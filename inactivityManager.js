import logger from './logger.js';
import * as stateManager from './stateManager.js';
import { generateInactivityMessageWithAI } from './aiProcessor.js';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { botConfig } from './botConfig.js';
import responseSender from './responseSender.js';
import salesFunnelBluePrint from './salesFunnelBluePrint.js';

const { getStepById } = salesFunnelBluePrint;

/**
 * Gerenciador de Inatividade
 * Monitora leads inativos e envia mensagens de reengajamento personalizadas
 */
class InactivityManager {
    constructor() {
        this.activeTimers = new Map(); // chatId -> timerId
        this.abortedFlows = new Set(); // ✅ NOVO: Armazena os fluxos de inatividade que devem ser abortados
        this.enabled = botConfig.behavior.inactivity.enabled;
        
        // ✅ NOVAS CONFIGURAÇÕES: Sistema de Etapas
        this.firstAttemptThreshold = botConfig.behavior.inactivity.firstAttemptThresholdMs;
        this.secondAttemptThreshold = botConfig.behavior.inactivity.secondAttemptThresholdMs;
        this.useAIForMessages = botConfig.behavior.inactivity.useAIForMessages;
        this.fallbackToTemplate = botConfig.behavior.inactivity.fallbackToTemplate;
        this.minTimeBetweenAttempts = botConfig.behavior.inactivity.minTimeBetweenAttempts;
        
        // ✅ BACKWARD COMPATIBILITY: Configurações antigas
        this.inactivityThreshold = this.firstAttemptThreshold; // Para compatibilidade
        this.maxReengagementAttempts = botConfig.behavior.inactivity.maxReengagementAttempts;
        this.reengagementInterval = botConfig.behavior.inactivity.reengagementIntervalMs;
        
        logger.info('InactivityManager inicializado com sistema de etapas', {
            enabled: this.enabled,
            firstAttemptThreshold: this.firstAttemptThreshold,
            secondAttemptThreshold: this.secondAttemptThreshold,
            useAIForMessages: this.useAIForMessages,
            fallbackToTemplate: this.fallbackToTemplate,
            maxReengagementAttempts: this.maxReengagementAttempts
        });
    }

    /**
     * Wrapper para chamar a IA usando a função interna do aiProcessor
     * @param {Array} messages - Array de mensagens
     * @param {string} chatId - ID do chat
     * @param {Object} options - Opções adicionais
     * @returns {string|null} Resposta da IA ou null
     */
    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // async callAI(messages, chatId, options = {}) { ... }

    /**
     * Inicia o monitoramento de inatividade para um chat
     * @param {string} chatId - ID do chat
     * @param {string} [stage] - Etapa de inatividade ('first_attempt' ou 'second_attempt')
     */
    async startInactivityTimer(chatId, stage = null) {
        try {
            // Se o sistema de inatividade está desabilitado, ignora
            if (!this.enabled) return;

            // ✅ NOVO: Verifica se o lead está nas etapas de pós-venda antes de iniciar timer
            try {
                const chatState = await stateManager.getChatState(chatId, null, undefined, { updateInteractionTime: false });
                if (chatState && (chatState.currentFunnelStepId === 'POST_PURCHASE_FOLLOWUP' || chatState.currentFunnelStepId === 'GENERAL_SUPPORT')) {
                    logger.debug('⏹️ Timer de inatividade NÃO iniciado - lead está em etapa de pós-venda', {
                        chatId,
                        currentStep: chatState.currentFunnelStepId
                    });
                    return;
                }
            } catch (stateError) {
                logger.warn('⚠️ Erro ao verificar estado do funil para timer de inatividade', {
                    chatId,
                    error: stateError.message
                });
                // Continua com o timer mesmo com erro, para não quebrar funcionalidade
            }

            // ✅ NOVO: Ao iniciar um novo ciclo de inatividade, limpamos qualquer sinal de abort anterior.
            if (this.abortedFlows.has(chatId)) {
                this.abortedFlows.delete(chatId);
                logger.debug(`[Inactivity Mgr] Flag de abort anterior limpa para novo ciclo de inatividade`, { chatId });
            }

            // Se já existe um timer ativo, cancela-o antes de definir um novo
            if (this.activeTimers.has(chatId)) {
                clearTimeout(this.activeTimers.get(chatId));
                this.activeTimers.delete(chatId);
            }

            // Verifica se o sistema está habilitado
            if (!this.enabled) {
                logger.trace(`Timer de inatividade NÃO iniciado para ${chatId} (sistema desabilitado)`);
                return;
            }

            // Cancela timer existente se houver
            this.cancelInactivityTimer(chatId);

            // ✅ NOVO: Determina qual threshold usar baseado na etapa
            let threshold;
            let nextStage;
            
            if (stage === 'second_attempt') {
                threshold = this.secondAttemptThreshold;
                nextStage = 'second_attempt';
            } else {
                // Primeira tentativa ou não especificado
                threshold = this.firstAttemptThreshold;
                nextStage = 'first_attempt';
            }

            // ✅ NOVO: Atualiza o estado para indicar qual etapa será executada
            try {
                await stateManager.updateState(chatId, {
                    nextInactivityStage: nextStage,
                    inactivityTimerStartedAt: new Date().toISOString()
                });
            } catch (stateError) {
                logger.warn(`[Inactivity Timer] Erro ao atualizar estado para ${chatId}:`, stateError.message);
            }

            // Cria novo timer
            const timerId = setTimeout(async () => {
                await this.handleInactivity(chatId);
            }, threshold);

            this.activeTimers.set(chatId, timerId);
            
            logger.debug('Timer de inatividade iniciado', {
                chatId,
                stage: nextStage,
                threshold,
                timerCount: this.activeTimers.size
            });
        } catch (error) {
            logger.error('Erro ao iniciar timer de inatividade', {
                chatId,
                error: error.message
            });
        }
    }

