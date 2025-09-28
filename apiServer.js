// --- START OF FILE apiServer.js ---

/**
 * apiServer.js - Servidor API Express (v. Refatorado e Robusto com Endpoint Ping)
 * =========================================================
 * Responsável por:
 * - Configurar e iniciar o servidor Express para endpoints da API.
 * - Definir endpoints como /status, /send-message e /misc/ping.
 * - Gerenciar autenticação via API Key (opcional).
 * - Interagir com outros módulos para obter status ou enviar mensagens.
 * =========================================================
 */

import express from "express";
import http from "node:http";
import os from "node:os";

// --- Project Imports ---
import logger from "./logger.js";
import botConfig from "./botConfig.js";
import { default as clientManager } from "./whatsappClient.js";
import stateManager from "./stateManager.js";
import responseSender from "./responseSender.js";
import { trainingDataCache } from "./trainingLoader.js";

// --- Constantes e Configuração ---
const API_PORT = botConfig.server.port;
const API_KEY = process.env.API_KEY || null;
const API_KEY_HEADER = "x-api-key";
const SERVICE_NAME = "SmartZap AI Agent";

// --- Instância do Express e Servidor ---
const app = express();
/** @type {http.Server | null} */
let serverInstance = null;

// ================================================================
// ===                      MIDDLEWARES                         ===
// ================================================================

app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    // Usando logger.api para este log
    logger.api(
      `Req: ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | Dur: ${duration}ms`,
      { ip: req.ip, userAgent: req.headers["user-agent"]?.substring(0, 70) }
    );
  });
  next();
});

const authenticateApiKey = (req, res, next) => {
  if (!API_KEY) return next(); // Se não há API_KEY configurada, permite o acesso
  const providedKey = req.header(API_KEY_HEADER);
  if (providedKey && providedKey === API_KEY) return next();
  logger.warn(`[API Auth] Acesso NÃO AUTORIZADO via API. IP: ${req.ip}`, null, {
    endpoint: req.path,
    method: req.method,
  });
  res
    .status(401)
    .json({ error: "Unauthorized", message: "Acesso não autorizado." });
};

// ================================================================
// ===                   DEFINIÇÃO DAS ROTAS API                ===
// ================================================================

