// --- START OF FILE fileSystemHandler.js ---

/**
 * fileSystemHandler.js - Gerenciador Centralizado de Operações no Sistema de Arquivos
 * ----------------------------------------------------------------------------------
 * Responsabilidades:
 * - Definir e exportar caminhos de diretórios importantes (configuráveis via ENV).
 * - Garantir a existência desses diretórios na inicialização da aplicação.
 * - Limpar o diretório temporário na inicialização.
 * - Fornecer uma função robusta para remover a pasta de sessão (com retentativas).
 */

import fsPromises from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import logger from "./logger.js"; // Logger centralizado
import { sleep } from "./utils.js"; // Para delays em retentativas
import dotenv from "dotenv";

// Garante acesso a process.env (idealmente, dotenv.config() é chamado no ponto de entrada principal)
dotenv.config();

// --- Constantes de Configuração ---
const SESSION_CLEANUP_MAX_RETRIES = 3; // Máximo de tentativas para remover pasta de sessão
const SESSION_CLEANUP_RETRY_DELAY_MS = 1500; // Delay entre tentativas (ms)

// --- Definição de Caminhos ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determina a raiz do projeto.
// RECOMENDAÇÃO: Para maior robustez em diferentes ambientes de execução (docker, etc.),
// é preferível definir APP_ROOT explicitamente como variável de ambiente.
// O fallback `path.resolve(__dirname, "..")` assume que este arquivo está 1 nível abaixo da raiz.
const PROJECT_ROOT = process.env.APP_ROOT || process.cwd();
logger.info(`[FS Handler] Raiz do projeto definida como: ${PROJECT_ROOT}`);

// Nomes dos diretórios (configuráveis via ENV)
const TEMP_DIR_NAME = process.env.TEMP_DIR_NAME || "temp";
const PROOFS_DIR_NAME = process.env.PROOFS_DIR_NAME || "provasSociais";
const SESSION_DIR_NAME = process.env.SESSION_DIR_NAME || "session";
const TRAINING_DIR_NAME = process.env.TRAINING_DIR_NAME || "training";
const LOGS_DIR_NAME = process.env.LOGS_DIR_NAME || "logs"; // Adicionado diretório de logs

// Caminhos absolutos resolvidos (Exportados para uso em outros módulos)
export const TEMP_DIR = path.resolve(PROJECT_ROOT, TEMP_DIR_NAME);
export const PROOFS_DIR = path.resolve(PROJECT_ROOT, PROOFS_DIR_NAME);
export const SESSION_DIR = path.resolve(PROJECT_ROOT, SESSION_DIR_NAME);
export const TRAINING_DIR = path.resolve(PROJECT_ROOT, TRAINING_DIR_NAME);
export const LOGS_DIR = path.resolve(PROJECT_ROOT, LOGS_DIR_NAME); // Diretório de logs também gerenciado

// Array com todos os diretórios que devem ser criados/verificados na inicialização
// O diretório de logs é criado pelo logger, mas verificamos aqui por segurança.
const DIRS_TO_ENSURE = [TEMP_DIR, PROOFS_DIR, SESSION_DIR, TRAINING_DIR, LOGS_DIR];
const MANAGED_DIR_NAMES = [TEMP_DIR_NAME, PROOFS_DIR_NAME, SESSION_DIR_NAME, TRAINING_DIR_NAME, LOGS_DIR_NAME];

// ================================================================
// ===               FUNÇÕES DE MANIPULAÇÃO DE FS               ===
// ================================================================

/**
 * Garante que os diretórios essenciais da aplicação existam.
 * Cria os diretórios recursivamente se não existirem.
 * Lança um erro fatal se não conseguir criar um diretório essencial.
 * @private // Função interna chamada por initializeFileSystem
 * @throws {Error} Se a criação de um diretório falhar.
 */
async function _ensureDirectoriesExist() {
    logger.debug("[FS Handler] Verificando/Criando diretórios essenciais...");
    try {
        // Cria todos os diretórios em paralelo
        await Promise.all(
            DIRS_TO_ENSURE.map((dirPath) => fsPromises.mkdir(dirPath, { recursive: true }))
        );
        logger.info(
            `[FS Handler] Diretórios base verificados/criados: ${MANAGED_DIR_NAMES.join(", ")}`
        );
    } catch (err) {
        logger.fatal(
            `[FS Handler] Erro CRÍTICO ao criar diretório essencial. Verifique permissões. Path: ${err.path}`,
            err, // Loga o erro completo
            null,
            { errorCode: err.code } // Loga o código do erro (ex: EACCES)
        );
        // Re-lança o erro para interromper a inicialização
        throw new Error(`Falha crítica ao criar diretórios (${err.code || 'N/A'}): ${err.message}`);
    }
}

/**
 * Limpa o conteúdo do diretório temporário de forma segura.
 * Não remove o diretório em si, apenas seu conteúdo (exceto dotfiles).
 * @private // Função interna chamada por initializeFileSystem
 */