    /**
     * Cancela o timer de inatividade para um chat
     * @param {string} chatId - ID do chat
     */
    cancelInactivityTimer(chatId) {
        if (this.activeTimers.has(chatId)) {
            clearTimeout(this.activeTimers.get(chatId));
            this.activeTimers.delete(chatId);
            logger.debug(`[Inactivity Mgr] Timer de inatividade cancelado`, { chatId });
        }
    }

    /**
     * Reinicia o timer de inatividade (chamado quando há nova interação)
     * @param {string} chatId - ID do chat
     */
    async resetInactivityTimer(chatId) {
        logger.debug('Timer de inatividade RESETADO (nova interação do usuário)', {
            chatId,
            activeTimers: this.activeTimers.size
        });

        // ✅ NOVO: Reseta estado de inatividade quando usuário responde
        try {
            await stateManager.updateState(chatId, {
                nextInactivityStage: null,
                currentInactivityStage: null,
                inactivityTimerStartedAt: null,
                inactivityStageCompletedAt: null,
                // Não resetamos reengagementAttempts aqui pois pode ser útil para análise
            });
        } catch (error) {
            logger.warn(`[Reset Inactivity] Erro ao resetar estado para ${chatId}:`, error.message);
        }

        // Inicia timer para primeira tentativa
        await this.startInactivityTimer(chatId, 'first_attempt');
    }

    /**
     * Manipula a inatividade detectada
     * @param {string} chatId - ID do chat inativo
     */
    async handleInactivity(chatId) {
        try {
            logger.info('🔔 [INATIVIDADE] DETECTADA', { 
                chatId,
                thresholdMs: this.inactivityThreshold,
                activeTimers: this.activeTimers.size
            });

            // CRÍTICO: Verifica se há mensagens no buffer aguardando processamento
            const hasUnprocessedMessages = await this.hasMessagesInBuffer(chatId);
            if (hasUnprocessedMessages) {
                logger.info('⏸️ [INATIVIDADE] CANCELADA - mensagens no buffer aguardando processamento', { 
                    chatId,
                    action: 'restarting_timer'
                });
                // Reinicia timer para aguardar processamento completar
                this.startInactivityTimer(chatId);
                return;
            }

            // Obtém estado atual do chat sem atualizar o timestamp de interação
            // 🔥 CORREÇÃO CRÍTICA: Passa 'updateInteractionTime: false' para evitar o loop de "falso positivo".
            const chatState = await stateManager.getChatState(chatId, null, undefined, { updateInteractionTime: false });
            if (!chatState) {
                logger.warn('❌ [INATIVIDADE] Estado do chat não encontrado para inatividade', { chatId });
                return;
            }

            logger.info(`📊 [INATIVIDADE] Estado atual: attempts=${chatState.reengagementAttempts || 0}, stage=${chatState.nextInactivityStage || 'first_attempt'}, lastReengagement=${chatState.lastReengagementMessageSentAt || 'nunca'}`, { chatId });

            // Verifica se está processando mensagens
            if (chatState.isProcessing) {
                logger.info('⏸️ [INATIVIDADE] CANCELADA - chat está processando mensagens', { 
                    chatId,
                    action: 'restarting_timer'
                });
                // Reinicia timer para aguardar processamento completar
                this.startInactivityTimer(chatId);
                return;
            }

            // 🔥 NOVA VERIFICAÇÃO: Verifica se há atividade muito recente do usuário
            if (await this.hasRecentUserActivity(chatId, chatState)) {
                logger.info('⏸️ [INATIVIDADE] CANCELADA - atividade recente detectada', { 
                    chatId,
                    action: 'restarting_timer'
                });
                // Reinicia timer para aguardar mais tempo
                this.startInactivityTimer(chatId);
                return;
            }

            // 🔥 NOVA VERIFICAÇÃO: Verifica se uma mensagem de reengajamento foi enviada recentemente
            if (this.isReengagementTooRecent(chatState)) {
                logger.info('⏸️ [INATIVIDADE] CANCELADA - reengajamento muito recente', { 
                    chatId,
                    lastReengagement: chatState.lastReengagementMessageSentAt,
                    action: 'restarting_timer'
                });
                // Reinicia timer para aguardar mais tempo
                this.startInactivityTimer(chatId);
                return;
            }
            
            logger.info('✅ [INATIVIDADE] Todas as verificações passaram, prosseguindo com reengajamento', { chatId });

            // ✅ NOVO: Determina qual etapa de inatividade deve ser executada
            const currentStage = chatState.nextInactivityStage || 'first_attempt';
            const currentAttempts = chatState.reengagementAttempts || 0;
            
            // Verifica se deve enviar mensagem de reengajamento
            if (!this.shouldSendReengagementMessage(chatState, currentStage)) {
                logger.info('⏭️ Reengajamento não necessário', {
                    chatId,
                    currentStage,
                    attempts: currentAttempts,
                    maxAttempts: this.maxReengagementAttempts,
                    isBlocked: chatState.isBlockedUntil && new Date() < new Date(chatState.isBlockedUntil),
                    hasTakeover: chatState.humanTakeoverUntil && new Date() < new Date(chatState.humanTakeoverUntil)
                });
                return;
            }

            // ✅ NOVO: Gera e envia mensagem de reengajamento usando IA ou template
            logger.info('📤 Iniciando envio de reengajamento', { 
                chatId, 
                stage: currentStage,
                attempt: currentAttempts + 1
            });
            await this.sendReengagementMessage(chatId, chatState, currentStage);

        } catch (error) {
            logger.error('❌ Erro ao manipular inatividade', {
                chatId,
                error: error.message
            });
        }
    }

