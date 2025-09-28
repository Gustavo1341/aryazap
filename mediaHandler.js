// --- START OF FILE mediaHandler.js ---

/**
 * mediaHandler.js - Gerenciador Centralizado de Mídias (v. Robusta 5 - ElevenLabs SDK Fix)
 * =============================================================================
 * Responsável por:
 * - Download de mídias de mensagens do WhatsApp.
 * - Transcrição de áudio via API externa (OpenAI).
 * - Geração de áudio Text-to-Speech (TTS) via API externa (ElevenLabs) com mais controles.
 * - Envio de arquivos de mídia (provas sociais) armazenados localmente.
 * - Gerenciamento de arquivos temporários para processamento de mídia.
 * =============================================================================
 */

// --- Node.js Core Modules ---
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai"; // SDK Oficial OpenAI
import { ElevenLabsClient } from "elevenlabs"; // SDK Oficial ElevenLabs - Importação correta
import pkg from "whatsapp-web.js"; // Para MessageMedia
const { MessageMedia } = pkg;
import { serializeError } from "serialize-error"; // Para logs de erro robustos
import axios from "axios"; // Adicionado para a chamada manual da API ElevenLabs

// --- Project Imports ---
import { sleep, generateRandomString } from "./utils.js"; // Utilitários gerais
import {
  WHISPER_TIMEOUT_MS,
  TTS_TIMEOUT_MS,
  MIN_AUDIO_DURATION_FOR_TTS_MS,
} from "./constants.js"; // Constantes
import logger from "./logger.js"; // Logger centralizado
import botConfig from "./botConfig.js"; // Configurações do bot
import { TEMP_DIR, PROOFS_DIR } from "./fileSystemHandler.js"; // Caminhos de diretórios

// --- Constantes do Módulo ---
const MIN_AUDIO_SIZE_BYTES = 100; // Ignorar áudios muito pequenos
const VIDEO_POST_SEND_DELAY_MS =
  botConfig.behavior.responseSettings.videoPostSendDelayMs ?? 500;

const VALID_PROOF_EXTENSIONS = {
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".webp": "image",
  ".mp4": "video",
  ".mov": "video",
  ".avi": "video",
  ".3gp": "video",
  ".txt": "text",
};

// ================================================================
// ===            INICIALIZAÇÃO DE CLIENTES EXTERNOS            ===
// ================================================================

/** @type {OpenAI | null} */
let openaiClient = null;
if (botConfig.openai.apiKey) {
  try {
    openaiClient = new OpenAI({ apiKey: botConfig.openai.apiKey });
    logger.debug(
      "[Media Handler] Cliente OpenAI inicializado para transcrição."
    );
  } catch (error) {
    logger.error(
      "[Media Handler] Falha ao inicializar cliente OpenAI.",
      serializeError(error)
    );
  }
} else {
  logger.info(
    "[Media Handler] Transcrição via SDK OpenAI desativada (API Key não fornecida)."
  );
}

/** @type {ElevenLabsClient | null} */ // Tipo ajustado para o SDK oficial
let elevenLabsClient = null;
if (botConfig.tts.enabled) {
  if (botConfig.tts.elevenLabsApiKey) {
    try {
      // Utiliza a classe importada corretamente
      elevenLabsClient = new ElevenLabsClient({
        apiKey: botConfig.tts.elevenLabsApiKey,
      });
      logger.debug("[Media Handler] Cliente ElevenLabs inicializado para TTS.");
    } catch (ttsError) {
      logger.error(
        "[Media Handler] Falha ao inicializar cliente ElevenLabs. TTS desativado.",
        serializeError(ttsError)
      );
      if (botConfig?.tts) botConfig.tts.enabled = false;
    }
  } else {
    logger.warn(
      "[Media Handler] TTS habilitado (no código), mas ELEVENLABS_API_KEY ausente no .env. TTS desativado."
    );
    if (botConfig?.tts) botConfig.tts.enabled = false;
  }
}

