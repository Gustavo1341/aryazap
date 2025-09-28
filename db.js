/**
 * db.js - Serviço de Conexão com Banco de Dados PostgreSQL (v. Robusta)
 * ------------------------------------------------------------------------------
 * Gerencia o pool de conexões com o banco de dados PostgreSQL usando 'node-postgres' (pg).
 * Fornece funções para inicializar, fechar, executar queries e transações.
 * Configuração lida das variáveis de ambiente.
 */

import pg from 'pg';
import crypto from 'node:crypto'; // Para gerar IDs únicos em logs
import logger from './logger.js'; // Logger centralizado
import { parseIntEnv } from './utils.js'; // Para parse de ENV numérico

const { Pool } = pg;

// --- Configuração do Banco de Dados ---
// Lida das variáveis de ambiente (.env / docker-compose.yml / etc.)
const dbConfig = {
    user: process.env.DB_USER || "smartzapuser",
    host: process.env.DB_HOST || "db", // Nome do serviço docker-compose é comum
    database: process.env.DB_NAME || "smartzapdb",
    password: process.env.DB_PASSWORD, // SENHA OBRIGATÓRIA via ENV
    port: parseIntEnv(process.env.DB_PORT, 5432, 'DB_PORT'),
    // Configurações do Pool (importantes para performance e resiliência)
    max: parseIntEnv(process.env.DB_POOL_MAX_CLIENTS, 10, 'DB_POOL_MAX_CLIENTS'), // Max conexões simultâneas
    idleTimeoutMillis: parseIntEnv(process.env.DB_POOL_IDLE_TIMEOUT_MS, 30000, 'DB_POOL_IDLE_TIMEOUT_MS'), // Fecha conexões ociosas
    connectionTimeoutMillis: parseIntEnv(process.env.DB_POOL_CONN_TIMEOUT_MS, 5000, 'DB_POOL_CONN_TIMEOUT_MS'), // Timeout para obter conexão
    // statement_timeout: parseIntEnv(process.env.DB_STATEMENT_TIMEOUT_MS, 10000), // Opcional: Timeout por statement
    // query_timeout: parseIntEnv(process.env.DB_QUERY_TIMEOUT_MS, 15000),      // Opcional: Timeout geral da query

    // --- Configuração SSL ---
    // IMPORTANTE: Ajuste conforme a necessidade do seu ambiente de produção.
    // 'require' é comum, mas pode precisar de CAs específicos.
    // Veja: https://node-postgres.com/features/ssl
    ssl: process.env.DB_SSL_MODE === 'require'
        ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } // Default true se DB_SSL_MODE=require
        : (process.env.DB_SSL_MODE === 'prefer' ? { rejectUnauthorized: false } : false) // 'prefer' ou 'false' (ou omitido) desativa ou torna opcional
};

// --- Validação Crítica da Configuração ---
if (!dbConfig.password) {
    logger.fatal("[DB Config] ERRO CRÍTICO: DB_PASSWORD não está definida nas variáveis de ambiente! A aplicação não pode iniciar.");
    // Lançar erro impede a inicialização do módulo e, consequentemente, da aplicação.
    throw new Error("DB_PASSWORD environment variable is not set.");
}
if (dbConfig.ssl && dbConfig.ssl.rejectUnauthorized === false) {
     logger.warn("[DB Config] SSL Habilitado com rejectUnauthorized=false. Conexão vulnerável a MITM. Use apenas em ambientes controlados ou com outras garantias.");
}

logger.info(`[DB Config] Carregada: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database} (User: ${dbConfig.user}, SSL: ${dbConfig.ssl ? JSON.stringify(dbConfig.ssl) : 'false'})`);

// --- Estado Interno ---
/** @type {pg.Pool | null} */
let pool = null;
let isInitializing = false;
let isClosing = false;

// ================================================================
// ===               INICIALIZAÇÃO E GERENCIAMENTO DO POOL      ===
// ================================================================

