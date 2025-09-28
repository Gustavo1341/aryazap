// --- START OF FILE socialProofPersonalizer.js ---

// ================================================================
// ===           PERSONALIZADOR DE PROVAS SOCIAIS                ===
// ================================================================
// Responsável por detectar pedidos de mais provas sociais e
// personalizar o comportamento do sistema de acordo

import logger from "./logger.js";
import stateManager from "./stateManager.js";
import pricing from "./pricing.js";

/**
 * Detecta se o usuário está pedindo mais provas sociais
 * @param {string} userInput - Entrada do usuário
 * @returns {boolean} - True se está pedindo mais provas
 */
function isRequestingMoreProofs(userInput) {
  if (!userInput || typeof userInput !== 'string') {
    return false;
  }

  const lowerInput = userInput.toLowerCase();
  
  // Indicadores de pedido de mais provas sociais
  const indicators = [
    'mais provas',
    'mais depoimentos',
    'outros depoimentos',
    'mais casos',
    'mais exemplos',
    'outras provas',
    'mais evidências',
    'mais resultados',
    'quero ver mais',
    'tem mais',
    'outros casos',
    'mais informações',
    'página completa',
    'site completo'
  ];

  return indicators.some(indicator => lowerInput.includes(indicator));
}

/**
 * Detecta se uma mensagem contém conteúdo do chunk 'mais_provas'
 * @param {string} message - Mensagem a ser verificada
 * @returns {boolean} - True se contém o chunk mais_provas
 */
function containsMaisProvasChunk(message) {
  if (!message || typeof message !== 'string') {
    return false;
  }

  const lowerMessage = message.toLowerCase();
  
  // Indicadores específicos do chunk mais_provas
  const chunkIndicators = [
    'mais provas sociais',
    'outros depoimentos',
    'mais casos de sucesso',
    'página de vendas completa',
    'site completo',
    'redes sociais do iajur',
    'instagram do iajur',
    'facebook do iajur'
  ];

  return chunkIndicators.some(indicator => lowerMessage.includes(indicator));
}

/**
 * Determina o contexto para mais provas sociais
 * @param {string} chatId - ID do chat
 * @param {string} userInput - Entrada do usuário
 * @returns {Object} - Contexto determinado
 */
async function determineContext(chatId, userInput) {
  try {
    const isMoreProofsRequest = isRequestingMoreProofs(userInput);
    
    // Determina o link apropriado baseado no contexto
    let link;
    if (isMoreProofsRequest) {
      link = pricing.getSalesPageLink();
      // Atualizar preferência no estado
      await stateManager.updateLinkPreference(chatId, true);
    } else {
      link = pricing.getCheckoutLinkDirect();
    }
    
    return {
      isMoreProofsRequest,
      shouldUseSalesPage: isMoreProofsRequest,
      reason: isMoreProofsRequest ? 'user_requested_more_proofs' : 'normal_flow',
      link
    };
  } catch (error) {
    logger.error(
      `[Social Proof Personalizer] Erro ao determinar contexto para ${chatId}:`,
      chatId,
      { error: error.message }
    );
    
    return {
      isMoreProofsRequest: false,
      shouldUseSalesPage: false,
      reason: 'error_fallback',
      link: pricing.getCheckoutLinkDirect() // Fallback link
    };
  }
}



/**
 * Adiciona tag ao estado do usuário
 * @param {string} chatId - ID do chat
 * @param {string} tag - Tag a ser adicionada
 */
async function addTagToState(chatId, tag) {
  try {
    // Implementação simplificada - pode ser expandida conforme necessário
    logger.info(
      `[Social Proof Personalizer] Tag '${tag}' adicionada para ${chatId}`,
      chatId
    );
  } catch (error) {
    logger.error(
      `[Social Proof Personalizer] Erro ao adicionar tag '${tag}' para ${chatId}:`,
      chatId,
      { error: error.message }
    );
  }
}

/**
 * Substitui {tag_link} na mensagem baseado no contexto
 * @param {string} message - Mensagem original
 * @param {string} chatId - ID do chat
 * @param {string} userMessage - Mensagem do usuário
 * @returns {string} - Mensagem com link substituído
 */
async function replaceTagLink(message, chatId, userMessage = '') {
  try {
    if (!message || !message.includes('{tag_link}')) {
      return message;
    }

    // NOVA VERIFICAÇÃO: Prioriza chunk 'mais_provas'
    if (containsMaisProvasChunk(message)) {
      const salesPageUrl = pricing.getSalesPageLink();
      logger.info(
        `[Social Proof Personalizer] Chunk 'mais_provas' detectado para ${chatId}. Forçando {tag_link} para salesPage: ${salesPageUrl}`,
        chatId
      );
      return message.replace(/{tag_link}/g, salesPageUrl);
    }

    // Lógica original para outros casos
    const context = await determineContext(chatId, userMessage);
    
    let linkToUse;
    let linkType;
    
    if (context.shouldUseSalesPage) {
      linkToUse = pricing.getSalesPageLink();
      linkType = 'salesPage';
      
      // Atualizar preferência no estado
      await stateManager.updateLinkPreference(chatId, true);
    } else {
      linkToUse = pricing.getCheckoutLinkDirect();
      linkType = 'checkout';
    }

    logger.info(
      `[Social Proof Personalizer] Substituindo {tag_link} para ${chatId}: contexto=${context.reason}, linkType=${linkType}`,
      chatId
    );

    return message.replace(/{tag_link}/g, linkToUse);
    
  } catch (error) {
    logger.error(
      `[Social Proof Personalizer] Erro ao substituir {tag_link} para ${chatId}:`,
      chatId,
      { error: error.message }
    );
    
    // Fallback para checkout em caso de erro
    const fallbackLink = pricing.getCheckoutLinkDirect();
    return message.replace(/{tag_link}/g, fallbackLink);
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

export default {
  isRequestingMoreProofs,
  containsMaisProvasChunk,
  determineContext,
  addTagToState,
  replaceTagLink
};

// --- END OF FILE socialProofPersonalizer.js ---