// --- Função _assembleStatusResponse ---
async function _assembleStatusResponse() {
  let clientName = "N/A";
  let clientNumber = "N/A";
  let clientWappState = "UNINITIALIZED";

  try {
    clientWappState = await clientManager.getClientState();
    const clientInstance = clientManager.getClient();

    if (clientInstance?.info) {
      clientName =
        clientInstance.info.pushname || botConfig.identity.firstName || "Bot";
      clientNumber = clientInstance.info.wid?.user || "N/A";
    } else if (clientWappState === "CONNECTED" || clientWappState === "READY") {
      // READY também indica conectado
      clientName = "Conectado (sem info detalhada)";
    }
  } catch (clientError) {
    logger.warn(
      "[API Status] Falha ao obter estado/info do cliente WAPP.",
      clientError
    );
    clientWappState =
      clientWappState === "UNINITIALIZED" ? "ERROR_FETCHING" : clientWappState;
  }

  const trainingStatus = trainingDataCache || {
    isLoaded: false,
    productInfo: null,
    generalKnowledge: { stats: {} },
    socialProofs: [], // Ajustado para ser um array como em trainingLoader
    allRequiredProofsFound: false,
  };
  const productInfo = trainingStatus.productInfo;
  const kbStats = trainingStatus.generalKnowledge?.stats;
  // Ajuste para contar provas sociais do array
  const proofsCount = {
    images: trainingStatus.socialProofs.filter((p) => p.type === "image")
      .length,
    videos: trainingStatus.socialProofs.filter((p) => p.type === "video")
      .length,
    audios: trainingStatus.socialProofs.filter((p) => p.type === "audio")
      .length,
    // Adicionar outros tipos se necessário
  };

  return {
    status: "running",
    serviceName: SERVICE_NAME,
    version: process.env.npm_package_version || "?.?.?",
    nodeEnv: process.env.NODE_ENV || "development",
    hostname: os.hostname(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    memoryUsage: process.memoryUsage(),
    whatsappClient: {
      connectionState: clientWappState,
      clientName: clientName,
      clientNumber: clientNumber,
    },
    aiConfig: {
      provider: botConfig.openai.apiKey ? "OpenAI" : "Disabled", // Removida checagem de LMStudio
      chatModel: botConfig.openai.model,
      whisperModel: botConfig.openai.whisperModel,
      temperature: botConfig.openai.temperature,
      maxTokens: botConfig.openai.maxTokens || "default",
    },
    ttsConfig: {
      enabled: botConfig.tts.enabled,
      provider: botConfig.tts.enabled ? "ElevenLabs" : "Disabled",
      voiceId: botConfig.tts.enabled ? botConfig.tts.elevenLabsVoiceId : null,
    },
    salesStrategy: {
      targetProduct: botConfig.behavior.salesStrategy.targetProductId,
      upsellEnabled: botConfig.behavior.salesStrategy.enableUpsell,
      crossSellEnabled: botConfig.behavior.salesStrategy.enableCrossSell,
    },
    trainingData: {
      loaded: trainingStatus.isLoaded || false,
      productName: productInfo?.product?.name || null,
      knowledgeBaseFiles: kbStats?.processed || 0,
      socialProofs: proofsCount, // Usa a contagem ajustada
      requiredProofsFound: trainingStatus.allRequiredProofsFound ?? true, // Usa ?? para default se undefined
    },
  };
}

// --- Rota GET /status ---
app.get("/status", async (req, res) => {
  try {
    const statusResponse = await _assembleStatusResponse();
    res.status(200).json(statusResponse);
  } catch (error) {
    logger.error(
      "[API Status] Erro GERAL ao montar resposta de status.",
      error
    );
    res.status(500).json({
      error: "Internal Server Error",
      message: "Erro ao obter status completo.",
    });
  }
});

// --- Rota GET /misc/ping (NOVO ENDPOINT) ---
app.get("/misc/ping", (req, res) => {
  // Este endpoint não requer autenticação por padrão.
  // Se a chave na URL for para alguma verificação específica do cliente que está pingando,
  // você pode adicionar lógica aqui para validá-la se necessário.
  // Ex: const clientKey = req.query.key;
  // if (!clientKey || clientKey !== "CHAVE_ESPERADA_PELO_CLIENTE_DE_PING") {
  //   logger.warn(`[API Ping] Tentativa de ping com chave inválida ou ausente: ${clientKey}`);
  //   return res.status(401).send("Unauthorized ping attempt");
  // }

  logger.trace(
    "[API Ping] Recebido ping em /misc/ping. Respondendo com pong.",
    null,
    { query: req.query }
  );
  res.status(200).send("pong");
});

// --- Rota POST /send-message ---
app.post("/send-message", authenticateApiKey, async (req, res) => {
  const { number, message } = req.body;

  if (
    !number ||
    typeof number !== "string" ||
    !message ||
    typeof message !== "string" ||
    !message.trim()
  ) {
    logger.warn(
      "[API SendMsg] Requisição inválida (número/mensagem ausente ou inválido).",
      null,
      { body: req.body, ip: req.ip }
    );
    return res.status(400).json({
      error: "Bad Request",
      message:
        "'number' (string) e 'message' (string não vazia) são obrigatórios.",
    });
  }

  const sanitizedNumber = number.replace(/\D/g, "");
  if (sanitizedNumber.length < 10 || sanitizedNumber.length > 15) {
    // Ajustado para permitir números um pouco mais longos (ex: com código de país e área)
    logger.warn(
      `[API SendMsg] Número fornecido parece inválido: ${number}`,
      null,
      { ip: req.ip }
    );
    return res.status(400).json({
      error: "Bad Request",
      message: `Número '${number}' parece inválido. Verifique o formato (ex: 55119XXXXXXXX).`,
    });
  }
  const chatId = `${sanitizedNumber}@c.us`;

  try {
    const clientInstance = clientManager.getClient();
    const clientWappState = await clientManager.getClientState();

    // Checa se o cliente está em um estado funcional para envio
    if (
      !clientInstance ||
      (clientWappState !== "CONNECTED" && clientWappState !== "READY")
    ) {
      logger.warn(
        `[API SendMsg] Cliente WhatsApp não conectado (Estado: ${clientWappState}). Abortando envio para ${chatId}`,
        null,
        { ip: req.ip }
      );
      return res.status(503).json({
        error: "Service Unavailable",
        message: `Cliente WhatsApp não está conectado (Estado: ${clientWappState}). Tente novamente mais tarde.`,
      });
    }

    const isRegistered = await clientInstance.isRegisteredUser(chatId);
    if (!isRegistered) {
      logger.warn(
        `[API SendMsg] Número não registrado no WhatsApp: ${number}`,
        chatId,
        { ip: req.ip }
      );
      return res.status(404).json({
        error: "Not Found",
        message: `Número ${number} não parece ser um usuário WhatsApp válido.`,
      });
    }

    let chat = null;
    let contactName = `API Contact ${sanitizedNumber.slice(-4)}`;
    try {
      chat = await clientInstance.getChatById(chatId);
      if (chat) {
        contactName =
          (await stateManager.getContactName({ from: chatId }, chat)) ||
          contactName;
      }
    } catch (getChatErr) {
      logger.warn(
        `[API SendMsg] Aviso: Não foi possível obter chat para ${chatId}. Erro: ${getChatErr.message}`,
        chatId
      );
    }

    logger.info(
      `[API SendMsg] Tentando enviar mensagem via API para ${contactName} (${number})...`,
      chatId
    );

    const sentOk = await responseSender.sendMessages(
      chat,
      chatId,
      contactName,
      [message], // sendMessages espera um array de strings
      false // Não tentar TTS para mensagens enviadas via API por padrão
    );

    if (sentOk) {
      await stateManager.addMessageToHistory(
        chatId,
        "system", // Ou "assistant" se a mensagem for considerada como se o bot tivesse dito
        `[Sistema: Mensagem enviada via API: "${message.substring(0, 50)}..."]`
      );
      logger.info(
        `[API SendMsg] Mensagem enviada via API para ${contactName} com sucesso.`,
        chatId
      );
      res
        .status(200)
        .json({ success: true, message: `Mensagem enviada para ${number}.` });
    } else {
      logger.error(
        `[API SendMsg] Falha no responseSender ao enviar mensagem API para ${contactName}.`,
        null,
        chatId
      );
      res.status(500).json({
        error: "Internal Server Error",
        message: `Falha ao enviar mensagem para ${number}. Verifique os logs do servidor.`,
      });
    }
  } catch (error) {
    logger.error(
      `[API SendMsg] Erro GERAL no endpoint /send-message para ${number}`,
      error, // Log completo do erro
      chatId,
      { ip: req.ip }
    );
    res.status(500).json({
      error: "Internal Server Error",
      message: error.message || "Erro desconhecido ao processar envio via API.",
    });
  }
});

// --- Rota Catch-All (404 Not Found) ---
// Esta deve ser a ÚLTIMA rota definida (exceto o error handler)
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `A rota ${req.method} ${req.originalUrl} não existe neste servidor.`,
  });
});

