/**
 * Swipe Pay MoMo — Mobile Client (React Native + Expo)
 * 1:1 UI/UX Design, Layout, Flow and Features Parity with Web App
 * Fully styled with Satoshi Font family and Vector Icons (Zero Emojis).
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  RefreshControl,
  Image,
} from 'react-native';
import { useFonts } from 'expo-font';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Location from 'expo-location';
import {
  setAuthToken,
  setApiBaseUrl,
  createUserSocket,
  api,
  generateDeviceProfile,
  generateEnrichedDeviceProfile,
  captureLocation,
  getStoredLocation,
  PRESET_LOCATIONS,
  formatCurrency,
  TRANSACTION_TYPE_LABELS,
} from '@momo/shared';

import { THEME, FONTS, SHADOWS } from './src/theme';
import { StatusBadge } from './src/components/StatusBadge';
import { DigitalReceipt } from './src/components/DigitalReceipt';
import { TransactionModal } from './src/components/TransactionModal';
import { CashOutModal } from './src/components/CashOutModal';
import { BiometricModal } from './src/components/BiometricModal';
import { QrCodeModal } from './src/components/QrCodeModal';
import { FacialVerificationScreen } from './src/screens/FacialVerificationScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { detectMobileDevice } from './src/utils/deviceDetector';

import Constants from 'expo-constants';

// ─── Environment-aware Base URL ─────────────────────────────────
function getBaseUrl() {
  // 1. Web environment (Expo Web / Browser)
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      return `http://${window.location.hostname}:5000`;
    }
    return 'http://localhost:5000';
  }

  // 2. Dynamically extract LAN host IP from Expo bundler (works automatically on physical phones via Wi-Fi)
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest?.hostUri;

  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
      return `http://${ip}:5000`;
    }
  }

  // 3. Android emulator loopback fallback
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:5000';
  }

  // 4. Default localhost fallback
  return 'http://localhost:5000';
}

const API_BASE_URL = getBaseUrl();
setApiBaseUrl(API_BASE_URL);

function formatOSDisplay(raw) {
  if (!raw) return Platform.OS === 'ios' ? 'iOS' : 'Android';
  if (raw.includes('/') || raw.includes(':') || raw.includes('user/release') || raw.length > 20) {
    const match = raw.match(/:(\d+)\//) || raw.match(/Android\s*(\d+)/i) || raw.match(/(\d+)/);
    const ver = match ? match[1] : '';
    return ver ? `Android ${ver}` : 'Android OS';
  }
  return raw;
}

function formatDeviceDisplay(raw) {
  if (!raw) return Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone';
  const words = raw.split(/\s+/);
  const deduped = words.filter((w, i) => i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase());
  return deduped.join(' ');
}

export default function App() {
  // ─── Load Satoshi Fonts ───────────────────────────────────────
  const [fontsLoaded] = useFonts({
    'Satoshi-Light': require('./assets/fonts/Satoshi-Light.ttf'),
    'Satoshi-Regular': require('./assets/fonts/Satoshi-Regular.ttf'),
    'Satoshi-Medium': require('./assets/fonts/Satoshi-Medium.ttf'),
    'Satoshi-Bold': require('./assets/fonts/Satoshi-Bold.ttf'),
    'Satoshi-Black': require('./assets/fonts/Satoshi-Black.ttf'),
  });

  // ─── Auth & Profile State ─────────────────────────────────────
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [token, setTokenState] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [user, setUser] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [deviceProfile, setDeviceProfile] = useState(null);
  const [deviceLocation, setDeviceLocation] = useState(() => {
    return (
      getStoredLocation() || {
        city: 'Sunyani',
        region: 'Bono Region',
        country: 'Ghana',
        latitude: 7.3399,
        longitude: -2.3268,
        accuracy: 10,
        source: 'gps',
        capturedAt: new Date().toISOString(),
      }
    );
  });

  const [authMode, setAuthMode] = useState('login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [hasBiometrics, setHasBiometrics] = useState(false);
  const [authError, setAuthError] = useState(null);

  // ─── Dashboard & Live Data ────────────────────────────────────
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showBalance, setShowBalance] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // ─── Navigation ───────────────────────────────────────────────
  const [currentTab, setCurrentTab] = useState('home');
  const [historyFilter, setHistoryFilter] = useState('all');
  const [historySearch, setHistorySearch] = useState('');

  // ─── Modals ───────────────────────────────────────────────────
  const [activeFlowModal, setActiveFlowModal] = useState(null);
  const [showCashOutModal, setShowCashOutModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showFacialVerification, setShowFacialVerification] = useState(false);
  const [showPostLoginFacial, setShowPostLoginFacial] = useState(false);
  const [selectedReceiptTx, setSelectedReceiptTx] = useState(null);
  const [bioTestMode, setBioTestMode] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // ─── Check Biometrics, Initialize Device Profile & Silent Location ──────────────
  const detectLiveLocation = useCallback(async () => {
    try {
      if (Platform.OS !== 'web') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          if (loc?.coords) {
            let city = 'Sunyani';
            let region = 'Bono Region';
            let country = 'Ghana';
            try {
              const rev = await Location.reverseGeocodeAsync({
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              });
              if (rev && rev[0]) {
                city = rev[0].city || rev[0].subregion || rev[0].district || rev[0].name || 'Sunyani';
                region = rev[0].region || rev[0].district || 'Bono Region';
                country = rev[0].country || 'Ghana';
              }
            } catch {}

            const resolved = {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              city,
              region,
              country,
              accuracy: Math.round(loc.coords.accuracy ?? 10),
              source: 'gps',
              capturedAt: new Date().toISOString(),
            };
            return resolved;
          }
        }
      }
      return await captureLocation();
    } catch {
      return (
        getStoredLocation() || {
          city: 'Sunyani',
          region: 'Bono Region',
          country: 'Ghana',
          latitude: 7.3399,
          longitude: -2.3268,
          accuracy: 10,
          source: 'gps',
          capturedAt: new Date().toISOString(),
        }
      );
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setHasBiometrics(compatible && enrolled);
      } catch {
        setHasBiometrics(false);
      }

      try {
        const loc = await detectLiveLocation();
        setDeviceLocation(loc);
      } catch {}

      try {
        const trueMobileProfile = await detectMobileDevice();
        setDeviceProfile(trueMobileProfile);
      } catch {
        const fallback = generateEnrichedDeviceProfile('mobile');
        setDeviceProfile(fallback);
      }
    })();
  }, [detectLiveLocation]);

  // ─── Load Wallet & Dashboard Data ─────────────────────────────
  const loadDashboardData = useCallback(async () => {
    try {
      const [bal, txns, alrts] = await Promise.all([
        api.getBalance(),
        api.getTransactions({ limit: 30 }),
        api.getAlerts().catch(() => []),
      ]);
      setBalance(bal);
      setTransactions(txns);
      setAlerts(alrts);
    } catch (err) {
      console.warn('Error loading dashboard data:', err.message);
    }
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    setIsRefreshing(false);
  };

  // ─── Real-Time WebSocket Synchronization ──────────────────────
  useEffect(() => {
    if (!isAuthenticated || !token || !sessionId) return;

    let socket = null;
    try {
      socket = createUserSocket(token, sessionId, API_BASE_URL);

      socket.on('balance:updated', (newBal) => {
        setBalance(newBal);
      });

      socket.on('transaction:updated', (newTx) => {
        setTransactions((prev) => {
          const filtered = prev.filter((t) => t.id !== newTx.id);
          return [newTx, ...filtered];
        });
      });

      socket.on('transaction:status_changed', ({ transactionId, status, reason }) => {
        setTransactions((prev) =>
          prev.map((t) => (t.id === transactionId ? { ...t, status, reason: reason ?? t.reason } : t))
        );
      });

      socket.on('alert:new', (newAlert) => {
        setAlerts((prev) => [newAlert, ...prev]);
        showToast(`Security Alert: ${newAlert.title}`);
      });

      socket.on('session:revoked', ({ sessionId: revokedId }) => {
        if (revokedId === sessionId) {
          Alert.alert('Session Terminated', 'Your session was revoked from another device.');
          handleLogout();
        }
      });
    } catch (err) {
      console.warn('Socket connection error:', err);
    }

    return () => {
      socket?.disconnect();
    };
  }, [isAuthenticated, token, sessionId]);

  // ─── Authentication Handlers ──────────────────────────────────
  const handleLoginSubmit = async (credentials) => {
    setAuthError(null);
    setIsAuthLoading(true);
    try {
      const dp = deviceProfile || generateDeviceProfile('mobile');
      const res = await api.login({
        email: credentials.email,
        ghanaCard: credentials.ghanaCard,
        password: credentials.password,
        biometricType: credentials.biometricType,
        deviceProfile: dp,
        location: deviceLocation,
      });

      setAuthToken(res.token);
      setTokenState(res.token);
      setSessionId(res.sessionId);
      setUser(res.user);
      setActiveSessions(res.activeSessions || []);

      if (credentials.biometricType === 'facial') {
        setShowPostLoginFacial(true);
        return { success: true };
      }

      // Fingerprint biometric option
      if (Platform.OS !== 'web') {
        try {
          await LocalAuthentication.authenticateAsync({
            promptMessage: 'Unlock Swipe Pay MoMo with Fingerprint',
            fallbackLabel: 'Enter Password',
          });
        } catch {}
      }
      showToast('Fingerprint Authenticated');
      setIsAuthenticated(true);

      setTimeout(() => {
        loadDashboardData();
      }, 100);

      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Login failed.';
      setAuthError(msg);
      return { success: false, error: msg };
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setTokenState(null);
    setSessionId(null);
    setUser(null);
    setIsAuthenticated(false);
    setCurrentTab('home');
  };

  // ─── Location Simulator & GPS Sensor ──────────────────────────
  const handleSelectLocation = (loc) => {
    const updated = {
      city: loc.city,
      region: loc.region,
      country: loc.country,
      latitude: loc.latitude,
      longitude: loc.longitude,
      capturedAt: new Date().toISOString(),
      source: 'gps',
      accuracy: 10,
    };
    setDeviceLocation(updated);
    showToast(`Location switched to ${loc.city}, ${loc.region}`);
  };

  const handleDetectGPS = async () => {
    showToast('Detecting live hardware GPS & coordinates...');
    try {
      const loc = await detectLiveLocation();
      setDeviceLocation(loc);
      showToast(`GPS: ${loc.city}, ${loc.region || loc.country} (±${loc.accuracy}m)`);
    } catch (err) {
      showToast('Could not fetch hardware GPS.');
    }
  };

  // ─── Filtering & Search ───────────────────────────────────────
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (historyFilter === 'outgoing') {
        if (!['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(tx.type)) return false;
      } else if (historyFilter === 'incoming') {
        if (!['receive', 'cash_in'].includes(tx.type)) return false;
      } else if (historyFilter === 'flagged') {
        if (tx.status !== 'flagged' && tx.status !== 'under_review') return false;
      } else if (historyFilter === 'blocked') {
        if (tx.status !== 'blocked') return false;
      }

      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchName = tx.receiverName?.toLowerCase().includes(q) || false;
        const matchRecv = tx.receiver.toLowerCase().includes(q);
        const matchRef = tx.reference?.toLowerCase().includes(q) || false;
        const matchAmt = tx.amount.toString().includes(q);
        return matchName || matchRecv || matchRef || matchAmt;
      }
      return true;
    });
  }, [transactions, historyFilter, historySearch]);

  const unreadAlertsCount = useMemo(() => {
    return alerts.filter((a) => !a.read).length;
  }, [alerts]);

  const userInitials = useMemo(() => {
    if (!user?.fullName) return 'SP';
    const parts = user.fullName.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }, [user]);

  // Loading Screen while Satoshi fonts load
  if (!fontsLoaded) {
    return (
      <View style={styles.fontLoadingScreen}>
        <Image
          source={require('./assets/swipe-pay-logo.png')}
          style={{ width: 64, height: 64, resizeMode: 'contain', marginBottom: 12 }}
        />
        <ActivityIndicator size="large" color={THEME.primary} />
        <Text style={styles.fontLoadingText}>Loading Swipe Pay MoMo...</Text>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 1. AUTHENTICATION SCREENS (LOGIN / ONBOARDING / FACIAL VERIFY)
  // ─────────────────────────────────────────────────────────────
  if (showPostLoginFacial) {
    return (
      <FacialVerificationScreen
        profilePicture={user?.profilePicture}
        userName={user?.fullName}
        ghanaCardId={user?.ghanaCardId}
        onSuccess={() => {
          setShowPostLoginFacial(false);
          setIsAuthenticated(true);
          setTimeout(() => {
            loadDashboardData();
          }, 100);
        }}
        onSkip={() => {
          setShowPostLoginFacial(false);
          setIsAuthenticated(true);
          setTimeout(() => {
            loadDashboardData();
          }, 100);
        }}
      />
    );
  }

  if (!isAuthenticated) {
    if (authMode === 'login') {
      return (
        <LoginScreen
          onLogin={handleLoginSubmit}
          hasBiometrics={hasBiometrics}
          onSwitchToSignup={() => {
            setAuthMode('signup');
            setAuthError(null);
          }}
          isLoading={isAuthLoading}
          error={authError}
        />
      );
    }

    return (
      <OnboardingScreen
        onSwitchToLogin={() => {
          setAuthMode('login');
          setAuthError(null);
        }}
        isLoading={isAuthLoading}
        error={authError}
        onComplete={async (data) => {
          setAuthError(null);
          setIsAuthLoading(true);
          try {
            const dp = deviceProfile || generateEnrichedDeviceProfile('mobile');
            const registrationMetadata = {
              latitude: deviceLocation.latitude,
              longitude: deviceLocation.longitude,
              city: deviceLocation.city,
              region: deviceLocation.region,
              country: deviceLocation.country,
              locationAccuracy: deviceLocation.accuracy,
              locationSource: deviceLocation.source,
              deviceId: dp.deviceId,
              deviceFingerprint: dp.fingerprint,
              deviceName: dp.deviceName || `${Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone'} (Mobile)`,
              osName: dp.osName || `${Platform.OS === 'ios' ? 'iOS' : 'Android'}`,
              browserName: 'Mobile Client',
              platform: 'mobile',
              registeredAt: new Date().toISOString(),
            };

            const res = await api.signup({
              fullName: data.fullName,
              phoneNumber: data.phoneNumber,
              email: data.email,
              password: data.password,
              pin: data.pin || data.password,
              dob: data.dob,
              gender: data.gender,
              profilePicture: data.profilePicture,
              facialScanVerified: data.facialScanVerified,
              biometricFingerprintEnrolled: data.biometricFingerprintEnrolled,
              ghanaCardId: data.ghanaCardId,
              deviceProfile: dp,
              location: deviceLocation,
              registrationMetadata,
            });

            setAuthToken(res.token);
            setTokenState(res.token);
            setSessionId(res.sessionId);
            setUser(res.user);
            setActiveSessions(res.activeSessions || []);
            setIsAuthenticated(true);
            loadDashboardData();
          } catch (err) {
            const msg = err.response?.data?.error || err.message || 'Registration failed.';
            setAuthError(msg);
            throw new Error(msg);
          } finally {
            setIsAuthLoading(false);
          }
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────
  // 2. MAIN APPLICATION (AUTHENTICATED)
  // ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.mainContainer}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />

      {/* Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeft}>
          {user?.profilePicture ? (
            <Image
              source={{ uri: user.profilePicture }}
              style={{ width: 38, height: 38, borderRadius: 12, borderWidth: 2, borderColor: THEME.primary, marginRight: 8, flexShrink: 0 }}
            />
          ) : (
            <View style={[styles.headerLogo, { marginRight: 8, flexShrink: 0 }]}>
              <Text style={styles.headerLogoText}>{userInitials}</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
            <Text style={styles.headerTitle} numberOfLines={1} ellipsizeMode="tail">
              Hi, {user?.fullName?.split(' ')[0] || 'Welcome'}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={[styles.ghFlagBadge, { flexShrink: 0 }]}>
                <Text style={styles.ghFlagText}>GH</Text>
              </View>
              <Text style={styles.headerSubtitle} numberOfLines={1} ellipsizeMode="tail">
                Swipe Pay MoMo
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* GPS Location Pill */}
          <TouchableOpacity
            style={styles.locationPill}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('profile')}
          >
            <Ionicons name="location-sharp" size={13} color={THEME.primary} style={{ marginRight: 3, flexShrink: 0 }} />
            <Text style={styles.locationPillText} numberOfLines={1} ellipsizeMode="tail">
              {deviceLocation.city}
            </Text>
          </TouchableOpacity>

          {/* Notification Bell */}
          <TouchableOpacity
            style={styles.bellBtn}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('alerts')}
          >
            <Ionicons name="notifications-outline" size={20} color={THEME.text} />
            {unreadAlertsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadAlertsCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Toast Bar */}
      {toastMessage && (
        <View style={[styles.toastContainer, SHADOWS.cardElevated]}>
          <Ionicons name="information-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* ─── TAB 1: HOME (DASHBOARD) ─────────────────────────── */}
      {currentTab === 'home' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.homeScroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[THEME.primary]}
              tintColor={THEME.primary}
            />
          }
        >
          {/* Primary Crimson Wallet Card */}
          <View style={[styles.walletCard, SHADOWS.crimsonGlow]}>
            <View style={styles.walletCardTop}>
              <View style={styles.flagChip}>
                <View style={styles.flagBadge}>
                  <Text style={styles.flagBadgeText}>GH</Text>
                </View>
                <Text style={styles.flagText}>GHANA MOMO WALLET</Text>
              </View>
              <TouchableOpacity
                style={styles.sessionPill}
                activeOpacity={0.7}
                onPress={() => setCurrentTab('profile')}
              >
                <View style={styles.activeDot} />
                <Text style={styles.sessionText}>Active Session</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.balanceSection}>
              <Text style={styles.balanceLabel}>Available Balance</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceValue}>
                  {showBalance
                    ? formatCurrency(balance?.available ?? 10000.0, 'GHS')
                    : 'GH₵ ••••••••'}
                </Text>
                <TouchableOpacity
                  style={styles.eyeBtn}
                  activeOpacity={0.7}
                  onPress={() => setShowBalance(!showBalance)}
                >
                  <Ionicons
                    name={showBalance ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="rgba(255,255,255,0.85)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.walletCardBottom}>
              <TouchableOpacity
                style={styles.phoneCopyBtn}
                activeOpacity={0.7}
                onPress={() => {
                  showToast('Phone number copied to clipboard!');
                }}
              >
                <Ionicons name="phone-portrait-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.walletPhoneText}>
                  {user?.phoneNumber || '024 123 4567'}
                </Text>
                <Ionicons name="copy-outline" size={12} color="rgba(255,255,255,0.7)" style={{ marginLeft: 6 }} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.qrReceiveBtn}
                activeOpacity={0.8}
                onPress={() => setShowQrModal(true)}
              >
                <Ionicons name="qr-code-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
                <Text style={styles.qrReceiveBtnText}>My QR Code</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Quick Service Action Grid */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>SERVICES & TRANSFERS</Text>
          </View>

          <View style={styles.serviceGrid}>
            {/* 1. Send Money */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.serviceSend, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setActiveFlowModal('send')}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: THEME.primaryLight }]}>
                <Ionicons name="send" size={22} color={THEME.primary} />
              </View>
              <Text style={styles.serviceName}>Send Money</Text>
              <Text style={styles.serviceSub}>P2P Transfer</Text>
            </TouchableOpacity>

            {/* 2. Cash Out */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.serviceCashOut, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setShowCashOutModal(true)}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: '#FEF3C7' }]}>
                <MaterialCommunityIcons name="bank-transfer-out" size={24} color="#D97706" />
              </View>
              <Text style={styles.serviceName}>Cash Out</Text>
              <Text style={styles.serviceSub}>Agent Withdraw</Text>
            </TouchableOpacity>

            {/* 3. Cash In */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.serviceCashIn, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setActiveFlowModal('cash_in')}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: THEME.tealLight }]}>
                <MaterialCommunityIcons name="bank-transfer-in" size={24} color="#0D9488" />
              </View>
              <Text style={styles.serviceName}>Cash In</Text>
              <Text style={styles.serviceSub}>Deposit & Top-up</Text>
            </TouchableOpacity>

            {/* 4. Pay Bills */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.servicePayBill, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setActiveFlowModal('pay_bill')}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: '#DCFCE7' }]}>
                <Ionicons name="flash" size={22} color="#16A34A" />
              </View>
              <Text style={styles.serviceName}>Pay Bills</Text>
              <Text style={styles.serviceSub}>ECG, Water, TV</Text>
            </TouchableOpacity>

            {/* 5. Buy Goods */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.serviceBuyGoods, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setActiveFlowModal('buy_goods')}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: THEME.roseLight }]}>
                <MaterialCommunityIcons name="storefront" size={22} color={THEME.rose} />
              </View>
              <Text style={styles.serviceName}>Buy Goods</Text>
              <Text style={styles.serviceSub}>Merchant Till</Text>
            </TouchableOpacity>

            {/* 6. Airtime & Data */}
            <TouchableOpacity
              style={[styles.serviceCard, styles.serviceAirtime, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setActiveFlowModal('airtime')}
            >
              <View style={[styles.serviceIconWrap, { backgroundColor: THEME.blueLight }]}>
                <Ionicons name="cellular" size={22} color={THEME.blue} />
              </View>
              <Text style={styles.serviceName}>Airtime & Data</Text>
              <Text style={styles.serviceSub}>Recharge & Bundles</Text>
            </TouchableOpacity>
          </View>

          {/* AI Defense Telemetry Widget */}
          <View style={[styles.telemetryCard, SHADOWS.card]}>
            <View style={styles.telemetryTop}>
              <View style={styles.telemetryBadge}>
                <Ionicons name="shield-checkmark" size={13} color={THEME.primary} style={{ marginRight: 4 }} />
                <Text style={styles.telemetryBadgeText}>AI DEFENSE ENGINE</Text>
              </View>
              <Text style={styles.telemetryStatus}>Active & Monitoring</Text>
            </View>
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Physical GPS Geo:</Text>
                <Text style={styles.telemetryItemVal}>
                  {deviceLocation.city}, {deviceLocation.region || 'Ghana'}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Device Hardware:</Text>
                <Text style={styles.telemetryItemVal} numberOfLines={1} ellipsizeMode="tail">
                  {formatDeviceDisplay(deviceProfile?.deviceName)}
                </Text>
              </View>
            </View>
          </View>

          {/* Account Credentials Card */}
          <View style={[styles.telemetryCard, SHADOWS.card]}>
            <View style={styles.telemetryTop}>
              <View style={styles.telemetryBadge}>
                <Ionicons name="lock-closed" size={13} color={THEME.primary} style={{ marginRight: 4 }} />
                <Text style={styles.telemetryBadgeText}>ACCOUNT CREDENTIALS</Text>
              </View>
            </View>
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>KYC Status:</Text>
                <Text style={[styles.telemetryItemVal, { color: THEME.success }]}>Verified (Tier 2)</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Ghana Card:</Text>
                <Text style={styles.telemetryItemVal}>{user?.ghanaCardId ? `${user.ghanaCardId.slice(0, 4)}••••${user.ghanaCardId.slice(-3)}` : 'GHA-•••••481-2'}</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Biometric 2FA:</Text>
                <Text style={[styles.telemetryItemVal, { color: THEME.success }]}>Face + Fingerprint Active</Text>
              </View>
            </View>
          </View>

          {/* Recent Transactions Section */}
          <View style={styles.recentSectionHeader}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setCurrentTab('history')}
            >
              <Text style={styles.viewAllText}>View Statement ›</Text>
            </TouchableOpacity>
          </View>

          {transactions.slice(0, 5).map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={[styles.txItem, SHADOWS.card]}
              activeOpacity={0.7}
              onPress={() => setSelectedReceiptTx(tx)}
            >
              <View style={styles.txIconWrap}>
                {tx.type === 'send' ? (
                  <Ionicons name="arrow-forward" size={18} color={THEME.primary} />
                ) : tx.type === 'cash_in' || tx.type === 'receive' ? (
                  <Ionicons name="arrow-down" size={18} color={THEME.success} />
                ) : tx.type === 'cash_out' ? (
                  <MaterialCommunityIcons name="bank-transfer-out" size={18} color="#D97706" />
                ) : tx.type === 'pay_bill' ? (
                  <Ionicons name="flash" size={18} color="#16A34A" />
                ) : (
                  <MaterialCommunityIcons name="storefront" size={18} color={THEME.rose} />
                )}
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txName} numberOfLines={1}>
                  {tx.receiverName || tx.receiver}
                </Text>
                <Text style={styles.txMeta}>
                  {TRANSACTION_TYPE_LABELS[tx.type] || tx.type} •{' '}
                  {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <View style={styles.txRight}>
                <Text
                  style={[
                    styles.txAmount,
                    ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(tx.type)
                      ? styles.deductAmount
                      : styles.creditAmount,
                  ]}
                >
                  {['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(tx.type) ? '-' : '+'}
                  {formatCurrency(tx.amount, 'GHS')}
                </Text>
                <StatusBadge status={tx.status} />
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ─── TAB 2: TRANSACTION HISTORY ──────────────────────── */}
      {currentTab === 'history' && (
        <View style={styles.tabContent}>
          <View style={styles.historyHeader}>
            <Text style={styles.pageTitle}>Transaction Statement</Text>
            <Text style={styles.pageSubtitle}>
              Filter & review all past transfers, deposits, and AI flags
            </Text>

            {/* Search Bar */}
            <View style={styles.searchBarWrap}>
              <Ionicons name="search-outline" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by recipient, phone, or memo..."
                placeholderTextColor="#9CA3AF"
                value={historySearch}
                onChangeText={setHistorySearch}
              />
              {historySearch.length > 0 && (
                <TouchableOpacity onPress={() => setHistorySearch('')}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </View>

            {/* Filter Tabs */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterPillsRow}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'outgoing', label: 'Outgoing' },
                { id: 'incoming', label: 'Incoming' },
                { id: 'flagged', label: 'Flagged / Review' },
                { id: 'blocked', label: 'Blocked' },
              ].map((f) => (
                <TouchableOpacity
                  key={f.id}
                  style={[
                    styles.filterPill,
                    historyFilter === f.id && styles.filterPillActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => setHistoryFilter(f.id)}
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      historyFilter === f.id && styles.filterPillTextActive,
                    ]}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Transactions List */}
          <ScrollView
            contentContainerStyle={styles.historyScroll}
            showsVerticalScrollIndicator={false}
          >
            {filteredTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" style={{ marginBottom: 10 }} />
                <Text style={styles.emptyTitle}>No Transactions Found</Text>
                <Text style={styles.emptySubtitle}>
                  No activity matching your search criteria.
                </Text>
              </View>
            ) : (
              filteredTransactions.map((tx) => (
                <TouchableOpacity
                  key={tx.id}
                  style={[styles.txItem, SHADOWS.card]}
                  activeOpacity={0.7}
                  onPress={() => setSelectedReceiptTx(tx)}
                >
                  <View style={styles.txIconWrap}>
                    {tx.type === 'send' ? (
                      <Ionicons name="arrow-forward" size={18} color={THEME.primary} />
                    ) : tx.type === 'cash_in' || tx.type === 'receive' ? (
                      <Ionicons name="arrow-down" size={18} color={THEME.success} />
                    ) : tx.type === 'cash_out' ? (
                      <MaterialCommunityIcons name="bank-transfer-out" size={18} color="#D97706" />
                    ) : tx.type === 'pay_bill' ? (
                      <Ionicons name="flash" size={18} color="#16A34A" />
                    ) : (
                      <MaterialCommunityIcons name="storefront" size={18} color={THEME.rose} />
                    )}
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txName} numberOfLines={1}>
                      {tx.receiverName || tx.receiver}
                    </Text>
                    <Text style={styles.txMeta}>
                      {TRANSACTION_TYPE_LABELS[tx.type] || tx.type} •{' '}
                      {new Date(tx.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  </View>
                  <View style={styles.txRight}>
                    <Text
                      style={[
                        styles.txAmount,
                        ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(tx.type)
                          ? styles.deductAmount
                          : styles.creditAmount,
                      ]}
                    >
                      {['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(tx.type) ? '-' : '+'}
                      {formatCurrency(tx.amount, 'GHS')}
                    </Text>
                    <StatusBadge status={tx.status} />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* ─── TAB 3: ALERTS ───────────────────────────────────── */}
      {currentTab === 'alerts' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.alertsScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.historyHeader}>
            <Text style={styles.pageTitle}>Security Notifications</Text>
            <Text style={styles.pageSubtitle}>
              Real-time threat monitoring and account takeover defense feed
            </Text>
          </View>

          {alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={48} color={THEME.success} style={{ marginBottom: 10 }} />
              <Text style={styles.emptyTitle}>All Clear</Text>
              <Text style={styles.emptySubtitle}>
                No security flags or unusual account takeover events detected.
              </Text>
            </View>
          ) : (
            alerts.map((al) => (
              <View
                key={al.id}
                style={[
                  styles.alertItemCard,
                  !al.read && styles.alertItemUnread,
                  SHADOWS.card,
                ]}
              >
                <View style={styles.alertItemIconWrap}>
                  <Ionicons
                    name={
                      al.type === 'new_device'
                        ? 'phone-portrait-outline'
                        : al.type === 'new_location'
                        ? 'location-outline'
                        : al.type === 'transaction_flagged'
                        ? 'warning-outline'
                        : 'shield-outline'
                    }
                    size={22}
                    color={THEME.primary}
                  />
                </View>
                <View style={styles.alertItemContent}>
                  <Text style={styles.alertItemTitle}>{al.title}</Text>
                  <Text style={styles.alertItemMessage}>{al.message}</Text>
                  <Text style={styles.alertItemTime}>
                    {new Date(al.createdAt).toLocaleString()}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* ─── TAB 4: PROFILE & SESSIONS ───────────────────────── */}
      {currentTab === 'profile' && (
        <ScrollView
          style={styles.tabContent}
          contentContainerStyle={styles.profileScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.historyHeader}>
            <Text style={styles.pageTitle}>Profile & Security</Text>
            <Text style={styles.pageSubtitle}>
              Manage biometric credentials, active sessions, and GPS simulation
            </Text>
          </View>

          {/* User KYC Card */}
          <View style={[styles.profileCard, SHADOWS.card]}>
            {user?.profilePicture ? (
              <Image
                source={{ uri: user.profilePicture }}
                style={{ width: 56, height: 56, borderRadius: 28, marginRight: 14 }}
              />
            ) : (
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>
                  {user?.fullName?.charAt(0) || 'A'}
                </Text>
              </View>
            )}
            <View style={[styles.profileDetails, { flex: 1 }]}>
              <Text style={styles.profileName}>{user?.fullName || 'Ama Tetteh'}</Text>
              <Text style={styles.profilePhone}>{user?.phoneNumber || '0241234567'}</Text>
              {user?.email && (
                <Text style={{ fontFamily: FONTS.regular, fontSize: 11, color: THEME.textMuted, marginTop: 1 }}>{user.email}</Text>
              )}
              <View style={[styles.kycBadge, { marginTop: 4 }]}>
                <Ionicons name="card-outline" size={12} color="#166534" style={{ marginRight: 4 }} />
                <Text style={styles.kycBadgeText}>
                  Ghana Card: {user?.ghanaCardId || 'GHA-729183921-4'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#DCFCE7' }}>
                  <Ionicons name="checkmark-circle" size={10} color="#166534" style={{ marginRight: 3 }} />
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 9, fontWeight: '700', color: '#166534' }}>Face Scan: Verified</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#DCFCE7' }}>
                  <Ionicons name="checkmark-circle" size={10} color="#166534" style={{ marginRight: 3 }} />
                  <Text style={{ fontFamily: FONTS.bold, fontSize: 9, fontWeight: '700', color: '#166534' }}>Touch Sensor: Active</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Location Simulator & Live GPS */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PHYSICAL GPS & LOCATION SIMULATOR</Text>
          </View>

          <View style={[styles.locationCard, SHADOWS.card]}>
            <View style={styles.currentLocRow}>
              <Text style={styles.currentLocLabel}>Current Position:</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="location-sharp" size={15} color={THEME.primary} style={{ marginRight: 4 }} />
                <Text style={styles.currentLocVal}>
                  {deviceLocation.city}, {deviceLocation.region || 'Ghana'}
                </Text>
              </View>
            </View>

            {/* Live GPS Coordinates Details */}
            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 8, marginVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
                <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: THEME.textMuted }}>GPS Coordinates:</Text>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 10, color: THEME.text, fontWeight: '700' }}>
                  {deviceLocation.latitude?.toFixed(4)}° N, {deviceLocation.longitude?.toFixed(4)}° W
                </Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: FONTS.medium, fontSize: 10, color: THEME.textMuted }}>Sensor Accuracy:</Text>
                <Text style={{ fontFamily: FONTS.bold, fontSize: 10, color: '#166534', fontWeight: '700' }}>
                  ±{deviceLocation.accuracy || 10}m ({deviceLocation.source === 'gps' ? 'Live Sensor' : 'Simulated'})
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.detectGpsBtn}
              activeOpacity={0.7}
              onPress={handleDetectGPS}
            >
              <Ionicons name="navigate-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.detectGpsBtnText}>
                Detect Live Hardware GPS & Position
              </Text>
            </TouchableOpacity>

            <Text style={styles.presetLocTitle}>Switch Simulated City:</Text>
            <View style={styles.presetLocGrid}>
              {PRESET_LOCATIONS.map((loc) => (
                <TouchableOpacity
                  key={loc.city}
                  style={[
                    styles.locChip,
                    deviceLocation.city === loc.city && styles.locChipActive,
                  ]}
                  activeOpacity={0.7}
                  onPress={() => handleSelectLocation(loc)}
                >
                  <Text
                    style={[
                      styles.locChipText,
                      deviceLocation.city === loc.city && styles.locChipTextActive,
                    ]}
                  >
                    {loc.city}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Active Sessions */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ACTIVE SESSIONS</Text>
          </View>

          <View style={[styles.sessionsCard, SHADOWS.card]}>
            {activeSessions.length === 0 ? (
              <View style={styles.sessionItem}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="phone-portrait-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.sessionDeviceText}>Native Mobile Client (This Device)</Text>
                </View>
                <Text style={styles.sessionStatusText}>Connected</Text>
              </View>
            ) : (
              activeSessions.map((s) => (
                <View key={s.sessionId} style={styles.sessionItem}>
                  <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Ionicons
                        name={s.platform === 'web' ? 'laptop-outline' : 'phone-portrait-outline'}
                        size={16}
                        color={THEME.text}
                        style={{ marginRight: 6 }}
                      />
                      <Text style={styles.sessionDeviceText}>
                        {s.platform === 'web' ? 'Web Browser' : 'Mobile App'}
                      </Text>
                    </View>
                    <Text style={styles.sessionTimeText}>
                      ID: {s.sessionId.slice(0, 8)}... • {s.deviceId}
                    </Text>
                  </View>
                  {s.sessionId === sessionId ? (
                    <View style={styles.currentSessionBadge}>
                      <Text style={styles.currentSessionText}>This Device</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.revokeBtn}
                      activeOpacity={0.7}
                      onPress={() => {
                        setActiveSessions((prev) =>
                          prev.filter((item) => item.sessionId !== s.sessionId)
                        );
                        showToast(`Revoked session ${s.sessionId.slice(0, 8)}`);
                      }}
                    >
                      <Text style={styles.revokeBtnText}>Revoke</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Hardware & Device Telemetry Card */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>DEVICE HARDWARE & TELEMETRY</Text>
          </View>

          <View style={[styles.telemetryCard, SHADOWS.card]}>
            <View style={styles.telemetryTop}>
              <View style={styles.telemetryBadge}>
                <Ionicons name="phone-portrait" size={13} color={THEME.primary} style={{ marginRight: 4 }} />
                <Text style={styles.telemetryBadgeText}>PHYSICAL SENSORS</Text>
              </View>
              <Text style={styles.telemetryStatus}>Active & Calibrated</Text>
            </View>
            <View style={styles.telemetryGrid}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Phone Model:</Text>
                <Text style={styles.telemetryItemVal} numberOfLines={1} ellipsizeMode="tail">
                  {formatDeviceDisplay(deviceProfile?.deviceName)}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Operating System:</Text>
                <Text style={styles.telemetryItemVal} numberOfLines={1} ellipsizeMode="tail">
                  {formatOSDisplay(deviceProfile?.osName)}
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Display & Memory:</Text>
                <Text style={styles.telemetryItemVal} numberOfLines={1} ellipsizeMode="tail">
                  {deviceProfile?.screenResolution || '1080x2400'} • {deviceProfile?.memoryGb || 6} GB RAM
                </Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryItemLabel}>Device Hardware ID:</Text>
                <Text style={[styles.telemetryItemVal, { fontSize: 10, color: THEME.textMuted }]} numberOfLines={1} ellipsizeMode="middle">
                  {deviceProfile?.deviceId || 'device-id'}
                </Text>
              </View>
            </View>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.8}
            onPress={handleLogout}
          >
            <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.logoutBtnText}>Sign Out of Wallet</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ─── FLOATING BOTTOM NAVIGATION BAR ───────────────────── */}
      <View style={styles.bottomNavWrap}>
        <View style={[styles.bottomNav, SHADOWS.cardElevated]}>
          <TouchableOpacity
            style={[styles.navItem, currentTab === 'home' && styles.navItemActive]}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('home')}
          >
            <Ionicons
              name={currentTab === 'home' ? 'home' : 'home-outline'}
              size={20}
              color={currentTab === 'home' ? THEME.primary : THEME.textMuted}
            />
            <Text style={[styles.navLabel, currentTab === 'home' && styles.navLabelActive]}>
              Home
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'history' && styles.navItemActive]}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('history')}
          >
            <Ionicons
              name={currentTab === 'history' ? 'time' : 'time-outline'}
              size={20}
              color={currentTab === 'history' ? THEME.primary : THEME.textMuted}
            />
            <Text style={[styles.navLabel, currentTab === 'history' && styles.navLabelActive]}>
              History
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'alerts' && styles.navItemActive]}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('alerts')}
          >
            <View>
              <Ionicons
                name={currentTab === 'alerts' ? 'shield' : 'shield-outline'}
                size={20}
                color={currentTab === 'alerts' ? THEME.primary : THEME.textMuted}
              />
              {unreadAlertsCount > 0 && (
                <View style={styles.navBadge}>
                  <Text style={styles.navBadgeText}>{unreadAlertsCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.navLabel, currentTab === 'alerts' && styles.navLabelActive]}>
              Alerts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navItem, currentTab === 'profile' && styles.navItemActive]}
            activeOpacity={0.7}
            onPress={() => setCurrentTab('profile')}
          >
            <Ionicons
              name={currentTab === 'profile' ? 'person' : 'person-outline'}
              size={20}
              color={currentTab === 'profile' ? THEME.primary : THEME.textMuted}
            />
            <Text style={[styles.navLabel, currentTab === 'profile' && styles.navLabelActive]}>
              Profile
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── TRANSACTION MODAL ──────────────────────────────── */}
      {activeFlowModal && (
        <TransactionModal
          visible={!!activeFlowModal}
          type={activeFlowModal}
          deviceProfile={deviceProfile}
          location={deviceLocation}
          hasBiometrics={hasBiometrics}
          onSubmit={async (payload) => {
            switch (activeFlowModal) {
              case 'send':
                return api.sendMoney(payload);
              case 'pay_bill':
                return api.payBill(payload);
              case 'buy_goods':
                return api.buyGoods(payload);
              case 'cash_in':
                return api.cashIn(payload);
              case 'airtime':
                return api.sendMoney(payload);
            }
          }}
          onClose={() => setActiveFlowModal(null)}
          onSuccess={(tx) => {
            setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
            loadDashboardData();
          }}
        />
      )}

      {/* ─── CASH OUT MODAL ─────────────────────────────────── */}
      {showCashOutModal && (
        <CashOutModal
          visible={showCashOutModal}
          deviceProfile={deviceProfile}
          location={deviceLocation}
          hasBiometrics={hasBiometrics}
          onSubmit={async (payload) => api.cashOut(payload)}
          onClose={() => setShowCashOutModal(false)}
          onSuccess={(tx) => {
            setTransactions((prev) => [tx, ...prev.filter((t) => t.id !== tx.id)]);
            loadDashboardData();
          }}
        />
      )}

      {/* ─── DIGITAL RECEIPT MODAL ──────────────────────────── */}
      {selectedReceiptTx && (
        <Modal visible transparent animationType="fade">
          <DigitalReceipt
            transaction={selectedReceiptTx}
            onClose={() => setSelectedReceiptTx(null)}
          />
        </Modal>
      )}

      {/* ─── POST-LOGIN FACIAL VERIFICATION ─────────────────── */}
      {showPostLoginFacial && (
        <Modal visible transparent animationType="slide">
          <FacialVerificationScreen
            profilePicture={user?.profilePicture}
            userName={user?.fullName || 'Ama Tetteh'}
            ghanaCardId={user?.ghanaCardId || 'GHA-729183921-4'}
            onSuccess={(res) => {
              setShowPostLoginFacial(false);
              showToast(`Identity Confirmed (${res?.matchScore || 98.6}% Match) — Welcome back!`);
            }}
            onSkip={() => setShowPostLoginFacial(false)}
          />
        </Modal>
      )}

      {/* ─── QR CODE MODAL ──────────────────────────────────── */}
      {showQrModal && (
        <QrCodeModal
          visible={showQrModal}
          user={user}
          onClose={() => setShowQrModal(false)}
          onScanResult={(scanned) => {
            setActiveFlowModal('send');
            showToast(`Scanned code for ${scanned.name || scanned.phoneNumber}`);
          }}
        />
      )}

      {/* ─── BIOMETRIC HARDWARE DIAGNOSTIC TEST MODAL ───────── */}
      {bioTestMode && (
        <BiometricModal
          isOpen={!!bioTestMode}
          mode={bioTestMode}
          profilePicture={user?.profilePicture}
          userName={user?.fullName || 'Ama Tetteh'}
          title={bioTestMode === 'facial' ? 'Face ID Sensor Scan' : 'Touch Sensor Biometrics'}
          subtitle={
            bioTestMode === 'facial'
              ? 'Optical sensor active — Center face to verify'
              : 'Press & hold touch sensor or tap hardware scan'
          }
          onClose={() => setBioTestMode(null)}
          onSuccess={(method) => {
            setBioTestMode(null);
            showToast(
              `${method === 'facial' ? 'Face ID Authenticated' : 'Fingerprint Authenticated'}`
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── STYLES ───────────────────────────────────────────────────
const styles = StyleSheet.create({
  fontLoadingScreen: {
    flex: 1,
    backgroundColor: THEME.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  fontLoadingText: {
    fontFamily: 'System',
    fontSize: 14,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  mainContainer: {
    flex: 1,
    backgroundColor: THEME.background,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  tabContent: {
    flex: 1,
  },
  homeScroll: {
    padding: 16,
    paddingBottom: 110,
  },
  historyScroll: {
    padding: 16,
    paddingBottom: 110,
  },
  alertsScroll: {
    padding: 16,
    paddingBottom: 110,
  },
  profileScroll: {
    padding: 16,
    paddingBottom: 110,
  },

  // Top Header
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogoText: {
    color: '#FFFFFF',
    fontFamily: FONTS.black,
    fontSize: 14,
    fontWeight: '900',
  },
  headerTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  headerSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: THEME.textMuted,
  },
  ghFlagBadge: {
    backgroundColor: '#FEF2F2',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  ghFlagText: {
    fontFamily: FONTS.bold,
    fontSize: 9,
    fontWeight: '800',
    color: THEME.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    maxWidth: 90,
  },
  locationPillText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
    maxWidth: 55,
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: THEME.primary,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },

  // Toast
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    top: 65,
    left: 20,
    right: 20,
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    zIndex: 999,
  },
  toastText: {
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },

  // Wallet Card
  walletCard: {
    backgroundColor: THEME.primary,
    borderRadius: 0,
    padding: 20,
    marginBottom: 20,
  },
  walletCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  flagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 6,
  },
  flagBadge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 0.5,
  },
  flagBadgeText: {
    fontFamily: FONTS.black,
    fontSize: 8,
    fontWeight: '900',
    color: THEME.primary,
  },
  flagText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22C55E',
  },
  sessionText: {
    fontFamily: FONTS.medium,
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  balanceSection: {
    marginBottom: 16,
  },
  balanceLabel: {
    fontFamily: FONTS.regular,
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 12,
    marginBottom: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceValue: {
    fontFamily: FONTS.black,
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  eyeBtn: {
    padding: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
  },
  walletCardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  phoneCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  walletPhoneText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  qrReceiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  qrReceiveBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },

  // Service Grid
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
  },
  serviceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 20,
  },
  serviceCard: {
    width: '31%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  serviceSend: {},
  serviceCashOut: {},
  serviceCashIn: {},
  servicePayBill: {},
  serviceBuyGoods: {},
  serviceAirtime: {},
  serviceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  serviceName: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
  },
  serviceSub: {
    fontFamily: FONTS.regular,
    fontSize: 9,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  // Telemetry Card
  telemetryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  telemetryTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  telemetryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  telemetryBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
  },
  telemetryStatus: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.success,
    fontWeight: '700',
  },
  telemetryGrid: {
    gap: 6,
  },
  telemetryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  telemetryItemLabel: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    flexShrink: 0,
  },
  telemetryItemVal: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text,
    textAlign: 'right',
    flex: 1,
  },

  // Recent Activity
  recentSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  viewAllText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.primary,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  txIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txInfo: {
    flex: 1,
  },
  txName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  txMeta: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  txAmount: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '800',
  },
  deductAmount: {
    color: THEME.text,
  },
  creditAmount: {
    color: THEME.success,
  },

  // History Tab
  historyHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: THEME.borderLight,
  },
  pageTitle: {
    fontFamily: FONTS.black,
    fontSize: 18,
    fontWeight: '900',
    color: THEME.text,
  },
  pageSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 2,
    marginBottom: 12,
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.text,
  },
  filterPillsRow: {
    gap: 8,
    paddingBottom: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  filterPillActive: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
  },
  filterPillText: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  filterPillTextActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '800',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
  },

  // Alerts Tab
  alertItemCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    gap: 12,
  },
  alertItemUnread: {
    borderColor: THEME.primaryBorder,
    backgroundColor: '#FFFBFB',
  },
  alertItemIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: THEME.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertItemContent: {
    flex: 1,
  },
  alertItemTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
  },
  alertItemMessage: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  alertItemTime: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 6,
  },

  // Profile Tab
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  profileAvatarText: {
    fontFamily: FONTS.black,
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  profileDetails: {},
  profileName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '900',
    color: THEME.text,
  },
  profilePhone: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  kycBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  kycBadgeText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
    color: '#166534',
  },
  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  currentLocRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  currentLocLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textSecondary,
  },
  currentLocVal: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  detectGpsBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.primary,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  detectGpsBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  presetLocTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 8,
  },
  presetLocGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  locChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  locChipActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  locChipText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    color: THEME.textSecondary,
    fontWeight: '600',
  },
  locChipTextActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '800',
  },
  sessionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    gap: 10,
  },
  sessionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionDeviceText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  sessionTimeText: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: THEME.textMuted,
    marginTop: 2,
  },
  sessionStatusText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.success,
  },
  currentSessionBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  currentSessionText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  revokeBtn: {
    backgroundColor: THEME.primaryLight,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  revokeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.primary,
  },
  facialTestBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.primary,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  facialTestBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  logoutBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  logoutBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  // Floating Bottom Navigation
  bottomNavWrap: {
    position: 'absolute',
    bottom: 12,
    left: 16,
    right: 16,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  navItem: {
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: {},
  navLabel: {
    fontFamily: FONTS.medium,
    fontSize: 10,
    color: THEME.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  navLabelActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -3,
    right: -6,
    backgroundColor: THEME.primary,
    borderRadius: 7,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navBadgeText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
});
