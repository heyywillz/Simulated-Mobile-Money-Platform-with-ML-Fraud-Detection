import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import * as api from '@momo/shared/src/api/endpoints'
import {
  DeviceMobileIcon,
  LocationPinIcon,
  ShieldAlertIcon,
  FreezeIcon,
  BellIcon,
  BellOffIcon,
  ZapIcon,
} from '@momo/shared/src/components/Icons'

export default function Notifications() {
  const navigate = useNavigate()
  const [alerts, setAlerts] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadAlerts()
  }, [])

  const loadAlerts = async () => {
    try {
      const data = await api.getAlerts()
      setAlerts(data)
    } catch (err) {
      console.error('Failed to load alerts:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const getAlertIcon = (type) => {
    switch (type) {
      case 'new_device':
        return <DeviceMobileIcon size={18} color="#8A0F13" />
      case 'new_location':
        return <LocationPinIcon size={18} color="#0284C7" />
      case 'transaction_flagged':
        return <ShieldAlertIcon size={18} color="#D97706" />
      case 'transaction_blocked':
        return <ShieldAlertIcon size={18} color="#8A0F13" />
      case 'account_frozen':
        return <FreezeIcon size={18} color="#8A0F13" />
      case 'session_active':
        return <ZapIcon size={18} color="#059669" />
      default:
        return <BellIcon size={18} color="#4B5563" />
    }
  }

  const formatTime = (dateStr) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffHrs < 1) return 'Just now'
    if (diffHrs < 24) return `${diffHrs}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="page-container animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between bg-white p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-colors text-neutral-700 md:hidden"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">Security & Risk Alerts</h1>
            <p className="text-xs text-neutral-500 font-medium">Real-time alerts triggered by account activity or anomaly rules</p>
          </div>
        </div>
        <span className="px-3 py-1 bg-neutral-100 text-neutral-700 rounded-full text-xs font-bold">
          {alerts.length} Total Alerts
        </span>
      </div>

      {/* Alerts Feed */}
      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 bg-white rounded-2xl animate-pulse border border-neutral-200" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="bg-white rounded-3xl border border-neutral-200 py-16 text-center flex flex-col items-center shadow-xs">
          <div className="mb-3 text-neutral-300">
            <BellOffIcon size={44} />
          </div>
          <p className="text-neutral-700 font-bold text-sm">No security alerts</p>
          <p className="text-neutral-400 text-xs mt-1">Your Swipe Pay account is fully secured and operating normally</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xs ${
                alert.type === 'transaction_blocked' || alert.type === 'account_frozen'
                  ? 'bg-red-50/70 border-red-200'
                  : 'bg-white border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center shrink-0 mt-0.5">
                  {getAlertIcon(alert.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-bold text-neutral-900 truncate">{alert.title}</p>
                    <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap ml-2 font-mono">
                      {formatTime(alert.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-600 leading-relaxed">{alert.message}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
