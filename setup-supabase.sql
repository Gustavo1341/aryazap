-- Configuração da tabela de conhecimento para o RAG
-- Execute este script no Supabase SQL Editor

-- 1. Criar a tabela de conhecimento
CREATE TABLE IF NOT EXISTS public.sales_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(1536), -- Para embeddings do Gemini/OpenAI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Criar índice para busca textual
CREATE INDEX IF NOT EXISTS idx_sales_knowledge_content
ON public.sales_knowledge USING gin(to_tsvector('portuguese', content));

-- 3. Criar índice para busca por source
CREATE INDEX IF NOT EXISTS idx_sales_knowledge_source
ON public.sales_knowledge(source);

-- 4. Criar índice para embeddings (se a extensão vector estiver instalada)
-- CREATE INDEX IF NOT EXISTS idx_sales_knowledge_embedding
-- ON public.sales_knowledge USING ivfflat (embedding vector_cosine_ops);

-- 5. Função para busca por similaridade (se usar embeddings)
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

-- 6. Inserir alguns dados de exemplo para teste
INSERT INTO public.sales_knowledge (source, content, metadata) VALUES
(
    'curso_info',
    'O Curso Completo de Prática em Sucessões e Inventários é ministrado pelo professor Jaylton Lopes, ex-juiz do TJDFT com 9 anos de experiência. O curso tem 42 horas de carga horária e acesso por 12 meses. O investimento é de 12x R$ 194,56 no cartão ou R$ 1.997,00 à vista.',
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
)
ON CONFLICT DO NOTHING;

-- 7. Habilitar RLS (Row Level Security) se necessário
-- ALTER TABLE public.sales_knowledge ENABLE ROW LEVEL SECURITY;

-- 8. Criar política de acesso público para leitura (ajuste conforme necessário)
-- CREATE POLICY "Public read access" ON public.sales_knowledge FOR SELECT USING (true);

-- Verificar se a tabela foi criada corretamente
SELECT 'Tabela sales_knowledge criada com sucesso!' as status;
SELECT COUNT(*) as total_documentos FROM public.sales_knowledge;