import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  HomeIcon,
  HistoryIcon,
  BellIcon,
  UserIcon,
} from '@momo/shared/src/components/Icons'

const NAV_ITEMS = [
  { label: 'Home', icon: HomeIcon, route: '/dashboard' },
  { label: 'History', icon: HistoryIcon, route: '/transactions' },
  { label: 'Alerts', icon: BellIcon, route: '/notifications' },
  { label: 'Profile', icon: UserIcon, route: '/profile' },
]

export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
      <div className="max-w-md mx-auto px-3 mb-2.5">
        <div className="bg-white/95 backdrop-blur-md border border-neutral-200/90 rounded-2xl px-2 py-1.5 shadow-lg pointer-events-auto flex items-center justify-around">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.route
            const Icon = item.icon
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className={`relative flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl transition-colors ${
                  isActive
                    ? 'text-primary-800 font-bold'
                    : 'text-neutral-500 hover:text-neutral-900 font-medium'
                }`}
              >
                {isActive && (
                  <span className="absolute inset-0 bg-primary-50 rounded-xl" />
                )}
                <span className="relative z-10 shrink-0">
                  <Icon size={20} />
                </span>
                <span className="relative z-10 text-[10px] tracking-tight">
                  {item.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
