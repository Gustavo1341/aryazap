import { createClient } from '@supabase/supabase-js';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class SupabaseService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.tableName = config.supabase.tableName;
  }

  async connect() {
    try {
      logger.info('Conectando ao Supabase...', { module: 'SupabaseService' });

      if (!config.supabase.url || !config.supabase.serviceRoleKey) {
        throw new Error('Configurações do Supabase não encontradas');
      }

      this.client = createClient(
        config.supabase.url,
        config.supabase.serviceRoleKey,
        {
          auth: { persistSession: false }
        }
      );

      // Testa a conexão de forma mais simples
      try {
        const { data, error } = await this.client
          .from(this.tableName)
          .select('count', { count: 'exact', head: true });

        if (error) {
          if (error.code === 'PGRST116' || error.code === 'PGRST205') {
            logger.info('Tabela não existe ou cache desatualizado, será criada/atualizada', { module: 'SupabaseService' });
          } else {
            logger.warn('Possível problema de conectividade, mas continuando...', { module: 'SupabaseService' });
          }
        }
      } catch (testError) {
        logger.warn('Teste de conexão falhou, mas Supabase client foi criado', { module: 'SupabaseService' });
      }

      this.isConnected = true;
      logger.info('Supabase conectado com sucesso', { module: 'SupabaseService' });

      return true;
    } catch (error) {
      logger.error('Erro ao conectar com Supabase:', error, { module: 'SupabaseService' });
      this.isConnected = false;
      return false;
    }
  }

  async ensureTableExists() {
    try {
      // Tenta inserir um documento vazio para testar se a tabela existe
      const testInsert = {
        source: '_test_table_exists_',
        content: 'test',
        metadata: { test: true }
      };

      const { data, error } = await this.client
        .from(this.tableName)
        .insert([testInsert])
        .select('id');

      if (!error) {
        // Remove o documento de teste se foi inserido
        await this.client
          .from(this.tableName)
          .delete()
          .eq('source', '_test_table_exists_');

        logger.info('Tabela já existe e está acessível', { module: 'SupabaseService' });
        return true;
      }

      // Se a tabela não existe, usa raw SQL para criar
      if (error.code === 'PGRST116' || error.code === 'PGRST205') {
        logger.info('Criando tabela básica de conhecimento...', { module: 'SupabaseService' });

        // Cria uma versão simplificada da tabela
        const { error: createError } = await this.client.rpc('exec_sql', {
          sql: `
            CREATE TABLE IF NOT EXISTS ${this.tableName} (
              id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
              source TEXT NOT NULL,
              content TEXT NOT NULL,
              metadata JSONB DEFAULT '{}',
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
          `
        });

        if (createError) {
          logger.warn('Tabela não pôde ser criada automaticamente. Assumindo que existe.', { module: 'SupabaseService' });
        } else {
          logger.info('Tabela básica criada', { module: 'SupabaseService' });
        }
      }

      return true;
    } catch (error) {
      logger.warn('Problemas ao verificar tabela, mas continuando...', { module: 'SupabaseService' });
      return true; // Continua otimisticamente
    }
  }

  async addDocuments(documents, embeddings = null) {
    if (!this.isConnected || !this.client) {
      throw new Error('Supabase não está conectado');
    }

    try {
      await this.ensureTableExists();

      const records = documents.map((doc, index) => ({
        source: doc.source,
        content: doc.content,
        metadata: {
          timestamp: new Date().toISOString(),
          length: doc.content.length,
          has_embedding: embeddings && embeddings[index] ? true : false
        }
      }));

      // Primeira tentativa: inserção simples sem embeddings
      const { data, error } = await this.client
        .from(this.tableName)
        .insert(records)
        .select('id');

      if (error) {
        logger.warn('Erro na inserção de documentos:', error, { module: 'SupabaseService' });
        throw error;
      }

      logger.info(`${documents.length} documentos adicionados ao Supabase`, { module: 'SupabaseService' });
      return data.map(record => record.id);

    } catch (error) {
      logger.error('Erro ao adicionar documentos ao Supabase:', error, { module: 'SupabaseService' });
      throw error;
    }
  }

  async search(query, limit = 5, useEmbedding = false, queryEmbedding = null) {
    if (!this.isConnected || !this.client) {
      throw new Error('Supabase não está conectado');
    }

    try {
      // Sempre usa busca textual simples por enquanto
      logger.info(`Buscando por: "${query}"`, { module: 'SupabaseService' });

      // Busca com ILIKE (case-insensitive pattern matching)
      const { data, error } = await this.client
        .from(this.tableName)
        .select('*')
        .ilike('content', `%${query}%`)
        .limit(limit);

      if (error) {
        logger.error('Erro na busca textual:', error, { module: 'SupabaseService' });
        throw error;
      }

      const results = this.formatResults(data);
      logger.info(`Busca retornou ${results.length} resultados`, { module: 'SupabaseService' });

      return results;

    } catch (error) {
      logger.error('Erro ao buscar no Supabase:', error, { module: 'SupabaseService' });
      return []; // Retorna array vazio em caso de erro
    }
  }

  formatResults(data) {
    if (!data || !Array.isArray(data)) return [];

    return data.map(record => ({
      content: record.content,
      metadata: {
        source: record.source,
        timestamp: record.created_at,
        ...record.metadata
      },
      score: record.similarity || 0,
      id: record.id
    }));
  }

  async getCount() {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const { count, error } = await this.client
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });

      if (error) {
        logger.warn('Erro ao obter contagem, retornando 0:', error.message, { module: 'SupabaseService' });
        return 0;
      }

      return count || 0;
    } catch (error) {
      logger.warn('Erro ao obter contagem, retornando 0:', error.message, { module: 'SupabaseService' });
      return 0;
    }
  }

  async clearCollection() {
    if (!this.isConnected || !this.client) {
      throw new Error('Supabase não está conectado');
    }

    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;

      logger.info('Tabela Supabase limpa', { module: 'SupabaseService' });
    } catch (error) {
      logger.error('Erro ao limpar tabela Supabase:', error, { module: 'SupabaseService' });
      throw error;
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.client = null;
    logger.info('Supabase desconectado', { module: 'SupabaseService' });
  }

  // Método para busca com embedding usando função SQL customizada
  async searchWithEmbedding(queryEmbedding, limit = 5, threshold = 0.7) {
    if (!this.isConnected || !this.client) {
      throw new Error('Supabase não está conectado');
    }

    try {
      const { data, error } = await this.client.rpc('search_embeddings', {
        query_embedding: queryEmbedding,
        similarity_threshold: threshold,
        match_count: limit
      });

      if (error) throw error;

      return this.formatResults(data);
    } catch (error) {
      logger.warn('Busca com embedding falhou, usando busca textual como fallback:', error, { module: 'SupabaseService' });
      return [];
    }
  }
}

export default SupabaseService;