#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import RAGService from './src/services/ragService.js';
import logger from './src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testEmbeddings() {
  console.log(chalk.blue.bold('\n🧪 Teste de Embeddings e Supabase\n'));

  const ragService = new RAGService();

  try {
    // 1. Inicializar serviços
    console.log(chalk.yellow('1. Inicializando serviços...'));
    const initialized = await ragService.initialize();

    if (!initialized) {
      console.log(chalk.red('❌ Falha ao inicializar serviços'));
      return;
    }
    console.log(chalk.green('✅ Serviços inicializados'));

    // 2. Carregar dados de conhecimento
    console.log(chalk.yellow('\n2. Carregando dados de conhecimento...'));
    const knowledgePath = path.join(__dirname, 'data/knowledge.json');

    if (!fs.existsSync(knowledgePath)) {
      console.log(chalk.red('❌ Arquivo knowledge.json não encontrado'));
      return;
    }

    const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
    console.log(chalk.green(`✅ ${knowledgeData.length} entradas carregadas`));

    // 3. Indexar conhecimento (com embeddings)
    console.log(chalk.yellow('\n3. Indexando conhecimento com embeddings...'));
    const startTime = Date.now();

    await ragService.indexKnowledge(knowledgeData, true);

    const endTime = Date.now();
    console.log(chalk.green(`✅ Indexação concluída em ${((endTime - startTime) / 1000).toFixed(2)}s`));

    // 4. Verificar contagem
    console.log(chalk.yellow('\n4. Verificando documentos indexados...'));
    const stats = await ragService.getKnowledgeStats();
    console.log(chalk.blue(`📊 Supabase conectado: ${stats.supabaseConnected ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 Gemini inicializado: ${stats.geminiInitialized ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 Documentos indexados: ${stats.documentCount}`));

    // 5. Testar buscas
    console.log(chalk.yellow('\n5. Testando buscas semânticas...'));

    const testQueries = [
      'Qual é o preço do curso?',
      'Como posso pagar?',
      'Quanto tempo de acesso?',
      'Quem é o professor?',
      'O curso tem certificado?'
    ];

    for (const query of testQueries) {
      console.log(chalk.gray(`\n   Testando: "${query}"`));

      try {
        const results = await ragService.searchKnowledge(query, 3);

        if (results.length > 0) {
          console.log(chalk.green(`   ✅ ${results.length} resultados encontrados`));

          results.forEach((result, index) => {
            const preview = result.content.substring(0, 100).replace(/\n/g, ' ');
            console.log(chalk.gray(`      ${index + 1}. [${result.source}]: ${preview}...`));
          });
        } else {
          console.log(chalk.yellow(`   ⚠️  Nenhum resultado para "${query}"`));
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Erro na busca: ${error.message}`));
      }
    }

    // 6. Testar geração de resposta completa
    console.log(chalk.yellow('\n6. Testando geração de resposta completa...'));

    const testMessage = "Quanto custa o curso e como posso pagar?";
    const systemInstruction = `Você é Pedro, vendedor especialista da DPA.
Responda de forma amigável e profissional sobre o curso de Direito Sucessório.
Use as informações do contexto fornecido.`;

    try {
      const response = await ragService.generateResponse(testMessage, systemInstruction, 3);

      console.log(chalk.green('\n✅ Resposta gerada:'));
      console.log(chalk.white(`"${response.response}"`));

      console.log(chalk.blue(`\n📊 Estatísticas da resposta:`));
      console.log(chalk.gray(`   Tem contexto: ${response.hasContext ? '✅' : '❌'}`));
      console.log(chalk.gray(`   Tokens usados: ${response.usage?.totalTokens || 'N/A'}`));
      console.log(chalk.gray(`   Contexto usado: ${response.context ? 'Sim' : 'Não'}`));

    } catch (error) {
      console.log(chalk.red(`❌ Erro na geração de resposta: ${error.message}`));
    }

    console.log(chalk.green.bold('\n🎉 Teste concluído com sucesso!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Erro durante o teste:'), error.message);
    logger.error('Erro no teste de embeddings:', error);
  } finally {
    await ragService.shutdown();
  }
}

// Executa o teste
testEmbeddings().catch(console.error);