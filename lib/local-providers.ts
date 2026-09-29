export type LocalProviderKind = "ollama" | "lm-studio";

export interface LocalProviderPreset {
  kind: LocalProviderKind;
  name: string;
  baseUrl: string;
  discoveryUrl: string;
  description: string;
}

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
