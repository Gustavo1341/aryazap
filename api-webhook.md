em?..."
18:27:40 TRACE [Ctx:557788621185] [Part 1/2] Não é possível simular 'digitando'. Usando delay fixo de 677ms...
18:27:41 TRACE [Ctx:557788621185] [Part 1/2] Preparando para enviar mensagem AGORA...
18:27:41 TRACE [Ctx:557788621185] [Part 1/2] Enviando texto: "Boa noite, aqui é o Pedro do DPA. Tudo bem?..."
18:27:41 DEBUG [System] [Evolution API Send] Enviando mensagem para 557788621185 via instância Aryazap - Jaylton Lopes
18:27:41 ERROR [System] [Evolution API Send] ❌ Erro ao enviar mensagem para 557788621185@c.us: | { errorMessage: 'Request failed with status code 400', errorResponse: { status: 400, error: 'Ba...
  ↳ Error: {
  message: 'Request failed with status code 400',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 400\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at IncomingMessage.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at IncomingMessage.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:754:22)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:221:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:817:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1864:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:910:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:493:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 30000,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      apikey: 'B6D711FCDE4D4FD5936544120E713976',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '79',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    baseURL: 'http://localhost:8080',
    method: 'post',
    url: '/message/sendText/Aryazap%20-%20Jaylton%20Lopes',
    data: '{"number":"557788621185","text":"Boa noite, aqui é o Pedro do DPA. Tudo bem?"}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 400
}
    message: 'Request failed with status code 400',
    name: 'AxiosError',
    description: undefined,
18:27:41 ERROR [Ctx:557788621185] [Part 1/2] Falha ao enviar texto para 557788621185@c.us: "Boa noite, aqui é o Pedro do DPA. Tudo bem?..."
  ↳ Error: {
  message: 'Request failed with status code 400',
  name: 'AxiosError',
  description: undefined,
  number: undefined,
  fileName: undefined,
  lineNumber: undefined,
  columnNumber: undefined,
  stack: 'AxiosError: Request failed with status code 400\n' +
    '    at settle (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/settle.js:19:12)\n' +
    '    at IncomingMessage.handleStreamEnd (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/adapters/http.js:599:11)\n' +
    '    at IncomingMessage.emit (node:events:531:35)\n' +
    '    at endReadableNT (node:internal/streams/readable:1698:12)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:90:21)\n' +
    '    at Axios.request (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/node_modules/axios/lib/core/Axios.js:45:41)\n' +
    '    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)\n' +
    '    at async Object.sendMessage (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/whatsappClient.js:754:22)\n' +
    '    at async _sendSingleMessagePart (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:221:17)\n' +
    '    at async Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:817:28)\n' +
    '    at async Module.callAndRespondWithAI (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/aiProcessor.js:1864:41)\n' +
    '    at async _handleBufferedMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:910:7)\n' +
    '    at async Timeout._onTimeout (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/messageHandler.js:493:13)',
  config: {
    transitional: {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    },
    adapter: [ 'xhr', 'http', 'fetch' ],
    transformRequest: [ [Function: transformRequest] ],
    transformResponse: [ [Function: transformResponse] ],
    timeout: 30000,
    xsrfCookieName: 'XSRF-TOKEN',
    xsrfHeaderName: 'X-XSRF-TOKEN',
    maxContentLength: -1,
    maxBodyLength: -1,
    env: { FormData: [Function [FormData]], Blob: [class Blob] },
    validateStatus: [Function: validateStatus],
    headers: Object [AxiosHeaders] {
      Accept: 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      apikey: 'B6D711FCDE4D4FD5936544120E713976',
      'User-Agent': 'axios/1.9.0',
      'Content-Length': '79',
      'Accept-Encoding': 'gzip, compress, deflate, br'
    },
    baseURL: 'http://localhost:8080',
    method: 'post',
    url: '/message/sendText/Aryazap%20-%20Jaylton%20Lopes',
    data: '{"number":"557788621185","text":"Boa noite, aqui é o Pedro do DPA. Tudo bem?"}',
    allowAbsoluteUrls: true
  },
  code: 'ERR_BAD_REQUEST',
  status: 400
}
    message: 'Request failed with status code 400',
    name: 'AxiosError',
    description: undefined,
18:27:41 TRACE [System] [DB Query OK] | { duration: '4.4ms', query_start: ' WITH updated_base AS ( SELECT state_data || $1::jso...', params_...
18:27:41 ERROR [System] [Response Sender] Falha ao enviar parte de texto 1/2 para Gustavo. Continuando sequência...
  ↳ Error: '557788621185@c.us'
    at Object.error (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/logger.js:395:127)
    at Object.sendMessages (file:///C:/Users/Gustavo%20Brand%C3%A3o/Documents/aryaAgent/aryazap/responseSender.js:829:14)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
18:27:43 DEBUG [Ctx:557788621185] [Response Sender Loop] Preparando envio Texto Parte 2/2: "Vi que seu nome aqui no WhatsApp é Gustavo Brandão. Posso te chamar assim, ou prefere outro nome?..."
18:27:43 TRACE [Ctx:557788621185] [Part 2/2] Não é possível simular 'digitando'. Usando delay fixo de 613ms...
18:27:43 WARN  [System] Sinal SIGINT (Ctrl+C) recebido.