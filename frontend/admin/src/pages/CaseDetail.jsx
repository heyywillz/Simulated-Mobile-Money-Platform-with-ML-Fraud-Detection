import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'
import { formatCurrency } from '@momo/shared/src/constants'
import {
  DeviceMobileIcon,
  LocationPinIcon,
  CashInIcon,
  ZapIcon,
  FreezeIcon,
} from '@momo/shared/src/components/Icons'

const getSignalIcon = (type) => {
  switch (type) {
    case 'new_device':
      return <DeviceMobileIcon size={20} color="#8A0F13" />
    case 'new_location':
      return <LocationPinIcon size={20} color="#8A0F13" />
    case 'unusual_amount':
      return <CashInIcon size={20} color="#8A0F13" />
    case 'abnormal_frequency':
    default:
      return <ZapIcon size={20} color="#8A0F13" />
  }
}

export default function CaseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [caseData, setCaseData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [noteText, setNoteText] = useState('')
  const [actionLoading, setActionLoading] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('momo_admin_token')
    if (token) setAuthToken(token)
    if (id) loadCase()
  }, [id])

  const loadCase = async () => {
    try {
      const data = await adminApi.getCaseById(id)
      setCaseData(data)
    } catch (err) {
      console.error('Failed to load case:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAction = async (action) => {
    setActionLoading(action)
    try {
      const fn = action === 'approve' ? adminApi.approveCase
        : action === 'block' ? adminApi.blockCase
        : adminApi.escalateCase
      const updated = await fn(id)
      setCaseData((prev) => ({ ...prev, ...updated }))
    } catch (err) {
      console.error(`Failed to ${action}:`, err)
    } finally {
      setActionLoading('')
    }
  }

  const handleToggleFreeze = async () => {
    const isFrozen = caseData.userStatus === 'frozen'
    const actionKey = isFrozen ? 'unfreeze' : 'freeze'
    setActionLoading(actionKey)
    try {
      if (isFrozen) {
        await adminApi.unfreezeAccount(caseData.userId, 'Account reactivated by fraud analyst')
        setCaseData((prev) => ({ ...prev, userStatus: 'active' }))
      } else {
        await adminApi.freezeAccount(caseData.userId, 'Account locked down due to suspicious activity')
        setCaseData((prev) => ({ ...prev, userStatus: 'frozen' }))
      }
      loadCase()
    } catch (err) {
      console.error(`Failed to ${actionKey}:`, err)
    } finally {
      setActionLoading('')
    }
  }

  const handleAddNote = async () => {
    if (!noteText.trim()) return
    try {
      await adminApi.addCaseNote(id, noteText)
      setNoteText('')
      loadCase()
    } catch (err) {
      console.error('Failed to add note:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-48 bg-neutral-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-white rounded-2xl animate-pulse" />
        <div className="h-48 bg-white rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (!caseData) {
    return (
      <div className="p-6 text-center">
        <p className="text-neutral-500">Case not found</p>
        <button onClick={() => navigate('/')} className="text-primary-800 text-sm font-semibold mt-2">
          Back to feed
        </button>
      </div>
    )
  }

  const riskStyles = {
    low: 'bg-neutral-100 text-neutral-600',
    medium: 'bg-neutral-200 text-neutral-800',
    high: 'bg-[#F2D5D6] text-[#8A0F13]',
    critical: 'bg-[#8A0F13] text-white',
  }

  const profile = caseData.userProfile
  const txn = caseData.transaction

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center hover:bg-neutral-200 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" /></svg>
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-neutral-900 font-mono">{caseData.id}</h1>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${riskStyles[caseData.riskLevel]}`}>
              {caseData.riskLevel.charAt(0).toUpperCase() + caseData.riskLevel.slice(1)} risk
            </span>
            <span className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${
              caseData.detectionType === 'atod' ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-800'
            }`}>
              {caseData.detectionType === 'atod' ? 'Account takeover' : 'Transaction anomaly'}
            </span>
            {txn && (
              <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${
                String(txn.channel || txn.type || '').includes('cash_out')
                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                  : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
              }`}>
                {String(txn.channel || txn.type || '').includes('cash_out') ? '⇥ Cash Out' : '↗ Send Money'}
              </span>
            )}
            {caseData.userStatus === 'frozen' ? (
              <span className="text-xs font-bold rounded-full px-2.5 py-0.5 bg-red-100 text-red-700 border border-red-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                Wallet Frozen
              </span>
            ) : (
              <span className="text-xs font-medium rounded-full px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200">
                Wallet Active
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">{caseData.userName} • {caseData.userPhone}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — main details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Behavior comparison */}
          {profile && (
            <div className="bg-white rounded-none border border-neutral-100 p-5">
              <h3 className="text-sm font-bold text-neutral-900 mb-4">Behaviour comparison</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Usual */}
                <div className="p-4 bg-neutral-50 rounded-xl">
                  <p className="text-xs text-neutral-500 font-medium mb-2">Usual behaviour</p>
                  <p className="text-2xl font-black text-neutral-900">
                    {formatCurrency(profile.typicalTransactionRange[0])} – {formatCurrency(profile.typicalTransactionRange[1])}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    Avg: {formatCurrency(profile.avgTransactionAmount)} • {profile.avgDailyTransactions}/day
                  </p>
                </div>
                {/* This transaction */}
                <div className="p-4 bg-primary-50 rounded-xl border border-primary-100">
                  <p className="text-xs text-[#8A0F13] font-medium mb-2">This transaction</p>
                  <p className="text-2xl font-black text-[#8A0F13]">
                    {formatCurrency(txn?.amount ?? 0)}
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    {((txn?.amount ?? 0) / profile.avgTransactionAmount).toFixed(1)}x the average
                  </p>
                </div>
              </div>

              {/* Visual bar */}
              <div className="mt-4 relative h-8 bg-neutral-100 rounded-full overflow-hidden">
                <div
                  className="absolute top-0 h-full bg-neutral-300 rounded-full"
                  style={{
                    left: `${(profile.typicalTransactionRange[0] / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount)) * 100}%`,
                    width: `${((profile.typicalTransactionRange[1] - profile.typicalTransactionRange[0]) / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount)) * 100}%`,
                  }}
                />
                <div
                  className="absolute top-0 h-full w-1.5 bg-[#8A0F13] rounded-full"
                  style={{
                    left: `${Math.min(((txn?.amount ?? 0) / Math.max(txn?.amount ?? 1, profile.maxTransactionAmount * 1.2)) * 100, 98)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
                <span>GH₵ 0</span>
                <span className="text-neutral-600 font-medium">← Typical range →</span>
                <span>{formatCurrency(Math.max(txn?.amount ?? 0, profile.maxTransactionAmount))}</span>
              </div>
            </div>
          )}

          {/* ML Fraud Intelligence */}
          {typeof txn?.mlScore === 'number' && (
            <div className="bg-white rounded-none border border-neutral-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a4 4 0 0 1 4 4c0 1.95-1.4 3.57-3.25 3.92L12 22" />
                  <path d="M12 2a4 4 0 0 0-4 4c0 1.95 1.4 3.57 3.25 3.92" />
                </svg>
                <h3 className="text-sm font-bold text-neutral-900">ML Fraud Intelligence</h3>
              </div>

              <div className="flex items-center gap-6 mb-4">
                {/* Circular score indicator */}
                <div className="relative w-24 h-24 shrink-0">
                  <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#f5f5f5" strokeWidth="8" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={txn.mlScore >= 0.8 ? '#8A0F13' : txn.mlScore >= 0.6 ? '#c2410c' : txn.mlScore >= 0.3 ? '#b45309' : '#059669'}
                      strokeWidth="8"
                      strokeLinecap="round"
                      strokeDasharray={`${txn.mlScore * 263.9} 263.9`}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xl font-black text-neutral-900">{(txn.mlScore * 100).toFixed(0)}%</span>
                  </div>
                </div>

                <div className="flex-1">
                  <p className="text-xs text-neutral-500 mb-1">Fraud Probability</p>
                  <p className="text-2xl font-black text-neutral-900 mb-2">{txn.mlScore.toFixed(3)}</p>
                  <span className={`inline-flex items-center text-xs font-bold rounded-full px-2.5 py-0.5 ${
                    txn.mlScore >= 0.8 ? 'bg-[#8A0F13] text-white' :
                    txn.mlScore >= 0.6 ? 'bg-orange-600 text-white' :
                    txn.mlScore >= 0.3 ? 'bg-amber-500 text-white' :
                    'bg-emerald-500 text-white'
                  }`}>
                    {txn.mlScore >= 0.8 && <span className="w-1.5 h-1.5 rounded-full bg-white mr-1.5 animate-pulse" />}
                    {txn.mlRiskLevel ? txn.mlRiskLevel.charAt(0).toUpperCase() + txn.mlRiskLevel.slice(1) : 'Unknown'} Risk
                  </span>
                </div>
              </div>

              {/* ML Feature breakdown */}
              <div className="border-t border-neutral-100 pt-4">
                <p className="text-xs font-semibold text-neutral-600 mb-3">Model Input Features</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Unusual Location', key: 'location', active: txn.location?.city !== 'Accra' },
                    { label: 'New Device', key: 'device', active: txn.deviceProfile?.deviceId?.includes('unknown') },
                    { label: 'High Amount', key: 'amount', active: (txn.amount || 0) > 2000 },
                    { label: 'Unusual Time', key: 'time', active: false },
                    { label: 'New User', key: 'user', active: false },
                    { label: 'Velocity Spike', key: 'velocity', active: caseData.signals?.some(s => s.type === 'unusual_amount' && s.details?.velocityCount) },
                  ].map((f) => (
                    <div key={f.key} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${f.active ? 'bg-[#F2D5D6] text-[#8A0F13] font-semibold' : 'bg-neutral-50 text-neutral-500'}`}>
                      <span className={`w-2 h-2 rounded-full ${f.active ? 'bg-[#8A0F13]' : 'bg-neutral-300'}`} />
                      {f.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-none border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-4">Contributing signals</h3>
            <div className="space-y-3">
              {caseData.signals?.map((signal, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-xl">
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
                    {getSignalIcon(signal.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-neutral-900">{signal.label}</p>
                      <span className="text-xs font-mono font-bold text-primary-800">
                        {(signal.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{signal.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Transaction details */}
          <div className="bg-white rounded-none border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Transaction details</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-neutral-400">Channel / Type:</span>{' '}
                <span className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-0.5 rounded-md ${
                  String(txn?.channel || txn?.type || '').includes('cash_out')
                    ? 'bg-amber-100 text-amber-900 border border-amber-200'
                    : String(txn?.channel || txn?.type || '').includes('cash_in')
                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    : 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                }`}>
                  {String(txn?.channel || txn?.type || '').includes('cash_out')
                    ? '⇥ Cash Out (Withdrawal)'
                    : String(txn?.channel || txn?.type || '').includes('cash_in')
                    ? '↙ Cash In (Deposit)'
                    : '↗ Send Money (Transfer)'}
                </span>
              </div>
              <div><span className="text-neutral-400">Amount:</span> <span className="font-bold text-neutral-900">{formatCurrency(txn?.amount ?? 0)}</span></div>
              <div><span className="text-neutral-400">Sender:</span> <span className="font-medium">{txn?.sender}</span></div>
              <div><span className="text-neutral-400">Receiver:</span> <span className="font-medium">{txn?.receiver}</span></div>
              <div><span className="text-neutral-400">Location:</span> <span className="font-medium">{txn?.location?.city}, {txn?.location?.region}</span></div>
              <div><span className="text-neutral-400">Status:</span> <span className="font-medium">{txn?.status}</span></div>
            </div>
          </div>
        </div>

        {/* Right column — actions & notes */}
        <div className="space-y-5">
          {/* Actions */}
          <div className="bg-white rounded-none border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-4">Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => handleAction('approve')}
                disabled={!!actionLoading || caseData.status === 'approved'}
                className="w-full py-2.5 px-4 bg-green-50 text-green-800 border border-green-200 rounded-xl text-xs font-bold hover:bg-green-100 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>{actionLoading === 'approve' ? 'Approving...' : 'Authorize Transaction'}</span>
              </button>
              <button
                onClick={() => handleAction('block')}
                disabled={!!actionLoading || caseData.status === 'blocked'}
                className="w-full py-2.5 px-4 bg-[#8A0F13] text-white rounded-xl text-xs font-bold hover:bg-primary-900 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{actionLoading === 'block' ? 'Blocking...' : 'Block & Mark Fraud'}</span>
              </button>
              <button
                onClick={() => handleAction('escalate')}
                disabled={!!actionLoading || caseData.status === 'escalated'}
                className="w-full py-2.5 px-4 bg-neutral-900 text-white rounded-xl text-xs font-bold hover:bg-neutral-800 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <span>{actionLoading === 'escalate' ? 'Escalating...' : 'Escalate to Tier 2 Lead'}</span>
              </button>
              <button
                onClick={handleToggleFreeze}
                disabled={!!actionLoading}
                className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all disabled:opacity-40 flex items-center justify-center gap-2 ${
                  caseData.userStatus === 'frozen'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs'
                    : 'border border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                }`}
              >
                <FreezeIcon size={16} />
                <span>
                  {actionLoading === 'freeze'
                    ? 'Freezing...'
                    : actionLoading === 'unfreeze'
                    ? 'Reactivating...'
                    : caseData.userStatus === 'frozen'
                    ? 'Reactivate / Unfreeze Account'
                    : 'Freeze Account (Lockdown)'}
                </span>
              </button>
            </div>
          </div>

          {/* User profile */}
          {profile && (
            <div className="bg-white rounded-none border border-neutral-100 p-5">
              <div className="flex items-center gap-3 mb-4">
                {caseData.userAvatar ? (
                  <img
                    src={caseData.userAvatar}
                    alt={caseData.userName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-primary-800"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-primary-800 text-white flex items-center justify-center font-bold text-sm">
                    {caseData.userName?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">{caseData.userName}</h3>
                  <p className="text-xs text-neutral-500">{caseData.userEmail || caseData.userPhone}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {caseData.userGhanaCard && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-400">Ghana Card</span>
                    <span className="font-mono text-xs font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded">
                      {caseData.userGhanaCard}
                    </span>
                  </div>
                )}
                {typeof caseData.userBalance === 'number' && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Wallet Balance</span>
                    <span className="font-bold text-neutral-900">{formatCurrency(caseData.userBalance)}</span>
                  </div>
                )}
                {caseData.userDob && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Date of birth</span>
                    <span className="font-medium">{caseData.userDob}</span>
                  </div>
                )}
                {caseData.userGender && (
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Gender</span>
                    <span className="font-medium capitalize">{caseData.userGender}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-neutral-400">Account age</span>
                  <span className="font-medium">{profile.accountAge ?? '—'} days</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Biometric defense</span>
                  <span className="font-medium text-green-700 text-xs">
                    Face ID Active ✓
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Registered Device</span>
                  <span className="font-mono text-xs text-neutral-600 truncate max-w-[140px]">
                    {caseData.userRegisteredDevice || profile.knownDevices?.[0] || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-400">Known locations</span>
                  <span className="font-medium">{profile.knownLocations?.join(', ') || 'Sunyani, Ghana'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Analyst notes */}
          <div className="bg-white rounded-none border border-neutral-100 p-5">
            <h3 className="text-sm font-bold text-neutral-900 mb-3">Analyst notes</h3>
            <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
              {caseData.analystNotes?.length === 0 ? (
                <p className="text-xs text-neutral-400">No notes yet</p>
              ) : (
                caseData.analystNotes?.map((note) => (
                  <div key={note.id} className="p-3 bg-neutral-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-neutral-700">{note.author}</span>
                      <span className="text-[10px] text-neutral-400">{new Date(note.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-neutral-600">{note.content}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a note..."
                className="flex-1 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-200"
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
              />
              <button
                onClick={handleAddNote}
                disabled={!noteText.trim()}
                className="px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
