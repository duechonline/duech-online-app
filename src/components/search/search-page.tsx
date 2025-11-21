'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { SelectDropdown, MultiSelectDropdown } from '@/components/common/dropdown';
import SearchBar from '@/components/search/search-bar';
import { searchDictionary } from '@/lib/dictionary-client';
import {
  SearchResult,
  STATUS_OPTIONS,
  MEANING_MARKER_KEYS,
  type MeaningMarkerKey,
} from '@/lib/definitions';
import { WordCard } from '@/components/search/word-card';
import { AddWordModal } from '@/components/search/add-word-modal';
import { useUrlSearchParams } from '@/hooks/useUrlSearchParams';
import { useSearchState } from '@/hooks/useSearchState';
import {
  SearchLoadingSkeleton,
  EmptySearchState,
  NoResultsState,
  SearchResultsCount,
} from '@/components/search/search-results-components';
import { Pagination } from '@/components/search/pagination';
import {
  arraysEqual,
  filtersChanged,
  cloneFilters,
  LocalSearchFilters,
  getLexicographerOptions,
  type User,
} from '@/lib/search-utils';

// Helper to check if current search state matches URL params
function matchesUrlState(
  searchState: {
    query: string;
    filters: LocalSearchFilters;
    status: string;
    assignedTo: string[];
  },
  urlParams: {
    trimmedQuery: string;
    categories: string[];
    origins: string[];
    letters: string[];
    status: string;
    assignedTo: string[];
    markers: Record<MeaningMarkerKey, string[]>;
  }
): boolean {
  return (
    searchState.query === urlParams.trimmedQuery &&
    arraysEqual(searchState.filters.categories, urlParams.categories) &&
    arraysEqual(searchState.filters.origins, urlParams.origins) &&
    arraysEqual(searchState.filters.letters, urlParams.letters) &&
    MEANING_MARKER_KEYS.every((key) =>
      arraysEqual(searchState.filters[key], urlParams.markers[key])
    ) &&
    searchState.status === urlParams.status &&
    arraysEqual(searchState.assignedTo, urlParams.assignedTo)
  );
}

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

// Helper to validate if URL-based search should proceed
function shouldProceedWithUrlSearch(
  editorMode: boolean,
  hasUrlCriteria: boolean,
  isInitialized: boolean
): boolean {
  if (!editorMode) return false;
  if (!hasUrlCriteria) return false;
  if (!isInitialized) return false;
  return true;
}

// Helper to handle early returns in URL search effects
function handleEarlyUrlSearchReturn(
  editorMode: boolean,
  urlParams: { hasUrlCriteria: boolean },
  isInitialized: boolean,
  urlSearchTriggeredRef: React.MutableRefObject<boolean>
): boolean {
  if (!shouldProceedWithUrlSearch(editorMode, urlParams.hasUrlCriteria, isInitialized)) {
    if (editorMode && !urlParams.hasUrlCriteria) {
      urlSearchTriggeredRef.current = false;
    }
    return true; // Should return early
  }
  return false; // Should continue
}

interface SearchPageProps {
  title?: string;
  placeholder: string;
  initialUsers?: User[];
  editorMode?: boolean;
  currentUserId?: number | null;
  currentUserRole?: string | null;
}

