import { create } from 'zustand'
import { User } from '../types/index'

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
  setCurrentUser: (user) => set({ currentUser: user }),
}))
