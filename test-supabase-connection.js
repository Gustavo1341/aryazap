#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function testSupabaseConnection() {
  console.log(chalk.blue.bold('\n🔗 Teste de Conexão Supabase\n'));

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(chalk.yellow('Configurações:'));
  console.log(chalk.gray(`URL: ${url}`));
  console.log(chalk.gray(`Service Key: ${serviceRoleKey ? serviceRoleKey.substring(0, 20) + '...' : 'Não encontrada'}`));

  if (!url || !serviceRoleKey) {
    console.log(chalk.red('❌ Configurações do Supabase não encontradas no .env'));
    return;
  }

  try {
    console.log(chalk.yellow('\n1. Criando cliente Supabase...'));

    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log(chalk.green('✅ Cliente criado'));

    console.log(chalk.yellow('\n2. Testando conectividade básica...'));

    // Teste simples de conectividade via RPC
    const { data: rpcData, error: rpcError } = await client
      .rpc('current_database');

    if (rpcError) {
      console.log(chalk.red(`❌ Erro de conectividade: ${rpcError.message}`));
      console.log(chalk.gray(`Código: ${rpcError.code}`));
      return;
    } else {
      console.log(chalk.green('✅ Conectividade OK'));
      console.log(chalk.gray(`Database: ${rpcData}`));
    }

    console.log(chalk.yellow('\n3. Verificando extensão vector...'));

    // Verifica se a extensão vector está habilitada
    const { data: extensions, error: extError } = await client
      .rpc('exec_sql', { sql: 'SELECT * FROM pg_extension WHERE extname = \'vector\';' });

    if (extError) {
      console.log(chalk.red(`❌ Erro ao verificar extensão vector: ${extError.message}`));

      console.log(chalk.yellow('\n4. Tentando habilitar extensão vector...'));

      const { error: enableError } = await client
        .rpc('exec_sql', { sql: 'CREATE EXTENSION IF NOT EXISTS vector;' });

      if (enableError) {
        console.log(chalk.red(`❌ Erro ao habilitar extensão: ${enableError.message}`));
      } else {
        console.log(chalk.green('✅ Extensão vector habilitada'));
      }
    } else {
      console.log(chalk.green('✅ Extensão vector já está habilitada'));
    }

    console.log(chalk.yellow('\n5. Verificando tabela sales_knowledge...'));

    const { data: tableData, error: tableError } = await client
      .from('sales_knowledge')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      if (tableError.code === 'PGRST116') {
        console.log(chalk.yellow('⚠️  Tabela sales_knowledge não existe'));

        console.log(chalk.yellow('\n6. Criando estrutura do banco...'));

        // Lê o script SQL de setup
        const fs = await import('fs');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const { dirname } = await import('path');

        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);

        const setupSqlPath = path.join(__dirname, 'scripts', 'setup-supabase.sql');

        if (fs.existsSync(setupSqlPath)) {
          const setupSql = fs.readFileSync(setupSqlPath, 'utf8');

          const { error: setupError } = await client
            .rpc('exec_sql', { sql: setupSql });

          if (setupError) {
            console.log(chalk.red(`❌ Erro ao executar setup: ${setupError.message}`));
          } else {
            console.log(chalk.green('✅ Estrutura do banco criada com sucesso'));
          }
        } else {
          console.log(chalk.red('❌ Arquivo setup-supabase.sql não encontrado'));
        }
      } else {
        console.log(chalk.red(`❌ Erro ao verificar tabela: ${tableError.message}`));
      }
    } else {
      console.log(chalk.green('✅ Tabela sales_knowledge existe'));
    }

    console.log(chalk.green.bold('\n🎉 Teste de conexão concluído!\n'));

  } catch (error) {
    console.log(chalk.red('\n❌ Erro durante o teste de conexão:'));
    console.log(chalk.red(error.message));
    console.log(chalk.gray(error.stack));
  }
}

testSupabaseConnection().catch(console.error);