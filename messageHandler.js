// --- START OF FILE messageHandler.js ---

/**
 * messageHandler.js - Orquestrador Central de Processamento de Mensagens
 * =======================================================================
 * Responsável por:
 * - Receber mensagens filtradas do whatsappClient.
 * - Gerenciar o estado do chat (obter/criar, verificar takeover/block).
 * - Implementar buffer e debounce para agrupar mensagens do usuário.
 * - Pré-processar tipos de mensagem (texto, áudio com transcrição, não suportados).
 * - Detectar spam.
 * - Orquestrar a resposta: decidir entre intervenção do sistema ou chamada da IA.
 * - Lidar com a detecção de intervenção humana.
 * *** ATUALIZAÇÃO: Lógica de ENTRADA no modo objeção movida para _handleBufferedMessages. ***
 * =======================================================================
 */

import logger from "./logger.js";
import botConfig from "./botConfig.js";
import { serializeError } from "serialize-error";
// ===> isSpamDetected foi movida para dentro deste arquivo <===
import {
  getGreetingTime,
  getFormattedHistoryForAI,
  normalizeString,
  sleep,
} from "./utils.js";
import stateManager from "./stateManager.js";
import mediaHandler from "./mediaHandler.js";
import * as aiProcessor from "./aiProcessor.js";
import responseSender from "./responseSender.js";
import pricing from "./pricing.js";
import { DEFAULT_LEAD_PREFIX } from "./constants.js";
import salesFunnelBluePrint from "./salesFunnelBluePrint.js";
import whatsappClient from "./whatsappClient.js"; // Importação adicionada para obter o client
import * as criticalStepExecutor from "./criticalStepExecutor.js"; // Executor de etapas críticas
import inactivityManager from "./inactivityManager.js"; // Sistema de inatividade

// --- Constantes e Estado do Módulo ---
const GROUPING_DELAY_MS =
  botConfig.behavior.responseSettings.groupingDelaySeconds * 1000;
const messageProcessingBuffer = {}; // Buffer in-memory { chatId: { messages: [], timeoutId: null, chat: object, isProcessingBuffer: boolean } }

// ================================================================
// ===                DETECÇÃO DE SPAM INTERNA                  ===
// ================================================================
/**
 * Verifica se uma mensagem ou sequência é considerada spam.
 * ATENÇÃO: Esta função MODIFICA os arrays messageTimestamps/audioTimestamps no objeto state passado!
 * @param {ChatState} state - O estado atual do chat (será modificado).
 * @param {string} messageType - Tipo da mensagem ('text', 'audio', 'ptt', etc.).
 * @param {import('whatsapp-web.js').Message | null} message - O objeto da mensagem (para verificar keywords).
 * @returns {{ detected: boolean, reason?: string, details?: object }}
 */
function _isSpamDetected(state, messageType = "other", message = null) {
  // (Lógica mantida como antes)
  if (!state || !state.id) return { detected: false };
  const chatId = state.id;
  const now = Date.now();
  const config = botConfig.behavior.antiSpam;
  // 1. Keywords
  if (
    messageType === "text" &&
    message?.body &&
    config.spamKeywords?.length > 0
  ) {
    const lowerBody = message.body.toLowerCase();
    const foundKeyword = config.spamKeywords.find(
      (kw) => kw && lowerBody.includes(kw.toLowerCase())
    );
    if (foundKeyword) {
      logger.debug(
        `[Spam Detect] Keyword "${foundKeyword}" detectada.`,
        chatId
      );
      return {
        detected: true,
        reason: `Keyword (${foundKeyword})`,
        details: {
          keyword: foundKeyword,
          message: message.body.substring(0, 100),
        },
      };
    }
  }
  // 2. Taxa de Mensagens
  const msgWindowMs = config.messageWindowSeconds * 1000;
  state.messageTimestamps = (state.messageTimestamps || []).filter(
    (ts) => now - ts < msgWindowMs
  );
  state.messageTimestamps.push(now);
  if (state.messageTimestamps.length > config.maxMessagesPerWindow) {
    const count = state.messageTimestamps.length;
    logger.debug(
      `[Spam Detect] Taxa Msgs Excedida (${count}/${config.maxMessagesPerWindow} em ${config.messageWindowSeconds}s).`,
      chatId
    );
    return {
      detected: true,
      reason: `Taxa Msgs (${count}/${config.messageWindowSeconds}s)`,
      details: {
        count,
        limit: config.maxMessagesPerWindow,
        windowSec: config.messageWindowSeconds,
      },
    };
  }
  // 3. Taxa de Áudios
  if (messageType === "audio" || messageType === "ptt") {
    const audioWindowMs = config.audioWindowMinutes * 60 * 1000;
    state.audioTimestamps = (state.audioTimestamps || []).filter(
      (ts) => now - ts < audioWindowMs
    );
    state.audioTimestamps.push(now);
    if (state.audioTimestamps.length > config.maxAudiosPerWindow) {
      const count = state.audioTimestamps.length;
      logger.debug(
        `[Spam Detect] Taxa Áudios Excedida (${count}/${config.maxAudiosPerWindow} em ${config.audioWindowMinutes}min).`,
        chatId
      );
      return {
        detected: true,
        reason: `Taxa Áudios (${count}/${config.audioWindowMinutes}min)`,
        details: {
          count,
          limit: config.maxAudiosPerWindow,
          windowMin: config.audioWindowMinutes,
        },
      };
    }
  }
  return { detected: false };
}

// ================================================================
// ===          PROCESSAMENTO DE MENSAGEM RECEBIDA             ===
// ================================================================
/**
 * Ponto de entrada principal para mensagens recebidas. Filtra, valida,
 * gerencia estado inicial, checa spam e adiciona ao buffer para processamento agrupado.
 * @param {import('whatsapp-web.js').Message} message - Objeto da mensagem.
 * @param {import('whatsapp-web.js').Client} client - Instância do cliente WWebJS.
 * @param {object} trainingData - Dados de treinamento carregados.
 */
