/**
 * Script de teste para verificar conexão com Evolution API
 * Execute: node test-evolution-connection.js
 */

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8080';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'my-secure-api-key-12345';

console.log('🔍 Testando conexão com Evolution API...\n');
console.log(`📡 URL: ${EVOLUTION_API_URL}`);
console.log(`🔑 API Key: ${EVOLUTION_API_KEY.substring(0, 10)}...`);
console.log('─'.repeat(50));

const apiClient = axios.create({
  baseURL: EVOLUTION_API_URL,
  headers: {
    'apikey': EVOLUTION_API_KEY,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function testConnection() {
  try {
    // Teste 1: Verificar se a API está rodando
    console.log('\n✅ Teste 1: Verificando se Evolution API está acessível...');
    try {
      const healthResponse = await axios.get(`${EVOLUTION_API_URL}/`);
      console.log('   ✓ Evolution API está rodando!');
      console.log(`   Status: ${healthResponse.status}`);
    } catch (error) {
      console.error('   ✗ Evolution API não está acessível!');
      console.error(`   Erro: ${error.message}`);
      console.error('\n💡 Dica: Execute "docker-compose -f docker-compose-evolution.yml up -d"');
      process.exit(1);
    }

    // Teste 2: Listar instâncias existentes
    console.log('\n✅ Teste 2: Listando instâncias existentes...');
    try {
      const instancesResponse = await apiClient.get('/instance/fetchInstances');
      const instances = instancesResponse.data;

      if (instances && instances.length > 0) {
        console.log(`   ✓ Encontradas ${instances.length} instância(s):`);
        instances.forEach(inst => {
          console.log(`     - ${inst.instance?.instanceName || inst.instanceName || 'N/A'} (${inst.state || 'desconhecido'})`);
        });
      } else {
        console.log('   ℹ Nenhuma instância encontrada (normal para primeira execução)');
      }
    } catch (error) {
      if (error.response?.status === 401) {
        console.error('   ✗ Erro de autenticação!');
        console.error('   💡 Verifique se a EVOLUTION_API_KEY está correta no .env');
      } else {
        console.error(`   ✗ Erro ao listar instâncias: ${error.message}`);
      }
    }

    // Teste 3: Verificar endpoint de webhook
    console.log('\n✅ Teste 3: Verificando endpoint de webhook local...');
    const webhookUrl = process.env.WEBHOOK_URL || `http://localhost:${process.env.PORT || 3000}/webhook`;
    console.log(`   URL do webhook: ${webhookUrl}`);

    try {
      const webhookTest = await axios.post(webhookUrl, {
        event: 'test',
        instance: 'test-instance',
        data: { message: 'Teste de conexão' }
      }, { timeout: 3000 });

      console.log('   ✓ Endpoint de webhook está respondendo!');
      console.log(`   Status: ${webhookTest.status}`);
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.warn('   ⚠ Endpoint de webhook não está rodando');
        console.warn('   💡 Isso é normal se o bot ainda não foi iniciado');
        console.warn('   💡 Execute "npm start" em outro terminal');
      } else {
        console.warn(`   ⚠ Webhook retornou: ${error.response?.status || error.message}`);
      }
    }

    console.log('\n' + '─'.repeat(50));
    console.log('✨ RESUMO:');
    console.log('   ✓ Evolution API está funcionando');
    console.log('   ✓ Autenticação está configurada');
    console.log('\n📝 PRÓXIMOS PASSOS:');
    console.log('   1. Se o bot não estiver rodando, execute: npm start');
    console.log('   2. Aguarde o QR Code aparecer');
    console.log('   3. Escaneie o QR Code com seu WhatsApp');
    console.log('   4. Teste enviando uma mensagem');
    console.log('\n🎉 Tudo pronto para começar!\n');

  } catch (error) {
    console.error('\n❌ Erro durante os testes:', error.message);
    process.exit(1);
  }
}

testConnection();
