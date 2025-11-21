import 'server-only';
import { db } from '@/lib/db';
import { words, meanings, notes } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import type { Word, Example } from '@/lib/definitions';

/**
 * Clean example data by removing undefined fields
 */
function cleanExample(ex: Example) {
  return {
    value: ex.value,
    ...(ex.author !== undefined && { author: ex.author }),
    ...(ex.title !== undefined && { title: ex.title }),
    ...(ex.source !== undefined && { source: ex.source }),
    ...(ex.date !== undefined && { date: ex.date }),
    ...(ex.page !== undefined && { page: ex.page }),
  };
}

/**
 * Normalize examples to array and clean them
 */
function normalizeAndCleanExamples(
  examples: Example | Example[] | undefined | null
): ReturnType<typeof cleanExample>[] {
  if (!examples) return [];
  const examplesArray = Array.isArray(examples) ? examples : [examples];
  return examplesArray.map(cleanExample);
}

/**
 * Insert a meaning into the database
 */
async function insertMeaning(wordId: number, def: Word['values'][number]) {
  const cleanedExamples = normalizeAndCleanExamples(def.examples);

  await db.insert(meanings).values({
    wordId,
    number: def.number,
    origin: def.origin || null,
    meaning: def.meaning,
    observation: def.observation || null,
    remission: def.remission || null,
    categories: def.categories && def.categories.length > 0 ? def.categories : null,
    socialValuations:
      def.socialValuations && def.socialValuations.length > 0 ? def.socialValuations : null,
    socialStratumMarkers:
      def.socialStratumMarkers && def.socialStratumMarkers.length > 0
        ? def.socialStratumMarkers
        : null,
    styleMarkers: def.styleMarkers && def.styleMarkers.length > 0 ? def.styleMarkers : null,
    intentionalityMarkers:
      def.intentionalityMarkers && def.intentionalityMarkers.length > 0
        ? def.intentionalityMarkers
        : null,
    geographicalMarkers:
      def.geographicalMarkers && def.geographicalMarkers.length > 0
        ? def.geographicalMarkers
        : null,
    chronologicalMarkers:
      def.chronologicalMarkers && def.chronologicalMarkers.length > 0
        ? def.chronologicalMarkers
        : null,
    frequencyMarkers:
      def.frequencyMarkers && def.frequencyMarkers.length > 0 ? def.frequencyMarkers : null,
    examples: cleanedExamples.length > 0 ? cleanedExamples : null,
  });
}

/**
 * Update a word and all its meanings
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
 * Create a new word with its meanings
 */
interface CreateWordOptions {
  createdBy?: number | null;
  assignedTo?: number | null;
  letter?: string | null;
  status?: string;
}

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
 * Delete a word by lemma (cascade delete will remove meanings)
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
 * Add a note (comment) to a word identified by lemma
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
