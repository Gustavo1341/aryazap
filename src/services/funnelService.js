import logger from '../utils/logger.js';
import salesFunnelBluePrint from '../../salesFunnelBluePrint.js';

class FunnelService {
  constructor() {
    this.funnelSteps = salesFunnelBluePrint.steps;
    this.currentSession = {
      currentStep: 'NAME_CAPTURE_VALIDATION',
      userContext: {},
      history: [],
    };
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
    const timeOfDay = this.getTimeOfDay();

    if (!currentStep) {
      return `Você é Pedro da DPA. Responda de forma profissional e prestativa.`;
    }

    let instruction = `
Você é Pedro da DPA (Direito Processual Aplicado), especialista em vendas consultivas de cursos jurídicos.

🚫 PROIBIÇÕES CRÍTICAS:
- NUNCA inicie respostas com "Olá", "Oi", "Bom dia", "Boa tarde", "Boa noite"
- NUNCA diga "aqui é o Pedro do DPA" em conversas já iniciadas
- NUNCA repita apresentações ou saudações já feitas
- NUNCA force formalidades desnecessárias

ETAPA ATUAL: ${currentStep.title}
OBJETIVO: ${currentStep.goal}

INSTRUÇÕES ESPECÍFICAS PARA ESTA ETAPA:
${currentStep.instructionsForAI ? currentStep.instructionsForAI.join('\n') : 'Siga o objetivo da etapa.'}

CONTEXTO DO USUÁRIO:
${Object.entries(this.currentSession.userContext)
  .map(([key, value]) => `- ${key}: ${value}`)
  .join('\n')}

PLACEHOLDERS DISPONÍVEIS:
- {contactName}: ${userName}
- {timeOfDay}: ${timeOfDay}
- {botIdentity.firstName}: Pedro
- {botIdentity.company}: DPA
- {firstNameFallback}: ${this.getFirstNameFallback()}

REGRAS GERAIS:
1. Use o nome do usuário: "${userName}"
2. Mantenha o tom profissional mas amigável
3. Siga RIGOROSAMENTE as instruções específicas da etapa
4. Use %%MSG_BREAK%% para quebras de linha quando necessário
5. SEMPRE responda de forma inteligente e natural PRIMEIRO
6. SÓ use [ACTION: ADVANCE_FUNNEL] quando as instruções da etapa indicarem claramente
7. Responda DIRETAMENTE ao que o usuário perguntou
8. NÃO avance automaticamente - deixe a conversa fluir naturalmente

INFORMAÇÕES DO CURSO:
- Nome: Curso Completo de Prática em Sucessões e Inventários
- Professor: Jaylton Lopes (ex-juiz TJDFT, 9 anos)
- Investimento: 12x R$ 194,56 ou R$ 1.997,00 à vista
- Acesso: 12 meses limitado
- Carga horária: 42 horas
- Suporte: (61) 99664-5250

Responda seguindo EXATAMENTE as instruções da etapa atual.
`;

    return instruction;
  }

  getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  }

  getFirstNameFallback() {
    const userName = this.getUserContext('preferredName');
    if (userName && userName !== 'usuário') {
      return userName.split(' ')[0];
    }
    return 'amigo(a)';
  }

  getConversationContext() {
    if (this.currentSession.history.length === 0) {
      return 'Nenhuma conversa anterior.';
    }

    // Pega as últimas 5 interações para contexto
    const recentHistory = this.currentSession.history.slice(-5);

    return recentHistory
      .map(entry => `Usuário: ${entry.userMessage}\nPedro: ${entry.botResponse}`)
      .join('\n\n');
  }

  detectAdvanceSignals(userMessage) {
    // Remove essa detecção automática - deixa apenas para a IA decidir
    // através das tags [ACTION: ADVANCE_FUNNEL]
    const explicitAdvanceSignals = [
      '[ACTION: ADVANCE_FUNNEL]',
      '[ACTION: SKIP_SOCIAL_PROOF]'
    ];

    return explicitAdvanceSignals.some(signal =>
      userMessage.includes(signal)
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