import crypto from 'crypto';
import { db } from '../config/database';
import { User } from '../types';
import logger from '../utils/logger';

class UserService {
  getAll(): User[] {
    const rows = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as Array<{
      id: string; name: string; avatar_color: string; created_at: number;
    }>;
    return rows.map(this.mapRow);
  }

  getById(id: string): User | null {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as {
      id: string; name: string; avatar_color: string; created_at: number;
    } | undefined;
    return row ? this.mapRow(row) : null;
  }

  create(name: string, avatarColor?: string): User {
    const id = crypto.randomUUID();
    const now = Date.now();
    const color = avatarColor || '#1976d2';

    db.prepare('INSERT INTO users (id, name, avatar_color, created_at) VALUES (?, ?, ?, ?)').run(id, name, color, now);
    logger.info(`User created: ${name} (${id})`);

    return { id, name, avatarColor: color, createdAt: now };
  }

  update(id: string, name?: string, avatarColor?: string): User | null {
    const existing = this.getById(id);
    if (!existing) return null;

    const newName = name ?? existing.name;
    const newColor = avatarColor ?? existing.avatarColor;

    db.prepare('UPDATE users SET name = ?, avatar_color = ? WHERE id = ?').run(newName, newColor, id);
    logger.info(`User updated: ${id}`);

    return { ...existing, name: newName, avatarColor: newColor };
  }

  delete(id: string): boolean {
    const result = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    if (result.changes > 0) {
      logger.info(`User deleted: ${id}`);
      return true;
    }
    return false;
  }

  private mapRow(row: { id: string; name: string; avatar_color: string; created_at: number }): User {
    return {
      id: row.id,
      name: row.name,
      avatarColor: row.avatar_color,
      createdAt: row.created_at,
    };
  }
}

export default new UserService();
