import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { setAuthToken } from '@momo/shared/src/api/client'
import * as adminApi from '@momo/shared/src/api/admin-endpoints'

import swipePayLogo from '../assets/swipe-pay-logo.png'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    try {
      const response = await adminApi.adminLogin({ email, password })
      localStorage.setItem('momo_admin_token', response.token)
      setAuthToken(response.token)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.error ?? 'Invalid credentials')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdminFill = () => {
    setEmail('admin@swipepay.gh')
    setPassword('admin123')
    setError('')
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <img
            src={swipePayLogo}
            alt="Swipe Pay Admin"
            className="w-16 h-16 object-contain mx-auto mb-4"
          />
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-neutral-400 font-semibold mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            SOC Fraud Intel Platform
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Swipe Pay Admin</h1>
          <p className="text-xs sm:text-sm text-neutral-400 mt-1">Autonomous risk mitigation & analyst control portal</p>
        </div>

        {/* Card Form */}
        <form onSubmit={handleSubmit} className="bg-[#17171E]/90 backdrop-blur-xl rounded-none border border-white/10 p-6 sm:p-8 shadow-2xl space-y-5">
          <div>
            <label htmlFor="admin-email" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Admin Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@swipepay.gh"
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white/10 transition-all font-medium"
              autoFocus
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-xs font-bold text-neutral-300 uppercase tracking-wider mb-2">
              Admin Security Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-neutral-500 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white/10 transition-all font-mono"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs font-semibold text-red-200 animate-fade-in flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-primary-800 hover:bg-primary-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-lg hover:shadow-primary-900/50 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Authenticating Session...</span>
              </>
            ) : (
              <span>Access Admin Portal →</span>
            )}
          </button>
        </form>

        {/* Admin Credentials Card */}
        <div className="mt-5 p-4 bg-white/5 backdrop-blur-md rounded-none border border-white/10 flex items-center justify-between">
          <div className="text-left">
            <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Default Admin Credentials</p>
            <p className="text-xs font-mono font-medium text-neutral-200 mt-0.5">admin@swipepay.gh • admin123</p>
          </div>
          <button
            type="button"
            onClick={handleAdminFill}
            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-all border border-white/10 active:scale-95"
          >
            Fill Admin
          </button>
        </div>
      </div>
    </div>
  )
}
