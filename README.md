# AryaZap - Agente de Vendas IA para WhatsApp 🤖💬💰

## Visão Geral

O **AryaZap** é um agente de vendas inteligente baseado em WhatsApp, desenvolvido para automatizar a qualificação de leads, gerenciamento de conversas, tratamento de objeções e processos de fechamento. Utiliza modelos de IA avançados (como GPT-4o e GPT-3.5-Turbo) para engajar clientes em potencial de forma natural, guiá-los através de um funil de vendas configurável e converter vendas diretamente no WhatsApp.

Este projeto fornece uma plataforma robusta, configurável e extensível para empresas que desejam escalar suas vendas e interações com clientes no WhatsApp usando IA.

## ✨ Principais Funcionalidades

### 🎯 **Core Features**
*   **Integração WhatsApp:** Conecta diretamente ao WhatsApp usando `whatsapp-web.js` para envio e recebimento de mensagens
*   **Conversas Alimentadas por IA:** Utiliza modelos de linguagem grandes (GPT-4o, GPT-3.5-Turbo) para conversas naturais e conscientes do contexto
*   **Gerenciamento de Funil de Vendas:** Guia leads através de estágios predefinidos do funil de vendas
*   **Classificação Inteligente de Intenções:** Usa GPT-3.5-Turbo para entender intenção do usuário (perguntas, objeções, confirmações, etc.)

### 🧠 **Inteligência Avançada**
*   **Tratamento de Objeções:** Lógica específica e prompts para lidar efetivamente com objeções comuns
*   **Sistema RAG Inteligente:** Base de conhecimento personalizada com busca semântica para respostas precisas
*   **Detecção Contextual:** Identifica quando usar links de checkout vs. páginas de vendas baseado no comportamento do usuário
*   **Personalização de Provas Sociais:** Sistema inteligente que adapta provas sociais ao contexto da conversa

### 💼 **Recursos de Vendas**
*   **Apresentação Dinâmica de Produtos:** Apresenta informações de produtos e planos de preços dinamicamente
*   **Entrega de Prova Social:** Envia automaticamente arquivos de mídia predefinidos como prova social
*   **Gestão de Estado Persistente:** Armazena estado e histórico de conversas em banco PostgreSQL
*   **Sistema de Links Inteligente:** Alterna automaticamente entre links de checkout e páginas de vendas

### 🎤 **Recursos de Mídia**
*   **Text-to-Speech (TTS):** Gera mensagens de voz para respostas da IA usando API ElevenLabs
*   **Processamento de Áudio:** Transcrição de áudio usando Whisper API
*   **Gestão de Mídia:** Download e processamento automático de mídias do WhatsApp

### 🛡️ **Segurança e Controle**
*   **Takeover Humano:** Permite que agentes humanos pausem o bot e assumam conversas
*   **Medidas Anti-Spam:** Inclui limitação de taxa e detecção de palavras-chave para prevenir abuso
*   **Validação de Configuração:** Sistema robusto de validação de configurações na inicialização
*   **Tratamento de Inatividade:** Gerenciamento automático de sessões inativas

### 🔧 **Infraestrutura**
*   **Servidor API (Opcional):** Inclui servidor Express para verificações de status e envio de mensagens via API
*   **Log Robusto:** Sistema de logging centralizado com diferentes níveis de log
*   **Configuração Flexível:** Personalize facilmente identidade, tom, foco do produto e parâmetros operacionais
*   **Shutdown Gracioso:** Mecanismos seguros de desligamento e tratamento de erros

## 🏗️ Arquitetura

A aplicação segue uma arquitetura modular bem estruturada:

### 📋 **Módulos Principais**

#### 🚀 **Core System**
1.  **`main.js`** - Ponto de entrada principal, responsável por inicializar todos os módulos e gerenciar shutdown gracioso
2.  **`whatsappClient.js`** - Gerencia o ciclo de vida do cliente `whatsapp-web.js` (QR code, autenticação, eventos)
3.  **`messageHandler.js`** - Recebe mensagens, gerencia buffering de estado, detecta spam e orquestra o fluxo de processamento

