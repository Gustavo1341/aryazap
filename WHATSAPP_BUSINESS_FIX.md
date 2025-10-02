# Correção do Erro 400 - WhatsApp Business API + Evolution API

## Problema Identificado

O erro `Cannot read properties of undefined (reading '0')` ocorre porque:

1. **Evolution API v2.2.3 tem incompatibilidade** com o endpoint `/message/sendText/` quando a integração é `WHATSAPP-BUSINESS`
2. A Evolution API atua como proxy, mas não consegue processar corretamente as mensagens para a Graph API

## Solução Implementada

O arquivo `whatsappClient.js` foi atualizado para **usar diretamente a Graph API do Meta** quando detectar WhatsApp Business:

```javascript
// Agora verifica se existe WA_BUSINESS_TOKEN configurado
if (WA_BUSINESS_TOKEN && WA_BUSINESS_PHONE_NUMBER_ID) {
  // Usa Graph API direta
  const response = await axios.post(
    `https://graph.facebook.com/v23.0/${WA_BUSINESS_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: number,
      type: "text",
      text: { body: message }
    },
    {
      headers: {
        'Authorization': `Bearer ${WA_BUSINESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );
}
```

## Configuração Necessária

### 1. Renovar Access Token (Se Expirado)

O erro `error_subcode: 33` indica que o token pode estar expirado. Para renovar:

1. Acesse [Meta Business Suite](https://business.facebook.com/)
2. Vá em **WhatsApp** > **API Setup**
3. Clique em **Generate Access Token**
4. Copie o novo token
5. Atualize o `.env`:

```env
WA_BUSINESS_TOKEN=SEU_NOVO_TOKEN_AQUI
```

### 2. Verificar Permissões

Certifique-se de que seu WhatsApp Business Account tem as permissões:
- `whatsapp_business_messaging`
- `whatsapp_business_management`

### 3. Verificar Phone Number ID

Confirme que o Phone Number ID está correto:

```env
WA_BUSINESS_PHONE_NUMBER_ID=785005758035788
WA_BUSINESS_ID=1950390949146130
```

## Teste da Configuração

Execute este comando para testar se o token está válido:

```bash
curl -X GET "https://graph.facebook.com/v23.0/785005758035788" \
  -H "Authorization: Bearer SEU_TOKEN"
```

Se retornar dados do número, o token está válido. Se retornar erro 100, o token expirou ou não tem permissões.

## Fluxo Atualizado

1. **Webhook recebe mensagem** → Evolution API converte para formato padrão
2. **Agente processa** → Gera resposta via IA
3. **Envio de resposta** → Detecta WhatsApp Business e usa Graph API direta
4. **Mensagem entregue** → Bypass da Evolution API no envio

## Arquivos Modificados

- ✅ `whatsappClient.js` - Função `sendMessage()` atualizada
- 📝 `.env` - Requer `WA_BUSINESS_TOKEN` válido

## Próximos Passos

1. Renovar o Access Token no Meta Business Manager
2. Atualizar `.env` com novo token
3. Reiniciar aplicação: `npm start`
4. Testar envio de mensagem

## Logs para Monitorar

Procure por estas mensagens nos logs:

```
✅ [WhatsApp Business] Enviando via Graph API direta
✅ [WhatsApp Business] Mensagem enviada para XXX via Graph API
```

Se aparecer fallback warning, significa que o token não está configurado:

```
⚠️  [Evolution API Send] WhatsApp Business token não configurado
```
