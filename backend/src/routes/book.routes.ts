import { Router } from 'express';
import bookController from '../controllers/book.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

router.get('/books', (req, res) => bookController.getAll(req, res));
router.post('/books', uploadMiddleware.single('file'), (req, res) => bookController.upload(req, res));
router.get('/books/:id', (req, res) => bookController.getById(req, res));
router.delete('/books/:id', (req, res) => bookController.delete(req, res));
router.get('/books/:id/file', (req, res) => bookController.serveFile(req, res));
router.get('/books/:id/cover', (req, res) => bookController.serveCover(req, res));

export default router;
