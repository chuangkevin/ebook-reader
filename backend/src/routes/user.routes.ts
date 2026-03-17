import { Router } from 'express';
import userController from '../controllers/user.controller';

const router = Router();

router.get('/users', (req, res) => userController.getAll(req, res));
router.post('/users', (req, res) => userController.create(req, res));
router.get('/users/:id', (req, res) => userController.getById(req, res));
router.put('/users/:id', (req, res) => userController.update(req, res));
router.delete('/users/:id', (req, res) => userController.delete(req, res));

export default router;
