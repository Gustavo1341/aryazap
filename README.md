# 🤖 Sales Agent CLI - DPA

**O melhor agente de vendas do mundo para o curso de Direito Sucessório da DPA**

Um agente de vendas inteligente construído com Node.js, que utiliza tecnologias de ponta como **ChromaDB** para RAG (Retrieval-Augmented Generation) e **Google Gemini** para geração de respostas naturais e precisas.

## 🚀 Características Principais

- **🧠 Inteligência Artificial Avançada**: Powered by Google Gemini
- **📚 RAG (Retrieval-Augmented Generation)**: ChromaDB + LlamaIndex para busca inteligente na base de conhecimento
- **🎯 Funil de Vendas Estruturado**: Baseado no blueprint comprovado da DPA
- **💬 Interface CLI Interativa**: Teste e valide as respostas antes da implementação
- **📊 Analytics e Métricas**: Acompanhe o desempenho e estatísticas
- **🔄 Gestão de Sessão**: Exporte/importe sessões para análise

## 🏗️ Arquitetura

```
├── src/
│   ├── agents/          # SalesAgent principal
│   ├── services/        # ChromaDB, Gemini, RAG, Funnel
│   ├── config/          # Configurações
│   └── utils/           # Utilitários e logger
├── scripts/             # Scripts de setup
├── logs/                # Logs do sistema
└── knowledge.js         # Base de conhecimento
```

## 🛠️ Instalação Rápida

### 1. Pré-requisitos

- **Node.js** 18+
- **Docker** (para ChromaDB)
- **Chave da API do Google Gemini**

### 2. Setup Automático

```bash
# Clone e entre no diretório
cd cli-sales

# Execute o setup interativo
npm run setup

# Instale as dependências
npm install
```

### 3. Configuração Manual (alternativa)

```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite com suas configurações
nano .env
```

### 4. Inicie o ChromaDB

```bash
# Via Docker (recomendado)
docker run -p 8000:8000 chromadb/chroma

# Ou via Python
pip install chromadb
chroma run --host localhost --port 8000
```

## 🎮 Como Usar

### Iniciar o Agente

```bash
# Modo normal
npm start

# Modo desenvolvimento (hot-reload)
npm run dev
```

### Menu Principal

```
🤖 Sales Agent CLI - DPA

? O que você gostaria de fazer?
❯ 💬 Iniciar Conversa de Vendas
  📊 Ver Estatísticas
  🔍 Buscar Base de Conhecimento
  🔄 Reiniciar Sessão
  📤 Exportar Sessão
  📥 Importar Sessão
  ❌ Sair
```

### Modo Conversa

No modo conversa, você simula um prospect interessado no curso:

```
🎯 Modo Conversa de Vendas Ativado
📍 Etapa Atual: Captura e Validação do Nome Personalizado

🤖 Pedro: Olá! Aqui é o Pedro do DPA. Tudo bem? Vi que você tem interesse no nosso curso. Como posso te chamar?

👤 Você: Oi! Pode me chamar de Maria.

🤖 Pedro: Prazer, Maria! Para começarmos e eu entender como posso te ajudar melhor, você já atua com Direito Sucessório ou pretende iniciar nessa área?
```

## 📊 Funcionalidades Avançadas

### Estatísticas do Sistema
- Status dos serviços (ChromaDB, Gemini)
- Contagem de documentos indexados
- Informações da sessão atual
- Métricas de uso

### Busca na Base de Conhecimento
- Busca semântica inteligente
- Ranking por relevância
- Visualização dos resultados

### Gestão de Sessão
- Exportar sessões para análise
- Importar sessões salvas
- Reiniciar conversas

## 🔧 Configuração Avançada

### Variáveis de Ambiente

```bash
# IA
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-1.5-flash
GEMINI_TEMPERATURE=0.7

# ChromaDB
CHROMA_HOST=localhost
CHROMA_PORT=8000
CHROMA_COLLECTION_NAME=sales_knowledge

# Bot
BOT_FIRST_NAME=Pedro
BOT_COMPANY_NAME=DPA - Direito Processual Aplicado
SUPPORT_WHATSAPP_NUMBER=556199664525

# Debug
DEBUG_MODE=true
LOG_LEVEL=info
```

### Personalizar o Funil de Vendas

Edite `src/services/funnelService.js` para modificar:
- Etapas do funil
- Perguntas de cada etapa
- Lógica de avanço
- Contexto do usuário

### Personalizar a Base de Conhecimento

Modifique `knowledge.js` com:
- Informações sobre produtos
- Objeções e respostas
- Provas sociais
- FAQ

## 🏆 Funil de Vendas Implementado

1. **📝 Captura de Nome**: Personalização inicial
2. **🔍 Qualificação**: Atuação em Direito Sucessório
3. **❓ Exploração de Problemas**: Principais dificuldades
4. **💥 Impacto**: Como os problemas afetam o negócio
5. **💡 Apresentação da Solução**: Curso como resposta
6. **🌟 Prova Social**: Depoimentos e casos de sucesso
7. **💰 Oferta**: Apresentação do investimento
8. **✅ Fechamento**: Link de pagamento
9. **🎉 Pós-venda**: Instruções e suporte

## 🚀 Tecnologias Utilizadas

- **Node.js & ES6 Modules**: Runtime e sintaxe moderna
- **Google Gemini**: IA para geração de texto e embeddings
- **ChromaDB**: Banco vetorial para RAG
- **LlamaIndex**: Framework de RAG (conceitual)
- **Winston**: Sistema de logs avançado
- **Inquirer.js**: Interface CLI interativa
- **Chalk**: Cores e formatação no terminal

## 📈 Roadmap

- [ ] **Integração WhatsApp**: Conectar com API real
- [ ] **Dashboard Web**: Interface gráfica para análise
- [ ] **A/B Testing**: Teste de diferentes abordagens
- [ ] **CRM Integration**: Conectar com sistemas existentes
- [ ] **Voice Support**: Suporte a áudio via speech-to-text
- [ ] **Multi-tenancy**: Suporte a múltiplos clientes

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📞 Suporte

- **WhatsApp**: (61) 99664-5250
- **Email**: suporte@dpa.com.br
- **Website**: https://direitoprocessualaplicado.com.br

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**Construído com ❤️ pela equipe DPA**

*"O futuro da advocacia é agora - e é inteligente!"*