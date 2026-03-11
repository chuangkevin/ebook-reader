import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Book, ProgressWithBook } from '../types';
import apiService from '../services/api.service';

interface BookState {
  books: Book[];
  userProgress: ProgressWithBook[];
  bookmarks: string[];
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
}

const initialState: BookState = {
  books: [],
  userProgress: [],
  bookmarks: [],
  isLoading: false,
  uploadProgress: 0,
  error: null,
};

export const fetchBooks = createAsyncThunk('books/fetchBooks', async () => {
  return await apiService.getBooks();
});

export const fetchUserProgress = createAsyncThunk(
  'books/fetchUserProgress',
  async (userId: string) => {
    return await apiService.getUserProgress(userId);
  }
);

export const fetchBookmarks = createAsyncThunk(
  'books/fetchBookmarks',
  async (userId: string) => {
    return await apiService.getBookmarks(userId);
  }
);

export const toggleBookmark = createAsyncThunk(
  'books/toggleBookmark',
  async ({ userId, bookId }: { userId: string; bookId: string }) => {
    const result = await apiService.toggleBookmark(userId, bookId);
    return { bookId, bookmarked: result.bookmarked };
  }
);

export const deleteBook = createAsyncThunk('books/deleteBook', async (id: string) => {
  await apiService.deleteBook(id);
  return id;
});

const bookSlice = createSlice({
  name: 'books',
  initialState,
  reducers: {
    setUploadProgress(state, action) {
      state.uploadProgress = action.payload;
    },
    addBook(state, action) {
      state.books.unshift(action.payload);
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBooks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchBooks.fulfilled, (state, action) => {
        state.isLoading = false;
        state.books = action.payload;
      })
      .addCase(fetchBooks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch books';
      })
      .addCase(fetchUserProgress.fulfilled, (state, action) => {
        state.userProgress = action.payload;
      })
      .addCase(fetchBookmarks.fulfilled, (state, action) => {
        state.bookmarks = action.payload;
      })
      .addCase(toggleBookmark.fulfilled, (state, action) => {
        const { bookId, bookmarked } = action.payload;
        if (bookmarked) {
          if (!state.bookmarks.includes(bookId)) state.bookmarks.push(bookId);
        } else {
          state.bookmarks = state.bookmarks.filter(id => id !== bookId);
        }
      })
      .addCase(deleteBook.fulfilled, (state, action) => {
        state.books = state.books.filter(b => b.id !== action.payload);
        state.userProgress = state.userProgress.filter(p => p.bookId !== action.payload);
        state.bookmarks = state.bookmarks.filter(id => id !== action.payload);
      });
  },
});

export const { setUploadProgress, addBook, clearError } = bookSlice.actions;
export default bookSlice.reducer;
