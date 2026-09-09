import { createSlice } from '@reduxjs/toolkit';
import { getAuthToken, setAuthToken } from '@momo/shared/src/api/client';

const initialToken = getAuthToken();

const initialState = {
  user: null,
  token: initialToken,
  sessionId: null,
  activeSessions: [],
  isAuthenticated: !!initialToken,
  isLoading: false,
  facialVerified: false,
  error: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.sessionId = action.payload.sessionId ?? state.sessionId;
      state.activeSessions = action.payload.activeSessions ?? state.activeSessions;
      state.isAuthenticated = true;
      state.error = null;
      setAuthToken(action.payload.token);
    },
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setFacialVerified: (state, action) => {
      state.facialVerified = action.payload;
    },
    setAuthLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.sessionId = null;
      state.activeSessions = [];
      state.isAuthenticated = false;
      state.facialVerified = false;
      state.error = null;
      setAuthToken(null);
    },
  },
});

export const {
  setCredentials,
  setUser,
  setFacialVerified,
  setAuthLoading,
  setAuthError,
  logout,
} = authSlice.actions;

export default authSlice.reducer;
