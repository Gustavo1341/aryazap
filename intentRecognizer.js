// intentRecognizer.js
import logger from "./logger.js";
import { serializeError } from "serialize-error";

// Placeholder para futuras integrações com NLP/NLU
// import ... from 'some-nlp-library';

/**
 * @typedef {import('./stateManager.js').ChatState} ChatState
 */

/**
 * Analisa a entrada do usuário e o estado da conversa para determinar a intenção.
 * ATENÇÃO: Esta é uma implementação placeholder e precisa ser expandida com lógica real de NLP/NLU.
 *
 * @param {string} userInput - A última mensagem do usuário.
 * @param {ChatState} chatState - O estado atual da conversa.
 * @returns {Promise<{intent: string|null, confidence: number, nluData: object|null, error?: string}>}
 *          - intent: String representando a intenção (ex: 'REQUEST_INFO', 'PRICE_OBJECTION').
 *          - confidence: Nível de confiança na detecção (0-1).
 *          - nluData: Dados brutos da análise NLU (sentimento, entidades, etc.).
 *          - error: Mensagem de erro, se houver.
 */
export async function recognizeIntent(userInput, chatState) {
  logger.debug(`[Intent Recognizer] Iniciando reconhecimento para: "${userInput.substring(0, 50)}..."`, chatState.id);

  try {
    // --- LÓGICA PLACEHOLDER --- 
    // Esta seção deve ser substituída por chamadas reais a um modelo de NLP/NLU.

    let detectedIntent = null;
    let confidence = 0.0;
    const nluData = { rawInput: userInput, timestamp: Date.now() }; // Exemplo de NLU data

    const lowerInput = userInput.toLowerCase();

    // Exemplo simples de detecção baseada em palavras-chave (MELHORAR SIGNIFICATIVAMENTE)
    if (lowerInput.includes("preço") || lowerInput.includes("valor") || lowerInput.includes("quanto custa")) {
      detectedIntent = 'PRICE_INQUIRY';
      confidence = 0.7;
      nluData.keywords = ['preço', 'valor', 'quanto custa'];
    } else if (lowerInput.includes("caro") || lowerInput.includes("muito alto")) {
      detectedIntent = 'PRICE_OBJECTION';
      confidence = 0.8;
      nluData.keywords = ['caro', 'muito alto'];
      nluData.sentiment = 'negative'; // Exemplo
    } else if (lowerInput.includes("não tenho tempo") || lowerInput.includes("sem tempo")) {
      detectedIntent = 'TIME_OBJECTION';
      confidence = 0.75;
      nluData.keywords = ['não tenho tempo', 'sem tempo'];
    } else if (lowerInput.includes("quero comprar") || lowerInput.includes("como faço para adquirir")) {
      detectedIntent = 'PURCHASE_INTENT';
      confidence = 0.85;
      nluData.keywords = ['quero comprar', 'como faço para adquirir'];
      nluData.sentiment = 'positive';
    } else if (lowerInput.includes("demonstração") || lowerInput.includes("demo")) {
      detectedIntent = 'REQUEST_DEMO';
      confidence = 0.8;
      nluData.keywords = ['demonstração', 'demo'];
    } else if (lowerInput.includes("falar com humano") || lowerInput.includes("atendente")) {
      detectedIntent = 'REQUEST_HUMAN_TAKEOVER';
      confidence = 0.9;
      nluData.keywords = ['falar com humano', 'atendente'];
    } else if (lowerInput.includes("ajuda") || lowerInput.includes("suporte")) {
      detectedIntent = 'REQUEST_SUPPORT';
      confidence = 0.7;
      nluData.keywords = ['ajuda', 'suporte'];
    } else if (lowerInput.includes("mostrar conteúdo") || lowerInput.includes("mostrar conteudo") || 
               lowerInput.includes("ver conteúdo") || lowerInput.includes("ver conteudo") ||
               lowerInput.includes("você pode me mostrar") || lowerInput.includes("voce pode me mostrar") ||
               lowerInput.includes("me mostrar") || lowerInput.includes("me mostra") ||
               lowerInput.includes("módulos") || lowerInput.includes("modulos") ||
               lowerInput.includes("o que tem no curso") || lowerInput.includes("que tem no curso") ||
               lowerInput.includes("o que ensina") || lowerInput.includes("que ensina") ||
               lowerInput.includes("o que vou aprender") || lowerInput.includes("que vou aprender") ||
               lowerInput.includes("o que aprendo") || lowerInput.includes("que aprendo") ||
               lowerInput.includes("grade curricular") || lowerInput.includes("programa do curso") ||
               lowerInput.includes("temas são abordados") || lowerInput.includes("temas abordados") ||
               lowerInput.includes("assuntos") || lowerInput.includes("tópicos") || lowerInput.includes("topicos") ||
               lowerInput.includes("estrutura do curso") || lowerInput.includes("organização do curso") ||
               lowerInput.includes("como é dividido") || lowerInput.includes("como está dividido") ||
               lowerInput.includes("divisão do curso") || lowerInput.includes("cronograma") ||
               lowerInput.includes("roteiro") || lowerInput.includes("sumário") || lowerInput.includes("sumario") ||
               lowerInput.includes("índice") || lowerInput.includes("indice") || lowerInput.includes("matérias") ||
               lowerInput.includes("materias") || lowerInput.includes("programação") || lowerInput.includes("programacao")) {
      detectedIntent = 'CONTENT_INQUIRY';
      confidence = 0.8;
      nluData.keywords = ['conteúdo', 'módulos', 'mostrar', 'ensina'];
      nluData.sentiment = 'neutral';
    }
    else if (lowerInput.includes("carga horária") || lowerInput.includes("carga horaria") || lowerInput.includes("quantas horas") || lowerInput.includes("duração do curso") || lowerInput.includes("duracao do curso") || lowerInput.includes("horas do curso")) {
      detectedIntent = 'DURATION_INQUIRY';
      confidence = 0.8;
      nluData.keywords = ['carga horária', 'quantas horas', 'duração'];
      nluData.sentiment = 'neutral';
    }
    // Adicionar mais regras e, idealmente, integrar com NLP real.

    // --- FIM DA LÓGICA PLACEHOLDER ---

    if (detectedIntent) {
      logger.info(`[Intent Recognizer] Intenção detectada: ${detectedIntent} (Confiança: ${confidence})`, chatState.id);
    } else {
      logger.debug(`[Intent Recognizer] Nenhuma intenção específica detectada por placeholder.`, chatState.id);
    }

    return {
      intent: detectedIntent,
      confidence,
      nluData,
    };

  } catch (error) {
    logger.error(`[Intent Recognizer] Erro ao reconhecer intenção: ${error.message}`, chatState.id, { error: serializeError(error) });
    return {
      intent: null,
      confidence: 0,
      nluData: null,
      error: `Erro no reconhecimento de intenção: ${error.message}`
    };
  }
}

