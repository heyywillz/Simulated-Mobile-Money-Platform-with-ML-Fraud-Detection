/**
 * Transaction History — Responsive desktop & mobile statement view.
 * Filter tabs, instant search, detailed modal view, and color-coded status badges.
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBadge, MlScoreBadge } from '../components/StatusBadge';
import {
  formatCurrency,
  TRANSACTION_TYPE_LABELS,
} from '@momo/shared/src/constants';
import * as api from '@momo/shared/src/api/endpoints';

import {
  SendIcon,
  ReceiveIcon,
  CashOutIcon,
  CashInIcon,
  PayBillIcon,
  BuyGoodsIcon,
  HistoryIcon,
  EmptyBoxIcon,
  CheckIcon,
} from '@momo/shared/src/components/Icons';
import { simEvents, SimStore } from '@momo/shared/src/api/store';

export default function TransactionHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxn, setSelectedTxn] = useState(null);

  useEffect(() => {
    loadTransactions();

    const handleNewTx = (newTx) => {
      if (!newTx) return;
      setTransactions((prev) => {
        const id = newTx.id || newTx._id;
        if (prev.some((t) => (t.id || t._id) === id)) return prev;
        return [newTx, ...prev];
      });
    };

    simEvents.on('transaction:updated', handleNewTx);

    const onCustomEvent = (e) => {
      if (e.detail) handleNewTx(e.detail);
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
  }, []);

  const loadTransactions = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch latest transactions from client store (all executed client transactions)
      const localTxns = await api.getTransactions({ limit: 100 });
      let list = Array.isArray(localTxns) ? [...localTxns] : [];

      // Local sim store is the sole source of truth — no backend needed

      // Sort newest first
      list.sort(
        (a, b) =>
          new Date(b.createdAt || b.date || 0) -
          new Date(a.createdAt || a.date || 0),
      );

      setTransactions(list);
    } catch (err) {
      console.error('Failed to load transactions:', err);
      const fallback = SimStore.get().getTransactions();
      setTransactions(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (
        filter === 'outgoing' &&
        !['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(t.type)
      )
        return false;
      if (filter === 'incoming' && !['receive', 'cash_in'].includes(t.type))
        return false;
      if (
        filter === 'flagged' &&
        !['flagged', 'under_review'].includes(t.status)
      )
        return false;
      if (filter === 'blocked' && t.status !== 'blocked') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = (t.receiverName || '').toLowerCase().includes(q);
        const matchPhone = (t.receiver || '').toLowerCase().includes(q);
        const matchType = (TRANSACTION_TYPE_LABELS[t.type] || t.type)
          .toLowerCase()
          .includes(q);
        const matchId = t.id.toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchType && !matchId) return false;
      }
      return true;
    });
  }, [transactions, filter, searchQuery]);

  const filters = [
    { value: 'all', label: 'All Activity' },
    { value: 'outgoing', label: 'Cash Out' },
    { value: 'incoming', label: 'Cash In' },
    { value: 'flagged', label: 'Flagged / Review' },
    { value: 'blocked', label: 'Blocked' },
  ];

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'send':
        return <SendIcon size={18} color="#8A0F13" />;
      case 'receive':
        return <ReceiveIcon size={18} color="#059669" />;
      case 'cash_out':
        return <CashOutIcon size={18} color="#D97706" />;
      case 'cash_in':
        return <CashInIcon size={18} color="#0D9488" />;
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

  const formatDateTime = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page-container animate-fade-in max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-none border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-colors text-neutral-700 md:hidden"
            aria-label="Back"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">
              Statement & History
            </h1>
            <p className="text-xs text-neutral-500 font-medium">
              {transactions.length} total operations recorded
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-80">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {/* Filter Tabs — Edge-to-edge swipeable on mobile */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1 no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border shrink-0 ${
              filter === f.value
                ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Transactions List / Grid */}
      {isLoading ? (
        <div className="bg-white rounded-none border border-neutral-200 p-6 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-16 bg-neutral-50 rounded-xl animate-pulse"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-none border border-neutral-200 p-12 text-center flex flex-col items-center shadow-xs">
          <div className="mb-3 text-neutral-300">
            <EmptyBoxIcon size={44} />
          </div>
          <p className="text-neutral-700 font-bold text-sm">
            {transactions.length === 0
              ? 'No transactions yet'
              : 'No transactions match your search'}
          </p>
          <p className="text-neutral-400 text-xs mt-1">
            {transactions.length === 0
              ? 'Transactions you perform will appear here on your statement.'
              : 'Try switching filters or search terms'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-none border border-neutral-200 shadow-xs divide-y divide-neutral-100 overflow-hidden">
          {filtered.map((txn) => {
            const { prefix, color } = getAmountDisplay(txn);
            return (
              <div
                key={txn.id}
                onClick={() => setSelectedTxn(txn)}
                className="flex items-center gap-4 p-4 sm:p-5 hover:bg-neutral-50 transition-colors cursor-pointer"
              >
                <div className="w-11 h-11 rounded-2xl bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0">
                  {getTransactionIcon(txn.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-neutral-900 truncate">
                      {TRANSACTION_TYPE_LABELS[txn.type] ?? txn.type}
                    </p>
                    <StatusBadge status={txn.status} />
                    {txn.mlScore != null && (
                      <MlScoreBadge score={txn.mlScore} riskLevel={txn.mlRiskLevel} />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mt-0.5">
                    <span className="font-semibold text-neutral-700">
                      {txn.receiverName || txn.receiver || 'Swipe Pay'}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[11px]">
                      {formatDateTime(txn.createdAt)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-sm sm:text-base font-black font-mono ${color}`}
                  >
                    {prefix}
                    {formatCurrency(txn.amount)}
                  </p>
                  <p className="text-[10px] text-neutral-400 uppercase font-medium">
                    GHS
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-none border border-neutral-200 max-w-md w-full p-6 shadow-xl animate-scale-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-neutral-100">
              <h3 className="text-base font-bold text-neutral-900">
                Transaction Receipt
              </h3>
              <button
                onClick={() => setSelectedTxn(null)}
                className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center text-neutral-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-center my-4">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-2">
                {getTransactionIcon(selectedTxn.type)}
              </div>
              <p className="text-2xl font-black font-mono text-neutral-900">
                {formatCurrency(selectedTxn.amount)}
              </p>
              <div className="mt-1 flex items-center justify-center gap-2">
                <StatusBadge status={selectedTxn.status} />
                {selectedTxn.mlScore != null && (
                  <MlScoreBadge score={selectedTxn.mlScore} riskLevel={selectedTxn.mlRiskLevel} />
                )}
              </div>
            </div>

            <div className="bg-neutral-50 rounded-none p-4 border border-neutral-200/60 text-xs space-y-2 mb-6">
              <div className="flex justify-between">
                <span className="text-neutral-500">Transaction ID:</span>
                <span className="font-mono font-bold text-neutral-800 text-[11px]">
                  {selectedTxn.id}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Type:</span>
                <span className="font-bold text-neutral-800">
                  {TRANSACTION_TYPE_LABELS[selectedTxn.type] ??
                    selectedTxn.type}
                </span>
              </div>
              {selectedTxn.receiver && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recipient:</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {selectedTxn.receiver}
                  </span>
                </div>
              )}
              {selectedTxn.receiverName && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Name:</span>
                  <span className="font-bold text-neutral-800">
                    {selectedTxn.receiverName}
                  </span>
                </div>
              )}
              {selectedTxn.reason && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">Note:</span>
                  <span className="font-medium text-neutral-700 text-right max-w-[200px]">
                    {selectedTxn.reason}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">Date:</span>
                <span className="font-medium text-neutral-700">
                  {formatDateTime(selectedTxn.createdAt)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTxn(null)}
              className="btn-primary w-full py-2.5 text-xs font-bold"
            >
              Close Receipt
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