// ================================================================
// ===                 DOWNLOAD E TRANSCRIÇÃO                   ===
// ================================================================
async function downloadWhatsAppMedia(message) {
  const chatId = message.from;
  logger.trace(
    `[Media Download] Tentando baixar mídia tipo ${message.type}...`,
    chatId,
    { msgId: message.id.id }
  );
  try {
    const media = await message.downloadMedia();
    if (!media?.data) {
      logger.warn("[Media Download] Download retornou mídia vazia.", chatId, {
        type: message.type,
      });
      return {
        success: false,
        errorType: "empty_media",
        errorMessage: "Mídia retornada vazia.",
      };
    }
    const mimeType = media.mimetype || "application/octet-stream";
    const buffer = Buffer.from(media.data, "base64");
    if (mimeType.startsWith("audio/") && buffer.length < MIN_AUDIO_SIZE_BYTES) {
      logger.warn(
        `[Media Download] Buffer de áudio muito pequeno (${buffer.length} bytes).`,
        chatId
      );
      return {
        success: false,
        errorType: "audio_too_small",
        errorMessage: `Buffer de áudio < ${MIN_AUDIO_SIZE_BYTES} bytes.`,
      };
    }
    logger.debug(
      `[Media Download] Mídia baixada: ${(buffer.length / 1024).toFixed(
        1
      )} KB, Mime: ${mimeType}`,
      chatId
    );
    return {
      success: true,
      data: { buffer, mimeType, filename: media.filename || null },
    };
  } catch (error) {
    logger.error(
      "[Media Download] Erro ao baixar mídia.",
      serializeError(error),
      chatId,
      { msgId: message.id.id }
    );
    return {
      success: false,
      errorType: "download_exception",
      errorMessage: error.message || "Erro desconhecido no download.",
    };
  }
}

async function transcribeAudio(audioBuffer, originalMimeType, chatId) {
  // Sempre usa OpenAI para transcrição de áudio, independente do provedor primário
  if (botConfig.openai.whisperModel === "disabled" || !openaiClient) {
    let errorType = "transcription_disabled";
    let errorMessage = "Transcrição desativada na configuração.";
    
    if (botConfig.openai.whisperModel !== "disabled" && !openaiClient) {
      errorType = "openai_client_not_available";
      errorMessage = "Cliente OpenAI não disponível para transcrição.";
      
      // Verifica se o problema é falta de API Key da OpenAI quando Gemini é o provedor primário
      if (botConfig.ai?.primaryProvider === "gemini" && !botConfig.openai?.apiKey) {
        errorType = "openai_api_key_missing";
        errorMessage = "API Key da OpenAI necessária para transcrição mesmo usando Gemini como provedor primário.";
        logger.warn(
          `[Whisper] ${errorMessage}`,
          chatId
        );
      }
    }
    
    return {
      success: false,
      errorType: errorType,
      errorMessage: errorMessage,
    };
  }
  
  if (!audioBuffer || audioBuffer.length < MIN_AUDIO_SIZE_BYTES) {
    return {
      success: false,
      errorType: "audio_too_small",
      errorMessage: `Buffer de áudio < ${MIN_AUDIO_SIZE_BYTES} bytes.`,
    };
  }
  let tempFilePath = "";
  const tempFileNameBase = `audio_${
    chatId.split("@")[0]
  }_${Date.now()}_${generateRandomString(4)}`;
  let fileExtension = "tmp";
  try {
    const contentType = originalMimeType.split(";")[0];
    const extensionMap = {
      "audio/ogg": "ogg",
      "video/ogg": "ogg",
      "audio/opus": "opus",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/aac": "aac",
      "audio/m4a": "m4a",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "audio/amr": "amr",
    };
    fileExtension =
      extensionMap[contentType] ||
      (contentType.includes("ogg") ? "ogg" : "mp3");
    const finalTempFileName = `${tempFileNameBase}.${fileExtension}`;
    tempFilePath = path.join(TEMP_DIR, finalTempFileName);
    await fsPromises.writeFile(tempFilePath, audioBuffer);
    logger.trace(`[Whisper] Arquivo temp criado: ${finalTempFileName}`, chatId);
    logger.debug(
      `[Whisper] Enviando ${finalTempFileName} (${(
        audioBuffer.length / 1024
      ).toFixed(1)} KB)...`,
      chatId
    );
    const transcriptionPromise = openaiClient.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: botConfig.openai.whisperModel,
      language: "pt",
      response_format: "text",
    });
    const timeoutPromise = sleep(WHISPER_TIMEOUT_MS).then(() => {
      throw new Error(`Timeout (${WHISPER_TIMEOUT_MS}ms) Whisper.`);
    });
    const transcriptionResult = await Promise.race([
      transcriptionPromise,
      timeoutPromise,
    ]);
    if (typeof transcriptionResult === "string" && transcriptionResult.trim()) {
      return { success: true, text: transcriptionResult.trim() };
    } else {
      logger.warn(
        "[Whisper] Transcrição da API retornou vazia ou não é string.",
        chatId,
        { result: transcriptionResult }
      );
      return {
        success: false,
        errorType: "empty_transcription",
        errorMessage:
          "API retornou transcrição vazia ou em formato inesperado.",
      };
    }
  } catch (error) {
    let errorType = "transcription_exception";
    let errorMessage = error.message || "Erro desconhecido na transcrição";
    if (error instanceof OpenAI.APIError) {
      errorType = `openai_api_error_${error.status || "unknown"}`;
      errorMessage = `OpenAI API Error: ${error.message}`;
      if (error.code) errorType += `_code_${error.code}`;
    } else if (error.message?.includes("Timeout")) {
      errorType = "timeout";
    }
    logger.error(`[Whisper] ${errorMessage}`, serializeError(error), chatId, {
      file: path.basename(tempFilePath || "unknown"),
      errorType,
    });
    return { success: false, errorType: errorType, errorMessage: errorMessage };
  } finally {
    if (tempFilePath) {
      fsPromises.unlink(tempFilePath).catch(() => {});
    }
  }
}

