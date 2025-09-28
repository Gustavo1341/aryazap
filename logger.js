// --- START OF FILE logger.js ---

/**
 * logger.js - Sistema de Logging Centralizado e Configurável (v. Robusta 3 - Scope Fix)
 * =====================================================================================
 * // ... (Descrição mantida) ...
 * Corrige ReferenceError passando thresholds como argumentos para funções internas.
 * =====================================================================================
 */

import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import util from "node:util";
import { fileURLToPath } from "node:url";
import { serializeError } from "serialize-error";
import dotenv from "dotenv";

dotenv.config();

// ================================================================
// ===        DEFINIÇÕES PRIMÁRIAS E CONSTANTES ESSENCIAIS      ===
// ================================================================

// --- Níveis de Log (Definidos Primeiro) ---
const LOG_LEVELS = Object.freeze({ /* ... (como antes) ... */
    FATAL: 0, ERROR: 1, WARN: 2, INFO: 3, DEBUG: 4, TRACE: 5,
});
const LEVEL_NAMES = Object.freeze({ /* ... (como antes) ... */
    0: "FATAL", 1: "ERROR", 2: "WARN", 3: "INFO", 4: "DEBUG", 5: "TRACE",
});

// --- Configurações Padrão ---
// ... (defaults como antes) ...
const DEFAULT_CONSOLE_LEVEL = "INFO";
const DEFAULT_FILE_LEVEL = "DEBUG";
const DEFAULT_LOG_FORMAT = "text";
const DEFAULT_MAX_LOG_SIZE_MB = 20;
const DEFAULT_MAX_LOG_BACKUPS = 3;
const DEFAULT_LOG_DIR_NAME = "logs";
const DEFAULT_LOG_FILE_NAME = "dpaLog.log";

/**
 * Retorna o timestamp atual no formato ISO ajustado para o timezone configurado
 * @returns {string} Timestamp ISO com horário local ajustado
 */
function getLocalTimestamp() {
    const timezone = process.env.TZ || 'America/Sao_Paulo';
    try {
        return new Date().toLocaleString('sv-SE', { timeZone: timezone });
    } catch (error) {
        console.warn(`[Logger] Timezone inválida ou não suportada: "${timezone}". Usando UTC como fallback. Erro:`, error.message);
        return new Date().toISOString();
    }
}

// --- Helper para Níveis ---
const getLevelValue = (levelName, defaultLevelValue) => { /* ... (como antes) ... */
    const nameUpper = levelName?.toUpperCase(); return LOG_LEVELS[nameUpper] ?? defaultLevelValue;
};

// --- Determinação dos Níveis e Formato ATIVOS ---
const CONSOLE_LOG_LEVEL_NAME = (process.env.CONSOLE_LOG_LEVEL || DEFAULT_CONSOLE_LEVEL).toUpperCase();
const FILE_LOG_LEVEL_NAME = (process.env.FILE_LOG_LEVEL || DEFAULT_FILE_LEVEL).toUpperCase();
const LOG_FORMAT = (process.env.LOG_FORMAT || DEFAULT_LOG_FORMAT).toLowerCase();
const MAX_LOG_SIZE_MB = parseInt(process.env.MAX_LOG_SIZE_MB || String(DEFAULT_MAX_LOG_SIZE_MB), 10);
const MAX_LOG_BACKUPS = parseInt(process.env.MAX_LOG_BACKUPS || String(DEFAULT_MAX_LOG_BACKUPS), 10);
const MAX_LOG_SIZE_BYTES = Math.max(1 * 1024 * 1024, MAX_LOG_SIZE_MB * 1024 * 1024);

// --- Níveis Numéricos Threshold ---
const CONSOLE_THRESHOLD = getLevelValue(CONSOLE_LOG_LEVEL_NAME, LOG_LEVELS.INFO);
const FILE_THRESHOLD = getLevelValue(FILE_LOG_LEVEL_NAME, LOG_LEVELS.DEBUG);

// --- Flags para Logs Especiais ---
const parseBoolEnvFlag = (envVar, defaultValue) => { /* ... (como antes) ... */
    const v = process.env[envVar]; return (v === undefined || v === null) ? defaultValue : v.toLowerCase() !== 'false';
};
const LOG_INTERACTIONS = parseBoolEnvFlag("LOG_INTERACTIONS", true);
const LOG_TAKEOVERS = parseBoolEnvFlag("LOG_TAKEOVERS", true);
const LOG_SPAM = parseBoolEnvFlag("LOG_SPAM", true);

// --- Diretórios e Arquivos ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = process.env.APP_ROOT || path.resolve(__dirname, "..");
const LOG_DIR = process.env.LOG_DIR_PATH ? path.resolve(process.env.LOG_DIR_PATH) : path.resolve(PROJECT_ROOT, DEFAULT_LOG_DIR_NAME);
const LOG_FILE = path.join(LOG_DIR, DEFAULT_LOG_FILE_NAME);

// --- Cores e Formatação ---
const COLORS = Object.freeze({ /* ... (como antes) ... */
    RESET: "\x1b[0m", BOLD: "\x1b[1m", RED: "\x1b[31m", YELLOW: "\x1b[33m",
    CYAN: "\x1b[36m", MAGENTA: "\x1b[35m", WHITE: "\x1b[37m", GRAY: "\x1b[90m",
    BG_RED_WHITE: "\x1b[41m\x1b[37m",
});
const LEVEL_FORMATTING = Object.freeze({ /* ... (como antes) ... */
    [LOG_LEVELS.FATAL]: { color: COLORS.BG_RED_WHITE, prefix: "FATAL" }, [LOG_LEVELS.ERROR]: { color: COLORS.RED, prefix: "ERROR" },
    [LOG_LEVELS.WARN]: { color: COLORS.YELLOW, prefix: "WARN " }, [LOG_LEVELS.INFO]: { color: COLORS.CYAN, prefix: "INFO " },
    [LOG_LEVELS.DEBUG]: { color: COLORS.WHITE, prefix: "DEBUG" }, [LOG_LEVELS.TRACE]: { color: COLORS.GRAY, prefix: "TRACE" },
});
const TYPE_FORMATTING = Object.freeze({ /* ... (como antes) ... */
    INTERACTION:{c:COLORS.MAGENTA,p:"INTER"},TAKEOVER:{c:COLORS.MAGENTA,p:"TAKE "},SPAM:{c:COLORS.YELLOW,p:"SPAM "},READY:{c:COLORS.CYAN+COLORS.BOLD,p:"READY"},SHUTDOWN:{c:COLORS.CYAN+COLORS.BOLD,p:"SHUTD"},STARTUP:{c:COLORS.CYAN+COLORS.BOLD,p:"START"},DB:{c:COLORS.CYAN,p:"DB   "},VALIDATE:{c:COLORS.YELLOW,p:"VALID"},FS:{c:COLORS.GRAY,p:"FS   "},AI:{c:COLORS.MAGENTA,p:"AI   "},WAPP:{c:COLORS.CYAN,p:"WAPP "},API:{c:COLORS.CYAN,p:"API  "},MEDIA:{c:COLORS.GRAY,p:"MEDIA"},STATE:{c:COLORS.GRAY,p:"STATE"},RESPONSE:{c:COLORS.MAGENTA,p:"RESP "},
});

// --- Constantes Internas ---
const MAX_QUEUE_SIZE = 500;
const STREAM_REOPEN_DELAY_MS = 2000;
const MAX_STREAM_REOPEN_ATTEMPTS = 3;

// ================================================================
// ===                   ESTADO INTERNO DO LOGGER               ===
// ================================================================
/** @type {fs.WriteStream | null} */
let logStream = null;
let isStreamClosing = false;
let isStreamInitialized = false;
let streamErrorLogged = false;
let logQueue = [];
let streamReopenAttempts = 0;
let isAttemptingStreamReopen = false;

// ================================================================
// ===                   FUNÇÕES DE FORMATAÇÃO                  ===
// ================================================================
// (Definidas ANTES das funções que as usam)

