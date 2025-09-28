// --- START OF FILE utils.js ---

/**
 * utils.js - Funções Utilitárias Diversas (v. Robusta)
 * -------------------------------------------------------------
 * Coleção de funções auxiliares puras e reutilizáveis, organizadas
 * por categorias para facilitar a manutenção e o uso.
 */

import crypto from "node:crypto";
import logger from "./logger.js"; // Para logs internos (ex: falha no parse ENV)
import dotenv from "dotenv";
// Importa constantes e configurações necessárias por algumas funções
import { AI_MAX_MSG_LENGTH } from "./constants.js";
import botConfig from "./botConfig.js";

// Garante que process.env esteja populado (idealmente chamado uma vez no entry point)
dotenv.config();

// ================================================================
// ===                    FUNÇÕES DE TEMPO                      ===
// ================================================================

/**
 * Retorna o timestamp atual no formato ISO ajustado para o timezone configurado
 * @returns {string} Timestamp ISO com horário local ajustado
 */
function getLocalTimestamp() {
    const timezone = process.env.TZ || 'America/Sao_Paulo';
    try {
        return new Date().toLocaleString('sv-SE', { timeZone: timezone });
    } catch (error) {
        console.warn(`[Utils] Timezone inválida ou não suportada: "${timezone}". Usando UTC como fallback. Erro:`, error.message);
        return new Date().toISOString();
    }
}

// ================================================================
// ===              PARSING DE VARIÁVEIS DE AMBIENTE            ===
// ================================================================

/**
 * Parseia um valor de ENV como inteiro base 10.
 * Retorna defaultValue se o valor for ausente, vazio, ou inválido.
 * Loga um aviso se a conversão falhar para um valor não vazio.
 * @param {string | undefined | null} envValue - Valor da variável de ambiente.
 * @param {number | null} defaultValue - Valor padrão.
 * @param {string} [envName="ENV Var"] - Nome da variável (para logs).
 * @returns {number | null} Valor parseado ou defaultValue.
 */
function parseIntEnv(envValue, defaultValue, envName = "ENV Var") {
  const strValue = String(envValue ?? "").trim(); // Converte para string e remove espaços
  if (strValue === "") {
    // logger?.trace(`[ENV Parse Int] ${envName} ausente/vazio. Usando default: ${defaultValue}.`);
    return defaultValue;
  }
  const parsed = parseInt(strValue, 10);
  if (isNaN(parsed)) {
    // Loga aviso apenas se havia um valor mas ele era inválido
    logger?.warn(
      `[ENV Parse Int] Valor inválido para ${envName}="${envValue}". Usando default: ${defaultValue}.`
    );
    return defaultValue;
  }
  return parsed;
}

/**
 * Parseia um valor de ENV como float.
 * Trata vírgula como separador decimal.
 * Retorna defaultValue se o valor for ausente, vazio, ou inválido.
 * Loga um aviso se a conversão falhar para um valor não vazio.
 * @param {string | undefined | null} envValue - Valor da variável de ambiente.
 * @param {number | null} defaultValue - Valor padrão.
 * @param {string} [envName="ENV Var"] - Nome da variável (para logs).
 * @returns {number | null} Valor parseado ou defaultValue.
 */
function parseFloatEnv(envValue, defaultValue, envName = "ENV Var") {
  const strValue = String(envValue ?? "").trim();
  if (strValue === "") {
    // logger?.trace(`[ENV Parse Float] ${envName} ausente/vazio. Usando default: ${defaultValue}.`);
    return defaultValue;
  }
  const valueWithDot = strValue.replace(",", "."); // Normaliza separador decimal
  const parsed = parseFloat(valueWithDot);
  if (isNaN(parsed)) {
    logger?.warn(
      `[ENV Parse Float] Valor inválido para ${envName}="${envValue}". Usando default: ${defaultValue}.`
    );
    return defaultValue;
  }
  return parsed;
}

/**
 * Parseia um valor de ENV como booleano.
 * Aceita 'true', '1' (verdadeiro) ou 'false', '0' (falso), case-insensitive.
 * Retorna defaultValue se o valor for ausente, vazio, ou não reconhecido.
 * Loga um aviso se o valor não for reconhecido.
 * @param {string | undefined | null} envValue - Valor da variável de ambiente.
 * @param {boolean} defaultValue - Valor padrão.
 * @param {string} [envName="ENV Var"] - Nome da variável (para logs).
 * @returns {boolean} Valor booleano parseado ou defaultValue.
 */
