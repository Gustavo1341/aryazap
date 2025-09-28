#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

async function setupSupabaseDatabase() {
  console.log(chalk.blue.bold('\n🔧 Setup do Banco Supabase\n'));

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    console.log(chalk.red('❌ Configurações do Supabase não encontradas no .env'));
    return;
  }

  try {
    console.log(chalk.yellow('1. Conectando ao Supabase...'));

    const client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false }
    });

    console.log(chalk.green('✅ Cliente criado'));

    console.log(chalk.yellow('\n2. Carregando script SQL de setup...'));

    const setupSqlPath = path.join(__dirname, 'scripts', 'setup-supabase.sql');

    if (!fs.existsSync(setupSqlPath)) {
      console.log(chalk.red('❌ Arquivo setup-supabase.sql não encontrado'));
      return;
    }

    const setupSql = fs.readFileSync(setupSqlPath, 'utf8');
    console.log(chalk.green('✅ Script carregado'));

    console.log(chalk.yellow('\n3. Executando setup do banco...'));

    // Divide o script em comandos individuais
    const commands = setupSql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log(chalk.gray(`Executando ${commands.length} comandos SQL...`));

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i] + ';';

      console.log(chalk.gray(`   ${i + 1}/${commands.length}: ${command.substring(0, 60)}...`));

      try {
        const { data, error } = await client.rpc('exec_sql', {
          sql: command
        });

        if (error) {
          // Alguns erros são aceitáveis (extensão já existe, etc.)
          if (error.message.includes('already exists') ||
              error.message.includes('does not exist') ||
              error.code === '42710') { // duplicate_object
            console.log(chalk.yellow(`   ⚠️  ${error.message}`));
          } else {
            console.log(chalk.red(`   ❌ Erro: ${error.message}`));
          }
        } else {
          console.log(chalk.green(`   ✅ OK`));
        }
      } catch (err) {
        console.log(chalk.red(`   ❌ Erro: ${err.message}`));
      }
    }

    console.log(chalk.yellow('\n4. Verificando estrutura criada...'));

    // Verifica se a tabela foi criada
    const { data: tableCheck, error: tableError } = await client
      .from('sales_knowledge')
      .select('count', { count: 'exact', head: true });

    if (tableError) {
      console.log(chalk.red(`❌ Tabela sales_knowledge não foi criada: ${tableError.message}`));
    } else {
      console.log(chalk.green('✅ Tabela sales_knowledge criada e acessível'));
    }

    // Verifica se as funções foram criadas
    const { data: funcCheck, error: funcError } = await client
      .rpc('search_embeddings', {
        query_embedding: new Array(768).fill(0.001),
        similarity_threshold: 0.7,
        match_count: 1
      });

    if (funcError) {
      console.log(chalk.red(`❌ Função search_embeddings não está funcionando: ${funcError.message}`));
    } else {
      console.log(chalk.green('✅ Função search_embeddings criada e funcionando'));
    }

    console.log(chalk.green.bold('\n🎉 Setup do banco concluído!\n'));

  } catch (error) {
    console.log(chalk.red('\n❌ Erro durante o setup:'));
    console.log(chalk.red(error.message));
    console.log(chalk.gray(error.stack));
  }
}

setupSupabaseDatabase().catch(console.error);