const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "for", "from", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "please", "search", "show", "tell", "the", "to", "what", "when", "where", "which", "who", "why", "with",
  "একটা", "একটি", "এর", "এবং", "ও", "করে", "করুন", "কি", "কী", "কোন", "জন্য", "দেখান", "পর", "সহ", "হলো",
]);

const SYNONYM_GROUPS = [
  ["visa", "ভিসা"],
  ["job", "employment", "চাকরি"],
].map((group) => new Set(group));
const SYNONYMS_BY_TERM = new Map(SYNONYM_GROUPS.flatMap((group) => [...group].map((term) => [term, group])));

const tokenize = (value) => String(value || "")
  .normalize("NFKC")
  .toLocaleLowerCase()
  .match(/[\p{L}\p{M}\p{N}]+/gu) || [];

const normalizePhrase = (value) => tokenize(value).join(" ");

function termMatches(term, words) {
  return words.some((word) => {
    if (word === term) return true;
    const shorter = Math.min(word.length, term.length);
    const longer = Math.max(word.length, term.length);
    return shorter >= 5 && longer / shorter <= 1.4 && (word.startsWith(term) || term.startsWith(word));
  });
}

function synonymMatches(term, words) {
  const group = SYNONYMS_BY_TERM.get(term);
  return Boolean(group && words.some((word) => group.has(word)));
}

/**
 * Rank provider results against the user's query without sending query/result text to another service.
 * Exact title/phrase matches lead; approved synonyms and broad query-term coverage provide weaker evidence.
 * @param {Array<{id:string,title:string,url:string,displayUrl?:string,snippet:string,source:string,publishedAt?:string}>} results
 * @param {string} query
 */
export function rankSearchResults(results, query) {
  const queryWords = [...new Set(tokenize(query).filter((word) => word.length > 1 && !STOP_WORDS.has(word)))];
  if (queryWords.length === 0 || results.length < 2) return [...results];

  const documents = results.map((result) => {
    const titleWords = tokenize(result.title);
    const snippetWords = tokenize(result.snippet);
    const urlWords = tokenize(`${result.displayUrl || ""} ${result.url || ""}`);
    return {
      titleWords,
      snippetWords,
      urlWords,
      phraseTitle: normalizePhrase(result.title),
      phraseSnippet: normalizePhrase(result.snippet),
    };
  });

  const weights = new Map(queryWords.map((term) => {
    const frequency = documents.reduce((count, document) => count + Number(
      termMatches(term, document.titleWords) || termMatches(term, document.snippetWords) || termMatches(term, document.urlWords)
        || synonymMatches(term, document.titleWords) || synonymMatches(term, document.snippetWords) || synonymMatches(term, document.urlWords),
    ), 0);
    return [term, 1 + Math.log((documents.length + 1) / (frequency + 1))];
  }));
  const queryPhrase = normalizePhrase(query);

  return results
    .map((result, index) => {
      const document = documents[index];
      let score = 0;
      let matchedWeight = 0;
      let totalWeight = 0;

      for (const term of queryWords) {
        const weight = weights.get(term) || 1;
        totalWeight += weight;
        const exactTitle = document.titleWords.includes(term);
        const inTitle = termMatches(term, document.titleWords);
        const inSnippet = termMatches(term, document.snippetWords);
        const inUrl = termMatches(term, document.urlWords);
        const titleSynonym = synonymMatches(term, document.titleWords);
        const snippetSynonym = synonymMatches(term, document.snippetWords);
        if (exactTitle) score += 8 * weight;
        else if (inTitle) score += 5 * weight;
        else if (titleSynonym) score += 3 * weight;
        else if (inSnippet) score += 2.5 * weight;
        else if (snippetSynonym) score += 1.5 * weight;
        else if (inUrl) score += 1.5 * weight;
        if (inTitle && inSnippet) score += 0.75 * weight;
        if (inTitle || titleSynonym || inSnippet || snippetSynonym || inUrl) matchedWeight += weight;
      }

      if (totalWeight > 0) score += 8 * matchedWeight / totalWeight;
      if (queryPhrase.length >= 5 && document.phraseTitle === queryPhrase) score += 24;
      else if (queryPhrase.length >= 5 && document.phraseTitle.includes(queryPhrase)) score += 14;
      else if (queryPhrase.length >= 5 && document.phraseSnippet.includes(queryPhrase)) score += 5;

      return { result, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ result }) => result);
}
