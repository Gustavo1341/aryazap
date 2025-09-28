📍 Etapa Atual: Captura e Validação do Nome Personalizado
   Objetivo: Validar o nome completo do contato e perguntar como ele gostaria de ser chamado para personalização.
🤖 Pedro: Boa tarde, aqui é o Pedro do DPA. Tudo bem?

Vi que seu nome aqui no WhatsApp é usuário. Posso te chamar assim, ou prefere outro nome?     
? 👤 Você: oi

🔄 Processando...
2025-09-28 17:04:12 INFO [SalesAgent] Processando mensagem: "oi..."
2025-09-28 17:04:12 INFO [RAGService] Gerando resposta com RAG...
2025-09-28 17:04:12 INFO [SupabaseService] Buscando por: "oi"
2025-09-28 17:04:13 ERROR  Erro na busca textual: Could not find the table 'public.sales_knowledge' in the schema cache
2025-09-28 17:04:13 ERROR  Erro ao buscar no Supabase: Could not find the table 'public.sales_knowledge' in the schema cache
2025-09-28 17:04:13 INFO [RAGService] Usando busca em memória (fallback)
2025-09-28 17:04:16 INFO [RAGService] Resposta gerada com sucesso
2025-09-28 17:04:16 INFO [SalesAgent] Mensagem processada com sucesso

🤖 Pedro: Olá! Boa tarde, aqui é o Pedro do DPA. Tudo bem?

Vi que seu nome aqui no WhatsApp é usuário. Posso te chamar assim, ou prefere outro nome?     

--- Debug Info ---
Etapa: NAME_CAPTURE_VALIDATION
Avançou: Não
Contexto: Não
Tokens: 1393
--- End Debug ---

? 👤 Você: Sim

🔄 Processando...
2025-09-28 17:04:35 INFO [SalesAgent] Processando mensagem: "Sim..."
2025-09-28 17:04:35 INFO [RAGService] Gerando resposta com RAG...
2025-09-28 17:04:35 INFO [SupabaseService] Buscando por: "Sim"
2025-09-28 17:04:35 ERROR  Erro na busca textual: Could not find the table 'public.sales_knowledge' in the schema cache
2025-09-28 17:04:35 ERROR  Erro ao buscar no Supabase: Could not find the table 'public.sales_knowledge' in the schema cache
2025-09-28 17:04:35 INFO [RAGService] Usando busca em memória (fallback)
2025-09-28 17:04:39 INFO [RAGService] Resposta gerada com sucesso
2025-09-28 17:04:39 INFO [FunnelService] Avançando para: PROBLEM_EXPLORATION_INITIAL
2025-09-28 17:04:39 INFO [SalesAgent] Mensagem processada com sucesso

🤖 Pedro:

--- Debug Info ---
Etapa: PROBLEM_EXPLORATION_INITIAL
Avançou: Sim
Contexto: Não
Tokens: 1473
--- End Debug ---

📍 Etapa Atual: Qualificação Inicial - Atuação em Direito Sucessório
   Objetivo: Perguntar ao lead se já atua com Direito Sucessório ou se pretende iniciar.      

? 👤 Você: