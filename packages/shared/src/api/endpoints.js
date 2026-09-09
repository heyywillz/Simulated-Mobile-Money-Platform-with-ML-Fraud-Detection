/**
 * Endpoint functions for end-user apps.
 *
 * Wiring:
 *   - signup()  → Express POST /
 *   - login()   → Express POST /login
 *   - sendMoney / cashOut / cashIn / payBill / buyGoods → Express POST /transaction
 *   - Everything else (balance, history, alerts, OTP) → local SimStore
 */

import { api, setAuthToken, getAuthToken } from './client';
import { SimStore, simEvents } from './store';

// ─── Auth ───────────────────────────────────────────────────────

export async function requestOtp(payload) {
  // Express server does not support OTP — simulate locally
  return {
    success: true,
    message: `OTP sent to ${payload.phoneNumber}`,
    otp: '123456',
    expiresInSeconds: 300,
  };
}

export async function getCurrentUser() {
  const store = SimStore.get();
  return store.getUser() || null;
}

function formatGhanaCard(card) {
  if (!card) return 'GHA-000000000-0';
  const clean = String(card).trim().toUpperCase();
  if (/^GHA-\d{9}-\d$/.test(clean)) return clean;
  const digits = clean.replace(/\D/g, '');
  const padded = digits.padEnd(10, '0');
  return `GHA-${padded.slice(0, 9)}-${padded[9]}`;
}

export async function signup(payload) {
  const store = SimStore.get();
  const password = payload.password || payload.pin || '1234';

  const rawPhone = String(payload.phoneNumber || '0240000000').replace(/\D/g, '');
  const validEmail = payload.email && payload.email.includes('@')
    ? payload.email.trim()
    : `${rawPhone || 'user'}@momo.gh`;

  // Map to Express server schema:  POST /
  // { fullName, email, password, ghanaCard, location: {lat, long}, device }
  const expressPayload = {
    fullName: payload.fullName?.trim() || 'Swipe Pay User',
    email: validEmail,
    password,
    ghanaCard: formatGhanaCard(payload.ghanaCardId),
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device:
      payload.deviceProfile?.deviceId ||
      payload.deviceProfile?.deviceName ||
      payload.deviceProfile?.browserName ||
      'Web Browser',
  };

  try {
    const { data } = await api.post('/', expressPayload, {
      withCredentials: true,
    });

    // Build user from Express response
    const user = {
      id: data._id || `user_${Date.now()}`,
      fullName: data.fullName || payload.fullName,
      phoneNumber: payload.phoneNumber,
      email: data.email || payload.email,
      dob: payload.dob,
      gender: payload.gender,
      profilePicture: payload.profilePicture,
      ghanaCardId: data.ghanaCard || expressPayload.ghanaCard,
      password,
      pin: payload.pin || password,
      createdAt: data.createdAt || new Date().toISOString(),
      status: 'active',
      kycVerified: true,
      facialScanVerified: payload.facialScanVerified ?? true,
      facialTemplate: payload.facialTemplate,
      facialEnrollmentDate: new Date().toISOString(),
      biometricEnrolled: payload.biometricFingerprintEnrolled ?? true,
      fingerprintTemplate: payload.fingerprintTemplate,
      fingerprintEnrollmentDate: new Date().toISOString(),
    };

    store.setUser(user);
    const initialBal = typeof data.balance === 'number' ? data.balance : 10000.0;
    store.setBalance(initialBal);
    store.setTransactions([]);
    store.setAlerts([]);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_sim_balance', String(initialBal));
      localStorage.setItem('momo_sim_transactions', JSON.stringify([]));
      localStorage.setItem('momo_sim_alerts', JSON.stringify([]));
    }

    // Store credentials for later transaction calls
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_user_email', expressPayload.email);
      localStorage.setItem('momo_user_password', expressPayload.password);
      localStorage.setItem('momo_user_ghanaCard', expressPayload.ghanaCard);
    }

    if (data.token) {
      setAuthToken(data.token);
    }

    const sessionId = `sess_${Date.now()}`;
    const token = data.token || `sim_jwt_${Date.now()}`;

    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  } catch (err) {
    if (err.response?.status === 400) {
      const serverMsg = err.response?.data?.message || err.response?.data?.error || 'User already registered with this email or Ghana Card.';
      const customErr = new Error(serverMsg);
      customErr.response = err.response;
      throw customErr;
    }
    // If Express server is unreachable (connection refused/offline), fall back to local simulation
    console.warn('Express signup failed, server returned:', err.response?.status, err.response?.data || err.message);
    return signupLocal(payload);
  }
}