#### 🧠 **Sistema de IA**
4.  **`aiProcessor.js`** - Núcleo da IA:
    *   Gera prompts dinâmicos baseados no step atual do funil e histórico
    *   Chama **OpenAI API (GPT-3.5-Turbo)** para **classificação de intenção/sentimento**
    *   Chama **LLM primário (GPT-4o)** para gerar respostas conversacionais
    *   Gerencia lógica para entrar/sair do modo de tratamento de objeções
5.  **`intentRecognizer.js`** - Sistema especializado de reconhecimento de intenções
6.  **`IntelligentRAG.js`** - Sistema RAG (Retrieval-Augmented Generation) inteligente para busca na base de conhecimento

#### 📨 **Comunicação e Estado**
7.  **`responseSender.js`** - Formata e envia mensagens (texto e áudio TTS opcional) simulando digitação
8.  **`stateManager.js`** - Gerencia persistência do estado da conversa no banco PostgreSQL
9.  **`socialProofPersonalizer.js`** - Sistema inteligente de personalização de provas sociais

#### 💾 **Dados e Configuração**
10. **`db.js`** - Gerencia pool de conexão e execução de queries PostgreSQL
11. **`botConfig.js`** - Centraliza configurações carregadas do `.env`, define identidade e comportamento do bot
12. **`pricing.js`** - Define estruturas de produtos, planos e links de checkout
13. **`salesFunnelBluePrint.js`** - Define estágios e instruções da IA para o funil de vendas

#### 🎵 **Mídia e Assets**
14. **`mediaHandler.js`** - Gerencia download de mídia do WhatsApp, transcrição de áudio (Whisper) e geração TTS (ElevenLabs)
15. **`trainingLoader.js`** - Carrega arquivos da base de conhecimento e valida assets de prova social na inicialização

#### 🌐 **API e Utilitários**
16. **`apiServer.js`** (Opcional) - Servidor Express para interações externas
17. **`inactivityManager.js`** - Gerencia sessões inativas automaticamente
18. **`criticalStepExecutor.js`** - Executa operações críticas do sistema

#### 🛠️ **Utilitários de Suporte**
19. **`logger.js`** - Sistema de logging centralizado e configurável
20. **`utils.js`** - Funções utilitárias gerais (parsing, formatação, tempo, etc.)
21. **`constants.js`** - Constantes globais da aplicação
22. **`fileSystemHandler.js`** - Gerencia diretórios essenciais e limpeza de sessão
23. **`configValidator.js`** - Validação robusta de configurações críticas na inicialização

### 📁 **Estrutura de Dados**
*   **`data/`** - Base de conhecimento processada
*   **`training/`** - Arquivos de treinamento em formato JSON
*   **`provasSociais/`** - Assets de mídia para provas sociais
*   **`utils/`** - Utilitários especializados (similaridade, chunks, etc.)

## 🚀 Como Começar

### Pré-requisitos

*   **Node.js:** Versão 18.x ou superior (verifique com `node -v`)
*   **npm** ou **yarn:** Gerenciador de pacotes para Node.js
*   **PostgreSQL:** Instância do banco PostgreSQL em execução (local ou remoto)
*   **Git:** Para clonar o repositório
*   **APIs Necessárias:**
    *   Conta OpenAI com créditos para GPT-4o e GPT-3.5-Turbo
    *   (Opcional) Conta ElevenLabs para Text-to-Speech
*   **(Opcional) Google Chrome:** Instalação padrão do Chrome para envio nativo de vídeos pelo WhatsApp

