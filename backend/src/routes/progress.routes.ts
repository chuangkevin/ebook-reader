import { Router } from 'express';
import progressController from '../controllers/progress.controller';

const router = Router();

router.get('/users/:userId/progress', (req, res) => progressController.getAllForUser(req, res));
router.get('/users/:userId/books/:bookId/progress', (req, res) => progressController.get(req, res));
router.put('/users/:userId/books/:bookId/progress', (req, res) => progressController.update(req, res));

export default router;
