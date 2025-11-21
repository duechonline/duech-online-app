/**
 * Database query functions using Drizzle ORM
 */

import { eq, ilike, or, and, sql, SQL } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { db } from '@/lib/db';
import { words, meanings, users, passwordResetTokens } from '@/lib/schema';
import { Word, SearchResult, WordNote } from '@/lib/definitions';
import { dbWordToWord, dbWordToSearchResult } from '@/lib/transformers';

/**
 * Get a word by lemma with all its meanings
 * Returns in frontend-compatible format
 */
interface GetWordByLemmaOptions {
  includeDrafts?: boolean;
}

export async function getWordByLemma(
  lemma: string,
  options: GetWordByLemmaOptions = {}
): Promise<{
  word: Word;
  letter: string;
  status: string;
  assignedTo: number | null;
  createdBy: number | null;
  wordId: number;
  comments: WordNote[];
} | null> {
  const { includeDrafts = false } = options;

  const whereCondition = includeDrafts
    ? eq(words.lemma, lemma)
    : and(eq(words.lemma, lemma), eq(words.status, 'published'));

  const result = await db.query.words.findFirst({
    where: whereCondition,
    columns: {
      id: true,
      lemma: true,
      root: true,
      letter: true,
      variant: true,
      status: true,
      createdBy: true,
      assignedTo: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      meanings: {
        orderBy: (meanings, { asc }) => [asc(meanings.number)],
      },
      notes: {
        orderBy: (notesTable, { desc }) => [desc(notesTable.createdAt)],
        with: {
          user: true,
        },
      },
    },
  });

  if (!result) return null;

  return {
    word: dbWordToWord(result),
    letter: result.letter,
    status: result.status,
    assignedTo: result.assignedTo ?? null,
    createdBy: result.createdBy ?? null,
    wordId: result.id,
    comments:
      result.notes?.map((note) => ({
        id: note.id,
        note: note.note,
        createdAt: note.createdAt.toISOString(),
        user: note.user
          ? {
            id: note.user.id,
            username: note.user.username,
          }
          : null,
      })) ?? [],
  };
}

/**
 * Advanced search with filters
 * Returns in frontend-compatible format
 */