// --- Middleware Genérico de Tratamento de Erros ---
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  logger.error(
    "[API Error Handler] Erro não tratado na camada Express:",
    err,
    null,
    { path: req.path, method: req.method }
  );
  const errorMessage =
    process.env.NODE_ENV === "production"
      ? "Ocorreu um erro interno no servidor."
      : err.message;
  if (!res.headersSent) {
    res.status(500).json({
      error: "Internal Server Error",
      message: errorMessage,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    });
  }
});

// ================================================================
// ===               INICIALIZAÇÃO E PARADA DO SERVIDOR         ===
// ================================================================

/**
 * Inicia o servidor HTTP com a aplicação Express.
 * @returns {Promise<http.Server | null>} A instância do servidor HTTP iniciada ou null se desabilitado/erro.
 * @throws {Error} Se o servidor não puder ser iniciado (ex: porta em uso).
 */
async function start() {
  if (serverInstance) {
    logger.warn(
      "[API Server] Tentativa de iniciar servidor que já está rodando."
    );
    return serverInstance;
  }
  if (!isEnabled()) {
    logger.info(
      "[API Server] Porta inválida ou não configurada (PORT). API desativada."
    );
    return null;
  }

  try {
    logger.info("[API Server] Configurando e iniciando servidor HTTP...");
    serverInstance = http.createServer(app);
    const server = serverInstance;

    await new Promise((resolveListeners, rejectListeners) => {
      server.once("listening", () => {
        const address = server.address();
        const port = typeof address === "string" ? "N/A" : address?.port;
        logger.info(
          `[API Server] Servidor API iniciado e escutando em http://0.0.0.0:${port}`
        );
        logger.info(
          `   Rotas disponíveis: GET /status, GET /misc/ping, POST /send-message`
        );
        if (API_KEY) {
          logger.info(
            `   Autenticação API (para /send-message): ATIVA (Header: ${API_KEY_HEADER})`
          );
        } else {
          logger.warn(
            `   Autenticação API (para /send-message): DESATIVADA (API_KEY não definida)`
          );
        }
        resolveListeners();
      });

      server.once("error", (error) => {
        const nodeError = /** @type {NodeJS.ErrnoException} */ (error);
        serverInstance = null;
        if (nodeError.code === "EADDRINUSE") {
          logger.fatal(
            `[API Server] ERRO FATAL: Porta ${API_PORT} já está em uso!`
          );
          rejectListeners(new Error(`Porta ${API_PORT} já em uso.`));
        } else {
          logger.error(
            `[API Server] Erro inesperado no servidor HTTP: ${nodeError.message}`,
            nodeError
          );
          rejectListeners(nodeError);
        }
      });
      server.listen(API_PORT, "0.0.0.0");
    });
    return server;
  } catch (error) {
    logger.fatal(
      "[API Server] Erro crítico durante a inicialização do servidor API.",
      error
    );
    serverInstance = null;
    throw error;
  }
}

