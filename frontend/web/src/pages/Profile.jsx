import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PRESET_LOCATIONS } from '@momo/shared/src/utils/location'
import {
  DeviceWebIcon,
  DeviceMobileIcon,
  SignalCellularIcon,
  ShieldCheckIcon,
  CheckIcon,
  LogoutIcon,
  LocationPinIcon,
  ZapIcon,
} from '@momo/shared/src/components/Icons'

export default function Profile() {
  const { user, deviceProfile, activeSessions, currentLocation, changeLocation, detectLocation, logout } = useAuth()
  const navigate = useNavigate()
  const [copiedId, setCopiedId] = useState(false)
  const [locationToast, setLocationToast] = useState(null)
  const [isDetectingLocation, setIsDetectingLocation] = useState(false)

  const copyDeviceId = () => {
    if (deviceProfile?.deviceId) {
      navigator.clipboard?.writeText(deviceProfile.deviceId)
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    }
  }

  const handleSelectLocation = (loc) => {
    changeLocation({
      city: loc.city,
      region: loc.region,
      country: loc.country,
      latitude: loc.latitude,
      longitude: loc.longitude,
      capturedAt: new Date().toISOString(),
    })
    setLocationToast(`Location switched to ${loc.city}, ${loc.region}`)
    setTimeout(() => setLocationToast(null), 3000)
  }

  const handleDetectGPS = async () => {
    setIsDetectingLocation(true)
    try {
      const loc = await detectLocation()
      setLocationToast(`Exact Location Detected: ${loc.city}, ${loc.region ?? loc.country} (${loc.latitude.toFixed(4)} N, ${loc.longitude.toFixed(4)} E)`)
      setTimeout(() => setLocationToast(null), 4000)
    } catch {
      setLocationToast('Unable to access live GPS, keeping simulated location')
      setTimeout(() => setLocationToast(null), 3000)
    } finally {
      setIsDetectingLocation(false)
    }
  }

  const maskGhanaCard = (cardId) => {
    if (!cardId) return 'GHA-•••••••••-•'
    if (cardId.length <= 8) return cardId
    return `${cardId.slice(0, 4)}••••••${cardId.slice(-3)}`
  }

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'SP'

  const isCurrentLocationKnown =
    currentLocation?.country === 'Ghana' ||
    ['Sunyani', 'Accra', 'Tema', 'Kumasi', 'Takoradi', 'Tamale', 'Cape Coast', 'Koforidua', 'Ho', 'Wa', 'Bolgatanga', 'Techiman'].includes(currentLocation?.city ?? '');

  return (
    <div className="page-container animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between bg-white p-5 rounded-none border border-neutral-200 shadow-xs">
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
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">Account & Security</h1>
            <p className="text-xs text-neutral-500 font-medium">KYC verification, device identifier, geolocation & active sessions</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-1.5 text-neutral-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogoutIcon size={15} />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Location Toast Notification */}
      {locationToast && (
        <div className="mb-6 p-4 bg-neutral-900 text-white rounded-2xl shadow-lg border border-neutral-700 animate-slide-down flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <LocationPinIcon size={18} color="#fde047" />
            <span>{locationToast}</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">TELEMETRY UPDATED</span>
        </div>
      )}

      {/* Profile Grid (Desktop 2-column) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: User Card & Geolocation Telemetry */}
        <div className="lg:col-span-6 space-y-6">
          {/* User Card */}
          <div className="p-6 bg-white border border-neutral-200 rounded-none shadow-xs">
            <div className="flex items-center gap-4 mb-4">
              {user?.profilePicture ? (
                <img
                  src={user.profilePicture}
                  alt={user?.fullName ?? 'Avatar'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary-800 shadow-xs"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary-800 text-white flex items-center justify-center font-bold text-xl shadow-xs">
                  {userInitials}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-neutral-900">{user?.fullName ?? 'Swipe Pay User'}</h2>
                <p className="text-xs text-neutral-500 font-mono mt-0.5">{user?.phoneNumber ?? '+233 24 123 4567'}</p>
                {user?.email && (
                  <p className="text-xs text-neutral-400 mt-0.5">{user.email}</p>
                )}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-200">
                    Verified KYC Level 2
                  </span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-700">
                    Face Scan Verified
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Ghana Card ID</p>
                <p className="font-mono font-bold text-neutral-800 mt-1">{maskGhanaCard(user?.ghanaCardId)}</p>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Date of Birth</p>
                <p className="font-bold text-neutral-800 mt-1">{user?.dob ?? '1998-05-14'}</p>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Gender</p>
                <p className="font-bold text-neutral-800 mt-1 capitalize">{user?.gender ?? 'Male'}</p>
              </div>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <p className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Wallet Status</p>
                <p className="font-bold text-green-700 mt-1 capitalize">{user?.status ?? 'Active'}</p>
              </div>
            </div>
          </div>

          {/* Device Geolocation & Geofence Telemetry */}
          <div className="p-6 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-800 flex items-center justify-center">
                  <LocationPinIcon size={18} color="#8A0F13" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Device Location Telemetry</h3>
                  <p className="text-[10px] text-neutral-500">Live GPS coordinates & ATOD Geofencing</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isDetectingLocation}
                className="px-2.5 py-1 text-[11px] font-bold text-primary-800 bg-red-50 hover:bg-red-100 border border-red-100 rounded-lg transition-colors flex items-center gap-1"
              >
                <ZapIcon size={12} />
                <span>{isDetectingLocation ? 'Detecting Exact Location...' : 'Detect Exact Location'}</span>
              </button>
            </div>

            {/* Current Active Location Display */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200/70 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-neutral-500 font-medium">Auto-Detected City / Region:</span>
                <span className="text-xs font-black text-neutral-900">
                  {currentLocation?.city || 'Detecting...'}{currentLocation?.region ? `, ${currentLocation.region}` : ''} ({currentLocation?.country || 'Ghana'})
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">Live GPS Coordinates:</span>
                <span className="font-mono font-semibold text-neutral-700">
                  {currentLocation?.latitude ? `${currentLocation.latitude.toFixed(4)}° N, ${currentLocation.longitude.toFixed(4)}° W` : 'Detecting...'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-neutral-500">Detection Method / Precision:</span>
                <span className="font-semibold text-neutral-700">
                  {currentLocation?.source === 'gps' ? 'Hardware Physical GPS' : 'Network IP'}
                  {currentLocation?.accuracy ? ` (+/-${currentLocation.accuracy}m)` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-neutral-200/50">
                <span className="text-neutral-500">ATOD Geofence Status:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                    isCurrentLocationKnown
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {isCurrentLocationKnown ? 'Known Trusted Location' : 'Anomalous Location'}
                </span>
              </div>
            </div>
          </div>

          {/* Session Awareness Indicator */}
          <div className="p-6 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                </span>
                <h3 className="text-xs font-bold text-neutral-800 uppercase tracking-wider">Session Awareness</h3>
              </div>
              <span className="text-[10px] font-semibold text-neutral-400">Live Device Sync</span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-700">
                    <DeviceWebIcon size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-neutral-900">Current Web Session</p>
                    <p className="text-[10px] text-neutral-400">This Browser • Active now</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-primary-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                  This Device
                </span>
              </div>

              {activeSessions && activeSessions.filter((s) => s.platform === 'mobile').length > 0 ? (
                activeSessions
                  .filter((s) => s.platform === 'mobile')
                  .map((session, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-700">
                          <DeviceMobileIcon size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-neutral-900">Mobile Client (Expo App)</p>
                          <p className="text-[10px] text-neutral-400">Also active • Synced</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    </div>
                  ))
              ) : (
                <div className="flex items-center justify-between p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-neutral-200 flex items-center justify-center text-neutral-400">
                      <DeviceMobileIcon size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-700">Mobile Client</p>
                      <p className="text-[10px] text-neutral-400">Ready for pairing</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-neutral-400 font-medium">Standby</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Hardware Profile & Security Settings */}
        <div className="lg:col-span-6 space-y-6">
          {/* Simulated e-SIM & Device Profile */}
          <div className="p-6 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="text-neutral-700">
                  <SignalCellularIcon size={18} />
                </div>
                <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Simulated Network & Hardware Profile</h3>
              </div>
              <span className="text-[10px] font-mono font-bold text-primary-800 bg-red-50 px-2 py-0.5 rounded-full">ATOD Tag</span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Platform / Runtime</span>
                <span className="font-bold text-neutral-900 uppercase font-mono">{deviceProfile?.platform ?? 'web'}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <span className="text-neutral-500 font-medium">Device Hardware Identifier</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-neutral-700">
                    {deviceProfile?.deviceId ? `${deviceProfile.deviceId.slice(0, 12)}...` : 'dev_web_demo'}
                  </span>
                  <button
                    onClick={copyDeviceId}
                    className="p-1 rounded hover:bg-neutral-200 transition-colors"
                    title="Copy Device ID"
                  >
                    {copiedId ? (
                      <CheckIcon size={12} color="#059669" />
                    ) : (
                      <span className="text-[10px] text-primary-800 font-semibold underline">Copy</span>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Biometric & 2FA Status */}
          <div className="p-6 rounded-none bg-white border border-neutral-200 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Multi-Layer Authentication</h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Hardware Enrolled
              </span>
            </div>
            
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <div>
                  <p className="font-bold text-neutral-900">Layer 1: Security Password</p>
                  <p className="text-[11px] text-neutral-500">Required on all outgoing transfers & withdrawals</p>
                </div>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">Active</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl border border-neutral-200/60">
                <div>
                  <p className="font-bold text-neutral-900">Layer 2: Face ID & Live Camera</p>
                  <p className="text-[11px] text-neutral-500">Live 3D telemetry landmark matching on step-up challenges</p>
                </div>
                <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg">Enrolled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
