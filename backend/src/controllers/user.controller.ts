import { Request, Response } from 'express';
import userService from '../services/user.service';
import logger from '../utils/logger';

class UserController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const users = userService.getAll();
      res.json(users);
    } catch (error) {
      logger.error('Failed to get users:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const user = userService.getById(req.params.id);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      logger.error('Failed to get user:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  async create(req: Request, res: Response): Promise<void> {
    try {
      const { name, avatarColor } = req.body;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ error: 'Name is required' });
        return;
      }
      const user = userService.create(name.trim(), avatarColor);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        res.status(409).json({ error: 'User name already exists' });
        return;
      }
      logger.error('Failed to create user:', error);
      res.status(500).json({ error: 'Failed to create user' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { name, avatarColor } = req.body;
      const user = userService.update(req.params.id, name, avatarColor);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
        res.status(409).json({ error: 'User name already exists' });
        return;
      }
      logger.error('Failed to update user:', error);
      res.status(500).json({ error: 'Failed to update user' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const deleted = userService.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json({ message: 'User deleted' });
    } catch (error) {
      logger.error('Failed to delete user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  }
}

export default new UserController();
