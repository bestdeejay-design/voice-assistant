import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { embedText } from "./embed.js";

const INDEX_PATH = process.env.INDEX_PATH ?? "./.kb-index.json";

export interface Chunk {
  id: string;
  text: string;
  source: string;
  date?: string;
}

interface IndexEntry extends Chunk {
  vector: number[];
}
interface IndexFile {
  collection: string;
  entries: IndexEntry[];
}

function loadIndex(): IndexFile {
  if (existsSync(INDEX_PATH)) {
    try {
      return JSON.parse(readFileSync(INDEX_PATH, "utf-8")) as IndexFile;
    } catch {
      /* повреждённый индекс — пересоздаём */
    }
  }
  return { collection: "lovii", entries: [] };
}

function saveIndex(idx: IndexFile): void {
  mkdirSync(dirname(INDEX_PATH), { recursive: true });
  writeFileSync(INDEX_PATH, JSON.stringify(idx), "utf-8");
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

export async function upsertChunks(chunks: Chunk[]): Promise<void> {
  const idx = loadIndex();
  const byId = new Map(idx.entries.map((e) => [e.id, e]));
  for (const c of chunks) byId.set(c.id, { ...c, vector: await embedText(c.text) });
  idx.entries = [...byId.values()];
  saveIndex(idx);
}

export async function querySimilar(text: string, topK = 5) {
  const idx = loadIndex();
  const qvec = await embedText(text);
  const scored = idx.entries
    .map((e) => ({ e, score: cosine(qvec, e.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  return {
    documents: [scored.map((s) => s.e.text)],
    metadatas: [scored.map((s) => ({ source: s.e.source, date: s.e.date ?? "" }))],
  };
}

/** Возвращает первый чанк из файла, чьё имя содержит fname (поиск по всему индексу). */
export function getChunkByFile(fname: string): Chunk | undefined {
  const idx = loadIndex();
  return idx.entries.find((e) => e.source.includes(fname));
}
