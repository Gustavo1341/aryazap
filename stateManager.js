// --- START OF FILE stateManager.js ---

/**
 * stateManager.js - Gerenciador de Estado das Conversas (v. Robusta com DB e Spam)
 * ================================================================================
 * Responsável por:
 * - Persistir e recuperar o estado de cada conversa (chatId) no Banco de Dados.
 * - Gerenciar o histórico de mensagens dentro do estado persistido (JSONB).
 * - Lidar com status como 'humanTakeoverUntil', 'isBlockedUntil'.
 * - Implementar e fornecer lógica de detecção de spam (rate limit, keywords).
 * - Fornecer funções para manipular o estado (bloquear usuário, ativar takeover).
 * - Utilizar dbService para interação com o banco de dados.
 * - Manter flags não persistidas (como 'isProcessing') em memória.
 * ================================================================================
 * NOTA Multi-Tenancy: O schema inclui `tenant_id`. Em um ambiente real,
 * o `tenantId` correto deve ser determinado e incluído nas cláusulas WHERE.
 */

import logger from "./logger.js";
import botConfig from "./botConfig.js";
import salesFunnelBluePrint from "./salesFunnelBluePrint.js"; // Para etapa inicial padrão
import dbService from "./db.js"; // Para persistência no PostgreSQL
import pricing from "./pricing.js"; // Para plano recomendado inicial
import responseSender from "./responseSender.js"; // Para enviar msg de bloqueio
import whatsappClient from "./whatsappClient.js"; // Para obter chat quando necessário
import inactivityManager from "./inactivityManager.js"; // Sistema de inatividade
import {
  MAX_HISTORY_MESSAGES_STATE,
  DEFAULT_LEAD_PREFIX,
} from "./constants.js"; // Limites e defaults
import { serializeError } from "serialize-error"; // Para logs de erro

// --- Sistema de Proteção de Etapas Críticas ---
const CRITICAL_STEPS = [
  'CLOSE_DEAL',
  'UPSELL_CLOSE', 
  'DOWNSELL_CLOSE',
  'POST_PURCHASE_FOLLOWUP'
];

const CRITICAL_STEP_PROTECTION_TIME = 30000; // 30 segundos

// Flag para proteger etapas críticas
const criticalStepProtection = new Map();

/**
 * Marca uma etapa como crítica e protegida contra interrupções
 */
function protectCriticalStep(chatId, stepId) {
  if (CRITICAL_STEPS.includes(stepId)) {
    const protectionKey = `${chatId}_${stepId}`;
    criticalStepProtection.set(protectionKey, {
      stepId,
      protectedAt: Date.now(),
      chatId
    });
    
    // Auto-remove proteção após timeout
    setTimeout(() => {
      criticalStepProtection.delete(protectionKey);
      logger.debug(`[Critical Protection] Proteção removida para ${stepId} em ${chatId}`);
    }, CRITICAL_STEP_PROTECTION_TIME);
    
    logger.info(`[Critical Protection] Etapa ${stepId} protegida para ${chatId}`);
  }
}

/**
 * Verifica se uma etapa está protegida
 */
function isCriticalStepProtected(chatId, stepId) {
  const protectionKey = `${chatId}_${stepId}`;
  return criticalStepProtection.has(protectionKey);
}

/**
 * Remove proteção de etapa crítica
 */
function removeCriticalStepProtection(chatId, stepId) {
  const protectionKey = `${chatId}_${stepId}`;
  criticalStepProtection.delete(protectionKey);
  logger.debug(`[Critical Protection] Proteção removida manualmente para ${stepId} em ${chatId}`);
}

/**
 * Verifica se uma etapa é crítica
 */
function isCriticalStep(stepId) {
  return CRITICAL_STEPS.includes(stepId);
}

// --- Tipos (JSDoc) ---
/**
 * @typedef {import('whatsapp-web.js').Message} WAMessage
 * @typedef {import('whatsapp-web.js').Chat} WAChat
 */

/**
 * @typedef {object} CompletedStep
 * @property {string} stepId - ID da etapa completada
 * @property {number} completedAt - Timestamp de quando foi completada
 * @property {object} collectedData - Dados coletados nesta etapa
 * @property {boolean} wasSuccessful - Se a etapa foi completada com sucesso
 */

/**
 * @typedef {object} ConversationContext - Contexto conversacional para transições naturais.
 * @property {string[]} userPainPoints - Problemas específicos mencionados pelo usuário

 * @property {string} communicationStyle - Estilo de comunicação detectado ('formal'|'casual')
 * @property {string} urgencyLevel - Nível de urgência detectado ('high'|'medium'|'low')
 * @property {string|null} previousStepId - ID da etapa anterior para transições contextuais
 * @property {{pricing: boolean, benefits: boolean, testimonials: boolean, planDetails: boolean}} informationShared - Informações já compartilhadas
 * @property {string|null} lastTransitionReason - Motivo da última transição entre etapas
 */

/**
 * @typedef {object} ChatState - Estrutura do estado de uma conversa.
 * @property {string} id - Chat ID (ex: '1234567890@c.us'). **PK**.
 * @property {CompletedStep[]} [completedSteps] - Array de etapas completadas
 * @property {object} [collectedUserData] - Dados consolidados do usuário
 * @property {ConversationContext} [conversationContext] - Contexto conversacional para transições naturais
 * @property {string} [currentIntent] - Intenção atual detectada do usuário (ex: 'request_discount', 'ask_support').

 * @property {Array<{timestamp: number, reason: string, oldStep: string, newStep: string}>} [flowAdaptationHistory] - Histórico de adaptações do fluxo.
 * @property {string} name - Nome do contato.
 * @property {string | null} tenantId - ID do tenant/cliente SaaS. **FK/Index**.
 * @property {string | null} userId - ID do usuário associado ao bot. **FK/Index**.
 * @property {Array<{role: string, content: string, timestamp: string, metadata?: object}>} history - Histórico da conversa (JSONB).
 * @property {string} currentFunnelStepId - ID da etapa atual no funil.
 * @property {string | null} recommendedPlanId - ID do plano recomendado inicialmente.
 * @property {{type: string|null, filename: string|null, timestamp: number|null, success: boolean|null}} lastProofSent - Última prova enviada.
 * @property {string | null} lastAction - Última ação significativa do bot/sistema.
 * @property {number | null} humanTakeoverUntil - Timestamp (ms) até quando o takeover está ativo.
 * @property {number | null} isBlockedUntil - Timestamp (ms) até quando o usuário está bloqueado.
 * @property {number[]} messageTimestamps - Timestamps das últimas N mensagens (para rate limit - JSONB).
 * @property {number[]} audioTimestamps - Timestamps dos últimos N áudios (para rate limit - JSONB).
 * @property {number} lastInteractionTimestamp - Timestamp (ms) da última interação (entrada ou saída).
 * @property {object} [metadata] - Campo opcional para dados extras (tags, score, etc.) (JSONB).
 * // --- Propriedades NÃO Persistidas ---
 * @property {boolean} [isProcessing=false] - Flag de controle de concorrência (apenas em memória).
 */

/** Cache em memória APENAS para flags não persistidas (isProcessing). */
const nonPersistentStateCache = {};

const STATE_TABLE = "chat_states";
const DEFAULT_TENANT_ID = process.env.TENANT_ID || "default_tenant";

// ================================================================
// ===         LÓGICA DE DETECÇÃO DE SPAM INTERNA               ===
// ================================================================

/**
 * Verifica se uma mensagem ou sequência é considerada spam com base no estado atual.
 * Verifica keywords, taxa de mensagens e taxa de áudios.
 * ATENÇÃO: Esta função MODIFICA os arrays messageTimestamps/audioTimestamps no objeto state passado!
 * @param {ChatState} state - O estado atual do chat (será modificado).
 * @param {string} messageType - Tipo da mensagem atual ('chat', 'audio', 'ptt', etc.).
 * @param {WAMessage | null} messageObject - O objeto da mensagem (para verificar keywords no body).
 * @returns {{ detected: boolean, reason?: string, details?: object }}
 */
