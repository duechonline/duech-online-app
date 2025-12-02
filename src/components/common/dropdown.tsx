/**
 * Dropdown components for single and multi-select inputs.
 *
 * Provides SelectDropdown for single selection and MultiSelectDropdown
 * for multiple selection with search filtering.
 *
 * @module components/common/dropdown
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@/components/icons';

/**
 * Option item for dropdown menus.
 */
export interface Option {
  /** Option value (stored/submitted) */
  value: string;
  /** Option label (displayed to user) */
  label: string;
}

/**
 * @internal
 * Shared button component for dropdown triggers.
 */
function DropdownButton({
  onClick,
  isOpen,
  displayText,
  isEmpty,
  badge,
  disabled,
}: {
  onClick: () => void;
  isOpen: boolean;
  displayText: string;
  isEmpty: boolean;
  badge?: number;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
        disabled
          ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-60'
          : 'focus:border-duech-blue cursor-pointer border-gray-300 bg-white hover:bg-gray-50 focus:outline-none'
      } `}
    >
      <div className="flex items-center justify-between">
        <span className={`truncate ${isEmpty ? 'text-gray-500' : 'text-gray-900'}`}>
          {displayText}
        </span>
        <div className="flex items-center gap-2">
          {badge !== undefined && badge > 0 && (
            <span className="bg-duech-blue rounded-full px-2 py-1 text-xs text-white">{badge}</span>
          )}
          <ChevronDownIcon
            className={`h-5 w-5 text-gray-400 transition-transform ${!disabled && isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>
    </button>
  );
}

/**
 * @internal
 * Hook to close dropdown when clicking outside.
 */
function useDropdownClose(setIsOpen: (open: boolean) => void, reset?: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
        reset?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsOpen, reset]);

  return ref;
}

/**
 * Single-select dropdown component.
 *
 * Displays a list of options and allows selecting one value.
 *
 * @example
 * ```tsx
 * <Dropdown
 *   label="Estado"
 *   options={[{ value: 'draft', label: 'Borrador' }]}
 *   selectedValue={status}
 *   onChange={setStatus}
 * />
 * ```
 */
export function Dropdown({
  label,
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled,
  searchable = false,
  multiple = false,
  maxDisplay = 3,
  menuMaxHeight = '24rem',
  listMaxHeight = '16rem',
}: {
  label?: string;
  options: Option[];
  value: string | string[];
  onChange: ((value: string) => void) | ((value: string[]) => void);
  placeholder?: string;
  /** Disables the dropdown */
  disabled?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  maxDisplay?: number;
  menuMaxHeight?: string;
  listMaxHeight?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const ref = useDropdownClose(setIsOpen, () => setSearchTerm(''));

  // Helper to ensure value is array for multiple mode
  const selectedValues = multiple
    ? Array.isArray(value)
      ? value
      : []
    : value
      ? [value as string]
      : [];

  const filteredOptions = searchable
    ? options.filter((o) => o.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  const selectedOptions = options.filter((o) => selectedValues.includes(o.value));

  let displayText = placeholder;
  if (selectedValues.length > 0) {
    if (multiple) {
      displayText =
        selectedValues.length <= maxDisplay
          ? selectedOptions.map((o) => o.label).join(', ')
          : `${selectedOptions
              .slice(0, maxDisplay)
              .map((o) => o.label)
              .join(', ')} +${selectedValues.length - maxDisplay} más`;
    } else {
      const option = options.find((o) => o.value === selectedValues[0]);
      displayText = option ? option.label : placeholder;
    }
  }

  const handleSelect = (val: string) => {
    if (disabled) return;

    if (multiple) {
      const newValues = selectedValues.includes(val)
        ? selectedValues.filter((v) => v !== val)
        : [...selectedValues, val];
      (onChange as (value: string[]) => void)(newValues);
    } else {
      (onChange as (value: string) => void)(val);
      setIsOpen(false);
      setSearchTerm('');
    }
  };

  const handleSelectAll = () => {
    if (disabled || !multiple) return;
    if (selectedValues.length === options.length) (onChange as (value: string[]) => void)([]);
    else (onChange as (value: string[]) => void)(options.map((o) => o.value));
  };

  return (
    <div className={`relative ${disabled ? 'cursor-not-allowed opacity-50' : ''}`} ref={ref}>
      {label && <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>}
      <DropdownButton
        onClick={() => !disabled && setIsOpen(!isOpen)}
        isOpen={isOpen}
        disabled={disabled}
        displayText={displayText}
        isEmpty={selectedValues.length === 0}
        badge={multiple && selectedValues.length > 0 ? selectedValues.length : undefined}
      />

      {isOpen && !disabled && (
        <div
          className="absolute z-10 mt-1 max-h-96 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow-lg"
          style={{ maxHeight: menuMaxHeight }}
        >
          {searchable && (
            <div className="border-b border-gray-200 p-2">
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="focus:border-duech-blue w-full rounded border border-gray-300 px-3 py-1 text-sm focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {multiple && (
            <div className="border-b border-gray-200 p-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-duech-blue text-sm hover:underline"
              >
                {selectedValues.length === options.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto" style={{ maxHeight: listMaxHeight }}>
            {filteredOptions.map((option) => {
              const isSelected = selectedValues.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`flex w-full items-center px-3 py-2 text-left transition-colors hover:bg-gray-50 ${
                    isSelected && !multiple
                      ? 'bg-duech-blue bg-opacity-10 text-duech-blue font-medium'
                      : 'text-gray-700'
                  }`}
                >
                  {multiple && (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="text-duech-blue focus:ring-duech-blue mr-3 rounded"
                    />
                  )}
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-500">No se encontraron opciones</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
