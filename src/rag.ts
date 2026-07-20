import { Ollama } from "ollama";
import { querySimilar, getChunkByFile } from "./store.js";

const ollama = new Ollama({ host: process.env.OLLAMA_HOST ?? "http://localhost:11434" });
const GEN_MODEL = process.env.GEN_MODEL ?? "deepseek-r1";

export interface Answer {
  text: string;
  citations: string[];
}

export async function answer(question: string, topK = 8): Promise<Answer> {
  const res = await querySimilar(question, topK);
  let docs = res.documents?.[0] ?? [];
  const metas = res.metadatas?.[0] ?? [];

  // Heuristic boost: если в вопросе упомянута архитектура/дизайн/финансы —
  // подтягиваем соответствующий документ из всего индекса вне топ-K.
  const q = question.toLowerCase();
  const boost: Record<string, string> = {
    архитектур: "ARCHITECTURE.md",
    дизайн: "DESIGN.md",
    финанс: "FINANCIAL_MODEL.md",
    prd: "PRD_DEMO.md",
    структу: "lovii_summary.md",
  };
  for (const [kw, fname] of Object.entries(boost)) {
    if (q.includes(kw)) {
      const chunk = getChunkByFile(fname);
      if (chunk && !docs.includes(chunk.text)) {
        docs.unshift(chunk.text);
        metas.unshift({ source: chunk.source, date: chunk.date ?? "" });
      }
    }
  }

  const citations = metas.map((m: any) => m.source);
  const context = docs.map((d, i) => `[${i + 1}] (${citations[i]})\n${d}`).join("\n\n");

  const prompt =
    "Ты — голосовой ассистент по документации проекта Lovii. " +
    "Ответь на вопрос ТОЛЬКО на основе контекста. Если ответа нет — скажи об этом. " +
    "Кратко, подходит для озвучивания. Цитируй номера фрагментов.\n\n" +
    `Контекст:\n${context}\n\nВопрос: ${question}\n\nОтвет:`;

  let text: string;
  try {
    const r = await ollama.generate({ model: GEN_MODEL, prompt, stream: false });
    text = r.response.trim();
  } catch {
    text = `Контекст по запросу «${question}»:\n\n${context.slice(0, 1200)}`;
  }
  return { text, citations: [...new Set(citations)] };
}