    /**
     * Verifica se deve enviar mensagem de reengajamento
     * @param {Object} chatState - Estado do chat
     * @param {string} currentStage - Etapa atual ('first_attempt' ou 'second_attempt')
     * @returns {boolean}
     */
    shouldSendReengagementMessage(chatState, currentStage = 'first_attempt') {
        // ✅ NOVO: Não envia mensagens de inatividade após as etapas de pós-venda
        if (chatState.currentFunnelStepId === 'POST_PURCHASE_FOLLOWUP' || chatState.currentFunnelStepId === 'GENERAL_SUPPORT') {
            logger.debug('⏹️ Sistema de inatividade desativado - lead está em etapa de pós-venda', {
                chatId: chatState.chatId || 'unknown',
                currentStep: chatState.currentFunnelStepId
            });
            return false;
        }

        // Não envia se estiver em takeover humano
        if (chatState.humanTakeoverUntil && new Date() < new Date(chatState.humanTakeoverUntil)) {
            return false;
        }

        // Não envia se estiver bloqueado
        if (chatState.isBlockedUntil && new Date() < new Date(chatState.isBlockedUntil)) {
            return false;
        }

        const attempts = chatState.reengagementAttempts || 0;
        
        // ✅ NOVO: Controle baseado em etapas
        if (currentStage === 'first_attempt') {
            // Primeira tentativa: só pode enviar se ainda não enviou nenhuma
            return attempts === 0;
        } else if (currentStage === 'second_attempt') {
            // Segunda tentativa: só pode enviar se enviou exatamente 1
            if (attempts !== 1) {
                return false;
            }
            
            // Verifica intervalo mínimo entre tentativas
            if (chatState.lastReengagementAt) {
                const timeSinceLastReengagement = Date.now() - new Date(chatState.lastReengagementAt).getTime();
                if (timeSinceLastReengagement < this.minTimeBetweenAttempts) {
                    logger.debug(`⏸️ Muito cedo para 2ª tentativa: ${timeSinceLastReengagement}ms < ${this.minTimeBetweenAttempts}ms`);
                    return false;
                }
            }
            
            return true;
        }

        // ✅ FALLBACK: Usa lógica antiga para compatibilidade
        if (attempts >= this.maxReengagementAttempts) {
            return false;
        }

        // Verifica intervalo entre tentativas (lógica antiga)
        if (chatState.lastReengagementAt) {
            const timeSinceLastReengagement = Date.now() - new Date(chatState.lastReengagementAt).getTime();
            if (timeSinceLastReengagement < this.reengagementInterval) {
                return false;
            }
        }

        return true;
    }

