// --- START OF FILE aiProcessor.js ---

// ================================================================
// ===               PROCESSADOR DE IA (aiProcessor.js)            ===
// ================================================================
// Responsável por gerar prompts, chamar/processar IA, detectar objeções/intenções
// *** ATUALIZAÇÃO: Simplificação da chamada TTS. ***

import logger from "./logger.js";
import stateManager from "./stateManager.js";
// ETAPA 2: Functions like markStepAsCompleted, getAllCompletedSteps, getCollectedUserData, 
 
// logFlowAdaptation, etc., from stateManager.js are now accessed via stateManager.functionName
import * as intentRecognizer from "./intentRecognizer.js"; // ETAPA 2: Adicionado (será criado)
import botConfig from "./botConfig.js";
import responseSender from "./responseSender.js";
import inactivityManager from "./inactivityManager.js"; // Sistema de inatividade
import { sleep } from "./utils.js";
import { serializeError } from "serialize-error";
import salesFunnelBluePrint from "./salesFunnelBluePrint.js";
import pricing from "./pricing.js";
import { AI_GLOBAL_RULE_NO_INVENTION } from "./constants.js";

import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import IntelligentRAG from "./utils/IntelligentRAG.js"; // Sistema RAG inteligente
// Axios e FormData não são mais necessários diretamente aqui se a transcrição LMStudio foi removida
// import axios from "axios";
// import FormData from "form-data";
import * as mediaHandler from "./mediaHandler.js"; // mediaHandler.default para acessar as funções exportadas
import { PROOFS_DIR } from "./fileSystemHandler.js";
import path from "node:path";
import whatsappClient from "./whatsappClient.js";
import * as criticalStepExecutor from "./criticalStepExecutor.js"; // Executor de etapas críticas
import socialProofPersonalizer from "./socialProofPersonalizer.js"; // Personalizador de provas sociais
import {
  getGreetingTime,
  getFormattedHistoryForAI,
  // normalizeString, // Não usado diretamente aqui após refatorações
} from "./utils.js";

// Constantes e configurações
const MAX_HISTORY_MESSAGES_AI =
  botConfig.behavior.responseSettings.maxHistoryMessagesAI || 15; // Ajustado para usar o valor do botConfig

const VIDEO_POST_SEND_DELAY_MS =
  botConfig.behavior.responseSettings.videoPostSendDelayMs || 1800;

// Clientes e instâncias
let openaiClient = null;
let geminiClient = null;
let intelligentRAG = null; // Sistema RAG inteligente

// Tipos JSDoc
/**
 * @typedef {import('./stateManager.js').ChatState} ChatState
 * @typedef {import('./salesFunnelBluePrint.js').FunnelStep} FunnelStep
 * @typedef {import('whatsapp-web.js').Chat} WAChat
 */

// --- Inicialização Assíncrona ---
(async function initializeDependencies() {
  try {
    // Inicializa o cliente OpenAI
    if (botConfig.openai?.apiKey) {
      openaiClient = new OpenAI({
        apiKey: botConfig.openai.apiKey,
        maxRetries: 2,
        timeout: 60000, // (60 segundos) Timeout para chamadas OpenAI
      });
      logger.info("[AI Init] Cliente OpenAI inicializado com sucesso");
    } else {
      logger.error(
        "[AI Init] FALHA: API Key OpenAI (OPENAI_API_KEY) não definida!"
      );
    }
    
    // Inicializa o cliente Gemini
    if (botConfig.gemini?.apiKey) {
      geminiClient = new GoogleGenerativeAI(botConfig.gemini.apiKey);
      logger.info("[AI Init] Cliente Gemini inicializado com sucesso");
    } else {
      logger.error(
        "[AI Init] AVISO: API Key Gemini (GEMINI_API_KEY) não definida!"
      );
    }
    
    // Inicializa o sistema IntelligentRAG
    try {
      intelligentRAG = new IntelligentRAG();
      logger.info("[AI Init] Sistema IntelligentRAG inicializado com sucesso");
    } catch (error) {
      logger.error(
        "[AI Init] ERRO ao inicializar IntelligentRAG:",
        error.message
      );
      intelligentRAG = null;
    }
  } catch (error) {
    logger.error("[AI Init] ERRO durante inicialização:", error);
  }
})(); // Executa a IIFE imediatamente

// Função para obter conhecimento relevante usando IntelligentRAG
function getRelevantKnowledge(
  userMessage,
  currentStage = null,
  contactName = "{contactName}",
  conversationHistory = []
) {
  if (!intelligentRAG) {
    logger.warn(
      "[IntelligentRAG] Sistema não inicializado, retornando conhecimento vazio"
    );
    return "";
  }
  
  try {
    // Sistema RAG inteligente: sempre tenta buscar conhecimento, mas filtra por estágio
    // Se não for uma query de conhecimento, ainda pode retornar contexto geral relevante
    const relevantInfo = intelligentRAG.getRelevantKnowledge(
      userMessage,
      2000,
      currentStage,
      conversationHistory
    );
    
    if (relevantInfo && relevantInfo.trim().length > 0) {
      logger.info(
        `[IntelligentRAG] Conhecimento relevante extraído: ${relevantInfo.length} caracteres (Estágio: ${currentStage})`
      );
    return relevantInfo;
    } else {
      logger.debug(
        `[IntelligentRAG] Nenhum conhecimento relevante encontrado para: "${userMessage}" (Estágio: ${currentStage})`
      );
      return "";
    }
  } catch (error) {
    logger.error(
      "[IntelligentRAG] Erro ao obter conhecimento relevante:",
      error.message
    );
    return "";
  }
}

// A inicialização é feita automaticamente pela IIFE acima

// Função auxiliar para verificar se os clientes estão prontos
function ensureClientsReady() {
  if (!openaiClient && !geminiClient) {
    throw new Error("Nenhum cliente de IA disponível (OpenAI ou Gemini)");
  }
}

// ================================================================
// ===           FUNÇÕES HELPER INTERNAS                       ===
// ================================================================

async function _buildRuntimeContextData(
  state,
  productContextData,
  stepBlueprint,
  userInputText,
  greeting,
  chatIdStr
) {
  // Função para sanitizar nomes (remove quebras de linha e caracteres estranhos)
  const sanitizeName = (name) => {
    if (!name || typeof name !== "string") return name;
    return name
      .replace(/[\r\n\t\v\f]/g, "") // Remove todas as quebras de linha e caracteres de controle
      .replace(/\s+/g, " ") // Substitui múltiplos espaços por um único espaço
      .trim(); // Remove espaços no início e fim
  };
  
  const { identity: botIdentity, behavior } = botConfig;
  const mainProductId =
    productContextData?.product?.id ||
    botConfig.behavior.salesStrategy.targetProductId;

  const activePlans = productContextData?.activePlans || [];
  const recommendedPlan =
    activePlans.find((p) => p.isRecommended) ||
    activePlans.find(
      (p) => p.priceValue !== null && p.billingCycle !== "custom"
    ) ||
    activePlans[0] ||
    {};
  const alternativePlan =
    activePlans.find(
      (p) =>
        !p.isRecommended && p.priceValue !== null && p.billingCycle !== "custom"
    ) || {};

  // Determinar qual link usar baseado na preferência do banco de dados
  const usesSalesPage = state?.metadata?.contextFlags?.usesSalesPageLink || false;
  
  const recommendedCheckoutLink = usesSalesPage 
    ? (recommendedPlan?.salesPage ?? "[LINK_SALESPAGE_N/D]")
    : (recommendedPlan?.checkoutLink ?? "[LINK_CHECKOUT_N/D]");
    
  const alternativeCheckoutLink = usesSalesPage
    ? (alternativePlan?.salesPage ?? "[LINK_SALESPAGE_N/D]")
    : (alternativePlan?.checkoutLink ?? "[LINK_CHECKOUT_N/D]");

  const upsellSummary = productContextData?.upsellOfferSummary || {};
  const crossSellSummary = productContextData?.crossSellOfferSummary || {};
  
  // Obter links de checkout para o produto upsell (configuração personalizada) e sua versão com desconto
  let upsellProductCheckoutLink = "[LINK_CHECKOUT_N/D]";
  let upsellProductDiscountCheckoutLink = "[LINK_CHECKOUT_N/D]";
  
  // Buscar o link real de checkout para o upsell
  if (
    productContextData?.upsellPlans &&
    productContextData.upsellPlans.length > 0
  ) {
    // Procurar o plano principal (sem desconto)
    const upsellMainPlan = productContextData.upsellPlans.find(
      (p) => p.active && !p.id.toLowerCase().includes("discount")
    );
    
    // Procurar o plano com desconto
    const upsellDiscountPlan = productContextData.upsellPlans.find(
      (p) => p.active && p.id.toLowerCase().includes("discount")
    );
    
    if (upsellMainPlan) {
      upsellProductCheckoutLink = usesSalesPage
        ? (upsellMainPlan.salesPage ?? upsellMainPlan.checkoutLink ?? "[LINK_SALESPAGE_N/D]")
        : (upsellMainPlan.checkoutLink ?? "[LINK_CHECKOUT_N/D]");
      logger.debug(
        `[AI Runtime Context] Link ${usesSalesPage ? 'salesPage' : 'checkout'} do upsell encontrado: ${upsellProductCheckoutLink}`,
        state?.id
      );
    }
    
    if (upsellDiscountPlan) {
      upsellProductDiscountCheckoutLink = usesSalesPage
        ? (upsellDiscountPlan.salesPage ?? upsellDiscountPlan.checkoutLink ?? "[LINK_SALESPAGE_N/D]")
        : (upsellDiscountPlan.checkoutLink ?? "[LINK_CHECKOUT_N/D]");
      logger.debug(
        `[AI Runtime Context] Link ${usesSalesPage ? 'salesPage' : 'checkout'} do upsell com desconto encontrado: ${upsellProductDiscountCheckoutLink}`,
        state?.id
      );
    }
  } else if (upsellSummary?.productId) {
    // Alternativa: usar o pricing diretamente
    // pricing já importado no topo do arquivo
    const upsellProduct = pricing.getProductById(upsellSummary.productId);
    
    if (upsellProduct) {
      const upsellMainPlan = upsellProduct.plans?.find(
        (p) => p.active && !p.id.toLowerCase().includes("discount")
      );
      
      const upsellDiscountPlan = upsellProduct.plans?.find(
        (p) => p.active && p.id.toLowerCase().includes("discount")
      );
      
      if (upsellMainPlan) {
      upsellProductCheckoutLink = usesSalesPage
        ? (upsellMainPlan.salesPage ?? upsellMainPlan.checkoutLink ?? "[LINK_SALESPAGE_N/D]")
        : (upsellMainPlan.checkoutLink ?? "[LINK_CHECKOUT_N/D]");
    }
    
    if (upsellDiscountPlan) {
      upsellProductDiscountCheckoutLink = usesSalesPage
        ? (upsellDiscountPlan.salesPage ?? upsellDiscountPlan.checkoutLink ?? "[LINK_SALESPAGE_N/D]")
        : (upsellDiscountPlan.checkoutLink ?? "[LINK_CHECKOUT_N/D]");
    }
    }
  }

  const lastProof = state.lastProofSent || {};
  const mediaAction = stepBlueprint?.mediaAction || {};

  // Recuperar preferência de link do banco de dados
  try {
    const linkPreference = await stateManager.getLinkPreference(chatIdStr);
    if (linkPreference !== null) {
      state.metadata = state.metadata || {};
      state.metadata.contextFlags = state.metadata.contextFlags || {};
      state.metadata.contextFlags.usesSalesPageLink = linkPreference;
      logger.debug(
        `[AI Runtime Context] Preferência de link recuperada do BD: usesSalesPageLink=${linkPreference}`,
        chatIdStr
      );
    }
  } catch (error) {
    logger.error(
      `[AI Runtime Context] Erro ao recuperar preferência de link:`,
      error.message,
      chatIdStr
    );
  }

  // Obter contexto conversacional
  const conversationContext =
    (await stateManager.getConversationContext(chatIdStr)) || {};
  
  // Construir o objeto de contexto final
  const runtimeData = {
    // Dados de Identidade do Bot - Corrigido para acessar corretamente
    "botIdentity.firstName": botIdentity.firstName || "Assistente",
    "botIdentity.fullname":
      botIdentity.fullName || botIdentity.firstName || "Assistente",
    "botIdentity.position": botIdentity.position || "Especialista",
    "botIdentity.company": botIdentity.company || "Empresa",
    "botIdentity.tone": botIdentity.tone || "profissional e amigável",
    "botIdentity.prompt": greeting || botIdentity.prompt || "Olá",
    
    // Adicionar a saudação corretamente para uso nas mensagens
    greeting: greeting || "Olá",
    
    // Dados do Contato/Cliente - MELHORADA: Priorizar nome real do WhatsApp
    // 🔥 MELHORIA: Na etapa NAME_CAPTURE_VALIDATION, usar o nome real do WhatsApp (fullName)
    // Em outras etapas, usar o nome preferido se disponível
    contactName: (() => {
      if (state?.currentFunnelStepId === "NAME_CAPTURE_VALIDATION") {
        // Na etapa de captura de nome, usar o nome REAL do WhatsApp
        const realName = sanitizeName(state?.fullName || state?.name);
        if (realName && !realName.startsWith("Lead-")) {
          return realName;
        }
      }
      // Em outras etapas, usar nome preferido ou primeiro nome
      return (
        sanitizeName(state?.preferredName || state?.name) || "[Nome do Cliente]"
      );
    })(),
    
    // 🔥 NOVO: Primeiro nome extraído automaticamente como fallback
    firstNameFallback: (() => {
      const fullName = sanitizeName(state?.fullName || state?.name);
      if (fullName && !fullName.startsWith("Lead-")) {
        // Extrair apenas o primeiro nome
        const words = fullName.split(' ').filter(word => word.length > 1);
        if (words.length > 0) {
          const firstName = words[0];
          // Capitalizar corretamente
          return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
        }
      }
      return "[Nome]"; // Fallback se não conseguir extrair
    })(),
    
    fullContactName:
      sanitizeName(state?.fullName || state?.name) ||
      "[Nome Completo do Cliente]",
    chatId: state?.id || "[ID do Chat]",
    
    // Informações sobre captura de nome personalizado
    hasPreferredName: state?.preferredName ? "SIM" : "NÃO",
    preferredNameCaptured:
      sanitizeName(state?.preferredName) || "NÃO_CAPTURADO",
    
    // Contexto Conversacional
    "conversationContext.userPainPoints":
      conversationContext.userPainPoints?.join(", ") ||
      "[Nenhum ponto de dor identificado]",

    "conversationContext.communicationStyle":
      conversationContext.communicationStyle || "casual",
    "conversationContext.urgencyLevel":
      conversationContext.urgencyLevel || "medium",
    "conversationContext.previousStepId":
      conversationContext.previousStepId || "[Nenhuma etapa anterior]",
    "conversationContext.informationShared.pricing": conversationContext
      .informationShared?.pricing
      ? "sim"
      : "não",
    "conversationContext.informationShared.benefits": conversationContext
      .informationShared?.benefits
      ? "sim"
      : "não",
    "conversationContext.informationShared.testimonials": conversationContext
      .informationShared?.testimonials
      ? "sim"
      : "não",
    "conversationContext.informationShared.planDetails": conversationContext
      .informationShared?.planDetails
      ? "sim"
      : "não",
    "conversationContext.lastTransitionReason":
      conversationContext.lastTransitionReason || "[Primeira interação]",
    
    // Dados de Produto
    "productInfo.product.id": productContextData?.product?.id || mainProductId,
    "productInfo.product.name":
      productContextData?.product?.name || "[Nome do Produto]",
    "productInfo.product.description":
      productContextData?.product?.description || "[Descrição do Produto]",
    "productInfo.activePlans": activePlans.length.toString(),
    
    // Dados do Plano Recomendado
    "recommendedPlan.id": recommendedPlan?.id || "[ID do Plano]",
    "recommendedPlan.name": recommendedPlan?.name || "[Nome do Plano]",
    "recommendedPlan.mainBenefit":
      recommendedPlan?.mainBenefit || "[Benefício Principal]",
    "recommendedPlan.price": recommendedPlan?.priceFormatted || "[Preço N/D]",
    "recommendedPlan.billingCycle":
      recommendedPlan?.billingCycle || "[Ciclo de Cobrança]",
    
    // Dados do Plano Alternativo
    "alternativePlan.id": alternativePlan?.id || "[ID do Plano Alt]",
    "alternativePlan.name": alternativePlan?.name || "[Nome do Plano Alt]",
    "alternativePlan.mainBenefit":
      alternativePlan?.mainBenefit || "[Benefício Principal Alt]",
    "alternativePlan.price":
      alternativePlan?.priceFormatted || "[Preço Alt N/D]",
    
    // Links de Checkout
    "checkoutLink.recommendedPlan": recommendedCheckoutLink,
    "checkoutLink.alternativePlan": alternativeCheckoutLink,
    "checkoutLink.upsellProduct": upsellProductCheckoutLink,
    "checkoutLink.upsellProductDiscount": upsellProductDiscountCheckoutLink,
    
    // Dados de Upsell (se disponível)
    "upsellOffer.productName":
      upsellSummary?.productName || "[Nome Upsell N/D]",
    "upsellOffer.planName": upsellSummary?.planName || "[Plano Upsell N/D]",
    "upsellOffer.mainBenefit":
      upsellSummary?.mainBenefit || "[Benefício Upsell N/D]",
    "upsellOffer.price": upsellSummary?.price || "[Preço Upsell N/D]",
    
    // Dados de CrossSell (se disponível)
    "crossSellOffer.productName":
      crossSellSummary?.productName || "[Nome CrossSell N/D]",
    "crossSellOffer.planName":
      crossSellSummary?.planName || "[Plano CrossSell N/D]",
    "crossSellOffer.mainBenefit":
      crossSellSummary?.mainBenefit || "[Benefício CrossSell N/D]",
    "crossSellOffer.price": crossSellSummary?.price || "[Preço CrossSell N/D]",
    
    // Suporte
    suporteNumero: process.env.SUPPORT_PHONE || "(11) 99999-9999",
    suporteEmail: process.env.SUPPORT_EMAIL || "suporte@dominio.com.br",
    
    // Outros dados do contexto
    userTimeOfDay: greeting || "Olá",
    
    // Flags de Provas Sociais e Média
    "mediaAction.textBefore": mediaAction.textBefore || "",
    "mediaAction.textAfter": mediaAction.textAfter || "",
    "mediaAction.useAsCaption": String(mediaAction.useAsCaption ?? false),
    "lastProofSent.type": lastProof.type || "[Nenhuma prova enviada]",
    "lastProofSent.filename": lastProof.filename || "[Nenhuma prova enviada]",
    "lastProofSent.success": String(lastProof.success ?? "N/A"),
  };
  return runtimeData;
}

