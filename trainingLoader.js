// --- START OF FILE trainingLoader.js ---

/**
 * trainingLoader.js - Carregador de Dados para Contexto/Treinamento da IA (v. Robusta com PDF.js)
 * =============================================================================================
 * Responsabilidades:
 * 1. Carregar Base de Conhecimento (KB): Ler e processar arquivos .txt, .pdf (via pdfjs-dist),
 * e .json do diretório de treinamento configurado.
 * 2. Carregar Dados do Produto: Consultar o módulo `pricing.js` para obter informações
 * detalhadas sobre o produto principal alvo e seus planos/ofertas ativas.
 * 3. Carregar e Validar Provas Sociais: Verificar a existência de arquivos de mídia
 * (imagem, vídeo, áudio) mencionados no `salesFunnelBluePrint.js`, resolvendo
 * placeholders no nome dos arquivos usando dados do produto carregado. Lista
 * os arquivos disponíveis na pasta de provas sociais.
 *
 * Dependências:
 * - `pdfjs-dist` (instalado via npm/yarn). Não requer binários externos como o poppler.
 * - Módulos internos: `logger`, `pricing`, `salesFunnelBluePrint`, `utils`, `fileSystemHandler`.
 * =============================================================================================
 */

// --- Imports ---
import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import util from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dotenv from "dotenv";
// Importa pdfjs-dist de forma compatível com ES Modules
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { serializeError } from "serialize-error";

// --- Project Imports ---
import logger from "./logger.js";
import pricing from "./pricing.js";
import salesFunnelBluePrint from "./salesFunnelBluePrint.js";
import { parseIntEnv, getFileSizeKB } from "./utils.js";
import { TRAINING_DIR, PROOFS_DIR } from "./fileSystemHandler.js";

dotenv.config();

// --- PDF.js Worker Initialization ---
// Variável global para o status do worker
let pdfWorkerStatus = "pending"; // pending, success, failed

async function initializePdfWorker() {
  logger.debug("[PDF Loader] Iniciando localização do pdf.worker.mjs...");
  try {
    // Estratégia 1: Tentar resolver via node_modules relativo ao CWD
    let workerPath = path.resolve(
      process.cwd(),
      "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    await fsPromises.access(workerPath);
    logger.debug(`[PDF Loader] Worker encontrado via CWD: ${workerPath}`);

    // Configura o worker globalmente
    pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath;
    pdfWorkerStatus = "success";
    logger.info(
      `[PDF Loader] Worker PDF.js inicializado com sucesso: ${workerPath}`
    );
  } catch (errorCwd) {
    logger.debug(
      `[PDF Loader] Worker não encontrado via CWD (${errorCwd.code}). Tentando via __dirname...`
    );
    try {
      // Estratégia 2: Tentar resolver via node_modules relativo a este arquivo (__dirname)
      let workerPathDirname = path.resolve(
        __dirname,
        "../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
      );
      await fsPromises.access(workerPathDirname);
      logger.debug(
        `[PDF Loader] Worker encontrado via __dirname: ${workerPathDirname}`
      );

      pdfjsLib.GlobalWorkerOptions.workerSrc = workerPathDirname;
      pdfWorkerStatus = "success";
      logger.info(
        `[PDF Loader] Worker PDF.js inicializado com sucesso: ${workerPathDirname}`
      );
    } catch (errorDirname) {
      logger.error(
        "[PDF Loader] CRITICAL: Falha ao localizar 'pdf.worker.mjs' em node_modules (via CWD e __dirname). Leitura de PDFs FALHARÁ.",
        errorDirname
      );
      pdfWorkerStatus = "failed";
    }
  }
}

// Inicia a configuração do worker imediatamente ao carregar o módulo
initializePdfWorker();

// Objeto de Configuração Centralizado
const config = {
  maxTrainingFileSizeMB: parseIntEnv(
    process.env.MAX_TRAINING_FILE_SIZE_MB,
    25,
    "MAX_TRAINING_FILE_SIZE_MB"
  ),
  kb: {
    supportedExtensions: [".txt", ".pdf", ".json"],
    ignoredExtensions: [
      ".log", ".bak", ".tmp", ".temp", ".swp", ".DS_Store", "Thumbs.db",
      ".md", ".csv", ".yaml", ".xml", ".html", ".css", ".js", ".ts",
      ".jsx", ".tsx", ".py", ".java", ".sh", ".bat", ".exe", ".dll",
      ".so", ".dmg", ".app", ".zip", ".rar", ".7z", ".tar", ".gz",
      ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".odt",
      ".ods", ".odp",
    ],
  },
  socialProof: {
    supportedExtensions: {
      images: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
      videos: [".mp4", ".avi", ".mov", ".mkv", ".webm", ".3gp"],
      audios: [".mp3", ".ogg", ".opus", ".aac", ".m4a", ".wav", ".amr"],
      // Removido .txt daqui para não conflitar com KB
      texts: [],
    },
  },
  get maxFileSizeBytes() {
    return Math.max(1 * 1024 * 1024, this.maxTrainingFileSizeMB * 1024 * 1024);
  },
};

// Adiciona extensões de prova social à lista de ignorados do KB dinamicamente
config.kb.ignoredExtensions.push(...Object.values(config.socialProof.supportedExtensions).flat());


// ================================================================
// ===           LEITURA E VALIDAÇÃO DE ARQUIVOS                ===
// ================================================================

/**
 * Valida se um arquivo é adequado para leitura (não diretório, não vazio, dentro do limite de tamanho).
 * @param {string} filePath - Caminho completo do arquivo.
 * @param {string} filename - Nome do arquivo (para logs).
 * @returns {Promise<{isValid: boolean, reason: string, sizeKB?: number}>} Resultado da validação.
 */
async function validateFileForReading(filePath, filename) {
  try {
    const stats = await fsPromises.stat(filePath);
    const sizeKB = getFileSizeKB(stats.size); // Usa helper de utils

    if (stats.isDirectory()) {
      return { isValid: false, reason: "directory" };
    }
    if (stats.size === 0) {
      logger.warn(
        `[File Validation] Arquivo '${filename}' está vazio. Pulado.`
      );
      return { isValid: false, reason: "empty", sizeKB: 0 };
    }
    if (stats.size > config.maxFileSizeBytes) {
      logger.warn(
        `[File Validation] Arquivo '${filename}' (${sizeKB}KB) excede limite ${config.maxTrainingFileSizeMB}MB. Pulado.`
      );
      return { isValid: false, reason: "size_limit", sizeKB };
    }
    return { isValid: true, reason: "ok", sizeKB };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { isValid: false, reason: "not_found" };
    }
    logger.error(
      `[File Validation] Erro ao obter status de '${filename}'`,
      error,
      null,
      { path: filePath }
    );
    return {
      isValid: false,
      reason: `stat_error: ${error.code || error.message}`,
    };
  }
}