function parseBoolEnv(envValue, defaultValue, envName = "ENV Var") {
  const strValue = String(envValue ?? "").trim();
  if (strValue === "") {
    // logger?.trace(`[ENV Parse Bool] ${envName} ausente/vazio. Usando default: ${defaultValue}.`);
    return defaultValue;
  }
  const lowerCaseValue = strValue.toLowerCase();
  if (lowerCaseValue === "true" || lowerCaseValue === "1") return true;
  if (lowerCaseValue === "false" || lowerCaseValue === "0") return false;

  // Loga aviso apenas se havia valor mas não era reconhecido
  logger?.warn(
    `[ENV Parse Bool] Valor não reconhecido para ${envName}="${envValue}" (esperado 'true'/'1' ou 'false'/'0'). Usando default: ${defaultValue}.`
  );
  return defaultValue;
}

/**
 * Parseia uma string de ENV contendo uma lista de valores separados por um delimitador.
 * Retorna defaultValue se o valor for ausente, vazio, ou ocorrer erro.
 * @param {string | undefined | null} envValue - Valor da variável de ambiente.
 * @param {string} [separator=","] - Caractere separador.
 * @param {string[]} [defaultValue=[]] - Valor padrão (array vazio).
 * @param {string} [envName="ENV Var"] - Nome da variável (para logs).
 * @returns {string[]} Array de strings (limpas e sem itens vazios).
 */
function parseListEnv(
  envValue,
  separator = ",",
  defaultValue = [],
  envName = "ENV Var"
) {
  const strValue = String(envValue ?? "").trim();
  if (strValue === "") {
    // logger?.trace(`[ENV Parse List] ${envName} ausente/vazio. Usando default: ${JSON.stringify(defaultValue)}.`);
    return defaultValue;
  }
  try {
    const list = strValue
      .split(separator)
      .map((item) => item.trim()) // Remove espaços das pontas de cada item
      .filter((item) => item.length > 0); // Remove itens que ficaram vazios
    return list;
  } catch (error) {
    logger?.warn(
      `[ENV Parse List] Erro ao processar ${envName}="${envValue}". Usando default: ${JSON.stringify(
        defaultValue
      )}. Error: ${error.message}`
    );
    return defaultValue;
  }
}

// ================================================================
// ===                  FUNÇÕES DE TEMPO E DELAY                 ===
// ================================================================

/**
 * Gera um delay aleatório (inteiro) dentro de um intervalo [minMs, maxMs].
 * Usa crypto.randomInt para maior qualidade de aleatoriedade.
 * @param {number} minMs - Tempo mínimo em milissegundos (>= 0).
 * @param {number} maxMs - Tempo máximo em milissegundos (>= minMs).
 * @returns {number} Delay aleatório em milissegundos.
 */
function generateRandomDelay(minMs, maxMs) {
  const validMin = Math.max(0, Number(minMs) || 0);
  const validMax = Math.max(validMin, Number(maxMs) || validMin);
  if (validMin === validMax) return validMin; // Se min e max são iguais, retorna o valor
  // crypto.randomInt é [min, max), então adicionamos 1 ao max para incluir o valor máximo
  try {
    return crypto.randomInt(validMin, validMax + 1);
  } catch (e) {
    // Fallback caso crypto.randomInt falhe (raríssimo)
    logger?.warn(
      "[Random Delay] Falha no crypto.randomInt, usando Math.random.",
      e
    );
    return Math.floor(Math.random() * (validMax - validMin + 1)) + validMin;
  }
}

/**
 * Pausa a execução assíncrona por um número especificado de milissegundos.
 * @param {number} ms - Tempo de pausa em milissegundos (>= 0).
 * @returns {Promise<void>} Promise que resolve após o delay.
 */
function sleep(ms) {
  const validMs = Math.max(0, Number(ms) || 0);
  return new Promise((resolve) => setTimeout(resolve, validMs));
}

/**
 * Retorna a saudação apropriada ("Bom dia", "Boa tarde", "Boa noite")
 * baseada no horário local inferido pelo timezone ou offset configurado.
 * NOTA: Para aplicações globais, obter o timezone do usuário seria ideal.
 * @returns {string} A saudação.
 */
