/**
 * Type definitions for the Chilean Spanish Dictionary (DUECh)
 */

/**
 * Data structures
 */

export interface Example {
  value: string;
  author?: string;
  title?: string;
  source?: string;
  date?: string;
  page?: string;
}

export interface WordNote {
  id: number;
  note: string;
  createdAt: string;
  user?: { id?: number; username?: string } | null;
}

export interface DBWord {
  id: number;
  lemma: string;
  root: string | null;
  letter: string;
  variant?: string | null;
  status: string; // Drizzle returns string, not literal union
  createdBy?: number | null;
  assignedTo?: number | null;
  createdAt: Date;
  updatedAt: Date;
  meanings?: Meaning[]; // When joined with meanings
}

export interface Meaning {
  id: number;
  wordId: number;
  number: number;
  origin?: string | null;
  meaning: string;
  observation?: string | null;
  remission?: string | null;
  categories: string[] | null;
  styles: string[] | null;
  examples: Example[] | null; // JSONB field
  createdAt: Date;
  updatedAt: Date;
}

// Legacy types for backward compatibility (will be deprecated)
export interface WordDefinition {
  number: number;
  origin: string | null;
  categories: string[];
  remission: string | null;
  meaning: string;
  styles: string[] | null;
  observation: string | null;
  example: Example | Example[];
  variant: string | null;
}

export interface Word {
  lemma: string;
  root: string;
  values: WordDefinition[];
}

/**
 * Advanced search with filters
 */
export interface SearchResult {
  word: Word;
  letter: string;
  matchType: 'exact' | 'partial' | 'filter';
  status?: string;
  createdBy?: number;
}

export interface SearchFilters {
  query?: string;
  categories?: string[];
  styles?: string[];
  origins?: string[];
  letters?: string[];
}

export interface SearchMetadata {
  categories: string[];
  styles: string[];
  origins: string[];
}

export interface SearchResponse {
  results: SearchResult[];
  metadata: SearchMetadata;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// Categories mapping for advanced search
export const GRAMMATICAL_CATEGORIES: Record<string, string> = {
  // Adjetivo
  adj: 'Adjetivo',

  // Adjetivo/Adverbio
  'adj/adv': 'Adjetivo/Adverbio',

  // Adjetivo/Sustantivo
  'adj/sust': 'Adjetivo/Sustantivo',

  // Adverbio
  adv: 'Adverbio',

  // Fórmula
  fórm: 'Fórmula',

  // Interjección
  interj: 'Interjección',

  // Locución
  loc: 'Locución',

  // Locución sustantiva/adjetiva
  'loc sust/adj': 'Locución sustantiva/adjetiva',

  // Locución adjetiva
  'loc adj': 'Locución adjetiva',

  // Locución adjetiva/adverbial
  'loc adj/adv': 'Locución adjetiva/adverbial',

  // Locución adjetiva/sustantiva
  'loc adj/sust': 'Locución adjetiva/sustantiva',

  // Locución adverbial
  'loc adv': 'Locución adverbial',

  // Locución interjectiva
  'loc interj': 'Locución interjectiva',

  // Locución sustantiva
  'loc sust': 'Locución sustantiva',

  // Marcador discursivo
  marc: 'Marcador discursivo',
  disc: 'Marcador discursivo',

  // Sustantivo/Adjetivo
  sust: 'Sustantivo/Adjetivo',

  // Sustantivo femenino
  f: 'Sustantivo femenino',

  // Sustantivo masculino
  m: 'Sustantivo masculino',

  // Sustantivo masculino o femenino
  'm o f': 'Sustantivo masculino o femenino',

  // Sustantivo masculino-femenino
  'm-f': 'Sustantivo masculino-femenino',

  // Sustantivo masculino y femenino
  'm y f': 'Sustantivo masculino y femenino',

  // Sustantivo masculino plural
  'm pl': 'Sustantivo masculino plural',

  // Sustantivo femenino plural
  'f pl': 'Sustantivo femenino plural',

  // Verbo intransitivo
  intr: 'Verbo intransitivo',

  // Verbo transitivo
  tr: 'Verbo transitivo',
};

// Style mappings
export const USAGE_STYLES: Record<string, string> = {
  espon: 'Espontáneo',
  fest: 'Festivo',
  vulgar: 'Vulgar',
  hist: 'Histórico',
  esm: 'Esmerado',
  'p. us.': 'Poco usado',
  p: 'Poco usado',
  us: 'Usado',
};

// Word states (for editorial workflow)
export const STATUS_OPTIONS = [
  { value: 'imported', label: 'Importado' },
  { value: 'included', label: 'Incorporado' },
  { value: 'preredacted', label: 'Prerredactada' },
  { value: 'redacted', label: 'Redactado' },
  { value: 'reviewed', label: 'Revisado por comisión' },
  { value: 'published', label: 'Publicado' },
  { value: 'archaic', label: 'Arcaico' },
  { value: 'quarantined', label: 'Cuarentena' },
];
