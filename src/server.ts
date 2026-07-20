#!/usr/bin/env tsx
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { transcribeBuffer } from "./stt.js";
import { answer } from "./rag.js";
import { speak } from "./tts.js";

const PORT = Number(process.env.PORT ?? 3000);
const PUBLIC = join(import.meta.dirname, "..", "public");

function readBody(req: import("node:http").IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function json(res: import("node:http").ServerResponse, data: unknown, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

async function serveStatic(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) {
  let p = req.url === "/" ? "/index.html" : req.url!.split("?")[0];
  const fp = join(PUBLIC, p);
  if (!fp.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(fp);
    const type = extname(fp) === ".html" ? "text/html" : extname(fp) === ".js" ? "text/javascript" : "text/plain";
    res.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
    res.end(data);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && (req.url === "/" || req.url?.startsWith("/index") || req.url === "/app")) {
      return serveStatic(req, res);
    }
    if (req.method === "POST" && req.url === "/api/ask-audio") {
      const buf = await readBody(req);
      if (buf.length === 0) return json(res, { error: "empty audio" }, 400);
      const question = await transcribeBuffer(buf);
      if (!question) return json(res, { error: "не удалось распознать речь" }, 422);
      const { text, citations } = await answer(question);
      speak(text); // озвучка на ноутбуке (Вариант А)
      return json(res, { question, text, citations });
    }
    if (req.method === "POST" && req.url === "/api/ask") {
      const buf = await readBody(req);
      const { text: question } = JSON.parse(buf.toString("utf-8") || "{}");
      if (!question) return json(res, { error: "empty text" }, 400);
      const { text, citations } = await answer(question);
      speak(text);
      return json(res, { question, text, citations });
    }
    if (req.method === "POST" && req.url === "/api/tts") {
      const buf = await readBody(req);
      const { text } = JSON.parse(buf.toString("utf-8") || "{}");
      if (!text) return json(res, { error: "empty text" }, 400);
      await speak(text);
      return json(res, { ok: true });
    }
    if (req.method === "GET") return serveStatic(req, res);
    json(res, { error: "not found" }, 404);
  } catch (e: any) {
    console.error(e);
    json(res, { error: e?.message ?? String(e) }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`🎙️  Voice Assistant web — http://localhost:${PORT}`);
  console.log("   Запись голоса в браузере → распознавание → ответ → озвучка на ноутбуке.");
});
