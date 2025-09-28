# Project Structure & Architecture

## Entry Point & Core Flow
- **`main.js`** - Application entry point, orchestrates initialization sequence
- **`whatsappClient.js`** - WhatsApp Web client wrapper and event handling
- **`messageHandler.js`** - Central message processing orchestrator with buffering
- **`aiProcessor.js`** - AI interaction layer (OpenAI/Gemini) and response generation
- **`responseSender.js`** - Message formatting and delivery with typing simulation

## State & Data Management
- **`stateManager.js`** - Conversation state persistence and retrieval
- **`db.js`** - PostgreSQL connection pool and query interface
- **`botConfig.js`** - Centralized configuration management from environment variables

## Business Logic
- **`salesFunnelBluePrint.js`** - Sales funnel stages and AI instructions
- **`pricing.js`** - Product definitions, plans, and checkout links
- **`intentRecognizer.js`** - Intent classification and sentiment analysis
- **`criticalStepExecutor.js`** - Critical sales step execution logic
- **`inactivityManager.js`** - Re-engagement system for inactive users

## Utilities & Support
- **`utils.js`** - Pure utility functions (parsing, formatting, time)
- **`constants.js`** - Global application constants
- **`logger.js`** - Structured logging with Winston
- **`mediaHandler.js`** - Audio transcription and TTS generation

## Directory Structure
```
├── data/                    # Knowledge base and processed data
├── logs/                    # Application logs
├── session/                 # WhatsApp session data
├── training/                # Knowledge base files (.txt, .pdf, .json)
├── provasSociais/          # Social proof media files
├── utils/                   # Specialized utilities (RAG, similarity)
├── tests/                   # Test files and helpers
└── temp/                    # Temporary files
```

## Architecture Patterns
- **Modular Design**: Each file has single responsibility
- **Event-Driven**: WhatsApp events trigger processing pipeline
- **State Machine**: Sales funnel progression with persistent state
- **Configuration-Driven**: Behavior controlled via environment variables
- **Error Handling**: Graceful shutdown and comprehensive error logging
- **Async/Await**: Modern JavaScript patterns throughout

## Naming Conventions
- **Files**: camelCase.js (e.g., `messageHandler.js`)
- **Functions**: camelCase with descriptive names
- **Constants**: UPPER_SNAKE_CASE
- **Environment Variables**: UPPER_SNAKE_CASE with prefixes (DB_, BOT_, etc.)
- **Database**: snake_case for tables and columns