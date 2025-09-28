// --- START OF FILE botConfig.js ---

/**
 * botConfig.js - Configuração Central do Agente de Vendas (v. TTS Hardcoded)
 * ----------------------------------------------------------------------------
 * Define identidade, comportamento, IA, TTS, produto alvo, estratégias de venda
 * e parâmetros operacionais do bot.
 *
 * Algumas configurações de TTS (enabled, voiceId, etc.) são agora definidas
 * DIRETAMENTE NO CÓDIGO para simplificar, exceto a API Key do ElevenLabs.
 */

import dotenv from "dotenv";
// Carrega variáveis de ambiente do .env ANTES de qualquer outra coisa
dotenv.config(); // Ainda necessário para OPENAI_API_KEY, ELEVENLABS_API_KEY, etc.

// ***** INÍCIO DO LOG DE DEPURAÇÃO (MANTENHA POR ENQUANTO) *****
console.log("--- DEBUG .ENV (botConfig.js Top) ---");
console.log(
  `process.env.TTS_ENABLED raw value (from .env): '${process.env.TTS_ENABLED}'`
);
console.log(
  `process.env.ELEVENLABS_API_KEY_EXISTS: ${!!process.env.ELEVENLABS_API_KEY}`
);
console.log("--- END DEBUG .ENV ---");
// ***** FIM DO LOG DE DEPURAÇÃO *****

// --- Imports ---
import {
  parseIntEnv,
  parseFloatEnv,
  parseBoolEnv,
  parseListEnv,
  // generateRandomDelay, // Não usado diretamente aqui
} from "./utils.js";
import logger from "./logger.js";

// --- Constantes Padrão ---
const DEFAULT_BOT_FIRST_NAME = "Pedro";
const DEFAULT_BOT_COMPANY_NAME = "DPA - Direito Processual Aplicado";
const DEFAULT_BOT_POSITION = "Especialista";
const DEFAULT_BOT_TONE = `Aja como um consultor especialista da {botIdentity.company}. Seu objetivo é entender as necessidades de {contactName} e apresentar a solução de forma clara e útil, focando nos benefícios. Comunique-se de forma profissional, prestativa e adaptável.`;
const DEFAULT_SUPPORT_TEMPLATE = `Entendi, {contactName}. Para questões técnicas ou específicas, nossa equipe de suporte pode ajudar melhor. O contato é: {supportNumber}.`;
const DEFAULT_SPAM_BLOCK_TEMPLATE = `Opa {contactName}, percebi um volume alto de mensagens. Para manter a qualidade, faremos uma pausa de {durationMinutes} minutos. Agradeço a compreensão!`;
// const DEFAULT_ELEVENLABS_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Exemplo (Rachel) - Removido, será hardcoded
// const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2"; // Removido, será hardcoded
const DEFAULT_TARGET_PRODUCT_ID = "PRODUCT_A";
const DEFAULT_SUPPORT_WHATSAPP_NUMBER = null;

// ================================================================
// ===                 ESTRUTURA PRINCIPAL DO botConfig         ===
// ================================================================
// ... (JSDoc da BotConfig mantido como antes) ...

