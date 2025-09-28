#!/usr/bin/env node

// Script para testar o chat automaticamente
import SalesAgentCLI from './src/index.js';

async function testChat() {
  console.log('🧪 Teste automatizado do chat...\n');

  const cli = new SalesAgentCLI();

  try {
    const initialized = await cli.initialize();
    if (!initialized) {
      console.log('❌ Falha na inicialização');
      process.exit(1);
    }

    console.log('✅ Sistema inicializado. Testando chat...\n');

    // Simula o chat direto
    await cli.startChat();

  } catch (error) {
    console.error('❌ Erro no teste:', error);
    process.exit(1);
  }
}

// Executa o teste
testChat().catch(console.error);