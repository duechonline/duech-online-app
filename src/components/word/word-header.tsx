'use client';

import React from 'react';
import { useMemo } from 'react';
import Link from 'next/link';
import InlineEditable from '@/components/word/inline-editable';
import { SelectDropdown } from '@/components/common/dropdown';
import { InformationCircleIcon } from '@/components/icons';
import WordWarning from '@/components/word/word-warning';
import type { Meaning } from '@/lib/definitions';
import { useUserRole } from '@/hooks/useUserRole';
import { getLexicographerByRole } from '@/lib/search-utils';
import { getStatusByRole } from '@/lib/search-utils';
interface WordHeaderProps {
  lemma: string;
  onLemmaChange: (value: string | null) => void;
  editorMode: boolean;
  canActuallyEdit: boolean;
  canAsigned: boolean;
  canChangeStatus?: boolean;
  // Lemma field
  editingLemma: boolean;
  onStartEditLemma: () => void;
  onCancelEditLemma: () => void;
  // Root field
  root: string;
  onRootChange: (value: string | null) => void;
  editingRoot: boolean;
  onStartEditRoot: () => void;
  onCancelEditRoot: () => void;
  // Editor controls
  letter: string;
  onLetterChange: (value: string) => void;
  letterOptions: Array<{ value: string; label: string }>;
  assignedTo: number | null;
  onAssignedToChange: (value: number | null) => void;
  users: Array<{ id: number; username: string; role: string }>;
  status: string;
  onStatusChange: (value: string) => void;
  statusOptions: Array<{ value: string; label: string }>;
  searchPath: string;
  searchLabel: string;
  definitions?: Meaning[];
}

export function WordHeader({
  lemma,
  onLemmaChange,
  editorMode,
  canActuallyEdit,
  canAsigned,
  canChangeStatus,
  editingLemma,
  onStartEditLemma,
  onCancelEditLemma,
  root,
  onRootChange,
  editingRoot,
  onStartEditRoot,
  onCancelEditRoot,
  letter,
  onLetterChange,
  letterOptions,
  assignedTo,
  onAssignedToChange,
  users,
  status,
  onStatusChange,
  statusOptions,
  searchPath,
  searchLabel,
  definitions,
}: WordHeaderProps) {
  const { isAdmin, isCoordinator, isLexicographer, username } = useUserRole(true);

  const userOptions = useMemo(
    () => getLexicographerByRole(users, username, isAdmin, isCoordinator, isLexicographer),
    [users, username, isAdmin, isCoordinator, isLexicographer] // ← all dependencies
  );
  const statusFilters = useMemo(
    () => getStatusByRole(statusOptions, isAdmin, isCoordinator, isLexicographer),
    [statusOptions, isAdmin, isCoordinator, isLexicographer]
  );

  return (
    <>
      {/* Breadcrumb Navigation */}
      <nav className="mb-6">
        <ol className="flex items-center space-x-2 text-sm">
          <li>
            <Link href={searchPath} className="text-blue-600 hover:text-blue-800">
              {searchLabel}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600">{lemma}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-duech-blue text-5xl font-bold">
            <InlineEditable
              value={lemma}
              onChange={onLemmaChange}
              editorMode={canActuallyEdit}
              editing={editingLemma}
              onStart={onStartEditLemma}
              onCancel={onCancelEditLemma}
              saveStrategy="manual"
              placeholder="(lema)"
            />
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-lg text-gray-700">Palabra base:</span>
            <span className="text-duech-blue font-semibold">
              <InlineEditable
                value={root}
                onChange={onRootChange}
                editorMode={canActuallyEdit}
                editing={editingRoot}
                onStart={onStartEditRoot}
                onCancel={onCancelEditRoot}
                saveStrategy="manual"
                placeholder="Palabra base"
                addLabel="+ Añadir palabra base"
              />
            </span>
          </div>
        </div>

        {/* Editor controls */}
        {editorMode && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="w-24">
              <SelectDropdown
                label="Letra"
                options={letterOptions}
                selectedValue={letter}
                onChange={(value) => onLetterChange(value.toLowerCase())}
                placeholder="Letra"
                disabled={!canActuallyEdit}
              />
            </div>

            <div className="w-36">
              <SelectDropdown
                label="Asignado a"
                options={userOptions}
                selectedValue={assignedTo?.toString() ?? ''}
                onChange={(value) => onAssignedToChange(value ? Number(value) : null)}
                placeholder="Sin asignar"
                disabled={!(canAsigned || canActuallyEdit)}
              />
            </div>

            <div className="w-32">
              <SelectDropdown
                label="Estado"
                options={statusFilters}
                selectedValue={status}
                onChange={onStatusChange}
                placeholder="Seleccionar estado"
                disabled={!canActuallyEdit && !canChangeStatus}
              />
            </div>
          </div>
        )}
      </div>
      {editorMode && canActuallyEdit && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <InformationCircleIcon className="h-20 w-20 flex-shrink-0 text-blue-600" />
            <div className="text-sm text-gray-700">
              <p className="mb-2 font-semibold text-blue-900">
                Para empezar a editar, basta con hacer clic en el ícono de lápiz.
              </p>
              <p className="mb-2 font-semibold text-blue-900">Formato de texto con Markdown:</p>
              <ul className="space-y-1">
                <li>
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">*cursiva*</code> para{' '}
                  <em>cursiva</em>
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">**negrita**</code>{' '}
                  para <strong>negrita</strong>
                </li>
                <li>
                  <code className="rounded bg-blue-100 px-1.5 py-0.5 text-xs">***ambos***</code>{' '}
                  para{' '}
                  <strong>
                    <em>negrita y cursiva</em>
                  </strong>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warnings summary below the info box */}
      {editorMode && canActuallyEdit && definitions && definitions.length > 0 && (
        <WordWarning definitions={definitions} className="mb-6" />
      )}
    </>
  );
}
