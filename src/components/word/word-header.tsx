/**
 * Word header component with metadata and editor controls.
 *
 * This component renders the top section of a word page, including:
 * - Breadcrumb navigation back to search
 * - Main lemma title with inline editing
 * - Root word display/editor
 * - Dictionary source indicator
 * - Editor control panel with dropdowns and action buttons
 * - Markdown formatting help box
 * - Field warnings for incomplete definitions
 *
 * The header adapts significantly between public view and editor modes,
 * showing only essential information to readers while providing full
 * control to editors.
 *
 * ## Permission Levels
 * - `canActuallyEdit`: Controls inline editing of lemma/root/dictionary
 * - `canAsigned`: Controls assignment dropdown access
 * - `canChangeStatus`: Controls status dropdown access
 *
 * @module components/word/word-header
 * @see {@link WordHeader} - The main exported component
 * @see {@link WordHeaderProps} - Props interface
 * @see {@link WordDisplay} - Parent component that uses this header
 */

'use client';

import React from 'react';
import { useMemo } from 'react';
import Link from 'next/link';
import InlineEditable from '@/components/word/inline-editable';
import { Dropdown } from '@/components/common/dropdown';
import { Button } from '@/components/common/button';
import { InformationCircleIcon, SpinnerIcon } from '@/components/icons';
import WordWarning from '@/components/word/word-warning';
import { DICCIONARIES, type Meaning } from '@/lib/definitions';
import { useUserRole } from '@/hooks/useUserRole';
import { getLexicographerAndAdminOptions } from '@/lib/search-utils';
import { getStatusByRole } from '@/lib/search-utils';

/**
 * Props for the WordHeader component.
 *
 * @interface WordHeaderProps
 */
export interface WordHeaderProps {
  /**
   * The word's lemma (headword/entry word).
   * @type {string}
   */
  lemma: string;

  /**
   * Callback when lemma is changed via inline editing.
   * @param {string | null} value - New lemma value or null to clear
   * @returns {void}
   */
  onLemmaChange: (value: string | null) => void;

  /**
   * Whether the component is in editor mode.
   * @type {boolean}
   */
  editorMode: boolean;

  /**
   * Whether the current user can actually edit this word.
   * Combines role checks with word status and assignment.
   * @type {boolean}
   */
  canActuallyEdit: boolean;

  /**
   * Whether the current user can assign this word to someone.
   * @type {boolean}
   */
  canAsigned: boolean;

  /**
   * Whether the current user can change the word's status.
   * @type {boolean}
   */
  canChangeStatus?: boolean;

  /**
   * Whether the lemma field is currently being edited.
   * @type {boolean}
   */
  editingLemma: boolean;

  /**
   * Callback to start editing the lemma.
   * @returns {void}
   */
  onStartEditLemma: () => void;

  /**
   * Callback to cancel lemma editing.
   * @returns {void}
   */
  onCancelEditLemma: () => void;

  /**
   * The word's root/base form.
   * @type {string}
   */
  root: string;

  /**
   * Callback when root word is changed.
   * @param {string | null} value - New root value or null to clear
   * @returns {void}
   */
  onRootChange: (value: string | null) => void;

  /**
   * Whether the root field is currently being edited.
   * @type {boolean}
   */
  editingRoot: boolean;

  /**
   * Callback to start editing the root.
   * @returns {void}
   */
  onStartEditRoot: () => void;

  /**
   * Callback to cancel root editing.
   * @returns {void}
   */
  onCancelEditRoot: () => void;

  /**
   * The dictionary source for this word.
   * @type {string | null}
   */
  dictionary: string | null;

  /**
   * Callback when dictionary source is changed.
   * @param {string | null} value - New dictionary value or null
   * @returns {void}
   */
  onDictionaryChange: (value: string | null) => void;

  /**
   * The letter this word is filed under (a-z).
   * @type {string}
   */
  letter: string;

  /**
   * Callback when letter is changed via dropdown.
   * @param {string} value - New letter value
   * @returns {void}
   */
  onLetterChange: (value: string) => void;

  /**
   * Available letter options for the dropdown.
   * @type {Array<{ value: string; label: string }>}
   */
  letterOptions: Array<{ value: string; label: string }>;

  /**
   * User ID of person assigned to this word, or null.
   * @type {number | null}
   */
  assignedTo: number | null;

  /**
   * Callback when assignment is changed.
   * @param {number | null} value - User ID or null for unassigned
   * @returns {void}
   */
  onAssignedToChange: (value: number | null) => void;

  /**
   * List of users available for assignment.
   * @type {Array<{ id: number; username: string; role: string }>}
   */
  users: Array<{ id: number; username: string; role: string }>;

  /**
   * Current word status (draft, preredacted, included, imported, redacted).
   * @type {string}
   */
  status: string;

