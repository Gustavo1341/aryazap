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
let currentQrCode = null; // Armazena o último QR code
let qrCodeCheckInterval = null; // Intervalo para verificar QR code
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
        logger.info(`[Evolution API Init] Criando nova instância '${instanceName}'...`);

        const createResponse = await apiClient.post("/instance/create", {
          instanceName: instanceName,
          token: EVOLUTION_API_KEY,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS",
          webhookUrl: WEBHOOK_URL,
          webhookByEvents: true,
          webhookBase64: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
          ],
        });

        logger.info(`[Evolution API Init] Instância criada: ${createResponse.data.instance.instanceName}`);
      } else {
        logger.info(`[Evolution API Init] Instância '${instanceName}' já existe.`);
      }

      // 3. Conectar à instância
      logger.info(`[Evolution API Init] Conectando instância '${instanceName}'...`);

      const connectResponse = await apiClient.get(`/instance/connect/${instanceName}`);
      logger.debug(`[Evolution API Init] Resposta de conexão:`, connectResponse.data);

      // 4. Verificar status da conexão
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
 * Verifica o status da conexão e aguarda QR code ou conexão
 * @private
 */
async function _checkConnectionStatus(apiClient, timeoutId) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = INIT_TIMEOUT_MS / CONNECTION_CHECK_INTERVAL_MS;

    connectionCheckInterval = setInterval(async () => {
      attempts++;

      try {
        const statusResponse = await apiClient.get(`/instance/connectionState/${instanceName}`);
        const state = statusResponse.data?.state;

        logger.debug(`[Evolution API] Estado da conexão: ${state} (tentativa ${attempts}/${maxAttempts})`);

        if (state === "open") {
          // Conexão estabelecida!
          clearInterval(connectionCheckInterval);
          clearInterval(qrCodeCheckInterval);
          clearTimeout(timeoutId);

          logger.ready(
            `🟢🟢🟢 EVOLUTION API CONECTADA! [${instanceName}] 🟢🟢🟢`
          );
          logger.wapp("Client Ready", null, { instanceName, state });

          isInitializing = false;
          isClientReady = true;
          currentQrCode = null;

          if (clientReadyResolve) {
            clientReadyResolve();
            clientReadyResolve = null;
            clientReadyReject = null;
          }

          resolve();
        } else if (state === "close") {
          // Precisa escanear QR code
          if (!qrCodeCheckInterval) {
            _startQrCodeCheck(apiClient);
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(connectionCheckInterval);
          clearInterval(qrCodeCheckInterval);
          clearTimeout(timeoutId);
          reject(new Error("Timeout aguardando conexão"));
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

/**
 * Inicia verificação periódica do QR code
 * @private
 */
function _startQrCodeCheck(apiClient) {
  logger.info("[Evolution API] Iniciando verificação de QR code...");

  qrCodeCheckInterval = setInterval(async () => {
    try {
      const qrResponse = await apiClient.get(`/instance/qrcode/${instanceName}`);

      if (qrResponse.data?.qrcode?.code) {
        const newQrCode = qrResponse.data.qrcode.code;

        if (newQrCode !== currentQrCode) {
          currentQrCode = newQrCode;
          _displayQrCode(currentQrCode);
        }
      }
    } catch (error) {
      logger.debug("[Evolution API] Aguardando QR code...");
    }
  }, QR_CHECK_INTERVAL_MS);
}

/**
 * Exibe o QR Code no terminal
 * @private
 */
function _displayQrCode(qrString) {
  if (!qrString) {
    logger.warn("[QR Display] QR Code vazio.");
    return;
  }

  try {
    // Importação dinâmica do qrcode-terminal
    import("qrcode-terminal").then((qrcode) => {
      console.log("\n" + "-".repeat(60));
      logger.info("📱 Escaneie o QR Code abaixo com o WhatsApp:");

      qrcode.generate(qrString, { small: true }, (output) => {
        if (output) {
          console.log(output);
          console.log("-".repeat(60));
          logger.info("✨ Aguardando leitura e autenticação... ✨");
        }
      });

      console.log("\n");
    }).catch((error) => {
      logger.error("[QR Display] Erro ao importar qrcode-terminal:", error);
      // Fallback: mostrar o QR code como texto/link
      logger.info(`📱 QR Code: ${qrString.substring(0, 100)}...`);
    });
  } catch (error) {
    logger.error(
      "[QR Display] Erro ao exibir QR Code:",
      serializeError(error)
    );
  }
}

/**
 * Destrói a instância atual do WhatsApp.
 * @returns {Promise<void>}
 */
async function destroy() {
  logger.shutdown("[Evolution API Destroy] Solicitado desligamento...");

  if (qrCodeCheckInterval) {
    clearInterval(qrCodeCheckInterval);
    qrCodeCheckInterval = null;
  }

  if (connectionCheckInterval) {
    clearInterval(connectionCheckInterval);
    connectionCheckInterval = null;
  }

  if (instanceName && isClientReady) {
    try {
      const apiClient = createApiClient();

      // Logout da instância (mantém os dados)
      await apiClient.delete(`/instance/logout/${instanceName}`);
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
  currentQrCode = null;
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
    const response = await apiClient.get(`/instance/connectionState/${instanceName}`);
    return {
      instanceName,
      state: response.data?.state,
      isReady: response.data?.state === "open",
    };
  } catch (error) {
    logger.error("[Evolution API] Erro ao obter informações:", serializeError(error));
    return null;
  }
}

/**
 * Retorna o estado atual da conexão.
 */
async function getClientState() {
  if (!instanceName) {
    return isInitializing ? "INITIALIZING" : "UNINITIALIZED";
  }

  try {
    const apiClient = createApiClient();
    const response = await apiClient.get(`/instance/connectionState/${instanceName}`);
    return response.data?.state || "UNKNOWN";
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
    const { event, instance, data } = webhookData;

    logger.debug(`[Evolution Webhook] Evento: ${event}, Instância: ${instance}`);

    // Verifica se é da nossa instância
    if (instance !== instanceName) {
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

      case "qrcode.updated":
        _handleQrCodeUpdate(data);
        break;

      default:
        logger.debug(`[Evolution Webhook] Evento não tratado: ${event}`);
    }
  } catch (error) {
    logger.error(
      "[Evolution Webhook] Erro ao processar webhook:",
      serializeError(error)
    );
  }
}

/**
 * Processa mensagens recebidas
 * @private
 */
async function _handleMessageUpsert(data, trainingData) {
  try {
    if (!data || !Array.isArray(data.messages)) {
      return;
    }

    for (const msg of data.messages) {
      // Ignora mensagens de grupos
      if (msg.key?.remoteJid?.endsWith("@g.us")) {
        logger.debug("[Evolution Webhook] Ignorando mensagem de grupo");
        continue;
      }

      // Converte mensagem Evolution API para formato compatível
      const message = _convertEvolutionMessage(msg);

      // Verifica intervenção humana
      if (!message.fromMe) {
        const isHumanTakeover = await checkHumanIntervention(message, {
          instanceName,
          sendMessage: sendMessage,
        });

        if (isHumanTakeover) {
          logger.debug(`[Evolution Webhook] Intervenção humana detectada para ${message.from}`);
          continue;
        }
      }

      // Processa a mensagem
      await processIncomingMessage(message, {
        instanceName,
        sendMessage: sendMessage,
      }, trainingData);
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

  return {
    id: {
      fromMe: fromMe,
      remote: remoteJid,
      id: evolutionMsg.key?.id || "",
      _serialized: `${fromMe}_${remoteJid}_${evolutionMsg.key?.id}`,
    },
    from: remoteJid,
    to: fromMe ? remoteJid : instanceName,
    body: evolutionMsg.message?.conversation ||
          evolutionMsg.message?.extendedTextMessage?.text || "",
    type: _getMessageType(evolutionMsg.message),
    timestamp: evolutionMsg.messageTimestamp || Date.now(),
    fromMe: fromMe,
    hasMedia: !!(evolutionMsg.message?.imageMessage ||
                 evolutionMsg.message?.videoMessage ||
                 evolutionMsg.message?.audioMessage ||
                 evolutionMsg.message?.documentMessage),
    _data: evolutionMsg, // Mantém dados originais
  };
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
 * Envia mensagem de texto
 */
async function sendMessage(to, message) {
  if (!isClientReady) {
    throw new Error("Evolution API não está conectada");
  }

  try {
    const apiClient = createApiClient();

    const response = await apiClient.post(`/message/sendText/${instanceName}`, {
      number: to.replace("@c.us", ""),
      text: message,
    });

    logger.debug(`[Evolution API] Mensagem enviada para ${to}`);
    return response.data;
  } catch (error) {
    logger.error(
      `[Evolution API] Erro ao enviar mensagem para ${to}:`,
      serializeError(error)
    );
    throw error;
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
  // Mantém compatibilidade
  instanceName: () => instanceName,
};

// --- END OF FILE whatsappClient.js ---
