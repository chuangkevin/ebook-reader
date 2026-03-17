import { create } from 'zustand'
import { Book } from '../types/index'

interface BookState {
  books: Book[]
  currentBook: Book | null
  setBooks: (books: Book[]) => void
  setCurrentBook: (book: Book | null) => void
  updateBookProgress: (bookId: number, progress: string) => void
}

export const useBookStore = create<BookState>()((set) => ({
  books: [],
  currentBook: null,
  setBooks: (books) => set({ books }),
  setCurrentBook: (book) => set({ currentBook: book }),
  updateBookProgress: (bookId, progress) =>
    set((state) => ({
      books: state.books.map((book) =>
        book.id === bookId ? { ...book, progress } : book
      ),
      currentBook:
        state.currentBook?.id === bookId
          ? { ...state.currentBook, progress }
          : state.currentBook,
    })),
}))
