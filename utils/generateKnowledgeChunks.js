// utils/generateKnowledgeChunks.js
// Script para gerar chunks de conhecimento automaticamente a partir do knowledgeBase.js
// Uso: node utils/generateKnowledgeChunks.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log function that forces output
function log(message) {
    process.stdout.write(message + '\n');
}

// Função para processar recursivamente o objeto de conhecimento
function processKnowledgeObject(obj, currentPath = [], chunks = []) {
    for (const [key, value] of Object.entries(obj)) {
        const newPath = [...currentPath, key];
        const sourceId = newPath.join('_');
        
        if (typeof value === 'string') {
            // É um valor string - criar chunk
            chunks.push({
                source: sourceId,
                content: value
            });
        } else if (Array.isArray(value)) {
            // É um array - juntar os itens em uma string
            const arrayContent = value.map(item => `"${item}"`).join(', ');
            chunks.push({
                source: sourceId,
                content: `${getContextualPrefix(newPath)} ${arrayContent}.`
            });
        } else if (typeof value === 'object' && value !== null) {
            // É um objeto - processar recursivamente
            processKnowledgeObject(value, newPath, chunks);
        }
    }
    return chunks;
}

// Função para gerar prefixos contextuais baseados no caminho
function getContextualPrefix(pathArray) {
    const lastKey = pathArray[pathArray.length - 1];
    const contextMap = {
        'modulos_principais': 'O curso é extremamente completo e cobre os seguintes módulos principais:',
        'combo_advocacia_4_0': 'Como bônus, você recebe o "Combo Advocacia 4.0", que inclui os seguintes materiais:',
        'combo_segredos_prospeccao': 'Você também recebe o "Combo Segredos da Prospecção", que inclui:',
        'outros_bonus': 'Outros bônus importantes são:',
        'formas_pagamento': 'As formas de pagamento aceitas são:',
        'areas_cobertas': 'Além de sucessões, o curso também cobre:',
        'argumento': 'Argumento para a objeção:',
        'objecao': 'Objeção comum:'
    };
    
    return contextMap[lastKey] || `Informação sobre ${lastKey.replace(/_/g, ' ')}:`;
}

// Função para gerar chunks especializados baseados na estrutura do DPA
function generateSpecializedChunks(knowledgeBase) {
    const chunks = [];
    const curso = knowledgeBase.curso;
    
    // 1. Informações básicas completas
    chunks.push({
        source: 'curso_informacoes_basicas_completo',
        content: `O nome do curso é '${curso.informacoes_basicas.nome}', oferecido pela ${curso.informacoes_basicas.instituicao}. ${curso.informacoes_basicas.objetivo_principal} O público-alvo são ${curso.informacoes_basicas.publico_alvo}.`
    });
    
    // 2. Política de acesso crítica
    chunks.push({
        source: 'curso_acesso_politica_critica',
        content: `ATENÇÃO: A política de acesso é ${curso.acesso_e_tempo.duracao_acesso}. ${curso.acesso_e_tempo.tipo_acesso}. ${curso.acesso_e_tempo.expiracao}. ${curso.acesso_e_tempo.renovacao}. ${curso.acesso_e_tempo.importancia}`
    });
    
    // 3. Investimento completo
    chunks.push({
        source: 'curso_investimento_completo',
        content: `O preço do curso é ${curso.investimento.valor_vista} à vista ou ${curso.investimento.valor_parcelado}. ${curso.investimento.valor_diario}. ${curso.investimento.formas_pagamento}`
    });
    
    // 4. Detalhes técnicos completos
    chunks.push({
        source: 'curso_detalhes_completos',
        content: `${curso.detalhes_tecnicos.carga_horaria}. ${curso.detalhes_tecnicos.tempo_conclusao}. ${curso.detalhes_tecnicos.formato}. ${curso.detalhes_tecnicos.certificado}`
    });
    
    // 5. Professor e metodologia
    chunks.push({
        source: 'professor_completo',
        content: `${curso.professor.experiencia_advocacia} e ${curso.professor.experiencia_magistratura}. ${curso.professor.decisao_carreira}. ${curso.professor.foco_ensino}. ${curso.professor.metodologia}`
    });
    
    // 6. Suporte completo
    chunks.push({
        source: 'suporte_completo',
        content: `${curso.suporte.pedagogico} ${curso.suporte.tecnico_administrativo}. ${curso.suporte.comunidade}`
    });
    
    // 7. Seção objections_handling removida - objeções agora são tratadas pelas diretrizes estruturadas
    
    // 8. Processa argumentos de vendas
    for (const [argKey, argValue] of Object.entries(knowledgeBase.argumentos_vendas)) {
        chunks.push({
            source: `vendas_${argKey}`,
            content: `Argumento de Venda: ${argValue}`
        });
    }
    
    // 9. Processa FAQ de forma especializada
    for (const [faqKey, faqValue] of Object.entries(curso.faq)) {
        chunks.push({
            source: `faq_${faqKey}`,
            content: `FAQ: ${faqValue}`
        });
    }
    
    // 10. Processa políticas
    for (const [polKey, polValue] of Object.entries(knowledgeBase.politicas)) {
        if (typeof polValue === 'object') {
            const policyText = Object.values(polValue).join(' ');
            chunks.push({
                source: `politica_${polKey}`,
                content: `Política: ${policyText}`
            });
        } else {
            chunks.push({
                source: `politica_${polKey}`,
                content: `Política: ${polValue}`
            });
        }
    }
    
    return chunks;
}

