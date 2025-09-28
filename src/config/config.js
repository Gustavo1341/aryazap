import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

export const config = {
  // Configurações da IA
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.7,
    maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 2048,
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
  },

  // Configurações do Supabase
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    tableName: process.env.SUPABASE_TABLE_NAME || 'sales_knowledge',
  },

  // Configurações do Bot
  bot: {
    firstName: process.env.BOT_FIRST_NAME || 'Pedro',
    companyName: process.env.BOT_COMPANY_NAME || 'DPA - Direito Processual Aplicado',
    position: process.env.BOT_POSITION || 'Especialista',
    targetProductId: process.env.TARGET_PRODUCT_ID || 'PRODUCT_A',
  },

  // Configurações de Suporte
  support: {
    whatsappNumber: process.env.SUPPORT_WHATSAPP_NUMBER || '556199664525',
  },

  // Configurações de Debug
  debug: {
    enabled: process.env.DEBUG_MODE === 'true',
    logLevel: process.env.LOG_LEVEL || 'info',
  },

  // URLs e Links importantes
  links: {
    checkout: 'https://pay.hotmart.com/A44481801Y?off=qvbx78wi&checkoutMode=10&bid=1738260098796',
    socialProofs: {
      cristiane: 'https://www.youtube.com/watch?v=H0LMl6BFPso',
      mariana: 'https://www.youtube.com/watch?v=vykOaYczq5A',
      ernandes: 'https://www.youtube.com/watch?v=kEVOyn4NCZo',
    },
  },
};

// Validação das configurações críticas
export function validateConfig() {
  const errors = [];

  if (!config.gemini.apiKey) {
    errors.push('GEMINI_API_KEY não configurada');
  }

  if (!config.supabase.url) {
    errors.push('SUPABASE_URL não configurada');
  }

  if (!config.supabase.serviceRoleKey) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY não configurada');
  }

  if (errors.length > 0) {
    logger.error('Configuração inválida:', errors);
    return false;
  }

  logger.info('Configuração validada com sucesso');
  return true;
}

export default config;