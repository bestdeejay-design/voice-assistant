import { Ollama } from "ollama";

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? "http://localhost:11434" });
const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

export async function embedText(text: string): Promise<number[]> {
  const res = await ollama.embeddings({ model: EMBED_MODEL, prompt: text });
  return res.embedding;
}
