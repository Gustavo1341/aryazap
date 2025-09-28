# Technology Stack & Build System

## Core Technologies
- **Runtime**: Node.js 18+ (ES Modules)
- **Database**: PostgreSQL with connection pooling (pg library)
- **WhatsApp Integration**: whatsapp-web.js with Puppeteer
- **AI Providers**: 
  - OpenAI (GPT-4o, GPT-3.5-Turbo, Whisper)
  - Google Gemini (gemini-1.5-flash)
- **Text-to-Speech**: ElevenLabs API
- **Web Framework**: Express.js (optional API server)

## Key Dependencies
- `@google/generative-ai` - Google Gemini integration
- `openai` - OpenAI API client
- `whatsapp-web.js` - WhatsApp Web automation
- `pg` - PostgreSQL client
- `winston` - Structured logging
- `dotenv` - Environment configuration
- `natural` - NLP utilities
- `elevenlabs` - TTS integration

## Development Tools
- **Process Manager**: nodemon for development
- **Containerization**: Docker + Docker Compose
- **Testing**: Custom test framework in `/tests`
- **Linting**: No explicit linter configured

## Common Commands
```bash
# Development
npm run dev          # Start with nodemon
npm start           # Production start

# Docker
docker-compose up   # Start full stack
docker-compose down # Stop services

# Testing
node test_*.js      # Run individual tests
```

## Environment Configuration
All configuration via `.env` file with validation in `configValidator.js`. Critical variables:
- `OPENAI_API_KEY` / `GEMINI_API_KEY`
- `DB_*` variables for PostgreSQL
- `ELEVENLABS_API_KEY` for TTS
- `TARGET_PRODUCT_ID` for sales configuration