/**
 * criticalStepExecutor.js - Executor de Etapas Críticas
 * =====================================================
 * 
 * Responsável por executar etapas críticas de forma protegida,
 * garantindo que não sejam interrompidas por race conditions.
 * 
 * Etapas críticas incluem:
 * - CLOSE_DEAL (envio do link de compra)
 * - UPSELL_CLOSE (fechamento de upsell)
 * - DOWNSELL_CLOSE (fechamento de downsell)
 * - POST_PURCHASE_FOLLOWUP (acompanhamento pós-compra)
 */

import logger from './logger.js';
import stateManager from './stateManager.js';
import salesFunnelBluePrint from './salesFunnelBluePrint.js';
import * as aiProcessor from './aiProcessor.js';
import { serializeError } from 'serialize-error';

/**
 * Executa uma etapa crítica de forma protegida
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa crítica
 * @param {object} trainingData - Dados de treinamento
 * @param {object} options - Opções adicionais
 * @returns {Promise<boolean>} - Sucesso da execução
 */
async function executeCriticalStep(chatId, stepId, trainingData, options = {}) {
  const chatIdStr = chatId.replace('@c.us', '');
  
  try {
    logger.info(`[Critical Executor] Iniciando execução da etapa crítica ${stepId} para ${chatIdStr}`);
    
    // Verificar se a etapa é realmente crítica
    if (!stateManager.isCriticalStep(stepId)) {
      logger.warn(`[Critical Executor] Etapa ${stepId} não é crítica. Ignorando execução.`);
      return false;
    }
    
    // Obter estado atual
    const state = await stateManager.getChatState(chatId);
    if (!state) {
      throw new Error(`Estado não encontrado para ${chatId}`);
    }
    
    // Verificar se ainda está na etapa crítica
    if (state.currentFunnelStepId !== stepId) {
      logger.info(`[Critical Executor] Chat ${chatIdStr} não está mais na etapa ${stepId}. Etapa atual: ${state.currentFunnelStepId}`);
      return false;
    }
    
    // Obter blueprint da etapa
    const blueprint = salesFunnelBluePrint.getStepById(stepId);
    if (!blueprint) {
      throw new Error(`Blueprint não encontrado para etapa ${stepId}`);
    }
    
    // Verificar se a etapa não espera resposta do usuário
    if (blueprint.waitForUserResponse) {
      logger.info(`[Critical Executor] Etapa ${stepId} espera resposta do usuário. Não executando automaticamente.`);
      return false;
    }
    
    // Proteger a etapa contra interrupções
    stateManager.protectCriticalStep(chatId, stepId);
    
    // Simular mensagem vazia para forçar processamento da etapa
    const mockMessage = {
      body: '',
      from: chatId,
      timestamp: Date.now(),
      type: 'chat',
      _data: { 
        notifyName: state.contactName || 'Usuário',
        id: {
          fromMe: false,
          remote: chatId,
          id: `CRITICAL_EXEC_${Date.now()}`
        }
      },
      // Marcar como execução crítica
      _criticalExecution: true
    };
    
    logger.debug(`[Critical Executor] Processando etapa ${stepId} com IA para ${chatIdStr}`);
    
    // Processar com IA para executar a etapa
    await aiProcessor.processWithAI(
      chatId,
      mockMessage,
      trainingData,
      null, // chat object
      {
        forcedStepId: stepId,
        criticalExecution: true,
        skipUserResponseCheck: true
      }
    );
    
    logger.info(`[Critical Executor] Etapa crítica ${stepId} executada com sucesso para ${chatIdStr}`);
    
    // Remover proteção após execução bem-sucedida
    stateManager.removeCriticalStepProtection(chatId, stepId);
    
    return true;
    
  } catch (error) {
    logger.error(
      `[Critical Executor] Erro ao executar etapa crítica ${stepId} para ${chatIdStr}:`,
      serializeError(error)
    );
    
    // Remover proteção em caso de erro
    stateManager.removeCriticalStepProtection(chatId, stepId);
    
    return false;
  }
}

/**
 * Verifica se uma etapa crítica precisa ser executada
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa
 * @returns {Promise<boolean>} - Se precisa executar
 */
async function shouldExecuteCriticalStep(chatId, stepId) {
  try {
    // Verificar se é etapa crítica
    if (!stateManager.isCriticalStep(stepId)) {
      return false;
    }
    
    // Verificar se já está protegida
    if (stateManager.isCriticalStepProtected(chatId, stepId)) {
      logger.debug(`[Critical Executor] Etapa ${stepId} já está protegida para ${chatId}`);
      return false;
    }
    
    // Obter estado e blueprint
    const state = await stateManager.getChatState(chatId);
    if (!state || state.currentFunnelStepId !== stepId) {
      return false;
    }
    
    const blueprint = salesFunnelBluePrint.getStepById(stepId);
    if (!blueprint || blueprint.waitForUserResponse) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger.error(
      `[Critical Executor] Erro ao verificar se deve executar etapa ${stepId}:`,
      serializeError(error)
    );
    return false;
  }
}

/**
 * Agenda execução de etapa crítica com delay
 * @param {string} chatId - ID do chat
 * @param {string} stepId - ID da etapa
 * @param {object} trainingData - Dados de treinamento
 * @param {number} delayMs - Delay em milissegundos
 * @returns {Promise<void>}
 */
async function scheduleExecuteCriticalStep(chatId, stepId, trainingData, delayMs = 5000) {
  logger.info(`[Critical Executor] Agendando execução da etapa ${stepId} em ${delayMs}ms para ${chatId}`);
  
  setTimeout(async () => {
    try {
      const shouldExecute = await shouldExecuteCriticalStep(chatId, stepId);
      if (shouldExecute) {
        logger.info(`[Critical Executor] Executando etapa agendada ${stepId} para ${chatId}`);
        await executeCriticalStep(chatId, stepId, trainingData);
      } else {
        logger.debug(`[Critical Executor] Execução agendada cancelada para ${stepId} em ${chatId}`);
      }
    } catch (error) {
      logger.error(
        `[Critical Executor] Erro na execução agendada de ${stepId}:`,
        serializeError(error)
      );
    }
  }, delayMs);
}

export {
  executeCriticalStep,
  shouldExecuteCriticalStep,
  scheduleExecuteCriticalStep
};