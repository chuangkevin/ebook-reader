import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from '../config/database';
import { Book, BookFormat } from '../types';
import config from '../config/environment';
import logger from '../utils/logger';

interface BookMetadata {
  title: string;
  author: string;
}

interface BookRow {
  id: string; title: string; author: string; format: string; cover_path: string | null;
  file_path: string; file_size: number; uploaded_by: string; uploaded_at: number;
}

class BookService {
  getAll(): Book[] {
    const rows = db.prepare('SELECT * FROM books ORDER BY uploaded_at DESC').all() as BookRow[];
    return rows.map(this.mapRow);
  }

  getById(id: string): Book | null {
    const row = db.prepare('SELECT * FROM books WHERE id = ?').get(id) as BookRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async create(filePath: string, fileSize: number, uploadedBy: string, originalName: string, format: BookFormat): Promise<Book> {
    const id = crypto.randomUUID();
    const now = Date.now();

    // Extract metadata based on format
    let metadata: BookMetadata;
    try {
      metadata = await this.extractMetadata(filePath, format, originalName);
    } catch (error) {
      logger.warn(`Failed to extract metadata, using filename: ${error}`);
      const ext = path.extname(originalName);
      metadata = { title: path.basename(originalName, ext), author: 'Unknown' };
    }

    // Extract cover (EPUB and PDF only)
    let coverPath: string | null = null;
    if (format === 'epub') {
      try {
        coverPath = await this.extractEpubCover(filePath, id);
      } catch (error) {
        logger.warn(`Failed to extract EPUB cover: ${error}`);
      }
    } else if (format === 'pdf') {
      try {
        coverPath = await this.extractPdfCover(filePath, id);
      } catch (error) {
        logger.warn(`Failed to extract PDF cover: ${error}`);
      }
    }

    db.prepare(
      'INSERT INTO books (id, title, author, format, cover_path, file_path, file_size, uploaded_by, uploaded_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, metadata.title, metadata.author, format, coverPath, filePath, fileSize, uploadedBy, now);

    logger.info(`Book created: ${metadata.title} [${format}] (${id})`);

    return {
      id, title: metadata.title, author: metadata.author, format, coverPath, filePath, fileSize, uploadedBy, uploadedAt: now,
    };
  }

  delete(id: string): boolean {
    const book = this.getById(id);
    if (!book) return false;

    try {
      if (fs.existsSync(book.filePath)) fs.unlinkSync(book.filePath);
      if (book.coverPath && fs.existsSync(book.coverPath)) fs.unlinkSync(book.coverPath);
    } catch (error) {
      logger.error(`Failed to delete book files: ${error}`);
    }

    const result = db.prepare('DELETE FROM books WHERE id = ?').run(id);
    if (result.changes > 0) {
      logger.info(`Book deleted: ${id}`);
      return true;
    }
    return false;
  }

  // --- Metadata extraction ---

  private async extractMetadata(filePath: string, format: BookFormat, originalName: string): Promise<BookMetadata> {
    switch (format) {
      case 'epub':
        return this.extractEpubMetadata(filePath);
      case 'pdf':
        return this.extractPdfMetadata(filePath);
      case 'txt':
        return { title: path.basename(originalName, '.txt'), author: 'Unknown' };
      default:
        return { title: path.basename(originalName), author: 'Unknown' };
    }
  }

  private async extractEpubMetadata(filePath: string): Promise<BookMetadata> {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    let opfContent = '';
    for (const entry of entries) {
      if (entry.entryName.endsWith('.opf')) {
        opfContent = entry.getData().toString('utf8');
        break;
      }
    }

    if (!opfContent) throw new Error('No OPF file found in EPUB');

    const titleMatch = opfContent.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
    const authorMatch = opfContent.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);

    return {
      title: titleMatch ? titleMatch[1].trim() : 'Untitled',
      author: authorMatch ? authorMatch[1].trim() : 'Unknown',
    };
  }

  private async extractPdfMetadata(filePath: string): Promise<BookMetadata> {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, { max: 0 }); // max:0 = don't parse pages, just metadata

    return {
      title: data.info?.Title || path.basename(filePath, '.pdf'),
      author: data.info?.Author || 'Unknown',
    };
  }

  // --- Cover extraction ---

  private async extractEpubCover(filePath: string, bookId: string): Promise<string | null> {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    const coverPatterns = [/cover\.(jpg|jpeg|png|gif)/i, /cover-image/i, /frontcover/i];
    let coverEntry = null;

    for (const entry of entries) {
      const name = entry.entryName.toLowerCase();
      if (coverPatterns.some(p => p.test(name))) {
        coverEntry = entry;
        break;
      }
    }

    if (!coverEntry) {
      for (const entry of entries) {
        if (/\.(jpg|jpeg|png|gif)$/i.test(entry.entryName)) {
          coverEntry = entry;
          break;
        }
      }
    }

    if (!coverEntry) return null;

    const ext = path.extname(coverEntry.entryName).toLowerCase() || '.jpg';
    const coverFileName = `${bookId}${ext}`;
    const coverFilePath = path.join(config.storage.coversDir, coverFileName);

    fs.writeFileSync(coverFilePath, coverEntry.getData());
    logger.info(`Cover extracted: ${coverFilePath}`);
    return coverFilePath;
  }

  private async extractPdfCover(_filePath: string, _bookId: string): Promise<string | null> {
    // PDF cover extraction requires canvas/sharp which adds complexity.
    // For now, return null and use the placeholder SVG.
    // Could be added later with pdf-to-img or similar.
    return null;
  }

  private mapRow(row: BookRow): Book {
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      format: (row.format || 'epub') as BookFormat,
      coverPath: row.cover_path,
      filePath: row.file_path,
      fileSize: row.file_size,
      uploadedBy: row.uploaded_by,
      uploadedAt: row.uploaded_at,
    };
  }
}

export default new BookService();