/**
 * Lê um arquivo de texto (UTF-8), removendo BOM se presente.
 * @param {string} filePath - Caminho completo.
 * @param {string} filename - Nome do arquivo (para logs).
 * @returns {Promise<string>} Conteúdo do arquivo (trimado) ou string vazia em caso de erro.
 */
async function readTextFile(filePath, filename) {
  try {
    let content = await fsPromises.readFile(filePath, "utf-8");
    // Remove BOM (Byte Order Mark) se presente no início do arquivo
    if (content.charCodeAt(0) === 0xfeff) {
      content = content.slice(1);
    }
    return content.trim();
  } catch (error) {
    logger.error(
      `[Reader TXT] Erro ao ler arquivo '${filename}'`,
      error,
      null,
      { path: filePath }
    );
    return "";
  }
}

/**
 * Lê e faz parse de um arquivo JSON (UTF-8), removendo BOM.
 * @param {string} filePath - Caminho completo.
 * @param {string} filename - Nome do arquivo (para logs).
 * @returns {Promise<object|null>} Objeto parseado ou null em caso de erro/conteúdo inválido.
 */
async function readJsonFile(filePath, filename) {
  let fileContent;
  try {
    fileContent = await fsPromises.readFile(filePath, "utf-8");
    if (fileContent.charCodeAt(0) === 0xfeff) {
      // Remove BOM
      fileContent = fileContent.slice(1);
    }
    const trimmedContent = fileContent.trim();
    if (!trimmedContent) {
      logger.warn(
        `[Reader JSON] Arquivo '${filename}' vazio ou contém apenas espaços. Retornando null.`
      );
      return null;
    }
    const jsonObj = JSON.parse(trimmedContent);
    // Garante que o resultado seja um objeto ou array (não primitivos)
    if (jsonObj !== null && typeof jsonObj === "object") {
      return jsonObj;
    } else {
      logger.error(
        `[Reader JSON] Conteúdo de '${filename}' não resultou em um objeto/array JSON válido (Tipo: ${typeof jsonObj}).`
      );
      return null;
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.error(
        `[Reader JSON] Erro de Sintaxe ao fazer parse de '${filename}': ${error.message}`
      );
    } else {
      logger.error(
        `[Reader JSON] Erro ao ler ou fazer parse de '${filename}'`,
        error,
        null,
        { path: filePath }
      );
    }
    return null;
  }
}

/**
 * Extrai o conteúdo textual de um arquivo PDF usando pdfjs-dist.
 * @param {string} filePath - Caminho completo.
 * @param {string} filename - Nome do arquivo (para logs).
 * @returns {Promise<string>} Conteúdo textual extraído (trimado) ou string vazia em caso de erro.
 */
