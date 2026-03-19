import { Router } from 'express';
import pageBookmarkController from '../controllers/pageBookmark.controller';

const router = Router();

// GET /api/users/:userId/books/:bookId/page-bookmarks
router.get('/users/:userId/books/:bookId/page-bookmarks', (req, res) => pageBookmarkController.list(req, res));

// POST /api/users/:userId/books/:bookId/page-bookmarks
router.post('/users/:userId/books/:bookId/page-bookmarks', (req, res) => pageBookmarkController.add(req, res));

// DELETE /api/page-bookmarks/:id
router.delete('/page-bookmarks/:id', (req, res) => pageBookmarkController.remove(req, res));

export default router;