function isSpamDetected(state, messageType = "other", messageObject = null) {
  if (!state || !state.id) return { detected: false }; // Impossível verificar sem estado

  const chatId = state.id;
  const now = Date.now();
  const config = botConfig.behavior.antiSpam;

  // 1. Verificação de Keywords (apenas para mensagens de texto)
  if (
    messageType === "chat" &&
    messageObject?.body &&
    config.spamKeywords?.length > 0
  ) {
    const lowerBody = messageObject.body.toLowerCase();
    const foundKeyword = config.spamKeywords.find(
      (kw) => kw && lowerBody.includes(kw.toLowerCase())
    );
    if (foundKeyword) {
      logger.debug(
        `[Spam Detect] Keyword "${foundKeyword}" detectada.`,
        chatId
      );
      return {
        detected: true,
        reason: `Keyword (${foundKeyword})`,
        details: {
          keyword: foundKeyword,
          message: messageObject.body.substring(0, 100),
        },
      };
    }
  }

  // 2. Verificação de Taxa de Mensagens (qualquer tipo)
  const msgWindowMs = config.messageWindowSeconds * 1000;
  // Garante que o array exista e remove timestamps antigos
  state.messageTimestamps = (state.messageTimestamps || []).filter(
    (ts) => now - ts < msgWindowMs
  );
  // Adiciona timestamp atual
  state.messageTimestamps.push(now);
  // Verifica se excedeu o limite
  if (state.messageTimestamps.length > config.maxMessagesPerWindow) {
    const count = state.messageTimestamps.length;
    logger.debug(
      `[Spam Detect] Taxa Msgs Excedida (${count}/${config.maxMessagesPerWindow} em ${config.messageWindowSeconds}s).`,
      chatId
    );
    return {
      detected: true,
      reason: `Taxa Msgs (${count}/${config.messageWindowSeconds}s)`,
      details: {
        count,
        limit: config.maxMessagesPerWindow,
        windowSec: config.messageWindowSeconds,
      },
    };
  }

  // 3. Verificação de Taxa de Áudios (apenas para audio/ptt)
  if (messageType === "audio" || messageType === "ptt") {
    const audioWindowMs = config.audioWindowMinutes * 60 * 1000;
    // Garante que o array exista e remove timestamps antigos
    state.audioTimestamps = (state.audioTimestamps || []).filter(
      (ts) => now - ts < audioWindowMs
    );
    // Adiciona timestamp atual
    state.audioTimestamps.push(now);
    // Verifica se excedeu o limite
    if (state.audioTimestamps.length > config.maxAudiosPerWindow) {
      const count = state.audioTimestamps.length;
      logger.debug(
        `[Spam Detect] Taxa Áudios Excedida (${count}/${config.maxAudiosPerWindow} em ${config.audioWindowMinutes}min).`,
        chatId
      );
      return {
        detected: true,
        reason: `Taxa Áudios (${count}/${config.audioWindowMinutes}min)`,
        details: {
          count,
          limit: config.maxAudiosPerWindow,
          windowMin: config.audioWindowMinutes,
        },
      };
    }
  }

  // Se passou por todas as verificações
  return { detected: false };
}

// ================================================================
// ===         FUNÇÕES DE RASTREAMENTO DE ETAPAS              ===
// ================================================================

/**
 * Marca uma etapa como completada
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa
 * @param {object} collectedData - Dados coletados na etapa
 * @param {boolean} wasSuccessful - Se foi completada com sucesso
 */
async function markStepAsCompleted(chatId, stepId, collectedData = {}, wasSuccessful = true) {
  try {
    const state = await getChatState(chatId);
    if (!state) return false;

    // Inicializa arrays se não existirem
    if (!state.completedSteps) state.completedSteps = [];
    if (!state.collectedUserData) state.collectedUserData = {};

    // Remove etapa anterior se já existir (para atualização)
    state.completedSteps = state.completedSteps.filter(step => step.stepId !== stepId);

    // Adiciona nova entrada
    state.completedSteps.push({
      stepId,
      completedAt: Date.now(),
      collectedData,
      wasSuccessful
    });

    // Consolida dados coletados
    Object.assign(state.collectedUserData, collectedData);

    // Persiste no banco
    await updateState(chatId, {
      completedSteps: state.completedSteps,
      collectedUserData: state.collectedUserData
    });

    logger.info(`[Step Tracking] Etapa ${stepId} marcada como completada`, chatId);
    return true;
  } catch (error) {
    logger.error(`[Step Tracking] Erro ao marcar etapa ${stepId}:`, serializeError(error), chatId);
    return false;
  }
}

/**
 * Verifica se uma etapa foi completada
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa
 * @returns {Promise<CompletedStep|null>}
 */
async function getCompletedStep(chatId, stepId) {
  try {
    const state = await getChatState(chatId);
    if (!state?.completedSteps) return null;

    return state.completedSteps.find(step => step.stepId === stepId) || null;
  } catch (error) {
    logger.error(`[Step Tracking] Erro ao verificar etapa ${stepId}:`, serializeError(error), chatId);
    return null;
  }
}

/**
 * Obtém todas as etapas completadas
 * @param {string} chatId - ID do chat
 * @returns {Promise<CompletedStep[]>}
 */
async function getAllCompletedSteps(chatId) {
  try {
    const state = await getChatState(chatId);
    return state?.completedSteps || [];
  } catch (error) {
    logger.error(`[Step Tracking] Erro ao obter etapas completadas:`, serializeError(error), chatId);
    return [];
  }
}

/**
 * Obtém dados consolidados do usuário
 * @param {string} chatId - ID do chat
 * @returns {Promise<object>}
 */
async function getCollectedUserData(chatId) {
  try {
    const state = await getChatState(chatId);
    return state?.collectedUserData || {};
  } catch (error) {
    logger.error(`[Step Tracking] Erro ao obter dados do usuário:`, serializeError(error), chatId);
    return {};
  }
}

/**
 * Verifica se o usuário pode pular uma etapa baseado no histórico
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa
 * @returns {Promise<boolean>}
 */
async function canSkipStep(chatId, stepId) {
  const completedStep = await getCompletedStep(chatId, stepId);
  return completedStep && completedStep.wasSuccessful;
}

// Função getNextLogicalStep removida - estava interferindo com o fluxo natural do funil
// O fluxo agora segue exclusivamente o nextStepDefault definido no salesFunnelBluePrint.js

// ================================================================
// ===              FUNÇÕES DE ACESSO E MANIPULAÇÃO             ===
// ================================================================

/**
 * Obtém o estado atual para um chatId do Banco de Dados.
 * Cria estado inicial se não existir.
 * @param {string} chatId - O ID do chat.
 * @param {string | null} [contactNameHint=null] - Sugestão de nome.
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant.
 * @param {object} [options={}] - Opções para controlar a atualização do timestamp.
 * @returns {Promise<ChatState | null>} O objeto de estado ou null em erro crítico.
 */
