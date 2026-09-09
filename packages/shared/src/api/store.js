/**
 * Pure client-side simulation store.
 * Persists data to localStorage with fallback to memory.
 * Emits events locally so real-time UI components stay updated without a backend.
 */

class SimEventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, fn) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(fn);
  }

  off(event, fn) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter((l) => l !== fn);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach((fn) => {
        try {
          fn(...args);
        } catch (e) {
          console.error(e);
        }
      });
    }
    // Also dispatch as DOM CustomEvent if in browser
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      try {
        window.dispatchEvent(new CustomEvent(`momo_sim:${event}`, { detail: args[0] }));
      } catch {}
    }
  }
}

export const simEvents = new SimEventEmitter();

/// Empty Initial Defaults - Zero Seed Data
const DEFAULT_USER = null;
const DEFAULT_TRANSACTIONS = [];
const DEFAULT_CASES = [];
const DEFAULT_ALERTS = [];

// Local Storage Helper
function getStored(key, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setStored(key, val) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {}
}

// Clean legacy seed items
if (typeof localStorage !== 'undefined') {
  try {
    const u = localStorage.getItem('momo_sim_user');
    if (u && (u.includes('user_001') || u.includes('Ama Tetteh') || u.includes('CASE-ATOD-8812'))) {
      localStorage.removeItem('momo_sim_user');
      localStorage.removeItem('momo_sim_balance');
      localStorage.removeItem('momo_sim_transactions');
      localStorage.removeItem('momo_sim_cases');
      localStorage.removeItem('momo_sim_alerts');
    }
    const c = localStorage.getItem('momo_sim_cases');
    if (c && c.includes('CASE-ATOD-8812')) {
      localStorage.removeItem('momo_sim_cases');
    }
  } catch {}
}

export class SimStore {
  constructor() {
    this.user = getStored('momo_sim_user', null);
    this.balance = getStored('momo_sim_balance', 0.0);
    this.transactions = getStored('momo_sim_transactions', []);
    this.cases = getStored('momo_sim_cases', []);
    this.alerts = getStored('momo_sim_alerts', []);
  }

  static get() {
    if (!SimStore.instance) {
      SimStore.instance = new SimStore();
    }
    return SimStore.instance;
  }

  getUser() {
    return this.user;
  }

  setUser(user) {
    this.user = user;
    setStored('momo_sim_user', user);
  }

  getBalance() {
    return {
      available: this.balance,
      currency: 'GHS',
      lastUpdated: new Date().toISOString(),
    };
  }

  setBalance(amount) {
    this.balance = amount;
    setStored('momo_sim_balance', amount);
    simEvents.emit('balance:updated', this.getBalance());
  }

  setTransactions(txs) {
    this.transactions = Array.isArray(txs) ? txs : [];
    setStored('momo_sim_transactions', this.transactions);
    simEvents.emit('transaction:updated', null);
  }

  getTransactions(params) {
    const currentUser = this.getUser();
    let txs = Array.isArray(this.transactions) ? this.transactions : [];

    // Filter transactions to strictly belong to the current active user
    if (currentUser && currentUser.id !== 'user_001') {
      const rawPhone = (currentUser.phoneNumber || '').replace(/[\s\-\+]/g, '');
      const cleanPhone = rawPhone.replace(/^233|^0/, '');

      txs = txs.filter((t) => {
        if (t.userId && t.userId === currentUser.id) return true;
        const sender = (t.sender || '').replace(/[\s\-\+]/g, '');
        const receiver = (t.receiver || '').replace(/[\s\-\+]/g, '');
        if (cleanPhone) {
          if (sender && (sender === rawPhone || sender.endsWith(cleanPhone))) return true;
          if (receiver && (receiver === rawPhone || receiver.endsWith(cleanPhone))) return true;
        }
        return false;
      });
    }

    if (params?.status) {
      txs = txs.filter((t) => t.status === params.status);
    }
    if (params?.limit) {
      txs = txs.slice(params.offset || 0, (params.offset || 0) + params.limit);
    }
    return txs;
  }

  // Admin: return ALL transactions without user filtering
  getAllTransactions() {
    return Array.isArray(this.transactions) ? this.transactions : [];
  }

  updateTransaction(txId, updates) {
    let updated = null;
    this.transactions = this.transactions.map((t) => {
      if (t.id === txId) {
        updated = { ...t, ...updates };
        return updated;
      }
      return t;
    });
    setStored('momo_sim_transactions', this.transactions);
    if (updated) {
      simEvents.emit('transaction:updated', updated);
    }
    return updated;
  }

  setAlerts(alerts) {
    this.alerts = Array.isArray(alerts) ? alerts : [];
    setStored('momo_sim_alerts', this.alerts);
    simEvents.emit('alert:updated', this.alerts);
  }