/**
 * Ponto de extensão para inicialização/migração do schema do banco de dados.
 * **IMPORTANTE:** Esta é uma implementação placeholder. Em um ambiente real,
 * substitua esta lógica pela execução de uma ferramenta de migração dedicada
 * (como node-pg-migrate, Flyway, Liquibase, ou migrations de ORM).
 * Usar `CREATE TABLE IF NOT EXISTS` não gerencia alterações de schema (adição/remoção
 * de colunas, constraints, etc.) de forma robusta ao longo do tempo.
 *
 * @param {pg.PoolClient} client - Cliente conectado para executar as queries de migração/setup.
 * @throws {Error} Se a inicialização/migração do schema falhar.
 */
async function runSchemaInitializationOrMigration(client) {
    logger.info("[DB Schema] Verificando/Executando inicialização/migração do schema...");

    // --- INÍCIO DO PLACEHOLDER - SUBSTITUA PELA SUA FERRAMENTA DE MIGRAÇÃO ---
    // Exemplo: Usando node-pg-migrate (requer instalação e configuração)
    /*
    try {
        const migrate = require('node-pg-migrate').default; // Exemplo
        await migrate({
            dbClient: client, // Passa o cliente conectado
            direction: 'up',
            migrationsTable: 'pgmigrations', // Nome da tabela de controle
            dir: 'migrations', // Pasta com os arquivos de migração SQL ou JS
            log: (msg) => logger.info(`[DB Migrate] ${msg}`), // Usa o logger da aplicação
            checkOrder: true, // Garante ordem de execução
        });
        logger.info("[DB Schema] Migrações executadas com sucesso.");
    } catch (migrationError) {
        logger.fatal("[DB Schema] FALHA CRÍTICA na execução das migrações!", migrationError);
        throw migrationError; // Re-lança para interromper a inicialização
    }
    */

    // --- Exemplo Alternativo MÍNIMO (NÃO RECOMENDADO PARA PRODUÇÃO) ---
    // Apenas cria tabelas básicas se não existirem. NÃO GERENCIA ALTERAÇÕES.
    try {
        // Verifica se a tabela existe e se tem a constraint correta
        const tableExists = await client.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'chat_states'
            );
        `);
        
        if (tableExists.rows[0].exists) {
            // Verifica se a PRIMARY KEY está correta
            const pkCheck = await client.query(`
                SELECT COUNT(*) as count
                FROM pg_index i 
                JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) 
                WHERE i.indrelid = 'chat_states'::regclass AND i.indisprimary
            `);
            
            // Se não tem 2 colunas na PK, precisa recriar
            if (parseInt(pkCheck.rows[0].count) !== 2) {
                logger.info('[DB Schema] Tabela chat_states existe mas com constraint incorreta. Recriando...');
                await client.query('DROP TABLE IF EXISTS chat_states');
            }
        }
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_states (
                chat_id VARCHAR(255),
                tenant_id VARCHAR(100),
                state_data JSONB NOT NULL,
                last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (chat_id, tenant_id)
            );
        `);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_states_tenant ON chat_states(tenant_id);`); // Exemplo de índice

        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_history (
                message_id BIGSERIAL PRIMARY KEY, -- Usar BIGSERIAL para IDs maiores
                chat_id VARCHAR(255) NOT NULL,   -- Idealmente FK para chat_states(chat_id) com ON DELETE CASCADE/SET NULL
                tenant_id VARCHAR(100),
                role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant', 'system', 'tts', 'action')),
                content TEXT NOT NULL,
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                metadata JSONB
            );
        `);
         await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_chat_time ON chat_history(chat_id, timestamp DESC);`);
         await client.query(`CREATE INDEX IF NOT EXISTS idx_chat_history_tenant_chat ON chat_history(tenant_id, chat_id);`);

        logger.info("[DB Schema] PLACEHOLDER: Tabelas básicas verificadas/criadas (use migrações!).");
    } catch (schemaError) {
        logger.fatal("[DB Schema] FALHA CRÍTICA no placeholder de criação de tabelas!", schemaError);
        throw schemaError;
    }
    // --- FIM DO PLACEHOLDER ---
}

/**
 * Inicializa o pool de conexões PostgreSQL, testa a conexão e roda inicialização/migração do schema.
 * Lança um erro fatal se a inicialização falhar.
 * Evita execuções concorrentes.
 * @throws {Error} Se a inicialização do pool, conexão inicial ou schema falharem.
 */
async function initialize() {
    if (pool) {
        logger.debug("[DB Init] Pool já inicializado.");
        return;
    }
    if (isInitializing) {
        logger.warn("[DB Init] Inicialização já em progresso. Aguardando...");
        // Opcional: Implementar uma fila ou promise para aguardar a conclusão
        // Por simplicidade, apenas retornamos para evitar concorrência.
        return;
    }
    if (isClosing) {
        logger.error("[DB Init] Tentativa de inicializar enquanto o pool está fechando.");
        throw new Error("Cannot initialize DB pool while it is closing.");
    }

    isInitializing = true;
    logger.info("[DB Init] Inicializando pool de conexões PostgreSQL...");
    logger.debug(`[DB Init] Config: host=${dbConfig.host}, port=${dbConfig.port}, db=${dbConfig.database}, user=${dbConfig.user}, maxClients=${dbConfig.max}, idleTimeout=${dbConfig.idleTimeoutMillis}ms, connTimeout=${dbConfig.connectionTimeoutMillis}ms`);

    try {
        pool = new Pool(dbConfig);

        // Listener para erros GERAIS do pool (conexões ociosas, etc.)
        pool.on('error', (err, client) => {
            const errorId = crypto.randomUUID ? crypto.randomUUID() : `err-${Date.now()}`;
            logger.error(
                `[DB Pool Error] Erro inesperado no pool (ID: ${errorId}). Cliente ocioso pode ter sido desconectado. Verifique a rede/DB.`,
                err,
                null, // Sem chatId específico para erros de pool
                {
                    errorId: errorId,
                    clientInfo: client ? `Client PID: ${client.processID}, DB: ${client.database}` : 'N/A',
                    pgErrorCode: err.code, // Adiciona código de erro PG se disponível
                }
            );
            // NÃO encerrar a aplicação aqui; o pool tentará se recuperar. Monitorar esses erros é crucial.
        });

        // Testa a conexão imediatamente pegando um cliente
        logger.debug("[DB Init] Testando conexão com o banco de dados...");
        const client = await pool.connect(); // Pode lançar erro se a conexão falhar
        logger.info(`[DB Init] Conexão de teste com PostgreSQL (${dbConfig.host}:${dbConfig.port}) realizada com sucesso!`);

        try {
            // Verifica a versão do PostgreSQL
            const versionRes = await client.query('SELECT version();');
            const pgVersion = versionRes?.rows?.[0]?.version || 'N/A';
            logger.info(`[DB Init] Versão PostgreSQL: ${pgVersion.includes(' ') ? pgVersion.split(' ')[1] : pgVersion}`);

            // === Executa Inicialização/Migração do Schema ===
            await runSchemaInitializationOrMigration(client);

        } finally {
            // Libera o cliente de teste de volta para o pool, SEMPRE
            client.release();
            logger.debug("[DB Init] Cliente de teste liberado.");
        }

        logger.info(`[DB Init] Pool PostgreSQL inicializado e pronto para ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);

    } catch (error) {
        logger.fatal(
            "[DB Init] FALHA CRÍTICA ao inicializar/conectar/migrar banco de dados!",
            error,
            null,
            {
                config: { /* Omitido password intencionalmente */
                    host: dbConfig.host, port: dbConfig.port, user: dbConfig.user,
                    database: dbConfig.database, maxClients: dbConfig.max,
                    connTimeout: dbConfig.connectionTimeoutMillis, ssl: dbConfig.ssl
                },
                errorMessage: error.message,
                errorCode: error.code, // Ex: 'ECONNREFUSED', 'ENOTFOUND', '28P01' (auth failure)
            }
        );
        // Limpa o pool em caso de falha na inicialização
        if (pool) {
            try { await pool.end(); } catch (endErr) { /* ignore */ }
            pool = null;
        }
        // Re-lança o erro para interromper a inicialização da aplicação
        throw error;
    } finally {
        isInitializing = false; // Libera a flag de inicialização
    }
}

