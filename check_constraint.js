import db from './db.js';

async function checkConstraint() {
    try {
        await db.initialize();
        console.log('Verificando constraint da tabela chat_states...');
        
        const result = await db.query(`
            SELECT a.attname 
            FROM pg_index i 
            JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) 
            WHERE i.indrelid = 'chat_states'::regclass AND i.indisprimary 
            ORDER BY a.attnum
        `);
        
        console.log('Colunas da PRIMARY KEY:', result.rows.map(r => r.attname));
        
        // Verificar se a tabela foi recriada corretamente
        const tableInfo = await db.query(`
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'chat_states' 
            ORDER BY ordinal_position
        `);
        
        console.log('\nEstrutura da tabela:');
        tableInfo.rows.forEach(col => {
            console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'})`);
        });
        
        await db.close();
    } catch(e) {
        console.error('Erro:', e.message);
        process.exit(1);
    }
}

checkConstraint();