export async function searchWords(params: {
  query?: string;
  categories?: string[];
  origins?: string[];
  letters?: string[];
  status?: string;
  assignedTo?: string[];
  editorMode?: boolean;
  limit?: number;
  socialValuations?: string[];
  socialStratumMarkers?: string[];
  styleMarkers?: string[];
  intentionalityMarkers?: string[];
  geographicalMarkers?: string[];
  chronologicalMarkers?: string[];
  frequencyMarkers?: string[];
  page?: number;
  pageSize?: number;
}): Promise<{ results: SearchResult[]; total: number }> {
  const {
    query,
    categories,
    origins,
    letters,
    status,
    assignedTo,
    editorMode,
    socialValuations,
    socialStratumMarkers,
    styleMarkers,
    intentionalityMarkers,
    geographicalMarkers,
    chronologicalMarkers,
    frequencyMarkers,
    page = 1,
    pageSize = 25,
  } = params;

  const conditions: SQL[] = [];

  // STATUS logic:
  if (!editorMode) {
    // Public mode: ALWAYS show only published words
    conditions.push(eq(words.status, 'published'));
  } else {
    // Editor mode:
    if (status && status !== '') {
      // If editor selected a specific filter → apply it
      conditions.push(eq(words.status, status));
    }
    // If status === '' → editor wants all words → do NOT push conditions
  }
  // If status is '', don't add any status filter (show all statuses - editor mode)

  // Filter by assignedTo (OR within assignedTo values)
  if (assignedTo && assignedTo.length > 0) {
    const assignedToIds = assignedTo.map((id) => parseInt(id, 10)).filter((id) => !isNaN(id));
    if (assignedToIds.length > 0) {
      const assignedConditions = assignedToIds.map((id) => eq(words.assignedTo, id));
      conditions.push(or(...assignedConditions)!);
    }
  }

  // Text search in lemma or meaning
  if (query) {
    // NEED CHANGES, pattern matches only starts of word, works bad for phrases
    const searchPattern = `${query}%`;
    // Accent-insensitive match using PostgreSQL unaccent: requires the unaccent extension
    // This compares lower(unaccent(lemma)) LIKE lower(unaccent(pattern))
    conditions.push(sql`unaccent(lower(${words.lemma})) LIKE unaccent(lower(${searchPattern}))`);
  }

  // Filter by letters (OR within letters - if multiple letters provided)
  if (letters && letters.length > 0) {
    const letterConditions = letters.map((letter) => eq(words.letter, letter.toLowerCase()));
    conditions.push(or(...letterConditions)!);
  }

  // Filter by origins (OR within origins - any selected origin matches)
  if (origins && origins.length > 0) {
    const originConditions = origins.map((origin) => ilike(meanings.origin, `%${origin}%`));
    conditions.push(or(...originConditions)!);
  }

  // Filter by categories (OR within categories - any selected category matches)
  if (categories && categories.length > 0) {
    const categoryConditions = categories.map((cat) => sql`${cat} = ANY(${meanings.categories})`);
    conditions.push(or(...categoryConditions)!);
  }

  type MarkerColumn =
    | typeof meanings.categories
    | typeof meanings.socialValuations
    | typeof meanings.socialStratumMarkers
    | typeof meanings.styleMarkers
    | typeof meanings.intentionalityMarkers
    | typeof meanings.geographicalMarkers
    | typeof meanings.chronologicalMarkers
    | typeof meanings.frequencyMarkers;

  const pushMarkerFilter = (values: string[] | undefined, column: MarkerColumn) => {
    if (!values || values.length === 0) return;
    const clause = values.map((value) => sql`${value} = ANY(${column})`);
    if (clause.length > 0) {
      conditions.push(or(...clause)!);
    }
  };

  pushMarkerFilter(socialValuations, meanings.socialValuations);
  pushMarkerFilter(socialStratumMarkers, meanings.socialStratumMarkers);
  pushMarkerFilter(styleMarkers, meanings.styleMarkers);
  pushMarkerFilter(intentionalityMarkers, meanings.intentionalityMarkers);
  pushMarkerFilter(geographicalMarkers, meanings.geographicalMarkers);
  pushMarkerFilter(chronologicalMarkers, meanings.chronologicalMarkers);
  pushMarkerFilter(frequencyMarkers, meanings.frequencyMarkers);

  // All conditions are combined with AND
  // Within each filter type (categories, markers, assignedTo), values are OR'ed
  // This means: (cat1 OR cat2) AND (style1 OR style2) AND letter AND query
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Get total count of matching results
  const countResult = await db
    .select({ count: sql<number>`count(distinct ${words.id})` })
    .from(words)
    .leftJoin(meanings, eq(words.id, meanings.wordId))
    .where(whereClause);

  const total = Number(countResult[0]?.count || 0);

  // Execute query - get unique word IDs with pagination
  const offset = (page - 1) * pageSize;
  const results = await db
    .selectDistinctOn([words.id], {
      id: words.id,
      lemma: words.lemma,
      root: words.root,
      letter: words.letter,
      variant: words.variant,
      status: words.status,
      createdBy: words.createdBy,
      assignedTo: words.assignedTo,
      createdAt: words.createdAt,
      updatedAt: words.updatedAt,
    })
    .from(words)
    .leftJoin(meanings, eq(words.id, meanings.wordId))
    .where(whereClause)
    .limit(pageSize)
    .offset(offset);

  // Batch fetch full word data with meanings in a single optimized query
  const wordIds = results.map((w) => w.id);

  const fullWords = await db.query.words.findMany({
    where: (words, { inArray }) => inArray(words.id, wordIds),
    with: {
      meanings: {
        orderBy: (meanings, { asc }) => [asc(meanings.number)],
      },
    },
  });

  // Create a map for O(1) lookup performance
  const wordMap = new Map(fullWords.map((w) => [w.id, w]));

  // Determine match type for each word
  const wordsWithMeanings = results.map((w) => {
    const fullWord = wordMap.get(w.id);

    // Determine match type
    let matchType: 'exact' | 'partial' | 'filter' = 'filter';
    if (query && fullWord) {
      const normalizedQuery = query.toLowerCase();
      const lemma = fullWord.lemma.toLowerCase();
      if (lemma === normalizedQuery) {
        matchType = 'exact';
      } else if (lemma.includes(normalizedQuery)) {
        matchType = 'partial';
      }
    }

    return { fullWord, matchType };
  });

  // Sort so exact matches first,   then prefix/partial, then others.
  const rank = { exact: 0, partial: 1, filter: 2 } as const;
  const finalResults = wordsWithMeanings
    .filter((w) => w.fullWord !== undefined)
    .sort((a, b) => {
      const ra = rank[a.matchType];
      const rb = rank[b.matchType];
      if (ra !== rb) return ra - rb;
      // Tie-breaker: alphabetic by lemma (accent-insensitive)
      return a.fullWord!.lemma.localeCompare(b.fullWord!.lemma, 'es', { sensitivity: 'base' });
    })
    .map((w) => dbWordToSearchResult(w.fullWord!, w.matchType));

  return {
    results: finalResults,
    total: total,
  };
}