// --- Função stop ---
function stop(timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!serverInstance) {
      logger.info("[API Server] Servidor não estava rodando ou já foi parado.");
      return resolve();
    }
    const server = serverInstance;
    serverInstance = null;
    logger.info(
      `[API Server] Parando servidor API (aguardando até ${timeoutMs}ms para conexões)...`
    );
    const closePromise = new Promise((innerResolve) =>
      server.close(innerResolve)
    );
    const timeoutPromise = new Promise((innerResolve) =>
      setTimeout(innerResolve, timeoutMs)
    );

    Promise.race([closePromise, timeoutPromise]).then((result) => {
      if (result instanceof Error) {
        // closePromise pode rejeitar com erro
        logger.error(
          "[API Server] Erro ao finalizar conexões existentes do servidor API.",
          result
        );
      } else if (result === undefined && server.listening) {
        // Timeout ocorreu e servidor ainda estava ouvindo
        logger.warn(
          `[API Server] Timeout (${timeoutMs}ms) atingido ao parar servidor. Pode haver conexões ativas.`
        );
      } else {
        // Servidor fechou normalmente ou já estava fechado
        logger.info(
          "[API Server] Servidor API parado com sucesso (conexões finalizadas)."
        );
      }
      resolve();
    });
  });
}

// --- Função isEnabled ---
function isEnabled() {
  return Number.isInteger(API_PORT) && API_PORT > 0 && API_PORT <= 65535;
}

// --- Função getInstance ---
function getInstance() {
  return serverInstance;
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

export default {
  start,
  stop,
  isEnabled,
  getInstance,
};

// --- END OF FILE apiServer.js ---
