/**
 * Dashboard — Responsive desktop & mobile mobile-money dashboard.
 * Clean, modern fintech aesthetic with solid color tokens, rich multi-column
 * desktop layout, quick service grid, live AI defense telemetry, and instant statement feed.
 */

import { useState, useEffect, useTransition } from 'react';
import { useLoaderData, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge, MlScoreBadge } from '../components/StatusBadge';
import {
  formatCurrency,
  TRANSACTION_TYPE_LABELS,
} from '@momo/shared/src/constants';
import * as api from '@momo/shared/src/api/endpoints';
import { PRESET_LOCATIONS } from '@momo/shared/src/utils/location';
import { createUserSocket } from '@momo/shared/src/socket/client';
import { loginUser } from '../../redux_store/features/dashboard';
import swipePayLogo from '../assets/swipe-pay-logo.png';

import {
  SendIcon,
  ReceiveIcon,
  CashOutIcon,
  CashInIcon,
  PayBillIcon,
  BuyGoodsIcon,
  HistoryIcon,
  BellIcon,
  EmptyBoxIcon,
  QrCodeIcon,
  CopyIcon,
  CheckIcon,
  ShieldCheckIcon,
  SparklesIcon,
  LocationPinIcon,
} from '@momo/shared/src/components/Icons';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setBalance,
  toggleShowBalance,
  setTransactions,
  addTransaction,
  updateTransactionStatus,
  setHasNewAlert,
} from '../store';
import { simEvents } from '@momo/shared/src/api/store';
import { useDispatch, useSelector } from 'react-redux';

const DEFAULT_BALANCE = { available: 10000, ledger: 10000, currency: 'GHS' };

