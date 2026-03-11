import { Router } from 'express';
import bookmarkController from '../controllers/bookmark.controller';

const router = Router();

// GET /api/users/:userId/bookmarks
router.get('/users/:userId/bookmarks', (req, res) => bookmarkController.getAll(req, res));

// POST /api/users/:userId/books/:bookId/bookmark (toggle)
router.post('/users/:userId/books/:bookId/bookmark', (req, res) => bookmarkController.toggle(req, res));

export default router;
