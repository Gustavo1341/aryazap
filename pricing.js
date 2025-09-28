// --- START OF FILE pricing.js ---

/**
 * pricing.js - Definição da Estrutura de Produtos, Planos e Ofertas
 * ---------------------------------------------------------------------------------------
 * Define o produto "Curso Prática em Direito Sucessório" e seu plano único.
 */

import {
  // parseFloatEnv, // Não mais usado diretamente para detalhes do plano
  parseBoolEnv,
  // parseListEnv, // Não mais usado diretamente para detalhes do plano
  // parseIntEnv, // Não mais usado diretamente para detalhes do plano
  isValidHttpUrl, // Validador de URL
} from "./utils.js";
import dotenv from "dotenv";
import logger from "./logger.js"; // Para logs (ex: link inválido)

// Carrega ENV (usado para IDs de produto e flags de ativação, NÃO para detalhes de plano)
dotenv.config();

// ================================================================
// ===                 ESTRUTURAS DE DADOS (JSDoc)              ===
// ================================================================
/**
 * @typedef {object} Plan
 * @property {string} id - Identificador único (ex: 'CURSO_DIREITO_UNICO').
 * @property {string} productId - ID do produto ao qual pertence.
 * @property {string} name - Nome comercial (ex: 'Curso Prática em Direito Sucessório').
 * @property {string} shortDescription - Descrição curta.
 * @property {string|null} [mainBenefit] - Benefício principal.
 * @property {string} priceFormatted - Preço formatado (ex: '12x R$ 166,42 ou R$ 1.997,00 à vista').
 * @property {number|null} priceValue - Valor numérico (do pagamento à vista ou total).
 * @property {string} currency - Código moeda (ex: 'BRL').
 * @property {'one-time'|'custom'} billingCycle - Ciclo cobrança.
 * @property {string|null} checkoutLink - URL checkout. **CRÍTICO:** Definido diretamente no objeto do plano.
 * @property {string[]} features - Lista features/módulos/bônus.
 * @property {boolean} active - Disponível para oferta?
 * @property {boolean} [isRecommended=false] - Plano principal recomendado?
 * @property {number} [sortOrder=99] - Ordem exibição.
 */

/**
 * @typedef {object} Product
 * @property {string} id - Identificador único (ex: 'CURSO_DIREITO_SUCCESSORIO').
 * @property {string} name - Nome comercial.
 * @property {string} description - Descrição geral.
 * @property {boolean} active - Disponível?
 * @property {'main'} productType - Tipo.
 * @property {string|null} [targetAudience] - Público-alvo (opcional).
 * @property {null} [associatedMainProductId=null]
 * @property {null} [associatedUpsellProductId=null]
 * @property {null} [associatedCrossSellProductId=null]
 * @property {Plan[]} plans - Planos/ofertas associados (neste caso, apenas um).
 */

// ================================================================
// ===        FUNÇÃO AUXILIAR DE CRIAÇÃO DE PLANOS              ===
// ================================================================

/**
 * Cria um objeto Plan a partir da definição fornecida, aplicando defaults mínimos.
 * @param {string} id - ID único do plano (para referência e logs).
 * @param {object} planDefinition - Objeto contendo as propriedades do plano.
 * @returns {Plan} Objeto Plan configurado.
 * @throws {Error} Se `planDefinition.productId` ou `planDefinition.id` não forem fornecidos.
 */
