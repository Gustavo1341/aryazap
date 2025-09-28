#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

async function setupSimple() {
  console.log(chalk.blue.bold('\n🔧 Setup Simples do Supabase\n'));

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

    console.log(chalk.yellow('1. Testando tabela sales_knowledge...'));

    // Testa se consegue acessar a tabela
    const { data, error } = await client
      .from('sales_knowledge')
      .select('count', { count: 'exact', head: true });

    if (error) {
      console.log(chalk.red(`❌ Erro ao acessar tabela: ${error.message}`));
      return;
    }

    console.log(chalk.green(`✅ Tabela acessível (${data || 0} registros)`));

    console.log(chalk.yellow('\n2. Testando inserção de documento...'));

    // Testa inserção de um documento simples
    const testDoc = {
      source: 'test_source',
      content: 'Conteúdo de teste para validação',
      embedding: new Array(768).fill(0.001), // Embedding fake para teste
      metadata: { test: true }
    };

    const { data: insertData, error: insertError } = await client
      .from('sales_knowledge')
      .insert([testDoc])
      .select('id');

    if (insertError) {
      console.log(chalk.red(`❌ Erro na inserção: ${insertError.message}`));
    } else {
      console.log(chalk.green(`✅ Documento inserido (ID: ${insertData[0].id})`));

      console.log(chalk.yellow('\n3. Testando busca simples...'));

      // Testa busca simples
      const { data: searchData, error: searchError } = await client
        .from('sales_knowledge')
        .select('*')
        .eq('source', 'test_source');

      if (searchError) {
        console.log(chalk.red(`❌ Erro na busca: ${searchError.message}`));
      } else {
        console.log(chalk.green(`✅ Busca funcionando (${searchData.length} resultados)`));
      }

      console.log(chalk.yellow('\n4. Limpando dados de teste...'));

      // Remove o documento de teste
      const { error: deleteError } = await client
        .from('sales_knowledge')
        .delete()
        .eq('source', 'test_source');

      if (deleteError) {
        console.log(chalk.yellow(`⚠️  Erro ao limpar: ${deleteError.message}`));
      } else {
        console.log(chalk.green('✅ Limpeza concluída'));
      }
    }

    console.log(chalk.green.bold('\n🎉 Supabase está funcionando básicamente!\n'));

    console.log(chalk.yellow('Nota: As funções search_embeddings ainda precisam ser criadas,'));
    console.log(chalk.yellow('mas o sistema pode funcionar com busca textual como fallback.'));

  } catch (error) {
    console.log(chalk.red('\n❌ Erro:'));
    console.log(chalk.red(error.message));
  }
}

setupSimple().catch(console.error);