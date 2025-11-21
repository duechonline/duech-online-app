'use client';

import {
  MEANING_MARKER_KEYS,
  createEmptyMarkerFilterState,
  type MeaningMarkerKey,
} from '@/lib/definitions';

interface EditorSearchFilters {
  query: string;
  selectedCategories: string[];
  selectedOrigins: string[];
  selectedLetters: string[];
  selectedStatus: string;
  selectedAssignedTo: string[];
  selectedMarkers: Record<MeaningMarkerKey, string[]>;
}

const COOKIE_NAME = 'duech_editor_filters';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function setEditorSearchFilters(filters: EditorSearchFilters): void {
  try {
    const serializedFilters = JSON.stringify(filters);
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(serializedFilters)}; max-age=${COOKIE_MAX_AGE}; path=/; samesite=lax`;
  } catch {
    // Silent fail
  }
}

export function getEditorSearchFilters(): EditorSearchFilters {
  const defaultFilters: EditorSearchFilters = {
    query: '',
    selectedCategories: [],
    selectedOrigins: [],
    selectedLetters: [],
    selectedStatus: '',
    selectedAssignedTo: [],
    selectedMarkers: createEmptyMarkerFilterState(),
  };

  try {
    if (typeof document === 'undefined') {
      return defaultFilters;
    }

    const cookies = document.cookie.split(';');
    const filterCookie = cookies.find((cookie) => cookie.trim().startsWith(`${COOKIE_NAME}=`));

    if (!filterCookie) {
      return defaultFilters;
    }

    const cookieValue = filterCookie.split('=')[1];
    if (!cookieValue) {
      return defaultFilters;
    }

    const decodedValue = decodeURIComponent(cookieValue);
    const parsedFilters = JSON.parse(decodedValue) as EditorSearchFilters;

    // Validate the structure
    if (
      typeof parsedFilters.query === 'string' &&
      typeof parsedFilters.selectedStatus === 'string' &&
      Array.isArray(parsedFilters.selectedCategories) &&
      Array.isArray(parsedFilters.selectedOrigins) &&
      Array.isArray(parsedFilters.selectedLetters) &&
      Array.isArray(parsedFilters.selectedAssignedTo)
    ) {
      const markers = createEmptyMarkerFilterState();
      const incomingMarkers = parsedFilters.selectedMarkers;

      if (incomingMarkers && typeof incomingMarkers === 'object') {
        for (const key of MEANING_MARKER_KEYS) {
          const value = incomingMarkers[key];
          markers[key] = Array.isArray(value)
            ? value.filter((entry): entry is string => typeof entry === 'string')
            : [];
        }
      }

      return {
        query: parsedFilters.query,
        selectedCategories: parsedFilters.selectedCategories,
        selectedOrigins: parsedFilters.selectedOrigins,
        selectedLetters: parsedFilters.selectedLetters,
        selectedStatus: parsedFilters.selectedStatus,
        selectedAssignedTo: parsedFilters.selectedAssignedTo,
        selectedMarkers: markers,
      } satisfies EditorSearchFilters;
    }

    return defaultFilters;
  } catch {
    return defaultFilters;
  }
}

export function clearEditorSearchFilters(): void {
  try {
    document.cookie = `${COOKIE_NAME}=; max-age=0; path=/; samesite=lax`;
  } catch {
    // Silent fail
  }
}