async function readPdfFile(filePath, filename) {
  // Verifica se o worker PDF.js foi inicializado com sucesso
  if (pdfWorkerStatus !== "success") {
    logger.warn(
      `[Reader PDF] Leitura de '${filename}' pulada (Worker PDF ${pdfWorkerStatus}).`
    );
    return "";
  }

  let pdfDocument = null;
  try {
    // Lê o arquivo como buffer
    const dataBuffer = await fsPromises.readFile(filePath);
    // Converte o Buffer do Node para Uint8Array esperado pelo PDF.js
    const typedArray = new Uint8Array(
      dataBuffer.buffer,
      dataBuffer.byteOffset,
      dataBuffer.byteLength
    );

    // Carrega o documento PDF
    pdfDocument = await pdfjsLib.getDocument({ data: typedArray }).promise;
    let fullText = "";
    const numPages = pdfDocument.numPages;
    logger.trace(
      `[Reader PDF] Processando '${filename}' (${numPages} páginas)...`
    );

    // Itera por todas as páginas
    for (let i = 1; i <= numPages; i++) {
      let page = null;
      try {
        page = await pdfDocument.getPage(i);
        const textContent = await page.getTextContent();

        // Extrai texto dos itens, tratando nulos e juntando com espaço
        const pageText = textContent.items
          .map((item) => item?.str || "") // Pega 'str', tratando item nulo
          .join(" ") // Junta itens da página com espaço
          .replace(/\s+/g, " ") // Normaliza múltiplos espaços/newlines
          .trim();

        if (pageText) {
          fullText += pageText + "\n\n"; // Adiciona quebra de parágrafo entre páginas
        }
      } catch (pageError) {
        logger.error(
          `[Reader PDF] Erro ao processar página ${i}/${numPages} de '${filename}'`,
          serializeError(pageError),
          null,
          { path: filePath, page: i }
        );
        // Continua para a próxima página se uma falhar
      } finally {
        // Limpa recursos da página (se o método existir)
        if (page?.cleanup) {
          page.cleanup();
        }
      }
    }
    logger.trace(
      `[Reader PDF] Texto extraído de '${filename}' (${fullText.length} chars).`
    );
    return fullText.trim();
  } catch (error) {
    // Trata erros específicos do PDF.js e outros
    if (
      error.name === "PasswordException" ||
      error.message?.toLowerCase().includes("password")
    ) {
      logger.warn(
        `[Reader PDF] PDF protegido por senha ignorado: '${filename}'`,
        null,
        { path: filePath }
      );
    } else if (
      error.name === "InvalidPDFException" ||
      error.message?.includes("invalid pdf structure")
    ) {
      logger.error(
        `[Reader PDF] Arquivo PDF inválido ou corrompido: '${filename}'`,
        serializeError(error),
        null,
        { path: filePath }
      );
    } else if (error.message?.includes("worker")) {
      logger.error(
        `[Reader PDF] Erro relacionado ao worker PDF.js ao processar '${filename}'. Verifique a inicialização.`,
        serializeError(error),
        null,
        { path: filePath }
      );
    } else if (error.code === "ERR_INVALID_ARG_TYPE") {
      logger.error(
        `[Reader PDF] Erro de tipo de argumento (provavelmente Buffer inválido) ao processar '${filename}'`,
        serializeError(error)
      );
    } else {
      logger.error(
        `[Reader PDF] Erro genérico ao ler/processar PDF '${filename}'`,
        serializeError(error),
        null,
        { path: filePath }
      );
    }
    return ""; // Retorna vazio em caso de erro
  } finally {
    // Garante a limpeza dos recursos do documento principal (se o método existir)
    if (pdfDocument?.destroy) {
      try {
        await pdfDocument.destroy();
      } catch (destroyError) {
        logger.warn(
          `[Reader PDF] Erro menor ao destruir documento PDF '${filename}'`,
          null,
          { error: destroyError.message }
        );
      }
    }
  }
}

// ================================================================
// ===            CARREGAMENTO DA BASE DE CONHECIMENTO (KB)     ===
// ================================================================

/**
 * Processa um único arquivo da base de conhecimento.
 * @param {fs.Dirent} item - O item do diretório.
 * @param {object} result - O objeto de resultado para popular.
 */
