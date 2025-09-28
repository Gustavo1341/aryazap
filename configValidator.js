/**
 * configValidator.js - Central de Validação de Configurações (v. Robusta)
 * -----------------------------------------------------------
 * Responsável por validar as configurações carregadas de:
 * - botConfig.js (Configurações do Bot, IA, TTS, etc.)
 * - pricing.js (Produtos, Planos, Links de Checkout, Associações Upsell/Cross-sell)
 *
 * Utiliza o logger para reportar avisos (warnings) e erros (errors/fatal).
 * Retorna contagens separadas de erros críticos e avisos. A aplicação
 * principal pode usar a contagem de erros críticos para decidir se interrompe a inicialização.
 */

import logger from "./logger.js";
import botConfig from "./botConfig.js"; // Importa a configuração do bot para validação
import pricing from "./pricing.js"; // Importa a configuração de preços para validação
// Importa helper para validar URLs, assumindo que existe em utils.js
import { isValidHttpUrl } from "./utils.js";

// ================================================================
// ===            VALIDAÇÃO ESPECÍFICA: botConfig               ===
// ================================================================

/**
 * Valida as configurações principais do bot (IA, TTS, Suporte, Produto Alvo, etc.).
 * @returns {{criticalErrors: number, warnings: number}} Contagem de problemas.
 */