/**
 * Função para simular uma análise NLU mais detalhada (placeholder).
 * Em um cenário real, isso viria de uma biblioteca ou API de NLP.
 * @param {string} text
 * @returns {Promise<object>}
 */
async function _getNLUDetails(text) {
  // Simulação de chamada a API de NLP
  await new Promise(resolve => setTimeout(resolve, 50)); // Simula latência
  
  const lowerText = text.toLowerCase();
  let sentiment = 'neutral';
  let entities = [];

  if (lowerText.includes('excelente') || lowerText.includes('ótimo') || lowerText.includes('quero')) {
    sentiment = 'positive';
  }
  if (lowerText.includes('ruim') || lowerText.includes('péssimo') || lowerText.includes('caro')) {
    sentiment = 'negative';
  }

  if (lowerText.includes('produto x')) {
    entities.push({ type: 'PRODUCT', text: 'Produto X' });
  }
  if (lowerText.match(/\d{2}\/\d{2}\/\d{4}/)) {
    entities.push({ type: 'DATE', text: lowerText.match(/\d{2}\/\d{2}\/\d{4}/)[0] });
  }

  return {
    sentiment: sentiment,
    entities: entities,
    language: 'pt-br', // Exemplo
    keywords: text.split(' ').slice(0,5) // Exemplo muito simples
  };
}

// Exportar funções adicionais se necessário no futuro
export default {
  recognizeIntent,
  // outras funções de reconhecimento de intenção podem ser adicionadas aqui
};