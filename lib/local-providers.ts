export type LocalProviderKind = "ollama" | "lm-studio";

export interface LocalProviderPreset {
  kind: LocalProviderKind;
  name: string;
  baseUrl: string;
  discoveryUrl: string;
  description: string;
}

export interface LocalModelDownload {
  label: string;
  size: string;
  ollamaModel: string;
  lmStudioModel: string;
  ollamaUrl: string;
  lmStudioUrl: string;
}

export const QWEN_LOCAL_MODELS: LocalModelDownload[] = [
  { label: "Qwen3 4B", size: "~2.5 GB", ollamaModel: "qwen3:4b", lmStudioModel: "qwen/qwen3-4b-2507", ollamaUrl: "https://ollama.com/library/qwen3:4b", lmStudioUrl: "https://lmstudio.ai/models/qwen/qwen3-4b-2507" },
  { label: "Qwen3 8B", size: "~5.2 GB", ollamaModel: "qwen3:8b", lmStudioModel: "qwen/qwen3-8b-2507", ollamaUrl: "https://ollama.com/library/qwen3:8b", lmStudioUrl: "https://lmstudio.ai/models/qwen3" },
  { label: "Qwen3 30B MoE", size: "~19 GB", ollamaModel: "qwen3:30b", lmStudioModel: "qwen/qwen3-30b-a3b-2507", ollamaUrl: "https://ollama.com/library/qwen3:30b", lmStudioUrl: "https://lmstudio.ai/models/qwen/qwen3-30b-a3b-2507" },
];

export const LOCAL_PROVIDER_PRESETS: LocalProviderPreset[] = [
  {
    kind: "ollama",
    name: "Ollama (Local)",
    baseUrl: "http://localhost:11434/v1",
    discoveryUrl: "http://localhost:11434/api/tags",
    description: "Run Llama, Qwen, Mistral, Gemma, DeepSeek and other local models.",
  },
  {
    kind: "lm-studio",
    name: "LM Studio (Local)",
    baseUrl: "http://localhost:1234/v1",
    discoveryUrl: "http://localhost:1234/v1/models",
    description: "Use any model loaded in the LM Studio local server.",
  },
];

export async function discoverLocalModels(preset: LocalProviderPreset): Promise<string[]> {
  const response = await fetch(preset.discoveryUrl, { signal: AbortSignal.timeout(4000), cache: "no-store" });
  if (!response.ok) throw new Error(`${preset.name} returned HTTP ${response.status}. Start its local server and try again.`);
  const payload: unknown = await response.json();
  if (preset.kind === "ollama") {
    const models = payload && typeof payload === "object" && Array.isArray((payload as { models?: unknown }).models) ? (payload as { models: Array<{ name?: unknown }> }).models : [];
    return models.flatMap((model) => typeof model.name === "string" && model.name.trim() ? [model.name.trim()] : []);
  }
  const models = payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data) ? (payload as { data: Array<{ id?: unknown }> }).data : [];
  return models.flatMap((model) => typeof model.id === "string" && model.id.trim() ? [model.id.trim()] : []);
}
