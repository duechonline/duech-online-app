/**
 * Transformation functions to convert between DB format and frontend format
 */

import { DBWord, Meaning, Word } from '@/lib/definitions';

/**
 * Transform a DBWord (from database) to Word (frontend format)
 */
export function dbWordToWord(dbWord: DBWord): Word {
  const meanings = dbWord.meanings?.map(normalizeMeaningForClient) || [];

  return {
    lemma: dbWord.lemma,
    root: dbWord.root || dbWord.lemma,
    values: meanings,
  };
}

function normalizeMeaningForClient(meaning: Meaning): Meaning {
  return {
    id: meaning.id,
    wordId: meaning.wordId,
    number: meaning.number,
    origin: meaning.origin || null,
    meaning: meaning.meaning,
    observation: meaning.observation || null,
    remission: meaning.remission || null,
    categories: meaning.categories || [],
    socialValuations: meaning.socialValuations || [],
    socialStratumMarkers: meaning.socialStratumMarkers || [],
    styleMarkers: meaning.styleMarkers || [],
    intentionalityMarkers: meaning.intentionalityMarkers || [],
    geographicalMarkers: meaning.geographicalMarkers || [],
    chronologicalMarkers: meaning.chronologicalMarkers || [],
    frequencyMarkers: meaning.frequencyMarkers || [],
    examples: meaning.examples && meaning.examples.length > 0 ? meaning.examples : [],
    createdAt: meaning.createdAt,
    updatedAt: meaning.updatedAt,
  };
}

/**
 * Transform DBWord with its letter to SearchResult-compatible format
 */
export function dbWordToSearchResult(
  dbWord: DBWord,
  matchType: 'exact' | 'partial' | 'filter' = 'filter'
) {
  const word = dbWordToWord(dbWord);
  return {
    word,
    letter: dbWord.letter,
    matchType,
    status: dbWord.status,
    assignedTo: dbWord.assignedTo ?? null,
    createdBy: dbWord.createdBy ?? null,
  };
}
