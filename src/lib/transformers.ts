/**
 * Transformation functions to convert between DB format and frontend format
 */

import { DBWord, Meaning, Word, WordDefinition, Example } from '@/lib/definitions';

/**
 * Transform a DBWord (from database) to Word (frontend format)
 */
export function dbWordToWord(dbWord: DBWord): Word {
  const wordDefinitions: WordDefinition[] =
    dbWord.meanings?.map((meaning) => meaningToWordDefinition(meaning)) || [];

  return {
    lemma: dbWord.lemma,
    root: dbWord.root || dbWord.lemma,
    values: wordDefinitions,
  };
}

/**
 * Transform a Meaning (from database) to WordDefinition (frontend format)
 */
function meaningToWordDefinition(meaning: Meaning): WordDefinition {
  // Normalize examples to match frontend format
  // Frontend expects Example | Example[], but DB always has Example[]
  const examples = meaning.examples || [];
  const example = examples.length === 1 ? examples[0] : examples;

  return {
    number: meaning.number,
    origin: meaning.origin || null,
    categories: meaning.categories || [],
    remission: meaning.remission || null,
    meaning: meaning.meaning,
    styles: meaning.styles || null,
    observation: meaning.observation || null,
    example: example as Example | Example[],
    variant: null, // Variant is stored at word level, not meaning level
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
    createdBy: dbWord.createdBy,
  };
}
