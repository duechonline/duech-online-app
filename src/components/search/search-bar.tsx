'use client';

import React from 'react';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MultiSelectDropdown } from '@/components/common/dropdown';
import { getSearchMetadata } from '@/lib/dictionary-client';
import { CloseIcon, SearchIcon, SettingsIcon } from '@/components/icons';
import { Button } from '@/components/common/button';
import {
  GRAMMATICAL_CATEGORIES,
  SearchFilters,
  MEANING_MARKER_GROUPS,
  MEANING_MARKER_KEYS,
  createEmptyMarkerFilterState,
  type MeaningMarkerKey,
} from '@/lib/definitions';
import { useDebounce } from '@/hooks/useDebounce';
import { LocalSearchFilters } from '@/lib/search-utils';

interface SearchBarProps {
  placeholder?: string;
  className?: string;
  initialValue?: string;
  initialFilters?: Partial<SearchFilters>;
  searchPath?: string; // Custom search route, defaults to /buscar
  initialAdvancedOpen?: boolean; // Whether advanced filters start expanded
  onSearch?: (state: { query: string; filters: InternalFilters }) => void | Promise<void>;
  onStateChange?: (state: { query: string; filters: InternalFilters }) => void;
  onClearAll?: () => void;
  additionalFilters?: AdditionalFiltersConfig;
  editorMode?: boolean;
}

type InternalFilters = LocalSearchFilters;

type FilterVariant = 'category' | 'style' | 'origin' | 'letter' | 'marker';

interface AdditionalFiltersConfig {
  hasActive: boolean;
  onClear?: () => void;
  render: () => ReactNode;
}

const LETTER_OPTIONS = 'abcdefghijklmnñopqrstuvwxyz'.split('').map((letter) => ({
  value: letter,
  label: letter.toUpperCase(),
}));

const createEmptyFilters = (): InternalFilters => ({
  categories: [],
  origins: [],
  letters: [],
  ...createEmptyMarkerFilterState(),
});

const cloneMarkerValues = (
  markers?: Partial<Record<MeaningMarkerKey, string[]>>
): Record<MeaningMarkerKey, string[]> => {
  const base = createEmptyMarkerFilterState();
  for (const key of MEANING_MARKER_KEYS) {
    const values = markers?.[key];
    base[key] = values ? [...values] : [];
  }
  return base;
};

function arraysEqual(current: string[], next: string[]): boolean {
  if (current === next) return true;
  if (current.length !== next.length) return false;
  for (let index = 0; index < current.length; index += 1) {
    if (current[index] !== next[index]) return false;
  }
  return true;
}

function filtersEqual(a: InternalFilters, b: InternalFilters): boolean {
  if (!arraysEqual(a.categories, b.categories)) return false;
  if (!arraysEqual(a.origins, b.origins)) return false;
  if (!arraysEqual(a.letters, b.letters)) return false;

  return MEANING_MARKER_KEYS.every((key) => arraysEqual(a[key], b[key]));
}

