// Arquivo de conhecimento para o RAG Service
// Este arquivo carrega os dados do knowledge.json para uso no sistema

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Carrega o arquivo knowledge.json
const knowledgeFilePath = path.join(__dirname, 'data', 'knowledge.json');

let processedKnowledge = [];

try {
  const rawData = fs.readFileSync(knowledgeFilePath, 'utf8');
  const knowledgeData = JSON.parse(rawData);

  // Processa os dados para o formato esperado pelo RAG
  processedKnowledge = knowledgeData.map((item, index) => ({
    id: `knowledge_${index}`,
    source: item.source,
    content: item.content,
    metadata: {
      type: 'knowledge_base',
      index: index,
      source: item.source
    }
  }));

  console.log(`✅ Knowledge.js carregado: ${processedKnowledge.length} documentos`);
} catch (error) {
  console.warn('⚠️ Erro ao carregar knowledge.js:', error.message);
  // Fallback com conhecimento básico se não conseguir carregar o arquivo
  processedKnowledge = [
    {
      id: 'basic_1',
      source: 'curso_basico',
      content: 'Curso Completo de Prática em Sucessões e Inventários ministrado por Jaylton Lopes, ex-juiz TJDFT. Investimento: 12x R$ 194,56 ou R$ 1.997,00 à vista.',
      metadata: { type: 'fallback', source: 'curso_basico' }
    }
  ];
}

export { processedKnowledge };
export default { processedKnowledge };