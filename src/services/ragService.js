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

      // Fallback: busca em memória
      if (!this.useSupabase || results.length === 0) {
        logger.info('Usando busca em memória (fallback)', { module: 'RAGService' });
        const queryLower = query.toLowerCase();

        results = this.fallbackKnowledge
          .filter(doc => doc.content.toLowerCase().includes(queryLower))
          .slice(0, maxResults)
          .map(doc => ({
            content: doc.content,
            metadata: { source: doc.source },
            score: 1.0 // Score fixo para busca textual simples
          }));
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

      // Fallback: busca em memória
      if (!this.useSupabase || results.length === 0) {
        const queryLower = query.toLowerCase();
        const memoryResults = this.fallbackKnowledge
          .filter(doc => doc.content.toLowerCase().includes(queryLower))
          .slice(0, limit);

        results = memoryResults.map(doc => ({
          content: doc.content,
          metadata: { source: doc.source },
          score: 1.0
        }));
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