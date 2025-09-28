2025-09-28 17:59:54 INFO [SalesAgent] Processando primeira mensagem: "Oi..."
2025-09-28 17:59:54 INFO [SalesAgent] Resposta direta sem RAG (mensagem simples)
2025-09-28 17:59:59 INFO [SalesAgent] Primeira mensagem processada com sucesso

🤖 Pedro: Boa tarde, aqui é o Pedro do DPA. Tudo bem?

Vi que seu nome aqui no WhatsApp é usuário. Posso te chamar assim, ou prefere outro nome?     

--- Debug Info ---
Etapa: NAME_CAPTURE_VALIDATION
Avançou: Não
Contexto: Não
Tokens: 2000
--- End Debug ---

? 👤 Você: Pode ser de Irineu

🔄 Processando...
2025-09-28 18:00:11 INFO [SalesAgent] Processando mensagem: "Pode ser de Irineu..."
2025-09-28 18:00:11 INFO [RAGService] Gerando resposta com RAG...
2025-09-28 18:00:11 INFO [SupabaseService] Buscando por: "Pode ser de Irineu"
2025-09-28 18:00:11 INFO [SupabaseService] Busca retornou 0 resultados
2025-09-28 18:00:11 INFO [RAGService] Usando busca em memória avançada (fallback)
2025-09-28 18:00:13 INFO [RAGService] Resposta gerada com sucesso
2025-09-28 18:00:13 INFO [FunnelService] Avançando para: PROBLEM_EXPLORATION_INITIAL
2025-09-28 18:00:13 INFO [SalesAgent] Mensagem processada com sucesso

🤖 Pedro:

--- Debug Info ---
Etapa: PROBLEM_EXPLORATION_INITIAL
Avançou: Sim
Contexto: Sim
Tokens: 2496
--- End Debug ---

📍 Etapa Atual: Qualificação Inicial - Atuação em Direito Sucessório
   Objetivo: Perguntar ao lead se já atua com Direito Sucessório ou se pretende iniciar.      

? 👤 Você: