import { db } from '../config/database';
import logger from '../utils/logger';

interface BookmarkRow {
  user_id: string;
  book_id: string;
  created_at: number;
}

class BookmarkService {
  getAll(userId: string): string[] {
    const rows = db.prepare(
      'SELECT book_id FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC'
    ).all(userId) as BookmarkRow[];
    return rows.map(r => r.book_id);
  }

  add(userId: string, bookId: string): void {
    db.prepare(
      'INSERT OR IGNORE INTO bookmarks (user_id, book_id, created_at) VALUES (?, ?, ?)'
    ).run(userId, bookId, Date.now());
    logger.debug(`Bookmark added: user=${userId}, book=${bookId}`);
  }

  remove(userId: string, bookId: string): void {
    db.prepare(
      'DELETE FROM bookmarks WHERE user_id = ? AND book_id = ?'
    ).run(userId, bookId);
    logger.debug(`Bookmark removed: user=${userId}, book=${bookId}`);
  }

  isBookmarked(userId: string, bookId: string): boolean {
    const row = db.prepare(
      'SELECT 1 FROM bookmarks WHERE user_id = ? AND book_id = ?'
    ).get(userId, bookId);
    return !!row;
  }
}

export default new BookmarkService();
