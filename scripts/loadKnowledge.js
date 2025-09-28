#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import RAGService from '../src/services/ragService.js';
import logger from '../src/utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class KnowledgeLoader {
  constructor() {
    this.ragService = new RAGService();
    this.knowledgePath = path.join(__dirname, '../data/knowledge.json');
  }

  async run() {
    try {
      console.log(chalk.blue.bold('\n🧠 Carregador da Base de Conhecimento\n'));

      // Verifica se o arquivo existe
      if (!fs.existsSync(this.knowledgePath)) {
        console.log(chalk.red('❌ Arquivo knowledge.json não encontrado!'));
        console.log(chalk.gray(`   Esperado em: ${this.knowledgePath}`));
        process.exit(1);
      }

      // Carrega os dados
      console.log(chalk.yellow('📖 Carregando dados da base de conhecimento...'));
      const knowledgeData = JSON.parse(fs.readFileSync(this.knowledgePath, 'utf8'));
      console.log(chalk.green(`✅ ${knowledgeData.length} entradas carregadas`));

      // Inicializa o RAG Service
      console.log(chalk.yellow('🔧 Inicializando serviços...'));
      const initialized = await this.ragService.initialize();

      if (!initialized) {
        console.log(chalk.red('❌ Falha ao inicializar os serviços'));
        process.exit(1);
      }

      console.log(chalk.green('✅ Serviços inicializados com sucesso'));

      // Verifica estatísticas antes
      const statsBefore = await this.ragService.getKnowledgeStats();
      console.log(chalk.blue(`📊 Estado atual: ${statsBefore.documentCount} documentos indexados`));

      // Indexa o conhecimento
      console.log(chalk.yellow('🚀 Indexando base de conhecimento...'));
      console.log(chalk.gray('   Isso pode levar alguns minutos...'));

      const startTime = Date.now();
      await this.ragService.indexKnowledge(knowledgeData, true);
      const endTime = Date.now();

      console.log(chalk.green(`✅ Indexação concluída em ${((endTime - startTime) / 1000).toFixed(2)}s`));

      // Verifica estatísticas depois
      const statsAfter = await this.ragService.getKnowledgeStats();
      console.log(chalk.blue(`📊 Resultado: ${statsAfter.documentCount} documentos indexados`));

      // Testa busca
      console.log(chalk.yellow('\n🔍 Testando busca...'));
      await this.testSearch();

      console.log(chalk.green.bold('\n🎉 Base de conhecimento carregada com sucesso!\n'));

      // Finaliza
      await this.ragService.shutdown();

    } catch (error) {
      console.error(chalk.red('❌ Erro durante o carregamento:'), error.message);
      logger.error('Erro no carregamento da base de conhecimento:', error);
      process.exit(1);
    }
  }

  async testSearch() {
    const testQueries = [
      'preço do curso',
      'certificado',
      'quanto tempo de acesso',
      'professor do curso',
      'formas de pagamento'
    ];

    for (const query of testQueries) {
      try {
        console.log(chalk.gray(`   Testando: "${query}"`));
        const results = await this.ragService.searchKnowledge(query, 2);

        if (results.length > 0) {
          console.log(chalk.green(`   ✅ ${results.length} resultados encontrados`));
        } else {
          console.log(chalk.yellow(`   ⚠️  Nenhum resultado para "${query}"`));
        }
      } catch (error) {
        console.log(chalk.red(`   ❌ Erro na busca por "${query}"`));
      }
    }
  }
}

// Executa o carregador
const loader = new KnowledgeLoader();
loader.run().catch((error) => {
  console.error(chalk.red('❌ Erro fatal:'), error);
  process.exit(1);
});