  /**
   * Callback when status is changed via dropdown.
   * @param {string} value - New status value
   * @returns {void}
   */
  onStatusChange: (value: string) => void;

  /**
   * Available status options for the dropdown.
   * @type {Array<{ value: string; label: string }>}
   */
  statusOptions: Array<{ value: string; label: string }>;

  /**
   * Path for the search link in breadcrumb.
   * @type {string}
   */
  searchPath: string;

  /**
   * Label for the search link in breadcrumb.
   * @type {string}
   */
  searchLabel: string;

  /**
   * Array of definitions to check for warnings.
   * @type {Meaning[]}
   */
  definitions?: Meaning[];

  /**
   * Callback to trigger word deletion modal.
   * @returns {void}
   */
  onDeleteWord?: () => void;

  /**
   * Current user's role for permission checks.
   * @type {string}
   */
  userRole?: string;

  /**
   * Callback for manual save button.
   * @returns {void}
   */
  onManualSave?: () => void;

  /**
   * Whether current state is saved (no pending changes).
   * @type {boolean}
   */
  isSaved?: boolean;

  /**
   * Whether a save operation is in progress.
   * @type {boolean}
   */
  isSaving?: boolean;

  /**
   * Callback for preview button.
   * @returns {void}
   */
  onPreview?: () => void;
}

