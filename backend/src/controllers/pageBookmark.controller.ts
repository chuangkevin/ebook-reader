import { Request, Response } from 'express';
import pageBookmarkService from '../services/pageBookmark.service';
import logger from '../utils/logger';

class PageBookmarkController {
  list(req: Request, res: Response): void {
    try {
      const { userId, bookId } = req.params;
      const bookmarks = pageBookmarkService.list(userId, bookId);
      res.json(bookmarks);
    } catch (error) {
      logger.error('Failed to list page bookmarks', error);
      res.status(500).json({ error: 'Failed to list page bookmarks' });
    }
  }

  add(req: Request, res: Response): void {
    try {
      const { userId, bookId } = req.params;
      const { position, label } = req.body;
      if (!position) {
        res.status(400).json({ error: 'Position is required' });
        return;
      }
      const bookmark = pageBookmarkService.add(userId, bookId, position, label);
      res.status(201).json(bookmark);
    } catch (error) {
      logger.error('Failed to add page bookmark', error);
      res.status(500).json({ error: 'Failed to add page bookmark' });
    }
  }

  remove(req: Request, res: Response): void {
    try {
      const { id } = req.params;
      pageBookmarkService.remove(id);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to remove page bookmark', error);
      res.status(500).json({ error: 'Failed to remove page bookmark' });
    }
  }
}

export default new PageBookmarkController();
