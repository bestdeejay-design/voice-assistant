import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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
