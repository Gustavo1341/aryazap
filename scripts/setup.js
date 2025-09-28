#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class SetupScript {
  constructor() {
    this.envPath = path.join(__dirname, '../.env');
    this.envExamplePath = path.join(__dirname, '../.env.example');
  }

  async run() {
    console.log(chalk.blue.bold('\n🚀 Setup do Sales Agent CLI\n'));

    // Verifica se .env já existe
    if (fs.existsSync(this.envPath)) {
      const { overwrite } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'overwrite',
          message: 'Arquivo .env já existe. Deseja reconfigurar?',
          default: false,
        },
      ]);

      if (!overwrite) {
        console.log(chalk.yellow('Setup cancelado.'));
        process.exit(0);
      }
    }

    await this.setupEnvironment();
    await this.setupChromaDB();
    await this.showNextSteps();
  }

  async setupEnvironment() {
    console.log(chalk.green('\n📝 Configuração das Variáveis de Ambiente\n'));

    const questions = [
      {
        type: 'input',
        name: 'GEMINI_API_KEY',
        message: 'Chave da API do Google Gemini:',
        validate: (input) => input.length > 0 || 'A chave da API é obrigatória',
      },
      {
        type: 'input',
        name: 'OPENAI_API_KEY',
        message: 'Chave da API da OpenAI (opcional):',
      },
      {
        type: 'input',
        name: 'CHROMA_HOST',
        message: 'Host do ChromaDB:',
        default: 'localhost',
      },
      {
        type: 'input',
        name: 'CHROMA_PORT',
        message: 'Porta do ChromaDB:',
        default: '8000',
        validate: (input) => !isNaN(input) || 'A porta deve ser um número',
      },
      {
        type: 'input',
        name: 'BOT_FIRST_NAME',
        message: 'Nome do agente de vendas:',
        default: 'Pedro',
      },
      {
        type: 'input',
        name: 'SUPPORT_WHATSAPP_NUMBER',
        message: 'Número do WhatsApp de suporte:',
        default: '556199664525',
      },
      {
        type: 'list',
        name: 'DEBUG_MODE',
        message: 'Ativar modo de debug?',
        choices: ['true', 'false'],
        default: 'true',
      },
      {
        type: 'list',
        name: 'LOG_LEVEL',
        message: 'Nível de log:',
        choices: ['debug', 'info', 'warn', 'error'],
        default: 'info',
      },
    ];

    const answers = await inquirer.prompt(questions);

    // Cria arquivo .env
    const envContent = Object.entries(answers)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const fullEnvContent = `# Configurações da IA
${envContent}

# Configurações do ChromaDB
CHROMA_COLLECTION_NAME=sales_knowledge

# Configurações do Bot
BOT_COMPANY_NAME=DPA - Direito Processual Aplicado
BOT_POSITION=Especialista
TARGET_PRODUCT_ID=PRODUCT_A
`;

    fs.writeFileSync(this.envPath, fullEnvContent);
    console.log(chalk.green('✅ Arquivo .env criado com sucesso!'));
  }

  async setupChromaDB() {
    console.log(chalk.green('\n🗄️ Configuração do ChromaDB\n'));

    const { setupChroma } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'setupChroma',
        message: 'Deseja que eu te ajude a configurar o ChromaDB?',
        default: true,
      },
    ]);

    if (!setupChroma) {
      console.log(chalk.yellow('Configuração do ChromaDB pulada.'));
      return;
    }

    console.log(chalk.blue('\n📋 Instruções para ChromaDB:\n'));

    console.log(chalk.white('1. Instale o Docker (se não tiver):'));
    console.log(chalk.gray('   https://docs.docker.com/get-docker/\n'));

    console.log(chalk.white('2. Execute o ChromaDB em Docker:'));
    console.log(chalk.cyan('   docker run -p 8000:8000 chromadb/chroma\n'));

    console.log(chalk.white('3. Ou instale via Python:'));
    console.log(chalk.cyan('   pip install chromadb'));
    console.log(chalk.cyan('   chroma run --host localhost --port 8000\n'));

    const { chromaRunning } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'chromaRunning',
        message: 'ChromaDB está rodando?',
        default: false,
      },
    ]);

    if (chromaRunning) {
      console.log(chalk.green('✅ Ótimo! O ChromaDB está configurado.'));
    } else {
      console.log(chalk.yellow('⚠️  Lembre-se de iniciar o ChromaDB antes de usar o sistema.'));
    }
  }

  async showNextSteps() {
    console.log(chalk.green('\n🎉 Setup Concluído!\n'));

    console.log(chalk.white('📋 Próximos passos:\n'));

    console.log(chalk.white('1. Instale as dependências:'));
    console.log(chalk.cyan('   npm install\n'));

    console.log(chalk.white('2. Inicie o ChromaDB (se ainda não fez):'));
    console.log(chalk.cyan('   docker run -p 8000:8000 chromadb/chroma\n'));

    console.log(chalk.white('3. Execute o agente:'));
    console.log(chalk.cyan('   npm start\n'));

    console.log(chalk.white('4. Para desenvolvimento com hot-reload:'));
    console.log(chalk.cyan('   npm run dev\n'));

    console.log(chalk.blue('📚 Documentação:'));
    console.log(chalk.gray('   - O agente usará a base de conhecimento do arquivo knowledge.js'));
    console.log(chalk.gray('   - O funil de vendas segue o salesFunnelBluePrint.js'));
    console.log(chalk.gray('   - Logs são salvos na pasta logs/\n'));

    console.log(chalk.green('✨ Divirta-se testando o melhor agente de vendas do mundo!\n'));
  }
}

// Executa o setup
const setup = new SetupScript();
setup.run().catch((error) => {
  console.error(chalk.red('❌ Erro durante o setup:'), error);
  process.exit(1);
});