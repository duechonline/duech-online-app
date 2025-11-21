'use client';

import React, { useMemo } from 'react';
import type { Meaning, Example } from '@/lib/definitions';
import { ChipList } from '@/components/common/chip';
import { ExclamationCircleIcon } from '@/components/icons';

type DefinitionField =
  | 'origin'
  | 'categories'
  | 'remission'
  | 'meaning'
  | 'observation'
  | 'examples'
  | 'variant';

interface WordWarningProps {
  definitions: Meaning | Meaning[];
  requiredFields?: DefinitionField[];
  className?: string;
}

const LABELS: Record<DefinitionField, string> = {
  origin: 'Origen vacío',
  categories: 'Categorías sin seleccionar',
  remission: 'Remisión vacía',
  meaning: 'Significado vacío',
  observation: 'Observación vacía',
  examples: 'Ejemplo(s) faltante(s)',
  variant: 'Variante vacía',
};

function isEmptyValue(val: unknown): boolean {
  if (val == null) return true;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function isExampleMissing(examples: Example[] | undefined | null): boolean {
  if (!examples) return true;
  return examples.length === 0 || examples.every((e) => (e?.value ?? '').trim().length === 0);
}

function collectMissing(def: Meaning, fields: DefinitionField[]): DefinitionField[] {
  const missing: DefinitionField[] = [];

  for (const f of fields) {
    switch (f) {
      case 'origin':
        if (isEmptyValue(def.origin)) missing.push(f);
        break;
      case 'categories':
        if (isEmptyValue(def.categories)) missing.push(f);
        break;
      case 'remission':
        if (isEmptyValue(def.remission)) missing.push(f);
        break;
      case 'meaning':
        if (isEmptyValue(def.meaning)) missing.push(f);
        break;
      case 'observation':
        if (isEmptyValue(def.observation)) missing.push(f);
        break;
      case 'examples':
        if (isExampleMissing(def.examples)) missing.push(f);
        break;
      case 'variant':
        if (isEmptyValue(def.variant)) missing.push(f);
        break;
    }
  }
  return missing;
}

export default function WordWarning({
  definitions,
  requiredFields = [
    'origin',
    'categories',
    'remission',
    'meaning',
    'observation',
    'examples',
    'variant',
  ],
  className,
}: WordWarningProps) {
  // Check if there are any definitions with missing fields
  const definitionsWithWarnings = useMemo(() => {
    const definitionList = Array.isArray(definitions) ? definitions : [definitions];
    return definitionList
      .map((def, idx) => ({
        definition: def,
        missing: collectMissing(def, requiredFields),
        index: idx,
      }))
      .filter((item) => item.missing.length > 0);
  }, [definitions, requiredFields]);

  if (definitionsWithWarnings.length === 0) return null;

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className ?? ''}`}>
      <div className="flex items-center gap-3">
        <ExclamationCircleIcon className="h-20 w-20 flex-shrink-0 text-amber-600" />
        <div className="flex-1">
          <p className="mb-3 font-semibold text-amber-900">Campos pendientes por definición:</p>
          <div className="space-y-3">
            {definitionsWithWarnings.map(({ definition: def, missing }) => (
              <div key={def.number} className="flex items-center gap-3">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-200 px-2 text-sm font-bold text-amber-900">
                  {def.number}
                </span>
                <ChipList items={missing} labels={LABELS} variant="warning" editorMode={false} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
