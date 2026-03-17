import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import config from '../config/environment';
import type { BookFormat } from '../types';

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.storage.booksDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.epub';
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_EXTENSIONS: Record<string, BookFormat> = {
  '.epub': 'epub',
  '.pdf': 'pdf',
  '.txt': 'txt',
};

const ALLOWED_MIMES = [
  'application/epub+zip',
  'application/pdf',
  'text/plain',
  'application/octet-stream',
];

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ALLOWED_MIMES.includes(file.mimetype) || ext in ALLOWED_EXTENSIONS) {
    cb(null, true);
  } else {
    cb(new Error('Only .epub, .pdf, and .txt files are allowed'));
  }
};

export function getFormatFromFilename(filename: string): BookFormat {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTENSIONS[ext] || 'epub';
}

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
  },
});