async function processIncomingMessage(message, client, trainingData) {
  const messageReceiveTime = Date.now();
  const chatId = message.from;

  // --- Early Exit Checks --- //
  if (
    message.isStatus ||
    message.type === "call_log" ||
    message.fromMe ||
    !chatId
  )
    return;
    
  // Rejeita explicitamente mensagens de grupos
  if (chatId.endsWith('@g.us')) {
    logger.debug("[Msg Handler] Ignorando mensagem de grupo. Grupos não são suportados.");
    return;
  }
  
  // Verifica formato de chatId individual (suporta Baileys e WhatsApp Business API)
  if (!chatId.endsWith("@c.us") && !chatId.endsWith("@s.whatsapp.net")) {
    logger.debug(`[Msg Handler] Ignorando mensagem com formato de chatId inválido: ${chatId}`);
    return;
  }
  
  if (message.type === "revoked") return;

  // ✅ MELHORIA CRÍTICA: Aborta qualquer fluxo de inatividade EM ANDAMENTO e cancela timers futuros.
  // Isso resolve a race condition onde o usuário responde enquanto a mensagem de inatividade está sendo processada.
  try {
    inactivityManager.abortInactivityFlow(chatId);
  } catch (timerError) {
    logger.error(
      `[Msg Handler] Erro ao abortar o fluxo de inatividade para ${chatId}.`,
      timerError
    );
  }

  let chat;
  try {
    chat = await message.getChat();
    if (!chat || chat.isGroup) {
      logger.debug("[Msg Handler] Ignorando mensagem de grupo detectado via getChat()");
      return; // Ignora grupos - verificação adicional
    }
  } catch (chatErr) {
    logger.error(
      `[Msg Handler] Erro getChat p/ msg ${message.id.id}. Ignorando.`,
      chatErr,
      chatId
    );
    return;
  }

  const contactName = await stateManager.getContactName(message, chat);
  // DEBUG LOG: Verificar lista de ignorados
  logger.debug(
    `[Msg Handler] Checking ignored list. Loaded: ${JSON.stringify(
      botConfig.behavior.ignoredNumbers
    )}`
  );
  if (botConfig.behavior.ignoredNumbers?.includes(chatId)) {
    logger.debug(
      `[Msg Handler] Ignorado ${contactName} (${chatId}): Remetente na lista de ignorados.`
    );
    return;
  }

  let state = await stateManager.getChatState(chatId, contactName);
  if (!state) {
    logger.error(
      `[Msg Handler] Falha CRÍTICA obter/criar estado p/ ${contactName}. Ignorada.`,
      null,
      chatId
    );
    return;
  }

  // ✅ CORREÇÃO: Aguarda 100ms para garantir que o INSERT commitou no DB
  // Isso previne race condition onde updateState é chamado antes do commit
  if (!state.lastInteractionTimestamp || state.lastInteractionTimestamp === state.createdAt) {
    logger.debug(`[Msg Handler] Estado novo detectado. Aguardando commit no DB...`, chatId);
    await sleep(100);
    // Recarrega estado para ter versão commitada
    state = await stateManager.getChatState(chatId, contactName);
    if (!state) {
      logger.error(`[Msg Handler] Falha ao recarregar estado após criação`, chatId);
      return;
    }
  }

  const now = Date.now();
  if (state.humanTakeoverUntil && now < state.humanTakeoverUntil) {
    logger.debug(
      `[Msg Handler] Ignorada ${state.name}: Takeover ativo.`,
      chatId
    );
    return;
  }
  if (state.isBlockedUntil && now < state.isBlockedUntil) {
    logger.debug(
      `[Msg Handler] Ignorada ${state.name}: Usuário bloqueado.`,
      chatId
    );
    return;
  }

  // *** Checagem de SPAM antes do buffer ***
  const spamCheck = _isSpamDetected(state, message.type, message); // Usa função interna
  if (spamCheck.detected) {
    await stateManager.blockUserForSpam(
      chat,
      chatId,
      state.name,
      spamCheck.reason,
      spamCheck.details
    );
    clearProcessingBuffer(chatId, `Bloqueado por spam (${spamCheck.reason})`);
    return;
  }

  // ✅ CORREÇÃO: Atualizar timestamps mas preservar contadores de reengajamento
  // Isso permite que o sistema continue tentativas de reengajamento sem resetar completamente
  const updateData = {
    lastInteractionTimestamp: new Date().toISOString(),
    lastUserMessageTimestamp: new Date().toISOString(),
  };
  
  // Só resetar contadores se for uma resposta real (não reengajamento)
  const isResponseToReengagement = await _isResponseToReengagementMessage(chatId, message.body, state);
  if (!isResponseToReengagement) {
    // Reset apenas se não for resposta a reengajamento
    updateData.reengagementAttempts = 0;
    updateData.lastReengagementMessageSentAt = null;
    updateData.nextInactivityStage = 'first_attempt';
    updateData.currentInactivityStage = null;
    updateData.inactivityStageCompletedAt = null;
    updateData.maxReengagementReachedAt = null;
  }
  
  await stateManager.updateState(chatId, updateData);

  // 🛡️ PROTEÇÃO: Se for resposta a reengajamento, processar de forma simplificada
  if (isResponseToReengagement) {
    logger.info(`[Msg Handler] Resposta detectada para mensagem de reengajamento. Processando de forma simplificada.`, chatId);
    await _handleReengagementResponse(chat, chatId, state, message.body);
    return;
  }

  // --- Processamento do Tipo de Mensagem ---
  let messageDataForBuffer = {
    id: message.id.id,
    type: message.type,
    content: null, // Será preenchido se for texto ou áudio transcrito
    timestamp: message.timestamp
      ? message.timestamp * 1000
      : messageReceiveTime,
    error: null, // Indica erro no processamento da mensagem
    mediaInfo: null, // Guarda informações adicionais da mídia
    originalMsgId: message.id?.id || null, // ID da mensagem original para citação (quoted)
  };
  const msgPreview = (
    message.body ||
    message.caption ||
    `(${message.type})`
  ).substring(0, 50);
  logger.interaction(
    "Received",
    state.name,
    chatId,
    `[${message.type}] "${msgPreview}..."`
  );
  let sendErrorNotification = false;
  let errorMessageToSend = null;

  switch (message.type) {
    case "chat":
      messageDataForBuffer.content = message.body;
      break;
    case "audio":
    case "ptt":
      if (botConfig.openai.whisperModel !== "disabled") {
        // Tenta transcrever
        const audioResult = await mediaHandler.downloadAndTranscribeAudio(
          message,
          chatId
        );
        if (audioResult.text) {
          messageDataForBuffer.content = audioResult.text;
          messageDataForBuffer.mediaInfo = {
            type: message.type,
            duration: audioResult.duration || null,
          };
          // Adiciona log ANTES de bufferizar, indicando SUCESSO na transcrição
          await stateManager.addMessageToHistory(
            chatId,
            "system",
            `[Sistema: Áudio (${
              message.type
            }) recebido e transcrito: "${audioResult.text.substring(
              0,
              50
            )}..."]`
          );
        } else {
          // Falha na transcrição
          messageDataForBuffer.error = audioResult.errorType;
          errorMessageToSend =
            audioResult.errorType === "download_failed"
              ? botConfig.behavior.errorHandling.audioDownloadFailed(state.name)
              : botConfig.behavior.errorHandling.audioTranscription(state.name);
          sendErrorNotification = true;
          await stateManager.addMessageToHistory(
            chatId,
            "system",
            `[Sistema: Falha ao processar áudio (${message.type}). Erro: ${audioResult.errorType}. Notificado usuário.]`
          );
        }
      } else {
        // Transcrição desativada
        messageDataForBuffer.error = "transcription_disabled";
        logger.info(
          `[Msg Handler] Áudio (${message.type}) de ${state.name} ignorado (transcrição desativada).`,
          chatId
        );
        errorMessageToSend =
          botConfig.behavior.errorHandling.audioTranscription(state.name); // Informa que não processa áudio
        sendErrorNotification = true;
        await stateManager.addMessageToHistory(
          chatId,
          "system",
          `[Sistema: Áudio (${message.type}) ignorado (transcrição desativada)]`
        );
      }
      break;
    case "image":
    case "video":
    case "sticker":
    case "document":
    case "location":
    case "vcard":
    case "multi_vcard":
    case "list_response":
    case "buttons_response":
    case "order":
    case "product":
    case "contact_card":
      const mediaType = message.type;
      messageDataForBuffer.error = "unsupported_media";
      logger.info(
        `[Msg Handler] Tipo não suportado (${mediaType}) de ${state.name}. Notificando.`,
        chatId
      );
      errorMessageToSend = botConfig.behavior.errorHandling.unsupportedMedia(
        state.name,
        mediaType
      );
      sendErrorNotification = true;
      await stateManager.addMessageToHistory(
        chatId,
        "system",
        `[Sistema: Recebido tipo não suportado (${mediaType}). Notificado usuário.]`
      );
      break;
    default:
      logger.warn(
        `[Msg Handler] Tipo desconhecido/ignorado: ${message.type} de ${state.name}`,
        chatId
      );
      messageDataForBuffer = null; // Não adiciona ao buffer
      break;
  }

  // Envia notificação de erro SE necessário (imediatamente, fora do buffer)
  if (sendErrorNotification && errorMessageToSend) {
    await responseSender.sendMessages(
      chat,
      chatId,
      state.name,
      [errorMessageToSend],
      false,
      null // userMessage não disponível neste contexto
    );
  }

  // --- LÓGICA DE BUFFER RENOVADA --- //
  if (messageDataForBuffer && !messageDataForBuffer.error) {
    // Só bufferiza se não houve erro processando a msg
    let bufferEntry = messageProcessingBuffer[chatId];

    if (!bufferEntry) {
      logger.trace(
        `[Buffer Create] Criando novo buffer para ${chatId}`,
        chatId
      );
      bufferEntry = {
        messages: [],
        timeoutId: null,
        chat: chat,
        isProcessingBuffer: false,
      };
      messageProcessingBuffer[chatId] = bufferEntry;
      
      // ❌ NÃO iniciar timer aqui - apenas após bot responder
      // Timer será iniciado/resetado apenas quando bot terminar de enviar mensagens
      logger.debug(
        `[Buffer Create] Buffer criado, timer será iniciado após resposta do bot`,
        chatId
      );
    }

    bufferEntry.messages.push(messageDataForBuffer);
    const bufferSize = bufferEntry.messages.length;
    logger.trace(
      `[Buffer Add] Msg (${messageDataForBuffer.type}) add p/ ${state.name}. Buffer: ${bufferSize}`,
      chatId
    );
    
    // REMOVIDO: Timer NÃO deve ser resetado quando mensagem entra no buffer
    // Timer será resetado apenas APÓS processamento bem-sucedido das mensagens
    // Isso evita conflitos com detecção de inatividade

    if (bufferEntry.timeoutId) {
      clearTimeout(bufferEntry.timeoutId);
      logger.trace(
        `[Buffer Timeout] Timeout anterior cancelado para ${chatId}`,
        chatId
      );
      bufferEntry.timeoutId = null;
    }

    if (!bufferEntry.isProcessingBuffer) {
      logger.trace(
        `[Buffer Timeout] Agendando novo timeout (${GROUPING_DELAY_MS}ms) para ${chatId}`,
        chatId
      );
      bufferEntry.timeoutId = setTimeout(async () => {
        const currentBufferEntry = messageProcessingBuffer[chatId];
        if (currentBufferEntry && !currentBufferEntry.isProcessingBuffer) {
          currentBufferEntry.isProcessingBuffer = true;
          currentBufferEntry.timeoutId = null;

          // Cria cópias dos dados do buffer antes de limpá-lo
          const messagesToProcess = [...currentBufferEntry.messages];
          const chatObjToProcess = currentBufferEntry.chat;
          // Limpa o buffer original AQUI, antes de chamar o handler
          currentBufferEntry.messages = [];

          try {
            await _handleBufferedMessages(
              chatId,
              trainingData,
              messagesToProcess, // Passa a cópia
              chatObjToProcess // Passa o objeto chat
            );
          } catch (handlerError) {
            logger.error(
              `[Buffer Timeout] Erro não capturado retornado por _handleBufferedMessages para ${chatId}`,
              serializeError(handlerError),
              chatId
            );
          } finally {
            // Libera a flag interna do buffer APÓS _handleBufferedMessages concluir
            if (messageProcessingBuffer[chatId]) {
              // Verifica se ainda existe
              messageProcessingBuffer[chatId].isProcessingBuffer = false;
            }
            logger.trace(
              `[Buffer Timeout] Flag isProcessingBuffer liberada para ${chatId}`,
              chatId
            );
          }
        } else if (currentBufferEntry?.isProcessingBuffer) {
          logger.warn(
            `[Buffer Timeout] Timeout disparado para ${chatId}, mas buffer já estava sendo processado. Ignorando chamada duplicada.`,
            chatId
          );
          if (currentBufferEntry) currentBufferEntry.timeoutId = null;
        } else {
          logger.warn(
            `[Buffer Timeout] Timeout disparado para ${chatId}, mas buffer não existe mais. Ignorando.`,
            chatId
          );
        }
      }, GROUPING_DELAY_MS);
    } else {
      logger.trace(
        `[Buffer Add] Buffer para ${chatId} já está sendo processado. Mensagem apenas adicionada.`,
        chatId
      );
    }
  } else if (!messageDataForBuffer) {
    logger.trace(
      `[Msg Handler] Mensagem de ${state.name} não gerou dados para buffer.`,
      chatId
    );
  } else {
    // Caso de messageDataForBuffer.error ser true
    logger.trace(
      `[Msg Handler] Mensagem de ${state.name} com erro (${messageDataForBuffer.error}). Buffer não processado.`,
      chatId
    );
  }
}

