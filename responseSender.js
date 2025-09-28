// --- START OF FILE responseSender.js ---

/**
 * responseSender.js - Módulo de Envio de Respostas do Bot (v. Robusta com TTS Refinado)
 * ============================================================================
 * Responsável por:
 * - Processar conteúdo textual (dividido por %%MSG_BREAK%% e limites de tamanho).
 * - Enviar partes de texto via WhatsApp, simulando digitação e delays.
 * - Orquestrar geração e envio de áudio TTS (via mediaHandler), se habilitado.
 *   TTS é gerado para o CONTEÚDO COMBINADO de todas as partes de texto da resposta atual.
 * - Garantir limpeza de arquivos TTS temporários.
 * - Registrar mensagens enviadas (texto e TTS) no histórico (via stateManager).
 * - Utilizar a instância do cliente WhatsApp para envio (via clientManager).
 * ============================================================================
 */

import fsPromises from "node:fs/promises";
import path from "node:path";
import pkg from "whatsapp-web.js"; // Para MessageMedia
const { MessageMedia } = pkg;

// --- Project Imports ---
import logger from "./logger.js";
import botConfig from "./botConfig.js";
import { sleep, splitResponseIntoMessages } from "./utils.js"; // Funções utilitárias
import mediaHandler from "./mediaHandler.js"; // Para gerar TTS
import { default as clientManager } from "./whatsappClient.js"; // Para obter o cliente wweb.js
import stateManager from "./stateManager.js"; // Para logar histórico APÓS envio bem sucedido
import { serializeError } from "serialize-error"; // Para logs de erro robustos
import salesFunnelBluePrint from "./salesFunnelBluePrint.js"; // Para verificar sendRecordMessage
import inactivityManager from "./inactivityManager.js"; // Para gerenciar timer de inatividade


// --- Sistema de Prevenção de Duplicação ---
const recentlySentMessages = new Map();
const DUPLICATE_PREVENTION_WINDOW = 5000; // 5 segundos
const MESSAGE_CLEANUP_INTERVAL = 60000; // 1 minuto

// Limpeza periódica do cache de mensagens
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentlySentMessages.entries()) {
    if (now - timestamp > DUPLICATE_PREVENTION_WINDOW * 2) {
      recentlySentMessages.delete(key);
    }
  }
}, MESSAGE_CLEANUP_INTERVAL);

/**
 * Verifica se uma mensagem é duplicada baseada no conteúdo e timing
 * @param {string} chatId - ID do chat
 * @param {string} content - Conteúdo da mensagem
 * @returns {boolean} - True se for duplicada
 */
function isDuplicateMessage(chatId, content) {
  const key = `${chatId}_${content.substring(0, 100).replace(/\s+/g, '_')}`;
  const now = Date.now();
  
  if (recentlySentMessages.has(key)) {
    const lastSent = recentlySentMessages.get(key);
    if (now - lastSent < DUPLICATE_PREVENTION_WINDOW) {
      logger.warn(
        `[Duplicate Prevention] Mensagem duplicada detectada para ${chatId}: "${content.substring(0, 50)}..."`
      );
      return true;
    }
  }
  
  // NÃO registra aqui - será registrado apenas após envio bem-sucedido
  return false;
}

/**
 * Registra uma mensagem como enviada no cache de prevenção de duplicação
 * @param {string} chatId - ID do chat
 * @param {string} content - Conteúdo da mensagem
 */
function markMessageAsSent(chatId, content) {
  const key = `${chatId}_${content.substring(0, 100).replace(/\s+/g, '_')}`;
  const now = Date.now();
  recentlySentMessages.set(key, now);
  logger.trace(
    `[Duplicate Prevention] Mensagem registrada como enviada: "${content.substring(0, 50)}..."`
  );
}

// --- Type Imports (JSDoc) ---
/**
 * @typedef {import('whatsapp-web.js').Chat} WAChat
 * @typedef {import('whatsapp-web.js').Client} WAClient
 * @typedef {import('whatsapp-web.js').Message} WAMessage
 * @typedef {import('whatsapp-web.js').MessageMedia} WAMessageMedia
 */

// ================================================================
// ===           ENVIO DE PARTE ÚNICA DE MENSAGEM               ===
// ================================================================