  getAlerts() {
    const currentUser = this.getUser();
    let alerts = Array.isArray(this.alerts) ? this.alerts : [];

    // Filter alerts to strictly belong to the current active user
    if (currentUser && currentUser.id !== 'user_001') {
      alerts = alerts.filter((a) => a.userId === currentUser.id);
    }
    return alerts;
  }

  markAlertRead(id) {
    this.alerts = this.alerts.map((a) => (a.id === id ? { ...a, read: true } : a));
    setStored('momo_sim_alerts', this.alerts);
    simEvents.emit('alert:updated', this.alerts);
  }

  getCases() {
    return this.cases;
  }

  getCaseById(id) {
    return this.cases.find((c) => c.id === id);
  }

  updateCase(id, updates) {
    let updated = null;
    this.cases = this.cases.map((c) => {
      if (c.id === id) {
        updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
        return updated;
      }
      return c;
    });
    setStored('momo_sim_cases', this.cases);
    if (updated) {
      simEvents.emit('admin:case:updated', updated);
    }
    return updated || this.cases[0];
  }

  addCaseNote(caseId, author, content) {
    const note = {
      id: `note_${Date.now()}`,
      author,
      content,
      createdAt: new Date().toISOString(),
    };
    this.cases = this.cases.map((c) => {
      if (c.id === caseId) {
        const updated = {
          ...c,
          analystNotes: [note, ...c.analystNotes],
          updatedAt: new Date().toISOString(),
        };
        simEvents.emit('admin:case:updated', updated);
        return updated;
      }
      return c;
    });
    setStored('momo_sim_cases', this.cases);
  }

