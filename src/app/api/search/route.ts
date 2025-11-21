import { NextRequest, NextResponse } from 'next/server';
import { searchWords } from '@/lib/queries';
import {
  SearchResult,
  PREDEFINED_GRAMMATICAL_CATEGORY_FILTERS,
  PREDEFINED_ORIGIN_FILTERS,
} from '@/lib/definitions';
import { applyRateLimit } from '@/lib/rate-limiting';
import { db } from '@/lib/db';
import { meanings } from '@/lib/schema';
import { sql } from 'drizzle-orm';
import { isEditorModeFromHeaders } from '@/lib/editor-mode-server';

const MAX_QUERY_LENGTH = 100;
const MAX_FILTER_OPTIONS = 10;
const MAX_LIMIT = 1000;

interface SearchFilters {
  query: string;
  categories: string[];
  origins: string[];
  letters: string[];
  status: string | undefined;
  assignedTo: string[];
  socialValuations: string[];
  socialStratumMarkers: string[];
  styleMarkers: string[];
  intentionalityMarkers: string[];
  geographicalMarkers: string[];
  chronologicalMarkers: string[];
  frequencyMarkers: string[];
}

interface ParseSuccess {
  filters: SearchFilters;
  page: number;
  limit: number;
  metaOnly: boolean;
}

interface ParseError {
  errorResponse: NextResponse;
}

