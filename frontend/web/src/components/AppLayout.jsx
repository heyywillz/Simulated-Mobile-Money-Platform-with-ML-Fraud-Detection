import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import BottomNav from './BottomNav'
import { stopAllMediaStreams } from '@momo/shared'

export default function AppLayout({ children, hideNav = false }) {
  const location = useLocation()

  // Ensure camera streams are freed upon navigating between dashboard & service routes
  useEffect(() => {
    stopAllMediaStreams()
  }, [location.pathname])

  if (hideNav) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <Navbar />
      <main className="flex-1 pb-20 md:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  )
}
