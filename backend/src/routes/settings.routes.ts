import { Router } from 'express';
import settingsController from '../controllers/settings.controller';

const router = Router();

router.get('/users/:userId/settings', (req, res) => settingsController.get(req, res));
router.put('/users/:userId/settings', (req, res) => settingsController.update(req, res));

export default router;