function getGreetingTime() {
  // Usando diretamente o offset em vez de timezone name para evitar inconsistências
  // Offset padrão para Brasília: UTC-3
  const offsetHours = -3;
  
  try {
    // Converter hora atual para hora local brasileira usando offset direto
    const nowUtc = new Date();
    const nowLocal = new Date(nowUtc.getTime() + offsetHours * 3600000); // 3600000 = 1 hora em ms
    const hour = nowLocal.getUTCHours();
    
    // Determinar saudação com base na hora local
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  } catch (error) {
    // Fallback em caso de erro, usando UTC-3 fixo
    logger?.warn(`[GreetingTime] Erro ao calcular hora: ${error.message}. Usando fallback simples.`);
    const nowUtc = new Date();
    const nowLocal = new Date(nowUtc.getTime() - 3 * 3600000); // UTC-3 fixo
    const hour = nowLocal.getUTCHours();
    
    if (hour >= 5 && hour < 12) return "Bom dia";
    if (hour >= 12 && hour < 18) return "Boa tarde";
    return "Boa noite";
  }
}

// ================================================================
// ===                    FUNÇÕES DE VALIDAÇÃO                  ===
// ================================================================

/**
 * Verifica se uma string é uma URL HTTP ou HTTPS válida.
 * @param {string | undefined | null} urlString - A string a ser validada.
 * @returns {boolean} True se for uma URL HTTP/HTTPS válida, False caso contrário.
 */
