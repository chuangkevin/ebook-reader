import { Request, Response } from 'express';
import progressService from '../services/progress.service';
import logger from '../utils/logger';

class ProgressController {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bookId } = req.params;
      const progress = progressService.get(userId, bookId);
      if (!progress) {
        res.json({ userId, bookId, cfi: null, percentage: 0 });
        return;
      }
      res.json(progress);
    } catch (error) {
      logger.error('Failed to get progress:', error);
      res.status(500).json({ error: 'Failed to get progress' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bookId } = req.params;
      const { cfi, percentage } = req.body;

      if (percentage !== undefined && (typeof percentage !== 'number' || percentage < 0 || percentage > 100)) {
        res.status(400).json({ error: 'Percentage must be a number between 0 and 100' });
        return;
      }

      const progress = progressService.upsert(userId, bookId, cfi ?? null, percentage ?? 0);
      res.json(progress);
    } catch (error) {
      logger.error('Failed to update progress:', error);
      res.status(500).json({ error: 'Failed to update progress' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bookId } = req.params;
      progressService.delete(userId, bookId);
      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to delete progress:', error);
      res.status(500).json({ error: 'Failed to delete progress' });
    }
  }

  async getAllForUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const progress = progressService.getAllForUser(userId);
      res.json(progress);
    } catch (error) {
      logger.error('Failed to get user progress:', error);
      res.status(500).json({ error: 'Failed to get user progress' });
    }
  }
}

export default new ProgressController();
