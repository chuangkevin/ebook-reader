import { Request, Response } from 'express';
import settingsService from '../services/settings.service';
import logger from '../utils/logger';

class SettingsController {
  async get(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const settings = settingsService.get(userId);
      res.json(settings);
    } catch (error) {
      logger.error('Failed to get settings:', error);
      res.status(500).json({ error: 'Failed to get settings' });
    }
  }

  async update(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { writingMode, fontSize, theme, openccMode, tapZoneLayout } = req.body;

      const allowed = {
        writingMode: ['vertical-rl', 'horizontal-tb'],
        theme: ['light', 'sepia', 'dark'],
        openccMode: ['none', 'tw2s', 's2tw'],
        tapZoneLayout: ['default', 'bottom-next', 'bottom-prev'],
      };

      if (writingMode !== undefined && !allowed.writingMode.includes(writingMode)) {
        res.status(400).json({ error: `writingMode must be one of: ${allowed.writingMode.join(', ')}` });
        return;
      }
      if (fontSize !== undefined && (typeof fontSize !== 'number' || fontSize < 8 || fontSize > 64)) {
        res.status(400).json({ error: 'fontSize must be a number between 8 and 64' });
        return;
      }
      if (theme !== undefined && !allowed.theme.includes(theme)) {
        res.status(400).json({ error: `theme must be one of: ${allowed.theme.join(', ')}` });
        return;
      }
      if (openccMode !== undefined && !allowed.openccMode.includes(openccMode)) {
        res.status(400).json({ error: `openccMode must be one of: ${allowed.openccMode.join(', ')}` });
        return;
      }
      if (tapZoneLayout !== undefined && !allowed.tapZoneLayout.includes(tapZoneLayout)) {
        res.status(400).json({ error: `tapZoneLayout must be one of: ${allowed.tapZoneLayout.join(', ')}` });
        return;
      }

      const partial: Record<string, unknown> = {};
      if (writingMode !== undefined) partial.writingMode = writingMode;
      if (fontSize !== undefined) partial.fontSize = fontSize;
      if (theme !== undefined) partial.theme = theme;
      if (openccMode !== undefined) partial.openccMode = openccMode;
      if (tapZoneLayout !== undefined) partial.tapZoneLayout = tapZoneLayout;

      const settings = settingsService.upsert(userId, partial as Parameters<typeof settingsService.upsert>[1]);
      res.json(settings);
    } catch (error) {
      logger.error('Failed to update settings:', error);
      res.status(500).json({ error: 'Failed to update settings' });
    }
  }
}

export default new SettingsController();