async function getChatState(
  chatId,
  contactNameHint = null,
  tenantId = DEFAULT_TENANT_ID,
  options = {}
) {
  // 🔥 CORREÇÃO: Introduz a opção `updateInteractionTime` para controlar a atualização do timestamp.
  const { updateInteractionTime = true } = options;

  if (!chatId) {
    logger.warn("[State Mgr] Chamado `getChatState` sem chatId.");
    return null;
  }

  // Handle cases where an object with chatId property is passed instead of a string
  if (typeof chatId === 'object' && chatId !== null) {
    if (chatId.chatId && typeof chatId.chatId === 'string') {
      chatId = chatId.chatId;
    } else if (chatId.id && typeof chatId.id === 'string') {
      chatId = chatId.id;
    } else if (chatId.from && typeof chatId.from === 'string') {
      chatId = chatId.from;
    } else if (chatId.to && typeof chatId.to === 'string') {
      chatId = chatId.to;
    } else {
      // If we have an object but can't find a valid ID property, log the structure
      logger.error(
        "[State Mgr] Objeto de chatId não contém propriedade válida de ID",
        null,
        { objectStructure: JSON.stringify(chatId).substring(0, 200) }
      );
      return null;
    }
  }

  // Explicitly reject group chats (ending with @g.us)
  if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
    logger.error(
      "[State Mgr] Tentativa de obter estado para um grupo. Grupos não são suportados.",
      null,
      { chatId }
    );
    return null;
  }

  if (!chatId || typeof chatId !== "string" || !chatId.endsWith("@c.us")) {
    logger.error(
      "[State Mgr] Tentativa de obter estado com chatId inválido.",
      null,
      { chatId }
    );
    return null;
  }
  
  if (!dbService.isReady()) {
    logger.error(
      "[State Mgr] DB não está pronto. Impossível obter/criar estado.",
      null,
      { chatId }
    );
    return null;
  }

  // Inicializa cache não persistido se não existir
  if (!nonPersistentStateCache[chatId]) {
    nonPersistentStateCache[chatId] = { isProcessing: false, processingStartTime: null };
  }

  try {
    // Prepara os dados para o estado inicial, caso seja necessário inserir
    const defaultName =
      contactNameHint ||
      `${DEFAULT_LEAD_PREFIX} ${chatId.split("@")[0].slice(-4)}`;
    const mainProductId = botConfig.behavior.salesStrategy.targetProductId;
    const initialTimestamp = Date.now();
    /** @type {Omit<ChatState, 'isProcessing'>} */
    const stateToPersist = {
      id: chatId,
      name: defaultName,
      preferredName: null, // Nome como o usuário prefere ser chamado
      fullName: null, // Nome completo capturado do contato
      tenantId: tenantId,
      userId: process.env.BOT_USER_ID || null,
      history: [],
      currentFunnelStepId:
        (salesFunnelBluePrint?.steps && salesFunnelBluePrint.steps.length > 0) 
          ? salesFunnelBluePrint.steps[0]?.id 
          : "NAME_CAPTURE_VALIDATION",
      recommendedPlanId:
        pricing.getRecommendedPlan(mainProductId)?.id || null,
      lastProofSent: {
        type: null,
        filename: null,
        timestamp: null,
        success: null,
      },
      currentIntent: null, // Inicializa currentIntent
  
      flowAdaptationHistory: [], // Inicializa flowAdaptationHistory
      conversationContext: { // Inicializa contexto conversacional
        userPainPoints: [],

        communicationStyle: 'casual',
        urgencyLevel: 'medium',
        previousStepId: null,
        informationShared: {
          pricing: false,
          benefits: false,
          testimonials: false,
          planDetails: false
        },
        lastTransitionReason: null
      },
      lastAction: null,
      humanTakeoverUntil: null,
      isBlockedUntil: null,
      messageTimestamps: [],
      audioTimestamps: [],
      lastInteractionTimestamp: initialTimestamp,
      metadata: {},
      // Campos para sistema de inatividade
      reengagementAttempts: 0,
      lastReengagementAt: null,
    };

    // Tenta inserir o estado inicial com INSERT ... ON CONFLICT DO NOTHING
    // Isso garante que, se já existir um registro com esse chat_id, a operação não falhará
    await dbService.query(
      `INSERT INTO ${STATE_TABLE} (chat_id, tenant_id, state_data, last_updated) 
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (chat_id, tenant_id) DO NOTHING`,
      [
        chatId,
        tenantId,
        JSON.stringify(stateToPersist),
        new Date(initialTimestamp),
      ]
    );
    
    // Após a tentativa de inserção (bem-sucedida ou não), buscamos o estado
    // Isso garante que sempre retornamos o estado correto, mesmo que outro processo o tenha criado
    const { rows } = await dbService.query(
      `SELECT state_data FROM ${STATE_TABLE} WHERE chat_id = $1 AND tenant_id = $2`,
      [chatId, tenantId]
    );

    if (rows.length > 0) {
      // --- Estado Encontrado (pode ser o que acabamos de inserir ou um já existente) ---
      const stateFromDb = rows[0].state_data;
      const currentState = {
        ...stateFromDb,
        id: chatId,
        tenantId: tenantId,
        isProcessing: nonPersistentStateCache[chatId].isProcessing,
        processingStartTime: nonPersistentStateCache[chatId].processingStartTime
      };

      // Se não foi fornecido contactNameHint, tenta obter o nome atual do contato
      if (!contactNameHint && whatsappClient.isReady()) {
        try {
          const clientInstance = whatsappClient.getClient();
          if (clientInstance) {
            const chat = await clientInstance.getChatById(chatId);
            if (chat && chat.contact && chat.contact.pushname) {
              const firstName = chat.contact.pushname.trim().split(" ")[0];
              logger.trace(`[State Mgr GetChatState] Obtido nome "${firstName}" (original: "${chat.contact.pushname}") para atualizar estado`, chatId);
              currentState.name = firstName;
            }
          }
        } catch (e) {
          logger.warn(`[State Mgr GetChatState] Falha ao obter nome atualizado para ${chatId} via whatsappClient: ${e.message}`);
        }
      } else if (contactNameHint && 
                 !contactNameHint.startsWith(DEFAULT_LEAD_PREFIX) && 
                 contactNameHint !== currentState.name) {
        // Atualiza o nome se foi fornecido um novo nome explícito diferente do atual
        currentState.name = contactNameHint;
      }

      // Hydration/Defaults (Garante campos essenciais)
      currentState.history = currentState.history || [];
      currentState.messageTimestamps = currentState.messageTimestamps || [];
      currentState.audioTimestamps = currentState.audioTimestamps || [];
      currentState.lastProofSent = currentState.lastProofSent || {
        type: null,
        filename: null,
        timestamp: null,
        success: null,
      };
      currentState.currentFunnelStepId =
        currentState.currentFunnelStepId ||
        ((salesFunnelBluePrint?.steps && salesFunnelBluePrint.steps.length > 0)
          ? salesFunnelBluePrint.steps[0]?.id
          : "NAME_CAPTURE_VALIDATION");
      currentState.metadata = currentState.metadata || {};

      logger.debug(
        `[State Mgr DB] Estado encontrado para ${chatId} após upsert atômico.`,
        chatId
      );
      
      // REMOVIDO: Timer de inatividade NÃO deve ser iniciado a cada consulta de estado
      // Timer é controlado apenas no messageHandler quando usuário interage
      
      // Atualiza o timestamp da última interação para refletir atividade, SE PERMITIDO.
      // 🔥 CORREÇÃO: A atualização do timestamp agora é condicional.
      if (updateInteractionTime) {
        currentState.lastInteractionTimestamp = Date.now();
        logger.trace(
          `[State Mgr] Timestamp da última interação atualizado para ${currentState.lastInteractionTimestamp} para ${chatId}`
        );
      }
      
      return currentState;
    } else {
      // Este caso é altamente improvável, pois acabamos de tentar inserir
      logger.error(
        `[State Mgr DB] Estado não encontrado após tentativa de inserção para ${chatId}. Situação anômala.`,
        chatId
      );
      return null;
    }
  } catch (dbError) {
    logger.error(
      `[State Mgr DB] Erro CRÍTICO ao buscar/criar estado para ${chatId}.`,
      serializeError(dbError),
      chatId
    );
    return null;
  }
}

/**
 * Atualiza o estado de um chat no Banco de Dados (JSONB) e cache não persistido.
 * @param {string} chatId - O ID do chat.
 * @param {Partial<ChatState>} updates - Objeto com chaves/valores a serem atualizados.
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant.
 * @returns {Promise<boolean>} True se a atualização no DB foi bem-sucedida, False caso contrário.
 */