export async function login(payload) {
  const store = SimStore.get();

  // Retrieve stored credentials
  const storedEmail =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_email') : null;
  const storedPassword =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_password') : null;
  const storedGhanaCard =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_ghanaCard') : null;

  // Map to Express server schema:  POST /login
  // { email, password, ghanaCard }
  const email =
    payload.email ||
    storedEmail ||
    (payload.phoneNumber ? `${payload.phoneNumber}@momo.gh` : '');
  const password = payload.password || storedPassword || payload.pin || '';
  const ghanaCard = payload.ghanaCard || storedGhanaCard || '';

  const expressPayload = {
    email,
    password,
    ghanaCard,
  };

  try {
    const loginRes = await api.post('/login', expressPayload, { withCredentials: true, timeout: 5000 });
    const serverToken = loginRes.data?.token;
    if (serverToken) {
      setAuthToken(serverToken);
    }

    // Save active credentials in localStorage for subsequent requests
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('momo_user_email', expressPayload.email);
      localStorage.setItem('momo_user_password', expressPayload.password);
      localStorage.setItem('momo_user_ghanaCard', expressPayload.ghanaCard);
    }

    const backendUser = loginRes.data?.user || {};
    let user = {
      id: backendUser._id || `user_${Date.now()}`,
      fullName: backendUser.fullName || payload.fullName || 'Swipe Pay User',
      phoneNumber: payload.phoneNumber || '0241234567',
      email: backendUser.email || expressPayload.email,
      ghanaCardId: backendUser.ghanaCard || expressPayload.ghanaCard,
      password: expressPayload.password,
      pin: payload.pin || expressPayload.password,
      createdAt: new Date().toISOString(),
      status: 'active',
      kycVerified: true,
      facialScanVerified: payload.biometricType === 'facial',
      biometricEnrolled: payload.biometricType === 'fingerprint' || true,
    };

    // Attempt to enrich with /user (e.g. balance or additional fields)
    try {
      const userRes = await api.get('/user', { withCredentials: true });
      if (userRes.data) {
        user.id = userRes.data._id || user.id;
        user.fullName = userRes.data.fullName || user.fullName;
        user.email = userRes.data.email || user.email;
        user.ghanaCardId = userRes.data.ghanaCard || user.ghanaCardId;
        if (typeof userRes.data.balance === 'number') {
          store.setBalance(userRes.data.balance);
        }
      }
    } catch {
      // Non-fatal if /user endpoint fails
    }

    store.setUser(user);

    const sessionId = `sess_${Date.now()}`;
    const token = serverToken || `sim_jwt_${Date.now()}`;

    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  } catch (err) {
    if (err.response?.status === 400 || err.response?.status === 404) {
      const serverMsg = err.response?.data?.message || 'Invalid email, password, or Ghana Card';
      const customErr = new Error(serverMsg);
      customErr.response = err.response;
      throw customErr;
    }
    console.warn('Express login failed, falling back to local user:', err.message);
    let user = store.getUser();
    if (!user) {
      user = {
        id: `user_${Date.now()}`,
        fullName: 'Ama Tetteh',
        phoneNumber: payload.phoneNumber || '0241234567',
        email: expressPayload.email,
        ghanaCardId: expressPayload.ghanaCard,
        password: expressPayload.password,
        pin: payload.pin || expressPayload.password,
        createdAt: new Date().toISOString(),
        status: 'active',
        kycVerified: true,
        facialScanVerified: payload.biometricType === 'facial',
        biometricEnrolled: true,
      };
      store.setUser(user);
    } else {
      user = {
        ...user,
        email: expressPayload.email || user.email,
        ghanaCardId: expressPayload.ghanaCard || user.ghanaCardId,
        password: expressPayload.password || user.password,
      };
      store.setUser(user);
    }
    const sessionId = `sess_${Date.now()}`;
    const token = `sim_jwt_${Date.now()}`;
    return {
      token,
      user,
      sessionId,
      activeSessions: [
        {
          sessionId,
          platform: payload.deviceProfile?.platform || 'web',
          lastActive: new Date().toISOString(),
          deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
        },
      ],
    };
  }
}

