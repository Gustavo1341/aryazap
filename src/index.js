#!/usr/bin/env node

import readline from 'readline';
import chalk from 'chalk';
import inquirer from 'inquirer';
import SalesAgent from './agents/salesAgent.js';
import logger from './utils/logger.js';
import { validateConfig } from './config/config.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SalesAgentCLI {
  constructor() {
    this.agent = new SalesAgent();
    this.rl = null;
    this.isRunning = false;
  }

  async initialize() {
    try {
      console.log(chalk.blue.bold('\n🤖 Sales Agent CLI - DPA\n'));
      console.log(chalk.gray('Inicializando sistema...'));

      // Valida configuração
      if (!validateConfig()) {
        console.log(chalk.red('❌ Configuração inválida. Verifique o arquivo .env'));
        process.exit(1);
      }

      // Inicializa o agente
      const initialized = await this.agent.initialize();
      if (!initialized) {
        console.log(chalk.red('❌ Falha ao inicializar o agente de vendas'));
        process.exit(1);
      }

      // Carrega base de conhecimento
      console.log(chalk.gray('Carregando base de conhecimento...'));
      const knowledgePath = path.join(__dirname, '../data/knowledge.json');

      if (!fs.existsSync(knowledgePath)) {
        console.log(chalk.red('❌ Arquivo knowledge.json não encontrado!'));
        console.log(chalk.yellow('💡 Execute: npm run load-knowledge'));
        process.exit(1);
      }

      const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
      await this.agent.loadKnowledge(knowledgeData);

      console.log(chalk.green('✅ Sistema inicializado com sucesso!\n'));

      return true;
    } catch (error) {
      logger.error('Erro na inicialização:', error);
      console.log(chalk.red('❌ Erro durante a inicialização'));
      return false;
    }
  }

  async showMainMenu() {
    const choices = [
      { name: '💬 Iniciar Conversa de Vendas', value: 'chat' },
      { name: '📊 Ver Estatísticas', value: 'stats' },
      { name: '🔍 Buscar Base de Conhecimento', value: 'search' },
      { name: '🔄 Reiniciar Sessão', value: 'reset' },
      { name: '📤 Exportar Sessão', value: 'export' },
      { name: '📥 Importar Sessão', value: 'import' },
      { name: '❌ Sair', value: 'exit' },
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'O que você gostaria de fazer?',
        choices,
      },
    ]);

    return action;
  }

  async startChat() {
    console.log(chalk.green('\n🎯 Modo Conversa de Vendas Ativado'));
    console.log(chalk.gray('Digite suas mensagens como um prospect interessado no curso.'));
    console.log(chalk.gray('Digite "sair" para voltar ao menu principal.\n'));

    this.setupReadline();

    // Mostra estado inicial
    await this.showCurrentStep();

    // Inicia primeira interação
    const currentStep = this.agent.funnelService.getCurrentStep();
    if (currentStep && currentStep.coreQuestionPrompt) {
      console.log(chalk.blue('🤖 Pedro:'), currentStep.coreQuestionPrompt);
    }

    this.promptUser();
  }

  setupReadline() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.yellow('👤 Você: '),
    });

    this.rl.on('line', async (input) => {
      const trimmedInput = input.trim();

      if (trimmedInput.toLowerCase() === 'sair') {
        this.rl.close();
        return;
      }

      if (trimmedInput === '') {
        this.promptUser();
        return;
      }

      await this.processUserInput(trimmedInput);
    });

    this.rl.on('close', () => {
      console.log(chalk.gray('\nRetornando ao menu principal...\n'));
      this.showMainMenu().then(action => this.handleMenuAction(action));
    });
  }

  async processUserInput(input) {
    try {
      console.log(chalk.gray('\n🔄 Processando...'));

      const result = await this.agent.processMessage(input);

      // Mostra resposta do agente
      console.log(chalk.blue('\n🤖 Pedro:'), result.response);

      // Mostra informações de debug se habilitado
      if (process.env.DEBUG_MODE === 'true') {
        this.showDebugInfo(result);
      }

      // Mostra nova etapa se avançou
      if (result.advanced) {
        await this.showCurrentStep();
      }

      console.log(''); // Linha em branco
      this.promptUser();
    } catch (error) {
      logger.error('Erro ao processar entrada:', error);
      console.log(chalk.red('\n❌ Erro ao processar sua mensagem. Tente novamente.'));
      this.promptUser();
    }
  }

  promptUser() {
    if (this.rl) {
      this.rl.prompt();
    }
  }

  async showCurrentStep() {
    const sessionInfo = this.agent.getSessionInfo();
    const step = sessionInfo.currentStepInfo;

    console.log(chalk.cyan(`\n📍 Etapa Atual: ${step.title}`));
    console.log(chalk.gray(`   Objetivo: ${step.goal}`));
  }

  showDebugInfo(result) {
    console.log(chalk.gray('\n--- Debug Info ---'));
    console.log(chalk.gray(`Etapa: ${result.currentStep.id}`));
    console.log(chalk.gray(`Avançou: ${result.advanced ? 'Sim' : 'Não'}`));
    console.log(chalk.gray(`Contexto: ${result.hasContext ? 'Sim' : 'Não'}`));
    if (result.usage) {
      console.log(chalk.gray(`Tokens: ${result.usage.totalTokens}`));
    }
    console.log(chalk.gray('--- End Debug ---'));
  }

  async showStats() {
    console.log(chalk.blue('\n📊 Estatísticas do Sistema\n'));

    const stats = await this.agent.getStats();

    console.log(chalk.green('🤖 Agente:'));
    console.log(`   Inicializado: ${stats.agent.initialized ? '✅' : '❌'}`);
    console.log(`   Sessão iniciada: ${new Date(stats.agent.sessionStartTime).toLocaleString()}`);

    console.log(chalk.green('\n🧠 RAG (Retrieval-Augmented Generation):'));
    console.log(`   Supabase conectado: ${stats.rag.supabaseConnected ? '✅' : '❌'}`);
    console.log(`   Gemini inicializado: ${stats.rag.geminiInitialized ? '✅' : '❌'}`);
    console.log(`   Documentos indexados: ${stats.rag.documentCount}`);

    console.log(chalk.green('\n🎯 Funil de Vendas:'));
    console.log(`   Etapa atual: ${stats.funnel.currentStep}`);
    console.log(`   Total de etapas: ${stats.funnel.totalSteps}`);
    console.log(`   Mensagens no histórico: ${stats.funnel.historyCount}`);

    await this.waitForEnter();
  }

  async searchKnowledge() {
    const { query } = await inquirer.prompt([
      {
        type: 'input',
        name: 'query',
        message: 'Digite sua busca:',
      },
    ]);

    if (!query.trim()) {
      console.log(chalk.yellow('Busca cancelada.'));
      return;
    }

    console.log(chalk.gray('\n🔍 Buscando...'));

    try {
      const results = await this.agent.searchKnowledge(query);

      if (results.length === 0) {
        console.log(chalk.yellow('Nenhum resultado encontrado.'));
      } else {
        console.log(chalk.green(`\n📋 ${results.length} resultado(s) encontrado(s):\n`));

        results.slice(0, 5).forEach((result, index) => {
          console.log(chalk.blue(`${index + 1}. [${result.source}]`));
          console.log(chalk.gray(`   ${result.content.substring(0, 200)}...`));
          console.log(chalk.gray(`   Score: ${result.score.toFixed(4)}\n`));
        });
      }
    } catch (error) {
      logger.error('Erro na busca:', error);
      console.log(chalk.red('❌ Erro durante a busca.'));
    }

    await this.waitForEnter();
  }

  async resetSession() {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Tem certeza que deseja reiniciar a sessão?',
        default: false,
      },
    ]);

    if (confirm) {
      this.agent.resetSession();
      console.log(chalk.green('✅ Sessão reiniciada com sucesso!'));
    }

    await this.waitForEnter();
  }

  async exportSession() {
    try {
      const sessionData = this.agent.exportSession();
      const filename = `session_${Date.now()}.json`;

      // Em um ambiente real, você salvaria em arquivo
      console.log(chalk.blue('\n📤 Dados da Sessão:'));
      console.log(chalk.gray(JSON.stringify(sessionData, null, 2)));
      console.log(chalk.green(`\n✅ Sessão exportada (salve o conteúdo acima em ${filename})`));
    } catch (error) {
      logger.error('Erro ao exportar sessão:', error);
      console.log(chalk.red('❌ Erro ao exportar sessão.'));
    }

    await this.waitForEnter();
  }

  async importSession() {
    const { sessionJson } = await inquirer.prompt([
      {
        type: 'input',
        name: 'sessionJson',
        message: 'Cole os dados JSON da sessão:',
      },
    ]);

    try {
      const sessionData = JSON.parse(sessionJson);
      const success = await this.agent.importSession(sessionData);

      if (success) {
        console.log(chalk.green('✅ Sessão importada com sucesso!'));
      } else {
        console.log(chalk.red('❌ Falha ao importar sessão.'));
      }
    } catch (error) {
      logger.error('Erro ao importar sessão:', error);
      console.log(chalk.red('❌ JSON inválido ou erro ao importar.'));
    }

    await this.waitForEnter();
  }

  async waitForEnter() {
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: 'Pressione Enter para continuar...',
      },
    ]);
  }

  async handleMenuAction(action) {
    switch (action) {
      case 'chat':
        await this.startChat();
        break;
      case 'stats':
        await this.showStats();
        break;
      case 'search':
        await this.searchKnowledge();
        break;
      case 'reset':
        await this.resetSession();
        break;
      case 'export':
        await this.exportSession();
        break;
      case 'import':
        await this.importSession();
        break;
      case 'exit':
        await this.shutdown();
        return;
    }

    // Volta ao menu principal
    const nextAction = await this.showMainMenu();
    await this.handleMenuAction(nextAction);
  }

  async shutdown() {
    console.log(chalk.gray('\n🔄 Finalizando sistema...'));
    await this.agent.shutdown();
    console.log(chalk.green('✅ Sistema finalizado. Até logo!\n'));
    process.exit(0);
  }

  async run() {
    try {
      const initialized = await this.initialize();
      if (!initialized) {
        process.exit(1);
      }

      const action = await this.showMainMenu();
      await this.handleMenuAction(action);
    } catch (error) {
      logger.error('Erro na execução principal:', error);
      console.log(chalk.red('❌ Erro fatal na aplicação'));
      process.exit(1);
    }
  }
}

// Executa apenas se for o arquivo principal
const isMainModule = process.argv[1].endsWith('src/index.js') || process.argv[1].endsWith('src\\index.js');
if (isMainModule) {
  const cli = new SalesAgentCLI();
  cli.run().catch((error) => {
    logger.error('Erro não tratado:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\n⚠️  Interrupção recebida...'));
    await cli.shutdown();
  });

  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n\n⚠️  Finalizando aplicação...'));
    await cli.shutdown();
  });
}

export default SalesAgentCLI;