async function _cleanTempDirectory() {
    logger.debug(`[FS Handler] Limpando diretório temporário: ${TEMP_DIR_NAME} (${TEMP_DIR})...`);
    let cleanedCount = 0;
    let failedToDelete = 0;
    try {
        const entries = await fsPromises.readdir(TEMP_DIR, { withFileTypes: true });
        await Promise.all(
            entries.map(async (entry) => {
                // Ignora dotfiles (ex: .gitignore)
                if (entry.name.startsWith(".")) {
                    return;
                }
                const entryPath = path.join(TEMP_DIR, entry.name);
                try {
                    // Remove arquivos ou diretórios recursivamente
                    if (entry.isDirectory()) {
                        await fsPromises.rm(entryPath, { recursive: true, force: true });
                    } else {
                        await fsPromises.unlink(entryPath);
                    }
                    cleanedCount++;
                } catch (unlinkErr) {
                    // Ignora erro se o arquivo/dir não existe mais (pode acontecer em escritas concorrentes)
                    if (unlinkErr.code !== "ENOENT") {
                        logger.warn(
                            `[FS Handler] Falha ao limpar item '${entry.name}' da TEMP (${unlinkErr.code}).`,
                            null,
                            { error: unlinkErr.message }
                        );
                        failedToDelete++;
                    }
                }
            })
        );

        if (failedToDelete > 0) {
            logger.warn(
                `[FS Handler] Diretório TEMP limpo (${cleanedCount} itens removidos, ${failedToDelete} falhas).`
            );
        } else {
            logger.info(
                `[FS Handler] Diretório TEMP limpo (${cleanedCount} itens removidos).`
            );
        }
    } catch (readdirErr) {
        // Se o diretório TEMP não existe, não há o que limpar.
        if (readdirErr.code === "ENOENT") {
            logger.info(`[FS Handler] Diretório TEMP (${TEMP_DIR_NAME}) não encontrado para limpeza (será criado).`);
        } else {
            // Outros erros ao ler o diretório são problemáticos.
            logger.error(
                `[FS Handler] Erro ao ler diretório TEMP para limpeza. Verifique permissões.`,
                readdirErr,
                null,
                { errorCode: readdirErr.code }
            );
            // Considerar lançar erro aqui se a limpeza for crítica?
            // throw new Error(`Erro ao limpar TEMP: ${readdirErr.message}`);
        }
    }
}


// ================================================================
// ===                   FUNÇÕES EXPORTADAS                     ===
// ================================================================

/**
 * Função principal de inicialização do sistema de arquivos.
 * Garante a existência dos diretórios e limpa o diretório temporário.
 * Deve ser chamada na inicialização da aplicação.
 * @throws {Error} Se a criação de um diretório essencial falhar.
 */
export async function initializeFileSystem() {
    await _ensureDirectoriesExist();
    await _cleanTempDirectory();
    logger.info("[FS Handler] Sistema de arquivos inicializado.");
}

/**
 * Remove a pasta de sessão do WhatsApp de forma segura e robusta.
 * Tenta múltiplas vezes em caso de erro EBUSY/EPERM (arquivos bloqueados).
 * @param {string} [context="[Cleanup]"] - Contexto para logs (ex: "[Auth Failure]", "[Shutdown]").
 * @returns {Promise<boolean>} True se a pasta foi removida ou não existia, False se falhou após retentativas.
 */
export async function cleanupSessionFolder(context = "[Cleanup]") {
    logger.info(
        `${context} Tentando limpar pasta de sessão (${SESSION_DIR_NAME}). Path: ${SESSION_DIR}`
    );

    for (let attempt = 1; attempt <= SESSION_CLEANUP_MAX_RETRIES; attempt++) {
        try {
            await fsPromises.rm(SESSION_DIR, { recursive: true, force: true });
            logger.info(`${context} Pasta de sessão removida com sucesso (tentativa ${attempt}).`);
            return true; // Sucesso
        } catch (rmErr) {
            if (rmErr.code === "ENOENT") {
                logger.info(`${context} Pasta de sessão não encontrada (considerado sucesso).`);
                return true; // Não existe, sucesso
            } else if (
                (rmErr.code === "EBUSY" || rmErr.code === "EPERM") && // Erros comuns de lock
                attempt < SESSION_CLEANUP_MAX_RETRIES // Se ainda há tentativas
            ) {
                logger.warn(
                    `${context} Erro ${rmErr.code} ao remover pasta sessão (Tentativa ${attempt}/${SESSION_CLEANUP_MAX_RETRIES}). Tentando novamente em ${SESSION_CLEANUP_RETRY_DELAY_MS}ms...`,
                    null, { errorCode: rmErr.code }
                );
                await sleep(SESSION_CLEANUP_RETRY_DELAY_MS); // Aguarda antes de tentar novamente
            } else {
                // Erro final ou erro diferente de lock/não encontrado
                logger.error(
                    `${context} Erro final (${rmErr.code}) ao remover pasta sessão (Tentativa ${attempt}/${SESSION_CLEANUP_MAX_RETRIES}).`,
                    rmErr,
                    null,
                    { errorCode: rmErr.code }
                );
                return false; // Falha definitiva
            }
        }
    }

    // Se chegou aqui, todas as tentativas falharam (provavelmente por EBUSY/EPERM)
    logger.error(
        `${context} FALHA ao remover pasta sessão (${SESSION_DIR_NAME}) após ${SESSION_CLEANUP_MAX_RETRIES} tentativas (provavelmente EBUSY/EPERM).`
    );
    return false; // Falha após retentativas
}

// --- END OF FILE fileSystemHandler.js ---