async function generateChunks() {
    try {
        log('🚀 Iniciando geração de chunks de conhecimento...');
        
        // Importar o knowledgeBase dinamicamente
        const knowledgeBaseUrl = `file://${path.resolve(__dirname, '../data/knowledgeBase.js')}?t=${Date.now()}`;
        const { knowledgeBase } = await import(knowledgeBaseUrl);
        
        log('📚 Conhecimento base carregado com sucesso!');
        
        // Gerar chunks especializados
        const chunks = generateSpecializedChunks(knowledgeBase);
        
        log(`✨ Gerados ${chunks.length} chunks de conhecimento!`);
        
        // Gerar o conteúdo do arquivo processedKnowledge.js
        const fileContent = `// data/processedKnowledge.js
// ⚠️  ARQUIVO GERADO AUTOMATICAMENTE - NÃO EDITE MANUALMENTE! ⚠️
// Para atualizar, edite data/knowledgeBase.js e execute: node utils/generateKnowledgeChunks.js
// Gerado em: ${new Date().toLocaleString('pt-BR')}

export const processedKnowledge = ${JSON.stringify(chunks, null, 2)};
`;
        
        // Escrever o arquivo
        const outputPath = path.resolve(__dirname, '../data/processedKnowledge.js');
        fs.writeFileSync(outputPath, fileContent, 'utf8');
        
        log('✅ Arquivo processedKnowledge.js atualizado com sucesso!');
        log(`📊 Total de chunks: ${chunks.length}`);
        log(`📁 Arquivo salvo em: ${outputPath}`);
        
        // Mostrar estatísticas
        const avgChunkSize = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length;
        log(`📈 Tamanho médio dos chunks: ${Math.round(avgChunkSize)} caracteres`);
        
        // Mostrar preview dos primeiros chunks
        log('\n📋 Preview dos primeiros chunks:');
        chunks.slice(0, 3).forEach((chunk, index) => {
            log(`${index + 1}. [${chunk.source}] ${chunk.content.substring(0, 100)}...`);
        });
        
        log('\n🎉 Processo concluído! O sistema RAG está pronto para usar os novos chunks.');
        
    } catch (error) {
        log('❌ Erro ao gerar chunks: ' + error.message);
        log(error.stack);
        process.exit(1);
    }
}

// Executar se for chamado diretamente
if (import.meta.url === `file://${process.argv[1]}`) {
    generateChunks();
}

export { generateChunks }; 