/** Formata o ID de contexto */
const formatContextId = (contextIdInput) => {
    // Caso em que contextIdInput é nulo ou indefinido - retorna genérico
    if (!contextIdInput) return "[System]";
    
    // Se o input é string, mas parece ser um JSON malformado contendo "chatId"
    if (typeof contextIdInput === "string" && contextIdInput.includes("chatId:")) {
        try {
            // Tenta extrair o valor do chatId de uma string parcial como "{ chatId: '12345..."
            const match = contextIdInput.match(/chatId:\s*['"]([^'"]+)/);
            if (match && match[1]) {
                // Extrai apenas a parte numérica/ID
                const extractedId = match[1].trim();
                return `[Ctx:${extractedId}]`;
            }
        } catch {
            // Se falhar a extração, continua para outras verificações
        }
    }
    
    // Caso em que contextIdInput é um objeto
    if (typeof contextIdInput !== "string") {
        try {
            // Tenta inspecionar o objeto de forma compacta
            return `[Ctx:${util.inspect(contextIdInput, { 
                compact: true, 
                breakLength: 20, 
                depth: 0 
            }).slice(0, 20)}]`;
        } catch {
            return "[Ctx:InspectErr]";
        }
    }
    
    // Caso em que contextIdInput contém @ (ID típico WhatsApp)
    if (contextIdInput.includes("@")) {
        try {
            const idPart = contextIdInput.split("@")[0];
            // Se o ID for longo, trunca
            return idPart.length > 15 
                ? `[Ctx:${idPart.substring(0, 5)}..${idPart.slice(-5)}]` 
                : `[Ctx:${idPart}]`;
        } catch {
            return "[Ctx:ParseErr]";
        }
    }
    
    // Caso padrão - apenas trunca se for muito longo
    return contextIdInput.length > 20 
        ? `[Ctx:${contextIdInput.substring(0, 8)}..${contextIdInput.slice(-8)}]` 
        : `[Ctx:${contextIdInput}]`;
};

/**
 * Formata entrada para CONSOLE.
 * @param {object} logEntry - Objeto de log.
 * @param {number} consoleThresholdParam - **NOVO:** Nível threshold passado como parâmetro.
 * @returns {string} String formatada para console.
 */
function formatForConsole(logEntry, consoleThresholdParam) { // << RECEBE THRESHOLD
    const { timestamp, level, message, contextId, details, error, logType } = logEntry;
    const formatting = TYPE_FORMATTING[logType] || LEVEL_FORMATTING[level] || LEVEL_FORMATTING[LOG_LEVELS.INFO];
    // Adiciona fallback seguro para o prefixo e cor
    const prefixBase = formatting.prefix || LEVEL_NAMES[level] || "UNKN"; // Usa nome do nível ou 'UNKN' como fallback
    const prefix = prefixBase.padEnd(5); // Agora prefixBase sempre será uma string
    const color = formatting.color || COLORS.WHITE; // Fallback de cor
    const time = timestamp.substring(11, 23);
    const ctxIdFormatted = formatContextId(contextId); let detailsPart = "";

    // Usa o THRESHOLD PASSADO COMO PARÂMETRO
    if (details && consoleThresholdParam >= LOG_LEVELS.DEBUG) {
        try { /* ... (lógica de inspect como antes) ... */
            const dp = util.inspect(details, { colors: true, depth: 1, compact: true, breakLength: 100 }).replace(/\n\s*/g, " "); detailsPart = ` ${COLORS.GRAY}| ${dp.substring(0, 120)}${dp.length > 120 ? "..." : ""}${COLORS.RESET}`;
        } catch { detailsPart = ` ${COLORS.GRAY}(Err detalhes)${COLORS.RESET}`; }
    } else if (details) { detailsPart = ` ${COLORS.GRAY}(+detalhes)${COLORS.RESET}`; }

    let errorPart = "";
    if (error) {
        try { /* ... (lógica de serializeError como antes) ... */
             const se = serializeError(error); const ec = COLORS.RED; errorPart = `\n  ${ec}↳ ${se.name || "Error"}: ${se.message || "[No Message]"}${COLORS.RESET}`;
             // Usa o THRESHOLD PASSADO COMO PARÂMETRO
             if (se.stack && consoleThresholdParam >= LOG_LEVELS.DEBUG) { const ss = se.stack.split('\n').slice(1, 4).map(l => l.trim()).join('\n    '); errorPart += `\n    ${COLORS.GRAY}${ss}${COLORS.RESET}`; }
        } catch { errorPart = `\n  ${COLORS.RED}↳ [Err Format Error]${COLORS.RESET}`; }
    }
    return `${time} ${color}${prefix}${COLORS.RESET} ${ctxIdFormatted} ${message}${detailsPart}${errorPart}`;
}

/** Formata entrada para ARQUIVO (formato TEXTO). */
function formatForFileText(logEntry) {
    const { timestamp, level, message, contextId, details, error, logType } = logEntry;
    const levelNamePart = TYPE_FORMATTING[logType]?.prefix; // Pega o prefixo de forma segura
    const levelName = (levelNamePart ? levelNamePart.trim() : null) || LEVEL_NAMES[level] || "INFO"; // Chama trim() apenas se existir, senão usa fallback
    const ctxFormatted = formatContextId(contextId);
    const parts = [timestamp, `[${levelName.padEnd(5)}]`, ctxFormatted, message];
    if (details) {
        try {
            const id = util.inspect(details, { depth: 4, colors: false, compact: false, breakLength: 180, showHidden: false }).replace(/\r?\n/g, " <-NL-> ");
            parts.push(`| Details: ${id}`);
        } catch (e) {
            parts.push(`| Details: [Inspect Error: ${e.message}]`);
        }
    }
    if (error) {
        try {
            const se = serializeError(error);
            parts.push(`| ErrName: ${se.name || "Unknown"}`);
            parts.push(`| ErrMsg: ${se.message || "[No Message]"}`);
            if (se.stack) {
                const cs = se.stack.replace(/\r?\n/g, " <= ").replace(/\s{2,}/g, " ");
                parts.push(`| Stack: ${cs}`);
            }
            Object.keys(se).forEach(key => {
                if (!["name", "message", "stack"].includes(key)) {
                    try {
                        parts.push(`| ErrProp_${key}: ${util.inspect(se[key], { depth: 2 })}`);
                    } catch {
                        parts.push(`| ErrProp_${key}: [Inspect Error]`);
                    }
                }
            });
        } catch (seErr) {
            parts.push(`| Error: [Serialize Error: ${seErr.message}]`);
            try {
                parts.push(`| RawErrorInspect: ${util.inspect(error, { depth: 1 }).replace(/\r?\n/g, " <-NL-> ")}`);
            } catch {
                parts.push(`| RawErrorInspect: [Inspect Error]`);
            }
        }
    }
    return parts.join(" ") + "\n";
}

/** Formata entrada para ARQUIVO (formato JSON). */
function formatForJsonFile(logEntry) { /* ... (lógica mantida com fallback de inspect) ... */
    const { timestamp, level, message, contextId, details, error, logType } = logEntry; const jsonPayload = { timestamp, level, levelName: LEVEL_NAMES[level] || "UNKNOWN", type: logType || LEVEL_NAMES[level], message, contextId: formatContextId(contextId).replace(/^\[Ctx:|\]$/g, ""), pid: process.pid }; if (details !== null && details !== undefined) { try { jsonPayload.details = JSON.parse(JSON.stringify(details, (k, v) => v instanceof Error ? serializeError(v) : (typeof v === 'bigint' ? v.toString() : v))); } catch (stringifyError) { try { jsonPayload.details_fallback_inspect = util.inspect(details, { depth: 2, colors: false }); } catch { jsonPayload.details_fallback_inspect = "[Inspect Error]"; } jsonPayload.details_stringify_error = stringifyError.message; } } if (error) { try { jsonPayload.error = serializeError(error); } catch (serializeErr) { jsonPayload.error = { name: "SerializeError", message: serializeErr.message, raw_inspect: util.inspect(error, { depth: 1, colors: false }) }; } } try { return JSON.stringify(jsonPayload) + "\n"; } catch (finalStringifyError) { const ft = getLocalTimestamp(); return `{"timestamp":"${ft}","level":${LOG_LEVELS.ERROR},"levelName":"ERROR","type":"LOG_ERROR","message":"Falha CRÍTICA stringify log JSON","originalMessage":"${message.replace(/"/g, '\\"')}", "error":{"name":"FinalStringifyError","message":"${finalStringifyError.message}"}}\n`; }
}


// ================================================================
// ===           INICIALIZAÇÃO E GERENCIAMENTO DO ARQUIVO       ===
// ================================================================
// (Funções _rotateLogFileIfNeeded, _cleanupOldBackups, initializeLogFile, flushLogQueue definidas ANTES de _logInternal)

async function _rotateLogFileIfNeeded() { /* ... (lógica mantida) ... */ }
async function _cleanupOldBackups() { /* ... (lógica mantida) ... */ }
async function initializeLogFile() { /* ... (lógica mantida, mas agora chama _logToConsole diretamente) ... */
    if (isStreamInitialized || isStreamClosing || isAttemptingStreamReopen) return; isAttemptingStreamReopen = true; isStreamClosing = false; try { try { await fsPromises.mkdir(LOG_DIR, { recursive: true }); } catch (mkdirError) { _logToConsole(LOG_LEVELS.FATAL, `Falha FATAL criar/acessar log dir: ${LOG_DIR}. ${mkdirError.message}. Log arquivo DESATIVADO.`, null, null, serializeError(mkdirError), "FATAL", CONSOLE_THRESHOLD); isAttemptingStreamReopen = false; return; } await _rotateLogFileIfNeeded(); logStream = fs.createWriteStream(LOG_FILE, { flags: "a", encoding: "utf8" }); streamErrorLogged = false; streamReopenAttempts = 0; logStream.once("open", () => { isStreamInitialized = true; isAttemptingStreamReopen = false; isStreamClosing = false; streamErrorLogged = false; _logInternal(LOG_LEVELS.INFO, `--- Log Arquivo Iniciado | Formato: ${LOG_FORMAT} | Nível: ${FILE_LOG_LEVEL_NAME} | Arquivo: ${LOG_FILE} ---`, null, { pid: process.pid }, null, "STARTUP"); flushLogQueue(); }); logStream.on("error", (streamError) => { isStreamInitialized = false; if (!streamErrorLogged) { _logToConsole(LOG_LEVELS.ERROR, `Erro stream log (${streamError?.code}): ${streamError?.message}. Log arquivo DESATIVADO temp.`, null, { error: serializeError(streamError) }, null, "ERROR", CONSOLE_THRESHOLD); streamErrorLogged = true; } try { logStream?.close(); } catch {} logStream = null; isAttemptingStreamReopen = false; }); logStream.once("close", () => { isStreamInitialized = false; isStreamClosing = true; if (logStream) logStream = null; }); } catch (initError) { _logToConsole(LOG_LEVELS.FATAL, `Falha FATAL inicializar log arquivo (${LOG_FILE}): ${initError?.message}. Log apenas console.`, null, { error: serializeError(initError) }, null, "FATAL", CONSOLE_THRESHOLD); isStreamInitialized = false; if (logStream) { try { logStream.close(); } catch {} logStream = null; } isAttemptingStreamReopen = false; }
}
function flushLogQueue() { /* ... (lógica mantida, chama _writeLogToFile com threshold) ... */
    if (logQueue.length === 0 || !isStreamInitialized || isStreamClosing || streamErrorLogged) return; _logToConsole(LOG_LEVELS.DEBUG, `Processando ${logQueue.length} logs pendentes p/ arquivo...`, null, null, null, 'DEBUG', CONSOLE_THRESHOLD); let entry; while ((entry = logQueue.shift()) !== undefined) { if (entry && entry.level !== undefined && entry.message !== undefined) _writeLogToFile(entry, FILE_THRESHOLD); }
}

// ================================================================
// ===                   NÚCLEO DE ESCRITA DO LOG               ===
// ================================================================

/**
 * Escreve log formatado no CONSOLE (stdout/stderr).
 * @param {number} levelValue - Nível numérico do log.
 * @param {string} message - Mensagem principal.
 * @param {string|null} contextId - Contexto (chatId, etc.).
 * @param {any} details - Detalhes adicionais.
 * @param {Error|any} error - Objeto de erro.
 * @param {string|null} logType - Tipo especial de log.
 * @param {number} consoleThresholdParam - **NOVO:** Threshold do console passado como argumento.
 */
function _logToConsole(levelValue, message, contextId = null, details = null, error = null, logType = null, consoleThresholdParam) {
    // Só loga se o nível for permitido PELO THRESHOLD PASSADO
    if (levelValue <= consoleThresholdParam) {
        try {
            const entry = { 
                timestamp: getLocalTimestamp(), // Usar a nova função em vez de new Date().toISOString()
                level: levelValue, 
                logType, 
                message: String(message), 
                contextId, 
                details, 
                error 
            };
            const stream = levelValue <= LOG_LEVELS.ERROR ? process.stderr : process.stdout;
            if (typeof stream?.write === 'function') {
                stream.write(formatForConsole(entry, consoleThresholdParam) + "\n"); // Passa threshold para formatador
            } else {
                console.log(formatForConsole(entry, consoleThresholdParam));
            }
        } catch (consoleErr) {
            process.stderr.write(`[Logger Console Error] ${consoleErr}\nMsg: ${String(message)}\n`);
        }
    }
}

/**
 * Escreve log formatado no ARQUIVO (se stream OK).
 * @param {object} logEntry - Objeto de log completo.
 * @param {number} fileThresholdParam - **NOVO:** Threshold do arquivo passado como argumento.
 */
function _writeLogToFile(logEntry, fileThresholdParam) {
    // Só escreve se nível permitir E stream estiver OK
    if (logEntry.level <= fileThresholdParam && logStream && isStreamInitialized && !isStreamClosing && !streamErrorLogged) {
        try {
            const formattedString = LOG_FORMAT === "json" ? formatForJsonFile(logEntry) : formatForFileText(logEntry);
            if (!logStream.write(formattedString)) { /* Handle backpressure opcional */ }
        } catch (writeError) {
            isStreamInitialized = false; // Marca como não ok
            if (!streamErrorLogged) {
                // Usa o novo getLocalTimestamp
                const timestamp = getLocalTimestamp();
                // Usa _logToConsole para fallback, passando o threshold do console
                _logToConsole(LOG_LEVELS.ERROR, `Falha CRÍTICA sync escrita log: ${writeError?.message}. Desativando log arquivo.`, null, { error: serializeError(writeError) }, null, "ERROR", CONSOLE_THRESHOLD); // <<< Passa CONSOLE_THRESHOLD
                streamErrorLogged = true;
            }
            try { logStream?.close(); } catch { /* ignore */ } logStream = null;
        }
    }
}

/**
 * Função central privada que processa e distribui a entrada de log.
 * Agora passa os thresholds para as funções de escrita/formatação.
 */
function _logInternal(levelValue, message, contextId = null, details = null, error = null, logType = null) {
    let messageStr; try { messageStr = (message === null || message === undefined) ? String(message) : (typeof message === 'string' ? message : util.inspect(message, { depth: 1 })); } catch { messageStr = "[Erro ao inspecionar mensagem]"; }
    
    // Usar horário local (UTC-3) em vez do horário do sistema
    const entry = { 
        timestamp: getLocalTimestamp(), 
        level: levelValue, 
        logType, 
        message: messageStr, 
        contextId, 
        details, 
        error 
    };

    // Passa CONSOLE_THRESHOLD para _logToConsole
    _logToConsole(entry.level, entry.message, entry.contextId, entry.details, entry.error, entry.logType, CONSOLE_THRESHOLD);

    // Lógica para arquivo (passa FILE_THRESHOLD para _writeLogToFile)
    if (levelValue <= FILE_THRESHOLD) {
        if (isStreamInitialized && !isStreamClosing && !streamErrorLogged) {
            _writeLogToFile(entry, FILE_THRESHOLD); // <<< Passa FILE_THRESHOLD
        } else if (!isStreamClosing && !isAttemptingStreamReopen) {
            if (!logStream && !streamErrorLogged && streamReopenAttempts < MAX_STREAM_REOPEN_ATTEMPTS) {
                streamReopenAttempts++;
                // Log no console usa CONSOLE_THRESHOLD
                _logToConsole(LOG_LEVELS.WARN, `Stream log indisponível. Tentando reabrir (${streamReopenAttempts}/${MAX_STREAM_REOPEN_ATTEMPTS})... (Log enfileirado)`, null, null, null, 'WARN', CONSOLE_THRESHOLD);
                setTimeout(initializeLogFile, STREAM_REOPEN_DELAY_MS);
            } else if (streamReopenAttempts >= MAX_STREAM_REOPEN_ATTEMPTS && !streamErrorLogged) {
                _logToConsole(LOG_LEVELS.ERROR, `Max tentativas (${MAX_STREAM_REOPEN_ATTEMPTS}) reabrir stream log atingido. Desistindo temp.`, null, null, null, 'ERROR', CONSOLE_THRESHOLD);
                streamErrorLogged = true;
            }
            // Adiciona à fila (entry já contém todos os dados)
            if (logQueue.length < MAX_QUEUE_SIZE) { logQueue.push(entry); }
            else if (logQueue.length === MAX_QUEUE_SIZE) {
                 _logToConsole(LOG_LEVELS.WARN, `Fila logs arquivo cheia (${MAX_QUEUE_SIZE}). Logs podem ser perdidos.`, null, null, null, 'WARN', CONSOLE_THRESHOLD);
                 logQueue.push({ level: LOG_LEVELS.WARN, message: `--- LOG QUEUE FULL (${MAX_QUEUE_SIZE}) ---`, timestamp: new Date().toISOString() });
            }
        }
    }
}

// ================================================================
// ===           INTERFACE PÚBLICA DO LOGGER                    ===
// ================================================================
// (Definida APÓS todas as constantes e funções internas)

const loggerInterface = {
    // (Métodos fatal, error, warn, info, debug, trace mantidos como antes, eles chamam _logInternal)
    fatal: (message, error = null, contextId = null, details = null) => { const e = error instanceof Error ? error : new Error(util.inspect(error || message)); _logInternal(LOG_LEVELS.FATAL, message, contextId, details, e, "FATAL"); },
    error: (message, error = null, contextId = null, details = null) => { const e = error instanceof Error ? error : (error ? new Error(util.inspect(error)) : null); _logInternal(LOG_LEVELS.ERROR, message, contextId, details, e, "ERROR"); },
    warn: (message, contextId = null, details = null, error = null) => { const e = error instanceof Error ? error : (error ? new Error(util.inspect(error)) : null); _logInternal(LOG_LEVELS.WARN, message, contextId, details, e, "WARN"); },
    info: (message, contextId = null, details = null) => { _logInternal(LOG_LEVELS.INFO, message, contextId, details, null, "INFO"); },
    debug: (message, contextId = null, details = null) => { _logInternal(LOG_LEVELS.DEBUG, message, contextId, details, null, "DEBUG"); },
    trace: (message, contextId = null, details = null) => { _logInternal(LOG_LEVELS.TRACE, message, contextId, details, null, "TRACE"); },
    // (Métodos específicos mantidos como antes)
    interaction: (actionType, contactName, chatId, detailsStr = "") => { if (LOG_INTERACTIONS) _logInternal(LOG_LEVELS.INFO, `[${actionType.padEnd(9)}] (${contactName}) ${detailsStr}`, chatId, { action: actionType, contact: contactName, description: detailsStr }, null, "INTERACTION"); },
    takeover: (actorName, contactName, chatId, durationMinutes) => { if (LOG_TAKEOVERS) _logInternal(LOG_LEVELS.INFO, `Takeover por ${actorName || "Agente"} p/ (${contactName}). Pausa: ${durationMinutes} min.`, chatId, { actor: actorName, contact: contactName, duration: durationMinutes }, null, "TAKEOVER"); },
    spam: (contactName, chatId, reason, blockDetails = {}) => { if (LOG_SPAM) _logInternal(LOG_LEVELS.WARN, `SPAM Block Ativado p/ (${contactName}). Razão: ${reason}`, chatId, { reason, contact: contactName, ...blockDetails }, null, "SPAM"); },
    ready: (message, details = null) => _logInternal(LOG_LEVELS.INFO, message, null, details, null, "READY"),
    startup: (message, details = null) => _logInternal(LOG_LEVELS.INFO, message, null, details, null, "STARTUP"),
    shutdown: (message, details = null, isError = false) => _logInternal(isError ? LOG_LEVELS.WARN : LOG_LEVELS.INFO, message, null, details, null, "SHUTDOWN"),
    db: (message, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, null, details, null, "DB"),
    validate: (message, details = null, level = LOG_LEVELS.WARN) => _logInternal(level, message, null, details, null, "VALIDATE"),
    fs: (message, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, null, details, null, "FS"),
    ai: (message, contextId = null, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, contextId, details, null, "AI"),
    wapp: (message, contextId = null, details = null, level = LOG_LEVELS.INFO) => _logInternal(level, message, contextId, details, null, "WAPP"),
    api: (message, details = null, level = LOG_LEVELS.INFO) => _logInternal(level, message, null, details, null, "API"),
    media: (message, contextId = null, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, contextId, details, null, "MEDIA"),
    state: (message, contextId = null, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, contextId, details, null, "STATE"),
    response: (message, contextId = null, details = null, level = LOG_LEVELS.DEBUG) => _logInternal(level, message, contextId, details, null, "RESPONSE"),

    /** Finaliza o logger de forma graciosa. */
    shutdown: async (timeoutMs = 5000) => { /* ... (lógica mantida) ... */
        if (isStreamClosing) return; _logToConsole(LOG_LEVELS.INFO, "Logger Shutdown iniciado...", null, { pid: process.pid }, null, "SHUTDOWN", CONSOLE_THRESHOLD); isStreamClosing = true; flushLogQueue(); if (logStream && isStreamInitialized) { const stream = logStream; const streamEndPromise = new Promise((resolve) => { try { const finalEntry = { timestamp: new Date().toISOString(), level: LOG_LEVELS.INFO, logType: "SHUTDOWN", message: `--- Log Encerrado (PID: ${process.pid}) ---`, contextId: null, details: null, error: null }; const finalFormattedString = LOG_FORMAT === "json" ? formatForJsonFile(finalEntry) : formatForFileText(finalEntry); stream.end(finalFormattedString, "utf8", (err) => { if (err) loggerInterface.warn("[Logger Shutdown] Erro callback end()", null, null, err); resolve(); }); } catch (endError) { loggerInterface.error("[Logger Shutdown] Erro stream.end()", endError); resolve(); } stream.once("finish", resolve); stream.once("error", (err) => { loggerInterface.error("[Logger Shutdown] Erro stream.close()", err); resolve(); }); }); const timeoutPromise = new Promise((resolve) => { const timer = setTimeout(() => { _logToConsole(LOG_LEVELS.WARN,`[Logger Shutdown WARN] Timeout (${timeoutMs}ms) fechando stream.`, null, null, null, 'WARN', CONSOLE_THRESHOLD); resolve(); }, timeoutMs); streamEndPromise.finally(() => clearTimeout(timer)); }); try { await Promise.race([streamEndPromise, timeoutPromise]); _logToConsole(LOG_LEVELS.INFO, "[Logger Shutdown] Stream log finalizado/timeout.", null, null, null, 'INFO', CONSOLE_THRESHOLD); } catch (shutdownError) { _logToConsole(LOG_LEVELS.WARN, `[Logger Shutdown WARN] Erro inesperado: ${shutdownError.message}`, null, null, null, 'WARN', CONSOLE_THRESHOLD); } finally { logStream = null; isStreamInitialized = false; isStreamClosing = false; streamReopenAttempts = 0; } } else { _logToConsole(LOG_LEVELS.INFO, "[Logger Shutdown] Stream arquivo não ativo.", null, null, null, 'INFO', CONSOLE_THRESHOLD); isStreamClosing = false; } _logToConsole(LOG_LEVELS.INFO, "[Logger Shutdown] Procedimento concluído.", null, null, null, 'SHUTDOWN', CONSOLE_THRESHOLD);
    },

    // --- Propriedades de Acesso ---
    /** Níveis de log configurados */
    get levels() { return { console: CONSOLE_LOG_LEVEL_NAME, file: FILE_LOG_LEVEL_NAME, format: LOG_FORMAT, consoleThreshold: CONSOLE_THRESHOLD, fileThreshold: FILE_THRESHOLD, validLevels: Object.keys(LOG_LEVELS), }; },
    /** Enumeração dos níveis de log */
    get LOG_LEVELS() { return LOG_LEVELS; },
};

// ================================================================
// ===           INICIALIZAÇÃO E LOG INICIAL                    ===
// ================================================================
// Tenta inicializar o arquivo de log imediatamente
initializeLogFile().then(() => {
    setTimeout(() => { // Delay para garantir que stream esteja OK
        loggerInterface.startup("Logger Interface Pronta.", { /* ... (log mantido) ... */
             logDir: LOG_DIR.replace(PROJECT_ROOT, "."), logFile: path.basename(LOG_FILE), levels: loggerInterface.levels, logSpecials: { interactions: LOG_INTERACTIONS, takeovers: LOG_TAKEOVERS, spam: LOG_SPAM }, maxLogSizeMB: MAX_LOG_SIZE_MB, maxLogBackups: MAX_LOG_BACKUPS,
        });
    }, 50);
}).catch(() => {
     setTimeout(() => { loggerInterface.error("Logger Interface pronta (LOG ARQUIVO FALHOU init).", null, null, { levels: loggerInterface.levels }); }, 50);
});

// --- Congelar a Interface (Opcional) ---
// Object.freeze(loggerInterface);

// --- Exporta a instância ---
export default loggerInterface;

// --- END OF FILE logger.js ---