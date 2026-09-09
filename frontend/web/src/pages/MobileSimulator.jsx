/**
 * Mobile App Simulator — Renders the Mobile Money App inside an interactive smartphone bezel.
 * Perfect for previewing inside VS Code Simple Browser or desktop browser.
 */

import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as api from '@momo/shared/src/api/endpoints'
import { PRESET_LOCATIONS } from '@momo/shared/src/utils/location'
import { formatCurrency } from '@momo/shared/src/constants'
import {
  SendIcon,
  CashOutIcon,
  CashInIcon,
  PayBillIcon,
  BuyGoodsIcon,
  ShieldCheckIcon,
} from '@momo/shared/src/components/Icons'

export default function MobileSimulator() {
  const { user, currentLocation, changeLocation } = useAuth()
  const [activeTab, setActiveTab] = useState('home')
  const [showBalance, setShowBalance] = useState(true)
  const [balance, setBalance] = useState(null)
  const [phoneFrame, setPhoneFrame] = useState('iphone')

  useEffect(() => {
    api.getBalance().then(setBalance).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-neutral-900 py-6 px-4 flex flex-col items-center justify-center font-sans">
      {/* Top Controller Bar */}
      <div className="w-full max-w-md mb-4 flex items-center justify-between px-3 text-white">
        <div className="flex items-center gap-2">
          <Link
            to="/"
            className="text-xs font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-lg transition-colors border border-neutral-700"
          >
            ← Back to Web
          </Link>
          <span className="text-xs font-black tracking-wider text-primary-400">MOBILE APP SIMULATOR</span>
        </div>
        <div className="flex items-center gap-1 bg-neutral-800 p-1 rounded-xl border border-neutral-700">
          <button
            onClick={() => setPhoneFrame('iphone')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${
              phoneFrame === 'iphone' ? 'bg-primary-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            iPhone
          </button>
          <button
            onClick={() => setPhoneFrame('android')}
            className={`text-xs px-2.5 py-1 rounded-lg font-bold transition-colors ${
              phoneFrame === 'android' ? 'bg-primary-800 text-white' : 'text-neutral-400 hover:text-white'
            }`}
          >
            Android
          </button>
        </div>
      </div>

      {/* Smartphone Device Frame */}
      <div
        className="w-full max-w-[390px] h-[800px] bg-neutral-950 rounded-[48px] p-3 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border-4 border-neutral-700 flex flex-col relative overflow-hidden transition-all"
      >
        {/* Dynamic Island / Notch */}
        {phoneFrame === 'iphone' ? (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-6 bg-black rounded-full z-50 flex items-center justify-between px-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-neutral-800" />
            <div className="w-2 h-2 rounded-full bg-neutral-800" />
          </div>
        ) : (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-4 h-4 bg-black rounded-full z-50 border border-neutral-800" />
        )}

        {/* Screen Content Container */}
        <div className="w-full h-full bg-[#F5F5F7] rounded-[36px] overflow-hidden flex flex-col relative pt-7">
          {/* Status Bar */}
          <div className="h-6 px-6 flex items-center justify-between text-[11px] font-bold text-neutral-800 select-none">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px]">5G</span>
              <div className="w-5 h-2.5 border border-neutral-800 rounded-xs p-0.5 flex items-center">
                <div className="w-full h-full bg-neutral-800 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto pb-20 px-4 pt-2">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-primary-800 text-white font-black flex items-center justify-center text-sm shadow-sm">
                  {user?.fullName?.slice(0, 2).toUpperCase() ?? 'KW'}
                </div>
                <div>
                  <p className="text-sm font-black text-neutral-900 leading-tight">Hi, {user?.fullName ?? 'Kwame Mensah'}</p>
                  <p className="text-[10px] text-neutral-500 font-medium">Main Active Wallet</p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-neutral-200/80 px-2 py-1 rounded-full text-[10px] font-bold text-neutral-700">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>{currentLocation?.city || 'Detecting...'}</span>
              </div>
            </div>

            {/* Wallet Balance Card */}
            <div className="bg-primary-900 text-white p-5 rounded-none shadow-lg relative overflow-hidden mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-primary-200 uppercase tracking-wider">Available Balance</span>
                <button
                  onClick={() => setShowBalance(!showBalance)}
                  className="text-xs bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-full transition-colors"
                >
                  {showBalance ? 'Hide' : 'Show'}
                </button>
              </div>
              <p className="text-2xl font-black font-mono tracking-tight mb-3">
                {showBalance ? formatCurrency(balance?.available ?? 2450.75) : '••••••••'}
              </p>
              <div className="flex items-center justify-between text-[10px] text-primary-200 border-t border-white/10 pt-2.5">
                <span>Account: {user?.phoneNumber ?? '0241234567'}</span>
                <span className="flex items-center gap-1 font-bold text-green-300">
                  AI Protected
                </span>
              </div>
            </div>

            {/* Quick Action Buttons Grid */}
            <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2.5 px-1">Quick Services</h4>
            <div className="grid grid-cols-3 gap-2.5 mb-5">
              <Link
                to="/send"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5">
                  <SendIcon size={20} color="#8A0F13" />
                </div>
                <span className="text-xs font-bold text-neutral-800">Send</span>
              </Link>
              <Link
                to="/cash-out"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5">
                  <CashOutIcon size={20} color="#8A0F13" />
                </div>
                <span className="text-xs font-bold text-neutral-800">Cash Out</span>
              </Link>
              <Link
                to="/cash-in"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5">
                  <CashInIcon size={20} color="#8A0F13" />
                </div>
                <span className="text-xs font-bold text-neutral-800">Cash In</span>
              </Link>
              <Link
                to="/pay-bill"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5">
                  <PayBillIcon size={20} color="#8A0F13" />
                </div>
                <span className="text-xs font-bold text-neutral-800">Pay Bill</span>
              </Link>
              <Link
                to="/buy-goods"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5">
                  <BuyGoodsIcon size={20} color="#8A0F13" />
                </div>
                <span className="text-xs font-bold text-neutral-800">Buy Goods</span>
              </Link>
              <Link
                to="/profile"
                className="bg-white p-3 rounded-2xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center text-center hover:bg-neutral-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mb-1.5 text-primary-800">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
                    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-neutral-800">Face ID</span>
              </Link>
            </div>

            {/* Auto-Detected Device Location Badge */}
            <div className="bg-white p-3.5 rounded-none border border-neutral-200 shadow-xs mb-4 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">Auto-Detected GPS</span>
                <span className="text-xs font-black text-neutral-900">
                  {currentLocation?.city || 'Detecting...'}{currentLocation?.region ? `, ${currentLocation.region}` : ''}
                </span>
              </div>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Active GPS
              </span>
            </div>

            {/* AI Security Status Card */}
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-none flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <ShieldCheckIcon size={18} color="#FFFFFF" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">AI Defense Engine Active</p>
                <p className="text-[10px] text-emerald-700">Real-time risk scoring, geofencing & biometrics enabled.</p>
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="absolute bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-neutral-200 py-2 px-6 flex items-center justify-between z-40">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex flex-col items-center gap-0.5 ${
                activeTab === 'home' ? 'text-primary-800 font-bold' : 'text-neutral-400'
              }`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              </svg>
              <span className="text-[10px]">Home</span>
            </button>
            <Link to="/transactions" className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-neutral-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span className="text-[10px]">History</span>
            </Link>
            <Link to="/profile" className="flex flex-col items-center gap-0.5 text-neutral-400 hover:text-neutral-700">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="text-[10px]">Profile</span>
            </Link>
          </div>

          {/* iPhone Home Indicator */}
          {phoneFrame === 'iphone' && (
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-neutral-900 rounded-full z-50" />
          )}
        </div>
      </div>
    </div>
  )
}
