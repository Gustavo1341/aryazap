// --- START OF FILE whatsappClient.js ---

/**
 * whatsappClient.js - Módulo Cliente WhatsApp (whatsapp-web.js) (v. Robusta)
 * =======================================================================
 * Responsável por:
 * - Inicializar e configurar o cliente whatsapp-web.js com autenticação local.
 * - Gerenciar o ciclo de vida do cliente: QR code, autenticação, conexão, desconexão.
 * - Registrar e lidar com os principais eventos do cliente WWebJS.
 * - Delegar o processamento de mensagens recebidas para o messageHandler.
 * - Fornecer acesso controlado à instância do cliente e seu estado.
 * =======================================================================
 */

// --- Node.js & Third-Party Imports ---
import pkg from "whatsapp-web.js";
const { Client, LocalAuth, WAState } = pkg; // MessageMedia não é usado diretamente aqui
import qrcode from "qrcode-terminal";
import path from "node:path"; // Usar node: prefix
import { clearTimeout, setTimeout } from "node:timers";
import { serializeError } from "serialize-error"; // Para logs de erro

// --- Project Imports ---
import logger from "./logger.js";
import botConfig from "./botConfig.js";
import { SESSION_DIR } from "./fileSystemHandler.js"; // Diretório da sessão
import { sleep, parseIntEnv } from "./utils.js"; // Utilitários
// Importa apenas a função necessária do messageHandler
// Nota: Isso pode criar dependência cíclica se messageHandler importar whatsappClient.
// Alternativa: Usar um sistema de eventos ou passar a função como callback.
import {
  processIncomingMessage,
  checkHumanIntervention,
} from "./messageHandler.js";

// --- Module State ---
/** @type {Client | null} */
let client = null; // Instância do cliente WWebJS
let currentQr = null; // Armazena o último QR code gerado
let isClientReady = false; // Flag: Cliente autenticado e pronto
let isInitializing = false; // Flag: Processo de inicialização em andamento
/** @type {NodeJS.Timeout | null} */
let qrRetryTimeout = null; // Timer para re-exibir QR code
/** @type {Function | null} */
let clientReadyResolve = null; // Resolve da Promise de inicialização
/** @type {Function | null} */
let clientReadyReject = null; // Reject da Promise de inicialização

// --- Constants ---
const WAPP_CLIENT_INIT_TIMEOUT_MS = parseIntEnv(
  process.env.WAPP_CLIENT_INIT_TIMEOUT_MS,
  180000,
  "WAPP_CLIENT_INIT_TIMEOUT_MS"
); // 3 minutos
const WAPP_AUTH_TIMEOUT_MS = parseIntEnv(
  process.env.WAPP_AUTH_TIMEOUT_MS,
  120000,
  "WAPP_AUTH_TIMEOUT_MS"
); // 2 minutos
const CHROME_EXECUTABLE_PATH = process.env.CHROME_PATH || undefined; // Caminho para Chrome/Chromium (opcional)
// Versão do WhatsApp Web a ser usada (VERIFICAR COMPATIBILIDADE com a versão whatsapp-web.js instalada!)
// Consulte: https://github.com/wppconnect-team/wa-version
// Exemplo para whatsapp-web.js v1.23.0 (verifique a versão correta para a sua instalação)
const WA_WEB_VERSION = "2.2412.54"; // <<< ATUALIZE CONFORME NECESSÁRIO >>>
const WA_WEB_CACHE_URL = `https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/${WA_WEB_VERSION}.html`;

// ================================================================
// ===               FUNÇÕES DE CONTROLE DO CLIENTE             ===
// ================================================================

/**
 * Inicializa e configura o cliente whatsapp-web.js.
 * Retorna uma Promise que resolve quando o cliente está pronto ('ready')
 * ou rejeita em caso de erro fatal na inicialização/autenticação.
 * @param {object} trainingData - Dados de treinamento/contexto a serem passados para o messageHandler.
 * @returns {Promise<void>}
 * @throws {Error} Se a inicialização falhar criticamente.
 */