async function updateState(chatId, updates, tenantId = DEFAULT_TENANT_ID) {
  // Handle cases where an object with chatId property is passed instead of a string
  if (typeof chatId === 'object' && chatId !== null) {
    if (chatId.chatId && typeof chatId.chatId === 'string') {
      chatId = chatId.chatId;
    } else if (chatId.id && typeof chatId.id === 'string') {
      chatId = chatId.id;
    } else if (chatId.from && typeof chatId.from === 'string') {
      chatId = chatId.from;
    } else if (chatId.to && typeof chatId.to === 'string') {
      chatId = chatId.to;
    } else {
      // If we have an object but can't find a valid ID property, log the structure
      logger.error(
        "[State Mgr Update] Objeto de chatId não contém propriedade válida de ID",
        null,
        { objectStructure: JSON.stringify(chatId).substring(0, 200) }
      );
      return false;
    }
  }

  // Explicitly reject group chats (ending with @g.us)
  if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
    logger.error(
      "[State Mgr Update] Tentativa de atualizar estado para um grupo. Grupos não são suportados.",
      null,
      { chatId }
    );
    return false;
  }

  if (!chatId || !updates || typeof updates !== "object") {
    logger.warn(
      "[State Mgr Update] Tentativa de update com chatId ou updates inválidos.",
      null,
      { chatId, updates }
    );
    return false;
  }
  
  if (!dbService.isReady()) {
    logger.error(
      "[State Mgr Update] DB não está pronto. Impossível atualizar estado persistido.",
      null,
      { chatId }
    );
    return false;
  }

  // Atualiza cache não persistido
  if (updates.isProcessing !== undefined) {
    if (!nonPersistentStateCache[chatId])
      nonPersistentStateCache[chatId] = { isProcessing: false, processingStartTime: null };
    nonPersistentStateCache[chatId].isProcessing = updates.isProcessing;
    
    // Atualiza processingStartTime
    if (updates.isProcessing === true) {
      nonPersistentStateCache[chatId].processingStartTime = Date.now();
      logger.trace(`[State Mgr Cache] Flag 'processingStartTime' definida para ${nonPersistentStateCache[chatId].processingStartTime} para ${chatId}`);
    } else {
      nonPersistentStateCache[chatId].processingStartTime = null;
      logger.trace(`[State Mgr Cache] Flag 'processingStartTime' limpa para ${chatId}`);
    }
    
    logger.trace(
      `[State Mgr Cache] Flag 'isProcessing' atualizada para ${updates.isProcessing} para ${chatId}`
    );
  }

  // Atualiza processingStartTime explicitamente se fornecido
  if (updates.processingStartTime !== undefined) {
    if (!nonPersistentStateCache[chatId])
      nonPersistentStateCache[chatId] = { isProcessing: false, processingStartTime: null };
    nonPersistentStateCache[chatId].processingStartTime = updates.processingStartTime;
    logger.trace(
      `[State Mgr Cache] Flag 'processingStartTime' atualizada explicitamente para ${updates.processingStartTime} para ${chatId}`
    );
  }
  
  const { isProcessing, processingStartTime, ...updatesToPersist } = updates;
  if (Object.keys(updatesToPersist).length === 0) return true; // Só mudou isProcessing

  const updateTimestamp = Date.now();
  let historyUpdateJson = null;

  // Prepara a parte de atualização do histórico SE ele estiver no objeto de updates
  if (updatesToPersist.history && Array.isArray(updatesToPersist.history)) {
    // A query SQL vai CONCATENAR este array ao history existente no DB
    historyUpdateJson = JSON.stringify(updatesToPersist.history);
    // Remove history do objeto principal para não sobrescrever, apenas concatenar
    delete updatesToPersist.history;
  }

  // Prepara o merge das outras propriedades
  const otherUpdatesJsonb = JSON.stringify(updatesToPersist);

  try {
    // Query mais robusta para merge e trim de histórico
    // 1. Merge dos 'otherUpdates'
    // 2. Concatena 'historyUpdateJson' se ele foi fornecido
    // 3. Faz trim do array history resultante se exceder o limite
    // 4. Atualiza lastInteractionTimestamp
    const queryText = `
            WITH updated_base AS (
                SELECT state_data || $1::jsonb AS merged_data
                FROM ${STATE_TABLE}
                WHERE chat_id = $2 AND tenant_id = $3
            ), history_appended AS (
                SELECT
                    CASE
                        WHEN $4::jsonb IS NOT NULL THEN jsonb_set(ub.merged_data, '{history}', (ub.merged_data->'history') || $4::jsonb)
                        ELSE ub.merged_data
                    END as data_with_history
                FROM updated_base ub
            ), history_trimmed AS (
                SELECT
                    CASE
                        WHEN jsonb_array_length(ha.data_with_history->'history') > $5 -- MAX_HISTORY
                        THEN jsonb_set(ha.data_with_history, '{history}', (ha.data_with_history->'history') - 0 ) -- Remove o primeiro (índice 0)
                        ELSE ha.data_with_history
                    END as final_data
                FROM history_appended ha
            )
            UPDATE ${STATE_TABLE} s
            SET
                state_data = jsonb_set(ht.final_data, '{lastInteractionTimestamp}', to_jsonb($6::double precision)),
                last_updated = $7
            FROM history_trimmed ht
            WHERE s.chat_id = $2 AND s.tenant_id = $3
            RETURNING s.chat_id;
        `;
    const params = [
      otherUpdatesJsonb, // $1: updates (sem history)
      chatId, // $2: chat_id
      tenantId, // $3: tenant_id
      historyUpdateJson, // $4: novas entradas de history (ou NULL)
      MAX_HISTORY_MESSAGES_STATE, // $5: limite do histórico
      updateTimestamp, // $6: novo lastInteractionTimestamp
      new Date(updateTimestamp), // $7: novo last_updated
    ];

    const { rowCount } = await dbService.query(queryText, params);

    if (rowCount === 0) {
      logger.error(
        `[State Mgr DB Update] Nenhuma linha atualizada para ${chatId} (Tenant: ${tenantId}). Estado pode não existir ou Tenant ID incorreto.`,
        null,
        { chatId, tenantId }
      );
      return false;
    }
    return true; // Sucesso
  } catch (dbError) {
    logger.error(
      `[State Mgr DB Update] Erro CRÍTICO ao persistir estado atualizado para ${chatId}.`,
      serializeError(dbError),
      chatId,
      { updates: Object.keys(updatesToPersist) }
    );
    return false;
  }
}

/**
 * Adiciona uma mensagem ao histórico do chat via updateState.
 * @param {string} chatId - ID do chat.
 * @param {'user' | 'assistant' | 'system' | 'tts' | 'action'} role - Papel.
 * @param {string} content - Conteúdo da mensagem (será trimado e truncado).
 * @param {number} [timestampMs=Date.now()] - Timestamp (ms).
 * @param {object} [metadata={}] - Metadados opcionais.
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant.
 * @returns {Promise<boolean>} True se adicionado e estado salvo com sucesso.
 */
async function addMessageToHistory(
  chatId,
  role,
  content,
  timestampMs = Date.now(),
  metadata = {},
  tenantId = DEFAULT_TENANT_ID
) {
  // Handle cases where an object with chatId property is passed instead of a string
  if (typeof chatId === 'object' && chatId !== null) {
    if (chatId.chatId && typeof chatId.chatId === 'string') {
      chatId = chatId.chatId;
    } else if (chatId.id && typeof chatId.id === 'string') {
      chatId = chatId.id;
    } else if (chatId.from && typeof chatId.from === 'string') {
      chatId = chatId.from;
    } else if (chatId.to && typeof chatId.to === 'string') {
      chatId = chatId.to;
    } else {
      // If we have an object but can't find a valid ID property, log the structure
      logger.error(
        "[State Mgr History] Objeto de chatId não contém propriedade válida de ID",
        null,
        { objectStructure: JSON.stringify(chatId).substring(0, 200) }
      );
      return false;
    }
  }

  // Explicitly reject group chats (ending with @g.us)
  if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
    logger.error(
      "[State Mgr History] Tentativa de adicionar mensagem a um grupo. Grupos não são suportados.",
      null,
      { chatId }
    );
    return false;
  }

  if (!chatId || !role || typeof content !== "string") {
    logger.warn(
      "[State Mgr History] Parâmetros inválidos para addMessageToHistory.",
      null,
      { chatId, role }
    );
    return false;
  }

  const TRUNCATE_LIMIT = 5000; // Limite por entrada
  let processedContent = content.trim();
  if (processedContent.length > TRUNCATE_LIMIT) {
    logger.warn(
      `[State Mgr History] Mensagem longa truncada (${processedContent.length} > ${TRUNCATE_LIMIT} chars)`,
      chatId,
      { role }
    );
    processedContent =
      processedContent.substring(0, TRUNCATE_LIMIT - 3) + "...";
  }

  const historyEntry = {
    role,
    content: processedContent,
    timestamp: new Date(timestampMs).toISOString(),
    ...(Object.keys(metadata).length > 0 && { metadata }), // Adiciona metadata apenas se não vazio
  };

  // Chama updateState passando a nova entrada de histórico num array
  // A query em updateState fará o append e trim atomicamente.
  return await updateState(chatId, { history: [historyEntry] }, tenantId);
}

