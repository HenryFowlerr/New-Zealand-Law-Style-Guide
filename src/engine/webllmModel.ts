/**
 * In-browser LLM adapter (WebLLM) for optional AI-assisted extraction.
 *
 * The model runs entirely in the visitor's browser on WebGPU — free, private,
 * no backend, no API key — so the whole app still ships as a static site. The
 * library and model weights are loaded on demand from a CDN the first time the
 * user opts in, so nothing is added to the main bundle and no npm dependency is
 * required. The runtime import goes through `new Function` so neither the type
 * checker nor the bundler tries to resolve the CDN URL at build time.
 *
 * This layer only obtains and drives the model; the prompt and the parsing of
 * its reply live in llmParse.ts and are unit-tested there. Inference itself
 * needs a real WebGPU browser and cannot be exercised in CI.
 */
import type { CallModel } from "./llmParse";

// A small instruct model — ~1 GB download, fine for schema-guided extraction on
// a low-RAM machine. Swap for a 3B build for higher quality if desired.
const DEFAULT_MODEL = "Llama-3.2-1B-Instruct-q4f16_1-MLC";
const WEBLLM_CDN = "https://esm.run/@mlc-ai/web-llm";

/** A truly dynamic import the bundler and tsc leave untouched. */
const cdnImport = (url: string): Promise<any> =>
  (new Function("u", "return import(u)") as (u: string) => Promise<any>)(url);

export function isWebGpuAvailable(): boolean {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

export type ProgressReport = { text: string; progress: number };

export type WebllmSession = {
  callModel: CallModel;
  model: string;
};

let sessionPromise: Promise<WebllmSession> | null = null;

/**
 * Load WebLLM and initialise an engine, reusing it across calls. `onProgress`
 * reports the (potentially large) first-time model download. Rejects with a
 * clear message when WebGPU is unavailable.
 */
export function getWebllmSession(
  onProgress?: (report: ProgressReport) => void,
  model: string = DEFAULT_MODEL,
): Promise<WebllmSession> {
  if (!isWebGpuAvailable()) {
    return Promise.reject(
      new Error(
        "This browser has no WebGPU support, which in-browser AI needs. Try desktop Chrome or Edge.",
      ),
    );
  }
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    const webllm = await cdnImport(WEBLLM_CDN);
    const engine = await webllm.CreateMLCEngine(model, {
      initProgressCallback: (report: ProgressReport) => onProgress?.(report),
    });
    const callModel: CallModel = async ({ system, user }) => {
      const reply = await engine.chat.completions.create({
        stream: false,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return reply?.choices?.[0]?.message?.content ?? "";
    };
    return { callModel, model };
  })();

  // Let a failed load be retried rather than cached forever.
  sessionPromise.catch(() => {
    sessionPromise = null;
  });
  return sessionPromise;
}