function validateBotConfig() {
  // Garante que o logger esteja pronto
  if (!logger?.info) {
    console.error(
      "[VALIDATION FALLBACK ERROR] Logger principal não disponível. Validação de botConfig abortada."
    );
    return { criticalErrors: 1, warnings: 0 }; // Retorna erro crítico se logger falhar
  }

  logger.debug("[Config Validate] Iniciando validação de botConfig...");
  let criticalErrors = 0;
  let warnings = 0;
  const mainProductId = botConfig.behavior.salesStrategy.targetProductId;

  // --- 1. Validação IA (OpenAI / LM Studio) ---
  const hasApiKey = !!botConfig.openai.apiKey;
  const hasLmStudioUrl = !!botConfig.openai.lmStudioBaseUrl;

  if (!hasApiKey && !hasLmStudioUrl) {
    logger.error(
      "[Config Validate] CRÍTICO: IA não funcionará. Defina OPENAI_API_KEY ou LMSTUDIO_BASE_URL no .env.",
      null,
      { critical: true }
    );
    criticalErrors++;
  } else if (hasApiKey && hasLmStudioUrl) {
    logger.warn(
      // Aviso sobre ambiguidade, mas não crítico
      `[Config Validate] Config IA AMBÍGUA: Usando LM Studio (prioridade) em ${botConfig.openai.lmStudioBaseUrl}. OPENAI_API_KEY será ignorada para chat/transcrição.`,
      null,
      { prioritized: "LM Studio" }
    );
    warnings++;
  } else {
    logger.info(
      `[Config Validate] Config IA OK: ${
        hasLmStudioUrl
          ? `LM Studio (${botConfig.openai.lmStudioBaseUrl})`
          : "OpenAI API"
      }. Modelo Chat: ${botConfig.openai.model}`
    );
  }

  // --- 2. Validação Transcrição (Whisper) ---
  const whisperEnabled = botConfig.openai.whisperModel !== "disabled";
  if (whisperEnabled) {
    if (!hasApiKey && !hasLmStudioUrl) {
      logger.error(
        // Erro crítico: Transcrição ativa mas sem backend IA
        "[Config Validate] CRÍTICO: Transcrição ATIVA, mas IA base (OpenAI/LMStudio) NÃO configurada. Transcrição Whisper FALHARÁ.",
        null,
        { whisperModel: botConfig.openai.whisperModel, critical: true }
      );
      criticalErrors++;
    } else {
      logger.info(
        `[Config Validate] Transcrição Áudio ATIVA. Modelo: ${botConfig.openai.whisperModel}.`
      );
    }
  } else {
    logger.info("[Config Validate] Transcrição Áudio DESATIVADA.");
  }

  // --- 3. Validação Número de Suporte ---
  if (!botConfig.behavior.support.whatsappNumber) {
    logger.warn(
      // Aviso importante, mas não impede boot
      "[Config Validate] Número de Suporte (SUPPORT_WHATSAPP_NUMBER) não definido! Encaminhamento para suporte FALHARÁ.",
      null,
      { critical_feature: true }
    );
    warnings++;
  } else {
    // Validação simples do formato (ex: apenas números, mínimo de 10 dígitos)
    const supportNumberDigits =
      botConfig.behavior.support.whatsappNumber.replace(/\D/g, "");
    if (supportNumberDigits.length < 10) {
      logger.warn(
        `[Config Validate] Número de Suporte (${botConfig.behavior.support.whatsappNumber}) parece inválido (curto/formato incorreto). Verifique SUPPORT_WHATSAPP_NUMBER.`,
        null,
        { critical_feature: true }
      );
      warnings++;
    } else {
      logger.info(
        `[Config Validate] Número Suporte Configurado: ${botConfig.behavior.support.whatsappNumber}`
      );
    }
  }

  // --- 4. Validação TTS (ElevenLabs) ---
  if (botConfig.tts.enabled) {
    if (!botConfig.tts.elevenLabsApiKey) {
      logger.error(
        // Erro crítico: TTS ativo sem chave
        "[Config Validate] CRÍTICO: TTS ATIVO, mas ELEVENLABS_API_KEY está faltando no .env! TTS NÃO FUNCIONARÁ.",
        null,
        { critical_tts: true }
      );
      criticalErrors++;
    } else if (!botConfig.tts.elevenLabsVoiceId) {
      logger.warn(
        // Aviso: Voz não definida, usará default API
        "[Config Validate] TTS ATIVO, mas ELEVENLABS_VOICE_ID não definido no .env. Usará voz padrão da API (pode não ser a desejada).",
        null,
        { voiceIdUsed: "Default API Voice" }
      );
      warnings++;
    } else {
      logger.info(
        `[Config Validate] TTS ATIVO (ElevenLabs). Voz: ${
          botConfig.tts.elevenLabsVoiceId
        }, Modelo: ${botConfig.tts.elevenLabsModelId}, Prob: ${
          botConfig.tts.usageProbability * 100
        }%.`
      );
    }
  } else {
    logger.info("[Config Validate] TTS DESATIVADO.");
  }

  // --- 5. Validação Produto Alvo Principal ---
  if (!mainProductId) {
    logger.error(
      `[Config Validate] CRÍTICO: TARGET_PRODUCT_ID não definido em botConfig / .env! O funil de vendas principal não funcionará.`,
      null,
      { critical: true }
    );
    criticalErrors++;
  } else {
    logger.info(
      `[Config Validate] Produto Alvo Principal (ID): ${mainProductId}`
    );
    // A existência real em pricing.js será validada em validatePricing()
  }

  // --- 6. Validação Configuração Upsell/Cross-sell (Dependência de Pricing) ---
  // Verifica apenas se as flags estão ativas e se há *algum* ID associado em pricing.
  // A validação completa do produto/plano associado ocorre em validatePricing().
  const mainProductDetails = pricing.getProductById(mainProductId); // Pega mesmo se inativo para checar associação

  if (botConfig.behavior.salesStrategy.enableUpsell) {
    logger.info(`[Config Validate] Estratégia Upsell: ATIVADA.`);
    if (!mainProductDetails?.associatedUpsellProductId) {
      logger.warn(
        `[Config Validate] Upsell ATIVADO, mas nenhum ID de produto Upsell associado a ${mainProductId} em pricing.js (propriedade 'associatedUpsellProductId').`
      );
      warnings++;
    } else {
      logger.info(
        `[Config Validate] Produto principal ${mainProductId} tem Upsell associado (ID: ${mainProductDetails.associatedUpsellProductId}). Validação detalhada em pricing.`
      );
    }
  } else {
    logger.info(`[Config Validate] Estratégia Upsell: DESATIVADA.`);
  }

  if (botConfig.behavior.salesStrategy.enableCrossSell) {
    logger.info(`[Config Validate] Estratégia Cross-Sell: ATIVADA.`);
    if (!mainProductDetails?.associatedCrossSellProductId) {
      logger.warn(
        `[Config Validate] Cross-Sell ATIVADO, mas nenhum ID de produto Cross-Sell associado a ${mainProductId} em pricing.js (propriedade 'associatedCrossSellProductId').`
      );
      warnings++;
    } else {
      logger.info(
        `[Config Validate] Produto principal ${mainProductId} tem Cross-Sell associado (ID: ${mainProductDetails.associatedCrossSellProductId}). Validação detalhada em pricing.`
      );
    }
  } else {
    logger.info(`[Config Validate] Estratégia Cross-Sell: DESATIVADA.`);
  }

  // --- 7. Validação Max Tokens ---
  if (botConfig.openai.maxTokens !== null && botConfig.openai.maxTokens < 150) {
    logger.warn(
      `[Config Validate] OpenAI Max Tokens (${botConfig.openai.maxTokens}) < 150 pode ser muito baixo (OPENAI_MAX_TOKENS).`,
      null,
      { maxTokens: botConfig.openai.maxTokens }
    );
    warnings++;
  }

  // --- 8. Validação de Ranges Numéricos ---
  if (botConfig.openai.temperature < 0 || botConfig.openai.temperature > 2) {
    logger.warn(
      `[Config Validate] Temperatura OpenAI (${botConfig.openai.temperature}) fora do range recomendado (0-2). Verifique OPENAI_TEMPERATURE.`
    );
    warnings++;
  }
  if (
    botConfig.tts.usageProbability < 0 ||
    botConfig.tts.usageProbability > 1
  ) {
    logger.warn(
      `[Config Validate] Probabilidade TTS (${botConfig.tts.usageProbability}) fora do range (0-1). Verifique TTS_USAGE_PROBABILITY.`
    );
    warnings++; // Valor inválido, mesmo que clampado no config
  }
  if (botConfig.behavior.responseSettings.maxLengthChars < 50) {
    logger.warn(
      `[Config Validate] RESPONSE_MAX_LENGTH_CHARS (${botConfig.behavior.responseSettings.maxLengthChars}) < 50 é muito baixo.`
    );
    warnings++;
  }
  if (botConfig.behavior.responseSettings.groupingDelaySeconds < 1) {
    logger.warn(
      `[Config Validate] RESPONSE_GROUPING_DELAY_SECONDS (${botConfig.behavior.responseSettings.groupingDelaySeconds}) < 1 pode causar processamento excessivo.`
    );
    warnings++;
  }

  logger.info(
    `[Config Validate] Validação botConfig: ${criticalErrors} Erro(s) Crítico(s), ${warnings} Aviso(s).`
  );
  return { criticalErrors, warnings };
}