async function _processKbFile(item, result) {
  const itemName = item.name;
  const filePath = path.join(TRAINING_DIR, itemName);

  if (!item.isFile() || itemName.startsWith(".")) {
    if (item.isDirectory()) result.stats.skipped_dir++;
    else result.stats.skipped_ignored++;
    return;
  }

  const validation = await validateFileForReading(filePath, itemName);
  if (!validation.isValid) {
    if (validation.reason === "empty") result.stats.skipped_empty++;
    else if (validation.reason === "size_limit") result.stats.skipped_size++;
    else if (validation.reason !== "not_found") result.stats.failed_other++;
    return;
  }

  const ext = path.extname(itemName).toLowerCase();

  if (config.kb.ignoredExtensions.some((ignored) => itemName.toLowerCase().endsWith(ignored))) {
    result.stats.skipped_ignored++;
    return;
  }

  if (config.kb.supportedExtensions.includes(ext)) {
    let content;
    try {
      switch (ext) {
        case ".txt":
          content = await readTextFile(filePath, itemName);
          if (content) {
            result.textSources.push({ filename: itemName, content });
            result.stats.txt++;
            result.stats.processed++;
            result.stats.totalSizeKB += validation.sizeKB || 0;
          } else {
            result.stats.failed_read++;
          }
          break;
        case ".json":
          content = await readJsonFile(filePath, itemName);
          if (content !== null) {
            result.jsonData.push({ filename: itemName, data: content });
            result.stats.json++;
            result.stats.processed++;
            result.stats.totalSizeKB += validation.sizeKB || 0;
          } else {
            result.stats.failed_parse++;
          }
          break;
        case ".pdf":
          if (pdfWorkerStatus !== "success") {
            logger.warn(`[KB Load] PDF ${itemName} pulado (Worker PDF não pronto).`);
            result.stats.skipped_ignored++;
            return;
          }
          content = await readPdfFile(filePath, itemName);
          if (content) {
            result.pdfSources.push({ filename: itemName, content });
            result.stats.pdf++;
            result.stats.processed++;
            result.stats.totalSizeKB += validation.sizeKB || 0;
          } else {
            result.stats.failed_pdf++;
          }
          break;
      }
    } catch (processingError) {
      logger.error(
        `[KB Load] Erro INESPERADO durante processamento do arquivo ${itemName}`,
        serializeError(processingError)
      );
      result.stats.failed_other++;
    }
  } else {
    logger.warn(`[KB Load] Arquivo '${itemName}' pulado (extensão '${ext}' não suportada para KB).`);
    result.stats.skipped_ignored++;
  }
}

/**
 * Carrega e processa arquivos da Base de Conhecimento (KB) do diretório TRAINING_DIR.
 * @returns {Promise<{textSources: Array<{filename: string, content: string}>, pdfSources: Array<{filename: string, content: string}>, jsonData: Array<{filename: string, data: object}>, stats: object}>} Resultados e estatísticas.
 */
async function loadKnowledgeBaseData() {
  const startTime = performance.now();
  logger.info(`[KB Load] Iniciando varredura da Base de Conhecimento em: ${TRAINING_DIR}`);

  const result = {
    textSources: [],
    pdfSources: [],
    jsonData: [],
    stats: {
      total: 0, processed: 0, skipped_dir: 0, skipped_ignored: 0,
      skipped_size: 0, skipped_empty: 0, failed_read: 0, failed_parse: 0,
      failed_pdf: 0, failed_other: 0, txt: 0, pdf: 0, json: 0, totalSizeKB: 0,
    },
  };

  try {
    const items = await fsPromises.readdir(TRAINING_DIR, { withFileTypes: true });
    result.stats.total = items.length;

    if (items.length === 0) {
      logger.info(`[KB Load] Diretório de treinamento (${path.basename(TRAINING_DIR)}) vazio.`);
      return result;
    }
    logger.info(`[KB Load] ${items.length} itens encontrados em ${path.basename(TRAINING_DIR)}. Processando...`);

    await Promise.all(items.map((item) => _processKbFile(item, result)));

    const duration = performance.now() - startTime;
    logger.info(
      `[KB Load] Varredura KB concluída (${duration.toFixed(
        0
      )} ms). Processados: ${result.stats.processed} (Txt:${
        result.stats.txt
      }, Pdf:${result.stats.pdf}, Json:${result.stats.json}). Falhas: ${
        result.stats.failed_read +
        result.stats.failed_parse +
        result.stats.failed_pdf +
        result.stats.failed_other
      }. Skipped: ${
        result.stats.skipped_dir +
        result.stats.skipped_ignored +
        result.stats.skipped_size +
        result.stats.skipped_empty
      }. Size: ${result.stats.totalSizeKB.toFixed(1)} KB`
    );
  } catch (error) {
    if (error.code === "ENOENT") {
      logger.error(
        `[KB Load] CRÍTICO: Diretório de Treinamento NÃO ENCONTRADO: ${TRAINING_DIR}`
      );
    } else {
      logger.error(
        `[KB Load] CRÍTICO: Erro ao acessar diretório de Treinamento ${TRAINING_DIR}`,
        error
      );
    }
    // Reset stats on directory access error
    result.stats = {
      total: 0,
      processed: 0,
      skipped_dir: 0,
      skipped_ignored: 0,
      skipped_size: 0,
      skipped_empty: 0,
      failed_read: 0,
      failed_parse: 0,
      failed_pdf: 0,
      failed_other: 0,
      txt: 0,
      pdf: 0,
      json: 0,
      totalSizeKB: 0,
    };
  }
  return result;
}

