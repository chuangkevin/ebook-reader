import { Request, Response } from 'express';
import bookmarkService from '../services/bookmark.service';
import logger from '../utils/logger';

class BookmarkController {
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const bookIds = bookmarkService.getAll(userId);
      res.json(bookIds);
    } catch (error) {
      logger.error('Failed to get bookmarks:', error);
      res.status(500).json({ error: 'Failed to get bookmarks' });
    }
  }

  async toggle(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bookId } = req.params;
      const isBookmarked = bookmarkService.isBookmarked(userId, bookId);

      if (isBookmarked) {
        bookmarkService.remove(userId, bookId);
        res.json({ bookmarked: false });
      } else {
        bookmarkService.add(userId, bookId);
        res.json({ bookmarked: true });
      }
    } catch (error) {
      logger.error('Failed to toggle bookmark:', error);
      res.status(500).json({ error: 'Failed to toggle bookmark' });
    }
  }
}

export default new BookmarkController();
