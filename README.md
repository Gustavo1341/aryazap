# SmartZap AI Sales Agent 🤖💬💰

## Overview

Nex is an intelligent WhatsApp-based sales agent designed to automate lead qualification, conversation management, objection handling, and closing processes. It leverages powerful AI models (like GPT-4o and GPT-3.5-Turbo) to engage potential customers naturally, guide them through a configurable sales funnel, and ultimately drive conversions directly within WhatsApp.

This project provides a robust, configurable, and extensible platform for businesses looking to scale their WhatsApp sales and customer interactions using AI.

## ✨ Key Features

*   **WhatsApp Integration:** Connects directly to WhatsApp using `whatsapp-web.js` for seamless message sending and receiving.
*   **AI-Powered Conversations:** Utilizes large language models (configurable, e.g., GPT-4o via OpenAI API or LM Studio compatible APIs) for natural, context-aware conversations.
*   **Sales Funnel Management:** Guides leads through predefined sales funnel stages (`salesFunnelBluePrint.js`).
*   **Intelligent Intent Classification:** Uses GPT-3.5-Turbo (via API) to understand user intent (questions, objections, confirmations, etc.) and sentiment, adapting the conversation flow accordingly.
*   **Objection Handling:** Specifically designed logic and prompts to address common customer objections effectively.
*   **Product Presentation & Pricing:** Dynamically presents product information and pricing plans based on `pricing.js`.
*   **Social Proof Delivery:** Can automatically send predefined media files (images, videos) as social proof (`provasSociais/` folder).
*   **Text-to-Speech (TTS - Optional):** Generates voice messages for AI responses using ElevenLabs API for a more personal touch (`TTS_ENABLED`).
*   **Human Takeover:** Allows human agents to pause the bot and take over conversations when needed.
*   **Anti-Spam Measures:** Includes rate limiting and keyword detection to prevent abuse.
*   **Persistent State:** Stores conversation state and history in a PostgreSQL database (`db.js`, `stateManager.js`).
*   **Configurable Identity & Behavior:** Easily customize the bot's persona, tone, product focus, and operational parameters via `.env` and `botConfig.js`.
*   **API Server (Optional):** Includes an Express server for status checks and sending messages via API (`apiServer.js`).
*   **Robust Logging & Error Handling:** Centralized logging (`logger.js`) and graceful shutdown mechanisms.

## 🏗️ Architecture

The application follows a modular architecture:

1.  **`main.js`:** The main entry point, responsible for initializing all modules (DB, WhatsApp Client, API Server, etc.) and handling graceful shutdown.
2.  **`whatsappClient.js`:** Manages the `whatsapp-web.js` client lifecycle (QR code, authentication, events).
3.  **`messageHandler.js`:** Receives messages from `whatsappClient`, manages chat state buffering, detects spam, and orchestrates the processing flow.
4.  **`aiProcessor.js`:**
    *   Generates dynamic prompts based on the current funnel step and conversation history.
    *   Calls the **OpenAI API (GPT-3.5-Turbo)** for **intent/sentiment classification** of user messages.
    *   Calls the primary **LLM (e.g., GPT-4o)** via OpenAI API or LM Studio for generating conversational responses.
    *   Manages logic for entering/exiting objection handling mode based on classified intent.
5.  **`responseSender.js`:** Formats and sends messages (text and optional TTS audio) back to the user via `whatsappClient`, simulating typing.
6.  **`stateManager.js`:** Manages the persistence of conversation state (history, funnel step, user status) in the PostgreSQL database.
7.  **`db.js`:** Handles the connection pool and query execution for the PostgreSQL database.
8.  **`botConfig.js`:** Centralizes configuration loaded from `.env` variables, defining the bot's identity, behavior, API keys, etc.
9.  **`pricing.js`:** Defines product structures, plans, and checkout links.
10. **`salesFunnelBluePrint.js`:** Defines the stages and AI instructions for the sales funnel.
11. **`mediaHandler.js`:** Handles downloading WhatsApp media, audio transcription (Whisper via API), and TTS generation (ElevenLabs via API).
12. **`trainingLoader.js`:** Loads knowledge base files, product data from `pricing.js`, and validates social proof assets on startup.
13. **`apiServer.js` (Optional):** Runs an Express server for external interactions.
14. **`logger.js`, `utils.js`, `constants.js`, `fileSystemHandler.js`, `configValidator.js`:** Provide core utilities, constants, file system operations, logging, and configuration validation.

## 🚀 Getting Started

### Prerequisites

*   **Node.js:** Version 18.x or higher (check with `node -v`).
*   **npm** or **yarn:** Package manager for Node.js.
*   **PostgreSQL:** A running PostgreSQL database instance (local or remote).
*   **Git:** For cloning the repository.
*   **(Optional but Recommended for Video Sending) Google Chrome:** A standard installation of Google Chrome (not just Chromium). The path needs to be set in the `.env` file (`CHROME_PATH`) for `whatsapp-web.js` to correctly handle sending some video formats natively.

### Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```
3.  **Set up Environment Variables:**
    *   Copy the example environment file:
        ```bash
        cp .env.example .env
        ```
    *   **Edit the `.env` file** and fill in *at least* the following critical variables:
        *   `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`, `DB_PORT`: PostgreSQL connection details.
        *   `OPENAI_API_KEY`: Your OpenAI API key (required for both GPT-4o/main model and GPT-3.5-Turbo/intent classification).
        *   `TARGET_PRODUCT_ID`: The primary product ID (must match an ID in `pricing.js`).
        *   `BOT_FIRST_NAME`, `BOT_COMPANY_NAME`, `BOT_POSITION`: Define the bot's identity.
        *   `SUPPORT_WHATSAPP_NUMBER`: The WhatsApp number for support escalations.
    *   Review and configure other variables in `.env` as needed (e.g., `ELEVENLABS_API_KEY` if using TTS, `PORT` and `API_KEY` for the API server, `CHROME_PATH`).

4.  **Database Setup:**
    *   Ensure your PostgreSQL server is running.
    *   Create the database and user specified in your `.env` file. Grant necessary privileges.
    *   The application attempts basic table creation (`CREATE TABLE IF NOT EXISTS`) on the first run (see `db.js`). **For production, use a proper migration tool.**

5.  **Prepare Training/Proof Folders:**
    *   Create the `training/` folder (if it doesn't exist) and add any `.txt`, `.pdf`, or `.json` knowledge base files.
    *   Create the `provasSociais/` folder (if it doesn't exist) and add your social proof media files (images, videos). Ensure filenames match those potentially referenced in `salesFunnelBluePrint.js`.

## ⚙️ Configuration

Configuration is primarily handled through:

1.  **`.env` file:** Contains secrets (API keys, DB password), environment-specific settings (DB host, ports), and overrides for default behaviors. **This is the primary place for customization.**
2.  **`botConfig.js`:** Loads values from `.env` and provides structured access to configurations for identity, behavior, AI models, TTS, etc. Defaults are defined here if ENV variables are missing.
3.  **`pricing.js`:** Define your products, plans, features, prices, and **checkout links** directly in this file. Ensure `TARGET_PRODUCT_ID` in `.env` matches a main product ID here.
4.  **`salesFunnelBluePrint.js`:** Define the stages, goals, and specific instructions for the AI at each step of your sales funnel.

**Key areas to configure:**

*   Bot identity (`BOT_*` variables in `.env`).
*   Database connection (`DB_*` variables in `.env`).
*   OpenAI API Key (`OPENAI_API_KEY`).
*   Target Product (`TARGET_PRODUCT_ID`).
*   Support Number (`SUPPORT_WHATSAPP_NUMBER`).
*   TTS settings (`TTS_*`, `ELEVENLABS_*`) if enabled.
*   API Server port and key (`PORT`, `API_KEY`) if enabled.
*   Product details and checkout links in `pricing.js`.
*   Funnel steps and AI instructions in `salesFunnelBluePrint.js`.

## ▶️ Running the Bot

1.  **Start the application:**
    ```bash
    npm start
    # or if no start script is defined:
    node main.js
    ```
2.  **WhatsApp Authentication:**
    *   On the first run (or after deleting the `session` folder), a QR code will appear in your terminal.
    *   Open WhatsApp on your phone, go to `Settings > Linked Devices > Link a Device`, and scan the QR code.
    *   Wait for the client to initialize and authenticate. You should see logs indicating "CLIENTE WHATSAPP PRONTO!".
3.  The bot is now running and will process incoming messages according to the configured funnel and logic.

## 🔌 API Server (Optional)

If `PORT` is set in your `.env` file, an Express API server will start.

*   **Authentication:** If `API_KEY` is set in `.env`, requests to protected endpoints (like `/send-message`) must include the header `x-api-key: YOUR_API_KEY`.
*   **Endpoints:**
    *   `GET /status`: Returns a detailed JSON object with the current status of the bot, WhatsApp connection, configuration, etc. (No authentication required).
    *   `POST /send-message`: Sends a message to a specific WhatsApp number. Requires `x-api-key` header if `API_KEY` is set.
        *   **Body (JSON):**
            ```json
            {
              "number": "5511999998888", // Include country code, no '+' or '@c.us'
              "message": "Your message content here."
            }
            ```

## 🧩 Key Modules Reference

*   **`main.js`:** Application entry point, orchestrates initialization and shutdown.
*   **`whatsappClient.js`:** Wrapper around `whatsapp-web.js`, manages connection and events.
*   **`messageHandler.js`:** Core logic for processing incoming messages, buffering, spam check.
*   **`aiProcessor.js`:** Handles all interactions with AI models (intent classification via GPT-3.5, response generation via primary LLM), manages objection logic.
*   **`responseSender.js`:** Sends formatted text and TTS audio responses to users.
*   **`stateManager.js`:** Manages reading/writing conversation state to the database.
*   **`db.js`:** PostgreSQL database connection pool and query interface.
*   **`botConfig.js`:** Loads and structures configuration from `.env`.
*   **`pricing.js`:** Defines product and pricing structure.
*   **`salesFunnelBluePrint.js`:** Defines the conversational sales funnel stages.
*   **`mediaHandler.js`:** Manages media downloads, transcription, and TTS generation via external APIs.
*   **`trainingLoader.js`:** Loads KB, product data, and validates social proofs at startup.
*   **`apiServer.js`:** Optional Express API server.
*   **`logger.js`:** Centralized and configurable logging system.
*   **`utils.js`:** General utility functions (parsing, formatting, time, etc.).
*   **`constants.js`:** Global application constants.
*   **`fileSystemHandler.js`:** Manages essential directories and session cleanup.
*   **`configValidator.js`:** Performs checks on critical configuration settings at startup.