    /**
     * Envia mensagem de reengajamento para o lead
     * @param {string} chatId - ID do chat
     * @param {Object} chatState - Estado atual do chat
     * @param {string} currentStage - Etapa atual de inatividade
     */
    async sendReengagementMessage(chatId, chatState, currentStage = 'first_attempt') {
        try {
            logger.info('📤 Iniciando envio de reengajamento', { 
                chatId, 
                stage: currentStage,
                useAI: this.useAIForMessages
            });

            // Define flag para indicar que reengajamento está sendo enviado
            await stateManager.updateState(chatId, {
                isReengagementMessageBeingSent: true,
                lastReengagementAttemptAt: new Date().toISOString(),
                currentInactivityStage: currentStage
            });

            const attemptNumber = (chatState.reengagementAttempts || 0) + 1;
            let reengagementMessage = null;

            // ✅ NOVO: Tenta gerar mensagem usando IA primeiro
            if (this.useAIForMessages) {
                try {
                    logger.debug('🤖 Tentando gerar mensagem com IA', { 
                        chatId, 
                        attempt: attemptNumber,
                        currentStepId: chatState.currentFunnelStepId 
                    });

                    const aiContext = {
                        chatId,
                        chatState,
                        attemptNumber,
                        currentStepId: chatState.currentFunnelStepId || 'GREETING_NEW',
                        trainingData: null // Pode ser passado se necessário
                    };

                    reengagementMessage = await generateInactivityMessageWithAI(aiContext);
                    
                    if (reengagementMessage) {
                        logger.info('✅ Mensagem gerada pela IA com sucesso', { 
                            chatId,
                            messageLength: reengagementMessage.length,
                            preview: reengagementMessage.substring(0, 50) + '...'
                        });
                    }
                } catch (aiError) {
                    logger.warn('⚠️ Erro ao gerar mensagem com IA, usando fallback', {
                        chatId,
                        error: aiError.message
                    });
                }
            }

            // ✅ FALLBACK: Usa template apenas se a IA falhou ou está desabilitada
            if (!reengagementMessage) { // Se a IA não gerou mensagem
                if (this.fallbackToTemplate) {
                logger.debug('📝 Usando template de fallback', { chatId });
                
                const context = { 
                    chatState: chatState, 
                    reengagementAttempt: attemptNumber,
                    stepId: chatState.currentFunnelStepId || 'GREETING_NEW',
                    urgencyLevel: attemptNumber === 1 ? 'normal' : 'high'
                };
                reengagementMessage = this.getSmartFallbackMessage(context);
                
                                    logger.info('📤 Usando mensagem de template', { 
                        chatId,
                        messagePreview: reengagementMessage.substring(0, 50) + '...',
                        displayName: this.getDisplayNameForInactivity(chatState)
                    });
                } else {
                    logger.warn('⚠️ Fallback desabilitado e IA falhou. Nenhuma mensagem será enviada.', { chatId });
                }
            }

            // Verifica se conseguiu gerar alguma mensagem
            if (!reengagementMessage) {
                logger.error('❌ Não foi possível gerar mensagem de reengajamento', { chatId });
                return false;
            }

            // ✅ MELHORIA: Garante a formatação com quebra de linha dupla
            // Primeiro substitui %%MSG_BREAK%% por \n\n, depois pontuações seguidas de espaço
            reengagementMessage = reengagementMessage
                .replace(/%%MSG_BREAK%%/g, '\n\n')
                .replace(/([.?!])\s+/g, '$1\n\n')
                .trim();

            logger.debug('📝 Mensagem final formatada', {
                chatId,
                message: JSON.stringify(reengagementMessage)
            });

            // ✅ VERIFICAÇÃO CRÍTICA: Checa se o fluxo foi abortado após a geração da mensagem (que pode demorar)
            if (this.abortedFlows.has(chatId)) {
                this.abortedFlows.delete(chatId); // Limpa o flag
                logger.info(`[Inactivity Mgr] Envio de reengajamento CANCELADO para ${chatId} porque o usuário respondeu durante o processamento.`, { chatId });
                return false; // Aborta o envio
            }

            // Salva a mensagem que será enviada para comparação posterior
            await stateManager.updateState(chatId, {
                lastReengagementMessage: reengagementMessage,
                lastReengagementMessageSentAt: new Date().toISOString()
            });
            
            // Envia a mensagem
            const contactName = this.getDisplayNameForInactivity(chatState);
            const success = await responseSender.sendMessages(
                null, // chat objeto - pode ser null para reengajamento
                chatId,
                contactName,
                [reengagementMessage],
                false // não tentar TTS
            );
            
            if (success) {
                // ✅ NOVO: Atualiza estado com informações da etapa
                await this.updateReengagementState(chatId, chatState, currentStage);
            
                logger.info('✅ Mensagem de reengajamento enviada com sucesso', { 
                    chatId,
                    stage: currentStage,
                    attempt: attemptNumber,
                    messagePreview: reengagementMessage.substring(0, 50) + '...'
                });
            
                // ✅ NOVO: Configura próximo timer se necessário
                await this.scheduleNextAttemptIfNeeded(chatId, chatState, currentStage);
                
                // Limpa buffer de mensagens para evitar processamento duplo
                this.clearMessageBuffer(chatId);
                
                return true;
            } else {
                logger.error('❌ Falha ao enviar mensagem de reengajamento', { chatId });
                return false;
            }
            
        } catch (error) {
            logger.error('❌ Erro no envio de reengajamento', {
                error: error.message,
                chatId
            });
            return false;
        } finally {
            // Remove flag de envio
            try {
                await stateManager.updateState(chatId, {
                    isReengagementMessageBeingSent: false
                });
            } catch (flagError) {
                logger.error('❌ Erro ao limpar flag de reengajamento', {
                    error: flagError.message,
                    chatId
            });
            }
        }
    }

