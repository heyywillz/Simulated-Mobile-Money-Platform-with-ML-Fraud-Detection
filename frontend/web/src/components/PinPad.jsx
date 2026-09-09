import React, { useState, useRef, useEffect } from 'react';
import { ShieldCheckIcon } from '@momo/shared/src/components/Icons';

export default function PinPad({
  onComplete,
  length = 6,
  title = 'Enter your Password',
  subtitle = 'Enter the account password you created during registration to authorize this payment',
  error,
  isLoading = false,
  compact = false,
}) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (error) {
      setShakeError(true);
      const timer = setTimeout(() => setShakeError(false), 600);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (isLoading || !password.trim()) return;
    onComplete(password.trim());
  };

  return (
    <div
      className={`flex flex-col items-center justify-center animate-fade-in ${
        compact ? 'px-2' : 'px-4'
      }`}
    >
      {/* Shield Icon Badge */}
      <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center mb-3 shadow-xs">
        <ShieldCheckIcon size={24} color="#8A0F13" />
      </div>

      {/* Header */}
      <div className="text-center mb-4 max-w-sm">
        <h2 className="text-xl sm:text-2xl font-black text-neutral-900 mb-1 leading-tight tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs sm:text-sm text-neutral-500 leading-relaxed">
            {subtitle}
          </p>
        )}
      </div>

      {/* Password Authorization Form */}
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div
          className={`bg-white p-4 sm:p-5 rounded-2xl border ${
            error
              ? 'border-red-300 ring-2 ring-red-100'
              : 'border-neutral-200 focus-within:border-primary-800 focus-within:ring-2 focus-within:ring-primary-800/20'
          } shadow-xs transition-all ${
            shakeError ? 'animate-[shake_0.5s_ease-in-out]' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="auth-password-input"
              className="text-xs font-bold text-neutral-700 uppercase tracking-wide"
            >
              Account Password
            </label>
            <span className="text-[10px] text-neutral-400 font-medium">
              Registered Password
            </span>
          </div>

          <div className="relative">
            <input
              id="auth-password-input"
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              placeholder="Enter your account password"
              autoComplete="current-password"
              className="w-full pr-14 pl-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-sm font-semibold text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:bg-white transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-bold text-neutral-500 hover:text-primary-800 rounded-md hover:bg-neutral-100 transition-colors"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>

          {/* Inline Error Message */}
          {error && (
            <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-primary-800 text-xs font-semibold animate-fade-in">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="shrink-0 mt-0.5"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !password.trim()}
          className="btn-primary w-full py-3 text-sm font-bold shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Verifying Password...</span>
            </>
          ) : (
            <>
              <span>Authorize Payment</span>
              <span>→</span>
            </>
          )}
        </button>

        {/* Security Info Note */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400 text-center">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>End-to-end encrypted transaction authorization</span>
        </div>
      </form>
    </div>
  );
}
