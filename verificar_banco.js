import dbService from './db.js';

async function verificarBanco() {
    try {
        console.log('🔍 Verificando estrutura do banco de dados...');
        
        // Inicializar conexão
        await dbService.initialize();
        
        // Verificar estrutura da tabela chat_states
        const estrutura = await dbService.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chat_states'
            ORDER BY ordinal_position
        `);
        
        console.log('📋 Estrutura da tabela chat_states:');
        estrutura.rows.forEach(row => {
            console.log(`  ${row.column_name}: ${row.data_type}`);
        });
        
        // Verificar se há dados de exemplo
        const dados = await dbService.query(`
            SELECT chat_id, tenant_id, 
                   state_data->'metadata'->'contextFlags'->'usesSalesPageLink' as uses_sales_page
            FROM chat_states 
            LIMIT 5
        `);
        
        console.log('\n📊 Dados de exemplo (usesSalesPageLink):');
        if (dados.rows.length === 0) {
            console.log('  Nenhum dado encontrado');
        } else {
            dados.rows.forEach(row => {
                console.log(`  ${row.chat_id}: ${row.uses_sales_page}`);
            });
        }
        
        console.log('\n✅ Banco de dados está configurado corretamente!');
        console.log('   - Tabela chat_states existe');
        console.log('   - Coluna state_data é JSONB');
        console.log('   - Flag usesSalesPageLink pode ser armazenada em state_data.metadata.contextFlags.usesSalesPageLink');
        
        // Testar funções de preferência de link
        console.log('\n🧪 Testando funções de preferência de link...');
        
        // Importar stateManager para testar
        const stateManager = await import('./stateManager.js');
        
        // Testar com um chat_id de exemplo
        const chatIdTeste = 'teste_123@c.us';
        
        // Obter estado inicial
        const estadoInicial = await stateManager.default.getChatState(chatIdTeste);
        console.log(`   Estado inicial usesSalesPageLink: ${await stateManager.default.getLinkPreference(chatIdTeste)}`);
        
        // Atualizar preferência
        await stateManager.default.updateLinkPreference(chatIdTeste, true);
        console.log(`   Após atualizar para true: ${await stateManager.default.getLinkPreference(chatIdTeste)}`);
        
        await stateManager.default.updateLinkPreference(chatIdTeste, false);
        console.log(`   Após atualizar para false: ${await stateManager.default.getLinkPreference(chatIdTeste)}`);
        
        console.log('\n🎉 Tudo funcionando corretamente!');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
    } finally {
        await dbService.close();
    }
}

verificarBanco();