async function _injectRuntimePlaceholders(text, data, chatIdStr = null, userInputText = null) {
  if (!text || typeof text !== "string") return "";

  let processedText = text;

  // Substituir placeholders normalmente
  processedText = processedText.replace(/\{([\w.-]+)\}/g, (match, key) => {
    const value = data[key];
    return value !== null && value !== undefined
      ? String(value)
      : `[${key}? N/D]`;
  });

  return processedText;
}

// ================================================================
// ===           GERAÇÃO DE PROMPT PARA A IA (Principal)        ===
// ================================================================
async function _generatePromptForAIStep(
  effectiveStepId,
  state,
  userInputText,
  transcriptionHasFailed,
  trainingData
) {
  const completedSteps = await stateManager.getAllCompletedSteps(state.id);
  const collectedUserData = await stateManager.getCollectedUserData(state.id);

  let conversationContextPrompt = "\n--- Contexto da Conversa Anterior ---";
  if (completedSteps && completedSteps.length > 0) {
    conversationContextPrompt += "\nEtapas já concluídas (em ordem):";
    completedSteps.forEach((cs) => {
      const stepName =
        salesFunnelBluePrint.getStepById(cs.stepId)?.title || cs.stepId;
      conversationContextPrompt += `\n  - Etapa: ${stepName} (Sucesso: ${cs.wasSuccessful})`;
      if (cs.collectedData && Object.keys(cs.collectedData).length > 0) {
        conversationContextPrompt += ` | Dados Coletados: ${JSON.stringify(
          cs.collectedData
        )}`;
      }
    });
  } else {
    conversationContextPrompt += "\nNenhuma etapa anterior registrada.";
  }

  if (collectedUserData && Object.keys(collectedUserData).length > 0) {
    conversationContextPrompt +=
      "\n Dados consolidados sobre o usuário (coletados até agora):";
    for (const key in collectedUserData) {
      conversationContextPrompt += `\n  - ${key}: ${collectedUserData[key]}`;
    }
  } else {
    conversationContextPrompt += "\nNenhum dado consolidado do usuário ainda.";
  }
  conversationContextPrompt += "\n------------------------------------\n";

  const chatId = state.id;
  // Ensure chatId is a string
  const chatIdStr =
    typeof chatId === "object" && chatId?.chatId
      ? String(chatId.chatId)
      : String(chatId);
  
  const contactName = state.name;
  const greeting = getGreetingTime();
  const { identity: botIdentity } = botConfig;

  if (!salesFunnelBluePrint || !Array.isArray(salesFunnelBluePrint.steps)) {
    logger.fatal(
      `[AI Prompt Gen] CRÍTICO: salesFunnelBluePrint.steps não é um array válido!`,
      chatIdStr
    );
    return {
      messages: [
        {
          role: "system",
          content: `ERRO DE CONFIGURAÇÃO: Entre em contato com o desenvolvedor. Usando resposta de emergência.`,
        },
      ],
      stepBlueprint: {
        id: effectiveStepId || "EMERGENCY_STEP",
        title: "Etapa de Emergência",
        goal: "Informar sobre um problema técnico",
        instructionsForAI: ["Informe sobre um problema técnico temporário."],
      },
    };
  }

  const stepBlueprint = salesFunnelBluePrint.getStepById(effectiveStepId);
  if (!stepBlueprint) {
    logger.fatal(
      `[AI Prompt Gen] CRÍTICO: Blueprint da Etapa ID "${effectiveStepId}" NÃO ENCONTRADO!`,
      chatIdStr
    );
    // Em vez de lançar um erro, retorna uma mensagem de erro para a IA lidar
    return {
      messages: [
        {
          role: "system",
          content: `ERRO DE CONFIGURAÇÃO INTERNO: Blueprint da etapa '${effectiveStepId}' não encontrado. Informe o usuário sobre um problema técnico e peça para tentar mais tarde.`,
        },
        {
          role: "user",
          content: userInputText || "(sem entrada do usuário)",
        },
      ],
      stepBlueprint: {
        id: effectiveStepId || "EMERGENCY_BLUEPRINT_NOT_FOUND",
        title: "Erro de Configuração - Etapa Não Encontrada",
        goal: "Informar sobre um problema técnico interno.",
        instructionsForAI: [
          "Peça desculpas pelo inconveniente.",
          "Informe que houve um problema técnico interno ao processar a solicitação.",
          "Sugira que o usuário tente novamente mais tarde ou entre em contato com o suporte se o problema persistir.",
        ],
      },
    };
  }
  logger.trace(
    `[AI Prompt Gen] Usando blueprint para Etapa: ${stepBlueprint.id} - ${stepBlueprint.title}`,
    chatIdStr
  );

  const runtimeData = await _buildRuntimeContextData(
    state,
    trainingData?.productInfo,
    stepBlueprint,
    userInputText,
    greeting,
    chatIdStr
  );

  // Registro explícito da saudação que será usada no prompt
  logger.debug(
    `[AI Prompt Gen] Usando saudação: "${greeting}" para o usuário ${contactName}`,
    chatIdStr
  );

  let systemPrompt = `!!! VOCÊ É {botIdentity.firstName}, {botIdentity.position} da {botIdentity.company}, especialista em ajudar clientes como {contactName} a superar desafios com [{productInfo.product.name}]. Use o TOM BASE: {botIdentity.tone} (adaptado pela etapa) !!!\n\n`;
  systemPrompt += `OBJETIVO GERAL: Entender profundamente os desafios de {contactName} e demonstrar CLARAMENTE como [{productInfo.product.name}] gera VALOR e resolve esses problemas, guiando-o para a melhor solução.\n\n`;
  systemPrompt += `OBRIGATÓRIO: NÃO ENVIE SAUDAÇÕES COMO: OLÁ, BOM DIA, E ETC, SE NÃO ESTIVER NA ETAPA QUE FALA SOBRE SAUDAÇÃO, SE NÃO TIVER, EM HIPOTESE ALGUMA FAÇA ISSO.\n\n`;
  systemPrompt += `--- REGRAS GLOBAIS INDISPENSÁVEIS ---\n`;
  systemPrompt += `  - **REGRA DE COMPREENSÃO CONTEXTUAL AVANÇADA:** Antes de responder qualquer pergunta, analise PROFUNDAMENTE o contexto e a intenção real por trás da mensagem do usuário. Considere: 1) O que o usuário REALMENTE quer saber (não apenas as palavras superficiais); 2) O histórico da conversa e etapa atual do funil; 3) Possíveis dúvidas implícitas ou preocupações não verbalizadas; 4) O nível de conhecimento técnico demonstrado pelo usuário; 5) Sinais de interesse, objeções ou hesitação nas entrelinhas. NUNCA responda de forma automática ou genérica - sempre contextualize sua resposta considerando TODOS esses fatores para oferecer uma resposta verdadeiramente útil e personalizada.\n`;
  systemPrompt += `  - **REGRA DE CONTROLE DE FLUXO:** Você está no controle do avanço da conversa. Você SÓ avança para a próxima etapa do funil quando incluir APENAS a tag [ACTION: ADVANCE_FUNNEL] como sua resposta completa (sem nenhum texto adicional). Use esta tag apenas quando o objetivo da etapa atual for concluído e o lead estiver pronto para prosseguir. Se o lead fizer perguntas, sua prioridade é respondê-las naturalmente antes de tentar avançar. IMPORTANTE: Quando usar [ACTION: ADVANCE_FUNNEL], NÃO adicione nenhum texto - apenas a tag.\n`;
  systemPrompt += `  - PERSONA: Mantenha {botIdentity.firstName}. Adapte TOM conforme etapa (confiante, consultivo, empático).\n`;
  systemPrompt += `  - COMUNICAÇÃO EFICAZ: Linguagem CLARA, OBJETIVA e PERSUASIVA. Enfatize BENEFÍCIOS CHAVE e PONTOS IMPORTANTES usando palavras IMPACTANTES. **REGRA CRÍTICA DE FORMATAÇÃO: Use %%MSG_BREAK%% OBRIGATORIAMENTE sempre que sua resposta exceder 200 caracteres ou contiver múltiplas ideias**. Divida respostas longas em várias mensagens menores e mais legíveis. Insira a quebra após frases completas, pontos finais, ou ao mudar de assunto. Prefira múltiplas mensagens curtas a uma mensagem longa. Máximo recomendado: 250 caracteres por segmento antes de usar %%MSG_BREAK%%.\n`;
  systemPrompt += `  - FOCO NO CLIENTE E VALOR: Conecte TUDO aos desafios e objetivos de {contactName}. Pergunte para entender MELHOR. Destaque o VALOR e os BENEFÍCIOS do curso.\n`;
  systemPrompt += `  - ${AI_GLOBAL_RULE_NO_INVENTION}\n`;
  systemPrompt += `  - **REGRA DE DETECÇÃO EMOCIONAL:** Detecte sinais de vulnerabilidade: tristeza, desânimo, "vou desistir", "não consigo", "estou perdido", emojis tristes (😔😢😞). QUANDO DETECTAR: Seja empático, NÃO TENTE VENDER nada, diga que o curso não é prioridade agora e que primeiro quer que a pessoa melhore. PORÉM NÃO FALE QUE PODE AJUDAR OU ESCUTAR, APENAS ACONSELHE.\n`;
  systemPrompt += `  - **REGRA CRÍTICA PARA PERGUNTAS FORA DO ESCOPO (Isso serve apenas para perguntas, não serve para quando for falado de problemas pessoais.):** Se o usuário fizer perguntas que NÃO estão relacionadas ao Curso Prática em Direito Sucessório (como "Quem descobriu o Brasil?", perguntas sobre outros assuntos, curiosidades gerais, etc.), você deve SEMPRE responder não siga a mesma estrutura, mas adapte de acordo a etapa, seja educado: "{contactName}, estou aqui para te ajudar especificamente como o Curso Prática em Direito Sucessório pode transformar sua carreira. Para que eu possa te auxiliar de forma mais personalizada, gostaria de saber: [fazer pergunta relevante da etapa atual]". **IMPORTANTE: Perguntas SOBRE O CURSO (preço, conteúdo, duração, formato, garantia, etc.) DEVEM SER RESPONDIDAS normalmente usando o conhecimento disponível. Esta regra se aplica APENAS a perguntas completamente fora do contexto do curso.**\n`;
    systemPrompt += `  - EVITE SAUDAÇÕES REPETIDAS (APÓS A PRIMEIRA INTERAÇÃO): Após a saudação inicial do bot (especialmente em etapas como GREETING_QUALIFICATION_DIRECT), NUNCA comece suas respostas subsequentes com "Bom dia", "Boa tarde", "Boa noite" ou qualquer saudação formal. Vá direto ao ponto, respondendo à pergunta ou continuando a conversa de forma natural, MESMO QUE O CONTEXTO DA CONVERSA PAREÇA TER MUDADO OU QUE A SAUDAÇÃO NÃO ESTEJA MAIS NO HISTÓRICO VISÍVEL.\n`;
  systemPrompt += `  - PROIBIDO INVENTAR OFERTAS: NUNCA mencione bônus, descontos, brindes, ou ofertas extras que não estejam EXPLICITAMENTE definidos no contexto fornecido. Não crie promoções como "bônus para novos clientes", "desconto por tempo limitado" ou "acesso VIP gratuito" a menos que estejam detalhados nas seções de produto e planos acima. ATENÇÃO ESPECIAL: Não invente "Bônus especial para primeiros compradores", "Bônus de boas-vindas", "Bônus de inscrição", ou qualquer bônus que não esteja explicitamente listado nas informações fornecidas. Se não existe informação sobre bônus na seção de produto ou planos, é porque NÃO EXISTE NENHUM BÔNUS a ser oferecido.\n`;
  systemPrompt += `  - PROIBIDO INVENTAR FUNCIONALIDADES OU INFORMAÇÕES: NUNCA mencione recursos, ferramentas, serviços, processos, garantias ou características que não estejam EXPLICITAMENTE definidos nas informações do produto. Não invente integrações, suporte 24/7, prazos de entrega, períodos de teste gratuito, compromissos de serviço, ou qualquer detalhe que não esteja claramente documentado. ATENÇÃO ESPECIAL: APENAS ofereça o que está listado nas informações do produto, NUNCA amplie ou modifique os recursos/benefícios para torná-los mais atraentes. SEMPRE mantenha-se fiel à realidade do que é efetivamente oferecido.\n`;
  systemPrompt += `  - TAGS PERMITIDAS: Use a tag **[ACTION: ADVANCE_FUNNEL]** SOMENTE quando concluir o objetivo da etapa atual e o lead estiver pronto para avançar - **CRÍTICO: quando usar [ACTION: ADVANCE_FUNNEL] ou [ACTION: SKIP_SOCIAL_PROOF], responda APENAS com a tag, ZERO texto adicional**. Também é permitida a tag [ACTION: CONTINUE_FUNNEL] QUANDO especificamente instruído. NUNCA use outras tags internas.\n`;
  systemPrompt += `  - PROIBIDO FORMATAÇÃO MARKDOWN: Não use \`**asteriscos**\`, \`*asteriscos*\`, \`_sublinhados_\` ou qualquer outra formatação Markdown. Enfatize usando clareza e escolha de palavras.\n`;
  systemPrompt += `  - PROIBIDO PLACEHOLDERS GENÉRICOS: Não invente nomes como '[Cliente Exemplo]'. Se não tiver um exemplo real específico do contexto, descreva os resultados de forma genérica (Ex: 'Muitos clientes relatam...').\n`;
  systemPrompt += `  - SÓ FALA DO BOT: Responda APENAS o que {botIdentity.firstName} diria. Sem meta-comentários.\n`;
  systemPrompt += `  - Bem de vez em quando, você pode usar emojis para expressar emoções, mas não abuse. Use apenas quando for natural e relevante para a conversa.\n`;
  systemPrompt += `  - PONTUAÇÃO APÓS NOME: Sempre use vírgula (,) após mencionar o nome do cliente (Ex: 'Entendido, {contactName}, ...'). NUNCA use exclamação após o nome, especialmente no início das frases. CORRETO: "{contactName}, gostaria de..." / INCORRETO: "{contactName}! Gostaria de...". Use tom educado e profissional, evitando exclamações excessivas.\n`;

  // systemPrompt += `  - SAUDAÇÃO INICIAL (GREETING_QUALIFICATION_DIRECT): **OBRIGATÓRIO PARA A PRIMEIRA MENSAGEM DO BOT NESTA ETAPA**: Comece EXATAMENTE com: "{greeting}, {contactName}. Aqui é o {botIdentity.firstName} da {botIdentity.company}. Irei te auxiliar por aqui. Me diz aqui, hoje você já atua com Direito Sucessório ou pretende iniciar?". Não adicione "tudo bem?" ou outras variações A MENOS que a instrução da etapa ESPECÍFICA peça. Para OUTRAS ETAPAS ou respostas subsequentes, siga a regra 'EVITE SAUDAÇÕES REPETIDAS'.\n`;

  // REMOVIDO: Lógica anti-humana de detecção de repetição
  // A lógica anterior forçava mudança de abordagem após 4 mensagens, o que não é natural
  // Pessoas podem e devem poder fazer perguntas similares ou esclarecer dúvidas naturalmente
  
  if (transcriptionHasFailed) {
    systemPrompt += `  - **ALERTA TRANSCRIÇÃO:** Áudio anterior falhou. Peça GENTILMENTE para repetir por texto ANTES de prosseguir.\n`;
  }

  systemPrompt += conversationContextPrompt; // Adiciona o contexto da conversa ANTES do contexto runtime

  // === SEÇÃO DE CONHECIMENTO BASE INTELIGENTE (IntelligentRAG) ===
  // Sistema RAG Avançado com contexto rico e filtros inteligentes
  // NOVA ESTRATÉGIA: Conhecimento liberado em TODAS as etapas, exceto informações de PREÇO antes da apresentação
  let relevantKnowledge = "";
  
  // Sempre tentar obter conhecimento relevante - o filtro de preço é feito internamente
  // Obter histórico de conversas para análise de pedidos anteriores de provas sociais
  const conversationHistory = state?.history || [];
  relevantKnowledge = getRelevantKnowledge(
    userInputText || "",
    effectiveStepId,
    runtimeData.contactName || "{contactName}",
    conversationHistory
  );
  
  // Aplicar substituição de placeholders ao conteúdo do RAG antes de injetar no prompt
  if (relevantKnowledge && relevantKnowledge.trim().length > 0) {
    const processedRelevantKnowledge = await _injectRuntimePlaceholders(
      relevantKnowledge,
      runtimeData,
      chatIdStr,
      userInputText
    );
    
    systemPrompt += `\n=== CONHECIMENTO ESPECIALIZADO DO CURSO DPA ===\n`;
    systemPrompt += `📚 CONTEXTO RELEVANTE: As informações abaixo são específicas e relevantes para a consulta atual do cliente:\n\n`;
    systemPrompt += processedRelevantKnowledge;
    systemPrompt += `\n\n=== FIM DO CONHECIMENTO ESPECIALIZADO ===\n`;
    systemPrompt += `🎯 INSTRUÇÕES DE USO DO CONHECIMENTO:\n`;
    systemPrompt += `• Use PRIORITARIAMENTE as informações acima para responder perguntas específicas sobre o curso\n`;
    systemPrompt += `• Se a informação não estiver presente acima, seja honesto e informe que pode ajudar com outras questões\n`;
    systemPrompt += `• NUNCA invente informações que não estejam no conhecimento fornecido\n`;
    systemPrompt += `• Utilize o conhecimento para enriquecer suas respostas com detalhes técnicos e contexto\n`;
    systemPrompt += `• Faça referências naturais ao conteúdo quando relevante para a conversa\n`;
    systemPrompt += `• 🎯 ESPECIAL PROVAS SOCIAIS: Se o conhecimento acima contém depoimentos, links do YouTube ou informações sobre resultados de alunos, USE ESSAS INFORMAÇÕES para responder consultas sobre provas sociais, depoimentos ou resultados\n`;
    systemPrompt += `• ❌ NUNCA responda "não tenho" ou "não há" quando há informações específicas no conhecimento fornecido acima\n\n`;
  } else {
    // Mesmo sem conhecimento específico, fornecer orientação
    systemPrompt += `\n=== ORIENTAÇÃO CONTEXTUAL ===\n`;
    systemPrompt += `💡 FOQUE EM: Manter a conversa no objetivo da etapa atual (${stepBlueprint.title})\n`;
    systemPrompt += `🎯 Se o cliente fizer perguntas específicas sobre o curso, seja transparente sobre buscar as informações corretas\n\n`;
  }

  systemPrompt += `\n--- CONTEXTO ATUAL (RUNTIME) ---
`;
  systemPrompt += `Cliente: {contactName}\n`;
  systemPrompt += `Saudação Atual: {greeting}\n`;
  systemPrompt += `Produto Principal: {productInfo.product.name}\n`;

  const stagesWherePlanContextIsRelevant = [
    "SOLUTION_PRESENTATION",
    "PLAN_OFFER",
    "CLOSE_DEAL",
    
    // "POST_PURCHASE_FOLLOWUP" // Talvez para confirmar o plano comprado, mas menos provável
  ];

  if (stagesWherePlanContextIsRelevant.includes(effectiveStepId)) {
    systemPrompt += `   - Recomendado: {recommendedPlan.name} ({recommendedPlan.price})\n`;
    if (runtimeData["alternativePlan.id"] !== "N/A") {
      systemPrompt += `   - Alternativa: {alternativePlan.name} ({alternativePlan.price})\n`;
    }
    // Adiciona alerta explícito sobre bônus QUANDO os planos são mencionados
    systemPrompt += `\n** IMPORTANTE: Os planos e preços acima são EXATAMENTE o que deve ser oferecido. NÃO INVENTE bônus adicionais, descontos, ou quaisquer ofertas especiais para "novos clientes" ou "primeiros compradores" que não estejam explicitamente listados acima. **\n`;
  } else {
    // Adiciona alerta explícito sobre bônus mesmo que os planos não sejam mencionados,
    // para reforçar a regra globalmente.
     systemPrompt += `\n** IMPORTANTE: NÃO INVENTE bônus, descontos, ou quaisquer ofertas especiais para "novos clientes" ou "primeiros compradores" que não estejam explicitamente listados nas informações do produto/planos. Se não houver informação sobre bônus, é porque NÃO EXISTE NENHUM BÔNUS a ser oferecido. **\n`;
  }

  if (runtimeData["upsellProduct.id"] !== "N/A")
    systemPrompt += `   - Upsell: {upsellProduct.name} ({upsellProduct.priceFormatted})\n`;
  if (runtimeData["crossSellProduct.id"] !== "N/A")
    systemPrompt += `   - Cross-Sell: {crossSellProduct.name} ({crossSellProduct.priceFormatted})\n`;

  if (runtimeData["lastProofSent.filename"] !== "[Nenhuma prova enviada]")
    systemPrompt += `Última Prova: {lastProofSent.type}: {lastProofSent.filename} (Sucesso: {lastProofSent.success})\n`;
  const inputPreview =
    userInputText && userInputText.length > 300
      ? userInputText.substring(0, 297) + "..."
      : userInputText || "[Sem entrada recente]";
  systemPrompt += `Última Mensagem de {contactName}: "${inputPreview}"\n`;

  // Adicionar informações de intenção detectada ao prompt
  if (state.userIntent && state.userIntent.intent) {
    systemPrompt += `Intenção Detectada do Usuário: ${state.userIntent.intent} (Confiança: ${state.userIntent.confidence}%)\n`;
    if (state.userIntent.details) {
      systemPrompt += `Detalhes da Intenção: ${JSON.stringify(
        state.userIntent.details
      )}\n`;
    }
  }

  systemPrompt += `\n===> SUA MISSÃO AGORA (Etapa: ${stepBlueprint.title} [${stepBlueprint.id}]) <===\n`;
  systemPrompt += `    OBJETIVO DESTA ETAPA: ${stepBlueprint.goal}\n`;
  systemPrompt += `\n    == DIRETRIZES ESPECÍFICAS DA ETAPA (Execute AGORA): ==\n`;

  let finalInstructions = [
    ...(stepBlueprint.instructionsForAI || ["Aja conforme o objetivo."]),
  ];

  // 🔥 SUBSTITUIR {tag_link} NAS INSTRUÇÕES ANTES DE ENVIAR PARA A IA
  finalInstructions = await Promise.all(
    finalInstructions.map(async (instr) => {
      if (instr.includes('{tag_link}')) {
        // Obter contador de provas sociais
        const proofRequestCount = await stateManager.getProofRequestCount(chatIdStr);

        // Decidir qual link usar
        let linkToUse;
        if (proofRequestCount > 1) {
          linkToUse = pricing.getSalesPageLink();
          logger.info(
            `[AI Prompt] Substituindo {tag_link} por SALES PAGE (contador=${proofRequestCount})`,
            chatIdStr
          );
        } else {
          linkToUse = pricing.getCheckoutLinkDirect();
          logger.info(
            `[AI Prompt] Substituindo {tag_link} por CHECKOUT (contador=${proofRequestCount})`,
            chatIdStr
          );
        }

        return instr.replace(/{tag_link}/g, linkToUse);
      }
      return instr;
    })
  );

  systemPrompt += finalInstructions.map((instr) => `    ${instr}`).join("\n");

    const nextStepId = stepBlueprint.nextStepDefault;
    const nextStep =
      nextStepId && nextStepId !== effectiveStepId
        ? salesFunnelBluePrint.getStepById(nextStepId)
        : null;
    if (nextStep) {
      systemPrompt += `\n\n    ==> PREPARAÇÃO P/ PRÓXIMA ETAPA (${nextStep.title} [${nextStep.id}]): Guie {contactName} SUAVEMENTE para "${nextStep.goal}".\n`;
  }

  systemPrompt += `\n\n--- Fim das Instruções da Etapa ---\n`;
  // Verificar se é processamento automático (sem input do usuário)
  const isAutomaticProcessing = !userInputText || userInputText.trim() === "";
  
  if (isAutomaticProcessing && effectiveStepId === "PLAN_OFFER") {
    systemPrompt += `\n🤖 **PROCESSAMENTO AUTOMÁTICO DETECTADO - PLAN_OFFER:** 
Você está sendo chamado automaticamente (sem mensagem do usuário). 
APRESENTE A OFERTA COMPLETA seguindo EXATAMENTE a estrutura das instruções.
NÃO use nenhuma tag de ação ([ACTION: ADVANCE_FUNNEL], etc.).
AGUARDE a resposta do usuário após apresentar a oferta.`;
  }

  // Verificar se há contexto de mais provas sociais após tag
  if (state.metadata?.contextFlags?.isRequestingMoreProofsAfterTag) {
    systemPrompt += `\n\n🎯 **CONTEXTO ESPECIAL DETECTADO - MAIS PROVAS SOCIAIS:**
O usuário está pedindo mais provas sociais APÓS já ter recebido provas anteriormente.
Você deve:
1. Responder de forma natural e humanizada ao pedido
2. Mencionar que há mais informações e casos disponíveis
3. Manter o tom conversacional e não robótico
4. NÃO usar mensagens prontas ou constantes
5. Mais para frente você vai enviar o nosso site, lá tem mais provas sociais

Exemplo de resposta: "Claro! Tenho mais casos de sucesso para te mostrar. Mais para frente eu vou te enviar o nosso site, lá tem mais provas sociais e casos reais de pessoas que conseguiram resultados excelentes. [Aqui você coloca uma pergunta para retornar ao funil, de acordo a etapa atual]?"
`;
  }

  systemPrompt += `\nLEMBRETE FINAL: Você é {botIdentity.firstName}. Siga as diretrizes da etapa. FOQUE NO VALOR para {contactName}. Enfatize com PALAVRAS IMPACTANTES. Gere APENAS a resposta (use %%MSG_BREAK%% se necessário). 

🚨 **REGRAS GLOBAIS ANTI-REPETIÇÃO (PRIORIDADE MÁXIMA SOBRE QUALQUER CONHECIMENTO):**

**REGRA 1 - ANTI-REPETIÇÃO GERAL:**
Se você já apresentou informações detalhadas e o usuário faz uma pergunta específica:
1. Responda APENAS à pergunta específica
2. NÃO repita informações já fornecidas anteriormente
3. Use transição curta para manter o fluxo da etapa
4. ESTA REGRA TEM PRIORIDADE ABSOLUTA SOBRE QUALQUER CONHECIMENTO FORNECIDO

**REGRA CRÍTICA DE AVANÇO:** 
- Se concluir o objetivo da etapa e o lead estiver pronto, responda APENAS com [ACTION: ADVANCE_FUNNEL] (sem nenhum texto adicional). 
- Se instruído a adicionar a tag [ACTION: CONTINUE_FUNNEL], coloque-a EXATAMENTE no final.
- **ATENÇÃO ESPECIAL SOLUTION_PRESENTATION (CRÍTICO):** 
  * ✅ ACEITA PROVAS: "sim", "pode", "vamos", "ok", "quero ver" → APENAS [ACTION: ADVANCE_FUNNEL]
  * ❌ RECUSA PROVAS: "não", "nao", "agora não", "depois", "obrigado" (sem sim) → APENAS [ACTION: SKIP_SOCIAL_PROOF]
  * 🎯 DETECÇÃO AUTOMÁTICA: Se contém "não" OU "obrigado" sem confirmação positiva = [ACTION: SKIP_SOCIAL_PROOF]
  * 📝 EXEMPLOS REAIS:
    - "Não" → [ACTION: SKIP_SOCIAL_PROOF]
    - "Não, obrigado" → [ACTION: SKIP_SOCIAL_PROOF]
    - "agora não posso" → [ACTION: SKIP_SOCIAL_PROOF]
    - "Sim, quero ver" → [ACTION: ADVANCE_FUNNEL]
  * 🚫 JAMAIS: Não tente convencer após recusa. RECUSA = TAG APENAS!

🚨 **REGRA ABSOLUTA SOBRE TAGS DE AÇÃO** 🚨
QUANDO USAR [ACTION: ADVANCE_FUNNEL] ou [ACTION: SKIP_SOCIAL_PROOF]:
- SUA RESPOSTA DEVE CONTER **APENAS A TAG**
- **ZERO TEXTO ANTES DA TAG**
- **ZERO TEXTO DEPOIS DA TAG**
- **ZERO EXPLICAÇÕES**
- **ZERO COMENTÁRIOS**
- **APENAS A TAG E MAIS NADA**
Exemplo CORRETO: [ACTION: ADVANCE_FUNNEL]
Exemplo ERRADO: Entendi! [ACTION: ADVANCE_FUNNEL]

RESPONDA AGORA.`;

  const finalSystemPrompt = await _injectRuntimePlaceholders(
    systemPrompt,
    runtimeData,
    chatIdStr,
    userInputText
  );
  logger.trace("[AI Prompt Gen] Final System Prompt:", chatIdStr, {
    promptLength: finalSystemPrompt.length,
    firstChars: finalSystemPrompt.substring(0, 250),
  });
  logger.info(
    `[AI Prompt Gen] Prompt Sistema final gerado para ${stepBlueprint.id} (${finalSystemPrompt.length} chars).`,
    chatIdStr
  );

  const historyForAI = getFormattedHistoryForAI(state, MAX_HISTORY_MESSAGES_AI);
  const messages = [
    { role: "system", content: finalSystemPrompt },
    ...historyForAI,
    ...(userInputText && userInputText.trim()
      ? [{ role: "user", content: userInputText.trim() }]
      : []),
  ];

  // ADDING DIAGNOSTIC LOGGING HERE
  const localChatIdStr =
    typeof state.id === "object" && state.id?.chatId
      ? String(state.id.chatId)
      : String(state.id);
  logger.debug(
    `[AI Prompt Gen DEBUG] Final messages array for AI call: IsArray=${Array.isArray(
      messages
    )}, Length=${messages?.length}, Roles=${messages
      ?.map((m) => m?.role)
      .join(",")}`,
    localChatIdStr
  );
  if (messages && messages.length > 0) {
    logger.trace(
      "[AI Prompt Gen DEBUG] First message (system) content length:",
      localChatIdStr,
      messages[0]?.content?.length
    );
    if (messages.length > 1 && messages[messages.length - 1]?.role === "user") {
      logger.trace(
        "[AI Prompt Gen DEBUG] Last message (user) content:",
        localChatIdStr,
        messages[messages.length - 1]?.content
      );
    }
  }
  // END OF DIAGNOSTIC LOGGING

  return { messages, stepBlueprint };
}

