import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === "production";

const ALLOWED_VOICES = new Set(["Kore", "Zephyr"]);

const DEFAULT_STYLE =
  "Warm, poised, and sophisticated Indonesian female narrator with graceful articulation, calm luxury heritage brand cadence, and clear pronunciation of Indonesian and classic architectural terms; pure clean spoken studio voice only without background music or sound effects.";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw Object.assign(
      new Error("GEMINI_API_KEY belum dikonfigurasi pada server."),
      { status: 500 }
    );
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: "v1beta",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function createWavHeader(
  pcmDataLength: number,
  sampleRate = 24000,
  channels = 1,
  bitDepth = 16
): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = (sampleRate * channels * bitDepth) / 8;
  const blockAlign = (channels * bitDepth) / 8;

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmDataLength, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitDepth, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmDataLength, 40);

  return header;
}

function ensureWavBuffer(rawBuffer: Buffer): {
  wavBuffer: Buffer;
  sampleRate: number;
  channels: number;
  bitDepth: number;
  durationSeconds: number;
} {
  const isRiff =
    rawBuffer.length >= 44 &&
    rawBuffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    rawBuffer.subarray(8, 12).toString("ascii") === "WAVE";

  const wavBuffer = isRiff
    ? rawBuffer
    : Buffer.concat([createWavHeader(rawBuffer.length, 24000, 1, 16), rawBuffer]);

  let sampleRate = 24000;
  let channels = 1;
  let bitDepth = 16;
  let dataBytes = Math.max(0, wavBuffer.length - 44);

  if (wavBuffer.length >= 44) {
    let offset = 12;
    while (offset + 8 <= wavBuffer.length) {
      const chunkId = wavBuffer.subarray(offset, offset + 4).toString("ascii");
      const chunkSize = wavBuffer.readUInt32LE(offset + 4);
      if (chunkId === "fmt " && offset + 24 <= wavBuffer.length) {
        channels = wavBuffer.readUInt16LE(offset + 10) || 1;
        sampleRate = wavBuffer.readUInt32LE(offset + 12) || 24000;
        bitDepth = wavBuffer.readUInt16LE(offset + 22) || 16;
      } else if (chunkId === "data") {
        dataBytes = chunkSize;
        break;
      }
      offset += 8 + chunkSize + (chunkSize % 2);
    }
  }

  const bytesPerSecond = sampleRate * channels * (bitDepth / 8);
  const durationSeconds =
    bytesPerSecond > 0 ? Number((dataBytes / bytesPerSecond).toFixed(2)) : 0;

  return {
    wavBuffer,
    sampleRate,
    channels,
    bitDepth,
    durationSeconds,
  };
}

async function generateWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: unknown) {
      lastError = error;
      const errObj = error as { status?: number; code?: number; message?: string };
      const status = errObj?.status || errObj?.code || 500;
      const isRetryable = status >= 500 || status === 429;
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      const delayMs = 600 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, model: "gemini-3.8-flash-tts" });
  });

  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName, styleInstruction } = req.body ?? {};

      if (typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({
          error: "Naskah teks tidak boleh kosong.",
        });
      }

      const trimmedText = text.trim();
      if (trimmedText.length > 5000) {
        return res.status(400).json({
          error: "Panjang naskah maksimal 5.000 karakter per sesi sintesis.",
        });
      }

      const selectedVoice =
        typeof voiceName === "string" && ALLOWED_VOICES.has(voiceName)
          ? voiceName
          : "Kore";

      const selectedStyle =
        typeof styleInstruction === "string" && styleInstruction.trim().length > 0
          ? styleInstruction.trim()
          : DEFAULT_STYLE;

      const ai = getAiClient();

      const response = await generateWithRetry(() =>
        ai.models.generateContent({
          model: "gemini-3.8-flash-tts",
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: trimmedText,
                  speechMetadata: {
                    style: selectedStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: selectedVoice,
                },
              },
            },
          },
        })
      );

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      const audioPart = parts.find((part) => part.inlineData?.data);
      const base64Raw = audioPart?.inlineData?.data;

      if (!base64Raw) {
        return res.status(502).json({
          error:
            "Model suara tidak mengembalikan data audio. Silakan coba kembali.",
        });
      }

      const rawBuffer = Buffer.from(base64Raw, "base64");
      const { wavBuffer, sampleRate, channels, bitDepth, durationSeconds } =
        ensureWavBuffer(rawBuffer);

      return res.json({
        audioBase64: wavBuffer.toString("base64"),
        mimeType: "audio/wav",
        durationSeconds,
        sampleRate,
        channels,
        bitDepth,
        byteLength: wavBuffer.length,
        voiceName: selectedVoice,
      });
    } catch (error: unknown) {
      const errObj = error as {
        status?: number;
        code?: number;
        message?: string;
      };
      const status = Number(errObj?.status || errObj?.code) || 500;
      const message =
        errObj?.message || "Terjadi kendala saat memproses sintesis suara.";

      console.error("[TTS Error]", status, message);

      if (status === 403 || message.includes("PERMISSION_DENIED")) {
        return res.status(403).json({
          error:
            "Akses API Gemini ditolak. Periksa kunci API pada panel Settings > Secrets.",
        });
      }
      if (status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
        return res.status(429).json({
          error:
            "Batas kuota permintaan suara tercapai sementara. Tunggu beberapa saat lalu coba lagi.",
        });
      }
      if (status === 404) {
        return res.status(404).json({
          error: "Model suara gemini-3.8-flash-tts tidak ditemukan.",
        });
      }

      return res.status(status >= 400 && status < 600 ? status : 500).json({
        error: message,
      });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distDir, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
