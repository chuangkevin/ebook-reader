import { configureStore } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import bookReducer from './bookSlice';
import readerReducer from './readerSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    books: bookReducer,
    reader: readerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
