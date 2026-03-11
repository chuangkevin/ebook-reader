import crypto from 'crypto';
import { db } from '../config/database';
import { ReadingProgress } from '../types';
import logger from '../utils/logger';

interface ProgressRow {
  id: string;
  user_id: string;
  book_id: string;
  cfi: string | null;
  percentage: number;
  last_read_at: number;
}

interface ProgressWithBookRow extends ProgressRow {
  title: string;
  author: string;
  cover_path: string | null;
}

class ProgressService {
  get(userId: string, bookId: string): ReadingProgress | null {
    const row = db.prepare(
      'SELECT * FROM reading_progress WHERE user_id = ? AND book_id = ?'
    ).get(userId, bookId) as ProgressRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  upsert(userId: string, bookId: string, cfi: string | null, percentage: number): ReadingProgress {
    const now = Date.now();
    const existing = this.get(userId, bookId);

    if (existing) {
      db.prepare(
        'UPDATE reading_progress SET cfi = ?, percentage = ?, last_read_at = ? WHERE user_id = ? AND book_id = ?'
      ).run(cfi, percentage, now, userId, bookId);
      logger.debug(`Progress updated: user=${userId}, book=${bookId}, ${percentage}%`);
      return { ...existing, cfi, percentage, lastReadAt: now };
    }

    const id = crypto.randomUUID();
    db.prepare(
      'INSERT INTO reading_progress (id, user_id, book_id, cfi, percentage, last_read_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId, bookId, cfi, percentage, now);
    logger.debug(`Progress created: user=${userId}, book=${bookId}, ${percentage}%`);

    return { id, userId, bookId, cfi, percentage, lastReadAt: now };
  }

  getAllForUser(userId: string): Array<ReadingProgress & { title: string; author: string; coverPath: string | null }> {
    const rows = db.prepare(`
      SELECT rp.*, b.title, b.author, b.cover_path
      FROM reading_progress rp
      JOIN books b ON rp.book_id = b.id
      WHERE rp.user_id = ?
      ORDER BY rp.last_read_at DESC
    `).all(userId) as ProgressWithBookRow[];

    return rows.map(row => ({
      ...this.mapRow(row),
      title: row.title,
      author: row.author,
      coverPath: row.cover_path,
    }));
  }

  private mapRow(row: ProgressRow): ReadingProgress {
    return {
      id: row.id,
      userId: row.user_id,
      bookId: row.book_id,
      cfi: row.cfi,
      percentage: row.percentage,
      lastReadAt: row.last_read_at,
    };
  }
}

export default new ProgressService();