/** @type {BotConfig} */
export const botConfig = {
  // --- Identidade do Bot (Persona Base) ---
  identity: {
    firstName: process.env.BOT_FIRST_NAME || DEFAULT_BOT_FIRST_NAME,
    company: process.env.BOT_COMPANY_NAME || DEFAULT_BOT_COMPANY_NAME,
    position: process.env.BOT_POSITION || DEFAULT_BOT_POSITION,
    tone: process.env.BOT_TONE || DEFAULT_BOT_TONE,
  },

  // --- Comportamento Geral e Estratégias ---
  behavior: {
    responseSettings: {
      maxLengthChars: parseIntEnv(process.env.RESPONSE_MAX_LENGTH_CHARS, 1200),
      typingDelay: {
        minMs: parseIntEnv(process.env.RESPONSE_TYPING_DELAY_MIN_MS, 1000),
        maxMs: parseIntEnv(process.env.RESPONSE_TYPING_DELAY_MAX_MS, 2000),
      },
      betweenMessagesDelay: {
        minMs: parseIntEnv(process.env.RESPONSE_BETWEEN_MSG_MIN_MS, 500),
        maxMs: parseIntEnv(process.env.RESPONSE_BETWEEN_MSG_MAX_MS, 1200),
      },
      groupingDelaySeconds: parseIntEnv(
        process.env.RESPONSE_GROUPING_DELAY_SECONDS,
        10
      ),
      videoPostSendDelayMs: parseIntEnv(
        process.env.VIDEO_POST_SEND_DELAY_MS,
        1800
      ),
    },
    humanTakeover: {
      pauseDurationMinutes: parseIntEnv(
        process.env.HUMAN_TAKEOVER_PAUSE_MINUTES,
        60
      ),
    },
    ignoredNumbers: parseListEnv(process.env.IGNORED_NUMBERS, ",", [
      "557799178152@c.us",
      "557799263537@c.us",
      "5513982308926@c.us",
      "557799263537@c.us",
      "557781631308@c.us",
      "558388605467@c.us",
      "557781631308@c.us",
      "553291257025@c.us",
      "557788724189@c.us",
      "557791971356@c.us",
      "557788656738@c.us",
      "557781106464@c.us",
    ]),
    antiSpam: {
      maxMessagesPerWindow: parseIntEnv(process.env.SPAM_MAX_MESSAGES, 8),
      messageWindowSeconds: parseIntEnv(
        process.env.SPAM_MESSAGE_WINDOW_SECONDS,
        20
      ),
      maxAudiosPerWindow: parseIntEnv(process.env.SPAM_MAX_AUDIOS, 4),
      audioWindowMinutes: parseIntEnv(
        process.env.SPAM_AUDIO_WINDOW_MINUTES,
        10
      ),
      blockDurationMinutes: parseIntEnv(
        process.env.SPAM_BLOCK_DURATION_MINUTES,
        60
      ),
      spamKeywords: parseListEnv(process.env.SPAM_KEYWORDS, ",", [
        "travazap",
        "spam",
        "flood",
        "compre agora",
        "oferta imperdível",
        "marketing multinível",
        "renda extra fácil",
        "dinheiro rápido",
        "criptomoeda grátis",
        "robô pix",
        "urubu do pix",
      ]),
    },
    support: {
      whatsappNumber:
        process.env.SUPPORT_WHATSAPP_NUMBER || DEFAULT_SUPPORT_WHATSAPP_NUMBER,
      forwardMessageTemplate: null,
    },
    errorHandling: {
      audioTranscription: null,
      unsupportedMedia: null,
      default: null,
      blockedSpam: null,
      emptyAiResponse: null,
      audioDownloadFailed: null,
    },
    salesStrategy: {
      targetProductId:
        process.env.TARGET_PRODUCT_ID || DEFAULT_TARGET_PRODUCT_ID,
      enableUpsell: parseBoolEnv(process.env.ENABLE_UPSELL, false),
      enableCrossSell: parseBoolEnv(process.env.ENABLE_CROSS_SELL, false),
    },

    // --- Sistema de Inatividade ---
    inactivity: {
      enabled: parseBoolEnv(process.env.INACTIVITY_ENABLED, true),
      
      // ✅ CONFIGURAÇÃO MELHORADA: Sistema de Etapas de Inatividade
      // Para testes: 30s para 1ª tentativa, 60s para 2ª tentativa
      // Para produção: 3h para 1ª tentativa, 24h para 2ª tentativa
      firstAttemptThresholdMs: parseIntEnv(process.env.FIRST_INACTIVITY_THRESHOLD_MS, 30000), // 30s (teste) / 3h (prod)
      secondAttemptThresholdMs: parseIntEnv(process.env.SECOND_INACTIVITY_THRESHOLD_MS, 60000), // 60s (teste) / 24h (prod)
      
      // ✅ BACKWARD COMPATIBILITY: Mantendo configurações antigas
      thresholdMs: parseIntEnv(process.env.INACTIVITY_THRESHOLD_MS, 30000), // Usado como firstAttemptThreshold se não especificado
      maxReengagementAttempts: parseIntEnv(process.env.MAX_REENGAGEMENT_ATTEMPTS, 2), // Reduzido para 2 tentativas
      reengagementIntervalMs: parseIntEnv(process.env.REENGAGEMENT_INTERVAL_MS, 60000), // Não usado no novo sistema
      
      // ✅ NOVAS CONFIGURAÇÕES: IA e Controle
      useAIForMessages: parseBoolEnv(process.env.INACTIVITY_USE_AI, true), // Usar IA para gerar mensagens
      fallbackToTemplate: parseBoolEnv(process.env.INACTIVITY_FALLBACK_TEMPLATE, true), // Fallback se IA falhar
      minTimeBetweenAttempts: parseIntEnv(process.env.MIN_TIME_BETWEEN_INACTIVITY_MS, 30000), // Tempo mínimo entre tentativas
    },

    processingTimeoutMinutes: parseIntEnv(
      process.env.PROCESSING_TIMEOUT_MINUTES,
      5
    ),
  },

  // --- Funcionalidades (Features) --- 
  features: {
    advancedIntentDetection: parseBoolEnv(process.env.ADVANCED_INTENT_DETECTION, true), // Default true
    // Outras features podem ser adicionadas aqui
  },

  // --- Configuração da IA (OpenAI) ---
  openai: {
    apiKey: process.env.OPENAI_API_KEY || null,
    model: process.env.OPENAI_MODEL || "gpt-4o",
    whisperModel: process.env.WHISPER_MODEL || "whisper-1",
    temperature: parseFloatEnv(process.env.OPENAI_TEMPERATURE, 0.65),
    maxTokens: process.env.OPENAI_MAX_TOKENS
      ? parseIntEnv(process.env.OPENAI_MAX_TOKENS, null)
      : null,
  },

  // --- Configuração da IA (Google Gemini) ---
  gemini: {
    apiKey: process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "SUA_CHAVE_GEMINI_API_AQUI" 
      ? process.env.GEMINI_API_KEY 
      : null,
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
    temperature: parseFloatEnv(process.env.GEMINI_TEMPERATURE, 0.65),
    maxTokens: process.env.GEMINI_MAX_TOKENS
      ? parseIntEnv(process.env.GEMINI_MAX_TOKENS, null)
      : null,
  },

  // --- Configuração de Tokens Dinâmicos ---
  tokens: {
    // Tokens padrão para operações gerais (reduzido para economizar)
    default: parseIntEnv(process.env.GEMINI_MAX_TOKENS, 1024),
    // Tokens altos para mensagens de inatividade (precisam ser mais elaboradas)
    inactivity: parseIntEnv(process.env.GEMINI_TOKENS_INACTIVITY, 4096),
    // Tokens médios para operações complexas
    complex: parseIntEnv(process.env.GEMINI_TOKENS_COMPLEX, 2048),
  },

  // --- Configuração Geral de IA ---
  ai: {
    // Define qual provedor de IA deve ser usado como principal (openai, gemini)
    primaryProvider: process.env.PRIMARY_AI_PROVIDER || "openai",
  },

  // --- Configurações de Text-to-Speech (TTS - ElevenLabs) ---
  tts: {
    // ***** ALTERAÇÕES AQUI *****
    enabled: true, // Definido diretamente como true
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || null, // Chave da API ainda do .env
    elevenLabsVoiceId: "fB2lLA2TtC2KEj37Trcl", // Voice ID específico (apenas o ID, não a URL completa)
    elevenLabsModelId: "eleven_multilingual_v2", // Modelo padrão ou específico
    elevenLabsRate: 0.95, // Ligeiramente mais lento, ajuda na clareza e naturalidade
    elevenLabsStability: 0.5, // MAIS baixo = mais variações naturais na entonação (recomendo entre 0.3–0.5)
    elevenLabsSimilarityBoost: 0.75, // Reduzido para permitir mais liberdade de expressividade (não soa "travado")
    elevenLabsStyleExaggeration: 0.0, // Menor exagero no estilo = fala mais neutra e natural, evita informalidade artificial
    elevenLabsUseSpeakerBoost: true, // Otimização para modelos v2, default true
    usageProbability: 1.0, // Definido como 1.0 (100%) para teste, ajuste conforme" necessário (0.0 a 1.0)
    minTextLengthForTTS: 25, // Mínimo de caracteres para tentar TTS, default 30
  },

  // --- Configuração do Servidor API (Opcional) ---
  server: {
    port: parseIntEnv(process.env.PORT, 3000),
  },

  // --- Placeholder para Futuras Integrações ---
  integrations: {
    crm: {
      apiKey: process.env.CRM_API_KEY || null,
      baseUrl: process.env.CRM_BASE_URL || null,
    },
    calendar: {
      type: process.env.CALENDAR_TYPE || "none",
      apiKey: process.env.CALENDAR_API_KEY || null,
    },
  },

  // --- Notas Operacionais Internas ---
  _operationalNotes: {
    envReminder:
      "Verificar ENVs CRÍTICAS: OPENAI_API_KEY, GEMINI_API_KEY, ELEVENLABS_API_KEY (se TTS ativo no código), Suporte (Número), Produto Alvo.",
    funnelSource: "salesFunnelBluePrint.js (gerado externamente/backend).",
    trainingSource:
      "Pastas 'training/' e 'provasSociais/' (idealmente específicas por tenant).",
    aiProviderSetup: 
      "Para usar o Gemini como provedor principal, configure GEMINI_API_KEY e defina PRIMARY_AI_PROVIDER=gemini. " +
      "A OpenAI (OPENAI_API_KEY) ainda é necessária para transcrição de áudio quando o Gemini está ativo. " +
      "Por padrão, o sistema usa a OpenAI para todas as funções."
  },
};