### Instalação

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/Gustavo1341/aryazap.git
    cd aryazap
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure as Variáveis de Ambiente:**
    *   Crie o arquivo `.env` baseado no exemplo:
        ```bash
        cp .env.example .env
        ```
    *   **Edite o arquivo `.env`** e preencha pelo menos as seguintes variáveis críticas:

    **🔑 Configurações Essenciais:**
    ```env
    # Banco de Dados PostgreSQL
    DB_USER=seu_usuario
    DB_HOST=localhost
    DB_NAME=aryazap_db
    DB_PASSWORD=sua_senha
    DB_PORT=5432

    # API da OpenAI (OBRIGATÓRIO)
    OPENAI_API_KEY=sk-sua-chave-openai

    # Identidade do Bot
    BOT_FIRST_NAME=Pedro
    BOT_COMPANY_NAME=Sua Empresa
    BOT_POSITION=Consultor de Vendas

    # Produto Alvo (deve existir em pricing.js)
    TARGET_PRODUCT_ID=PRODUCT_A

    # WhatsApp de Suporte
    SUPPORT_WHATSAPP_NUMBER=5511999998888
    ```

    **🎵 Configurações Opcionais:**
    ```env
    # Text-to-Speech (ElevenLabs)
    ELEVENLABS_API_KEY=sua-chave-elevenlabs
    TTS_ENABLED=true

    # Servidor API
    PORT=3000
    API_KEY=sua-chave-api-secreta

    # Chrome para vídeos (opcional)
    CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe"
    ```

4.  **Configure o Banco de Dados:**
    *   Certifique-se de que o PostgreSQL está rodando
    *   Crie o banco e usuário especificados no `.env`
    *   A aplicação cria as tabelas automaticamente na primeira execução
    *   **Para produção, use ferramentas de migração adequadas**

5.  **Prepare as Pastas de Dados:**
    ```bash
    # Crie as pastas necessárias
    mkdir -p training provasSociais data

    # Adicione arquivos de conhecimento em training/
    # Adicione mídias de prova social em provasSociais/
    ```

6.  **Gere a Base de Conhecimento:**
    ```bash
    # Execute o script para processar os dados de treinamento
    node utils/generateChunks.cjs
    ```

## ⚙️ Configuração

A configuração é gerenciada através de múltiplos arquivos para máxima flexibilidade:

### 🔧 **Arquivos de Configuração**

1.  **`.env`** - Configurações de ambiente e secrets:
    *   Chaves de API, senhas do banco
    *   Configurações específicas do ambiente
    *   **Principal local para customização**

2.  **`botConfig.js`** - Configuração estruturada:
    *   Carrega valores do `.env`
    *   Define defaults para variáveis ausentes
    *   Centraliza acesso a configurações de identidade, comportamento, IA, TTS

3.  **`pricing.js`** - Produtos e preços:
    *   Define produtos, planos, recursos e preços
    *   **Links de checkout e páginas de vendas**
    *   Garanta que `TARGET_PRODUCT_ID` corresponda a um ID válido

4.  **`salesFunnelBluePrint.js`** - Funil de vendas:
    *   Define estágios, objetivos e instruções específicas da IA
    *   Lógica de progressão no funil
    *   Prompts personalizados por etapa

### 🎯 **Áreas-Chave para Configurar**

#### 🤖 **Identidade do Bot**
```env
BOT_FIRST_NAME=Pedro
BOT_COMPANY_NAME=DPA - Direito Processual Aplicado
BOT_POSITION=Especialista em Vendas
BOT_TONE="Aja como um consultor especialista..."
```

#### 🏢 **Configurações de Negócio**
```env
TARGET_PRODUCT_ID=PRODUCT_A
SUPPORT_WHATSAPP_NUMBER=5511999998888
COMPANY_WEBSITE=https://suaempresa.com
SALES_PAGE_URL=https://suaempresa.com/vendas
```

