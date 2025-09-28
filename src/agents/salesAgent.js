import RAGService from '../services/ragService.js';
import FunnelService from '../services/funnelService.js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class SalesAgent {
  constructor() {
    this.ragService = new RAGService();
    this.funnelService = new FunnelService();
    this.isInitialized = false;
    this.sessionStartTime = new Date();
  }

  async initialize() {
    try {
      logger.info('Inicializando Sales Agent...', { module: 'SalesAgent' });

      // Inicializa o RAG Service
      const ragInitialized = await this.ragService.initialize();
      if (!ragInitialized) {
        throw new Error('Falha ao inicializar RAG Service');
      }

      this.isInitialized = true;
      logger.info('Sales Agent inicializado com sucesso', { module: 'SalesAgent' });

      return true;
    } catch (error) {
      logger.error('Erro ao inicializar Sales Agent:', error, { module: 'SalesAgent' });
      this.isInitialized = false;
      return false;
    }
  }

  async loadKnowledge(knowledgeData) {
    if (!this.isInitialized) {
      throw new Error('Sales Agent não está inicializado');
    }

    try {
      logger.info('Carregando base de conhecimento...', { module: 'SalesAgent' });
      await this.ragService.indexKnowledge(knowledgeData);
      logger.info('Base de conhecimento carregada com sucesso', { module: 'SalesAgent' });
      return true;
    } catch (error) {
      logger.error('Erro ao carregar base de conhecimento:', error, { module: 'SalesAgent' });
      throw error;
    }
  }

  async processFirstMessage(userMessage) {
    if (!this.isInitialized) {
      throw new Error('Sales Agent não está inicializado');
    }

    try {
      logger.info(`Processando primeira mensagem: "${userMessage.substring(0, 100)}..."`, { module: 'SalesAgent' });

      // Detecta nome se estivermos na primeira etapa
      this.detectAndSaveName(userMessage);

      // Para primeira mensagem, combinamos a saudação inicial com a resposta ao input do usuário
      const currentStep = this.funnelService.getCurrentStep();

      // Constrói prompt especial para primeira mensagem
      let initialPrompt = '';
      if (currentStep && currentStep.coreQuestionPrompt) {
        initialPrompt = this.formatResponse(currentStep.coreQuestionPrompt);
      }

      // Constrói instrução especial que combina saudação + resposta ao usuário
      const systemInstruction = this.funnelService.generateSystemInstruction();
      const enhancedInstruction = this.enhanceInstructionWithStepContext(systemInstruction);

      const firstMessageInstruction = `${enhancedInstruction}

PRIMEIRA MENSAGEM DA CONVERSA:
Você deve iniciar com a saudação/pergunta inicial da etapa e depois responder ao que o usuário disse.

SAUDAÇÃO INICIAL OBRIGATÓRIA: "${initialPrompt}"

INSTRUÇÃO ESPECIAL PARA PRIMEIRA MENSAGEM:
1. SEMPRE inicie sua resposta com a saudação/pergunta inicial formatada
2. Se o usuário fez uma pergunta, responda após a saudação
3. Siga todas as instruções específicas da etapa atual
4. Mensagem do usuário foi: "${userMessage}"`;

      // Gera resposta usando RAG
      const result = await this.ragService.generateResponse(
        userMessage,
        firstMessageInstruction,
        5 // máximo de contextos
      );

      // Processa resposta e determina próximos passos
      const processedResponse = this.processResponse(result.response, userMessage);

      // Adiciona ao histórico ANTES de verificar avanço
      this.funnelService.addToHistory(userMessage, processedResponse.finalResponse);

      // Avança no funil APENAS se a resposta da IA indicar
      if (processedResponse.shouldAdvance) {
        this.funnelService.advanceToNextStep();
      }

      logger.info('Primeira mensagem processada com sucesso', { module: 'SalesAgent' });

      return {
        response: processedResponse.finalResponse,
        currentStep: this.funnelService.getCurrentStep(),
        advanced: processedResponse.shouldAdvance,
        hasContext: result.hasContext,
        usage: result.usage,
        sessionInfo: this.funnelService.getSessionInfo(),
      };
    } catch (error) {
      logger.error('Erro ao processar primeira mensagem:', error, { module: 'SalesAgent' });

      // Resposta de fallback para primeira mensagem
      const currentStep = this.funnelService.getCurrentStep();
      let fallbackResponse = 'Desculpe, tive um problema técnico. ';
      if (currentStep && currentStep.coreQuestionPrompt) {
        fallbackResponse += this.formatResponse(currentStep.coreQuestionPrompt);
      }

      return {
        response: fallbackResponse,
        currentStep: this.funnelService.getCurrentStep(),
        advanced: false,
        hasContext: false,
        error: true,
      };
    }
  }

  async processMessage(userMessage) {
    if (!this.isInitialized) {
      throw new Error('Sales Agent não está inicializado');
    }

    try {
      logger.info(`Processando mensagem: "${userMessage.substring(0, 100)}..."`, { module: 'SalesAgent' });

      // Detecta nome se estivermos na primeira etapa
      this.detectAndSaveName(userMessage);

      // Gera instrução do sistema baseada na etapa atual
      const systemInstruction = this.funnelService.generateSystemInstruction();

      // Adiciona contexto específico da etapa
      const enhancedInstruction = this.enhanceInstructionWithStepContext(systemInstruction);

      // Adiciona histórico da conversa para contexto
      const conversationContext = this.funnelService.getConversationContext();
      const fullInstruction = enhancedInstruction + '\n\nHISTÓRICO DA CONVERSA:\n' + conversationContext;

      // Gera resposta usando RAG
      const result = await this.ragService.generateResponse(
        userMessage,
        fullInstruction,
        5 // máximo de contextos
      );

      // Processa resposta e determina próximos passos
      const processedResponse = this.processResponse(result.response, userMessage);

      // Adiciona ao histórico ANTES de verificar avanço
      this.funnelService.addToHistory(userMessage, processedResponse.finalResponse);

      // Avança no funil APENAS se a resposta da IA indicar
      if (processedResponse.shouldAdvance) {
        this.funnelService.advanceToNextStep();
      }

      logger.info('Mensagem processada com sucesso', { module: 'SalesAgent' });

      return {
        response: processedResponse.finalResponse,
        currentStep: this.funnelService.getCurrentStep(),
        advanced: processedResponse.shouldAdvance,
        hasContext: result.hasContext,
        usage: result.usage,
        sessionInfo: this.funnelService.getSessionInfo(),
      };
    } catch (error) {
      logger.error('Erro ao processar mensagem:', error, { module: 'SalesAgent' });

      // Resposta de fallback
      return {
        response: 'Desculpe, tive um problema técnico. Poderia repetir sua pergunta?',
        currentStep: this.funnelService.getCurrentStep(),
        advanced: false,
        hasContext: false,
        error: true,
      };
    }
  }

  detectAndSaveName(userMessage) {
    const currentStep = this.funnelService.getCurrentStep();

    if (currentStep.id === 'NAME_CAPTURE_VALIDATION') {
      // Tenta extrair um nome explícito da mensagem
      const namePattern = /(?:me chama(?:m|r)? de|sou (?:o|a)?|meu nome é)\s*([a-záàâãéèêíïóôõöúçñ]+)/i;
      const match = userMessage.match(namePattern);

      if (match) {
        const name = match[1];
        this.funnelService.updateUserContext('preferredName', name);
        logger.info(`Nome preferido detectado: ${name}`, { module: 'SalesAgent' });
      } else {
        // Verifica se é apenas um nome (palavra única que pode ser um nome)
        const words = userMessage.trim().split(/\s+/);
        const firstWord = words[0];

        // Se for uma palavra única que parece ser um nome (começa com maiúscula, só letras, mais de 2 caracteres)
        if (words.length === 1 &&
            firstWord.length > 2 &&
            /^[A-ZÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ][a-záàâãéèêíïóôõöúçñ]+$/.test(firstWord) &&
            !['Oi', 'Olá', 'Sim', 'Não', 'Ok'].includes(firstWord)) {
          this.funnelService.updateUserContext('preferredName', firstWord);
          logger.info(`Nome detectado automaticamente: ${firstWord}`, { module: 'SalesAgent' });
        }
        // Se não é um nome claro, não salva nada ainda
        // Deixa a IA responder naturalmente
      }
    }
  }

  enhanceInstructionWithStepContext(baseInstruction) {
    const currentStep = this.funnelService.getCurrentStep();

    let enhanced = baseInstruction;

    // Adiciona pergunta principal da etapa se apropriado
    if (currentStep.coreQuestionPrompt) {
      enhanced += `\n\nPERGUNTA PRINCIPAL DA ETAPA: ${currentStep.coreQuestionPrompt}`;
    }

    // Adiciona informações específicas baseadas na etapa
    switch (currentStep.id) {
      case 'SOCIAL_PROOF_DELIVERY':
        enhanced += `\n\nLINKS DE DEPOIMENTOS:
- Cristiane Costa: ${config.links.socialProofs.cristiane}
- Mariana: ${config.links.socialProofs.mariana}
- Ernandes: ${config.links.socialProofs.ernandes}`;
        break;

      case 'CLOSE_DEAL':
        enhanced += `\n\nLINK DE COMPRA: ${config.links.checkout}`;
        break;

      case 'POST_PURCHASE_FOLLOWUP':
        enhanced += `\n\nSUPORTE: WhatsApp ${config.support.whatsappNumber}`;
        break;
    }

    return enhanced;
  }

  processResponse(response, userMessage) {
    let finalResponse = response;
    let shouldAdvance = false;

    // Detecta se a resposta indica avanço no funil
    const advanceIndicators = [
      '[ACTION: ADVANCE_FUNNEL]',
      '[ACTION: SKIP_SOCIAL_PROOF]',
    ];

    const hasAdvanceAction = advanceIndicators.some(indicator =>
      response.includes(indicator)
    );

    if (hasAdvanceAction) {
      // Remove as tags de ação da resposta final
      finalResponse = response.replace(/\[ACTION:[^\]]+\]/g, '').trim();
      shouldAdvance = true;
    }

    // Aplica formatação específica
    finalResponse = this.formatResponse(finalResponse);

    return { finalResponse, shouldAdvance };
  }

  formatResponse(response) {
    // Substitui placeholders
    const userName = this.funnelService.getUserContext('preferredName') || 'usuário';
    const timeOfDay = this.getTimeOfDay();

    let formatted = response
      .replace(/{contactName}/g, userName)
      .replace(/{timeOfDay}/g, timeOfDay)
      .replace(/{botIdentity\.firstName}/g, config.bot.firstName)
      .replace(/{botIdentity\.company}/g, config.bot.companyName);

    // Substitui %%MSG_BREAK%% por quebras de linha
    formatted = formatted.replace(/%%MSG_BREAK%%/g, '\n\n');

    return formatted;
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  async searchKnowledge(query) {
    if (!this.isInitialized) {
      throw new Error('Sales Agent não está inicializado');
    }

    return await this.ragService.searchKnowledge(query);
  }

  getSessionInfo() {
    return {
      ...this.funnelService.getSessionInfo(),
      sessionStartTime: this.sessionStartTime,
      sessionDuration: Date.now() - this.sessionStartTime.getTime(),
      agentInitialized: this.isInitialized,
    };
  }

  async getStats() {
    const ragStats = await this.ragService.getKnowledgeStats();
    const sessionInfo = this.getSessionInfo();

    return {
      agent: {
        initialized: this.isInitialized,
        sessionStartTime: this.sessionStartTime,
      },
      rag: ragStats,
      funnel: {
        currentStep: sessionInfo.currentStep,
        totalSteps: this.funnelService.funnelSteps.length,
        historyCount: sessionInfo.historyCount,
      },
    };
  }

  resetSession() {
    this.funnelService.resetSession();
    this.sessionStartTime = new Date();
    logger.info('Sessão do agente reiniciada', { module: 'SalesAgent' });
  }

  exportSession() {
    return {
      funnelSession: this.funnelService.exportSession(),
      sessionStartTime: this.sessionStartTime,
      isInitialized: this.isInitialized,
    };
  }

  async importSession(sessionData) {
    try {
      this.funnelService.importSession(sessionData.funnelSession);
      this.sessionStartTime = new Date(sessionData.sessionStartTime);
      logger.info('Sessão do agente importada', { module: 'SalesAgent' });
      return true;
    } catch (error) {
      logger.error('Erro ao importar sessão:', error, { module: 'SalesAgent' });
      return false;
    }
  }

  async shutdown() {
    logger.info('Desligando Sales Agent...', { module: 'SalesAgent' });
    await this.ragService.shutdown();
    this.isInitialized = false;
    logger.info('Sales Agent desligado', { module: 'SalesAgent' });
  }
}

export default SalesAgent;