// ================================================================
// ===           PROCESSAMENTO DO BUFFER DE MENSAGENS           ===
// ================================================================

/**
 * Valida com a IA se o texto do usuário é realmente uma objeção/dúvida
 * que deve ser tratada pelo fluxo de objeções.
 * 
 * @param {string} userText - Texto completo do usuário
 * @param {string} chatId - ID do chat
 * @param {object} state - Estado atual do chat
 * @param {string} currentStepId - Etapa atual do funil
 * @returns {Promise<boolean>} - True se for uma objeção legítima, False caso contrário
 */


/**
 * Processa as mensagens acumuladas no buffer para um chat específico.
 * Inclui detecção de ENTRADA no modo objeção.
 *
 * @param {string} chatId - ID do chat.
 * @param {object} trainingData - Dados de treinamento carregados.
 * @param {Array<object>} bufferedMessages - Array de objetos de mensagem bufferizados.
 * @param {import('whatsapp-web.js').Chat | null} chat - O objeto chat do WWebJS.
 */
async function _handleBufferedMessages(
  chatId,
  trainingData,
  bufferedMessages,
  chat
) {
  logger.debug(
    `[Buffer Proc ENTRY] Iniciando _handleBufferedMessages para ${chatId} com ${
      bufferedMessages?.length || 0
    } mensagens`,
    chatId
  );
  if (!bufferedMessages || bufferedMessages.length === 0) {
    logger.warn(
      `[Buffer Proc] Chamada com buffer vazio para ${chatId}. Saindo.`,
      chatId
    );
    // Se o buffer está sendo processado e ficou vazio, limpa a flag isProcessingBuffer
    if (messageProcessingBuffer[chatId]) {
      messageProcessingBuffer[chatId].isProcessingBuffer = false;
    }
    return;
  }

  let state = null;
  let effectiveStepIdForAI = null;
  let funnelStepIdToSaveInDB = null; // O que será salvo no DB como currentFunnelStepId
  let metadataToSaveInDB = null; // O que será salvo no DB como metadata

  try {
    state = await stateManager.getChatState(chatId);
    if (!state) {
      logger.error(
        `[Buffer Proc] Falha ao obter estado inicial para ${chatId}. Saindo.`,
        chatId
      );
      if (messageProcessingBuffer[chatId]) {
        // Garante liberação da flag de processamento do buffer
        messageProcessingBuffer[chatId].isProcessingBuffer = false;
      }
      return;
    }

    const currentStepIdFromState = state.currentFunnelStepId;
    const currentMetadataFromState = state.metadata || {};
    const combinedUserText = bufferedMessages
      .map((msg) => msg.content)
      .filter(Boolean)
      .join("\n");

    // ================================================================
    // ===           VERIFICAÇÃO DE CORREÇÃO DE NOME                ===
    // ================================================================
    // Verifica se o usuário está corrigindo seu nome antes do processamento normal
    if (combinedUserText && combinedUserText.trim().length > 0) {
      const { detectNameCorrection, processGlobalNameCorrection } = await import('./aiProcessor.js');
      const nameCorrection = await detectNameCorrection(combinedUserText);
      
      if (nameCorrection.isCorrection) {
        logger.info(
          `[Name Correction] Correção de nome detectada para ${chatId}: "${nameCorrection.newName}"`,
          chatId
        );
        
        // Processa a correção globalmente
        await processGlobalNameCorrection(chatId, state, combinedUserText);
        
        // Recarrega o estado após a correção
        state = await stateManager.getChatState(chatId);
        if (!state) {
          logger.error(
            `[Name Correction] Falha ao recarregar estado após correção de nome para ${chatId}`,
            chatId
          );
          return;
        }
        
        logger.info(
          `[Name Correction] Correção de nome processada para ${chatId}. Continuando com o fluxo normal.`,
          chatId
        );
        
        // NÃO retorna aqui - continua com o processamento normal do fluxo
        // O nome corrigido será usado automaticamente na próxima resposta da IA
      }
    }

    // Inicializa com os valores atuais do estado
    effectiveStepIdForAI = currentStepIdFromState;
    funnelStepIdToSaveInDB = currentStepIdFromState;
    metadataToSaveInDB = { ...currentMetadataFromState }; // Cria cópia para modificar
    // LOGIC TO ADVANCE FROM GREETING_NEW
    /*
    if (currentStepIdFromState === "GREETING_NEW") {
      // Affirmative keywords and isAffirmativeResponse logic removed.
      // Now, if the state is GREETING_NEW, it will attempt to advance by default.
      // The logic to handle negative responses/objections should prevent this advance if necessary.
      logger.info(
        `[Buffer Proc Decision] Processing GREETING_NEW. Attempting to advance to PROBLEM_EXPLORATION_INITIAL.`,
        chatId
      );
      const nextStep = salesFunnelBluePrint.getNextStep("GREETING_NEW", state); // Pass state
      if (nextStep) {
          effectiveStepIdForAI = nextStep;
          funnelStepIdToSaveInDB = nextStep;
          // Limpar metadados específicos da saudação, se houver, ou preparar para a próxima etapa
          metadataToSaveInDB = {
              ...currentMetadataFromState,
  
              // Outros metadados relevantes para a transição podem ser definidos aqui
          };
          await stateManager.recordStepTransition(
              chatId,
              currentStepIdFromState,
              nextStep,
              "Advanced from GREETING_NEW (default behavior)"
          );
      } else {
          logger.warn(`[Buffer Proc Decision] Não foi possível obter nextStep para GREETING_NEW. Mantendo GREETING_NEW.`, chatId);
      }
    }
    */

    // Lógica simplificada: processar normalmente na etapa atual
    // A IA será responsável por identificar e responder a dúvidas e objeções diretamente
    logger.debug(
      `[Buffer Proc Decision] Processando mensagem na etapa atual: ${effectiveStepIdForAI}`,
        chatId
      );

    // ATUALIZAR ESTADO NO DB COM A DECISÃO DE ETAPA E METADADOS
    // Só atualiza se houve mudança na etapa que será salva ou nos metadados
    if (
      funnelStepIdToSaveInDB !== currentStepIdFromState ||
      JSON.stringify(metadataToSaveInDB) !==
        JSON.stringify(currentMetadataFromState)
    ) {
      logger.debug(
        `[Buffer Proc StateUpdate] Atualizando estado no DB ANTES da trava: currentFunnelStepId=${funnelStepIdToSaveInDB}, metadata mudou? ${
          JSON.stringify(metadataToSaveInDB) !==
          JSON.stringify(currentMetadataFromState)
        }`,
        chatId
      );
      const stateUpdated = await stateManager.updateState(chatId, {
        currentFunnelStepId: funnelStepIdToSaveInDB,
        metadata: metadataToSaveInDB,
      });
      if (stateUpdated) {
        state = await stateManager.getChatState(chatId); // Recarrega para ter o estado mais recente para a IA
        if (!state)
          throw new Error(
            "Falha crítica ao obter estado após atualização pré-IA."
          );
      } else {
        logger.error(
          `[Buffer Proc StateUpdate] Falha ao persistir atualização de estado para ${funnelStepIdToSaveInDB}. A IA processará ${effectiveStepIdForAI}, mas o DB pode estar com ${currentStepIdFromState}.`,
          chatId
        );
        // Se falhou em salvar, 'state' (e seus metadados) ainda são os antigos.
        // 'effectiveStepIdForAI' reflete a decisão lógica, mesmo que não persistida.
        // Considerar se deve prosseguir ou lançar erro aqui. Por ora, prossegue com a etapa decidida.
      }
    } else {
      logger.trace(
        `[Buffer Proc StateUpdate] Estado do funil e metadados não alterados antes da trava. Sem update no DB necessário nesta fase.`,
        chatId
      );
      // 'state' já está atualizado (é o que foi lido no início)
    }

    // --- Verificação da Trava (usando o estado MAIS RECENTE do DB ou o carregado se não houve update) ---
    const MAX_PROCESSING_TIME =
      (botConfig.behavior.processingTimeoutMinutes || 5) * 60 * 1000;
    if (state.isProcessing && state.processingStartTime) {
      const processingTime = Date.now() - state.processingStartTime;
      if (processingTime > MAX_PROCESSING_TIME) {
        logger.warn(
          `[Buffer Proc] Trava DB detectada como travada para ${chatId} por ${Math.round(
            processingTime / 1000
          )}s. Liberando...`,
          chatId
        );
        await stateManager.updateState(chatId, {
          isProcessing: false,
          processingStartTime: null,
        });
        state = await stateManager.getChatState(chatId); // Recarrega
        if (!state)
          throw new Error(
            "Falha crítica ao obter estado após liberar trava travada."
          );
      } else {
        logger.debug(
          `[Buffer Proc] Chat ${chatId} já processando (trava DB ativa e não expirada). Saindo.`,
          chatId
        );
        // Se já está processando, não deve continuar este fluxo. Libera a flag do buffer.
        if (messageProcessingBuffer[chatId]) {
          messageProcessingBuffer[chatId].isProcessingBuffer = false;
        }
        return;
      }
    }

    // --- Aquisição da Trava ---
    logger.debug(
      `[Buffer Proc] Adquirindo trava (setando isProcessing=true) para ${chatId}`,
      chatId
    );
    const lockTimestamp = Date.now();
    const lockAcquired = await stateManager.updateState(chatId, {
      isProcessing: true,
      processingStartTime: lockTimestamp,
    });
    if (!lockAcquired) {
      logger.error(
        `[Buffer Proc] Falha ao adquirir trava no DB para ${chatId}. Saindo.`,
        chatId
      );
      if (messageProcessingBuffer[chatId]) {
        // Libera flag do buffer
        messageProcessingBuffer[chatId].isProcessingBuffer = false;
      }
      return;
    }
    // Atualiza a cópia local do estado com a trava
    state.isProcessing = true;
    state.processingStartTime = lockTimestamp;
    // O currentFunnelStepId e metadata em 'state' são os que foram lidos/atualizados acima.

    logger.debug(
      `[Buffer Proc] Processando ${bufferedMessages.length} mensagens para ${chatId} (Etapa para IA: ${effectiveStepIdForAI}, DB Step: ${state.currentFunnelStepId}, trava adquirida)`,
      chatId
    );

    // Adiciona mensagens ao histórico e guarda o ID da última mensagem
    let lastOriginalMsgId = null;
    for (const msg of bufferedMessages.sort(
      (a, b) => a.timestamp - b.timestamp
    )) {
      await stateManager.addMessageToHistory(chatId, "user", msg.content);
      // Guarda o ID da última mensagem para citação
      if (msg.originalMsgId) {
        lastOriginalMsgId = msg.originalMsgId;
      }
    }

    // Salva o originalMsgId no metadata para uso posterior
    if (lastOriginalMsgId) {
      logger.debug(
        `[Buffer Proc] Salvando originalMsgId no metadata: ${lastOriginalMsgId}`,
        chatId
      );
      await stateManager.updateState(chatId, {
        metadata: {
          ...metadataToSaveInDB,
          lastOriginalMsgId: lastOriginalMsgId
        }
      });
    }

    // Recarrega o estado APÓS adições ao histórico para passar à IA.
    // Isso garante que a IA veja as mensagens mais recentes no histórico.
    // O estado do funil (etapa, metadata) já foi definido e salvo antes.
    const stateForAI = await stateManager.getChatState(chatId);
    if (!stateForAI)
      throw new Error(
        "Falha crítica ao re-obter estado após add histórico e antes da IA."
      );
    // Restaura a trava na cópia que vai para a IA, pois getChatState não retorna isProcessing
    stateForAI.isProcessing = true;
    stateForAI.processingStartTime = lockTimestamp;

    // ================================================================
    // ===           PROTEÇÃO DE ETAPAS CRÍTICAS                    ===
    // ================================================================
    
    // Verificar se há uma etapa crítica que precisa ser executada antes de processar mensagens
    const currentStepId = stateForAI.currentFunnelStepId;
    if (stateManager.isCriticalStep(currentStepId)) {
      const shouldExecuteCritical = await criticalStepExecutor.shouldExecuteCriticalStep(chatId, currentStepId);
      
      if (shouldExecuteCritical) {
        logger.info(
          `[Critical Protection] Executando etapa crítica ${currentStepId} antes de processar mensagens para ${chatId}`,
          chatId
        );
        
        // Executar etapa crítica primeiro
        const criticalExecuted = await criticalStepExecutor.executeCriticalStep(
          chatId,
          currentStepId,
          trainingData
        );
        
        if (criticalExecuted) {
          logger.info(
            `[Critical Protection] Etapa crítica ${currentStepId} executada com sucesso. Continuando com processamento normal.`,
            chatId
          );
          
          // Recarregar estado após execução crítica
          const updatedState = await stateManager.getChatState(chatId);
          if (updatedState) {
            updatedState.isProcessing = true;
            updatedState.processingStartTime = lockTimestamp;
            Object.assign(stateForAI, updatedState);
          }
        } else {
          logger.warn(
            `[Critical Protection] Falha ao executar etapa crítica ${currentStepId}. Continuando com processamento normal.`,
            chatId
          );
        }
      }
    }
    
    // ================================================================
    // ===           PROCESSAMENTO NORMAL COM IA                    ===
    // ================================================================

    if (combinedUserText) {
      // ATUALIZAR lastUserInput no estado antes de chamar a IA
      logger.debug(
        `[Buffer Proc] Atualizando lastUserInput no estado: "${combinedUserText.substring(
          0,
          100
        )}..."`,
        chatId
      );
      
      // Atualiza o lastUserInput no estado
      await stateManager.updateState(chatId, {
        lastUserInput: combinedUserText
      });
      
      // Recarrega o estado para ter o lastUserInput atualizado
      const updatedStateWithInput = await stateManager.getChatState(chatId);
      if (updatedStateWithInput) {
        updatedStateWithInput.isProcessing = true;
        updatedStateWithInput.processingStartTime = stateForAI.processingStartTime;
        Object.assign(stateForAI, updatedStateWithInput);
      }
      
      logger.debug(
        `[Buffer Proc] Calling AI with combined text: "${combinedUserText.substring(
          0,
          100
        )}..."`,
        chatId
      );
      const transcriptionFailed = bufferedMessages.some(
        (msg) => msg.mediaInfo?.type === "audio" && !msg.content
      ); // Verifica se algum áudio falhou
      await aiProcessor.callAndRespondWithAI(
        chat,
        chatId,
        stateForAI, // Passa o estado lido após histórico, com a trava
        combinedUserText,
        transcriptionFailed,
        trainingData,
        effectiveStepIdForAI // Passa a etapa efetiva determinada pela lógica acima
      );
    } else {
      logger.debug(
        `[Buffer Proc] No text content in buffer for ${chatId}. Skipping AI call.`,
        chatId
      );
    }
    // ❌ NÃO resetar timer aqui - apenas quando bot terminar de enviar mensagens
    // Timer será resetado/iniciado no aiProcessor após envio bem-sucedido das respostas
    logger.debug(
      `[Buffer Proc] Processamento de ${bufferedMessages.length} mensagem(s) concluído, aguardando resposta do bot`,
      chatId
    );
    
    logger.debug(
      `[Buffer Proc] Processamento concluído para ${chatId}`,
      chatId
    );
  } catch (error) {
    logger.error(
      `[Buffer Proc] Erro GERAL no processamento do buffer para ${chatId}: ${error.message}`,
      serializeError(error),
      chatId
    );
  } finally {
    logger.debug(
      `[Buffer Proc] Liberando trava isProcessing para ${chatId} no finally.`,
      chatId
    );
    await stateManager
      .updateState(chatId, { isProcessing: false, processingStartTime: null })
      .catch((e) =>
        logger.error(
          `[Buffer Proc] Falha CRÍTICA ao liberar trava DB no finally para ${chatId}`,
          serializeError(e),
          chatId
        )
      );

    // Libera a flag de processamento do buffer em memória
    if (messageProcessingBuffer[chatId]) {
      messageProcessingBuffer[chatId].isProcessingBuffer = false;
      logger.trace(
        `[Buffer Proc] Flag isProcessingBuffer (em memória) liberada para ${chatId} no finally.`,
        chatId
      );
    }
  }
}

