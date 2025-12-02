/**
 * Redacted words report email template.
 *
 * Email sent with the redacted words report attachment.
 *
 * @module components/emails/report-words-report-email
 */

import { Section, Text } from '@react-email/components';
import * as React from 'react';
import { BaseEmail } from '@/components/emails/base-email';

/**
 * Props for the WordsReportEmail component.
 */
export interface WordsReportEmailProps {
  /** Recipient's username */
  username: string;
  /** Formatted date string for the report */
  dateStr: string;
}

/**
 * Email template for words report delivery.
 *
 * Sent to editorial team with the words report attachment.
 *
 * @example
 * ```tsx
 * <WordsReportEmail username="editor" dateStr="26 Nov 2025" />
 * ```
 */
const WordsReportEmail = ({ username, dateStr }: WordsReportEmailProps) => (
  <BaseEmail preview="Reporte de palabras - DUECh en línea" title="Reporte de palabras">
    <Text className="mb-[3%] px-[5%] text-base leading-relaxed text-gray-800">
      Estimado/a {username},
    </Text>

    <Text className="mb-[3%] px-[5%] text-base leading-relaxed text-gray-800">
      Adjunto encontrarás el reporte de palabras generado el <strong>{dateStr}</strong>.
    </Text>

    <Text className="mb-[3%] px-[5%] text-base leading-relaxed text-gray-800">
      Este documento contiene el listado completo de todas las palabras en estado
      &ldquo;redactada&rdquo; y &ldquo;revisada por lexicógrafo&rdquo; junto con sus comentarios
      editoriales correspondientes.
    </Text>

    <Section className="mx-[5%] my-5 border-l-4 border-yellow-400 bg-yellow-50 p-4">
      <Text className="m-0 text-sm text-yellow-800">
        <strong>Nota:</strong> Este reporte es confidencial y de uso exclusivo para el equipo
        editorial de DUECh.
      </Text>
    </Section>

    <Text className="mb-[3%] px-[5%] text-base leading-relaxed text-gray-800">
      Saludos cordiales,
      <br />
      <strong>Equipo DUECh en línea</strong>
    </Text>
  </BaseEmail>
);

export default WordsReportEmail;