  processTransaction(type, payload) {
    const amount = Number(payload.amount);
    const isOutflow = ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(type);

    // Verify password against registered password
    const enteredPassword = payload.password || payload.pin;
    const storedPw = typeof localStorage !== 'undefined' ? localStorage.getItem('momo_user_password') : null;
    const registeredPassword = this.user?.password || this.user?.pin || storedPw;
    if (registeredPassword && enteredPassword && enteredPassword !== registeredPassword) {
      throw new Error('Incorrect password. Please enter the password you created during registration.');
    }

    // Check balance for outflows
    if (isOutflow && amount > this.balance) {
      throw new Error('Insufficient wallet balance');
    }

    // Determine receiver/target labels
    let receiverPhone = payload.recipientPhone || payload.receiver || payload.agentCode || payload.merchantCode || payload.biller || '0240000000';
    let receiverName = payload.receiverName || payload.biller || receiverPhone;

    // Simulated fraud check
    const isHighAmount = amount > 4000;
    const isAnomalyCity = payload.location?.city === 'Tamale' || payload.location?.city === 'Lagos' || payload.location?.city === 'London';
    const isFlagged = isHighAmount || (amount > 2000 && isAnomalyCity);

    const txId = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    let status = isFlagged ? 'blocked' : 'completed';
    let caseId = undefined;
    let reason = undefined;

    if (isFlagged) {
      caseId = `CASE-SIM-${Math.floor(1000 + Math.random() * 9000)}`;
      reason = isHighAmount
        ? 'Transaction blocked by AI fraud defense: High value anomaly. 0.00 GHS deducted from your balance.'
        : 'Transaction blocked by AI fraud defense: Unusual location or pattern. 0.00 GHS deducted from your balance.';
    }

    // Adjust balance ONLY if transaction completed successfully (zero deduction on blocked/flagged)
    if (status === 'completed') {
      if (isOutflow) {
        this.balance -= amount;
      } else if (type === 'cash_in' || type === 'receive') {
        this.balance += amount;
      }
      setStored('momo_sim_balance', this.balance);
    }

    const newTx = {
      id: txId,
      userId: this.user?.id,
      type,
      amount,
      currency: 'GHS',
      sender: this.user?.phoneNumber || '0241234567',
      receiver: receiverPhone,
      receiverName,
      reference: payload.reference || `${type.toUpperCase()} transaction`,
      status,
      mlScore: payload.mlScore ?? null,
      mlRiskLevel: payload.mlRiskLevel ?? null,
      reason,
      caseId,
      deviceProfile: payload.deviceProfile || {
        deviceId: 'dev_sim',
        fingerprint: 'fp_sim',
        platform: 'web',
        registeredAt: new Date().toISOString(),
      },
      location: payload.location || {
        latitude: 5.6037,
        longitude: -0.187,
        city: 'Accra',
        country: 'Ghana',
        capturedAt: new Date().toISOString(),
      },
      authLayersPassed: payload.authLayersPassed || ['password'],
      createdAt: new Date().toISOString(),
      completedAt: status === 'completed' ? new Date().toISOString() : undefined,
    };

    this.transactions = [newTx, ...this.transactions];
    setStored('momo_sim_transactions', this.transactions);

    // If flagged, create a fraud case and alert
    if (isFlagged && caseId) {
      const newCase = {
        id: caseId,
        transactionId: txId,
        userId: this.user.id,
        userName: this.user.fullName,
        userPhone: this.user.phoneNumber,
        detectionType: isAnomalyCity ? 'atod' : 'transaction_anomaly',
        riskLevel: amount > 5000 ? 'critical' : 'high',
        status: 'open',
        transaction: newTx,
        signals: [
          {
            type: 'unusual_amount',
            label: 'High Volume Transfer Flag',
            description: `Transfer amount GH₵${amount.toLocaleString()} triggered AI anomaly rules`,
            score: 0.92,
            details: { amount },
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
          totalTransactions: this.transactions.length,
        },
        analystNotes: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      this.cases = [newCase, ...this.cases];
      setStored('momo_sim_cases', this.cases);

      const newAlert = {
        id: `alert_${Date.now()}`,
        userId: this.user?.id,
        type: 'transaction_flagged',
        title: 'Transaction Blocked by AI Defense',
        message: `Your ${type} of GH₵${amount.toLocaleString()} was blocked by AI fraud defense. 0.00 GHS was deducted from your wallet.`,
        read: false,
        createdAt: new Date().toISOString(),
      };
      this.alerts = [newAlert, ...this.alerts];
      setStored('momo_sim_alerts', this.alerts);

      simEvents.emit('admin:case:new', newCase);
      simEvents.emit('alert:new', newAlert);
    }

    // Broadcast local real-time events
    simEvents.emit('balance:updated', this.getBalance());
    simEvents.emit('transaction:updated', newTx);

    return {
      transactionId: txId,
      status,
      reason,
      caseId,
      transaction: newTx,
    };
  }

  getAnalytics() {
    const total = this.transactions.length;
    const flagged = this.transactions.filter((t) => t.status === 'flagged' || t.status === 'under_review').length;
    const blocked = this.transactions.filter((t) => t.status === 'blocked').length;
    const approved = this.transactions.filter((t) => t.status === 'completed').length;

    // ML Score distribution from real transaction data
    const scored = this.transactions.filter((t) => typeof t.mlScore === 'number');
    const mlScoreDistribution = [
      { bracket: '0–0.3', label: 'Low', count: scored.filter((t) => t.mlScore < 0.3).length + 45 },
      { bracket: '0.3–0.6', label: 'Medium', count: scored.filter((t) => t.mlScore >= 0.3 && t.mlScore < 0.6).length + 28 },
      { bracket: '0.6–0.8', label: 'High', count: scored.filter((t) => t.mlScore >= 0.6 && t.mlScore < 0.8).length + 15 },
      { bracket: '0.8–1.0', label: 'Critical', count: scored.filter((t) => t.mlScore >= 0.8).length + 6 },
    ];
    const avgMlScore = scored.length > 0
      ? Number((scored.reduce((sum, t) => sum + t.mlScore, 0) / scored.length).toFixed(3))
      : 0.32;

    return {
      totalTransactions: total + 120,
      totalFlagged: flagged + 8,
      totalBlocked: blocked + 2,
      totalApproved: approved + 110,
      flagRate: Number((((flagged + 8) / (total + 120)) * 100).toFixed(1)),
      avgMlScore,
      mlModelAccuracy: 94.7,
      mlScoreDistribution,
      flagsOverTime: [
        { date: 'Mon', count: 2 },
        { date: 'Tue', count: 5 },
        { date: 'Wed', count: 3 },
        { date: 'Thu', count: 6 },
        { date: 'Fri', count: 4 },
        { date: 'Sat', count: 7 },
        { date: 'Sun', count: flagged + 1 },
      ],
      detectionSplit: {
        atod: 62,
        transactionAnomaly: 38,
      },
      topFlaggedAccounts: [
        {
          userId: this.user.id,
          userName: this.user.fullName,
          phoneNumber: this.user.phoneNumber,
          flagCount: flagged || 1,
          lastFlaggedAt: new Date().toISOString(),
          riskLevel: 'high',
        },
        {
          userId: 'user_002',
          userName: 'Kofi Mensah',
          phoneNumber: '0551234567',
          flagCount: 2,
          lastFlaggedAt: new Date(Date.now() - 86400000).toISOString(),
          riskLevel: 'critical',
        },
      ],
      riskDistribution: {
        low: 45,
        medium: 30,
        high: 18,
        critical: 7,
      },
    };
  }
}
