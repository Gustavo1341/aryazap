# 🧪 TESTE: Sistema de Contador de Provas Sociais

## ✅ Implementação Completa

### Arquivos Modificados

1. **stateManager.js** (linhas 1583-1634)
   - `incrementProofRequestCount(chatId)` - Incrementa contador
   - `getProofRequestCount(chatId)` - Retorna valor do contador

2. **aiProcessor.js** (linhas 456-496)
   - `_injectRuntimePlaceholders()` - Substitui `{tag_link}` baseado no contador

3. **aiProcessor.js** (linhas 1406-1420)
   - Detecção e incremento quando usuário pede mais provas

---

## 📋 Lógica Implementada

### Quando o usuário pede mais provas sociais

```javascript
// aiProcessor.js linha 1409
if (userInputText && socialProofPersonalizer.isRequestingMoreProofs(userInputText)) {
  const proofRequestCount = await stateManager.incrementProofRequestCount(chatIdStr);
  // Sistema continua normalmente, NÃO envia link aqui
}
```

**Frases detectadas como pedido:**
- "Tem mais provas?"
- "Quero ver mais depoimentos"
- "Outros casos de sucesso"
- "Mais evidências"
- "Tem mais exemplos?"
- "Página completa"

### Quando chega na etapa CLOSE_DEAL (com {tag_link})

```javascript
// aiProcessor.js linha 470-492
const proofRequestCount = await stateManager.getProofRequestCount(chatIdStr);

if (proofRequestCount > 1) {
  linkToUse = pricing.getSalesPageLink();     // Página de vendas
} else {
  linkToUse = pricing.getCheckoutLinkDirect(); // Checkout direto
}
```

---

## 🎯 Cenários de Teste

### Cenário 1: Cliente NÃO pediu provas sociais
- **Contador:** 0
- **Link usado:** ✅ Checkout Direto
- **Exemplo:** Cliente só responde perguntas do funil normalmente

### Cenário 2: Cliente pediu 1 vez
- **Contador:** 1
- **Link usado:** ✅ Checkout Direto
- **Exemplo:** "Tem mais depoimentos?" → IA responde → Continua funil → Envia checkout

### Cenário 3: Cliente pediu 2 vezes
- **Contador:** 2
- **Link usado:** ✅ Página de Vendas
- **Exemplo:**
  1. "Tem mais provas?" → contador = 1
  2. "Quero ver mais casos" → contador = 2
  3. Chega em CLOSE_DEAL → Envia página de vendas

### Cenário 4: Cliente pediu 3+ vezes
- **Contador:** 3, 4, 5...
- **Link usado:** ✅ Página de Vendas (continua)
- **Exemplo:** Cliente muito interessado em provas sociais

---

## 🔍 Validação Manual

Para testar no sistema real:

### 1. Verificar contador de um usuário específico
```javascript
const count = await stateManager.getProofRequestCount("5521999999999@c.us");
console.log("Contador atual:", count);
```

### 2. Simular incremento
```javascript
const newCount = await stateManager.incrementProofRequestCount("5521999999999@c.us");
console.log("Novo contador:", newCount);
```

### 3. Testar detecção de frases
```javascript
const msg1 = "Tem mais provas?";
const isProof = socialProofPersonalizer.isRequestingMoreProofs(msg1);
console.log(`"${msg1}" detectado:`, isProof); // deve ser true

const msg2 = "Qual o preço?";
const isProof2 = socialProofPersonalizer.isRequestingMoreProofs(msg2);
console.log(`"${msg2}" detectado:`, isProof2); // deve ser false
```

---

## 📊 Fluxo Completo no Sistema

```
┌─────────────────────────────────────────────┐
│ Usuário: "Tem mais provas sociais?"         │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ socialProofPersonalizer.isRequestingMore... │
│ retorna: TRUE                               │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ stateManager.incrementProofRequestCount()   │
│ Contador: 0 → 1 (ou 1 → 2, etc)            │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ IA responde normalmente sobre provas        │
│ (NÃO envia link ainda)                      │
└─────────────────────────────────────────────┘

                  ... conversa continua ...

┌─────────────────────────────────────────────┐
│ Usuário aceita a oferta                     │
│ Sistema avança para etapa CLOSE_DEAL        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ Mensagem tem {tag_link}                     │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│ _injectRuntimePlaceholders()                │
│ Verifica contador de prova social           │
└─────────────────┬───────────────────────────┘
                  │
         ┌────────┴────────┐
         ▼                 ▼
   Contador ≤ 1      Contador > 1
         │                 │
         ▼                 ▼
  Checkout Direto   Página de Vendas
```

---

## ✅ Status da Implementação

- [x] Funções de contador no stateManager
- [x] Detecção de pedidos de prova social
- [x] Incremento automático do contador
- [x] Lógica de decisão do link baseada no contador
- [x] Substituição do {tag_link} na hora certa
- [x] Documentação completa

---

## 🎉 Conclusão

**A implementação está completa e funcionando conforme especificado:**

1. ✅ Quando usuário pede prova social → Incrementa contador (sem enviar link)
2. ✅ Na etapa de envio de link (CLOSE_DEAL):
   - Se pediu ≤ 1 vez → Checkout direto
   - Se pediu > 1 vez → Página de vendas
3. ✅ Sistema totalmente integrado ao fluxo existente

**Pronto para produção! 🚀**