#### 🎵 **Text-to-Speech (Opcional)**
```env
TTS_ENABLED=true
ELEVENLABS_API_KEY=sua-chave
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

#### 🌐 **Servidor API (Opcional)**
```env
PORT=3000
API_KEY=sua-chave-secreta-api
API_ENABLED=true
```

#### 🛡️ **Anti-Spam e Limites**
```env
RATE_LIMIT_MAX_MESSAGES=10
RATE_LIMIT_WINDOW_MINUTES=5
SPAM_BLOCK_DURATION_MINUTES=15
```

### 📋 **Configuração da Base de Conhecimento**

Adicione seus dados de treinamento em:
*   **`training/`** - Arquivos `.txt`, `.pdf`, `.json` com conhecimento do produto
*   **`data/knowledgeBase.js`** - Base estruturada de perguntas e respostas
*   **`provasSociais/`** - Mídias (imagens, vídeos) para provas sociais

## ▶️ Executando o Bot

### 🚀 **Inicialização**

1.  **Inicie a aplicação:**
    ```bash
    npm start
    # ou para desenvolvimento com auto-reload:
    npm run dev
    ```

2.  **Autenticação WhatsApp:**
    *   Na primeira execução (ou após deletar a pasta `session`), um QR code aparecerá no terminal
    *   Abra o WhatsApp no seu celular
    *   Vá em `Configurações > Aparelhos conectados > Conectar aparelho`
    *   Escaneie o QR code exibido no terminal
    *   Aguarde a inicialização - você verá logs indicando "CLIENTE WHATSAPP PRONTO!"

3.  **Verificação do Status:**
    *   O bot agora está rodando e processará mensagens recebidas
    *   Verifique os logs para confirmar que todos os módulos foram inicializados
    *   Se configurado, acesse `http://localhost:3000/status` para ver o status via API

### 📱 **Primeiros Testes**

1.  **Teste Básico:**
    *   Envie uma mensagem para o número conectado
    *   O bot deve responder seguindo o funil configurado

2.  **Comandos de Teste:**
    *   `"Olá"` - Inicia conversa
    *   `"Quero saber sobre o produto"` - Apresentação de produto
    *   `"Quero ver provas sociais"` - Ativa sistema de provas
    *   `"Qual o preço?"` - Apresenta preços

### 🔧 **Scripts Disponíveis**

```bash
# Iniciar em produção
npm start

# Desenvolvimento com auto-reload
npm run dev

# Regenerar base de conhecimento
node utils/generateChunks.cjs

# Testar configuração
node configValidator.js

# Verificar banco de dados
node verificar_banco.js
```

## 🌐 Servidor API (Opcional)

Se `PORT` estiver definido no `.env`, um servidor Express API será iniciado automaticamente.

### 🔐 **Autenticação**
*   Se `API_KEY` estiver configurado, endpoints protegidos requerem o header `x-api-key: SUA_CHAVE_API`
*   Endpoints públicos não requerem autenticação

### 📋 **Endpoints Disponíveis**

#### `GET /status`
Retorna status detalhado do sistema (público):
```json
{
  "status": "running",
  "whatsapp": {
    "connected": true,
    "authenticated": true,
    "clientInfo": {...}
  },
  "database": {
    "connected": true,
    "totalChats": 42
  },
  "ai": {
    "model": "gpt-4o",
    "provider": "OpenAI"
  },
  "features": {
    "tts": true,
    "rag": true,
    "socialProof": true
  }
}
```

#### `POST /send-message`
Envia mensagem para número específico (requer autenticação):
```json
{
  "number": "5511999998888",
  "message": "Sua mensagem aqui"
}
```

#### `GET /health`
Verificação rápida de saúde do sistema:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### `POST /broadcast` (Futuro)
Envio em massa para lista de contatos (requer autenticação):
```json
{
  "numbers": ["5511999998888", "5511999997777"],
  "message": "Mensagem em massa"
}
```

### 🔧 **Exemplo de Uso**

```bash
# Verificar status
curl http://localhost:3000/status

# Enviar mensagem (com API key)
curl -X POST http://localhost:3000/send-message \
  -H "Content-Type: application/json" \
  -H "x-api-key: sua-chave-api" \
  -d '{
    "number": "5511999998888",
    "message": "Olá! Esta é uma mensagem via API."
  }'
```

## 🛠️ Recursos Avançados