/**
 * Fecha o pool de conexões de forma graciosa.
 * @returns {Promise<void>} Resolve quando o fechamento for concluído.
 */
async function close() {
    if (!pool) {
        logger.debug("[DB Close] Pool não inicializado ou já fechado.");
        return;
    }
    if (isClosing) {
        logger.warn("[DB Close] Fechamento já em progresso.");
        return;
    }
    if (isInitializing) {
        logger.error("[DB Close] Tentativa de fechar enquanto o pool está inicializando. Abortando fechamento.");
        // Não deve fechar um pool que está no meio da inicialização.
        return;
    }

    isClosing = true;
    logger.info("[DB Close] Fechando pool de conexões PostgreSQL...");
    try {
        await pool.end(); // Espera todos os clientes serem liberados e o pool fechar
        logger.info("[DB Close] Pool de conexões fechado com sucesso.");
    } catch (error) {
        logger.error("[DB Close] Erro ao fechar pool de conexões.", error);
        // Mesmo com erro, o pool pode estar parcialmente fechado.
    } finally {
        pool = null; // Limpa a referência
        isClosing = false; // Libera a flag
    }
}

// ================================================================
// ===                   EXECUÇÃO DE QUERIES E TRANSAÇÕES       ===
// ================================================================

/**
 * Executa uma query SQL no banco de dados usando um cliente do pool.
 * @template T Tipo esperado para as linhas do resultado (opcional).
 * @param {string} text - O texto da query SQL (ex: 'SELECT * FROM users WHERE id = $1'). Usar placeholders ($1, $2...) é crucial para segurança (prevenção de SQL Injection).
 * @param {Array<any>} [params=[]] - Array de parâmetros para a query.
 * @returns {Promise<pg.QueryResult<T>>} O resultado da query (inclui rows, rowCount, etc.).
 * @throws {Error} Se o pool não estiver inicializado, ou durante a query.
 */
