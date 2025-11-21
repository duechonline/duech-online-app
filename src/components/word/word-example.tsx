'use client';

import React from 'react';
import MarkdownRenderer from '@/components/word/markdown-renderer';
import { Button } from '@/components/common/button';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { type Example } from '@/lib/definitions';

interface ExampleDisplayProps {
  example: Example | Example[];
  defIndex?: number;
  editorMode?: boolean;
  onEdit?: (exIndex: number) => void;
  onAdd?: () => void;
  onDelete?: (exIndex: number) => void;
}

export function ExampleDisplay({
  example,
  defIndex,
  editorMode = false,
  onEdit,
  onAdd,
  onDelete,
}: ExampleDisplayProps) {
  const examples = Array.isArray(example) ? example : [example];
  const isEditable = editorMode && defIndex !== undefined;

  return (
    <>
      {examples.map((ex, exIndex) => (
        <div
          key={exIndex}
          className={`example-hover relative rounded-lg border-l-4 ${editorMode ? 'border-blue-600' : 'border-blue-400'} bg-gray-50 p-4 ${editorMode ? 'pb-12' : ''}`}
        >
          <div className="mb-2 text-gray-700">
            <MarkdownRenderer content={ex.value} />
          </div>
          <div className="text-sm text-gray-600">
            {ex.author && <span className="mr-3">Autor: {ex.author}</span>}
            {ex.title && <span className="mr-3">Título: {ex.title}</span>}
            {ex.source && <span className="mr-3">Fuente: {ex.source}</span>}
            {ex.date && <span className="mr-3">Fecha: {ex.date}</span>}
            {ex.page && <span>Página: {ex.page}</span>}
          </div>

          {/* Example action buttons (editor mode) */}
          {isEditable && (
            <div className="example-buttons absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 opacity-0 transition-opacity duration-200">
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => onEdit?.(exIndex)}
                  aria-label="Editar ejemplo"
                  title="Editar ejemplo"
                  className="inline-flex size-12 items-center justify-center rounded-full border-2 border-dashed border-green-400 bg-white text-green-600 shadow hover:bg-green-50 focus:ring-2 focus:ring-green-300 focus:outline-none"
                >
                  <PencilIcon className="h-5 w-5" />
                </Button>

                <Button
                  onClick={onAdd}
                  aria-label="Agregar ejemplo"
                  title="Agregar ejemplo"
                  className="inline-flex size-12 items-center justify-center rounded-full border-2 border-dashed border-blue-400 bg-white text-blue-600 shadow hover:bg-blue-50 focus:ring-2 focus:ring-blue-300 focus:outline-none"
                >
                  <PlusIcon className="h-5 w-5" />
                </Button>

                <Button
                  onClick={() => onDelete?.(exIndex)}
                  aria-label="Eliminar ejemplo"
                  title="Eliminar ejemplo"
                  className="inline-flex size-12 items-center justify-center rounded-full border-2 border-dashed border-red-300 bg-white text-red-600 shadow hover:bg-red-50 focus:ring-2 focus:ring-red-300 focus:outline-none"
                >
                  <TrashIcon className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
