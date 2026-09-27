export type ResponseVote = "up" | "down";
export function getResponseFeedback(messageId: string): ResponseVote | null;
export function setResponseFeedback(messageId: string, vote: ResponseVote): void;
