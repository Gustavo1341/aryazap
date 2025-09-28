// --- START OF FILE main.js ---

/**
 * main.js - Ponto de Entrada Principal da Aplicação SmartZap AI Sales Agent (v. Robusta)
 * ============================================================================================
 * Responsabilidades:
 * 1. Carregar configurações e variáveis de ambiente (.env).
 * 2. Orquestrar a inicialização sequencial e segura dos módulos principais:
 * - Logging (Inicializado na importação)
 * - Diretórios Essenciais (FS Handler)
 * - Validação das Configurações (Config Validator)
 * - Banco de Dados (Pool de Conexão)
 * - Dados de Treinamento/Contexto (Training Loader)
 * - Cliente WhatsApp (WWebJS Wrapper)
 * - Servidor API (Express - Opcional)
 * 3. Gerenciar o desligamento seguro (graceful shutdown) da aplicação.
 * 4. Lidar com sinais do sistema (SIGINT, SIGTERM) e exceções não capturadas.
 * ============================================================================================
 */

// --- Node Standard Modules ---
import path from "path";
import { fileURLToPath } from "node:url";
import util from "node:util";
import dotenv from "dotenv";
import fs from 'fs/promises';

// --- Load Environment Variables Early ---
// Garante que .env seja lido antes de qualquer módulo que dependa dele.
dotenv.config();

// --- Core Application Modules ---
// Logger é importado primeiro pois outros módulos dependem dele.
import logger from "./logger.js";
import dbService from "./db.js";
import {
  initializeFileSystem,
  cleanupSessionFolder,
} from "./fileSystemHandler.js";
import { validateAllConfigurations } from "./configValidator.js";
import { loadAllTrainingData } from "./trainingLoader.js";
import whatsAppClient from "./whatsappClient.js";
import apiServer from "./apiServer.js";
import botConfig from "./botConfig.js"; // Usado principalmente para obter configs específicas no main

// --- Global Variables & Constants ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const APP_VERSION = process.env.npm_package_version || "?.?.?"; // Do package.json
const MIN_NODE_VERSION_MAJOR = 18; // Versão mínima recomendada do Node.js

let isShuttingDown = false; // Flag para controle do graceful shutdown
let loadedTrainingData = null; // Cache dos dados de treinamento

// ================================================================
// ===            VERIFICAÇÃO DE VERSÃO DO NODE.JS              ===
// ================================================================

function checkNodeVersion() {
  const [major] = process.versions.node.split(".").map(Number);
  if (major < MIN_NODE_VERSION_MAJOR) {
    console.error(
      `[FATAL] Versão do Node.js (${process.versions.node}) é INFERIOR à mínima recomendada (${MIN_NODE_VERSION_MAJOR}). Atualize o Node.js.`
    );
    logger.fatal(
      `Versão Node.js ${process.versions.node} é incompatível (requer >= ${MIN_NODE_VERSION_MAJOR}).`
    );
    process.exit(1); // Sai imediatamente
  }
  logger.info(`Versão Node.js: ${process.versions.node} (OK)`);
}

// ================================================================
// ===                SEQUÊNCIA DE INICIALIZAÇÃO                ===
// ================================================================

/**
 * Orquestra a inicialização passo-a-passo da aplicação.
 * Em caso de falha crítica em qualquer etapa, inicia o gracefulShutdown.
 */
