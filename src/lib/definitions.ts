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

export type MeaningMarkerKey =
  | 'socialValuations'
  | 'socialStratumMarkers'
  | 'styleMarkers'
  | 'intentionalityMarkers'
  | 'geographicalMarkers'
  | 'chronologicalMarkers'
  | 'frequencyMarkers';

export type MeaningMarkerValues = Partial<Record<MeaningMarkerKey, string[] | null>>;

export interface Meaning extends MeaningMarkerValues {
  id?: number;
  wordId?: number;
  number: number;
  origin?: string | null;
  meaning: string;
  observation?: string | null;
  remission?: string | null;
  categories: string[] | null;
  examples: Example[] | null; // JSONB field
  variant?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Word {
  lemma: string;
  root: string;
  values: Meaning[];
}

/**
 * Advanced search with filters
 */
export interface SearchResult {
  word: Word;
  letter: string;
  matchType: 'exact' | 'partial' | 'filter';
  status?: string;
  assignedTo: number | null;
  createdBy?: number | null;
}

export type MarkerFilterState = Partial<Record<MeaningMarkerKey, string[]>>;

export type SearchFilters = {
  query?: string;
  categories?: string[];
  origins?: string[];
  letters?: string[];
} & MarkerFilterState;

export type MarkerMetadata = Record<MeaningMarkerKey, string[]>;

export interface SearchMetadata {
  categories: string[];
  origins: string[];
  markers: MarkerMetadata;
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

export const GRAMMATICAL_CATEGORIES: Record<string, string> = {
  adj: 'Adjetivo',
  'adj/adv': 'Adjetivo/Adverbio',
  'adj/sust': 'Adjetivo/Sustantivo',
  adv: 'Adverbio',
  fórm: 'Fórmula',
  interj: 'Interjección',
  'loc. sust/adj': 'Locución sustantiva/adjetiva',
  'loc. adj': 'Locución adjetiva',
  'loc. adj/adv': 'Locución adjetiva/adverbial',
  'loc. adj/sust': 'Locución adjetiva/sustantiva',
  'loc. adv/adj': 'Locución adverbial/adjetiva',
  'loc. adv': 'Locución adverbial',
  'loc. interj': 'Locución interjectiva',
  'loc. sust': 'Locución sustantiva',
  'loc. verb': 'Locución verbal',
  impers: 'Impersonal',
  'marc. disc': 'Marcador discursivo',
  sust: 'Sustantivo/Adjetivo',
  f: 'Sustantivo femenino',
  m: 'Sustantivo masculino',
  'm o f': 'Sustantivo masculino o femenino',
  'm-f': 'Sustantivo masculino-femenino',
  'm y f': 'Sustantivo masculino y femenino',
  'm. pl': 'Sustantivo masculino plural',
  'f. pl': 'Sustantivo femenino plural',
  intr: 'Verbo intransitivo',
  tr: 'Verbo transitivo',
};

export const SOCIAL_VALUATIONS: Record<string, string> = {
  vulgar: 'Vulgar',
  euf: 'Eufemismo',
};

export const GEOGRAPHICAL_MARKERS: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  sur: 'Sur',
  austral: 'Zona Austral',
};

export const SOCIAL_STRATUM_MARKERS: Record<string, string> = {
  pop: 'Popular',
  cult: 'Culto',
};

export const STYLE_MARKERS: Record<string, string> = {
  espon: 'Espontáneo',
  esm: 'Esmerado',
};

export const INTENTIONALITY_MARKERS: Record<string, string> = {
  fest: 'Festivo',
  desp: 'Despectivo',
  afect: 'Afectivo',
};

export const CRONOLOGICAL_MARKERS: Record<string, string> = {
  hist: 'Histórico',
  obsol: 'Obsolescente',
};

export const FREQUENCY_MARKERS: Record<string, string> = {
  'p. us': 'Poco usado',
};

export const MEANING_MARKER_GROUPS: Record<
  MeaningMarkerKey,
  {
    label: string;
    addLabel: string;
    labels: Record<string, string>;
  }
> = {
  socialValuations: {
    label: 'Valoración social',
    addLabel: '+ Añadir valoración social',
    labels: SOCIAL_VALUATIONS,
  },
  socialStratumMarkers: {
    label: 'Marca de estrato social',
    addLabel: '+ Añadir marca de estrato social',
    labels: SOCIAL_STRATUM_MARKERS,
  },
  styleMarkers: {
    label: 'Marca de estilo',
    addLabel: '+ Añadir marca de estilo',
    labels: STYLE_MARKERS,
  },
  intentionalityMarkers: {
    label: 'Marca de intencionalidad',
    addLabel: '+ Añadir marca de intencionalidad',
    labels: INTENTIONALITY_MARKERS,
  },
  geographicalMarkers: {
    label: 'Marca geográfica',
    addLabel: '+ Añadir marca geográfica',
    labels: GEOGRAPHICAL_MARKERS,
  },
  chronologicalMarkers: {
    label: 'Marca cronológica',
    addLabel: '+ Añadir marca cronológica',
    labels: CRONOLOGICAL_MARKERS,
  },
  frequencyMarkers: {
    label: 'Marca de frecuencia',
    addLabel: '+ Añadir marca de frecuencia',
    labels: FREQUENCY_MARKERS,
  },
};

export const MEANING_MARKER_KEYS = Object.keys(MEANING_MARKER_GROUPS) as MeaningMarkerKey[];

export function createEmptyMarkerFilterState(): Record<MeaningMarkerKey, string[]> {
  return MEANING_MARKER_KEYS.reduce(
    (acc, key) => {
      acc[key] = [];
      return acc;
    },
    {} as Record<MeaningMarkerKey, string[]>
  );
}

export const ORIGINS: Record<string, string> = {
  africano: 'Africano',
  aimara: 'Aymara',
  'aimara y quechua': 'Aymara y quechua',
  alemán: 'Alemán',
  'alemán, con influencia del inglés': 'Alemán, con influencia del inglés',
  arahuaco: 'Arawaco',
  croata: 'Croata',
  francés: 'Francés',
  'indígena antillano o mexicano': 'Indígena antillano o mexicano',
  inglés: 'Inglés',
  italiano: 'Italiano',
  kawesqar: 'Kawésqar',
  mapuche: 'Mapuche',
  maya: 'Maya',
  nahua: 'Náhuatl',
  polinésico: 'Polinésico',
  portugués: 'Portugués',
  quechua: 'Quechua',
  'quechua o aimara': 'Quechua o aymara',
  'rapa nui': 'Rapa Nui',
  romané: 'Romané',
  selknam: "Selk'nam",
  taíno: 'Taíno',
};

function sortKeysByLabel(source: Record<string, string>): string[] {
  return Object.entries(source)
    .sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, 'es'))
    .map(([key]) => key);
}

export const PREDEFINED_GRAMMATICAL_CATEGORY_FILTERS = sortKeysByLabel(GRAMMATICAL_CATEGORIES);

export const PREDEFINED_ORIGIN_FILTERS = sortKeysByLabel(ORIGINS);

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
