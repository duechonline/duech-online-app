/**
 * Custom hook to manage search state with URL and cookie synchronization
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { arraysEqual, LocalSearchFilters } from '@/lib/search-utils';
import {
  setEditorSearchFilters,
  getEditorSearchFilters,
  clearEditorSearchFilters,
} from '@/lib/cookies';
import { UrlSearchParams } from '@/hooks/useUrlSearchParams';
import {
  MEANING_MARKER_KEYS,
  createEmptyMarkerFilterState,
  type MeaningMarkerKey,
} from '@/lib/definitions';

interface SearchState {
  query: string;
  filters: LocalSearchFilters;
  status: string;
  assignedTo: string[];
}

const createEmptyFilters = (): LocalSearchFilters => ({
  categories: [],
  origins: [],
  letters: [],
  ...createEmptyMarkerFilterState(),
});

const cloneMarkers = (
  source: Pick<LocalSearchFilters, MeaningMarkerKey>
): Record<MeaningMarkerKey, string[]> =>
  MEANING_MARKER_KEYS.reduce(
    (acc, key) => {
      acc[key] = [...source[key]];
      return acc;
    },
    {} as Record<MeaningMarkerKey, string[]>
  );

const createDefaultSearchState = (): SearchState => ({
  query: '',
  filters: createEmptyFilters(),
  status: '',
  assignedTo: [],
});

interface UseSearchStateOptions {
  editorMode: boolean;
  urlParams: UrlSearchParams;
}

/**
 * Manages search state with synchronization from URL params (priority) or cookies (fallback)
 */
export function useSearchState({ editorMode, urlParams }: UseSearchStateOptions) {
  const [searchState, setSearchState] = useState<SearchState>(() => {
    if (editorMode) {
      return createDefaultSearchState();
    }
    // Public mode: use URL params
    return {
      query: urlParams.query,
      filters: {
        categories: [...urlParams.categories],
        origins: [...urlParams.origins],
        letters: [...urlParams.letters],
        ...cloneMarkers(urlParams.markers),
      },
      status: '',
      assignedTo: [],
    };
  });

  const isInitializedRef = useRef(false);
  const mountedRef = useRef(false);

  const setSearchStateFromUrl = useCallback(() => {
    setSearchState({
      query: urlParams.trimmedQuery,
      filters: {
        categories: [...urlParams.categories],
        origins: [...urlParams.origins],
        letters: [...urlParams.letters],
        ...cloneMarkers(urlParams.markers),
      },
      status: urlParams.status,
      assignedTo: [...urlParams.assignedTo],
    });
  }, [urlParams]);

  // Initialize state on mount for editor mode (URL params take precedence over cookies)
  useEffect(() => {
    if (!editorMode || mountedRef.current) return;

    mountedRef.current = true;

    if (urlParams.hasUrlCriteria) {
      setSearchStateFromUrl();
      isInitializedRef.current = true;
    } else {
      const savedFilters = getEditorSearchFilters();

      setSearchState({
        query: savedFilters.query,
        filters: {
          categories: savedFilters.selectedCategories,
          origins: savedFilters.selectedOrigins,
          letters: savedFilters.selectedLetters,
          ...cloneMarkers(savedFilters.selectedMarkers),
        },
        status: savedFilters.selectedStatus,
        assignedTo: savedFilters.selectedAssignedTo,
      });
      isInitializedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode]);
  // Only run on mount to initialize state from URL params or cookies

  // Sync state when URL params change (e.g., browser back/forward navigation)
  useEffect(() => {
    if (!editorMode || !mountedRef.current) return;
    if (!urlParams.hasUrlCriteria) return;

    // Check if URL params differ from current state
    const urlMatchesState =
      searchState.query === urlParams.trimmedQuery &&
      arraysEqual(searchState.filters.categories, urlParams.categories) &&
      arraysEqual(searchState.filters.origins, urlParams.origins) &&
      arraysEqual(searchState.filters.letters, urlParams.letters) &&
      MEANING_MARKER_KEYS.every((key) =>
        arraysEqual(searchState.filters[key], urlParams.markers[key])
      ) &&
      searchState.status === urlParams.status &&
      arraysEqual(searchState.assignedTo, urlParams.assignedTo);

    if (urlMatchesState) return;

    // URL params changed (e.g., from browser navigation), sync state
    setSearchStateFromUrl();
  }, [
    editorMode,
    urlParams.hasUrlCriteria,
    urlParams.trimmedQuery,
    urlParams.categories,
    urlParams.origins,
    urlParams.letters,
    urlParams.markers,
    urlParams.status,
    urlParams.assignedTo,
    setSearchStateFromUrl,
    searchState.query,
    searchState.filters.categories,
    searchState.filters.origins,
    searchState.filters.letters,
    searchState.filters,
    searchState.status,
    searchState.assignedTo,
  ]);

  // Save filters to cookies for editor mode
  const saveFilters = useCallback(() => {
    if (!editorMode || !isInitializedRef.current) return;

    setEditorSearchFilters({
      query: searchState.query,
      selectedCategories: searchState.filters.categories,
      selectedOrigins: searchState.filters.origins,
      selectedLetters: searchState.filters.letters,
      selectedStatus: searchState.status,
      selectedAssignedTo: searchState.assignedTo,
      selectedMarkers: cloneMarkers(searchState.filters),
    });
  }, [editorMode, searchState]);

  // Clear all filters and reset state
  const clearAll = useCallback(() => {
    setSearchState(createDefaultSearchState());
    if (editorMode) {
      clearEditorSearchFilters();
    }
  }, [editorMode]);

  // Update search state
  const updateState = useCallback((updater: (prev: SearchState) => SearchState) => {
    setSearchState(updater);
  }, []);

  return {
    searchState,
    setSearchState,
    updateState,
    saveFilters,
    clearAll,
    isInitialized: isInitializedRef.current,
  };
}