async function query(text, params = []) {
    if (!pool || !dbService.isReady()) { // Usa isReady() para checar estado completo
        const stateMsg = !pool ? "não inicializado" : (isInitializing ? "inicializando" : "fechando");
        logger.error(`[DB Query] ERRO CRÍTICO: Pool ${stateMsg}. Impossível executar query.`);
        throw new Error(`Database pool is not ready (state: ${stateMsg}).`);
    }

    const startTime = performance.now();
    /** @type {pg.PoolClient | null} */
    let client = null;

    try {
        client = await pool.connect(); // Pega um cliente do pool
        const res = await client.query(text, params);
        const duration = performance.now() - startTime;

        logger.trace('[DB Query OK]', null, {
            duration: `${duration.toFixed(1)}ms`,
            query_start: text.substring(0, 80).replace(/\s+/g, ' ') + (text.length > 80 ? '...' : ''),
            params_count: params.length,
            rows_returned: res.rowCount ?? 0
        });
        return res;

    } catch (error) {
        const duration = performance.now() - startTime;
        const errorDetails = {
            duration: `${duration.toFixed(1)}ms`,
            query: text, // Logar query no erro ajuda na depuração
            pg_error_code: error.code,
            pg_error_message: error.message, // Mensagem principal do erro PG
            pg_error_detail: error.detail,
            pg_error_hint: error.hint,
            pg_error_position: error.position,
            pg_error_schema: error.schema,
            pg_error_table: error.table,
            pg_error_constraint: error.constraint,
        };
        // Logar parâmetros apenas em dev ou se explicitamente permitido
        if (process.env.NODE_ENV !== 'production' || process.env.LOG_QUERY_PARAMS_ON_ERROR === 'true') {
             // !! CUIDADO: Logar parâmetros em produção pode expor dados sensíveis !!
            errorDetails.params = params;
        } else {
            errorDetails.params_count = params.length; // Loga apenas a contagem em prod
        }

        logger.error("[DB Query FAIL]", error, null, errorDetails);
        throw error; // Re-lança para a camada superior

    } finally {
        if (client) {
            client.release(); // SEMPRE libera o cliente de volta ao pool
        }
    }
}