// ================================================================
// ===            CARREGAMENTO DOS DADOS DO PRODUTO             ===
// ================================================================

/**
 * Carrega dados de produto e planos de pricing.js para consumo pela IA
 * @param {string} targetProductId - ID do produto a carregar (Geralmente o principal)
 * @returns {object} Dados do produto, planos ativos, etc.
 */
function loadProductDataFromPricing(targetProductId) {
  if (!targetProductId) {
    logger.error(
      `[Training Loader] loadProductDataFromPricing: ID do produto alvo não fornecido.`
    );
    return {}; // Retorna objeto vazio para evitar erros no uso posterior
  }

  try {
    const trimmedProductId = targetProductId.trim(); // Sanitiza ID
    
    // Obter detalhes e planos do produto do pricing.js
    const productDetails = pricing.getActiveProductById(trimmedProductId) || pricing.getProductById(trimmedProductId) || null;
    if (!productDetails) {
      logger.warn(
        `[Training Loader] Produto ${trimmedProductId} não encontrado no pricing.js. Usando dados limitados.`
      );
      return {
        product: {
          id: trimmedProductId,
          name: `Produto ${trimmedProductId}`,
          description: "Descrição não disponível.",
        },
        activePlans: [],
      };
    }

    // Prepara objeto de retorno básico
    const productDetailsForAI = {
      product: {
        id: productDetails.id,
        name: productDetails.name,
        description: productDetails.description,
      },
      activePlans: [],
    };

    // Adiciona planos ativos
    const activePlans = pricing.getActivePlans(trimmedProductId);
    if (activePlans && activePlans.length > 0) {
      productDetailsForAI.activePlans = activePlans.map((plan) => ({
        id: plan.id,
        name: plan.name,
        mainBenefit: plan.mainBenefit, // Benefício principal (crucial)
        priceFormatted: plan.priceFormatted, // "R$ 97/mês"
        priceValue: plan.priceValue, // 97.00
        billingCycle: plan.billingCycle, // "monthly"
        features: plan.features || [],
        isRecommended: plan.isRecommended || false,
        checkoutLink: plan.checkoutLink || null,
      }));
    }

    // Adiciona resumos das ofertas ATIVAS de Upsell/Cross-sell
    const upsellProductDetails =
      pricing.getUpsellProductDetails(trimmedProductId);
    if (upsellProductDetails) {
      // getUpsellProductDetails já verifica se está ativo e tipo correto
      const upsellOffer = upsellProductDetails.plans?.find((p) => p.active); // Pega o primeiro plano ativo do upsell
      if (upsellOffer) {
        productDetailsForAI.upsellOfferSummary = {
          productId: upsellProductDetails.id,
          productName: upsellProductDetails.name,
          planId: upsellOffer.id,
          planName: upsellOffer.name,
          mainBenefit: upsellOffer.mainBenefit, // Crucial
          price: upsellOffer.priceFormatted,
        };
        
        // Adicionar todos os planos do upsell
        productDetailsForAI.upsellPlans = upsellProductDetails.plans
          .filter(p => p.active)
          .map(plan => ({
            id: plan.id,
            name: plan.name,
            mainBenefit: plan.mainBenefit,
            priceFormatted: plan.priceFormatted,
            priceValue: plan.priceValue,
            billingCycle: plan.billingCycle,
            active: plan.active,
            isRecommended: plan.isRecommended || false,
            checkoutLink: plan.checkoutLink || null,
          }));
      }
    }

    const crossSellProductDetails =
      pricing.getCrossSellProductDetails(trimmedProductId);
    if (crossSellProductDetails) {
      // getCrossSellProductDetails já verifica se está ativo e tipo correto
      const crossSellOffer = crossSellProductDetails.plans?.find(
        (p) => p.active
      ); // Pega o primeiro plano ativo do cross-sell
      if (crossSellOffer) {
        productDetailsForAI.crossSellOfferSummary = {
          productId: crossSellProductDetails.id,
          productName: crossSellProductDetails.name,
          planId: crossSellOffer.id,
          planName: crossSellOffer.name,
          mainBenefit: crossSellOffer.mainBenefit, // Crucial
          price: crossSellOffer.priceFormatted,
        };
      }
    }

    // Logging para debug - o que está retornando
    if (!productDetailsForAI.activePlans || productDetailsForAI.activePlans.length === 0) {
      logger.warn(
        `[Training Loader] Produto ${trimmedProductId} não possui PLANOS ATIVOS. IA terá dados limitados.`
      );
    } else {
      logger.debug(
        `[Training Loader] Carregados ${productDetailsForAI.activePlans.length} planos ativos para produto ${trimmedProductId}.`
      );
    }

    return productDetailsForAI;
  } catch (error) {
    logger.error(
      `[Training Loader] Erro ao carregar dados de pricing para produto ${targetProductId}`,
      error
    );
    return {
      product: {
        id: targetProductId,
        name: `Produto ${targetProductId}`,
        description: "Descrição não disponível (erro).",
      },
      activePlans: [],
    };
  }
}