export async function registerDevice(_profile) {
  return { success: true };
}

export async function verifyBiometric(_payload) {
  return { verified: true };
}

export async function verifyFacial(_payload) {
  return { verified: true };
}

// ─── Wallet ─────────────────────────────────────────────────────

export async function getBalance() {
  return SimStore.get().getBalance();
}

export async function getTransactions(params) {
  return SimStore.get().getTransactions(params);
}

// ─── Transactions (Express POST /transaction) ───────────────────

let isTransactionPending = false;
let lastTransactionTime = 0;
let lastTransactionKey = '';

async function executeTransaction(type, payload) {
  const store = SimStore.get();
  const user = store.getUser();
  const storedEmail =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_email') : null;
  const storedPw =
    typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_password') : null;

  // Verify entered password matches registered password
  const enteredPassword = payload.password || payload.pin;
  const registeredPassword = user?.password || user?.pin || storedPw;
  if (registeredPassword && enteredPassword && enteredPassword !== registeredPassword) {
    throw new Error('Incorrect password. Please enter the password you created during registration.');
  }

  const currentKey = `${type}_${payload.amount}_${payload.receiver || payload.recipientPhone || payload.agentCode || ''}`;
  const now = Date.now();

  // Deduplication guard: ignore concurrent or identical rapid requests within 2.5s
  if (isTransactionPending || (lastTransactionKey === currentKey && now - lastTransactionTime < 2500)) {
    console.warn('[Transaction] Concurrent or duplicate execution prevented for:', currentKey);
    const recent = store.getTransactions();
    return recent[0] || { status: 'completed' };
  }

  isTransactionPending = true;
  lastTransactionTime = now;
  lastTransactionKey = currentKey;

  const senderRaw = user?.phoneNumber || '0241234567';
  const cleanSender = String(senderRaw).replace(/^\+?233|^0/, '').replace(/\D/g, '');
  const formattedSenderPhone = `233-${(cleanSender || '241234567').padEnd(9, '0').slice(0, 9)}`;

  const receiverRaw = payload.recipientPhone || payload.receiver || payload.agentCode || payload.merchantCode || '0240000000';
  const cleanReceiver = String(receiverRaw).replace(/^\+?233|^0/, '').replace(/\D/g, '');
  const formattedReceiverPhone = `233-${(cleanReceiver || '240000000').padEnd(9, '0').slice(0, 9)}`;

  const normalizedType = type === 'send' ? 'send_money' : type;

  // Map to Express server schema:  POST /transaction
  // { amount, SenderPhone, receiverPhone, reason, channel, city, country, location, device, email }
  const expressPayload = {
    amount: payload.amount,
    SenderPhone: formattedSenderPhone,
    receiverPhone: formattedReceiverPhone,
    reason: normalizedType,
    channel: normalizedType,
    transactionType: normalizedType,
    city: payload.location?.city || 'Accra',
    country: payload.location?.country || 'Ghana',
    location: {
      lat: payload.location?.latitude ?? 5.6037,
      long: payload.location?.longitude ?? -0.187,
    },
    device: payload.deviceProfile?.deviceId || payload.deviceProfile?.deviceName || payload.deviceProfile?.browserName || 'Web Browser',
    email: storedEmail || user?.email || `${senderRaw}@momo.gh`,
  };

  try {
    const { data } = await api.post('/transaction', expressPayload);

    // Extract ML fraud score from server response
    const rawMlScore =
      data?.status?.fraud_risk_score ??
      data?.fraud_risk_score ??
      data?.prediction ??
      data?.detection_score ??
      null;

    // Normalization based on ML model range [~3.0, ~20.0]:
    // Raw output <= 3.0 represents 0% baseline risk.
    // Raw output >= 20.0 represents 100% critical fraud risk.
    const ML_MIN_SCORE = 3.0;
    const ML_MAX_SCORE = 20.0;
    let normalizedScore = null;

    if (typeof rawMlScore === 'number') {
      if (rawMlScore <= 1.0) {
        normalizedScore = Math.max(0, Math.min(1, rawMlScore));
      } else {
        normalizedScore = Math.max(0, Math.min(1, (rawMlScore - ML_MIN_SCORE) / (ML_MAX_SCORE - ML_MIN_SCORE)));
      }
    }

    const mlScore = normalizedScore;
    const mlRiskLevel = mlScore !== null
      ? (mlScore >= 0.8 ? 'critical' : mlScore >= 0.6 ? 'high' : mlScore >= 0.3 ? 'medium' : 'low')
      : null;

    // Pass ML data into the local processing so it's stored on the transaction
    const enrichedPayload = { ...payload, mlScore, mlRiskLevel, channel: normalizedType, type: normalizedType };

    // Process locally to track balance and history
    const result = store.processTransaction(type, enrichedPayload);
    const txId = result.transactionId || result.transaction?.id;

    // If ML score indicates fraud on a transaction that was locally marked completed, auto-block it and refund/preserve balance
    // Cash in is exempted from fraud detection as per requirements
    if (type !== 'cash_in' && mlScore !== null && mlScore >= 0.6 && txId) {
      const caseId = `CASE-ML-${Math.floor(1000 + Math.random() * 9000)}`;
      const amount = Number(payload.amount) || 0;

      // Restore wallet balance so 0.00 GHS is deducted
      if (result.transaction?.status === 'completed' && ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(type)) {
        const restoredBalance = store.getBalance() + amount;
        store.setBalance(restoredBalance);
        simEvents.emit('balance:updated', restoredBalance);
      }

      const blockReason = `Transaction blocked by AI defense: ML fraud risk ${(mlScore * 100).toFixed(0)}%. 0.00 GHS was deducted from your wallet.`;

      store.updateTransaction(txId, {
        status: 'blocked',
        mlScore,
        mlRiskLevel,
        reason: blockReason,
        caseId,
      });

      // Create fraud case for admin
      const updatedTx = store.getAllTransactions().find((t) => t.id === txId);
      const newCase = {
        id: caseId,
        transactionId: txId,
        userId: user?.id,
        userName: user?.fullName || 'Unknown',
        userPhone: user?.phoneNumber || '',
        detectionType: 'transaction_anomaly',
        riskLevel: mlRiskLevel,
        status: 'open',
        transaction: updatedTx || result.transaction,
        signals: [
          {
            type: 'ml_score',
            label: 'ML Fraud Risk Score',
            description: `Machine learning model flagged this transaction with ${(mlScore * 100).toFixed(0)}% fraud probability`,
            score: mlScore,
            details: { model: 'fraud_detection_v1', threshold: 0.6 },
          },
        ],
        userProfile: {
          avgTransactionAmount: 200,
          minTransactionAmount: 10,
          maxTransactionAmount: 500,
          typicalTransactionRange: [20, 500],
          avgDailyTransactions: 2,
          knownDevices: [payload.deviceProfile?.deviceId || 'dev_001'],
          knownLocations: ['Accra', 'Kumasi'],
          accountAge: 90,
          totalTransactions: store.getAllTransactions().length,
        },
        analystNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.cases = [newCase, ...store.cases];
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('momo_sim_cases', JSON.stringify(store.cases));
      }
      simEvents.emit('admin:case:new', newCase);

      result.status = 'blocked';
      result.reason = blockReason;
      result.caseId = caseId;
      if (result.transaction) {
        result.transaction.status = 'blocked';
        result.transaction.reason = blockReason;
        result.transaction.mlScore = mlScore;
        result.transaction.mlRiskLevel = mlRiskLevel;
      }
    } else if (mlScore !== null && txId) {
      // Attach ML score even for non-flagged transactions
      store.updateTransaction(txId, { mlScore, mlRiskLevel });
    }

    // If server returned updated balance, synchronize store balance with it
    if (data && typeof data.balance === 'number') {
      store.setBalance(data.balance);
    } else if (data && data.user && typeof data.user.balance === 'number') {
      store.setBalance(data.user.balance);
    }

    if (mlScore !== null) {
      console.log(`[ML] fraud_risk_score: ${mlScore} (${mlRiskLevel})`);
    }

    return result;
  } catch (err) {
    console.warn('Express transaction failed, processing locally:', err.response?.data?.message || err.message);
    // Fall back to local processing
    return store.processTransaction(type, payload);
  } finally {
    isTransactionPending = false;
  }
}

