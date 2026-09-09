import { createSlice } from '@reduxjs/toolkit';
import { getStoredLocation } from '@momo/shared/src/utils/location';

const initialState = {
  currentLocation: getStoredLocation(),
  deviceProfile: null,
  locationPermission: 'prompt',
};

export const telemetrySlice = createSlice({
  name: 'telemetry',
  initialState,
  reducers: {
    setCurrentLocation: (state, action) => {
      state.currentLocation = action.payload;
    },
    setDeviceProfile: (state, action) => {
      state.deviceProfile = action.payload;
    },
    setLocationPermission: (state, action) => {
      state.locationPermission = action.payload;
    },
  },
});

export const { setCurrentLocation, setDeviceProfile, setLocationPermission } =
  telemetrySlice.actions;

export default telemetrySlice.reducer;