/**
 * Extrai os nomes de arquivos de prova requeridos do salesFunnelBluePrint.
 * @param {object} productContext - O contexto do produto para resolver placeholders.
 * @returns {{requiredFiles: Set<string>, placeholdersUsed: Set<string>}}
 */
function _extractRequiredProofFiles(productContext) {
  const requiredFiles = new Set();
  const placeholdersUsed = new Set();

  const resolveAndGetBaseName = (filenameTemplate) => {
    if (!filenameTemplate || typeof filenameTemplate !== 'string') return null;
    let isPlaceholder = false;
    let resolvedFilename = filenameTemplate.replace(/\{product\.([\w-]+)\}/g, (match, key) => {
      isPlaceholder = true;
      const value = productContext[key];
      if (value !== undefined && value !== null && typeof value === 'string' && value.trim() !== '') {
        return value.replace(/[\\/<>:"|?*&\s]+/g, '_').toLowerCase();
      } else {
        placeholdersUsed.add(match);
        return match;
      }
    });

    if (resolvedFilename.includes('{') || !resolvedFilename.trim()) {
      if (isPlaceholder) logger.trace(`[Proofs Load] Placeholder não resolvido em '${filenameTemplate}'.`);
      return null;
    }
    return path.basename(resolvedFilename.trim()).toLowerCase();
  };

  logger.trace("[Proofs Load] Extraindo nomes de arquivos de prova requeridos do Funnel Blueprint...");
  salesFunnelBluePrint?.steps?.forEach((step) => {
    if (step.mediaAction?.filename) {
      const mediaBaseName = resolveAndGetBaseName(step.mediaAction.filename);
      if (mediaBaseName) {
        requiredFiles.add(mediaBaseName);
        logger.trace(`[Proofs Load] Arquivo requerido (Step ${step.id}): ${mediaBaseName}`);
      } else {
        logger.warn(`[Proofs Load] Não foi possível resolver/validar nome da prova '${step.mediaAction.filename}' na etapa ${step.id}. Verifique placeholders e dados do produto.`);
      }
    }
  });

  return { requiredFiles, placeholdersUsed };
}

// ================================================================
// ===       CARREGAMENTO E VALIDAÇÃO DAS PROVAS SOCIAIS        ===
// ================================================================

/**
 * Carrega e valida arquivos de prova social.
 * @param {object | null} productData - Dados do produto carregado (para resolver placeholders).
 * @returns {Promise<{proofsList: Array<{filePath: string, fileName: string, type: string, caption?: string}>, allRequiredFound: boolean}>} Lista de objetos de prova e status de validação.
 */
async function loadSocialProofAssets(productData) {
  const proofsList = [];
  const requiredFiles = new Set(); // Nomes base (lowercase) requeridos pelo funil
  const placeholdersUsed = new Set();
  const productContext = productData?.product || {}; // Contexto para resolver placeholders

  // 1. Extrair Nomes Requeridos do Funil
  const { requiredFiles: extractedFiles, placeholdersUsed: unresolvedPlaceholders } = _extractRequiredProofFiles(productContext);
  extractedFiles.forEach(file => requiredFiles.add(file));
  unresolvedPlaceholders.forEach(ph => placeholdersUsed.add(ph));

  // Avisa sobre placeholders não resolvidos
  if (placeholdersUsed.size > 0) {
    logger.warn(
      `[Proofs Load] Placeholders NÃO RESOLVIDOS em nomes de prova: ${[
        ...placeholdersUsed,
      ].join(", ")}. Verifique dados do produto.`
    );
  }
  logger.info(
    `[Proofs Load] Pasta de Verificação: ${PROOFS_DIR}. Arquivos Requeridos: ${
      requiredFiles.size > 0 ? [...requiredFiles].join(", ") : "Nenhum"
    }`
  );

  // 2. Listar e Validar Arquivos na Pasta PROOFS_DIR
  const foundRequiredFilesStatus = {};
  requiredFiles.forEach((f) => (foundRequiredFilesStatus[f] = false)); // Inicializa status como não encontrado
  let allRequiredFound = true; // Assume true até que um falte

  try {
    const items = await fsPromises.readdir(PROOFS_DIR, { withFileTypes: true });

    if (items.length === 0) {
      logger.warn(
        `[Proofs Load] Pasta de Provas Sociais (${path.basename(
          PROOFS_DIR
        )}) vazia.`
      );
      if (requiredFiles.size > 0) allRequiredFound = false;
    } else {
      logger.info(
        `[Proofs Load] ${items.length} itens encontrados em ${path.basename(
          PROOFS_DIR
        )}. Validando...`
      );
    }

    for (const item of items) {
      if (!item.isFile() || item.name.startsWith(".")) continue; // Ignora diretórios e dotfiles

      const filename = item.name;
      const fullPath = path.join(PROOFS_DIR, filename);
      const lowerFilename = filename.toLowerCase();
      const normalizedBaseName = path.basename(lowerFilename); // Nome base lowercase para comparação

      try {
        const stats = await fsPromises.stat(fullPath);
        if (stats.size > 100) {
          // Ignora arquivos muito pequenos
          const ext = path.extname(lowerFilename);
          let categorized = false;
          let fileType = null; // MODIFICAÇÃO: Guarda o tipo

          // Categoriza e adiciona à lista como objeto
          if (config.socialProof.supportedExtensions.images.includes(ext)) {
            fileType = 'image';
            categorized = true;
          } else if (config.socialProof.supportedExtensions.videos.includes(ext)) {
            fileType = 'video';
            categorized = true;
          } else if (config.socialProof.supportedExtensions.audios.includes(ext)) {
            fileType = 'audio';
            categorized = true;
          } else if (config.socialProof.supportedExtensions.texts.includes(ext)) { // Adicionado para .txt
            fileType = 'text';
            categorized = true;
          }

          // MODIFICAÇÃO: Adiciona objeto à lista única se categorizado
          if (categorized && fileType) {
            if (fileType === 'text') {
              // Lê o conteúdo do arquivo .txt
              const content = await readTextFile(fullPath, filename);
              if (content) {
                // Assume que o conteúdo do .txt é um link ou uma lista de links
                // Poderia adicionar validação de URL aqui se necessário
                proofsList.push({
                  filePath: fullPath, // Mantém o path para referência, mas o conteúdo é o link
                  fileName: filename,
                  type: fileType,
                  link: content.trim(), // Armazena o link diretamente
                  // caption: `Confira este link!`
                });
              } else {
                logger.warn(`[Proofs Load] Arquivo de texto '${filename}' está vazio ou não pôde ser lido.`);
              }
            } else {
              proofsList.push({
                filePath: fullPath,
                fileName: filename,
                type: fileType,
                // caption: `Veja este ${fileType}!`
              });
            }
          }

          // Marca como encontrado se estava na lista de requeridos
          if (categorized && requiredFiles.has(normalizedBaseName)) {
            foundRequiredFilesStatus[normalizedBaseName] = true;
          }
        } else {
          logger.trace(
            `[Proofs Load] Arquivo '${filename}' ignorado (tamanho ${stats.size} bytes <= 100).`
          );
        }
      } catch (statError) {
        if (statError.code !== "ENOENT")
          logger.error(
            `[Proofs Load] Erro ao obter status de '${filename}'`,
            statError
          );
      }
    } // Fim loop for

    // 3. Verifica se todos os requeridos foram encontrados
    requiredFiles.forEach((reqFile) => {
      if (!foundRequiredFilesStatus[reqFile]) {
        logger.error(
          `[Proofs Load] ERRO CRÍTICO: Prova REQUERIDA "${reqFile}" NÃO encontrada em ${path.basename(
            PROOFS_DIR
          )}!`
        );
        allRequiredFound = false; // Marca falha se algum requerido faltar
      }
    });

    // MODIFICAÇÃO: Log usa proofsList.length
    logger.info(
      `[Proofs Load] Varredura Provas concluída: ${proofsList.length} arquivos válidos encontrados.`
    );
    if (requiredFiles.size > 0) {
      if (allRequiredFound)
        logger.info(
          "[Proofs Load] OK: Todas as provas requeridas pelo funil foram encontradas."
        );
      else
        logger.error(
          "[Proofs Load] FALHA: Nem todas as provas requeridas foram encontradas!"
        );
    } else {
      logger.info(
        "[Proofs Load] Nenhuma prova social explicitamente requerida pelo funil."
      );
      allRequiredFound = true; // Considera sucesso se nada era requerido
    }
  } catch (error) {
    // ... (catch externo mantido como antes) ...
    // Este catch agora também pegaria o erro do readdir, se lançado
    if (error.code === "ENOENT") {
       logger.error(`[Proofs Load] CRÍTICO: Diretório Provas Sociais NÃO ENCONTRADO: ${PROOFS_DIR}`);
    } else {
       logger.error("[Proofs Load] CRÍTICO: Erro ao ler diretório Provas Sociais", error);
    }
    allRequiredFound = false;
  }

  return { proofsList, allRequiredFound };
}

// ================================================================
// ===                ORQUESTRADOR PRINCIPAL                    ===
// ================================================================

/** Cache para os dados carregados. */
export let trainingDataCache = {
  productInfo: null,
  generalKnowledge: {
    stats: {},
    textSources: [],
    pdfSources: [],
    jsonData: [],
  },
  // MODIFICAÇÃO: Renomeado para socialProofs e tipo alterado
  socialProofs: [], // Será Array<{filePath: string, fileName: string, type: string}>
  allRequiredProofsFound: false,
  isLoaded: false,
};

/**
 * Carrega todos os dados de treinamento (KB, Produto, Provas) e armazena em cache.
 * @param {string} targetProductId - ID do produto principal definido em botConfig.
 * @returns {Promise<object>} O objeto `trainingDataCache` atualizado.
 * @throws {Error} Se o carregamento do produto principal falhar.
 */
export async function loadAllTrainingData(targetProductId) {
  logger.info(
    "[Training Load All] Iniciando carregamento GERAL de dados de contexto..."
  );
  const overallStartTime = performance.now();
  let productInfo = null;
  let generalKnowledge = {
    stats: {},
    textSources: [],
    pdfSources: [],
    jsonData: [],
  };
  // MODIFICAÇÃO: Variável local para receber a lista
  let socialProofsList = [];
  let allRequiredProofsFound = false; // Assume false inicialmente
  let isLoadedOverall = false;

  // 1. Carregar Dados do Produto (CRÍTICO)
  if (targetProductId) {
    productInfo = await loadProductDataFromPricing(targetProductId);
    if (!productInfo) {
      // Se o produto principal não puder ser carregado, é um erro fatal para o funil.
      const errorMsg = `[Training Load All] FALHA CRÍTICA ao carregar dados do produto principal alvo "${targetProductId}". Verifique ID e pricing.js.`;
      logger.fatal(errorMsg);
      // Atualiza cache com falha e lança erro para parar inicialização
      trainingDataCache = {
        ...trainingDataCache,
        productInfo: null,
        isLoaded: false,
      };
      throw new Error(errorMsg);
    }
  } else {
    const errorMsg =
      "[Training Load All] CRÍTICO: TARGET_PRODUCT_ID não fornecido. Impossível carregar dados de contexto.";
    logger.fatal(errorMsg);
    trainingDataCache = {
      ...trainingDataCache,
      productInfo: null,
      isLoaded: false,
    };
    throw new Error(errorMsg);
  }

  // 2. Carregar KB e Provas Sociais (em paralelo)
  try {
    logger.info(
      "[Training Load All] Carregando Base de Conhecimento e Provas Sociais..."
    );
    // Passa productInfo para que loadSocialProofAssets possa resolver placeholders
    const [kbResult, proofResult] = await Promise.all([
      loadKnowledgeBaseData(),
      loadSocialProofAssets(productInfo),
    ]);
    generalKnowledge = kbResult || generalKnowledge; // Mantém default se falhar

    // MODIFICAÇÃO: Pega a lista e o status do proofResult
    socialProofsList = proofResult?.proofsList || [];
    allRequiredProofsFound = proofResult?.allRequiredFound ?? false;

  } catch (concurrentLoadError) {
    // Erro GERAL ao carregar KB/Provas - não fatal, mas loga
    logger.error(
      "[Training Load All] Erro durante carregamento concorrente de KB/Provas.",
      serializeError(concurrentLoadError)
    );
    allRequiredProofsFound = false; // Assume que provas podem ter falhado
  }

  // Determina status final
  const kbLoadedOk = generalKnowledge?.stats?.processed > 0;
  // MODIFICAÇÃO: Verifica socialProofsList.length
  const proofsLoadedOk = socialProofsList.length > 0;
  // Considera carregado se produto OU KB OU provas foram carregados
  isLoadedOverall = !!productInfo || kbLoadedOk || proofsLoadedOk;

  const overallDuration = performance.now() - overallStartTime;
  const finalStatus = isLoadedOverall
    ? allRequiredProofsFound
      ? "Dados Carregados OK"
      : "Dados Carregados (PROVAS REQUERIDAS FALTANDO!)"
    : "FALHA GERAL CARREGAR DADOS"; // Indica falha se nem produto carregou

  logger.info(
    `[Training Load All] Carregamento GERAL concluído (${overallDuration.toFixed(
      0
    )} ms). Status: ${finalStatus}`,
    null,
    {
      productLoaded: !!productInfo,
      productName:
        productInfo?.product?.name || (targetProductId ? "FALHA" : "N/A"),
      kbFilesProcessed: generalKnowledge?.stats?.processed || 0,
      kbTotalSizeKB: generalKnowledge?.stats?.totalSizeKB?.toFixed(1) || 0,
      // MODIFICAÇÃO: Log usa socialProofsList.length
      proofsLoadedCount: socialProofsList.length,
      allRequiredProofsFound: allRequiredProofsFound,
      overallSuccess: isLoadedOverall,
    }
  );

  // Atualiza o cache exportado
  trainingDataCache = {
    productInfo,
    generalKnowledge,
    // MODIFICAÇÃO: Atribui a lista correta ao campo esperado pelo handler
    socialProofs: socialProofsList,
    allRequiredProofsFound,
    isLoaded: isLoadedOverall,
  };

  return trainingDataCache; // Retorna os dados carregados
}

// --- END OF FILE trainingLoader.js ---