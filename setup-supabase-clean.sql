-- Configuração da tabela de conhecimento para o RAG
-- Execute este script no Supabase SQL Editor

-- 1. Criar a tabela de conhecimento
CREATE TABLE IF NOT EXISTS public.sales_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índice para busca textual
CREATE INDEX IF NOT EXISTS idx_sales_knowledge_content
ON public.sales_knowledge USING gin(to_tsvector('portuguese', content));

-- 3. Criar índice para busca por source
CREATE INDEX IF NOT EXISTS idx_sales_knowledge_source
ON public.sales_knowledge(source);

-- 4. Criar índice para embeddings
CREATE INDEX IF NOT EXISTS idx_sales_knowledge_embedding
ON public.sales_knowledge USING ivfflat (embedding vector_cosine_ops);

-- 5. Função para busca por similaridade
CREATE OR REPLACE FUNCTION search_embeddings(
    query_embedding vector(1536),
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id uuid,
    source text,
    content text,
    metadata jsonb,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sales_knowledge.id,
        sales_knowledge.source,
        sales_knowledge.content,
        sales_knowledge.metadata,
        1 - (sales_knowledge.embedding <=> query_embedding) as similarity
    FROM sales_knowledge
    WHERE sales_knowledge.embedding IS NOT NULL
    AND 1 - (sales_knowledge.embedding <=> query_embedding) > similarity_threshold
    ORDER BY sales_knowledge.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 6. Inserir dados de conhecimento básico
INSERT INTO public.sales_knowledge (source, content, metadata) VALUES
(
    'curso_info_basica',
    'O Curso Completo de Prática em Sucessões e Inventários é ministrado pelo professor Jaylton Lopes, ex-juiz do TJDFT com 9 anos de experiência. O curso tem 42 horas de carga horária e acesso por 12 meses limitado. O investimento é de 12x R$ 194,56 no cartão ou R$ 1.997,00 à vista.',
    '{"tipo": "informacao_basica", "categoria": "curso"}'
),
(
    'beneficios_curso',
    'Com o curso você aprenderá: Prática Sucessória Completa (Inventário, Testamento, ITCMD), Ferramentas Avançadas (Holding, Planejamento, Usucapião), Atuação Estratégica (Contratos, Negociação, Prospecção de Clientes). Você receberá também o Combo Advocacia 4.0 com modelos de petições, Combo Segredos da Prospecção para marketing digital e Google Ads, acesso às IAs exclusivas JUR e Mar.IA, e comunidade exclusiva.',
    '{"tipo": "beneficios", "categoria": "curso"}'
),
(
    'suporte_contato',
    'Nossa equipe de suporte está disponível através do WhatsApp (61) 99664-5250. Para questões administrativas, acesso à plataforma e dúvidas técnicas, entre em contato conosco.',
    '{"tipo": "suporte", "categoria": "atendimento"}'
),
(
    'professor_jaylton',
    'Jaylton Lopes é ex-juiz do Tribunal de Justiça do Distrito Federal (TJDFT) com 9 anos de experiência na magistratura. É especialista em Direito Sucessório e criador do método de ensino prático aplicado no curso. Sua experiência prática como juiz trouxe insights únicos sobre como os processos sucessórios realmente funcionam na prática.',
    '{"tipo": "professor", "categoria": "credencial"}'
),
(
    'depoimento_cristiane',
    'Cristiane Costa, aluna do curso, relatou: "Depois de me especializar, eu fecho contratos de 600 mil reais. É claro que tem contratos menores também, mas assim, ultrapassou todas minhas expectativas." Seu depoimento em vídeo está disponível em: https://www.youtube.com/watch?v=H0LMl6BFPso',
    '{"tipo": "depoimento", "categoria": "prova_social"}'
),
(
    'depoimento_mariana',
    'Mariana, outra aluna do curso, compartilhou sua experiência positiva. Seu depoimento completo está disponível em: https://www.youtube.com/watch?v=vykOaYczq5A',
    '{"tipo": "depoimento", "categoria": "prova_social"}'
),
(
    'depoimento_ernandes',
    'Ernandes também teve excelentes resultados com o curso. Confira seu depoimento em: https://www.youtube.com/watch?v=kEVOyn4NCZo',
    '{"tipo": "depoimento", "categoria": "prova_social"}'
),
(
    'preco_investimento',
    'O investimento no Curso de Prática em Sucessões e Inventários é de 12x de R$ 194,56 no cartão de crédito ou R$ 1.997,00 à vista via PIX. Este valor dá acesso completo ao curso por 12 meses, incluindo todos os bônus e materiais complementares.',
    '{"tipo": "preco", "categoria": "investimento"}'
),
(
    'dificuldades_direito_sucessorio',
    'As principais dificuldades dos advogados em Direito Sucessório incluem: domínio dos procedimentos de inventário, conhecimento sobre partilhas, questões de ITCMD, elaboração de testamentos, planejamento sucessório, usucapião familiar, e prospecção de clientes nessa área específica.',
    '{"tipo": "dificuldades", "categoria": "problemas"}'
),
(
    'solucoes_curso',
    'O curso resolve as principais dificuldades oferecendo: roteiro completo de inventários, modelos de petições prontos, estratégias de prospecção, técnicas de negociação, ferramentas de planejamento sucessório, acesso a IAs especializadas, e suporte de comunidade exclusiva de profissionais da área.',
    '{"tipo": "solucoes", "categoria": "beneficios"}'
)
ON CONFLICT (id) DO NOTHING;

-- Verificar se tudo foi criado corretamente
SELECT 'Configuração concluída!' as status;
SELECT COUNT(*) as total_documentos FROM public.sales_knowledge;