// ================================================================
// ===           INTERVENÇÕES DO SISTEMA (Checkout, Suporte)    ===
// ================================================================
// (Função _handleSystemIntervention MANTIDA COMO ANTES)
async function _handleSystemIntervention(
  chat,
  chatId,
  contactName,
  userFullText,
  state
) {
  // ... (lógica mantida) ...
  const currentStepId = state.currentFunnelStepId;
  const mainProductId = botConfig.behavior.salesStrategy.targetProductId;
  // Intervenção 1: Link Checkout Principal (Exemplo - AJUSTE OS IDS DAS ETAPAS)
  if (
    currentStepId === "CLOSE_DEAL" /* ou etapa similar onde o link é esperado */
  ) {
    const planId = state.recommendedPlanId; // Ou puxe de outra lógica
    if (planId) {
      const link = pricing.getCheckoutLink(planId, mainProductId);
      if (link) {
        // Não precisa fazer nada aqui, pois o fluxo normal da etapa CLOSE_DEAL já envia o link
        // Poderia adicionar lógica extra se necessário
      }
    }
  }
  // Intervenção 4: Encaminhar Suporte
  const supportKeywords = [
    "suporte",
    "ajuda técnica",
    "falar com humano",
    "atendente",
    "problema",
    "erro",
    "não funciona",
    "configurar",
    "configuração",
    "consultor",
    "especialista", // Adicionado
  ];
  // Usar uma regex mais robusta que busca palavras inteiras
  const isPotentiallySupport = new RegExp(
    `\\b(${supportKeywords.join("|")})\\b`,
    "i"
  ).test(userFullText);
  // Evitar encaminhar se for claramente uma pergunta de vendas
  const isLikelySalesQuestion =
    /preço|quanto custa|valor|plano|comprar|adquirir|boleto|pix|cartão|link/i.test(
      userFullText
    );
  // Evitar encaminhar novamente logo após compra ou encaminhamento anterior
  const isPostActionContext =
    currentStepId.includes("POST_PURCHASE") ||
    currentStepId.includes("ONBOARDING") ||
    state.lastAction?.includes("LINK_SENT") ||
    state.lastAction?.includes("SUPPORT_FORWARDED");
  // Exigir um mínimo de detalhe para não encaminhar "?" ou "ok"
  const isSufficientlyDetailed =
    userFullText.length > 10 || userFullText.split(" ").length > 2;

  if (
    isPotentiallySupport &&
    !isLikelySalesQuestion &&
    !isPostActionContext &&
    isSufficientlyDetailed
  ) {
    const supportNumber = botConfig.behavior.support.whatsappNumber;
    if (supportNumber) {
      const forwardMessage =
        botConfig.behavior.support.forwardMessageTemplate(contactName);
      logger.info(
        `[System Intervention] Detectado pedido de suporte para ${contactName}. Encaminhando...`,
        chatId
      );
      await responseSender.sendMessages(
        chat,
        chatId,
        contactName,
        [forwardMessage],
        false,
        null // userMessage não disponível neste contexto
      );
      await stateManager.addMessageToHistory(
        chatId,
        "system",
        `[Sistema: Encaminhado para Suporte (${supportNumber})]`
      );
      await stateManager.updateState(chatId, {
        lastAction: "SUPPORT_FORWARDED",
      });
      return true; // Indica que houve intervenção
    } else {
      logger.warn(
        `[System Intervention] Pedido de suporte detectado para ${contactName}, mas número de suporte não configurado!`,
        chatId
      );
      // Opcional: Enviar mensagem indicando que não há suporte disponível
      // await responseSender.sendMessages(chat, chatId, contactName, ["Desculpe, nosso canal de suporte não está disponível no momento."]);
      return false; // Não houve intervenção efetiva
    }
  }
  return false; // Nenhuma intervenção realizada
}

