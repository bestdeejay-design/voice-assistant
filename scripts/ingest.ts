#!/usr/bin/env tsx
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { upsertChunks, type Chunk } from "../src/store.js";

const KB_ROOT = process.env.KB_SOURCE ?? "/Users/best/Projects/lovii_docs/docs";
const CHUNK_SIZE = 1000;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if ([".md", ".txt", ".json"].includes(extname(full))) out.push(full);
  }
  return out;
}

function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const parts = text.split(/\n{2,}/).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + p).length > size) {
      if (buf) chunks.push(buf.trim());
      buf = p;
    } else buf += "\n" + p;
  }
  if (buf) chunks.push(buf.trim());
  return chunks;
}

async function main() {
  const files = walk(KB_ROOT).filter((f) => !f.includes("/.git/") && !f.includes("/.omo/"));
  const chunks: Chunk[] = [];
  for (const f of files) {
    const text = readFileSync(f, "utf-8");
    chunkText(text).forEach((p, i) =>
      chunks.push({ id: `${f}#${i}`, text: p, source: f, date: new Date().toISOString().slice(0, 10) })
    );
  }
  console.log(`Индексация: ${files.length} файлов, ${chunks.length} чанков`);
  await upsertChunks(chunks);
  console.log("Готово.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
