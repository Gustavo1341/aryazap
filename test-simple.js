#!/usr/bin/env node

/**
 * Teste Simples do Sales Agent
 *
 * Este arquivo permite testar o agente sem ChromaDB,
 * útil para desenvolvimento e debug inicial.
 */

import SalesAgent from './src/agents/salesAgent.js';
import { processedKnowledge } from './knowledge.js';
import chalk from 'chalk';

async function testSimple() {
  console.log(chalk.blue.bold('🧪 Teste Simples do Sales Agent\n'));

  const agent = new SalesAgent();

  try {
    // Inicializa o agente
    console.log(chalk.gray('Inicializando agente...'));
    const initialized = await agent.initialize();

    if (!initialized) {
      console.log(chalk.red('❌ Falha ao inicializar'));
      return;
    }

    // Carrega conhecimento
    console.log(chalk.gray('Carregando conhecimento...'));
    await agent.loadKnowledge(processedKnowledge);

    console.log(chalk.green('✅ Agente inicializado!\n'));

    // Testa algumas mensagens
    const testMessages = [
      'Oi, tudo bem?',
      'Me chama de João',
      'Já atuo um pouco com direito sucessório',
      'Minha maior dificuldade é com inventários',
      'Isso me faz perder muito tempo',
      'Gostaria de ver os depoimentos',
      'Pode apresentar a oferta',
      'Pode enviar o link'
    ];

    for (const message of testMessages) {
      console.log(chalk.yellow(`👤 Usuário: ${message}`));

      const result = await agent.processMessage(message);

      console.log(chalk.blue(`🤖 Pedro: ${result.response}`));

      if (result.advanced) {
        console.log(chalk.green(`📍 Avançou para: ${result.currentStep.title}`));
      }

      console.log(chalk.gray('─'.repeat(80)));

      // Pausa para simular conversa
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Mostra estatísticas finais
    const stats = await agent.getStats();
    console.log(chalk.blue('\n📊 Estatísticas Finais:'));
    console.log(JSON.stringify(stats, null, 2));

    await agent.shutdown();
    console.log(chalk.green('\n✅ Teste concluído!'));

  } catch (error) {
    console.error(chalk.red('❌ Erro no teste:'), error);
    await agent.shutdown();
  }
}

// Executa o teste
testSimple().catch(console.error);