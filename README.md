# voice-assistant

Бесплатный голосовой RAG-ассистент. Говоришь вопрос — получаешь голосовой
ответ по базе знаний проекта Lovii, с цитированием источника. Генерация —
через бесплатные облачные модели Ollama-провайдера, распознавание и TTS —
локально, без платных API-ключей.

## Как это работает

```
[Микрофон] → Whisper (STT) → текст
  → RAG по базе знаний (Ollama embeddings + локальный индекс)
  → генерация ответа (облачная модель: minimax-m3 / nemotron-3-super) + цитаты
  → macOS say (TTS) → [Динамики]
```

## Стек (бесплатно)

- **STT**: whisper.cpp (`whisper-cli`, модель `ggml-small.bin`) — локально, офлайн
- **Embeddings**: Ollama `nomic-embed-text`
- **Векторный индекс**: локальный in-process (косинусное сходство, файл)
- **LLM (генерация)**: облачные бесплатные модели Ollama-провайдера
  (`minimax-m3:cloud`, `nemotron-3-super:cloud`) с fallback на локальные
  (`deepseek-r1`, `yi-coder`)
- **TTS**: встроенный macOS `say` (голос Yuri) — ноль установки
- **Рантайм**: TypeScript + Node.js

## Быстрый старт

```bash
brew install sox                                   # для записи с микрофона (rec)
npm install
npm run ingest          # индексирует lovii_docs/docs (путь можно переопределить KB_SOURCE)
npm run assist          # режим записи: говорите → Enter для остановки → слушайте ответ
npm run assist file путь.wav   # обработать готовый аудиофайл
```

> Первый запуск `npm run assist` (запись) запросит у macOS доступ к микрофону
> для терминала. Говорите, затем нажмите Enter — ассистент распознает, найдёт
> ответ в базе и озвучит его.

## Структура

```
src/
  embed.ts      — Ollama embeddings
  store.ts      — локальный векторный индекс
  stt.ts        — whisper.cpp транскрибация
  tts.ts        — macOS say озвучка
  rag.ts        — retrieval + генерация с цитатами
  assistant.ts  — голосовой цикл
scripts/ingest.ts — индексация базы знаний
models/         — ggml-small.bin (whisper)
```

Подробности — в [docs/PROJECT.md](docs/PROJECT.md).