// ================================================================
// ===            FUNÇÕES DE LÓGICA DE ESTADO ESPECÍFICO        ===
// ================================================================

/**
 * Atualiza apenas o campo 'name' no estado do chat (quando o nome do contato mudar)
 * @param {string} chatId - O ID do chat
 * @param {string} newName - O novo nome do contato a ser salvo
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant
 * @returns {Promise<boolean>} True se a atualização foi bem-sucedida
 */
async function updateContactName(chatId, newName, tenantId = DEFAULT_TENANT_ID) {
  if (!chatId || !newName) return false;
  
  try {
    // Primeiro verifica se o estado existe e qual é o nome atual
    const currentState = await getChatState(chatId, null, tenantId);
    if (!currentState) return false;
    
    // Se o nome é o mesmo ou o novo nome é o padrão Lead, não precisa atualizar
    if (currentState.name === newName || newName.startsWith(DEFAULT_LEAD_PREFIX)) {
      return true; // Considera como "atualizado" pois já está correto
    }
    
    // Atualiza apenas o nome no estado
    await updateState(chatId, { name: newName }, tenantId);
    logger.trace(`[State Mgr] Nome do contato ${chatId} atualizado para "${newName}" (antigo: "${currentState.name}")`, chatId);
    return true;
  } catch (error) {
    logger.error(`[State Mgr] Erro ao atualizar nome do contato ${chatId}:`, serializeError(error), chatId);
    return false;
  }
}

/**
 * Atualiza o nome personalizado e nome completo do contato
 * @param {string} chatId - O ID do chat
 * @param {string} preferredName - Nome como o usuário prefere ser chamado
 * @param {string} [fullName] - Nome completo do usuário (opcional)
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant
 * @returns {Promise<boolean>} True se a atualização foi bem-sucedida
 */
async function updatePreferredName(chatId, preferredName, fullName = null, tenantId = DEFAULT_TENANT_ID) {
  if (!chatId || !preferredName) return false;
  
  // ✅ VERIFICAÇÃO ROBUSTA DE DB COM RETRY
  if (!dbService.isReady()) {
    logger.warn(`[State Mgr] DB não está pronto para updatePreferredName ${chatId}. Tentando aguardar...`, chatId);
    
    // Tenta aguardar o DB ficar pronto por até 3 segundos
    for (let i = 0; i < 6; i++) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 500ms
      if (dbService.isReady()) {
        logger.info(`[State Mgr] DB ficou pronto após ${(i + 1) * 500}ms para updatePreferredName ${chatId}`, chatId);
        break;
      }
    }
    
    // Se ainda não está pronto após 3 segundos, falha
    if (!dbService.isReady()) {
      logger.error(`[State Mgr] DB não ficou pronto em 3s para updatePreferredName ${chatId}. Operação cancelada.`, chatId);
      return false;
    }
  }
  
  try {
    let currentState = await getChatState(chatId, null, tenantId);
    if (!currentState) {
      logger.warn(`[State Mgr] Estado não encontrado para updatePreferredName ${chatId}. Tentando novamente...`, chatId);
      // Segunda tentativa após pequeno delay
      await new Promise(resolve => setTimeout(resolve, 200));
      currentState = await getChatState(chatId, null, tenantId);
      if (!currentState) {
        logger.error(`[State Mgr] Estado ainda não encontrado após retry para updatePreferredName ${chatId}`, chatId);
        return false;
      }
    }
    
    // SANITIZAÇÃO RIGOROSA DO NOME PERSONALIZADO
    // Remove quebras de linha, caracteres de controle e espaços extras
    let sanitizedPreferredName = preferredName;
    if (typeof preferredName === 'string') {
      sanitizedPreferredName = preferredName
        .replace(/[\r\n\t\v\f]/g, '') // Remove todas as quebras de linha e caracteres de controle
        .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único espaço
        .trim(); // Remove espaços no início e fim
    }
    
    let sanitizedFullName = fullName;
    if (fullName && typeof fullName === 'string') {
      sanitizedFullName = fullName
        .replace(/[\r\n\t\v\f]/g, '') // Remove todas as quebras de linha e caracteres de controle
        .replace(/\s+/g, ' ') // Substitui múltiplos espaços por um único espaço
        .trim(); // Remove espaços no início e fim
    }
    
    const updates = { 
      preferredName: sanitizedPreferredName,
      name: sanitizedPreferredName // Também atualiza o name principal para o nome preferido
    };
    
    // Se forneceu nome completo, atualiza também
    if (sanitizedFullName && sanitizedFullName.length > 0) {
      updates.fullName = sanitizedFullName;
    }
    
    await updateState(chatId, updates, tenantId);
    logger.info(`[State Mgr] Nome personalizado atualizado para ${chatId}: "${sanitizedPreferredName}"${sanitizedFullName ? ` (Nome completo: "${sanitizedFullName}")` : ''}`, chatId);
    return true;
  } catch (error) {
    logger.error(`[State Mgr] Erro ao atualizar nome personalizado ${chatId}:`, serializeError(error), chatId);
    return false;
  }
}

/**
 * Obtém o nome para usar na conversa, priorizando o nome preferido
 * @param {string} chatId - O ID do chat
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant
 * @returns {Promise<{displayName: string, fullName: string|null, preferredName: string|null}>} Objeto com nomes disponíveis
 */
async function getDisplayName(chatId, tenantId = DEFAULT_TENANT_ID) {
  const fallbackName = `${DEFAULT_LEAD_PREFIX} ${
    chatId ? chatId.split("@")[0].slice(-4) : "Unknown"
  }`;
  
  try {
    const state = await getChatState(chatId, null, tenantId);
    if (!state) {
      return {
        displayName: fallbackName,
        fullName: null,
        preferredName: null
      };
    }
    
    // Prioridade: preferredName > name > fallback
    const displayName = state.preferredName || state.name || fallbackName;
    
    return {
      displayName: displayName,
      fullName: state.fullName || null,
      preferredName: state.preferredName || null
    };
  } catch (error) {
    logger.error(`[State Mgr] Erro ao obter nome para exibição ${chatId}:`, serializeError(error), chatId);
    return {
      displayName: fallbackName,
      fullName: null,
      preferredName: null
    };
  }
}

/**
 * Obtém o nome do contato de forma confiável, priorizando o nome do perfil (pushname)
 * e retornando apenas o primeiro nome, mas também capturando o nome completo.
 * @param {WAMessage | { from: string, notifyName?: string }} messageOrInfo - Objeto msg ou info.
 * @param {WAChat | null} chat - Objeto chat (opcional, mas recomendado para pegar pushname).
 * @param {boolean} [captureFullName=false] - Se true, captura e armazena também o nome completo
 * @returns {Promise<string>} Primeiro nome do contato ou fallback.
 */
