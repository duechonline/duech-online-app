/**
 * Utilities for handling redacted and reviewed words in API routes.
 *
 * Provides authentication and data transformation helpers for
 * the redacted and reviewed words report feature.
 *
 * @module lib/redacted-words-utils
 */
import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getWordsByStatus } from '@/lib/queries';
import type { PDFWord } from '@/lib/pdf-utils';
import type { Meaning } from '@/lib/definitions';

/** Type alias for raw redacted word from database */
type RawRedactedWord = Awaited<ReturnType<typeof getWordsByStatus>>[number];

export type WordStatusFilter = 'redacted' | 'reviewedLex' | 'both';

/**
 * Authenticates the user and fetches words by status.
 *
 * @returns Success with user and words data, or error response
 */
export async function authenticateAndFetchWordsByStatus(filter: WordStatusFilter): Promise<
  | {
      success: true;
      user: { email: string; name?: string };
      words: Awaited<ReturnType<typeof getWordsByStatus>>;
    }
  | { success: false; response: NextResponse }
> {
  // Get current user session
  const user = await getSessionUser();

  if (!user) {
    return {
      success: false,
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }
  // Determine which statuses to fetch
  const statuses = filter === 'both' ? ['redacted', 'reviewedLex'] : [filter];

  const words = await getWordsByStatus(statuses);

  return {
    success: true,
    user: { email: user.email, name: user.name },
    words,
  };
}

export async function authenticateAndFetchRedactedWords() {
  return authenticateAndFetchWordsByStatus('redacted');
}

/**
 * Maps raw database notes to the PDF report format.
 * @internal
 */
function mapNotes(notes: RawRedactedWord['notes']): PDFWord['notes'] {
  if (!notes || notes.length === 0) {
    return null;
  }

  return notes.map((note) => ({
    note: note.note ?? null,
    date: note.createdAt ? note.createdAt.toISOString() : null,
    user: note.user?.username ?? null,
  }));
}

/**
 * Maps raw database words to the PDF generation format.
 *
 * @param words - Raw words from the database
 * @returns Array of words formatted for PDF generation
 */
export function mapWordsByStatusToPdf(
  words: Awaited<ReturnType<typeof getWordsByStatus>>
): PDFWord[] {
  return words.map((word) => ({
    lemma: word.lemma,
    root: word.root,
    letter: word.letter,
    meanings: word.meanings as unknown as Meaning[],
    notes: mapNotes(word.notes),
    status: word.status,
  }));
}