// ================================================================
// ===              DETECÇÃO DE INTERVENÇÃO HUMANA              ===
// ================================================================

/**
 * Verifica se a resposta do usuário é para uma mensagem de reengajamento recente
 * @param {string} chatId - ID do chat
 * @param {string} userMessage - Mensagem do usuário
 * @param {object} state - Estado atual do chat
 * @returns {Promise<boolean>} Se é uma resposta para reengajamento
 */
async function _isResponseToReengagementMessage(chatId, userMessage, state) {
  try {
    // Verifica se há uma mensagem de reengajamento recente no histórico
    const recentHistory = state.messageHistory?.slice(-10) || [];
    const lastBotMessage = recentHistory
      .filter(msg => msg.role === 'assistant')
      .pop();
    
    if (!lastBotMessage) return false;
    
    // Verifica se a última mensagem do bot é uma mensagem de reengajamento
    const reengagementPatterns = [
      /ainda está aí/i,
      /continua interessad/i,
      /gostaria de continuar/i,
      /posso ajudar/i,
      /tem alguma dúvida/i,
      /quer saber mais/i,
      /ainda tem interesse/i
    ];
    
    const isReengagementMessage = reengagementPatterns.some(pattern => 
      pattern.test(lastBotMessage.content)
    );
    
    if (!isReengagementMessage) return false;
    
    // Verifica se a resposta do usuário é uma resposta típica a reengajamento
    const userResponsePatterns = [
      /^(sim|s)$/i,
      /^(não|nao|n)$/i,
      /^(ok|okay)$/i,
      /^(oi|olá|ola)$/i,
      /^(continua|continue)$/i,
      /^(tenho interesse|interessad)$/i,
      /^(quero saber mais)$/i
    ];
    
    const isTypicalResponse = userResponsePatterns.some(pattern => 
      pattern.test(userMessage?.trim() || '')
    );
    
    // Verifica se a mensagem de reengajamento foi enviada recentemente (últimos 30 minutos)
    const messageTime = new Date(lastBotMessage.timestamp || 0).getTime();
    const now = Date.now();
    const timeDiff = now - messageTime;
    const isRecent = timeDiff < (30 * 60 * 1000); // 30 minutos
    
    logger.debug(
      `[Reengagement Check] Bot msg pattern: ${isReengagementMessage}, User response pattern: ${isTypicalResponse}, Recent: ${isRecent} (${Math.round(timeDiff/1000)}s ago)`,
      chatId
    );
    
    return isReengagementMessage && isTypicalResponse && isRecent;
  } catch (error) {
    logger.error(
      `[Msg Handler] Erro ao verificar resposta de reengajamento: ${error.message}`,
      error,
      chatId
    );
    return false;
  }
}