async function downloadAndTranscribeAudio(message, chatId) {
  const downloadResult = await downloadWhatsAppMedia(message);
  if (!downloadResult.success) {
    return {
      success: false,
      duration: null,
      errorType: downloadResult.errorType || "download_failed",
      errorMessage: downloadResult.errorMessage || "Falha download.",
    };
  }
  const transcriptionResult = await transcribeAudio(
    downloadResult.data.buffer,
    downloadResult.data.mimeType,
    chatId
  );
  if (!transcriptionResult.success) {
    return {
      success: false,
      duration: null,
      errorType: transcriptionResult.errorType || "transcription_failed",
      errorMessage: transcriptionResult.errorMessage || "Falha transcrição.",
    };
  }
  return {
    success: true,
    text: transcriptionResult.text,
    duration: null,
    errorType: null,
    errorMessage: null,
  };
}

// --- START OF FILE mediaHandler.js (Função generateTTSAudio Completa e Corrigida) ---

// ... (outras importações: fs, fsPromises, path, OpenAI, ElevenLabsClient, MessageMedia, serializeError, utils, constants, logger, botConfig, TEMP_DIR, axios) ...
// Certifique-se de que axios está importado:
// import axios from 'axios';

// ================================================================
// ===                  GERAÇÃO DE ÁUDIO (TTS)                  ===
// ================================================================

