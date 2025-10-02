import express from 'express';
import axios from 'axios';

const app = express();
app.use(express.json());

const PORT = 3001;
const VERIFY_TOKEN = 'meu_token_webhook_2025';

// Configurações do seu bot
const YOUR_BOT_WEBHOOK = 'http://localhost:3000/webhook';
const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0/785005758035788/messages';
const WHATSAPP_ACCESS_TOKEN = 'EAFTsItWJ4bQBPnVMAGVNT08HDqDCPzcf5AiCOSOjZBhqWGYGwgmo0OTKZCs471AAC7GAjVQqreiq2Xk6oAr7AqgHiP89vBZBZCZAU8wvpZB5EL6C1lC1qIaWIs2j4WhqJOAByyUmDZA275L0wyKGGatB2yEcZArniSdZBHmgrju3Od5pmIyo3nNuYfr1WucBxXfj9T5PCJh0dWbbkKpI2taoZBlMKyTLOvSpE7D0dxFe4tiTCt5OMzUG9D11yxDsjr6gZDZD';

// Endpoint de verificação do webhook (Meta envia GET para validar)
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('📞 Verificação do webhook da Meta:');
  console.log('  Mode:', mode);
  console.log('  Token recebido:', token);
  console.log('  Token esperado:', VERIFY_TOKEN);
  console.log('  Challenge:', challenge);

  // A Meta espera que você retorne o challenge de volta
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verificado! Retornando challenge...');
    res.status(200).send(challenge); // IMPORTANTE: retornar o challenge exato
  } else {
    console.log('❌ Token inválido!');
    res.status(403).send('Forbidden');
  }
});

// Endpoint para receber mensagens (Meta envia POST)
app.post('/webhook', async (req, res) => {
  console.log('📨 Webhook recebido da Meta');

  // Responde imediatamente para a Meta
  res.status(200).send('EVENT_RECEIVED');

  try {
    const { entry } = req.body;

    if (entry && entry[0]?.changes) {
      const changes = entry[0].changes;

      for (const change of changes) {
        if (change.value?.messages) {
          const messages = change.value.messages;

          for (const message of messages) {
            const from = message.from;
            const text = message.text?.body || '';
            const messageType = message.type;
            const messageId = message.id;

            console.log('💬 Nova mensagem:', {
              de: from,
              tipo: messageType,
              texto: text,
              id: messageId
            });

            // Encaminhar para seu bot no formato que ele espera
            try {
              console.log('📤 Encaminhando para seu bot em:', YOUR_BOT_WEBHOOK);

              const botPayload = {
                from: from,
                body: text,
                type: messageType,
                id: messageId,
                timestamp: message.timestamp,
                // Adicione outros campos que seu bot precisa
              };

              const response = await axios.post(YOUR_BOT_WEBHOOK, botPayload);
              console.log('✅ Bot respondeu:', response.status);
            } catch (botError) {
              console.error('❌ Erro ao enviar para o bot:', botError.message);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error);
  }
});

app.get('/status', (req, res) => {
  res.json({
    status: 'online',
    port: PORT,
    verify_token: VERIFY_TOKEN,
    instructions: {
      callback_url: 'https://[SEU-NGROK-URL]/webhook',
      verify_token: VERIFY_TOKEN
    }
  });
});

app.listen(PORT, () => {
  console.log('\n🚀 Webhook Proxy para Meta iniciado!');
  console.log('📍 Porta:', PORT);
  console.log('🔗 URL local:', `http://localhost:${PORT}/webhook`);
  console.log('🔑 Token de verificação:', VERIFY_TOKEN);
  console.log('\n📋 Configure na Meta:');
  console.log('   1. Inicie ngrok na porta 3001: ngrok http 3001');
  console.log('   2. Callback URL: https://[URL-DO-NGROK]/webhook');
  console.log('   3. Verify Token:', VERIFY_TOKEN);
  console.log('\n✅ Aguardando validação da Meta...\n');
});
