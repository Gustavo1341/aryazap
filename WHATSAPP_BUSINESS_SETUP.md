# Configuração WhatsApp Business API com Evolution API

## 📋 Pré-requisitos

1. **Evolution API rodando** (via Docker)
2. **Número WhatsApp Business** cadastrado na Meta/Facebook
3. **Token de acesso** da WhatsApp Business API

## 🔧 Configuração da Instância

### 1. Acesse o Painel da Evolution API

```
http://localhost:8080
```

### 2. Configure a Instância WhatsApp Business

A instância já é criada automaticamente pelo bot com o nome definido em:
```
EVOLUTION_INSTANCE_NAME=Aryazap - Jaylton Lopes
```

### 3. Conecte o Número WhatsApp Business

No painel da Evolution API:

1. Vá em **Instâncias**
2. Localize: `Aryazap - Jaylton Lopes`
3. Configure os dados da WhatsApp Business API:
   - **Phone Number ID** (da Meta)
   - **Business Account ID**
   - **Access Token** (permanente)
4. Clique em **Conectar**

### 4. Configure o Webhook

O bot já configura automaticamente o webhook para:
```
http://seu-servidor:3000/webhook
```

Certifique-se de que este endereço é acessível pela Evolution API.

## 🔍 Verificação

### Estado da Conexão

O bot verifica automaticamente o estado a cada 10 segundos:
- ✅ `open` = Conectado e pronto
- ❌ `close` = Desconectado (verifique configuração)

### Logs Importantes

```
🟢 WHATSAPP BUSINESS API CONECTADA! [Aryazap - Jaylton Lopes]
```
= Tudo funcionando!

```
⚠️ Instância ainda desconectada. Verifique o painel da Evolution API.
```
= Precisa configurar no painel da Evolution

## 🚨 Troubleshooting

### Instância fica em estado "close"

1. Verifique se o número WhatsApp Business está ativo na Meta
2. Confirme que o token de acesso não expirou
3. Verifique logs da Evolution API: `docker logs evolution-api`
4. Teste a API manualmente: `GET http://localhost:8080/instance/connectionState/Aryazap%20-%20Jaylton%20Lopes`

### Webhook não recebe mensagens

1. Confirme que o webhook está configurado na instância
2. Verifique se a URL do webhook é acessível
3. Teste: envie uma mensagem para o número Business
4. Verifique logs: `[API Webhook] Recebido: event=messages.upsert`

## 📊 Variáveis de Ambiente Necessárias

```env
# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=sua-chave-api-evolution
EVOLUTION_INSTANCE_NAME=Aryazap - Jaylton Lopes

# Webhook
WEBHOOK_URL=http://seu-servidor:3000/webhook
PORT=3000
```

## 📞 Diferenças entre WhatsApp Web e Business API

| Recurso | WhatsApp Web | WhatsApp Business API |
|---------|--------------|----------------------|
| Autenticação | QR Code | Token da Meta |
| Limite de mensagens | Baixo | Alto (paid tier) |
| Webhooks | Sim | Sim |
| Sessão | Expira facilmente | Persistente |
| Custo | Grátis | Pago (após tier gratuito) |

## ✅ Checklist de Configuração

- [ ] Evolution API rodando
- [ ] Número WhatsApp Business cadastrado na Meta
- [ ] Token de acesso gerado (permanente)
- [ ] Instância criada no Evolution API
- [ ] Credenciais configuradas no painel
- [ ] Estado da instância = "open"
- [ ] Webhook configurado e acessível
- [ ] Bot recebendo webhooks

---

**Última atualização:** 2025-10-01
