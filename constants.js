/**
 * constants.js - Constantes Globais da Aplicação (v. Robusta)
 * ===================================================================
 * Define valores constantes usados em múltiplos módulos.
 * Permite que valores numéricos sejam sobrescritos por variáveis de ambiente.
 * Inclui validações para garantir a sanidade dos valores configurados.
 * ===================================================================
 */

import dotenv from 'dotenv';
// Garante acesso a process.env antes de qualquer definição
dotenv.config();

import { parseIntEnv } from './utils.js'; // Para permitir override via .env
import logger from './logger.js'; // Para log de validações

// --- Limites de Histórico ---

/**
 * Número máximo de mensagens a serem mantidas no ESTADO INTERNO da conversa (stateManager).
 * Define o limite da memória/DB para o histórico de cada chat.
 * Controlado por: `MAX_HISTORY_MESSAGES_STATE`. Default: 100.
 * @type {number}
 */
export const MAX_HISTORY_MESSAGES_STATE = parseIntEnv(
    process.env.MAX_HISTORY_MESSAGES_STATE,
    100, // Default: Mantém as últimas 100 mensagens no estado
    'MAX_HISTORY_MESSAGES_STATE' // Nome da ENV para logs em utils.js (se implementado)
);

/**
 * Número máximo de mensagens do histórico a serem ENVIADAS para a IA (aiProcessor).
 * Deve ser menor ou igual a MAX_HISTORY_MESSAGES_STATE e considerar limites de contexto da IA.
 * Controlado por: `AI_MAX_HISTORY_MSGS`. Default: 75.
 * @type {number}
 */
export const MAX_HISTORY_MESSAGES_AI = parseIntEnv(
    process.env.AI_MAX_HISTORY_MSGS,
    75, // Default: Envia as últimas 75 mensagens relevantes para a IA
    'AI_MAX_HISTORY_MSGS'
);

/**
 * Número máximo de caracteres por mensagem individual enviada para a IA dentro do histórico.
 * Usado em `utils.js -> getFormattedHistoryForAI` para truncar mensagens longas.
 * Controlado por: `AI_MAX_MSG_LENGTH`. Default: 1500.
 * @type {number}
 */
export const AI_MAX_MSG_LENGTH = parseIntEnv(
    process.env.AI_MAX_MSG_LENGTH,
    1500, // Default: Limita mensagens individuais a 1500 chars no contexto da IA
    'AI_MAX_MSG_LENGTH'
);

// --- Timeouts Padrão (em Milissegundos) ---

/**
 * Timeout padrão em ms para chamadas de API de transcrição (Whisper/LMStudio).
 * Controlado por: `WHISPER_TIMEOUT_MS`. Default: 120000 (2 minutos).
 * @type {number}
 */
export const WHISPER_TIMEOUT_MS = parseIntEnv(
    process.env.WHISPER_TIMEOUT_MS,
    120000, // Default: 120 segundos
    'WHISPER_TIMEOUT_MS'
);

/**
 * Timeout padrão em ms para chamadas de API de TTS (ElevenLabs).
 * Controlado por: `TTS_TIMEOUT_MS`. Default: 20000 (20 segundos).
 * @type {number}
 */
export const TTS_TIMEOUT_MS = parseIntEnv(
    process.env.TTS_TIMEOUT_MS,
    20000, // Default: 20 segundos
    'TTS_TIMEOUT_MS'
);

// --- Outras Constantes ---

/**
 * Prefixo padrão para IDs de Lead quando o nome não pode ser determinado.
 * @type {string}
 */
export const DEFAULT_LEAD_PREFIX = "Lead";

/**
 * Tempo mínimo (ms) que um áudio deve ter para ser considerado para TTS.
 * Evita gerar áudios muito curtos que podem soar estranhos.
 * Controlado por: `MIN_AUDIO_DURATION_FOR_TTS_MS`. Default: 1000 (1 segundo).
 * @type {number}
 */
export const MIN_AUDIO_DURATION_FOR_TTS_MS = parseIntEnv(
    process.env.MIN_AUDIO_DURATION_FOR_TTS_MS,
    1000, // Default: 1 segundo
    'MIN_AUDIO_DURATION_FOR_TTS_MS'
);


// Adicionar outras constantes globais conforme necessário...
// Ex: export const MAX_CONCURRENT_AI_CALLS = parseIntEnv(process.env.MAX_CONCURRENT_AI_CALLS, 5);


// ================================================================
// ===              VALIDAÇÃO DAS CONSTANTES                    ===
// ================================================================

/**
 * Valida as constantes definidas neste módulo para garantir valores sãos.
 * Loga avisos ou erros se encontrar problemas.
 */
