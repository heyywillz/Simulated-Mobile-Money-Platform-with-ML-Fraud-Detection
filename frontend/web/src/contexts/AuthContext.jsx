import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setAuthToken, getAuthToken } from '@momo/shared/src/api/client';
import * as api from '@momo/shared/src/api/endpoints';
import {
  generateDeviceProfile,
  generateEnrichedDeviceProfile,
  getStoredDeviceProfile,
  storeDeviceProfile,
} from '@momo/shared/src/utils/device';
import {
  captureLocation,
  detectExactLocation,
  getStoredLocation,
  setStoredLocation,
  checkLocationPermission,
  watchExactLocation,
} from '@momo/shared/src/utils/location';
import { useAppDispatch } from '../store/hooks';
import {
  setCredentials,
  setFacialVerified as setFacialVerifiedAction,
  logout as logoutAction,
  setCurrentLocation as setCurrentLocationAction,
  setDeviceProfile as setDeviceProfileAction,
  setLocationPermission as setLocationPermissionAction,
  setBalance,
  setTransactions,
  setAlerts,
  setHasNewAlert,
} from '../store';
import { loginUser } from '../../redux_store/features/dashboard';

const AuthContext = createContext(undefined);

function getInitialUser() {
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('momo_sim_user');
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return null;
}

