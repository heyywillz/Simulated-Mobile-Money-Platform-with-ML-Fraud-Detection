import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@momo/shared/src/api/endpoints';

const initialState = {
  transactions: [],
  isLoading: false,
  error: null,
};

export const fetchTransactions = createAsyncThunk(
  'transactions/fetchTransactions',
  async (params, { rejectWithValue }) => {
    try {
      const queryParams = typeof params === 'number' ? { limit: params } : params;
      const txns = await api.getTransactions(queryParams);
      return txns;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch transactions');
    }
  }
);

export const transactionsSlice = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    setTransactions: (state, action) => {
      state.transactions = action.payload;
    },
    addTransaction: (state, action) => {
      const exists = state.transactions.some((t) => t.id === action.payload.id);
      if (!exists) {
        state.transactions.unshift(action.payload);
      }
    },
    updateTransactionStatus: (state, action) => {
      const { id, status, reason } = action.payload;
      const tx = state.transactions.find((t) => t.id === id);
      if (tx) {
        tx.status = status;
        if (reason !== undefined) tx.reason = reason;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchTransactions.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.transactions = action.payload;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

export const { setTransactions, addTransaction, updateTransactionStatus } = transactionsSlice.actions;
export default transactionsSlice.reducer;
