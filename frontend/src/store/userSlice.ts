import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../types';
import apiService from '../services/api.service';

interface UserState {
  users: User[];
  currentUser: User | null;
  isLoading: boolean;
  error: string | null;
}

const savedUser = localStorage.getItem('currentUser');

const initialState: UserState = {
  users: [],
  currentUser: savedUser ? JSON.parse(savedUser) : null,
  isLoading: false,
  error: null,
};

export const fetchUsers = createAsyncThunk('user/fetchUsers', async () => {
  return await apiService.getUsers();
});

export const createUser = createAsyncThunk(
  'user/createUser',
  async ({ name, avatarColor }: { name: string; avatarColor: string }) => {
    return await apiService.createUser(name, avatarColor);
  }
);

export const deleteUser = createAsyncThunk('user/deleteUser', async (id: string) => {
  await apiService.deleteUser(id);
  return id;
});

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    selectUser(state, action: PayloadAction<User | null>) {
      state.currentUser = action.payload;
      if (action.payload) {
        localStorage.setItem('currentUser', JSON.stringify(action.payload));
      } else {
        localStorage.removeItem('currentUser');
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.users = action.payload;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'Failed to fetch users';
      })
      .addCase(createUser.fulfilled, (state, action) => {
        state.users.push(action.payload);
      })
      .addCase(createUser.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to create user';
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.users = state.users.filter(u => u.id !== action.payload);
        if (state.currentUser?.id === action.payload) {
          state.currentUser = null;
          localStorage.removeItem('currentUser');
        }
      });
  },
});

export const { selectUser, clearError } = userSlice.actions;
export default userSlice.reducer;
