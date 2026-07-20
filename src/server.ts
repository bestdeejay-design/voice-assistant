import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { extname, join, dirname } from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { transcribe } from "./stt.js";
import { answer } from "./rag.js";
import { speak } from "./tts.js";

const exec = promisify(execFile);
const PORT = Number(process.env.PORT ?? 3000);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, "..", "public");
const TMP = "/tmp/va-web";

mkdirSync(TMP, { recursive: true });

function sendJson(res: any, code: number, data: any) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendFile(res: any, path: string) {
  if (!existsSync(path)) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  const mt = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] ?? "text/plain";
  res.writeHead(200, { "Content-Type": mt });
  res.end(readFileSync(path));
}

async function readBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  // статика
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    return sendFile(res, join(PUBLIC, "index.html"));
  }
  if (req.method === "GET" && url.pathname.startsWith("/public/")) {
    return sendFile(res, join(PUBLIC, url.pathname.replace("/public/", "")));
  }

  // озвучка текста (возвращает wav для проигрывания в браузере)
  if (req.method === "POST" && url.pathname === "/api/tts") {
    const body = await readBody(req);
    const text = body.toString("utf-8");
    const aiff = join(TMP, `tts-${Date.now()}.aiff`);
    const wav = join(TMP, `tts-${Date.now()}.wav`);
    try {
      execFileSync("say", ["-v", process.env.TTS_VOICE ?? "Yuri", "-o", aiff, text]);
      await exec("ffmpeg", ["-y", "-i", aiff, wav]);
      const buf = readFileSync(wav);
      res.writeHead(200, { "Content-Type": "audio/wav" });
      res.end(buf);
    } catch (e: any) {
      sendJson(res, 500, { error: String(e?.message ?? e) });
    }
    return;
  }

  // запрос текстом
  if (req.method === "POST" && url.pathname === "/api/ask") {
    const body = await readBody(req);
    let question = body.toString("utf-8");
    // если пришёл JSON {text}
    try {
      const j = JSON.parse(question);
      if (j.text) question = j.text;
    } catch { /* обычный текст */ }

    try {
      const { text, citations } = await answer(question);
      sendJson(res, 200, { question, answer: text, citations });
    } catch (e: any) {
      sendJson(res, 500, { error: String(e?.message ?? e) });
    }
    return;
  }

  // запрос аудио (whisper STT → RAG)
  if (req.method === "POST" && url.pathname === "/api/ask-audio") {
    const buf = await readBody(req);
    const raw = join(TMP, `in-${Date.now()}.webm`);
    const wav = join(TMP, `in-${Date.now()}.wav`);
    writeFileSync(raw, buf);
    try {
      await exec("ffmpeg", ["-y", "-i", raw, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wav]);
      const question = await transcribe(wav);
      const { text, citations } = await answer(question);
      sendJson(res, 200, { question, answer: text, citations });
    } catch (e: any) {
      sendJson(res, 500, { error: String(e?.message ?? e) });
    }
    return;
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`🌐 Voice Assistant UI: http://localhost:${PORT}`);
});
