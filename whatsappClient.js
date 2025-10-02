// --- START OF FILE whatsappClient.js ---

/**
 * whatsappClient.js - Módulo Cliente WhatsApp (Evolution API) (v. Refatorada)
 * =======================================================================
 * Responsável por:
 * - Inicializar e configurar conexão com Evolution API via HTTP.
 * - Gerenciar instância do WhatsApp: criar, conectar, QR code, status.
 * - Processar webhooks recebidos da Evolution API.
 * - Delegar o processamento de mensagens recebidas para o messageHandler.
 * - Fornecer acesso controlado à API e seu estado.
 * =======================================================================
 */

// --- Node.js & Third-Party Imports ---
import axios from "axios";
import { serializeError } from "serialize-error";

// --- Project Imports ---
import logger from "./logger.js";
import botConfig from "./botConfig.js";
import { sleep, parseIntEnv } from "./utils.js";
import {
  processIncomingMessage,
  checkHumanIntervention,
} from "./messageHandler.js";

// --- Module State ---
let instanceName = null; // Nome da instância Evolution API
let isClientReady = false; // Flag: Instância conectada e pronta
let isInitializing = false; // Flag: Processo de inicialização em andamento
let connectionCheckInterval = null; // Intervalo para verificar status de conexão
let clientReadyResolve = null; // Resolve da Promise de inicialização
let clientReadyReject = null; // Reject da Promise de inicialização