export async function sendMoney(payload) {
  return executeTransaction('send_money', payload);
}

export async function cashOut(payload) {
  return executeTransaction('cash_out', payload);
}

export async function cashIn(payload) {
  return executeTransaction('cash_in', payload);
}

export async function payBill(payload) {
  return executeTransaction('pay_bill', payload);
}

export async function buyGoods(payload) {
  return executeTransaction('buy_goods', payload);
}

// ─── Alerts ─────────────────────────────────────────────────────

export async function getAlerts() {
  return SimStore.get().getAlerts();
}

export async function setAlerts(alerts) {
  SimStore.get().setAlerts(alerts);
}

export async function markAlertRead(alertId) {
  SimStore.get().markAlertRead(alertId);
}

// ─── Local Fallbacks ────────────────────────────────────

function signupLocal(payload) {
  const store = SimStore.get();
  const user = {
    id: `user_${Date.now()}`,
    fullName: payload.fullName,
    phoneNumber: payload.phoneNumber,
    email: payload.email,
    dob: payload.dob,
    gender: payload.gender,
    profilePicture: payload.profilePicture,
    ghanaCardId: payload.ghanaCardId,
    password: payload.password || payload.pin || '1234',
    pin: payload.pin || payload.password || '1234',
    createdAt: new Date().toISOString(),
    status: 'active',
    kycVerified: true,
    facialScanVerified: payload.facialScanVerified ?? true,
    biometricEnrolled: payload.biometricFingerprintEnrolled ?? true,
  };
  store.setUser(user);
  store.setBalance(10000.0);
  store.setTransactions([]);
  store.setAlerts([]);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('momo_sim_balance', '10000');
    localStorage.setItem('momo_sim_transactions', JSON.stringify([]));
    localStorage.setItem('momo_sim_alerts', JSON.stringify([]));
  }
  const sessionId = `sess_${Date.now()}`;
  const token = `sim_jwt_${Date.now()}`;
  return {
    token,
    user,
    sessionId,
    activeSessions: [
      {
        sessionId,
        platform: payload.deviceProfile?.platform || 'web',
        lastActive: new Date().toISOString(),
        deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
      },
    ],
  };
}

