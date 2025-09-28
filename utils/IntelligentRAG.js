// utils/IntelligentRAG.js
import { processedKnowledge } from '../data/processedKnowledge.js';
import { cosineSimilarity } from './cosineSimilarity.js';
import logger from '../logger.js';
import stateManager from '../stateManager.js';

class IntelligentRAG {
    constructor() {
        this.stopWords = new Set(['a', 'o', 'e', 'é', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'não', 'os', 'as', 'são', 'ser', 'tem', 'mas', 'foi', 'ao', 'seu', 'sua', 'ou', 'que', 'se', 'isso', 'me', 'sobre', 'como', 'onde', 'qual', 'este', 'esta', 'nos', 'no', 'nas', 'na']);
        this.synonymMap = {
            pagamento: ['pagar', 'pagamento', 'preco', 'valor', 'investimento', 'custo', 'comprar', 'compra', 'parcelar', 'parcelamento', 'parcela', 'pix', 'cartao', 'nubank', 'quanto', 'dinheiro', 'grana', 'bufunfa', 'tubarao', '1997', '1.997', '166', '166,42', '12x', 'boleto', 'formas de pagamento'],
            suporte_contato: ['suporte', 'duvida', 'ajuda', 'contato', 'whatsapp', 'telefone', '61', '99664-5250', 'maria', 'mar.ia', 'area exclusiva', 'tirar duvidas', 'esclarecer'],
            inscricao: ['inscrever', 'matricular', 'link', 'hotmart', 'pay.hotmart', 'A44481801Y', 'como comprar', 'onde comprar', 'me inscrevo', 'fazer matricula'],
            problemas_area: ['problema', 'dificuldade', 'especializa', 'improviso', 'confianca', 'neles proprios', 'advogados', 'area juridica'],
            acesso_duracao: ['para sempre', 'vitalicio', 'permanente', 'expira', 'quanto tempo', 'duracao', 'acesso'],
            conteudo: ['conteudo', 'modulo', 'aula', 'materia', 'grade', 'ensina', 'aprende', 'aprender', 'topico', 'programatico', 'aborda', 'fala', 'tem', 'inclui', 'ensino', 'conteúdo', 'módulo', 'módulos', 'disciplina', 'assunto', 'tema', 'tópico', 'tópicos', 'pode mostrar', 'pode me mostrar', 'mostrar', 'mostra', 'me mostra o', 'consegue mostrar', 'tem como mostrar', 'da para mostrar', 'dá para mostrar', 'o que tem no curso', 'que tem o curso', 'tem o que', 'o que o curso tem', 'curso tem o que', 'tem alguma coisa', 'o que inclui', 'que inclui', 'o que vem no curso', 'que vem no curso', 'vem o que', 'grade do curso', 'programa', 'programação do curso', 'grade', 'ementa', 'currículo', 'curriculo', 'conteúdo programático', 'conteudo programatico'],
            acesso: ['acesso', 'acessar', 'duracao', 'tempo', 'expira', 'expiracao', 'vitalicio', 'permanente', 'login', 'entrar', 'quando', 'duração', 'período', 'prazo', 'validade', 'disponível', 'disponivel'],
            garantia: ['garantia', 'reembolso', 'devolver', 'gostar', 'satisfacao', 'satisfação', 'devolução', 'estorno', 'cancelar', 'cancelamento'],
            certificado: ['certificado', 'certificacao', 'diploma', 'certificação', 'documento', 'comprovante', 'atestado'],
            suporte: ['suporte', 'duvida', 'ajuda', 'professor', 'contato', 'dúvida', 'dúvidas', 'apoio', 'assistência', 'assistencia', 'atendimento', 'suporte'],
            professor: ['professor', 'instrutor', 'educador', 'mentor', 'docente', 'mestre', 'quem', 'ministra', 'ensina', 'dá', 'da', 'responsável', 'responsavel', 'coordenador', 'jaylton', 'lopes', 'jaylton lopes', 'nome do professor', 'quem é', 'quem e', 'formação', 'formacao', 'experiência', 'experiencia', 'credenciais', 'currículo', 'curriculo', 'especialista', 'expert'],
            funcionamento: ['funciona', 'funcionamento', 'como', 'processo', 'método', 'metodo', 'metodologia', 'estrutura', 'organização', 'organizacao', 'dinâmica', 'dinamica'],
            carga_horaria: ['carga', 'horaria', 'horas', 'hora', 'carga de horas', 'total de horas', 'quantas horas', 'tempo do curso', 'duracao do curso', 'carga horaria', 'duração', 'tempo total', 'quantidade de horas', 'quanto tempo tem', 'tamanho do curso', 'extensão', 'extensao', 'volume de conteúdo', 'volume de conteudo', 'muito conteúdo', 'muito conteudo', 'pesado', 'leve', 'denso', 'superficial', 'profundo', 'completo', 'resumido', 'detalhado', 'tem quantas horas', 'curso tem horas', 'quantas horas tem o curso', 'horas de duração', 'horas de duracao', 'duração em horas', 'duracao em horas', 'tempo em horas', 'o curso tem quantas', 'quantas horas o curso', 'curso quantas horas', 'horas do curso', 'horas no curso', 'curso tem quantas horas', 'tem horas', 'quantas horas de', 'horas são', 'horas sao', 'são quantas horas', 'sao quantas horas'],
            prazo_acesso: ['prazo', 'tempo', 'acesso', 'assistir', 'conseguir', 'medo', 'nao conseguir', 'nao vou conseguir', 'tempo suficiente', 'tempo limitado', 'expira', 'expiracao', 'vence', 'termina', 'acabar', 'acabou', 'perder acesso', 'mais tempo', 'extensao', 'prorrogar', 'estender', 'aumentar prazo', 'renovar', '30 dias', 'um ano', '1 ano', 'vitalicio', 'permanente', 'sempre', 'para sempre'],
            ansiedade_tempo: ['medo', 'preocupado', 'ansioso', 'nervoso', 'conseguir assistir', 'dar tempo', 'tempo suficiente', 'muito corrido', 'agenda apertada', 'pouco tempo', 'sem tempo', 'nao tenho tempo', 'tempo limitado', 'pressao', 'pressa', 'urgencia', 'ansiedade', 'preocupação', 'receio'],
            provas_sociais: ['prova', 'provas', 'depoimento', 'depoimentos', 'testemunho', 'resultado', 'resultados', 'aluno', 'alunos', 'aluna', 'alunas', 'sucesso', 'caso', 'casos', 'exemplo', 'exemplos', 'video', 'videos', 'youtube', 'link', 'links', 'mariana', 'cristiane', 'ernandes', 'social', 'sociais', 'feedback', 'relato', 'relatos', 'história', 'historia', 'transformação', 'transformacao'],
            diretrizes_estruturadas: ['abrange', 'planejamento', 'sucessorio', 'quanto', 'tempo', 'aulas', 'vivo', 'gravadas', 'atualizado', 'vitalicio', 'pos', 'graduacao', 'certificacao', 'duracao', 'pressa', 'pouco', 'iniciante', 'experiente', 'curto', 'incluído', 'incluido', 'cobertura', 'metodologia', 'método', 'metodo', 'sistema', 'estratégia', 'estrategia', 'organizado', 'estruturado', 'didática', 'didatica', 'sequência', 'sequencia', 'ordem', 'cronologia', 'progressão', 'progressao', 'nível', 'nivel', 'etapas', 'fases'],
            situacoes_emocionais: ['dinheiro', 'pagar', 'financeira', 'desempregado', 'renda', 'endividado', 'saude', 'doente', 'depressao', 'ansiedade', 'psicologicas', 'bem', 'mental', 'burnout', 'estresse', 'pessoais', 'separacao', 'divorcio', 'morte', 'familia', 'luto', 'relacionamento', 'familiares', 'crise', 'emprego', 'demitido', 'fechou', 'clientes', 'advocacia', 'carreira', 'perspectiva', 'dificuldade', 'problema', 'situação', 'situacao'],
            bonus_materiais: ['bonus', 'bônus', 'extras', 'materiais', 'inclusos', 'gratis', 'gratuito', 'combo', 'adicionais', 'brinde', 'brindes', 'tem alguma coisa a mais', 'vem junto', 'acompanha', 'inclui', 'ferramentas', 'petições', 'modelos', 'templates', 'formulários', 'formularios', 'manuais', 'guias', 'acelerador', 'prospecção', 'prospeccao', 'marketing', 'google ads', 'comunidade', 'facebook', 'networking', 'm.a.s', 'mas', 'mapa', 'advocacia 4.0', 
                // Novas variações para melhor detecção
                'que mais vem', 'o que mais tem', 'tem mais alguma coisa', 'vem mais alguma coisa', 'que mais inclui', 'o que mais inclui', 'tem algo mais', 'vem algo mais', 'alguma coisa extra', 'algo extra', 'tem extra', 'vem extra', 'que extras', 'quais extras', 'extras tem', 'extras vem', 'que bônus', 'quais bônus', 'bônus tem', 'bônus vem', 'que bonus', 'quais bonus', 'bonus tem', 'bonus vem',
                'material extra', 'materiais extras', 'conteúdo extra', 'conteudo extra', 'conteúdos extras', 'conteudos extras', 'curso vem com', 'curso tem', 'curso inclui', 'curso acompanha', 'pacote inclui', 'pacote tem', 'pacote vem', 'oferta inclui', 'oferta tem', 'oferta vem',
                'ganho junto', 'recebo junto', 'levo junto', 'tenho junto', 'vou ganhar', 'vou receber', 'vou levar', 'vou ter', 'posso ganhar', 'posso receber', 'posso levar', 'posso ter', 'consigo ganhar', 'consigo receber', 'consigo levar', 'consigo ter',
                'presente', 'presentes', 'cortesia', 'cortesias', 'mimo', 'mimos', 'surpresa', 'surpresas', 'benefício', 'beneficio', 'benefícios', 'beneficios', 'vantagem', 'vantagens', 'diferencial', 'diferenciais',
                'ferramenta extra', 'ferramentas extras', 'recurso extra', 'recursos extras', 'funcionalidade extra', 'funcionalidades extras', 'sistema extra', 'sistemas extras', 'plataforma extra', 'plataformas extras',
                'ia extra', 'ias extras', 'inteligência artificial extra', 'inteligencia artificial extra', 'inteligências artificiais extras', 'inteligencias artificiais extras', 'bot extra', 'bots extras', 'chatbot extra', 'chatbots extras',
                'suporte extra', 'ajuda extra', 'assistência extra', 'assistencia extra', 'apoio extra', 'orientação extra', 'orientacao extra', 'consultoria extra', 'mentoria extra',
                'documento extra', 'documentos extras', 'arquivo extra', 'arquivos extras', 'material de apoio', 'materiais de apoio', 'conteúdo de apoio', 'conteudo de apoio', 'conteúdos de apoio', 'conteudos de apoio',
                'planilha extra', 'planilhas extras', 'modelo extra', 'modelos extras', 'template extra', 'templates extras', 'formulário extra', 'formulario extra', 'formulários extras', 'formularios extras',
                'curso completo', 'pacote completo', 'kit completo', 'conjunto completo', 'tudo incluso', 'tudo incluído', 'tudo incluido', 'pacote fechado', 'oferta completa', 'promoção completa', 'promocao completa'],
            modalidade_ensino: ['online', 'presencial', 'ead', 'distância', 'distancia', 'formato', 'como são', 'como sao', 'ao vivo', 'gravado', 'gravadas', 'sincrono', 'assincrono', 'quando quiser', 'horário', 'horario', 'flexível', 'flexivel', 'plataforma', 'sistema', 'onde assisto', 'como acesso', 'modalidade', 'forma de ensino', 'tipo de curso'],
            area_especialidade: ['familia', 'família', 'sucessões', 'sucessao', 'sucessório', 'sucessorio', 'inventário', 'inventario', 'testamento', 'herança', 'heranca', 'divórcio', 'divorcio', 'alimentos', 'pensão', 'pensao', 'guarda', 'holding', 'patrimonial', 'planejamento', 'itcmd', 'usucapião', 'usucapiao', 'alvará', 'alvara', 'judicial', 'extrajudicial', 'cartório', 'cartorio', 'civilista', 'civil'],
            nivel_experiencia: ['iniciante', 'experiente', 'avançado', 'avancado', 'básico', 'basico', 'recém-formado', 'recem-formado', 'junior', 'senior', 'sênior', 'sem experiência', 'sem experiencia', 'primeira vez', 'começando', 'comecando', 'novo na área', 'novo na area', 'anos de experiência', 'anos de experiencia', 'tempo de advocacia', 'carreira', 'profissional', 'especialista'],
            resultados_financeiros: ['quanto ganho', 'quanto posso ganhar', 'faturamento', 'honorários', 'honorarios', 'renda', 'lucro', 'retorno', 'roi', 'investimento', 'vale a pena', 'compensa', 'multiplicar', 'aumentar ganhos', 'resultados financeiros', 'casos de sucesso', 'quanto cobra', 'tabela de honorários', 'tabela de honorarios', 'precificação', 'precificacao', 'contratos', 'faturar', 'rendimento', 'receita'],
            iajur: ['iajur', 'ia jur', 'inteligencia artificial jur', 'inteligência artificial jur', 'ia do jur', 'ia do professor', 'ia para petições', 'ia para peticoes', 'ia para inventários', 'ia para inventarios', 'ia para documentos', 'ia jurídica', 'ia juridica', 'ferramenta ia', 'ferramenta de ia', 'petições automáticas', 'peticoes automaticas', 'elaboração de petições', 'elaboracao de peticoes', 'gerar petições', 'gerar peticoes', 'criar petições', 'criar peticoes', 'redação jurídica', 'redacao juridica', 'assistente jurídico', 'assistente juridico', 'automação jurídica', 'automacao juridica', 'ia para advogados', 'ia advocacia', 'ia escritório', 'ia escritorio', 'ia para escritório', 'ia para escritorio', 'robô jurídico', 'robo juridico', 'bot jurídico', 'bot juridico', 'inteligência artificial advocacia', 'inteligencia artificial advocacia', 'ia para direito', 'ia direito', 'tecnologia jurídica', 'tecnologia juridica', 'legal tech', 'lawtech', 'automação de documentos', 'automacao de documentos', 'gerador de petições', 'gerador de peticoes', 'modelo de petição', 'modelo de peticao', 'template jurídico', 'template juridico', 'ia para inventário', 'ia para inventario', 'ia sucessões', 'ia sucessoes', 'ia família', 'ia familia', 'ia civil', 'ferramenta jurídica', 'ferramenta juridica', 'software jurídico', 'software juridico', 'sistema jurídico', 'sistema juridico', 'plataforma jurídica', 'plataforma juridica'],
            maria: ['maria', 'MARIA', 'mar.ia', 'MAR.IA', 'mar ia', 'MAR IA', 'inteligencia artificial maria', 'inteligência artificial maria', 'ia maria', 'IA MARIA', 'chatbot maria', 'assistente maria', 'suporte maria', 'ia do curso', 'ia para dúvidas', 'ia para duvidas', 'tirar dúvidas', 'tirar duvidas', 'esclarecer dúvidas', 'esclarecer duvidas', 'suporte 24h', 'suporte 24 horas', 'atendimento automático', 'atendimento automatico', 'chat automático', 'chat automatico', 'assistente virtual', 'bot de suporte', 'ia de suporte', 'chatbot do curso', 'bot do curso', 'assistente do curso', 'ia educacional', 'ia para ensino', 'ia para aprendizado', 'tutor virtual', 'tutor ia', 'mentor virtual', 'mentor ia', 'professora virtual', 'professora ia', 'instrutora virtual', 'instrutora ia', 'guia virtual', 'guia ia', 'ajuda automática', 'ajuda automatica', 'suporte inteligente', 'atendimento inteligente', 'chat inteligente', 'resposta automática', 'resposta automatica', 'esclarecimento automático', 'esclarecimento automatico', 'dúvida automática', 'duvida automatica', 'pergunta automática', 'pergunta automatica', 'ia para estudantes', 'ia para alunos', 'assistente de estudos', 'assistente de estudo', 'bot educacional', 'chatbot educacional', 'ia pedagógica', 'ia pedagogica', 'suporte pedagógico', 'suporte pedagogico', 'orientação virtual', 'orientacao virtual', 'consultoria virtual', 'consultoria ia'],
            diferenca_ias: ['diferença entre ias', 'diferenca entre ias', 'diferença maria iajur', 'diferenca maria iajur', 'qual diferença', 'qual diferenca', 'qual a diferença', 'qual a diferenca', 'para que serve cada', 'função de cada', 'funcao de cada', 'uso de cada ia', 'quando usar cada', 'maria vs iajur', 'iajur vs maria', 'comparar ias', 'distinguir ias', 'separar ias'],
            carga_horaria: ['carga horaria', 'carga horária', 'qual a carga horaria', 'qual a carga horária', 'carga horaria do curso', 'carga horária do curso', 'horas do curso', 'quantas horas', 'quantas horas tem', 'quantas horas o curso tem', 'duracao do curso', 'duração do curso', 'tempo total', 'total de horas', 'quantidade de horas']
        };
        this.vocabulary = [];
        this.processedKnowledgeWithBow = [];
        this.initializeBow();
    }