### 🎯 **Sistema RAG Inteligente**
*   **Busca Semântica:** Utiliza embeddings para encontrar respostas relevantes na base de conhecimento
*   **Chunking Inteligente:** Divide documentos em chunks otimizados para contexto
*   **Similaridade de Cosseno:** Algoritmo avançado para matching de consultas
*   **Cache de Embeddings:** Otimização de performance para consultas frequentes

### 🔄 **Gestão de Estado Avançada**
*   **Persistência PostgreSQL:** Estado completo mantido no banco de dados
*   **Contexto Conversacional:** Mantém histórico e contexto entre sessões
*   **Flags Contextuais:** Sistema de flags para comportamentos específicos
*   **Migração Automática:** Sistema de atualização de esquemas de dados

### 🎵 **Sistema de Mídia**
*   **Transcrição de Áudio:** Whisper API para converter áudio em texto
*   **Text-to-Speech:** ElevenLabs para mensagens de voz humanizadas
*   **Processamento de Imagens:** Suporte completo para imagens e vídeos
*   **Provas Sociais Dinâmicas:** Sistema inteligente de seleção de mídia

### 🛡️ **Segurança e Controle**
*   **Rate Limiting:** Proteção contra spam e uso abusivo
*   **Validação de Entrada:** Sanitização e validação de todas as entradas
*   **Logs Auditáveis:** Sistema de logging completo para auditoria
*   **Configuração Validada:** Verificação de configurações críticas na inicialização

## 📊 **Monitoramento e Analytics**

### 📈 **Métricas Disponíveis**
*   **Conversas Ativas:** Número de chats em andamento
*   **Taxa de Conversão:** Leads convertidos vs. total de leads
*   **Tempo de Resposta:** Latência média das respostas da IA
*   **Uso de Recursos:** Consumo de tokens da API e performance

### 🔍 **Logs Estruturados**
```javascript
// Exemplo de log estruturado
{
  "timestamp": "2024-01-01T12:00:00Z",
  "level": "INFO",
  "module": "aiProcessor",
  "event": "response_generated",
  "userId": "5511999998888",
  "tokens_used": 150,
  "response_time_ms": 1200,
  "funnel_step": "qualification"
}
```

### 📋 **Relatórios Automáticos**
*   **Relatório Diário:** Resumo de atividades e métricas
*   **Alertas de Sistema:** Notificações automáticas para problemas
*   **Performance Dashboard:** Via API endpoint `/status`

## 🔧 **Desenvolvimento e Personalização**

### 🎨 **Personalizando o Bot**

#### **1. Identidade e Comportamento**
Edite `botConfig.js` para personalizar:
```javascript
const BOT_IDENTITY = {
  firstName: "Pedro",
  company: "Sua Empresa",
  position: "Consultor Especialista",
  tone: "profissional e prestativo"
};
```

#### **2. Funil de Vendas**
Modifique `salesFunnelBluePrint.js` para definir:
```javascript
export const SALES_FUNNEL_STEPS = {
  greeting: {
    goal: "Cumprimentar e identificar necessidades",
    instructions: "Seja caloroso e profissional...",
    nextSteps: ["qualification", "objection_handling"]
  }
  // ... outros steps
};
```

#### **3. Base de Conhecimento**
Adicione conhecimento em `data/knowledgeBase.js`:
```javascript
export const knowledgeChunks = [
  {
    id: "produto_beneficios",
    pergunta: "Quais são os benefícios do produto?",
    resposta: "Nosso produto oferece...",
    tags: ["beneficios", "produto", "vantagens"]
  }
];
```

### 🧪 **Testes e Desenvolvimento**

#### **Scripts de Teste**
```bash
# Testar configuração
node configValidator.js

# Testar base de conhecimento
node test_social_proof.js

# Verificar banco de dados
node verificar_banco.js

# Gerar chunks de conhecimento
node utils/generateChunks.cjs
```