async function getContactName(messageOrInfo, chat = null, captureFullName = false) {
  const chatId = messageOrInfo?.from;
  const fallbackName = `${DEFAULT_LEAD_PREFIX} ${
    chatId ? chatId.split("@")[0].slice(-4) : "Unknown"
  }`;
  if (!chatId) return fallbackName;

  // Tenta obter o objeto Contact se 'chat' foi fornecido
  let contact = null;
  if (chat && typeof chat.getContact === 'function') {
    try {
      contact = await chat.getContact();
    } catch (e) {
      logger.warn(`[State Mgr GetName] Falha ao obter contato para ${chatId}`, e.message);
    }
  }

  // --- Validação de nome melhorada ---
  function isValidName(name) {
    if (!name || typeof name !== 'string') return false;
    
    // Remover espaços extras e verificar tamanho mínimo
    const trimmedName = name.trim();
    if (trimmedName.length < 2) return false;
    
    // 🔥 MELHORIA: Lista expandida de palavras que não são nomes
    const invalidNameWords = [
      'oi', 'olá', 'ola', 'bom', 'dia', 'boa', 'tarde', 'noite',
      'sim', 'não', 'nao', 'ok', 'tudo', 'bem', 'como', 'quem',
      'qual', 'porque', 'por', 'que', 'quando', 'onde', 'como',
      'certo', 'errado', 'talvez', 'obrigado', 'obrigada',
      // Adicionando mais palavras comuns que não são nomes
      'hey', 'hello', 'hi', 'tchau', 'até', 'logo', 'fala', 'aí',
      'cara', 'mano', 'brother', 'amigo', 'amiga', 'pessoal',
      'galera', 'turma', 'gente', 'vocês', 'você', 'eu', 'meu',
      'minha', 'nosso', 'nossa', 'dele', 'dela', 'deles', 'delas',
      'aqui', 'ali', 'lá', 'hoje', 'ontem', 'amanhã', 'agora',
      'sempre', 'nunca', 'talvez', 'quiçá', 'certamente'
    ];
    
    // Verificar se o nome contém apenas palavras da lista de palavras inválidas
    const words = trimmedName.toLowerCase().split(/\s+/);
    if (words.every(word => invalidNameWords.includes(word))) {
      return false;
    }
    
    // 🔥 MELHORIA: Verificação mais rigorosa de caracteres especiais
    const specialCharsRegex = /[^a-zA-ZÀ-ÖØ-öø-ÿ\s]/g;
    const specialCharsCount = (trimmedName.match(specialCharsRegex) || []).length;
    // Reduzindo a tolerância para 20% em vez de 30%
    if (specialCharsCount > trimmedName.length * 0.2) {
      return false;
    }
    
    // 🔥 NOVA VALIDAÇÃO: Verificar se não é apenas números
    if (/^\d+$/.test(trimmedName.replace(/\s/g, ''))) {
      return false;
    }
    
    // 🔥 NOVA VALIDAÇÃO: Verificar se não é um texto muito longo (provável descrição)
    if (trimmedName.length > 50) {
      return false;
    }
    
    return true;
  }

  // --- Ordem de Prioridade para Nome MELHORADA ---
  let fullNameToUse = null;

  // 🔥 PRIORIDADE 1: Nome do Perfil (Pushname) do Contato - MAIS ALTA PRIORIDADE
  const pushName = contact?.pushname;
  if (
    pushName &&
    typeof pushName === "string" &&
    pushName.trim().length > 1 &&
    isValidName(pushName)
  ) {
    const fullName = pushName.trim();
    logger.trace(`[State Mgr GetName] ✅ Usando pushname: "${fullName}"`, chatId);
    fullNameToUse = fullName;
  }

  // 🔥 PRIORIDADE 2: Nome do Chat (geralmente igual ao pushname ou nome salvo)
  if (!fullNameToUse) {
    const chatName = chat?.name;
    if (
      chatName &&
      typeof chatName === "string" &&
      chatName.trim().length > 1 &&
      !chatName.includes("@") && // Evitar pegar o próprio número como nome
      !chatName.includes("+") && // Evitar números de telefone
      !/^\+?\d+/.test(chatName) && // Evitar strings que começam com números
      isValidName(chatName)
    ) {
      const fullName = chatName.trim();
      logger.trace(`[State Mgr GetName] ✅ Usando chat.name: "${fullName}"`, chatId);
      fullNameToUse = fullName;
    }
  }

  // 🔥 PRIORIDADE 3: Notify Name da Mensagem (nome que aparece na notificação)
  if (!fullNameToUse) {
    const notifyName = messageOrInfo.notifyName;
    if (
      notifyName &&
      typeof notifyName === "string" &&
      notifyName.trim().length > 1 &&
      !notifyName.includes("@") && // Evitar emails/usernames
      !notifyName.includes("+") && // Evitar números de telefone
      !/^\+?\d+/.test(notifyName) && // Evitar strings que começam com números
      isValidName(notifyName)
    ) {
      const fullName = notifyName.trim();
      logger.trace(`[State Mgr GetName] ✅ Usando notifyName: "${fullName}"`, chatId);
      fullNameToUse = fullName;
    }
  }

  // 🔥 PRIORIDADE 4: Nome do Contato Salvo na Agenda (se disponível no objeto Contact)
  if (!fullNameToUse) {
    const contactNameSaved = contact?.name;
    if (
      contactNameSaved &&
      typeof contactNameSaved === "string" &&
      contactNameSaved.trim().length > 1 &&
      !contactNameSaved.includes("@") && // Evitar emails
      !contactNameSaved.includes("+") && // Evitar números de telefone
      !/^\+?\d+/.test(contactNameSaved) && // Evitar strings que começam com números
      isValidName(contactNameSaved)
    ) {
      const fullName = contactNameSaved.trim();
      logger.trace(`[State Mgr GetName] ✅ Usando contact.name: "${fullName}"`, chatId);
      fullNameToUse = fullName;
    }
  }

  // 🔥 PRIORIDADE 5: Nome do Estado Persistido (último recurso antes do fallback)
  if (!fullNameToUse) {
    try {
      const state = await getChatState(chatId); // Pode ler do DB
      if (state?.name && !state.name.startsWith(DEFAULT_LEAD_PREFIX) && isValidName(state.name)) {
        logger.trace(`[State Mgr GetName] ✅ Usando state.name: "${state.name}"`, chatId);
        fullNameToUse = state.name.trim();
      }
    } catch (e) {
        logger.warn(`[State Mgr GetName] Erro ao buscar nome no state para ${chatId}`, e.message);
    }
  }

  // 🔥 PROCESSAMENTO FINAL DO NOME
  let finalName = fullNameToUse || fallbackName;
  
  // Se encontrou um nome válido, extrair apenas o primeiro nome para uso
  if (fullNameToUse && !fullNameToUse.startsWith(DEFAULT_LEAD_PREFIX)) {
    // Separar em palavras e pegar o primeiro nome válido
    const words = fullNameToUse.split(' ').filter(word => word.length > 1);
    if (words.length > 0) {
      // Usar apenas o primeiro nome (mais natural em conversas)
      const firstName = words[0];
      
      // Capitalizar corretamente
      finalName = firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase();
      
      logger.debug(`[State Mgr GetName] 🎯 Nome final extraído: "${finalName}" (original: "${fullNameToUse}")`, chatId);
    }
    
    // Atualizar o estado com o nome completo capturado
    await updateState(chatId, { 
      name: finalName, // Primeiro nome
      fullName: fullNameToUse // Nome completo
    });
    logger.trace(`[State Mgr GetName] 💾 Nome completo salvo: "${fullNameToUse}" | Primeiro nome: "${finalName}"`, chatId);
  }

  return finalName;
}

/**
 * Bloqueia um usuário por spam.
 * @param {WAChat | null} chat - Objeto chat.
 * @param {string} chatId - ID do chat.
 * @param {string} contactName - Nome do contato.
 * @param {string} reason - Motivo.
 * @param {object} [details={}] - Detalhes.
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant.
 * @returns {Promise<void>}
 */
