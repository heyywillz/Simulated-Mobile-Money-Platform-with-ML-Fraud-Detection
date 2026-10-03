import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PinPad from './PinPad';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from './StatusBadge';
import BiometricModal from './BiometricModal';
import { formatCurrency } from '@momo/shared/src/constants';
import {
  ShieldCheckIcon,
  CheckIcon,
  SparklesIcon,
} from '@momo/shared/src/components/Icons';
import { useAppSelector } from '../store/hooks';
import axios from "axios"

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function TransactionFlow({
  type,
  title,
  subtitle,
  fields,
  onSubmit,
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState('input');
  const [formData, setFormData] = useState({});
  const [amount, setAmount] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [stepUpAttempts, setStepUpAttempts] = useState(0);
  const isSubmittingRef = useRef(false);

  useEffect(() => {
    if (step === 'input' || step === 'pin') {
      isSubmittingRef.current = false;
    }
  }, [step]);

  // Biometric Modal State
  const [isBioModalOpen, setIsBioModalOpen] = useState(false);
  const [bioModalTitle, setBioModalTitle] = useState('Biometric Authorization');
  const [bioModalSubtitle, setBioModalSubtitle] = useState(
    'Authorize this payment with biometrics',
  );

  const parsedAmount = parseFloat(amount) || 0;

  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setError(null);
    setStep('pin');
  };


  // function validateUser transaction
  const authState = useAppSelector((state) => state?.auth);
  const telemetryState = useAppSelector((state) => state?.telemetry);
  const userAuth = authState?.user;
  const deviceProfile = telemetryState?.deviceProfile;
  const currentLocation = telemetryState?.currentLocation;

  // Step 1: User completes PIN -> Trigger mandatory Layer 2 Biometric Authorization
  const handlePinComplete = (enteredPassword) => {
    if (!enteredPassword || !enteredPassword.trim()) {
      setError('Please enter your account password');
      return;
    }

    // Strict validation against registered account password
    const regPassword =
      user?.password ||
      user?.pin ||
      (typeof localStorage !== 'undefined'
        ? localStorage.getItem('momo_user_password') ||
          JSON.parse(localStorage.getItem('momo_sim_user') || '{}')?.password ||
          JSON.parse(localStorage.getItem('momo_sim_user') || '{}')?.pin
        : null);

    if (regPassword && enteredPassword.trim() !== regPassword) {
      setError('Incorrect password. Please enter the password you created during registration.');
      return;
    }

    setCurrentPin(enteredPassword.trim());
    setError(null);

    setBioModalTitle('Layer 2 Security Check: Biometric Authorization');
    setBioModalSubtitle(
      `Verify your identity via Face ID to release GH₵ ${parsedAmount.toFixed(2)}`,
    );

    setIsBioModalOpen(true);
  };



  // Open Direct Biometric on Password Pad if clicked explicitly
  const openDirectBiometric = () => {
    setBioModalTitle('Layer 2 Security Check: Biometric Authorization');
    setBioModalSubtitle(
      `Authorize GH₵ ${parsedAmount.toFixed(2)} with Face ID`,
    );
    setIsBioModalOpen(true);
  };

  // Open Step-Up Biometric
  const openStepUpBiometric = () => {
    setBioModalTitle('Security Challenge: Step-Up Biometric Check');
    setBioModalSubtitle(
      'Verify your identity to release this flagged transaction',
    );
    setIsBioModalOpen(true);
  };

  // Handle Biometric Verification Success
  const handleBiometricSuccess = async (method) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsBioModalOpen(false);
    setStep('processing');
    setIsLoading(true);
    setError(null);

    try {
      const layers = ['password', method];
      const response = await onSubmit(
        formData,
        parsedAmount,
        layers,
        currentPin,
      );
      setResult(response);

      if (response.status === 'flagged' || response.status === 'under_review') {
        setStep('step_up_prompt');
      } else {
        setStep('result');
      }
    } catch (err) {
      isSubmittingRef.current = false;
      const errorMsg =
        err.response?.data?.message ??
        err.response?.data?.error ??
        'Transaction failed';
      if (
        err.response?.status === 401 ||
        errorMsg.toLowerCase().includes('pin')
      ) {
        setError(errorMsg);
        setStep('pin');
      } else {
        setError(errorMsg);
        setStep('result');
        setResult({
          transactionId: '',
          status: 'blocked',
          reason: errorMsg,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricFailure = () => {
    const attempts = stepUpAttempts + 1;
    setStepUpAttempts(attempts);
    if (attempts >= 2) {
      setResult({
        transactionId: result?.transactionId || `tx_${Date.now()}`,
        status: 'blocked',
        reason:
          'Failed second-factor biometric verification twice. Account protected.',
        caseId:
          result?.caseId || `CASE-${Math.floor(1000 + Math.random() * 9000)}`,
      });
      setIsBioModalOpen(false);
      setStep('result');
    } else {
      setError('Biometric scan mismatch. 1 attempt remaining.');
    }
  };

  const isSuccess = result?.status === 'completed';
  const isFlagged =
    result?.status === 'flagged' || result?.status === 'under_review';
  const isBlocked = result?.status === 'blocked';

  return (
    <div className="page-container animate-fade-in max-w-4xl mx-auto">
      {/* Biometric Verification Modal */}
      <BiometricModal
        isOpen={isBioModalOpen}
        onClose={() => setIsBioModalOpen(false)}
        onSuccess={handleBiometricSuccess}
        onFailure={handleBiometricFailure}
        title={bioModalTitle}
        subtitle={bioModalSubtitle}
      />

      {/* Header */}
      <div className="mb-6 flex items-center justify-between bg-white p-4 sm:p-5 rounded-none border border-neutral-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={() => (step === 'input' ? navigate(-1) : setStep('input'))}
            className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center hover:bg-neutral-100 transition-colors text-neutral-700"
            aria-label="Back"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg font-black text-neutral-900 tracking-tight">
              {title}
            </h1>
            <p className="text-xs text-neutral-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-full">
          Encrypted MoMo Gateway
        </span>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <form
          onSubmit={handleInputSubmit}
          className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start"
        >
          <div className="md:col-span-7 space-y-4">
            {fields.map((field) => (
              <div
                key={field.id}
                className="bg-white p-4 sm:p-5 rounded-none border border-neutral-200 shadow-xs"
              >
                <label
                  htmlFor={field.id}
                  className="block text-xs font-bold text-neutral-700 mb-2 uppercase tracking-wide"
                >
                  {field.label}
                </label>
                <div className="relative">
                  {field.prefix && (
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 text-sm font-bold">
                      {field.prefix}
                    </span>
                  )}
                  <input
                    id={field.id}
                    type={field.type ?? 'text'}
                    value={formData[field.id] ?? ''}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.id]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    className={`input-field ${field.prefix ? 'pl-14' : ''} text-sm font-semibold`}
                  />
                </div>
              </div>
            ))}

            <div className="bg-white p-4 sm:p-5 rounded-none border border-neutral-200 shadow-xs">
              <label
                htmlFor="amount-input"
                className="block text-xs font-bold text-neutral-700 mb-2 uppercase tracking-wide"
              >
                Transfer Amount
              </label>
              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-lg font-black">
                  GH₵
                </span>
                <input
                  id="amount-input"
                  type="number"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError(null);
                  }}
                  placeholder="0.00"
                  className="input-field pl-16 text-3xl font-black font-mono tracking-tight"
                  step="0.01"
                  min="0"
                  autoFocus
                />
              </div>

              {/* Preset buttons */}
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setAmount(preset.toString());
                      setError(null);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      parsedAmount === preset
                        ? 'bg-primary-800 text-white'
                        : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                    }`}
                  >
                    +GH₵ {preset}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-primary-800 text-xs font-semibold rounded-xl animate-slide-down">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={parsedAmount <= 0}
              className="btn-primary w-full py-4 text-sm font-bold shadow-sm"
            >
              Continue to Authorization →
            </button>
          </div>

          {/* Right Column: Transaction Summary */}
          <div className="md:col-span-5 bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              Debit Breakdown
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-500">Principal Amount</span>
                <span className="font-mono font-bold text-neutral-900">
                  {formatCurrency(parsedAmount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">E-Levy Fee (0%)</span>
                <span className="font-mono font-bold text-green-700">
                  GH₵ 0.00
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Network Fee</span>
                <span className="font-mono font-bold text-green-700">
                  GH₵ 0.00
                </span>
              </div>
              <div className="pt-3 border-t border-neutral-100 flex justify-between items-baseline">
                <span className="font-bold text-neutral-900">Total Debit</span>
                <span className="font-mono text-xl font-black text-primary-800">
                  {formatCurrency(parsedAmount)}
                </span>
              </div>
            </div>

            <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/60 text-[11px] text-neutral-500 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-neutral-800">
                Real-time Fraud Scoring
              </div>
              <p>
                Outgoing transfers are monitored in real-time by the AI Defense
                Engine.
              </p>
            </div>
          </div>
        </form>
      )}

      {/* Step 2: PIN Pad (Layer 1 of 2) */}
      {step === 'pin' && (
        <div className="max-w-md mx-auto animate-slide-up space-y-4">
          <div className="text-center bg-white p-5 rounded-none border border-neutral-200 shadow-xs">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-primary-800 border border-red-200 rounded-full text-[11px] font-bold mb-2">
              <span>Multi-Factor Security: Step 1 of 2</span>
            </div>
            <p className="text-3xl font-black text-neutral-900 mt-1 font-mono">
              {formatCurrency(parsedAmount)}
            </p>
            {formData.receiver && (
              <p className="text-xs text-neutral-500 font-medium mt-1">
                Recipient:{' '}
                <span className="font-mono font-bold text-neutral-800">
                  {formData.receiver}
                </span>
              </p>
            )}
          </div>
          <div className="bg-white p-6 rounded-none border border-neutral-200 shadow-xs space-y-4">
            <PinPad
              onComplete={handlePinComplete}
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
                  onClick={() => openDirectBiometric()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-neutral-700 hover:text-primary-800 rounded-lg hover:bg-neutral-50 border border-neutral-200 transition-colors shadow-2xs"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A0F13"
                    strokeWidth="2.2"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  </svg>
                  <span>Face ID</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
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
          <p className="text-base font-black text-neutral-900">
            Securing Transaction
          </p>
          <p className="text-xs text-neutral-500 mt-1">
            Evaluating telemetry & biometric risk models...
          </p>
        </div>
      )}

      {/* Step 4: Step-Up Biometric Choice */}
      {step === 'step_up_prompt' && (
        <div className="max-w-md mx-auto bg-white p-8 rounded-3xl border border-neutral-200 shadow-xs flex flex-col items-center justify-center animate-scale-in text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4 border border-red-200">
            <ShieldCheckIcon size={32} color="#8A0F13" />
          </div>

          <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full uppercase mb-2">
            Step-Up Biometric Required
          </span>

          <h2 className="text-lg font-black text-neutral-900 mb-2">
            Security Challenge Triggered
          </h2>
          <p className="text-xs text-neutral-600 mb-5 leading-relaxed">
            {result?.reason ??
              'An unusual transaction pattern or amount was detected. Complete biometric authentication to release this transfer.'}
          </p>

          {error && (
            <p className="text-xs text-primary-800 font-semibold mb-4 bg-red-50 px-3 py-1.5 rounded-xl border border-red-100">
              {error}
            </p>
          )}

          <div className="w-full space-y-2.5">
            {/* Primary: Face ID */}
            <button
              onClick={() => openStepUpBiometric()}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 text-xs font-bold"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
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

      {/* Step 5: Receipt / Result */}
      {step === 'result' && result && (
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
                    backgroundColor: [
                      '#8A0F13',
                      '#D97706',
                      '#059669',
                      '#4F46E5',
                      '#E11D48',
                      '#7C3AED',
                    ][i % 6],
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
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#8A0F13"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </div>
              )}
            </div>

            <h2 className="text-xl font-black text-neutral-900 mb-1">
              {isSuccess && 'Transaction Successful'}
              {isFlagged && 'Transaction Under Review'}
              {isBlocked && 'Transaction Blocked by AI Defense'}
            </h2>

            <p className={`text-3xl font-black font-mono my-2 ${isBlocked ? 'line-through text-neutral-400' : 'text-neutral-900'}`}>
              {formatCurrency(parsedAmount)}
            </p>

            {isBlocked && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 border border-green-200 rounded-full text-[11px] font-bold text-green-800 mb-3">
                <span>Wallet Balance Untouched — 0.00 GHS Deducted</span>
              </div>
            )}

            <p className="text-xs text-neutral-500 mb-6 max-w-sm mx-auto">
              {result.reason ??
                (isSuccess
                  ? 'The recipient has been credited immediately.'
                  : isBlocked
                  ? 'This transaction was automatically blocked to protect your account. No money was deducted.'
                  : 'Security review in progress.')}
            </p>

            <div className="bg-neutral-50 rounded-none p-4 border border-neutral-200/60 text-xs space-y-2.5 text-left mb-6">
              {result.transactionId && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Transaction ID:</span>
                  <span className="font-mono font-bold text-neutral-800 text-[11px] truncate max-w-[180px]">
                    {result.transactionId}
                  </span>
                </div>
              )}
              {formData.receiver && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Recipient:</span>
                  <span className="font-mono font-bold text-neutral-800">
                    {formData.receiver}
                  </span>
                </div>
              )}
              {formData.receiverName && (
                <div className="flex justify-between items-center">
                  <span className="text-neutral-500">Recipient Name:</span>
                  <span className="font-bold text-neutral-800">
                    {formData.receiverName}
                  </span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Status:</span>
                <StatusBadge status={result.status} />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Timestamp:</span>
                <span className="font-medium text-neutral-700">
                  {new Date().toLocaleString('en-GB')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => navigate('/dashboard')}
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
  );
}