async function generateTTSAudio(textToSpeak, chatId) {
  // Correção: Usa a variável do módulo diretamente
  const currentElevenLabsClient = elevenLabsClient;

  if (!botConfig.tts?.enabled || !currentElevenLabsClient) {
    let errorType = "tts_disabled";
    let errorMessage = "TTS desabilitado na configuração.";
    if (botConfig.tts?.enabled && !currentElevenLabsClient) {
      errorType = "tts_client_not_initialized";
      errorMessage = "Cliente ElevenLabs não inicializado.";
    }
    logger.debug(`[TTS] Geração pulada. ${errorMessage}`, chatId);
    return { success: false, errorType, errorMessage };
  }

  const cleanText =
    textToSpeak
      ?.replace(/\[.*?\]/g, "")
      .replace(/\{.*?\}/g, "")
      .replace(/\*+/g, "")
      .replace(/%%MSG_BREAK%%/gi, " ")
      .replace(/\s{2,}/g, " ")
      .replace(/(\S)(\?)/g, "$1 $2")
      .trim() ?? "";

  if (cleanText.length < (botConfig.tts.minTextLengthForTTS || 5)) {
    logger.debug(`[TTS] Texto muito curto para TTS: "${cleanText}"`, chatId);
    return {
      success: false,
      errorType: "text_too_short",
      errorMessage: "Texto muito curto para TTS.",
    };
  }

  const tempFileName = `tts_${
    chatId.split("@")[0]
  }_${Date.now()}_${generateRandomString(6)}.mp3`;
  const tempFilePath = path.join(TEMP_DIR, tempFileName);
  logger.debug(
    `[TTS] Gerando áudio para "${cleanText.substring(
      0,
      70
    )}..." -> ${tempFileName}`,
    chatId
  );

  try {
    // Definições de voz e payload para a API
    const voiceSettings = {
      stability: botConfig.tts.elevenLabsStability,
      similarity_boost: botConfig.tts.elevenLabsSimilarityBoost,
      style: botConfig.tts.elevenLabsStyleExaggeration,
      use_speaker_boost: botConfig.tts.elevenLabsUseSpeakerBoost,
    };

    const payload = {
      text: cleanText,
      model_id: botConfig.tts.elevenLabsModelId,
      voice_settings: voiceSettings,
    };
    const voiceId = botConfig.tts.elevenLabsVoiceId;
    const apiKey = botConfig.tts.elevenLabsApiKey;

    logger.debug(
      `[TTS] Payload para ElevenLabs API (Voice ID: ${voiceId}):`,
      chatId,
      payload
    );

    // --- TENTATIVA COM REQUISIÇÃO HTTP MANUAL (axios) ---
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;

    let response;
    try {
      logger.debug(`[TTS DEBUG] Fazendo POST para: ${apiUrl}`, chatId);
      response = await axios.post(apiUrl, payload, {
        headers: {
          Accept: "audio/mpeg", // Crucial: Indica o que você espera receber
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        responseType: "arraybuffer", // Crucial para receber dados binários
        timeout: TTS_TIMEOUT_MS,
      });

      logger.debug(
        `[TTS DEBUG] Resposta recebida da API (AXIOS). Status: ${response.status}`,
        chatId
      );
      logger.trace(`[TTS DEBUG] Headers da resposta:`, chatId, {
        headers: response.headers,
      });
      logger.trace(
        `[TTS DEBUG] Tipo de response.data: ${typeof response.data}`,
        chatId
      );

      if (response.data) {
        logger.trace(
          `[TTS DEBUG] response.data é instanceof ArrayBuffer? ${
            response.data instanceof ArrayBuffer
          }`,
          chatId
        );
        logger.trace(
          `[TTS DEBUG] response.data é Buffer.isBuffer? ${Buffer.isBuffer(
            response.data
          )}`,
          chatId
        ); // Novo log

        if (
          response.data instanceof ArrayBuffer ||
          Buffer.isBuffer(response.data)
        ) {
          const dataLength = response.data.byteLength || response.data.length; // Para ArrayBuffer ou Buffer
          logger.trace(
            `[TTS DEBUG] response.data.length/byteLength: ${dataLength}`,
            chatId
          );
        } else {
          try {
            const responseText = String(response.data); // Tenta converter para string de qualquer forma
            logger.warn(
              `[TTS DEBUG] response.data NÃO é ArrayBuffer nem Buffer. Conteúdo (primeiros 500 chars): ${responseText.substring(
                0,
                500
              )}`,
              chatId
            );
          } catch (e) {
            logger.warn(
              `[TTS DEBUG] response.data NÃO é ArrayBuffer nem Buffer e falhou ao converter para string.`,
              chatId
            );
          }
        }
      } else {
        logger.warn(`[TTS DEBUG] response.data é NULO ou INDEFINIDO.`, chatId);
      }

      if (response.status === 200 && response.data) {
        const contentTypeHeader =
          response.headers["content-type"] || response.headers["Content-Type"];
        if (!contentTypeHeader || !contentTypeHeader.startsWith("audio/")) {
          let errorBodyText = "Corpo da resposta não é áudio.";
          if (
            response.data instanceof ArrayBuffer ||
            Buffer.isBuffer(response.data)
          ) {
            try {
              errorBodyText = Buffer.from(response.data).toString("utf-8");
            } catch (e) {
              // ignorar
            }
          } else if (typeof response.data === "string") {
            errorBodyText = String(response.data);
          }
          logger.error(
            `[TTS] API respondeu com status 200 mas Content-Type NÃO é áudio: '${contentTypeHeader}'. Corpo: ${errorBodyText.substring(
              0,
              500
            )}`,
            null,
            chatId
          );
          throw new Error(
            `API respondeu com status 200 mas Content-Type não é áudio: ${contentTypeHeader}. Corpo: ${errorBodyText.substring(
              0,
              100
            )}...`
          );
        }

        // ****** MODIFICAÇÃO PRINCIPAL APLICADA AQUI ******
        let audioDataBuffer = null;
        if (response.data instanceof ArrayBuffer) {
          audioDataBuffer = Buffer.from(response.data);
        } else if (Buffer.isBuffer(response.data)) {
          audioDataBuffer = response.data;
        }

        if (audioDataBuffer && audioDataBuffer.length > MIN_AUDIO_SIZE_BYTES) {
          logger.info(
            `[TTS] Dados de áudio recebidos via AXIOS. Tamanho: ${audioDataBuffer.length} bytes. Escrevendo...`,
            chatId
          );
          await fsPromises.writeFile(tempFilePath, audioDataBuffer);
        } else {
          let problemDescription =
            "sem dados de áudio válidos ou formato inesperado";
          if (!audioDataBuffer) {
            problemDescription =
              "os dados recebidos não são ArrayBuffer nem Buffer do Node.js";
          } else if (audioDataBuffer.length <= MIN_AUDIO_SIZE_BYTES) {
            problemDescription = `os dados de áudio são muito pequenos (${audioDataBuffer.length} bytes)`;
          }
          const actualDataType = response.data
            ? Object.prototype.toString.call(response.data)
            : typeof response.data;
          logger.error(
            `[TTS] Resposta da API (AXIOS) com status 200, mas ${problemDescription}. Tipo real de response.data: ${actualDataType}`,
            null,
            chatId,
            {
              responseHeaders: response.headers,
              responseDataLength:
                response.data?.length || response.data?.byteLength,
            }
          );
          throw new Error(
            `Resposta da API (AXIOS) com status 200, mas ${problemDescription}.`
          );
        }
      } else {
        let responseDataLog = "N/A";
        if (response.data) {
          try {
            responseDataLog =
              response.data instanceof ArrayBuffer ||
              Buffer.isBuffer(response.data)
                ? `Buffer/ArrayBuffer de ${
                    response.data.length || response.data.byteLength
                  } bytes`
                : JSON.stringify(response.data).substring(0, 500);
          } catch {
            responseDataLog = "Erro ao serializar response.data";
          }
        }
        logger.error(
          `[TTS] Resposta inesperada da API (AXIOS). Status: ${response.status}`,
          null,
          chatId,
          { responseData: responseDataLog }
        );
        throw new Error(
          `ElevenLabs API (AXIOS) respondeu com status ${response.status}`
        );
      }
    } catch (axiosError) {
      let errorType = "tts_axios_exception";
      let errorMessage =
        axiosError.message || "Erro desconhecido na requisição manual TTS.";
      let apiResponseData = null;

      if (axiosError.response) {
        errorType = `api_axios_error_${axiosError.response.status}`;
        errorMessage = `Erro API ElevenLabs (AXIOS ${axiosError.response.status}): `;
        apiResponseData = axiosError.response.data;
        const contentTypeHeader =
          axiosError.response.headers["content-type"] ||
          axiosError.response.headers["Content-Type"];

        if (
          (apiResponseData instanceof ArrayBuffer ||
            Buffer.isBuffer(apiResponseData)) &&
          contentTypeHeader &&
          contentTypeHeader.includes("application/json")
        ) {
          try {
            const errorJsonString =
              Buffer.from(apiResponseData).toString("utf-8");
            const errorJson = JSON.parse(errorJsonString);
            errorMessage +=
              errorJson.detail?.message ||
              errorJson.detail?.text ||
              errorJson.detail ||
              errorJson.message ||
              errorJsonString;
            apiResponseData = errorJson;
          } catch (e) {
            errorMessage +=
              "Corpo do erro (JSON em Buffer/ArrayBuffer) não pôde ser decodificado.";
          }
        } else if (
          typeof apiResponseData === "object" &&
          apiResponseData !== null
        ) {
          errorMessage +=
            apiResponseData.detail?.message ||
            apiResponseData.detail?.text ||
            apiResponseData.detail ||
            apiResponseData.message ||
            JSON.stringify(apiResponseData);
        } else if (typeof apiResponseData === "string") {
          errorMessage += apiResponseData;
        } else if (
          apiResponseData instanceof ArrayBuffer ||
          Buffer.isBuffer(apiResponseData)
        ) {
          const dataLength =
            apiResponseData.byteLength || apiResponseData.length;
          errorMessage += `Corpo do erro é um Buffer/ArrayBuffer de ${dataLength} bytes (não JSON).`;
        }

        if (axiosError.response.status === 401)
          errorType = "invalid_api_key_axios";
        else if (axiosError.response.status === 402)
          errorType = "quota_exceeded_axios";
        else if (axiosError.response.status === 422)
          errorType = "unprocessable_entity_axios";
        else if (axiosError.response.status === 429)
          errorType = "rate_limit_exceeded_axios";
      } else if (axiosError.request) {
        errorType = "no_response_axios";
        errorMessage =
          "API do ElevenLabs não respondeu à requisição manual (AXIOS).";
      }

      logger.error(
        `[TTS] ${errorMessage}`,
        serializeError(axiosError),
        chatId,
        {
          errorType,
          apiResponseData: apiResponseData
            ? typeof apiResponseData === "object"
              ? JSON.stringify(apiResponseData).substring(0, 500)
              : String(apiResponseData).substring(0, 500)
            : "N/A",
        }
      );
      throw new Error(errorMessage);
    }

    const stats = await fsPromises.stat(tempFilePath).catch(() => null);
    if (!stats || stats.size < MIN_AUDIO_SIZE_BYTES) {
      if (stats && tempFilePath) {
        try {
          await fsPromises.unlink(tempFilePath);
        } catch (e) {
          logger.warn(
            `[TTS] Falha menor ao remover arquivo TTS inválido '${tempFileName}': ${e.message}`,
            chatId
          );
        }
      }
      throw new Error(
        `Arquivo TTS gerado (AXIOS) vazio ou inválido (${
          stats?.size || 0
        } bytes).`
      );
    }

    logger.info(
      `[TTS] Áudio gerado com sucesso (AXIOS): ${tempFileName} (${(
        stats.size / 1024
      ).toFixed(1)} KB)`,
      chatId
    );
    return { success: true, filePath: tempFilePath };
  } catch (error) {
    // Catch principal da função generateTTSAudio
    let errorType = "tts_exception";
    const errorMessageLower = error.message?.toLowerCase() || "";
    const errorStatus = error.status || error.statusCode;

    if (errorMessageLower.includes("timeout")) {
      errorType = "timeout";
    } else if (
      errorMessageLower.includes("unauthorized") ||
      errorMessageLower.includes("api key") ||
      errorStatus === 401
    ) {
      errorType = "invalid_api_key";
    } else if (
      errorMessageLower.includes("quota") ||
      errorMessageLower.includes("payment required") ||
      errorStatus === 402
    ) {
      errorType = "quota_exceeded";
    } else if (
      errorMessageLower.includes("voice not found") ||
      errorMessageLower.includes("voice_id")
    ) {
      errorType = "voice_not_found";
    } else if (
      errorMessageLower.includes("model_id") ||
      errorMessageLower.includes("model not found")
    ) {
      errorType = "model_not_found";
    } else if (errorMessageLower.includes("input text was too long")) {
      errorType = "text_too_long";
    } else if (error.name === "TooManyRequestsError" || errorStatus === 429) {
      errorType = "rate_limit_exceeded";
    } else if (
      errorMessageLower.includes("validation error") ||
      errorMessageLower.includes("unprocessable entity") ||
      errorStatus === 400 ||
      errorStatus === 422
    ) {
      errorType = "validation_error";
    } else if (errorMessageLower.includes("content-type não é áudio")) {
      errorType = "api_wrong_content_type";
    } else if (
      errorMessageLower.includes("arraybuffer é muito pequeno") ||
      errorMessageLower.includes("dados de áudio são muito pequenos")
    ) {
      errorType = "api_audio_too_small";
    }

    logger.error(
      `[TTS] Erro final ao gerar/salvar áudio. Tipo detectado: ${errorType}. Mensagem: ${error.message}`,
      serializeError(error),
      chatId,
      { file: tempFileName, classifiedErrorType: errorType }
    );

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      await fsPromises
        .unlink(tempFilePath)
        .catch((e) =>
          logger.warn(
            `[TTS] Falha ao remover arquivo TTS em erro '${tempFileName}': ${e.message}`,
            chatId
          )
        );
    }

    return {
      success: false,
      errorType: errorType,
      errorMessage: error.message || "Erro desconhecido na geração de TTS.",
    };
  }
}
// --- END OF FILE mediaHandler.js (Função generateTTSAudio Completa e Corrigida) ---