/**
 * Processa resposta do usuário para mensagem de reengajamento de forma simplificada
 * @param {object} chat - Objeto chat do WhatsApp
 * @param {string} chatId - ID do chat
 * @param {object} state - Estado atual do chat
 * @param {string} userMessage - Mensagem do usuário
 */
async function _handleReengagementResponse(chat, chatId, state, userMessage) {
  try {
    const contactName = state.name || 'Cliente';
    
    // Adiciona a mensagem do usuário ao histórico
    await stateManager.addMessageToHistory(chatId, 'user', userMessage);
    
    // Determina o tipo de resposta baseado na mensagem do usuário
    const isPositiveResponse = /^(sim|s|ok|okay|oi|olá|ola|continua|continue|tenho interesse|interessad|quero saber mais)$/i.test(userMessage?.trim() || '');
    const isNegativeResponse = /^(não|nao|n)$/i.test(userMessage?.trim() || '');
    
    let responseMessage;
    
    if (isPositiveResponse) {
      // Resposta positiva - continuar com o fluxo normal
      responseMessage = `Ótimo, ${contactName}! Vou continuar de onde paramos. Em que posso ajudá-lo agora?`;
      
      // Adiciona resposta ao histórico
      await stateManager.addMessageToHistory(chatId, 'assistant', responseMessage);
      
      // Envia a mensagem
      await responseSender.sendMessages(
        chat,
        chatId,
        contactName,
        [responseMessage],
        false,
        userMessage
      );
      
      logger.info(`[Reengagement Response] Resposta positiva processada para ${contactName}`, chatId);
      
    } else if (isNegativeResponse) {
      // Resposta negativa - mensagem de despedida
      responseMessage = `Entendo, ${contactName}. Fico à disposição caso mude de ideia. Tenha um ótimo dia!`;
      
      // Adiciona resposta ao histórico
      await stateManager.addMessageToHistory(chatId, 'assistant', responseMessage);
      
      // Envia a mensagem
      await responseSender.sendMessages(
        chat,
        chatId,
        contactName,
        [responseMessage],
        false
      );
      
      // Marca como não interessado
      await stateManager.updateState(chatId, {
        lastAction: 'REENGAGEMENT_DECLINED',
        metadata: {
          ...state.metadata,
          reengagementDeclined: true,
          declinedAt: new Date().toISOString()
        }
      });
      
      logger.info(`[Reengagement Response] Resposta negativa processada para ${contactName}`, chatId);
      
    } else {
      // Resposta ambígua - pedir esclarecimento
      responseMessage = `${contactName}, não entendi bem sua resposta. Você gostaria de continuar nossa conversa? Responda 'sim' ou 'não', por favor.`;
      
      // Adiciona resposta ao histórico
      await stateManager.addMessageToHistory(chatId, 'assistant', responseMessage);
      
      // Envia a mensagem
      await responseSender.sendMessages(
        chat,
        chatId,
        contactName,
        [responseMessage],
        false
      );
      
      logger.info(`[Reengagement Response] Resposta ambígua processada para ${contactName}`, chatId);
    }
    
    // Atualiza estado com informações do reengajamento
    await stateManager.updateState(chatId, {
      lastAction: 'REENGAGEMENT_RESPONSE_PROCESSED',
      lastInteractionTimestamp: new Date().toISOString(),
      metadata: {
        ...state.metadata,
        lastReengagementResponse: {
          message: userMessage,
          type: isPositiveResponse ? 'positive' : isNegativeResponse ? 'negative' : 'ambiguous',
          processedAt: new Date().toISOString()
        }
      }
    });
    
  } catch (error) {
    logger.error(
      `[Reengagement Response] Erro ao processar resposta de reengajamento: ${error.message}`,
      error,
      chatId
    );
    
    // Em caso de erro, envia mensagem de fallback
    try {
      const fallbackMessage = `Desculpe, ${state.name || 'Cliente'}, tive um problema técnico. Em que posso ajudá-lo?`;
      await responseSender.sendMessages(
        chat,
        chatId,
        state.name || 'Cliente',
        [fallbackMessage],
        false
      );
    } catch (fallbackError) {
      logger.error(
        `[Reengagement Response] Falha crítica ao enviar mensagem de fallback`,
        fallbackError,
        chatId
      );
    }
  }
}

