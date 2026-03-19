import { db } from '../config/database';
import logger from '../utils/logger';

export interface PageBookmark {
  id: string;
  userId: string;
  bookId: string;
  position: string;
  label: string | null;
  createdAt: number;
}

interface PageBookmarkRow {
  id: string;
  user_id: string;
  book_id: string;
  position: string;
  label: string | null;
  created_at: number;
}

class PageBookmarkService {
  list(userId: string, bookId: string): PageBookmark[] {
    const rows = db.prepare(
      'SELECT * FROM page_bookmarks WHERE user_id = ? AND book_id = ? ORDER BY created_at DESC'
    ).all(userId, bookId) as PageBookmarkRow[];
    return rows.map(this.mapRow);
  }

  add(userId: string, bookId: string, position: string, label?: string): PageBookmark {
    const id = `pb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const createdAt = Date.now();
    db.prepare(
      'INSERT INTO page_bookmarks (id, user_id, book_id, position, label, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, userId, bookId, position, label ?? null, createdAt);
    logger.debug(`Page bookmark added: user=${userId}, book=${bookId}, pos=${position}`);
    return { id, userId, bookId, position, label: label ?? null, createdAt };
  }

  remove(id: string): void {
    db.prepare('DELETE FROM page_bookmarks WHERE id = ?').run(id);
    logger.debug(`Page bookmark removed: id=${id}`);
  }

  private mapRow(row: PageBookmarkRow): PageBookmark {
    return {
      id: row.id,
      userId: row.user_id,
      bookId: row.book_id,
      position: row.position,
      label: row.label,
      createdAt: row.created_at,
    };
  }
}

export default new PageBookmarkService();
