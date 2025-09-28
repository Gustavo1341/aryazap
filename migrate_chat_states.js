import dbService from './db.js';
import logger from './logger.js';

async function migrateChatStates() {
  try {
    console.log('=== INICIANDO MIGRAÇÃO DA TABELA CHAT_STATES ===');
    
    // Inicializar conexão
    await dbService.initialize();
    
    // 1. Fazer backup dos dados existentes
    console.log('1. Fazendo backup dos dados existentes...');
    let backupData = [];
    try {
      const result = await dbService.query('SELECT * FROM chat_states');
      backupData = result.rows;
      console.log(`   Backup realizado: ${backupData.length} registros`);
    } catch (e) {
      console.log('   Tabela não existe ou está vazia, continuando...');
    }
    
    // 2. Remover tabela antiga
    console.log('2. Removendo tabela antiga...');
    await dbService.query('DROP TABLE IF EXISTS chat_states');
    
    // 3. Criar nova tabela com constraint correta
    console.log('3. Criando nova tabela com PRIMARY KEY composta...');
    await dbService.query(`
      CREATE TABLE chat_states (
        chat_id VARCHAR(255),
        tenant_id VARCHAR(100),
        state_data JSONB NOT NULL,
        last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (chat_id, tenant_id)
      )
    `);
    
    // 4. Restaurar dados se houver backup
    if (backupData.length > 0) {
      console.log('4. Restaurando dados do backup...');
      for (const row of backupData) {
        await dbService.query(
          'INSERT INTO chat_states (chat_id, tenant_id, state_data, last_updated) VALUES ($1, $2, $3, $4)',
          [row.chat_id, row.tenant_id, row.state_data, row.last_updated]
        );
      }
      console.log(`   ${backupData.length} registros restaurados`);
    }
    
    // 5. Verificar nova constraint
    console.log('5. Verificando nova PRIMARY KEY...');
    const pkInfo = await dbService.query(`
      SELECT a.attname 
      FROM pg_index i 
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) 
      WHERE i.indrelid = 'chat_states'::regclass AND i.indisprimary 
      ORDER BY a.attnum
    `);
    console.log('   PRIMARY KEY criada:', pkInfo.rows.map(r => r.attname));
    
    // 6. Testar ON CONFLICT
    console.log('6. Testando ON CONFLICT com nova constraint...');
    await dbService.query(
      'INSERT INTO chat_states (chat_id, tenant_id, state_data) VALUES ($1, $2, $3) ON CONFLICT (chat_id, tenant_id) DO NOTHING',
      ['test_migration', 'default_tenant', '{"test": true}']
    );
    console.log('   Teste de ON CONFLICT bem-sucedido');
    
    // 7. Limpar dados de teste
    await dbService.query(
      'DELETE FROM chat_states WHERE chat_id = $1 AND tenant_id = $2',
      ['test_migration', 'default_tenant']
    );
    
    console.log('\n✅ MIGRAÇÃO CONCLUÍDA COM SUCESSO!');
    console.log('   - PRIMARY KEY agora é (chat_id, tenant_id)');
    console.log('   - ON CONFLICT funciona corretamente');
    console.log('   - Dados preservados');
    
  } catch (error) {
    console.error('❌ ERRO NA MIGRAÇÃO:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await dbService.close();
    process.exit(0);
  }
}

migrateChatStates();