export function SearchPage({
  title,
  placeholder,
  initialUsers = [],
  editorMode = false,
  currentUserId,
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

  const urlSearchTriggeredRef = useRef(false);

  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(!editorMode);
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

  const initialFilters = useMemo<LocalSearchFilters>(
    () => ({
      categories: [...urlParams.categories],
      origins: [...urlParams.origins],
      letters: [...urlParams.letters],
      ...MEANING_MARKER_KEYS.reduce(
        (acc, key) => {
          acc[key] = [...urlParams.markers[key]];
          return acc;
        },
        {} as Record<MeaningMarkerKey, string[]>
      ),
    }),
    [urlParams.categories, urlParams.markers, urlParams.origins, urlParams.letters]
  );

  // Reset URL search trigger when URL params change
  useEffect(() => {
    if (handleEarlyUrlSearchReturn(editorMode, urlParams, isInitialized, urlSearchTriggeredRef)) {
      return;
    }

    if (!matchesUrlState(searchState, urlParams)) {
      urlSearchTriggeredRef.current = false;
      setHasSearched(false);
      setSearchResults([]);
      setTotalResults(0);
    }
  }, [editorMode, isInitialized, urlParams, searchState]);

  // Auto-search on mount for public mode
  useEffect(() => {
    if (editorMode || hasSearched) return;

    let cancelled = false;

    const hasSearchCriteria =
      Boolean(urlParams.trimmedQuery) ||
      initialFilters.categories.length > 0 ||
      initialFilters.origins.length > 0 ||
      initialFilters.letters.length > 0 ||
      MEANING_MARKER_KEYS.some((key) => initialFilters[key].length > 0);

    if (!hasSearchCriteria) {
      setSearchResults([]);
      setTotalResults(0);
      setIsLoading(false);
      return;
    }

    const executeInitialSearch = async () => {
      setIsLoading(true);
      try {
        const data = await searchDictionary(
          {
            query: urlParams.trimmedQuery,
            ...initialFilters,
          },
          1,
          RESULTS_PER_PAGE
        );

        if (!cancelled) {
          setSearchResults(data.results);
          setTotalResults(data.pagination.total);
          setPagination({
            totalPages: data.pagination.totalPages,
            hasNext: data.pagination.hasNext,
            hasPrev: data.pagination.hasPrev,
          });
          setCurrentPage(1);
          setHasSearched(true);
        }
      } catch {
        if (!cancelled) {
          setSearchResults([]);
          setTotalResults(0);
          setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    executeInitialSearch();

    return () => {
      cancelled = true;
    };
  }, [editorMode, hasSearched, urlParams.query, urlParams.trimmedQuery, initialFilters]);

  const handleSearchStateChange = useCallback(
    ({ query, filters }: { query: string; filters: LocalSearchFilters }) => {
      updateState((prev) => updateStateIfChanged(prev, query, filters));
    },
    [updateState]
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
      setIsLoading(true);
      setHasSearched(true);

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

        setSearchResults(searchData.results);
        setTotalResults(searchData.pagination.total);
        setPagination({
          totalPages: searchData.pagination.totalPages,
          hasNext: searchData.pagination.hasNext,
          hasPrev: searchData.pagination.hasPrev,
        });
        setCurrentPage(page);
        setLastExecutedQuery(query); // Save the query that was actually executed

        updateState((prev) => updateStateIfChanged(prev, query, filters));

        if (editorMode) {
          setTimeout(() => saveFilters(), 0);
        }
      } catch {
        setSearchResults([]);
        setTotalResults(0);
        setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
      } finally {
        setIsLoading(false);
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

  const handleClearAll = useCallback(() => {
    clearAll();
    setSearchResults([]);
    setHasSearched(false);
    setTotalResults(0);
    setCurrentPage(1);
    setLastExecutedQuery('');
    setPagination({ totalPages: 0, hasNext: false, hasPrev: false });
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

  // Trigger search when URL params match current state in editor mode
  useEffect(() => {
    if (handleEarlyUrlSearchReturn(editorMode, urlParams, isInitialized, urlSearchTriggeredRef)) {
      return;
    }

    if (!matchesUrlState(searchState, urlParams)) {
      urlSearchTriggeredRef.current = false;
      return;
    }

    if (urlSearchTriggeredRef.current) return;

    urlSearchTriggeredRef.current = true;

    void executeSearch({
      query: searchState.query,
      filters: searchState.filters,
    });
  }, [editorMode, executeSearch, isInitialized, urlParams, searchState]);

  const userOptions = useMemo(() => getLexicographerOptions(availableUsers), [availableUsers]);

  const hasEditorFilters = searchState.status.length > 0 || searchState.assignedTo.length > 0;

  const hasSearchCriteria =
    searchState.query.length > 0 ||
    searchState.filters.categories.length > 0 ||
    searchState.filters.origins.length > 0 ||
    searchState.filters.letters.length > 0 ||
    MEANING_MARKER_KEYS.some((key) => searchState.filters[key].length > 0) ||
    (editorMode && hasEditorFilters);

  // Memoize filter components for editor mode
  const statusFilter = useMemo(
    () =>
      editorMode ? (
        <SelectDropdown
          key="status-filter"
          label="Estado"
          options={STATUS_OPTIONS}
          selectedValue={searchState.status}
          onChange={handleStatusChange}
          placeholder="Seleccionar estado"
        />
      ) : null,
    [editorMode, searchState.status, handleStatusChange]
  );

  const assignedFilter = useMemo(
    () =>
      editorMode ? (
        <MultiSelectDropdown
          key="assigned-filter"
          label="Asignado a"
          options={userOptions}
          selectedValues={searchState.assignedTo}
          onChange={handleAssignedChange}
          placeholder="Seleccionar usuario"
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
          onSearch={executeSearch}
          onStateChange={handleSearchStateChange}
          onClearAll={editorMode ? handleClearAll : undefined}
          additionalFilters={additionalFiltersConfig}
          initialAdvancedOpen={
            editorMode &&
            (searchState.filters.categories.length > 0 ||
              searchState.filters.origins.length > 0 ||
              searchState.filters.letters.length > 0 ||
              MEANING_MARKER_KEYS.some((key) => searchState.filters[key].length > 0) ||
              hasEditorFilters)
          }
          editorMode={editorMode}
        />
      </div>

      {/* Results Section */}
      <div>
        {isLoading ? (
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
              <div className="space-y-4">
                {searchResults.map((result, index) => {
                  return (
                    <WordCard
                      key={`${result.word.lemma}-${index}`}
                      lemma={result.word.lemma}
                      letter={result.letter}
                      editorMode={editorMode}
                      root={editorMode ? result.word.root : undefined}
                      status={editorMode ? result.status : undefined}
                      createdBy={editorMode ? result.createdBy : undefined}
                      definitionsCount={editorMode ? result.word.values.length : undefined}
                      assignedTo={editorMode ? result.assignedTo : undefined}
                      currentUserId={currentUserId}
                    />
                  );
                })}
              </div>

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