/**
 * Envia uma única parte de mensagem de texto, simulando digitação e tratando erros.
 * Função interna, chamada por sendMessages.
 * @param {WAChat | null} chat - Objeto Chat do wweb.js (para simular digitação). Null se não disponível.
 * @param {string} chatId - ID do chat de destino.
 * @param {string} messagePart - O conteúdo textual (já trimado) a ser enviado.
 * @param {number} partIndex - Índice da parte na sequência (para logs).
 * @param {number} totalParts - Total de partes na sequência (para logs).
 * @returns {Promise<boolean>} True se enviado com sucesso, False caso contrário.
 */
async function _sendSingleMessagePart(
  chat,
  chatId,
  messagePart,
  partIndex,
  totalParts
) {
  const client = clientManager.getClient();
  if (!client?.sendMessage) {
    logger.error(
      "[Response Sender] Cliente WhatsApp indisponível para envio de texto.",
      null,
      { chatId }
    );
    return false;
  }

  // Verificação adicional do estado do cliente
  const clientState = await clientManager.getClientState();
  if (clientState !== "CONNECTED" && clientState !== "READY") {
    logger.error(
      `[Response Sender] Cliente WhatsApp não está em estado válido: ${clientState}`,
      null,
      { chatId }
    );
    return false;
  }

  if (!messagePart) {
    logger.warn(
      `[Response Sender] Tentativa de enviar parte ${
        partIndex + 1
      }/${totalParts} vazia.`,
      null,
      { chatId }
    );
    return false;
  }

  // Verificação de duplicação de mensagem
  if (isDuplicateMessage(chatId, messagePart)) {
    logger.info(
      `[Response Sender] Mensagem duplicada detectada e bloqueada para ${chatId}: "${messagePart.substring(0, 50)}..."`
    );
    return true; // Retorna sucesso para não interromper o fluxo
  }

  const logPrefix = `[Part ${partIndex + 1}/${totalParts}]`;
  try {
    const canSimulateTyping = chat?.sendStateTyping;
    if (canSimulateTyping) {
      try {
        const typingConfig = botConfig.behavior.responseSettings.typingDelay;
        const minDelay = typingConfig.minMs;
        const maxDelay = typingConfig.maxMs;
        const CHARS_PER_SECOND = 20;
        const estimatedTimeMs = (messagePart.length / CHARS_PER_SECOND) * 1000;
        const BASE_DELAY_MS = 500;
        let calculatedDelay = BASE_DELAY_MS + estimatedTimeMs;
        const randomFactor = Math.random() * 0.3 - 0.15;
        calculatedDelay = calculatedDelay * (1 + randomFactor);
        const typingDuration = Math.max(
          minDelay,
          Math.min(maxDelay, Math.round(calculatedDelay))
        );

        await sleep(200);
        logger.trace(
          `${logPrefix} Calculado typingDuration: ${typingDuration}ms. Tentando definir estado 'digitando'...`,
          chatId
        );
        await chat.sendStateTyping();
        logger.trace(
          `${logPrefix} Estado 'digitando' definido. Aguardando ${typingDuration}ms...`,
          chatId
        );
        await sleep(typingDuration);
        logger.trace(
          `${logPrefix} Pausa de digitação de ${typingDuration}ms CONCLUÍDA.`,
          chatId
        );
      } catch (typingError) {
        logger.warn(
          `${logPrefix} Erro DURANTE simulação de digitação (continuando envio).`,
          typingError,
          chatId
        );
      }
    } else {
      const fallbackDelay = 500 + Math.random() * 300;
      logger.trace(
        `${logPrefix} Não é possível simular 'digitando'. Usando delay fixo de ${Math.round(
          fallbackDelay
        )}ms...`,
        chatId
      );
      await sleep(fallbackDelay);
    }

    logger.trace(
      `${logPrefix} Preparando para enviar mensagem AGORA...`,
      chatId
    );
    logger.trace(
      `${logPrefix} Enviando texto: "${messagePart.substring(0, 80)}..."`,
      chatId
    );
    
    // Verificação adicional de segurança para o cliente
    if (!client.info || !client.info.wid) {
      logger.error(
        `${logPrefix} Cliente WhatsApp não está completamente inicializado. Tentando reconectar...`,
        null,
        { chatId }
      );
      throw new Error("Cliente WhatsApp não inicializado completamente");
    }
    
    let sentMsg;
    try {
      sentMsg = await client.sendMessage(String(chatId), messagePart);
    } catch (sendError) {
      // Se o erro é de serialização, a mensagem pode ter sido enviada mesmo assim
      if (sendError.message?.includes("Cannot read properties of undefined (reading 'serialize')") ||
          sendError.message?.includes("getMessageModel")) {
        logger.warn(
          `${logPrefix} Erro de serialização detectado. Aguardando confirmação antes de prosseguir: "${messagePart.substring(0, 50)}..."`,
          chatId
        );
        
        // Aguarda um tempo para evitar duplicações por reenvio automático
        await sleep(3000); // 3 segundos de espera
        
        logger.info(
          `${logPrefix} Período de espera concluído. Considerando mensagem como enviada: "${messagePart.substring(0, 50)}..."`,
          chatId
        );
        
        // Assumimos que foi enviado e registramos no histórico
        await stateManager.addMessageToHistory(chatId, "assistant", messagePart);
        // Registra no cache de prevenção de duplicação
        markMessageAsSent(chatId, messagePart);
        logger.interaction(
          "SentText",
          `Contact_${chatId.split("@")[0]}`,
          chatId,
          `"${messagePart.substring(0, 70)}..." (${messagePart.length} chars) - com erro de serialização (aguardado)`
        );
        return true; // Considera como sucesso
      } else {
        // Outros erros são falhas reais de envio
        throw sendError;
      }
    }

    if (!sentMsg?.id) {
      logger.warn(
        `${logPrefix} Envio de texto para ${chatId} não retornou confirmação (ID). Status incerto.`,
        null,
        { chatId }
      );
      // Mesmo sem confirmação, assumimos sucesso se chegou até aqui sem erro
      await stateManager.addMessageToHistory(chatId, "assistant", messagePart);
      // Registra no cache de prevenção de duplicação
      markMessageAsSent(chatId, messagePart);
      logger.interaction(
        "SentText",
        `Contact_${chatId.split("@")[0]}`,
        chatId,
        `"${messagePart.substring(0, 70)}..." (${messagePart.length} chars) - sem confirmação`
      );
      return true;
    }
    // Log no histórico APÓS envio bem sucedido do texto
    // (Movido da função principal para cá para registrar cada parte)
    await stateManager.addMessageToHistory(chatId, "assistant", messagePart);
    // Registra no cache de prevenção de duplicação
    markMessageAsSent(chatId, messagePart);
    logger.interaction(
      "SentText",
      `Contact_${chatId.split("@")[0]}`, // Usa um nome de contato genérico se não tiver o real aqui
      chatId,
      `"${messagePart.substring(0, 70)}..." (${messagePart.length} chars)`
    );

    // Iniciar timer de inatividade após envio bem-sucedido do bot
    inactivityManager.startInactivityTimer(chatId);

    return true;
  } catch (error) {
    // Se chegou até aqui, é um erro que não foi tratado no try interno
    logger.error(
      `${logPrefix} Falha ao enviar texto para ${chatId}: "${messagePart.substring(0, 50)}..."`,
      serializeError(error),
      chatId
    );
    // Adiciona nota de falha no histórico para esta parte específica
    await stateManager.addMessageToHistory(
      chatId,
      "system",
      `[Sistema: Falha ao enviar msg texto: "${messagePart.substring(0, 50)}..."]`
    );
    return false;
  } finally {
    if (chat?.clearState) {
      try {
        logger.trace(
          `${logPrefix} Bloco finally: Tentando limpar estado do chat...`,
          chatId
        );
        await chat.clearState();
      } catch {
        /* ignora erro menor */
      }
    }
  }
}