// ================================================================
// ===                   EXECUÇÃO DA CHAMADA IA (Principal)     ===
// ================================================================
async function _executeAICall(messages, chatId, customMaxTokens = null) {
  // Ensure chatId is a string
  const chatIdStr =
    typeof chatId === "object" && chatId?.chatId
      ? String(chatId.chatId)
      : String(chatId);
  
  // Determina qual provedor de IA usar
  const primaryProvider = botConfig.ai?.primaryProvider || "openai";
  
  // Verificação de disponibilidade de clientes
  if (primaryProvider === "gemini" && !geminiClient) {
    const errorMsg = "[AI Call] Abortado: Cliente Gemini não configurado.";
    logger.error(errorMsg, null, chatIdStr);
    return {
      responseText: null,
      finishReason: "client_unavailable",
      usage: null,
      modelUsed: botConfig.gemini.model || "unknown_model",
      responseId: null,
      errorType: "client_unavailable",
    };
  } else if (primaryProvider === "openai" && !openaiClient) {
    const errorMsg = "[AI Call] Abortado: Cliente OpenAI não configurado.";
    logger.error(errorMsg, null, chatIdStr);
    return {
      responseText: null,
      finishReason: "client_unavailable",
      usage: null,
      modelUsed: botConfig.openai.model || "unknown_model",
      responseId: null,
      errorType: "client_unavailable",
    };
  }

  // Configuração baseada no provedor
  const isGemini = primaryProvider === "gemini";
  const chatModel = isGemini ? botConfig.gemini.model : botConfig.openai.model;
  const temperature = isGemini
    ? botConfig.gemini.temperature
    : botConfig.openai.temperature;
  // ✅ NOVO: Usa customMaxTokens se fornecido, senão usa o valor padrão do provedor
  const maxTokens = customMaxTokens || (isGemini
    ? botConfig.gemini.maxTokens
    : botConfig.openai.maxTokens);
  
  let responseText = null,
    finishReason = "error",
    usage = null,
    modelUsed = chatModel,
    responseId = null,
    errorType = null;

  // Verifica se messages é um array e tem elementos
  if (!Array.isArray(messages) || messages.length === 0) {
    logger.error(
      "[AI Call] Abortado: Parâmetro 'messages' inválido ou vazio.",
      null,
      chatIdStr
    );
    return {
      responseText: null,
      finishReason: "invalid_input",
      usage: null,
      modelUsed: chatModel,
      responseId: null,
      errorType: "invalid_input",
    };
  }

  try {
    const logMsg = `>>> Chamando ${primaryProvider} (${chatModel})... (Msg Count: ${messages.length})`;
    if (typeof logger.ai === "function") logger.ai(logMsg, chatIdStr);
    else logger.debug(`[AI Call] ${logMsg}`, chatIdStr);

    if (isGemini) {
      // Chamada para a API do Gemini
      const model = geminiClient.getGenerativeModel({ model: chatModel });
      
      // Ajuste para o formato do Gemini
      // Tratamos o sistema como contexto na primeira mensagem do histórico
      const history = [];
      let systemContent = "";
      
      // Extraímos o conteúdo do prompt do sistema
      if (messages.length > 0 && messages[0].role === "system") {
        systemContent = messages[0].content;
      }
      
      // Adicionamos o histórico de mensagens (excluindo o sistema)
      messages.slice(1).forEach((msg) => {
        if (msg.role === "user" || msg.role === "assistant") {
          history.push({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          });
        }
      });
      
      // Configuração da chamada
      const genConfig = {
        temperature: temperature,
        maxOutputTokens: maxTokens || undefined,
      };
      
      // Obtém a última mensagem do usuário ou cria uma mensagem base
      const lastUserMessage =
        messages.length > 0 && messages[messages.length - 1].role === "user"
        ? messages[messages.length - 1].content
        : "Por favor, continue com base no contexto anterior.";
      
      try {
        // Cria uma resposta Gemini com todo o contexto
        const result = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `INSTRUÇÕES DO SISTEMA:\n${systemContent}\n\nCONVERSA ANTERIOR:\n${history
                    .map(
                      (msg) =>
                        `${msg.role === "model" ? "Assistente" : "Usuário"}: ${
                          msg.parts[0].text
                        }`
                    )
                    .join("\n")}\n\nUSUÁRIO ATUAL: ${lastUserMessage}`,
                },
              ],
            },
          ],
          generationConfig: genConfig,
          safetySettings: [
            {
              category: "HARM_CATEGORY_HARASSMENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_HATE_SPEECH",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        });
        
        responseText = result.response?.text()?.trim() || null;
        finishReason = "stop"; // Gemini não fornece finish_reason como a OpenAI
        usage = {
          completion_tokens: responseText
            ? Math.ceil(responseText.length / 4)
            : 0,
          prompt_tokens: Math.ceil(
            (systemContent.length + JSON.stringify(history).length) / 4
          ),
          total_tokens: 0,
        };
        usage.total_tokens = usage.completion_tokens + usage.prompt_tokens;
        modelUsed = chatModel;
        responseId = new Date().toISOString();
      } catch (geminiError) {
        // Se houver erro, vamos registrá-lo e relançar para que seja tratado pelo bloco catch externo
        logger.error(
          `[AI Call] Erro específico do Gemini: ${geminiError.message}`,
          serializeError(geminiError),
          chatIdStr
        );
        throw geminiError;
      }
    } else {
      // Chamada para a API da OpenAI (código existente)
      const completion = await openaiClient.chat.completions.create({
        model: chatModel,
        messages: messages,
        temperature: temperature,
        max_tokens: maxTokens || undefined,
      });

      const choice = completion.choices?.[0];
      responseText = choice?.message?.content?.trim() || null;
      finishReason = choice?.finish_reason || "unknown";
      usage = completion.usage || null;
      modelUsed = completion.model || chatModel;
      responseId = completion.id || null;
    }

    // Log da resposta (comum para ambos os provedores)
    const respLogMsg = `<<< Resposta ${primaryProvider} (${modelUsed}) | Finish: ${finishReason} | Tokens: ${
      usage?.completion_tokens ?? "?"
    }r/${usage?.prompt_tokens ?? "?"}p=${usage?.total_tokens ?? "?"}t`;

    if (typeof logger.ai === "function") logger.ai(respLogMsg, chatIdStr);
    else logger.debug(`[AI Call] ${respLogMsg}`, chatIdStr);

    if (finishReason === "length") {
      logger.warn(
        `[AI Call] Resposta da IA CORTADA (max_tokens ${
          maxTokens || "default"
        } atingido).`,
        chatIdStr
      );
      await stateManager.addMessageToHistory(
        chatIdStr,
        "system",
        "[Sistema: Resposta IA truncada (max_tokens)]"
      );
    } else if (finishReason !== "stop" && finishReason !== "tool_calls") {
      logger.warn(
        `[AI Call] Finalização da IA inesperada: ${finishReason}.`,
        chatIdStr,
        { id: responseId }
      );
    }
  } catch (error) {
    logger.error(
      `[AI Call] Erro ao chamar API da IA (${primaryProvider}:${chatModel})`,
      serializeError(error),
      chatIdStr
    );
    
    // Classificação de erro específica para cada provedor
    if (isGemini) {
      // Classificação de erro para Gemini
      errorType = "gemini_api_error";
      
      // Melhor classificação se possível baseado na mensagem de erro
      const errorMsg = error.message || "";
      if (errorMsg.includes("API key")) {
        errorType = "invalid_api_key";
      } else if (errorMsg.includes("rate") || errorMsg.includes("quota")) {
        errorType = "rate_limit_exceeded";
      } else if (errorMsg.includes("content") && errorMsg.includes("safety")) {
        errorType = "content_filtered";
      }
    } else if (error instanceof OpenAI.APIError) {
      // Classificação de erro aprimorada para OpenAI SDK
      errorType = `openai_api_error_${error.status || "unknown"}`;
      if (error.code) errorType += `_code_${error.code}`;

      switch (error.status) {
        case 401:
          errorType = "invalid_api_key";
          break;
        case 429:
          errorType = "rate_limit_exceeded";
          break;
      }
      if (error.code === "context_length_exceeded") {
        errorType = "context_length_exceeded";
      }
    } else {
      errorType = error.code || "generic_client_error";
    }

    logger.warn(`[AI Call] Tipo de erro detectado: ${errorType}`, chatIdStr);
    if (errorType === "context_length_exceeded") {
      logger.error(
        `[AI Call] ERRO: Limite de contexto da IA excedido. Histórico/Prompt muito longo (MAX_HISTORY_AI=${MAX_HISTORY_MESSAGES_AI}).`,
        chatIdStr
      );
      await stateManager.addMessageToHistory(
        chatIdStr,
        "system",
        "[Sistema: Erro IA - Limite de contexto excedido]"
      );
    } else if (errorType === "invalid_api_key") {
      logger.fatal(
        `[AI Call] ERRO CRÍTICO: API Key ${primaryProvider} inválida/não autorizada! Verifique credenciais.`,
        null,
        chatIdStr
      );
    } else if (errorType === "content_filtered") {
      logger.warn(
        `[AI Call] Conteúdo bloqueado pelos filtros de segurança do Gemini.`,
        chatIdStr
      );
      await stateManager.addMessageToHistory(
        chatIdStr,
        "system",
        "[Sistema: Conteúdo bloqueado pelos filtros de segurança]"
      );
    }
    finishReason = errorType; // Em caso de erro, finishReason reflete o tipo de erro
  }

  return {
    responseText,
    finishReason,
    usage,
    modelUsed,
    responseId,
    errorType,
  };
}

