#!/usr/bin/env node

import chalk from 'chalk';
import { validateConfig } from './src/config/config.js';
import SalesAgent from './src/agents/salesAgent.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function debugCLI() {
  console.log(chalk.blue.bold('\n🔍 Debug do CLI\n'));

  try {
    console.log(chalk.yellow('1. Verificando configuração...'));
    const configValid = validateConfig();
    console.log(chalk.green(`✅ Configuração válida: ${configValid}`));

    if (!configValid) {
      console.log(chalk.red('❌ Configuração inválida - parando aqui'));
      return;
    }

    console.log(chalk.yellow('\n2. Verificando arquivo knowledge.json...'));
    const knowledgePath = path.join(__dirname, 'data/knowledge.json');
    const exists = fs.existsSync(knowledgePath);
    console.log(chalk.green(`✅ knowledge.json existe: ${exists}`));

    if (!exists) {
      console.log(chalk.red('❌ Arquivo knowledge.json não encontrado - parando aqui'));
      return;
    }

    const knowledgeData = JSON.parse(fs.readFileSync(knowledgePath, 'utf8'));
    console.log(chalk.green(`✅ knowledge.json carregado: ${knowledgeData.length} entradas`));

    console.log(chalk.yellow('\n3. Inicializando Sales Agent...'));
    const agent = new SalesAgent();

    const initialized = await agent.initialize();
    console.log(chalk.green(`✅ Agent inicializado: ${initialized}`));

    if (!initialized) {
      console.log(chalk.red('❌ Falha ao inicializar agente - parando aqui'));
      return;
    }

    console.log(chalk.yellow('\n4. Carregando base de conhecimento...'));
    await agent.loadKnowledge(knowledgeData);
    console.log(chalk.green('✅ Base de conhecimento carregada'));

    console.log(chalk.yellow('\n5. Verificando estatísticas...'));
    const stats = await agent.getStats();
    console.log(chalk.blue(`📊 Agente: ${stats.agent.initialized ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 RAG: ${stats.rag.supabaseConnected ? '✅' : '❌'}`));
    console.log(chalk.blue(`📊 Documentos: ${stats.rag.documentCount}`));

    console.log(chalk.green.bold('\n🎉 Debug concluído - tudo funcionando!\n'));

    await agent.shutdown();

  } catch (error) {
    console.log(chalk.red('\n❌ Erro durante debug:'));
    console.log(chalk.red(error.message));
    console.log(chalk.gray(error.stack));
  }
}

debugCLI().catch(console.error);