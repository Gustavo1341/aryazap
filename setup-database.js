#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tableName = process.env.SUPABASE_TABLE_NAME || 'sales_knowledge';

if (!supabaseUrl || !serviceRoleKey) {
  console.log(chalk.red('❌ Configurações do Supabase não encontradas no .env'));
  console.log(chalk.yellow('Verifique SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false }
});

async function setupDatabase() {
  console.log(chalk.blue('🔧 Configurando banco de dados Supabase...'));

  try {
    // 1. Verificar se a tabela já existe
    console.log(chalk.gray('Verificando se a tabela existe...'));
    const { data: existingTable, error: checkError } = await supabase
      .from(tableName)
      .select('count', { count: 'exact', head: true });

    if (!checkError) {
      console.log(chalk.green(`✅ Tabela '${tableName}' já existe!`));
      console.log(chalk.gray('Verificando dados existentes...'));

      const { count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });

      console.log(chalk.blue(`📊 Documentos existentes: ${count || 0}`));

      if (count > 0) {
        console.log(chalk.green('✅ Base de conhecimento já configurada!'));
        process.exit(0);
      }
    } else {
      console.log(chalk.yellow('⚠️  Tabela não existe, criando...'));
    }

    // 2. Criar a tabela se não existir
    console.log(chalk.gray('Criando tabela de conhecimento...'));

    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.${tableName} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: createTableSQL
    });

    if (createError) {
      // Tenta uma abordagem alternativa
      console.log(chalk.yellow('Tentando método alternativo...'));

      // Inserir um documento de teste para forçar criação da tabela
      const { error: insertError } = await supabase
        .from(tableName)
        .insert([{
          source: '_setup_test_',
          content: 'Teste de configuração inicial',
          metadata: { setup: true }
        }]);

      if (insertError) {
        throw insertError;
      }

      // Remove o documento de teste
      await supabase
        .from(tableName)
        .delete()
        .eq('source', '_setup_test_');
    }

    console.log(chalk.green('✅ Tabela criada com sucesso!'));

    // 3. Inserir dados de conhecimento básico
    console.log(chalk.gray('Inserindo dados de conhecimento básico...'));

    const knowledgeData = [
      {
        source: 'curso_info_basica',
        content: 'O Curso Completo de Prática em Sucessões e Inventários é ministrado pelo professor Jaylton Lopes, ex-juiz do TJDFT com 9 anos de experiência. O curso tem 42 horas de carga horária e acesso por 12 meses. O investimento é de 12x R$ 194,56 no cartão ou R$ 1.997,00 à vista.',
        metadata: { tipo: 'informacao_basica', categoria: 'curso' }
      },
      {
        source: 'beneficios_curso',
        content: 'Com o curso você aprenderá: Prática Sucessória Completa (Inventário, Testamento, ITCMD), Ferramentas Avançadas (Holding, Planejamento, Usucapião), Atuação Estratégica (Contratos, Negociação, Prospecção de Clientes). Você receberá também o Combo Advocacia 4.0 com modelos de petições, Combo Segredos da Prospecção para marketing digital e Google Ads, acesso às IAs exclusivas JUR e Mar.IA, e comunidade exclusiva.',
        metadata: { tipo: 'beneficios', categoria: 'curso' }
      },
      {
        source: 'suporte_contato',
        content: 'Nossa equipe de suporte está disponível através do WhatsApp (61) 99664-5250. Para questões administrativas, acesso à plataforma e dúvidas técnicas, entre em contato conosco.',
        metadata: { tipo: 'suporte', categoria: 'atendimento' }
      },
      {
        source: 'professor_jaylton',
        content: 'Jaylton Lopes é ex-juiz do Tribunal de Justiça do Distrito Federal (TJDFT) com 9 anos de experiência na magistratura. É especialista em Direito Sucessório e criador do método de ensino prático aplicado no curso. Sua experiência prática como juiz trouxe insights únicos sobre como os processos sucessórios realmente funcionam na prática.',
        metadata: { tipo: 'professor', categoria: 'credencial' }
      },
      {
        source: 'depoimento_cristiane',
        content: 'Cristiane Costa, aluna do curso, relatou: "Depois de me especializar, eu fecho contratos de 600 mil reais. É claro que tem contratos menores também, mas assim, ultrapassou todas minhas expectativas." Seu depoimento em vídeo está disponível em: https://www.youtube.com/watch?v=H0LMl6BFPso',
        metadata: { tipo: 'depoimento', categoria: 'prova_social' }
      }
    ];

    const { data: insertedData, error: insertError } = await supabase
      .from(tableName)
      .insert(knowledgeData)
      .select('id');

    if (insertError) {
      throw insertError;
    }

    console.log(chalk.green(`✅ ${insertedData.length} documentos de conhecimento inseridos!`));

    // 4. Verificar configuração final
    const { count: finalCount } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    console.log(chalk.green(`\n🎉 Configuração concluída!`));
    console.log(chalk.blue(`📊 Total de documentos: ${finalCount}`));
    console.log(chalk.blue(`🗃️  Tabela: ${tableName}`));
    console.log(chalk.gray(`🔗 URL: ${supabaseUrl}`));

    // 5. Testar busca
    console.log(chalk.gray('\nTestando busca...'));
    const { data: testSearch, error: searchError } = await supabase
      .from(tableName)
      .select('*')
      .ilike('content', '%curso%')
      .limit(1);

    if (searchError) {
      console.log(chalk.yellow('⚠️  Erro no teste de busca:', searchError.message));
    } else {
      console.log(chalk.green(`✅ Busca funcionando! Encontrados: ${testSearch.length} resultados`));
    }

  } catch (error) {
    console.error(chalk.red('❌ Erro durante a configuração:'), error.message);
    console.log(chalk.yellow('\n💡 Dicas para resolver:'));
    console.log(chalk.gray('1. Verifique se as credenciais no .env estão corretas'));
    console.log(chalk.gray('2. Verifique se você tem permissões de administrador no Supabase'));
    console.log(chalk.gray('3. Execute o script SQL manualmente no Supabase Dashboard'));
    process.exit(1);
  }
}

setupDatabase();