// =======================================================================
// === DEFINIÇÃO DINÂMICA DE TEMPLATES (Usando Valores Configurados) ===
// =======================================================================
// (Esta parte permanece a mesma)
botConfig.behavior.support.forwardMessageTemplate = (contactName = "você") =>
  (process.env.SUPPORT_FORWARD_MSG_TEMPLATE || DEFAULT_SUPPORT_TEMPLATE)
    .replace(/{contactName}/g, contactName)
    .replace(
      /{supportNumber}/g,
      botConfig.behavior.support.whatsappNumber ||
        "[NÚMERO DE SUPORTE NÃO CONFIGURADO]"
    );
// ... resto das definições de template ...
botConfig.behavior.errorHandling.audioTranscription = (
  contactName = "por aqui"
) =>
  (
    process.env.ERROR_MSG_AUDIO_TRANSCRIPTION ||
    `Hum, {contactName}, não consegui entender bem o áudio. Poderia repetir por texto, por favor?`
  ).replace(/{contactName}/g, contactName);
botConfig.behavior.errorHandling.unsupportedMedia = (
  contactName = "desculpe",
  mediaType = "este tipo"
) =>
  (
    process.env.ERROR_MSG_UNSUPPORTED_MEDIA ||
    `Opa {contactName}! Ainda não processo {mediaType}. Pode me mandar por texto ou áudio?`
  )
    .replace(/{contactName}/g, contactName)
    .replace(/{mediaType}/g, mediaType);