// ================================================================
// ===            VALIDAÇÃO ESPECÍFICA: pricing                 ===
// ================================================================

/**
 * Valida a configuração de produtos e planos em pricing.js.
 * Verifica existência do produto principal, links de checkout, associações, etc.
 * @returns {{criticalErrors: number, warnings: number}} Contagem de problemas.
 */
function validatePricing() {
  if (!logger?.info) {
    console.error(
      "[VALIDATION FALLBACK ERROR] Logger principal não disponível. Validação de pricing abortada."
    );
    return { criticalErrors: 1, warnings: 0 };
  }
  logger.debug(
    "[Pricing Validate] Iniciando validação de produtos, planos e links..."
  );
  let criticalErrors = 0;
  let warnings = 0;
  const placeholderLinkRegex = /DEFAULT_.*_LINK|_CHECKOUT_LINK|LINK_PADRAO/i; // Regex mais abrangente
  const mainProductIdFromBotConfig =
    botConfig.behavior.salesStrategy.targetProductId;

  // --- Valida Produto Principal Alvo (existência e atividade em pricing.js) ---
  if (!mainProductIdFromBotConfig) {
    logger.error(
      `[Pricing Validate] CRÍTICO: TARGET_PRODUCT_ID não definido em botConfig. Impossível validar pricing corretamente.`
    );
    criticalErrors++;
    // Não podemos prosseguir muito sem saber o produto principal
    return { criticalErrors, warnings };
  }

  const mainProduct = pricing.getProductById(mainProductIdFromBotConfig); // Pega mesmo se inativo para dar erro correto
  if (!mainProduct) {
    logger.error(
      `[Pricing Validate] CRÍTICO: Produto principal alvo (TARGET_PRODUCT_ID=${mainProductIdFromBotConfig}) NÃO FOI ENCONTRADO em pricing.js! Verifique o ID ou pricing.js.`,
      null,
      { productId: mainProductIdFromBotConfig, critical: true }
    );
    criticalErrors++;
    return { criticalErrors, warnings }; // Não adianta validar planos/associações
  } else if (!mainProduct.active) {
    logger.error(
      `[Pricing Validate] CRÍTICO: Produto principal alvo (${mainProductIdFromBotConfig}) está INATIVO em pricing.js! O funil principal não funcionará.`,
      null,
      { productId: mainProductIdFromBotConfig, critical: true }
    );
    criticalErrors++;
    // Continuamos a validação dos planos dele, pois podem ser referenciados por Upsell/Cross-sell
  } else {
    logger.info(
      `[Pricing Validate] Produto principal alvo (${mainProductIdFromBotConfig}) encontrado e ativo em pricing.js.`
    );
  }

  const mainProductPlans = mainProduct.plans?.filter((p) => p.active) ?? [];
  if (mainProduct.active && mainProductPlans.length === 0) {
    logger.warn(
      `[Pricing Validate] Produto principal ativo (${mainProductIdFromBotConfig}) NÃO possui PLANOS ATIVOS definidos em pricing.js.`
    );
    warnings++;
  } else if (mainProduct.active) {
    const recommendedPlan = pricing.getRecommendedPlan(
      mainProductIdFromBotConfig
    );
    if (
      recommendedPlan &&
      !pricing.getCheckoutLink(recommendedPlan.id, mainProductIdFromBotConfig)
    ) {
      logger.error(
        // Erro, link do recomendado é importante
        `[Pricing Validate] Plano RECOMENDADO '${recommendedPlan.name}' (${
          recommendedPlan.id
        }) do produto principal está SEM CHECKOUT LINK válido (PLAN_${recommendedPlan.id.toUpperCase()}_CHECKOUT_LINK).`,
        null,
        { critical_link: true }
      );
      criticalErrors++;
    }
    const alternativePlan = pricing.getAlternativePlan(
      mainProductIdFromBotConfig
    );
    if (
      alternativePlan &&
      !pricing.getCheckoutLink(alternativePlan.id, mainProductIdFromBotConfig)
    ) {
      logger.warn(
        // Aviso, link do alternativo é menos crítico
        `[Pricing Validate] Plano ALTERNATIVO '${alternativePlan.name}' (${
          alternativePlan.id
        }) do produto principal está sem CHECKOUT LINK válido (PLAN_${alternativePlan.id.toUpperCase()}_CHECKOUT_LINK).`
      );
      warnings++;
    }
  }

  // --- Itera sobre todos os produtos definidos em pricing.js ---
  pricing.getAllProducts().forEach((product) => {
    if (!product.active) {
      logger.trace(`[Pricing Validate] Pulando produto INATIVO: ${product.id}`);
      return;
    }

    const productIdentifier = `Produto '${product.name}' (${
      product.id
    }, Tipo: ${product.productType || "main"})`; // Assume 'main' se type não definido

    // --- Valida Associações (para Upsell/Cross-sell) ---
    if (
      product.productType === "upsell" ||
      product.productType === "crosssell"
    ) {
      if (!product.associatedMainProductId) {
        logger.error(
          `[Pricing Validate] CRÍTICO: ${productIdentifier} não define a qual produto principal está associado ('associatedMainProductId').`,
          null,
          { critical: true }
        );
        criticalErrors++;
      } else if (!pricing.getProductById(product.associatedMainProductId)) {
        logger.error(
          `[Pricing Validate] CRÍTICO: ${productIdentifier} aponta para produto principal INEXISTENTE ('associatedMainProductId': ${product.associatedMainProductId}).`,
          null,
          { critical: true }
        );
        criticalErrors++;
      }
    }
    // A validação se o produto principal aponta para upsell/cross-sell existente já está em validateBotConfig e abaixo

    // --- Validações dos Planos ATIVOS do Produto ---
    const activePlans = product.plans?.filter((p) => p.active) ?? [];

    if (activePlans.length === 0 && product.productType !== "bundle") {
      // Bundles podem não ter planos próprios
      logger.warn(
        `[Pricing Validate] ${productIdentifier} ATIVO não possui nenhum plano ATIVO definido.`
      );
      warnings++;
      return; // Pula validação de planos se não houver planos ativos
    }

    activePlans.forEach((plan) => {
      const planIdentifier = `Plano '${plan.name}' (${plan.id}) de ${productIdentifier}`;

      // 1. Validação do Link de Checkout (Refatorada para maior rigor)
      const isPaidPlan = plan.priceValue !== null && plan.priceValue > 0; // Planos gratuitos não exigem link
      const isCustomBilling = plan.billingCycle === "custom"; // Planos custom podem não ter link padrão

      // Condição para exigir link válido: ativo (já filtrado), pago e não-custom
      const requiresValidLinkStrictly = plan.status === 'active' && isPaidPlan && !isCustomBilling;

      const isMissingLink = !plan.checkoutLink;
      const isPlaceholderLink = plan.checkoutLink && placeholderLinkRegex.test(plan.checkoutLink);
      const isInvalidHttpUrl = plan.checkoutLink && !isPlaceholderLink && !isValidHttpUrl(plan.checkoutLink); // Só checa URL se não for placeholder

      if (requiresValidLinkStrictly && (isMissingLink || isPlaceholderLink || isInvalidHttpUrl)) {
          // Erro Crítico: Plano ativo, pago, não-custom com link inválido/ausente/placeholder
          let reason = "está SEM link de checkout";
          if (isPlaceholderLink) {
              reason = `usa LINK PLACEHOLDER: \"${plan.checkoutLink}\"`;
          } else if (isInvalidHttpUrl) {
              reason = `possui link INVÁLIDO (não é HTTP/S): \"${plan.checkoutLink}\"`;
          }
          logger.error(
              `[Pricing Validate] CRÍTICO: ${planIdentifier} (${plan.status}, ${plan.billingCycle}, $${plan.priceValue}) ${reason}. Configure via ENV (PLAN_${plan.id.toUpperCase()}_CHECKOUT_LINK).`,
              null,
              { critical: true, planId: plan.id, productId: product.id }
          );
          criticalErrors++;
      } else if (plan.checkoutLink && (isPlaceholderLink || isInvalidHttpUrl)) {
          // Aviso para outros casos (e.g., plano inativo, gratuito, custom) com link problemático mas não crítico
          let reason = isPlaceholderLink
              ? `usa LINK PLACEHOLDER: \"${plan.checkoutLink}\"`
              : `possui link INVÁLIDO (não é HTTP/S): \"${plan.checkoutLink}\"`;
          logger.warn(
              `[Pricing Validate] AVISO: ${planIdentifier} ${reason}. Verifique PLAN_${plan.id.toUpperCase()}_CHECKOUT_LINK.`,
               null,
               { planId: plan.id, productId: product.id }
          );
          warnings++;
       } else if (isPaidPlan && !isCustomBilling && isMissingLink && !requiresValidLinkStrictly) {
           // Aviso se for pago, não-custom, sem link, mas *não* estritamente requerido (ex: plano inativo)
           // Isso cobre casos onde o plano pode ser reativado ou referenciado de outra forma.
            logger.warn(
                `[Pricing Validate] AVISO: ${planIdentifier} (${plan.status}, ${plan.billingCycle}) está SEM link de checkout. Verifique PLAN_${plan.id.toUpperCase()}_CHECKOUT_LINK.`,
                 null,
                 { planId: plan.id, productId: product.id }
             );
           warnings++;
       }
       // Caso contrário (plano gratuito, custom com link ok/ausente, ou pago/ativo/não-custom com link válido): Nenhuma ação necessária aqui.

      // 2. Verificar se Upsell/Cross-sell tem mainBenefit (recomendado)
      if (
        (product.productType === "upsell" ||
          product.productType === "crosssell") &&
        !plan.mainBenefit
      ) {
        logger.warn(
          `[Pricing Validate] Oferta ${
            product.productType
          } ${planIdentifier} está sem 'mainBenefit'. Defina PLAN_${plan.id.toUpperCase()}_MAIN_BENEFIT no .env.`,
          null,
          { recommended: true }
        );
        warnings++;
      }

      // 3. Verificar se features existem (aviso)
      if (!plan.features || plan.features.length === 0) {
        logger.warn(
          `[Pricing Validate] ${planIdentifier} está sem NENHUMA feature listada.`
        );
        warnings++;
      }
    }); // Fim forEach plan
  }); // Fim forEach product

  logger.info(
    `[Pricing Validate] Validação pricing: ${criticalErrors} Erro(s) Crítico(s), ${warnings} Aviso(s).`
  );
  return { criticalErrors, warnings };
}

