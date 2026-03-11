import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import config from './environment';

const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  try {
    fs.mkdirSync(dbDir, { recursive: true });
    console.log(`Created database directory: ${dbDir}`);
  } catch (err) {
    console.error(`Failed to create database directory: ${dbDir}`, err);
  }
}

let db: BetterSqlite3.Database;

try {
  console.log(`Opening database at: ${config.database.path}`);
  db = new Database(config.database.path, {
    verbose: config.env === 'development' ? console.log : undefined,
  });

  db.pragma('journal_mode = WAL');
  console.log('Database connection established');
} catch (err) {
  console.error('Failed to open database:', err);
  throw new Error(`Database initialization failed: ${err instanceof Error ? err.message : String(err)}`);
}

export { db };

export function initDatabase(): void {
  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      avatar_color TEXT NOT NULL DEFAULT '#1976d2',
      created_at INTEGER NOT NULL
    )
  `);

  // Books table
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT DEFAULT 'Unknown',
      format TEXT NOT NULL DEFAULT 'epub',
      cover_path TEXT,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_at INTEGER NOT NULL,
      FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  // Migration: add format column if missing
  const booksInfo = db.pragma('table_info(books)') as Array<{ name: string }>;
  if (!booksInfo.some(col => col.name === 'format')) {
    db.exec(`ALTER TABLE books ADD COLUMN format TEXT NOT NULL DEFAULT 'epub'`);
    console.log('Added format column to books table');
  }

  // Reading progress table
  db.exec(`
    CREATE TABLE IF NOT EXISTS reading_progress (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      book_id TEXT NOT NULL,
      cfi TEXT,
      percentage REAL DEFAULT 0,
      last_read_at INTEGER NOT NULL,
      UNIQUE(user_id, book_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_reading_progress_user ON reading_progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progress_book ON reading_progress(book_id);
    CREATE INDEX IF NOT EXISTS idx_books_uploaded_by ON books(uploaded_by);
    CREATE INDEX IF NOT EXISTS idx_books_uploaded_at ON books(uploaded_at DESC);
  `);

  console.log('Database initialized successfully');
}

export function getDatabase(): BetterSqlite3.Database {
  return db;
}

export default db;
