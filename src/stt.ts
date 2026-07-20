import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const exec = promisify(execFile);

const WHISPER_BIN = process.env.WHISPER_BIN ?? "/opt/homebrew/bin/whisper-cli";
const MODEL = process.env.WHISPER_MODEL ?? "./models/ggml-small.bin";

/**
 * Транскрибирует аудиофайл (wav/mp3) в текст через локальный whisper.cpp.
 * Бесплатно, офлайн, без API.
 */
export async function transcribe(audioPath: string): Promise<string> {
  const outBase = join(tmpdir(), `whisper-${Date.now()}`);
  await exec(WHISPER_BIN, [
    "-m", MODEL,
    "-f", audioPath,
    "-otxt",
    "-of", outBase,
    "-l", process.env.WHISPER_LANG ?? "ru",
  ]);
  const txtPath = `${outBase}.txt`;
  const text = readFileSync(txtPath, "utf-8").trim();
  try { unlinkSync(txtPath); } catch { /* ignore */ }
  return text;
}

/**
 * Транскрибирует аудио из памяти (webm/opus/wav), не сохраняя на диск.
 * ffmpeg конвертирует в wav (16k mono) в stdout, whisper.cpp читает через stdin.
 */
export async function transcribeBuffer(buf: Buffer): Promise<string> {
  const ffmpeg = spawn("ffmpeg", [
    "-i", "pipe:0",
    "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1",
  ]);
  const whisper = spawn(WHISPER_BIN, [
    "-m", MODEL,
    "-f", "-",            // читать wav из stdin
    "-otxt",
    "-of", "-",           // писать текст в stdout
    "-l", process.env.WHISPER_LANG ?? "ru",
  ]);
  ffmpeg.stdout.pipe(whisper.stdin);
  const errChunks: Buffer[] = [];
  whisper.stdout.on("data", (d) => errChunks.push(d));
  const fErr: Buffer[] = [];
  ffmpeg.stderr.on("data", (d) => fErr.push(d));
  whisper.stderr.on("data", (d) => fErr.push(d));

  ffmpeg.stdin.write(buf);
  ffmpeg.stdin.end();

  await new Promise<void>((res, rej) => {
    whisper.on("close", (code) => (code === 0 ? res() : rej(new Error("whisper exit " + code))));
    whisper.on("error", rej);
  });
  return Buffer.concat(errChunks).toString("utf-8").trim();
}