export default function SearchBar({
  placeholder = 'Buscar palabra...',
  className = '',
  initialValue = '',
  initialFilters,
  searchPath: customSearchPath,
  initialAdvancedOpen = false,
  onSearch,
  onStateChange,
  onClearAll,
  additionalFilters,
  editorMode = false,
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const editorBasePath = editorMode && pathname.startsWith('/editor') ? '/editor' : '';
  const isInitialMountRef = useRef(true);
  const isSyncingFromPropsRef = useRef(false);

  const buildInitialFilters = useCallback(() => {
    const base = createEmptyFilters();
    base.categories = initialFilters?.categories ? [...initialFilters.categories] : [];
    base.origins = initialFilters?.origins ? [...initialFilters.origins] : [];
    base.letters = initialFilters?.letters ? [...initialFilters.letters] : [];

    for (const key of MEANING_MARKER_KEYS) {
      const values = initialFilters?.[key];
      base[key] = values ? [...values] : [];
    }

    return base;
  }, [initialFilters]);

  const [query, setQuery] = useState(initialValue);
  const [filters, setFilters] = useState<InternalFilters>(buildInitialFilters);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableMarkers, setAvailableMarkers] = useState<Record<MeaningMarkerKey, string[]>>(
    createEmptyMarkerFilterState()
  );
  const [availableOrigins, setAvailableOrigins] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(initialAdvancedOpen);
  const [metadataLoaded, setMetadataLoaded] = useState(false);

  const defaultSearchPath = editorBasePath ? `${editorBasePath}/buscar` : '/buscar';
  const searchPath = customSearchPath ?? defaultSearchPath;

  const baseHasActiveFilters = useMemo(
    () =>
      filters.categories.length > 0 ||
      filters.origins.length > 0 ||
      filters.letters.length > 0 ||
      MEANING_MARKER_KEYS.some((key) => filters[key].length > 0),
    [filters]
  );

  const extraFiltersActive = Boolean(additionalFilters?.hasActive);
  const hasActiveFilters = baseHasActiveFilters || extraFiltersActive;

  // Debounce query and filters for onStateChange to prevent loops
  const debouncedQuery = useDebounce(query, 300);
  const debouncedFilters = useDebounce(filters, 300);

  // Track if we're currently typing to prevent external updates
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only update from props if user is not actively typing
    if (!isTypingRef.current) {
      setQuery(initialValue);
    }
  }, [initialValue]);

  useEffect(() => {
    // Skip on initial mount as state is already initialized
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
      return;
    }

    const nextFilters = buildInitialFilters();

    const shouldAutoOpen =
      nextFilters.categories.length > 0 ||
      nextFilters.origins.length > 0 ||
      nextFilters.letters.length > 0 ||
      MEANING_MARKER_KEYS.some((key) => nextFilters[key].length > 0);

    // Only update if filters actually changed (not just array references)
    if (!filtersEqual(filters, nextFilters)) {
      isSyncingFromPropsRef.current = true;
      setFilters(nextFilters);
    }

    if (shouldAutoOpen) {
      setAdvancedOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildInitialFilters]);

  useEffect(() => {
    if (extraFiltersActive) {
      setAdvancedOpen(true);
    }
  }, [extraFiltersActive]);

  useEffect(() => {
    let isMounted = true;

    const loadMetadata = async () => {
      try {
        const metadata = await getSearchMetadata();

        if (!isMounted) return;

        setAvailableCategories(metadata.categories);
        setAvailableMarkers(cloneMarkerValues(metadata.markers));
        setAvailableOrigins(metadata.origins);
        setMetadataLoaded(true);
      } catch {
        if (isMounted) {
          setMetadataLoaded(true);
        }
      }
    };

    loadMetadata();

    return () => {
      isMounted = false;
    };
  }, []);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const categoryOptions = useMemo(
    () =>
      availableCategories.map((category) => ({
        value: category,
        label: GRAMMATICAL_CATEGORIES[category] || category,
      })),
    [availableCategories]
  );

  const markerOptions = useMemo(() => {
    return MEANING_MARKER_KEYS.reduce(
      (acc, key) => {
        const labelsMap = MEANING_MARKER_GROUPS[key].labels;
        const codes = new Set<string>([...Object.keys(labelsMap), ...availableMarkers[key]]);
        acc[key] = Array.from(codes)
          .map((code) => ({ value: code, label: labelsMap[code] || code }))
          .sort((a, b) => a.label.localeCompare(b.label, 'es'));
        return acc;
      },
      {} as Record<MeaningMarkerKey, { value: string; label: string }[]>
    );
  }, [availableMarkers]);

  const originOptions = useMemo(
    () => availableOrigins.map((origin) => ({ value: origin, label: origin })),
    [availableOrigins]
  );

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmedQuery = query.trim();

      if (!trimmedQuery && !hasActiveFilters) {
        return;
      }

      if (onSearch) {
        await onSearch({ query: trimmedQuery, filters });
        return;
      }

      const params = new URLSearchParams();
      if (trimmedQuery) params.set('q', trimmedQuery);
      if (filters.categories.length) params.set('categories', filters.categories.join(','));
      if (filters.origins.length) params.set('origins', filters.origins.join(','));
      if (filters.letters.length) params.set('letters', filters.letters.join(','));
      MEANING_MARKER_KEYS.forEach((key) => {
        if (filters[key].length) {
          params.set(key, filters[key].join(','));
        }
      });

      const queryString = params.toString();
      router.push(`${searchPath}${queryString ? `?${queryString}` : ''}`);
    },
    [filters, hasActiveFilters, onSearch, query, router, searchPath]
  );

  const updateFilters = useCallback(<K extends keyof InternalFilters>(key: K, values: string[]) => {
    setFilters((prev) => ({ ...prev, [key]: values }));
  }, []);

  const clearFilters = useCallback(() => {
    setQuery('');
    setFilters(createEmptyFilters());
    additionalFilters?.onClear?.();
    onClearAll?.();
  }, [additionalFilters, onClearAll]);

  const removeFilterValue = useCallback((key: keyof InternalFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].filter((item: string) => item !== value),
    }));
  }, []);

  const renderFilterPills = () => {
    const pills: Array<{
      key: keyof InternalFilters;
      value: string;
      label: string;
      variant: FilterVariant;
    }> = [];

    filters.categories.forEach((category: string) => {
      pills.push({
        key: 'categories',
        value: category,
        label: GRAMMATICAL_CATEGORIES[category] || category,
        variant: 'category',
      });
    });

    MEANING_MARKER_KEYS.forEach((key) => {
      filters[key].forEach((value: string) => {
        const config = MEANING_MARKER_GROUPS[key];
        pills.push({
          key,
          value,
          label: config.labels[value] || value,
          variant: 'marker',
        });
      });
    });

    filters.origins.forEach((origin) => {
      pills.push({
        key: 'origins',
        value: origin,
        label: origin,
        variant: 'origin',
      });
    });

    filters.letters.forEach((letter) => {
      pills.push({
        key: 'letters',
        value: letter,
        label: letter.toUpperCase(),
        variant: 'letter',
      });
    });

    if (pills.length === 0) {
      return null;
    }

    return (
      <div className="mt-4 flex flex-wrap gap-2">
        {pills.map((pill) => (
          <Button
            key={`${pill.key}-${pill.value}`}
            type="button"
            onClick={() => removeFilterValue(pill.key, pill.value)}
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-medium ${pill.variant === 'category'
                ? 'border-blue-300 bg-blue-100 text-blue-800'
                : pill.variant === 'style' || pill.variant === 'marker'
                  ? 'border-green-300 bg-green-100 text-green-800'
                  : pill.variant === 'origin'
                    ? 'border-purple-300 bg-purple-100 text-purple-800'
                    : pill.variant === 'letter'
                      ? 'border-orange-300 bg-orange-100 text-orange-800'
                      : 'border-gray-300 bg-gray-100 text-gray-800'
              } `}
          >
            <span>{pill.label}</span>
            <CloseIcon className="h-3 w-3" />
          </Button>
        ))}
      </div>
    );
  };

  // Use debounced values for onStateChange to prevent rapid updates
  useEffect(() => {
    if (!onStateChange) {
      return;
    }

    // Don't call onStateChange when we're syncing from props to avoid circular updates
    if (isSyncingFromPropsRef.current) {
      isSyncingFromPropsRef.current = false;
      return;
    }

    onStateChange({ query: debouncedQuery, filters: debouncedFilters });
  }, [debouncedFilters, debouncedQuery, onStateChange]);

  const additionalFiltersContent = additionalFilters?.render?.();

  return (
    <form onSubmit={handleSubmit} className={`w-full ${className}`}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            // Mark that user is typing
            isTypingRef.current = true;
            // Clear existing timeout
            if (typingTimeoutRef.current) {
              clearTimeout(typingTimeoutRef.current);
            }
            // Reset typing flag after 500ms of inactivity
            typingTimeoutRef.current = setTimeout(() => {
              isTypingRef.current = false;
            }, 500);
          }}
          placeholder={placeholder}
          className="focus:border-duech-blue w-full rounded-xl border-2 border-gray-300 bg-white px-6 py-4 pr-28 text-lg text-gray-900 shadow-lg transition-all duration-200 focus:ring-4 focus:ring-blue-200 focus:outline-none"
        />
        <div className="absolute inset-y-0 right-3 flex items-center gap-2">
          <Button
            type="button"
            onClick={() => setAdvancedOpen((prev) => !prev)}
            aria-label={advancedOpen ? 'Ocultar opciones avanzadas' : 'Mostrar opciones avanzadas'}
            className="hover:text-duech-blue bg-gray-100 p-3 text-gray-600 hover:bg-blue-50"
          >
            <SettingsIcon className="h-6 w-6" />
          </Button>

          <Button
            type="submit"
            aria-label="Buscar"
            className="hover:text-duech-blue bg-gray-100 p-3 text-gray-600 hover:bg-blue-50"
          >
            <SearchIcon className="h-6 w-6" />
          </Button>
        </div>
      </div>

      {advancedOpen && (
        <div className="border-duech-blue/20 mt-4 rounded-xl border bg-white p-6 shadow-sm">
          {!metadataLoaded ? (
            <div className="h-24 animate-pulse rounded bg-gray-100" />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:grid-rows-5">
                <MultiSelectDropdown
                  label="Letras"
                  options={LETTER_OPTIONS}
                  selectedValues={filters.letters}
                  onChange={(values) => updateFilters('letters', values)}
                  placeholder="Seleccionar letras"
                />

                <MultiSelectDropdown
                  label="Orígenes"
                  options={originOptions}
                  selectedValues={filters.origins}
                  onChange={(values) => updateFilters('origins', values)}
                  placeholder="Seleccionar orígenes"
                />

                <MultiSelectDropdown
                  label="Categorías gramaticales"
                  options={categoryOptions}
                  selectedValues={filters.categories}
                  onChange={(values) => updateFilters('categories', values)}
                  placeholder="Seleccionar categorías"
                />

                {MEANING_MARKER_KEYS.map((key) => (
                  <MultiSelectDropdown
                    key={key}
                    label={MEANING_MARKER_GROUPS[key].label}
                    options={markerOptions[key]}
                    selectedValues={filters[key]}
                    onChange={(values) => updateFilters(key, values)}
                    placeholder={`Seleccionar ${MEANING_MARKER_GROUPS[key].label.toLowerCase()}`}
                  />
                ))}
              </div>

              {additionalFiltersContent && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {additionalFiltersContent}
                </div>
              )}
            </div>
          )}

          {renderFilterPills()}

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
              className="border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Limpiar filtros
            </Button>

            <Button
              type="submit"
              className="bg-duech-blue px-5 py-2 text-sm font-semibold text-white shadow hover:bg-blue-900"
            >
              Buscar con filtros
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