export default function Dashboard() {
  const {
    user,
    token,
    sessionId,
    currentLocation,
    locationPermission,
    detectLocation,
    requestLocationPermission,
    logout,
  } = useAuth();
  const navigate = useNavigate();
  const dispatch = useDispatch() || useAppDispatch();
  const data = useLoaderData();

  const balance = useAppSelector(
    (state) => state.wallet?.balance ?? DEFAULT_BALANCE,
  );

  const { user: userState } = useAppSelector((state) => state.dashboard);
  const storedUser =
    typeof localStorage !== 'undefined'
      ? JSON.parse(localStorage.getItem('momo_sim_user') || 'null')
      : null;
  const activeUser = userState || user || storedUser;
  const showBalance = useAppSelector(
    (state) => state.wallet?.showBalance ?? true,
  );
  const transactions = useAppSelector(
    (state) => state.transactions?.transactions ?? [],
  );
  const hasNewAlert = useAppSelector(
    (state) => state.alerts?.hasNewAlert ?? false,
  );

  const [isLoading, setIsLoading] = useState(true);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [isAccountFrozen, setIsAccountFrozen] = useState(
    Boolean(activeUser?.status === 'frozen')
  );
  const [frozenReason, setFrozenReason] = useState(
    activeUser?.frozenReason || ''
  );

  const [input, setInput] = useState({
    fullName: null,
    password: null,
    ghanaCard: null,
    email: null,
  });

  const dispatcher = useDispatch();

  useEffect(() => {
    async function getAllTransactions() {
      try {
        const localTxns = await api.getTransactions({ limit: 10 });
        dispatch(setTransactions(Array.isArray(localTxns) ? localTxns : []));
      } catch (error) {
        console.warn('Failed to load transactions:', error);
        dispatch(setTransactions([]));
      }
    }
    getAllTransactions();
  }, [dispatch]);

  useEffect(() => {
    if (data) {
      console.log('data', data);
      dispatcher(loginUser(data?.user ?? data));
    }
  }, [data]);

  useEffect(() => {
    loadData();
  }, []);

  // Sync authenticated user to the dashboard Redux slice
  useEffect(() => {
    if (user) {
      dispatcher(loginUser(user));
    } else if (storedUser && !userState) {
      dispatcher(loginUser(storedUser));
    }
  }, [user, storedUser, dispatcher]);

  useEffect(() => {
    async function fetchUser() {
      try {
        // Use local sim store — no backend server needed
        const localUser = await api.getCurrentUser();
        if (localUser && (localUser.fullName || localUser.id)) {
          dispatcher(loginUser(localUser));
        }
      } catch (error) {
        // Sim store unavailable — ignore
      }
    }
    fetchUser();
  }, [dispatcher]);

  // Live Socket.io Sync
  useEffect(() => {
    if (!token || !sessionId) return;

    const socket = createUserSocket(token, sessionId);

    socket.on('balance:updated', (newBalance) => {
      dispatch(setBalance(newBalance));
    });

    socket.on('transaction:updated', (newTxn) => {
      dispatch(addTransaction(newTxn));
    });

    socket.on(
      'transaction:status_changed',
      ({ transactionId, status, reason }) => {
        dispatch(updateTransactionStatus({ id: transactionId, status, reason }));
      },
    );

    socket.on('alert:new', () => {
      dispatch(setHasNewAlert(true));
    });

    socket.on('account:frozen', (data) => {
      setIsAccountFrozen(true);
      if (data?.reason) setFrozenReason(data.reason);
      dispatch(setHasNewAlert(true));
    });

    socket.on('account:unfrozen', () => {
      setIsAccountFrozen(false);
      setFrozenReason('');
    });

    return () => {
      // Retain socket connection in singleton cache for stable life cycle
    };
  }, [token, sessionId, dispatch]);

  // Live SimStore local event sync for instant reflection of new transactions
  useEffect(() => {
    const handleNewTx = (newTx) => {
      if (newTx) {
        dispatch(addTransaction(newTx));
      }
    };
    simEvents.on('transaction:updated', handleNewTx);

    const onCustomEvent = (e) => {
      if (e.detail) dispatch(addTransaction(e.detail));
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('momo_sim:transaction:updated', onCustomEvent);
    }

    return () => {
      simEvents.off('transaction:updated', handleNewTx);
      if (typeof window !== 'undefined') {
        window.removeEventListener('momo_sim:transaction:updated', onCustomEvent);
      }
    };
  }, [dispatch]);

  const loadData = async () => {
    try {
      const [bal, txns] = await Promise.all([
        api.getBalance(),
        api.getTransactions({ limit: 10 }),
      ]);
      dispatch(setBalance(bal));
      if (Array.isArray(txns) && txns.length > 0) {
        dispatch(setTransactions(txns));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyPhone = () => {
    const phoneToCopy = activeUser?.phoneNumber || user?.phoneNumber;
    if (!phoneToCopy) return;
    navigator.clipboard.writeText(phoneToCopy);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const services = [
    {
      label: 'Send Money',
      sublabel: isAccountFrozen ? 'Disabled (Frozen)' : 'P2P Transfer',
      icon: <SendIcon size={18} color={isAccountFrozen ? '#9CA3AF' : '#8A0F13'} />,
      bg: isAccountFrozen
        ? 'bg-neutral-100 opacity-60 cursor-not-allowed'
        : 'bg-red-50 hover:bg-red-100 border-red-100/80',
      action: () => {
        if (isAccountFrozen) {
          alert(
            'Your wallet is temporarily frozen by fraud operations. Outgoing transfers are disabled.',
          );
        } else {
          navigate('/send');
        }
      },
    },
    {
      label: 'Cash Out',
      sublabel: 'Agent Withdrawal',
      icon: <CashOutIcon size={18} color="#D97706" />,
      bg: 'bg-amber-50 hover:bg-amber-100 border-amber-100/80',
      action: () => navigate('/cash-out'),
    },
    {
      label: 'Cash In',
      sublabel: 'Top-up & Deposit',
      icon: <CashInIcon size={18} color="#0D9488" />,
      bg: 'bg-teal-50 hover:bg-teal-100 border-teal-100/80',
      action: () => navigate('/cash-in'),
    },
    {
      label: 'Pay Bills',
      sublabel: 'Utilities',
      icon: <PayBillIcon size={18} color="#059669" />,
      bg: 'bg-emerald-50 hover:bg-emerald-100 border-emerald-100/80',
      action: () => navigate('/pay-bill'),
    },
    {
      label: 'Buy Goods',
      sublabel: 'Merchant Pay',
      icon: <BuyGoodsIcon size={18} color="#E11D48" />,
      bg: 'bg-rose-50 hover:bg-rose-100 border-rose-100/80',
      action: () => navigate('/buy-goods'),
    },
    {
      label: 'My QR Code',
      sublabel: 'Receive Money',
      icon: <QrCodeIcon size={18} color="#7C3AED" />,
      bg: 'bg-purple-50 hover:bg-purple-100 border-purple-100/80',
      action: () => setShowQrModal(true),
    },
  ];

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'send':
        return <SendIcon size={18} color="#8A0F13" />;
      case 'receive':
      case 'cash_in':
        return <ReceiveIcon size={18} color="#059669" />;
      case 'cash_out':
        return <CashOutIcon size={18} color="#D97706" />;
      case 'pay_bill':
        return <PayBillIcon size={18} color="#059669" />;
      case 'buy_goods':
        return <BuyGoodsIcon size={18} color="#E11D48" />;
      default:
        return <HistoryIcon size={18} color="#6B7280" />;
    }
  };

  const getAmountDisplay = (txn) => {
    const isOutgoing = ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(
      txn.type,
    );
    const prefix = isOutgoing ? '−' : '+';
    const color = isOutgoing ? 'text-neutral-900' : 'text-green-700';
    return { prefix, color };
  };

  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHrs < 1) return 'Just now';
    if (diffHrs < 24) return `${diffHrs}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className="page-container animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-56 bg-white rounded-none border border-neutral-200 animate-pulse p-6" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-white rounded-2xl border border-neutral-200 animate-pulse"
                />
              ))}
            </div>
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-96 bg-white rounded-none border border-neutral-200 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  //get transaction from the database

  // user details from useSelector

  // const { user: userState } = useSelector((state) => state.dashboard);

  // console.log('userState', userState)

  return (
    <div className="page-container animate-fade-in">
      {/* Top Welcome Header: Hi, Username */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 bg-white p-5 sm:p-6 rounded-none border border-neutral-200/80 shadow-xs">
        <div className="flex items-center gap-3.5">
          {activeUser?.profilePicture ? (
            <img
              src={activeUser.profilePicture}
              alt={activeUser.fullName || 'User'}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary-800 shadow-sm shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center font-black text-base shadow-sm shrink-0">
              {activeUser?.fullName
                ? activeUser.fullName
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'SP'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-neutral-900 tracking-tight">
                Hi, {activeUser?.fullName || 'User'}
              </h1>
              {isAccountFrozen ? (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 border border-red-300 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                  Account Frozen
                </span>
              ) : (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Verified Active
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-neutral-500 mt-0.5">
              Welcome back to your mobile money wallet. All security defenses
              and fraud models are active.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={() => navigate('/transactions')}
            className="btn-secondary text-xs py-2 px-3.5 whitespace-nowrap font-bold text-neutral-700 hover:text-primary-800"
          >
            Full Statement
          </button>
        </div>
      </div>

      {/* Wallet Security Lockdown Alert */}
      {isAccountFrozen && (
        <div className="mb-6 p-4 sm:p-5 bg-red-50 border-2 border-red-200 rounded-3xl flex items-start gap-4 shadow-sm animate-fade-in">
          <div className="w-11 h-11 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-red-900">
                Wallet Security Lockdown Active
              </h3>
              <span className="text-[10px] uppercase font-black bg-red-600 text-white px-2.5 py-0.5 rounded-full tracking-wider">
                Account Frozen
              </span>
            </div>
            <p className="text-xs sm:text-sm text-red-800 mt-1 leading-relaxed font-medium">
              {frozenReason ||
                'Your wallet has been temporarily frozen by fraud operations following suspicious transaction activity. Outgoing transfers and cash-outs are disabled for your protection.'}
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
              <span className="font-semibold text-red-900">
                Resolution: Contact fraud support at{' '}
                <span className="underline">support@swipepay.gh</span> or visit a
                customer center with your Ghana Card.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Dashboard Grid (8 cols main + 4 cols side) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left / Main Area */}
        <div className="lg:col-span-8 space-y-6">
          {/* Hero Wallet Card — Solid clean dark primary theme */}
          <div className="bg-primary-800 text-white rounded-none p-5 sm:p-8 shadow-sm border border-primary-900 relative overflow-hidden">
            {/* Top row */}
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2 sm:gap-2.5">
                <img
                  src={swipePayLogo}
                  alt="Swipe Pay"
                  className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
                />
                <div>
                  <p className="text-[11px] sm:text-xs font-bold tracking-wider text-red-100 uppercase">
                    SWIPE PAY WALLET
                  </p>
                  <p className="text-[10px] sm:text-[11px] text-white/70">
                    Main Active Account
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-white/15 text-white border border-white/20">
                  GHS (₵)
                </span>
                <button
                  onClick={() => dispatch(toggleShowBalance())}
                  className="text-white/80 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                  aria-label={showBalance ? 'Hide balance' : 'Show balance'}
                >
                  {showBalance ? (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  ) : (
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Balance Display */}
            <div className="my-2 sm:my-3">
              <p className="text-[11px] sm:text-xs text-red-200 font-medium uppercase tracking-wide">
                Available Balance
              </p>
              <p className="text-3xl sm:text-5xl font-black tracking-tight font-mono mt-1 text-white">
                {/* userState?.balance ||  */}
                {userState?.balance || showBalance
                  ? formatCurrency(balance?.available ?? 10000)
                  : 'GH₵ ••••••'}
              </p>
            </div>

            {/* Account Details & Quick Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3.5 sm:pt-4 mt-3.5 sm:mt-4 border-t border-white/15 gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <button
                  onClick={handleCopyPhone}
                  className="flex items-center gap-1.5 text-white/80 hover:text-white transition-colors group"
                >
                  <span className="font-mono text-xs sm:text-sm font-semibold">
                    {activeUser?.phoneNumber ?? '+233 24 123 4567'}
                  </span>
                  {copiedPhone ? (
                    <span className="inline-flex items-center text-[10px] sm:text-[11px] text-green-300 font-bold bg-green-950/80 px-2 py-0.5 rounded">
                      Copied
                    </span>
                  ) : (
                    <CopyIcon
                      size={14}
                      color="#fca5a5"
                      className="group-hover:text-white transition-colors"
                    />
                  )}
                </button>
                <span className="text-white/40 hidden sm:inline">•</span>
                <span className="text-[11px] sm:text-xs text-white/70">
                  Daily Limit: GH₵ 20k/day
                </span>
              </div>

              <div className="flex items-center">
                <button
                  onClick={() => navigate('/send')}
                  className="w-full sm:w-auto px-5 py-2.5 bg-white text-primary-800 hover:bg-neutral-100 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95"
                >
                  <span>Send Money</span>
                  <span>→</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Operations & Services Grid (6 Core MoMo Services) */}
          <div className="bg-white rounded-none p-4 sm:p-5 border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-xs sm:text-sm font-bold text-neutral-900 tracking-tight">
                  Quick Operations
                </h2>
                <p className="text-[10px] sm:text-[11px] text-neutral-400">
                  Transfers, Cash Out, Cash In, and utility bills
                </p>
              </div>
              <span className="text-[9px] sm:text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full uppercase">
                Services
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
              {services.map((service, idx) => (
                <button
                  key={idx}
                  onClick={service.action}
                  className="flex items-center gap-3 p-3 sm:p-3.5 rounded-2xl bg-neutral-50/70 border border-neutral-200/70 hover:bg-white hover:border-neutral-300 hover:shadow-xs active:scale-95 transition-all text-left group cursor-pointer"
                >
                  <div
                    className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center border shrink-0 transition-transform group-hover:scale-105 ${service.bg}`}
                  >
                    {service.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold text-neutral-800 leading-tight block truncate">
                      {service.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 font-medium block truncate mt-0.5">
                      {service.sublabel}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Device Location Telemetry & AI Security Defense Card */}
          <div className="bg-white rounded-none p-5 sm:p-6 border border-neutral-200 shadow-xs space-y-3.5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-primary-800 text-white flex items-center justify-center shrink-0">
                  <LocationPinIcon size={20} color="#ffffff" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-bold text-neutral-900">
                      Auto-Detected Physical Location
                    </h3>
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        currentLocation?.country === 'Ghana' ||
                        [
                          'Sunyani',
                          'Accra',
                          'Tema',
                          'Kumasi',
                          'Takoradi',
                          'Tamale',
                          'Cape Coast',
                          'Koforidua',
                          'Ho',
                          'Wa',
                          'Bolgatanga',
                          'Techiman',
                        ].includes(currentLocation?.city ?? '')
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border-amber-200'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          currentLocation?.country === 'Ghana' ||
                          [
                            'Sunyani',
                            'Accra',
                            'Tema',
                            'Kumasi',
                            'Takoradi',
                            'Tamale',
                            'Cape Coast',
                            'Koforidua',
                            'Ho',
                            'Wa',
                            'Bolgatanga',
                            'Techiman',
                          ].includes(currentLocation?.city ?? '')
                            ? 'bg-emerald-500'
                            : 'bg-amber-500'
                        } animate-pulse`}
                      />
                      {currentLocation?.country === 'Ghana' ||
                      [
                        'Sunyani',
                        'Accra',
                        'Tema',
                        'Kumasi',
                        'Takoradi',
                        'Tamale',
                        'Cape Coast',
                        'Koforidua',
                        'Ho',
                        'Wa',
                        'Bolgatanga',
                        'Techiman',
                      ].includes(currentLocation?.city ?? '')
                        ? 'Safe Trusted Zone'
                        : 'Anomalous Location'}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full">
                      {currentLocation?.source === 'gps'
                        ? 'Hardware GPS'
                        : 'Network IP'}
                      {currentLocation?.accuracy
                        ? ` (+/-${currentLocation.accuracy}m)`
                        : ''}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 mt-1 font-medium">
                    <strong className="text-neutral-900">
                      {currentLocation?.city || 'Detecting...'}
                    </strong>
                    {currentLocation?.region
                      ? `, ${currentLocation.region}`
                      : ''}{' '}
                    ({currentLocation?.country || 'Ghana'})
                    {currentLocation?.latitude &&
                      currentLocation?.longitude && (
                        <span className="text-neutral-400 font-mono text-[11px] ml-2">
                          ({currentLocation.latitude.toFixed(4)}° N,{' '}
                          {currentLocation.longitude.toFixed(4)}° W)
                        </span>
                      )}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    Physical device location captured where the platform was
                    opened. AI Geofencing defense active.
                  </p>
                </div>
              </div>
              <button
                onClick={() => requestLocationPermission()}
                className="btn-secondary text-xs py-2 px-3.5 whitespace-nowrap shrink-0 flex items-center gap-1.5 text-primary-800 font-bold hover:bg-neutral-50"
              >
                <span>Refresh GPS</span>
              </button>
            </div>

            {/* If browser location permission is needed or was denied */}
            {locationPermission === 'prompt' && (
              <div className="p-3 bg-red-50/60 border border-primary-100 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <LocationPinIcon size={14} color="#8A0F13" />
                  <p className="text-primary-950 font-medium">
                    Allow physical browser location access to automatically
                    pinpoint your exact physical location
                    {currentLocation?.city ? ` (${currentLocation.city})` : ''}.
                  </p>
                </div>
                <button
                  onClick={() => requestLocationPermission()}
                  className="px-3 py-1 bg-primary-800 hover:bg-primary-900 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-2xs"
                >
                  Enable Physical GPS
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right / Sidebar Area */}
        <div className="lg:col-span-4 space-y-6">
          {/* Recent Statement Feed */}
          <div className="bg-white rounded-none p-5 sm:p-6 border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-900 tracking-tight">
                  Recent Activity
                </h2>
                <span className="px-2 py-0.5 bg-neutral-100 text-neutral-600 rounded-full text-[10px] font-bold">
                  {transactions.length}
                </span>
              </div>
              <button
                onClick={() => navigate('/transactions')}
                className="text-xs text-primary-800 font-bold hover:underline"
              >
                View Full Statement →
              </button>
            </div>

            {transactions.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center">
                <div className="mb-2 text-neutral-300">
                  <EmptyBoxIcon size={40} />
                </div>
                <p className="text-neutral-700 font-bold text-xs">
                  No activity yet
                </p>
                <p className="text-neutral-400 text-[11px] mt-0.5">
                  Your transactions will appear here instantly.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {transactions.slice(0, 6).map((txn) => {
                  const { prefix, color } = getAmountDisplay(txn);
                  return (
                    <div
                      key={txn.id}
                      onClick={() => navigate('/transactions')}
                      className="flex items-center gap-3 py-3 hover:bg-neutral-50 rounded-xl px-2 -mx-2 transition-colors cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0">
                        {getTransactionIcon(txn.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-neutral-900 truncate">
                            {TRANSACTION_TYPE_LABELS[txn.type] ?? txn.type}
                          </p>
                          {txn.status !== 'completed' && (
                            <StatusBadge status={txn.status} />
                          )}
                          {txn.mlScore != null && (
                            <MlScoreBadge score={txn.mlScore} riskLevel={txn.mlRiskLevel} />
                          )}
                        </div>
                        <p className="text-[11px] text-neutral-500 truncate">
                          {txn.receiverName || txn.receiver || 'Swipe Pay'} •{' '}
                          {formatTime(txn.createdAt)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-xs sm:text-sm font-black font-mono ${color}`}
                        >
                          {prefix}
                          {formatCurrency(txn.amount)}
                        </p>
                        <p className="text-[10px] text-neutral-400 uppercase">
                          GHS
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Account Security Overview Widget */}
          <div className="bg-white rounded-none p-5 border border-neutral-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
              Account Credentials
            </h3>

            <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">KYC Status:</span>
                <span className="font-bold text-emerald-700 flex items-center">
                  Verified (Level 2)
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Ghana Card:</span>
                <span className="font-mono font-bold text-neutral-800">
                  {activeUser?.ghanaCardId
                    ? `${activeUser.ghanaCardId.slice(0, 4)}•••••${activeUser.ghanaCardId.slice(-3)}`
                    : 'GHA-•••••481-2'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Biometric 2FA:</span>
                <span className="font-semibold text-neutral-800">
                  Facial Scan Enabled
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* My QR Code Modal (For people to send money with QR) */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-none border border-neutral-200 max-w-sm w-full p-6 sm:p-7 shadow-xl animate-scale-in text-center space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                  <QrCodeIcon size={18} color="#7C3AED" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  My Receive QR Code
                </h3>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-neutral-500">
              Show this QR code to anyone to receive instant money transfers
              into your wallet.
            </p>

            {/* QR Code container */}
            <div className="w-48 h-48 mx-auto bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-3xl flex flex-col items-center justify-center p-4 shadow-inner">
              <QrCodeIcon size={110} color="#171717" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-1">
                Scan to Send Money
              </p>
            </div>

            <div>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">
                Your MoMo Number
              </p>
              <p className="text-xl font-black font-mono text-neutral-900 mt-0.5">
                {user?.phoneNumber ?? '024 123 4567'}
              </p>
              <p className="text-xs font-bold text-neutral-600 mt-0.5">
                {user?.fullName ?? 'Swipe Pay Customer'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={handleCopyPhone}
                className="btn-primary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
              >
                {copiedPhone ? (
                  <>
                    <CheckIcon size={15} color="#ffffff" />
                    <span>Number Copied!</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={15} color="#ffffff" />
                    <span>Copy Mobile Number</span>
                  </>
                )}
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="btn-secondary w-full py-2.5 text-xs text-neutral-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export async function loader({ request, params } = {}) {
  try {
    // Use local sim store — no backend server needed
    const user = await api.getCurrentUser();
    return user ?? null;
  } catch (error) {
    console.warn('Dashboard loader: could not load user:', error);
    return null;
  }
}
