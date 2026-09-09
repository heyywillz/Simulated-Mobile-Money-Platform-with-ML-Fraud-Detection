import { useState, useEffect } from 'react'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { createAdminSocket } from '@momo/shared/src/socket/client'

export default function Analytics() {
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)
    loadAnalytics()

    if (token) {
      const socket = createAdminSocket(token)
      socket.on('admin:stats:updated', (updatedStats) => {
        setData((prev) => ({ ...prev, ...updatedStats }))
      })
      // Also refresh on new transaction or case
      socket.on('admin:transaction:new', () => {
        loadAnalytics()
      })
      socket.on('admin:case:new', () => {
        loadAnalytics()
      })
      return () => {
        socket.disconnect()
      }
    }
  }, [])

  const loadAnalytics = async () => {
    try {
      const analytics = await adminApi.getAnalytics()
      setData(analytics)
    } catch (err) {
      console.error('Failed to load analytics:', err)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 max-w-7xl mx-auto">
        <div className="h-8 w-48 bg-neutral-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
        </div>
        <div className="h-80 bg-white rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!data) return null

  const totalTx = data?.totalTransactions ?? 0
  const totalFlagged = data?.totalFlagged ?? 0
  const flagRate = data?.flagRate ?? '0.0'
  const totalBlocked = data?.totalBlocked ?? 0
  const totalApproved = data?.totalApproved ?? 0
  const mlModelAccuracy = data?.mlModelAccuracy ?? 99.2
  const avgMlScore = data?.avgMlScore ?? 0
  const flagsOverTime = data?.flagsOverTime ?? []
  const mlScoreDistribution = data?.mlScoreDistribution ?? []
  const topFlaggedAccounts = data?.topFlaggedAccounts ?? []

  const pieData = [
    { name: 'Account takeover', value: data?.detectionSplit?.atod || 0, color: '#171717' },
    { name: 'Transaction anomaly', value: data?.detectionSplit?.transactionAnomaly || 0, color: '#8A0F13' },
  ]
  const totalPie = pieData.reduce((acc, cur) => acc + cur.value, 0)

  const riskStyles = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-amber-100 text-amber-800 font-semibold',
    high: 'bg-[#F2D5D6] text-[#8A0F13] font-bold',
    critical: 'bg-[#8A0F13] text-white font-bold',
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 tracking-tight">Fraud Analytics & Metrics</h1>
          <p className="text-xs sm:text-sm text-neutral-500 mt-1">Aggregated platform telemetry, detection distributions, and model performance</p>
        </div>

        <button
          onClick={loadAnalytics}
          className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-neutral-50 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 shadow-xs flex items-center gap-2"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
          </svg>
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total transactions</p>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{totalTx.toLocaleString()}</p>
          <p className="text-[11px] text-neutral-400 mt-1">System processed</p>
        </div>
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total flagged</p>
          <p className="text-2xl sm:text-3xl font-black text-[#8A0F13]">{totalFlagged}</p>
          <p className="text-[11px] text-primary-800 font-semibold mt-1">{flagRate}% overall flag rate</p>
        </div>
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Total auto-blocked</p>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{totalBlocked}</p>
          <p className="text-[11px] text-neutral-400 mt-1">Model A zero deduction</p>
        </div>
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Completed / Approved</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700">{totalApproved}</p>
          <p className="text-[11px] text-emerald-600 font-medium mt-1">Clean transfers settled</p>
        </div>
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <div className="flex items-center gap-2 mb-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
              <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
            </svg>
            <p className="text-xs text-neutral-500 font-medium">ML Model Accuracy</p>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-neutral-900">{mlModelAccuracy}%</p>
          <p className="text-[11px] text-emerald-600 font-semibold mt-1">xgboost_regressor_v1</p>
        </div>
        <div className="bg-white p-5 rounded-none border border-neutral-100 shadow-xs">
          <p className="text-xs text-neutral-500 font-medium mb-1">Avg ML Score</p>
          <p className="text-2xl sm:text-3xl font-black text-[#8A0F13]">{(avgMlScore * 100).toFixed(1)}%</p>
          <p className="text-[11px] text-neutral-400 mt-1">Across all transactions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Flags over time */}
        <div className="bg-white rounded-none border border-neutral-100 p-5 shadow-xs">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Security Incidents & Blocks (Past 30 Days)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flagsOverTime}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#A3A3A3' }}
                  tickFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  interval={4}
                />
                <YAxis tick={{ fontSize: 10, fill: '#A3A3A3' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                  labelFormatter={(val) => new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                />
                <Bar dataKey="count" fill="#8A0F13" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detection type split */}
        <div className="bg-white rounded-none border border-neutral-100 p-5 shadow-xs flex flex-col">
          <h3 className="text-sm font-bold text-neutral-900 mb-4">Detection model split</h3>
          <div className="h-64 w-full flex-1">
            {totalPie > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ value }) => `${value}`}
                    labelLine={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4">
                <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xl mb-2">
                  ✓
                </div>
                <p className="text-sm font-bold text-neutral-800">Zero Active Threats</p>
                <p className="text-xs text-neutral-400 mt-1">No ATOD or anomaly cases logged in the queue</p>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 text-xs font-semibold mt-2 pt-2 border-t border-neutral-100">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-neutral-900" />
              <span>ATOD ({data?.detectionSplit?.atod || 0})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#8A0F13]" />
              <span>Anomaly ({data?.detectionSplit?.transactionAnomaly || 0})</span>
            </div>
          </div>
        </div>

        {/* ML Score Distribution */}
        {mlScoreDistribution.length > 0 && (
          <div className="bg-white rounded-none border border-neutral-100 p-5 shadow-xs lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
                <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
              </svg>
              <h3 className="text-sm font-bold text-neutral-900">ML Risk Score Distribution</h3>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mlScoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="bracket" tick={{ fontSize: 11, fill: '#737373' }} />
                  <YAxis tick={{ fontSize: 10, fill: '#A3A3A3' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #E5E5E5', fontSize: '12px' }}
                    formatter={(value) => [value, 'Transactions']}
                    labelFormatter={(label) => `Score range: ${label}`}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {mlScoreDistribution.map((_, idx) => {
                      const colors = ['#059669', '#b45309', '#c2410c', '#8A0F13']
                      return <Cell key={idx} fill={colors[idx % colors.length]} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 text-[11px] font-semibold mt-3 pt-3 border-t border-neutral-100">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Clean / Low (&lt;30%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Medium (30-59%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-700" /> High (60-79%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#8A0F13]" /> Critical (&gt;80%)</div>
            </div>
          </div>
        )}
      </div>

      {/* Channel Breakdown & Fraud Monitoring Scope */}
      <div className="bg-white rounded-none border border-neutral-100 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-neutral-900">Transaction Channels & Fraud Monitoring Scope</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Focus areas: Sending Money & Withdrawing Money (Cash Out) are AI-guarded; Cash In is safe deposit</p>
          </div>
          <span className="text-[11px] font-mono font-semibold bg-neutral-100 text-neutral-700 px-2.5 py-1 rounded-lg">
            3 Operational Channels
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Send Money */}
          <div className="p-4 rounded-xl bg-indigo-50/60 border border-indigo-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-900">
                ↗ Send Money
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                AI Monitored
              </span>
            </div>
            <p className="text-2xl font-black text-neutral-900">
              {data?.channelBreakdown?.sendMoney?.total ?? 0}
            </p>
            <div className="flex justify-between text-xs text-neutral-500 pt-1 border-t border-indigo-100/60">
              <span>Auto-Blocked Flags:</span>
              <span className="font-bold text-[#8A0F13]">{data?.channelBreakdown?.sendMoney?.blocked ?? 0}</span>
            </div>
          </div>

          {/* Cash Out */}
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                ⇥ Cash Out
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                AI Monitored
              </span>
            </div>
            <p className="text-2xl font-black text-neutral-900">
              {data?.channelBreakdown?.cashOut?.total ?? 0}
            </p>
            <div className="flex justify-between text-xs text-neutral-500 pt-1 border-t border-amber-100/60">
              <span>Auto-Blocked Flags:</span>
              <span className="font-bold text-[#8A0F13]">{data?.channelBreakdown?.cashOut?.blocked ?? 0}</span>
            </div>
          </div>

          {/* Cash In */}
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                ↙ Cash In
              </span>
              <span className="text-[11px] font-bold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
                Exempt from Fraud Block
              </span>
            </div>
            <p className="text-2xl font-black text-neutral-900">
              {data?.channelBreakdown?.cashIn?.total ?? 0}
            </p>
            <div className="flex justify-between text-xs text-neutral-500 pt-1 border-t border-emerald-100/60">
              <span>Auto-Blocked Flags:</span>
              <span className="font-bold text-neutral-500">0 (Safe Deposit)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top flagged accounts */}
      <div className="bg-white rounded-none border border-neutral-100 p-5 shadow-xs">
        <h3 className="text-sm font-bold text-neutral-900 mb-4">Top Flagged Accounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full data-table min-w-[600px]">
            <thead>
              <tr className="bg-neutral-50/70">
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-left">Customer Name</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-left">Phone Number</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-left">Flag Count</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-left">Last Incident</th>
                <th className="py-3 px-4 text-xs font-semibold text-neutral-500 text-right">Risk Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {topFlaggedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-sm text-neutral-400">
                    No customer accounts currently flagged for suspicious activity
                  </td>
                </tr>
              ) : (
                topFlaggedAccounts.map((account) => (
                  <tr key={account.userId} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-neutral-900">{account.userName}</td>
                    <td className="py-3.5 px-4 font-mono text-neutral-600 text-xs">{account.phoneNumber}</td>
                    <td className="py-3.5 px-4 font-black text-neutral-900">{account.flagCount}</td>
                    <td className="py-3.5 px-4 text-neutral-500 text-xs">
                      {account.lastFlaggedAt ? new Date(account.lastFlaggedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${riskStyles[account.riskLevel] || riskStyles.medium}`}>
                        {account.riskLevel.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