    /**
     * Constrói contexto rico para geração de mensagem de reengajamento
     * @param {Object} chatState - Estado atual do chat
     * @param {string} chatId - ID do chat
     * @returns {Object} Contexto completo
     */
    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // buildReengagementContext(chatState, chatId) { ... }

    // ✅ FUNÇÕES AUXILIARES REMOVIDAS - NÃO MAIS NECESSÁRIAS (mensagens diretas)
    // getTimeOfDay() { ... }
    // getStepProgress(stepId) { ... }
    // calculateProgressPercentage(stepId) { ... }

    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // async generateReengagementMessage(context) { ... }

    /**
     * Atualiza estado do chat após envio de reengajamento
     * @param {string} chatId - ID do chat
     * @param {Object} chatState - Estado atual do chat
     * @param {string} currentStage - Etapa atual de inatividade
     */
    async updateReengagementState(chatId, chatState, currentStage = 'first_attempt') {
        const newAttempts = (chatState.reengagementAttempts || 0) + 1;
        
        const updates = {
            reengagementAttempts: newAttempts,
            lastReengagementAt: new Date().toISOString(),
            lastInteractionTimestamp: new Date().toISOString(),
            currentInactivityStage: currentStage,
            inactivityStageCompletedAt: new Date().toISOString()
        };

        // ✅ NOVO: Marca como max_reached se atingiu o limite
        if (newAttempts >= this.maxReengagementAttempts) {
            updates.inactivityStage = 'max_reached';
            updates.maxReengagementReachedAt = new Date().toISOString();
            logger.debug(`📊 Máximo de tentativas atingido para ${chatId}: ${newAttempts}/${this.maxReengagementAttempts}`);
        }
        
        await stateManager.updateState(chatId, updates);
    }

    /**
     * Agenda próxima tentativa de reengajamento se necessário
     * @param {string} chatId - ID do chat
     * @param {Object} chatState - Estado atual do chat
     * @param {string} currentStage - Etapa atual completada
     */
    async scheduleNextAttemptIfNeeded(chatId, chatState, currentStage) {
        const newAttempts = (chatState.reengagementAttempts || 0) + 1;
        
        // Se foi a primeira tentativa e ainda pode fazer a segunda
        if (currentStage === 'first_attempt' && newAttempts < this.maxReengagementAttempts) {
            logger.debug('⏳ Agendando segunda tentativa de reengajamento', { 
                chatId,
                afterMs: this.secondAttemptThreshold
            });
            
            // Agenda timer para segunda tentativa
            await this.startInactivityTimer(chatId, 'second_attempt');
            
        } else {
            logger.debug('🏁 Não há mais tentativas de reengajamento agendadas', { 
                chatId,
                currentStage,
                attempts: newAttempts,
                maxAttempts: this.maxReengagementAttempts
            });
        }
    }

    /**
     * Obtém estatísticas do sistema de inatividade
     * @returns {Object} Estatísticas
     */
    getStats() {
        return {
            activeTimers: this.activeTimers.size,
            inactivityThreshold: this.inactivityThreshold,
            maxReengagementAttempts: this.maxReengagementAttempts,
            reengagementInterval: this.reengagementInterval
        };
    }

    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // async generateWithOpenAI(prompt, context) { ... }

    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // async generateWithGemini(prompt, context) { ... }

    // ✅ FUNÇÕES REMOVIDAS - NÃO MAIS NECESSÁRIAS (mensagens diretas)
    // getOpenAIClient() { ... }
    // getGeminiClient() { ... }