botConfig.behavior.errorHandling.default = (contactName = "por aqui") =>
  (
    process.env.ERROR_MSG_DEFAULT ||
    `Opa {contactName}, tivemos um contratempo técnico. Poderia tentar novamente, por favor?`
  ).replace(/{contactName}/g, contactName);
botConfig.behavior.errorHandling.blockedSpam = (contactName = "amigo(a)") => {
  const duration = botConfig.behavior.antiSpam.blockDurationMinutes;
  return (process.env.ERROR_MSG_SPAM_BLOCK || DEFAULT_SPAM_BLOCK_TEMPLATE)
    .replace(/{contactName}/g, contactName)
    .replace(/{durationMinutes}/g, String(duration));
};
botConfig.behavior.errorHandling.emptyAiResponse = (
  contactName = "meu caro(a)"
) =>
  (
    process.env.ERROR_MSG_EMPTY_AI ||
    `Não consegui formular uma resposta agora, {contactName}. Poderia perguntar de outra forma?`
  ).replace(/{contactName}/g, contactName);
botConfig.behavior.errorHandling.audioDownloadFailed = (
  contactName = "por aqui"
) =>
  (
    process.env.ERROR_MSG_AUDIO_DOWNLOAD ||
    `{contactName}, tive dificuldade em baixar seu áudio. Poderia reenviar, por gentileza?`
  ).replace(/{contactName}/g, contactName);

// ================================================================
// ===            VALIDAÇÃO DAS CONFIGURAÇÕES CRÍTICAS          ===
// ================================================================

