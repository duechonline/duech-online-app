/**
 * Word API endpoint for CRUD operations on dictionary entries.
 *
 * Supports fetching, creating, updating, and deleting words by their lemma.
 *
 * @module app/api/words/[lemma]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWordByLemma } from '@/lib/queries';
import { isEditorModeFromHeaders } from '@/lib/editor-mode-server';
import {
  updateWordByLemma,
  deleteWordByLemma,
  createWord,
  addNoteToWord,
} from '@/lib/editor-mutations';
import { applyRateLimit } from '@/lib/rate-limiting';
import { getSessionUser } from '@/lib/auth';
import type { Word, Meaning, WordNote, MeaningMarkerValues, Example } from '@/lib/definitions';
import { MEANING_MARKER_KEYS } from '@/lib/definitions';

/**
 * GET /api/words/[lemma] - Fetch a word by its lemma
 *
 * @returns Word data with meanings and notes, or 404 if not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lemma: string }> }
) {
  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(request);
  if (!rateLimitResult.success) {
    const response = new NextResponse('Too Many Requests', { status: 429 });
    return response;
  }

  try {
    const { lemma } = await params;

    // Input validation
    if (!lemma || typeof lemma !== 'string' || lemma.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid lemma parameter' }, { status: 400 });
    }

    // Sanitize input
    const decodedLemma = decodeURIComponent(lemma.trim());

    // Prevent excessively long queries (potential DoS)
    if (decodedLemma.length > 100) {
      return NextResponse.json({ error: 'Lemma too long' }, { status: 400 });
    }

    // Determine editor mode from headers or query param fallback. When in editor mode
    // we must include drafts (imported/incorporated/preredacted) in the result.
    const url = new URL(request.url);
    const editorMode =
      isEditorModeFromHeaders(request.headers) || url.searchParams.get('editorMode') === 'true';

    // Get word data from database
    const wordData = await getWordByLemma(
      decodedLemma,
      editorMode ? { includeDrafts: true } : undefined
    );

    if (!wordData) {
      return NextResponse.json({ error: 'Word not found' }, { status: 404 });
    }

    // Return only the requested word data
    return NextResponse.json({
      success: true,
      data: wordData,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/** @internal */
interface CreateWordPayload {
  lemma?: unknown;
  root?: unknown;
  letter?: unknown;
  assignedTo?: unknown;
  values?: unknown;
  status?: unknown;
  createdBy?: unknown;
}

/** @internal */
function normalizeMeanings(input: unknown): Meaning[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((def, index) => {
      const number = typeof def.number === 'number' ? def.number : index + 1;
      const meaning =
        typeof def.meaning === 'string' && def.meaning.trim()
          ? def.meaning
          : `Definición ${number}`;

      const markerValues = extractMarkerValues(def);
      const examples = extractExamples(def);

      return {
        number,
        meaning,
        origin: typeof def.origin === 'string' ? def.origin : null,
        grammarCategory: typeof def.grammarCategory === 'string' ? def.grammarCategory : null,
        remission: typeof def.remission === 'string' ? def.remission : null,
        observation: typeof def.observation === 'string' ? def.observation : null,
        examples: examples.length > 0 ? examples : null,
        variant: typeof def.variant === 'string' ? def.variant : null,
        ...markerValues,
      };
    });
}

/** @internal */
function extractMarkerValues(source: Record<string, unknown>): MeaningMarkerValues {
  return MEANING_MARKER_KEYS.reduce((acc, key) => {
    const rawValue = source[key];
    if (typeof rawValue === 'string') {
      acc[key] = rawValue;
    } else {
      acc[key] = null;
    }
    return acc;
  }, {} as MeaningMarkerValues);
}

/** @internal */
function extractExamples(source: Record<string, unknown>): Example[] {
  const legacyExample = source.example;
  const newExamples = source.examples;

  if (Array.isArray(newExamples)) {
    return newExamples as Example[];
  }

  if (Array.isArray(legacyExample)) {
    return legacyExample as Example[];
  }

  if (legacyExample && typeof legacyExample === 'object') {
    return [legacyExample as Example];
  }

  return [];
}

