import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import { formatCurrency } from '@momo/shared/src/constants'
import { createAdminSocket } from '@momo/shared/src/socket/client'
import {
  ShieldAlertIcon,
  ZapIcon,
  DeviceMobileIcon,
  SendIcon,
  HistoryIcon,
  LocationPinIcon,
  FreezeIcon,
  UserIcon,
} from '@momo/shared/src/components/Icons'

export default function LiveFeed() {
  const navigate = useNavigate()
  const location = useLocation()

  // Tab mode: 'transactions' (all system transactions) or 'cases' (flagged fraud cases)
  const [viewMode, setViewMode] = useState(
    location.pathname.startsWith('/cases') ? 'cases' : 'transactions'
  )

  const [transactions, setTransactions] = useState([])
  const [cases, setCases] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Drawer modal for full sender details
  const [selectedTxn, setSelectedTxn] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Filters
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterRisk, setFilterRisk] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (location.pathname.startsWith('/cases')) {
      setViewMode('cases')
    } else if (location.pathname === '/') {
      setViewMode('transactions')
    }
  }, [location.pathname])

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)

    loadData()

    if (token) {
      const socket = createAdminSocket(token)

      // Listen for all new live transactions
      socket.on('admin:transaction:new', (newTxn) => {
        setTransactions((prev) => {
          const exists = prev.some((t) => t.id === newTxn.id)
          if (exists) return prev
          return [newTxn, ...prev]
        })
      })

      // Listen for newly generated security incident cases
      socket.on('admin:case:new', (newCase) => {
        setCases((prev) => {
          const exists = prev.some((c) => c.id === newCase.id)
          if (exists) return prev
          return [newCase, ...prev]
        })
      })

      // Listen for case status updates (approved, blocked, notes)
      socket.on('admin:case:updated', (updatedCase) => {
        setCases((prev) =>
          prev.map((c) => (c.id === updatedCase.id ? { ...c, ...updatedCase } : c))
        )
      })

      return () => {
        socket.disconnect()
      }
    }
  }, [])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [casesData, txnsData] = await Promise.all([
        adminApi.getCases(),
        adminApi.getAllTransactions(),
      ])
      setCases(casesData || [])
      setTransactions(txnsData || [])
    } catch (err) {
      console.error('Failed to load admin feed data:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleFreeze = async (userId, currentStatus) => {
    if (!userId) return
    const isFrozen = currentStatus === 'frozen'
    setActionLoading(true)
    try {
      if (isFrozen) {
        await adminApi.unfreezeAccount(userId, 'Account reactivated by administrator')
      } else {
        await adminApi.freezeAccount(userId, 'Account locked by administrator')
      }

      // Update in selectedTxn
      setSelectedTxn((prev) => {
        if (!prev) return null
        return {
          ...prev,
          senderDetails: {
            ...prev.senderDetails,
            status: isFrozen ? 'active' : 'frozen',
          },
        }
      })

      // Update in transactions list
      setTransactions((prev) =>
        prev.map((t) => {
          if (t.senderDetails?.userId === userId) {
            return {
              ...t,
              senderDetails: {
                ...t.senderDetails,
                status: isFrozen ? 'active' : 'frozen',
              },
            }
          }
          return t
        })
      )
    } catch (err) {
      console.error('Error toggling account freeze state:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const getChannelInfo = (channelOrType) => {
    const raw = String(channelOrType || '').toLowerCase()
    if (raw.includes('cash_out') || raw.includes('cashout') || raw.includes('withdraw')) {
      return {
        key: 'cash_out',
        label: 'Cash Out',
        badge: 'bg-amber-50 text-amber-900 border border-amber-300',
        dot: 'bg-amber-600',
        icon: '⇥',
      }
    }
    if (raw.includes('cash_in') || raw.includes('cashin') || raw.includes('deposit')) {
      return {
        key: 'cash_in',
        label: 'Cash In',
        badge: 'bg-emerald-50 text-emerald-900 border border-emerald-300',
        dot: 'bg-emerald-600',
        icon: '↙',
      }
    }
    return {
      key: 'send_money',
      label: 'Send Money',
      badge: 'bg-indigo-50 text-indigo-900 border border-indigo-200',
      dot: 'bg-indigo-600',
      icon: '↗',
    }
  }

  // Filtered Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterRisk !== 'all' && t.mlRiskLevel !== filterRisk) return false
      if (filterChannel !== 'all') {
        const ch = getChannelInfo(t.channel || t.type || t.reason).key
        if (ch !== filterChannel) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesSender = (t.sender || '').toLowerCase().includes(q)
        const matchesReceiver = (t.receiver || '').toLowerCase().includes(q)
        const matchesId = (t.id || '').toLowerCase().includes(q)
        const matchesCity = (t.location?.city || '').toLowerCase().includes(q)
        const matchesName = (t.senderDetails?.fullName || '').toLowerCase().includes(q)
        const matchesEmail = (t.senderDetails?.email || '').toLowerCase().includes(q)
        const matchesGhanaCard = (t.senderDetails?.ghanaCard || '').toLowerCase().includes(q)
        const matchesChannel = getChannelInfo(t.channel || t.type || t.reason).label.toLowerCase().includes(q)
        if (
          !matchesSender &&
          !matchesReceiver &&
          !matchesId &&
          !matchesCity &&
          !matchesName &&
          !matchesEmail &&
          !matchesGhanaCard &&
          !matchesChannel
        ) {
          return false
        }
      }
      return true
    })
  }, [transactions, filterStatus, filterRisk, filterChannel, searchQuery])

  // Filtered Cases
  const filteredCases = useMemo(() => {
    return cases.filter((c) => {
      if (filterStatus !== 'all' && c.status !== filterStatus) return false
      if (filterType !== 'all' && c.detectionType !== filterType) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesUser = (c.userName || '').toLowerCase().includes(q) || (c.userPhone || '').includes(q)
        const matchesId = (c.id || '').toLowerCase().includes(q)
        if (!matchesUser && !matchesId) return false
      }
      return true
    })
  }, [cases, filterStatus, filterType, searchQuery])

  // Transaction Stats
  const transactionStats = useMemo(() => {
    const totalVolume = transactions.reduce((acc, t) => acc + (t.amount || 0), 0)
    const completedCount = transactions.filter((t) => t.status === 'completed' || t.status === 'approved').length
    const blockedCount = transactions.filter((t) => t.status === 'blocked' || t.status === 'flagged').length
    const sendCount = transactions.filter((t) => getChannelInfo(t.channel || t.type || t.reason).key === 'send_money').length
    const cashOutCount = transactions.filter((t) => getChannelInfo(t.channel || t.type || t.reason).key === 'cash_out').length
    const cashInCount = transactions.filter((t) => getChannelInfo(t.channel || t.type || t.reason).key === 'cash_in').length
    const scores = transactions.map((t) => t.mlScore).filter((s) => typeof s === 'number')
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
    return {
      total: transactions.length,
      volume: totalVolume,
      completed: completedCount,
      blocked: blockedCount,
      sendCount,
      cashOutCount,
      cashInCount,
      avgScore,
    }
  }, [transactions])

  // Case Stats
  const caseStats = useMemo(() => {
    const open = cases.filter((c) => c.status === 'open' || c.status === 'under_review').length
    const critical = cases.filter((c) => c.riskLevel === 'critical').length
    const atod = cases.filter((c) => c.detectionType === 'atod').length
    const scores = cases.map((c) => c.transaction?.mlScore).filter((s) => typeof s === 'number')
    const avgMlScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
    return { open, critical, atod, total: cases.length, avgMlScore }
  }, [cases])

  const getMlScoreColor = (score) => {
    if (score >= 0.8) return 'text-[#8A0F13] bg-[#F2D5D6] font-black'
    if (score >= 0.6) return 'text-orange-700 bg-orange-50 font-bold'
    if (score >= 0.3) return 'text-amber-700 bg-amber-50 font-semibold'
    return 'text-emerald-700 bg-emerald-50 font-medium'
  }

  const statusStyles = {
    open: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
    under_review: 'bg-[#F2D5D6] text-[#8A0F13] border border-[#F9A8A8]',
    approved: 'bg-neutral-100 text-neutral-700',
    completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold',
    blocked: 'bg-[#8A0F13] text-white font-bold',
    flagged: 'bg-amber-100 text-amber-800 font-semibold',
    escalated: 'bg-neutral-900 text-white',
  }

  const riskStyles = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-amber-100 text-amber-800 font-semibold',
    high: 'bg-[#F2D5D6] text-[#8A0F13] font-bold',
    critical: 'bg-[#8A0F13] text-white font-bold',
  }

  const formatTime = (dateStr) => {
    if (!dateStr) return 'Just now'
    const date = new Date(dateStr)
    const now = new Date()
    const diffHrs = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffHrs < 1) {
      const diffMins = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
      if (diffMins < 1) return 'Just now'
      return `${diffMins}m ago`
    }
    if (diffHrs < 24) return `${diffHrs}h ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in relative">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">
            {viewMode === 'transactions' ? 'Live System Transactions' : 'Live Fraud Cases Queue'}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">
            {viewMode === 'transactions'
              ? 'Real-time telemetry of all customer transfers, sender identities, and XGBoost risk scores'
              : 'Security analyst queue for flagged account takeovers and suspicious transfers'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-white rounded-full border border-neutral-200 shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span className="text-xs font-semibold text-neutral-700 font-mono">LIVE SOCKET SYNC</span>
          </div>

          <button
            onClick={loadData}
            className="p-2 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-600 transition-colors shadow-xs"
            title="Refresh Feed"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
            </svg>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="flex items-center p-1 bg-neutral-200/70 rounded-2xl w-full sm:w-fit">
        <button
          onClick={() => {
            setViewMode('transactions')
            navigate('/', { replace: true })
          }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            viewMode === 'transactions'
              ? 'bg-white text-neutral-900 shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <HistoryIcon size={16} />
          <span>All Transactions</span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
            viewMode === 'transactions' ? 'bg-neutral-900 text-white' : 'bg-neutral-300 text-neutral-700'
          }`}>
            {transactions.length}
          </span>
        </button>

        <button
          onClick={() => {
            setViewMode('cases')
            navigate('/cases', { replace: true })
          }}
          className={`flex-1 sm:flex-none flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all ${
            viewMode === 'cases'
              ? 'bg-neutral-900 text-white shadow-sm'
              : 'text-neutral-600 hover:text-neutral-900'
          }`}
        >
          <ShieldAlertIcon size={16} color={viewMode === 'cases' ? '#fff' : '#8A0F13'} />
          <span>Flagged Security Cases</span>
          {caseStats.open > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded-full font-mono bg-red-600 text-white font-bold animate-pulse">
              {caseStats.open}
            </span>
          )}
          {caseStats.open === 0 && (
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-mono ${
              viewMode === 'cases' ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-300 text-neutral-700'
            }`}>
              {cases.length}
            </span>
          )}
        </button>
      </div>

      {/* KPI Cards Bar */}
      {viewMode === 'transactions' ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Total Transactions</span>
              <HistoryIcon size={16} color="#737373" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{transactionStats.total}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Processed to date</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Total Volume</span>
              <span className="text-xs font-bold text-neutral-400">GH₵</span>
            </div>
            <p className="text-2xl font-black text-neutral-900">{formatCurrency(transactionStats.volume)}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Gross transit volume</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Successful Transfers</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <p className="text-2xl font-black text-emerald-700">{transactionStats.completed}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Clean & settled</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Auto-Blocked</span>
              <ShieldAlertIcon size={16} color="#8A0F13" />
            </div>
            <p className="text-2xl font-black text-[#8A0F13]">{transactionStats.blocked}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Model A zero-deduction</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Avg ML Risk</span>
              <ZapIcon size={16} color="#059669" />
            </div>
            <p className="text-2xl font-black text-neutral-900">
              {(transactionStats.avgScore * 100).toFixed(1)}%
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">FastAPI XGBoost</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Open Cases</span>
              <span className="w-2 h-2 rounded-full bg-primary-800" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{caseStats.open}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Requiring review</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Critical Risk</span>
              <ShieldAlertIcon size={16} color="#8A0F13" />
            </div>
            <p className="text-2xl font-black text-[#8A0F13]">{caseStats.critical}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Immediate action</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">ATOD Flagged</span>
              <DeviceMobileIcon size={16} color="#171717" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{caseStats.atod}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Account takeover</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Total Flagged</span>
              <ZapIcon size={16} color="#737373" />
            </div>
            <p className="text-2xl font-black text-neutral-900">{caseStats.total}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">All time records</p>
          </div>

          <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs col-span-2 sm:col-span-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-neutral-500">Avg ML Score</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
                <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
              </svg>
            </div>
            <p className="text-2xl font-black text-[#8A0F13]">
              {caseStats.avgMlScore !== null ? (caseStats.avgMlScore * 100).toFixed(0) + '%' : '—'}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Fraud probability</p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-none border border-neutral-100 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
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
            placeholder={
              viewMode === 'transactions'
                ? 'Search by Sender Name, Phone, Ghana Card, or Transaction ID...'
                : 'Search by User, Phone number, or Case ID...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-100 focus:bg-white transition-all"
          />
        </div>

        <div className="flex gap-2.5 flex-wrap sm:flex-nowrap">
          {viewMode === 'transactions' ? (
            <>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="blocked">Blocked (Auto-ML)</option>
                <option value="approved">Approved</option>
                <option value="processing">Processing</option>
              </select>

              <select
                value={filterRisk}
                onChange={(e) => setFilterRisk(e.target.value)}
                className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All Risk Levels</option>
                <option value="low">Low Risk (&lt; 30%)</option>
                <option value="medium">Medium Risk (30 - 60%)</option>
                <option value="high">High Risk (60 - 80%)</option>
                <option value="critical">Critical Risk (&gt; 80%)</option>
              </select>
            </>
          ) : (
            <>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="under_review">Under Review</option>
                <option value="blocked">Blocked</option>
                <option value="escalated">Escalated</option>
                <option value="approved">Approved</option>
              </select>

              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
              >
                <option value="all">All Detection Types</option>
                <option value="atod">Account Takeover (ATOD)</option>
                <option value="transaction_anomaly">Transaction Anomaly</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Main Table Content */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : viewMode === 'transactions' ? (
        /* ALL TRANSACTIONS TABLE */
        <div className="bg-white rounded-none border border-neutral-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[850px]">
              <thead>
                <tr className="bg-neutral-50/70">
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Ref ID</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Channel / Type</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Sender Full Details</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Receiver</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Amount</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">ML Risk Score</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Location & Device</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-left">Status</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredTransactions.map((t, idx) => {
                  const ch = getChannelInfo(t.channel || t.type || t.reason)
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelectedTxn(t)}
                      className="cursor-pointer hover:bg-neutral-50/80 transition-colors animate-fade-in group"
                      style={{ animationDelay: `${idx * 20}ms` }}
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 group-hover:bg-neutral-200 px-2 py-1 rounded-lg transition-colors">
                          {t.id.slice(-8).toUpperCase()}
                        </span>
                      </td>
                      {/* Channel / Type */}
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-lg ${ch.badge}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${ch.dot}`} />
                          <span>{ch.icon}</span>
                          <span>{ch.label}</span>
                        </span>
                      </td>
                      {/* Sender Full Details */}
                      <td className="py-3.5 px-4">
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-sm text-neutral-900">
                            <UserIcon size={14} className="text-neutral-400 shrink-0" />
                            <span>{t.senderDetails?.fullName || 'Swipe Pay User'}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-xs text-neutral-500">{t.senderDetails?.phoneNumber || t.sender}</span>
                            {t.senderDetails?.ghanaCard && t.senderDetails.ghanaCard !== '—' && (
                              <span className="text-[10px] font-mono font-semibold bg-primary-50 text-[#8A0F13] px-1.5 py-0.2 rounded border border-primary-100">
                                {t.senderDetails.ghanaCard}
                              </span>
                            )}
                          </div>
                          {t.senderDetails?.email && (
                            <p className="text-[11px] text-neutral-400 truncate max-w-[200px] mt-0.5">{t.senderDetails.email}</p>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-neutral-600">
                          {t.receiver || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-black text-neutral-900 text-sm">
                        {formatCurrency(t.amount ?? 0)}
                      </td>
                    <td className="py-3.5 px-4">
                      {typeof t.mlScore === 'number' ? (
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 font-mono ${getMlScoreColor(t.mlScore)}`}>
                          {t.mlScore >= 0.8 && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                          {(t.mlScore * 100).toFixed(1)}%
                          <span className="text-[10px] font-sans uppercase font-bold opacity-80">
                            ({t.mlRiskLevel})
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col text-xs">
                        <span className="font-semibold text-neutral-800 flex items-center gap-1">
                          <LocationPinIcon size={12} className="text-neutral-400 shrink-0" />
                          {t.location?.city || 'Accra'}, {t.location?.country || 'Ghana'}
                        </span>
                        <span className="text-neutral-400 text-[11px] font-mono mt-0.5 truncate max-w-[140px]">
                          {t.deviceProfile?.deviceId || 'Web Client'}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5 capitalize ${statusStyles[t.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {t.status === 'completed' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />}
                        {t.status === 'blocked' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />}
                        {t.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTxn(t)
                        }}
                        className="px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-lg text-xs font-bold transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-neutral-500 font-medium text-sm">No transactions found</p>
              <p className="text-neutral-400 text-xs mt-1">Try resetting filters or perform a transaction in the customer app</p>
            </div>
          )}
        </div>
      ) : (
        /* FLAGGED SECURITY CASES TABLE */
        <div className="bg-white rounded-none border border-neutral-100 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full data-table min-w-[700px]">
              <thead>
                <tr className="bg-neutral-50/70">
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Case ID</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Customer</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Detection Model</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Amount</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">ML Score</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Risk Level</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4">Case Status</th>
                  <th className="font-semibold text-xs text-neutral-500 py-3.5 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filteredCases.map((c, idx) => (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/cases/${c.id}`)}
                    className="cursor-pointer hover:bg-neutral-50/80 transition-colors animate-fade-in"
                    style={{ animationDelay: `${idx * 25}ms` }}
                  >
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-xs font-bold text-neutral-900 bg-neutral-100 px-2 py-1 rounded-lg">
                        {c.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-neutral-900 text-sm">{c.userName}</p>
                        <p className="text-xs text-neutral-400 font-mono mt-0.5">{c.userPhone}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold rounded-full px-2.5 py-0.5 ${
                          c.detectionType === 'atod' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'
                        }`}
                      >
                        {c.detectionType === 'atod' ? 'Account takeover' : 'Transaction anomaly'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-black text-neutral-900 text-sm">
                      {formatCurrency(c.transaction?.amount ?? 0)}
                    </td>
                    <td className="py-3.5 px-4">
                      {typeof c.transaction?.mlScore === 'number' ? (
                        <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-0.5 font-mono ${getMlScoreColor(c.transaction.mlScore)}`}>
                          {c.transaction.mlScore >= 0.8 && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                          {(c.transaction.mlScore * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5 ${riskStyles[c.riskLevel]}`}>
                        {c.riskLevel === 'critical' && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />}
                        {c.riskLevel.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center text-xs font-semibold rounded-full px-2.5 py-0.5 ${statusStyles[c.status] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {(c.status === 'open' || c.status === 'under_review') && (
                          <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                        )}
                        {c.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-xs text-neutral-400 text-right whitespace-nowrap">
                      {formatTime(c.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredCases.length === 0 && (
            <div className="text-center py-16 px-4">
              <p className="text-neutral-500 font-medium text-sm">No cases match your filters or search query</p>
              <p className="text-neutral-400 text-xs mt-1">Try resetting filters to view incoming transactions</p>
            </div>
          )}
        </div>
      )}

      {/* SENDER FULL DETAILS SLIDE-OVER DRAWER */}
      {selectedTxn && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setSelectedTxn(null)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col transform transition-transform animate-slide-left">
              {/* Drawer Header */}
              <div className="p-6 bg-neutral-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary-800 text-white font-black text-lg flex items-center justify-center shadow-xs">
                    {(selectedTxn.senderDetails?.fullName || 'SP').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-lg font-black leading-tight text-white">
                      {selectedTxn.senderDetails?.fullName || 'Swipe Pay Customer'}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {selectedTxn.senderDetails?.phoneNumber || selectedTxn.sender}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTxn(null)}
                  className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-300 font-bold transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* KYC & Identity Profile */}
                <div className="bg-neutral-50 rounded-none p-5 border border-neutral-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">KYC & Identity</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      selectedTxn.senderDetails?.status === 'frozen'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {selectedTxn.senderDetails?.status || 'Active'} Account
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Legal Full Name:</span>
                      <span className="font-bold text-neutral-900">{selectedTxn.senderDetails?.fullName || '—'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Ghana Card Number:</span>
                      <span className="font-mono font-bold text-neutral-900 bg-white px-2 py-0.5 rounded border border-neutral-200">
                        {selectedTxn.senderDetails?.ghanaCard || '—'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Email Address:</span>
                      <span className="font-medium text-neutral-800">{selectedTxn.senderDetails?.email || '—'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Mobile Number:</span>
                      <span className="font-mono font-bold text-neutral-900">{selectedTxn.senderDetails?.phoneNumber || selectedTxn.sender}</span>
                    </div>

                    {typeof selectedTxn.senderDetails?.balance === 'number' && (
                      <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                        <span className="text-neutral-500">Wallet Balance:</span>
                        <span className="font-black text-neutral-900 text-sm">{formatCurrency(selectedTxn.senderDetails.balance)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center py-1">
                      <span className="text-neutral-500">Customer ID:</span>
                      <span className="font-mono text-[11px] text-neutral-500">{selectedTxn.senderDetails?.userId || '—'}</span>
                    </div>
                  </div>
                </div>

                {/* Telemetry & Device Audit */}
                <div className="bg-neutral-50 rounded-none p-5 border border-neutral-200/80 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Device & Telemetry Audit</span>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-start py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Transaction Device:</span>
                      <span className="font-mono font-semibold text-neutral-800">{selectedTxn.deviceProfile?.deviceId || 'Web Client'}</span>
                    </div>

                    <div className="flex justify-between items-start py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Registered Hardware:</span>
                      <span className="font-mono text-neutral-600 truncate max-w-[180px]">{selectedTxn.senderDetails?.registeredDevice || '—'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Hardware Match:</span>
                      <span className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                        selectedTxn.senderDetails?.registeredDevice === selectedTxn.deviceProfile?.deviceId
                          ? 'bg-green-100 text-green-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {selectedTxn.senderDetails?.registeredDevice === selectedTxn.deviceProfile?.deviceId
                          ? '✓ Exact Hardware Match'
                          : '⚡ Hardware Changed'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-neutral-500">City & Coordinates:</span>
                      <span className="font-medium text-neutral-800 text-right">
                        {selectedTxn.location?.city || 'Accra'}, {selectedTxn.location?.country || 'Ghana'}
                        <br />
                        <span className="font-mono text-[10px] text-neutral-400">
                          {selectedTxn.location?.latitude?.toFixed(4)}, {selectedTxn.location?.longitude?.toFixed(4)}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Transaction Intelligence */}
                <div className="bg-neutral-50 rounded-none p-5 border border-neutral-200/80 space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">Transaction Intelligence</span>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Transaction Reference:</span>
                      <span className="font-mono font-bold text-neutral-900">{selectedTxn.id}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Channel / Operation:</span>
                      {(() => {
                        const ch = getChannelInfo(selectedTxn.channel || selectedTxn.type || selectedTxn.reason)
                        return (
                          <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded-lg ${ch.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${ch.dot}`} />
                            <span>{ch.icon}</span>
                            <span>{ch.label}</span>
                          </span>
                        )
                      })()}
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Amount:</span>
                      <span className="font-black text-neutral-900 text-sm">{formatCurrency(selectedTxn.amount)}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">Recipient Phone:</span>
                      <span className="font-mono font-bold text-neutral-800">{selectedTxn.receiver}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-neutral-200/50">
                      <span className="text-neutral-500">XGBoost ML Score:</span>
                      <span className={`font-mono font-bold px-2 py-0.5 rounded ${getMlScoreColor(selectedTxn.mlScore)}`}>
                        {(selectedTxn.mlScore * 100).toFixed(2)}% ({selectedTxn.mlRiskLevel})
                      </span>
                    </div>

                    <div className="flex justify-between items-center py-1">
                      <span className="text-neutral-500">Execution Status:</span>
                      <span className={`font-bold capitalize ${
                        selectedTxn.status === 'completed'
                          ? 'text-emerald-700'
                          : selectedTxn.status === 'blocked'
                          ? 'text-red-700'
                          : 'text-neutral-700'
                      }`}>
                        {selectedTxn.status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="p-6 bg-white border-t border-neutral-200 space-y-3">
                {selectedTxn.senderDetails?.userId && (
                  <button
                    onClick={() => handleToggleFreeze(selectedTxn.senderDetails.userId, selectedTxn.senderDetails.status)}
                    disabled={actionLoading}
                    className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                      selectedTxn.senderDetails.status === 'frozen'
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                    }`}
                  >
                    <FreezeIcon size={16} />
                    <span>
                      {actionLoading
                        ? 'Processing...'
                        : selectedTxn.senderDetails.status === 'frozen'
                        ? 'Reactivate / Unfreeze Customer Account'
                        : 'Freeze Customer Account (Lockdown)'}
                    </span>
                  </button>
                )}

                <button
                  onClick={() => setSelectedTxn(null)}
                  className="w-full py-2.5 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-semibold text-xs transition-colors"
                >
                  Close Drawer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