async function blockUserForSpam(
  chat,
  chatId,
  contactName,
  reason,
  details = {},
  tenantId = DEFAULT_TENANT_ID
) {
  // Handle cases where an object with chatId property is passed instead of a string
  if (typeof chatId === 'object' && chatId !== null) {
    if (chatId.chatId && typeof chatId.chatId === 'string') {
      chatId = chatId.chatId;
    } else if (chatId.id && typeof chatId.id === 'string') {
      chatId = chatId.id;
    } else if (chatId.from && typeof chatId.from === 'string') {
      chatId = chatId.from;
    } else if (chatId.to && typeof chatId.to === 'string') {
      chatId = chatId.to;
    } else {
      // If we have an object but can't find a valid ID property, log the structure
      logger.error(
        "[State Mgr Spam] Objeto de chatId não contém propriedade válida de ID",
        null,
        { objectStructure: JSON.stringify(chatId).substring(0, 200) }
      );
      return;
    }
  }

  // Explicitly reject group chats (ending with @g.us)
  if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
    logger.error(
      "[State Mgr Spam] Tentativa de bloquear um grupo. Grupos não são suportados.",
      null,
      { chatId }
    );
    return;
  }

  const state = await getChatState(chatId, contactName, tenantId);
  if (!state) return;

  const now = Date.now();
  if (state.isBlockedUntil && now < state.isBlockedUntil) return; // Já bloqueado

  const blockDurationMinutes = botConfig.behavior.antiSpam.blockDurationMinutes;
  const blockUntilTimestamp = now + blockDurationMinutes * 60 * 1000;

  // Atualiza estado no DB (incluindo limpeza dos arrays de timestamp)
  const updated = await updateState(
    chatId,
    {
      isBlockedUntil: blockUntilTimestamp,
      messageTimestamps: [],
      audioTimestamps: [],
      isProcessing: false, // Garante que para de processar
    },
    tenantId
  );

  if (!updated) {
    logger.error(
      `[State Mgr Spam] Falha ao persistir estado de bloqueio para ${contactName}.`,
      chatId
    );
    return;
  }

  logger.spam(contactName, chatId, reason, {
    // Usa logger específico
    durationMin: blockDurationMinutes,
    blockedUntil: new Date(blockUntilTimestamp).toISOString(),
    ...details,
  });

  // Envia notificação de bloqueio
  const blockMessage = botConfig.behavior.errorHandling.blockedSpam(
    contactName,
    blockDurationMinutes
  );
  if (blockMessage) {
    const sentOk = await responseSender.sendMessages(
      chat,
      chatId,
      contactName,
      [blockMessage],
      false
    );
    const historyMsg = sentOk
      ? `[Sistema: Usuário BLOQUEADO (${reason}) por ${blockDurationMinutes} min. Notificação enviada.]`
      : `[Sistema: Usuário BLOQUEADO (${reason}) por ${blockDurationMinutes} min. FALHA ao enviar notificação.]`;
    await addMessageToHistory(
      chatId,
      "system",
      historyMsg,
      undefined,
      {},
      tenantId
    );
  } else {
    await addMessageToHistory(
      chatId,
      "system",
      `[Sistema: Usuário BLOQUEADO (${reason}) por ${blockDurationMinutes} min (sem notificação).]`,
      undefined,
      {},
      tenantId
    );
  }
  try {
    if (chat?.clearState) await chat.clearState();
  } catch {
    /* Ignore */
  }
}

/**
 * Ativa o modo de takeover humano.
 * @param {string} chatId - ID do chat.
 * @param {string} [actorName="Agente Humano"] - Quem ativou.
 * @param {string | null} [contactNameHint=null] - Nome do contato.
 * @param {string} [tenantId=DEFAULT_TENANT_ID] - ID do Tenant.
 * @returns {Promise<void>}
 */
async function activateHumanTakeover(
  chatId,
  actorName = "Agente Humano",
  contactNameHint = null,
  tenantId = DEFAULT_TENANT_ID
) {
  // Handle cases where an object with chatId property is passed instead of a string
  if (typeof chatId === 'object' && chatId !== null) {
    if (chatId.chatId && typeof chatId.chatId === 'string') {
      chatId = chatId.chatId;
    } else if (chatId.id && typeof chatId.id === 'string') {
      chatId = chatId.id;
    } else if (chatId.from && typeof chatId.from === 'string') {
      chatId = chatId.from;
    } else if (chatId.to && typeof chatId.to === 'string') {
      chatId = chatId.to;
    } else {
      // If we have an object but can't find a valid ID property, log the structure
      logger.error(
        "[State Mgr Takeover] Objeto de chatId não contém propriedade válida de ID",
        null,
        { objectStructure: JSON.stringify(chatId).substring(0, 200) }
      );
      return;
    }
  }

  // Explicitly reject group chats (ending with @g.us)
  if (typeof chatId === 'string' && chatId.endsWith('@g.us')) {
    logger.error(
      "[State Mgr Takeover] Tentativa de ativar takeover para um grupo. Grupos não são suportados.",
      null,
      { chatId }
    );
    return;
  }

  const state = await getChatState(chatId, contactNameHint, tenantId);
  if (!state) {
    logger.error(
      "[State Mgr Takeover] Falha CRÍTICA obter/criar estado ao ativar takeover.",
      null,
      { chatId }
    );
    return;
  }

  const pauseDurationMinutes =
    botConfig.behavior.humanTakeover.pauseDurationMinutes;
  const now = Date.now();
  const wasActive = state.humanTakeoverUntil && state.humanTakeoverUntil > now;
  const newTakeoverUntil = now + pauseDurationMinutes * 60 * 1000;

  const updated = await updateState(
    chatId,
    {
      humanTakeoverUntil: newTakeoverUntil,
      isProcessing: false, // Garante que para
    },
    tenantId
  );

  if (!updated) {
    logger.error(
      `[State Mgr Takeover] Falha ao persistir estado de takeover para ${state.name}.`,
      chatId
    );
    return;
  }

  const actionType = wasActive ? "Renovado" : "Ativado";
  logger.takeover(actorName, state.name, chatId, pauseDurationMinutes); // Logger específico
  await addMessageToHistory(
    chatId,
    "system",
    `[Sistema: Takeover ${actionType.toLowerCase()} por ${actorName}. Bot pausado até ${new Date(
      newTakeoverUntil
    ).toLocaleTimeString()}.]`,
    undefined,
    {},
    tenantId
  );
  logger.debug(
    `[State Mgr Takeover] ${actionType} para ${
      state.name
    }. Pausado até ${new Date(newTakeoverUntil).toLocaleTimeString()}.`,
    chatId
  );
}

// ================================================================
// ===         FUNÇÕES DE INTENÇÃO E OBJEÇÃO                  ===
// ================================================================

/**
 * Atualiza a intenção do usuário no estado.
 * @param {string} chatId - ID do chat.
 * @param {string | null} intent - A nova intenção detectada.
 * @returns {Promise<boolean>}
 */
async function updateUserIntent(chatId, intent) {
  try {
    const success = await updateState(chatId, { currentIntent: intent });
    if (success) {
      logger.info(`[State] Intenção do usuário atualizada para: ${intent}`, chatId);
    } else {
      logger.error(`[State] Falha ao atualizar intenção do usuário para: ${intent}`, chatId);
    }
    return success;
  } catch (error) {
    logger.error(`[State] Erro ao atualizar intenção do usuário: ${error.message}`, chatId, { error: serializeError(error) });
    return false;
  }
}

/**
 * Registra uma adaptação do fluxo no histórico.
 * @param {string} chatId - ID do chat.
 * @param {string} reason - Motivo da adaptação (ex: 'objection_handled', 'user_intent_changed').
 * @param {string} oldStep - ID da etapa anterior.
 * @param {string} newStep - ID da nova etapa para a qual o fluxo foi adaptado.
 * @returns {Promise<boolean>}
 */
async function logFlowAdaptation(chatId, adaptationDetails) {
  try {
    const state = await getChatState(chatId);
    if (!state) return false;

    // Garante que flowAdaptationHistory exista no estado antes de tentar adicionar.
    // getChatState deve inicializá-lo, mas esta é uma proteção adicional.
    const flowAdaptationHistory = state.flowAdaptationHistory || [];

    const { reason, oldStep, newStep, detectedIntent, confidence, previousNextStep, triggeringInput, objectionType, objectionRetryCount } = adaptationDetails;
    flowAdaptationHistory.push({
      timestamp: Date.now(),
      reason,
      oldStep,
      newStep,
      // Adiciona os campos opcionais se existirem
      ...(detectedIntent && { detectedIntent }),
      ...(confidence && { confidence }),
      ...(previousNextStep && { previousNextStep }),
      ...(triggeringInput && { triggeringInput }),
      ...(objectionType && { objectionType }),
      ...(objectionRetryCount !== undefined && { objectionRetryCount }), // Inclui se for 0
    });

    // Opcional: Limitar o tamanho do histórico de adaptação
    // const MAX_ADAPTATION_HISTORY = 10; // Defina um limite se necessário
    // if (flowAdaptationHistory.length > MAX_ADAPTATION_HISTORY) {
    //   flowAdaptationHistory.shift(); // Remove o mais antigo
    // }

    const success = await updateState(chatId, { flowAdaptationHistory });
    if (success) {
      logger.info(`[State] Adaptação de fluxo registrada: ${adaptationDetails.reason} (de ${adaptationDetails.oldStep} para ${adaptationDetails.newStep})`, chatId);
    } else {
      logger.error(`[State] Falha ao registrar adaptação de fluxo.`, chatId);
    }
    return success;
  } catch (error) {
    logger.error(`[State] Erro ao registrar adaptação de fluxo: ${error.message}`, chatId, { error: serializeError(error) });
    return false;
  }
}

