# AryaZap AI Sales Agent - Copilot Instructions

## System Architecture

**AryaZap** is a sophisticated WhatsApp-based AI sales agent built with Node.js ES6 modules, designed for lead qualification and sales automation. The system follows a modular event-driven architecture with persistent state management.

### Core Components & Flow

- **Entry Point**: `main.js` - Orchestrates sequential initialization of all modules
- **Message Flow**: `whatsappClient.js` → `messageHandler.js` → `aiProcessor.js` → `responseSender.js`
- **State Persistence**: PostgreSQL via `stateManager.js` with JSONB conversation history
- **AI Processing**: Dual AI approach - GPT-3.5 for intent recognition, GPT-4o for responses
- **Sales Funnel**: Defined in `salesFunnelBluePrint.js` with step-by-step progression logic

### Critical Development Rules

1. **ES6 Modules Only**: All files use `import/export` syntax with `"type": "module"` in package.json
2. **Never Run Locally**: System must only run on VPS at `/var/www/proprius` 
3. **Deployment Flow**: Local changes → git commit/push → VPS git pull → pm2 restart
4. **No Information Invention**: AI agent NEVER invents offers, features, or statistics not in training data

## Key Technical Patterns

### Configuration Management
```javascript
// botConfig.js centralizes all settings
import botConfig from "./botConfig.js";
const setting = botConfig.ai.model.primary; // GPT-4o
```

### State Management Pattern
```javascript
// All conversation state persisted to PostgreSQL
const state = await stateManager.getUserState(chatId);
await stateManager.updateState(chatId, { currentStep: "GREETING_NEW" });
```

### AI Processing Flow
```javascript
// Dual AI approach in aiProcessor.js
const intent = await callIntentRecognitionAI(message); // GPT-3.5
const response = await callPrimaryAI(fullPrompt, history); // GPT-4o
```

### Sales Funnel Progression
- Each step in `salesFunnelBluePrint.js` has specific `instructionsForAI` and goals
- Advancement triggered by `[ACTION: ADVANCE_FUNNEL]` tag in AI responses
- Critical steps (CLOSE_DEAL, etc.) have 30-second protection against interruptions

## Development Workflows

### Adding New Funnel Steps
1. Define step object in `salesFunnelBluePrint.js` with unique `id` and `instructionsForAI`
2. Update state transitions in `stateManager.js` if needed
3. Test flow logic in `aiProcessor.js` prompt generation

### Modifying AI Behavior  
1. Update `instructionsForAI` arrays in funnel steps for step-specific behavior
2. Modify system prompts in `aiProcessor.js` for global behavior changes
3. Adjust intent recognition logic in `intentRecognizer.js`

### Environment Setup
- PostgreSQL database with `chat_states` table (JSONB state column)
- Environment variables in `.env` for API keys (OpenAI, ElevenLabs, etc.)
- PM2 process management with nginx reverse proxy on VPS

## Important File Relationships

- `main.js` → Initialization orchestrator
- `botConfig.js` → Single source of truth for all settings  
- `salesFunnelBluePrint.js` → Sales conversation logic definition
- `stateManager.js` → Conversation persistence and anti-spam
- `aiProcessor.js` → Core AI logic and prompt management
- `messageHandler.js` → WhatsApp event processing and spam detection
- `utils/IntelligentRAG.js` → Knowledge base search for AI responses

## VPS Deployment Commands
```bash
# Access VPS (use Git Bash only)
ssh -i "C:\Public\id_ed25519" root@72.60.159.155

# Deploy changes
cd /var/www/proprius && git pull origin main
npm run build # If frontend changes
pm2 restart all
pm2 logs --nostream # Check status and exit automatically
```

## Anti-Patterns to Avoid

- Never use CommonJS `require()` - ES6 modules only
- Don't modify database schema without migration scripts
- Avoid breaking the sequential initialization in `main.js`
- Never bypass the state management system for conversation data
- Don't add features without corresponding funnel step definitions