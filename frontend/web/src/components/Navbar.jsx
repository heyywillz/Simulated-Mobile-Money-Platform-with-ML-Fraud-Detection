import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as api from '@momo/shared/src/api/endpoints'
import { simEvents } from '@momo/shared/src/api/store'
import swipePayRedLogo from '../assets/swipe-pay-red-logo.png'
import {
  SendIcon,
  CashOutIcon,
  CashInIcon,
  PayBillIcon,
  HistoryIcon,
  BellIcon,
  ShieldCheckIcon,
} from '@momo/shared/src/components/Icons'

export default function Navbar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  useEffect(() => {
    const updateAlerts = () => {
      api.getAlerts().then((alerts) => {
        const list = Array.isArray(alerts) ? alerts : []
        setUnreadAlerts(list.filter((a) => !a.read).length)
      }).catch(() => {})
    }
    updateAlerts()

    simEvents.on('alert:new', updateAlerts)
    simEvents.on('alert:updated', updateAlerts)

    const onCustomEvent = () => updateAlerts()
    if (typeof window !== 'undefined') {
      window.addEventListener('momo_sim:alert:new', onCustomEvent)
      window.addEventListener('momo_sim:alert:updated', onCustomEvent)
    }

    return () => {
      simEvents.off('alert:new', updateAlerts)
      simEvents.off('alert:updated', updateAlerts)
      if (typeof window !== 'undefined') {
        window.removeEventListener('momo_sim:alert:new', onCustomEvent)
        window.removeEventListener('momo_sim:alert:updated', onCustomEvent)
      }
    }
  }, [location.pathname])

  const navLinks = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Send Money', path: '/send', icon: SendIcon },
    { label: 'Cash Out', path: '/cash-out', icon: CashOutIcon },
    { label: 'Cash In', path: '/cash-in', icon: CashInIcon },
    { label: 'Pay Bills', path: '/pay-bill', icon: PayBillIcon },
    { label: 'Statement', path: '/transactions', icon: HistoryIcon },
    { label: 'Alerts', path: '/notifications', icon: BellIcon, badge: unreadAlerts > 0 ? unreadAlerts : undefined },
  ]

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SP'

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-neutral-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Brand Logo & Navigation */}
          <div className="flex items-center gap-8">
            <Link to="/dashboard" className="flex items-center gap-3 group">
              <img
                src={swipePayRedLogo}
                alt="Swipe Pay"
                className="w-10 h-10 object-contain transition-transform group-hover:scale-105"
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-lg text-neutral-900 tracking-tight">Swipe Pay</span>
                  <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded uppercase">MoMo</span>
                </div>
                <p className="text-[10px] text-neutral-400 font-semibold tracking-wide uppercase leading-none hidden sm:block">
                  Simulated Mobile Money
                </p>
              </div>
            </Link>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative px-3 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-neutral-900 text-white'
                        : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                    }`}
                  >
                    <span>{link.label}</span>
                    {link.badge !== undefined && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-primary-500 text-white' : 'bg-primary-800 text-white'
                      }`}>
                        {link.badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Right: Security Pill, User Profile & Logout */}
          <div className="flex items-center gap-3">
            {/* Live Security Defense Status */}
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-neutral-50 border border-neutral-200 rounded-full text-xs font-semibold text-neutral-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px]">AI Fraud Defense Active</span>
            </div>

            {/* Notifications Bell for quick access on all sizes */}
            <button
              onClick={() => navigate('/notifications')}
              className="relative w-9 h-9 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 flex items-center justify-center transition-colors text-neutral-700"
              aria-label="Security Alerts"
            >
              <BellIcon size={17} color="#404040" />
              {unreadAlerts > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary-800 rounded-full ring-2 ring-white" />
              )}
            </button>

            {/* User Profile Pill */}
            <Link
              to="/profile"
              className={`flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border transition-all ${
                location.pathname === '/profile'
                  ? 'bg-neutral-100 border-neutral-300'
                  : 'bg-white hover:bg-neutral-50 border-neutral-200'
              }`}
            >
              <div className="w-7 h-7 rounded-full bg-primary-800 text-white flex items-center justify-center font-bold text-xs">
                {userInitials}
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-bold text-neutral-900 leading-tight truncate max-w-[130px]">
                  Hi, {user?.fullName?.split(' ')[0] ?? 'User'}
                </p>
                <div className="flex items-center gap-1">
                  <ShieldCheckIcon size={11} color="#059669" />
                  <span className="text-[10px] text-neutral-400 font-semibold leading-none">KYC Verified</span>
                </div>
              </div>
            </Link>

            {/* Logout button */}
            <button
              onClick={logout}
              className="w-9 h-9 rounded-xl bg-neutral-50 hover:bg-red-50 hover:text-primary-800 border border-neutral-200 flex items-center justify-center transition-colors text-neutral-500"
              title="Sign Out"
              aria-label="Log Out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