// ================================================================
// ===           FUNÇÕES DE PREFERÊNCIA DE LINK                 ===
// ================================================================

/**
 * Atualiza a preferência de link no banco de dados (checkout vs salesPage)
 * @param {string} chatId - ID do chat
 * @param {boolean} useSalesPage - Se deve usar salesPage ao invés de checkout
 * @returns {Promise<boolean>} Sucesso da operação
 */
async function updateLinkPreference(chatId, useSalesPage) {
  try {
    const state = await getChatState(chatId);
    if (!state) {
      logger.warn(`[Link Preference] Estado não encontrado para atualizar preferência de link`, chatId);
      return false;
    }

    // Garante que metadata e contextFlags existem
    if (!state.metadata) {
      state.metadata = {};
    }
    if (!state.metadata.contextFlags) {
      state.metadata.contextFlags = {};
    }

    // Atualiza a flag usesSalesPageLink
    state.metadata.contextFlags.usesSalesPageLink = useSalesPage;

    const success = await updateState(chatId, { metadata: state.metadata });
    if (success) {
      logger.info(`[Link Preference] Preferência de link atualizada: usesSalesPageLink=${useSalesPage}`, chatId);
    }
    return success;
  } catch (error) {
    logger.error(`[Link Preference] Erro ao atualizar preferência de link: ${error.message}`, chatId, { error: serializeError(error) });
    return false;
  }
}

/**
 * Obtém a preferência de link do banco de dados
 * @param {string} chatId - ID do chat
 * @returns {Promise<boolean>} Se deve usar salesPage (true) ou checkout (false)
 */
async function getLinkPreference(chatId) {
  try {
    const state = await getChatState(chatId);
    return state?.metadata?.contextFlags?.usesSalesPageLink || false;
  } catch (error) {
    logger.error(`[Link Preference] Erro ao obter preferência de link: ${error.message}`, chatId);
    return false;
  }
}

// ================================================================
// ===           FUNÇÕES DE CONTEXTO CONVERSACIONAL             ===
// ================================================================

/**
 * Atualiza o contexto conversacional com informações sobre transições
 * @param {string} chatId - ID do chat
 * @param {Partial<ConversationContext>} contextUpdates - Atualizações do contexto
 * @returns {Promise<boolean>}
 */
async function updateConversationContext(chatId, contextUpdates) {
  try {
    const state = await getChatState(chatId);
    if (!state) {
      logger.warn(`[Context] Estado não encontrado para atualizar contexto conversacional`, chatId);
      return false;
    }

    // Garante que conversationContext existe
    if (!state.conversationContext) {
      state.conversationContext = {
        userPainPoints: [],
  
        communicationStyle: 'casual',
        urgencyLevel: 'medium',
        previousStepId: null,
        informationShared: {
          pricing: false,
          benefits: false,
          testimonials: false,
          planDetails: false
        },
        lastTransitionReason: null
      };
    }

    // Merge das atualizações
    const updatedContext = {
      ...state.conversationContext,
      ...contextUpdates
    };

    // Se informationShared está sendo atualizado, faz merge dos objetos
    if (contextUpdates.informationShared) {
      updatedContext.informationShared = {
        ...state.conversationContext.informationShared,
        ...contextUpdates.informationShared
      };
    }

    const success = await updateState(chatId, { conversationContext: updatedContext });
    if (success) {
      logger.info(`[Context] Contexto conversacional atualizado`, chatId);
    }
    return success;
  } catch (error) {
    logger.error(`[Context] Erro ao atualizar contexto conversacional: ${error.message}`, chatId, { error: serializeError(error) });
    return false;
  }
}

/**
 * Adiciona um ponto de dor do usuário ao contexto
 * @param {string} chatId - ID do chat
 * @param {string} painPoint - Problema mencionado pelo usuário
 * @returns {Promise<boolean>}
 */
async function addUserPainPoint(chatId, painPoint) {
  try {
    const state = await getChatState(chatId);
    if (!state?.conversationContext) return false;

    const userPainPoints = [...(state.conversationContext.userPainPoints || []), painPoint];
    // Remove duplicatas
    const uniquePainPoints = [...new Set(userPainPoints)];
    
    return await updateConversationContext(chatId, { userPainPoints: uniquePainPoints });
  } catch (error) {
    logger.error(`[Context] Erro ao adicionar ponto de dor: ${error.message}`, chatId);
    return false;
  }
}

/**
 * Marca uma informação como já compartilhada
 * @param {string} chatId - ID do chat
 * @param {string} infoType - Tipo de informação ('pricing'|'benefits'|'testimonials'|'planDetails')
 * @returns {Promise<boolean>}
 */
async function markInformationAsShared(chatId, infoType) {
  try {
    const validTypes = ['pricing', 'benefits', 'testimonials', 'planDetails'];
    if (!validTypes.includes(infoType)) {
      logger.warn(`[Context] Tipo de informação inválido: ${infoType}`, chatId);
      return false;
    }

    return await updateConversationContext(chatId, {
      informationShared: { [infoType]: true }
    });
  } catch (error) {
    logger.error(`[Context] Erro ao marcar informação como compartilhada: ${error.message}`, chatId);
    return false;
  }
}

/**
 * Registra uma transição entre etapas com contexto
 * @param {string} chatId - ID do chat
 * @param {string} fromStepId - Etapa de origem
 * @param {string} toStepId - Etapa de destino
 * @param {string} reason - Motivo da transição
 * @returns {Promise<boolean>}
 */
async function recordStepTransition(chatId, fromStepId, toStepId, reason) {
  try {
    return await updateConversationContext(chatId, {
      previousStepId: fromStepId,
      lastTransitionReason: reason
    });
  } catch (error) {
    logger.error(`[Context] Erro ao registrar transição: ${error.message}`, chatId);
    return false;
  }
}

/**
 * Obtém o contexto conversacional atual
 * @param {string} chatId - ID do chat
 * @returns {Promise<ConversationContext|null>}
 */
async function getConversationContext(chatId) {
  try {
    const state = await getChatState(chatId);
    return state?.conversationContext || null;
  } catch (error) {
    logger.error(`[Context] Erro ao obter contexto conversacional: ${error.message}`, chatId);
    return null;
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

// Exporta as funções E a função de detecção de spam
export default {
  getChatState,
  updateState,
  getContactName,
  addMessageToHistory,
  activateHumanTakeover,
  isSpamDetected,
  blockUserForSpam,
  updateContactName,
  updatePreferredName,
  getDisplayName,
  // Novas funções de rastreamento de etapas
  markStepAsCompleted,
  getCompletedStep,
  getAllCompletedSteps,
  getCollectedUserData,
  canSkipStep, // Adicionado para futura implementação de lógica de pulo de etapas

  // Funções de Intenção e Adaptação de Fluxo
  updateUserIntent,
  logFlowAdaptation,
  
  // Funções de preferência de link
  updateLinkPreference,
  getLinkPreference,
  
  // Funções de contexto conversacional
  updateConversationContext,
  addUserPainPoint,
  markInformationAsShared,
  recordStepTransition,
  getConversationContext,
  
  // Funções de proteção de etapas críticas
  protectCriticalStep,
  isCriticalStepProtected,
  removeCriticalStepProtection,
  isCriticalStep,
};

// Named exports for individual functions
export {
  getChatState,
  updateState,
  getContactName,
  addMessageToHistory,
  activateHumanTakeover,
  isSpamDetected,
  blockUserForSpam,
  updateContactName,
  updatePreferredName,
  getDisplayName,
  markStepAsCompleted,
  getCompletedStep,
  getAllCompletedSteps,
  getCollectedUserData,
  canSkipStep,
  updateUserIntent,
  logFlowAdaptation,
  updateConversationContext,
  addUserPainPoint,
  markInformationAsShared,
  recordStepTransition,
  getConversationContext,
  protectCriticalStep,
  isCriticalStepProtected,
  removeCriticalStepProtection,
  isCriticalStep,
};