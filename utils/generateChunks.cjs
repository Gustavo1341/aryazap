// utils/generateChunks.cjs
// Script CommonJS para gerar chunks de conhecimento
// Uso: node utils/generateChunks.cjs

const fs = require('fs');
const path = require('path');

console.log('🚀 Iniciando geração de chunks...');

// Função para ler e importar o knowledgeBase dinamicamente
function loadKnowledgeBase() {
    try {
        const knowledgeBasePath = path.join(__dirname, '../data/knowledgeBase.js');
        const content = fs.readFileSync(knowledgeBasePath, 'utf8');
        
        // Extrair apenas o objeto do knowledgeBase
        const match = content.match(/export const knowledgeBase = ({[\s\S]*});/);
        if (!match) {
            throw new Error('Não foi possível extrair knowledgeBase do arquivo');
        }
        
        // Usar Function constructor para avaliar o objeto de forma segura
        const knowledgeBaseObj = new Function('return ' + match[1])();
        console.log('📚 Knowledge base carregado dinamicamente!');
        return knowledgeBaseObj;
        
    } catch (error) {
        console.error('❌ Erro ao carregar knowledge base:', error.message);
        process.exit(1);
    }
}

function generateDetailedChunks(knowledgeBase) {
    const chunks = [];

    // Função auxiliar para percorrer objetos profundamente
    function extractDetailedInfo(obj, prefix = '') {
        let result = '';
        for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'object' && value !== null) {
                result += extractDetailedInfo(value, prefix + key + '.');
            } else {
                result += `${prefix}${key}: ${value}\n`;
            }
        }
        return result;
    }

    // 1. INFORMAÇÕES BÁSICAS DO CURSO - COMPLETAS
    chunks.push({
        source: 'informacoes_basicas_completas',
        content: `CURSO COMPLETO: ${knowledgeBase.curso.informacoes_basicas.nome}
INSTITUIÇÃO: ${knowledgeBase.curso.informacoes_basicas.instituicao}
PÚBLICO-ALVO: ${knowledgeBase.curso.informacoes_basicas.publico_alvo}
OBJETIVO PRINCIPAL: ${knowledgeBase.curso.informacoes_basicas.objetivo_principal}
ASSISTENTE RESPONSÁVEL: ${knowledgeBase.curso.informacoes_basicas.assistente}

Este é um curso especializado e completo para advogados que querem dominar sucessões e inventários, com foco na prática profissional de alto nível. O curso transforma a advocacia do aluno para se tornar um profissional de destaque e bem-sucedido nestas áreas.`
    });

    // 2. DETALHES TÉCNICOS COMPLETOS
    chunks.push({
        source: 'detalhes_tecnicos_completos',
        content: `ESTRUTURA TÉCNICA DO CURSO:
• CARGA HORÁRIA: ${knowledgeBase.curso.detalhes_tecnicos.carga_horaria}
• TEMPO PARA CONCLUSÃO: ${knowledgeBase.curso.detalhes_tecnicos.tempo_conclusao}
• FORMATO DAS AULAS: ${knowledgeBase.curso.detalhes_tecnicos.formato}
• CERTIFICADO: ${knowledgeBase.curso.detalhes_tecnicos.certificado}

O curso é estruturado de forma prática e objetiva, permitindo que o aluno comece a aplicar o conhecimento imediatamente após assistir as aulas. As aulas são gravadas e podem ser assistidas no ritmo do aluno.`
    });

    // 3. POLÍTICA DE ACESSO - MUITO IMPORTANTE
    chunks.push({
        source: 'politica_acesso_critica',
        content: `⚠️ POLÍTICA DE ACESSO - INFORMAÇÃO CRÍTICA:
• DURAÇÃO DO ACESSO: ${knowledgeBase.curso.acesso_e_tempo.duracao_acesso}
• TIPO DE ACESSO: ${knowledgeBase.curso.acesso_e_tempo.tipo_acesso}
• EXPIRAÇÃO: ${knowledgeBase.curso.acesso_e_tempo.expiracao}
• RENOVAÇÃO: ${knowledgeBase.curso.acesso_e_tempo.renovacao}
• IMPORTÂNCIA: ${knowledgeBase.curso.acesso_e_tempo.importancia}

⚠️ ATENÇÃO: Este é um ponto crítico que deve ser sempre destacado. O acesso é limitado e definitivo. Não há possibilidade de extensão de prazo após o vencimento. É fundamental que o aluno organize seus estudos dentro do período de 12 meses.`
    });

    // 4. INVESTIMENTO E FORMAS DE PAGAMENTO
    chunks.push({
        source: 'investimento_completo',
        content: `INVESTIMENTO NO CURSO:
💰 VALOR À VISTA: ${knowledgeBase.curso.investimento.valor_vista}
💳 VALOR PARCELADO: ${knowledgeBase.curso.investimento.valor_parcelado}
☕ VALOR DIÁRIO: ${knowledgeBase.curso.investimento.valor_diario}
💳 FORMAS DE PAGAMENTO ACEITAS: ${knowledgeBase.curso.investimento.formas_pagamento}
🔗 LINK DIRETO PARA INSCRIÇÃO: ${knowledgeBase.curso.investimento.link_inscricao}

O investimento é acessível e justificável pelo valor do conhecimento especializado oferecido. O parcelamento sem juros facilita o acesso ao curso para todos os interessados.`
    });

    // 5. SISTEMA DE SUPORTE COMPLETO
    chunks.push({
        source: 'suporte_completo',
        content: `SISTEMA DE SUPORTE AO ALUNO:
👨‍🏫 SUPORTE PEDAGÓGICO: ${knowledgeBase.curso.suporte.pedagogico}
📱 SUPORTE TÉCNICO/ADMINISTRATIVO: ${knowledgeBase.curso.suporte.tecnico_administrativo}
👥 COMUNIDADE DE ALUNOS: ${knowledgeBase.curso.suporte.comunidade}

O sistema de suporte é completo e garante que o aluno tenha toda a assistência necessária durante o período de acesso ao curso. O suporte pedagógico permite tirar dúvidas diretamente com o professor.`
    });

    // 6. FAQ - ACESSO PÓS-COMPRA
    chunks.push({
        source: 'faq_acesso_pos_compra',
        content: `PERGUNTA FREQUENTE: Como faço para acessar o curso após a compra?
RESPOSTA COMPLETA: ${knowledgeBase.faq.acesso_pos_compra}

Este é um processo automatizado e simples. O aluno recebe todas as informações necessárias por email imediatamente após a confirmação do pagamento.`
    });

    // 7. FAQ - CERTIFICADO
    chunks.push({
        source: 'faq_certificado',
        content: `PERGUNTA FREQUENTE: O curso possui certificado?
RESPOSTA COMPLETA: ${knowledgeBase.faq.certificado}

O certificado é gerado automaticamente após a conclusão de todas as aulas, sem necessidade de solicitação manual ou taxas adicionais.`
    });

    // 8. FAQ - TEMPO DE ACESSO (CRÍTICO)
    chunks.push({
        source: 'faq_tempo_acesso_critico',
        content: `PERGUNTA FREQUENTE: Por quanto tempo terei acesso ao curso?
RESPOSTA CRÍTICA: ${knowledgeBase.faq.tempo_acesso}

Esta é uma informação FUNDAMENTAL que deve ser sempre destacada. O acesso limitado é uma política definida e não há exceções.`
    });

    // 9. FAQ - GARANTIA DE SATISFAÇÃO
    chunks.push({
        source: 'faq_garantia_satisfacao',
        content: `PERGUNTA FREQUENTE: Existe garantia de satisfação?
RESPOSTA COMPLETA: ${knowledgeBase.faq.garantia_satisfacao}

A garantia é processada automaticamente pela Hotmart, plataforma de ensino reconhecida e confiável no mercado.`
    });

    // 10. FAQ ADICIONAL - CARGA HORÁRIA
    chunks.push({
        source: 'faq_carga_horaria',
        content: `PERGUNTA FREQUENTE: Qual é a carga horária do curso?
RESPOSTA COMPLETA: ${knowledgeBase.faq.carga_horaria}`
    });

    // 11. FAQ ADICIONAL - FORMATO DO CURSO
    chunks.push({
        source: 'faq_formato_curso',
        content: `PERGUNTA FREQUENTE: Qual é o formato do curso?
RESPOSTA COMPLETA: ${knowledgeBase.faq.formato_curso}`
    });

    // 12. FAQ ADICIONAL - DÚVIDAS E SUPORTE
    chunks.push({
        source: 'faq_duvidas_suporte',
        content: `PERGUNTA FREQUENTE: Como funcionam as dúvidas e suporte?
RESPOSTA COMPLETA: ${knowledgeBase.faq.duvidas_suporte}`
    });

    // 13. FAQ CRÍTICO - PÓS 12 MESES
    chunks.push({
        source: 'faq_pos_12_meses_critico',
        content: `PERGUNTA FREQUENTE: O que acontece após os 12 meses?
RESPOSTA CRÍTICA: ${knowledgeBase.faq.pos_12_meses}`
    });

    // 14. FAQ - VS PÓS-GRADUAÇÃO
    chunks.push({
        source: 'faq_vs_pos_graduacao',
        content: `PERGUNTA FREQUENTE: Como este curso se compara a uma pós-graduação?
RESPOSTA COMPLETA: ${knowledgeBase.faq.vs_pos_graduacao}`
    });

    // 15. FAQ - URGÊNCIA DE ESPECIALIZAÇÃO
    chunks.push({
        source: 'faq_urgencia_especializacao',
        content: `CONTEXTO IMPORTANTE: Por que é urgente se especializar?
RESPOSTA: ${knowledgeBase.faq.urgencia_especializacao}`
    });

    // 16. FAQ - QUEM É O PROFESSOR
    if (knowledgeBase.faq.quem_e_o_professor) {
        chunks.push({
            source: 'faq_quem_e_o_professor',
            content: `PERGUNTA FREQUENTE: ${knowledgeBase.faq.quem_e_o_professor.pergunta}
RESPOSTA COMPLETA: ${knowledgeBase.faq.quem_e_o_professor.resposta}

Esta é uma resposta direta sobre a identidade e experiência do professor do curso, incluindo seu nome e credenciais.`
        });
    }

    // 17. PROFESSOR - CREDENCIAIS COMPLETAS
    chunks.push({
        source: 'professor_credenciais_completas',
        content: `SOBRE O PROFESSOR:
👨‍⚖️ EXPERIÊNCIA NA ADVOCACIA: ${knowledgeBase.professor.experiencia_advocacia}
👨‍⚖️ EXPERIÊNCIA NA MAGISTRATURA: ${knowledgeBase.professor.experiencia_magistratura}
🎯 DECISÃO DE CARREIRA: ${knowledgeBase.professor.decisao_carreira}
🎓 FOCO NO ENSINO: ${knowledgeBase.professor.foco_ensino}
📚 METODOLOGIA DE ENSINO: ${knowledgeBase.professor.metodologia}

O professor possui experiência única tanto na advocacia quanto na magistratura, garantindo uma visão completa e prática do direito de família e sucessões. Sua dupla experiência permite ensinar tanto a perspectiva do advogado quanto do magistrado, transformando teoria em prática aplicável e rentável.`
    });

    // 18. CONTEÚDO PROGRAMÁTICO - MÓDULOS PRINCIPAIS
    chunks.push({
        source: 'conteudo_programatico_modulos',
        content: `CONTEÚDO PROGRAMÁTICO COMPLETO - MÓDULOS PRINCIPAIS:
${knowledgeBase.conteudo_programatico.modulos_principais.map((modulo, index) => `${index + 1}. ${modulo}`).join('\n')}

ÁREAS COBERTAS: ${knowledgeBase.conteudo_programatico.areas_cobertas}

Este é o conteúdo mais completo e estruturado disponível no mercado para advogados que querem dominar totalmente o direito de família e sucessões.`
    });

    // 19. BÔNUS E MATERIAIS EXTRAS (SEM MENÇÃO ÀS IAs)
    chunks.push({
        source: 'bonus_materiais_completos',
        content: `MATERIAIS BÔNUS INCLUSOS:

🎁 COMBO ADVOCACIA 4.0:
${knowledgeBase.bonus_materiais.combo_advocacia_4_0.map(item => `• ${item}`).join('\n')}

🎁 COMBO SEGREDOS DA PROSPECÇÃO:
${knowledgeBase.bonus_materiais.combo_segredos_prospeccao.map(item => `• ${item}`).join('\n')}

🎁 OUTROS BÔNUS:
${knowledgeBase.bonus_materiais.outros_bonus.filter(item => !item.includes('IAJUR') && !item.includes('Mar.IA')).map(item => `• ${item}`).join('\n')}

São mais de 15 bônus extras inclusos no curso, aumentando drasticamente o valor do investimento.`
    });

    // 19.1. BÔNUS ESPECÍFICO - IAJUR
    chunks.push({
        source: 'bonus_iajur_especifico',
        content: `🎁 BÔNUS EXCLUSIVO - IAJUR:

• IAJUR - Inteligência Artificial para elaboração de petições de inventários

Esta é uma ferramenta revolucionária incluída como bônus do curso, desenvolvida especificamente para automatizar a elaboração de documentos jurídicos na área sucessória.

PALAVRAS-CHAVE: IAJUR, bônus, inteligência artificial, petições, inventários, ferramenta jurídica`
    });

    // 19.2. BÔNUS ESPECÍFICO - MAR.IA
    chunks.push({
        source: 'bonus_maria_especifico',
        content: `🎁 BÔNUS EXCLUSIVO - MAR.IA:

• Mar.IA - Inteligência Artificial para tirar dúvidas específicas de cada aula 24/7

Esta é uma assistente virtual educacional incluída como bônus do curso, disponível 24 horas por dia para esclarecer dúvidas sobre o conteúdo das aulas.

PALAVRAS-CHAVE: Mar.IA, maria, bônus, assistente virtual, dúvidas, suporte educacional, 24/7`
    });

    // 19.1. INTELIGÊNCIAS ARTIFICIAIS - IAJUR (ESPECÍFICO)
    if (knowledgeBase.inteligencias_artificiais && knowledgeBase.inteligencias_artificiais.iajur) {
        chunks.push({
            source: 'inteligencias_artificiais_iajur',
            content: `🤖 IAJUR - INTELIGÊNCIA ARTIFICIAL JURÍDICA:

📋 NOME: ${knowledgeBase.inteligencias_artificiais.iajur.nome}
📝 DESCRIÇÃO: ${knowledgeBase.inteligencias_artificiais.iajur.descricao}

🎯 FUNCIONALIDADES:
${knowledgeBase.inteligencias_artificiais.iajur.funcionalidades.map(func => `• ${func}`).join('\n')}

⭐ DIFERENCIAL: ${knowledgeBase.inteligencias_artificiais.iajur.diferencial}

🔑 ACESSO: ${knowledgeBase.inteligencias_artificiais.iajur.acesso}
🎯 OBJETIVO: ${knowledgeBase.inteligencias_artificiais.iajur.objetivo}
⚡ ECONOMIA DE TEMPO: ${knowledgeBase.inteligencias_artificiais.iajur.economia_tempo}
🏆 VANTAGEM COMPETITIVA: ${knowledgeBase.inteligencias_artificiais.iajur.vantagem_competitiva}

A IAJUR é uma ferramenta especializada para automatizar e agilizar a elaboração de petições e documentos jurídicos, especialmente na área de inventários e sucessões.

PALAVRAS-CHAVE: IAJUR, IA JUR, inteligencia artificial juridica, petições, inventário, documentos jurídicos, automatização`
        });
    }

    // 19.2. INTELIGÊNCIAS ARTIFICIAIS - MAR.IA (ESPECÍFICO)
    if (knowledgeBase.inteligencias_artificiais && knowledgeBase.inteligencias_artificiais.maria) {
        chunks.push({
            source: 'inteligencias_artificiais_maria',
            content: `🤖 MAR.IA - ASSISTENTE VIRTUAL EDUCACIONAL:

📋 NOME: ${knowledgeBase.inteligencias_artificiais.maria.nome}
📝 DESCRIÇÃO: ${knowledgeBase.inteligencias_artificiais.maria.descricao}

🎯 FUNCIONALIDADES:
${knowledgeBase.inteligencias_artificiais.maria.funcionalidades.map(func => `• ${func}`).join('\n')}

⭐ DIFERENCIAL: ${knowledgeBase.inteligencias_artificiais.maria.diferencial}

🔑 ACESSO: ${knowledgeBase.inteligencias_artificiais.maria.acesso}
🎯 OBJETIVO: ${knowledgeBase.inteligencias_artificiais.maria.objetivo}
⏰ DISPONIBILIDADE: ${knowledgeBase.inteligencias_artificiais.maria.disponibilidade}
💡 CONTEXTO DE USO: ${knowledgeBase.inteligencias_artificiais.maria.contexto_uso}

A Mar.IA é seu assistente pessoal 24/7 para tirar dúvidas específicas sobre cada aula do curso, proporcionando suporte educacional contínuo.

PALAVRAS-CHAVE: Mar.IA, maria, assistente virtual, dúvidas, aulas, suporte educacional, 24/7`
        });
    }

    // 19.3. INTELIGÊNCIAS ARTIFICIAIS - DIFERENÇA PRINCIPAL
    if (knowledgeBase.inteligencias_artificiais && knowledgeBase.inteligencias_artificiais.diferenca_principal) {
        chunks.push({
            source: 'inteligencias_artificiais_diferenca',
            content: `🔍 DIFERENÇA ENTRE AS INTELIGÊNCIAS ARTIFICIAIS:

📊 DIFERENÇA PRINCIPAL: ${knowledgeBase.inteligencias_artificiais.diferenca_principal}

💎 VALOR AGREGADO: ${knowledgeBase.inteligencias_artificiais.valor_agregado}

Cada IA tem sua função específica: a IAJUR foca na prática jurídica (elaboração de documentos), enquanto a Mar.IA foca no suporte educacional (esclarecimento de dúvidas do curso).`
        });
    }

    // 19.4. INTELIGÊNCIAS ARTIFICIAIS - ACESSO GERAL
    if (knowledgeBase.inteligencias_artificiais) {
        chunks.push({
            source: 'inteligencias_artificiais_acesso',
            content: `🔑 ACESSO ÀS INTELIGÊNCIAS ARTIFICIAIS:

🤖 IAJUR: ${knowledgeBase.inteligencias_artificiais.iajur ? knowledgeBase.inteligencias_artificiais.iajur.acesso : 'Incluída como bônus do curso'}
🤖 MAR.IA: ${knowledgeBase.inteligencias_artificiais.maria ? knowledgeBase.inteligencias_artificiais.maria.acesso : 'Incluída como bônus do curso'}

Ambas as inteligências artificiais são bônus exclusivos inclusos no curso, proporcionando ferramentas avançadas para otimizar tanto o aprendizado quanto a prática profissional.`
        });
    }

    // 20. PROVAS SOCIAIS - DEPOIMENTOS EM VÍDEO
    if (knowledgeBase.provas_sociais) {
        chunks.push({
            source: 'provas_sociais_depoimentos_video',
            content: `DEPOIMENTOS REAIS DE ALUNOS - PROVAS SOCIAIS:

🎥 ALUNA MARIANA:
• Nome: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_mariana.nome}
• Status: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_mariana.status}
• Link do depoimento: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_mariana.link_youtube}
• Resumo: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_mariana.resumo_depoimento}

🎥 ALUNA CRISTIANE COSTA:
• Nome: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_cristiane.nome}
• Status: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_cristiane.status}
• Link do depoimento: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_cristiane.link_youtube}
• Resumo: ${knowledgeBase.provas_sociais.depoimentos_video.aluna_cristiane.resumo_depoimento}
• Citação destaque: "${knowledgeBase.provas_sociais.depoimentos_video.aluna_cristiane.citacao_destaque}"

🎥 ALUNO ERNANDES:
• Nome: ${knowledgeBase.provas_sociais.depoimentos_video.aluno_ernandes.nome}
• Status: ${knowledgeBase.provas_sociais.depoimentos_video.aluno_ernandes.status}
• Link do depoimento: ${knowledgeBase.provas_sociais.depoimentos_video.aluno_ernandes.link_youtube}
• Resumo: ${knowledgeBase.provas_sociais.depoimentos_video.aluno_ernandes.resumo_depoimento}

Estes são depoimentos reais e verificáveis de alunos que obtiveram resultados excepcionais com o curso.`
        });

        chunks.push({
            source: 'provas_sociais_todos_os_links',
            content: `LINKS COMPLETOS DOS DEPOIMENTOS:

${knowledgeBase.provas_sociais.todos_os_links.links_completos}

INSTRUÇÕES DE USO: ${knowledgeBase.provas_sociais.todos_os_links.instrucoes_uso}

Use estes links quando o lead solicitar especificamente para ver depoimentos, provas sociais, resultados de outros alunos ou casos de sucesso. São provas reais e concretas do valor do curso.`
        });
    }

    // 21. NOVO CHUNK - MAIS PROVAS SOCIAIS (PÁGINA DE VENDAS)
    if (knowledgeBase.provas_sociais && knowledgeBase.provas_sociais.mais_provas) {
        chunks.push({
            source: 'provas_sociais_mais_provas_redes_sociais',
            content: `INSTRUÇÃO: ${knowledgeBase.provas_sociais.mais_provas.instrucao}
RESPOSTA SUGERIDA: ${knowledgeBase.provas_sociais.mais_provas.resposta_sugerida}

Use este chunk especificamente quando o lead pedir por MAIS provas sociais ou outros depoimentos além dos principais.`
        });
    }

    // 21.1. NOVO CHUNK - ESPECIFICAÇÕES DO CURSO (PÁGINA DE VENDAS)
    if (knowledgeBase.provas_sociais && knowledgeBase.provas_sociais.especificacoes_curso) {
        chunks.push({
            source: 'especificacoes_curso_pagina_vendas',
            content: `INSTRUÇÃO: ${knowledgeBase.provas_sociais.especificacoes_curso.instrucao}
RESPOSTA SUGERIDA: Perfeito, {contactName}! Você pode acessar nossa página de vendas: https://direitoprocessualaplicado.com.br/pos-graduacao-direito-sucessorio/ 

Lá você encontrará todas as especificações detalhadas do curso, o programa completo, os módulos, bônus e muito mais informações sobre tudo que está incluído, incluindo detalhes da pós-graduação disponível para alunos.

Use este chunk especificamente quando o lead pedir especificações, detalhes ou programa do curso.`
        });
    }

    // 22. POLÍTICAS IMPORTANTES
    chunks.push({
        source: 'politicas_curso_importantes',
        content: `POLÍTICAS IMPORTANTES DO CURSO:

⚠️ ACESSO CRÍTICO: ${knowledgeBase.politicas.acesso_critico}

🔒 EXCLUSIVIDADE: ${knowledgeBase.politicas.exclusividade}

✅ GARANTIA DE SATISFAÇÃO:
• ${knowledgeBase.politicas.garantia_satisfacao.descricao}
• ${knowledgeBase.politicas.garantia_satisfacao.processamento}
• PIX: ${knowledgeBase.politicas.garantia_satisfacao.pix_reembolso} ${knowledgeBase.politicas.garantia_satisfacao.prazo_deposito}
• CARTÃO: ${knowledgeBase.politicas.garantia_satisfacao.cartao_credito}

Estas políticas garantem transparência total e segurança para o aluno.`
    });

    // 23. RESPOSTAS ESTRATÉGICAS PARA OBJEÇÕES
    if (knowledgeBase.respostas_a_objecoes) {
        const respostasObjecoes = Object.entries(knowledgeBase.respostas_a_objecoes);
        respostasObjecoes.forEach(([key, value]) => {
            chunks.push({
                source: `resposta_objecao_${key}`,
                content: `OBJECÃO COMUM: ${key.replace(/_/g, ' ')}
SITUAÇÃO IDENTIFICADA: ${value.situacao}
RESPOSTA ESTRATÉGICA: ${value.resposta}
PALAVRAS-CHAVE PARA DETECÇÃO: ${value.palavras_chave}

Esta é uma resposta estruturada para uma objeção comum. Use-a para resolver a preocupação do lead de forma empática e eficaz.`
            });
        });
    }

    // 24. ARGUMENTOS DE VENDAS DETALHADOS
    const argumentos = Object.entries(knowledgeBase.argumentos_vendas);
    argumentos.forEach(([key, value], index) => {
        chunks.push({
            source: `argumento_vendas_${key}`,
            content: `ARGUMENTO DE VENDAS ${index + 1} - ${key.toUpperCase()}:
${value}

Este argumento deve ser usado estrategicamente para destacar o valor único do curso e motivar a ação do interessado.`
        });
    });

    // 25. PERSONA DO AGENTE
    chunks.push({
        source: 'persona_agente_vendas',
        content: `ORIENTAÇÕES PARA O AGENTE DE VENDAS:

🎯 TOM DE VOZ: ${knowledgeBase.persona_agente.tom_voz}
🤝 ABORDAGEM: ${knowledgeBase.persona_agente.abordagem}
💡 FOCO: ${knowledgeBase.persona_agente.foco}
💬 COMUNICAÇÃO: ${knowledgeBase.persona_agente.comunicacao}
👑 AUTORIDADE: ${knowledgeBase.persona_agente.autoridade}
⏰ URGÊNCIA/ESCASSEZ: ${knowledgeBase.persona_agente.urgencia_escassez}

Estas diretrizes garantem uma abordagem consistente e eficaz em todas as interações com prospects.`
    });

    // 26. CONTEXTO GERAL DO CURSO - RESUMO EXECUTIVO
    chunks.push({
        source: 'contexto_geral_curso',
        content: `RESUMO EXECUTIVO DO CURSO:
O ${knowledgeBase.curso.informacoes_basicas.nome} é um programa de especialização completo oferecido pela ${knowledgeBase.curso.informacoes_basicas.instituicao}, com ${knowledgeBase.curso.detalhes_tecnicos.carga_horaria} de conteúdo prático e direto. 

PÚBLICO-ALVO: ${knowledgeBase.curso.informacoes_basicas.publico_alvo}
DIFERENCIAL: Curso completo que abrange sucessões e inventários, diferente de cursos específicos do mercado
URGÊNCIA: Única turma do ano, com foco na qualidade
INVESTIMENTO: A partir de ${knowledgeBase.curso.investimento.valor_diario} por dia
ACESSO: ${knowledgeBase.curso.acesso_e_tempo.duracao_acesso} (limitado)

Este é o contexto geral que deve ser usado quando o lead faz perguntas amplas sobre o curso.`
    });

    // 27. DIRETRIZES ESTRUTURADAS - RESPOSTAS PADRONIZADAS
    if (knowledgeBase.diretrizes_estruturadas) {
        const respostasPadronizadas = Object.entries(knowledgeBase.diretrizes_estruturadas.respostas_padronizadas);
        respostasPadronizadas.forEach(([key, value]) => {
            chunks.push({
                source: `diretriz_resposta_${key}`,
                content: `RESPOSTA PADRONIZADA - ${key.toUpperCase()}:
PERGUNTA: ${value.pergunta || value.informacao || 'Informação técnica'}
RESPOSTA: ${value.resposta}

PALAVRAS-CHAVE: ${value.palavras_chave}

Esta é uma resposta estruturada e padronizada que deve ser usada quando o lead fizer perguntas relacionadas a este tópico específico.`
            });
        });

        // 28. FRASES HUMANIZADAS
        chunks.push({
            source: 'diretrizes_frases_humanizadas',
            content: `FRASES HUMANIZADAS PARA USO ESTRATÉGICO:

INTERESSE INICIAL: ${knowledgeBase.diretrizes_estruturadas.frases_humanizadas.interesse_inicial}

QUEBRA DE OBJEÇÃO: ${knowledgeBase.diretrizes_estruturadas.frases_humanizadas.quebra_objecao}

PALAVRAS-CHAVE: ${knowledgeBase.diretrizes_estruturadas.frases_humanizadas.palavras_chave}

Use essas frases humanizadas nos momentos apropriados da conversa para criar conexão emocional com o lead.`
        });

        // 29. OBJEÇÕES ESPECÍFICAS (INCLUINDO 30 DIAS EXTRAS)
        if (knowledgeBase.diretrizes_estruturadas.objecoes_especificas) {
            const objecoesEspecificas = Object.entries(knowledgeBase.diretrizes_estruturadas.objecoes_especificas);
            objecoesEspecificas.forEach(([key, value]) => {
                chunks.push({
                    source: `resposta_objecao_${key}`,
                    content: `OBJECÃO ESPECÍFICA: ${key.replace(/_/g, ' ')}
SITUAÇÃO IDENTIFICADA: ${value.situacao}
RESPOSTA ESTRATÉGICA: ${value.resposta}
PALAVRAS-CHAVE PARA DETECÇÃO: ${value.palavras_chave}

Esta é uma resposta estruturada para uma objeção específica. Use-a para resolver a preocupação do lead de forma empática e eficaz.`
                });
            });
        }

        // 30. SITUAÇÕES ESPECIAIS
        const situacoesEspeciais = Object.entries(knowledgeBase.diretrizes_estruturadas.situacoes_especiais);
        situacoesEspeciais.forEach(([key, value]) => {
            chunks.push({
                source: `diretriz_situacao_${key}`,
                content: `SITUAÇÃO ESPECIAL - ${key.toUpperCase()}:
CONTEXTO: ${value.situacao}
RESPOSTA RECOMENDADA: ${value.resposta}

PALAVRAS-CHAVE: ${value.palavras_chave}

Esta é uma situação que requer abordagem específica e cuidadosa.`
            });
        });
    }

    // 31. DETECÇÃO DE SITUAÇÕES EMOCIONAIS
    if (knowledgeBase.deteccao_situacoes_emocionais) {
        chunks.push({
            source: 'deteccao_problemas_emocionais',
            content: `DETECÇÃO DE SITUAÇÕES EMOCIONAIS DIFÍCEIS:

INDICADORES FINANCEIROS: ${knowledgeBase.deteccao_situacoes_emocionais.indicadores_problemas.financeiros.join(', ')}

INDICADORES DE SAÚDE: ${knowledgeBase.deteccao_situacoes_emocionais.indicadores_problemas.saude.join(', ')}

INDICADORES PESSOAIS: ${knowledgeBase.deteccao_situacoes_emocionais.indicadores_problemas.pessoais.join(', ')}

INDICADORES PROFISSIONAIS: ${knowledgeBase.deteccao_situacoes_emocionais.indicadores_problemas.profissionais.join(', ')}

ESTRUTURA DA RESPOSTA EMPÁTICA: ${knowledgeBase.deteccao_situacoes_emocionais.resposta_empatica.estrutura}

ELEMENTOS OBRIGATÓRIOS: ${knowledgeBase.deteccao_situacoes_emocionais.resposta_empatica.elementos_obrigatorios.join(', ')}

TOM: ${knowledgeBase.deteccao_situacoes_emocionais.resposta_empatica.tom}

PALAVRAS-CHAVE: ${knowledgeBase.deteccao_situacoes_emocionais.resposta_empatica.palavras_chave}

ATENÇÃO: Quando detectar qualquer um desses indicadores, priorize o bem-estar da pessoa, demonstre empatia genuína e NÃO insista na venda.`
        });
    }

    return chunks;
}