    /**
     * Verifica se há mensagens no buffer aguardando processamento
     * @param {string} chatId - ID do chat
     * @returns {Promise<boolean>} Se há mensagens no buffer
     */
    async hasMessagesInBuffer(chatId) {
        try {
            // ✅ CORREÇÃO: Usar variável global em vez de import dinâmico
            if (typeof global.messageHandlerBufferInfo === 'function') {
                const bufferInfo = global.messageHandlerBufferInfo(chatId);
                const hasMessages = bufferInfo && bufferInfo.messageCount > 0;
                const isProcessing = bufferInfo && bufferInfo.isProcessing;
                
                logger.debug(`Buffer check para ${chatId}:`, {
                    hasMessages,
                    messageCount: bufferInfo?.messageCount || 0,
                    isProcessing: isProcessing || false,
                    bufferExists: !!bufferInfo
                });
                
                // Considera que há mensagens se:
                // 1. Há mensagens no buffer OU
                // 2. O buffer está atualmente processando
                return hasMessages || isProcessing;
            } else {
                logger.debug(`Função getBufferInfo não disponível globalmente para ${chatId} - assumindo sem buffer`);
                return false; // Assume que não há buffer se função não estiver disponível
            }
        } catch (error) {
            logger.warn(`Erro ao verificar buffer para ${chatId}:`, error.message);
            return false; // Em caso de erro, não bloquear reengajamento
        }
    }

    /**
     * Limpa buffer de mensagens para evitar processamento duplo após reengajamento
     * @param {string} chatId - ID do chat
     */
    clearMessageBuffer(chatId) {
        try {
            // ✅ CORREÇÃO: Usar variável global em vez de import dinâmico
            if (typeof global.messageHandlerClearBuffer === 'function') {
                global.messageHandlerClearBuffer(chatId, 'Reengajamento enviado - evitando processamento duplo');
                logger.debug(`Buffer de mensagens limpo para ${chatId} após reengajamento`);
            } else {
                logger.debug(`Função clearProcessingBuffer não disponível globalmente para ${chatId}`);
            }
        } catch (error) {
            logger.warn(`Erro ao tentar limpar buffer para ${chatId}:`, error.message);
        }
    }

    /**
     * Limpa todos os timers ativos (usado no shutdown)
     */
    cleanup() {
        for (const [chatId, timerId] of this.activeTimers) {
            clearTimeout(timerId);
        }
        this.activeTimers.clear();
        logger.info('InactivityManager limpo - todos os timers cancelados');
    }

    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // isValidReengagementMessage(message, userName) { ... }

    /**
     * Obtém o nome correto para usar nas mensagens de inatividade
     * Prioridade: nome corrigido > nome preferido > primeiro nome do nome completo
     * @param {Object} chatState - Estado do chat
     * @returns {string} Nome a ser usado
     */
    getDisplayNameForInactivity(chatState) {
        let displayName = 'você';
        
        try {
            // 1ª Prioridade: Nome preferido (inclui correções)
            if (chatState.preferredName && 
                chatState.preferredName !== 'você' && 
                chatState.preferredName !== 'amigo(a)' && 
                !chatState.preferredName.startsWith('Lead-')) {
                displayName = chatState.preferredName;
                logger.debug('📝 Usando nome preferido/corrigido para inatividade', {
                    chatId: chatState.chatId,
                    preferredName: displayName
                });
                return displayName;
            }
            
            // 2ª Prioridade: Primeiro nome extraído do nome completo
            const fullName = chatState.fullName || chatState.name;
            if (fullName && 
                fullName !== 'você' && 
                fullName !== 'amigo(a)' && 
                !fullName.startsWith('Lead-')) {
                
                // Se o nome tem múltiplas palavras, usar apenas o primeiro nome
                const words = fullName.split(' ');
                if (words.length > 1) {
                    const firstWord = words[0];
                    // Verificar se primeira palavra parece um nome válido
                    if (firstWord.length >= 2 && 
                        !['quem', 'deus', 'palavra', 'atenção', 'felicidade', 'escuta'].includes(firstWord.toLowerCase())) {
                        displayName = firstWord;
                        logger.debug('📝 Usando primeiro nome do nome completo para inatividade', {
                            chatId: chatState.chatId,
                            fullName: fullName,
                            firstName: displayName
                        });
                    }
                } else {
                    // Se é apenas uma palavra, usar como está (desde que seja válida)
                    if (fullName.length >= 2 && fullName.length <= 20) {
                        displayName = fullName;
                        logger.debug('📝 Usando nome único para inatividade', {
                            chatId: chatState.chatId,
                            name: displayName
                        });
                    }
                }
            }
            
        } catch (error) {
            logger.warn('Erro ao obter nome para inatividade, usando fallback', {
                chatId: chatState.chatId,
                error: error.message
            });
        }
        
        return displayName;
    }

