'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRightCircleIcon, EyeIcon } from '@/components/icons';
import { STATUS_OPTIONS } from '@/lib/definitions';
import { Button } from '@/components/common/button';
import { useUserRole } from '@/hooks/useUserRole';

interface WordCardProps {
  lemma: string;
  letter: string;
  /** Editor mode: shows additional metadata like status, definitions count, etc */
  editorMode?: boolean;
  /** Only in editor mode */
  root?: string;
  /** Only in editor mode */
  status?: string;
  /** Only in editor mode */
  createdBy?: number;
  definitionsCount?: number;
  /** Optional class name for styling */
  className?: string;
}

export function WordCard({
  lemma,
  letter,
  editorMode = false,
  root,
  status,
  createdBy,
  definitionsCount,
  className = '',
}: WordCardProps) {
  const pathname = usePathname();
  const editorBasePath = pathname.startsWith('/editor') ? '/editor' : '';
  const { currentId } = useUserRole(true);

  const isCreator = createdBy === currentId;

  const isPublished = status === 'published';
  const viewUrl =
    editorMode && editorBasePath
      ? `${editorBasePath}/palabra/${encodeURIComponent(lemma)}`
      : `/palabra/${encodeURIComponent(lemma)}`;
  // In editor mode, we need the public domain URL for preview
  const publicPreviewUrl = editorMode
    ? `${process.env.NEXT_PUBLIC_HOST_URL || 'http://localhost:3000'}/palabra/${encodeURIComponent(lemma)}`
    : undefined;

  // Get status label and color for editor mode
  const statusOption = STATUS_OPTIONS.find((opt) => opt.value === status);
  const statusLabel = statusOption?.label || status || 'Desconocido';

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-800',
    in_review: 'bg-yellow-100 text-yellow-800',
    reviewed: 'bg-blue-100 text-blue-800',
    rejected: 'bg-red-100 text-red-800',
    published: 'bg-green-100 text-green-800',
  };
  const statusColor = statusColors[status || ''] || 'bg-gray-100 text-gray-800';

  // Public mode: simple card with link to view page
  if (!editorMode) {
    return (
      <Link
        href={viewUrl}
        className={`border-duech-gold card-hover block rounded-xl border-l-4 bg-white p-8 shadow-lg transition-all duration-200 hover:shadow-xl ${className}`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-duech-blue text-2xl font-bold">{lemma}</h2>
          <ArrowRightCircleIcon className="text-duech-gold ml-6 h-6 w-6 flex-shrink-0" />
        </div>
      </Link>
    );
  }

  // Editor mode: same card style but with additional metadata
  return (
    <div
      className={`border-duech-gold card-hover relative rounded-xl border-l-4 bg-white p-6 shadow-lg transition-all duration-200 hover:shadow-xl ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="text-duech-blue text-2xl font-bold">{lemma}</h2>
            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-800">
              Letra {letter.toUpperCase()}
            </span>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm text-gray-600">
            {root && root !== lemma && (
              <div className="flex items-center gap-1">
                <span className="font-medium">Palabra base:</span>
                <span className="text-gray-900">{root}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <span className="font-medium">Definiciones:</span>
              <span className="text-gray-900">
                {definitionsCount} {definitionsCount !== 1 ? 'definiciones' : 'definición'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">Estado:</span>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {/* {isCreator o aca iria lo de canEdit y todo eso ( */}
          <Button
            href={viewUrl}
            className="bg-duech-blue inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800"
          >
            Editar
            <ArrowRightCircleIcon className="h-4 w-4" />
          </Button>

          {isPublished && (
            <Button
              href={publicPreviewUrl}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
              title="Ver vista pública en nueva ventana"
            >
              Ver
              <EyeIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