function validateConstants() {
    logger.debug("[Constants Validation] Validando constantes...");
    let warnings = 0;
    let errors = 0;

    // Valida limites de histórico
    if (MAX_HISTORY_MESSAGES_STATE <= 0) {
        logger.error(`[Constants Validation] MAX_HISTORY_MESSAGES_STATE (${MAX_HISTORY_MESSAGES_STATE}) deve ser maior que 0.`);
        errors++;
    }
    if (MAX_HISTORY_MESSAGES_AI <= 0) {
        logger.error(`[Constants Validation] MAX_HISTORY_MESSAGES_AI (${MAX_HISTORY_MESSAGES_AI}) deve ser maior que 0.`);
        errors++;
    }
    if (MAX_HISTORY_MESSAGES_AI > MAX_HISTORY_MESSAGES_STATE) {
        logger.warn(`[Constants Validation] MAX_HISTORY_MESSAGES_AI (${MAX_HISTORY_MESSAGES_AI}) é maior que MAX_HISTORY_MESSAGES_STATE (${MAX_HISTORY_MESSAGES_STATE}). O histórico da IA será limitado pelo estado.`);
        warnings++;
        // Não é um erro crítico, mas um aviso sobre a configuração
    }
    if (AI_MAX_MSG_LENGTH < 100) {
        logger.warn(`[Constants Validation] AI_MAX_MSG_LENGTH (${AI_MAX_MSG_LENGTH}) é muito baixo (< 100), pode truncar mensagens excessivamente.`);
        warnings++;
    }

    // Valida timeouts (devem ser não-negativos, idealmente positivos)
    if (WHISPER_TIMEOUT_MS < 1000) { // Exige pelo menos 1 segundo
        logger.warn(`[Constants Validation] WHISPER_TIMEOUT_MS (${WHISPER_TIMEOUT_MS}) é muito baixo (< 1000ms). Pode causar timeouts frequentes.`);
        warnings++;
    }
    if (TTS_TIMEOUT_MS < 500) { // Exige pelo menos 0.5 segundos
        logger.warn(`[Constants Validation] TTS_TIMEOUT_MS (${TTS_TIMEOUT_MS}) é muito baixo (< 500ms). Pode causar timeouts frequentes.`);
        warnings++;
    }

     // Valida outras constantes
     if (MIN_AUDIO_DURATION_FOR_TTS_MS < 0) {
        logger.error(`[Constants Validation] MIN_AUDIO_DURATION_FOR_TTS_MS (${MIN_AUDIO_DURATION_FOR_TTS_MS}) não pode ser negativo.`);
        errors++;
    } else if (MIN_AUDIO_DURATION_FOR_TTS_MS === 0) {
         logger.info(`[Constants Validation] MIN_AUDIO_DURATION_FOR_TTS_MS é 0. TTS será tentado para qualquer áudio.`);
    }

    // Log final da validação das constantes
    if (errors > 0) {
         logger.error(`[Constants Validation] Validação concluída com ${errors} ERRO(S) e ${warnings} aviso(s).`);
    } else if (warnings > 0) {
         logger.warn(`[Constants Validation] Validação concluída com ${warnings} aviso(s).`);
    } else {
         logger.info("[Constants Validation] Constantes validadas sem erros ou avisos.");
    }
}

// Executa a validação após um pequeno delay para garantir que o logger esteja pronto.
// Não deve bloquear a exportação das constantes.
setTimeout(() => {
    try {
        validateConstants();
    } catch (validationError) {
        logger.error("[Constants Validation] Erro inesperado durante a validação das constantes!", validationError);
    }
}, 200); // Pequeno delay


// --- Regras Globais de IA ---

/**
 * Regra global que proíbe o agente de inventar informações não presentes no treinamento.
 * Esta regra é aplicada no prompt do sistema para garantir que o agente mantenha-se fiel aos fatos.
 * @type {string}
 */
export const AI_GLOBAL_RULE_NO_INVENTION = `PROIBIDO INVENTAR INFORMAÇÕES: NUNCA invente, crie ou mencione informações que não estejam EXPLICITAMENTE presentes no contexto fornecido ou nos dados de treinamento. Isso inclui: estatísticas falsas, casos de sucesso inventados, recursos inexistentes, garantias não oferecidas, prazos não confirmados, processos não documentados, ou qualquer informação que não possa ser verificada nas fontes oficiais do produto/serviço. Se não souber uma informação específica, seja honesto e use fontes verdadeiras. SEMPRE mantenha-se fiel aos fatos documentados.`;

// --- END OF FILE constants.js ---