export function AuthProvider({ children }) {
  const dispatch = useAppDispatch();
  const [user, setUser] = useState(() => getInitialUser());
  const [token, setToken] = useState(getAuthToken());
  const [sessionId, setSessionId] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [deviceProfile, setDeviceProfile] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(getStoredLocation());
  const [locationPermission, setLocationPermission] = useState('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [facialVerified, setFacialVerifiedState] = useState(() => {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('momo_facial_verified') === 'true';
    }
    return false;
  });

  const setFacialVerified = useCallback((verified) => {
    setFacialVerifiedState(verified);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('momo_facial_verified', verified ? 'true' : 'false');
    }
    dispatch(setFacialVerifiedAction(verified));
  }, [dispatch]);

  // Check permission & initialize device profile, user, and location
  useEffect(() => {
    const initialUser = getInitialUser();
    if (initialUser) {
      setUser(initialUser);
      dispatch(loginUser(initialUser));
    }

    let stored = getStoredDeviceProfile();
    if (!stored) {
      stored = generateDeviceProfile('web');
      storeDeviceProfile(stored);
    }
    setDeviceProfile(stored);
    dispatch(setDeviceProfileAction(stored));

    // Check location permission state
    checkLocationPermission().then((status) => {
      setLocationPermission(status);
      dispatch(setLocationPermissionAction(status));
    });

    // Auto-detect exact physical location where platform was opened
    detectExactLocation().then((loc) => {
      setCurrentLocation(loc);
      dispatch(setCurrentLocationAction(loc));
    }).finally(() => {
      setIsLoading(false);
    });

    // Start watching position if GPS is available
    const unwatch = watchExactLocation((newLoc) => {
      setCurrentLocation(newLoc);
      dispatch(setCurrentLocationAction(newLoc));
    });

    const handleLocChange = (e) => {
      if (e.detail) {
        setCurrentLocation(e.detail);
        dispatch(setCurrentLocationAction(e.detail));
      }
    };

    window.addEventListener('momo:location_changed', handleLocChange);
    return () => {
      if (unwatch) unwatch();
      window.removeEventListener('momo:location_changed', handleLocChange);
    };
  }, [dispatch]);

  const changeLocation = useCallback((loc) => {
    setStoredLocation(loc);
    setCurrentLocation(loc);
    dispatch(setCurrentLocationAction(loc));
  }, [dispatch]);

  const detectLocation = useCallback(async () => {
    const loc = await detectExactLocation();
    setCurrentLocation(loc);
    dispatch(setCurrentLocationAction(loc));
    const perm = await checkLocationPermission();
    setLocationPermission(perm);
    dispatch(setLocationPermissionAction(perm));
    return loc;
  }, [dispatch]);

  const requestLocationPermission = useCallback(async () => {
    const loc = await detectExactLocation();
    setCurrentLocation(loc);
    dispatch(setCurrentLocationAction(loc));
    const perm = await checkLocationPermission();
    setLocationPermission(perm);
    dispatch(setLocationPermissionAction(perm));
    return loc;
  }, [dispatch]);

  const requestOtp = useCallback(async (phoneNumber) => {
    try {
      const response = await api.requestOtp({ phoneNumber });
      return { success: true, otp: response.otp, message: response.message };
    } catch (err) {
      const message = err.response?.data?.error ?? 'Failed to send OTP. Please try again.';
      return { success: false, error: message };
    }
  }, []);

  const login = useCallback(
    async (credentials, otp) => {
      try {
        const location =
          currentLocation ||
          getStoredLocation() || {
            latitude: 5.6037,
            longitude: -0.187,
            city: 'Accra',
            region: 'Greater Accra',
            country: 'Ghana',
            source: 'default',
          };
        const dp = deviceProfile ?? generateDeviceProfile('web');

        const payload =
          typeof credentials === 'string'
            ? {
                phoneNumber: credentials,
                otp,
                deviceProfile: dp,
                location,
              }
            : {
                ...credentials,
                deviceProfile: dp,
                location,
              };

        const response = await api.login(payload);

        setUser(response.user);
        setToken(response.token);
        setSessionId(response.sessionId);
        setAuthToken(response.token);
        dispatch(loginUser(response.user));
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('momo_sim_user', JSON.stringify(response.user));
        }
        dispatch(
          setCredentials({
            user: response.user,
            token: response.token,
            sessionId: response.sessionId,
            activeSessions: response.activeSessions,
          })
        );
        return { success: true };
      } catch (err) {
        const message = err.response?.data?.error ?? err.message ?? 'Login failed. Please check your credentials.';
        return { success: false, error: message };
      }
    },
    [currentLocation, deviceProfile, dispatch]
  );

  const signup = useCallback(async (data) => {
    try {
      const location = currentLocation ?? (await detectExactLocation());
      const dp = deviceProfile ?? generateEnrichedDeviceProfile('web');
      const enrichedDp = generateEnrichedDeviceProfile('web');

      const registrationMetadata = {
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city,
        region: location.region,
        country: location.country,
        locationAccuracy: location.accuracy,
        locationSource: location.source,
        ip: location.ip,
        deviceId: dp.deviceId,
        deviceFingerprint: dp.fingerprint,
        deviceName: dp.deviceName || enrichedDp.deviceName,
        osName: dp.osName || enrichedDp.osName,
        browserName: dp.browserName || enrichedDp.browserName,
        gpuRenderer: dp.gpuRenderer || enrichedDp.gpuRenderer,
        cpuCores: dp.cpuCores || enrichedDp.cpuCores,
        memoryGb: dp.memoryGb || enrichedDp.memoryGb,
        platform: dp.platform,
        userAgent: dp.userAgent,
        screenResolution: dp.screenResolution || enrichedDp.screenResolution,
        devicePixelRatio: dp.devicePixelRatio || enrichedDp.devicePixelRatio,
        language: dp.language || enrichedDp.language,
        timezone: dp.timezone || enrichedDp.timezone,
        colorDepth: dp.colorDepth || enrichedDp.colorDepth,
        registeredAt: new Date().toISOString(),
      };

      const response = await api.signup({
        ...data,
        deviceProfile: dp,
        location,
        registrationMetadata,
      });

      setUser(response.user);
      setToken(response.token);
      setSessionId(response.sessionId);
      setAuthToken(response.token);
      setFacialVerifiedState(true);
      dispatch(setFacialVerifiedAction(true));
      dispatch(loginUser(response.user));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('momo_sim_user', JSON.stringify(response.user));
        if (data.password || data.pin) {
          localStorage.setItem('momo_user_password', data.password || data.pin);
        }
        localStorage.setItem('momo_sim_balance', '10000');
        localStorage.setItem('momo_sim_transactions', JSON.stringify([]));
        localStorage.setItem('momo_sim_alerts', JSON.stringify([]));
      }
      dispatch(setBalance({ available: 10000, ledger: 10000, currency: 'GHS' }));
      dispatch(setTransactions([]));
      dispatch(setAlerts([]));
      dispatch(setHasNewAlert(false));
      dispatch(
        setCredentials({
          user: response.user,
          token: response.token,
          sessionId: response.sessionId,
          activeSessions: response.activeSessions,
        })
      );
      return { success: true, user: response.user };
    } catch (err) {
      const message =
        err.response?.data?.message ??
        err.response?.data?.error ??
        err.message ??
        'Registration failed. Please check your details.';
      return { success: false, error: message };
    }
  }, [currentLocation, deviceProfile, dispatch]);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setSessionId(null);
    setAuthToken(null);
    setFacialVerifiedState(false);
    dispatch(loginUser(null));
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('momo_sim_user');
      localStorage.removeItem('momo_user_email');
      localStorage.removeItem('momo_user_password');
      localStorage.removeItem('momo_user_ghanaCard');
      localStorage.removeItem('momo_sim_transactions');
      localStorage.removeItem('momo_sim_alerts');
    }
    dispatch(setTransactions([]));
    dispatch(setAlerts([]));
    dispatch(setHasNewAlert(false));
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('momo_facial_verified');
      sessionStorage.removeItem('pending_biometric_type');
    }
    dispatch(logoutAction());
  }, [dispatch]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        sessionId,
        activeSessions,
        deviceProfile,
        currentLocation,
        locationPermission,
        changeLocation,
        detectLocation,
        requestLocationPermission,
        isAuthenticated: !!token && !!user,
        isLoading,
        requestOtp,
        login,
        signup,
        logout,
        setFacialVerified,
        facialVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
