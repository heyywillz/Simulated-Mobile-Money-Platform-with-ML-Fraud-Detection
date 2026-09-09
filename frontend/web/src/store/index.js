import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import walletReducer from './slices/walletSlice';
import transactionsReducer from './slices/transactionsSlice';
import alertsReducer from './slices/alertsSlice';
import telemetryReducer from './slices/telemetrySlice';
import userSliceReducer from '../../redux_store/features/dashboard';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wallet: walletReducer,
    transactions: transactionsReducer,
    alerts: alertsReducer,
    telemetry: telemetryReducer,
    dashboard: userSliceReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export * from './slices/authSlice';
export * from './slices/walletSlice';
export * from './slices/transactionsSlice';
export * from './slices/alertsSlice';
export * from './slices/telemetrySlice';
