import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Book } from '../types';

interface ReaderState {
  currentBook: Book | null;
  currentCfi: string | null;
  percentage: number;
}

const initialState: ReaderState = {
  currentBook: null,
  currentCfi: null,
  percentage: 0,
};

const readerSlice = createSlice({
  name: 'reader',
  initialState,
  reducers: {
    setCurrentBook(state, action: PayloadAction<Book | null>) {
      state.currentBook = action.payload;
      state.currentCfi = null;
      state.percentage = 0;
    },
    setLocation(state, action: PayloadAction<{ cfi: string | null; percentage: number }>) {
      state.currentCfi = action.payload.cfi;
      state.percentage = action.payload.percentage;
    },
    clearReader(state) {
      state.currentBook = null;
      state.currentCfi = null;
      state.percentage = 0;
    },
  },
});

export const { setCurrentBook, setLocation, clearReader } = readerSlice.actions;
export default readerSlice.reducer;