// --- Evolution API Configuration ---
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || "http://localhost:8080";
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || "CHANGE_THIS_API_KEY_FOR_SECURITY";
const EVOLUTION_INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "sales-bot-instance";
const WEBHOOK_URL = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/webhook`;

// Timeouts
const INIT_TIMEOUT_MS = parseIntEnv(
  process.env.WAPP_CLIENT_INIT_TIMEOUT_MS,
  180000,
  "WAPP_CLIENT_INIT_TIMEOUT_MS"
); // 3 minutos
const QR_CHECK_INTERVAL_MS = 5000; // Verifica QR a cada 5 segundos
const CONNECTION_CHECK_INTERVAL_MS = 10000; // Verifica conexão a cada 10 segundos

// ================================================================
// ===               FUNÇÕES DE CONTROLE DO CLIENTE             ===
// ================================================================

/**
 * Cria um cliente HTTP configurado para Evolution API
 */
function createApiClient() {
  return axios.create({
    baseURL: EVOLUTION_API_URL,
    headers: {
      "apikey": EVOLUTION_API_KEY,
      "Content-Type": "application/json",
    },
    timeout: 30000,
  });
}

/**
 * Inicializa e configura a conexão com Evolution API.
 * Retorna uma Promise que resolve quando a instância está conectada.
 * @param {object} trainingData - Dados de treinamento/contexto.
 * @returns {Promise<void>}
 * @throws {Error} Se a inicialização falhar criticamente.
 */
async function initialize(trainingData) {
  if (isInitializing || isClientReady) {
    logger.warn(
      "[Evolution API Init] Inicialização já em progresso ou instância já conectada."
    );
    return new Promise((res, rej) => {
      if (isClientReady) {
        res();
      } else {
        const originalResolve = clientReadyResolve;
        const originalReject = clientReadyReject;
        clientReadyResolve = () => {
          if (originalResolve) originalResolve();
          res();
        };
        clientReadyReject = (err) => {
          if (originalReject) originalReject(err);
          rej(err);
        };
      }
    });
  }

  isInitializing = true;
  isClientReady = false;
  instanceName = EVOLUTION_INSTANCE_NAME;

  logger.startup(
    "[Evolution API Init] Configurando e inicializando conexão com Evolution API..."
  );
  logger.wapp("Initializing Evolution API client...");

  return new Promise(async (resolve, reject) => {
    clientReadyResolve = resolve;
    clientReadyReject = reject;

    const timeoutId = setTimeout(() => {
      logger.fatal("[Evolution API Init] Timeout na inicialização!");
      _handleFatalError("INIT_TIMEOUT", new Error("Timeout na inicialização"));
    }, INIT_TIMEOUT_MS);

    try {
      const apiClient = createApiClient();

      // 1. Verificar se a instância já existe
      logger.info(`[Evolution API Init] Verificando instância '${instanceName}'...`);
      let instanceExists = false;

      try {
        const fetchResponse = await apiClient.get(`/instance/fetchInstances`, {
          params: { instanceName }
        });
        instanceExists = fetchResponse.data && fetchResponse.data.length > 0;
      } catch (error) {
        logger.debug("[Evolution API Init] Instância não encontrada, será criada.");
      }

      // 2. Criar ou reconectar à instância
      if (!instanceExists) {
        logger.info(`[Evolution API Init] Criando nova instância WhatsApp Business '${instanceName}'...`);

        const WA_BUSINESS_PHONE_NUMBER_ID = process.env.WA_BUSINESS_PHONE_NUMBER_ID || "785005758035788";
        const WA_BUSINESS_ID = process.env.WA_BUSINESS_ID || "1950390949146130";

        const createResponse = await apiClient.post("/instance/create", {
          instanceName: instanceName,
          token: EVOLUTION_API_KEY,
          integration: "WHATSAPP-BUSINESS",
          number: WA_BUSINESS_PHONE_NUMBER_ID,
          businessId: WA_BUSINESS_ID
        });

        logger.info(`[Evolution API Init] Instância WhatsApp Business criada: ${createResponse.data.instance.instanceName}`);
        logger.info(`📱 A instância foi criada e está no estado: ${createResponse.data.instance.status}`);
      } else {
        logger.info(`[Evolution API Init] Instância '${instanceName}' já existe.`);
      }

      // 3. Verificar se já está conectada
      logger.info(`[Evolution API Init] Verificando status de conexão...`);

      // Para WhatsApp Business API, verificar connectionStatus em fetchInstances
      const fetchStatusResponse = await apiClient.get(`/instance/fetchInstances`);
      const instancesList = fetchStatusResponse.data;
      let currentState = "UNKNOWN";
      let isWhatsAppBusiness = false;

      if (Array.isArray(instancesList)) {
        const currentInstance = instancesList.find(inst => inst.name === instanceName);
        if (currentInstance) {
          currentState = currentInstance.connectionStatus || "UNKNOWN";
          isWhatsAppBusiness = currentInstance.integration === "WHATSAPP-BUSINESS";
        }
      }

      logger.info(`[Evolution API Init] Estado atual: ${currentState} (${isWhatsAppBusiness ? 'WhatsApp Business API' : 'Baileys'})`);

      // Para WhatsApp Business API, sempre considerar "open" se a instância existe
      if (isWhatsAppBusiness || currentState === "open") {
        // Já está conectada!
        logger.ready(`🟢 Evolution API já conectada! [${instanceName}]`);
        clearTimeout(timeoutId);
        isInitializing = false;
        isClientReady = true;

        if (clientReadyResolve) {
          clientReadyResolve();
          clientReadyResolve = null;
          clientReadyReject = null;
        }
        return;
      }

      // 4. Se está fechada/desconectada, tentar reconectar (apenas para Baileys)
      if (currentState === "close" && instanceExists && !isWhatsAppBusiness) {
        logger.warn(`[Evolution API Init] Instância Baileys existe mas está desconectada (${currentState}).`);
        logger.info(`📱 AÇÃO NECESSÁRIA: Verifique se o número WhatsApp Business está ativo na Evolution API.`);
        logger.info(`   - Acesse o painel da Evolution API`);
        logger.info(`   - Verifique a instância: ${instanceName}`);
        logger.info(`   - Certifique-se de que o número WhatsApp Business está conectado`);
      }

      // 5. Conectar à instância (isso pode gerar novo QR code se necessário)
      logger.info(`[Evolution API Init] Conectando instância '${instanceName}'...`);

      try {
        const connectResponse = await apiClient.get(`/instance/connect/${encodeURIComponent(instanceName)}`);
        logger.debug(`[Evolution API Init] Resposta de conexão:`, connectResponse.data);
      } catch (connectError) {
        logger.warn(`[Evolution API Init] Erro ao conectar (esperado se precisa QR):`, connectError.message);
      }

      // 6. Verificar status da conexão e QR code
      await _checkConnectionStatus(apiClient, timeoutId);

    } catch (error) {
      clearTimeout(timeoutId);
      logger.fatal(
        "[Evolution API Init] Erro CRÍTICO na inicialização!",
        serializeError(error)
      );
      _handleFatalError("INIT_FAILURE", error);
    }
  });
}

/**
 * Verifica o status da conexão para WhatsApp Business API
 * @private
 */
async function _checkConnectionStatus(apiClient, timeoutId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = INIT_TIMEOUT_MS / CONNECTION_CHECK_INTERVAL_MS;

    connectionCheckInterval = setInterval(async () => {
      attempts++;

      try {
        const statusResponse = await apiClient.get(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
        const state = statusResponse.data?.instance?.state || statusResponse.data?.state;

        logger.debug(`[Evolution API] Estado da conexão: ${state} (tentativa ${attempts}/${Math.floor(maxAttempts)})`);

        if (state === "open") {
          // Conexão estabelecida!
          clearInterval(connectionCheckInterval);
          clearTimeout(timeoutId);

          logger.ready(
            `🟢🟢🟢 WHATSAPP BUSINESS API CONECTADA! [${instanceName}] 🟢🟢🟢`
          );
          logger.wapp("Client Ready", null, { instanceName, state });

          isInitializing = false;
          isClientReady = true;

          if (clientReadyResolve) {
            clientReadyResolve();
            clientReadyResolve = null;
            clientReadyReject = null;
          }

          resolve();
        } else if (state === "close") {
          // WhatsApp Business API desconectada - precisa verificar no painel da Evolution
          if (attempts % 6 === 0) { // A cada 60 segundos (6 * 10s)
            logger.warn(
              `[Evolution API] Instância ainda desconectada. Verifique o painel da Evolution API.`
            );
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(connectionCheckInterval);
          clearTimeout(timeoutId);

          logger.error(
            `[Evolution API] Timeout aguardando conexão após ${Math.floor(INIT_TIMEOUT_MS/1000)}s`
          );
          logger.error(
            `   A instância '${instanceName}' está em estado '${state}'.`
          );
          logger.error(
            `   Verifique se o número WhatsApp Business está configurado corretamente na Evolution API.`
          );

          reject(new Error(`Timeout aguardando conexão. Estado: ${state}`));
        }

      } catch (error) {
        logger.error(
          "[Evolution API] Erro ao verificar status:",
          serializeError(error)
        );
      }
    }, CONNECTION_CHECK_INTERVAL_MS);
  });
}

// QR Code functions removed - WhatsApp Business API doesn't use QR codes

/**
 * Destrói a instância atual do WhatsApp.
 * @returns {Promise<void>}
 */
async function destroy() {
  logger.shutdown("[Evolution API Destroy] Solicitado desligamento...");

  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }

  if (instanceName && isClientReady) {
    try {
      const apiClient = createApiClient();

      // Logout da instância (mantém os dados)
      await apiClient.delete(`/instance/logout/${encodeURIComponent(instanceName)}`);
      logger.info(`[Evolution API Destroy] Logout realizado: ${instanceName}`);

    } catch (error) {
      logger.error(
        "[Evolution API Destroy] Erro ao fazer logout:",
        serializeError(error)
      );
    }
  }

  isClientReady = false;
  isInitializing = false;
  instanceName = null;

  logger.info("[Evolution API Destroy] Cliente desconectado.");
}

/**
 * Retorna se a instância está conectada e pronta.
 */
function isReady() {
  return isClientReady;
}

/**
 * Retorna informações da instância.
 */
async function getClient() {
  if (!instanceName || !isClientReady) {
    return null;
  }

  try {
    const apiClient = createApiClient();
    const response = await apiClient.get(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
    const state = response.data?.instance?.state || response.data?.state;
    return {
      instanceName,
      state: state,
      isReady: state === "open",
    };
  } catch (error) {
    logger.error("[Evolution API] Erro ao obter informações:", serializeError(error));
    return null;
  }
}

/**
 * Retorna o estado atual da conexão.
 * Para WhatsApp Business API, verifica o connectionStatus da instância
 */
async function getClientState() {
  if (!instanceName) {
    return isInitializing ? "INITIALIZING" : "UNINITIALIZED";
  }

  try {
    const apiClient = createApiClient();

    // Para WhatsApp Business API, usar fetchInstances para pegar connectionStatus
    const fetchResponse = await apiClient.get(`/instance/fetchInstances`);
    const instances = fetchResponse.data;

    if (Array.isArray(instances)) {
      const currentInstance = instances.find(inst => inst.name === instanceName);
      if (currentInstance) {
        // Para WhatsApp Business API, connectionStatus é "open" quando conectado
        return currentInstance.connectionStatus || "UNKNOWN";
      }
    }

    // Fallback: tentar endpoint de estado
    const response = await apiClient.get(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
    return response.data?.instance?.state || response.data?.state || "UNKNOWN";
  } catch (error) {
    logger.warn(
      "[Evolution API] Erro ao obter estado:",
      serializeError(error)
    );
    return "ERROR_GETTING_STATE";
  }
}

// ================================================================
// ===                  PROCESSAMENTO DE WEBHOOKS               ===
// ================================================================

/**
 * Processa webhooks recebidos da Evolution API
 * @param {object} webhookData - Dados do webhook
 * @param {object} trainingData - Dados de treinamento
 */
async function processWebhook(webhookData, trainingData) {
  try {
    logger.debug(`[Evolution Webhook] Processando webhook`, {
      hasEvent: !!webhookData.event,
      hasInstance: !!webhookData.instance,
      hasData: !!webhookData.data,
      keys: Object.keys(webhookData)
    });

    // Formato padrão Evolution API (WhatsApp Web)
    if (webhookData.event && webhookData.data) {
      const { event, instance, data } = webhookData;

      logger.debug(`[Evolution Webhook] Formato padrão - Evento: ${event}, Instância: ${instance}`);

      // Verifica se é da nossa instância
      if (instance && instance !== instanceName) {
        logger.debug(`[Evolution Webhook] Ignorando evento de outra instância: ${instance}`);
        return;
      }

      switch (event) {
        case "messages.upsert":
          await _handleMessageUpsert(data, trainingData);
          break;

        case "connection.update":
          await _handleConnectionUpdate(data);
          break;

        default:
          logger.debug(`[Evolution Webhook] Evento não tratado: ${event}`);
      }
      return;
    }

    // Formato Meta/WhatsApp Business API
    if (webhookData.entry && Array.isArray(webhookData.entry)) {
      logger.debug(`[Evolution Webhook] Formato Meta/WhatsApp Business API detectado`);
      await _handleMetaWebhook(webhookData, trainingData);
      return;
    }

    // Formato desconhecido
    logger.warn(`[Evolution Webhook] Formato de webhook desconhecido:`, {
      keys: Object.keys(webhookData),
      sample: JSON.stringify(webhookData).substring(0, 200)
    });

  } catch (error) {
    logger.error(
      "[Evolution Webhook] Erro ao processar webhook:",
      serializeError(error)
    );
  }
}

/**
 * Processa webhook no formato Meta/WhatsApp Business API
 * @private
 */
async function _handleMetaWebhook(webhookData, trainingData) {
  try {
    logger.debug(`[Evolution Meta Webhook] Processando webhook Meta`, {
      entryCount: webhookData.entry?.length || 0
    });

    // Formato Meta: { entry: [{ changes: [{ value: { messages: [...] } }] }] }
    for (const entry of webhookData.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        // Processa mensagens
        if (value?.messages && Array.isArray(value.messages)) {
          logger.info(`[Evolution Meta Webhook] 📨 ${value.messages.length} mensagem(ns) recebida(s)`);

          for (const metaMsg of value.messages) {
            logger.debug(`[Evolution Meta Webhook] Mensagem Meta:`, {
              from: metaMsg.from,
              type: metaMsg.type,
              hasText: !!metaMsg.text,
              timestamp: metaMsg.timestamp
            });

            // Converte formato Meta para formato Evolution padrão
            const evolutionMsg = {
              key: {
                remoteJid: `${metaMsg.from}@s.whatsapp.net`,
                fromMe: false,
                id: metaMsg.id || `meta_${Date.now()}`,
              },
              message: _convertMetaMessageToEvolution(metaMsg),
              messageTimestamp: metaMsg.timestamp || Math.floor(Date.now() / 1000),
              pushName: value.contacts?.find(c => c.wa_id === metaMsg.from)?.profile?.name || null,
            };

            logger.debug(`[Evolution Meta Webhook] Mensagem convertida`, {
              remoteJid: evolutionMsg.key.remoteJid,
              hasMessage: !!evolutionMsg.message
            });

            // Processa como mensagem padrão Evolution
            const message = _convertEvolutionMessage(evolutionMsg);

            logger.info(`[Evolution Meta Webhook] Enviando para processamento: from=${message.from}, type=${message.type}`);

            // Processa a mensagem (apenas se não for do bot)
            if (!message.fromMe) {
              await processIncomingMessage(message, {
                instanceName,
                sendMessage: sendMessage,
              }, trainingData);
            }
          }
        }

        // Processa status
        if (value?.statuses && Array.isArray(value.statuses)) {
          logger.debug(`[Evolution Meta Webhook] ${value.statuses.length} status update(s) ignorado(s)`);
        }
      }
    }
  } catch (error) {
    logger.error(
      "[Evolution Meta Webhook] Erro ao processar webhook Meta:",
      serializeError(error)
    );
  }
}

/**
 * Converte mensagem Meta para formato Evolution
 * @private
 */
function _convertMetaMessageToEvolution(metaMsg) {
  // Formato Meta para formato Evolution/Baileys
  const message = {};

  switch (metaMsg.type) {
    case 'text':
      message.conversation = metaMsg.text?.body || '';
      break;

    case 'image':
      message.imageMessage = {
        url: metaMsg.image?.id,
        caption: metaMsg.image?.caption || '',
        mimetype: metaMsg.image?.mime_type || 'image/jpeg',
      };
      break;

    case 'video':
      message.videoMessage = {
        url: metaMsg.video?.id,
        caption: metaMsg.video?.caption || '',
        mimetype: metaMsg.video?.mime_type || 'video/mp4',
      };
      break;

    case 'audio':
    case 'voice':
      message.audioMessage = {
        url: metaMsg.audio?.id || metaMsg.voice?.id,
        mimetype: metaMsg.audio?.mime_type || metaMsg.voice?.mime_type || 'audio/ogg',
        ptt: metaMsg.type === 'voice',
      };
      break;

    case 'document':
      message.documentMessage = {
        url: metaMsg.document?.id,
        mimetype: metaMsg.document?.mime_type || 'application/octet-stream',
        fileName: metaMsg.document?.filename || 'document',
      };
      break;

    case 'sticker':
      message.stickerMessage = {
        url: metaMsg.sticker?.id,
        mimetype: metaMsg.sticker?.mime_type || 'image/webp',
      };
      break;

    default:
      logger.warn(`[Evolution Meta Webhook] Tipo de mensagem Meta não suportado: ${metaMsg.type}`);
      message.conversation = `[Tipo não suportado: ${metaMsg.type}]`;
  }

  return message;
}

/**
 * Processa mensagens recebidas (formato Evolution padrão)
 * @private
 */
async function _handleMessageUpsert(data, trainingData) {
  try {
    logger.debug("[Evolution Webhook] _handleMessageUpsert chamado", {
      hasData: !!data,
      messagesCount: data?.messages?.length || 0,
      dataKeys: data ? Object.keys(data) : []
    });

    // Verifica se data é válido
    if (!data) {
      logger.warn("[Evolution Webhook] Dados inválidos ou ausentes");
      return;
    }

    // Normaliza o formato: se não tiver array messages, cria um com o próprio data
    let messages;
    if (Array.isArray(data.messages)) {
      messages = data.messages;
    } else if (data.key && data.message) {
      // Formato novo da Evolution API: data contém diretamente os campos da mensagem
      messages = [data];
    } else {
      logger.warn("[Evolution Webhook] Formato de dados não reconhecido");
      return;
    }

    for (const msg of messages) {
      logger.debug("[Evolution Webhook] Processando mensagem", {
        remoteJid: msg.key?.remoteJid,
        fromMe: msg.key?.fromMe,
        messageType: _getMessageType(msg.message)
      });

      // Ignora mensagens de grupos
      if (msg.key?.remoteJid?.endsWith("@g.us")) {
        logger.debug("[Evolution Webhook] Ignorando mensagem de grupo");
        continue;
      }

      // Converte mensagem Evolution API para formato compatível
      const message = _convertEvolutionMessage(msg);

      logger.info(`[Evolution Webhook] Mensagem convertida: from=${message.from}, body="${message.body?.substring(0, 50)}", type=${message.type}`);

      // Verifica intervenção humana apenas para mensagens enviadas pelo bot (fromMe=true)
      if (message.fromMe) {
        const isHumanTakeover = await checkHumanIntervention(message, {
          instanceName,
          sendMessage: sendMessage,
        });

        if (isHumanTakeover) {
          logger.debug(`[Evolution Webhook] Intervenção humana detectada para ${message.from}`);
          continue;
        }
      }

      // Processa a mensagem (apenas se não for do bot)
      if (!message.fromMe) {
        logger.info(`[Evolution Webhook] Enviando mensagem para processamento: ${message.from}`);
        await processIncomingMessage(message, {
          instanceName,
          sendMessage: sendMessage,
        }, trainingData);
      } else {
        logger.debug(`[Evolution Webhook] Ignorando mensagem enviada pelo bot (fromMe=true)`);
      }
    }
  } catch (error) {
    logger.error(
      "[Evolution Webhook] Erro ao processar mensagem:",
      serializeError(error)
    );
  }
}

/**
 * Converte mensagem da Evolution API para formato compatível com o sistema
 * @private
 */
function _convertEvolutionMessage(evolutionMsg) {
  const remoteJid = evolutionMsg.key?.remoteJid || "";
  const fromMe = evolutionMsg.key?.fromMe || false;

  // Normaliza chatId para formato @c.us (compatível com messageHandler)
  const normalizedChatId = remoteJid.endsWith("@s.whatsapp.net")
    ? remoteJid.replace("@s.whatsapp.net", "@c.us")
    : remoteJid;

  // Cria objeto de mensagem compatível com whatsapp-web.js
  const message = {
    id: {
      fromMe: fromMe,
      remote: normalizedChatId,
      id: evolutionMsg.key?.id || "",
      _serialized: `${fromMe}_${normalizedChatId}_${evolutionMsg.key?.id}`,
    },
    from: normalizedChatId,
    to: fromMe ? normalizedChatId : `${instanceName}@c.us`,
    body: evolutionMsg.message?.conversation ||
          evolutionMsg.message?.extendedTextMessage?.text || "",
    type: _getMessageType(evolutionMsg.message),
    timestamp: evolutionMsg.messageTimestamp || Math.floor(Date.now() / 1000),
    fromMe: fromMe,
    hasMedia: !!(evolutionMsg.message?.imageMessage ||
                 evolutionMsg.message?.videoMessage ||
                 evolutionMsg.message?.audioMessage ||
                 evolutionMsg.message?.documentMessage),
    isStatus: false, // Evolution API não envia status
    _data: evolutionMsg, // Mantém dados originais

    // Implementa método getChat() esperado pelo messageHandler
    getChat: async function() {
      return {
        id: { _serialized: normalizedChatId },
        isGroup: normalizedChatId.endsWith("@g.us"),
        name: evolutionMsg.pushName || null,
        // Simula método sendMessage
        sendMessage: async (content, options) => {
          return await sendMessage(normalizedChatId, content);
        }
      };
    }
  };

  return message;
}

/**
 * Determina o tipo da mensagem
 * @private
 */
function _getMessageType(message) {
  if (!message) return "chat";

  if (message.conversation || message.extendedTextMessage) return "chat";
  if (message.imageMessage) return "image";
  if (message.videoMessage) return "video";
  if (message.audioMessage) return "ptt"; // Push to talk
  if (message.documentMessage) return "document";
  if (message.stickerMessage) return "sticker";

  return "chat";
}

/**
 * Processa atualização de conexão
 * @private
 */
async function _handleConnectionUpdate(data) {
  logger.info(`[Evolution Webhook] Atualização de conexão:`, data);

  if (data.state === "open") {
    isClientReady = true;
    logger.ready("🟢 Evolution API conectada via webhook!");
  } else if (data.state === "close") {
    isClientReady = false;
    logger.warn("🔴 Evolution API desconectada!");
  }
}

/**
 * Processa atualização de QR code
 * @private
 */
function _handleQrCodeUpdate(data) {
  if (data?.qrcode) {
    currentQrCode = data.qrcode;
    _displayQrCode(currentQrCode);
  }
}

// ================================================================
// ===                  ENVIO DE MENSAGENS                      ===
// ================================================================

/**
 * Envia mensagem de texto via WhatsApp Business API
 * @param {string} to - Número de destino (pode incluir @c.us ou @s.whatsapp.net)
 * @param {string} message - Mensagem a ser enviada
 * @param {object} options - Opções adicionais (ex: quoted para citação)
 */
async function sendMessage(to, message, options = {}) {
  if (!isClientReady) {
    throw new Error("Evolution API não está conectada");
  }

  try {
    // Remove sufixo @c.us ou @s.whatsapp.net para obter apenas o número
    let number = to.replace(/@c\.us|@s\.whatsapp\.net/g, "");

    logger.debug(`[Evolution API Send] Enviando mensagem para ${number} via instância ${instanceName}`);

    // Para WhatsApp Business API, usar Graph API diretamente
    const WA_BUSINESS_TOKEN = process.env.WA_BUSINESS_TOKEN;
    const WA_BUSINESS_PHONE_NUMBER_ID = process.env.WA_BUSINESS_PHONE_NUMBER_ID;

    if (WA_BUSINESS_TOKEN && WA_BUSINESS_PHONE_NUMBER_ID) {
      logger.debug(`[WhatsApp Business] Enviando via Graph API direta`);

      const graphApiUrl = `https://graph.facebook.com/v23.0/${WA_BUSINESS_PHONE_NUMBER_ID}/messages`;
      const axios = (await import('axios')).default;

      // Prepara payload base
      const payload = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: number,
        type: "text",
        text: {
          body: message
        }
      };

      // Adiciona contexto de citação se fornecido
      if (options.quoted?.key?.id) {
        payload.context = {
          message_id: options.quoted.key.id
        };
        logger.debug(`[WhatsApp Business] Enviando com citação (context) da mensagem ID: ${options.quoted.key.id}`);
      }

      const response = await axios.post(graphApiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${WA_BUSINESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      logger.info(`[WhatsApp Business] ✅ Mensagem enviada para ${to} via Graph API`, {
        messageId: response.data?.messages?.[0]?.id,
        status: response.data?.messages?.[0]?.message_status
      });

      return response.data;
    }

    // Fallback: tentar Evolution API (para Baileys)
    logger.warn(`[Evolution API Send] WhatsApp Business token não configurado, tentando Evolution API`);
    const apiClient = createApiClient();

    // Prepara payload base
    const payload = {
      number: number,
      text: message
    };

    // Adiciona opções se fornecidas (ex: quoted para Baileys)
    if (options && Object.keys(options).length > 0) {
      payload.options = options;
      if (options.quoted?.key?.id) {
        logger.debug(`[Evolution API] Enviando com citação (quoted) da mensagem ID: ${options.quoted.key.id}`);
      }
    }

    const response = await apiClient.post(`/message/sendText/${encodeURIComponent(instanceName)}`, payload);

    logger.info(`[Evolution API Send] ✅ Mensagem enviada para ${to}`, {
      messageId: response.data?.key?.id || response.data?.messages?.[0]?.id,
      status: response.data?.status
    });

    return response.data;
  } catch (error) {
    logger.error(
      `[Evolution API Send] ❌ Erro ao enviar mensagem para ${to}:`,
      serializeError(error),
      null,
      {
        errorMessage: error.message,
        errorResponse: error.response?.data,
        errorStatus: error.response?.status
      }
    );
    throw error;
  }
}