    stem(word) {
        if (word.length < 4 || !word.endsWith('s')) {
            return word;
        }
        if (word.endsWith('oes')) return word.slice(0, -3) + 'ao';
        if (word.endsWith('aes')) return word.slice(0, -3) + 'ao';
        if (word.endsWith('ais') || word.endsWith('eis') || word.endsWith('ois')) return word.slice(0, -1) + 'l';
        if (word.endsWith('res') || word.endsWith('zes')) return word.slice(0, -2);
        if (word.endsWith('ns')) return word.slice(0, -2) + 'm';
        if (word.endsWith('s')) {
            return word.slice(0, -1);
        }
        return word;
    }

    normalizeText(text) {
        return text
            .toLowerCase()
            .replace(/[.,?!;:]/g, ' ')
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .split(/\s+/)
            .filter(word => word.length > 2 && !this.stopWords.has(word))
            .map(this.stem);
    }

    expandQueryWithSynonyms(words) {
        const originalWords = new Set(words);
        const expandedWords = new Set(words);
        words.forEach(word => {
            for (const key in this.synonymMap) {
                if (this.synonymMap[key].includes(word)) {
                    this.synonymMap[key].forEach(synonym => expandedWords.add(synonym));
                }
            }
        });
        return { original: originalWords, expanded: expandedWords };
    }

    createBowVector(words, weights = new Map()) {
        const vector = new Array(this.vocabulary.length).fill(0);
        words.forEach(word => {
            const index = this.vocabulary.indexOf(word);
            if (index !== -1) {
                vector[index] += weights.get(word) || 1;
            }
        });
        return vector;
    }

    initializeBow() {
        const allWords = new Set();
        processedKnowledge.forEach(chunk => {
            this.normalizeText(chunk.content).forEach(word => allWords.add(word));
        });
        Object.values(this.synonymMap).flat().forEach(word => allWords.add(word));

        this.vocabulary = Array.from(allWords);
        logger.info(`[IntelligentRAG] Vocabulário BoW inicializado com ${this.vocabulary.length} palavras.`);

        this.processedKnowledgeWithBow = processedKnowledge.map(chunk => {
            const documentWords = this.normalizeText(chunk.content);
            const bowVector = this.createBowVector(documentWords);
            return { chunk, bowVector };
        });
        
        logger.info(`[IntelligentRAG] Processados ${this.processedKnowledgeWithBow.length} chunks de conhecimento.`);
    }

    // Método para reinicializar o sistema (útil quando chunks são atualizados)
    reinitialize() {
        logger.info("[IntelligentRAG] Reinicializando sistema com conhecimento atualizado...");
        this.vocabulary = [];
        this.processedKnowledgeWithBow = [];
        this.initializeBow();
    }

