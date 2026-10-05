const MAX_QUESTION_LENGTH = 120;

/**
 * Generate four lightweight follow-up prompts from an assistant response.
 * This stays local so suggestions never add another provider request or cost.
 */
export function getRelatedQuestions(answer: string): string[] {
  const text = answer.replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim();
  if (!text) return [];

  const isBengali = /[\u0980-\u09FF]/.test(text);
  const topic = extractTopic(text, isBengali);
  const questions = isBengali
    ? [
        `${topic} আরও সহজভাবে বুঝিয়ে বলুন`,
        `${topic}-এর একটি বাস্তব উদাহরণ দিন`,
        `${topic}-এর সুবিধা ও অসুবিধা কী?`,
        `${topic} ধাপে ধাপে কীভাবে ব্যবহার করব?`,
      ]
    : [
        `Explain ${topic} in simpler terms`,
        `Give me a practical example of ${topic}`,
        `What are the benefits and limitations of ${topic}?`,
        `How can I use ${topic} step by step?`,
      ];

  return Array.from(new Set(questions.map((question) => question.slice(0, MAX_QUESTION_LENGTH)))).slice(0, 4);
}

function extractTopic(text: string, bengali: boolean): string {
  const firstSentence = text.split(/[.!?。！？\n]/).map((part) => part.trim()).find(Boolean) || text;
  const cleaned = firstSentence
    .replace(/^(here is|sure|of course|সংক্ষেপে|অবশ্যই)[,:\s]*/i, "")
    .replace(/^(বিষয়টি হলো|বিষয়:)[,:\s]*/i, "")
    .trim();
  const topic = cleaned.slice(0, bengali ? 52 : 70).replace(/[,:;—-]+$/, "").trim();
  return topic || (bengali ? "এই বিষয়টি" : "this topic");
}
