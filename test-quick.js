import SalesAgent from './src/agents/salesAgent.js';
import { processedKnowledge } from './knowledge.js';

console.log('🧪 Teste Rápido - RAG e Saudações\n');

async function testQuick() {
  const agent = new SalesAgent();

  try {
    console.log('📋 Inicializando...');
    await agent.initialize();
    await agent.loadKnowledge(processedKnowledge);

    // Teste 1: Mensagem simples
    console.log('\n🔸 Teste 1: "oi"');
    const result1 = await agent.processFirstMessage('oi');
    console.log('🤖 Resposta:', result1.response.substring(0, 100) + '...');
    console.log('📊 Usou RAG:', result1.hasContext);

    // Reset agent
    agent.resetSession();

    // Teste 2: Pergunta sobre preço
    console.log('\n🔸 Teste 2: "qual o preço do curso?"');
    const result2 = await agent.processFirstMessage('qual o preço do curso?');
    console.log('🤖 Resposta:', result2.response.substring(0, 100) + '...');
    console.log('📊 Usou RAG:', result2.hasContext);

    // Reset agent
    agent.resetSession();

    // Teste 3: Pergunta com sinônimo
    console.log('\n🔸 Teste 3: "quanto custa?"');
    const result3 = await agent.processFirstMessage('quanto custa?');
    console.log('🤖 Resposta:', result3.response.substring(0, 100) + '...');
    console.log('📊 Usou RAG:', result3.hasContext);

    await agent.shutdown();
    console.log('\n✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
    await agent.shutdown();
  }
}

testQuick();