const createPlan = (id, planDefinition) => {
  if (!planDefinition.productId) {
    throw new Error(
      `[Pricing createPlan] ERRO CRÍTICO: planDefinition.productId é obrigatório ao criar o plano com ID de referência "${id}"`
    );
  }
  if (!planDefinition.id) {
    throw new Error(
      `[Pricing createPlan] ERRO CRÍTICO: planDefinition.id é obrigatório dentro do objeto ao criar o plano com ID de referência "${id}"`
    );
  }
  const planId = planDefinition.id;
  if (id !== planId) {
    logger.warn(
      `[Pricing createPlan] ID de referência '${id}' diferente do ID no objeto '${planId}'. Usando '${planId}'.`
    );
  }

  logger.trace(
    `[Pricing createPlan] Processando plano ${planId}. Link definido no objeto: ${planDefinition.checkoutLink}`
  );

  const planData = {
    id: planId,
    productId: planDefinition.productId,
    name: planDefinition.name ?? `Oferta ${planId}`,
    shortDescription:
      planDefinition.shortDescription ?? "Descrição não fornecida.",
    mainBenefit: planDefinition.mainBenefit ?? null,
    priceFormatted: planDefinition.priceFormatted ?? "N/D",
    priceValue: planDefinition.priceValue ?? null,
    currency: planDefinition.currency ?? "BRL",
    billingCycle: planDefinition.billingCycle ?? "custom",
    checkoutLink: planDefinition.checkoutLink ?? null,
    features: planDefinition.features ?? [],
    active: planDefinition.active ?? true,
    isRecommended: planDefinition.isRecommended ?? false,
    sortOrder: planDefinition.sortOrder ?? 99,
  };

  const isPaidActiveNonCustom =
    planData.active &&
    planData.priceValue &&
    planData.priceValue > 0 &&
    planData.billingCycle !== "custom";

  if (isPaidActiveNonCustom && !planData.checkoutLink) {
    logger.error(
      `[Pricing createPlan Validation] CRÍTICO: Plano ATIVO e PAGO '${planData.name}' (${planData.id}) está SEM checkoutLink definido no objeto de criação em pricing.js!`,
      null,
      { critical: true, planId: planData.id }
    );
  } else if (planData.checkoutLink && !isValidHttpUrl(planData.checkoutLink)) {
    logger.error(
      `[Pricing createPlan Validation] CRÍTICO: Link checkout para '${planData.name}' (${planData.id}) é INVÁLIDO (formato/protocolo): "${planData.checkoutLink}"`,
      null,
      { critical: true, planId: planData.id }
    );
  }

  return planData;
};

// ================================================================
// ===        DEFINIÇÃO DOS PRODUTOS (Links no Código)          ===
// ================================================================

// --- IDs dos Produtos ---
// Para este caso, vamos definir o ID diretamente, já que é um produto único.
const CURSO_DIREITO_ID = "CURSO_DIREITO_SUCCESSORIO_DPA";
const TARGET_PRODUCT_ID = "CURSO_DIREITO_SUCCESSORIO_DPA";

// ================================================================
// ===           CONFIGURAÇÃO DE LINKS PARA PERSONALIZAÇÃO       ===
// ================================================================

// Configuração de links baseada nas variáveis de ambiente
const LINK_CONFIGURATION = {
  checkout: process.env.SALES_PAGE_URL || "https://direitoprocessualaplicado.com.br/pos-graduacao-direito-sucessorio/",
  salesPage: process.env.SALES_PAGE_URL || "https://direitoprocessualaplicado.com.br/pos-graduacao-direito-sucessorio/"
};

