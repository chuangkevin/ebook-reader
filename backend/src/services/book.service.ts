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
  collection: string | null;
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

  checkDuplicate(title: string): Book | null {
    const row = db.prepare('SELECT * FROM books WHERE title = ?').get(title) as BookRow | undefined;
    return row ? this.mapRow(row) : null;
  }

  async create(filePath: string, fileSize: number, uploadedBy: string, originalName: string, format: BookFormat, collection?: string | null): Promise<Book> {
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

    // 檢查重複書名
    const existing = this.checkDuplicate(metadata.title);
    if (existing) {
      // 清理已上傳的檔案
      fs.unlinkSync(filePath);
      throw new Error(`DUPLICATE:${metadata.title}`);
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

    const normalizedCollection = collection ? collection.trim() || null : null;

    db.prepare(
      'INSERT INTO books (id, title, author, format, cover_path, file_path, file_size, uploaded_by, uploaded_at, collection) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(id, metadata.title, metadata.author, format, coverPath, filePath, fileSize, uploadedBy, now, normalizedCollection);

    logger.info(`Book created: ${metadata.title} [${format}] (${id})`);

    return {
      id, title: metadata.title, author: metadata.author, format, coverPath, filePath, fileSize, uploadedBy, uploadedAt: now, collection: normalizedCollection,
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
    // 從原始檔名取得書名（去除副檔名）
    const nameFromFile = path.basename(originalName, path.extname(originalName));

    switch (format) {
      case 'epub':
        return this.extractEpubMetadata(filePath);
      case 'pdf':
        return this.extractPdfMetadata(filePath, nameFromFile);
      case 'txt':
        return { title: nameFromFile, author: 'Unknown' };
      default:
        return { title: nameFromFile, author: 'Unknown' };
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

  private async extractPdfMetadata(filePath: string, fallbackTitle: string): Promise<BookMetadata> {
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer, { max: 0 });

    return {
      title: data.info?.Title || fallbackTitle,
      author: data.info?.Author || 'Unknown',
    };
  }

  // --- Cover extraction ---

  private async extractEpubCover(filePath: string, bookId: string): Promise<string | null> {
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Step 1: 從 OPF 的 <meta name="cover"> 找到 cover image id，再從 manifest 找到對應檔案路徑
    let coverHref: string | null = null;
    let opfDir = '';

    for (const entry of entries) {
      if (entry.entryName.endsWith('.opf')) {
        const opf = entry.getData().toString('utf8');
        opfDir = entry.entryName.replace(/[^/]*$/, '');

        // 找 <meta name="cover" content="coverId" />
        const coverMeta = opf.match(/<meta[^>]*name\s*=\s*["']cover["'][^>]*content\s*=\s*["']([^"']+)["'][^>]*>/i)
          || opf.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*name\s*=\s*["']cover["'][^>]*>/i);

        if (coverMeta) {
          const coverId = coverMeta[1];
          // 從 manifest 找對應的 item
          const itemRegex = new RegExp(`<item[^>]*id\\s*=\\s*["']${coverId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*href\\s*=\\s*["']([^"']+)["']`, 'i');
          const itemMatch = opf.match(itemRegex);
          if (!itemMatch) {
            // 試另一種屬性順序
            const altRegex = new RegExp(`<item[^>]*href\\s*=\\s*["']([^"']+)["'][^>]*id\\s*=\\s*["']${coverId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i');
            const altMatch = opf.match(altRegex);
            if (altMatch) coverHref = altMatch[1];
          } else {
            coverHref = itemMatch[1];
          }
        }

        // Step 2: 沒有 meta cover 的話，找 manifest 中 properties="cover-image" 的 item（EPUB3）
        if (!coverHref) {
          const coverImgItem = opf.match(/<item[^>]*properties\s*=\s*["']cover-image["'][^>]*href\s*=\s*["']([^"']+)["']/i)
            || opf.match(/<item[^>]*href\s*=\s*["']([^"']+)["'][^>]*properties\s*=\s*["']cover-image["']/i);
          if (coverImgItem) coverHref = coverImgItem[1];
        }

        break;
      }
    }

    // 解析出完整路徑
    let coverEntry = null;
    if (coverHref) {
      const fullPath = opfDir + coverHref;
      coverEntry = entries.find(e => e.entryName === fullPath)
        || entries.find(e => e.entryName.toLowerCase() === fullPath.toLowerCase());
    }

    // Step 3: fallback - 用檔名 pattern 找
    if (!coverEntry) {
      // 優先找含 cover 且是圖片的（排除 .xhtml/.html）
      for (const entry of entries) {
        if (/cover.*\.(jpg|jpeg|png|gif)$/i.test(entry.entryName) && !/\.xhtml?$/i.test(entry.entryName)) {
          coverEntry = entry;
          break;
        }
      }
    }

    // Step 4: fallback - 找最大的圖片檔（封面通常最大）
    if (!coverEntry) {
      let maxSize = 0;
      for (const entry of entries) {
        if (/\.(jpg|jpeg|png|gif)$/i.test(entry.entryName)) {
          const size = entry.getData().length;
          if (size > maxSize) {
            maxSize = size;
            coverEntry = entry;
          }
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
      collection: row.collection ?? null,
    };
  }
}

export default new BookService();
