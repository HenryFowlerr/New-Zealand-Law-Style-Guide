# Optional AI-assisted parsing

The tool fills citation fields for free with **no model at all** in most cases:

1. **Paste a link** — a DOI resolves through [Crossref](https://www.crossref.org/),
   an ISBN through [Open Library](https://openlibrary.org/); both are free,
   need no key, and work straight from the browser.
2. **Paste the text** — a rule-based scanner recognises citation shapes
   (neutral citations, reporters, pinpoints, dates, editions, publication
   blocks) and places them in the right fields.

The one case rules can't fully solve is **messy pasted text with no DOI and no
formatting** — e.g. telling where an author ends and a book title begins. A
small LLM handles that well. The engine has a transport-agnostic hook for it
(`src/engine/llmParse.ts`): it builds a strict JSON-schema prompt and parses the
reply into fields, while the inference call is injected — so the same code runs
against any of the free options below.

## Option A — Local model on your Mac (Ollama)

Best for your own use and for testing. Free, private, offline.

```sh
# 1. Install Ollama (macOS): https://ollama.com
# 2. Pull a small instruct model (≈2 GB, runs in ~4–6 GB RAM on Apple Silicon)
ollama pull llama3.2:3b     # or qwen2.5:3b, phi3.5
# 3. Ollama now serves http://localhost:11434
```

Wire it in with the provided adapter:

```ts
import { llmParse, ollamaModel } from "./engine/llmParse";
const fields = await llmParse(pastedText, type, ollamaModel("llama3.2:3b"));
```

**Limitation:** this only works on a machine that is running Ollama. A visitor
to the public GitHub Pages site cannot reach *your* Mac, so this path is for you
and other power users, not the default for everyone.

## Option B — In-browser model (WebLLM) — free for every visitor

Runs the model **in the visitor's own browser** via WebGPU. No backend, no key,
private, and the whole app still lives on GitHub Pages.

```sh
npm install @mlc-ai/web-llm
```

```ts
import { CreateMLCEngine } from "@mlc-ai/web-llm";
import { llmParse } from "./engine/llmParse";

const engine = await CreateMLCEngine("Llama-3.2-3B-Instruct-q4f16_1-MLC");
const webllmModel = async ({ system, user }) => {
  const r = await engine.chat.completions.create({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_object" },
  });
  return r.choices[0].message.content ?? "";
};
const fields = await llmParse(pastedText, type, webllmModel);
```

**Trade-offs:** first visit downloads the model (~0.5–2 GB, then cached);
needs WebGPU (desktop Chrome/Edge are solid, mobile Safari is limited).
[`@huggingface/transformers`](https://github.com/huggingface/transformers.js) or
[`@wllama/wllama`](https://github.com/ngxson/wllama) are WASM alternatives that
work without WebGPU (slower).

## Why it isn't turned on by default

WebLLM adds a large dependency and a big first-load, and Ollama needs a local
install — neither should be forced on a student who just wants to paste a
reference. The free APIs + scanner already cover the common cases, so the LLM
belongs behind an opt-in "AI parse" control. The parsing core and prompt are
already built and tested (`tests/engine-llmparse.test.ts`); enabling a backend
is a small, isolated step.
