23:08:32 DEBUG [System] [WhatsApp Business] Enviando com citação (context) da mensagem ID: wamid.HBgMNTU3Nzg4NjIxMTg1FQIAEhgWM0VCMEY2NDA3MjMwNUQxNkU4QTc4NgA=
23:08:32 ERROR [System] [Evolution API Send] ❌ Erro ao enviar mensagem para 557788621185@c.us: | { errorMessage: 'Request failed with status code 401', errorResponse: { error: [Object] }, errorStat...
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '303',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Excelente decisão, Gustavo! Tenho certeza de que será um divisor de águas na sua advocacia."},"context":{"message_id":"wamid.HBgMNTU3Nzg4NjIxMTg1FQIAEhgWM0VCMEY2NDA3MjMwNUQxNkU4QTc4NgA="}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:32 ERROR [Ctx:557788621185] [Part 1/4] Falha ao enviar texto para 557788621185@c.us: "Excelente decisão, Gustavo! Tenho certeza de que s..."
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '303',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Excelente decisão, Gustavo! Tenho certeza de que será um divisor de águas na sua advocacia."},"context":{"message_id":"wamid.HBgMNTU3Nzg4NjIxMTg1FQIAEhgWM0VCMEY2NDA3MjMwNUQxNkU4QTc4NgA="}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:32 TRACE [System] [DB Query OK] | { duration: '17.1ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params...
23:08:32 ERROR [System] [Response Sender] Falha ao enviar parte de texto 1/4 para Gustavo. Continuando sequência...
  ↳ Error: '557788621185@c.us'
    at Object.error (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/logger.js:395:127)
    at Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:868:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
23:08:34 DEBUG [Ctx:557788621185] [Response Sender Loop] Preparando envio Texto Parte 2/4: "Aqui está o link seguro para você garantir sua vaga: https://direitoprocessualaplicado.com.br/pos-gr..."
23:08:34 TRACE [Ctx:557788621185] [Response Sender] Estado do cliente: open
23:08:34 TRACE [Ctx:557788621185] [Part 2/4] Não é possível simular 'digitando'. Usando delay fixo de 571ms...
23:08:34 TRACE [Ctx:557788621185] [Part 2/4] Preparando para enviar mensagem AGORA...
23:08:34 TRACE [Ctx:557788621185] [Part 2/4] Enviando texto: "Aqui está o link seguro para você garantir sua vaga: https://direitoprocessualap..."
23:08:34 DEBUG [System] [Evolution API Send] Enviando mensagem para 557788621185 via instância Aryazap - Jaylton Lopes
23:08:34 DEBUG [System] [WhatsApp Business] Enviando via Graph API direta
23:08:35 ERROR [System] [Evolution API Send] ❌ Erro ao enviar mensagem para 557788621185@c.us: | { errorMessage: 'Request failed with status code 401', errorResponse: { error: [Object] }, errorStat...
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '244',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Aqui está o link seguro para você garantir sua vaga: https://direitoprocessualaplicado.com.br/pos-graduacao-direito-sucessorio/"}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:35 ERROR [Ctx:557788621185] [Part 2/4] Falha ao enviar texto para 557788621185@c.us: "Aqui está o link seguro para você garantir sua vag..."
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '244',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Aqui está o link seguro para você garantir sua vaga: https://direitoprocessualaplicado.com.br/pos-graduacao-direito-sucessorio/"}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:35 TRACE [System] [DB Query OK] | { duration: '16.2ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params...
23:08:35 ERROR [System] [Response Sender] Falha ao enviar parte de texto 2/4 para Gustavo. Continuando sequência...
  ↳ Error: '557788621185@c.us'
    at Object.error (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/logger.js:395:127)
    at Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:868:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
23:08:36 DEBUG [Ctx:557788621185] [Response Sender Loop] Preparando envio Texto Parte 3/4: "Lembrando que o investimento é de 12x de R$ 194,56 no cartão ou R$ 1.997,00 à vista via PIX. Você es..."
23:08:36 TRACE [Ctx:557788621185] [Response Sender] Estado do cliente: open
23:08:36 TRACE [Ctx:557788621185] [Part 3/4] Não é possível simular 'digitando'. Usando delay fixo de 576ms...
23:08:37 TRACE [Ctx:557788621185] [Part 3/4] Preparando para enviar mensagem AGORA...
23:08:37 TRACE [Ctx:557788621185] [Part 3/4] Enviando texto: "Lembrando que o investimento é de 12x de R$ 194,56 no cartão ou R$ 1.997,00 à vi..."
23:08:37 DEBUG [System] [Evolution API Send] Enviando mensagem para 557788621185 via instância Aryazap - Jaylton Lopes
23:08:37 DEBUG [System] [WhatsApp Business] Enviando via Graph API direta
23:08:37 ERROR [System] [Evolution API Send] ❌ Erro ao enviar mensagem para 557788621185@c.us: | { errorMessage: 'Request failed with status code 401', errorResponse: { error: [Object] }, errorStat...
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '266',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Lembrando que o investimento é de 12x de R$ 194,56 no cartão ou R$ 1.997,00 à vista via PIX. Você escolhe a melhor opção na página de pagamento."}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:37 ERROR [Ctx:557788621185] [Part 3/4] Falha ao enviar texto para 557788621185@c.us: "Lembrando que o investimento é de 12x de R$ 194,56..."
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '266',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"Lembrando que o investimento é de 12x de R$ 194,56 no cartão ou R$ 1.997,00 à vista via PIX. Você escolhe a melhor opção na página de pagamento."}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:37 TRACE [System] [DB Query OK] | { duration: '18.0ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params...
23:08:37 ERROR [System] [Response Sender] Falha ao enviar parte de texto 3/4 para Gustavo. Continuando sequência...
  ↳ Error: '557788621185@c.us'
    at Object.error (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/logger.js:395:127)
    at Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:868:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
23:08:39 DEBUG [Ctx:557788621185] [Response Sender Loop] Preparando envio Texto Parte 4/4: "É só me avisar assim que finalizar, ok?..."
23:08:39 TRACE [Ctx:557788621185] [Response Sender] Estado do cliente: open
23:08:39 TRACE [Ctx:557788621185] [Part 4/4] Não é possível simular 'digitando'. Usando delay fixo de 758ms...
23:08:39 TRACE [Ctx:557788621185] [Part 4/4] Preparando para enviar mensagem AGORA...
23:08:39 TRACE [Ctx:557788621185] [Part 4/4] Enviando texto: "É só me avisar assim que finalizar, ok?..."
23:08:39 DEBUG [System] [Evolution API Send] Enviando mensagem para 557788621185 via instância Aryazap - Jaylton Lopes
23:08:39 DEBUG [System] [WhatsApp Business] Enviando via Graph API direta
23:08:40 ERROR [System] [Evolution API Send] ❌ Erro ao enviar mensagem para 557788621185@c.us: | { errorMessage: 'Request failed with status code 401', errorResponse: { error: [Object] }, errorStat...
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '156',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"É só me avisar assim que finalizar, ok?"}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:40 ERROR [Ctx:557788621185] [Part 4/4] Falha ao enviar texto para 557788621185@c.us: "É só me avisar assim que finalizar, ok?..."
  ↳ Error: {
  message: 'Request failed with status code 401',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 401\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at BrotliDecompress.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at BrotliDecompress.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +  
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +  
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:811:24)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:254:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:854:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1843:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:930:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:494:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 0,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      Authorization: 'Bearer EAFTsItWJ4bQBPgjyS1GodQ2rtP3CrAOATZA8ZAYuakQhqRigM8HyTnGGzYRJZCIE7Ustx9eKUGGEgcHrn2ZCWf9TJnAVLZB6hy90tMHZBYXT1GlnZCc0LmnmLxmDZBEZAxAE1oyxMO9565lgdkhu90ElwFZCBBpZCvDnRPIrlTCKk1YDLsuP1Xm2ef7xfZAiZCX81ZCS771v1pp2U9ly0piNz5ehj3ylvVdSdQZAzvoaCSJXNwSkYlYiwZDZD',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '156',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    method: 'post',
    url: 'https://graph.facebook.com/v23.0/785005758035788/messages',
    data: '{"messaging_product":"whatsapp","recipient_type":"individual","to":"557788621185","type":"text","text":{"body":"É só me avisar assim que finalizar, ok?"}}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 401
}
    message: 'Request failed with status code 401',
    name: 'AxiosError',
    description: undefined,
23:08:40 TRACE [System] [DB Query OK] | { duration: '6.2ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params_...
23:08:40 ERROR [System] [Response Sender] Falha ao enviar parte de texto 4/4 para Gustavo. Continuando sequência...
  ↳ Error: '557788621185@c.us'
    at Object.error (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/logger.js:395:127)
    at Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:868:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
23:08:41 DEBUG [Ctx:557788621185] [Response Sender] Sequência de envio concluída para Gustavo. Sucesso geral: false
23:08:41 INFO  [Ctx:557788621185] [AI Processor] Envio de mensagens concluído. Sucesso: false
23:08:41 DEBUG [Ctx:557788621185] [AI Processor] Mensagens enviadas mas etapa NÃO marcada como concluída (IA não usou tag de ação).
23:08:41 TRACE [System] [DB Query OK] | { duration: '5.7ms', query_start: 'INSERT INTO chat_states (chat_id, tenant_id, state_data, last_updated)...
23:08:41 TRACE [System] [DB Query OK] | { duration: '2.6ms', query_start: 'SELECT state_data FROM chat_states WHERE chat_id = $1 AND tenant_id = ...
23:08:41 WARN  [System] [State Mgr GetChatState] Falha ao obter nome atualizado para 557788621185@c.us via whatsappClient: clientInstance.getChatById is not a function
23:08:41 DEBUG [Ctx:557788621185] [State Mgr DB] Estado encontrado para 557788621185@c.us após upsert atômico.
23:08:41 TRACE [System] [State Mgr] Timestamp da última interação atualizado para 1759370921800 para 557788621185@c.us
23:08:41 INFO  [Ctx:557788621185] [NextStepLogic] Mantendo etapa atual CLOSE_DEAL. Avanço só ocorrerá com tag [ACTION: ADVANCE_FUNNEL] da IA.
23:08:41 DEBUG [Ctx:557788621185] [AI Processor] Nenhuma alteração de estado necessária. Etapa: CLOSE_DEAL, Metadados não alterados.
23:08:41 DEBUG [Ctx:557788621185] [AI Processor] 🔄 Timer de inatividade iniciado após processamento completo
23:08:41 TRACE [Ctx:557788621185] [AI Processor] Processamento concluído. Etapa atual: CLOSE_DEAL. Próximo avanço dependente da decisão da IA.
23:08:41 TRACE [System] [State Mgr Cache] Flag 'processingStartTime' limpa para 557788621185@c.us
23:08:41 TRACE [System] [State Mgr Cache] Flag 'isProcessing' atualizada para false para 557788621185@c.us
23:08:41 TRACE [System] [State Mgr Cache] Flag 'processingStartTime' atualizada explicitamente para null para 557788621185@c.us
23:08:41 TRACE [Ctx:557788621185] [AI Processor] Timer de inatividade gerenciado após envio das mensagens para 557788621185@c.us
23:08:41 TRACE [Ctx:557788621185] [AI Processor] Trava isProcessing liberada para 557788621185@c.us.
23:08:41 DEBUG [Ctx:557788621185] [Buffer Proc] Processamento de 2 mensagem(s) concluído, aguardando resposta do bot
23:08:41 DEBUG [Ctx:557788621185] [Buffer Proc] Processamento concluído para 557788621185@c.us
23:08:41 DEBUG [Ctx:557788621185] [Buffer Proc] Liberando trava isProcessing para 557788621185@c.us no finally.
23:08:41 TRACE [System] [State Mgr Cache] Flag 'processingStartTime' limpa para 557788621185@c.us
23:08:41 TRACE [System] [State Mgr Cache] Flag 'isProcessing' atualizada para false para 557788621185@c.us
23:08:41 TRACE [System] [State Mgr Cache] Flag 'processingStartTime' atualizada explicitamente para null para 557788621185@c.us
23:08:41 TRACE [Ctx:557788621185] [Buffer Proc] Flag isProcessingBuffer (em memória) liberada para 557788621185@c.us no finally.
23:08:41 TRACE [Ctx:557788621185] [Buffer Timeout] Flag isProcessingBuffer liberada para 557788621185@c.us
23:08:41 TRACE [System] [DB Query OK] | { duration: '122.0ms', query_start: 'INSERT INTO chat_states (chat_id, tenant_id, state_data, last_update...
23:08:41 TRACE [System] [DB Query OK] | { duration: '9.1ms', query_start: 'SELECT state_data FROM chat_states WHERE chat_id = $1 AND tenant_id = ...
23:08:41 WARN  [System] [State Mgr GetChatState] Falha ao obter nome atualizado para 557788621185@c.us via whatsappClient: clientInstance.getChatById is not a function
23:08:41 DEBUG [Ctx:557788621185] [State Mgr DB] Estado encontrado para 557788621185@c.us após upsert atômico.
23:08:41 DEBUG [Ctx:{ chatId: '557788621] [Inactivity Mgr] Flag de abort anterior limpa para novo ciclo de inatividade
23:08:41 TRACE [System] [DB Query OK] | { duration: '4.3ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params_...
23:08:41 DEBUG [Ctx:{ chatId: '557788621] Timer de inatividade iniciado