/**
 * Executa uma chamada à IA para validar se uma mensagem é uma objeção/dúvida legítima.
 * Esta função usa o mesmo provedor de IA configurado (OpenAI ou Gemini) mas com 
 * configurações otimizadas para esta tarefa específica.
 * 
 * @param {Array<object>} messages - Array de mensagens no formato esperado pela IA
 * @param {string} chatId - ID do chat
 * @returns {Promise<{responseText: string, finishReason: string}>} - Resposta da IA
 */

// ================================================================
// ===                LIMPEZA DA RESPOSTA DA IA                 ===
// ================================================================
function _cleanAiResponse(rawText, contactName = "cliente") {
  if (!rawText || typeof rawText !== "string") return "";
  let text = rawText.trim();

  // 🔥 CORREÇÃO CRÍTICA: Preservamos TODAS as tags de ação importantes
  const hasSocialProofTag = /\[SEND_SOCIAL_PROOF\]/i.test(text);
  const hasAdvanceFunnelTag = /\[ACTION:\s*ADVANCE_FUNNEL\]/i.test(text);
  const hasSkipSocialProofTag = /\[ACTION:\s*SKIP_SOCIAL_PROOF\]/i.test(text);
  const hasContinueFunnelTag = /\[ACTION:\s*CONTINUE_FUNNEL\]/i.test(text);
  
  // Remove apenas tags de envio antigas (não as novas tags de ação)
  text = text.replace(/\[SEND_PROOF:\s*.*?\]/gi, ""); // Remove tags de envio antigas
  
  // Preserva as tags de social proof se existirem
  if (!hasSocialProofTag) {
    text = text.replace(/\[SEND_SOCIAL_PROOF\]/gi, "");
  }
  
  // Removido: SEND_SOCIAL_PROOF_DIREITO_SUCCESSORIO não é mais usado
  
  // 🔥 NOVO: Preserva TODAS as tags de ação importantes
  // NÃO removemos essas tags pois elas são cruciais para o controle de fluxo
  
  // SANITIZAÇÃO RIGOROSA DO NOME DO CONTATO
  // Remove quebras de linha, caracteres de controle e espaços extras do nome
  let sanitizedContactName = contactName;
  if (contactName && typeof contactName === "string") {
    sanitizedContactName = contactName
      .replace(/[\r\n\t\v\f]/g, "") // Remove todas as quebras de linha e caracteres de controle
      .replace(/\s+/g, " ") // Substitui múltiplos espaços por um único espaço
      .trim(); // Remove espaços no início e fim
  }
  
  text = text.replace(
    /\{contactName\}|\{\{contactName\}\}|{cliente}|{nome_cliente}/gi,
    sanitizedContactName
  );
  text = text.replace(
    /\{(?:botIdentity|recommendedPlan|alternativePlan|upsellProduct|crossSellProduct|mediaAction|lastProofSent|userInput|greeting|suporteNumero)\.?[\w-]+\}/gi,
    "[info]"
  );
  text = text
    .split("%%MSG_BREAK%%")
    .map((part) =>
      part
        .replace(/\s{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/ +\n/g, "\n")
        .replace(/\n +/g, "\n")
        .trim()
    )
    .join("%%MSG_BREAK%%");
  text = text.replace(/\[(https?:\/\/[^\s\]]+)\]\(\1\)/g, "$1");
  return text.trim();
}