// ================================================================
// ===           ENVIO DE ÁUDIO TTS                             ===
// ================================================================

/**
 * Calcula a duração aproximada do arquivo de áudio em milissegundos
 * com base no tamanho do arquivo.
 * @param {number} fileSizeBytes - Tamanho do arquivo em bytes
 * @returns {number} - Duração estimada em ms
 */
function _estimateAudioDuration(fileSizeBytes) {
  // Ajuste para reduzir significativamente o tempo de simulação:
  // - MP3 de 128kbps = aproximadamente 16KB por segundo, mas usamos um fator de ajuste
  // para reduzir o tempo de simulação mantendo uma proporção realista
  const BYTES_PER_SECOND = 48 * 1024; // 48KB por segundo (3x mais rápido)
  const durationSeconds = fileSizeBytes / BYTES_PER_SECOND;
  const durationMs = Math.round(durationSeconds * 1000);
  
  // Limite mínimo e máximo para durações razoáveis
  const minDuration = 1200; // Mínimo de 1.2 segundos (para não parecer instantâneo demais)
  const maxDuration = 20000; // Máximo de 12 segundos (para não ficar muito longo)
  
  return Math.min(maxDuration, Math.max(minDuration, durationMs));
}

/**
 * Envia um arquivo de áudio TTS gerado como mensagem de voz.
 * Simula gravação de áudio antes de enviar e limpa o arquivo após envio.
 * @param {WAChat | null} chat - Objeto Chat do wweb.js para simular gravação. Null se não disponível.
 * @param {string} chatId - ID do chat de destino.
 * @param {string} ttsAudioPath - Caminho completo para o arquivo de áudio TTS.
 * @param {string} originalCombinedText - Texto original combinado que gerou o áudio (para log).
 * @returns {Promise<boolean>} True se enviado com sucesso, False caso contrário.
 */
