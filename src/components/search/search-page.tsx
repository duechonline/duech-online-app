/**
 * Main search page component.
 *
 * Provides full dictionary search functionality with pagination,
 * filtering, and different modes for public and editor views.
 *
 * @module components/search/search-page
 */

'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { Dropdown } from '@/components/common/dropdown';
import SearchBar from '@/components/search/search-bar';
import { searchDictionary } from '@/lib/dictionary-client';
import {
  MEANING_MARKER_KEYS,
  MeaningMarkerKey,
  SearchResult,
  STATUS_OPTIONS,
} from '@/lib/definitions';
import { AddWordModal } from '@/components/search/add-word-modal';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { useSearchState, type SearchState } from '@/hooks/useSearchState';
import {
  SearchLoadingSkeleton,
  EmptySearchState,
  NoResultsState,
  SearchResultsCount,
  WordResultsList,
} from '@/components/search/search-results-components';
import { Pagination } from '@/components/search/pagination';
import {
  filtersChanged,
  cloneFilters,
  LocalSearchFilters,
  getLexicographerAndAdminOptions,
  type User,
} from '@/lib/search-utils';

const buildUrlSignature = (
  params: {
    trimmedQuery: string;
    categories: string[];
    origins: string[];
    letters: string[];
    dictionaries: string[];
    status: string;
    assignedTo: string[];
  } & Record<MeaningMarkerKey, string[]>
): string => {
  const markerSegment = MEANING_MARKER_KEYS.map((key) => params[key].join(',')).join('|');
  return [
    params.trimmedQuery,
    params.categories.join(','),
    params.origins.join(','),
    params.letters.join(','),
    params.dictionaries.join(','),
    markerSegment,
    params.status,
    params.assignedTo.join(','),
  ].join('|');
};

const stateHasCriteria = (state: SearchState, includeEditorFilters: boolean): boolean =>
  state.query.length > 0 ||
  state.filters.categories.length > 0 ||
  state.filters.origins.length > 0 ||
  state.filters.letters.length > 0 ||
  state.filters.dictionaries.length > 0 ||
  MEANING_MARKER_KEYS.some((key) => state.filters[key].length > 0) ||
  (includeEditorFilters && (state.status.length > 0 || state.assignedTo.length > 0));

// Helper to update state if query or filters changed
function updateStateIfChanged(
  prev: {
    query: string;
    filters: LocalSearchFilters;
    status: string;
    assignedTo: string[];
  },
  query: string,
  filters: LocalSearchFilters
) {
  const hasFiltersChanged = filtersChanged(prev.filters, filters);
  const queryChanged = prev.query !== query;

  if (!hasFiltersChanged && !queryChanged) {
    return prev;
  }

  return {
    ...prev,
    query,
    filters: hasFiltersChanged ? cloneFilters(filters) : prev.filters,
  };
}

/**
 * Props for the SearchPage component.
 */
export interface SearchPageProps {
  /** Page title (defaults based on mode) */
  title?: string;
  /** Search input placeholder text */
  placeholder: string;
  /** Users for assignment dropdown (editor mode) */
  initialUsers?: User[];
  /** Enable editor features and filters */
  editorMode?: boolean;
  /** Current user's ID for permission checks */
  currentUserId?: number | null;
  /** Current user's role for permission checks */
  currentUserRole?: string | null;
}

/**
 * Full-featured dictionary search page.
 *
 * Handles URL parameter parsing, search state management, API calls,
 * and result display with pagination. Supports both public and editor modes.
 *
 * @example
 * ```tsx
 * // Public search page
 * <SearchPage placeholder="Buscar palabra..." />
 *
 * // Editor search page
 * <SearchPage
 *   placeholder="Buscar para editar..."
 *   editorMode={true}
 *   initialUsers={users}
 *   currentUserId={session.user.id}
 *   currentUserRole={session.user.role}
 * />
 * ```
 */