    /**
     * Fallback inteligente que usa mensagens estratégicas contextuais
     * @param {Object} context - Contexto da conversa
     * @returns {string} Mensagem de fallback contextual estratégica
     */
    getSmartFallbackMessage(context) {
        const { chatState, reengagementAttempt, stepId, urgencyLevel = 'normal' } = context;
        
        // ✅ NOVO: Usa lógica inteligente para obter o nome correto
        const displayName = this.getDisplayNameForInactivity(chatState);
        
        // ✅ FALLBACKS ESTRATÉGICOS SOFISTICADOS - ESTILO CONTEXTUAL
        const fallbackStrategies = {
            'NAME_CAPTURE_VALIDATION': [
                `${displayName}, você começou bem...

Já demonstrou interesse real em direito sucessório e isso é o primeiro passo.

${urgencyLevel === 'high' ? 'Esta pode ser sua última chance de ter acesso a essas informações.' : 'Fiquei pensando, ainda faz sentido continuarmos?'}`,
                `${displayName}, vi que você tem interesse em sucessório...

É uma área que pode fazer total diferença na sua carreira, principalmente agora.

${urgencyLevel === 'high' ? 'Não quero que você perca essa oportunidade.' : 'Será que vale continuarmos nossa conversa?'}`
            ],
            'GREETING_NEW': [
                `${displayName}, você chegou no momento certo...

Sucessório está em alta e poucos advogados dominam de verdade essa área.

${urgencyLevel === 'high' ? 'Esta pode ser sua última oportunidade de ter acesso ao que vou te mostrar.' : 'Fiquei pensando se ainda faz sentido te mostrar algumas coisas?'}`,
                `${displayName}, percebi que você busca algo diferenciado...

Tenho algumas informações bem específicas sobre sucessório que podem te interessar.

${urgencyLevel === 'high' ? 'Não quero que você perca essa chance única.' : 'Ainda faz sentido pra você?'}`
            ],
            'PROBLEM_EXPLORATION_INITIAL': [
                `${displayName}, você chegou pertinho de começar...

A gente já entendeu seu momento, seu sonho e foi por isso que mostrei um plano que realmente encaixa.

Fiquei pensando será que ainda faz sentido pra você?`,
                `${displayName}, vi que você tem interesse real em sucessório...

É uma área incrível e que pode mudar sua vida profissional completamente.

Será que vale a pena darmos continuidade?`
            ],
            'PROBLEM_EXPLORATION_DIFFICULTY': [
                `${displayName}, estávamos chegando no ponto crucial...

Já identificamos algumas dificuldades e eu tenho soluções bem específicas pra seu caso.

Será que ainda faz sentido continuarmos?`,
                `${displayName}, você chegou no momento mais importante...

Estava te mostrando exatamente como resolver as principais dificuldades do sucessório.

Fiquei pensando... isso ainda te interessa?`
            ],
            'PROBLEM_IMPACT': [
                `${displayName}, estávamos no ponto de virada...

Já entendemos o impacto que o sucessório pode ter na sua carreira e tenho a solução exata.

Fiquei pensando... ainda faz sentido pra você?`,
                `${displayName}, chegamos num momento decisivo...

Vi que você realmente quer crescer nessa área e tenho algo que pode te ajudar muito.

Será que vale a pena continuarmos?`
            ],
            'SOLUTION_PRESENTATION': [
                `${displayName}, você chegou no momento decisivo...

Já entendemos suas dificuldades e eu estava te mostrando exatamente como resolver tudo isso.

Fiquei pensando... isso ainda faz sentido no seu momento atual?`,
                `${displayName}, estávamos quase fechando algo muito bom...

Você viu a solução que realmente encaixa no seu caso e pode transformar sua carreira.

Será que ainda faz sentido pra você?`
            ]
        };
        
        const stepFallbacks = fallbackStrategies[stepId];
        if (stepFallbacks && stepFallbacks.length > 0) {
            // Alternar entre fallbacks diferentes para não parecer robótico
            const index = (reengagementAttempt - 1) % stepFallbacks.length;
            return stepFallbacks[index];
        }
        
        // ✅ FALLBACK GENÉRICO SOFISTICADO baseado na urgência
        return urgencyLevel === 'high' 
            ? `${displayName}, você chegou pertinho de algo muito bom...

Estávamos construindo algo que realmente pode fazer diferença na sua carreira.

Esta pode ser nossa última chance de conversarmos sobre isso.`
            : `${displayName}, vi que você tem interesse real...

Tenho algumas informações que podem ser muito valiosas para seu momento.

Será que vale a pena continuarmos?`;
    }

    // ✅ FUNÇÃO REMOVIDA - NÃO MAIS NECESSÁRIA (mensagens diretas)
    // async saveExtractedName(chatId, userName) { ... }

