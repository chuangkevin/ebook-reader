import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { Book, ProgressWithBook } from '../types';
import apiService from '../services/api.service';

interface BookState {
  books: Book[];
  userProgress: ProgressWithBook[];
  isLoading: boolean;
  uploadProgress: number;
  error: string | null;
}

const initialState: BookState = {
  books: [],
  userProgress: [],
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
      .addCase(deleteBook.fulfilled, (state, action) => {
        state.books = state.books.filter(b => b.id !== action.payload);
        state.userProgress = state.userProgress.filter(p => p.bookId !== action.payload);
      });
  },
});

export const { setUploadProgress, addBook, clearError } = bookSlice.actions;
export default bookSlice.reducer;
