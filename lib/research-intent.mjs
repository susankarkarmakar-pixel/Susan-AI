const RESEARCH_INTENT_EN = /\b(research|investigat(?:e|ing|ion)|deep dive|web search|search(?: the web| online)? for|latest|recent|current|up[- ]to[- ]date|news|citations?|references?|fact[- ]?check|verify|compare|versus|\bvs\b)\b/i;
const RESEARCH_INTENT_BN = /(সার্চ|খুঁজে|অনুসন্ধান|রিসার্চ|গবেষণা|সাম্প্রতিক|সর্বশেষ|বর্তমান|তথ্যসূত্র|উৎসসহ|তথ্যসহ|তুলনা|যাচাই|খবর|নিউজ)/u;

/**
 * Identify explicit research/search-style prompts for a contextual loading treatment.
 * This is a presentation hint only; it does not claim a live web search is running.
 * @param {string} text
 * @returns {boolean}
 */
export function isResearchIntent(text) {
  return RESEARCH_INTENT_EN.test(text) || RESEARCH_INTENT_BN.test(text);
}