/**
 * Marca uma mensagem como lida
 * @param {string} chatId - ID do chat (número com @c.us ou @s.whatsapp.net)
 * @param {string} messageId - ID da mensagem a ser marcada como lida
 */
async function markMessageAsRead(chatId, messageId) {
  if (!isClientReady) {
    throw new Error("Evolution API não está conectada");
  }

  try {
    // Remove sufixo @c.us ou @s.whatsapp.net para obter apenas o número
    let number = chatId.replace(/@c\.us|@s\.whatsapp\.net/g, "");

    logger.debug(`[Evolution API Read] Marcando mensagem ${messageId} como lida para ${number}`);

    // Para WhatsApp Business API, usar Graph API diretamente
    const WA_BUSINESS_TOKEN = process.env.WA_BUSINESS_TOKEN;
    const WA_BUSINESS_PHONE_NUMBER_ID = process.env.WA_BUSINESS_PHONE_NUMBER_ID;

    if (WA_BUSINESS_TOKEN && WA_BUSINESS_PHONE_NUMBER_ID) {
      logger.debug(`[WhatsApp Business] Marcando como lida via Graph API`);

      const graphApiUrl = `https://graph.facebook.com/v23.0/${WA_BUSINESS_PHONE_NUMBER_ID}/messages`;
      const axios = (await import('axios')).default;

      const payload = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId
      };

      await axios.post(graphApiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${WA_BUSINESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      logger.trace(`[WhatsApp Business] ✓ Mensagem ${messageId} marcada como lida`);
      return true;
    }

    // Fallback: Evolution API (Baileys)
    logger.warn(`[Evolution API Read] WhatsApp Business token não configurado, tentando Evolution API`);
    const apiClient = createApiClient();

    const payload = {
      read_messages: [{
        remoteJid: `${number}@s.whatsapp.net`,
        id: messageId,
        fromMe: false
      }]
    };

    await apiClient.post(`/chat/readMessages/${encodeURIComponent(instanceName)}`, payload);

    logger.trace(`[Evolution API Read] ✓ Mensagem ${messageId} marcada como lida`);
    return true;
  } catch (error) {
    logger.warn(
      `[Evolution API Read] Erro ao marcar mensagem ${messageId} como lida:`,
      serializeError(error)
    );
    // Não lança erro, pois marcar como lida é uma ação secundária
    return false;
  }
}

/**
 * Envia mensagem com mídia
 */
async function sendMediaMessage(to, mediaUrl, caption = "", mediaType = "image") {
  if (!isClientReady) {
    throw new Error("Evolution API não está conectada");
  }

  try {
    const apiClient = createApiClient();

    let endpoint = "";
    let payload = {
      number: to.replace("@c.us", ""),
    };

    switch (mediaType) {
      case "image":
        endpoint = "/message/sendMedia/${instanceName}";
        payload.mediatype = "image";
        payload.media = mediaUrl;
        payload.caption = caption;
        break;
      case "audio":
        endpoint = "/message/sendWhatsAppAudio/${instanceName}";
        payload.audio = mediaUrl;
        break;
      case "video":
        endpoint = "/message/sendMedia/${instanceName}";
        payload.mediatype = "video";
        payload.media = mediaUrl;
        payload.caption = caption;
        break;
      default:
        throw new Error(`Tipo de mídia não suportado: ${mediaType}`);
    }

    const response = await apiClient.post(endpoint, payload);
    logger.debug(`[Evolution API] Mídia ${mediaType} enviada para ${to}`);
    return response.data;
  } catch (error) {
    logger.error(
      `[Evolution API] Erro ao enviar mídia para ${to}:`,
      serializeError(error)
    );
    throw error;
  }
}

// ================================================================
// ===                  FUNÇÕES AUXILIARES                      ===
// ================================================================

/**
 * Lida com erros fatais
 * @private
 */
function _handleFatalError(signal, error = null) {
  const errorToReject = error || new Error(signal);

  if (clientReadyReject) {
    logger.debug(`[Evolution Fatal] Rejeitando promise devido a: ${signal}`);
    clientReadyReject(errorToReject);
  }

  clientReadyResolve = null;
  clientReadyReject = null;
  isInitializing = false;
  isClientReady = false;

  // Dispara shutdown
  import("./main.js")
    .then(async ({ gracefulShutdown }) => {
      if (gracefulShutdown && typeof gracefulShutdown === "function") {
        logger.info(`[Evolution Fatal] Chamando gracefulShutdown: ${signal}`);
        await gracefulShutdown(signal);
      } else {
        logger.fatal(`[Evolution Fatal] gracefulShutdown não encontrado. Signal: ${signal}`);
        process.exit(1);
      }
    })
    .catch((importErr) => {
      logger.fatal(
        "[Evolution Fatal] Falha ao importar gracefulShutdown!",
        importErr
      );
      process.exit(1);
    });
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================
export default {
  initialize,
  destroy,
  getClient,
  isReady,
  getClientState,
  processWebhook,
  sendMessage,
  sendMediaMessage,
  markMessageAsRead,
  // Mantém compatibilidade
  instanceName: () => instanceName,
};

// --- END OF FILE whatsappClient.js ---