async function initialize(trainingData) {
  if (client || isInitializing) {
    logger.warn(
      "[WAPP Client Init] Inicialização já em progresso ou cliente já existe."
    );
    // Retorna a promise existente ou uma nova que será resolvida/rejeitada pelos eventos
    return new Promise((res, rej) => {
      if (isClientReady) {
        res(); // Já pronto, resolve imediatamente
      } else {
        // Anexa aos resolvers pendentes (se houver) ou cria novos
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
  _resetClientStateFlags(); // Reseta flags internas, exceto isInitializing
  logger.startup(
    "[WAPP Client Init] Configurando e inicializando cliente WWebJS..."
  );
  logger.wapp("Initializing client...");

  return new Promise((resolve, reject) => {
    clientReadyResolve = resolve;
    clientReadyReject = reject;

    try {
      logger.info(
        `[WAPP Client Init] Using remote WA Web cache v${WA_WEB_VERSION} from ${WA_WEB_CACHE_URL}`
      );
      // Log browser executable path more clearly
      if (CHROME_EXECUTABLE_PATH) {
        logger.info(
          `[WAPP Client Init] Usando instalação EXTERNA do Google Chrome em: ${CHROME_EXECUTABLE_PATH}`
        );
      } else {
        logger.warn(
          `[WAPP Client Init] CHROME_PATH não definido no .env. Puppeteer usará o Chromium padrão EMPACOTADO (pode NÃO suportar codecs de vídeo como H.264/AAC para envio nativo). Para envio nativo de vídeos, defina CHROME_PATH.`
        );
      }

      client = new Client({
        authStrategy: new LocalAuth({ dataPath: SESSION_DIR }),
        puppeteer: {
          // Usar 'new' em produção para headless real, false para ver o browser em dev
          headless: process.env.NODE_ENV === "production" ? "new" : false,
          executablePath: CHROME_EXECUTABLE_PATH,
          args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", // Essencial para Docker/Linux
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
            // '--single-process', // Pode causar instabilidade, evitar se possível
            "--disable-gpu", // Frequentemente necessário em headless
            "--disable-extensions", // Opcional: Reduzir consumo
            // Adicionar mais flags de otimização/compatibilidade se necessário
          ],
          timeout: WAPP_CLIENT_INIT_TIMEOUT_MS, // Timeout para launch/connect
        },
        webVersionCache: {
          type: "remote",
          remotePath: WA_WEB_CACHE_URL, // Usa URL baseada na versão constante
        },
        takeoverOnConflict: true, // Tenta assumir sessão se aberta em outro local
        takeoverTimeoutMs: 20000, // Tempo para tentar takeover
        qrMaxRetries: 3, // Tentativas de obter QR code
        authTimeoutMs: WAPP_AUTH_TIMEOUT_MS, // Timeout para usuário escanear QR
        // userAgent: 'Mozilla/5.0 ...' // Opcional: Definir User Agent específico se necessário
      });

      // Registra os handlers para os eventos do cliente
      _registerEventHandlers(trainingData);

      logger.debug("[WAPP Client Init] Chamando client.initialize()...");
      // A inicialização é assíncrona, os eventos ('qr', 'ready', 'auth_failure')
      // irão resolver ou rejeitar a Promise externa.
      client.initialize().catch((initError) => {
        // Este catch pega erros síncronos ou rejeições da promise interna do initialize()
        logger.fatal(
          "[WAPP Client Init] Erro CRÍTICO retornado/lançado por client.initialize()!",
          initError
        );
        _handleFatalError("CLIENT_INIT_FAILURE", initError); // Chama desligamento
      });
    } catch (configError) {
      // Erro na configuração do new Client()
      logger.fatal(
        "[WAPP Client Init] Erro CRÍTICO ao configurar o new Client().",
        configError
      );
      _handleFatalError("CLIENT_CONFIG_ERROR", configError);
    }
  });
}

/**
 * Destrói a instância atual do cliente WhatsApp de forma graciosa.
 * @returns {Promise<void>}
 */
async function destroy() {
  logger.shutdown(
    "[WAPP Client Destroy] Solicitado desligamento do cliente..."
  ); // Usando tipo SHUTDOWN
  const currentClient = client; // Referência local
  _resetClientStateFlags(); // LINHA CORRETA

  if (currentClient && typeof currentClient.destroy === "function") {
    try {
      // Tenta destruir com timeout
      const destroyPromise = currentClient.destroy();
      const timeoutPromise = sleep(15000).then(() => {
        throw new Error("Timeout (15s) ao destruir cliente WAPP.");
      });
      await Promise.race([destroyPromise, timeoutPromise]);
      logger.info("[WAPP Client Destroy] Cliente destruído com sucesso.");
    } catch (error) {
      logger.error(
        "[WAPP Client Destroy] Erro/Timeout ao destruir cliente (pode já estar fechado).",
        serializeError(error)
      );
    }
  } else {
    logger.info("[WAPP Client Destroy] Cliente não ativo ou já destruído.");
  }
}

/** Reseta as flags de estado interno do módulo. */
function _resetClientStateFlags() {
  // client é setado para null em destroy()
  currentQr = null;
  isClientReady = false;
  // isInitializing é controlado por initialize() e ready/error events
  if (qrRetryTimeout) clearTimeout(qrRetryTimeout);
  qrRetryTimeout = null;
  // Os resolvers/rejecters são resetados por destroy e no evento ready/error
}

/** Retorna a instância ativa do cliente WWebJS, ou null. */
function getClient() {
  return client;
}

/** Retorna se o cliente está autenticado e pronto para uso. */
function isReady() {
  return isClientReady;
}

/** Retorna o estado atual do cliente WWebJS ou um estado inferido. */
async function getClientState() {
  if (client && typeof client.getState === "function") {
    try {
      // WAState pode ser null durante inicialização/desconexão
      const state = await client.getState();
      return state || (isInitializing ? WAState.OPENING : "UNKNOWN"); // Retorna OPENING se inicializando e state for null
    } catch (error) {
      logger.warn(
        "[WAPP Client] Erro ao obter estado WWebJS.",
        serializeError(error)
      );
      return "ERROR_GETTING_STATE";
    }
  }
  // Se client não existe, infere estado baseado nas flags internas
  return isInitializing ? "INITIALIZING" : "UNINITIALIZED";
}

// ================================================================
// ===                  HANDLERS DE EVENTOS INTERNOS            ===
// ================================================================

/** Registra os handlers para os eventos principais do cliente WWebJS. */
function _registerEventHandlers(trainingData) {
  if (!client) return;

  // --- QR Code ---
  client.on("qr", (qr) => {
    logger.info("[Event QR] Novo QR Code recebido. Escaneie com o WhatsApp.");
    logger.wapp("QR Code Received", null, { qrLength: qr?.length });
    currentQr = qr;
    _displayQrCode(currentQr); // Mostra no console

    // Limpa timer antigo e agenda re-exibição
    if (qrRetryTimeout) clearTimeout(qrRetryTimeout);
    const qrRefreshDelay = 60 * 1000; // 1 minuto
    qrRetryTimeout = setTimeout(() => {
      qrRetryTimeout = null;
      // Verifica se ainda está esperando e tem QR
      if (!isClientReady && currentQr && isInitializing) {
        logger.warn(
          `[Event QR] Timeout ${
            qrRefreshDelay / 1000
          }s: Cliente não conectado. Re-exibindo QR...`
        );
        logger.wapp("QR Code Timeout - Re-displaying");
        _displayQrCode(currentQr);
      }
    }, qrRefreshDelay);
  });

  // --- Autenticação OK ---
  client.on("authenticated", (/*session*/) => {
    // Session não usada aqui
    logger.info("✅ [Event Authenticated] Cliente autenticado com sucesso!");
    logger.wapp("Authenticated");
    if (qrRetryTimeout) {
      clearTimeout(qrRetryTimeout);
      qrRetryTimeout = null;
    }
    currentQr = null;
  });

  // --- Falha na Autenticação ---
  client.on("auth_failure", async (msg) => {
    logger.fatal(
      "❌ [Event Auth Failure] FALHA NA AUTENTICAÇÃO!",
      new Error(`Auth Failure: ${msg}`)
    );
    logger.error(
      `   >> POSSÍVEL CAUSA: QR inválido/expirado, sessão revogada, problema de conexão/bloqueio.`
    );
    logger.error(
      `   >> AÇÃO RECOMENDADA: Exclua a pasta './${SESSION_DIR}' e reinicie a aplicação para gerar um NOVO QR Code.`
    );
    if (qrRetryTimeout) {
      clearTimeout(qrRetryTimeout);
      qrRetryTimeout = null;
    }
    currentQr = null;
    _handleFatalError("AUTH_FAILURE", new Error(msg)); // Desliga a aplicação
  });

  // --- Cliente Pronto para Uso ---
  client.on("ready", async () => {
    try {
      const botName =
        client.info?.pushname || botConfig.identity.firstName || "Bot";
      const botNumber = client.info?.wid?.user || "N/A";
      const platform = client.info?.platform || "N/A";
      const waVersion = client.info?.wa_version || "N/A";

      logger.ready(
        `🟢🟢🟢 CLIENTE WHATSAPP PRONTO! [${botName} (${botNumber})] 🟢🟢🟢`
      );
      logger.wapp("Client Ready", null, {
        botName,
        botNumber,
        platform,
        waVersion,
      });

      // Atualiza flags e resolve a Promise de inicialização
      isInitializing = false;
      isClientReady = true;
      if (qrRetryTimeout) {
        clearTimeout(qrRetryTimeout);
        qrRetryTimeout = null;
      }
      currentQr = null;
      if (clientReadyResolve) {
        clientReadyResolve(); // Resolve a promise retornada por initialize()
      }
    } catch (readyError) {
      // Erro DENTRO do handler 'ready' é crítico
      logger.fatal(
        "💥 FATAL: Erro inesperado no handler client.on('ready')!",
        readyError
      );
      _handleFatalError("READY_HANDLER_ERROR", readyError);
    } finally {
      // Garante limpeza dos resolvers da promise de inicialização
      clientReadyResolve = null;
      clientReadyReject = null;
    }
  });

  // --- Desconexão ---
  client.on("disconnected", (reason) => {
    logger.warn(
      `🔌 [Event Disconnected] Cliente desconectado! Razão: ${reason}`
    );
    logger.wapp("Disconnected", null, { reason });
    const wasReady = isClientReady; // Guarda estado anterior
    _resetClientStateFlags();
    client = null; // Limpa a instância do cliente
    // Só trata como erro fatal se *estava* pronto antes. Se desconectou durante init, já é erro fatal.
    if (wasReady) {
      _handleFatalError(`DISCONNECTED_${reason}`); // Inicia desligamento
    }
  });

  // --- Erros Gerais do Cliente ---
  client.on("error", (error) => {
    logger.error(
      "🆘 [Event Error] Erro geral no cliente WWebJS:",
      serializeError(error)
    );
    logger.wapp("Client Error", null, { error: serializeError(error) });
    // Verifica erros específicos que indicam problemas irrecuperáveis com o browser/puppeteer
    if (
      error.message?.includes("Page crashed") ||
      error.message?.includes("Target closed") ||
      error.message?.includes("Protocol error") ||
      error.message?.includes("Connection closed")
    ) {
      logger.fatal(
        "[WAPP Client] Erro CRÍTICO detectado (Puppeteer/Browser Crash?). Desligando..."
      );
      _handleFatalError("PUPPETEER_CRASH", error);
    }
    // Outros erros podem ser temporários, não necessariamente desligam.
  });

  // --- Mudança de Estado Interno ---
  client.on("change_state", (newState) => {
    logger.info(`🌀 [Event State Change] Novo estado WWebJS: ${newState}`);
    logger.wapp("State Changed", null, { newState });
    switch (newState) {
      case WAState.CONFLICT:
        logger.warn(
          "[WAPP Client] CONFLITO detectado (WhatsApp aberto em outro local?). Tentando reassumir..."
        );
        break;
      case WAState.UNPAIRED:
      case WAState.UNLAUNCHED:
        logger.error(
          `[WAPP Client] Estado CRÍTICO: ${newState}. Sessão perdida ou navegador fechado. Limpe './${SESSION_DIR}' e reinicie.`
        );
        _handleFatalError(`STATE_${newState}`);
        break;
      case WAState.TIMEOUT:
        logger.error(
          `[WAPP Client] Estado TIMEOUT durante conexão/autenticação. Verifique a rede/QR. Desligando.`
        );
        _handleFatalError("STATE_TIMEOUT");
        break;
      // Logar outros estados como DEBUG se necessário (PAIRING, OPENING, CONNECTED, etc.)
      case WAState.CONNECTED: // Já logado no evento 'ready'
      case WAState.PAIRING:
      case WAState.OPENING:
        logger.debug(`[WAPP Client] Estado transitório: ${newState}`);
        break;
    }
  });

  // --- Tela de Carregamento (Debug) ---
  client.on("loading_screen", (percent, message) => {
    logger.debug(`⏳ [Event Loading] ${percent}% ${message || ""}`);
  });

  // --- Mensagem Recebida ---
  // Delega para o messageHandler, passando client e trainingData
  client.on("message", async (message) => {
    try {
      // Rejeita mensagens de grupos explicitamente
      const chatId = message.from || null;
      if (!chatId) {
        logger.debug("[WAPP Client] Ignorando message: chatId indeterminado");
        return;
      }
      
      // REJEITA GRUPOS explicitamente
      if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
        logger.debug("[WAPP Client] Ignorando message de GRUPO. Grupos não são suportados.");
        return;
      }
      
      // Primeiramente, verifica se é uma intervenção humana 
      // (mensagem recebida não do bot)
      if (!message.fromMe) {
        const isHumanTakeover = await checkHumanIntervention(message, client);
        // Se a função detectou e processou uma intervenção humana, podemos parar aqui
        if (isHumanTakeover) {
          logger.debug(`[WAPP Client] Intervenção humana detectada e processada para ${message.from}`);
          return;
        }
      }
      
      // Adiciona try/catch aqui para isolar erros do messageHandler
      await processIncomingMessage(message, client, trainingData);
    } catch (messageHandlerError) {
      logger.error(
        `[WAPP Client] Erro não capturado DENTRO do processIncomingMessage para msg ${message.id?.id}`,
        messageHandlerError,
        message.from
      );
      // Considerar notificar o usuário sobre falha no processamento? Ou apenas logar?
    }
  });

  // --- Mensagem Criada (fromMe) ---
  // Usado para detectar intervenção humana
  client.on("message_create", async (message) => {
    if (!message) return;
    
    try {
      // Só lida com mensagens ENVIADAS pelo bot ou cliente (fromMe: true)
      if (!message.fromMe) return;
      
      // Garante que temos um chatId válido e NÃO é um grupo
      const chatId = message.to || null;
      if (!chatId) {
        logger.debug("[WAPP Client] Ignorando message_create: chatId indeterminado");
        return;
      }
      
      // REJEITA GRUPOS explicitamente
      if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
        logger.debug("[WAPP Client] Ignorando message_create de GRUPO. Grupos não são suportados.");
        return;
      }
      
      // Load checkHumanIntervention dynamically to avoid circular dependencies
      // Importação dinâmica para evitar dependências circulares
      const { checkHumanIntervention } = await import("./messageHandler.js");
      await checkHumanIntervention(message, client);
    } catch (err) {
      logger.error(
        "[WAPP Client] Erro ao executar checkHumanIntervention em message_create",
        err
      );
    }
  });

  // Registrar outros handlers de evento WWebJS conforme necessário (ex: 'group_join', 'change_battery', etc.)
  // client.on('change_battery', (batteryInfo) => { logger.info(`[Event Battery] Carga: ${batteryInfo.battery}%, Carregando: ${batteryInfo.plugged}`); });
}

// ================================================================
// ===                  FUNÇÕES AUXILIARES                      ===
// ================================================================

/**
 * Lida com erros fatais: rejeita a promise de inicialização (se pendente)
 * e dispara o graceful shutdown da aplicação.
 * @private
 */
function _handleFatalError(signal, error = null) {
  const errorToReject = error || new Error(signal);
  // Rejeita a promise de inicialização se ela ainda estiver pendente
  if (clientReadyReject) {
    logger.debug(
      `[WAPP Fatal] Rejeitando promise de inicialização devido a: ${signal}`
    );
    clientReadyReject(errorToReject);
  }
  // Limpa os resolvers para evitar chamadas múltiplas
  clientReadyResolve = null;
  clientReadyReject = null;
  isInitializing = false; // Marca que não está mais inicializando
  isClientReady = false;

  // Dispara o desligamento da aplicação principal
  // Usando import dinâmico para quebrar dependência cíclica main <-> whatsappClient
  // RECOMENDAÇÃO: Usar um sistema de eventos ou gerenciador de shutdown para melhor arquitetura.
  import("./main.js") // Ajuste o caminho se necessário
    .then(async ({ gracefulShutdown }) => {
      if (
        gracefulShutdown &&
        typeof gracefulShutdown === "function" &&
        !isShuttingDown
      ) {
        logger.info(
          `[WAPP Fatal] Chamando gracefulShutdown com sinal: ${signal}`
        );
        await gracefulShutdown(signal); // Chama o shutdown de main.js
      } else if (!isShuttingDown) {
        logger.fatal(
          `[WAPP Fatal] gracefulShutdown não encontrado/inválido em main.js ou já desligando. Forçando process.exit(1). Signal: ${signal}`
        );
        process.exit(1); // Fallback extremo
      }
    })
    .catch((importErr) => {
      logger.fatal(
        "[WAPP Fatal] Falha CRÍTICA ao importar gracefulShutdown de main.js! Forçando process.exit(1).",
        importErr
      );
      process.exit(1); // Fallback extremo
    });
}

/**
 * Exibe o QR Code no terminal de forma clara.
 * @private
 */
function _displayQrCode(qrString) {
  if (!qrString) {
    logger.warn("[QR Display] Tentativa de exibir QR Code vazio.");
    return;
  }
  try {
    // Limpa console anterior se possível (pode não funcionar em todos terminais)
    // process.stdout.write('\x1Bc'); // Ou usar \033c
    console.log("\n" + "-".repeat(60));
    logger.info("📱 Escaneie o QR Code abaixo com o WhatsApp do seu celular:");
    qrcode.generate(qrString, { small: true }, (output) => {
      if (output) {
        console.log(output);
        console.log("-".repeat(60));
        logger.info(
          "✨ Aguardando leitura e autenticação... ✨ (O QR atualiza automaticamente)"
        );
      } else {
        logger.error(
          "[QR Display] Falha ao gerar QR code para o terminal (qrcode-terminal retornou nulo)."
        );
      }
    });
    console.log("\n");
  } catch (error) {
    logger.error(
      "[QR Display] Erro CRÍTICO ao tentar exibir QR Code no terminal.",
      serializeError(error)
    );
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================
export default {
  /** Inicializa o cliente e retorna Promise que resolve quando pronto. */
  initialize,
  /** Destrói o cliente WWebJS. */
  destroy,
  /** Retorna a instância do cliente WWebJS ou null. */
  getClient,
  /** Retorna true se o cliente estiver pronto. */
  isReady,
  /** Retorna o estado atual do cliente WWebJS. */
  getClientState,
  
};

// --- END OF FILE whatsappClient.js ---