function runValidations() {
  logger.debug("[Config Validate] Iniciando validação das configurações...");
  let hasCriticalIssues = false;
  const config = botConfig;

  // --- Validação de Identidade (mantida) ---
  if (config.identity.firstName === DEFAULT_BOT_FIRST_NAME) {
    logger.warn(
      `[Config Validate] Usando nome padrão do bot ('${DEFAULT_BOT_FIRST_NAME}'). Defina BOT_FIRST_NAME no .env.`
    );
  }
  if (config.identity.company === DEFAULT_BOT_COMPANY_NAME) {
    logger.warn(
      `[Config Validate] Usando nome padrão da empresa ('${DEFAULT_BOT_COMPANY_NAME}'). Defina BOT_COMPANY_NAME no .env.`
    );
  }
  if (config.identity.position === DEFAULT_BOT_POSITION) {
    logger.warn(
      `[Config Validate] Usando posição padrão do bot ('${DEFAULT_BOT_POSITION}'). Defina BOT_POSITION no .env.`
    );
  }
  if (config.identity.tone === DEFAULT_BOT_TONE) {
    logger.info(
      "[Config Validate] Usando tom base padrão da IA. Pode ser personalizado via BOT_TONE."
    );
  }

  // --- Validação de Suporte (mantida) ---
  if (!config.behavior.support.whatsappNumber) {
    logger.error(
      "[Config Validate] Número de Suporte (SUPPORT_WHATSAPP_NUMBER) NÃO definido! Encaminhamento para suporte FALHARÁ.",
      null,
      { critical: true }
    );
    hasCriticalIssues = true;
  } else {
    logger.info(
      `[Config Validate] Número de Suporte configurado: ${config.behavior.support.whatsappNumber}`
    );
  }

  // --- Validação da Estratégia de Vendas (mantida) ---
  if (
    config.behavior.salesStrategy.targetProductId === DEFAULT_TARGET_PRODUCT_ID
  ) {
    logger.warn(
      `[Config Validate] Usando ID de produto alvo padrão ('${DEFAULT_TARGET_PRODUCT_ID}'). Defina TARGET_PRODUCT_ID no .env com um ID válido de pricing.js.`
    );
  } else {
    logger.info(
      `[Config Validate] Produto alvo definido: ${config.behavior.salesStrategy.targetProductId}`
    );
  }
  logger.info(
    `[Config Validate] Estratégias: Upsell=${config.behavior.salesStrategy.enableUpsell}, CrossSell=${config.behavior.salesStrategy.enableCrossSell}`
  );

  // --- Validação da Configuração da IA (OpenAI e Gemini) ---
  const hasOpenAIApiKey = !!config.openai.apiKey;
  const hasGeminiApiKey = !!config.gemini.apiKey;
  const primaryProvider = config.ai.primaryProvider;

  // Validação de provedor primário
  if (primaryProvider !== "openai" && primaryProvider !== "gemini") {
    logger.warn(
      `[Config Validate] Provedor de IA primário inválido: '${primaryProvider}'. Usando 'openai' como fallback.`,
      null
    );
    config.ai.primaryProvider = "openai";
  }

  // Validação baseada no provedor primário
  if (primaryProvider === "gemini") {
    if (!hasGeminiApiKey) {
      logger.error(
        "[Config Validate] Gemini configurado como provedor primário, mas GEMINI_API_KEY não está configurada!",
        null,
        { critical: true }
      );
      hasCriticalIssues = true;
    } else {
      logger.info(
        `[Config Validate] Gemini configurado como provedor primário. Modelo: ${config.gemini.model}`
      );
    }

    if (!hasOpenAIApiKey) {
      logger.warn(
        "[Config Validate] OpenAI API Key não configurada. A transcrição de áudio pode falhar.",
        null
      );
    } else {
      logger.info(
        "[Config Validate] OpenAI configurada para transcrição de áudio quando Gemini é primário."
      );
    }
  } else {
    // OpenAI como provedor primário
    if (!hasOpenAIApiKey) {
      logger.error(
        "[Config Validate] OpenAI configurado como provedor primário, mas OPENAI_API_KEY não está configurada!",
        null,
        { critical: true }
      );
      hasCriticalIssues = true;
    } else {
      logger.info(
        `[Config Validate] OpenAI configurado como provedor primário. Modelo: ${config.openai.model}`
      );
    }
  }

  // --- Validação da Transcrição (Whisper) (mantida) ---
  const whisperEnabled = config.openai.whisperModel !== "disabled";
  if (!whisperEnabled) {
    logger.info(
      "[Config Validate] Transcrição de áudio DESATIVADA (WHISPER_MODEL='disabled')."
    );
  } else if (!hasOpenAIApiKey) {
    logger.warn(
      "[Config Validate] Transcrição ATIVA, mas API Key da OpenAI NÃO configurada. Transcrição falhará.",
      null,
      { whisperModel: config.openai.whisperModel }
    );
  } else {
    logger.info(
      `[Config Validate] Transcrição de áudio ATIVA com modelo: ${config.openai.whisperModel}.`
    );
  }

  // --- Validação de TTS (AJUSTADA) ---
  if (!config.tts.enabled) {
    // Agora lê diretamente do objeto config
    logger.info(
      "[Config Validate] TTS DESATIVADO (config.tts.enabled = false)."
    );
  } else if (!config.tts.elevenLabsApiKey) {
    // API Key ainda é crucial do .env
    logger.error(
      "[Config Validate] TTS ATIVADO no código, mas API Key do ElevenLabs (ELEVENLABS_API_KEY) NÃO definida no .env! TTS falhará.",
      null,
      { critical: true }
    );
    hasCriticalIssues = true;
  } else {
    logger.info(
      `[Config Validate] TTS ATIVO (ElevenLabs - config.tts.enabled = true). Voz ID: ${
        config.tts.elevenLabsVoiceId // Direto do objeto config
      }, Modelo: ${config.tts.elevenLabsModelId}, Prob: ${
        config.tts.usageProbability * 100
      }%`
    );
    // Validação dos novos parâmetros de voz do ElevenLabs
    if (config.tts.elevenLabsRate < 0.5 || config.tts.elevenLabsRate > 2.0) {
      logger.warn(
        `[Config Validate] ElevenLabs Rate (${config.tts.elevenLabsRate}) fora do range recomendado (0.5-2.0).`
      );
    }
    if (
      config.tts.elevenLabsStability < 0.0 ||
      config.tts.elevenLabsStability > 1.0
    ) {
      logger.warn(
        `[Config Validate] ElevenLabs Stability (${config.tts.elevenLabsStability}) fora do range recomendado (0.0-1.0).`
      );
    }
    if (
      config.tts.elevenLabsSimilarityBoost < 0.0 ||
      config.tts.elevenLabsSimilarityBoost > 1.0
    ) {
      logger.warn(
        `[Config Validate] ElevenLabs Similarity Boost (${config.tts.elevenLabsSimilarityBoost}) fora do range recomendado (0.0-1.0).`
      );
    }
    if (
      config.tts.elevenLabsStyleExaggeration < 0.0 ||
      config.tts.elevenLabsStyleExaggeration > 1.0
    ) {
      logger.warn(
        `[Config Validate] ElevenLabs Style Exaggeration (${config.tts.elevenLabsStyleExaggeration}) fora do range recomendado (0.0-1.0).`
      );
    }
  }

  // --- Validação de Valores Numéricos (mantida) ---
  if (config.openai.temperature < 0 || config.openai.temperature > 2) {
    logger.warn(
      `[Config Validate] Temperatura OpenAI (${config.openai.temperature}) fora do range recomendado (0-2). Usando valor configurado.`
    );
  }
  if (config.openai.maxTokens !== null && config.openai.maxTokens < 50) {
    logger.warn(
      `[Config Validate] OpenAI Max Tokens (${config.openai.maxTokens}) está muito baixo (< 50). Respostas podem ser cortadas.`
    );
  }
  if (config.gemini.temperature < 0 || config.gemini.temperature > 2) {
    logger.warn(
      `[Config Validate] Temperatura Gemini (${config.gemini.temperature}) fora do range recomendado (0-2). Usando valor configurado.`
    );
  }
  if (config.gemini.maxTokens !== null && config.gemini.maxTokens < 50) {
    logger.warn(
      `[Config Validate] Gemini Max Tokens (${config.gemini.maxTokens}) está muito baixo (< 50). Respostas podem ser cortadas.`
    );
  }
  if (config.tts.usageProbability < 0 || config.tts.usageProbability > 1) {
    logger.warn(
      `[Config Validate] Probabilidade TTS (${config.tts.usageProbability}) fora do range (0-1). Usando valor configurado clampado.`
    );
  }

  // --- Conclusão da Validação ---
  if (hasCriticalIssues) {
    logger.fatal(
      "[Config Validate] Validação CONCLUÍDA com ERROS CRÍTICOS. A aplicação pode não funcionar corretamente."
    );
  } else {
    logger.info(
      "[Config Validate] Validação das configurações concluída sem erros críticos."
    );
  }
}

// Executa as validações após um pequeno delay
setTimeout(() => {
  try {
    runValidations();
  } catch (validationError) {
    logger.fatal(
      "[Config Validate] Erro inesperado durante a execução das validações!",
      validationError
    );
  }
}, 150);

// ================================================================
// ===                         EXPORT                           ===
// ================================================================
export default botConfig;

// --- END OF FILE botConfig.js ---