type ParseResult = ParseSuccess | ParseError;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(request);
  if (!rateLimitResult.success) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const parsed = parseSearchParams(searchParams);
    const editorMode = isEditorModeFromHeaders(request.headers);

    if ('errorResponse' in parsed) {
      return parsed.errorResponse;
    }

    const { filters, page, limit, metaOnly } = parsed;

    // Get metadata from database
    const [
      socialValuationsResult,
      socialStratumResult,
      styleMarkersResult,
      intentionalityResult,
      geographicalResult,
      chronologicalResult,
      frequencyResult,
    ] = await Promise.all([
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(social_valuations) as value FROM meanings WHERE social_valuations IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(social_stratum_markers) as value FROM meanings WHERE social_stratum_markers IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(style_markers) as value FROM meanings WHERE style_markers IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(intentionality_markers) as value FROM meanings WHERE intentionality_markers IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(geographical_markers) as value FROM meanings WHERE geographical_markers IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(chronological_markers) as value FROM meanings WHERE chronological_markers IS NOT NULL`
      ),
      db.execute<{ value: string }>(
        sql`SELECT DISTINCT UNNEST(frequency_markers) as value FROM meanings WHERE frequency_markers IS NOT NULL`
      ),
    ]);

    const metadata = {
      categories: PREDEFINED_GRAMMATICAL_CATEGORY_FILTERS,
      origins: PREDEFINED_ORIGIN_FILTERS,
      markers: {
        socialValuations: socialValuationsResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        socialStratumMarkers: socialStratumResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        styleMarkers: styleMarkersResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        intentionalityMarkers: intentionalityResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        geographicalMarkers: geographicalResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        chronologicalMarkers: chronologicalResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
        frequencyMarkers: frequencyResult.rows
          .map((r) => r.value)
          .filter((value) => value != null)
          .sort((a, b) => a.localeCompare(b, 'es')),
      },
    };

    let paginatedResults: SearchResult[] = [];
    let pagination = {
      page: 1,
      limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    };

    if (!metaOnly) {
      // Search in database using advanced search with pagination
      const { results, total } = await searchWords({
        query: filters.query || undefined,
        categories: filters.categories.length > 0 ? filters.categories : undefined,
        origins: filters.origins.length > 0 ? filters.origins : undefined,
        letters: filters.letters.length > 0 ? filters.letters : undefined,
        status: filters.status || undefined,
        assignedTo: filters.assignedTo.length > 0 ? filters.assignedTo : undefined,
        editorMode,
        limit: MAX_LIMIT,
        socialValuations:
          filters.socialValuations.length > 0 ? filters.socialValuations : undefined,
        socialStratumMarkers:
          filters.socialStratumMarkers.length > 0 ? filters.socialStratumMarkers : undefined,
        styleMarkers: filters.styleMarkers.length > 0 ? filters.styleMarkers : undefined,
        intentionalityMarkers:
          filters.intentionalityMarkers.length > 0 ? filters.intentionalityMarkers : undefined,
        geographicalMarkers:
          filters.geographicalMarkers.length > 0 ? filters.geographicalMarkers : undefined,
        chronologicalMarkers:
          filters.chronologicalMarkers.length > 0 ? filters.chronologicalMarkers : undefined,
        frequencyMarkers:
          filters.frequencyMarkers.length > 0 ? filters.frequencyMarkers : undefined,
        page: page,
        pageSize: limit,
      });

      paginatedResults = results;

      pagination = {
        page,
        limit,
        total: total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      };
    }

    return NextResponse.json({
      success: true,
      data: {
        results: paginatedResults,
        metadata,
        pagination,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function parseSearchParams(searchParams: URLSearchParams): ParseResult {
  const rawQuery = searchParams.get('q') ?? '';
  const query = rawQuery.trim();

  if (query.length > MAX_QUERY_LENGTH) {
    return {
      errorResponse: NextResponse.json({ error: 'Query too long' }, { status: 400 }),
    };
  }

  const categories = parseList(searchParams.get('categories'));
  const origins = parseList(searchParams.get('origins'));
  const letters = parseList(searchParams.get('letters'));
  const socialValuations = parseList(searchParams.get('socialValuations'));
  const socialStratumMarkers = parseList(searchParams.get('socialStratumMarkers'));
  const styleMarkers = parseList(searchParams.get('styleMarkers'));
  const intentionalityMarkers = parseList(searchParams.get('intentionalityMarkers'));
  const geographicalMarkers = parseList(searchParams.get('geographicalMarkers'));
  const chronologicalMarkers = parseList(searchParams.get('chronologicalMarkers'));
  const frequencyMarkers = parseList(searchParams.get('frequencyMarkers'));
  const statusParam = searchParams.get('status');
  // If status is explicitly provided (even as empty), use it. Otherwise undefined means show all.
  const status = statusParam !== null ? statusParam : undefined;
  const assignedTo = parseList(searchParams.get('assignedTo'));

  if (
    categories.length > MAX_FILTER_OPTIONS ||
    origins.length > MAX_FILTER_OPTIONS ||
    letters.length > MAX_FILTER_OPTIONS ||
    assignedTo.length > MAX_FILTER_OPTIONS ||
    socialValuations.length > MAX_FILTER_OPTIONS ||
    socialStratumMarkers.length > MAX_FILTER_OPTIONS ||
    styleMarkers.length > MAX_FILTER_OPTIONS ||
    intentionalityMarkers.length > MAX_FILTER_OPTIONS ||
    geographicalMarkers.length > MAX_FILTER_OPTIONS ||
    chronologicalMarkers.length > MAX_FILTER_OPTIONS ||
    frequencyMarkers.length > MAX_FILTER_OPTIONS
  ) {
    return {
      errorResponse: NextResponse.json({ error: 'Too many filter options' }, { status: 400 }),
    };
  }

  const metaOnlyParam = searchParams.get('metaOnly');
  const metaOnly = metaOnlyParam === 'true' || metaOnlyParam === '1';

  const page = Math.max(parseInteger(searchParams.get('page'), 1), 1);
  const limit = Math.max(Math.min(parseInteger(searchParams.get('limit'), 20), MAX_LIMIT), 1);

  if (!Number.isFinite(page) || !Number.isFinite(limit)) {
    return {
      errorResponse: NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 }),
    };
  }

  const filters: SearchFilters = {
    query,
    categories,
    origins,
    letters,
    status,
    assignedTo,
    socialValuations,
    socialStratumMarkers,
    styleMarkers,
    intentionalityMarkers,
    geographicalMarkers,
    chronologicalMarkers,
    frequencyMarkers,
  };

  return { filters, page, limit, metaOnly };
}

function parseList(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseInteger(input: string | null, fallback: number): number {
  if (!input) return fallback;
  const parsed = parseInt(input, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}