// ================================================================
// ===                  ENVIO DE PROVAS SOCIAIS                 ===
// ================================================================
async function sendMediaProof(
  client,
  chatId,
  type,
  mediaPath,
  caption = "",
  showFilename = true,
  options = {}
) {
  const normalizedFilename = mediaPath.replace(/\\/g, "/").split("/").pop();
  const mediaTypeLabel = type.toUpperCase();
  try {
    logger.info(
      `[Send Proof ${mediaTypeLabel}] Iniciando envio: ${normalizedFilename} para ${chatId}`
    );
    const stats = await fsPromises.stat(mediaPath).catch(() => null);
    if (stats) {
      const fileSizeMb = stats.size / (1024 * 1024);
      const MAX_FILE_SIZE_MB = type === "video" ? 60 : 15;
      if (fileSizeMb > MAX_FILE_SIZE_MB) {
        logger.error(
          `[Send Proof ${mediaTypeLabel}] Arquivo muito grande (${fileSizeMb.toFixed(
            1
          )}MB > ${MAX_FILE_SIZE_MB}MB): ${normalizedFilename}. Envio abortado.`,
          null,
          chatId
        );
        return false;
      }
      logger.debug(
        `[Send Proof ${mediaTypeLabel}] Tamanho do arquivo: ${fileSizeMb.toFixed(
          2
        )}MB (${normalizedFilename})`
      );
    } else {
      logger.warn(
        `[Send Proof ${mediaTypeLabel}] Não foi possível verificar o tamanho do arquivo: ${normalizedFilename}. Tentando enviar...`,
        null,
        chatId
      );
    }
    const media = MessageMedia.fromFilePath(mediaPath);
    if (!media || !media.data) {
      logger.error(
        `[Send Proof ${mediaTypeLabel}] Falha ao ler o arquivo: ${mediaPath}`,
        null,
        chatId
      );
      return false;
    }
    logger.debug(
      `[Send Proof ${mediaTypeLabel}] Objeto MessageMedia criado a partir de ${normalizedFilename}. Tentando enviar para ${chatId}...`,
      chatId
    );
    let finalCaption = caption || "";
    if (showFilename && normalizedFilename && !finalCaption) {
      finalCaption = normalizedFilename;
    }
    const effectiveOptions = { ...options };
    if (finalCaption) {
      effectiveOptions.caption = finalCaption;
    } else if (effectiveOptions.caption === undefined) {
      effectiveOptions.caption = "";
    }
    if (type === "pdf" || type === "video") {
      logger.trace(
        `[Send Proof ${mediaTypeLabel}] Forçando envio como documento para tipo: ${type}`,
        chatId
      );
      effectiveOptions.sendMediaAsDocument = true;
    } else {
      effectiveOptions.sendMediaAsDocument = false;
    }
    await client.sendMessage(chatId, media, effectiveOptions);
    logger.info(
      `[Send Proof ${mediaTypeLabel}] Enviado com sucesso: ${normalizedFilename} para ${chatId}`
    );
    if (type === "video") {
      await sleep(VIDEO_POST_SEND_DELAY_MS);
    }
    return true;
  } catch (error) {
    let logMessage = `[Send Proof ${mediaTypeLabel}] Erro INESPERADO ao tentar enviar ${normalizedFilename}. Path: ${mediaPath}. Erro: ${
      error.message || "Erro desconhecido"
    }`;
    if (error.name) {
      logMessage = `[Send Proof ${mediaTypeLabel}] Erro ${error.name} ao tentar enviar ${normalizedFilename}. Path: ${mediaPath}. Mensagem: ${error.message}`;
    }
    if (error.code === "ENOENT") {
      logMessage = `[Send Proof ${mediaTypeLabel}] Arquivo não encontrado: ${mediaPath}`;
    } else if (error.message?.includes("Evaluation failed")) {
      logMessage = `[Send Proof ${mediaTypeLabel}] Erro CRÍTICO 'Evaluation Failed' ao enviar ${normalizedFilename}. Provável problema de formato/biblioteca.`;
      logger.debug(
        `[Send Proof ${mediaTypeLabel}] DIAGNÓSTICO: Erro 'Evaluation Failed' geralmente ocorre com vídeos incompatíveis (codecs H.265, VP9, etc.), formatos não suportados (MKV, AVI) ou problemas da própria API do WhatsApp Web/Puppeteer. Recomenda-se converter o vídeo para MP4 com codificação H.264/AAC.`,
        chatId
      );
    } else if (
      error.message?.includes("Protocol error") ||
      error.message?.includes("Target closed")
    ) {
      logMessage = `[Send Proof ${mediaTypeLabel}] Erro de Protocolo/Conexão com WhatsApp Web ao enviar ${normalizedFilename}. Pode ser instabilidade.`;
    }
    logger.error(logMessage, serializeError(error), chatId);
    return false;
  }
}

