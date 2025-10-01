# Guia de Instalação e Configuração da Evolution API

## 📋 Pré-requisitos

- Docker Desktop instalado e rodando no Windows
- Porta 8080 disponível (Evolution API)
- Porta 3000 disponível (Seu bot)

## 🚀 Passo 1: Iniciar a Evolution API com Docker

### Método 1: Via Docker Desktop (Recomendado)

1. Abra o **Docker Desktop**
2. Vá em **Images** > **Import** ou use o terminal
3. No terminal (CMD ou PowerShell), navegue até a pasta do projeto:
   ```powershell
   cd "C:\Users\Gustavo Brandão\Documents\aryazap\sales-bot-workbench-main\cli-sales"
   ```

4. Execute o Docker Compose:
   ```powershell
   docker-compose -f docker-compose-evolution.yml up -d
   ```

5. Verifique se o container está rodando:
   ```powershell
   docker ps
   ```

   Você deve ver um container chamado `evolution-api` rodando na porta 8080.

### Método 2: Via Docker Desktop Interface

1. Abra o Docker Desktop
2. Clique em "Compose" ou "Stacks"
3. Clique em "Add Stack" ou "Import"
4. Selecione o arquivo `docker-compose-evolution.yml`
5. Clique em "Deploy" ou "Start"

## 🔍 Passo 2: Verificar se a Evolution API está funcionando

Abra seu navegador e acesse:
```
http://localhost:8080
```

Ou teste via curl/PowerShell:
```powershell
curl http://localhost:8080/manager/instance/status
```

## ⚙️ Passo 3: Configuração já realizada

✅ As seguintes configurações já foram feitas:

1. **Arquivo `.env` atualizado** com:
   - `EVOLUTION_API_URL=http://localhost:8080`
   - `EVOLUTION_API_KEY=my-secure-api-key-12345`
   - `EVOLUTION_INSTANCE_NAME=sales-bot-instance`
   - `WEBHOOK_URL=http://localhost:3000/webhook`

2. **`whatsappClient.js` refatorado** para usar Evolution API ao invés de whatsapp-web.js

3. **`apiServer.js` atualizado** com rota `/webhook` para receber eventos da Evolution API

4. **Docker Compose configurado** com:
   - Porta 8080 exposta
   - Webhook apontando para `http://host.docker.internal:3000/webhook`
   - API Key sincronizada
   - Banco SQLite para persistência

## 🎯 Passo 4: Iniciar seu bot

1. No terminal, execute:
   ```bash
   npm start
   ```

2. O bot irá:
   - Conectar-se à Evolution API
   - Criar uma instância chamada `sales-bot-instance`
   - Gerar um QR Code para você escanear
   - Configurar webhooks automaticamente

3. **Escaneie o QR Code** com seu WhatsApp

## 📱 Passo 5: Testar a integração

Após escanear o QR Code e conectar:

1. Envie uma mensagem para o número conectado
2. Verifique os logs do bot
3. O webhook deve processar a mensagem automaticamente

## 🔧 Comandos Úteis

### Ver logs do Evolution API:
```powershell
docker logs -f evolution-api
```

### Parar a Evolution API:
```powershell
docker-compose -f docker-compose-evolution.yml down
```

### Reiniciar a Evolution API:
```powershell
docker-compose -f docker-compose-evolution.yml restart
```

### Remover tudo (incluindo dados):
```powershell
docker-compose -f docker-compose-evolution.yml down -v
```

## 🐛 Troubleshooting

### Problema: Porta 8080 já está em uso
**Solução:**
1. Edite `docker-compose-evolution.yml`
2. Mude `"8080:8080"` para `"8081:8080"` (ou outra porta)
3. Atualize `EVOLUTION_API_URL` no `.env` para `http://localhost:8081`

### Problema: Webhook não está recebendo mensagens
**Solução:**
1. Verifique se seu bot está rodando na porta 3000
2. Teste o webhook manualmente:
   ```powershell
   curl -X POST http://localhost:3000/webhook -H "Content-Type: application/json" -d "{\"event\":\"test\"}"
   ```

### Problema: QR Code não aparece
**Solução:**
1. Verifique os logs: `docker logs evolution-api`
2. Acesse manualmente: `http://localhost:8080/instance/qrcode/sales-bot-instance`

### Problema: Docker não está acessível via comando
**Solução:**
1. Certifique-se que o Docker Desktop está rodando
2. Reinicie o Docker Desktop
3. Use o PowerShell como Administrador

## 📊 Verificar Status da Instância

### Via API REST:
```bash
curl -H "apikey: my-secure-api-key-12345" http://localhost:8080/instance/connectionState/sales-bot-instance
```

### Via seu bot:
```
http://localhost:3000/status
```

## 🔒 Segurança

⚠️ **IMPORTANTE:** Antes de colocar em produção:

1. Mude a `EVOLUTION_API_KEY` no `.env` e no `docker-compose-evolution.yml` para uma chave segura e aleatória
2. Configure um domínio e HTTPS para produção
3. Use um banco de dados PostgreSQL ao invés de SQLite (opcional, mas recomendado)

## 📚 Documentação da Evolution API

- Documentação oficial: https://doc.evolution-api.com/
- GitHub: https://github.com/EvolutionAPI/evolution-api

## ✨ Próximos Passos

Após a integração funcionar:

1. Configure notificações de desconexão
2. Implemente retry logic para falhas de envio
3. Monitore os logs da Evolution API
4. Configure backups do banco de dados SQLite
5. Considere usar um gerenciador de processos como PM2

## 🆘 Suporte

Se encontrar problemas, verifique:
1. Logs do Docker: `docker logs evolution-api`
2. Logs do seu bot
3. Status da instância na Evolution API
4. Conectividade de rede entre containers

---

**Criado por:** Claude Code
**Data:** 2025-10-01