// --- Estrutura principal que armazena todos os produtos ---
/** @type {Product[]} */
const allProductsData = [
  // --- Produto Principal: Curso Prática em Direito Sucessório ---
  (() => {
    const productId = CURSO_DIREITO_ID;
    return {
      id: productId,
      name: "Curso Prática em Direito Sucessório",
      description:
        "Curso completo para advogados que desejam se especializar em inventários, partilhas, testamentos e planejamento sucessório, multiplicando seus honorários e atuando com segurança.",
      active: parseBoolEnv(
        process.env[`PRODUCT_${productId}_ACTIVE`], // Permite desativar via ENV se necessário
        true,
        `PRODUCT_${productId}_ACTIVE`
      ),
      productType: "main",
      targetAudience: "Advogados e profissionais do Direito",
      associatedUpsellProductId: null, // Sem upsell
      associatedCrossSellProductId: null, // Sem cross-sell
      // **** PLANO ÚNICO DEFINIDO DIRETAMENTE AQUI ****
      plans: [
        createPlan("CURSO_DIREITO_UNICO", {
          id: "CURSO_DIREITO_UNICO", // ID OBRIGATÓRIO
          productId,
          name: "Curso Prática em Direito Sucessório - Oferta Completa",
          sortOrder: 10,
          shortDescription: "Acesso completo ao curso e todos os bônus.",
          priceFormatted: "12x de R$ 194,56 ou R$ 1.997,00 à vista",
          priceValue: 1997.00, // Valor à vista
          currency: "BRL",
          billingCycle: "one-time", // Pagamento único para o curso
          checkoutLink: "https://pay.hotmart.com/A44481801Y?off=qvbx78wi&checkoutMode=10&bid=1738260098796",
          salesPage: "https://dpaadvocacia.com.br/curso-direito-sucessorio",
          features: [
            "Curso Completo Prática em Direito Sucessório (19 módulos principais)",
            "Módulo: Dominando A Prática Sucessória",
            "Módulo: Inventário Judicial Na Prática",
            "Módulo: Inventário Extrajudicial",
            "Módulo: Testamento Na Prática",
            "Módulo: Itcmd",
            "Módulo: Ação De Exigir Contas",
            "Módulo: Regularização De Bem Imóvel",
            "Módulo: Herança Digital",
            "Módulo: Contrato De Honorários",
            "Módulo: Abertura E Registro De Testamento",
            "Módulo: Planejamento Sucessório",
            "Módulo: Planejamento Patrimonial Familiar",
            "Módulo: Holding Familiar",
            "Módulo: Alvará Judicial",
            "Módulo: Curso De Usucapião",
            "Módulo: Caixa De Ferramentas: Casos Práticos",
            "Módulo: Agravo De Instrumento",
            "Módulo: Negociação",
            "Módulo: Prospecção De Clientes",
            "Combo Advocacia 4.0 (Acelerador de Petições, Manual de Prática, Mapa da Advocacia Sucessória, Precificação e Contrato de Honorários)",
            "Combo Os Segredos da Prospecção (Módulo Como Prospectar Clientes Na Internet, Imersão Os Segredos Da Prospecção, Criando A Primeira Campanha no Google Ads)",
            "Bônus: Minicurso de planejamento sucessório",
            "Bônus: Caixa de ferramentas - Aulas Práticas",
            "Comunidade de Alunos Fechada no Facebook",
            "Acesso por 12 meses",
            "Carga horária de 42 horas de aulas gravadas",
            "Certificado de conclusão"
          ],
          active: true,
          isRecommended: true, // Único plano, então é o recomendado
        }),
      ].sort((a, b) => (a.sortOrder ?? 99) - (b.sortOrder ?? 99)), // Ordena (útil se mais planos fossem adicionados)
    };
  })(),
];

