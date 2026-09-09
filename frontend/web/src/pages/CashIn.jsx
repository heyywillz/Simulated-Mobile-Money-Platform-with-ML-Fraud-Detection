import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { formatCurrency } from '@momo/shared/src/constants'
import * as api from '@momo/shared/src/api/endpoints'
import { captureLocation } from '@momo/shared/src/utils/location'
import {
  ShieldCheckIcon,
  CheckIcon,
  CopyIcon,
  CashInIcon,
  QrCodeIcon,
  KioskIcon,
  VoucherIcon,
} from '@momo/shared/src/components/Icons'

const PRESET_DEPOSIT_AMOUNTS = [20, 50, 100, 200, 500, 1000]

export default function CashIn() {
  const navigate = useNavigate()
  const { user, deviceProfile } = useAuth()

  const [copiedPhone, setCopiedPhone] = useState(false)
  const [depositAmount, setDepositAmount] = useState('100')
  const [depositSource, setDepositSource] = useState('agent')
  const [agentName, setAgentName] = useState('Kwame Mensah Ventures (MoMo Agent #024881923)')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const handleCopyPhone = () => {
    if (!user?.phoneNumber) return
    navigator.clipboard.writeText(user.phoneNumber)
    setCopiedPhone(true)
    setTimeout(() => setCopiedPhone(false), 2000)
  }

  const handleSimulateCashIn = async (e) => {
    e.preventDefault()
    const parsed = parseFloat(depositAmount) || 0
    if (parsed <= 0) {
      setError('Please enter a valid deposit amount')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const location = await captureLocation()
      const sourceLabel =
        depositSource === 'agent'
          ? `Agent Deposit (${agentName})`
          : depositSource === 'kiosk'
          ? 'Merchant Kiosk Deposit'
          : 'MoMo Voucher Top-Up'

      const response = await api.cashIn({
        amount: parsed,
        receiver: user?.phoneNumber ?? '0241234567',
        receiverName: sourceLabel,
        deviceProfile,
        location,
        authLayersPassed: ['password'],
      })

      setReceipt(response)
      setShowSuccessModal(true)
    } catch (err) {
      setError(err.response?.data?.error ?? 'Deposit failed')
    } finally {
      setIsLoading(false)
    }
  }

  const parsedAmount = parseFloat(depositAmount) || 0

  return (
    <div className="page-container animate-fade-in max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between bg-white p-4 sm:p-5 rounded-none border border-neutral-200 shadow-xs">
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
            <h1 className="text-xl font-black text-neutral-900 tracking-tight">Cash In</h1>
            <p className="text-xs text-neutral-500 font-medium">Receive funds directly into your wallet via Agent or Merchant Kiosk</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full">
          100% Free Deposit
        </span>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Your Wallet Cash-In Identity & Instructions */}
        <div className="lg:col-span-6 space-y-6">
          {/* Account QR & Number Card */}
          <div className="bg-white rounded-none p-6 sm:p-7 border border-neutral-200 shadow-xs text-center space-y-5">
            <div className="inline-flex items-center px-3 py-1 bg-neutral-100 rounded-full text-xs font-bold text-neutral-700">
              <span>Verified MoMo Receiver ID</span>
            </div>

            {/* QR Code Graphic Container */}
            <div className="w-48 h-48 mx-auto bg-neutral-50 border-2 border-dashed border-neutral-200 rounded-3xl flex flex-col items-center justify-center p-4 shadow-inner relative group">
              <QrCodeIcon size={110} color="#171717" />
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mt-1">
                Scan to Deposit
              </p>
            </div>

            {/* Account Details & 1-Click Copy */}
            <div>
              <p className="text-xs text-neutral-400 font-bold uppercase tracking-wider">Your Wallet Number</p>
              <p className="text-2xl sm:text-3xl font-black font-mono text-neutral-900 mt-1">
                {user?.phoneNumber ?? '024 123 4567'}
              </p>
              <p className="text-xs font-bold text-neutral-600 mt-0.5">
                {user?.fullName ?? 'Swipe Pay Customer'}
              </p>
            </div>

            <button
              onClick={handleCopyPhone}
              className="btn-secondary w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-xs"
            >
              {copiedPhone ? (
                <>
                  <CheckIcon size={15} color="#16a34a" />
                  <span className="text-emerald-700">Number Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <CopyIcon size={15} color="#525252" />
                  <span>Copy Wallet Number for Agent</span>
                </>
              )}
            </button>
          </div>

          {/* Ghana MoMo Cash In Guide */}
          <div className="bg-white rounded-none p-6 border border-neutral-200 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider flex items-center gap-1.5">
              <CashInIcon size={16} color="#0D9488" />
              How Cash-In Works in Ghana
            </h3>
            <ul className="text-xs text-neutral-600 space-y-2.5 list-disc pl-4 leading-relaxed">
              <li>
                <strong>No Agent Code Required:</strong> You never need to enter an agent code or send money to deposit cash.
              </li>
              <li>
                <strong>Hand Over Physical Cash:</strong> Simply give the cash to any registered MoMo agent along with your phone number (<strong>{user?.phoneNumber ?? '024 123 4567'}</strong>).
              </li>
              <li>
                <strong>Instant Credit:</strong> The agent deposits the money onto your wallet from their terminal. Your balance updates immediately.
              </li>
              <li>
                <strong>Zero Fee:</strong> Cash In deposits are completely free of charge.
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Deposit & Top-up Simulator */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={handleSimulateCashIn} className="bg-white rounded-none p-6 sm:p-7 border border-neutral-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">Simulate Incoming Cash-In Deposit</h3>
                <p className="text-xs text-neutral-500">Test crediting your wallet from an agent or merchant kiosk</p>
              </div>
              <span className="text-[10px] font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded uppercase">
                Demo Simulator
              </span>
            </div>

            {/* Deposit Source Tabs */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-2 uppercase tracking-wide">
                Deposit Method / Source
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setDepositSource('agent')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    depositSource === 'agent'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <CashInIcon size={18} color={depositSource === 'agent' ? '#ffffff' : '#525252'} />
                  <span>MoMo Agent</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositSource('kiosk')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    depositSource === 'kiosk'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <KioskIcon size={18} color={depositSource === 'kiosk' ? '#ffffff' : '#525252'} />
                  <span>Merchant Kiosk</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDepositSource('voucher')}
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1 transition-all ${
                    depositSource === 'voucher'
                      ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                      : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                  }`}
                >
                  <VoucherIcon size={18} color={depositSource === 'voucher' ? '#ffffff' : '#525252'} />
                  <span>Top-Up Voucher</span>
                </button>
              </div>
            </div>

            {/* Agent / Sender Name */}
            {depositSource === 'agent' && (
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                  Depositing Agent Stand
                </label>
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  className="input-field text-xs font-medium"
                />
              </div>
            )}

            {/* Amount to Deposit */}
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1.5 uppercase tracking-wide">
                Deposit Amount (GH₵)
              </label>
              <div className="relative mb-2.5">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-base font-black">
                  GH₵
                </span>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => { setDepositAmount(e.target.value); setError(null) }}
                  placeholder="100.00"
                  className="input-field pl-16 text-2xl font-black font-mono tracking-tight"
                  step="0.01"
                  min="1"
                />
              </div>

              {/* Preset Chips */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {PRESET_DEPOSIT_AMOUNTS.map((val) => (
                  <button
                    type="button"
                    key={val}
                    onClick={() => { setDepositAmount(val.toString()); setError(null) }}
                    className={`py-2 sm:py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      parsedAmount === val
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : 'bg-neutral-50 text-neutral-700 border-neutral-200 hover:bg-neutral-100'
                    }`}
                  >
                    GH₵ {val}
                  </button>
                ))}
              </div>
            </div>

            {/* Breakdown */}
            <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 text-xs space-y-2">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Deposit Amount:</span>
                <span className="font-mono font-bold text-neutral-900">{formatCurrency(parsedAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-600">
                <span>Deposit Fee:</span>
                <span className="font-bold text-emerald-700">GH₵ 0.00 (Free)</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-neutral-200 font-bold text-sm text-neutral-900">
                <span>Wallet Credit:</span>
                <span className="font-mono text-emerald-700 text-base">+{formatCurrency(parsedAmount)}</span>
              </div>
            </div>

            {error && (
              <p className="text-primary-800 text-xs font-semibold bg-red-50 p-2.5 rounded-xl border border-red-100">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || parsedAmount <= 0}
              className="btn-primary w-full py-3.5 text-sm font-bold shadow-xs flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <span>Crediting Wallet...</span>
              ) : (
                <>
                  <CashInIcon size={18} color="#ffffff" />
                  <span>Execute Cash-In Deposit (+{formatCurrency(parsedAmount)})</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Success Receipt Modal */}
      {showSuccessModal && receipt && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-none border border-neutral-200 max-w-md w-full p-6 sm:p-8 shadow-xl animate-scale-in text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-50 border-2 border-green-200 flex items-center justify-center mx-auto animate-success-check">
              <CheckIcon size={32} color="#16a34a" />
            </div>

            <div>
              <span className="text-[10px] font-bold tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                Deposit Received
              </span>
              <h2 className="text-2xl font-black text-neutral-900 mt-2 font-mono">
                +{formatCurrency(parsedAmount)}
              </h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Your wallet has been credited immediately with zero fee.
              </p>
            </div>

            <div className="bg-neutral-50 rounded-2xl p-4 border border-neutral-200 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-neutral-500">Transaction ID:</span>
                <span className="font-mono font-bold text-neutral-800 text-[11px] truncate max-w-[180px]">{receipt.transactionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Source:</span>
                <span className="font-bold text-neutral-900 truncate max-w-[180px]">
                  {depositSource === 'agent' ? agentName : depositSource === 'kiosk' ? 'Merchant Kiosk Deposit' : 'MoMo Voucher Top-Up'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Type:</span>
                <span className="font-bold text-emerald-700">Cash In (Deposit)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Status:</span>
                <span className="font-bold text-emerald-700">Completed</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  navigate('/dashboard')
                }}
                className="btn-primary w-full py-3 text-sm font-bold"
              >
                Return to Dashboard
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  navigate('/transactions')
                }}
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
