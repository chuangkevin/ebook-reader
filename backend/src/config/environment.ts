import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3003', 10),

  database: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/db/readflix.sqlite'),
  },

  storage: {
    booksDir: process.env.BOOKS_DIR || path.join(__dirname, '../../data/books'),
    coversDir: process.env.COVERS_DIR || path.join(__dirname, '../../data/covers'),
  },

  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
  },

  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