#### **Desenvolvimento Local**
```bash
# Modo desenvolvimento com auto-reload
npm run dev

# Logs detalhados
DEBUG=* npm run dev

# Testar apenas um módulo
node -e "import('./aiProcessor.js').then(m => console.log(m))"
```

## 🚀 **Deploy e Produção**

### 🐳 **Docker Support**
```bash
# Build da imagem
docker build -t aryazap .

# Executar com Docker Compose
docker-compose up -d

# Logs do container
docker logs aryazap
```

### ☁️ **Deploy na Nuvem**
*   **VPS/Servidor Dedicado:** Recomendado para controle total
*   **Heroku/Railway:** Para deploy rápido (configurar variables de ambiente)
*   **DigitalOcean/AWS:** Para escala empresarial

### 🔒 **Segurança em Produção**
*   Use HTTPS para todas as APIs
*   Configure firewall adequadamente
*   Monitore logs regularmente
*   Mantenha backups do banco de dados
*   Use variáveis de ambiente para secrets

### 📋 **Checklist de Deploy**
- [ ] Configurar todas as variáveis de ambiente
- [ ] Testar conexão com banco de dados
- [ ] Verificar APIs (OpenAI, ElevenLabs)
- [ ] Configurar logs persistentes
- [ ] Testar autenticação WhatsApp
- [ ] Configurar monitoramento
- [ ] Documentar processo de recovery

## 🤝 **Contribuindo**

Contribuições são bem-vindas! Por favor, siga estas diretrizes:

### 📋 **Como Contribuir**
1. Faça fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

### 🐛 **Reportando Bugs**
Use o template de issue para reportar bugs:
*   Descreva o comportamento esperado vs. atual
*   Inclua logs relevantes
*   Especifique versão do Node.js e SO
*   Passos para reproduzir o problema

### 💡 **Sugerindo Melhorias**
*   Verifique issues existentes antes de criar nova
*   Descreva claramente a melhoria proposta
*   Explique por que seria útil para o projeto

## 📄 **Licença**

Este projeto está licenciado sob a Licença ISC - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 👨‍💻 **Autor**

**SmartZap Team**
- GitHub: [@Gustavo1341](https://github.com/Gustavo1341)
- Email: contato@smartzap.com.br

## 🙏 **Agradecimentos**

*   [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) - Biblioteca base para integração WhatsApp
*   [OpenAI](https://openai.com/) - Modelos de linguagem GPT
*   [ElevenLabs](https://elevenlabs.io/) - Text-to-Speech de alta qualidade
*   Comunidade Node.js e contribuidores open source

## 📚 **Recursos Adicionais**

### 📖 **Documentação Técnica**
*   [Guia de Configuração Avançada](docs/advanced-config.md)
*   [API Reference](docs/api-reference.md)
*   [Troubleshooting Guide](docs/troubleshooting.md)

### 🎥 **Tutoriais**
*   [Setup Inicial - Video Guide](#)
*   [Personalizando seu Bot](#)
*   [Deploy em Produção](#)

### 💬 **Comunidade**
*   [Discord Server](#)
*   [Telegram Group](#)
*   [Forum de Discussões](#)

## 📈 **Roadmap**

### 🎯 **Versão 2.0**
- [ ] Interface Web para gerenciamento
- [ ] Painel de análises avançado
- [ ] Suporte a múltiplos idiomas
- [ ] Integração com CRM
- [ ] Chatbot com foco em voz

### 🔮 **Futuro**
- [ ] Aprendizado de máquina personalizado
- [ ] Integração com redes sociais
- [ ] Automação de marketing
- [ ] Análise de sentimento avançada

---

<div align="center">

**⭐ Se este projeto foi útil para você, considere dar uma estrela!**

[⭐ Star no GitHub](https://github.com/Gustavo1341/aryazap) • [🐛 Reportar Bug](https://github.com/Gustavo1341/aryazap/issues) • [💡 Sugerir Feature](https://github.com/Gustavo1341/aryazap/issues)

---

**Desenvolvido com ❤️ pela equipe SmartZap**

</div>