// ================================================================
// ===              FUNÇÕES AUXILIARES DE ACESSO                 ===
// ================================================================
const pricingAccessors = {
  getAllProducts: function () {
    return allProductsData;
  },
  getActiveProducts: function (type = null) {
    return allProductsData.filter(
      (p) => p.active && (type === null || p.productType === type)
    );
  },
  getProductById: function (productId) {
    return allProductsData.find((p) => p.id === productId) ?? null;
  },
  getActiveProductById: function (productId) {
    // Neste caso específico, só há um produto, então podemos simplificar,
    // mas manteremos a lógica para consistência caso outros produtos sejam adicionados no futuro.
    const product = allProductsData.find((p) => p.id === productId && p.active);
    if (product && product.id === CURSO_DIREITO_ID) {
        return product;
    }
    // Se o ID não for o do curso de direito, ou se estiver inativo, retorna null.
    // Ou, se houver uma tentativa de buscar um produto diferente do curso de direito,
    // e ele não estiver definido, também retorna null.
    return null;
  },
  getActivePlans: function (productId) {
    const product = this.getActiveProductById(productId); // Usa getActiveProductById para garantir que o produto esteja ativo
    if (product && product.id === CURSO_DIREITO_ID) {
        return product.plans?.filter((plan) => plan.active) ?? [];
    }
    return []; // Retorna array vazio se o produto não for o curso de direito ou não estiver ativo
  },
  getPlanDetails: function (planId, productId = null) {
    // Se productId for fornecido e não for o CURSO_DIREITO_ID, não há o que buscar.
    if (productId && productId !== CURSO_DIREITO_ID) return null;

    const productToSearch = this.getProductById(CURSO_DIREITO_ID);
    if (!productToSearch) return null;

    return productToSearch.plans?.find((p) => p.id === planId) ?? null;
  },
  getCheckoutLink: function (planId, productId = null) {
    const plan = this.getPlanDetails(planId, productId);
    if (plan?.active && plan.checkoutLink) {
      if (isValidHttpUrl(plan.checkoutLink)) {
        return plan.checkoutLink;
      } else {
        logger?.warn(
          `[Pricing getCheckoutLink] Link checkout inválido para plano ATIVO '${plan.name}' (${plan.id}). Verifique a definição em pricing.js. Link: "${plan.checkoutLink}"`,
          null,
          { planId: plan.id, productId: plan.productId }
        );
        return null;
      }
    }
    return null;
  },
  getRecommendedPlan: function (productId = CURSO_DIREITO_ID) {
    // Se o produto solicitado não for o curso de direito, não há plano recomendado.
    if (productId !== CURSO_DIREITO_ID) return null;

    const activePlans = this.getActivePlans(productId);
    if (!activePlans.length) return null;
    // Como só há um plano, ele será o recomendado se estiver ativo.
    return activePlans.find((p) => p.isRecommended) || activePlans[0] || null;
  },
  getAlternativePlan: function (productId = CURSO_DIREITO_ID) {
    // Não há plano alternativo neste cenário com um único produto/plano.
    return null;
  },
  getUpsellProductDetails: function (mainProductId) {
    // Sem upsell definido neste cenário.
    return null;
  },
  getCrossSellProductDetails: function (mainProductId) {
    // Sem cross-sell definido neste cenário.
    return null;
  },
  
  // ================================================================
  // ===           FUNÇÕES PARA PERSONALIZAÇÃO DE LINKS           ===
  // ================================================================
  
  /**
   * Obtém o link de checkout padrão
   * @returns {string} Link de checkout
   */
  getCheckoutLinkDirect: function () {
    return LINK_CONFIGURATION.checkout;
  },
  
  /**
   * Obtém o link da página de vendas
   * @returns {string} Link da página de vendas
   */
  getSalesPageLink: function () {
    return LINK_CONFIGURATION.salesPage;
  },
  
  /**
   * Obtém o link apropriado baseado no contexto
   * @param {string} context - Contexto: 'checkout' ou 'salesPage'
   * @returns {string} Link apropriado para o contexto
   */
  getLinkByContext: function (context) {
    if (context === 'salesPage') {
      return this.getSalesPageLink();
    }
    // Por padrão, retorna o link de checkout
    return this.getCheckoutLinkDirect();
  },
};

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================
if (!Array.isArray(allProductsData) || allProductsData.length === 0) {
  logger.error(
    "[PRICING] ERRO CRÍTICO: allProductsData não é um array válido ou está vazio!"
  );
  // Em um cenário real, poderia lançar um erro ou ter um fallback mais robusto.
  // Forçamos um array vazio para evitar quebras downstream se allProductsData for undefined.
  allProductsData = [];
}

export default pricingAccessors;

// --- END OF FILE pricing.js ---