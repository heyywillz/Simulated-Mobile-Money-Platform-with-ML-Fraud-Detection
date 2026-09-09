import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import PinPad from '../components/PinPad'
import { StatusBadge } from '../components/StatusBadge'
import BiometricModal from '../components/BiometricModal'
import { formatCurrency } from '@momo/shared/src/constants'
import * as api from '@momo/shared/src/api/endpoints'
import { captureLocation } from '@momo/shared/src/utils/location'
import swipePayLogo from '../assets/swipe-pay-logo.png'
import {
  ShieldCheckIcon,
  CheckIcon,
  CashOutIcon,
  ZapIcon,
} from '@momo/shared/src/components/Icons'

const PRESET_AMOUNTS = [20, 50, 100, 200, 500, 1000]

export default function CashOut() {
  const navigate = useNavigate()
  const { deviceProfile, user } = useAuth()

  const [isCashOutAllowed, setIsCashOutAllowed] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(300)
  const [step, setStep] = useState('settings')

  const [customAmount, setCustomAmount] = useState('100')
  const [selectedAgentName, setSelectedAgentName] = useState('Kwame Mensah Ventures (MoMo Agent #0248819234)')
  const [promptData, setPromptData] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)
  const [stepUpAttempts, setStepUpAttempts] = useState(0)
  const [currentPassword, setCurrentPassword] = useState('')
  const isSubmittingRef = useRef(false)

  useEffect(() => {
    if (step === 'settings' || step === 'incoming_prompt' || step === 'password') {
      isSubmittingRef.current = false
    }
  }, [step])

  // Biometric Modal State
  const [isBioModalOpen, setIsBioModalOpen] = useState(false)
  const [bioModalMode, setBioModalMode] = useState('facial')
  const [bioModalTitle, setBioModalTitle] = useState('Cash Out Biometric Authorization')
  const [bioModalSubtitle, setBioModalSubtitle] = useState('Authorize cash withdrawal')

  useEffect(() => {
    let interval = null
    if (isCashOutAllowed && countdownSeconds > 0) {
      interval = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            setIsCashOutAllowed(false)
            return 300
          }
          return prev - 1
        })
      }, 1000)
    } else if (!isCashOutAllowed) {
      setCountdownSeconds(300)
    }
    return () => clearInterval(interval)
  }, [isCashOutAllowed, countdownSeconds])

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const handleToggleAllowCashOut = () => {
    if (!isCashOutAllowed) {
      setIsCashOutAllowed(true)
      setCountdownSeconds(300)
      setError(null)
    } else {
      setIsCashOutAllowed(false)
    }
  }

  const handleTriggerAgentPrompt = (amountToWithdraw) => {
    if (!isCashOutAllowed) {
      setError('Please toggle "Allow Cash Out" to ON first before an agent can initiate a withdrawal.')
      return
    }

    const calculatedFee = amountToWithdraw > 50 ? 1.0 : 0.5
    setPromptData({
      agentName: selectedAgentName,
      agentNumber: '0248819234',
      agentCode: 'AGT-882194',
      location: 'Accra Central - Market Circle',
      amount: amountToWithdraw,
      fee: calculatedFee,
    })
    setError(null)
    setStep('incoming_prompt')
  }

  const handleAuthorizePrompt = () => {
    setStep('password')
  }

  const handleDeclinePrompt = () => {
    setPromptData(null)
    setStep('settings')
  }

  // Step 1: User completes Password -> Verify against registered password
  const handlePasswordComplete = (enteredPassword) => {
    if (!promptData) return
    if (!enteredPassword || !enteredPassword.trim()) {
      setError('Please enter your account password')
      return
    }

    const regPassword =
      user?.password ||
      user?.pin ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('momo_user_password') ||
          JSON.parse(localStorage.getItem('momo_sim_user') || '{}')?.password ||
          JSON.parse(localStorage.getItem('momo_sim_user') || '{}')?.pin
        : null)

    if (regPassword && enteredPassword.trim() !== regPassword) {
      setError('Incorrect password. Please enter the password you created during registration.')
      return
    }

    setCurrentPassword(enteredPassword.trim())
    setError(null)
    setBioModalMode('facial')
    setBioModalTitle('Layer 2 Security Check: Biometric Authorization')
    setBioModalSubtitle(`Verify your identity via Face ID to release GH₵ ${promptData.amount.toFixed(2)} cash withdrawal`)
    setIsBioModalOpen(true)
  }

  // Open Direct Biometric Modal if clicked
  const openDirectBiometric = (mode = 'facial') => {
    setBioModalMode('facial')
    setBioModalTitle('Layer 2 Security Check: Biometric Authorization')
    setBioModalSubtitle(`Authorize withdrawal of GH₵ ${promptData?.amount ?? 100} with Face ID`)
    setIsBioModalOpen(true)
  }

  // Open Step-Up Biometric Modal
  const openStepUpBiometric = (mode = 'facial') => {
    setBioModalMode('facial')
    setBioModalTitle('Security Challenge: Step-Up Biometric Check')
    setBioModalSubtitle('Anomalous withdrawal pattern detected — Biometric proof required')
    setIsBioModalOpen(true)
  }

  // Handle Biometric Modal Success
  const handleBiometricSuccess = async (method) => {
    if (!promptData || isSubmittingRef.current) return
    isSubmittingRef.current = true
    setIsBioModalOpen(false)
    setIsLoading(true)
    setStep('processing')
    setError(null)

    try {
      const location = await captureLocation()
      const layers = ['password', method || 'facial']
      const verifiedResponse = await api.cashOut({
        amount: promptData.amount,
        receiver: promptData.agentNumber,
        receiverName: promptData.agentName,
        pin: currentPassword,
        password: currentPassword,
        deviceProfile,
        location,
        authLayersPassed: layers,
      })
      setResult({
        ...verifiedResponse,
        status: verifiedResponse.status ?? 'completed',
        reason: 'Verified via Face ID Biometrics',
      })
      setIsCashOutAllowed(false)
      setStep('result')
    } catch (err) {
      isSubmittingRef.current = false
      const errorMsg = err.response?.data?.error ?? 'Cash out failed'
      if (err.response?.status === 401 || errorMsg.toLowerCase().includes('pin') || errorMsg.toLowerCase().includes('password')) {
        setError(errorMsg)
        setStep('password')
      } else {
        setError(errorMsg)
        setStep('result')
        setResult({
          transactionId: '',
          status: 'blocked',
          reason: errorMsg,
        })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleBiometricFailure = () => {
    const attempts = stepUpAttempts + 1
    setStepUpAttempts(attempts)
    if (attempts >= 2) {
      setResult({
        transactionId: result?.transactionId || `tx_${Date.now()}`,
        status: 'blocked',
        reason: 'Failed second-factor biometric verification twice. Account protected.',
        caseId: result?.caseId || `CASE-${Math.floor(1000 + Math.random() * 9000)}`,
      })
      setIsBioModalOpen(false)
      setStep('result')
    } else {
      setError('Biometric verification mismatch. 1 attempt remaining.')
    }
  }

  const isSuccess = result?.status === 'completed'
  const isFlagged = result?.status === 'flagged' || result?.status === 'under_review'
  const isBlocked = result?.status === 'blocked'

  return (
    <div className="page-container animate-fade-in max-w-4xl mx-auto space-y-6">
      {/* Biometric Verification Modal */}
      <BiometricModal
        isOpen={isBioModalOpen}
        onClose={() => setIsBioModalOpen(false)}
        onSuccess={handleBiometricSuccess}
        onFailure={handleBiometricFailure}
        title={bioModalTitle}
        subtitle={bioModalSubtitle}
        initialMode="facial"
        allowModeSwitch={false}
      />

      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-colors text-neutral-700"
            aria-label="Back"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-black text-neutral-900 tracking-tight">Cash Out / ATM Withdrawal</h1>
            <p className="text-xs text-neutral-500 font-medium">Merchant & Agent physical cash withdrawals with AI & Biometric defense</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-full">
          BoG Regulated Agent Network
        </span>
      </div>

      {/* Step 1: Settings & Trigger */}
      {step === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-7 space-y-5">
            {/* Allow Cash Out Switch Card */}
            <div className="bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-primary-800">
                      <CashOutIcon size={18} color="#8A0F13" />
                    </div>
                    <h2 className="text-base font-black text-neutral-900">Allow Cash Out</h2>
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    By default, your wallet is locked against unauthorized merchant withdrawals. Toggle this ON when standing at an authorized MoMo Agent.
                  </p>
                </div>

                {/* Big Toggle Switch */}
                <button
                  type="button"
                  onClick={handleToggleAllowCashOut}
                  className={`w-16 h-9 rounded-full transition-colors relative p-1 shrink-0 ${
                    isCashOutAllowed ? 'bg-emerald-600' : 'bg-neutral-300'
                  }`}
                  aria-pressed={isCashOutAllowed}
                >
                  <span
                    className={`w-7 h-7 bg-white rounded-full block shadow-md transform transition-transform ${
                      isCashOutAllowed ? 'translate-x-7' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Status Banner */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  isCashOutAllowed
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                    : 'bg-neutral-50 border-neutral-200 text-neutral-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isCashOutAllowed ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                      }`}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isCashOutAllowed ? 'Cash Out Enabled' : 'Cash Out Disabled (Protected)'}
                    </span>
                  </div>

                  {isCashOutAllowed && (
                    <div className="flex items-center font-mono font-black text-emerald-800 text-sm bg-white/80 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                      <span>{formatTimer(countdownSeconds)}</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] mt-1 text-neutral-500">
                  {isCashOutAllowed
                    ? `Authorized agents can now initiate withdrawal requests. Automatically locks in ${Math.ceil(
                        countdownSeconds / 60
                      )} minutes.`
                    : 'No agent can initiate a debit withdrawal on your phone without your permission.'}
                </p>
              </div>
            </div>

            {/* Agent Simulator */}
            <div className="bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Simulate Incoming Agent Prompt</h3>
                  <p className="text-xs text-neutral-600 mt-0.5">Test real-time USSD push prompt as received at an agent kiosk.</p>
                </div>
                <span className="text-[10px] font-bold text-primary-800 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                  Interactive Demo
                </span>
              </div>

              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-primary-800 text-xs font-semibold rounded-xl animate-slide-down">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Agent Vendor
                  </label>
                  <select
                    value={selectedAgentName}
                    onChange={(e) => setSelectedAgentName(e.target.value)}
                    className="input-field text-xs font-semibold bg-neutral-50"
                  >
                    <option value="Kwame Mensah Ventures (MoMo Agent #024881923)">
                      Kwame Mensah Ventures (Accra Central #024881923)
                    </option>
                    <option value="Osu Oxford St Telecom Kiosk (MoMo Agent #055194821)">
                      Osu Oxford St Telecom Kiosk (#055194821)
                    </option>
                    <option value="Kumasi Kejetia Market Hub (MoMo Agent #020993182)">
                      Kumasi Kejetia Market Hub (#020993182)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                    Withdrawal Amount (GH₵)
                  </label>
                  <input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="100.00"
                    className="input-field text-base font-bold font-mono"
                    min="1"
                  />
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCustomAmount(amt.toString())}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        customAmount === amt.toString()
                          ? 'bg-primary-800 text-white'
                          : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                      }`}
                    >
                      GH₵ {amt}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => handleTriggerAgentPrompt(parseFloat(customAmount) || 100)}
                  disabled={!isCashOutAllowed}
                  className={`w-full py-3.5 text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition-all shadow-sm ${
                    isCashOutAllowed
                      ? 'btn-primary bg-primary-800 hover:bg-primary-900 text-white'
                      : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  }`}
                >
                  <ZapIcon size={16} />
                  <span>Receive Simulated Agent Withdrawal Prompt →</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Security & Educational Guide */}
          <div className="md:col-span-5 space-y-4">
            <div className="bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Anti-Fraud Protection Protocol</h3>
              <div className="space-y-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-50 text-primary-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    1
                  </div>
                  <p className="text-neutral-600">
                    <strong className="text-neutral-900">Never share your Password with an agent:</strong> Enter your Password only on your own screen.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-50 text-primary-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    2
                  </div>
                  <p className="text-neutral-600">
                    <strong className="text-neutral-900">AI Risk Scoring:</strong> Cash outs at unusual hours, high sums, or unverified agent SIMs trigger step-up Face ID verification.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-red-50 text-primary-800 font-bold flex items-center justify-center shrink-0 mt-0.5 text-[10px]">
                    3
                  </div>
                  <p className="text-neutral-600">
                    <strong className="text-neutral-900">Auto-Lock Defense:</strong> "Allow Cash Out" automatically locks immediately upon transaction completion.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Incoming USSD / In-App Prompt */}
      {step === 'incoming_prompt' && promptData && (
        <div className="max-w-md mx-auto animate-scale-in">
          <div className="bg-neutral-900 text-white p-6 sm:p-7 rounded-none shadow-2xl border border-neutral-700 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <div className="flex items-center gap-2">
                <img
                  src={swipePayLogo}
                  alt="Swipe Pay"
                  className="w-7 h-7 object-contain"
                />
                <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">MoMo Withdrawal Prompt</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-800">
                Live Agent Terminal
              </span>
            </div>

            <div className="text-center py-2">
              <p className="text-xs text-neutral-400 uppercase tracking-wider">Withdrawal Request</p>
              <p className="text-3xl font-black text-white font-mono mt-1">{formatCurrency(promptData.amount)}</p>
              <p className="text-xs text-neutral-400 mt-1">Network Fee: <span className="font-mono text-neutral-200">GH₵ {promptData.fee.toFixed(2)}</span></p>
            </div>

            <div className="bg-neutral-800/80 rounded-2xl p-3.5 space-y-2 text-xs border border-neutral-700">
              <div className="flex justify-between">
                <span className="text-neutral-400">Agent:</span>
                <span className="font-bold text-white text-right">{promptData.agentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Agent ID:</span>
                <span className="font-mono text-neutral-300">{promptData.agentCode}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Location:</span>
                <span className="text-neutral-300">{promptData.location}</span>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleAuthorizePrompt}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-2"
              >
                <CheckIcon size={16} color="#FFFFFF" />
                <span>Approve Withdrawal (Enter Password / Face ID)</span>
              </button>
              <button
                type="button"
                onClick={handleDeclinePrompt}
                className="w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-2xl text-xs font-bold transition-colors"
              >
                Reject & Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Password Pad (Layer 1 of 2) */}
      {step === 'password' && promptData && (
        <div className="max-w-md mx-auto animate-slide-up space-y-4">
          <div className="text-center bg-white p-5 rounded-none border border-neutral-200 shadow-xs">
            <div className="inline-flex items-center px-3 py-1 bg-red-50 text-primary-800 border border-red-200 rounded-full text-[11px] font-bold mb-2">
              <span>Multi-Factor Security: Step 1 of 2</span>
            </div>
            <p className="text-3xl font-black text-neutral-900 mt-1 font-mono">{formatCurrency(promptData.amount)}</p>
            <p className="text-xs text-neutral-500 font-medium mt-1">To: <span className="font-bold text-neutral-800">{promptData.agentName}</span></p>
          </div>
          <div className="bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
            <PinPad
              onComplete={handlePasswordComplete}
              title="Step 1: Enter Account Password"
              subtitle="Enter the password you created during registration (Face ID verification will follow)"
              error={error ?? undefined}
              isLoading={isLoading}
            />
            {/* Direct Quick Biometric Authorize Options */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500">
              <span className="font-medium">Direct Biometrics:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openDirectBiometric('facial')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:text-primary-800 rounded-lg hover:bg-neutral-50 border border-neutral-200 transition-colors shadow-2xs"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2.2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
                    <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
                  </svg>
                  <span>Face ID</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Processing */}
      {step === 'processing' && (
        <div className="max-w-md mx-auto bg-white p-10 rounded-3xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center animate-fade-in text-center">
          <div className="relative mb-6">
            <div className="w-16 h-16 border-4 border-neutral-200 border-t-primary-800 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-9 h-9 rounded-xl bg-primary-50 flex items-center justify-center">
                <ShieldCheckIcon size={20} color="#8A0F13" />
              </div>
            </div>
          </div>
          <p className="text-base font-black text-neutral-900">Authorizing Cash Out</p>
          <p className="text-xs text-neutral-500 mt-1">Checking AI fraud defense & account state...</p>
        </div>
      )}

      {/* Step 5: Step-Up Biometric Choice */}
      {step === 'step_up_prompt' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center animate-scale-in text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4 border border-red-200">
            <ShieldCheckIcon size={32} color="#8A0F13" />
          </div>

          <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase mb-2">
            Step-Up Biometric Required
          </span>

          <h2 className="text-lg font-black text-neutral-900 mb-2">Step-Up Biometric Verification</h2>
          <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
            {result?.reason ?? 'An unusual transaction pattern or amount was detected. Complete biometric authentication to authorize this withdrawal.'}
          </p>

          {error && <p className="text-xs text-primary-800 font-semibold mb-4 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">{error}</p>}

          <div className="w-full space-y-2.5">
            <button
              onClick={() => openStepUpBiometric('facial')}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-xs font-bold"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="10" />
                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                <line x1="9" y1="9" x2="9.01" y2="9" strokeWidth="2.5" />
                <line x1="15" y1="9" x2="15.01" y2="9" strokeWidth="2.5" />
              </svg>
              <span>Scan Face ID to Approve</span>
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Receipt / Result */}
      {step === 'result' && result && promptData && (
        <div className="max-w-lg mx-auto animate-scale-in">
          {isSuccess && (
            <div className="confetti-container">
              {[...Array(12)].map((_, i) => (
                <span
                  key={i}
                  className="confetti-particle"
                  style={{
                    left: `${10 + Math.random() * 80}%`,
                    top: `${10 + Math.random() * 30}%`,
                    backgroundColor: ['#8A0F13', '#D97706', '#059669', '#4F46E5', '#E11D48', '#7C3AED'][i % 6],
                    animationDelay: `${i * 0.1}s`,
                    animationDuration: `${1.2 + Math.random() * 0.8}s`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="bg-white rounded-none border border-neutral-200 p-6 sm:p-8 shadow-xs text-center">
            <div className="mb-4 flex justify-center">
              {isSuccess && (
                <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center animate-success-check">
                  <CheckIcon size={32} color="#16a34a" />
                </div>
              )}
              {isFlagged && (
                <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center">
                  <ShieldCheckIcon size={32} color="#d97706" />
                </div>
              )}
              {isBlocked && (
                <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-200 flex items-center justify-center">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#8A0F13" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
            </div>

            <h2 className="text-xl font-black text-neutral-900 mb-1">
              {isSuccess && 'Cash Out Successful'}
              {isFlagged && 'Cash Out Under Review'}
              {isBlocked && 'Cash Out Blocked'}
            </h2>

            <p className="text-3xl font-black text-neutral-900 font-mono my-2">
              {formatCurrency(promptData.amount)}
            </p>

            <p className="text-xs text-neutral-500 mb-6 max-w-sm mx-auto">
              {result.reason ?? (isSuccess ? 'Cash has been released by the agent. Allow Cash Out is now locked.' : 'Security review in progress.')}
            </p>

            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200/60 text-xs space-y-2.5 text-left mb-6">
              {result.transactionId && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-neutral-800 text-[11px] truncate max-w-[180px]">{result.transactionId}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Agent:</span>
                <span className="font-bold text-neutral-800">{promptData.agentName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Agent Code:</span>
                <span className="font-mono font-bold text-neutral-800">{promptData.agentCode}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Status:</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Allow Cash Out:</span>
                <span className="font-bold text-neutral-800">Locked (Safe)</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  setStep('settings')
                  setPromptData(null)
                  navigate('/dashboard')
                }}
                className="btn-primary w-full py-3 text-sm font-bold"
              >
                Return to Dashboard
              </button>
              <button
                onClick={() => navigate('/transactions')}
                className="btn-secondary w-full py-2.5 text-xs text-neutral-600"
              >
                View in Statement History
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