async function _sendTTSAudio(chat, chatId, ttsAudioPath, originalCombinedText) {
  const client = clientManager.getClient();
  if (!client?.sendMessage) {
    logger.error(
      "[Response Sender TTS] Cliente WhatsApp indisponível para envio de TTS.",
      null,
      { chatId }
    );
    fsPromises.unlink(ttsAudioPath).catch(() => {});
    return false;
  }

  // Verificação adicional do estado do cliente
  const clientState = await clientManager.getClientState();
  if (clientState !== "CONNECTED" && clientState !== "READY") {
    logger.error(
      `[Response Sender TTS] Cliente WhatsApp não está em estado válido: ${clientState}`,
      null,
      { chatId }
    );
    fsPromises.unlink(ttsAudioPath).catch(() => {});
    return false;
  }

  const fileName = path.basename(ttsAudioPath);
  logger.debug(
    `[Response Sender TTS] Preparando envio de ${fileName} para o texto combinado...`,
    chatId
  );

  try {
    // Obter tamanho do arquivo para calcular duração
    const stats = await fsPromises.stat(ttsAudioPath);
    const fileSizeBytes = stats.size;
    
    // Simular gravação de áudio se o chat estiver disponível
    const audioDurationMs = _estimateAudioDuration(fileSizeBytes);
    
    if (chat?.sendStateRecording) {
      try {
        logger.trace(
          `[Response Sender TTS] Simulando gravação por ${Math.round(audioDurationMs)}ms para ${fileName}...`,
          chatId
        );
        
        // Definir estado "gravando" imediatamente
        await chat.sendStateRecording();
        
        // Aguardar tempo proporcional à duração do áudio
        await sleep(audioDurationMs);
        
        // Limpar estado
        if (chat.clearState) {
          await chat.clearState();
        }
        
        logger.trace(
          `[Response Sender TTS] Simulação de gravação concluída para ${fileName}`,
          chatId
        );
      } catch (recordingError) {
        logger.warn(
          `[Response Sender TTS] Erro durante simulação de gravação (continuando envio)`,
          recordingError,
          chatId
        );
      }
    } else {
      // Se não puder simular gravação, ao menos faça uma pausa equivalente
      logger.trace(
        `[Response Sender TTS] Não é possível simular gravação. Usando delay fixo de ${Math.round(audioDurationMs)}ms...`,
        chatId
      );
      await sleep(audioDurationMs);
    }

    // Carregamos o MessageMedia APÓS a simulação de gravação
    // para não ter delay adicional entre simulação e envio
    let media = null;
    try {
      media = MessageMedia.fromFilePath(ttsAudioPath);
    } catch (mediaError) {
      logger.error(
        `[Response Sender TTS] Erro ao criar MessageMedia: ${fileName}`,
        mediaError,
        chatId
      );
      throw mediaError;
    }
    
    if (!media) {
      throw new Error(
        `MessageMedia.fromFilePath retornou nulo para ${fileName}.`
      );
    }

    // Enviar imediatamente após simulação
    logger.trace(
      `[Response Sender TTS] Enviando ${fileName} como voz...`,
      chatId
    );
    
    // Verificação adicional de segurança para o cliente
    if (!client.info || !client.info.wid) {
      logger.error(
        `[Response Sender TTS] Cliente WhatsApp não está completamente inicializado para envio de TTS.`,
        null,
        { chatId }
      );
      throw new Error("Cliente WhatsApp não inicializado completamente para TTS");
    }
    
    let sentMsg;
    try {
      sentMsg = await client.sendMessage(chatId, media, {
        sendAudioAsVoice: true,
      });
    } catch (sendError) {
      if (sendError.message?.includes("Cannot read properties of undefined (reading 'serialize')") ||
          sendError.message?.includes("getMessageModel")) {
        logger.warn(
          `[Response Sender TTS] Erro de serialização ao enviar TTS ${fileName}, mas mensagem pode ter sido enviada.`,
          chatId
        );
        await stateManager.addMessageToHistory(chatId, "assistant", originalCombinedText, Date.now(), { mediaType: 'tts', error: 'serialization_error' });
        // Registra no cache de prevenção de duplicação
        markMessageAsSent(chatId, originalCombinedText);
        inactivityManager.startInactivityTimer(chatId);
        return true;
      } else {
        throw sendError;
      }
    }

    if (!sentMsg?.id) {
      logger.warn(
        `[Response Sender TTS] Envio de TTS ${fileName} não retornou confirmação. Status incerto.`,
        null,
        { chatId }
      );
      await stateManager.addMessageToHistory(chatId, "assistant", originalCombinedText, Date.now(), { mediaType: 'tts', warning: 'no_confirmation_id' });
      // Registra no cache de prevenção de duplicação
      markMessageAsSent(chatId, originalCombinedText);
      inactivityManager.startInactivityTimer(chatId);
      return true;
    }

    logger.info(
      `[Response Sender TTS] Áudio TTS ${fileName} (para texto combinado) enviado com sucesso.`,
      chatId
    );
    await stateManager.addMessageToHistory(
      chatId,
      "assistant",
      originalCombinedText,
      Date.now(),
      { originalMsgId: sentMsg.id.id, mediaType: 'tts' }
    );
    // Registra no cache de prevenção de duplicação
    markMessageAsSent(chatId, originalCombinedText);
    
    inactivityManager.startInactivityTimer(chatId);
    
    return true;
  } catch (error) {
    // Se chegou até aqui, é um erro que não foi tratado no try interno
    logger.error(
      `[Response Sender TTS] Falha ao enviar áudio TTS ${fileName}`,
      serializeError(error),
      chatId
    );
    await stateManager.addMessageToHistory(
      chatId,
      "system",
      `[Sistema: Falha ao ENVIAR áudio TTS para texto combinado: "${originalCombinedText.substring(0, 70)}..."]`
    );
    return false;
  } finally {
    fsPromises
      .unlink(ttsAudioPath)
      .then(() =>
        logger.trace(
          `[Response Sender TTS] Arquivo temp TTS removido: ${fileName}`,
          chatId
        )
      )
      .catch((unlinkErr) => {
        if (unlinkErr.code !== "ENOENT") {
          logger.warn(
            `[Response Sender TTS] Falha menor ao remover arquivo temp TTS ${fileName}`,
            null,
            { error: unlinkErr.message }
          );
        }
      });
  }
}

