import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as api from '@momo/shared/src/api/endpoints';

const initialState = {
  alerts: [],
  hasNewAlert: false,
  isLoading: false,
  error: null,
};

export const fetchAlerts = createAsyncThunk(
  'alerts/fetchAlerts',
  async (_, { rejectWithValue }) => {
    try {
      const alerts = await api.getAlerts();
      return alerts;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to fetch alerts');
    }
  }
);

export const markAlertAsRead = createAsyncThunk(
  'alerts/markAlertAsRead',
  async (alertId, { rejectWithValue }) => {
    try {
      await api.markAlertRead(alertId);
      return alertId;
    } catch (err) {
      return rejectWithValue(err.message || 'Failed to mark alert as read');
    }
  }
);

export const alertsSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlerts: (state, action) => {
      state.alerts = action.payload;
    },
    addAlert: (state, action) => {
      state.alerts.unshift(action.payload);
      state.hasNewAlert = true;
    },
    setHasNewAlert: (state, action) => {
      state.hasNewAlert = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAlerts.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.alerts = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      .addCase(markAlertAsRead.fulfilled, (state, action) => {
        const target = state.alerts.find((a) => a.id === action.payload);
        if (target) {
          target.read = true;
        }
      });
  },
});

export const { setAlerts, addAlert, setHasNewAlert } = alertsSlice.actions;
export default alertsSlice.reducer;
