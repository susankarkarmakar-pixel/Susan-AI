export type ChatErrorAction = "settings" | "retry" | "models" | null;
export function getChatErrorAction(message: string): ChatErrorAction;
export function shouldAutomaticallyFallback(message: string): boolean;
