/**
 * Server-side mutation functions for dictionary editing.
 *
 * Provides CRUD operations for words, meanings, and notes.
 * These functions are server-only and directly modify the database.
 *
 * @module lib/editor-mutations
 */

import 'server-only';
import { db } from '@/lib/db';
import { words, meanings, notes, examples } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { Word, Example, MeaningMarkerKey } from '@/lib/definitions';
import { MEANING_MARKER_KEYS } from '@/lib/definitions';

/**
 * Cleans example data by removing undefined fields.
 * @internal
 */
function cleanExample(ex: Example) {
  return {
    value: ex.value,
    author: ex.author || null,
    year: ex.year || null,
    publication: ex.publication || ex.source || null, // Handle legacy source
    format: ex.format || null,
    title: ex.title || null,
    date: ex.date || null,
    city: ex.city || null,
    editorial: ex.editorial || null,
    volume: ex.volume || null,
    number: ex.number || null,
    page: ex.page || null,
    doi: ex.doi || null,
    url: ex.url || null,
  };
}

/**
 * Normalizes examples to an array and cleans each one.
 * @internal
 */
function normalizeAndCleanExamples(examples: Example[] | null | undefined) {
  if (!examples || examples.length === 0) {
    return [] as ReturnType<typeof cleanExample>[];
  }
  return examples.map(cleanExample);
}

/**
 * Inserts a meaning into the database.
 * @internal
 */
async function insertMeaning(wordId: number, def: Word['values'][number]) {
  const cleanedExamples = normalizeAndCleanExamples(def.examples);
  const markerValues = MEANING_MARKER_KEYS.reduce(
    (acc, key) => {
      const value = def[key as MeaningMarkerKey];
      acc[key] = value || null;
      return acc;
    },
    {} as Record<MeaningMarkerKey, string | null>
  );

  const [insertedMeaning] = await db
    .insert(meanings)
    .values({
      wordId,
      number: def.number,
      origin: def.origin || null,
      meaning: def.meaning,
      observation: def.observation || null,
      remission: def.remission || null,
      grammarCategory: def.grammarCategory || null,
      dictionary: def.dictionary || null,
      variant: def.variant || null,
      ...markerValues,
    })
    .returning({ id: meanings.id });

  if (cleanedExamples.length > 0) {
    await db.insert(examples).values(
      cleanedExamples.map((ex) => ({
        meaningId: insertedMeaning.id,
        ...ex,
      }))
    );
  }
}

/**
 * Updates a word and replaces all its meanings.
 *
 * @param prevLemma - The current lemma to find the word
 * @param updatedWord - The new word data
 * @param options - Optional status and assignedTo updates
 * @returns Success indicator
 * @throws Error if word not found
 */
export async function updateWordByLemma(
  prevLemma: string,
  updatedWord: Word,
  options?: { status?: string; assignedTo?: number | null }
) {
  // Find the word by lemma
  const existingWord = await db.query.words.findFirst({
    where: eq(words.lemma, prevLemma),
  });

  if (!existingWord) {
    throw new Error(`Word not found: ${prevLemma}`);
  }

  // Update word metadata (lemma, root, and optionally status/assignedTo)
  const updateData: Partial<typeof words.$inferInsert> = {
    lemma: updatedWord.lemma,
    root: updatedWord.root || null,
    updatedAt: new Date(),
  };

  if (options?.status !== undefined) {
    updateData.status = options.status;
  }

  if (options?.assignedTo !== undefined) {
    updateData.assignedTo = options.assignedTo;
  }

  await db.update(words).set(updateData).where(eq(words.id, existingWord.id));

  // Delete all existing meanings for this word
  await db.delete(meanings).where(eq(meanings.wordId, existingWord.id));

  // Insert new meanings
  for (const def of updatedWord.values) {
    await insertMeaning(existingWord.id, def);
  }

  return { success: true };
}

/**
 * Options for creating a new word.
 */
export interface CreateWordOptions {
  /** User ID who created the word */
  createdBy?: number | null;
  /** User ID assigned to work on the word */
  assignedTo?: number | null;
  /** First letter for indexing (auto-detected if not provided) */
  letter?: string | null;
  /** Initial status (default: 'included') */
  status?: string;
}

/**
 * Creates a new word with its meanings.
 *
 * @param newWord - The word data to create
 * @param options - Creation options
 * @returns Object with success, wordId, lemma, and letter
 * @throws Error if lemma already exists or is empty
 */
export async function createWord(newWord: Word, options: CreateWordOptions = {}) {
  // Normalize core fields
  const normalizedLemma = newWord.lemma.trim();
  if (!normalizedLemma) {
    throw new Error('El lema es obligatorio');
  }

  const normalizedRoot = (newWord.root || '').trim();
  const requestedLetter = options.letter?.trim();
  const normalizedLetter = (requestedLetter?.[0] || normalizedLemma[0] || 'a').toLowerCase();
  const assignedTo = options.assignedTo ?? null;
  const createdBy = options.createdBy ?? null;
  const status = options.status ?? 'included';

  // Prevent duplicate lemmas
  const existing = await db.query.words.findFirst({
    where: eq(words.lemma, normalizedLemma),
  });

  if (existing) {
    throw new Error(`Ya existe una palabra con el lema "${normalizedLemma}"`);
  }

  // Insert the word
  const [wordRecord] = await db
    .insert(words)
    .values({
      lemma: normalizedLemma,
      root: normalizedRoot || null,
      letter: normalizedLetter,
      status,
      createdBy,
      assignedTo,
    })
    .returning();

  // Insert meanings
  for (const def of newWord.values) {
    await insertMeaning(wordRecord.id, def);
  }

  return { success: true, wordId: wordRecord.id, lemma: normalizedLemma, letter: normalizedLetter };
}

/**
 * Deletes a word by its lemma.
 * Cascade delete removes associated meanings and notes.
 *
 * @param lemma - The lemma of the word to delete
 * @returns Success indicator
 * @throws Error if word not found
 */
export async function deleteWordByLemma(lemma: string) {
  const existingWord = await db.query.words.findFirst({
    where: eq(words.lemma, lemma),
  });

  if (!existingWord) {
    throw new Error(`Word not found: ${lemma}`);
  }

  await db.delete(words).where(eq(words.id, existingWord.id));
  return { success: true };
}

/**
 * Adds an editorial note/comment to a word.
 *
 * @param lemma - The lemma of the word to add the note to
 * @param noteValue - The note text
 * @param userId - The ID of the user adding the note
 * @returns The created note with user info
 * @throws Error if word not found
 */
export async function addNoteToWord(lemma: string, noteValue: string, userId: number | null) {
  const existingWord = await db.query.words.findFirst({
    where: eq(words.lemma, lemma),
    columns: { id: true },
  });

  if (!existingWord) {
    throw new Error(`Word not found: ${lemma}`);
  }

  const [inserted] = await db
    .insert(notes)
    .values({
      wordId: existingWord.id,
      note: noteValue,
      userId,
    })
    .returning({ id: notes.id });

  const created = await db.query.notes.findFirst({
    where: eq(notes.id, inserted.id),
    with: {
      user: true,
    },
  });

  if (!created) {
    throw new Error('Failed to retrieve the created note');
  }

  return created;
}
