/**
 * Drizzle ORM Schema for DUECh PostgreSQL Database
 */

import { pgTable, serial, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Users table for authentication and authorization.
 *
 * Supports role-based access control with roles: lexicographer, editor, admin, superadmin.
 * Tracks active sessions to prevent concurrent logins from multiple devices.
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('lexicographer'), // lexicographer, editor, admin, superadmin
  currentSessionId: text('current_session_id'), // Track active session to prevent concurrent logins
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Password reset tokens table for secure password recovery.
 *
 * Tokens are generated when users request password resets and are consumed
 * when the password is successfully changed. Cascades delete when user is removed.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Words table - main dictionary entries.
 *
 * Each word has a lemma (the dictionary form), optional root word,
 * letter for alphabetical indexing, and status for editorial workflow.
 *
 * Status values: draft, in_review, reviewed, rejected, published, imported,
 * included, preredacted, redacted, archaic, quarantined
 */
export const words = pgTable('words', {
  id: serial('id').primaryKey(),
  lemma: text('lemma').notNull(),
  root: text('root'),
  letter: text('letter').notNull(), // Single character (a-z, ñ)
  variant: text('variant'),
  status: text('status').notNull().default('draft'), // draft, in_review, reviewed, rejected, published
  createdBy: integer('created_by').references(() => users.id),
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Meanings table - word definitions and linguistic metadata.
 *
 * Each meaning belongs to a word and contains the definition text,
 * grammatical category, origin, usage markers, and examples.
 * A word can have multiple numbered meanings (acepciones).
 *
 * Marker fields store linguistic classification:
 * - socialValuations: Social value (e.g., vulgar, euphemism)
 * - socialStratumMarkers: Social stratum (e.g., popular, cultured)
 * - styleMarkers: Style (e.g., spontaneous, refined)
 * - intentionalityMarkers: Intent (e.g., festive, derogatory, affective)
 * - geographicalMarkers: Geographic region (e.g., north, south, central)
 * - chronologicalMarkers: Time period (e.g., historical, obsolescent)
 * - frequencyMarkers: Usage frequency (e.g., rarely used)
 */
export const meanings = pgTable('meanings', {
  id: serial('id').primaryKey(),
  wordId: integer('word_id')
    .notNull()
    .references(() => words.id, { onDelete: 'cascade' }),
  number: integer('number').notNull(),
  origin: text('origin'),
  meaning: text('meaning').notNull(),
  observation: text('observation'),
  remission: text('remission'), // Cross-reference to another word
  grammarCategory: text('grammar_categ'),
  socialValuations: text('social_valuation'),
  socialStratumMarkers: text('social_mark'),
  styleMarkers: text('style_mark'),
  intentionalityMarkers: text('inten_mark'),
  geographicalMarkers: text('geo_mark'),
  chronologicalMarkers: text('chrono_mark'),
  frequencyMarkers: text('freq_mark'),
  dictionary: text('dictionary'), // difruech, duech, etc.
  variant: text('variant'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Examples table (normalized)
export const examples = pgTable('examples', {
  id: serial('id').primaryKey(),
  meaningId: integer('meaning_id')
    .notNull()
    .references(() => meanings.id, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  author: text('author'),
  year: text('year'),
  publication: text('publication'),
  format: text('format'),
  title: text('title'),
  date: text('date'),
  city: text('city'),
  editorial: text('editorial'),
  volume: text('volume'),
  number: text('number'),
  page: text('page'),
  doi: text('doi'),
  url: text('url'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Notes table - editorial comments on words.
 *
 * Allows editors to leave comments and feedback on dictionary entries.
 * Notes can be marked as resolved when the feedback has been addressed.
 * Cascades delete when the associated word is removed.
 */
export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  wordId: integer('word_id')
    .notNull()
    .references(() => words.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  note: text('note').notNull(),
  resolved: boolean('resolved').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/**
 * Word relations - defines how words connect to meanings, notes, and users.
 */
export const wordsRelations = relations(words, ({ many, one }) => ({
  meanings: many(meanings),
  notes: many(notes),
  creator: one(users, {
    fields: [words.createdBy],
    references: [users.id],
    relationName: 'createdWords',
  }),
  assignee: one(users, {
    fields: [words.assignedTo],
    references: [users.id],
    relationName: 'assignedWords',
  }),
}));

export const meaningsRelations = relations(meanings, ({ one, many }) => ({
  word: one(words, {
    fields: [meanings.wordId],
    references: [words.id],
  }),
  examples: many(examples),
}));

export const examplesRelations = relations(examples, ({ one }) => ({
  meaning: one(meanings, {
    fields: [examples.meaningId],
    references: [meanings.id],
  }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  word: one(words, {
    fields: [notes.wordId],
    references: [words.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
}));

/**
 * User relations - connects users to their created words, notes, and password reset tokens.
 */
export const usersRelations = relations(users, ({ many }) => ({
  createdWords: many(words),
  notes: many(notes),
  passwordResetTokens: many(passwordResetTokens),
}));

/**
 * Password reset token relations - connects tokens to their user.
 */
export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