function isValidHttpUrl(urlString) {
  if (!urlString || typeof urlString !== "string") return false;
  try {
    const url = new URL(urlString);
    // Verifica se o protocolo é http: ou https:
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (_) {
    // Se o construtor new URL() lançar erro, a string não é uma URL válida.
    return false;
  }
}

/**
 * Verifica se um valor é um "Plain Old Javascript Object" (POJO).
 * Útil para distinguir objetos literais {} de instâncias de classes, arrays, etc.
 * @param {any} obj - O valor a ser verificado.
 * @returns {boolean} True se for um objeto simples, False caso contrário.
 */
function isPlainObject(obj) {
  if (
    typeof obj !== "object" ||
    obj === null ||
    Object.prototype.toString.call(obj) !== "[object Object]"
  ) {
    return false;
  }
  // Verifica se o protótipo é o Object.prototype ou null (criado com Object.create(null))
  const proto = Object.getPrototypeOf(obj);
  if (proto === null) {
    return true;
  }
  // Verifica se o construtor do protótipo é o Object construtor
  let constructor = proto.hasOwnProperty("constructor") && proto.constructor;
  return (
    typeof constructor === "function" &&
    constructor instanceof constructor &&
    Function.prototype.toString.call(constructor) ===
      Function.prototype.toString.call(Object)
  );
}

// ================================================================
// ===            FUNÇÕES DE FORMATAÇÃO E TEXTO               ===
// ================================================================

/**
 * Formata o histórico de mensagens recente para ser enviado à IA.
 * Filtra mensagens irrelevantes (system, tts), trunca mensagens longas,
 * e garante o limite máximo de mensagens.
 * @param {object} state - O estado do chat contendo a propriedade 'history'.
 * @param {number} historyLimit - Número máximo de mensagens a retornar.
 * @returns {Array<{role: 'user' | 'assistant', content: string}>} Array formatado para IA.
 */
function getFormattedHistoryForAI(state, historyLimit) {
  if (!state?.history || !Array.isArray(state.history)) return [];

  const relevantHistory = [];
  const limit = Math.max(0, historyLimit); // Garante limite não negativo

  // Itera de trás para frente para pegar as mais recentes
  for (
    let i = state.history.length - 1;
    i >= 0 && relevantHistory.length < limit;
    i--
  ) {
    const msg = state.history[i];

    // Pula entradas inválidas ou com roles irrelevantes para o contexto da IA
    if (
      !msg ||
      !msg.role ||
      typeof msg.content !== "string" ||
      !msg.content.trim() ||
      !(msg.role === "user" || msg.role === "assistant")
    ) {
      continue;
    }

    let role = msg.role; // 'user' or 'assistant'
    let content = msg.content.trim();

    // Limpeza adicional se necessário (ex: remover tags internas se existirem)
    // content = content.replace(/\[SOME_INTERNAL_TAG:.*?\]/gi, "").trim();

    // Trunca mensagens individuais se excederem o limite de caracteres para IA
    if (content.length > AI_MAX_MSG_LENGTH) {
      // logger?.trace(`[History Format AI] Mensagem ${role} truncada (${content.length} > ${AI_MAX_MSG_LENGTH})`);
      content = content.substring(0, AI_MAX_MSG_LENGTH - 3) + "...";
    }

    // Adiciona ao início do array resultante para manter a ordem cronológica correta
    if (content) {
      relevantHistory.unshift({ role, content });
    }
  }
  return relevantHistory;
}

/**
 * Converte bytes para kilobytes com uma casa decimal.
 * @param {number | undefined | null} bytes - O número de bytes.
 * @returns {number} O tamanho em KB, ou 0 se a entrada for inválida.
 */
function getFileSizeKB(bytes) {
  if (typeof bytes !== "number" || bytes < 0 || isNaN(bytes)) return 0;
  return parseFloat((bytes / 1024).toFixed(1));
}

/**
 * Gera uma string aleatória de um determinado comprimento usando caracteres seguros.
 * Usa crypto.randomBytes para fonte de aleatoriedade segura.
 * @param {number} length - Comprimento desejado da string (padrão 10).
 * @param {string} [charset] - Conjunto de caracteres a ser usado (padrão alfanumérico).
 * @returns {string} A string aleatória gerada.
 */
function generateRandomString(
  length = 10,
  charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
) {
  const validLength = Math.max(1, Math.floor(Number(length) || 10));
  const validCharset =
    typeof charset === "string" && charset.length > 0
      ? charset
      : "abcdefghijklmnopqrstuvwxyz0123456789";
  const charsetLen = validCharset.length;
  let result = "";
  try {
    // Tenta usar crypto.randomInt (mais eficiente para índices)
    for (let i = 0; i < validLength; i++) {
      result += validCharset.charAt(crypto.randomInt(0, charsetLen));
    }
  } catch (e) {
    // Fallback para randomBytes se randomInt não estiver disponível ou falhar
    logger?.warn(
      "[Random String] Falha crypto.randomInt, usando fallback randomBytes.",
      e
    );
    const byteLength = Math.ceil(
      (validLength * Math.log(charsetLen)) / Math.log(256)
    ); // Bytes necessários
    const randomBytes = crypto.randomBytes(byteLength);
    let byteIndex = 0;
    while (result.length < validLength && byteIndex < randomBytes.length) {
      const randomValue = randomBytes[byteIndex];
      const charIndex = randomValue % charsetLen; // Mapeia byte para índice do charset
      result += validCharset[charIndex];
      byteIndex++;
    }
    // Preenche se faltar (raro)
    while (result.length < validLength) {
      result += validCharset.charAt(Math.floor(Math.random() * charsetLen));
    }
    result = result.slice(0, validLength); // Garante o comprimento exato
  }
  return result;
}

/**
 * Normaliza uma string: converte para minúsculas e remove acentos/diacríticos.
 * @param {string | undefined | null} str - A string a ser normalizada.
 * @returns {string} A string normalizada ou string vazia se entrada inválida.
 */
function normalizeString(str) {
  if (!str || typeof str !== "string") return "";
  try {
    return str
      .toLowerCase()
      .normalize("NFD") // Normaliza para decompor caracteres acentuados
      .replace(/[\u0300-\u036f]/g, ""); // Remove diacríticos (acentos, cedilha, etc.)
  } catch (error) {
    // Fallback simples em caso de erro inesperado na normalização
    logger?.warn(
      `[Normalize String] Erro ao normalizar string: "${str}". Error: ${error.message}. Retornando lowercase.`
    );
    return str.toLowerCase();
  }
}

/**
 * Divide uma string longa em múltiplas partes menores, respeitando um limite máximo de caracteres.
 * Prioriza quebras em parágrafos (\n\n), depois sentenças (.!?), linhas (\n), e espaços.
 * @param {string | undefined | null} textChunk - O texto a ser dividido.
 * @param {string} [logContext="Splitter"] - Contexto para logs de aviso/erro.
 * @param {number | null} [maxCharsPerMessage=null] - Limite máximo de caracteres por parte. Usa botConfig.behavior.responseSettings.maxLengthChars como padrão.
 * @returns {string[]} Array com as partes de texto divididas.
 */
function splitResponseIntoMessages(
  textChunk,
  logContext = "Splitter",
  maxCharsPerMessage = null
) {
  // Usa valor do botConfig ou um default seguro (400)
  const maxChars =
    maxCharsPerMessage ||
    botConfig?.behavior?.responseSettings?.maxLengthChars ||
    400;

  const messages = [];
  if (!textChunk?.trim()) return messages;

  let textToProcess = textChunk.trim();
  // Define um tamanho mínimo para evitar chunks minúsculos (ex: 40% do max, mínimo 50)
  const MIN_CHUNK_SIZE = Math.max(50, Math.floor(maxChars * 0.4));

  while (textToProcess.length > 0) {
    // Se o restante cabe, adiciona como última parte
    if (textToProcess.length <= maxChars) {
      messages.push(textToProcess);
      break;
    }

    let splitIndex = -1; // Onde cortar a string atual
    let nextChunkStartIndex = -1; // Onde começar a próxima parte

    // Tentar estratégias de quebra, da mais preferível para a menos
    // 1. Quebra de Parágrafo (\n\n) - Busca do fim para o começo dentro do limite
    let pBreak = textToProcess.lastIndexOf("\n\n", maxChars);
    if (pBreak >= MIN_CHUNK_SIZE) {
      // A quebra deve ocorrer após o tamanho mínimo
      splitIndex = pBreak; // Corta antes do \n\n
      nextChunkStartIndex = pBreak + 2; // Próximo começa depois
    } else {
      // 2. Quebra de Sentença (. ! ?) - Seguido de espaço, newline ou fim da string
      // Itera do limite para trás até o mínimo
      for (let i = maxChars; i >= MIN_CHUNK_SIZE; i--) {
        if (".!?".includes(textToProcess[i])) {
          const isFollowedBySpaceOrEnd =
            /\s/.test(textToProcess[i + 1] ?? "") ||
            i + 1 >= textToProcess.length;
          // Evita quebrar em abreviações (A.B.C.) ou decimais (1.5) - heurística simples
          const isLikelyAbbr = /[A-Z]\.\s*$/.test(
            textToProcess.substring(i - 2, i + 1)
          );
          const isLikelyDecimal = /\d\.\s*$/.test(
            textToProcess.substring(i - 2, i + 1)
          );

          if (isFollowedBySpaceOrEnd && !isLikelyAbbr && !isLikelyDecimal) {
            splitIndex = i + 1; // Corta *depois* da pontuação
            nextChunkStartIndex = i + 1;
            break; // Encontrou a melhor quebra de sentença
          }
        }
      }
    }

    // 3. Quebra de Linha Simples (\n) - Se não achou parágrafo ou sentença
    if (splitIndex === -1) {
      let lBreak = textToProcess.lastIndexOf("\n", maxChars);
      if (lBreak >= MIN_CHUNK_SIZE) {
        splitIndex = lBreak; // Corta antes do \n
        nextChunkStartIndex = lBreak + 1;
      }
    }

    // 4. Quebra por Espaço - Se nada acima funcionou
    if (splitIndex === -1) {
      let sBreak = textToProcess.lastIndexOf(" ", maxChars);
      if (sBreak >= MIN_CHUNK_SIZE) {
        splitIndex = sBreak; // Corta antes do espaço
        nextChunkStartIndex = sBreak + 1;
      }
    }

    // 5. Quebra Forçada (Hard Cut) - Último recurso
    if (splitIndex === -1) {
      logger?.warn(
        `[${logContext}] Forçando quebra bruta em ${maxChars} caracteres (nenhum ponto natural encontrado após ${MIN_CHUNK_SIZE} chars).`,
        null,
        { chunkStart: textToProcess.substring(0, 30) }
      );
      splitIndex = maxChars;
      nextChunkStartIndex = maxChars;
    }

    // Adiciona a parte encontrada e atualiza o restante
    messages.push(textToProcess.substring(0, splitIndex).trim());
    textToProcess = textToProcess.substring(nextChunkStartIndex).trimStart(); // Remove espaços no início da próxima parte
  }

  // Filtra quaisquer partes que possam ter ficado vazias após trim/split
  const finalMessages = messages.filter((m) => m.length > 0);

  // Fallback caso algo dê muito errado e finalMessages fique vazio, mas havia texto original
  if (finalMessages.length === 0 && textChunk.trim()) {
    logger?.error(
      `[${logContext}] Divisão resultou em 0 mensagens válidas! Usando original truncado.`
    );
    return [textChunk.trim().substring(0, maxChars)]; // Retorna original truncado como segurança
  }

  return finalMessages;
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

// Exporta TODAS as funções definidas neste arquivo
export {
  // ENV Parsing
  parseIntEnv,
  parseFloatEnv,
  parseBoolEnv,
  parseListEnv,
  // Time/Delay
  getLocalTimestamp,
  generateRandomDelay,
  sleep,
  getGreetingTime,
  // Validation
  isValidHttpUrl,
  isPlainObject,
  // Formatting/Text
  getFormattedHistoryForAI,
  getFileSizeKB,
  generateRandomString,
  normalizeString,
  splitResponseIntoMessages,
  // Adicione outras funções aqui se forem criadas
};
