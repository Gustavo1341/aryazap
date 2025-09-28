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

    // Testa mensagens simples (que NÃO devem usar RAG)
    console.log(chalk.magenta('🚀 Testando mensagens simples (sem RAG):\n'));
    const simpleMessages = [
      'oi',
      'olá',
      'tudo bem',
      'beleza',
      'ok'
    ];

    for (const message of simpleMessages) {
      console.log(chalk.yellow(`👤 Usuário: ${message}`));

      const result = await agent.processFirstMessage(message);

      console.log(chalk.blue(`🤖 Pedro: ${result.response.substring(0, 100)}...`));

      // Verifica se RAG foi usado
      if (result.directResponse) {
        console.log(chalk.green('✅ Resposta DIRETA (sem RAG) - Tokens economizados!'));
      } else {
        console.log(chalk.red('⚠️ Usou RAG desnecessariamente'));
      }

      console.log(chalk.gray('─'.repeat(80)));
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Testa mensagens complexas (que DEVEM usar RAG)
    console.log(chalk.magenta('\n🔍 Testando mensagens complexas (com RAG):\n'));
    const complexMessages = [
      'Qual o preço do curso?',
      'Como funciona o inventário judicial?',
      'Preciso de ajuda com sucessões'
    ];

    for (const message of complexMessages) {
      console.log(chalk.yellow(`👤 Usuário: ${message}`));

      const result = await agent.processMessage(message);

      console.log(chalk.blue(`🤖 Pedro: ${result.response.substring(0, 100)}...`));

      // Verifica se RAG foi usado
      if (result.hasContext) {
        console.log(chalk.green('✅ Usou RAG (correto para pergunta específica)'));
      } else {
        console.log(chalk.yellow('⚠️ Não encontrou contexto relevante'));
      }

      console.log(chalk.gray('─'.repeat(80)));
      await new Promise(resolve => setTimeout(resolve, 500));
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