function loginLocal(payload) {
  const store = SimStore.get();
  let user = store.getUser();
  if (!user || (payload.phoneNumber && user.phoneNumber !== payload.phoneNumber)) {
    user = {
      id: `user_${Date.now()}`,
      fullName: 'Ama Tetteh',
      phoneNumber: payload.phoneNumber || '0241234567',
      email: payload.email || (payload.phoneNumber ? `${payload.phoneNumber}@momo.gh` : 'aninakwa3144@gmail.com'),
      ghanaCardId: payload.ghanaCard || 'GHA-729183921-4',
      password: payload.password || payload.pin || '@mista223',
      pin: payload.pin || payload.password || '1234',
      createdAt: new Date().toISOString(),
      status: 'active',
      kycVerified: true,
      facialScanVerified: payload.biometricType === 'facial',
      biometricEnrolled: true,
    };
    store.setUser(user);
  }
  const sessionId = `sess_${Date.now()}`;
  const token = `sim_jwt_${Date.now()}`;
  return {
    token,
    user,
    sessionId,
    activeSessions: [
      {
        sessionId,
        platform: payload.deviceProfile?.platform || 'web',
        lastActive: new Date().toISOString(),
        deviceId: payload.deviceProfile?.deviceId || 'dev_sim',
      },
    ],
  };
}

// Attach all endpoint functions onto the api object
Object.assign(api, {
  requestOtp,
  getCurrentUser,
  signup,
  login,
  getBalance,
  getTransactions,
  sendMoney,
  cashOut,
  cashIn,
  payBill,
  buyGoods,
  getAlerts,
  markAlertRead,
});