async function startApp() {
  console.log("\n" + "=".repeat(60));
  console.log(`🚀 Iniciando Agente SmartZap IA (v${APP_VERSION})... 🚀`);
  console.log("=".repeat(60));
  logger.startup("===== FASE DE INICIALIZAÇÃO ====="); // Usando tipo STARTUP
  const startTime = performance.now();
  let step = 0;

  try {
    // --- 0. Verificar Versão Node.js ---
    checkNodeVersion(); // Sai se a versão for incompatível

    // --- 1. Inicializar Diretórios ---
    step = 1;
    logger.startup(`[Init ${step}/7] Inicializando Sistema de Arquivos...`);
    await initializeFileSystem(); // Pode lançar erro fatal

    // --- 2. Validar Configurações ---
    // Valida botConfig, pricing, etc., ANTES de conectar ao DB ou iniciar serviços
    step = 2;
    logger.startup(`[Init ${step}/7] Validando Configurações...`);
    const criticalConfigIssues = await validateAllConfigurations(); // Retorna número de erros críticos
    if (criticalConfigIssues > 0) {
      // Se houver erros críticos de configuração, não adianta continuar.
      throw new Error(
        `Configuração inválida detectada (${criticalConfigIssues} erro(s) crítico(s)). Verifique os logs e o .env.`
      );
    }
    logger.info("[Init] Configurações validadas com sucesso.");

    // --- 3. Conectar ao Banco de Dados ---
    step = 3;
    logger.startup(`[Init ${step}/7] Conectando ao Banco de Dados...`);
    await dbService.initialize(); // Pode lançar erro fatal (conexão, migração)

    // --- 4. Carregar Dados de Treinamento/Contexto ---
    // Carrega KB, Dados do Produto (pricing.js), Provas Sociais
    step = 4;
    logger.startup(
      `[Init ${step}/7] Carregando Dados de Treinamento/Contexto...`
    );
    const targetProductId = botConfig.behavior.salesStrategy.targetProductId; // Pega ID do botConfig validado
    loadedTrainingData = await loadAllTrainingData(targetProductId);
    if (!loadedTrainingData || !loadedTrainingData.isLoaded) {
      logger.warn(
        "[Init] Nenhum dado de treinamento/contexto significativo foi carregado. IA pode ter performance limitada."
      );
    }
    // Verifica se provas sociais OBRIGATÓRIAS pelo funil foram encontradas
    if (loadedTrainingData && !loadedTrainingData.allRequiredProofsFound) {
      // Tornando isso um erro fatal, pois o funil provavelmente depende delas
      throw new Error(
        "ERRO CRÍTICO: Arquivos de prova social requeridos pelo funil não foram encontrados! Verifique a pasta 'provasSociais' e a configuração do funil."
      );
    } else if (loadedTrainingData) {
      logger.info("[Init] Dados de Treinamento/Contexto carregados.");
    }

    // --- 5. Inicializar Cliente WhatsApp ---
    // Configura e inicializa o whatsapp-web.js, aguardando o 'ready'
    step = 5;
    logger.startup(
      `[Init ${step}/7] Inicializando Cliente WhatsApp... (Aguardando QR/Autenticação)`
    );
    // Clean up session lockfiles before initializing WhatsApp client
    await cleanupSessionLockfiles();
    
    // Passa os dados de treinamento carregados para o handler de mensagens
    await whatsAppClient.initialize(loadedTrainingData); // Aguarda o evento 'ready' internamente
    logger.startup("[Init] Cliente WhatsApp PRONTO e autenticado."); // Log movido para após a resolução

    // --- 6. Iniciar Servidor API (Opcional) ---
    step = 6;
    if (apiServer.isEnabled()) {
      logger.startup(
        `[Init ${step}/7] Iniciando Servidor API na porta ${botConfig.server.port}...`
      );
      await apiServer.start(); // Inicia o servidor Express
    } else {
      logger.info(
        `[Init ${step}/7] Servidor API desabilitado (PORT não configurado ou <= 0). Pulando.`
      );
    }

    // --- 7. Finalização ---
    step = 7;
    const duration = (performance.now() - startTime).toFixed(0);
    logger.ready(
      `===== INICIALIZAÇÃO CONCLUÍDA COM SUCESSO (${duration} ms) =====`
    ); // Usando tipo READY
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    logger.fatal(
      `💥 FATAL: Erro durante a Etapa ${step} da Inicialização!`,
      error
    );
    // Inicia desligamento seguro devido à falha na inicialização
    await gracefulShutdown(`STARTUP_ERROR_STEP_${step}`);
    // A função gracefulShutdown chamará process.exit
  }
}

// ================================================================
// ===               DESLIGAMENTO SEGURO (Graceful)             ===
// ================================================================

/**
 * Realiza o desligamento ordenado e seguro da aplicação.
 * Fecha conexões (API, WAC, DB), salva estados pendentes (se aplicável), finaliza logger.
 * @param {string} [signal="UNKNOWN"] - O sinal ou razão para o desligamento.
 */
