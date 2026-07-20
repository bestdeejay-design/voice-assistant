import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const VOICE = process.env.TTS_VOICE ?? "Yuri";

/**
 * Озвучивает текст через встроенный macOS TTS (`say`).
 * Бесплатно, локально, без установки и моделей.
 */
export async function speak(text: string): Promise<void> {
  await exec("say", ["-v", VOICE, text]);
}