/**
 * Verifica se uma mensagem corresponde aos padrões de reengajamento automático
 * @param {string} messageBody - Corpo da mensagem
 * @param {string} contactName - Nome do contato
 * @returns {boolean} Se é uma mensagem de reengajamento
 */
function isReengagementMessage(messageBody, contactName) {
  // Padrões mais amplos das mensagens de reengajamento/fallback
  const reengagementPatterns = [
    /percebi que nossa conversa.*ficou pausada/i,
    /nossa conversa sobre.*estava.*interessante/i,
    /sei que questões de direito sucessório podem ser complexas/i,
    /sei que o tema pode ser complexo/i,
    /espero que esteja bem.*gostaria de continuar/i,
    /que tal continuarmos.*onde paramos/i,
    /que tal continuarmos.*conversa/i,
    /tenho informações importantes que podem te ajudar/i,
    /estou aqui para te ajudar quando quiser continuar/i,
    /gostaria de retomar nossa conversa/i,
    /vamos continuar.*direito sucessório/i,
    /podemos continuar nossa conversa/i,
    /tudo bem por aí.*podemos continuar/i,
    /oi amigo.*conversa/i,
    /oi.*que tal continuarmos/i,
    /vamos.*continuar.*falando/i,
    /que tal retomarmos/i
  ];
  
  // Verifica se contém o nome do contato (indicativo de personalização)
  const containsContactName = contactName && contactName !== "Cliente" && contactName !== "amigo(a)" &&
    messageBody.toLowerCase().includes(contactName.toLowerCase());
  
  // Verifica se corresponde aos padrões
  const matchesPattern = reengagementPatterns.some(pattern => pattern.test(messageBody));
  
  // Verifica emojis típicos de reengajamento
  const hasReengagementEmojis = /😊|🙂|💙|😀/.test(messageBody);
  
  // Palavras-chave específicas de reengajamento
  const reengagementKeywords = ['direito sucessório', 'sucessão', 'conversa', 'pausada', 'continuar', 'retomar', 'retomarmos'];
  const hasReengagementKeywords = reengagementKeywords.some(keyword => 
    messageBody.toLowerCase().includes(keyword)
  );
  
  // Estrutura típica de reengajamento: Nome + emoji + pergunta sobre continuar
  const isTypicalReengagementStructure = containsContactName && hasReengagementEmojis && 
    (messageBody.includes('?') || messageBody.includes('!')) &&
    (hasReengagementKeywords || messageBody.toLowerCase().includes('tudo bem'));
  
  return (matchesPattern || isTypicalReengagementStructure);
}