/**
 * USER AUTHENTICATION QUERIES
 */

/**
 * Find user by username
 */
export async function getUserByUsername(username: string) {
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Find user by email
 */
export async function getUserByEmail(email: string) {
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Verify password against bcrypt hash
 */
export async function verifyUserPassword(
  dbPasswordHash: string,
  password: string
): Promise<boolean> {
  return await bcrypt.compare(password, dbPasswordHash);
}

/**
 * Get all users (without sensitive data)
 */
export async function getUsers() {
  return await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users);
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

/**
 * Create a new user
 */
export async function createUser(data: {
  username: string;
  email: string;
  passwordHash: string;
  role: string;
}) {
  const result = await db
    .insert(users)
    .values({
      username: data.username,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
    })
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    });

  return result[0];
}

/**
 * Update an existing user
 */
export async function updateUser(
  userId: number,
  data: {
    username?: string;
    email?: string;
    role?: string;
    passwordHash?: string;
    currentSessionId?: string | null;
  }
) {
  const result = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      updatedAt: users.updatedAt,
    });

  return result[0];
}

/**
 * Update user's current session ID
 */
export async function updateUserSessionId(userId: number, sessionId: string) {
  await db
    .update(users)
    .set({
      currentSessionId: sessionId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

/**
 * Delete a user
 */
export async function deleteUser(userId: number) {
  const result = await db.delete(users).where(eq(users.id, userId)).returning({
    id: users.id,
    username: users.username,
  });

  return result[0];
}

/**
 * Get user by ID
 */
export async function getUserById(userId: number) {
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      role: users.role,
      currentSessionId: users.currentSessionId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

/**
 * Create a password reset token for a user
 */
export async function createPasswordResetToken(userId: number, token: string) {
  const result = await db
    .insert(passwordResetTokens)
    .values({
      userId,
      token,
    })
    .returning({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      token: passwordResetTokens.token,
      createdAt: passwordResetTokens.createdAt,
    });

  return result[0];
}

/**
 * Get password reset token and associated user
 */
export async function getPasswordResetToken(token: string) {
  const result = await db.query.passwordResetTokens.findFirst({
    where: eq(passwordResetTokens.token, token),
    with: {
      user: true,
    },
  });

  return result;
}

/**
 * Delete a password reset token
 */
export async function deletePasswordResetToken(token: string) {
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
}