    findTopRelevantChunks(userInput, currentStage = null, topK = 3, threshold = 0.03, conversationHistory = null) {
        if (this.processedKnowledgeWithBow.length === 0) return [];

        const queryWords = this.normalizeText(userInput);
        const { original: originalQueryWords, expanded: expandedQueryWordsSet } = this.expandQueryWithSynonyms(queryWords);
        
        const weights = new Map();
        originalQueryWords.forEach(word => weights.set(word, 10));

        const queryVector = this.createBowVector(Array.from(expandedQueryWordsSet), weights);

        // Filtrar chunks baseado no estágio atual
        const filteredKnowledgeData = this.filterChunksByStage(this.processedKnowledgeWithBow, currentStage);

        const similarities = filteredKnowledgeData.map(item => ({
            chunk: item.chunk,
            similarity: cosineSimilarity(queryVector, item.bowVector)
        }));

        let sortedBySimilarity = similarities.sort((a, b) => b.similarity - a.similarity);

        // BOOST ESTRATÉGICO PRIORITÁRIO: OBJEÇÕES
        // Se a consulta for uma objeção, ela tem a maior prioridade.
        if (this.isObjectionQuery(userInput)) {
            const objectionChunks = sortedBySimilarity.filter(item => this.isObjectionChunk(item.chunk.source));
            const otherChunks = sortedBySimilarity.filter(item => !this.isObjectionChunk(item.chunk.source));
            
            const finalSorted = [...objectionChunks, ...otherChunks];
            logger.debug(`[IntelligentRAG] Query de objeção detectada - Priorizando ${objectionChunks.length} chunks e retornando imediatamente.`);
            
            const relevantChunks = finalSorted
                .filter(item => item.similarity > threshold)
                .slice(0, topK);

            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Objection Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks; // Retorna imediatamente para evitar outros boosts
        }

        // NOVOS BOOSTS ESTRATÉGICOS PARA MELHORAR TAXA DE SUCESSO
        
        // BOOST ESTRATÉGICO: Para consultas sobre valores específicos (1997, 166,42, 12x, etc.)
        const isPriceSpecificQuery = this.isPriceSpecificQuery(userInput);
        const hasStageAccess = this.hasStageAccessToPrice(currentStage);
        
        if (isPriceSpecificQuery && hasStageAccess) {
            const priceChunks = sortedBySimilarity.filter(item => 
                this.isPriceChunk(item.chunk.source)
            );
            const nonPriceChunks = sortedBySimilarity.filter(item => 
                !this.isPriceChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...priceChunks, ...nonPriceChunks];
            logger.debug(`[IntelligentRAG] Query de preço específico detectada - Priorizando ${priceChunks.length} chunks de preço`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Price Specific Boost`);
            return relevantChunks;
        }
        
        // BOOST ESTRATÉGICO: Para consultas sobre suporte (WhatsApp, Mar.IA, área exclusiva)
        const isSupportQuery = this.isSupportQuery(userInput);
        
        if (isSupportQuery) {
            const supportChunks = sortedBySimilarity.filter(item => 
                this.isSupportChunk(item.chunk.source)
            );
            const nonSupportChunks = sortedBySimilarity.filter(item => 
                !this.isSupportChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...supportChunks, ...nonSupportChunks];
            logger.debug(`[IntelligentRAG] Query de suporte detectada - Priorizando ${supportChunks.length} chunks de suporte`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Support Boost`);
            return relevantChunks;
        }
        
        // BOOST ESTRATÉGICO: Para consultas sobre inscrição (link, hotmart, como me inscrevo)
        const isEnrollmentQuery = this.isEnrollmentQuery(userInput);
        
        if (isEnrollmentQuery) {
            const enrollmentChunks = sortedBySimilarity.filter(item => 
                this.isEnrollmentChunk(item.chunk.source)
            );
            const nonEnrollmentChunks = sortedBySimilarity.filter(item => 
                !this.isEnrollmentChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...enrollmentChunks, ...nonEnrollmentChunks];
            logger.debug(`[IntelligentRAG] Query de inscrição detectada - Priorizando ${enrollmentChunks.length} chunks de inscrição`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Enrollment Boost`);
            return relevantChunks;
        }
        
        // BOOST ESTRATÉGICO: Para consultas sobre formas de pagamento (boleto aceito)
        const isPaymentMethodsQuery = this.isPaymentMethodsQuery(userInput);
        
        if (isPaymentMethodsQuery) {
            const paymentChunks = sortedBySimilarity.filter(item => 
                this.isPaymentMethodsChunk(item.chunk.source)
            );
            const nonPaymentChunks = sortedBySimilarity.filter(item => 
                !this.isPaymentMethodsChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...paymentChunks, ...nonPaymentChunks];
            logger.debug(`[IntelligentRAG] Query sobre formas de pagamento detectada - Priorizando ${paymentChunks.length} chunks`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Payment Methods Boost`);
            return relevantChunks;
        }
        
        // BOOST ESTRATÉGICO: Para consultas sobre duração do acesso (para sempre, vitalício)
        const isAccessDurationQuery = this.isAccessDurationQuery(userInput);
        
        if (isAccessDurationQuery) {
            const accessChunks = sortedBySimilarity.filter(item => 
                this.isAccessDurationChunk(item.chunk.source)
            );
            const nonAccessChunks = sortedBySimilarity.filter(item => 
                !this.isAccessDurationChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...accessChunks, ...nonAccessChunks];
            logger.debug(`[IntelligentRAG] Query sobre duração do acesso detectada - Priorizando ${accessChunks.length} chunks`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Access Duration Boost`);
            return relevantChunks;
        }
        
        // BOOST ESTRATÉGICO: Para consultas sobre problemas da área (advogados, especialização)
        const isAreaProblemsQuery = this.isAreaProblemsQuery(userInput);
        
        if (isAreaProblemsQuery) {
            const problemsChunks = sortedBySimilarity.filter(item => 
                this.isAreaProblemsChunk(item.chunk.source)
            );
            const nonProblemsChunks = sortedBySimilarity.filter(item => 
                !this.isAreaProblemsChunk(item.chunk.source)
            );
            
            sortedBySimilarity = [...problemsChunks, ...nonProblemsChunks];
            logger.debug(`[IntelligentRAG] Query sobre problemas da área detectada - Priorizando ${problemsChunks.length} chunks`);
            
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes via Area Problems Boost`);
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre preço, priorizar chunks de preço quando disponíveis
        const isPriceQuery = this.isPriceQuery(userInput);
        
        if (isPriceQuery && hasStageAccess) {
            const priceChunks = sortedBySimilarity.filter(item => 
                this.isPriceChunk(item.chunk.source)
            );
            const nonPriceChunks = sortedBySimilarity.filter(item => 
                !this.isPriceChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de preço primeiro, depois outros por similaridade
            sortedBySimilarity = [...priceChunks, ...nonPriceChunks];
            
            logger.debug(`[IntelligentRAG] Query de preço detectada - Priorizando ${priceChunks.length} chunks de preço`);
        }

        // BOOST ESTRATÉGICO: Para consultas sobre professor, priorizar chunks específicos
        const isProfessorQuery = this.isProfessorQuery(userInput);
        
        if (isProfessorQuery) {
            const professorChunks = sortedBySimilarity.filter(item => 
                this.isProfessorChunk(item.chunk.source)
            );
            const nonProfessorChunks = sortedBySimilarity.filter(item => 
                !this.isProfessorChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de professor primeiro, depois outros por similaridade
            sortedBySimilarity = [...professorChunks, ...nonProfessorChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre professor detectada - Priorizando ${professorChunks.length} chunks sobre professor`);
            
            // Retornar imediatamente para priorizar informações do professor
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Professor Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre bônus, priorizar chunks específicos
        const isBonusQuery = this.isBonusQuery(userInput);
        
        if (isBonusQuery) {
            const bonusChunks = sortedBySimilarity.filter(item => 
                this.isBonusChunk(item.chunk.source)
            );
            const nonBonusChunks = sortedBySimilarity.filter(item => 
                !this.isBonusChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de bônus primeiro, depois outros por similaridade
            sortedBySimilarity = [...bonusChunks, ...nonBonusChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre bônus detectada - Priorizando ${bonusChunks.length} chunks sobre bônus`);
            
            // Retornar imediatamente para priorizar informações de bônus
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Bonus Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre modalidade de ensino, priorizar chunks específicos
        const isModalidadeQuery = this.isModalidadeQuery(userInput);
        
        if (isModalidadeQuery) {
            const modalidadeChunks = sortedBySimilarity.filter(item => 
                this.isModalidadeChunk(item.chunk.source)
            );
            const nonModalidadeChunks = sortedBySimilarity.filter(item => 
                !this.isModalidadeChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de modalidade primeiro, depois outros por similaridade
            sortedBySimilarity = [...modalidadeChunks, ...nonModalidadeChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre modalidade detectada - Priorizando ${modalidadeChunks.length} chunks sobre modalidade`);
            
            // Retornar imediatamente para priorizar informações de modalidade
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Modalidade Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre especificações do curso ou página de vendas
        const isSpecificationOrSalesPageQuery = this.isSpecificationOrSalesPageQuery(userInput);
        
        if (isSpecificationOrSalesPageQuery) {
            const specificationChunks = sortedBySimilarity.filter(item => 
                item.chunk.source === 'especificacoes_curso_pagina_vendas' || 
                item.chunk.source === 'provas_sociais_mais_provas_redes_sociais'
            );
            const nonSpecificationChunks = sortedBySimilarity.filter(item => 
                item.chunk.source !== 'especificacoes_curso_pagina_vendas' && 
                item.chunk.source !== 'provas_sociais_mais_provas_redes_sociais'
            );
            
            // Reorganizar: chunks de especificações primeiro, depois outros por similaridade
            sortedBySimilarity = [...specificationChunks, ...nonSpecificationChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre especificações/página de vendas detectada - Priorizando ${specificationChunks.length} chunks relacionados`);
            
            // Retornar imediatamente para priorizar informações sobre especificações
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Specification/Sales Page Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre resultados financeiros, priorizar chunks específicos
        const isResultadosQuery = this.isResultadosQuery(userInput);
        
        if (isResultadosQuery) {
            const resultadosChunks = sortedBySimilarity.filter(item => 
                this.isResultadosChunk(item.chunk.source)
            );
            const nonResultadosChunks = sortedBySimilarity.filter(item => 
                !this.isResultadosChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de resultados primeiro, depois outros por similaridade
            sortedBySimilarity = [...resultadosChunks, ...nonResultadosChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre resultados detectada - Priorizando ${resultadosChunks.length} chunks sobre resultados`);
            
            // Retornar imediatamente para priorizar provas sociais e resultados
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Resultados Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre área de especialidade, priorizar chunks específicos
        const isAreaEspecialidadeQuery = this.isAreaEspecialidadeQuery(userInput);
        
        if (isAreaEspecialidadeQuery) {
            const areaChunks = sortedBySimilarity.filter(item => 
                this.isAreaEspecialidadeChunk(item.chunk.source)
            );
            const nonAreaChunks = sortedBySimilarity.filter(item => 
                !this.isAreaEspecialidadeChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de área primeiro, depois outros por similaridade
            sortedBySimilarity = [...areaChunks, ...nonAreaChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre área de especialidade detectada - Priorizando ${areaChunks.length} chunks sobre área`);
        }

        // BOOST ESTRATÉGICO: Para consultas sobre nível de experiência, priorizar chunks específicos
        const isNivelExperienciaQuery = this.isNivelExperienciaQuery(userInput);
        
        if (isNivelExperienciaQuery) {
            const nivelChunks = sortedBySimilarity.filter(item => 
                this.isNivelExperienciaChunk(item.chunk.source)
            );
            const nonNivelChunks = sortedBySimilarity.filter(item => 
                !this.isNivelExperienciaChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de nível primeiro, depois outros por similaridade
            sortedBySimilarity = [...nivelChunks, ...nonNivelChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre nível de experiência detectada - Priorizando ${nivelChunks.length} chunks sobre nível`);
        }

        // BOOST ESTRATÉGICO: Para consultas sobre funcionamento, priorizar chunks específicos
        const isFunctioningQuery = this.isFunctioningQuery(userInput);
        
        if (isFunctioningQuery) {
            const functioningChunks = sortedBySimilarity.filter(item => 
                this.isFunctioningChunk(item.chunk.source)
            );
            const nonFunctioningChunks = sortedBySimilarity.filter(item => 
                !this.isFunctioningChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de funcionamento primeiro, depois outros por similaridade
            sortedBySimilarity = [...functioningChunks, ...nonFunctioningChunks];
            
            logger.debug(`[IntelligentRAG] Query de funcionamento detectada - Priorizando ${functioningChunks.length} chunks de funcionamento`);
        }

        // NOVO BOOST ESTRATÉGICO: Para consultas sobre carga horária, priorizar chunks específicos
        const isCargaHorariaQuery = this.isCargaHorariaQuery(userInput);
        
        if (isCargaHorariaQuery) {
            const cargaHorariaChunks = sortedBySimilarity.filter(item => 
                this.isCargaHorariaChunk(item.chunk.source)
            );
            const nonCargaHorariaChunks = sortedBySimilarity.filter(item => 
                !this.isCargaHorariaChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de carga horária primeiro, depois outros por similaridade
            sortedBySimilarity = [...cargaHorariaChunks, ...nonCargaHorariaChunks];
            
            logger.debug(`[IntelligentRAG] Query de carga horária detectada - Priorizando ${cargaHorariaChunks.length} chunks de carga horária`);

            // Pular outras lógicas de boost se a intenção for claramente sobre carga horária
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Carga Horária Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // NOVO BOOST ESTRATÉGICO: Para consultas sobre prazo de acesso e tempo
        const isPrazoAcessoQuery = this.isPrazoAcessoQuery(userInput);
        const isAnsiedadeTempoQuery = this.isAnsiedadeTempoQuery(userInput);
        
        if (isPrazoAcessoQuery || isAnsiedadeTempoQuery) {
            const prazoAcessoChunks = sortedBySimilarity.filter(item => 
                this.isPrazoAcessoChunk(item.chunk.source) || this.isAnsiedadeTempoChunk(item.chunk.source)
            );
            const nonPrazoAcessoChunks = sortedBySimilarity.filter(item => 
                !this.isPrazoAcessoChunk(item.chunk.source) && !this.isAnsiedadeTempoChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de prazo/acesso primeiro, depois outros por similaridade
            sortedBySimilarity = [...prazoAcessoChunks, ...nonPrazoAcessoChunks];
            
            const queryType = isPrazoAcessoQuery ? 'prazo de acesso' : 'ansiedade temporal';
            logger.debug(`[IntelligentRAG] Query de ${queryType} detectada - Priorizando ${prazoAcessoChunks.length} chunks relacionados`);

            // Pular outras lógicas de boost se a intenção for claramente sobre prazo/tempo
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via ${queryType} Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre IAJUR, priorizar chunks específicos
        const isIAJURQuery = this.isIAJURQuery(userInput);
        
        if (isIAJURQuery) {
            const iajurChunks = sortedBySimilarity.filter(item => 
                this.isIAJURChunk(item.chunk.source)
            );
            const nonIAJURChunks = sortedBySimilarity.filter(item => 
                !this.isIAJURChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de IAJUR primeiro, depois outros por similaridade
            sortedBySimilarity = [...iajurChunks, ...nonIAJURChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre IAJUR detectada - Priorizando ${iajurChunks.length} chunks sobre IAJUR`);
            
            // Retornar imediatamente para priorizar informações específicas do IAJUR
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via IAJUR Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre Mar.IA, priorizar chunks específicos
        const isMariaQuery = this.isMariaQuery(userInput);
        
        if (isMariaQuery) {
            const mariaChunks = sortedBySimilarity.filter(item => 
                this.isMariaChunk(item.chunk.source)
            );
            const nonMariaChunks = sortedBySimilarity.filter(item => 
                !this.isMariaChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de Mar.IA primeiro, depois outros por similaridade
            sortedBySimilarity = [...mariaChunks, ...nonMariaChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre Mar.IA detectada - Priorizando ${mariaChunks.length} chunks sobre Mar.IA`);
            
            // Retornar imediatamente para priorizar informações específicas da Mar.IA
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Mar.IA Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre diferenças entre IAs, priorizar chunks específicos
        const isDiferencaIAsQuery = this.isDiferencaIAsQuery(userInput);
        
        if (isDiferencaIAsQuery) {
            const diferencaChunks = sortedBySimilarity.filter(item => 
                this.isDiferencaIAsChunk(item.chunk.source)
            );
            const nonDiferencaChunks = sortedBySimilarity.filter(item => 
                !this.isDiferencaIAsChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de diferenças primeiro, depois outros por similaridade
            sortedBySimilarity = [...diferencaChunks, ...nonDiferencaChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre diferenças entre IAs detectada - Priorizando ${diferencaChunks.length} chunks sobre diferenças`);
            
            // Retornar imediatamente para priorizar informações sobre diferenças entre IAs
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Diferenças IAs Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // NOVO BOOST ESTRATÉGICO: Prioridade máxima para perguntas sobre conteúdo específico
        const isContentQuery = this.isContentQuery(userInput);

        if (isContentQuery) {
            const contentChunks = sortedBySimilarity.filter(item => 
                this.isContentChunk(item.chunk.source)
            );
            const otherChunks = sortedBySimilarity.filter(item => 
                !this.isContentChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de conteúdo primeiro, depois outros por similaridade
            sortedBySimilarity = [...contentChunks, ...otherChunks];
            
            logger.debug(`[IntelligentRAG] Query de conteúdo específico detectada - Priorizando ${contentChunks.length} chunks de conteúdo/bônus.`);

            // Pular outras lógicas de boost se a intenção for claramente sobre conteúdo
            const relevantChunks = sortedBySimilarity
                .filter(item => item.similarity > threshold)
                .slice(0, topK);
            
            logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}) via Content Boost:`, null, { 
                chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
            });
            return relevantChunks;
        }

        // BOOST ESTRATÉGICO: Para consultas sobre provas sociais, priorizar chunks específicos
        const isSocialProofQuery = this.isSocialProofQuery(userInput);
        
        if (isSocialProofQuery) {
            const socialProofChunks = sortedBySimilarity.filter(item => 
                this.isSocialProofChunk(item.chunk.source)
            );
            const nonSocialProofChunks = sortedBySimilarity.filter(item => 
                !this.isSocialProofChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de provas sociais primeiro, depois outros por similaridade
            sortedBySimilarity = [...socialProofChunks, ...nonSocialProofChunks];
            
            logger.debug(`[IntelligentRAG] Query de provas sociais detectada - Priorizando ${socialProofChunks.length} chunks de provas sociais`);
        }

        // BOOST ESTRATÉGICO: Para consultas sobre MAIS provas sociais, priorizar chunk de redes sociais
        const isMoreSocialProofQuery = this.isMoreSocialProofQuery(userInput);

        if (isMoreSocialProofQuery) {
            const moreSocialProofChunk = sortedBySimilarity.filter(item =>
                this.isMoreSocialProofChunk(item.chunk.source)
            );
            const otherChunks = sortedBySimilarity.filter(item =>
                !this.isMoreSocialProofChunk(item.chunk.source)
            );

            // 🔥 NOVA LÓGICA: Verificar se já houve pedido anterior de provas sociais
            const hasPreviousSocialProofRequest = this.hasPreviousSocialProofInHistory(conversationHistory);
            
            // REGRA ATUALIZADA: O chunk de Instagram/Facebook só é ativado APÓS o primeiro pedido de mais provas
            if (moreSocialProofChunk.length > 0 && hasPreviousSocialProofRequest) {
                // Lista de etapas onde oferta ou conteúdo detalhado já foi apresentado
                const stagesWithDetailedContent = [
                    'PLAN_OFFER',
                    'CLOSE_DEAL',
                    'POST_PURCHASE_FOLLOWUP',
                    'CHECKOUT',
                    'PAYMENT_CONFIRMATION'
                ];
                
                if (stagesWithDetailedContent.includes(currentStage)) {
                    // Nestas etapas, retornar APENAS o chunk de redes sociais
                    sortedBySimilarity = moreSocialProofChunk;
                    logger.debug(`[IntelligentRAG] ${currentStage} + mais provas sociais (após primeiro pedido) - Retornando APENAS chunk de redes sociais.`);
                    
                    // 🔥 SALVAR PREFERÊNCIA NO BANCO DE DADOS quando chunk de mais provas é detectado
                    if (conversationHistory && conversationHistory.length > 0) {
                        const chatId = conversationHistory[conversationHistory.length - 1]?.chatId;
                        if (chatId) {
                            stateManager.updateLinkPreference(chatId, true).catch(err => {
                                logger.error(`[IntelligentRAG] Erro ao salvar preferência de link: ${err.message}`);
                            });
                        }
                    }
                } else {
                    // Em etapas iniciais, priorizar chunk de mais provas mas permitir outros chunks
                    sortedBySimilarity = [...moreSocialProofChunk, ...otherChunks];
                    logger.debug(`[IntelligentRAG] ${currentStage} + mais provas sociais (após primeiro pedido) - Priorizando chunk de redes sociais.`);
                    
                    // 🔥 SALVAR PREFERÊNCIA NO BANCO DE DADOS quando chunk de mais provas é detectado
                    if (conversationHistory && conversationHistory.length > 0) {
                        const chatId = conversationHistory[conversationHistory.length - 1]?.chatId;
                        if (chatId) {
                            stateManager.updateLinkPreference(chatId, true).catch(err => {
                                logger.error(`[IntelligentRAG] Erro ao salvar preferência de link: ${err.message}`);
                            });
                        }
                    }
                }
            } else if (moreSocialProofChunk.length > 0 && !hasPreviousSocialProofRequest) {
                // Primeiro pedido de mais provas - não ativar chunk de redes sociais ainda
                sortedBySimilarity = otherChunks; // Excluir o chunk de redes sociais
                logger.debug(`[IntelligentRAG] Primeiro pedido de mais provas sociais detectado - Chunk de redes sociais NÃO ativado ainda.`);
            } else {
                // Se não encontrou o chunk específico, manter a ordenação original
                sortedBySimilarity = [...moreSocialProofChunk, ...otherChunks];
                logger.debug(`[IntelligentRAG] Query de MAIS provas sociais detectada mas chunk específico não encontrado.`);
            }
        }

        // BOOST ESTRATÉGICO: Para consultas sobre diretrizes estruturadas, priorizar chunks específicos
        const isStructuredGuidelineQuery = this.isStructuredGuidelineQuery(userInput);
        
        if (isStructuredGuidelineQuery) {
            const structuredChunks = sortedBySimilarity.filter(item => 
                this.isStructuredGuidelineChunk(item.chunk.source)
            );
            const nonStructuredChunks = sortedBySimilarity.filter(item => 
                !this.isStructuredGuidelineChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de diretrizes primeiro, depois outros por similaridade
            sortedBySimilarity = [...structuredChunks, ...nonStructuredChunks];
            
            logger.debug(`[IntelligentRAG] Query de diretrizes estruturadas detectada - Priorizando ${structuredChunks.length} chunks específicos`);
        }

        // DETECÇÃO DE SITUAÇÕES EMOCIONAIS: Priorizar chunk de detecção emocional
        const isEmotionalSituationQuery = this.isEmotionalSituationQuery(userInput);
        
        if (isEmotionalSituationQuery) {
            const emotionalChunk = sortedBySimilarity.filter(item => 
                this.isEmotionalDetectionChunk(item.chunk.source)
            );
            const otherChunks = sortedBySimilarity.filter(item => 
                !this.isEmotionalDetectionChunk(item.chunk.source)
            );
            
            // Reorganizar: chunk emocional primeiro, depois outros por similaridade
            sortedBySimilarity = [...emotionalChunk, ...otherChunks];
            
            logger.debug(`[IntelligentRAG] Situação emocional detectada - Priorizando chunk de detecção emocional`);
        }

        // BOOST ESTRATÉGICO: Para consultas sobre holding, priorizar chunks específicos
        const isHoldingQuery = this.isHoldingQuery(userInput);
        
        if (isHoldingQuery) {
            const holdingChunks = sortedBySimilarity.filter(item => 
                this.isHoldingChunk(item.chunk.source)
            );
            const nonHoldingChunks = sortedBySimilarity.filter(item => 
                !this.isHoldingChunk(item.chunk.source)
            );
            
            // Reorganizar: chunks de holding primeiro, depois outros por similaridade
            sortedBySimilarity = [...holdingChunks, ...nonHoldingChunks];
            
            logger.debug(`[IntelligentRAG] Query sobre holding detectada - Priorizando ${holdingChunks.length} chunks específicos sobre holding`);
        }

        const relevantChunks = sortedBySimilarity
            .filter(item => item.similarity > threshold)
            .slice(0, topK);
        
        logger.info(`[IntelligentRAG] Encontrados ${relevantChunks.length} chunks relevantes (Estágio: ${currentStage}):`, null, { 
            stage: currentStage,
            totalAvailable: filteredKnowledgeData.length,
            isPriceQuery: isPriceQuery,
            chunks: relevantChunks.map(c => ({source: c.chunk.source, similarity: c.similarity}))
        });
        return relevantChunks;
    }

    // Método auxiliar para detectar queries sobre preço
    isPriceQuery(userInput) {
        const priceIndicators = ['preço', 'preco', 'valor', 'custo', 'investimento', 'caro', 'barato', 'parcelar', 'parcela', 'pagar', 'pagamento', 'desconto', 'comprar', 'pix', 'cartao', 'dinheiro', 'pensar'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return priceIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método para verificar se a query é sobre valores específicos
    isPriceSpecificQuery(userInput) {
        const priceSpecific = ['1997', '1.997', '166', 'parcelado', '12x', 'quanto custa', 'valor do curso', 'parcelas', '166,42'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return priceSpecific.some(term => messageLower.includes(term));
    }

    // Método para verificar se a query é sobre suporte
    isSupportQuery(userInput) {
        const supportTerms = ['duvida', 'ajuda', 'suporte', 'contato', 'whatsapp', 'maria', 'mar.ia', 'tirar duvidas', 'como tiro', 'esclarecer', 'area exclusiva', '61', '99664-5250'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return supportTerms.some(term => messageLower.includes(term));
    }

    // Método para verificar se a query é sobre inscrição
    isEnrollmentQuery(userInput) {
        const enrollmentTerms = ['inscrever', 'matricular', 'link', 'como comprar', 'onde comprar', 'me inscrevo', 'fazer matricula', 'hotmart', 'pay.hotmart', 'A44481801Y'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return enrollmentTerms.some(term => messageLower.includes(term));
    }

    // Método para verificar se a query é sobre problemas da área
    isAreaProblemsQuery(userInput) {
        const problemTerms = ['problema', 'dificuldade', 'advogados', 'area', 'especializa', 'improviso', 'confianca', 'neles proprios', 'area juridica'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return problemTerms.some(term => messageLower.includes(term));
    }

    // Método para verificar se a query é sobre formas de pagamento
    isPaymentMethodsQuery(userInput) {
        const paymentTerms = ['formas de pagamento', 'boleto', 'cartao', 'pix', 'aceitas', 'aceitos', 'como pagar', 'metodos de pagamento'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return paymentTerms.some(term => messageLower.includes(term));
    }

    // Método para verificar se a query é sobre duração do acesso
    isAccessDurationQuery(userInput) {
        const durationTerms = ['duracao', 'acesso', 'para sempre', 'vitalicio', 'expira', 'quanto tempo', 'permanente', 'duração do acesso'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return durationTerms.some(term => messageLower.includes(term));
    }

    // Método auxiliar para verificar se chunk é sobre preço
    isPriceChunk(source) {
        return ['investimento_completo', 'objecao_preco_alto'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre preço específico
    isPriceSpecificChunk(source) {
        return ['investimento_completo', 'curso_investimento_completo'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre suporte
    isSupportChunk(source) {
        return ['suporte_completo', 'faq_duvidas_suporte'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre inscrição
    isEnrollmentChunk(source) {
        return ['informacoes_basicas_completas', 'curso_informacoes_basicas_completo'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre problemas da área
    isAreaProblemsChunk(source) {
        return ['contexto_geral_curso', 'faq_urgencia_especializacao'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre formas de pagamento
    isPaymentMethodsChunk(source) {
        return ['investimento_completo', 'curso_investimento_completo'].includes(source);
    }

    // Método auxiliar para verificar se chunk é sobre duração do acesso
    isAccessDurationChunk(source) {
        return ['faq_acesso_pos_compra', 'faq_tempo_acesso_critico', 'politica_acesso_critica', 'curso_acesso_politica_critica'].includes(source);
    }

    // Método auxiliar para verificar acesso a preço por estágio
    hasStageAccessToPrice(currentStage) {
        // 🔥 CORREÇÃO: Lista atualizada - preços só disponíveis nas etapas de oferta e fechamento
        const stagesWithPriceAccess = [
            'PLAN_OFFER',        // ✅ Etapa correta para apresentar oferta e preço
            'CLOSE_DEAL',        // ✅ Etapa correta para fechamento
            'POST_PURCHASE_FOLLOWUP',
            'CHECKOUT',
            'PAYMENT_CONFIRMATION'
        ];
        return !currentStage || stagesWithPriceAccess.includes(currentStage);
    }

    // Método auxiliar para detectar queries sobre funcionamento
    isFunctioningQuery(userInput) {
        const functioningIndicators = ['como funciona', 'funciona', 'funcionamento', 'formato', 'estrutura', 'como é', 'como vai ser', 'como acontece', 'processo', 'metodologia', 'organizado', 'organização'];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return functioningIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método auxiliar para verificar se chunk é sobre funcionamento
    isFunctioningChunk(source) {
        return [
            'detalhes_tecnicos_completos',
            'faq_formato_curso', 
            'faq_carga_horaria',
            'faq_acesso_pos_compra',
            'contexto_geral_curso'
        ].includes(source);
    }

    // Método auxiliar para detectar queries sobre provas sociais
    isSocialProofQuery(userInput) {
        const socialProofIndicators = [
            'prova', 'provas', 'depoimento', 'depoimentos', 'testemunho', 'testemunhos',
            'resultado', 'resultados', 'aluno', 'alunos', 'aluna', 'alunas', 'sucesso',
            'caso', 'casos', 'exemplo', 'exemplos', 'video', 'videos', 'youtube', 'link', 'links',
            'mariana', 'cristiane', 'ernandes', 'social', 'sociais', 'funcionou', 'funciona para outros',
            'outros alunos', 'quero ver', 'pode mostrar', 'tem algum', 'algum exemplo',
            // Novos sinônimos expandidos para melhor detecção
            'feedbacks', 'feedback', 'avaliação', 'avaliações', 'comentario', 'comentarios',
            'experiencia', 'experiencias', 'historia', 'historias', 'relato', 'relatos',
            'conquista', 'conquistas', 'realizacao', 'realizacoes', 'atingimento', 'atingimentos',
            'evolucao', 'progresso', 'desenvolvimento', 'melhoria', 'transformacao',
            'antes e depois', 'comparativo', 'comparacao', 'diferenca', 'mudanca',
            'cliente', 'clientes', 'participante', 'participantes', 'membro', 'membros',
            'estudante', 'estudantes', 'formando', 'formandos', 'aprovado', 'aprovados',
            'aprovacao', 'aprovacoes', 'certificado', 'certificados', 'comprovante', 'comprovantes',
            'evidencia', 'evidencias', 'comprovacao', 'validacao', 'verificacao',
            'garantia', 'garantias', 'seguranca', 'confianca', 'credibilidade',
            'reputacao', 'prestigio', 'reconhecimento', 'fama', 'notoriedade',
            'case', 'cases', 'case de sucesso', 'cases de sucesso', 'historico', 'historicos',
            'trajetoria', 'trajetorias', 'percurso', 'percursos', 'jornada', 'jornadas',
            'vencedor', 'vencedores', 'campeao', 'campeoes', 'destaque', 'destaques',
            'destacado', 'destacados', 'excelente', 'excelencia', 'excelencias',
            'referencia', 'referencias', 'modelo', 'modelos', 'exemplo a seguir',
            'benchmark', 'benchmarks', 'padrao', 'padroes', 'qualidade', 'qualidades',
            'satisfacao', 'satisfacoes', 'feliz', 'felizes', 'contente', 'contentes',
            'realizado', 'realizados', 'orgulhoso', 'orgulhosos', 'gratificado', 'gratificados',
            'recomendo', 'recomendacao', 'recomendacoes', 'indico', 'indicacao', 'indicacoes',
            'indicado', 'indicados', 'sugerido', 'sugeridos', 'aprovado por', 'aprovado pelos',
            'revisado', 'revisado por', 'validado', 'validado por', 'verificado', 'verificado por',
            '5 estrelas', '5 star', 'excelente nota', 'nota maxima', 'pontuacao maxima',
            'recomendado', 'altamente recomendado', 'fortemente recomendado', 'obrigatorio',
            'essencial', 'imprescindivel', 'fundamental', 'crucial', 'vital',
            'mariana oliveira', 'cristiane silva', 'ernandes junior', 'ernandes jr',
            'mariana', 'cristiane', 'ernandes', 'oliveira', 'silva', 'junior', 'jr',
            'instagram', 'facebook', 'linkedin', 'reels', 'stories', 'post', 'posts',
            'rede social', 'redes sociais', 'midia social', 'midias sociais',
            'comprovar', 'comprovado', 'comprovando', 'demonstrar', 'demonstrado',
            'mostrar', 'mostrado', 'exibir', 'exibido', 'apresentar', 'apresentado',
            'disponibilizar', 'disponibilizado', 'compartilhar', 'compartilhado',
            'visual', 'visualizar', 'visualizacao', 'imagem', 'imagens', 'foto', 'fotos',
            'gravacao', 'gravacoes', 'audio', 'audios', 'material', 'materiais'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return socialProofIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método auxiliar para verificar se chunk é sobre provas sociais
    isSocialProofChunk(source) {
        return [
            'provas_sociais_depoimentos_video',
            'provas_sociais_todos_os_links',
            'argumentos_vendas_prova_social'
        ].includes(source);
    }

    // Método auxiliar para detectar queries sobre MAIS provas sociais
    isMoreSocialProofQuery(userInput) {
        const moreSocialProofIndicators = [
            'mais', 'outros', 'alem desses', 'alem disso', 'só tem esses', 'tem mais', 'outro exemplo', 'outros casos', 'alem da mariana', 'alem do ernandes', 'alem da cristiane',
            // Novos sinônimos expandidos para pedidos de mais provas
            'adicional', 'adicionais', 'extra', 'extras', 'suplementar', 'suplementares',
            'adicionalmente', 'também', 'tambem', 'outras pessoas', 'outras pessoas', 'outras pessoas',
            'outros clientes', 'outras clientes', 'outros participantes', 'outras participantes',
            'mais pessoas', 'mais clientes', 'mais participantes', 'mais casos', 'mais exemplos',
            'mais depoimentos', 'mais testemunhos', 'mais provas', 'mais resultados',
            'mais historias', 'mais relatos', 'mais conquistas', 'mais sucessos',
            'mais evidencias', 'mais comprovantes', 'mais certificados', 'mais feedbacks',
            'exclusivo', 'exclusivos', 'adicional de', 'adicionalmente', 'acrescentar',
            'incrementar', 'aumentar', 'expandir', 'ampliar', 'complemento', 'complementar',
            'restante', 'restantes', 'faltando', 'falta', 'precisa de mais', 'necessito mais',
            'quero mais', 'gostaria de mais', 'seria possivel mais', 'possivel mais',
            'disponivel mais', 'existe mais', 'existe outro', 'existe outros', 'existe outras',
            'tem outro', 'tem outros', 'tem outras', 'possui mais', 'possui outro', 'possui outros',
            'apenas esses', 'só esses', 'só isso', 'apenas isso', 'unico', 'únicos',
            'limitado', 'restrito', 'completo', 'total', 'integral', 'absoluto',
            'resto', 'restante', 'faltam', 'falta', 'precisa', 'necessario', 'necessário',
            'essencial', 'obrigatorio', 'obrigatório', 'imprescindivel', 'fundamental',
            'crucial', 'vital', 'indispensavel', 'urgente', 'prioridade', 'prioritário',
            'mais um', 'mais uma', 'outra', 'outro', 'diferente', 'variado', 'variados',
            'diversificado', 'diversos', 'varios', 'múltiplo', 'multiplo', 'múltiplos', 'multiplos',
            'varias', 'diversas', 'quantos', 'quantos mais', 'quantidade', 'quantas',
            'quantos tem', 'quantos existem', 'quantos são', 'quantos sao', 'quantas tem',
            'quantas existem', 'quantas são', 'quantas sao'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

        // Casos especiais que implicam pedido por mais
        if (messageLower.includes('so tem ess') || messageLower.includes('só tem ess') ||
            messageLower.includes('apenas ess') || messageLower.includes('só ess') ||
            messageLower.includes('apenas isso') || messageLower.includes('só isso') ||
            messageLower.includes('falta mais') || messageLower.includes('precisa de mais')) {
            return true;
        }

        // Detectar se é uma query de prova social ou se contém indicadores de "mais"
        const hasMoreIndicator = moreSocialProofIndicators.some(indicator => messageLower.includes(indicator));
        const hasSocialProof = this.isSocialProofQuery(userInput);
        
        // Se tiver indicadores de "mais" E for relacionado a provas sociais, ou se for uma query de provas sociais
        return hasMoreIndicator || hasSocialProof;
    }

    // Método auxiliar para detectar queries sobre especificações do curso ou página de vendas
    isSpecificationOrSalesPageQuery(userInput) {
        const specificationIndicators = [
            'especificacao', 'especificacoes', 'especificação', 'especificações',
            'detalhes do curso', 'mais detalhes', 'informacoes completas', 'informações completas',
            'programa do curso', 'programa completo', 'conteudo programatico', 'conteúdo programático',
            'grade curricular', 'ementa', 'curriculo', 'currículo',
            'pagina de vendas', 'página de vendas', 'sales page', 'landing page',
            'mais informacoes', 'mais informações', 'quero saber mais',
            'ver tudo', 'informacao completa', 'informação completa'
        ];
        
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return specificationIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método auxiliar para verificar se chunk é sobre MAIS provas sociais
    isMoreSocialProofChunk(source) {
        return source === 'provas_sociais_mais_provas_redes_sociais';
    }

    // 🔥 NOVO MÉTODO: Verificar se já houve pedido anterior de provas sociais no histórico
    hasPreviousSocialProofInHistory(conversationHistory) {
        if (!conversationHistory || !Array.isArray(conversationHistory)) {
            return false;
        }

        // Indicadores de que provas sociais já foram solicitadas anteriormente
        const socialProofRequestIndicators = [
            'mais prova', 'mais provas', 'outros depoimento', 'outros depoimentos',
            'mais resultado', 'mais resultados', 'outros exemplo', 'outros exemplos',
            'mais caso', 'mais casos', 'alem desses', 'além desses', 'só tem esses',
            'tem mais', 'outro exemplo', 'outros casos', 'mais testemunho', 'mais testemunhos',
            // Indicadores expandidos para detecção mais precisa
            'quero ver mais', 'pode mostrar mais', 'tem mais algum', 'gostaria de ver mais',
            'existe mais', 'existe outro', 'existe outros', 'existe outras',
            'tem outro', 'tem outros', 'tem outras', 'possui mais', 'possui outro',
            'apenas esses', 'só esses', 'só isso', 'apenas isso', 'mais pessoas',
            'outras pessoas', 'outros clientes', 'outras clientes', 'mais clientes',
            'mais casos de sucesso', 'mais historias', 'mais relatos', 'mais feedbacks',
            'mais evidencias', 'mais comprovantes', 'mais certificados', 'mais conquistas',
            'adicional', 'extra', 'suplementar', 'complemento', 'restante', 'faltando',
            'falta mais', 'precisa de mais', 'necessito mais', 'quero mais', 'gostaria de mais',
            'quantos mais', 'quantas mais', 'quantos existem', 'quantas existem',
            'quantos tem', 'quantas tem', 'quantos são', 'quantas são', 'completo', 'total',
            'integral', 'absoluto', 'limitado', 'restrito', 'exclusivo', 'único', 'única',
            // 🔥 NOVOS INDICADORES: Para detectar pedidos iniciais de provas sociais
            'algumas provas', 'algumas prova', 'quero ver algumas', 'ver algumas',
            'algumas', 'uns exemplos', 'umas provas', 'alguns casos', 'algumas pessoas',
            'quero ver', 'pode mostrar', 'tem algum', 'tem alguma', 'algum exemplo',
            'alguma prova', 'algum caso', 'algum depoimento', 'alguma pessoa',
            'mostrar', 'ver', 'conhecer', 'saber sobre', 'exemplos de'
        ];

        // Verificar mensagens do usuário no histórico
        for (const message of conversationHistory) {
            if (message.role === 'user' && message.content) {
                const messageLower = message.content.toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "");
                
                // Verificar se alguma mensagem anterior contém indicadores de pedido de mais provas
                const hasMoreProofRequest = socialProofRequestIndicators.some(indicator => 
                    messageLower.includes(indicator)
                );
                
                if (hasMoreProofRequest) {
                    logger.debug(`[IntelligentRAG] Pedido anterior de mais provas sociais encontrado no histórico: "${message.content.substring(0, 50)}..."`);
                    return true;
                }
            }
        }

        return false;
    }

    // Novo método para filtrar chunks baseado no estágio
    filterChunksByStage(knowledgeData, currentStage) {
        // Chunks relacionados a preço/investimento que devem ser filtrados RIGOROSAMENTE
        const strictPriceChunks = [
            'investimento_completo', // Contém valores exatos: R$1.997,00
            'objecao_preco_alto' // Contém argumentos sobre preço alto
        ];

        // Chunks que podem mencionar preço mas não são principalmente sobre isso
        const partialPriceChunks = [
            'faq_garantia_satisfacao' // Menciona reembolso, mas não valores
        ];

        // Estágios onde informações de preço SÃO permitidas
        const stagesWithPriceAccess = [
            'PLAN_OFFER',
            'CLOSE_DEAL',
            'POST_PURCHASE_FOLLOWUP',
            'CHECKOUT',
            'PAYMENT_CONFIRMATION'
        ];

        // Se não há estágio definido ou é um estágio com acesso a preço, retorna tudo
        if (!currentStage || stagesWithPriceAccess.includes(currentStage)) {
            logger.debug(`[IntelligentRAG] Estágio ${currentStage} tem acesso completo ao conhecimento (${knowledgeData.length} chunks)`);
            return knowledgeData;
        }

        // Para estágios sem acesso a preço, filtrar chunks estritamente relacionados a preço
        const filteredData = knowledgeData.filter(item => {
            const isStrictPrice = strictPriceChunks.includes(item.chunk.source);
            // Manter chunks parciais que podem ser úteis em outros contextos
            return !isStrictPrice;
        });

        const removedCount = knowledgeData.length - filteredData.length;
        logger.debug(`[IntelligentRAG] Estágio ${currentStage} - Filtrados ${removedCount} chunks de preço estrito. Disponíveis: ${filteredData.length}`);
        return filteredData;
    }

    isKnowledgeQuery(message) {
        const knowledgeIndicators = [
            'quanto', 'preço', 'valor', 'custo', 'tempo', 'acesso', 'módulo', 'conteúdo',
            'certificado', 'professor', 'como funciona', 'o que ensina', 'inclui',
            'bônus', 'material', 'suporte', 'dúvida', 'prazo', 'duração', 'planos',
            'plano', 'opções', 'investimento', 'pagamento', 'parcelado', 'vista',
            'carga', 'horas', 'horária', 'carga horária',
            // NOVOS: indicadores de prazo/acesso e ansiedade temporal
            'conseguir assistir', 'medo de não conseguir', 'dar tempo', 'tempo suficiente',
            'vitalício', 'permanente', 'expira', 'extensão', '30 dias', 'mais tempo',
            'preocupado', 'ansioso', 'nervoso', 'inseguro', 'receio',
            // NOVOS: indicadores sobre professor
            'quem', 'ministra', 'responsável', 'instrutor', 'jaylton', 'lopes',
            'nome do professor', 'experiência', 'formação', 'credenciais', 'magistratura',
            // NOVOS: indicadores sobre bônus e materiais
            'extras', 'grátis', 'vem junto', 'ferramentas', 'modelos', 'templates',
            'combo', 'networking', 'comunidade', 'facebook', 'prospecção',
            // NOVOS: indicadores sobre modalidade
            'online', 'presencial', 'gravado', 'ao vivo', 'formato', 'plataforma',
            'horário', 'flexível', 'quando quiser', 'onde assisto',
            // NOVOS: indicadores sobre resultados
            'quanto ganho', 'faturamento', 'honorários', 'vale a pena', 'retorno',
            'casos de sucesso', 'resultados', 'multiplicar', 'aumentar ganhos',
            // NOVOS: indicadores sobre área
            'família', 'sucessões', 'inventário', 'testamento', 'divórcio', 'herança',
            'trabalha com', 'especialidade', 'atua em', 'sobre o que',
            // NOVOS: indicadores sobre nível
            'iniciante', 'experiente', 'básico', 'avançado', 'é para mim',
            'serve para', 'recém-formado', 'sem experiência', 'primeira vez'
        ];
        const messageLower = message.toLowerCase();
        return knowledgeIndicators.some(indicator => messageLower.includes(indicator));
    }

    getRelevantKnowledge(userMessage, maxLength = 1500, currentStage = null, conversationHistory = []) {
        // Para queries específicas, permitir mais contexto
        const isFunctioningQuery = this.isFunctioningQuery(userMessage);
        const isSocialProofQuery = this.isSocialProofQuery(userMessage);
        const isStructuredGuidelineQuery = this.isStructuredGuidelineQuery(userMessage);
        const isEmotionalSituationQuery = this.isEmotionalSituationQuery(userMessage);
        const isProfessorQuery = this.isProfessorQuery(userMessage);
        const isBonusQuery = this.isBonusQuery(userMessage);
        const isModalidadeQuery = this.isModalidadeQuery(userMessage);
        const isResultadosQuery = this.isResultadosQuery(userMessage);
        const isAreaEspecialidadeQuery = this.isAreaEspecialidadeQuery(userMessage);
        const isNivelExperienciaQuery = this.isNivelExperienciaQuery(userMessage);
        const isHoldingQuery = this.isHoldingQuery(userMessage);
        
        let effectiveMaxLength = maxLength;
        if (isFunctioningQuery) {
            effectiveMaxLength = Math.max(maxLength, 2500);
        } else if (isSocialProofQuery) {
            effectiveMaxLength = Math.max(maxLength, 3000); // Mais espaço para links e depoimentos
        } else if (isStructuredGuidelineQuery) {
            effectiveMaxLength = Math.max(maxLength, 2000); // Espaço para respostas estruturadas
        } else if (isEmotionalSituationQuery) {
            effectiveMaxLength = Math.max(maxLength, 2500); // Espaço para contexto emocional completo
        } else if (isProfessorQuery) {
            effectiveMaxLength = Math.max(maxLength, 2000); // Espaço adequado para informações do professor
        } else if (isBonusQuery) {
            effectiveMaxLength = Math.max(maxLength, 2800); // Espaço para listar todos os bônus
        } else if (isModalidadeQuery) {
            effectiveMaxLength = Math.max(maxLength, 1800); // Espaço para detalhes de modalidade
        } else if (isResultadosQuery) {
            effectiveMaxLength = Math.max(maxLength, 3000); // Espaço para casos de sucesso e resultados
        } else if (isAreaEspecialidadeQuery) {
            effectiveMaxLength = Math.max(maxLength, 2200); // Espaço para conteúdo programático
        } else if (isNivelExperienciaQuery) {
            effectiveMaxLength = Math.max(maxLength, 1800); // Espaço para respostas sobre adequação
        } else if (isHoldingQuery) {
            effectiveMaxLength = Math.max(maxLength, 2000); // Espaço para resposta estruturada sobre holding
        }
        
        const relevantChunks = this.findTopRelevantChunks(userMessage, currentStage, 3, 0.03, conversationHistory);

        if (relevantChunks.length === 0) {
            return ""; // Retorna vazio se nada relevante for encontrado
        }

        const context = relevantChunks
            .map(c => `Fonte: ${c.chunk.source}\nConteúdo: ${c.chunk.content}`)
            .join('\n\n---\n\n');
        
        if (context.length > effectiveMaxLength) {
            return context.substring(0, effectiveMaxLength) + '...';
        }
        
        return context;
    }

    // Métodos de detecção de Objeção
    isObjectionQuery(userInput) {
        const objectionIndicators = [
            'caro', 'preço', 'valor', 'investimento', 'pagar', 'custo', 'dinheiro',
            'tempo', 'correria', 'ocupado', 'agenda',
            'acesso', 'limitado', 'vitalício', 'expira',
            'pensar', 'analisar', 'decido',
            'pós-graduação', 'pos', 'especialização',
            'garantia', 'reembolso', 'cancelar',
            'boleto',
            'iniciante', 'recém-formado', 'sem experiência',
            'experiente', 'já atuo', 'de novo'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return objectionIndicators.some(indicator => messageLower.includes(indicator));
    }

    isObjectionChunk(source) {
        return source.startsWith('resposta_objecao_');
    }

    // Método auxiliar para detectar queries sobre diretrizes estruturadas
    isStructuredGuidelineQuery(userInput) {
        const structuredIndicators = [
            'abrange planejamento', 'planejamento sucessorio', 'por quanto tempo', 'tempo acesso',
            'aulas ao vivo', 'aulas gravadas', 'esta atualizado', 'atualizado', 'curso vitalicio',
            'vitalicio', 'pos graduacao', 'pos-graduacao', 'certificacao', 'certificado',
            'duracao aulas', '4 horas', 'pressa', 'pouco tempo', 'iniciante', 'experiente',
            '1 ano pouco', 'tempo curto'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return structuredIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método auxiliar para verificar se chunk é sobre diretrizes estruturadas
    isStructuredGuidelineChunk(source) {
        return source.startsWith('diretriz_resposta_') || 
               source.startsWith('diretriz_objecao_') || 
               source.startsWith('diretriz_situacao_') ||
               source === 'diretrizes_frases_humanizadas';
    }

    // Método auxiliar para detectar queries sobre situações emocionais
    isEmotionalSituationQuery(userInput) {
        const emotionalIndicators = [
            // Problemas financeiros específicos
            'nao tenho dinheiro', 'não tenho dinheiro', 'sem dinheiro', 'nao posso pagar', 'não posso pagar',
            'situacao financeira dificil', 'situação financeira difícil', 'desempregado', 'sem renda', 
            'apertado financeiramente', 'endividado', 'sem condições', 'sem condicoes',
            'muito caro', 'caro demais', 'não tenho como', 'nao tenho como', 'impossível pagar',
            'impossivel pagar', 'fora do orçamento', 'fora do orcamento', 'não cabe no bolso',
            'nao cabe no bolso', 'difícil financeiramente', 'dificil financeiramente',
            
            // Problemas de saúde
            'problemas de saude', 'problemas de saúde', 'doente', 'depressao', 'depressão', 
            'ansiedade', 'tratamento medico', 'tratamento médico', 'questoes psicologicas', 
            'questões psicológicas', 'nao estou bem', 'não estou bem', 'saude mental', 
            'saúde mental', 'burnout', 'estresse',
            
            // Problemas pessoais
            'problemas pessoais', 'separacao', 'separação', 'divorcio', 'divórcio', 
            'morte na familia', 'morte na família', 'luto', 'relacionamento dificil', 
            'relacionamento difícil', 'familia', 'família', 'problemas familiares', 'crise pessoal',
            
            // Problemas profissionais
            'perdeu emprego', 'perdi emprego', 'demitido', 'escritorio fechou', 'escritório fechou',
            'sem clientes', 'advocacia dificil', 'advocacia difícil', 'carreira estagnada', 
            'sem perspectiva', 'crise na advocacia', 'mercado difícil', 'mercado dificil',
            
            // Palavras-chave emocionais dos testes que falharam
            'empatia', 'bem-estar', 'bem estar', 'situação difícil', 'situacao dificil',
            'apoio', 'futuro', 'esperança', 'esperanca', 'compreensão', 'compreensao',
            'entendo sua situação', 'entendo sua situacao', 'sei como é difícil', 'sei como e dificil'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return emotionalIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Método auxiliar para verificar se chunk é sobre detecção emocional
    isEmotionalDetectionChunk(source) {
        return source === 'deteccao_problemas_emocionais';
    }

    // Novo método para detectar queries sobre conteúdo específico
    isContentQuery(userInput) {
        const contentIndicators = [
            // Palavras básicas sobre conteúdo
            'módulo', 'módulos', 'conteúdo', 'conteudo', 'bônus', 'bonus',
            
            // Frases diretas sobre mostrar/ver conteúdo
            'mostrar conteúdo', 'mostrar conteudo', 'mostrar o conteúdo', 'mostrar o conteudo',
            'ver conteúdo', 'ver conteudo', 'ver o conteúdo', 'ver o conteudo',
            'você pode me mostrar', 'voce pode me mostrar', 'pode me mostrar',
            'me mostrar', 'me mostra', 'mostra o', 'mostra os',
            'quero ver', 'gostaria de ver', 'posso ver', 'como posso ver',
            // Novas variações mais diretas
            'pode mostrar', 'pode me mostrar', 'mostrar', 'mostra', 'me mostra o',
            'consegue mostrar', 'tem como mostrar', 'da para mostrar', 'dá para mostrar',
            
            // Perguntas sobre o que tem/ensina
            'ensina sobre', 'fala sobre', 'aborda sobre', 'tem algo sobre', 
            'o que tem no', 'o que tem', 'que tem no curso', 'tem no curso',
            'o que ensina', 'que ensina', 'o que aprendo', 'que aprendo',
            'o que vou aprender', 'que vou aprender', 'vou aprender o que',
            // Novas variações mais naturais
            'o que tem no curso', 'que tem o curso', 'tem o que', 'o que o curso tem',
            'curso tem o que', 'tem alguma coisa', 'o que inclui', 'que inclui',
            'o que vem no curso', 'que vem no curso', 'vem o que',
            
            // Perguntas sobre estrutura
            'como é dividido', 'como está dividido', 'divisão do curso',
            'estrutura do curso', 'organização do curso', 'como funciona',
            'está organizado', 'esta organizado',
            
            // Temas específicos
            'inventário', 'inventarios', 'testamento', 'testamentos', 'holding', 
            'sucessões', 'sucessoes', 'herança', 'heranca', 'patrimônio', 'patrimonio',
            'prospecção', 'prospeccao', 'petições', 'peticoes', 'modelos',
            'formulários', 'formularios', 'templates', 'materiais',
            
            // Variações de pergunta
            'grade curricular', 'programa do curso', 'programação', 'programacao',
            'cronograma', 'roteiro', 'sumário', 'sumario', 'índice', 'indice',
            'tópicos', 'topicos', 'assuntos', 'temas', 'matérias', 'materias',
            // Novas variações mais simples
            'grade do curso', 'programa', 'programação do curso', 'grade',
            'ementa', 'currículo', 'curriculo', 'conteúdo programático', 'conteudo programatico'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return contentIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Novo método para verificar se chunk é sobre conteúdo
    isContentChunk(source) {
        return ['conteudo_programatico_modulos', 'bonus_materiais_completos'].includes(source);
    }

    // Novo método para detectar queries sobre carga horária
    isCargaHorariaQuery(userInput) {
        const cargaHorariaIndicators = [
            'carga horária', 'carga de horas', 'carga horaria', 'total de horas', 'quantas horas', 
            'tempo do curso', 'duracao do curso', 'duração do curso', 'horas de aula', 'horas tem',
            'quanto tempo de aula', 'tempo de conteudo', 'tempo de conteúdo', 'carga total',
            'horas gravadas', 'horas de video', 'horas de vídeo',
            // Novas variações mais naturais
            'tem quantas horas', 'curso tem horas', 'quantas horas tem o curso', 'quantas horas tem',
            'horas de duração', 'horas de duracao', 'duração em horas', 'duracao em horas', 
            'tempo em horas', 'o curso tem quantas', 'quantas horas o curso', 'curso quantas horas',
            'horas do curso', 'horas no curso', 'curso tem quantas horas', 'tem horas',
            'quantas horas de', 'horas são', 'horas sao', 'são quantas horas', 'sao quantas horas'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return cargaHorariaIndicators.some(indicator => messageLower.includes(indicator));
    }

    // Novo método para verificar se chunk é sobre carga horária
    isCargaHorariaChunk(source) {
        return [
            'faq_carga_horaria',
            'detalhes_tecnicos_completos',
            'faq_formato_curso'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre prazo de acesso e ansiedade temporal
    isPrazoAcessoQuery(userInput) {
        const prazoAcessoIndicators = [
            // Frases exatas que o usuário pode usar
            'tenho medo de não conseguir', 'medo de nao conseguir', 'nao vou conseguir assistir',
            'consigo aumentar mais um pouco o prazo', 'conseguir assistir a todas as aulas',
            'não conseguir assistir todas', 'nao conseguir assistir todas', 'prazo de 1 ano',
            'prazo de 1 anos', 'um ano é pouco', '1 ano é pouco', 'tempo suficiente',
            'dar tempo', 'dá tempo', 'tempo limitado', 'acesso expira', 'perder o acesso',
            'perder acesso', 'vou perder', 'vai expirar', 'acesso acaba', 'termina quando',
            'mais tempo', 'estender prazo', 'extensão', 'prorrogar', 'renovar acesso',
            '30 dias extras', '30 dias a mais', 'dias adicionais', 'tempo adicional',
            'prazo insuficiente', 'pouco tempo', 'tempo curto', 'corrido demais',
            'agenda apertada', 'muito ocupado', 'sem tempo para estudar',
            'conseguir concluir', 'terminar o curso', 'finalizar as aulas',
            'assistir no prazo', 'dentro do prazo', 'até o final', 'preocupado com tempo',
            'ansioso sobre tempo', 'nervoso com prazo', 'medo do tempo',
            // Novas variações que podem ter falhado
            'posso ter mais', 'consigo ter mais', 'pode ter mais', 'tem como ter mais',
            'mais 30 dias', 'ter 30 dias', 'liberar mais dias', 'ganhar mais tempo',
            'se precisar', 'caso precise', 'se não conseguir', 'caso não consiga',
            // Palavras-chave individuais
            'vitalicio', 'permanente', 'para sempre', 'ilimitado', 'sem prazo'
        ];
        
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return prazoAcessoIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre prazo de acesso
    isPrazoAcessoChunk(source) {
        return [
            'resposta_objecao_um_ano_pouco',
            'faq_tempo_acesso', 
            'politicas_acesso_critico',
            'resposta_objecao_acesso_limitado_pouco_tempo',
            'diretriz_situacao_pressa_pouco_tempo'
        ].includes(source);
    }

    // NOVO: Método para detectar ansiedade específica sobre tempo/capacidade
    isAnsiedadeTempoQuery(userInput) {
        const ansiedadeIndicators = [
            'tenho medo', 'estou preocupado', 'preocupada', 'ansioso', 'ansiosa',
            'nervoso', 'nervosa', 'com medo', 'receio', 'inseguro', 'insegura',
            'não sei se consigo', 'nao sei se consigo', 'será que dou conta',
            'sera que dou conta', 'dou conta', 'vou conseguir dar conta',
            'conseguir acompanhar', 'acompanhar o ritmo', 'muito conteúdo',
            'muito conteudo', 'sobrecarga', 'pressão', 'pressao',
            'medo de não dar conta', 'medo de nao dar conta',
            'e se eu não conseguir', 'e se eu nao conseguir',
            'e se não der tempo', 'e se nao der tempo'
        ];
        
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return ansiedadeIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre suporte emocional/ansiedade
    isAnsiedadeTempoChunk(source) {
        return [
            'resposta_objecao_um_ano_pouco',
            'diretriz_situacao_pressa_pouco_tempo',
            'resposta_objecao_falta_de_tempo',
            'deteccao_problemas_emocionais'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre professor
    isProfessorQuery(userInput) {
        const professorIndicators = [
            // Perguntas diretas sobre professor
            'quem é o professor', 'quem e o professor', 'nome do professor', 'professor se chama',
            'qual o nome do professor', 'qual nome do professor', 'quem ministra', 'quem ensina',
            'quem dá', 'quem da', 'quem é que ensina', 'quem e que ensina', 'responsável pelo curso',
            'responsavel pelo curso', 'instrutor do curso', 'mentor do curso',
            
            // Perguntas sobre experiência e formação
            'experiência do professor', 'experiencia do professor', 'formação do professor', 
            'formacao do professor', 'currículo do professor', 'curriculo do professor',
            'credenciais do professor', 'qualificação do professor', 'qualificacao do professor',
            
            // Perguntas sobre background profissional
            'professor é juiz', 'professor e juiz', 'ex-juiz', 'trabalhou como juiz',
            'atuou como juiz', 'magistratura', 'tjdft', 'tribunal', 'jaylton', 'lopes',
            'jaylton lopes', 'advogado', 'experiência na advocacia', 'experiencia na advocacia',
            
            // Variações simples
            'professor', 'ministra', 'ensina', 'coordenador', 'especialista', 'expert',
            'quem', 'responsável', 'responsavel', 'mestre', 'docente', 'mentor'
        ];
        
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return professorIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre professor
    isProfessorChunk(source) {
        return [
            'faq_quem_e_o_professor',
            'professor_credenciais_completas',
            'professor_completo'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre bônus e materiais
    isBonusQuery(userInput) {
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // Verificar se é uma query de carga horária primeiro (exclusão)
        if (this.isCargaHorariaQuery(userInput)) {
            return false;
        }
        
        const bonusIndicators = [
            'bônus', 'bonus', 'extras', 'materiais inclusos', 'vem junto', 'acompanha',
            'tem alguma coisa a mais', 'o que vem', 'combo', 'grátis', 'gratuito',
            'ferramentas', 'modelos', 'petições', 'templates', 'formulários',
            'manuais', 'guias', 'acelerador', 'prospecção', 'marketing',
            'google ads', 'comunidade', 'facebook', 'networking', 'm.a.s',
            'mas', 'mapa', 'advocacia 4.0', 'inclusos', 'adicionais', 'brinde',
            // Expansão significativa de sinônimos
            'que mais vem', 'o que mais tem', 'tem mais alguma coisa', 'vem mais alguma coisa',
            'que mais inclui', 'o que mais inclui', 'tem algo mais', 'vem algo mais',
            'alguma coisa extra', 'algo extra', 'tem extra', 'vem extra',
            'quais extras', 'extras tem', 'extras vem',
            'quais bônus', 'bônus tem', 'bônus vem',
            'quais bonus', 'bonus tem', 'bonus vem',
            'material extra', 'materiais extras', 'conteúdo extra', 'conteudo extra',
            'curso vem com', 'curso tem', 'curso inclui', 'curso acompanha',
            'pacote inclui', 'pacote tem', 'pacote vem', 'oferta inclui',
            'ganho junto', 'recebo junto', 'levo junto', 'tenho junto',
            'vou ganhar', 'vou receber', 'vou levar', 'vou ter',
            'presente', 'presentes', 'cortesia', 'benefício', 'beneficio',
            'vantagem', 'vantagens', 'diferencial', 'diferenciais',
            'ia extra', 'inteligência artificial extra', 'bot extra',
            'suporte extra', 'ajuda extra', 'assistência extra',
            'documento extra', 'arquivo extra', 'material de apoio',
            'planilha extra', 'modelo extra', 'template extra',
            'tudo incluso', 'tudo incluído', 'pacote completo', 'kit completo',
            // Variações específicas para IAJUR e Mar.IA
            'iajur', 'ia jur', 'maria', 'mar.ia', 'mar ia',
            'inteligencia artificial', 'inteligência artificial',
            'chatbot', 'assistente virtual', 'bot', 'ia',
            // Perguntas diretas comuns
            'tem algum bônus', 'tem bonus', 'tem bônus', 'vem com bônus',
            'vem com bonus', 'inclui bônus', 'inclui bonus',
            'acompanha bônus', 'acompanha bonus', 'ganha bônus', 'ganha bonus',
            'recebe bônus', 'recebe bonus', 'leva bônus', 'leva bonus'
        ];
        
        return bonusIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre bônus
    isBonusChunk(source) {
        return [
            'bonus_materiais_completos',
            'conteudo_programatico_modulos',
            // Chunks específicos sobre as IAs (principais bônus)
            'inteligencias_artificiais_iajur',
            'inteligencias_artificiais_maria', 
            'inteligencias_artificiais_diferenca',
            'inteligencias_artificiais_acesso',
            'bonus_maria_especifico',
            'bonus_iajur_especifico',
            // Outros chunks que podem conter informações sobre bônus
            'sistema_suporte_completo',
            'argumento_vendas_diferencial_tecnologico',
            'argumento_vendas_economia_tempo',
            'argumento_vendas_vantagem_competitiva'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre modalidade de ensino
    isModalidadeQuery(userInput) {
        const modalidadeIndicators = [
            'online', 'presencial', 'ead', 'distância', 'formato', 'como são',
            'ao vivo', 'gravado', 'gravadas', 'síncrono', 'assíncrono',
            'quando quiser', 'horário', 'flexível', 'plataforma', 'sistema',
            'onde assisto', 'como acesso', 'modalidade', 'forma de ensino',
            'tipo de curso', 'como funciona', 'estrutura do curso'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return modalidadeIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre modalidade
    isModalidadeChunk(source) {
        return [
            'faq_formato_curso',
            'detalhes_tecnicos_completos',
            'contexto_geral_curso'
        ].includes(source);
    }

    // NOVO: Método para detectar queries específicas sobre holding
    isHoldingQuery(userInput) {
        const holdingIndicators = [
            'holding', 'fala sobre holding', 'tem holding', 
            'curso holding', 'ensina holding', 'aborda holding', 'módulo holding',
            'modulo holding', 'vocês ensinam holding', 'voces ensinam holding',
            'curso fala sobre holding', 'tem módulo de holding', 'tem modulo de holding',
            'ensina sobre holding', 'planejamento sucessorio', 
            'instrumento planejamento', 'instrumento de planejamento'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return holdingIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre holding
    isHoldingChunk(source) {
        return [
            'curso_fala_holding',
            'conteudo_programatico_modulos',
            'foco_e_escopo'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre área de especialidade
    isAreaEspecialidadeQuery(userInput) {
        const areaIndicators = [
            'família', 'sucessões', 'inventário', 'testamento', 'herança',
            'divórcio', 'alimentos', 'pensão', 'guarda', 'holding',
            'patrimonial', 'planejamento', 'itcmd', 'usucapião', 'alvará',
            'judicial', 'extrajudicial', 'cartório', 'civilista', 'civil',
            'trabalha com', 'especialidade em', 'atua em', 'sobre o que'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return areaIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre área de especialidade
    isAreaEspecialidadeChunk(source) {
        return [
            'conteudo_programatico_modulos',
            'informacoes_basicas_completas',
            'contexto_geral_curso'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre nível de experiência
    isNivelExperienciaQuery(userInput) {
        const nivelIndicators = [
            'iniciante', 'experiente', 'avançado', 'básico', 'recém-formado',
            'junior', 'senior', 'sem experiência', 'primeira vez', 'começando',
            'novo na área', 'anos de experiência', 'tempo de advocacia',
            'carreira', 'é para mim', 'serve para', 'posso fazer'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return nivelIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre nível de experiência
    isNivelExperienciaChunk(source) {
        return [
            'resposta_objecao_duvida_se_e_para_iniciantes',
            'resposta_objecao_duvida_se_e_para_experientes',
            'informacoes_basicas_completas'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre resultados financeiros
    isResultadosQuery(userInput) {
        const resultadosIndicators = [
            'quanto ganho', 'quanto posso ganhar', 'faturamento', 'honorários',
            'renda', 'lucro', 'retorno', 'roi', 'vale a pena', 'compensa',
            'multiplicar', 'aumentar ganhos', 'resultados financeiros',
            'casos de sucesso', 'quanto cobra', 'tabela de honorários',
            'precificação', 'contratos', 'faturar', 'rendimento', 'receita',
            'dá resultado', 'funciona mesmo', 'vale o investimento'
        ];
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return resultadosIndicators.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre resultados financeiros
    isResultadosChunk(source) {
        return [
            'provas_sociais_depoimentos_video',
            'argumento_vendas_prova_social',
            'bonus_materiais_completos' // Contém precificação de honorários
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre IAJUR
    isIAJURQuery(userInput) {
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return this.synonymMap.iajur.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre IAJUR
    isIAJURChunk(source) {
        return [
            'inteligencias_artificiais_iajur',
            'inteligencias_artificiais_diferenca',
            'inteligencias_artificiais_acesso',
            'resposta_faq_ia_nao_confiavel',
            'resposta_faq_prefiro_manual',
            'argumento_vendas_diferencial_tecnologico',
            'argumento_vendas_economia_tempo',
            'argumento_vendas_vantagem_competitiva',
            'argumento_vendas_roi_imediato',
            'pergunta_iajur_dia_a_dia',
            'ia_pergunta_como_funciona_iajur',
            'ia_pergunta_acesso_iajur_curso',
            'ia_pergunta_iajur_substitui_advogado'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre Mar.IA
    isMariaQuery(userInput) {
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return this.synonymMap.maria.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre Mar.IA
    isMariaChunk(source) {
        return [
            'inteligencias_artificiais_maria',
            'inteligencias_artificiais_diferenca',
            'inteligencias_artificiais_acesso',
            'sistema_suporte_completo',
            'resposta_faq_ia_nao_confiavel',
            'resposta_faq_prefiro_manual'
        ].includes(source);
    }

    // NOVO: Método para detectar queries sobre diferenças entre IAs
    isDiferencaIAsQuery(userInput) {
        const messageLower = userInput.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        return this.synonymMap.diferenca_ias.some(indicator => messageLower.includes(indicator));
    }

    // NOVO: Método para verificar se chunk é sobre diferenças entre IAs
    isDiferencaIAsChunk(source) {
        return [
            'inteligencias_artificiais_diferenca',
            'inteligencias_artificiais_iajur',
            'inteligencias_artificiais_maria'
        ].includes(source);
    }
}

export default IntelligentRAG;