async function gracefulShutdown(signal = "UNKNOWN") {
  if (isShuttingDown) {
    logger.warn(
      `[Shutdown] Desligamento já em progresso (Solicitado por: ${signal}). Ignorando nova chamada.`
    );
    return;
  }
  isShuttingDown = true;
  // Determina se é um desligamento por erro ou normal
  const isErrorShutdown = !(
    (
      signal === "SIGINT" ||
      signal === "SIGTERM" ||
      signal === "SIGUSR2" ||
      signal.startsWith("DISCONNECTED")
    ) // Considera desconexão normal
  );
  const exitCode = isErrorShutdown ? 1 : 0;
  const startTime = performance.now();

  console.log("\n"); // Espaçamento no console
  logger.shutdown(
    `🚨 [Shutdown] Sinal/Motivo: ${signal}. Iniciando desligamento ordenado... (Código Saída Esperado: ${exitCode})`
  );

  // --- Executa na Ordem Reversa da Inicialização ---

  // 1. Parar API Server (se ativo)
  if (apiServer.isEnabled() && apiServer.getInstance()) {
    logger.info("[Shutdown] Parando Servidor API...");
    try {
      await apiServer.stop(3000); // Timeout de 3s para conexões existentes
    } catch (apiErr) {
      logger.error("[Shutdown] Erro (não fatal) ao parar API Server.", apiErr);
    }
  } else {
    logger.debug("[Shutdown] Servidor API não estava ativo ou já parado.");
  }

  // 2. Desconectar Cliente WhatsApp
  logger.info("[Shutdown] Desconectando Cliente WhatsApp...");
  try {
    // Checa se o cliente foi inicializado antes de tentar destruir
    if (whatsAppClient.getClient()) {
      await whatsAppClient.destroy();
    } else {
      logger.info(
        "[Shutdown] Cliente WhatsApp não parecia estar inicializado."
      );
    }
  } catch (waErr) {
    logger.error(
      "[Shutdown] Erro (não fatal) ao desconectar Cliente WhatsApp.",
      waErr
    );
    // Limpa sessão apenas em cenários específicos onde ela pode estar corrompida
    if (
      signal === "AUTH_FAILURE" ||
      signal.startsWith("STATE_UNPAIRED") ||
      signal.startsWith("STATE_UNLAUNCHED") ||
      signal === "PUPPETEER_CRASH"
    ) {
      await cleanupSessionFolder(`[Shutdown:${signal}]`);
    }
  }

  // 3. Salvar Estados Pendentes / Outras Limpezas
  // TODO: Implementar se houver buffers ou estados que precisam ser persistidos
  // logger.info("[Shutdown] Salvando estados pendentes...");
  // Ex: await stateManager.flushAndSaveAll();

  // 4. Desconectar Banco de Dados
  logger.info("[Shutdown] Desconectando Banco de Dados...");
  try {
    // Checa se o DB foi inicializado antes de fechar
    if (dbService.isReady() || dbService.getPool()) {
      await dbService.close();
    } else {
      logger.info("[Shutdown] Pool do DB não estava pronto ou já fechado.");
    }
  } catch (dbErr) {
    logger.error("[Shutdown] Erro (não fatal) ao desconectar DB.", dbErr);
  }

  // 5. Finalizar Logger (escrever logs pendentes da fila)
  const shutdownDuration = (performance.now() - startTime).toFixed(0);
  logger.shutdown(
    `[Shutdown] Desligamento concluído em ${shutdownDuration} ms. Finalizando logs...`
  ); // Log como SHUTDOWN type

  try {
    await logger.shutdown(5000); // Espera até 5s para logs serem escritos
    // Não usar logger aqui, pois ele acabou de ser finalizado
    console.log(
      `[${new Date().toISOString()}] INFO [SHUTD] Logger finalizado. Saindo com código ${exitCode}.`
    );
    process.exit(exitCode);
  } catch (logShutdownErr) {
    console.error(
      `[${new Date().toISOString()}] FATAL [SHUTD] ERRO CRÍTICO NO SHUTDOWN DO LOGGER: ${logShutdownErr}. Forçando saída ${exitCode}.`
    );
    process.exit(exitCode); // Força a saída
  }
}

// ================================================================
// ===         HANDLERS DE SINAIS E EXCEÇÕES GLOBAIS            ===
// ================================================================

// --- Captura sinais de término comuns ---
process.on("SIGINT", async () => {
  logger.warn("Sinal SIGINT (Ctrl+C) recebido.");
  try {
    // Check if whatsAppClient exists and has client
    if (whatsAppClient && typeof whatsAppClient.getClient === 'function') {
      const client = whatsAppClient.getClient();
      if (client && client.info) {
        logger.info('Tentando fazer logout do WhatsApp...');
        await client.logout().catch(err => {
          logger.error('Erro durante logout do WhatsApp:', err);
        });
      }
    }
  } catch (e) {
    logger.error('Erro durante processo de desligamento:', e);
  } finally {
    gracefulShutdown("SIGINT");
  }
});
process.on("SIGTERM", () => {
  logger.warn("Sinal SIGTERM recebido.");
  gracefulShutdown("SIGTERM");
});
process.on("SIGUSR2", () => {
  logger.warn("Sinal SIGUSR2 (nodemon restart) recebido.");
  gracefulShutdown("SIGUSR2");
}); // Usado por nodemon

