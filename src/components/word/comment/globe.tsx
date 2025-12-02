/**
 * Comment bubble (globe) component.
 *
 * This component renders a single editorial comment in a styled bubble/card
 * format. Each comment displays the user's avatar (with initials), username,
 * timestamp, and the comment content with markdown support.
 *
 * ## Visual Design
 *
 * ### User-Based Colors
 * The component uses a consistent color scheme for each user based on a
 * hash of their user ID or username. This makes it easy to visually
 * identify comments from the same person.
 *
 * ### Color Palette
 * - Blue, Emerald, Amber, Purple, Rose, Slate
 * - Each color has matching avatar, accent, bubble, and card styles
 *
 * ### Layout
 * - Left accent bar with gradient
 * - Avatar with user initials
 * - Username and timestamp header
 * - Comment content with markdown rendering
 *
 * @module components/word/comment/globe
 * @see {@link Globe} - The main exported component (default export)
 * @see {@link WordComment} - Comment data type
 * @see {@link MarkdownRenderer} - Used for comment content
 */

import React from 'react';
import MarkdownRenderer from '@/components/word/markdown-renderer';
import type { WordNote } from '@/lib/definitions';

/**
 * Word comment type alias for WordNote.
 *
 * This type represents a single editorial comment on a word.
 * It's re-exported from the definitions for convenience.
 *
 * @typedef WordComment
 */
export type WordComment = WordNote;

/**
 * Color palette for user-based styling.
 *
 * Each color scheme includes classes for:
 * - Avatar background and text
 * - Accent gradient (from, via, to)
 * - Bubble border and background
 * - Label text color
 * - Card border and background
 *
 * @internal
 * @constant
 * @type {ReadonlyArray<Object>}
 */
const COLOR_PALETTE = [
  {
    avatarBg: 'bg-blue-500/15',
    avatarText: 'text-blue-700',
    accentFrom: 'from-blue-500',
    accentVia: 'via-blue-400/80',
    accentTo: 'to-blue-300/70',
    bubbleBorder: 'border-blue-100',
    bubbleBg: 'bg-blue-50/80',
    label: 'text-blue-600',
    cardBorder: 'border-blue-100',
    cardBg: 'bg-blue-50/40',
  },
  {
    avatarBg: 'bg-emerald-500/15',
    avatarText: 'text-emerald-700',
    accentFrom: 'from-emerald-500',
    accentVia: 'via-emerald-400/80',
    accentTo: 'to-emerald-300/70',
    bubbleBorder: 'border-emerald-100',
    bubbleBg: 'bg-emerald-50/80',
    label: 'text-emerald-600',
    cardBorder: 'border-emerald-100',
    cardBg: 'bg-emerald-50/40',
  },
  {
    avatarBg: 'bg-amber-500/15',
    avatarText: 'text-amber-700',
    accentFrom: 'from-amber-500',
    accentVia: 'via-amber-400/80',
    accentTo: 'to-amber-300/70',
    bubbleBorder: 'border-amber-100',
    bubbleBg: 'bg-amber-50/80',
    label: 'text-amber-600',
    cardBorder: 'border-amber-100',
    cardBg: 'bg-amber-50/40',
  },
  {
    avatarBg: 'bg-purple-500/15',
    avatarText: 'text-purple-700',
    accentFrom: 'from-purple-500',
    accentVia: 'via-purple-400/80',
    accentTo: 'to-purple-300/70',
    bubbleBorder: 'border-purple-100',
    bubbleBg: 'bg-purple-50/80',
    label: 'text-purple-600',
    cardBorder: 'border-purple-100',
    cardBg: 'bg-purple-50/40',
  },
  {
    avatarBg: 'bg-rose-500/15',
    avatarText: 'text-rose-700',
    accentFrom: 'from-rose-500',
    accentVia: 'via-rose-400/80',
    accentTo: 'to-rose-300/70',
    bubbleBorder: 'border-rose-100',
    bubbleBg: 'bg-rose-50/80',
    label: 'text-rose-600',
    cardBorder: 'border-rose-100',
    cardBg: 'bg-rose-50/40',
  },
  {
    avatarBg: 'bg-slate-500/15',
    avatarText: 'text-slate-700',
    accentFrom: 'from-slate-500',
    accentVia: 'via-slate-400/80',
    accentTo: 'to-slate-300/70',
    bubbleBorder: 'border-slate-200',
    bubbleBg: 'bg-slate-50/80',
    label: 'text-slate-600',
    cardBorder: 'border-slate-200',
    cardBg: 'bg-slate-50/40',
  },
] as const;

