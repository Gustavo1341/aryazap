import { ChromaClient } from 'chromadb';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.isConnected = false;
  }

  async connect() {
    try {
      logger.info('Conectando ao ChromaDB...', { module: 'ChromaService' });

      this.client = new ChromaClient({
        path: `http://${config.chroma.host}:${config.chroma.port}`,
      });

      // Testa a conexão
      await this.client.heartbeat();

      // Tenta obter ou criar a coleção
      try {
        this.collection = await this.client.getCollection({
          name: config.chroma.collectionName,
        });
        logger.info(`Coleção '${config.chroma.collectionName}' encontrada`, { module: 'ChromaService' });
      } catch (error) {
        // Se a coleção não existe, cria uma nova
        this.collection = await this.client.createCollection({
          name: config.chroma.collectionName,
          metadata: { description: 'Knowledge base for sales agent' },
        });
        logger.info(`Coleção '${config.chroma.collectionName}' criada`, { module: 'ChromaService' });
      }

      this.isConnected = true;
      logger.info('ChromaDB conectado com sucesso', { module: 'ChromaService' });

      return true;
    } catch (error) {
      logger.error('Erro ao conectar com ChromaDB:', error, { module: 'ChromaService' });
      this.isConnected = false;
      return false;
    }
  }

  async addDocuments(documents, embeddings = null) {
    if (!this.isConnected || !this.collection) {
      throw new Error('ChromaDB não está conectado');
    }

    try {
      const ids = documents.map((_, index) => `doc_${Date.now()}_${index}`);
      const texts = documents.map(doc => doc.content);
      const metadatas = documents.map(doc => ({
        source: doc.source,
        timestamp: new Date().toISOString()
      }));

      const addData = {
        ids,
        documents: texts,
        metadatas,
      };

      // Se embeddings foram fornecidos, adiciona eles
      if (embeddings && embeddings.length === documents.length) {
        addData.embeddings = embeddings;
        logger.info('Usando embeddings customizados', { module: 'ChromaService' });
      } else {
        logger.info('ChromaDB gerará embeddings automaticamente', { module: 'ChromaService' });
      }

      await this.collection.add(addData);

      logger.info(`${documents.length} documentos adicionados ao ChromaDB`, { module: 'ChromaService' });
      return ids;
    } catch (error) {
      logger.error('Erro ao adicionar documentos ao ChromaDB:', error, { module: 'ChromaService' });
      throw error;
    }
  }

  async search(query, limit = 5) {
    if (!this.isConnected || !this.collection) {
      throw new Error('ChromaDB não está conectado');
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit,
      });

      const formattedResults = results.documents[0].map((doc, index) => ({
        content: doc,
        metadata: results.metadatas[0][index],
        score: results.distances[0][index],
        id: results.ids[0][index],
      }));

      logger.debug(`Busca retornou ${formattedResults.length} resultados`, { module: 'ChromaService' });
      return formattedResults;
    } catch (error) {
      logger.error('Erro ao buscar no ChromaDB:', error, { module: 'ChromaService' });
      throw error;
    }
  }

  async getCount() {
    if (!this.isConnected || !this.collection) {
      return 0;
    }

    try {
      const count = await this.collection.count();
      return count;
    } catch (error) {
      logger.error('Erro ao obter contagem do ChromaDB:', error, { module: 'ChromaService' });
      return 0;
    }
  }

  async clearCollection() {
    if (!this.isConnected || !this.collection) {
      throw new Error('ChromaDB não está conectado');
    }

    try {
      await this.client.deleteCollection({ name: config.chroma.collectionName });
      this.collection = await this.client.createCollection({
        name: config.chroma.collectionName,
        metadata: { description: 'Knowledge base for sales agent' },
      });

      logger.info('Coleção ChromaDB limpa e recriada', { module: 'ChromaService' });
    } catch (error) {
      logger.error('Erro ao limpar coleção ChromaDB:', error, { module: 'ChromaService' });
      throw error;
    }
  }

  async disconnect() {
    this.isConnected = false;
    this.collection = null;
    this.client = null;
    logger.info('ChromaDB desconectado', { module: 'ChromaService' });
  }
}

export default ChromaService;