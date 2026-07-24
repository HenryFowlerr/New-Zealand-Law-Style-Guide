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

## Option B — In-browser model (WebLLM) — free for every visitor — **built in**

Runs the model **in the visitor's own browser** via WebGPU. No backend, no key,
private, and the whole app still lives on GitHub Pages.

This is wired in already. When a source type is selected from a pasted
reference and the browser supports WebGPU, an **"✨ AI auto-fill (in-browser,
beta)"** button appears above the fields. Clicking it:

1. loads WebLLM from a CDN on demand (`src/engine/webllmModel.ts`) — nothing is
   added to the main bundle, and there is no npm dependency to install;
2. downloads the model the first time (~1 GB, then cached by the browser);
3. runs `llmParse` on the pasted text and fills the fields, leaving the
   review-before-copy step in place.

The default model is `Llama-3.2-1B-Instruct-q4f16_1-MLC` (small, low-RAM
friendly); change `DEFAULT_MODEL` in `webllmModel.ts` to a 3B build for higher
quality.

**Trade-offs:** first visit downloads the model (~1–2 GB, then cached); needs
WebGPU (desktop Chrome/Edge are solid, mobile Safari is limited — the button
simply doesn't appear there).
[`@huggingface/transformers`](https://github.com/huggingface/transformers.js) or
[`@wllama/wllama`](https://github.com/ngxson/wllama) are WASM alternatives that
work without WebGPU (slower).

## Why it's opt-in, not automatic

The model's first-load is large and WebGPU isn't everywhere, so a student who
just wants to paste a reference shouldn't pay that cost unasked. The free APIs +
scanner already cover the common cases, so the LLM sits behind the opt-in
button and only the visitors who want it ever load it. The parsing core and
prompt are unit-tested (`tests/engine-llmparse.test.ts`); actual inference needs
a real WebGPU browser and can't be exercised in CI.
