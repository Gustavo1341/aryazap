import SalesAgent from './src/agents/salesAgent.js';
import { processedKnowledge } from './knowledge.js';

async function debugTest() {
  console.log('🔍 Debug Test - Verificando Output Vazio\n');

  const agent = new SalesAgent();

  try {
    console.log('Inicializando...');
    await agent.initialize();
    await agent.loadKnowledge(processedKnowledge);

    console.log('\n===== TESTE 1: Mensagem Simples =====');
    const result1 = await agent.processFirstMessage('oi');
    console.log('📤 RESPOSTA COMPLETA:');
    console.log(`"${result1.response}"`);
    console.log(`📏 Tamanho: ${result1.response.length} caracteres`);
    console.log(`🔄 Avançou: ${result1.advanced}`);
    console.log(`📍 Etapa: ${result1.currentStep.id}`);

    agent.resetSession();

    console.log('\n===== TESTE 2: Pergunta sobre Preço =====');
    const result2 = await agent.processFirstMessage('Qual o preço do curso?');
    console.log('📤 RESPOSTA COMPLETA:');
    console.log(`"${result2.response}"`);
    console.log(`📏 Tamanho: ${result2.response.length} caracteres`);
    console.log(`🔄 Avançou: ${result2.advanced}`);
    console.log(`📍 Etapa: ${result2.currentStep.id}`);

    await agent.shutdown();

  } catch (error) {
    console.error('❌ Erro:', error);
    await agent.shutdown();
  }
}

debugTest();