// --- Captura exceções não tratadas ---
process.on("uncaughtException", async (err, origin) => {
  // Log Síncrono como fallback caso o logger falhe
  console.error(
    `\n\n💥💥💥 FATAL UNCAUGHT EXCEPTION (Origin: ${origin}) 💥💥💥`
  );
  console.error(err);
  console.error("=========================================\n");
  // Tenta logar via logger, mas não depende disso
  try {
    logger.fatal(`FATAL: Uncaught Exception! Origin: ${origin}`, err);
  } catch {
    /* ignore logger error */
  }
  // Inicia shutdown seguro
  await gracefulShutdown(`UNCAUGHT_EXCEPTION_${origin}`);
});

// --- Captura rejeições de Promises não tratadas ---
process.on("unhandledRejection", async (reason, promise) => {
  // Log Síncrono como fallback
  console.error("\n\n💥💥💥 FATAL UNHANDLED PROMISE REJECTION 💥💥💥");
  console.error("Reason:", reason);
  // console.error("Promise:", promise); // Promise pode ser muito grande/complexo
  console.error("=========================================\n");
  // Tenta logar via logger
  try {
    const errorReason =
      reason instanceof Error ? reason : new Error(util.inspect(reason));
    logger.fatal("FATAL: Unhandled Promise Rejection!", errorReason, null, {
      promiseInspect: util.inspect(promise, { depth: 1 }),
    });
  } catch {
    /* ignore logger error */
  }
  // Inicia shutdown seguro
  await gracefulShutdown("UNHANDLED_REJECTION");
});

// --- Log na saída final do processo ---
process.on("exit", (code) => {
  // !! APENAS CÓDIGO SÍNCRONO AQUI !!
  // Não usar logger aqui, pois já foi finalizado.
  console.log(
    `[${new Date().toISOString()}] INFO [EXIT ] Processo finalizado com código: ${code}`
  );
});

// ================================================================
// ===                      INÍCIO DA EXECUÇÃO                    ===
// ================================================================

// Inicia a aplicação. O catch final é uma última barreira de segurança.
startApp().catch(async (finalCatchError) => {
  console.error(
    "\n<<<< ERRO CATASTRÓFICO NÃO TRATADO DURANTE STARTUP (catch final) >>>>",
    finalCatchError
  );
  try {
    logger.fatal("Erro catastrófico final durante startup!", finalCatchError);
  } catch {
    /* ignore */
  }
  if (!isShuttingDown) {
    await gracefulShutdown("FINAL_CATCH_ERROR");
  } else {
    // Se já estava desligando, força a saída com erro para garantir término.
    process.exit(1);
  }
});

// Add this helper function before the main bot initialization
/**
 * Attempts to clean up session lockfiles on startup to prevent EBUSY errors
 */
async function cleanupSessionLockfiles() {
  const sessionPath = path.join(process.cwd(), 'session', 'session');
  try {
    // Check if the directory exists first
    await fs.access(sessionPath).catch(() => {
      logger.info("[Startup] Session directory doesn't exist yet. No cleanup needed.");
      return false;
    });
    
    const lockfilePath = path.join(sessionPath, 'lockfile');
    
    // Try to remove lockfile if it exists
    try {
      await fs.access(lockfilePath);
      await fs.unlink(lockfilePath).catch(err => {
        if (err.code === 'EBUSY' || err.code === 'EPERM') {
          logger.warn(`[Startup] Session lockfile is locked by another process. Will continue anyway.`);
        } else {
          throw err;
        }
      });
      logger.info("[Startup] Previous session lockfile cleaned successfully.");
    } catch (err) {
      if (err.code === 'ENOENT') {
        logger.debug("[Startup] No lockfile found. Clean startup.");
      } else {
        throw err;
      }
    }
    
    return true;
  } catch (error) {
    logger.warn("[Startup] Failed to cleanup session lockfiles:", error);
    return false;
  }
}