/**
 * Utility functions for search functionality
 */

import { MEANING_MARKER_KEYS, type MeaningMarkerKey } from '@/lib/definitions';

/**
 * Parse a comma-separated string parameter into an array
 */
export function parseListParam(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/**
 * Check if two arrays are equal (same length and same values in order)
 */
export function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

/**
 * Local type for filters with required arrays (used in search-page component)
 */
export type LocalSearchFilters = {
  categories: string[];
  origins: string[];
  letters: string[];
} & Record<MeaningMarkerKey, string[]>;

/**
 * Check if search filters have changed by comparing each filter array
 */
export function filtersChanged(
  prevFilters: LocalSearchFilters,
  newFilters: LocalSearchFilters
): boolean {
  if (arraysDifferent(prevFilters.categories, newFilters.categories)) return true;
  if (arraysDifferent(prevFilters.origins, newFilters.origins)) return true;
  if (arraysDifferent(prevFilters.letters, newFilters.letters)) return true;

  for (const key of MEANING_MARKER_KEYS) {
    if (arraysDifferent(prevFilters[key], newFilters[key])) return true;
  }

  return false;
}

function arraysDifferent(a: string[], b: string[]) {
  return a.length !== b.length || a.some((value, index) => value !== b[index]);
}

/**
 * Create a deep copy of search filters
 */
export function cloneFilters(filters: LocalSearchFilters): LocalSearchFilters {
  const cloned = {
    categories: [...filters.categories],
    origins: [...filters.origins],
    letters: [...filters.letters],
  } as LocalSearchFilters;

  for (const key of MEANING_MARKER_KEYS) {
    cloned[key] = [...filters[key]];
  }

  return cloned;
}

/**
 * User type for search functionality
 */
export interface User {
  id: number;
  username: string;
  email?: string | null;
  role: string;
}
function mapUsersToOptions(users: User[]) {
  return users.map((user) => ({
    value: user.id.toString(),
    label: user.username,
  }));
}

function filterLexicographersAndCoordinators(users: User[]) {
  return users.filter((user) => user.role === 'lexicographer' || user.role === 'coordinator');
}

/**
 * Get lexicographer options for dropdowns
 */
export function getLexicographerOptions(users: User[]) {
  return mapUsersToOptions(filterLexicographersAndCoordinators(users));
}

export function getLexicographerByRole(
  users: User[],
  currentUsername: string,
  isAdmin: boolean,
  isCoordinator: boolean,
  isLexicographer: boolean
) {
  if (isAdmin || isCoordinator) {
    return mapUsersToOptions(filterLexicographersAndCoordinators(users));
  }

  if (isLexicographer) {
    const filteredUsers = users.filter((user) => user.username === currentUsername);
    return mapUsersToOptions(filteredUsers);
  }

  return [];
}
export function getStatusByRole(
  statusOptions: { value: string; label: string }[],
  isAdmin: boolean,
  isCoordinator: boolean,
  isLexicographer: boolean
) {
  if (isAdmin) {
    return statusOptions.filter((status) => status.value !== 'imported');
  }

  if (isCoordinator) {
    return statusOptions.filter(
      (status) => status.value === 'reviewed' || status.value === 'preredacted'
    );
  }

  if (isLexicographer) {
    return statusOptions.filter(
      (status) => status.value === 'redacted' || status.value === 'preredacted'
    );
  }

  return [];
}
