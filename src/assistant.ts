#!/usr/bin/env tsx
import { transcribe } from "./stt.js";
import { answer } from "./rag.js";
import { speak } from "./tts.js";

/**
 * Голосовой цикл ассистента.
 * Режимы:
 *   npm run assist -- file <path.wav>   — обработать готовый аудиофайл
 *   npm run assist                       — запись с микрофона (через sox/rec),
 *                                           затем транскрибация и ответ
 */
async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const fileIdx = args.indexOf("file");
  let audioPath: string;

  if (fileIdx !== -1 && args[fileIdx + 1]) {
    audioPath = args[fileIdx + 1];
  } else {
    // интерактивная запись с микрофона: говоришь → Enter для остановки
    const { spawn } = await import("node:child_process");
    audioPath = `/tmp/va-input.wav`;
    console.log("🎙️  Говорите, затем нажмите Enter для остановки...");
    const rec = spawn("rec", ["-r", "16000", "-c", "1", "-t", "wav", audioPath]);
    await new Promise<void>((resolve) => {
      process.stdin.once("data", () => {
        rec.kill("SIGINT");
        resolve();
      });
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("📝 Распознавание...");
  const question = await transcribe(audioPath);
  console.log(`❓ ${question}`);

  console.log("🧠 Поиск ответа...");
  const { text, citations } = await answer(question);

  console.log(`💬 ${text}`);
  console.log("📚 Источники:", citations.join(", "));

  await speak(text);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
