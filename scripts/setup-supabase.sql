-- Configuração do Supabase para Sales Agent
-- Execute este script no SQL Editor do Supabase

-- Ativar extensão vector
CREATE EXTENSION IF NOT EXISTS vector;

-- Criar tabela para armazenar conhecimento
CREATE TABLE IF NOT EXISTS sales_knowledge (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector(768),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para otimizar buscas
CREATE INDEX IF NOT EXISTS sales_knowledge_embedding_idx
ON sales_knowledge USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS sales_knowledge_source_idx
ON sales_knowledge (source);

CREATE INDEX IF NOT EXISTS sales_knowledge_created_at_idx
ON sales_knowledge (created_at);

-- Criar função para busca por similaridade
CREATE OR REPLACE FUNCTION search_embeddings(
    query_embedding vector(768),
    similarity_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source TEXT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        sk.id,
        sk.source,
        sk.content,
        sk.metadata,
        sk.created_at,
        1 - (sk.embedding <=> query_embedding) as similarity
    FROM sales_knowledge sk
    WHERE sk.embedding IS NOT NULL
    AND 1 - (sk.embedding <=> query_embedding) > similarity_threshold
    ORDER BY sk.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Criar função para busca de documentos (alias para compatibilidade)
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(768),
    match_threshold float DEFAULT 0.7,
    match_count int DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    source TEXT,
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE,
    similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM search_embeddings(query_embedding, match_threshold, match_count);
END;
$$;

-- Criar função auxiliar para executar SQL (se necessário)
CREATE OR REPLACE FUNCTION exec_sql(sql TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE sql;
END;
$$;

-- Configurar RLS (Row Level Security) se necessário
-- ALTER TABLE sales_knowledge ENABLE ROW LEVEL SECURITY;

-- Política para permitir acesso (ajuste conforme necessário)
-- CREATE POLICY "Allow service role access" ON sales_knowledge
-- FOR ALL USING (auth.role() = 'service_role');

-- Comentários sobre a estrutura:
-- - id: Identificador único do documento
-- - source: Fonte/origem do conhecimento (ex: "faq_preco", "info_curso")
-- - content: Conteúdo textual do conhecimento
-- - embedding: Vetor de embedding (768 dimensões para Gemini)
-- - metadata: Dados adicionais em formato JSON
-- - created_at: Timestamp de criação

-- Para verificar se tudo foi criado corretamente:
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'sales_knowledge';
-- SELECT routine_name FROM information_schema.routines WHERE routine_name LIKE 'search_%';