import { readFileSync } from 'fs';

/**
 * Teste para validar a preferência de link (checkout vs salesPage)
 * Este teste verifica a estrutura dos arquivos e a implementação
 * quando a flag usesSalesPageLink está ativa
 */

async function testLinkPreference() {
    console.log('🧪 Iniciando testes de preferência de link...\n');

    // Teste 1: Verificar estrutura do pricing.js
    console.log('📋 Teste 1: Verificando estrutura do pricing.js');
    try {
        const pricingContent = readFileSync('./pricing.js', 'utf8');
        
        const hasCheckoutLink = pricingContent.includes('checkoutLink');
        const hasSalesPage = pricingContent.includes('salesPage');
        const hasGetCheckoutLink = pricingContent.includes('getCheckoutLink');
        const hasGetSalesPageLink = pricingContent.includes('getSalesPageLink');
        const hasGetLinkByContext = pricingContent.includes('getLinkByContext');
        
        console.log('✅ pricing.js encontrado');
        console.log('   - Tem checkoutLink:', hasCheckoutLink);
        console.log('   - Tem salesPage:', hasSalesPage);
        console.log('   - Tem getCheckoutLink:', hasGetCheckoutLink);
        console.log('   - Tem getSalesPageLink:', hasGetSalesPageLink);
        console.log('   - Tem getLinkByContext:', hasGetLinkByContext);
        
    } catch (error) {
        console.log('❌ Erro ao ler pricing.js:', error.message);
    }

    // Teste 2: Verificar estrutura do stateManager.js
    console.log('\n📋 Teste 2: Verificando estrutura do stateManager.js');
    try {
        const stateManagerContent = readFileSync('./stateManager.js', 'utf8');
        
        const hasUpdateLinkPreference = stateManagerContent.includes('updateLinkPreference');
        const hasGetLinkPreference = stateManagerContent.includes('getLinkPreference');
        const hasUsesSalesPageLink = stateManagerContent.includes('usesSalesPageLink');
        
        console.log('✅ stateManager.js encontrado');
        console.log('   - Tem updateLinkPreference:', hasUpdateLinkPreference);
        console.log('   - Tem getLinkPreference:', hasGetLinkPreference);
        console.log('   - Tem usesSalesPageLink:', hasUsesSalesPageLink);
        
    } catch (error) {
        console.log('❌ Erro ao ler stateManager.js:', error.message);
    }

    // Teste 3: Verificar estrutura do aiProcessor.js
    console.log('\n📋 Teste 3: Verificando estrutura do aiProcessor.js');
    try {
        const aiProcessorContent = readFileSync('./aiProcessor.js', 'utf8');
        
        const hasBuildRuntimeContextData = aiProcessorContent.includes('_buildRuntimeContextData');
        const hasUsesSalesPageLinkLogic = aiProcessorContent.includes('usesSalesPageLink');
        const hasRecommendedCheckoutLink = aiProcessorContent.includes('recommendedCheckoutLink');
        const hasUpsellCheckoutLink = aiProcessorContent.includes('upsellCheckoutLink');
        const hasSalesPageFallback = aiProcessorContent.includes('salesPage') && aiProcessorContent.includes('checkoutLink');
        
        console.log('✅ aiProcessor.js encontrado');
        console.log('   - Tem _buildRuntimeContextData:', hasBuildRuntimeContextData);
        console.log('   - Tem lógica usesSalesPageLink:', hasUsesSalesPageLinkLogic);
        console.log('   - Tem recommendedCheckoutLink:', hasRecommendedCheckoutLink);
        console.log('   - Tem upsellCheckoutLink:', hasUpsellCheckoutLink);
        console.log('   - Tem fallback salesPage/checkoutLink:', hasSalesPageFallback);
        
        // Verificar se tem a lógica específica de substituição
        const salesPageLogicLines = aiProcessorContent.split('\n').filter(line => 
            line.includes('usesSalesPageLink') || 
            line.includes('salesPage') || 
            line.includes('recommendedCheckoutLink')
        );
        
        if (salesPageLogicLines.length > 0) {
            console.log('   - Exemplos de linhas com lógica:');
            salesPageLogicLines.slice(0, 3).forEach(line => {
                console.log('     >', line.trim());
            });
        }
        
    } catch (error) {
        console.log('❌ Erro ao ler aiProcessor.js:', error.message);
    }

    // Teste 4: Verificar se tem produtos definidos
    console.log('\n📋 Teste 4: Verificando estrutura de produtos');
    try {
        const pricingContent = readFileSync('./pricing.js', 'utf8');
        
        // Procurar por produtos e planos
        const productMatches = pricingContent.match(/mainProduct\s*=\s*{([^}]+)}/s);
        if (productMatches) {
            console.log('✅ Produto principal encontrado');
            
            const checkoutLinkMatch = productMatches[1].match(/checkoutLink:\s*['"`]([^'"`]+)['"`]/);
            const salesPageMatch = productMatches[1].match(/salesPage:\s*['"`]([^'"`]+)['"`]/);
            
            console.log('   - Checkout Link:', checkoutLinkMatch ? checkoutLinkMatch[1] : 'Não encontrado');
            console.log('   - Sales Page:', salesPageMatch ? salesPageMatch[1] : 'Não encontrado');
        } else {
            console.log('❌ Produto principal não encontrado');
        }
        
    } catch (error) {
        console.log('❌ Erro ao verificar produtos:', error.message);
    }

    console.log('\n🎯 Testes concluídos! Verifique os resultados acima.');
    console.log('\n💡 Para testes funcionais completos:');
    console.log('   1. Inicie o servidor: node main.js');
    console.log('   2. Envie uma mensagem solicitando "mais provas"');
    console.log('   3. Verifique se os links usam salesPage ao invés de checkout');
}

// Executar testes
if (import.meta.url === `file://${process.argv[1]}`) {
    testLinkPreference().catch(console.error);
}

export { testLinkPreference };