// EXECUÇÃO PRINCIPAL
try {
    console.log('📚 Carregando knowledge base...');
    const knowledgeBase = loadKnowledgeBase();
    
    console.log('🔄 Gerando chunks detalhados...');
    const chunks = generateDetailedChunks(knowledgeBase);
    console.log(`✨ Gerados ${chunks.length} chunks ricos em conteúdo!`);
    
    // Gerar conteúdo do arquivo
    const fileContent = `// data/processedKnowledge.js
// ⚠️  ARQUIVO GERADO AUTOMATICAMENTE - NÃO EDITE MANUALMENTE! ⚠️
// Para atualizar, edite data/knowledgeBase.js e execute: node utils/generateChunks.cjs
// Gerado em: ${new Date().toLocaleString('pt-BR')}

export const processedKnowledge = ${JSON.stringify(chunks, null, 2)};
`;
    
    // Salvar arquivo
    const outputPath = path.join(__dirname, '../data/processedKnowledge.js');
    fs.writeFileSync(outputPath, fileContent, 'utf8');
    
    console.log('✅ Arquivo atualizado com sucesso!');
    console.log(`📊 Total de chunks: ${chunks.length}`);
    console.log(`📁 Salvo em: ${outputPath}`);
    
    // Preview detalhado
    console.log('\n📋 Preview dos chunks gerados:');
    chunks.slice(0, 5).forEach((chunk, index) => {
        console.log(`${index + 1}. [${chunk.source}] ${chunk.content.substring(0, 100)}...`);
    });
    
    // Estatísticas
    const totalChars = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
    const avgCharsPerChunk = Math.round(totalChars / chunks.length);
    
    console.log(`\n📈 Estatísticas:`);
    console.log(`• Total de caracteres: ${totalChars.toLocaleString('pt-BR')}`);
    console.log(`• Média por chunk: ${avgCharsPerChunk} caracteres`);
    console.log(`• Chunks com mais de 500 chars: ${chunks.filter(c => c.content.length > 500).length}`);
    
    console.log('\n🎉 Processo concluído! Knowledge base com contexto rico gerado com sucesso!');
    
} catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
}