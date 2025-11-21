import { NextRequest, NextResponse } from 'next/server';
import { getWordByLemma } from '@/lib/queries';
import {
  updateWordByLemma,
  deleteWordByLemma,
  createWord,
  addNoteToWord,
} from '@/lib/editor-mutations';
import { applyRateLimit } from '@/lib/rate-limiting';
import { getSessionUser } from '@/lib/auth';
import type { Word, Meaning, WordNote, Example } from '@/lib/definitions';

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

    // Get word data from database
    const wordData = await getWordByLemma(decodedLemma);

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

interface CreateWordPayload {
  lemma?: unknown;
  root?: unknown;
  letter?: unknown;
  assignedTo?: unknown;
  values?: unknown;
  status?: unknown;
  createdBy?: unknown;
}

function normalizeExamples(input: unknown): Example[] {
  if (input == null) return [];

  const source = Array.isArray(input) ? input : [input];

  return source
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => {
      const value = typeof item.value === 'string' ? item.value : '';
      const example: Example = {
        value,
      };

      if (typeof item.author === 'string') example.author = item.author;
      if (typeof item.title === 'string') example.title = item.title;
      if (typeof item.source === 'string') example.source = item.source;
      if (typeof item.date === 'string') example.date = item.date;
      if (typeof item.page === 'string') example.page = item.page;

      return example;
    })
    .filter((example) => example.value.trim().length > 0);
}

function normalizeStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeMeanings(input: unknown): Meaning[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((def, index) => {
      const number = typeof def.number === 'number' ? def.number : index + 1;
      const meaningText =
        typeof def.meaning === 'string' && def.meaning.trim()
          ? def.meaning
          : `Definición ${number}`;

      const rawExamples =
        'examples' in def
          ? (def.examples as unknown)
          : 'example' in def
            ? (def.example as unknown)
            : undefined;

      return {
        number,
        meaning: meaningText,
        origin: typeof def.origin === 'string' ? def.origin : null,
        categories: Array.isArray(def.categories)
          ? (def.categories.filter((cat): cat is string => typeof cat === 'string') as string[])
          : [],
        remission: typeof def.remission === 'string' ? def.remission : null,
        socialValuations: normalizeStringArray(
          (def as { socialValuations?: unknown }).socialValuations
        ),
        socialStratumMarkers: normalizeStringArray(
          (def as { socialStratumMarkers?: unknown }).socialStratumMarkers
        ),
        styleMarkers: normalizeStringArray((def as { styleMarkers?: unknown }).styleMarkers),
        intentionalityMarkers: normalizeStringArray(
          (def as { intentionalityMarkers?: unknown }).intentionalityMarkers
        ),
        geographicalMarkers: normalizeStringArray(
          (def as { geographicalMarkers?: unknown }).geographicalMarkers
        ),
        chronologicalMarkers: normalizeStringArray(
          (def as { chronologicalMarkers?: unknown }).chronologicalMarkers
        ),
        frequencyMarkers: normalizeStringArray(
          (def as { frequencyMarkers?: unknown }).frequencyMarkers
        ),
        observation: typeof def.observation === 'string' ? def.observation : null,
        examples: normalizeExamples(rawExamples),
      } satisfies Meaning;
    });
}

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
 * POST /api/words/[lemma]
 * Create a new word with its meanings
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
              categories: [],
              remission: null,
              socialValuations: [],
              socialStratumMarkers: [],
              styleMarkers: [],
              intentionalityMarkers: [],
              geographicalMarkers: [],
              chronologicalMarkers: [],
              frequencyMarkers: [],
              observation: null,
              examples: [],
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

/**
 * PUT /api/words/[lemma]
 * Update a word and its meanings
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
 * DELETE /api/words/[lemma]
 * Delete a word and its meanings
 */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ lemma: string }> }
) {
  try {
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