/**
 * Generates a consistent hash from a string.
 *
 * Uses a simple hash algorithm to convert any string into
 * a number that can be used for color palette selection.
 *
 * @internal
 * @param {string} value - String to hash
 * @returns {number} Positive hash value
 */
const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

/**
 * Gets a color palette based on user identifier.
 *
 * Returns a consistent color scheme for each user by hashing
 * their identifier and selecting from the palette.
 *
 * @internal
 * @param {string} userKey - User ID or username
 * @returns {Object} Color palette object with CSS classes
 */
const getPaletteForUser = (userKey: string) =>
  COLOR_PALETTE[hashString(userKey) % COLOR_PALETTE.length];

/**
 * Extracts initials from a user's name.
 *
 * For single names: returns first letter
 * For multiple names: returns first and last initials
 *
 * @internal
 * @param {string} name - User's display name
 * @returns {string} 1-2 character initials (uppercase)
 */
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? 'A';
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
};

/**
 * Formats a Date object to Spanish-style datetime string.
 *
 * Output format: "DD-MM-YYYY, HH:MM a.m./p.m."
 *
 * @internal
 * @param {Date} date - Date to format
 * @returns {string} Formatted datetime string
 */
const formatDateTime = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  const minutes = String(date.getMinutes()).padStart(2, '0');
  let hours = date.getHours();
  const period = hours >= 12 ? 'p.m.' : 'a.m.';
  hours = hours % 12 || 12;

  return `${day}-${month}-${year}, ${hours}:${minutes} ${period}`;
};

/**
 * Comment bubble displaying a single editorial comment.
 *
 * Renders a styled card with user information and comment content.
 * The color scheme is automatically selected based on the user's
 * identity to provide visual consistency.
 *
 * ## Visual Elements
 * - Left accent bar with gradient
 * - User avatar with initials
 * - Username and formatted timestamp
 * - Comment content with markdown rendering
 *
 * @function Globe
 * @param {Object} props - Component props
 * @param {WordComment} props.comment - Comment data to display
 * @returns {JSX.Element} Styled comment bubble
 *
 * @example
 * // Basic usage
 * <Globe
 *   comment={{
 *     id: 1,
 *     note: "This definition needs review",
 *     user: { username: "María García" },
 *     createdAt: "2024-01-15T10:30:00Z"
 *   }}
 * />
 *
 * @example
 * // With markdown content
 * <Globe
 *   comment={{
 *     id: 2,
 *     note: "Check the **bold** reference in *cursiva*",
 *     user: { id: 5, username: "Editor" },
 *     createdAt: new Date().toISOString()
 *   }}
 * />
 */
type GlobeProps = {
  comment: WordComment;
  actions?: React.ReactNode;
  content?: React.ReactNode;
};

export default function Globe({ comment, actions, content }: GlobeProps) {
  const createdAt = new Date(comment.createdAt);
  const formattedDate = formatDateTime(createdAt);

  const username = comment.user?.username?.trim() || 'Anónimo';
  const userKey = comment.user?.id ? String(comment.user.id) : username;
  const palette = getPaletteForUser(userKey);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${palette.cardBorder} ${palette.cardBg} p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${palette.accentFrom} ${palette.accentVia} ${palette.accentTo}`}
      />

      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={`${palette.avatarBg} ${palette.avatarText} flex h-12 w-12 items-center justify-center rounded-xl text-base font-semibold shadow-inner`}
          >
            {getInitials(username)}
          </div>
          <div className="flex flex-col gap-1 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold text-gray-900">{username}</span>
            </div>
            <span className="text-xs text-gray-500">{formattedDate}</span>
          </div>
        </div>
        {actions ? (
          <div className="flex items-center gap-2 text-xs text-gray-500">{actions}</div>
        ) : null}
      </header>

      {content ?? (
        <MarkdownRenderer
          content={comment.note}
          className={`mt-4 ${palette.bubbleBorder} ${palette.bubbleBg} px-1 py-1 text-sm leading-relaxed text-gray-700`}
        />
      )}
    </article>
  );
}
