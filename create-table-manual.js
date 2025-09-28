#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function createTableManual() {
  console.log(chalk.blue.bold('\n🔨 Criação Manual da Tabela\n'));

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.log(chalk.red('❌ Configurações do Supabase não encontradas'));
    return;
  }

  try {
    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log(chalk.yellow('1. Tentando criar a tabela diretamente...'));

    // Usando a REST API diretamente
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS sales_knowledge (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    // Método alternativo usando fetch diretamente
    const response = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        sql: createTableSQL
      })
    });

    if (response.ok) {
      console.log(chalk.green('✅ Tabela criada via REST API'));
    } else {
      const errorText = await response.text();
      console.log(chalk.yellow(`⚠️  REST API: ${response.status} - ${errorText}`));

      // Tentativa alternativa: inserir dados em uma tabela que não existe força a criação
      console.log(chalk.yellow('2. Tentando abordagem alternativa...'));

      try {
        // Se conseguirmos fazer uma operação básica, a tabela deve existir
        const { data, error } = await client
          .from('sales_knowledge')
          .select('count', { count: 'exact', head: true });

        if (error) {
          console.log(chalk.red(`Error code: ${error.code}`));
          console.log(chalk.red(`Error message: ${error.message}`));

          // Se a tabela não existe, Supabase pode estar configurado para criar automaticamente
          console.log(chalk.yellow('3. Tabela não existe - pode ser problema de configuração do Supabase'));

          console.log(chalk.blue('\n📋 Instruções manuais:'));
          console.log(chalk.gray('1. Acesse o Dashboard do Supabase'));
          console.log(chalk.gray('2. Vá para "SQL Editor"'));
          console.log(chalk.gray('3. Execute o seguinte SQL:'));
          console.log(chalk.white(createTableSQL));

        } else {
          console.log(chalk.green('✅ Tabela já existe e está acessível'));
        }
      } catch (err) {
        console.log(chalk.red(`❌ Erro na verificação: ${err.message}`));
      }
    }

    console.log(chalk.yellow('\n4. Testando inserção simples...'));

    // Testa inserção de um documento básico
    const testDoc = {
      source: 'test_manual',
      content: 'Teste manual de criação',
      metadata: { test: true, created_by: 'manual_script' }
    };

    const { data: insertData, error: insertError } = await client
      .from('sales_knowledge')
      .insert([testDoc])
      .select('id');

    if (insertError) {
      console.log(chalk.red(`❌ Erro na inserção: ${insertError.message}`));
      console.log(chalk.red(`Error code: ${insertError.code}`));
    } else {
      console.log(chalk.green(`✅ Documento inserido com sucesso (ID: ${insertData[0].id})`));

      // Remove o documento de teste
      await client
        .from('sales_knowledge')
        .delete()
        .eq('source', 'test_manual');

      console.log(chalk.green('✅ Limpeza concluída'));
    }

  } catch (error) {
    console.log(chalk.red('\n❌ Erro:'));
    console.log(chalk.red(error.message));
  }
}

createTableManual().catch(console.error);