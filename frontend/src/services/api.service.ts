import axios from 'axios';
import type { User, Book, ReadingProgress, ProgressWithBook } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

class ApiService {
  // Users
  async getUsers(): Promise<User[]> {
    const { data } = await api.get('/users');
    return data;
  }

  async createUser(name: string, avatarColor: string): Promise<User> {
    const { data } = await api.post('/users', { name, avatarColor });
    return data;
  }

  async updateUser(id: string, updates: Partial<Pick<User, 'name' | 'avatarColor'>>): Promise<User> {
    const { data } = await api.put(`/users/${id}`, updates);
    return data;
  }

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }

  // Books
  async getBooks(): Promise<Book[]> {
    const { data } = await api.get('/books');
    return data;
  }

  async uploadBook(file: File, uploadedBy: string, onProgress?: (percent: number) => void): Promise<Book> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('uploadedBy', uploadedBy);

    const { data } = await api.post('/books', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
      onUploadProgress: (event) => {
        if (event.total && onProgress) {
          onProgress(Math.round((event.loaded * 100) / event.total));
        }
      },
    });
    return data;
  }

  async deleteBook(id: string): Promise<void> {
    await api.delete(`/books/${id}`);
  }

  getBookFileUrl(bookId: string): string {
    return `/api/books/${bookId}/file`;
  }

  getBookCoverUrl(bookId: string): string {
    return `/api/books/${bookId}/cover`;
  }

  // Progress
  async getUserProgress(userId: string): Promise<ProgressWithBook[]> {
    const { data } = await api.get(`/users/${userId}/progress`);
    return data;
  }

  async getProgress(userId: string, bookId: string): Promise<ReadingProgress> {
    const { data } = await api.get(`/users/${userId}/books/${bookId}/progress`);
    return data;
  }

  async deleteProgress(userId: string, bookId: string): Promise<void> {
    await api.delete(`/users/${userId}/books/${bookId}/progress`);
  }

  async updateProgress(userId: string, bookId: string, cfi: string | null, percentage: number): Promise<ReadingProgress> {
    const { data } = await api.put(`/users/${userId}/books/${bookId}/progress`, { cfi, percentage });
    return data;
  }

  // Bookmarks
  async getBookmarks(userId: string): Promise<string[]> {
    const { data } = await api.get(`/users/${userId}/bookmarks`);
    return data;
  }

  async toggleBookmark(userId: string, bookId: string): Promise<{ bookmarked: boolean }> {
    const { data } = await api.post(`/users/${userId}/books/${bookId}/bookmark`);
    return data;
  }
}

export default new ApiService();