async function checkHumanIntervention(message, client) {
  // Verifica se a mensagem é enviada pelo cliente (via Web ou dispositivo móvel)
  const isOutgoingMessage = message.fromMe;
  
  // Extrair chatId de forma segura
  let chatId = null;
  if (isOutgoingMessage) {
    chatId = message.to;
  } else {
    chatId = message.from;
  }
  
  // Validação estrita do chatId
  if (!chatId || typeof chatId !== 'string') {
    logger.debug(
      "[Takeover Detect] Ignorando verificação: chatId inválido",
      { messageId: message.id?.id || "unknown" }
    );
    return false;
  }
  
  // Rejeita grupos explicitamente
  if (chatId.endsWith('@g.us')) {
    logger.debug("[Takeover Detect] Ignorando verificação de grupo. Grupos não são suportados.");
    return false;
  }
  
  if (!message.body) {
    logger.trace(
      "[Takeover Detect] Ignorando verificação: mensagem sem corpo",
      chatId
    );
    return false;
  }
  
  try {
    const state = await stateManager.getChatState(chatId);
    if (!state) {
      logger.trace(
        "[Takeover Detect] Ignorando verificação: estado não encontrado",
        chatId
      );
      return false;
    }
    
    const now = Date.now();
    const contactName = state.name || "Cliente";

    // Verifica se NÃO está em takeover e se NÃO está processando
    if (
      !state.isProcessing &&
      (!state.humanTakeoverUntil || state.humanTakeoverUntil < now)
    ) {
      // Se for mensagem de saída (enviada pelo cliente)
      if (isOutgoingMessage) {
        const history = state.history || [];
        // Pega as últimas mensagens do BOT
        const lastBotMsgsContent = history
          .filter((m) => m.role === "assistant")
          .slice(-5)
          .map((m) => m.content?.trim())
          .filter(Boolean);

        const currentSentBody = message.body.trim();

        // Verifica se a mensagem enviada corresponde a uma mensagem do bot
        let isLikelyBotMessage = false;
        
        // 1. Verificação exata de mensagens do histórico
        if (lastBotMsgsContent.some((botMsg) => botMsg === currentSentBody)) {
          isLikelyBotMessage = true;
        } 
        // 2. Verificação de mensagens muito curtas (ambíguas)
        else if (currentSentBody.length <= 5) {
          isLikelyBotMessage = true;
        }
        // 3. Verificação de mensagens de reengajamento (padrões conhecidos)
        else if (isReengagementMessage(currentSentBody, contactName)) {
          isLikelyBotMessage = true;
          logger.debug(`[Takeover Detect] Mensagem identificada como reengajamento automático para ${contactName}`, chatId);
        }
        // 4. Verificação temporal melhorada - se foi enviada logo após reengajamento
        else if (state.lastReengagementMessageSentAt) {
          const timeSinceReengagement = Date.now() - new Date(state.lastReengagementMessageSentAt).getTime();
          if (timeSinceReengagement < 15000) { // Aumentado para 15 segundos
            isLikelyBotMessage = true;
            logger.debug(`[Takeover Detect] Mensagem enviada ${timeSinceReengagement}ms após reengajamento - considerada automática`, chatId);
          }
        }
        // 5. Verificação de flag de reengajamento ativo
        else if (state.isReengagementMessageBeingSent) {
          isLikelyBotMessage = true;
          logger.debug(`[Takeover Detect] Flag de reengajamento ativa - mensagem considerada automática`, chatId);
        }
        // 6. Verificação de correspondência exata com última mensagem de reengajamento
        else if (state.lastReengagementMessage && currentSentBody === state.lastReengagementMessage) {
          isLikelyBotMessage = true;
          logger.debug(`[Takeover Detect] Mensagem idêntica à última mensagem de reengajamento`, chatId);
        }

        // Se a mensagem enviada NÃO parece ser do bot e é substancial
        if (!isLikelyBotMessage && currentSentBody.length > 5) {
          // Verificação adicional: se foi enviada muito próximo ao reengajamento, pode ser automática
          let isWithinReengagementWindow = false;
          if (state.lastReengagementMessageSentAt) {
            const timeSinceReengagement = Date.now() - new Date(state.lastReengagementMessageSentAt).getTime();
            if (timeSinceReengagement < 10000) { // 10 segundos
              isWithinReengagementWindow = true;
              logger.debug(`[Takeover Detect] Mensagem enviada ${timeSinceReengagement}ms após reengajamento - considerada automática`, chatId);
            }
          }

          // Verificação final: se está dentro da janela de reengajamento, não é takeover
          if (isWithinReengagementWindow) {
            logger.debug(`[Takeover Detect] Mensagem ignorada por estar dentro da janela de reengajamento`, chatId);
            return false;
          }

          logger.info(
            `[Takeover Detect] Intervenção humana detectada p/ ${contactName}. Ativando takeover e redirecionando para suporte...`,
            chatId
          );
          
          // 1. Ativa o takeover por 120 minutos (2 horas)
          const agentName = client.info?.pushname || "Agente (Web/Cel)";
          
          // Duração específica de 120 minutos (substitui o valor do config)
          const customTakeoverMinutes = 120;
          const takeoverUntil = now + (customTakeoverMinutes * 60 * 1000);
          
          // Atualizar estado diretamente
          await stateManager.updateState(chatId, {
            humanTakeoverUntil: takeoverUntil,
            isProcessing: false,
            // Pula para a etapa de suporte
            currentFunnelStepId: "GENERAL_SUPPORT"
          });
          
          // Registra a ação no histórico
          await stateManager.addMessageToHistory(
            chatId,
            "system",
            `[Sistema: Takeover ativado por ${agentName}. Bot pausado por ${customTakeoverMinutes} minutos. Redirecionado para etapa de SUPORTE.]`
          );
          
          logger.debug(
            `[Takeover Redirect] ${contactName} redirecionado para GENERAL_SUPPORT. Takeover ativo por ${customTakeoverMinutes} minutos.`,
            chatId
          );
          
          // Se o bot estava ativamente processando algo, limpamos o buffer
          if (messageProcessingBuffer[chatId]) {
            clearProcessingBuffer(chatId, "Takeover humano ativado");
          }
          
          return true; // Indica que a intervenção foi processada
        }
      }
    } else {
      logger.trace(
        `[Takeover Detect] Ignorando verificação para ${contactName}: Takeover já ativo ou Bot está processando.`,
        chatId
      );
    }
  } catch (error) {
    logger.error(
      `[Takeover Detect] Erro ao verificar intervenção para ${chatId}.`,
      serializeError(error),
      chatId
    );
  }
  
  return false; // Nenhuma intervenção detectada/processada
}

// ================================================================
// ===                 FUNÇÕES AUXILIARES INTERNAS              ===
// ================================================================
// (Função clearProcessingBuffer MANTIDA COMO ANTES)
/**
 * Obtém informações do buffer de um chat
 * @param {string} chatId - ID do chat
 * @returns {object|null} Informações do buffer ou null
 */
function getBufferInfo(chatId) {
  const bufferEntry = messageProcessingBuffer[chatId];
  if (!bufferEntry) {
    return null;
  }
  
  return {
    messageCount: bufferEntry.messages.length,
    isProcessing: bufferEntry.isProcessingBuffer,
    hasTimeout: bufferEntry.timeoutId !== null
  };
}

function clearProcessingBuffer(chatId, reason) {
  const bufferEntry = messageProcessingBuffer[chatId];
  if (bufferEntry) {
    const bufferedCount = bufferEntry.messages.length;
    if (bufferEntry.timeoutId) {
      clearTimeout(bufferEntry.timeoutId);
    }
    delete messageProcessingBuffer[chatId];
    if (bufferedCount > 0)
      logger.debug(
        `[Buffer Clear] Buffer (${bufferedCount} msgs) limpo p/ ${chatId}. Razão: ${reason}`,
        chatId
      );
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================
export { processIncomingMessage, checkHumanIntervention, clearProcessingBuffer, getBufferInfo };

// --- END OF FILE messageHandler.js ---