async function sendSocialProofs(client, chatId, contactName) {
  logger.info(
    `[Send Proofs Combined] Iniciando envio de link YouTube e provas locais para ${contactName}...`,
    chatId
  );
  let filesToSend = [];
  let filesAttempted = 0;
  let filesSentSuccess = 0;
  const delayMs = parseInt(process.env.SEND_PROOF_DELAY_MS || "1500", 10);
  try {
    logger.info(
      `[Send Proofs Combined] Buscando arquivos de mídia local em ${PROOFS_DIR}...`,
      chatId
    );
    try {
      const dirents = await fsPromises.readdir(PROOFS_DIR, {
        withFileTypes: true,
      });
      for (const dirent of dirents) {

        if (dirent.isFile()) {
          const filename = dirent.name;
          const ext = path.extname(filename).toLowerCase();
          const type = VALID_PROOF_EXTENSIONS[ext];
          if (type) {
            filesToSend.push({ filename, type });
          } else {
            logger.trace(
              `[Send Proofs Combined] Ignorando arquivo local com extensão inválida: ${filename}`,
              chatId
            );
          }
        } else {
          logger.trace(
            `[Send Proofs Combined] Ignorando subdiretório: ${dirent.name}`,
            chatId
          );
        }
      }
    } catch (readDirError) {
      if (readDirError.code === "ENOENT") {
        logger.warn(
          `[Send Proofs Combined] Diretório de provas (${PROOFS_DIR}) não encontrado. Nenhum arquivo local será enviado.`,
          chatId
        );
        filesToSend = [];
      } else {
        throw readDirError;
      }
    }
    filesAttempted = filesToSend.length;
    if (filesAttempted > 0) {
      logger.info(
        `[Send Proofs Combined] ${filesAttempted} arquivos locais encontrados. Iniciando envio...`,
        chatId
      );
      for (let i = 0; i < filesAttempted; i++) {
        const proof = filesToSend[i];
        const proofNumber = i + 1;
        logger.info(
          `[Send Proofs Combined] Enviando arquivo ${proofNumber}/${filesAttempted}: ${proof.filename} (${proof.type})...`,
          chatId
        );
        if (proof.type === 'text') {
          try {
            const filePath = path.join(PROOFS_DIR, proof.filename);
            const textContent = (await fsPromises.readFile(filePath, "utf8")).trim();
            if (textContent) {
              // Simular digitação para links (provas sociais)
              const chat = await client.getChatById(chatId);
              const canSimulateTyping = chat?.sendStateTyping;
              if (canSimulateTyping) {
                try {
                  // Calcular delay baseado no tamanho do texto
                  const CHARS_PER_SECOND = 25;
                  const estimatedTimeMs = (textContent.length / CHARS_PER_SECOND) * 1000;
                  const BASE_DELAY_MS = 800;
                  let calculatedDelay = BASE_DELAY_MS + estimatedTimeMs;
                  const randomFactor = Math.random() * 0.2 - 0.1;
                  calculatedDelay = calculatedDelay * (1 + randomFactor);
                  const typingDuration = Math.max(1000, Math.min(3000, Math.round(calculatedDelay)));
                  
                  await sleep(200);
                  await chat.sendStateTyping();
                  await sleep(typingDuration);
                } catch (typingError) {
                  logger.warn(
                    `[Send Proofs Combined] Erro durante simulação de digitação para ${proof.filename}.`,
                    typingError,
                    chatId
                  );
                }
              }
              
              await client.sendMessage(chatId, textContent);
              
              // Limpar estado do chat
              if (chat?.clearState) {
                try {
                  await chat.clearState();
                } catch {}
              }
              
              logger.info(
                `[Send Proofs Combined] Conteúdo de ${proof.filename} (texto) enviado com SUCESSO para ${contactName}.`,
                chatId
              );
              filesSentSuccess++;
            } else {
              logger.warn(
                `[Send Proofs Combined] Arquivo de texto ${proof.filename} está vazio. Nada enviado.`,
                chatId
              );
            }
          } catch (txtReadSendError) {
            logger.error(
              `[Send Proofs Combined] FALHA ao ler/enviar conteúdo do arquivo de texto ${proof.filename}.`,
              serializeError(txtReadSendError),
              chatId
            );
          }
        } else {
          const sentOk = await sendMediaProof(
            client,
            chatId,
            proof.type,
            path.join(PROOFS_DIR, proof.filename),
            null, // caption
            false // showFilename
          );
          if (sentOk) {
            filesSentSuccess++;
          } else {
            logger.warn(
              `[Send Proofs Combined] Falha final no envio do arquivo ${proofNumber}/${filesAttempted}: ${proof.filename}. Continuando...`,
              chatId
            );
          }
        }

      }
      logger.info(
        `[Send Proofs Combined] Envio de arquivos locais concluído (${filesSentSuccess}/${filesAttempted} com sucesso).`,
        chatId
      );
    } else {
      logger.info(
        `[Send Proofs Combined] Nenhum arquivo local válido encontrado para envio.`,
        chatId
      );
    }
    const overallSuccess = filesSentSuccess > 0;
    logger.info(
      `[Send Proofs Combined] Finalizado. Arquivos: ${filesSentSuccess}/${filesAttempted}`,
      chatId
    );
      return {
        overallSuccess: (filesSentSuccess > 0),
        filesAttempted,
        filesSent: filesSentSuccess,
      };
  } catch (error) {
    logger.error(
      `[Send Proofs Combined] Erro inesperado durante processo combinado de envio.`,
      serializeError(error),
      chatId
    );
    return {
      overallSuccess: false,
      filesAttempted: filesAttempted,
      filesSent: filesSentSuccess,
      error: error.message,
    };
  }
}

// ================================================================
// ===                         EXPORTS                          ===
// ================================================================

export default {
  downloadWhatsAppMedia,
  transcribeAudio,
  downloadAndTranscribeAudio,
  generateTTSAudio,
  sendMediaProof,
  sendSocialProofs,
};

// --- END OF FILE mediaHandler.js ---
