const MAX_QUESTION_LENGTH = 140;
const MAX_TOPIC_LENGTH = 72;

/**
 * Generate lightweight, local follow-up prompts grounded in both the user's
 * request and the assistant response. This intentionally makes no provider
 * request, so suggestions never add latency or cost.
 */
export function getRelatedQuestions(answer: string, userPrompt = ""): string[] {
  const cleanAnswer = cleanText(answer);
  if (!cleanAnswer) return [];

  const isBengali = /[\u0980-\u09FF]/.test(`${userPrompt} ${cleanAnswer}`);
  const topic = extractTopic(cleanAnswer, userPrompt, isBengali);
  const headings = extractHeadings(answer).slice(0, 2);
  const hasCode = /```|\b(function|class|import|const|def|SELECT|<\/?[a-z])/i.test(answer);
  const hasSources = /\[S\d+\]|https?:\/\//i.test(answer);
  const isComparison = /\b(compare|comparison|versus|vs\.?|difference|দুর্গত|তুলনা|পার্থক্য)\b/i.test(`${userPrompt} ${cleanAnswer}`);
  const isHowTo = /\bhow\b|\bsteps?\b|\bguide\b|\bimplement\b|\bsetup\b|\bকীভাবে\b|\bধাপ\b|\bসেটআপ\b/i.test(`${userPrompt} ${cleanAnswer}`);

  const english = [
    isHowTo ? `Can you turn the ${topic} guidance into a short checklist?` : `What should I do first with ${topic}?`,
    hasCode ? `Can you adapt the ${topic} example for my specific project?` : `Can you show a concrete example of ${topic}?`,
    isComparison ? `Which option is better for my situation, and why?` : `What are the main limitations or risks of ${topic}?`,
    hasSources ? `Which part of ${topic} should I verify or explore next?` : headings.length > 0 ? `Can you explain “${headings[0]}” in more detail?` : `How does ${topic} relate to my original question?`,
  ];
  const bengali = [
    isHowTo ? `${topic}-এর নির্দেশনাগুলো কি একটি ছোট checklist-এ সাজিয়ে দিতে পারেন?` : `${topic} নিয়ে প্রথমে আমার কী করা উচিত?`,
    hasCode ? `${topic}-এর উদাহরণটি কি আমার নির্দিষ্ট project অনুযায়ী মানিয়ে দিতে পারেন?` : `${topic}-এর একটি বাস্তব উদাহরণ দিতে পারেন?`,
    isComparison ? `আমার পরিস্থিতির জন্য কোন বিকল্পটি ভালো এবং কেন?` : `${topic}-এর প্রধান সীমাবদ্ধতা বা ঝুঁকি কী?`,
    hasSources ? `${topic}-এর কোন অংশটি আমার পরবর্তী ধাপে যাচাই করা উচিত?` : headings.length > 0 ? `“${headings[0]}” বিষয়টি আরও বিস্তারিতভাবে বুঝিয়ে বলবেন?` : `${topic} আমার মূল প্রশ্নের সঙ্গে কীভাবে সম্পর্কিত?`,
  ];

  return uniqueQuestions((isBengali ? bengali : english).map((question) => question.trim()));
}

function cleanText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/!?(\[[^\]]*\])\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[#*_>`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHeadings(answer: string): string[] {
  return Array.from(answer.matchAll(/^\s{0,3}#{1,3}\s+(.+)$/gm))
    .map((match) => cleanText(match[1]).replace(/[.!?。！？]+$/, "").trim())
    .filter((heading) => heading.length >= 3 && heading.length <= MAX_TOPIC_LENGTH);
}

function extractTopic(answer: string, userPrompt: string, bengali: boolean): string {
  const promptTopic = extractPromptTopic(userPrompt);
  if (promptTopic) return promptTopic;

  const heading = extractHeadings(answer)[0];
  if (heading) return heading.slice(0, MAX_TOPIC_LENGTH);

  const firstSentence = answer.split(/[.!?。！？\n]/).map((part) => part.trim()).find(Boolean) || answer;
  const cleaned = firstSentence
    .replace(/^(here is|sure|of course|in short|সংক্ষেপে|অবশ্যই|বিষয়টি হলো|বিষয়:)[, চ:：\s]*/i, "")
    .replace(/^(the answer is|the key point is)[, :\s]*/i, "")
    .trim();
  return (cleaned || (bengali ? "এই বিষয়টি" : "this topic")).slice(0, MAX_TOPIC_LENGTH).replace(/[,:;—-]+$/, "").trim();
}

function extractPromptTopic(prompt: string): string {
  const cleaned = cleanText(prompt)
    .replace(/^(please|can you|could you|help me|tell me|explain|show me|research|write|find|আমাকে|দয়া করে|ব্যাখ্যা করুন|বলুন|খুঁজে দিন)[, :\s]*/i, "")
    .replace(/[?؟।!]+$/, "")
    .trim();
  if (cleaned.length < 3) return "";
  const withoutFiller = cleaned.replace(/\b(for me|in simple terms|with sources|and cite reliable sources)\b/gi, "").trim();
  return withoutFiller.slice(0, MAX_TOPIC_LENGTH);
}

function uniqueQuestions(questions: string[]): string[] {
  return Array.from(new Set(questions.map((question) => question.slice(0, MAX_QUESTION_LENGTH)))).slice(0, 4);
}
