export interface GenerationOptions {
  temperature: number;
  maxOutputTokens: number;
}
export function normalizeGenerationOptions(input?: { temperature?: unknown; maxOutputTokens?: unknown }): GenerationOptions;
export function normalizeSystemPrompt(value: unknown): { valid: boolean; prompt: string };
