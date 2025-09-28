import logger from '../utils/logger.js';

class FunnelService {
  constructor() {
    this.funnelSteps = this.loadFunnelSteps();
    this.currentSession = {
      currentStep: 'NAME_CAPTURE_VALIDATION',
      userContext: {},
      history: [],
    };
  }

  loadFunnelSteps() {
    // Baseado no salesFunnelBluePrint.js
    return [
      {
        id: 'NAME_CAPTURE_VALIDATION',
        title: 'Captura e Validação do Nome Personalizado',
        goal: 'Validar o nome completo do contato e perguntar como ele gostaria de ser chamado.',
        coreQuestionPrompt: 'Olá! Aqui é o Pedro do DPA. Tudo bem? Vi que você tem interesse no nosso curso. Como posso te chamar?',
        nextStepDefault: 'PROBLEM_EXPLORATION_INITIAL',
        waitForUserResponse: true,
      },
      {
        id: 'PROBLEM_EXPLORATION_INITIAL',
        title: 'Qualificação Inicial - Atuação em Direito Sucessório',
        goal: 'Perguntar ao lead se já atua com Direito Sucessório ou se pretende iniciar.',
        coreQuestionPrompt: 'Para começarmos e eu entender como posso te ajudar melhor, você já atua com Direito Sucessório ou pretende iniciar nessa área?',
        nextStepDefault: 'PROBLEM_EXPLORATION_DIFFICULTY',
        waitForUserResponse: true,
      },
      {
        id: 'PROBLEM_EXPLORATION_DIFFICULTY',
        title: 'Exploração da Dificuldade Principal',
        goal: 'Identificar a maior dificuldade do lead em Direito Sucessório.',
        coreQuestionPrompt: 'E qual sua maior dificuldade hoje? Seria lidar com inventários, partilhas ou sucessório?',
        nextStepDefault: 'PROBLEM_IMPACT',
        waitForUserResponse: true,
      },
      {
        id: 'PROBLEM_IMPACT',
        title: 'Exploração do Impacto da Dificuldade',
        goal: 'Entender o impacto concreto da dificuldade mencionada pelo lead.',
        coreQuestionPrompt: 'E essa dificuldade que você mencionou, como ela tem te impactado na prática? Talvez em perda de tempo, na segurança para atuar, ou até mesmo financeiramente?',
        nextStepDefault: 'SOLUTION_PRESENTATION',
        waitForUserResponse: true,
      },
      {
        id: 'SOLUTION_PRESENTATION',
        title: 'Apresentação da Solução - Curso Direito Sucessório',
        goal: 'Conectar o problema do lead ao curso, apresentando a solução.',
        coreQuestionPrompt: 'Entendi perfeitamente sua situação. Foi exatamente para resolver essas questões que criamos o Curso de Prática em Sucessões e Inventários. Gostaria de ver alguns depoimentos de outros alunos que tinham as mesmas dificuldades?',
        nextStepDefault: 'SOCIAL_PROOF_DELIVERY',
        waitForUserResponse: true,
      },
      {
        id: 'SOCIAL_PROOF_DELIVERY',
        title: 'Entrega de Prova Social',
        goal: 'Mostrar depoimentos e resultados de outros alunos.',
        coreQuestionPrompt: 'Que bom que você quer ver! Temos vários casos de sucesso. Por exemplo, a aluna Cristiane Costa relatou: "Depois de me especializar, eu fecho contratos de 600 mil reais." Aqui está o depoimento dela: https://www.youtube.com/watch?v=H0LMl6BFPso. Podemos dar o próximo passo e eu te apresentar a oferta completa?',
        nextStepDefault: 'PLAN_OFFER',
        waitForUserResponse: true,
      },
      {
        id: 'PLAN_OFFER',
        title: 'Apresentação da Oferta',
        goal: 'Apresentar o investimento e detalhes do curso.',
        coreQuestionPrompt: 'Perfeito! O curso foi desenhado para te dar domínio completo dos inventários. O investimento é de apenas 12x de R$ 194,56 no cartão, ou R$ 1.997,00 à vista. Isso dá menos de R$ 6,48 por dia. Posso te enviar o link para garantir sua vaga?',
        nextStepDefault: 'CLOSE_DEAL',
        waitForUserResponse: true,
      },
      {
        id: 'CLOSE_DEAL',
        title: 'Fechamento da Venda',
        goal: 'Enviar o link de pagamento e finalizar a venda.',
        coreQuestionPrompt: 'Excelente decisão! Aqui está o link seguro: https://pay.hotmart.com/A44481801Y?off=qvbx78wi&checkoutMode=10&bid=1738260098796. O investimento é de 12x de R$ 194,56 no cartão ou R$ 1.997,00 à vista via PIX. É só me avisar quando finalizar!',
        nextStepDefault: 'POST_PURCHASE_FOLLOWUP',
        waitForUserResponse: true,
      },
      {
        id: 'POST_PURCHASE_FOLLOWUP',
        title: 'Pós-Compra',
        goal: 'Parabenizar e dar instruções pós-compra.',
        coreQuestionPrompt: 'Parabéns pela decisão! Fique de olho no seu e-mail para as informações de acesso. Para dúvidas, nosso suporte está em (61) 99664-5250. Sucesso nos estudos!',
        nextStepDefault: 'GENERAL_SUPPORT',
        waitForUserResponse: false,
      },
      {
        id: 'GENERAL_SUPPORT',
        title: 'Suporte Geral',
        goal: 'Fornecer suporte contínuo.',
        coreQuestionPrompt: 'Como posso ajudar você hoje?',
        nextStepDefault: null,
        waitForUserResponse: true,
      },
    ];
  }

