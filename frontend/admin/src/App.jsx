import { useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import AdminLogin from './pages/AdminLogin'
import LiveFeed from './pages/LiveFeed'
import CaseDetail from './pages/CaseDetail'
import Analytics from './pages/Analytics'

import swipePayRedLogo from './assets/swipe-pay-red-logo.png'
import { LiveFeedIcon, CasesIcon, AnalyticsIcon, LogoutIcon, ShieldCheckIcon } from '@momo/shared/src/components/Icons'

function AdminLayout({ children }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const navItems = [
    { label: 'Live Risk Stream', path: '/', icon: <LiveFeedIcon size={18} /> },
    { label: 'Cases & Queues', path: '/cases', icon: <CasesIcon size={18} /> },
    { label: 'Analytics & Insights', path: '/analytics', icon: <AnalyticsIcon size={18} /> },
  ]

  const handleNavClick = (path) => {
    navigate(path)
    setMobileDrawerOpen(false)
  }

  const handleLogout = () => {
    localStorage.removeItem('momo_admin_token')
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#FAFAFA]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-neutral-200/80 p-4 flex-col shrink-0 sticky top-0 h-screen shadow-xs">
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-3 mb-6 bg-neutral-50 rounded-2xl border border-neutral-200/80">
          <img
            src={swipePayRedLogo}
            alt="Swipe Pay"
            className="w-10 h-10 object-contain shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-neutral-900 leading-none truncate">Swipe Pay</p>
            <p className="text-[10px] text-neutral-400 font-semibold tracking-wider uppercase mt-1">SOC Fraud Engine</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-1">
          <p className="px-3 text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">Operations</p>
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/cases' && location.pathname.startsWith('/cases'))
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`relative w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm font-semibold'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-primary-500 rounded-r-full" />
                )}
                <span className="shrink-0">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Security Analyst User Card */}
        <div className="pt-4 border-t border-neutral-100 space-y-3">
          <div className="p-3 bg-neutral-50 rounded-2xl border border-neutral-200/60 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-800 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0">
              KM
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-neutral-900 truncate">Kwame Mensah</p>
              <div className="flex items-center gap-1 mt-0.5">
                <ShieldCheckIcon size={11} color="#059669" />
                <span className="text-[10px] text-green-700 font-semibold truncate">Lead Fraud Analyst</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full text-neutral-500 hover:text-red-700 hover:bg-red-50 flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-colors"
          >
            <LogoutIcon size={16} />
            <span>Terminate Session</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden animate-fade-in backdrop-blur-xs"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white z-50 p-5 flex flex-col shadow-2xl transition-transform duration-300 ease-out lg:hidden ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-5 border-b border-neutral-100">
          <div className="flex items-center gap-3">
            <img
              src={swipePayRedLogo}
              alt="Swipe Pay"
              className="w-9 h-9 object-contain shrink-0"
            />
            <div>
              <p className="text-sm font-bold text-neutral-900">Swipe Pay Admin</p>
              <p className="text-[10px] text-neutral-400 font-medium">SOC Control Center</p>
            </div>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-neutral-600 font-bold"
          >
            ✕
          </button>
        </div>

        <nav className="space-y-2 flex-1 mt-6">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path ||
              (item.path === '/cases' && location.pathname.startsWith('/cases'))
            return (
              <button
                key={item.path}
                onClick={() => handleNavClick(item.path)}
                className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-neutral-900 text-white shadow-sm font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="pt-4 border-t border-neutral-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 py-2.5 px-4 text-neutral-400 hover:text-red-700 hover:bg-red-50 rounded-xl text-sm font-semibold"
          >
            <LogoutIcon size={18} />
            <span>Log out</span>
          </button>
        </div>
      </div>

      {/* Main content wrapper */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Top Header */}
        <header className="lg:hidden bg-white border-b border-neutral-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-100"
              aria-label="Open menu"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-800" />
              <span className="text-sm font-bold text-neutral-900">Swipe Pay SOC</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live Intel
          </div>
        </header>

        {/* Main Content View */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

function ProtectedAdmin({ children }) {
  const token = localStorage.getItem('momo_admin_token')
  if (!token) return <Navigate to="/login" replace />
  return <AdminLayout>{children}</AdminLayout>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AdminLogin />} />
      <Route path="/" element={<ProtectedAdmin><LiveFeed /></ProtectedAdmin>} />
      <Route path="/cases" element={<ProtectedAdmin><LiveFeed /></ProtectedAdmin>} />
      <Route path="/cases/:id" element={<ProtectedAdmin><CaseDetail /></ProtectedAdmin>} />
      <Route path="/analytics" element={<ProtectedAdmin><Analytics /></ProtectedAdmin>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
