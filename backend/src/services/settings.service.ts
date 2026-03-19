import { db } from '../config/database';
import logger from '../utils/logger';

export interface ReaderSettings {
  writingMode: 'vertical-rl' | 'horizontal-tb';
  fontSize: number;
  gap: number;
  theme: 'light' | 'sepia' | 'dark';
  openccMode: 'none' | 'tw2s' | 's2tw';
  tapZoneLayout: 'default' | 'bottom-next' | 'bottom-prev';
}

const DEFAULT_SETTINGS: ReaderSettings = {
  writingMode: 'vertical-rl',
  fontSize: 18,
  gap: 0.06,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
};

interface SettingsRow {
  user_id: string;
  writing_mode: string;
  font_size: number;
  gap: number;
  theme: string;
  opencc_mode: string;
  tap_zone_layout: string;
}

class SettingsService {
  get(userId: string): ReaderSettings {
    const row = db.prepare(
      'SELECT * FROM user_settings WHERE user_id = ?'
    ).get(userId) as SettingsRow | undefined;

    if (!row) {
      return { ...DEFAULT_SETTINGS };
    }

    return this.mapRow(row);
  }

  upsert(userId: string, settings: Partial<ReaderSettings>): ReaderSettings {
    const current = this.get(userId);
    const merged: ReaderSettings = { ...current, ...settings };

    db.prepare(`
      INSERT INTO user_settings (user_id, writing_mode, font_size, gap, theme, opencc_mode, tap_zone_layout)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        writing_mode = excluded.writing_mode,
        font_size = excluded.font_size,
        gap = excluded.gap,
        theme = excluded.theme,
        opencc_mode = excluded.opencc_mode,
        tap_zone_layout = excluded.tap_zone_layout
    `).run(
      userId,
      merged.writingMode,
      merged.fontSize,
      merged.gap,
      merged.theme,
      merged.openccMode,
      merged.tapZoneLayout,
    );

    logger.debug(`Settings upserted: user=${userId}`);
    return merged;
  }

  private mapRow(row: SettingsRow): ReaderSettings {
    return {
      writingMode: row.writing_mode as ReaderSettings['writingMode'],
      fontSize: row.font_size,
      gap: row.gap ?? 0.06,
      theme: row.theme as ReaderSettings['theme'],
      openccMode: row.opencc_mode as ReaderSettings['openccMode'],
      tapZoneLayout: row.tap_zone_layout as ReaderSettings['tapZoneLayout'],
    };
  }
}

export default new SettingsService();
