#!/usr/bin/env node

import chalk from 'chalk';
import SalesAgent from './src/agents/salesAgent.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testSalesAgent() {
  console.log(chalk.blue.bold('\n🤖 Teste do Agente de Vendas\n'));

  const agent = new SalesAgent();

  try {
    // 1. Inicializar agente
    console.log(chalk.yellow('1. Inicializando agente de vendas...'));
    const initialized = await agent.initialize();

    if (!initialized) {
      console.log(chalk.red('❌ Falha ao inicializar agente'));
      return;
    }
    console.log(chalk.green('✅ Agente inicializado'));

    // 2. Carregar conhecimento
    console.log(chalk.yellow('\n2. Carregando base de conhecimento...'));
    const knowledgePath = path.join(__dirname, 'data/knowledge.json');

    if (!fs.existsSync(knowledgePath)) {
      console.log(chalk.red('❌ Arquivo knowledge.json não encontrado'));
      return;
    }

    const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
    await agent.loadKnowledge(knowledgeData);
    console.log(chalk.green(`✅ ${knowledgeData.length} entradas carregadas`));

    // 3. Verificar estatísticas
    console.log(chalk.yellow('\n3. Verificando estatísticas do agente...'));
    const stats = await agent.getStats();
    console.log(chalk.blue(`📊 Agente inicializado: ${stats.agent.initialized ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 RAG Supabase: ${stats.rag.supabaseConnected ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 RAG Gemini: ${stats.rag.geminiInitialized ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 Documentos: ${stats.rag.documentCount}`));
    console.log(chalk.blue(`📊 Etapa atual: ${stats.funnel.currentStep}`));

    // 4. Testar conversa simulada
    console.log(chalk.yellow('\n4. Testando conversa simulada...'));

    const conversations = [
      { user: 'Oi, tudo bem?', description: 'Cumprimento inicial' },
      { user: 'Pode me chamar de João', description: 'Fornece nome' },
      { user: 'Já atuo com direito sucessório mas tenho dificuldades', description: 'Responde qualificação' },
      { user: 'Minha maior dificuldade é com inventários', description: 'Especifica dificuldade' },
      { user: 'Sim, isso me impacta financeiramente', description: 'Confirma impacto' },
      { user: 'Quanto custa o curso?', description: 'Pergunta sobre preço' }
    ];

    for (const [index, conversation] of conversations.entries()) {
      console.log(chalk.gray(`\n   ${index + 1}. ${conversation.description}`));
      console.log(chalk.yellow(`   👤 Usuário: "${conversation.user}"`));

      try {
        const result = await agent.processMessage(conversation.user);

        console.log(chalk.green(`   🤖 Pedro: "${result.response.substring(0, 150)}..."`));
        console.log(chalk.blue(`   📍 Etapa: ${result.currentStep.id}`));
        console.log(chalk.blue(`   🔄 Avançou: ${result.advanced ? 'Sim' : 'Não'}`));
        console.log(chalk.blue(`   📖 Contexto: ${result.hasContext ? 'Sim' : 'Não'}`));

        // Aguarda um pouco entre mensagens
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.log(chalk.red(`   ❌ Erro: ${error.message}`));
      }
    }

    // 5. Testar busca de conhecimento
    console.log(chalk.yellow('\n5. Testando busca de conhecimento específica...'));

    const searchQueries = [
      'preço curso',
      'certificado',
      'professor jaylton'
    ];

    for (const query of searchQueries) {
      console.log(chalk.gray(`\n   Buscando: "${query}"`));

      try {
        const results = await agent.searchKnowledge(query);

        if (results.length > 0) {
          console.log(chalk.green(`   ✅ ${results.length} resultados`));
          const firstResult = results[0];
          console.log(chalk.gray(`   📄 Fonte: ${firstResult.source}`));
          console.log(chalk.gray(`   📝 Conteúdo: ${firstResult.content.substring(0, 100)}...`));
        } else {
          console.log(chalk.yellow(`   ⚠️  Nenhum resultado`));
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Erro na busca: ${error.message}`));
      }
    }

    // 6. Informações da sessão
    console.log(chalk.yellow('\n6. Informações da sessão...'));
    const sessionInfo = agent.getSessionInfo();
    console.log(chalk.blue(`📍 Etapa atual: ${sessionInfo.currentStepInfo.title}`));
    console.log(chalk.blue(`🎯 Objetivo: ${sessionInfo.currentStepInfo.goal}`));
    console.log(chalk.blue(`📝 Histórico: ${sessionInfo.historyCount} mensagens`));
    console.log(chalk.blue(`⏱️  Duração: ${Math.round(sessionInfo.sessionDuration / 1000)}s`));

    console.log(chalk.green.bold('\n🎉 Teste do agente concluído com sucesso!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Erro durante o teste:'), error.message);
  } finally {
    await agent.shutdown();
  }
}

// Executa o teste
testSalesAgent().catch(console.error);