import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import bookService from '../services/book.service';
import { getFormatFromFilename } from '../middleware/upload.middleware';
import logger from '../utils/logger';

class BookController {
  async getAll(_req: Request, res: Response): Promise<void> {
    try {
      const books = bookService.getAll();
      res.json(books);
    } catch (error) {
      logger.error('Failed to get books:', error);
      res.status(500).json({ error: 'Failed to get books' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    try {
      const book = bookService.getById(req.params.id);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      res.json(book);
    } catch (error) {
      logger.error('Failed to get book:', error);
      res.status(500).json({ error: 'Failed to get book' });
    }
  }

  async upload(req: Request, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const uploadedBy = req.body.uploadedBy;
      if (!uploadedBy) {
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        res.status(400).json({ error: 'uploadedBy is required' });
        return;
      }

      // multer 可能用 latin1 編碼非 ASCII 檔名，需要轉回 UTF-8
      let originalName = req.file.originalname;
      try {
        originalName = Buffer.from(originalName, 'latin1').toString('utf8');
      } catch { /* 保留原始值 */ }

      const format = getFormatFromFilename(originalName);
      const book = await bookService.create(
        req.file.path,
        req.file.size,
        uploadedBy,
        originalName,
        format
      );
      res.status(201).json(book);
    } catch (error) {
      // Clean up uploaded file on error (service 已自行清理重複的情況)
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      // 重複書名
      const errMsg = error instanceof Error ? error.message : '';
      if (errMsg.startsWith('DUPLICATE:')) {
        const title = errMsg.replace('DUPLICATE:', '');
        res.status(409).json({ error: `「${title}」已存在書庫中` });
        return;
      }

      logger.error('Failed to upload book:', error);
      res.status(500).json({ error: 'Failed to upload book' });
    }
  }

  async delete(req: Request, res: Response): Promise<void> {
    try {
      const deleted = bookService.delete(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      res.json({ message: 'Book deleted' });
    } catch (error) {
      logger.error('Failed to delete book:', error);
      res.status(500).json({ error: 'Failed to delete book' });
    }
  }

  async serveFile(req: Request, res: Response): Promise<void> {
    try {
      const book = bookService.getById(req.params.id);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }

      if (!fs.existsSync(book.filePath)) {
        res.status(404).json({ error: 'Book file not found on disk' });
        return;
      }

      const contentTypes: Record<string, string> = {
        epub: 'application/epub+zip',
        pdf: 'application/pdf',
        txt: 'text/plain; charset=utf-8',
      };
      res.setHeader('Content-Type', contentTypes[book.format] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(book.title)}.${book.format}"`);
      res.sendFile(path.resolve(book.filePath));
    } catch (error) {
      logger.error('Failed to serve book file:', error);
      res.status(500).json({ error: 'Failed to serve book file' });
    }
  }

  async serveCover(req: Request, res: Response): Promise<void> {
    try {
      const book = bookService.getById(req.params.id);
      if (!book || !book.coverPath || !fs.existsSync(book.coverPath)) {
        // Return a placeholder SVG
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="300" viewBox="0 0 200 300">
          <rect width="200" height="300" fill="#e0e0e0"/>
          <text x="100" y="150" text-anchor="middle" fill="#9e9e9e" font-size="16" font-family="sans-serif">No Cover</text>
        </svg>`);
        return;
      }

      const ext = path.extname(book.coverPath).toLowerCase();
      const mimeTypes: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
      };

      res.setHeader('Content-Type', mimeTypes[ext] || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(path.resolve(book.coverPath));
    } catch (error) {
      logger.error('Failed to serve cover:', error);
      res.status(500).json({ error: 'Failed to serve cover' });
    }
  }
}

export default new BookController();
