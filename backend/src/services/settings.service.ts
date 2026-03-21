import { db } from '../config/database';
import logger from '../utils/logger';

export interface ReaderSettings {
  writingMode: 'vertical-rl' | 'horizontal-tb';
  fontSize: number;
  theme: 'light' | 'sepia' | 'dark';
  openccMode: 'none' | 'tw2s' | 's2tw';
  tapZoneLayout: 'default' | 'bottom-next' | 'bottom-prev';
  version: number;
}

export interface SettingsConflict {
  conflict: true;
  serverData: ReaderSettings;
  serverVersion: number;
}

const DEFAULT_SETTINGS: ReaderSettings = {
  writingMode: 'vertical-rl',
  fontSize: 18,
  theme: 'light',
  openccMode: 'none',
  tapZoneLayout: 'default',
  version: 0,
};

interface SettingsRow {
  user_id: string;
  writing_mode: string;
  font_size: number;
  theme: string;
  opencc_mode: string;
  tap_zone_layout: string;
  version: number;
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

  upsert(userId: string, settings: Partial<ReaderSettings>, clientVersion?: number): ReaderSettings | SettingsConflict {
    const current = this.get(userId);

    // Version conflict check (only if clientVersion provided and settings exist on server)
    if (clientVersion !== undefined && current.version > 0 && clientVersion !== current.version) {
      logger.debug(`Settings conflict: user=${userId}, client=${clientVersion}, server=${current.version}`);
      return {
        conflict: true,
        serverData: current,
        serverVersion: current.version,
      };
    }

    const newVersion = current.version + 1;
    const { version: _v, ...settingsWithoutVersion } = settings;
    const merged: ReaderSettings = { ...current, ...settingsWithoutVersion, version: newVersion };

    db.prepare(`
      INSERT INTO user_settings (user_id, writing_mode, font_size, theme, opencc_mode, tap_zone_layout, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        writing_mode = excluded.writing_mode,
        font_size = excluded.font_size,
        theme = excluded.theme,
        opencc_mode = excluded.opencc_mode,
        tap_zone_layout = excluded.tap_zone_layout,
        version = excluded.version
    `).run(
      userId,
      merged.writingMode,
      merged.fontSize,
      merged.theme,
      merged.openccMode,
      merged.tapZoneLayout,
      merged.version,
    );

    logger.debug(`Settings upserted: user=${userId}, v${newVersion}`);
    return merged;
  }

  forceUpdate(userId: string, settings: Partial<ReaderSettings>): ReaderSettings {
    const current = this.get(userId);
    const newVersion = current.version + 1;
    const { version: _v, ...settingsWithoutVersion } = settings;
    const merged: ReaderSettings = { ...current, ...settingsWithoutVersion, version: newVersion };

    db.prepare(`
      INSERT INTO user_settings (user_id, writing_mode, font_size, theme, opencc_mode, tap_zone_layout, version)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        writing_mode = excluded.writing_mode,
        font_size = excluded.font_size,
        theme = excluded.theme,
        opencc_mode = excluded.opencc_mode,
        tap_zone_layout = excluded.tap_zone_layout,
        version = excluded.version
    `).run(
      userId,
      merged.writingMode,
      merged.fontSize,
      merged.theme,
      merged.openccMode,
      merged.tapZoneLayout,
      merged.version,
    );

    logger.debug(`Settings force-updated: user=${userId}, v${newVersion}`);
    return merged;
  }

  private mapRow(row: SettingsRow): ReaderSettings {
    return {
      writingMode: row.writing_mode as ReaderSettings['writingMode'],
      fontSize: row.font_size,
      theme: row.theme as ReaderSettings['theme'],
      openccMode: row.opencc_mode as ReaderSettings['openccMode'],
      tapZoneLayout: row.tap_zone_layout as ReaderSettings['tapZoneLayout'],
      version: row.version,
    };
  }
}

export default new SettingsService();