/**
 * Executa uma série de operações dentro de uma transação PostgreSQL.
 * Garante COMMIT em caso de sucesso e ROLLBACK em caso de erro.
 *
 * @template T Tipo de retorno esperado da função de callback da transação.
 * @param {(client: pg.PoolClient) => Promise<T>} transactionCallback - Função assíncrona que recebe o cliente conectado
 * e deve executar todas as operações da transação. Deve retornar um valor ou lançar um erro.
 * @returns {Promise<T>} O resultado retornado pela `transactionCallback`.
 * @throws {Error} Se o pool não estiver pronto, ou ocorrer erro ao obter cliente, iniciar/commitar/rollback a transação, ou dentro do callback.
 */
async function executeTransaction(transactionCallback) {
    if (!pool || !dbService.isReady()) {
        const stateMsg = !pool ? "não inicializado" : (isInitializing ? "inicializando" : "fechando");
        logger.error(`[DB Transaction] ERRO CRÍTICO: Pool ${stateMsg}. Impossível iniciar transação.`);
        throw new Error(`Database pool is not ready (state: ${stateMsg}).`);
    }

    /** @type {pg.PoolClient | null} */
    let client = null;
    logger.debug("[DB Transaction] Iniciando transação...");

    try {
        client = await pool.connect(); // Obtém cliente para a transação
        await client.query('BEGIN'); // Inicia a transação

        try {
            // Executa o código da aplicação que usa o cliente dentro da transação
            const result = await transactionCallback(client);

            await client.query('COMMIT'); // Tenta commitar se o callback foi bem-sucedido
            logger.debug("[DB Transaction] COMMIT realizado com sucesso.");
            return result; // Retorna o resultado do callback

        } catch (callbackError) {
            // Se ocorrer erro DENTRO do callback da aplicação
            logger.error("[DB Transaction] Erro DENTRO do callback da transação. Executando ROLLBACK.", callbackError);
            await client.query('ROLLBACK'); // Tenta reverter
            logger.warn("[DB Transaction] ROLLBACK realizado devido a erro no callback.");
            throw callbackError; // Re-lança o erro original do callback
        }

    } catch (transactionError) {
        // Se ocorrer erro ao obter cliente, BEGIN, COMMIT ou ROLLBACK
        logger.error("[DB Transaction] Erro na GERÊNCIA da transação (BEGIN/COMMIT/ROLLBACK).", transactionError);
        if (client) {
            // Tenta fazer rollback se o erro não foi no próprio rollback e o cliente existe
            try {
                logger.warn("[DB Transaction] Tentando ROLLBACK adicional devido a erro de gerência...");
                await client.query('ROLLBACK');
                logger.warn("[DB Transaction] ROLLBACK adicional realizado.");
            } catch (rollbackError) {
                logger.error("[DB Transaction] FALHA ao executar ROLLBACK adicional após erro de gerência!", rollbackError);
                // Não há muito mais a fazer aqui, o estado pode ser inconsistente.
            }
        }
        throw transactionError; // Re-lança o erro da gerência da transação

    } finally {
        if (client) {
            client.release(true); // Libera o cliente. O 'true' força a remoção em caso de erro grave no cliente.
            logger.debug("[DB Transaction] Cliente da transação liberado.");
        }
    }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

// Exporta um objeto contendo as funções como a exportação PADRÃO (default)
const dbService = {
    initialize,
    close,
    query,
    executeTransaction, // Exporta a nova função de transação
    /**
     * Obtém a instância do Pool diretamente. Use com extrema cautela, preferencialmente
     * utilize as funções `query` e `executeTransaction`.
     * @returns {pg.Pool | null} A instância do pool ou null se não inicializado.
     */
    getPool: () => pool,
    /**
     * Verifica se o pool está inicializado e pronto para uso (não inicializando ou fechando).
     * @returns {boolean}
     */
    isReady: () => !!pool && !isInitializing && !isClosing,
};

// RECOMENDAÇÃO: Manter comentado durante desenvolvimento/testes para facilitar mocks.
// Habilitar em ambiente de produção para prevenir modificações acidentais.
// Object.freeze(dbService);

export default dbService;