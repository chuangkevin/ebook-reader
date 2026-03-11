export interface User {
  id: string;
  name: string;
  avatarColor: string;
  createdAt: number;
}

export type BookFormat = 'epub' | 'pdf' | 'txt';

export interface Book {
  id: string;
  title: string;
  author: string;
  format: BookFormat;
  coverPath: string | null;
  filePath: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: number;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  bookId: string;
  cfi: string | null;
  percentage: number;
  lastReadAt: number;
}

export interface ProgressWithBook extends ReadingProgress {
  title: string;
  author: string;
  coverPath: string | null;
}
