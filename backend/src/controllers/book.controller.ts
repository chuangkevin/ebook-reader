import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import jschardet from 'jschardet';
import iconv from 'iconv-lite';
import bookService from '../services/book.service';
import { getFormatFromFilename } from '../middleware/upload.middleware';
import type { Book } from '../types';
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
      const collection = req.body.collection ? String(req.body.collection).trim() || null : null;
      const book = await bookService.create(
        req.file.path,
        req.file.size,
        uploadedBy,
        originalName,
        format,
        collection
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
      const requestedBy = req.query.requestedBy as string | undefined;
      const book = bookService.getById(req.params.id);
      if (!book) {
        res.status(404).json({ error: 'Book not found' });
        return;
      }
      if (!requestedBy || book.uploadedBy !== requestedBy) {
        res.status(403).json({ error: '只有上傳者可以刪除此書籍' });
        return;
      }
      bookService.delete(req.params.id);
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

      // ?download=1 時改為附件下載（觸發瀏覽器存檔），預設 inline 供閱讀器使用
      const disposition = req.query.download === '1' ? 'attachment' : 'inline';

      // TXT 檔案需偵測編碼並轉為 UTF-8
      if (book.format === 'txt') {
        const buf = fs.readFileSync(book.filePath);
        const detected = jschardet.detect(buf);
        const encoding = detected.encoding || 'utf-8';
        let text: string;
        if (encoding.toLowerCase() === 'utf-8' || encoding.toLowerCase() === 'ascii') {
          text = buf.toString('utf8');
        } else {
          text = iconv.decode(buf, encoding);
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(book.title)}.txt"`);
        res.send(text);
        return;
      }

      const contentTypes: Record<string, string> = {
        epub: 'application/epub+zip',
        pdf: 'application/pdf',
      };
      res.setHeader('Content-Type', contentTypes[book.format] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(book.title)}.${book.format}"`);
      res.sendFile(path.resolve(book.filePath));
    } catch (error) {
      logger.error('Failed to serve book file:', error);
      res.status(500).json({ error: 'Failed to serve book file' });
    }
  }

  async downloadZip(req: Request, res: Response): Promise<void> {
    try {
      const rawIds: unknown[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const ids = rawIds.filter((x): x is string => typeof x === 'string' && x.length > 0);
      if (!ids.length) {
        res.status(400).json({ error: 'ids is required' });
        return;
      }

      const books = ids
        .map((id) => bookService.getById(id))
        .filter((book): book is Book => !!book && fs.existsSync(book.filePath));
      if (!books.length) {
        res.status(404).json({ error: 'No downloadable books found' });
        return;
      }

      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();

      // zip 內檔名：過濾路徑非法字元，同名書加序號避免互相覆蓋
      const usedNames = new Set<string>();
      for (const book of books) {
        const safeTitle = book.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || book.id;
        let name = `${safeTitle}.${book.format}`;
        let n = 2;
        while (usedNames.has(name)) {
          name = `${safeTitle} (${n++}).${book.format}`;
        }
        usedNames.add(name);
        zip.addFile(name, fs.readFileSync(book.filePath));
      }

      const buf = zip.toBuffer();
      const stamp = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="readflix-books-${stamp}.zip"`);
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    } catch (error) {
      logger.error('Failed to build zip:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to build zip' });
      }
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