/** @internal */
function resolveAssignedTo(rawValue: unknown): number | null {
  if (typeof rawValue === 'number' && Number.isInteger(rawValue)) {
    return rawValue;
  }

  if (typeof rawValue === 'string') {
    const parsed = parseInt(rawValue, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (Array.isArray(rawValue) && rawValue.length > 0) {
    return resolveAssignedTo(rawValue[0]);
  }

  return null;
}

/**
 * POST /api/words/[lemma] - Create a new word
 *
 * Request body:
 * - lemma: Word headword (required)
 * - root: Root word (optional)
 * - letter: First letter for indexing (optional, auto-detected)
 * - values: Array of meaning definitions
 * - status: Initial status (optional)
 * - assignedTo: Assigned user ID (optional)
 * - createdBy: Creator user ID (optional)
 *
 * @returns Created word data with wordId, lemma, and letter
 */
export async function POST(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request);
  if (!rateLimitResult.success) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  try {
    const payload = (await request.json()) as CreateWordPayload;
    const lemma = typeof payload.lemma === 'string' ? payload.lemma.trim() : '';
    if (!lemma) {
      return NextResponse.json({ error: 'El lema es obligatorio' }, { status: 400 });
    }

    const root = typeof payload.root === 'string' ? payload.root : '';
    const letter = typeof payload.letter === 'string' ? payload.letter.trim() : null;
    const assignedTo = resolveAssignedTo(payload.assignedTo);
    const status = typeof payload.status === 'string' ? payload.status : undefined;
    const values = normalizeMeanings(payload.values);
    const createdBy = resolveAssignedTo(payload.createdBy);
    const finalValues =
      values.length > 0
        ? values
        : [
            {
              number: 1,
              meaning: 'Definición pendiente',
              origin: null,
              grammarCategory: null,
              dictionary: null,
              remission: null,
              observation: null,
              ...createEmptyMarkerValues(),
            },
          ];

    const word: Word = {
      lemma,
      root,
      values: finalValues,
    };

    const result = await createWord(word, {
      letter,
      assignedTo,
      status,
      createdBy,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          wordId: result.wordId,
          lemma: result.lemma,
          letter: result.letter,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error al crear la palabra',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/** @internal */
function createEmptyMarkerValues(): MeaningMarkerValues {
  return MEANING_MARKER_KEYS.reduce((acc, key) => {
    acc[key] = null;
    return acc;
  }, {} as MeaningMarkerValues);
}

/**
 * PUT /api/words/[lemma] - Update a word and its meanings
 *
 * Request body:
 * - word: Updated word data (optional if only adding comment)
 * - status: New status (optional)
 * - assignedTo: New assigned user ID (optional)
 * - comment: Editorial comment to add (optional)
 *
 * @returns Success or error with created comment if applicable
 */
export async function PUT(request: NextRequest, context: { params: Promise<{ lemma: string }> }) {
  try {
    const { lemma } = await context.params;
    const decodedLemma = decodeURIComponent(lemma);
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Solicitud inválida: se esperaba un objeto JSON' },
        { status: 400 }
      );
    }

    const {
      word: updatedWord,
      status,
      assignedTo,
      comment,
    } = body as {
      word?: Word;
      status?: string;
      assignedTo?: number | null;
      comment?: unknown;
    };

    const responseData: { comment?: WordNote } = {};

    if (typeof comment === 'string' && comment.trim().length > 0) {
      const session = await getSessionUser();
      const maybeId = session?.id ? Number.parseInt(session.id, 10) : NaN;
      const userId = Number.isInteger(maybeId) ? maybeId : null;

      const created = await addNoteToWord(decodedLemma, comment.trim(), userId);

      responseData.comment = {
        id: created.id,
        note: created.note,
        createdAt: created.createdAt.toISOString(),
        user: created.user
          ? {
              id: created.user.id,
              username: created.user.username,
            }
          : null,
      };
    }

    if (updatedWord) {
      await updateWordByLemma(decodedLemma, updatedWord, { status, assignedTo });
    } else if (!responseData.comment) {
      return NextResponse.json(
        { error: 'No se proporcionaron cambios para actualizar' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...(responseData.comment ? { data: { comment: responseData.comment } } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error al actualizar la palabra',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/words/[lemma] - Delete a word (admin only)
 *
 * Requires admin or superadmin role.
 * Cascade deletes associated meanings and notes.
 *
 * @returns Success or error
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ lemma: string }> }
) {
  try {
    // Check authentication and admin permission
    const user = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (user.role !== 'admin' && user.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin permission required to delete words' },
        { status: 403 }
      );
    }

    const { lemma } = await context.params;
    const decodedLemma = decodeURIComponent(lemma);

    await deleteWordByLemma(decodedLemma);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error al eliminar la palabra',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
