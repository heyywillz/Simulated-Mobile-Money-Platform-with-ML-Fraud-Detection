import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@momo/shared/src/api/endpoints';

const initialState = {
  balance: null,
  showBalance: true,
  isLoading: false,
  error: null,
};

export const fetchWalletBalance = createAsyncThunk(
  'wallet/fetchBalance',
  async (_, { rejectWithValue }) => {
    try {
      const balance = await api.getBalance();
      return balance;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch balance');
    }
  }
);

export const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance: (state, action) => {
      state.balance = action.payload;
    },
    toggleShowBalance: (state) => {
      state.showBalance = !state.showBalance;
    },
    setShowBalance: (state, action) => {
      state.showBalance = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchWalletBalance.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchWalletBalance.fulfilled, (state, action) => {
        state.isLoading = false;
        state.balance = action.payload;
      })
      .addCase(fetchWalletBalance.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { setBalance, toggleShowBalance, setShowBalance } = walletSlice.actions;
export default walletSlice.reducer;