    /**
     * Verifica se há atividade muito recente do usuário
     * @param {string} chatId - ID do chat
     * @param {Object} chatState - Estado atual do chat
     * @returns {Promise<boolean>} Se há atividade recente
     */
    async hasRecentUserActivity(chatId, chatState) {
        try {
            const now = Date.now();
            
            // 1. Verifica timestamp da última interação
            if (chatState.lastInteractionTimestamp) {
                const lastInteraction = new Date(chatState.lastInteractionTimestamp).getTime();
                const timeSinceLastInteraction = now - lastInteraction;
                
                // ✅ CORREÇÃO: Aumentar threshold para 30 segundos (mais realista)
                if (timeSinceLastInteraction < 30000) {
                    logger.debug(`🟡 Atividade recente detectada via lastInteractionTimestamp: ${timeSinceLastInteraction}ms atrás`, {
                        chatId,
                        lastInteraction: chatState.lastInteractionTimestamp
                    });
                    return true;
                }
            }
            
            // 2. Verifica se há mensagens muito recentes no histórico
            if (chatState.messageHistory && Array.isArray(chatState.messageHistory)) {
                const recentUserMessages = chatState.messageHistory
                    .filter(msg => !msg.isFromBot && msg.timestamp)
                    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    .slice(0, 3); // Últimas 3 mensagens do usuário
                
                if (recentUserMessages.length > 0) {
                    const lastUserMessage = recentUserMessages[0];
                    const lastMessageTime = new Date(lastUserMessage.timestamp).getTime();
                    const timeSinceLastMessage = now - lastMessageTime;
                    
                    // ✅ CORREÇÃO: Aumentar threshold para 60 segundos (mais realista)
                    if (timeSinceLastMessage < 60000) {
                        logger.debug(`🟡 Atividade recente detectada via messageHistory: ${timeSinceLastMessage}ms atrás`, {
                            chatId,
                            lastMessageTime: lastUserMessage.timestamp,
                            messagePreview: lastUserMessage.body?.substring(0, 50) || '(sem preview)'
                        });
                        return true;
                    }
                }
            }
            
            // 3. Verifica se está no meio de uma conversa ativa (múltiplas mensagens recentes)
            if (chatState.messageHistory && Array.isArray(chatState.messageHistory)) {
                const last5Minutes = now - (5 * 60 * 1000); // 5 minutos atrás
                const recentMessages = chatState.messageHistory
                    .filter(msg => {
                        const msgTime = new Date(msg.timestamp).getTime();
                        return msgTime > last5Minutes;
                    });
                
                // Se há mais de 3 mensagens nos últimos 5 minutos, considera conversa ativa
                if (recentMessages.length >= 3) {
                    logger.debug(`🟡 Conversa ativa detectada: ${recentMessages.length} mensagens nos últimos 5 minutos`, {
                        chatId
                    });
                    return true;
                }
            }
            
            return false;
            
        } catch (error) {
            logger.warn(`Erro ao verificar atividade recente para ${chatId}:`, error.message);
            return false; // Em caso de erro, não bloquear reengajamento
        }
    }

    /**
     * Verifica se uma mensagem de reengajamento foi enviada recentemente
     * @param {Object} chatState - Estado atual do chat
     * @returns {boolean} Se a última mensagem de reengajamento foi enviada recentemente
     */
    isReengagementTooRecent(chatState) {
        try {
            if (!chatState.lastReengagementMessageSentAt) {
                return false; // Nunca enviou reengajamento
            }
            
            const now = Date.now();
            const lastReengagement = new Date(chatState.lastReengagementMessageSentAt).getTime();
            const timeSinceLastReengagement = now - lastReengagement;
            
            // ✅ CORREÇÃO: Reduzir threshold para 30 segundos (menos restritivo)
            const tooRecentThreshold = 30 * 1000; // 30 segundos
            
            if (timeSinceLastReengagement < tooRecentThreshold) {
                logger.debug(`🟡 Reengajamento muito recente: ${timeSinceLastReengagement}ms atrás`, {
                    lastReengagement: chatState.lastReengagementMessageSentAt,
                    thresholdMs: tooRecentThreshold
                });
                return true;
            }
            
            return false;
            
        } catch (error) {
            logger.warn('Erro ao verificar se reengajamento é muito recente:', error.message);
            return false; // Em caso de erro, não bloquear reengajamento
        }
    }

    /**
     * ✅ NOVO: Aborta qualquer fluxo de inatividade em andamento para um usuário.
     * Chamado quando uma nova mensagem do usuário chega.
     * @param {string} chatId - ID do chat
     */
    abortInactivityFlow(chatId) {
        logger.info(`[Inactivity Mgr] Fluxo de inatividade marcado para ABORTAR para ${chatId}.`, { chatId });
        this.abortedFlows.add(chatId);
        // Também cancela qualquer timer futuro agendado
        this.cancelInactivityTimer(chatId);
    }
}

// Instância singleton
const inactivityManager = new InactivityManager();

export default inactivityManager;