// ================================================================
// ===          ORQUESTRADOR PRINCIPAL (Chamado por messageHandler) ===
// ================================================================
/**
 * @param {WAChat | null} chat - Objeto chat do wweb.js.
 * @param {string} chatId - ID do chat.
 * @param {ChatState} state - Objeto de estado atual do chat.
 * @param {string | null} userInputText - Texto combinado da entrada do usuário.
 * @param {boolean} transcriptionHasFailed - Flag de falha na transcrição do último áudio.
 * @param {object} trainingData - Dados de treinamento carregados.
 * @param {string} effectiveStepId - A etapa REAL a ser processada.
 */
async function callAndRespondWithAI(
  chat,
  chatId,
  initialState,
  userInputText,
  transcriptionHasFailed,
  trainingData,
  effectiveStepId
) {
  const chatIdStr =
    typeof chatId === "object" && chatId?.chatId
      ? String(chatId.chatId)
      : String(chatId);
  
  // 🔥 CORREÇÃO: Declarar a variável no escopo da função para evitar redeclaração.
  let cleanedResponse = "";

  try {
    // ================================================================
    // ===          PROCESSAMENTO ESPECIAL DE NOME PERSONALIZADO   ===
    // ================================================================
    
    // Processa captura de nome personalizado se estiver na etapa apropriada
    const nameCapture = await _processNameCapture(
      chatIdStr,
      initialState,
      userInputText
    );
    if (!nameCapture.shouldContinue) {
      return; // Se o processamento de nome determinou que devemos parar aqui
    }
    
    // Se capturou um nome, recarrega o estado para ter os dados atualizados
    let state = initialState;
    if (nameCapture.nameData) {
      state = await stateManager.getChatState(chatIdStr);
      if (!state) {
        logger.error(
          `[AI Processor] Falha ao recarregar estado após captura de nome para ${chatIdStr}`,
          chatIdStr
        );
        state = initialState; // Fallback para o estado inicial
      } else {
        logger.debug(
          `[AI Processor] Estado recarregado após captura de nome personalizado: "${nameCapture.nameData.preferredName}"`,
          chatIdStr
        );
      }
    }
    
    // ================================================================
    
    // Etapa 2: Reconhecimento de Intenção
    if (userInputText && botConfig.features.advancedIntentDetection) {
      try {
        logger.debug(
          `[Intent Recognizer] Analisando entrada para intenção: "${userInputText}"`,
          chatIdStr
        );
        const intentResult = await intentRecognizer.recognizeIntent(
          userInputText,
          state.history,
          chatIdStr
        );
        if (intentResult && intentResult.intent) {
          logger.info(
            `[Intent Recognizer] Intenção detectada: ${
              intentResult.intent
            }, Confiança: ${
              intentResult.confidence
            }, Detalhes: ${JSON.stringify(intentResult.details)}`,
            chatIdStr
          );
          await stateManager.updateUserIntent(
            chatIdStr,
            intentResult.intent,
            intentResult.confidence,
            intentResult.details
          );
          // Atualiza o estado local para refletir a nova intenção
          const updatedState = await stateManager.getChatState(chatIdStr);
          if (!updatedState)
            throw new Error(
              "Falha crítica ao recarregar estado após atualização de intenção."
            );
          state = updatedState;
        } else {
          logger.debug(
            `[Intent Recognizer] Nenhuma intenção específica detectada ou resultado inválido.`,
            chatIdStr
          );
        }
      } catch (intentError) {
        logger.error(
          `[Intent Recognizer] Erro ao reconhecer intenção: ${intentError.message}`,
          serializeError(intentError),
          chatIdStr
        );
        // Não interrompe o fluxo principal, mas registra o erro
      }
    }
    
    const contactName = state.name;
    let currentStepBlueprint = null;
    let mainAIResult = null;

    // ================================================================
    // ===          VERIFICAÇÃO DE PEDIDOS DE MAIS PROVAS SOCIAIS   ===
    // ================================================================
    
    // REGRA 0 - RESET DA FLAG usesSalesPageLink APÓS FINALIZAÇÃO DA VENDA:
    // Se o usuário chegou na etapa POST_PURCHASE_FOLLOWUP, resetamos a flag
    if (effectiveStepId === "POST_PURCHASE_FOLLOWUP" && 
        state?.metadata?.contextFlags?.usesSalesPageLink) {
      logger.info(
        `[AI Processor] Resetando flag usesSalesPageLink na etapa POST_PURCHASE_FOLLOWUP para ${contactName}.`,
        chatIdStr
      );
      
      if (!state.metadata) state.metadata = {};
      if (!state.metadata.contextFlags) state.metadata.contextFlags = {};
      state.metadata.contextFlags.usesSalesPageLink = false;
      
      await stateManager.updateState(chatIdStr, {
        metadata: state.metadata
      });
      
      logger.debug(
        `[AI Processor] Flag usesSalesPageLink resetada com sucesso para ${contactName}.`,
        chatIdStr
      );
    }
    
    // REGRA 1 - DETECÇÃO DE CONTEXTO PARA MAIS PROVAS SOCIAIS:
    // Verifica se o usuário está pedindo mais provas sociais
    // Incrementa o contador para controlar qual link será enviado posteriormente
    if (userInputText && socialProofPersonalizer.isRequestingMoreProofs(userInputText)) {
      // Incrementa o contador de solicitações de prova social
      const proofRequestCount = await stateManager.incrementProofRequestCount(chatIdStr);

      logger.info(
        `[AI Processor] Pedido de mais provas sociais detectado (${proofRequestCount}ª vez). Contador incrementado para ${contactName}.`,
        chatIdStr
      );

      // NÃO envia link aqui - o sistema continua normalmente e o link correto
      // será escolhido automaticamente quando chegar na etapa CLOSE_DEAL
    }
    
    // ================================================================

    try {
      logger.debug(
        `[AI Processor ENTRY] Effective Step: ${effectiveStepId}`,
        chatIdStr
      );

      currentStepBlueprint = salesFunnelBluePrint.getStepById(effectiveStepId);
      if (!currentStepBlueprint) {
        logger.error(
          `[AI Processor] CRITICAL: Blueprint ${effectiveStepId} não encontrado! Tentando fallback para GENERAL_SUPPORT.`,
          chatIdStr
        );
        const fallbackStepId = "GENERAL_SUPPORT";
        currentStepBlueprint = salesFunnelBluePrint.getStepById(fallbackStepId);
        if (!currentStepBlueprint) {
          logger.fatal(
            `[AI Processor] CRITICAL: Blueprint de fallback ${fallbackStepId} também não encontrado! Abortando.`,
            chatIdStr
          );
          const errorMsg =
            botConfig.behavior.errorHandling.default(contactName);
          await responseSender.sendMessages(
            chat,
            chatIdStr,
            contactName,
            [errorMsg],
            false,
            userInputText
          );
          await stateManager.addMessageToHistory(
            chatIdStr,
            "system",
            `[Sistema: Erro crítico - Blueprint ${effectiveStepId} e fallback ${fallbackStepId} não encontrados.]`
          );
          return;
        }
        logger.warn(
          `[AI Processor] Usando etapa de fallback: ${fallbackStepId}`,
          chatIdStr
        );
        await stateManager.updateState(chatIdStr, {
          currentFunnelStepId: fallbackStepId,
          metadata: {
            ...(state.metadata || {}),
          },
        });
        state = await stateManager.getChatState(chatIdStr);
        if (!state)
          throw new Error(
            "Falha crítica ao recarregar estado após fallback de blueprint."
          );
        state.isProcessing = true;
        state.processingStartTime = state.processingStartTime || Date.now();
        effectiveStepId = fallbackStepId;
      }

      // Gerar Prompt e Chamar IA
      logger.debug(
        `[AI Processor] Gerando prompt principal para etapa: ${effectiveStepId}`,
        chatIdStr
      );
      const promptInfo = await _generatePromptForAIStep(
        effectiveStepId,
        state,
        userInputText,
        transcriptionHasFailed,
        trainingData
      );

      // NEW DETAILED LOGGING FOR promptInfo and promptInfo.messages - V3 (Logging Only)
      const contextForLogV3 = state && state.chatId ? state.chatId : chatIdStr;
      try {
        if (promptInfo === null || typeof promptInfo === "undefined") {
          logger.error(
            `[AI Pre-Call DEBUG V3] promptInfo is null or undefined. Critical.`,
            { context: contextForLogV3, effectiveStepId }
          );
          } else {
          logger.debug(
            `[AI Pre-Call DEBUG V3] promptInfo received. Keys: ${Object.keys(
              promptInfo
            ).join(", ")}. Error flag: ${promptInfo.error}. Error message: ${
              promptInfo.message
            }`,
            { context: contextForLogV3 }
          );

          if (typeof promptInfo.messages === "undefined") {
            logger.warn(
              `[AI Pre-Call DEBUG V3] promptInfo.messages is undefined.`,
              { context: contextForLogV3 }
            );
              } else if (promptInfo.messages === null) {
            logger.warn(`[AI Pre-Call DEBUG V3] promptInfo.messages is null.`, {
              context: contextForLogV3,
            });
              } else if (!Array.isArray(promptInfo.messages)) {
            logger.warn(
              `[AI Pre-Call DEBUG V3] promptInfo.messages is not an array. Type: ${typeof promptInfo.messages}`,
              { context: contextForLogV3 }
            );
              } else {
            logger.info(
              `[AI Pre-Call DEBUG V3] promptInfo.messages IS an array. Length: ${promptInfo.messages.length}`,
              { context: contextForLogV3 }
            );
                  if (promptInfo.messages.length === 0) {
              logger.warn(
                `[AI Pre-Call DEBUG V3] promptInfo.messages is EMPTY array.`,
                { context: contextForLogV3 }
              );
                  } else {
                      // Log a sample of the first and last message parts/content to avoid overly verbose logs
              const firstMsgContentSample = JSON.stringify(
                promptInfo.messages[0]?.parts || promptInfo.messages[0]?.content
              )?.substring(0, 150);
              logger.trace(
                `[AI Pre-Call DEBUG V3] First message content (sample): ${firstMsgContentSample}`,
                { context: contextForLogV3 }
              );
                      if (promptInfo.messages.length > 1) {
                const lastMsgContentSample = JSON.stringify(
                  promptInfo.messages[promptInfo.messages.length - 1]?.parts ||
                    promptInfo.messages[promptInfo.messages.length - 1]?.content
                )?.substring(0, 150);
                logger.trace(
                  `[AI Pre-Call DEBUG V3] Last message content (sample): ${lastMsgContentSample}`,
                  { context: contextForLogV3 }
                );
                      }
                  }
              }
          }
      } catch (e) {
        logger.error(
          `[AI Pre-Call DEBUG V3] Error during logging: ${e.message}`,
          { context: contextForLogV3, stack: e.stack }
        );
      }
      // END OF NEW DETAILED LOGGING V3

      mainAIResult = await _executeAICall(promptInfo.messages, chatIdStr);
      
      // 🔥 LOG DE DIAGNÓSTICO ADICIONADO
      logger.debug(
        `[AI Processor] RAW AI RESPONSE: "${mainAIResult.responseText}"`,
        chatIdStr
      );

      // Etapa 3: Limpeza e Envio
      // A declaração é movida para fora do bloco try para evitar redeclaração.
      try {
        // A resposta da IA é limpa e processada aqui.
        cleanedResponse = _cleanAiResponse(
          mainAIResult.responseText,
          contactName
        );

        if (!mainAIResult.responseText) {
          logger.error(
            `[AI Processor] Resposta da IA principal vazia ou falha: ${mainAIResult.finishReason}`,
            chatIdStr
          );
          const fallbackMessage =
            botConfig.behavior.errorHandling.emptyAiResponse(contactName);
          await responseSender.sendMessages(
            chat,
            chatIdStr,
            contactName,
            [fallbackMessage],
            false,
            userInputText
          ); // Histórico já é adicionado
          await stateManager.addMessageToHistory(
            chatIdStr,
            "system",
            `[Sistema: Falha ao gerar resposta IA (${
              mainAIResult.finishReason || "Empty"
            })]`
          );
          return;
        }

        // Limpar Resposta e Verificar Tags
        cleanedResponse = _cleanAiResponse(
          mainAIResult.responseText,
          contactName
        );
        // Removido: SEND_SOCIAL_PROOF_DIREITO_SUCCESSORIO não é mais usado
        const hasSocialProofTag = false; // Desabilitado - provas sociais agora via RAG

        // Fluxo normal - provas sociais agora são gerenciadas via RAG

        // Fluxo normal se não houver tag de provas sociais
        if (!cleanedResponse) {
          logger.error(
            `[AI Processor] Resposta da IA ficou vazia após limpeza/remoção de tag!`,
            chatIdStr
          );
          const fallbackMessage =
            botConfig.behavior.errorHandling.emptyAiResponse(contactName);
          await responseSender.sendMessages(
            chat,
            chatIdStr,
            contactName,
            [fallbackMessage],
            false,
            userInputText
          );
          await stateManager.addMessageToHistory(
            chatIdStr,
            "system",
            `[Sistema: Resposta IA vazia após limpeza/tag]`
          );
          return;
        }

        // Enviar Resposta ao Usuário
        let messagesArray = cleanedResponse
          .split("%%MSG_BREAK%%")
          .map((msg) => msg.trim())
          .filter((msg) => msg.length > 0);
        
        // Variável para controlar se devemos pular o envio de mensagens
        let shouldSkipMessageSending = false;
        
        if (messagesArray.length === 0) {
          logger.error(
            `[AI Processor] Resposta dividida resultou em array vazio!`,
            chatIdStr
          );
          const fallbackMessage =
            botConfig.behavior.errorHandling.emptyAiResponse(contactName);
          await responseSender.sendMessages(
            chat,
            chatIdStr,
            contactName,
            [fallbackMessage],
            false,
            userInputText
          );
          await stateManager.addMessageToHistory(
            chatIdStr,
            "system",
            `[Sistema: Resposta IA inválida após split]`
          );
          return;
        }
        logger.debug(
          `[AI Processor] Enviando resposta (${messagesArray.length} partes).`,
          chatIdStr
        );

        // A decisão de tentar TTS é feita aqui, antes de chamar responseSender
        const attemptTTSForThisResponse =
          botConfig.tts.enabled &&
          Math.random() < botConfig.tts.usageProbability;
        logger.info(
          `[AI Processor] Tentativa de TTS para esta resposta: ${attemptTTSForThisResponse} (Global: ${botConfig.tts.enabled}, Prob: ${botConfig.tts.usageProbability})`,
          chatIdStr
        );

        // VERIFICAÇÃO DA TAG [ACTION: ADVANCE_FUNNEL] E AVANÇO DE ETAPA
        // A tag [ACTION: ADVANCE_FUNNEL] pode ser usada em qualquer etapa para controle de fluxo pela IA
        const hasAdvanceFunnelTag = cleanedResponse.includes(
          "[ACTION: ADVANCE_FUNNEL]"
        );
        const hasSkipSocialProofTag = cleanedResponse.includes(
          "[ACTION: SKIP_SOCIAL_PROOF]"
        );
        
        // Reinicializar flags para controle de fluxo
        shouldSkipMessageSending = false;
        let shouldProcessNextStepAfterSending = false;
        
        if (hasAdvanceFunnelTag) {
          logger.info(
            `[NextStepLogic] Tag [ACTION: ADVANCE_FUNNEL] detectada na resposta da IA para a etapa ${state.currentFunnelStepId}.`,
            chatIdStr
          );
          cleanedResponse = cleanedResponse
            .replace("[ACTION: ADVANCE_FUNNEL]", "")
            .trim();
          messagesArray = cleanedResponse
            .split("%%MSG_BREAK%%")
            .map((msg) => msg.trim())
            .filter((msg) => msg.length > 0);

          // Se não há mensagens após [ACTION: ADVANCE_FUNNEL], devemos pular o envio e avançar diretamente
          if (messagesArray.length === 0) {
            shouldSkipMessageSending = true;
            logger.info(
              `[NextStepLogic] Nenhuma mensagem para enviar após [ACTION: ADVANCE_FUNNEL]. Avançando silenciosamente para a próxima etapa.`,
              chatIdStr
            );
          } else {
            // Se há mensagens para enviar, devemos enviar primeiro e depois processar a próxima etapa
            shouldProcessNextStepAfterSending = true;
            logger.info(
              `[NextStepLogic] Mensagens serão enviadas primeiro, depois processamento da próxima etapa será executado.`,
              chatIdStr
            );
          }

          // Lógica de avanço imediato baseado na decisão da IA
          const currentBlueprintForAdvance = salesFunnelBluePrint.getStepById(
            state.currentFunnelStepId
          );
          if (
            currentBlueprintForAdvance &&
            currentBlueprintForAdvance.nextStepDefault
          ) {
            await stateManager.updateState(chatIdStr, {
              currentFunnelStepId: currentBlueprintForAdvance.nextStepDefault,
            });
            logger.info(
              `[NextStepLogic] Estado atualizado para ${currentBlueprintForAdvance.nextStepDefault} devido à tag [ACTION: ADVANCE_FUNNEL] da IA.`,
              chatIdStr
            );
            // Recarrega o estado para garantir que a lógica subsequente use a nova etapa
            try {
              const freshState = await stateManager.getChatState(chatIdStr);
              if (!freshState)
                throw new Error(
                  "Falha crítica ao recarregar estado após avanço por tag."
                );
              state = freshState; // Reatribuição segura
              logger.debug(
                `[NextStepLogic] Estado recarregado com sucesso após [ACTION: ADVANCE_FUNNEL]. Nova etapa: ${state.currentFunnelStepId}`,
                chatIdStr
              );
            } catch (stateReloadError) {
              logger.error(
                `[NextStepLogic] Erro ao recarregar estado após [ACTION: ADVANCE_FUNNEL]: ${stateReloadError.message}`,
                chatIdStr
              );
              throw stateReloadError;
            }
          }
        }
        
        // VERIFICAÇÃO DA TAG [ACTION: SKIP_SOCIAL_PROOF] - PULA DIRETO PARA PLAN_OFFER
        // Esta tag é específica da etapa SOLUTION_PRESENTATION quando o lead não quer ver provas sociais
        if (hasSkipSocialProofTag) {
          logger.info(
            `[NextStepLogic] Tag [ACTION: SKIP_SOCIAL_PROOF] detectada na resposta da IA para a etapa ${state.currentFunnelStepId}.`,
            chatIdStr
          );
          cleanedResponse = cleanedResponse
            .replace("[ACTION: SKIP_SOCIAL_PROOF]", "")
            .trim();
          messagesArray = cleanedResponse
            .split("%%MSG_BREAK%%")
            .map((msg) => msg.trim())
            .filter((msg) => msg.length > 0);

          // Se não há mensagens após [ACTION: SKIP_SOCIAL_PROOF], devemos pular o envio e avançar diretamente
          if (messagesArray.length === 0) {
            shouldSkipMessageSending = true;
            logger.info(
              `[NextStepLogic] Nenhuma mensagem para enviar após [ACTION: SKIP_SOCIAL_PROOF]. Pulando para PLAN_OFFER silenciosamente.`,
              chatIdStr
            );
          } else {
            // Se há mensagens para enviar, devemos enviar primeiro e depois processar a próxima etapa
            shouldProcessNextStepAfterSending = true;
            logger.info(
              `[NextStepLogic] Mensagens serão enviadas primeiro, depois processamento da PLAN_OFFER será executado.`,
              chatIdStr
            );
          }

          // LÓGICA ESPECÍFICA: Pula SOCIAL_PROOF_DELIVERY e vai direto para PLAN_OFFER
          await stateManager.updateState(chatIdStr, {
            currentFunnelStepId: "PLAN_OFFER",
          });
          logger.info(
            `[NextStepLogic] Estado atualizado para PLAN_OFFER devido à tag [ACTION: SKIP_SOCIAL_PROOF] da IA. Etapa SOCIAL_PROOF_DELIVERY foi pulada.`,
            chatIdStr
          );
          
          // Recarrega o estado para garantir que a lógica subsequente use a nova etapa
          try {
            const freshState = await stateManager.getChatState(chatIdStr);
            if (!freshState)
              throw new Error(
                "Falha crítica ao recarregar estado após pular prova social."
              );
            state = freshState; // Reatribuição segura
            logger.debug(
              `[NextStepLogic] Estado recarregado com sucesso após [ACTION: SKIP_SOCIAL_PROOF]. Nova etapa: ${state.currentFunnelStepId}`,
              chatIdStr
            );
          } catch (stateReloadError) {
            logger.error(
              `[NextStepLogic] Erro ao recarregar estado após [ACTION: SKIP_SOCIAL_PROOF]: ${stateReloadError.message}`,
              chatIdStr
            );
            throw stateReloadError;
          }
        }

        // Só envia mensagens se não devemos pular o envio
        if (!shouldSkipMessageSending) {
          const processedMessagesArray = [...messagesArray];

          // Recupera o originalMsgId do metadata (se disponível)
          const originalMsgId = initialState?.metadata?.lastOriginalMsgId || null;
          if (originalMsgId) {
            logger.debug(
              `[AI Processor] Enviando resposta com citação (quoted) da mensagem ID: ${originalMsgId}`,
              chatIdStr
            );
          }

          // CRUCIAL: Aguarda completamente o envio das mensagens antes de processar a próxima etapa
          const messageSendingSuccess = await responseSender.sendMessages(
            chat,
            chatIdStr,
            contactName,
            processedMessagesArray,
            attemptTTSForThisResponse,
            originalMsgId // Passa o ID da mensagem original para citação
          );
          
          logger.info(
            `[AI Processor] Envio de mensagens concluído. Sucesso: ${messageSendingSuccess}`,
            chatIdStr
          );
          
          // ✅ Iniciar/resetar timer de inatividade APENAS após bot terminar de enviar mensagens
          if (messageSendingSuccess) {
            inactivityManager.startInactivityTimer(chatIdStr);
            logger.debug(
              `[AI Processor] 🔄 Timer de inatividade iniciado após envio bem-sucedido das mensagens`,
              chatIdStr
            );
          }
          
          // Se há próxima etapa para processar E o envio foi bem-sucedido, processa agora
          if (shouldProcessNextStepAfterSending && messageSendingSuccess) {
            const actionType = hasAdvanceFunnelTag
              ? "ADVANCE_FUNNEL"
              : hasSkipSocialProofTag
              ? "SKIP_SOCIAL_PROOF"
              : "UNKNOWN";
            logger.info(
              `[AI Processor] Processando automaticamente a nova etapa após envio bem-sucedido por ${actionType}...`,
              chatIdStr
            );
            
            // Recarrega o estado para garantir que temos a etapa atualizada
            const freshStateForNewStep = await stateManager.getChatState(
              chatIdStr
            );
            if (freshStateForNewStep) {
              // Chama recursivamente o processamento para a nova etapa
              // Usa uma mensagem vazia para simular que o usuário "ativou" a nova etapa
              logger.info(
                `[AI Processor] Iniciando processamento automático da etapa ${freshStateForNewStep.currentFunnelStepId}`,
                chatIdStr
              );
              
              // Processa a nova etapa automaticamente
              await callAndRespondWithAI(
                chat, 
                chatIdStr, // chatId correto
                freshStateForNewStep, // initialState correto
                "", // userInputText (vazio para processamento automático)
                false, // transcriptionHasFailed
                trainingData, // trainingData
                freshStateForNewStep.currentFunnelStepId // effectiveStepId
              );
              return; // Sai da função atual pois o processamento foi delegado
            }
          }
        } else {
          logger.info(
            `[AI Processor] Envio de mensagens pulado devido ao avanço silencioso com [ACTION: ADVANCE_FUNNEL].`,
            chatIdStr
          );
          
          // Se fizemos avanço silencioso (por qualquer tag de ação), devemos processar automaticamente a nova etapa
          const actionType = hasAdvanceFunnelTag
            ? "ADVANCE_FUNNEL"
            : hasSkipSocialProofTag
            ? "SKIP_SOCIAL_PROOF"
            : "UNKNOWN";
          logger.info(
            `[AI Processor] Processando automaticamente a nova etapa após avanço silencioso por ${actionType}...`,
            chatIdStr
          );
          
          // Recarrega o estado para garantir que temos a etapa atualizada
          const freshStateForNewStep = await stateManager.getChatState(
            chatIdStr
          );
          if (freshStateForNewStep) {
            // Chama recursivamente o processamento para a nova etapa
            // Usa uma mensagem vazia para simular que o usuário "ativou" a nova etapa
            logger.info(
              `[AI Processor] Iniciando processamento automático da etapa ${freshStateForNewStep.currentFunnelStepId}`,
              chatIdStr
            );
            
            // Processa a nova etapa automaticamente
            await callAndRespondWithAI(
              chat, 
              chatIdStr, // chatId correto
              freshStateForNewStep, // initialState correto
              "", // userInputText (vazio para processamento automático)
              false, // transcriptionHasFailed
              trainingData, // trainingData
              freshStateForNewStep.currentFunnelStepId // effectiveStepId
            );
            return; // Sai da função atual pois o processamento foi delegado
          }
        }

        // Marca a etapa como concluída APÓS o envio bem-sucedido da mensagem principal da IA
        let collectedDataForStep = {};
        if (currentStepBlueprint) {
          if (
            currentStepBlueprint.id === "PROBLEM_EXPLORATION" &&
            cleanedResponse
          ) {
            const problemKeywords = [
              "dor principal:",
              "problema central:",
              "maior dificuldade:",
              "desafio chave:",
              "minha dificuldade é",
              "meu problema é",
              "preciso resolver",
              "estou lutando com",
            ];
            for (const keyword of problemKeywords) {
              const keywordIndex = cleanedResponse
                .toLowerCase()
                .indexOf(keyword.toLowerCase());
              if (keywordIndex !== -1) {
                let potentialProblem = cleanedResponse
                  .substring(keywordIndex + keyword.length)
                  .trim();
                potentialProblem = potentialProblem.split(/[\.\!\?]/)[0].trim();
                if (potentialProblem && potentialProblem.length < 150) {
                  collectedDataForStep.mainProblem = potentialProblem;
                  logger.info(
                    `[AI Processor] Dado 'mainProblem' potencialmente coletado: ${collectedDataForStep.mainProblem}`,
                    chatIdStr
                  );
                  break;
                }
              }
            }
          }

          if (
            currentStepBlueprint.id === "PLAN_OFFER" &&
            cleanedResponse &&
            state.recommendedPlanId
          ) {
            const planDetails = pricing.getPlanDetails(state.recommendedPlanId);
            if (
              planDetails &&
              cleanedResponse
                .toLowerCase()
                .includes(planDetails.name.toLowerCase())
            ) {
              collectedDataForStep.offeredPlan = planDetails.name;
              logger.info(
                `[AI Processor] Dado 'offeredPlan' potencialmente coletado: ${collectedDataForStep.offeredPlan}`,
                chatIdStr
              );
            }
          }
        }

        let stepIdToMarkCompleted = state.currentFunnelStepId;

        // NOVA FILOSOFIA: Só marca como completada se a IA usou as tags de ação
        if (hasAdvanceFunnelTag || hasSkipSocialProofTag) {
          await stateManager.markStepAsCompleted(
            state.id,
            stepIdToMarkCompleted,
            collectedDataForStep,
            true
          );
          logger.info(
            `[AI Processor] Mensagens enviadas e etapa ${stepIdToMarkCompleted} marcada como concluída.`,
            chatIdStr
          );
        } else {
          logger.debug(
            `[AI Processor] Mensagens enviadas mas etapa NÃO marcada como concluída (IA não usou tag de ação).`,
            chatIdStr
          );
        }

        // Lógica Pós-Envio e Atualização de Estado
        state = await stateManager.getChatState(chatIdStr);
        if (!state)
          throw new Error(
            "Falha crítica ao recarregar estado pós-envio da resposta da IA."
          );
        state.isProcessing = true;
        state.processingStartTime = state.processingStartTime || Date.now();

        let nextStepIdToSave = state.currentFunnelStepId;
        // CORREÇÃO: Preservar flags existentes no metadata, especialmente contextFlags
        let finalMetadataToSave = {
          ...(state.metadata || {}),
          contextFlags: {
            ...(state.metadata?.contextFlags || {})
          }
        };

        // Lógica de decisão do próximo passo baseada em intenção e blueprint
        const currentBlueprint = salesFunnelBluePrint.getStepById(
          state.currentFunnelStepId
        );

        // NOVA FILOSOFIA: O avanço só ocorre quando a IA explicitamente usar a tag [ACTION: ADVANCE_FUNNEL]
        // Não há mais avanço automático baseado em regras ou lógica de blueprint
        if (currentBlueprint) {
          logger.info(
            `[NextStepLogic] Mantendo etapa atual ${state.currentFunnelStepId}. Avanço só ocorrerá com tag [ACTION: ADVANCE_FUNNEL] da IA.`,
            chatIdStr
          );
          // Mantém na mesma etapa - o avanço só ocorre com a tag da IA
        }

        // ATUALIZAÇÃO DE ESTADO PRINCIPAL - Garantir que o estado seja atualizado
        // com o nextStepIdToSave e finalMetadataToSave determinados pela lógica anterior
        // (seja ela de objeção, avanço padrão, ou manutenção da etapa atual).
        if (
          state.currentFunnelStepId !== nextStepIdToSave ||
          JSON.stringify(state.metadata) !== JSON.stringify(finalMetadataToSave)
        ) {
            await stateManager.updateState(chatIdStr, {
                currentFunnelStepId: nextStepIdToSave,
                metadata: finalMetadataToSave,
            });
            logger.info(
            `[AI Processor] Estado ATUALIZADO para ${nextStepIdToSave}. Metadados alterados: ${
              JSON.stringify(state.metadata) !==
              JSON.stringify(finalMetadataToSave)
            }`,
                chatIdStr
            );
        } else {
            logger.debug(
                `[AI Processor] Nenhuma alteração de estado necessária. Etapa: ${nextStepIdToSave}, Metadados não alterados.`,
                chatIdStr
            );
        }

        // Lógica de Mídia Pós-IA
        currentStepBlueprint =
          salesFunnelBluePrint.getStepById(nextStepIdToSave);
        if (
          currentStepBlueprint?.mediaAction?.sendAfterAI === true &&
          currentStepBlueprint.mediaAction.type &&
          currentStepBlueprint.mediaAction.filename
        ) {
          logger.info(
            `[AI Processor] Enviando mídia pós-IA (Etapa ${nextStepIdToSave}): ${currentStepBlueprint.mediaAction.type}: ${currentStepBlueprint.mediaAction.filename}`,
            chatIdStr
          );
          if (currentStepBlueprint.mediaAction.type === "video") {
            await sleep(VIDEO_POST_SEND_DELAY_MS);
          }
          const mediaActionDetails = currentStepBlueprint.mediaAction;

          if (
            mediaActionDetails.type === "text" &&
            mediaActionDetails.filename
          ) {
            // Se for 'text', o 'filename' agora contém o link diretamente (conforme trainingLoader modificado)
            logger.info(
              `[AI Processor] Enviando link de prova social (Etapa ${nextStepIdToSave}): ${mediaActionDetails.filename}`,
              chatIdStr
            );
            await responseSender.sendMessages(
              chat,
              chatIdStr,
              contactName,
              [mediaActionDetails.filename], // Envia o link como mensagem de texto
              false, // Não tentar TTS para links
              userInputText
            );
            await stateManager.updateState(chatIdStr, {
              lastProofSent: {
                type: "text",
                filename: mediaActionDetails.filename,
                success: true, // Assumindo sucesso ao enviar texto
                timestamp: Date.now(),
              },
            });

            // Enviar textAfter se existir e não for legenda (já que não há legenda para texto puro)
            if (mediaActionDetails.textAfter) {
              await responseSender.sendMessages(
                chat,
                chatIdStr,
                contactName,
                [mediaActionDetails.textAfter],
                false,
                userInputText
              );
            }
          } else {
            // Lógica original para outros tipos de mídia (image, video, audio, pdf)
            const proofTypeMap = {
              image: "image",
              video: "video",
              audio: "audio",
              pdf: "pdf",
            };
            const proofType = proofTypeMap[mediaActionDetails.type];

            if (
              proofType &&
              typeof mediaHandler.default.sendMediaProof === "function"
            ) {
              const fullPath = path.join(
                PROOFS_DIR,
                mediaActionDetails.filename
              );
              const mediaResult = await mediaHandler.default.sendMediaProof(
                whatsappClient.getClient(),
                chatIdStr,
                proofType,
                fullPath,
                mediaActionDetails.useAsCaption
                  ? mediaActionDetails.textAfter
                  : "",
                false
              );
              const success = mediaResult;
              await stateManager.updateState(chatIdStr, {
                lastProofSent: {
                  type: proofType,
                  filename: mediaActionDetails.filename,
                  success: success,
                  timestamp: Date.now(),
                },
              });
              if (success) {
                if (
                  mediaActionDetails.textAfter &&
                  !mediaActionDetails.useAsCaption
                ) {
                  await responseSender.sendMessages(
                    chat,
                    chatIdStr,
                    contactName,
                    [mediaActionDetails.textAfter],
                    false,
                    userInputText
                  );
                }
              } else {
                logger.error(
                  `[AI Processor] Falha ao enviar mídia pós-IA: ${mediaActionDetails.filename}`,
                  chatIdStr
                );
              }
            } else {
              logger.error(
                `[AI Processor] Tipo de mídia pós-IA inválido (${mediaActionDetails.type}) ou sendMediaProof indisponível.`,
                chatIdStr
              );
            }
          }
        }

        // ✅ Iniciar/resetar timer de inatividade após envio completo (incluindo mídia pós-IA se houver)
        inactivityManager.startInactivityTimer(chatIdStr);
        logger.debug(
          `[AI Processor] 🔄 Timer de inatividade iniciado após processamento completo`,
          chatIdStr
        );

        // NOVA FILOSOFIA: Sem avanço automático
        // O controle de fluxo é 100% da IA através da tag [ACTION: ADVANCE_FUNNEL]
        logger.trace(
          `[AI Processor] Processamento concluído. Etapa atual: ${state.currentFunnelStepId}. Próximo avanço dependente da decisão da IA.`,
          chatIdStr
        );
      } catch (error) {
        logger.error(
          `[AI Processor] Erro GERAL ao processar IA para ${
            initialState?.name || "desconhecido"
          }:`,
          serializeError(error),
          chatIdStr
        );
        if (chat && typeof responseSender.sendMessages === "function") {
          try {
            const errorMsg = botConfig.behavior.errorHandling.default(
              initialState?.name
            );
            await responseSender.sendMessages(
              chat,
              chatIdStr,
              initialState?.name,
              [errorMsg],
              false,
              userInputText
            );
            await stateManager.addMessageToHistory(
              chatIdStr,
              "system",
              `[Sistema: Erro (${
                error.name || "Unknown"
              }) ao processar resposta IA]`
            );
          } catch (sendFallbackError) {
            logger.error(
              `[AI Processor] Falha CRÍTICA ao enviar msg erro FALLBACK para ${initialState?.name}`,
              serializeError(sendFallbackError),
              chatIdStr
            );
          }
        }
      } finally {
        await stateManager
          .updateState(chatIdStr, {
            isProcessing: false,
            processingStartTime: null,
          })
          .catch((e) =>
            logger.error(
              `[AI Processor] Falha CRÍTICA ao liberar trava DB no finally para ${chatIdStr}`,
              serializeError(e),
              chatIdStr
            )
          );
        
        // ✅ Timer de inatividade agora é gerenciado após envio bem-sucedido das mensagens
        // Não há necessidade de resetar aqui no finally
        logger.trace(
          `[AI Processor] Timer de inatividade gerenciado após envio das mensagens para ${chatIdStr}`,
          chatIdStr
        );
        
        logger.trace(
          `[AI Processor] Trava isProcessing liberada para ${chatIdStr}.`,
          chatIdStr
        );
      }
    } catch (error) {
      logger.error(
        `[AI Processor] Erro CRÍTICO no orquestrador para ${chatIdStr}:`,
        serializeError(error),
        chatIdStr
      );
    }
  } catch (error) {
    logger.error(
      `[AI Processor] Erro CRÍTICO no orquestrador para ${chatIdStr}:`,
      serializeError(error),
      chatIdStr
    );
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================
// Exportação movida para o final do arquivo

// ================================================================
// ===          PROCESSAMENTO ESPECIAL DE NOME PERSONALIZADO   ===
// ================================================================

/**
 * Detecta se o usuário está corrigindo seu nome na mensagem
 * @param {string} message - Mensagem do usuário
 * @returns {Promise<{isCorrection: boolean, newName: string|null}>} Resultado da detecção
 */
async function detectNameCorrection(message) {
  if (!message || typeof message !== 'string') {
    return { isCorrection: false, newName: null };
  }
  
  const text = message.toLowerCase().trim();
  
  // Padrões de correção de nome (específicos para evitar falsos positivos)
  const correctionPatterns = [
    /^\s*pode me chamar de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*me chame? de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*pode me chamar assim mesmo:\s*([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*meu nome é\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*eu sou\s+(?:o\s+|a\s+)?([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*prefiro ser chamad[oa] de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*me chama por\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*pode me chamar por\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*meu nome é\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
    /^\s*eu sou\s+(?:o\s+|a\s+)?([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
  ];
  
  for (const pattern of correctionPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const correctedName = match[1].trim();
      // Capitalizar corretamente cada palavra
      const formattedName = correctedName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
      return { isCorrection: true, newName: formattedName };
    }
  }
  
  return { isCorrection: false, newName: null };
}

/**
 * Processa correção de nome globalmente em qualquer etapa do funil
 * @param {string} chatIdStr - ID do chat
 * @param {object} state - Estado atual do chat
 * @param {string} userInputText - Texto da mensagem do usuário
 * @returns {Promise<{nameWasCorrected: boolean, correctedName: string|null}>}
 */
async function processGlobalNameCorrection(chatIdStr, state, userInputText) {
  try {
    const detectionResult = await detectNameCorrection(userInputText);
    
    if (detectionResult.isCorrection && detectionResult.newName) {
      logger.info(
        `[Global Name Correction] Correção de nome detectada: "${detectionResult.newName}" para ${chatIdStr}`,
        chatIdStr
      );
      
      // Atualizar o nome preferido no estado
      await stateManager.updatePreferredName(
        chatIdStr,
        detectionResult.newName,
        state.fullName,
        'corrected' // Marcar como correção
      );
      
      return {
        nameWasCorrected: true,
        correctedName: detectionResult.newName
      };
    }
    
    return {
      nameWasCorrected: false,
      correctedName: null
    };
  } catch (error) {
    logger.error(
      `[Global Name Correction] Erro ao processar correção de nome para ${chatIdStr}:`,
      error,
      chatIdStr
    );
    return {
      nameWasCorrected: false,
      correctedName: null
    };
  }
}

/**
 * Processa a etapa NAME_CAPTURE_VALIDATION para capturar o nome personalizado
 * Agora com IA para validação inteligente de nomes
 * @param {string} chatIdStr - ID do chat
 * @param {object} state - Estado atual do chat
 * @param {string} userInputText - Texto da mensagem do usuário
 * @returns {Promise<{shouldContinue: boolean, nameData: object|null}>}
 */
async function _processNameCapture(chatIdStr, state, userInputText) {
  if (state.currentFunnelStepId !== "NAME_CAPTURE_VALIDATION") {
    return { shouldContinue: true, nameData: null };
  }

  logger.info(
    `[Name Capture] Processando captura de nome personalizado para ${chatIdStr}`,
    chatIdStr
  );
  
  try {
    // Função para sanitizar nomes (remove quebras de linha e caracteres estranhos)
    const sanitizeName = (name) => {
      if (!name || typeof name !== "string") return name;
      return name
        .replace(/[\r\n\t\v\f]/g, "") // Remove todas as quebras de linha e caracteres de controle
        .replace(/\s+/g, " ") // Substitui múltiplos espaços por um único espaço
        .trim(); // Remove espaços no início e fim
    };
    
    // 🔥 NOVA LÓGICA: SEMPRE registra um nome antes de avançar
    // Função para extrair firstNameFallback do contactName ou fullName
    const getFirstNameFallback = () => {
      const sourceNames = [state.fullName, state.name, state.contactName].filter(Boolean);
      for (const sourceName of sourceNames) {
        if (sourceName && !sourceName.startsWith('Lead-')) {
          const firstName = sourceName.split(' ')[0].trim();
          if (firstName.length > 1) {
            return firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
          }
        }
      }
      return null;
    };
    
    // ============================================================
    // ===  🤖 VALIDAÇÃO DE NOME COM IA - APENAS NESTA ETAPA  ===
    // ============================================================
    
    /**
     * Usa IA para validar se o texto contém um nome válido e extraí-lo
     * @param {string} text - Texto a ser analisado
     * @returns {Promise<{isValidName: boolean, extractedName: string|null, confidence: number}>}
     */
    async function validateNameWithAI(text) {
      try {
        const prompt = `Analise o texto abaixo e determine se contém um nome próprio válido de pessoa.

REGRAS:
1. ACEITAR como nomes válidos: nomes próprios reais (João, Maria, Ana, Carlos, etc.)
2. REJEITAR: saudações (oi, olá, boa tarde), palavras genéricas (sim, não, ok), frases completas, números, emojis
3. Se encontrar um nome válido, extraia APENAS o primeiro nome
4. Se a pessoa disse algo como "me chama de João" ou "meu nome é Maria", extraia o nome

TEXTO PARA ANÁLISE: "${text}"

Responda EXATAMENTE no formato JSON:
{
  "isValidName": true/false,
  "extractedName": "Nome" ou null,
  "confidence": 0.0-1.0,
  "reasoning": "explicação breve"
}`;

        const messages = [
          {
            role: "system",
            content:
              "Você é um especialista em processamento de linguagem natural focado em identificação de nomes próprios. Seja preciso e objetivo.",
          },
          {
            role: "user",
            content: prompt,
          },
        ];

        const aiResponse = await _executeAICall(messages, chatIdStr);
        
        if (!aiResponse?.responseText) {
          logger.warn(
            `[Name Capture AI] Resposta vazia da IA para ${chatIdStr}`,
            chatIdStr
          );
          return { isValidName: false, extractedName: null, confidence: 0 };
        }

        // Tenta parsear a resposta JSON
        let result;
        try {
          // Remove possíveis caracteres extras e extrai apenas o JSON
          const cleanResponse = aiResponse.responseText.trim();
          const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
          
          if (jsonMatch) {
            result = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error("Formato JSON não encontrado na resposta");
          }
        } catch (parseError) {
          logger.warn(
            `[Name Capture AI] Erro ao parsear resposta da IA: ${parseError.message}`,
            chatIdStr
          );
          return { isValidName: false, extractedName: null, confidence: 0 };
        }

        // Validação dos campos da resposta
        if (typeof result !== "object" || result === null) {
          return { isValidName: false, extractedName: null, confidence: 0 };
        }

        const isValidName = Boolean(result.isValidName);
        const extractedName =
          result.extractedName && typeof result.extractedName === "string"
          ? result.extractedName.trim() 
          : null;
        const confidence =
          typeof result.confidence === "number"
          ? Math.min(Math.max(result.confidence, 0), 1) 
          : 0;

        logger.debug(`[Name Capture AI] Análise concluída para "${text}":`, {
          chatId: chatIdStr,
          isValidName,
          extractedName,
          confidence,
          reasoning: result.reasoning,
        });

        return { isValidName, extractedName, confidence };
      } catch (error) {
        logger.error(
          `[Name Capture AI] Erro na validação com IA para ${chatIdStr}:`,
          {
          error: error.message,
            text: text.substring(0, 100),
          },
          chatIdStr
        );
        return { isValidName: false, extractedName: null, confidence: 0 };
      }
    }
    
    // ============================================================
    // ===         PROCESSAMENTO PRINCIPAL DO NOME             ===
    // ============================================================
    
    // Primeiro, tenta usar a IA para validar o nome
    const aiValidation = await validateNameWithAI(userInputText);
    
    let extractedName = null;
    
    // Se a IA encontrou um nome válido com boa confiança, usa ele
    if (
      aiValidation.isValidName &&
      aiValidation.extractedName &&
      aiValidation.confidence >= 0.7
    ) {
      extractedName = aiValidation.extractedName;
      logger.info(
        `[Name Capture] Nome validado pela IA: "${extractedName}" (confiança: ${aiValidation.confidence})`,
        chatIdStr
      );
    } else {
      // Fallback para análise por regex (método anterior)
      logger.debug(
        `[Name Capture] IA não encontrou nome válido, usando fallback por regex`,
        chatIdStr
      );
      
      // Função de validação básica para fallback
      function isValidNameBasic(name) {
        if (!name || typeof name !== "string") return false;
        
        const trimmedName = name.trim();
        if (trimmedName.length < 2) return false;
        
        const invalidNameWords = [
          "oi",
          "olá",
          "ola",
          "bom",
          "dia",
          "boa",
          "tarde",
          "noite",
          "sim",
          "não",
          "nao",
          "ok",
          "tudo",
          "bem",
          "como",
          "quem",
          "qual",
          "porque",
          "por",
          "que",
          "quando",
          "onde",
          "como",
          "certo",
          "errado",
          "talvez",
          "obrigado",
          "obrigada",
        ];
        
        const words = trimmedName.toLowerCase().split(/\s+/);
        if (words.every((word) => invalidNameWords.includes(word))) {
          return false;
        }
        
        const specialCharsRegex = /[^a-zA-ZÀ-ÖØ-öø-ÿ\s]/g;
        const specialCharsCount = (trimmedName.match(specialCharsRegex) || [])
          .length;
        if (specialCharsCount > trimmedName.length * 0.3) {
          return false;
        }
        
        return true;
      }

      const userText = userInputText.trim().toLowerCase();
      
      // Padrões específicos para capturar nomes personalizados (evita falsos positivos)
      const namePatterns = [
        /^\s*pode me chamar de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
        /^\s*me chame? de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
        /^\s*meu nome é\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
        /^\s*eu sou\s+(?:o\s+|a\s+)?([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
        /^\s*prefiro ser chamad[oa] de\s+([a-záàâãéêíóôõúç\s]+?)\s*[.,!]?\s*$/i,
      ];

      // Lógica de fallback para casos sem nome explícito
      const fallbackTriggers = [
        /^\s*sim\s*$/i, // 'Sim'
        /^\s*$/, // Entrada vazia
        /carga horária|curso|quantas horas|conteúdo|preço|valor|como funciona/i // Perguntas sobre o curso
      ];

      const isFallbackCase = fallbackTriggers.some(pattern => pattern.test(userText));

      if (isFallbackCase && state.contactName) {
        // Extrai o primeiro nome do contactName como fallback
        extractedName = state.contactName.split(' ')[0].trim();
        logger.info(`[Name Capture] Usando fallback: "${extractedName}" de contactName "${state.contactName}"`, chatIdStr);
      } else {
        // Continuar com a lógica existente de padrões
        // Tenta extrair o nome usando apenas padrões explícitos
        for (const pattern of namePatterns) {
          const match = userInputText.match(pattern);
          if (match && match[1]) {
            const candidateName = match[1].trim();
            // Remove palavras comuns que não são nomes
            const commonWords = [
              "o",
              "a",
              "de",
              "por",
              "mesmo",
              "está",
              "bom",
              "tá",
              "ok",
              "obrigado",
              "obrigada",
            ];
            const words = candidateName.split(" ");
            const cleanWords = words.filter(
              (word) =>
                !commonWords.includes(word.toLowerCase()) && word.length > 1
            );
            if (cleanWords.length > 0) {
              const potentialName = cleanWords.join(" ");
              if (isValidNameBasic(potentialName)) {
                extractedName = potentialName;
                break;
              }
            }
          }
        }
      }
    }

    // 🔥 NOVA LÓGICA: SEMPRE registra um nome antes de avançar
    let finalName = extractedName;
    
    // Se não conseguiu extrair um nome válido da resposta, usa o firstNameFallback
    if (!finalName) {
      finalName = getFirstNameFallback();
      if (finalName) {
        logger.info(
          `[Name Capture] Usando firstNameFallback: "${finalName}" para ${chatIdStr}`,
          chatIdStr
        );
      } else {
        logger.warn(
          `[Name Capture] Não foi possível obter nem nome da resposta nem firstNameFallback para ${chatIdStr}`,
          chatIdStr
        );
        // Mesmo assim, continua o fluxo sem registrar nome
        return { shouldContinue: true, nameData: null };
      }
    }
    
    // Se temos um nome (extraído ou fallback), processa e registra
    if (finalName) {
      // Sanitizar o nome antes de capitalizar
      finalName = sanitizeName(finalName);
      
      // Capitaliza o nome (primeira letra maiúscula, resto minúscula)
      finalName =
        finalName.charAt(0).toUpperCase() +
        finalName.slice(1).toLowerCase();
      
      // Atualiza o nome personalizado no estado
      await stateManager.updatePreferredName(
        chatIdStr,
        finalName,
        state.fullName
      );
      
      logger.info(
        `[Name Capture] Nome registrado: "${finalName}" para ${chatIdStr} (${extractedName ? 'extraído da resposta' : 'firstNameFallback'})`,
        chatIdStr
      );
      
      return { 
        shouldContinue: true, 
        nameData: { 
          preferredName: finalName,
          fullName: state.fullName,
        },
      };
    }
    
    // Caso extremo: não conseguiu nem extrair nem usar fallback
    return { shouldContinue: true, nameData: null };
  } catch (error) {
    logger.error(
      `[Name Capture] Erro ao processar captura de nome para ${chatIdStr}:`,
      serializeError(error),
      chatIdStr
    );
    return { shouldContinue: true, nameData: null };
  }
}

// ================================================================
// ===           SISTEMA DE MENSAGENS DE INATIVIDADE            ===
// ================================================================

/**
 * Gera mensagem de reengajamento usando IA com contexto do funil
 * @param {Object} context - Contexto para geração da mensagem
 * @param {string} context.chatId - ID do chat
 * @param {Object} context.chatState - Estado atual do chat
 * @param {number} context.attemptNumber - Número da tentativa (1 ou 2)
 * @param {string} context.currentStepId - Etapa atual do funil
 * @param {Object} [context.trainingData] - Dados de treinamento
 * @returns {Promise<string|null>} Mensagem gerada ou null se falhar
 */
async function generateInactivityMessageWithAI(context) {
  ensureClientsReady();

  const { chatId, chatState, attemptNumber } = context;

  const contactName = chatState.name || "Cliente";
  const currentStepId = chatState.currentFunnelStepId || "GREETING_NEW";
  const stepBlueprint = salesFunnelBluePrint.getStepById(currentStepId);
  const stepGoal =
    stepBlueprint?.goal || "entender como posso te ajudar melhor";
  const lastUserMessage = chatState.lastUserInput || "";
  const lastBotMessage =
    chatState.messageHistory?.filter((m) => m.role === "assistant").pop()
      ?.content || "";

  // ✅ NOVO: Extrai contexto específico da conversa para personalização
  const conversationContext = chatState.conversationContext || {};
  const dificuldadeMencionada = conversationContext.userPainPoints?.join(', ') || '';
  const impactoMencionado = conversationContext.userImpacts?.join(', ') || '';
  const solucaoSugerida = conversationContext.solutionPresented || '';

  const haveDiffic = dificuldadeMencionada.trim().length > 0;
  const haveImpact = impactoMencionado.trim().length > 0;
  const haveSolution = solucaoSugerida.trim().length > 0;

   // ✅ DEFINIÇÕES DOS PLACEHOLDERS DO CURSO
  const desafioCurso = "a falta de especialização e confiança em Direito Sucessório e Inventários";
  const resultadoCurso = "domínio completo e transformação da advocacia para se tornar um profissional de destaque e bem-sucedido em sucessões e inventários";

  // ✅ NOVO: Obtém o coreQuestionPrompt da etapa atual para contextualização
  const coreQuestion = stepBlueprint?.coreQuestionPrompt || null;
  const stepTitle = stepBlueprint?.title || "Conversa";

  const instructions = `
🎯 VOCÊ É UM ESPECIALISTA EM REENGAJAMENTO PERSUASIVO

SUA IDENTIDADE:
Você é Pedro, consultor sênior em Direito Sucessório do DPA. Você não está "cobrando" uma resposta - você está dando continuidade natural a uma conversa estratégica importante. Sua mente estava processando a situação de ${contactName} e você teve um insight valioso.

🧠 GATILHOS MENTAIS OBRIGATÓRIOS:
1. **ESCASSEZ SUTIL**: "você chegou pertinho de...", "estamos quase lá..."
2. **PROVA SOCIAL IMPLÍCITA**: "já vi isso acontecer com outros advogados..."
3. **AUTORIDADE CONSULTIVA**: "na minha experiência...", "o que percebi é que..."
4. **RECIPROCIDADE**: "pensei em você porque...", "lembrei do seu caso..."
5. **URGÊNCIA EMOCIONAL**: "não quero que você perca essa oportunidade..."

📋 ESTRUTURA OBRIGATÓRIA DA MENSAGEM:

**ABERTURA PERSONALIZADA** (escolha 1):
- "${contactName}, você chegou pertinho de [resultado desejado]..."
- "${contactName}, fiquei pensando no seu caso..."
- "${contactName}, uma coisa me chamou atenção..."

**CONEXÃO COM O CONTEXTO** (obrigatório):
- Mencione sutilmente onde pararam: "${stepTitle.toLowerCase()}"
- Se houver dificuldade: conecte com "${dificuldadeMencionada}"
- Se houver impacto: reforce a consequência "${impactoMencionado}"

**REAFIRMAÇÃO DE VALOR** (obrigatório):
- Conecte com o resultado do curso: "${resultadoCurso}"
- Use o contexto da etapa atual: "${stepGoal}"

**PERGUNTA DE RETORNO** (obrigatório):
- NUNCA pergunte "podemos continuar?"
- Use perguntas que geram reflexão:
  * "isso ainda faz sentido pra você?"
  * "você ainda vê valor nisso?"
  * "vale a pena continuarmos?"
  * "isso ainda é uma prioridade?"

🎨 EXEMPLOS DE ESTRUTURA POR ETAPA:

**SE ETAPA = QUALIFICAÇÃO/EXPLORAÇÃO:**
"${contactName}, você chegou pertinho de descobrirmos exatamente como te ajudar...%%MSG_BREAK%%A gente já entendeu [contexto], e foi por isso que quero te mostrar um caminho que realmente encaixa.%%MSG_BREAK%%Fiquei pensando... isso ainda faz sentido pra você?"

**SE ETAPA = APRESENTAÇÃO DA SOLUÇÃO:**
"${contactName}, uma coisa me chamou atenção...%%MSG_BREAK%%Você mencionou [dificuldade/impacto] e isso é exatamente o que o nosso método resolve. Na minha experiência, advogados que passam por isso conseguem [resultado específico].%%MSG_BREAK%%Vale a pena continuarmos?"

**SE ETAPA = NOME/INICIAL:**
"${contactName}, fiquei pensando... você chegou até aqui porque tem interesse real em ${desafioCurso}.%%MSG_BREAK%%Isso ainda é uma prioridade pra você?"

🚫 PROIBIÇÕES ABSOLUTAS:
- "Você sumiu", "Percebi que não respondeu", "Está por aí?"
- Mensagens longas (máximo 3 linhas)
- Tom de cobrança ou pressão
- Perguntas genéricas sem contexto
- Mencionar tempo que passou

✅ DIRETRIZES FINAIS:
- Use %%MSG_BREAK%% para quebras de linha
- Máximo 2-3 frases curtas e impactantes
- Tom consultivo, nunca vendedor
- Sempre termine com pergunta de retorno
- Personalize com o nome e contexto específico

IMPORTANTE: Quando mencionar benefícios do curso:
- Desafio: ${desafioCurso}
- Resultado: ${resultadoCurso}

CONTEXTO DA CONVERSA:
Última mensagem bot: "${lastBotMessage}"
Etapa atual: ${stepTitle} (${stepGoal})
${coreQuestion ? `Pergunta central da etapa: "${coreQuestion}"` : ''}
${haveDiffic ? `Dificuldade identificada: "${dificuldadeMencionada}"` : ''}
${haveImpact ? `Impacto mencionado: "${impactoMencionado}"` : ''}
${haveSolution ? `Solução apresentada: "${solucaoSugerida}"` : ''}
    `;

  const messages = [
    { role: "system", content: instructions },
    {
      role: "user",
      content: `O histórico da conversa é o seguinte. Última mensagem do usuário: "${lastUserMessage}". Minha última mensagem foi: "${lastBotMessage}". O objetivo da etapa atual (${currentStepId}) é "${stepGoal}". Gere a mensagem de reengajamento para ${contactName}.`,
    },
  ];

  try {
    // ✅ NOVO: Usa tokens altos específicos para mensagens de inatividade
    const inactivityTokens = botConfig.tokens?.inactivity || 4096;
    const response = await _executeAICall(messages, chatId, inactivityTokens);
    const cleanedResponse = _cleanAiResponse(response.responseText, contactName);

    logger.info("🤖 Mensagem de inatividade gerada pela IA", {
      chatId,
      length: cleanedResponse.length,
    });

    return cleanedResponse;
  } catch (error) {
    logger.error("❌ Erro ao gerar mensagem de inatividade com IA", {
      error: error.message,
      chatId,
    });
    // Retorna null para que a lógica de fallback no InactivityManager seja acionada
    return null;
  }
}

// Exporta as funções
export { callAndRespondWithAI, generateInactivityMessageWithAI, detectNameCorrection, processGlobalNameCorrection };

// --- END OF FILE aiProcessor.js ---
