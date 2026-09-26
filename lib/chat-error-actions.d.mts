export type ChatErrorAction = "settings" | "retry" | "models" | null;
export function getChatErrorAction(message: string): ChatErrorAction;
