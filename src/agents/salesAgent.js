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

      // Gera instrução do sistema baseada na etapa atual
      const systemInstruction = this.funnelService.generateSystemInstruction();
      const enhancedInstruction = this.enhanceInstructionWithStepContext(systemInstruction);

      // Instrução para primeira mensagem SEM forçar saudação
      const firstMessageInstruction = `${enhancedInstruction}

PRIMEIRA MENSAGEM DA CONVERSA:
Esta é a primeira interação do usuário. Responda de forma natural e direta ao que ele perguntou ou disse.

⚠️ PROIBIÇÕES ABSOLUTAS:
- NUNCA comece com "Olá", "Oi", "Bom dia", "Boa tarde", "Boa noite"
- NUNCA diga "aqui é o Pedro do DPA"
- NUNCA use saudações formais automáticas
- NUNCA force apresentações quando não necessárias

✅ DIRETRIZES OBRIGATÓRIAS:
1. Responda DIRETAMENTE ao que o usuário perguntou
2. Se o usuário disse "oi", responda naturalmente sem repetir saudações
3. Seja conversacional e humano
4. Foque no que o usuário realmente quer saber
5. Use um tom profissional mas natural
6. Mensagem do usuário: "${userMessage}"

EXEMPLO DE COMO RESPONDER:
- Se usuário diz "oi" → "Tudo bem? Em que posso te ajudar?"
- Se usuário pergunta preço → "O investimento é de..."
- Se usuário pergunta sobre curso → "O curso oferece..."`;

      // Verifica se precisa usar RAG ou pode responder diretamente
      const needsRAG = this.shouldUseRAG(userMessage);
      let result;

      if (needsRAG) {
        // Gera resposta usando RAG
        result = await this.ragService.generateResponse(
          userMessage,
          firstMessageInstruction,
          5 // máximo de contextos
        );
      } else {
        // Gera resposta direta sem RAG para economizar tokens
        logger.info('Resposta direta sem RAG (mensagem simples)', { module: 'SalesAgent' });
        const directResponse = await this.ragService.geminiService.generateText(
          userMessage,
          firstMessageInstruction
        );
        logger.debug(`[DEBUG DIRECT] Resposta direta do Gemini: "${directResponse.text}"`, { module: 'SalesAgent' });
        result = {
          response: directResponse.text,
          context: '',
          usage: directResponse.usage,
          hasContext: false,
          directResponse: true
        };
      }

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
      return {
        response: 'Desculpe, tive um problema técnico. Poderia repetir sua pergunta?',
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
      const fullInstruction = enhancedInstruction + '\n\nHISTÓRICO DA CONVERSA:\n' + conversationContext + '\n\n⚠️ PROIBIÇÕES ABSOLUTAS:\n- NUNCA comece com saudações como "Olá", "Oi", "Bom dia"\n- NUNCA repita apresentações já feitas\n- Esta é uma CONTINUAÇÃO da conversa\n\n✅ DIRETRIZES OBRIGATÓRIAS:\n1. Responda DIRETAMENTE ao que o usuário perguntou\n2. Seja natural e conversacional\n3. Continue a conversa de onde parou';

      // Verifica se precisa usar RAG ou pode responder diretamente
      const needsRAG = this.shouldUseRAG(userMessage);
      let result;

      if (needsRAG) {
        // Gera resposta usando RAG
        result = await this.ragService.generateResponse(
          userMessage,
          fullInstruction,
          5 // máximo de contextos
        );
      } else {
        // Gera resposta direta sem RAG para economizar tokens
        logger.info('Resposta direta sem RAG (mensagem simples)', { module: 'SalesAgent' });
        const directResponse = await this.ragService.geminiService.generateText(
          userMessage,
          fullInstruction
        );
        logger.debug(`[DEBUG DIRECT] Resposta direta do Gemini: "${directResponse.text}"`, { module: 'SalesAgent' });
        result = {
          response: directResponse.text,
          context: '',
          usage: directResponse.usage,
          hasContext: false,
          directResponse: true
        };
      }

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

  shouldUseRAG(userMessage) {
    const message = userMessage.toLowerCase().trim();

    // Mensagens simples de saudação/cortesia que não precisam de RAG
    const simpleGreetings = [
      'oi', 'olá', 'ola', 'oie', 'eae', 'e ai', 'e aí',
      'tchau', 'até', 'ate', 'valeu', 'obrigado', 'obrigada',
      'blz', 'beleza', 'tudo bem', 'tudo bom', 'como vai',
      'bom dia', 'boa tarde', 'boa noite',
      'ok', 'certo', 'entendi', 'perfeito',
      'sim', 'não', 'nao', 'talvez',
      'legal', 'show', 'massa', 'top'
    ];

    // Verifica se é uma mensagem muito curta (até 3 palavras) e comum
    const words = message.split(/\s+/);
    if (words.length <= 3) {
      // Se é exatamente uma das saudações simples
      if (simpleGreetings.includes(message)) {
        return false;
      }

      // Se tem menos de 10 caracteres e não contém palavras relacionadas ao negócio
      const businessKeywords = [
        'curso', 'preço', 'preco', 'valor', 'custo', 'pagamento', 'parcelamento',
        'inventário', 'inventario', 'sucessão', 'sucessao', 'juiz', 'direito',
        'advogado', 'juridico', 'jurídico', 'certificado', 'aula', 'material',
        'dúvida', 'duvida', 'pergunta', 'informação', 'informacao',
        'quando', 'como', 'onde', 'porque', 'por que', 'quanto'
      ];

      const hasBusinessKeyword = businessKeywords.some(keyword =>
        message.includes(keyword)
      );

      if (message.length < 10 && !hasBusinessKeyword) {
        return false;
      }
    }

    // Para mensagens mais elaboradas ou com palavras-chave do negócio, usar RAG
    return true;
  }

  enhanceInstructionWithStepContext(baseInstruction) {
    const currentStep = this.funnelService.getCurrentStep();

    let enhanced = baseInstruction;

    // Adiciona pergunta principal da etapa apenas se apropriado para o contexto
    if (currentStep.coreQuestionPrompt) {
      enhanced += `\n\nPERGUNTA PRINCIPAL DA ETAPA (use apenas quando apropriado): ${currentStep.coreQuestionPrompt}`;
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

  getNextStepAfterAdvance() {
    const currentStep = this.funnelService.getCurrentStep();
    if (currentStep && currentStep.nextStepDefault) {
      return this.funnelService.getStepById(currentStep.nextStepDefault);
    }
    return null;
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