/**
 * Header section for word pages.
 *
 * Renders breadcrumb navigation, word title (lemma), root word,
 * and editor controls for managing word metadata. The component
 * significantly adapts its display based on the mode and permissions.
 *
 * ## Public View Mode
 * - Breadcrumb navigation to search
 * - Large lemma title
 * - Root word (only if different from lemma)
 * - Dictionary source label
 *
 * ## Editor Mode (with canActuallyEdit)
 * - InlineEditable lemma and root fields
 * - Dictionary dropdown selector
 * - Letter dropdown (a-z)
 * - User assignment dropdown (filtered by role)
 * - Status dropdown (filtered by user permissions)
 * - Preview button to open public view
 * - Save button with status indicator
 * - Delete button (admin only)
 * - Markdown formatting help box
 * - Field warnings for incomplete definitions
 *
 * @function WordHeader
 * @param {WordHeaderProps} props - Component props
 * @param {string} props.lemma - The word's headword
 * @param {Function} props.onLemmaChange - Lemma change callback
 * @param {boolean} props.editorMode - Whether in editor mode
 * @param {boolean} props.canActuallyEdit - Whether user can edit
 * @param {boolean} props.canAsigned - Whether user can assign
 * @param {boolean} [props.canChangeStatus] - Whether user can change status
 * @param {boolean} props.editingLemma - Whether lemma is being edited
 * @param {Function} props.onStartEditLemma - Start lemma editing
 * @param {Function} props.onCancelEditLemma - Cancel lemma editing
 * @param {string} props.root - The word's root form
 * @param {Function} props.onRootChange - Root change callback
 * @param {boolean} props.editingRoot - Whether root is being edited
 * @param {Function} props.onStartEditRoot - Start root editing
 * @param {Function} props.onCancelEditRoot - Cancel root editing
 * @param {string | null} props.dictionary - Dictionary source
 * @param {Function} props.onDictionaryChange - Dictionary change callback
 * @param {string} props.letter - Filing letter
 * @param {Function} props.onLetterChange - Letter change callback
 * @param {Array} props.letterOptions - Letter dropdown options
 * @param {number | null} props.assignedTo - Assigned user ID
 * @param {Function} props.onAssignedToChange - Assignment change callback
 * @param {Array} props.users - Users for assignment dropdown
 * @param {string} props.status - Word status
 * @param {Function} props.onStatusChange - Status change callback
 * @param {Array} props.statusOptions - Status dropdown options
 * @param {string} props.searchPath - Breadcrumb search link path
 * @param {string} props.searchLabel - Breadcrumb search link label
 * @param {Meaning[]} [props.definitions] - Definitions for warnings
 * @param {Function} [props.onDeleteWord] - Delete word callback
 * @param {string} [props.userRole] - Current user's role
 * @param {Function} [props.onManualSave] - Manual save callback
 * @param {boolean} [props.isSaved] - Whether state is saved
 * @param {boolean} [props.isSaving] - Whether save is in progress
 * @param {Function} [props.onPreview] - Preview callback
 * @returns {JSX.Element} The word header component
 *
 * @example
 * // Public view mode
 * <WordHeader
 *   lemma="chilenismo"
 *   editorMode={false}
 *   canActuallyEdit={false}
 *   canAsigned={false}
 *   // ... minimal props
 * />
 *
 * @example
 * // Full editor mode
 * <WordHeader
 *   lemma="chilenismo"
 *   onLemmaChange={setLemma}
 *   editorMode={true}
 *   canActuallyEdit={true}
 *   canAsigned={true}
 *   canChangeStatus={true}
 *   editingLemma={isEditingLemma}
 *   onStartEditLemma={() => setEditKey('lemma')}
 *   onCancelEditLemma={() => setEditKey(null)}
 *   root="chile"
 *   onRootChange={setRoot}
 *   editingRoot={isEditingRoot}
 *   onStartEditRoot={() => setEditKey('root')}
 *   onCancelEditRoot={() => setEditKey(null)}
 *   dictionary="DUECh"
 *   onDictionaryChange={setDictionary}
 *   letter="c"
 *   onLetterChange={setLetter}
 *   letterOptions={LETTER_OPTIONS}
 *   assignedTo={userId}
 *   onAssignedToChange={setAssignedTo}
 *   users={users}
 *   status="preredacted"
 *   onStatusChange={setStatus}
 *   statusOptions={STATUS_OPTIONS}
 *   searchPath="/editor/buscar"
 *   searchLabel="Buscar"
 *   definitions={word.values}
 *   onDeleteWord={handleDelete}
 *   userRole="admin"
 *   onManualSave={handleSave}
 *   isSaved={!isDirty}
 *   isSaving={saveStatus === 'saving'}
 *   onPreview={handlePreview}
 * />
 */
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
  dictionary,
  onDictionaryChange,
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
  onDeleteWord,
  userRole,
  onManualSave,
  isSaved,
  isSaving,
  onPreview,
}: WordHeaderProps) {
  const { isAdmin, isLexicographer, username } = useUserRole(true);

  const userOptions = useMemo(() => getLexicographerAndAdminOptions(users), [users]);
  const statusFilters = useMemo(
    () => getStatusByRole(statusOptions, isAdmin, isLexicographer),
    [statusOptions, isAdmin, isLexicographer]
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
            {/* Show root: in editor mode always, in public mode only if different from lemma */}
            {(editorMode || (root && root !== lemma)) && (
              <>
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
              </>
            )}
          </div>
          {/* Show dictionary source in public mode */}
          {!editorMode && dictionary && (
            <div className="text-sm text-gray-600">
              <span className="font-medium">Fuente:</span> {dictionary}
            </div>
          )}
        </div>

        {/* Editor controls */}
        {editorMode && (
          <div className="flex flex-wrap items-end gap-3 text-sm">
            <div className="w-32">
              <Dropdown
                label="Diccionario"
                options={DICCIONARIES}
                value={dictionary || ''}
                onChange={(val: string) => onDictionaryChange(val || null)}
                placeholder="Seleccionar"
                disabled={!canActuallyEdit}
              />
            </div>
            <div className="w-24">
              <Dropdown
                label="Letra"
                options={letterOptions}
                value={letter}
                onChange={(value: string) => onLetterChange(value.toLowerCase())}
                placeholder="Letra"
                disabled={!canActuallyEdit}
              />
            </div>

            <div className="w-36">
              <Dropdown
                label="Asignado a"
                options={userOptions}
                value={assignedTo?.toString() ?? ''}
                onChange={(value: string) => onAssignedToChange(value ? Number(value) : null)}
                placeholder={assignedTo?.toString() ?? 'Sin asignar'}
                disabled={!(canAsigned || canActuallyEdit)}
              />
            </div>

            <div className="w-32">
              <Dropdown
                label="Estado"
                options={statusFilters}
                value={status}
                onChange={onStatusChange}
                placeholder={
                  status
                    ? statusOptions.find((opt) => opt.value === status)?.label || status
                    : 'Seleccionar estado'
                }
                disabled={!canActuallyEdit && !canChangeStatus}
              />
            </div>

            {/* Preview Button */}
            {onPreview && (
              <Button
                type="button"
                onClick={onPreview}
                className="rounded-md bg-gray-100 px-4 py-2 text-gray-700 hover:bg-gray-200"
                title="Previsualizar"
              >
                Previsualizar
              </Button>
            )}

            {/* Manual Save Button */}
            {onManualSave && (
              <Button
                type="button"
                onClick={onManualSave}
                disabled={isSaving}
                className={`rounded-md px-4 py-2 text-white transition-colors ${
                  isSaved ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
                title="Guardar cambios"
              >
                {isSaved ? 'Guardado' : 'Guardar cambios'}
                {isSaving ? <SpinnerIcon className="h-5 w-5" /> : ''}
              </Button>
            )}

            {onDeleteWord && (userRole === 'admin' || userRole === 'superadmin') && (
              <Button
                type="button"
                onClick={onDeleteWord}
                className="rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
              >
                Eliminar palabra
              </Button>
            )}
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
