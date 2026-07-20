#!/usr/bin/env tsx
import { spawn } from "node:child_process";
import * as readline from "node:readline";
import { transcribe } from "./stt.js";
import { answer } from "./rag.js";
import { speak } from "./tts.js";

const AUDIO = "/tmp/va-input.wav";

function record(): Promise<void> {
  return new Promise((resolve, reject) => {
    const rec = spawn("rec", ["-r", "16000", "-c", "1", "-t", "wav", AUDIO]);
    rec.on("error", reject);
    rec.on("exit", () => resolve());
    // остановка записи по сигналу
    process.once("SIGUSR1", () => rec.kill("SIGINT"));
    (record as any)._stop = () => {
      try { rec.kill("SIGINT"); } catch { /* already exited */ }
    };
  });
}

async function handleQuestion() {
  console.log("📝 Распознавание...");
  const question = await transcribe(AUDIO);
  console.log(`❓ ${question}`);
  console.log("🧠 Поиск ответа...");
  const { text, citations } = await answer(question);
  console.log(`💬 ${text}`);
  console.log("📚 Источники:", citations.join(", "));
  await speak(text);
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const fileIdx = args.indexOf("file");

  // режим готового файла
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    await transcribe(args[fileIdx + 1]).then(async (question) => {
      console.log(`❓ ${question}`);
      const { text, citations } = await answer(question);
      console.log(`💬 ${text}`);
      console.log("📚 Источники:", citations.join(", "));
      await speak(text);
    });
    return;
  }

  // интерактивный режим: надстройка над консолью
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let recording = false;
  let recProc: import("node:child_process").ChildProcess | null = null;

  const prompt = () => {
    rl.setPrompt(recording ? "● ЗАПИСЬ — (r) стоп: " : "(r) запись   (q) выход: ");
    rl.prompt();
  };

  console.log("🎙️  Голосовой ассистент. Управление микрофоном через консоль.");
  prompt();

  rl.on("line", async (line) => {
    const cmd = line.trim().toLowerCase();
    if (cmd === "q" || cmd === "exit") {
      if (recProc) recProc.kill("SIGINT");
      rl.close();
      process.exit(0);
    }
    if (cmd === "r") {
      if (!recording) {
        recording = true;
        recProc = spawn("rec", ["-r", "16000", "-c", "1", "-t", "wav", AUDIO]);
        console.log("● Идёт запись... говорите.");
        prompt();
      } else {
        recording = false;
        if (recProc) { recProc.kill("SIGINT"); recProc = null; }
        console.log("■ Запись остановлена. Обработка...");
        rl.pause();
        try {
          await handleQuestion();
        } catch (e: any) {
          console.error("Ошибка:", e?.message ?? e);
        }
        rl.resume();
        prompt();
      }
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
