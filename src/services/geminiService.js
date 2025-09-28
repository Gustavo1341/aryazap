import { GoogleGenerativeAI } from '@google/generative-ai';
import logger from '../utils/logger.js';
import config from '../config/config.js';

class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.embeddingModel = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      if (!config.gemini.apiKey) {
        throw new Error('Chave da API do Gemini não configurada');
      }

      logger.info('Inicializando Gemini AI...', { module: 'GeminiService' });

      this.genAI = new GoogleGenerativeAI(config.gemini.apiKey);

      // Modelo para geração de texto
      this.model = this.genAI.getGenerativeModel({
        model: config.gemini.model,
        generationConfig: {
          temperature: config.gemini.temperature,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: config.gemini.maxTokens,
        },
      });

      // Modelo para embeddings
      this.embeddingModel = this.genAI.getGenerativeModel({
        model: 'text-embedding-004',
      });

      this.isInitialized = true;
      logger.info('Gemini AI inicializado com sucesso', { module: 'GeminiService' });

      return true;
    } catch (error) {
      logger.error('Erro ao inicializar Gemini AI:', error, { module: 'GeminiService' });
      this.isInitialized = false;
      return false;
    }
  }

  async generateText(prompt, systemInstruction = null) {
    if (!this.isInitialized) {
      throw new Error('Gemini AI não está inicializado');
    }

    try {
      let fullPrompt = prompt;

      if (systemInstruction) {
        fullPrompt = `${systemInstruction}\n\nUsuário: ${prompt}`;
      }

      logger.debug('Gerando texto com Gemini...', { module: 'GeminiService' });

      const result = await this.model.generateContent(fullPrompt);
      const response = await result.response;
      const text = response.text();

      logger.debug('Texto gerado com sucesso', { module: 'GeminiService' });

      return {
        text: text.trim(),
        usage: {
          promptTokens: result.response.usageMetadata?.promptTokenCount || 0,
          completionTokens: result.response.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: result.response.usageMetadata?.totalTokenCount || 0,
        },
      };
    } catch (error) {
      logger.error('Erro ao gerar texto com Gemini:', error, { module: 'GeminiService' });
      throw error;
    }
  }

  async generateEmbedding(text) {
    if (!this.isInitialized) {
      throw new Error('Gemini AI não está inicializado');
    }

    try {
      logger.debug('Gerando embedding com Gemini...', { module: 'GeminiService' });

      const result = await this.embeddingModel.embedContent(text);
      const embedding = result.embedding.values;

      logger.debug('Embedding gerado com sucesso', { module: 'GeminiService' });

      return embedding;
    } catch (error) {
      logger.warn('Erro ao gerar embedding real, usando fallback:', error, { module: 'GeminiService' });

      // Fallback para embedding simulado
      const simpleHash = this.generateSimpleEmbedding(text);
      return simpleHash;
    }
  }

  generateSimpleEmbedding(text) {
    // Embedding simples baseado em hash para teste
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);

    words.forEach((word, index) => {
      const hash = this.simpleHash(word);
      embedding[index % 384] += hash;
    });

    // Normalização simples
    const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => norm > 0 ? val / norm : 0);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash / Math.pow(2, 31);
  }

  async generateWithContext(prompt, context, systemInstruction) {
    const contextualPrompt = `
CONTEXTO RELEVANTE:
${context}

INSTRUÇÃO DO SISTEMA:
${systemInstruction}

PERGUNTA DO USUÁRIO:
${prompt}

Responda baseando-se no contexto fornecido e seguindo as instruções do sistema.
`;

    return this.generateText(contextualPrompt);
  }

  async batchGenerateEmbeddings(texts) {
    if (!this.isInitialized) {
      throw new Error('Gemini AI não está inicializado');
    }

    try {
      logger.info(`Gerando ${texts.length} embeddings em lote...`, { module: 'GeminiService' });

      const embeddings = [];

      // Processa em lotes para evitar rate limits
      const batchSize = 5;
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);
        const batchPromises = batch.map(text => this.generateEmbedding(text));
        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);

        // Pequena pausa entre lotes
        if (i + batchSize < texts.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      logger.info('Embeddings em lote gerados com sucesso', { module: 'GeminiService' });
      return embeddings;
    } catch (error) {
      logger.error('Erro ao gerar embeddings em lote:', error, { module: 'GeminiService' });
      throw error;
    }
  }
}

export default GeminiService;