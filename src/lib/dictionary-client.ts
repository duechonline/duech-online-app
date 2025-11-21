import {
  SearchFilters,
  SearchMetadata,
  SearchResponse,
  MEANING_MARKER_KEYS,
  PREDEFINED_GRAMMATICAL_CATEGORY_FILTERS,
  PREDEFINED_ORIGIN_FILTERS,
  type MarkerMetadata,
} from '@/lib/definitions';

function createEmptyMarkerMetadata(): MarkerMetadata {
  return MEANING_MARKER_KEYS.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as MarkerMetadata);
}

function createDefaultMetadata(): SearchMetadata {
  return {
    categories: [...PREDEFINED_GRAMMATICAL_CATEGORY_FILTERS],
    origins: [...PREDEFINED_ORIGIN_FILTERS],
    markers: createEmptyMarkerMetadata(),
  };
}

/**
 * Client-safe dictionary functions that use API routes instead of direct database access.
 * These functions can be safely imported in client components.
 */

export async function searchDictionary(
  filters: SearchFilters,
  page: number = 1,
  limit: number = 1000,
  status?: string,
  assignedTo?: string[],
  editorMode?: boolean
): Promise<SearchResponse> {
  try {
    const params = buildFilterParams(filters);

    // Status handling logic
    // - Public users always receive "published"
    // - Editors:
    //   * undefined or "" → no filter → return all statuses
    //   * any specific value → filter by that value
    if (!editorMode) {
      // Public search: always filter to published words only
      params.append('status', 'published');
    } else {
      if (status && status.trim() !== '') {
        // Editor filtering by a specific status
        params.append('status', status);
      }
      // 👉 If status is undefined or empty, DO NOT append anything
    }

    if (assignedTo?.length) params.append('assignedTo', assignedTo.join(','));

    params.append('page', page.toString());
    params.append('limit', limit.toString());
    return await fetchSearchResults(params, page, limit);
  } catch {
    return {
      results: [],
      metadata: createDefaultMetadata(),
      pagination: { page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false },
    };
  }
}

export async function getSearchMetadata(): Promise<SearchMetadata> {
  try {
    const response = await fetch('/api/search?metaOnly=true');

    if (!response.ok) {
      throw new Error('Failed to get search metadata');
    }

    const result = await response.json();
    return result.data.metadata;
  } catch {
    return createDefaultMetadata();
  }
}

function buildFilterParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();

  const query = filters.query?.trim();
  if (query) params.append('q', query);
  if (filters.categories?.length) params.append('categories', filters.categories.join(','));
  if (filters.origins?.length) params.append('origins', filters.origins.join(','));
  if (filters.letters?.length) params.append('letters', filters.letters.join(','));

  for (const key of MEANING_MARKER_KEYS) {
    const values = filters[key];
    if (values && values.length > 0) {
      params.append(key, values.join(','));
    }
  }
  return params;
}

async function fetchSearchResults(params: URLSearchParams, page: number, limit: number) {
  try {
    const queryString = params.toString();
    const response = await fetch(`/api/search${queryString ? `?${queryString}` : ''}`);
    if (!response.ok) {
      throw new Error('Search failed');
    }

    const result = await response.json();
    return result.data;
  } catch {
    return {
      results: [],
      metadata: createDefaultMetadata(),
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: page > 1,
      },
    };
  }
}