// ================================================================
// ===            FUNÇÃO PRINCIPAL DE VALIDAÇÃO                 ===
// ================================================================

/**
 * Executa todas as validações de configuração em sequência.
 * @returns {Promise<number>} O número total de erros críticos encontrados.
 * Retorna uma Promise para manter consistência com inicializadores assíncronos.
 */
export async function validateAllConfigurations() {
  logger.info(
    "================================================================"
  );
  logger.info(
    "===          INICIANDO VALIDAÇÃO DAS CONFIGURAÇÕES           ==="
  );
  logger.info(
    "================================================================"
  );

  let totalCriticalErrors = 0;
  let totalWarnings = 0;

  // Valida botConfig
  const botConfigResult = validateBotConfig();
  totalCriticalErrors += botConfigResult.criticalErrors;
  totalWarnings += botConfigResult.warnings;

  // Valida pricing
  // Garante que isValidHttpUrl esteja disponível antes de chamar validatePricing
  if (typeof isValidHttpUrl !== "function") {
    logger.error(
      "[Config Validator] CRÍTICO: Função 'isValidHttpUrl' não encontrada (esperada em utils.js). Validação de pricing abortada.",
      null,
      { critical: true }
    );
    totalCriticalErrors++;
  } else {
      const pricingResult = validatePricing();
      totalCriticalErrors += pricingResult.criticalErrors;
      totalWarnings += pricingResult.warnings;
  }

  // Adicionar chamadas para outras validações (ex: salesFunnelBluePrint) aqui, se necessário
  // totalCriticalErrors += validateSalesFunnel();

  logger.info(
    "================================================================"
  );
  if (totalCriticalErrors > 0) {
    logger.fatal(
      // Log fatal se houver qualquer erro crítico
      `[Config Validator] VALIDAÇÃO GERAL CONCLUÍDA COM ${totalCriticalErrors} ERRO(S) CRÍTICO(S) e ${totalWarnings} Aviso(s).`,
      null,
      { critical: true }
    );
    logger.fatal(
      "[Config Validator] A INICIALIZAÇÃO PODE SER INSTÁVEL OU FALHAR. VERIFIQUE OS LOGS DE ERRO ACIMA."
    );
    // Considerar lançar um erro para forçar a parada no main.js:
    // throw new Error(`Configuração inválida: ${totalCriticalIssues} erro(s) crítico(s) encontrados.`);
  } else if (totalWarnings > 0) {
    logger.warn(
      // Aviso se não há erros críticos mas há avisos
      `[Config Validator] VALIDAÇÃO GERAL CONCLUÍDA SEM ERROS CRÍTICOS, mas com ${totalWarnings} Aviso(s). Verifique os logs.`
    );
  } else {
    logger.info(
      "[Config Validator] VALIDAÇÃO GERAL CONCLUÍDA SEM ERROS CRÍTICOS OU AVISOS."
    );
  }
  logger.info(
    "================================================================"
  );

  return totalCriticalErrors; // Retorna apenas os erros CRÍTICOS
}

// --- END OF FILE configValidator.js ---