/**
 * Verifica se o texto contém números de telefone ou links
 * @param {string} text - Texto a ser verificado
 * @returns {boolean} - True se contém números de telefone ou links
 */
function _containsPhoneNumbersOrLinks(text) {
  if (!text) return false;
  
  // Regex aprimorada para detectar números de telefone em diversos formatos
  // Cobre formatos brasileiros comuns e alguns formatos internacionais
  const phoneRegex = /(?:(?:\+|00)?\d{1,3}[\s-]?)?(?:\(?\d{2}\)?[\s-]?)?(?:\d{4,5}[\s-]?\d{4})|(?:\d{2}[\s-]?\d{4,5}[\s-]?\d{4})|(?:\d{2}[\s-]?\d{8,9})/g;
  
  // Regex aprimorada para detectar links
  const linkRegex = /(https?:\/\/[^\s]+)|(?:www\.)[^\s]+|([a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z0-9]{2,}([^\s]*\b)/gi;
  
  return phoneRegex.test(text) || linkRegex.test(text);
}

// ================================================================
// ===          ORQUESTRADOR PRINCIPAL DE ENVIO                 ===
// ================================================================

/**
 * Processa e envia uma ou mais respostas de texto para o usuário, com opção de TTS para o conteúdo combinado.
 * 1. Recebe um array de strings de resposta (geralmente da IA, potencialmente com %%MSG_BREAK%%).
 * 2. Subdivide strings que excedam `maxLengthChars`.
 * 3. Se `tryTTS` for true e a probabilidade for atendida:
 *    a. Verifica se a etapa atual do funil permite envio de áudio (sendRecordMessage).
 *    b. Combina TODAS as partes de texto que seriam enviadas.
 *    c. Tenta gerar UM ÚNICO áudio TTS para este texto combinado.
 *    d. Se a geração do TTS for bem-sucedida, ENVIA PRIMEIRO O ÁUDIO.
 *    e. Se o TTS for enviado com sucesso, NÃO envia as mensagens de texto.
 * 4. Se o TTS falhar ou não estiver habilitado, envia cada parte de texto sequencialmente.
 * 5. Registra mensagens enviadas (texto e TTS) e falhas no histórico.
 *
 * @param {WAChat | null} chat - Objeto Chat do wweb.js. Null se não disponível.
 * @param {string} chatId - ID do chat de destino.
 * @param {string} contactName - Nome do contato (para logs).
 * @param {string[]} messageContents - Array de strings de resposta.
 * @param {boolean} [tryTTS=false] - Se true, tenta gerar e enviar TTS para o conteúdo combinado.
 * @returns {Promise<boolean>} True se pelo menos uma parte (texto OU TTS) foi enviada com sucesso. False se todas as tentativas falharam.
 */
async function sendMessages(
  chat,
  chatId,
  contactName,
  messageContents,
  tryTTS = false
) {
  if (
    !chatId ||
    !Array.isArray(messageContents) ||
    messageContents.length === 0
  ) {
    logger.warn(
      "[Response Sender] Chamado sem chatId ou com array de mensagens vazio.",
      null,
      { chatId }
    );
    return false;
  }

  const finalMessagesToSend = [];
  const maxChars = botConfig.behavior.responseSettings.maxLengthChars;

  for (const content of messageContents) {
    // Se o conteúdo for um objeto de prova social do tipo 'text', usa o link
    if (typeof content === 'object' && content !== null && content.type === 'text' && content.link) {
      finalMessagesToSend.push(content.link.trim());
    } else if (typeof content === 'string' && content.trim()) {
      let trimmedContent = content.trim();
      

      
      if (trimmedContent.length > maxChars) {
        logger.trace(
          `[Response Sender] Subdividindo parte longa (${trimmedContent.length} > ${maxChars} chars)...`,
          chatId
        );
        try {
          const subParts = splitResponseIntoMessages(
            trimmedContent,
            contactName, // Passando contactName como contexto para o splitter
            maxChars
          );
          finalMessagesToSend.push(...subParts.filter((part) => part));
        } catch (splitError) {
          logger.error(
            `[Response Sender] Erro ao subdividir mensagem longa para ${chatId}.`,
            splitError
          );
        }
      } else {
        finalMessagesToSend.push(trimmedContent);
      }
    }
  }

  if (finalMessagesToSend.length === 0) {
    logger.warn(
      "[Response Sender] Nenhuma mensagem válida para enviar após pré-processamento.",
      null,
      { chatId }
    );
    return false;
  }

  let overallSuccess = false;
  logger.debug(
    `[Response Sender] Iniciando envio de ${finalMessagesToSend.length} parte(s) de texto para ${contactName}. TTS Habilitado globalmente: ${botConfig.tts.enabled}, Tentativa TTS para esta resposta: ${tryTTS}`,
    chatId
  );

  // --- Verificar se o texto contém links ou informações de preço (não usar TTS) ---
  const containsLinks = /https?:\/\/[^\s]+|www\.[^\s]+|\.com|\.me|\.ai|\.io/i.test(finalMessagesToSend.join(" "));
  const containsPricing = /R\$|preço|\$|plano|mensal|anual|investimento|pagamento|checkout/i.test(finalMessagesToSend.join(" "));
  
  // Se contiver links ou informações de preço, desabilitar TTS para esta mensagem
  if (containsLinks || containsPricing) {
    logger.debug(
      `[Response Sender] Pulando TTS por conter links/preços: links=${containsLinks}, pricing=${containsPricing}`,
      chatId
    );
    tryTTS = false;
  }

  // --- Tentar Gerar e Enviar TTS para o CONTEÚDO COMBINADO PRIMEIRO ---
  let ttsSentOkForCombined = false;
  const ttsConfig = botConfig.tts;
  const combinedTextForTTS = finalMessagesToSend.join(" "); // Junta todas as partes de texto

  // Verifica se o texto contém números de telefone ou links
  const hasPhoneNumbersOrLinks = _containsPhoneNumbersOrLinks(combinedTextForTTS);

  // Verifica se alguma das mensagens é um link de prova social (tipo 'text')
  // Esta verificação é um pouco simplista, idealmente o tipo de mensagem seria passado
  // ou inferido de forma mais robusta.
  const isSocialProofLink = messageContents.some(content => 
    typeof content === 'object' && content !== null && content.type === 'text' && content.link
  );

  // Verifica se a etapa atual do funil permite envio de áudio (sendRecordMessage)
  let stepAllowsAudio = true;
  try {
    const chatState = await stateManager.getChatState(chatId);
    if (chatState && chatState.currentFunnelStepId) {
      const currentStepBlueprint = salesFunnelBluePrint.getStepById(chatState.currentFunnelStepId);
      if (currentStepBlueprint && currentStepBlueprint.sendRecordMessage === false) {
        stepAllowsAudio = false;
        logger.debug(
          `[Response Sender] TTS desabilitado para etapa ${chatState.currentFunnelStepId} (sendRecordMessage: false)`,
          chatId
        );
      }
    }
  } catch (stateError) {
    logger.warn(
      `[Response Sender] Erro ao verificar estado da etapa para TTS: ${stateError.message}`,
      chatId
    );
    // Em caso de erro, permite TTS por segurança
  }

  const shouldAttemptTTS =
    tryTTS &&
    ttsConfig.enabled &&
    stepAllowsAudio && // Verifica se a etapa permite áudio
    combinedTextForTTS.length >= (ttsConfig.minTextLengthForTTS || 5) &&
    Math.random() < ttsConfig.usageProbability &&
    !hasPhoneNumbersOrLinks && // Não tenta TTS se houver números de telefone ou links
    !isSocialProofLink; // Não tenta TTS se for um link de prova social

  if (shouldAttemptTTS) {
    logger.info(
      `[Response Sender] Tentando gerar TTS para o texto combinado (${combinedTextForTTS.length} chars) para ${contactName}.`,
      chatId
    );
    const ttsResult = await mediaHandler.generateTTSAudio(
      combinedTextForTTS,
      chatId
    );
    if (ttsResult.success && ttsResult.filePath) {
      // Envia o áudio TTS usando a função atualizada com simulação de gravação
      ttsSentOkForCombined = await _sendTTSAudio(
        chat,
        chatId,
        ttsResult.filePath,
        combinedTextForTTS // Passa o texto combinado para log
      );
      if (ttsSentOkForCombined) {
        overallSuccess = true;
        // Se TTS foi enviado com sucesso, NÃO envia as mensagens de texto
        logger.debug(
          `[Response Sender] TTS enviado com sucesso. Pulando envio do texto.`,
          chatId
        );
        return true;
      } else {
        // IMPORTANTE: Se o TTS foi gerado mas FALHOU no envio, ainda assim NÃO envia texto
        // para evitar envio duplicado. O usuário receberá apenas uma notificação no histórico.
        logger.warn(
          `[Response Sender] TTS gerado mas falhou no envio. NÃO enviando texto para evitar duplicação.`,
          chatId
        );
        await stateManager.addMessageToHistory(
          chatId,
          "system",
          `[Sistema: TTS gerado mas falhou no envio. Mensagem não enviada para evitar duplicação.]`
        );
        return false; // Retorna false pois nenhuma mensagem foi enviada
      }
    } else {
      // Falha na GERAÇÃO do TTS (já logada em mediaHandler)
      logger.debug(
        `[Response Sender] Falha na geração do TTS. Continuando com envio de texto.`,
        chatId
      );
      await stateManager.addMessageToHistory(
        chatId,
        "system",
        `[Sistema: Falha ao GERAR áudio TTS para texto combinado: "${combinedTextForTTS.substring(
          0,
          70
        )}..." (Erro: ${ttsResult.errorType}). Enviando texto.]`
      );
    }
  } else if (!stepAllowsAudio) {
    // Log quando TTS é pulado devido à configuração da etapa
    logger.info(
      `[Response Sender] TTS desativado para etapa atual (sendRecordMessage: false) para ${contactName}.`,
      chatId
    );
    await stateManager.addMessageToHistory(
      chatId,
      "system",
      `[Sistema: TTS pulado - etapa não permite áudio]`
    );
  } else if (hasPhoneNumbersOrLinks) {
    // Log quando TTS é pulado devido a números de telefone ou links
    logger.info(
      `[Response Sender] TTS desativado para mensagem contendo números de telefone ou links para ${contactName}.`,
      chatId
    );
    await stateManager.addMessageToHistory(
      chatId,
      "system",
      `[Sistema: TTS pulado para texto contendo números de telefone ou links]`
    );
  } else if (tryTTS && ttsConfig.enabled) {
    // Log quando TTS é pulado por outras razões
    logger.info(
      `[Response Sender] TTS não tentado: probabilidade=${ttsConfig.usageProbability}, random=${Math.random()}, tamanho=${combinedTextForTTS.length}`,
      chatId
    );
  }

  // --- Envio Sequencial das Partes de TEXTO (somente se TTS falhou ou não foi habilitado) ---
  for (let i = 0; i < finalMessagesToSend.length; i++) {
    const part = finalMessagesToSend[i];
    logger.debug(
      `[Response Sender Loop] Preparando envio Texto Parte ${i + 1}/${
        finalMessagesToSend.length
      }: "${part.substring(0, 100)}..."`,
      chatId
    );

    const textPartSentOk = await _sendSingleMessagePart(
      chat,
      chatId,
      part,
      i,
      finalMessagesToSend.length
    );

    if (textPartSentOk) {
      overallSuccess = true; // Marca que pelo menos uma parte de texto teve sucesso
      // O log no histórico e o logger.interaction foram movidos para dentro de _sendSingleMessagePart
    } else {
      logger.error(
        `[Response Sender] Falha ao enviar parte de texto ${i + 1}/${
          finalMessagesToSend.length
        } para ${contactName}. Continuando sequência...`,
        chatId
      );
      // O log de falha no histórico também foi movido para _sendSingleMessagePart
      await sleep(1500); // Delay maior após falha de uma parte de texto
    }

    // Delay ENTRE partes de texto bem-sucedidas
    if (textPartSentOk && i < finalMessagesToSend.length - 1) {
      const betweenConfig =
        botConfig.behavior.responseSettings.betweenMessagesDelay;
      const betweenDelay =
        Math.floor(
          Math.random() * (betweenConfig.maxMs - betweenConfig.minMs + 1)
        ) + betweenConfig.minMs;
      if (betweenDelay > 0) {
        logger.trace(
          `[Response Sender] Pausando ${betweenDelay}ms entre partes de texto...`,
          chatId
        );
        await sleep(betweenDelay);
      }
    }
  } // --- Fim do Loop for (partes de texto) ---

  logger.debug(
    `[Response Sender] Sequência de envio concluída para ${contactName}. Sucesso geral: ${overallSuccess}`,
    chatId
  );
  return overallSuccess;
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

export default {
  sendMessages,
};
// --- END OF FILE responseSender.js ---
