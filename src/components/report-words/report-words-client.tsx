/**
 * Redacted and reviewed by lexicographers words management client component.
 *
 * Displays list of words in "redactada" and "revisada por lexicógrafos" status with PDF export
 * and email sending capabilities.
 *
 * @module components/export-words/exported-words-client
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert } from '@/components/common/alert';
import { Button } from '@/components/common/button';

/**
 * Exported word data structure.
 */
export interface ExportedWord {
  /** Word database ID */
  id: number;
  /** Word lemma */
  lemma: string;
  /** Word status */
  status: string;
  /** Associated editorial notes */
  notes?: Array<{
    id: number;
    note: string | null;
  }> | null;
}

/**
 * Props for the ExportedWordsClient component.
 */
export interface ExportedWordsClientProps {
  /** List of redacted words */
  redactedWords: ExportedWord[];
  /** List of reviewed by lexicographers words */
  reviewedLexWords: ExportedWord[];
  /** Email address for sending report */
  userEmail: string;
}

type ReportType = 'redacted' | 'reviewedLex' | 'both';

/**
 * Client component for managing redacted and reviewed words.
 *
 * Shows a table of words in "redactada" and "revisada por lexicógrafos" status with their editorial
 * comments. Provides actions to download PDF or email the report.
 *
 * @example
 * ```tsx
 * <ExportedWordsClient
 *   redactedWords={exportedWords}
 *   reviewedLexWords={exportedWords}
 *   userEmail={user.email}
 * />
 * ```
 */
export function ExportedWordsClient({
  redactedWords,
  reviewedLexWords,
  userEmail,
}: ExportedWordsClientProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'redacted' | 'reviewed'>('all');
  const [isSending, setIsSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const allWords = [...redactedWords, ...reviewedLexWords];

  // Filtrar palabras según la pestaña activa
  const displayWords =
    activeTab === 'redacted'
      ? redactedWords
      : activeTab === 'reviewed'
        ? reviewedLexWords
        : allWords;

  const getReportType = (): ReportType => {
    if (activeTab === 'redacted') return 'redacted';
    if (activeTab === 'reviewed') return 'reviewedLex';
    return 'both';
  };

  const handleSendEmail = async () => {
    const type = getReportType();
    setIsSending(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/words/export/send-email?type=${type}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setErrorMessage(data.error || 'Error al enviar el correo');
        return;
      }

      setSuccessMessage(`Reporte enviado exitosamente a ${data.email}`);
    } catch (error) {
      setErrorMessage('Error al enviar el correo. Por favor, intenta nuevamente.');
      console.error('Error sending email:', error);
    } finally {
      setIsSending(false);
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'redacted' ? 'Redactada' : 'Revisada por lexicógrafo';
  };

  const getStatusBadgeColor = (status: string) => {
    return status === 'redacted' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">
          {' '}
          Reporte de palabras pendientes de revisión
        </h1>
        <div className="text-gray-600">
          <p>
            Redactadas: <strong>{redactedWords.length}</strong>
          </p>
          <p>
            Revisadas por lexicógrafo: <strong>{reviewedLexWords.length}</strong>
          </p>
          <p>
            Total: <strong>{allWords.length}</strong>
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('all')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'border-duech-blue text-duech-blue'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Todas ({allWords.length})
          </button>
          <button
            onClick={() => setActiveTab('redacted')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'redacted'
                ? 'border-yellow-600 text-yellow-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Redactadas ({redactedWords.length})
          </button>
          <button
            onClick={() => setActiveTab('reviewed')}
            className={`border-b-2 px-1 py-4 text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'reviewed'
                ? 'border-green-600 text-green-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
            }`}
          >
            Revisadas ({reviewedLexWords.length})
          </button>
        </nav>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <Alert variant="success" className="mb-4">
          {successMessage}
        </Alert>
      )}

      {errorMessage && (
        <Alert variant="error" className="mb-4">
          {errorMessage}
        </Alert>
      )}

      {/* Action Buttons */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          href={`/api/words/report?type=${getReportType()}`}
          className="bg-duech-blue text-white hover:bg-blue-700"
          disabled={displayWords.length === 0}
        >
          Descargar PDF
        </Button>

        <Button
          onClick={handleSendEmail}
          loading={isSending}
          disabled={isSending || displayWords.length === 0}
          className="bg-duech-gold text-gray-900 hover:bg-yellow-500"
        >
          {isSending ? 'Enviando...' : 'Enviar por correo'}
        </Button>

        <div className="text-sm text-gray-500">Correo destino: {userEmail}</div>
      </div>

      {/* Words List */}
      {displayWords.length === 0 ? (
        <Alert variant="info">No se encontraron palabras en esta categoría.</Alert>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-gray-200 bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">#</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Palabra
                  </th>
                  {activeTab === 'all' && (
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Estado
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                    Comentarios Editoriales
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayWords.map((word, index) => (
                  <tr key={word.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/editor/palabra/${encodeURIComponent(word.lemma)}`}
                        className="text-duech-blue font-semibold hover:text-blue-700 hover:underline"
                      >
                        {word.lemma}
                      </Link>
                    </td>
                    {activeTab === 'all' && (
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadgeColor(word.status)}`}
                        >
                          {getStatusLabel(word.status)}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {word.notes && word.notes.length > 0 ? (
                        <ul className="space-y-1 text-sm text-gray-700">
                          {word.notes.map((note) => (
                            <li key={note.id} className="flex items-start">
                              <span className="mr-2 text-gray-400">•</span>
                              <span>{note.note || 'Sin comentario'}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-gray-400 italic">Sin comentarios</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
