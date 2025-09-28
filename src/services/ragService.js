import SupabaseService from './supabaseService.js';
import GeminiService from './geminiService.js';
import logger from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class RAGService {
  constructor() {
    this.supabaseService = new SupabaseService();
    this.geminiService = new GeminiService();
    this.isInitialized = false;
    this.fallbackKnowledge = []; // Armazenamento em memória como fallback
    this.useSupabase = true;
    this.cacheFilePath = path.join(__dirname, '../../data/embeddings-cache.json');
  }

  async initialize() {
    try {
      logger.info('Inicializando RAG Service...', { module: 'RAGService' });

      // Inicializa os serviços
      const supabaseConnected = await this.supabaseService.connect();
      const geminiInitialized = await this.geminiService.initialize();

      if (!supabaseConnected) {
        logger.warn('Supabase não conectado - funcionará em modo fallback (memória)', { module: 'RAGService' });
        this.useSupabase = false;
      } else {
        this.useSupabase = true;
      }

      if (!geminiInitialized) {
        throw new Error('Falha ao inicializar Gemini AI');
      }

      this.isInitialized = true;
      logger.info('RAG Service inicializado com sucesso', { module: 'RAGService' });

      return true;
    } catch (error) {
      logger.error('Erro ao inicializar RAG Service:', error, { module: 'RAGService' });
      this.isInitialized = false;
      return false;
    }
  }

  // Gera hash dos dados de conhecimento para verificar se mudaram
  generateKnowledgeHash(knowledgeData) {
    const content = JSON.stringify(knowledgeData.map(item => ({ source: item.source, content: item.content })));
    return crypto.createHash('md5').update(content).digest('hex');
  }

  // Carrega cache de embeddings
  loadEmbeddingsCache() {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const cacheData = JSON.parse(fs.readFileSync(this.cacheFilePath, 'utf8'));
        return cacheData;
      }
    } catch (error) {
      logger.warn('Erro ao carregar cache de embeddings:', error.message, { module: 'RAGService' });
    }
    return null;
  }

  // Salva cache de embeddings
  saveEmbeddingsCache(knowledgeData, embeddings) {
    try {
      const cacheData = {
        version: '1.0.0',
        lastGenerated: new Date().toISOString(),
        knowledgeHash: this.generateKnowledgeHash(knowledgeData),
        embeddings: embeddings,
        documentsCount: knowledgeData.length
      };

      fs.writeFileSync(this.cacheFilePath, JSON.stringify(cacheData, null, 2));
      logger.info('Cache de embeddings salvo com sucesso', { module: 'RAGService' });
    } catch (error) {
      logger.warn('Erro ao salvar cache de embeddings:', error.message, { module: 'RAGService' });
    }
  }

  // Verifica se os embeddings em cache são válidos
  isCacheValid(knowledgeData) {
    const cache = this.loadEmbeddingsCache();
    if (!cache || !cache.embeddings || !cache.knowledgeHash) {
      return false;
    }

    const currentHash = this.generateKnowledgeHash(knowledgeData);
    const isValid = cache.knowledgeHash === currentHash &&
                   cache.embeddings.length === knowledgeData.length;

    logger.info(`Cache de embeddings ${isValid ? 'válido' : 'inválido'}`, { module: 'RAGService' });
    return isValid;
  }

  async indexKnowledge(knowledgeData, useCustomEmbeddings = true) {
    if (!this.isInitialized) {
      throw new Error('RAG Service não está inicializado');
    }

    try {
      logger.info('Indexando base de conhecimento...', { module: 'RAGService' });

      // Processa os dados de conhecimento
      const documents = knowledgeData.map(item => ({
        content: item.content,
        source: item.source,
      }));

      let embeddings = null;

      // Verifica se deve gerar embeddings
      if (useCustomEmbeddings && this.geminiService.isInitialized) {
        // Primeiro tenta usar cache
        if (this.isCacheValid(knowledgeData)) {
          logger.info('Usando embeddings do cache', { module: 'RAGService' });
          const cache = this.loadEmbeddingsCache();
          embeddings = cache.embeddings;
        } else {
          // Gera novos embeddings se cache inválido
          logger.info('Gerando novos embeddings com Gemini...', { module: 'RAGService' });
          const texts = documents.map(doc => doc.content);
          embeddings = await this.geminiService.batchGenerateEmbeddings(texts);
          logger.info(`${embeddings.length} embeddings gerados`, { module: 'RAGService' });

          // Salva no cache
          this.saveEmbeddingsCache(knowledgeData, embeddings);
        }
      }

      // Tenta armazenar no Supabase, se não conseguir usa fallback
      if (this.useSupabase && this.supabaseService.isConnected) {
        try {
          await this.supabaseService.clearCollection();
          await this.supabaseService.addDocuments(documents, embeddings);
          const count = await this.supabaseService.getCount();
          logger.info(`Base de conhecimento indexada no Supabase: ${count} documentos`, { module: 'RAGService' });
        } catch (supabaseError) {
          logger.warn('Erro no Supabase, mudando para modo fallback:', supabaseError.message, { module: 'RAGService' });
          this.useSupabase = false;
        }
      }

      // Sempre armazena em memória como fallback
      this.fallbackKnowledge = documents.map((doc, index) => ({
        ...doc,
        embedding: embeddings ? embeddings[index] : null,
        id: `fallback_${index}`
      }));

      const totalCount = this.useSupabase ? await this.supabaseService.getCount() : this.fallbackKnowledge.length;
      logger.info(`Base de conhecimento indexada: ${totalCount} documentos (${this.useSupabase ? 'Supabase' : 'Memória'})`, { module: 'RAGService' });

      return true;
    } catch (error) {
      logger.error('Erro ao indexar base de conhecimento:', error, { module: 'RAGService' });
      throw error;
    }
  }

  // Busca avançada em memória com suporte a sinônimos e termos relacionados
  async searchInMemory(query, maxResults = 5) {
    const normalizedQuery = this.normalizeText(query);
    const queryTerms = this.extractKeyTerms(normalizedQuery);

    // Mapa de sinônimos e termos relacionados
    const synonymMap = {
      'preço': ['valor', 'custo', 'investimento', 'pagamento', 'dinheiro'],
      'valor': ['preço', 'custo', 'investimento', 'pagamento'],
      'curso': ['treinamento', 'capacitação', 'formação', 'ensino'],
      'professor': ['instrutor', 'docente', 'jaylton'],
      'aulas': ['lições', 'conteúdo', 'material'],
      'certificado': ['certificação', 'diploma'],
      'tempo': ['prazo', 'duração', 'período'],
      'acesso': ['disponibilidade', 'liberação'],
      'pagamento': ['forma de pagar', 'como pagar', 'opções'],
      'cartão': ['cartao', 'credito', 'crédito'],
      'boleto': ['transferência', 'depósito'],
      'garantia': ['reembolso', 'devolução', 'satisfação'],
      'inventário': ['inventario', 'sucessões', 'sucessão', 'herança'],
      'holding': ['planejamento patrimonial', 'estruturação'],
      'advogado': ['advocacia', 'jurídico', 'direito']
    };

    // Expande os termos da query com sinônimos
    const expandedTerms = new Set(queryTerms);
    queryTerms.forEach(term => {
      if (synonymMap[term]) {
        synonymMap[term].forEach(synonym => expandedTerms.add(synonym));
      }
    });

    // Busca e pontua documentos
    const scored = this.fallbackKnowledge.map(doc => {
      const score = this.calculateRelevanceScore(doc.content, Array.from(expandedTerms), normalizedQuery);
      return {
        content: doc.content,
        metadata: { source: doc.source },
        score: score
      };
    });

    // Filtra apenas resultados com score > 0 e ordena por relevância
    const filtered = scored
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    logger.debug(`Busca em memória: ${filtered.length} resultados relevantes de ${queryTerms.join(', ')}`, { module: 'RAGService' });

    return filtered;
  }

  // Normaliza texto removendo acentos e padronizando
  normalizeText(text) {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, ' ') // Remove pontuação
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim();
  }

  // Extrai termos-chave da query
  extractKeyTerms(normalizedText) {
    const stopWords = ['o', 'a', 'e', 'de', 'do', 'da', 'em', 'um', 'uma', 'para', 'com', 'por', 'que', 'se', 'na', 'no', 'como', 'tem', 'ter', 'qual', 'quais', 'quando', 'onde', 'porque', 'por que'];

    return normalizedText
      .split(' ')
      .filter(word => word.length > 2 && !stopWords.includes(word))
      .filter(word => word.length > 0);
  }

  // Calcula score de relevância
  calculateRelevanceScore(content, expandedTerms, originalQuery) {
    const normalizedContent = this.normalizeText(content);
    const contentWords = normalizedContent.split(' ');

    let score = 0;

    // Pontuação por termos encontrados
    expandedTerms.forEach(term => {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      const matches = (normalizedContent.match(regex) || []).length;
      score += matches * 10; // Peso base para termo encontrado
    });

    // Bonus para correspondência exata de frases
    if (originalQuery.length > 10) {
      const queryParts = originalQuery.split(' ').filter(w => w.length > 3);
      queryParts.forEach(part => {
        if (normalizedContent.includes(part)) {
          score += 15; // Bonus para correspondência de frase
        }
      });
    }

    // Bonus para documentos com múltiplos termos
    const termsFound = expandedTerms.filter(term =>
      new RegExp(`\\b${term}\\b`, 'i').test(normalizedContent)
    ).length;

    if (termsFound > 1) {
      score += termsFound * 5; // Bonus por cobertura múltipla
    }

    return score;
  }

  async retrieveContext(query, maxResults = 5) {
    if (!this.isInitialized) {
      throw new Error('RAG Service não está inicializado');
    }

    try {
      logger.debug(`Buscando contexto para: "${query}"`, { module: 'RAGService' });

      let results = [];

      // Tenta busca no Supabase primeiro
      if (this.useSupabase && this.supabaseService.isConnected) {
        try {
          results = await this.supabaseService.search(query, maxResults);
        } catch (supabaseError) {
          logger.warn('Erro no Supabase, usando busca em memória:', supabaseError.message, { module: 'RAGService' });
          this.useSupabase = false;
        }
      }

      // Fallback: busca em memória com sistema aprimorado
      if (!this.useSupabase || results.length === 0) {
        logger.info('Usando busca em memória avançada (fallback)', { module: 'RAGService' });
        results = await this.searchInMemory(query, maxResults);
      }

      // Formata o contexto
      const context = results
        .map(result => `[${result.metadata.source}]: ${result.content}`)
        .join('\n\n');

      logger.debug(`Contexto recuperado: ${results.length} fragmentos (${this.useSupabase ? 'Supabase' : 'Memória'})`, { module: 'RAGService' });

      return context;
    } catch (error) {
      logger.error('Erro ao recuperar contexto:', error, { module: 'RAGService' });
      return '';
    }
  }

  async generateResponse(userMessage, systemInstruction, maxContextResults = 5) {
    if (!this.isInitialized) {
      throw new Error('RAG Service não está inicializado');
    }

    try {
      logger.info('Gerando resposta com RAG...', { module: 'RAGService' });

      // Recupera contexto relevante
      const context = await this.retrieveContext(userMessage, maxContextResults);

      // Gera resposta com contexto
      const response = await this.geminiService.generateWithContext(
        userMessage,
        context,
        systemInstruction
      );

      logger.debug(`[DEBUG RAG] Resposta do Gemini: "${response.text}"`, { module: 'RAGService' });
      logger.info('Resposta gerada com sucesso', { module: 'RAGService' });

      return {
        response: response.text,
        context: context,
        usage: response.usage,
        hasContext: context.length > 0,
      };
    } catch (error) {
      logger.error('Erro ao gerar resposta:', error, { module: 'RAGService' });

      // Fallback: gera resposta sem contexto
      try {
        logger.info('Tentando fallback sem contexto...', { module: 'RAGService' });
        const fallbackResponse = await this.geminiService.generateText(
          userMessage,
          systemInstruction
        );

        logger.debug(`[DEBUG RAG FALLBACK] Resposta do Gemini: "${fallbackResponse.text}"`, { module: 'RAGService' });

        return {
          response: fallbackResponse.text,
          context: '',
          usage: fallbackResponse.usage,
          hasContext: false,
          fallback: true,
        };
      } catch (fallbackError) {
        logger.error('Erro no fallback:', fallbackError, { module: 'RAGService' });
        throw error;
      }
    }
  }

  async searchKnowledge(query, limit = 10) {
    if (!this.isInitialized) {
      return [];
    }

    try {
      let results = [];

      // Tenta busca no Supabase primeiro
      if (this.useSupabase && this.supabaseService.isConnected) {
        try {
          results = await this.supabaseService.search(query, limit);
        } catch (supabaseError) {
          logger.warn('Erro no Supabase para searchKnowledge, usando fallback:', supabaseError.message, { module: 'RAGService' });
          this.useSupabase = false;
        }
      }

      // Fallback: busca em memória com sistema avançado
      if (!this.useSupabase || results.length === 0) {
        logger.info('Usando busca avançada em memória para searchKnowledge', { module: 'RAGService' });
        results = await this.searchInMemory(query, limit);
      }

      return results.map(result => ({
        content: result.content,
        source: result.metadata.source,
        score: result.score,
      }));
    } catch (error) {
      logger.error('Erro ao buscar conhecimento:', error, { module: 'RAGService' });
      return [];
    }
  }

  async getKnowledgeStats() {
    const stats = {
      supabaseConnected: this.supabaseService.isConnected,
      geminiInitialized: this.geminiService.isInitialized,
      documentCount: 0,
      usingFallback: !this.useSupabase,
    };

    if (this.useSupabase && this.supabaseService.isConnected) {
      stats.documentCount = await this.supabaseService.getCount();
    } else {
      stats.documentCount = this.fallbackKnowledge.length;
    }

    return stats;
  }

  async shutdown() {
    logger.info('Desligando RAG Service...', { module: 'RAGService' });

    if (this.supabaseService) {
      await this.supabaseService.disconnect();
    }

    this.isInitialized = false;
    logger.info('RAG Service desligado', { module: 'RAGService' });
  }
}

export default RAGService;