export function SearchPage({
  title,
  placeholder,
  initialUsers = [],
  editorMode = false,
  currentUserId,
  currentUserRole,
}: SearchPageProps) {
  // Parse URL search params
  const searchParams = useSearchParams();
  const urlParams = useUrlSearchParams(searchParams);

  // Set title based on editor mode if not provided
  const pageTitle = title || (editorMode ? 'Editor de Diccionario' : 'Diccionario');

  // Manage search state with URL/cookie synchronization
  const { searchState, updateState, saveFilters, clearAll, isInitialized } = useSearchState({
    editorMode,
    urlParams,
  });

  const urlHasCriteria = urlParams.hasUrlCriteria;

  const urlSignature = useMemo(() => buildUrlSignature(urlParams), [urlParams]);

  const stateInitiallyHasCriteria = stateHasCriteria(searchState, editorMode);

  const latestRequestRef = useRef(0);
  const initialSearchTriggeredRef = useRef(false);
  const previousUrlSignatureRef = useRef(urlSignature);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(() => stateInitiallyHasCriteria);
  const [hasSearched, setHasSearched] = useState(false);
  const [totalResults, setTotalResults] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastExecutedQuery, setLastExecutedQuery] = useState(''); // Track the query used in the last search
  const [pagination, setPagination] = useState({
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
  });

  const RESULTS_PER_PAGE = 50;

  // Editor mode: Use users passed from server
  const availableUsers = initialUsers;

  const hasEditorFilters = searchState.status.length > 0 || searchState.assignedTo.length > 0;
  const hasMarkerFilters = useMemo(
    () => MEANING_MARKER_KEYS.some((key) => searchState.filters[key].length > 0),
    [searchState.filters]
  );
  const hasSearchCriteria = stateHasCriteria(searchState, editorMode);

  // Reset bookkeeping when public URL params change so new criteria trigger a fresh search
  useEffect(() => {
    if (editorMode) {
      return;
    }

    if (previousUrlSignatureRef.current === urlSignature) {
      return;
    }

    previousUrlSignatureRef.current = urlSignature;
    initialSearchTriggeredRef.current = false;

    if (urlHasCriteria) {
      setHasSearched(false);
      setIsLoading(true);
      setCurrentPage(1);
      return;
    }

    if (!stateHasCriteria(searchState, false)) {
      setHasSearched(false);
      setSearchResults([]);
      setTotalResults(0);
      setCurrentPage(1);
      setLastExecutedQuery('');
      setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
      setIsLoading(false);
    }
  }, [editorMode, searchState, urlHasCriteria, urlSignature]);

  const handleSearchStateChange = useCallback(
    ({ query, filters }: { query: string; filters: LocalSearchFilters }) => {
      // Editor mode: avoid triggering searches while typing so only manual submits run queries.
      // Keep the last executed query in state until the user submits and still update filters for visual feedback.
      updateState((prev) => {
        if (editorMode) {
          const hasFiltersChanged = filtersChanged(prev.filters, filters);
          if (!hasFiltersChanged) {
            return prev; // Ignore live query changes
          }
          return {
            ...prev,
            filters: cloneFilters(filters),
          };
        }
        // Public mode keeps live synchronization between the bar and the URL-driven state
        return updateStateIfChanged(prev, query, filters);
      });
    },
    [updateState, editorMode]
  );

  const handleStatusChange = useCallback(
    (value: string) => {
      updateState((prev) => ({
        ...prev,
        status: value,
      }));
    },
    [updateState]
  );

  const handleAssignedChange = useCallback(
    (values: string[]) => {
      updateState((prev) => ({
        ...prev,
        assignedTo: values,
      }));
    },
    [updateState]
  );

  const clearAdditionalFilters = useCallback(() => {
    updateState((prev) => ({
      ...prev,
      status: '',
      assignedTo: [],
    }));
  }, [updateState]);

  const executeSearch = useCallback(
    async ({
      query,
      filters,
      page = 1,
    }: {
      query: string;
      filters: LocalSearchFilters;
      page?: number;
    }) => {
      const requestId = latestRequestRef.current + 1;
      latestRequestRef.current = requestId;
      setIsLoading(true);
      let nextStateSnapshot: SearchState | null = null;

      updateState((prev) => {
        const next = updateStateIfChanged(prev, query, filters);
        nextStateSnapshot = next;
        return next;
      });

      try {
        const searchData = await searchDictionary(
          {
            query,
            ...filters,
          },
          page,
          RESULTS_PER_PAGE,
          editorMode ? searchState.status : undefined,
          editorMode ? searchState.assignedTo : undefined,
          editorMode
        );

        if (requestId !== latestRequestRef.current) {
          return;
        }

        setSearchResults(searchData.results);
        setTotalResults(searchData.pagination.total);
        setPagination({
          totalPages: searchData.pagination.totalPages,
          hasNext: searchData.pagination.hasNext,
          hasPrev: searchData.pagination.hasPrev,
        });
        setCurrentPage(page);
        setLastExecutedQuery(query); // Save the query that was actually executed
      } catch {
        if (requestId !== latestRequestRef.current) {
          return;
        }
        setSearchResults([]);
        setTotalResults(0);
        setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
      } finally {
        if (requestId === latestRequestRef.current) {
          setHasSearched(true);
          setIsLoading(false);
          if (nextStateSnapshot) {
            saveFilters(nextStateSnapshot);
          }
        }
      }
    },
    [
      editorMode,
      saveFilters,
      searchState.assignedTo,
      searchState.status,
      updateState,
      RESULTS_PER_PAGE,
    ]
  );

  useEffect(() => {
    if (!isInitialized) {
      return;
    }

    if (hasSearched || initialSearchTriggeredRef.current) {
      return;
    }

    if (!hasSearchCriteria) {
      setIsLoading(false);
      return;
    }

    initialSearchTriggeredRef.current = true;

    const initialQuery = editorMode
      ? searchState.query
      : urlHasCriteria
        ? urlParams.trimmedQuery
        : searchState.query;

    const filtersForAutoSearch = editorMode
      ? searchState.filters
      : urlHasCriteria
        ? (() => {
            const snapshot = {
              categories: [...urlParams.categories],
              origins: [...urlParams.origins],
              letters: [...urlParams.letters],
            } as LocalSearchFilters;
            for (const key of MEANING_MARKER_KEYS) {
              snapshot[key] = [...urlParams[key]];
            }
            return snapshot;
          })()
        : searchState.filters;

    void executeSearch({
      query: initialQuery,
      filters: filtersForAutoSearch,
    });
  }, [
    editorMode,
    executeSearch,
    hasSearchCriteria,
    hasSearched,
    isInitialized,
    searchState.filters,
    searchState.query,
    urlHasCriteria,
    urlParams,
    urlSignature,
  ]);

  // Shared manual search handler that normalizes the payload before executing
  const handleManualSearch = useCallback(
    async ({ query, filters }: { query: string; filters: LocalSearchFilters }) => {
      const trimmedQuery = query.trim();
      const normalizedFilters = cloneFilters(filters);

      await executeSearch({ query: trimmedQuery, filters: normalizedFilters, page: 1 });
    },
    [executeSearch]
  );

  const handleClearAll = useCallback(() => {
    clearAll();
    setSearchResults([]);
    setHasSearched(false);
    setTotalResults(0);
    setCurrentPage(1);
    setLastExecutedQuery('');
    setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
    setIsLoading(false);
    initialSearchTriggeredRef.current = false;
  }, [clearAll]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (page < 1 || page > pagination.totalPages) return;

      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: 'smooth' });

      executeSearch({
        query: searchState.query,
        filters: searchState.filters,
        page,
      });
    },
    [pagination.totalPages, executeSearch, searchState.query, searchState.filters]
  );

  // Editor mode no longer synchronizes with the URL; public history still relies on the earlier effect

  const userOptions = useMemo(
    () => getLexicographerAndAdminOptions(availableUsers),
    [availableUsers]
  );

  useEffect(() => {
    if (!editorMode) {
      return;
    }
    if (hasSearched) {
      return;
    }
    if (initialSearchTriggeredRef.current) {
      return;
    }
    if (!hasSearchCriteria) {
      return;
    }

    initialSearchTriggeredRef.current = true;
    void executeSearch({
      query: searchState.query,
      filters: searchState.filters,
    });
  }, [
    editorMode,
    executeSearch,
    hasSearched,
    hasSearchCriteria,
    searchState.filters,
    searchState.query,
  ]);

  // Memoize filter components for editor mode
  const statusFilter = useMemo(
    () =>
      editorMode ? (
        <Dropdown
          key="status-filter"
          label="Estado"
          options={STATUS_OPTIONS}
          value={searchState.status}
          onChange={handleStatusChange}
          placeholder="Seleccionar estado"
        />
      ) : null,
    [editorMode, searchState.status, handleStatusChange]
  );

  const assignedFilter = useMemo(
    () =>
      editorMode ? (
        <Dropdown
          key="assigned-filter"
          label="Asignado a"
          options={userOptions}
          value={searchState.assignedTo}
          onChange={handleAssignedChange}
          placeholder="Seleccionar usuario"
          multiple={true}
        />
      ) : null,
    [editorMode, searchState.assignedTo, userOptions, handleAssignedChange]
  );

  const additionalFiltersConfig = useMemo(
    () =>
      editorMode
        ? {
            hasActive: hasEditorFilters,
            onClear: clearAdditionalFilters,
            render: () => (
              <>
                {statusFilter}
                {assignedFilter}
              </>
            ),
          }
        : undefined,
    [editorMode, clearAdditionalFilters, hasEditorFilters, statusFilter, assignedFilter]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div
        className={`mb-${editorMode ? '3' : '10'} ${editorMode ? 'flex items-center justify-between' : ''}`}
      >
        <h1 className={`text-duech-blue ${editorMode ? '' : 'mb-6'} text-4xl font-bold`}>
          {pageTitle}
        </h1>
        {editorMode && <AddWordModal availableUsers={availableUsers} />}
      </div>

      {/* Search Bar */}
      <div className={`mb-8 ${editorMode ? 'rounded-xl bg-white p-6 shadow-lg' : ''}`}>
        <SearchBar
          placeholder={placeholder}
          initialValue={searchState.query}
          initialFilters={searchState.filters}
          onSearch={handleManualSearch}
          onStateChange={handleSearchStateChange}
          onClearAll={editorMode ? handleClearAll : undefined}
          additionalFilters={additionalFiltersConfig}
          initialAdvancedOpen={
            editorMode &&
            (searchState.filters.categories.length > 0 ||
              hasMarkerFilters ||
              searchState.filters.origins.length > 0 ||
              searchState.filters.letters.length > 0 ||
              hasEditorFilters)
          }
          editorMode={editorMode}
        />
      </div>

      {/* Results Section */}
      <div>
        {isLoading && !hasSearched ? (
          <SearchLoadingSkeleton editorMode={editorMode} />
        ) : hasSearched || (!editorMode && hasSearchCriteria) ? (
          searchResults.length > 0 ? (
            <>
              <SearchResultsCount
                editorMode={editorMode}
                totalResults={totalResults}
                query={lastExecutedQuery}
                currentPage={currentPage}
                pageSize={RESULTS_PER_PAGE}
              />
              {/* Results list */}
              <WordResultsList
                results={searchResults}
                editorMode={editorMode}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                hasNext={pagination.hasNext}
                hasPrev={pagination.hasPrev}
                onPageChange={handlePageChange}
              />
            </>
          ) : (
            <NoResultsState editorMode={editorMode} />
          )
        ) : (
          <EmptySearchState editorMode={editorMode} />
        )}
      </div>
    </div>
  );
}
