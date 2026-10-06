import { create } from 'zustand'
import { useBookStore } from './bookStore'
import type { User } from '../types/index'

interface UserState {
  users: User[]
  currentUser: User | null
  setUsers: (users: User[]) => void
  setCurrentUser: (user: User | null) => void
}

export const useUserStore = create<UserState>()((set) => ({
  users: [],
  currentUser: null,
  setUsers: (users) => set({ users }),
  setCurrentUser: (user) => {
    try {
      if (user) sessionStorage.setItem('readflix.reader', String(user.id))
      else sessionStorage.removeItem('readflix.reader')
    } catch { /* Restricted storage: retain the active in-memory selection. */ }
    useBookStore.setState({ books: [], currentBook: null })
    set({ currentUser: user })
  },
}))