  getCurrentStep() {
    return this.funnelSteps.find(step => step.id === this.currentSession.currentStep);
  }

  getStepById(stepId) {
    return this.funnelSteps.find(step => step.id === stepId);
  }

  advanceToNextStep() {
    const currentStep = this.getCurrentStep();
    if (currentStep && currentStep.nextStepDefault) {
      this.currentSession.currentStep = currentStep.nextStepDefault;
      logger.info(`Avançando para: ${currentStep.nextStepDefault}`, { module: 'FunnelService' });
      return true;
    }
    return false;
  }

  setStep(stepId) {
    const step = this.getStepById(stepId);
    if (step) {
      this.currentSession.currentStep = stepId;
      logger.info(`Etapa definida para: ${stepId}`, { module: 'FunnelService' });
      return true;
    }
    return false;
  }

  addToHistory(userMessage, botResponse) {
    this.currentSession.history.push({
      timestamp: new Date().toISOString(),
      step: this.currentSession.currentStep,
      userMessage,
      botResponse,
    });

    // Mantém apenas os últimos 20 registros
    if (this.currentSession.history.length > 20) {
      this.currentSession.history = this.currentSession.history.slice(-20);
    }
  }

  updateUserContext(key, value) {
    this.currentSession.userContext[key] = value;
    logger.debug(`Contexto atualizado: ${key} = ${value}`, { module: 'FunnelService' });
  }

  getUserContext(key) {
    return this.currentSession.userContext[key];
  }

  getSessionInfo() {
    return {
      currentStep: this.currentSession.currentStep,
      currentStepInfo: this.getCurrentStep(),
      userContext: this.currentSession.userContext,
      historyCount: this.currentSession.history.length,
    };
  }

  generateSystemInstruction() {
    const currentStep = this.getCurrentStep();
    const userName = this.getUserContext('preferredName') || 'usuário';

    let instruction = `
Você é o Pedro, especialista da DPA (Direito Processual Aplicado) em vendas consultivas de cursos jurídicos.

ETAPA ATUAL: ${currentStep.title}
OBJETIVO: ${currentStep.goal}

CONTEXTO DO USUÁRIO:
${Object.entries(this.currentSession.userContext)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

INSTRUÇÕES ESPECÍFICAS:
1. Seja profissional, mas amigável e prestativo
2. Use o nome preferido do usuário: "${userName}"
3. Mantenha o foco no objetivo da etapa atual
4. Seja consultivo - entenda antes de oferecer
5. Use argumentos baseados em benefícios e transformação

INFORMAÇÕES IMPORTANTES:
- Curso: Prática em Sucessões e Inventários
- Professor: Jaylton Lopes (ex-juiz, 9 anos TJDFT)
- Investimento: 12x R$ 194,56 ou R$ 1.997,00 à vista
- Acesso: 12 meses
- Carga horária: 42 horas
- Suporte: (61) 99664-5250

Responda de forma natural e humana, seguindo o objetivo da etapa atual.
`;

    return instruction;
  }

  detectAdvanceSignals(userMessage) {
    const advanceSignals = [
      '[ACTION: ADVANCE_FUNNEL]',
      'pode apresentar',
      'vamos lá',
      'quero ver',
      'pode enviar',
      'aceito',
      'finalizada a compra',
      'paguei',
    ];

    return advanceSignals.some(signal =>
      userMessage.toLowerCase().includes(signal.toLowerCase())
    );
  }

  resetSession() {
    this.currentSession = {
      currentStep: 'NAME_CAPTURE_VALIDATION',
      userContext: {},
      history: [],
    };
    logger.info('Sessão reiniciada', { module: 'FunnelService' });
  }

  exportSession() {
    return JSON.stringify(this.currentSession, null, 2);
  }

  importSession(sessionData) {
    try {
      this.currentSession = JSON.parse(sessionData);
      logger.info('Sessão importada com sucesso', { module: 'FunnelService' });
      return true;
    } catch (error) {
      logger.error('Erro ao importar sessão:', error, { module: 'FunnelService' });
      return false;
    }
  }
}

export default FunnelService;