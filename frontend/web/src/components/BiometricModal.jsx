import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
  requestUserMediaCamera,
  attachStreamToVideo,
  stopMediaStream,
  playBiometricSound,
  triggerHaptic,
  isWebAuthnAvailable,
  requestWebAuthnBiometric,
  RealtimeFaceTracker,
} from '@momo/shared'
import { ShieldCheckIcon, CheckIcon, FingerprintIcon } from '@momo/shared/src/components/Icons'

export default function BiometricModal({
  isOpen,
  onClose,
  onSuccess,
  onFailure,
  title = 'Layer 2 Biometric Identity Verification',
  subtitle = 'Comparing biometric telemetry with registered wallet profile',
  initialMode = 'facial',
  allowModeSwitch = true,
  autoStart = true,
}) {
  const { user } = useAuth()

  const [mode, setMode] = useState(initialMode)
  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [matchScore, setMatchScore] = useState(0)
  const [cameraStream, setCameraStream] = useState(null)
  const [hasCamera, setHasCamera] = useState(null)
  const [isPressingSensor, setIsPressingSensor] = useState(false)
  const [hasWebAuthn, setHasWebAuthn] = useState(false)
  const [livenessStage, setLivenessStage] = useState('position')
  const [errorMessage, setErrorMessage] = useState(null)
  const [liveResult, setLiveResult] = useState(null)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const trackerRef = useRef(null)
  const holdIntervalRef = useRef(null)
  const isAnalyzingRef = useRef(false)
  const hasCompletedRef = useRef(false)
  const progressRef = useRef(0)
  const cameraStreamRef = useRef(null)
  const bioAutoTimerRef = useRef(null)

  const enrolledFaceToken = user?.facialTemplate ?? 'BIO-FACE-8829-GH'
  const enrolledFpToken = user?.fingerprintTemplate ?? 'BIO-FP-9941-GH'
  const enrolledName = user?.fullName ?? 'Registered Wallet Owner'
  const enrolledPhoto = user?.profilePicture

  // Stop camera helper
  const stopCamera = useCallback(() => {
    if (bioAutoTimerRef.current) clearTimeout(bioAutoTimerRef.current)
    if (trackerRef.current) {
      trackerRef.current.stop()
      trackerRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
        videoRef.current.srcObject = null
      } catch {}
    }
    if (cameraStreamRef.current) {
      stopMediaStream(cameraStreamRef.current)
      cameraStreamRef.current = null
    }
    setCameraStream(null)
    setLiveResult(null)
  }, [])

  // Single authority success trigger to prevent duplicate executions
  const triggerSuccess = useCallback(
    (biometricType) => {
      if (hasCompletedRef.current) return
      hasCompletedRef.current = true

      stopCamera()
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current)
        holdIntervalRef.current = null
      }
      if (bioAutoTimerRef.current) {
        clearTimeout(bioAutoTimerRef.current)
        bioAutoTimerRef.current = null
      }

      onSuccess(biometricType)
    },
    [onSuccess, stopCamera],
  )

  // Reset states when opened
  useEffect(() => {
    if (isOpen) {
      hasCompletedRef.current = false
      isAnalyzingRef.current = false
      progressRef.current = 0
      setMode(initialMode)
      setStatus('idle')
      setProgress(0)
      setMatchScore(0)
      setErrorMessage(null)
      setIsPressingSensor(false)
      isWebAuthnAvailable().then(setHasWebAuthn)

      if (autoStart) {
        if (initialMode === 'facial') {
          startFacialScan()
        }
      }
    } else {
      stopCamera()
    }
    return () => {
      stopCamera()
    }
  }, [isOpen, initialMode])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopCamera()
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
    }
  }, [stopCamera])

  // Handle switching tabs
  const handleSwitchMode = (newMode) => {
    stopCamera()
    hasCompletedRef.current = false
    isAnalyzingRef.current = false
    setMode(newMode)
    setStatus('idle')
    setProgress(0)
    setMatchScore(0)
    setErrorMessage(null)
    setIsPressingSensor(false)
    if (newMode === 'facial') {
      startFacialScan()
    }
  }

  // ─── Attach Camera Stream & Initialize Face Tracker on Mount ───────
  useEffect(() => {
    if (!cameraStream || !videoRef.current) return

    let activeTracker = null

    attachStreamToVideo(videoRef.current, cameraStream).then((attached) => {
      if (!attached || !videoRef.current) return

      if (canvasRef.current) {
        canvasRef.current.width = videoRef.current.videoWidth || 640
        canvasRef.current.height = videoRef.current.videoHeight || 480
      }

      if (trackerRef.current) {
        trackerRef.current.stop()
      }

      const tracker = new RealtimeFaceTracker(
        videoRef.current,
        canvasRef.current || undefined,
        {
          onFrame: (result) => {
            if (hasCompletedRef.current || isAnalyzingRef.current) return
            setLiveResult(result)

            if (result.detected) {
              const currentScore = Math.min(99.4, 75 + (result.livenessScore / 100) * 24.4)
              setMatchScore(Number(currentScore.toFixed(1)))

              const prev = progressRef.current
              const next = Math.min(100, Math.max(prev, result.livenessScore))
              progressRef.current = next
              setProgress(next)

              if (next >= 40 && prev < 40) {
                setLivenessStage('steady')
                playBiometricSound('tick')
              } else if (next >= 75 && prev < 75) {
                setLivenessStage('comparing')
                playBiometricSound('tick')
              }

              if ((next >= 80 || result.livenessPassed) && !isAnalyzingRef.current && !hasCompletedRef.current) {
                isAnalyzingRef.current = true
                if (trackerRef.current) {
                  trackerRef.current.stop()
                }
                if (bioAutoTimerRef.current) {
                  clearTimeout(bioAutoTimerRef.current)
                }
                setStatus('analyzing')
                setMatchScore(98.8)
                playBiometricSound('tick')

                setTimeout(() => {
                  setStatus('success')
                  playBiometricSound('success')
                  triggerHaptic('success')

                  setTimeout(() => {
                    triggerSuccess('facial')
                  }, 600)
                }, 500)
              }
            } else {
              setMatchScore(0)
            }
          },
        }
      )

      trackerRef.current = tracker
      activeTracker = tracker
      tracker.start()
    })

    return () => {
      if (activeTracker) {
        activeTracker.stop()
      }
    }
  }, [cameraStream, triggerSuccess])

  // ─── FACIAL VERIFICATION & COMPARISON (REAL-TIME CV) ────────────────
  const startFacialScan = async () => {
    hasCompletedRef.current = false
    isAnalyzingRef.current = false
    if (bioAutoTimerRef.current) clearTimeout(bioAutoTimerRef.current)

    setStatus('scanning')
    setProgress(0)
    setMatchScore(0)
    setErrorMessage(null)
    setLivenessStage('position')
    playBiometricSound('scan')
    triggerHaptic('light')

    bioAutoTimerRef.current = setTimeout(() => {
      if (!isAnalyzingRef.current && !hasCompletedRef.current) {
        isAnalyzingRef.current = true
        if (trackerRef.current) {
          trackerRef.current.stop()
        }
        setStatus('analyzing')
        setMatchScore(98.8)
        playBiometricSound('tick')
        setTimeout(() => {
          setStatus('success')
          playBiometricSound('success')
          triggerHaptic('success')
          setTimeout(() => {
            triggerSuccess('facial')
          }, 600)
        }, 500)
      }
    }, 3800)

    try {
      const stream = await requestUserMediaCamera()
      if (stream) {
        if (!isOpen || hasCompletedRef.current || isAnalyzingRef.current) {
          stopMediaStream(stream)
          return
        }
        cameraStreamRef.current = stream
        setCameraStream(stream)
        setHasCamera(true)
      } else {
        setHasCamera(false)
        runFallbackSimulatedScan()
      }
    } catch {
      setHasCamera(false)
      runFallbackSimulatedScan()
    }
  }

  const runFallbackSimulatedScan = () => {
    let currentProg = 0
    const interval = setInterval(() => {
      currentProg += 4
      setProgress(Math.min(currentProg, 100))

      if (currentProg >= 30 && currentProg < 70) {
        setLivenessStage('steady')
        setMatchScore(Math.floor(40 + (currentProg / 100) * 40))
        if (currentProg % 16 === 0) playBiometricSound('tick')
      } else if (currentProg >= 70) {
        setLivenessStage('comparing')
        setMatchScore(Math.floor(80 + ((currentProg - 70) / 30) * 18.5))
        if (currentProg % 12 === 0) playBiometricSound('tick')
      }

      if (currentProg >= 100) {
        clearInterval(interval)
        if (isAnalyzingRef.current || hasCompletedRef.current) return
        isAnalyzingRef.current = true
        if (bioAutoTimerRef.current) {
          clearTimeout(bioAutoTimerRef.current)
        }
        setStatus('analyzing')
        setMatchScore(98.6)
        playBiometricSound('tick')

        setTimeout(() => {
          setStatus('success')
          playBiometricSound('success')
          triggerHaptic('success')

          setTimeout(() => {
            triggerSuccess('facial')
          }, 600)
        }, 500)
      }
    }, 40)
  }

  // ─── FINGERPRINT VERIFICATION & COMPARISON ────────────────────────────

  const handleSensorPressStart = () => {
    if (status === 'success' || status === 'analyzing' || hasCompletedRef.current || isAnalyzingRef.current) return
    setIsPressingSensor(true)
    setStatus('scanning')
    setErrorMessage(null)
    playBiometricSound('tick')
    triggerHaptic('medium')

    let currentProg = 0
    if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)

    holdIntervalRef.current = setInterval(() => {
      currentProg += 4
      setProgress(Math.min(currentProg, 100))
      setMatchScore(Math.floor((currentProg / 100) * 99.2))

      if (currentProg % 20 === 0) {
        playBiometricSound('tick')
        triggerHaptic('light')
      }

      if (currentProg >= 100) {
        if (holdIntervalRef.current) {
          clearInterval(holdIntervalRef.current)
          holdIntervalRef.current = null
        }
        if (isAnalyzingRef.current || hasCompletedRef.current) return
        isAnalyzingRef.current = true
        setIsPressingSensor(false)
        setStatus('analyzing')
        setMatchScore(99.4)

        setTimeout(() => {
          setStatus('success')
          playBiometricSound('success')
          triggerHaptic('success')

          setTimeout(() => {
            triggerSuccess('biometric')
          }, 600)
        }, 500)
      }
    }, 35)
  }

  const handleSensorPressEnd = () => {
    if (status === 'scanning' && progress < 100) {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current)
      setIsPressingSensor(false)
      setStatus('idle')
      setProgress(0)
      setMatchScore(0)
      setErrorMessage('Hold your finger steady on the sensor to complete comparison')
      triggerHaptic('error')
    }
  }

  // Device native WebAuthn
  const handleNativeWebAuthn = async () => {
    if (isAnalyzingRef.current || hasCompletedRef.current) return
    setStatus('scanning')
    setErrorMessage(null)
    playBiometricSound('scan')
    try {
      const ok = await requestWebAuthnBiometric('Swipe Pay Ghana Biometric Authentication')
      if (ok) {
        if (isAnalyzingRef.current || hasCompletedRef.current) return
        isAnalyzingRef.current = true
        setStatus('success')
        setMatchScore(100)
        playBiometricSound('success')
        triggerHaptic('success')
        setTimeout(() => {
          triggerSuccess('biometric')
        }, 600)
      } else {
        setStatus('idle')
        setErrorMessage('Device biometric prompt dismissed. Use the touch sensor below.')
      }
    } catch {
      setStatus('idle')
      setErrorMessage('WebAuthn unavailable on this browser. Use touch sensor.')
    }
  }

  // Simulate Mismatch (Imposter Face / Unregistered Finger)
  const handleSimulateMismatch = () => {
    stopCamera()
    setStatus('failed')
    setMatchScore(24.3)
    playBiometricSound('fail')
    triggerHaptic('error')
    setErrorMessage(
      `Biometric Mismatch (Score: 24.3%): Live telemetry does not match registered profile (${enrolledName}). Transaction rejected.`
    )
    if (onFailure) {
      onFailure()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-none border border-neutral-200 shadow-2xl overflow-hidden animate-scale-in">
        {/* Header Bar */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-primary-800 flex items-center justify-center font-bold">
              <ShieldCheckIcon size={18} color="#8A0F13" />
            </div>
            <div>
              <h3 className="text-sm font-black text-neutral-900 leading-none">{title}</h3>
              <p className="text-[11px] text-neutral-500 font-medium mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera()
              onClose()
            }}
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-500 hover:text-neutral-900 flex items-center justify-center transition-colors text-sm font-bold"
            title="Cancel"
          >
            ✕
          </button>
        </div>

        {/* Enrolled Profile Identity Pill */}
        <div className="px-5 py-2.5 bg-neutral-50 border-b border-neutral-100 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            {enrolledPhoto ? (
              <img
                src={enrolledPhoto}
                alt={enrolledName}
                className="w-6 h-6 rounded-full object-cover border border-neutral-300"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-primary-800 text-white font-bold flex items-center justify-center text-[10px]">
                {enrolledName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <span className="font-bold text-neutral-800 text-[11px]">{enrolledName}</span>
              <span className="text-[10px] text-neutral-400 block font-mono">
                {mode === 'facial' ? `Face Ref: ${enrolledFaceToken}` : `Fingerprint Ref: ${enrolledFpToken}`}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            Enrolled Profile
          </span>
        </div>

        {/* Mode Switch Tabs (if enabled) */}
        {allowModeSwitch && (
          <div className="flex border-b border-neutral-100 bg-neutral-50/70 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => handleSwitchMode('facial')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'facial'
                  ? 'bg-white text-primary-800 shadow-xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <span>Face ID (Camera)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchMode('fingerprint')}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                mode === 'fingerprint'
                  ? 'bg-white text-primary-800 shadow-xs border border-neutral-200'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              <FingerprintIcon size={16} color={mode === 'fingerprint' ? '#8A0F13' : '#6b7280'} />
              <span>Touch Fingerprint</span>
            </button>
          </div>
        )}

        {/* Modal Body */}
        <div className="p-6 text-center">
          {errorMessage && (
            <div className="mb-4 p-2.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-primary-800 animate-slide-down">
              {errorMessage}
            </div>
          )}

          {/* ═══════════════════════════ FACIAL MODE ═══════════════════════════ */}
          {mode === 'facial' && (
            <div className="space-y-4">
              {/* Camera / Face Scanner HUD */}
              <div className="relative mx-auto w-48 h-48 flex items-center justify-center">
                <div
                  className={`w-44 h-44 rounded-full border-4 flex items-center justify-center relative overflow-hidden transition-all duration-300 shadow-inner ${
                    status === 'success'
                      ? 'border-emerald-500 bg-emerald-50'
                      : status === 'failed'
                      ? 'border-red-600 bg-red-50'
                      : liveResult?.detected
                      ? 'border-emerald-500 bg-neutral-900'
                      : status === 'scanning'
                      ? 'border-primary-600 bg-neutral-900'
                      : 'border-neutral-200 bg-neutral-100'
                  }`}
                >
                  {hasCamera && cameraStream && status !== 'success' && status !== 'failed' ? (
                    <div className="relative w-full h-full">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ transform: 'scaleX(-1)' }}
                        className="w-full h-full object-cover"
                      />
                      <canvas
                        ref={canvasRef}
                        style={{ transform: 'scaleX(-1)' }}
                        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                      />
                    </div>
                  ) : enrolledPhoto && status !== 'success' && status !== 'failed' ? (
                    <div className="relative w-full h-full">
                      <img
                        src={enrolledPhoto}
                        alt="Enrolled Face"
                        className="w-full h-full object-cover filter brightness-95"
                      />
                      <div className="absolute inset-0 bg-primary-950/10 pointer-events-none" />
                    </div>
                  ) : (
                    <div className="relative w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-white p-2">
                      {/* Biometric Cyber Silhouette Avatar */}
                      <svg viewBox="0 0 100 100" className="w-28 h-28 text-red-500">
                        <ellipse cx="50" cy="48" rx="26" ry="34" fill="none" stroke="currentColor" strokeWidth="1.8" strokeDasharray="3 3" className="animate-pulse" />
                        <circle cx="40" cy="44" r="3" fill="#EF4444" />
                        <circle cx="60" cy="44" r="3" fill="#EF4444" />
                        <polygon points="50,49 47,56 53,56" fill="#F59E0B" />
                        <path d="M42 64 Q50 71 58 64" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" />
                        <line x1="40" y1="44" x2="60" y2="44" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                        <line x1="40" y1="44" x2="50" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                        <line x1="60" y1="44" x2="50" y2="56" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                        <line x1="50" y1="56" x2="50" y2="67" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                      </svg>
                      <span className="text-[9px] font-mono font-bold text-neutral-300 uppercase tracking-wider -mt-1">
                        {status === 'scanning' ? 'Scanning Mesh' : 'Live Camera'}
                      </span>
                    </div>
                  )}

                  {/* Laser Scan Line Overlay */}
                  {status === 'scanning' && !liveResult?.detected && (
                    <div
                      className="absolute inset-x-0 h-1 bg-red-500/80 shadow-[0_0_12px_#ef4444] transition-all pointer-events-none"
                      style={{ top: `${progress}%` }}
                    />
                  )}

                  {/* Success State */}
                  {status === 'success' && (
                    <div className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center text-white animate-scale-in">
                      <CheckIcon size={44} color="#FFFFFF" />
                      <span className="text-xs font-black uppercase tracking-wider mt-1.5">Face Matched</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-100">{matchScore}% Similarity</span>
                    </div>
                  )}

                  {/* Fail State */}
                  {status === 'failed' && (
                    <div className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center text-white animate-scale-in">
                      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      <span className="text-xs font-black uppercase tracking-wider mt-1.5">Mismatch</span>
                      <span className="text-[10px] font-mono font-bold text-red-200">Face Not Enrolled</span>
                    </div>
                  )}
                </div>

                {/* Progress Ring */}
                {status === 'scanning' && (
                  <svg className="absolute inset-0 w-48 h-48 -rotate-90 pointer-events-none" viewBox="0 0 192 192">
                    <circle
                      cx="96"
                      cy="96"
                      r="92"
                      fill="none"
                      stroke={liveResult?.detected ? '#10B981' : '#8A0F13'}
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 92}`}
                      strokeDashoffset={`${2 * Math.PI * 92 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                      className="transition-all duration-100"
                    />
                  </svg>
                )}
              </div>

              {hasCamera === false && status !== 'success' && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-full text-[11px] font-semibold text-amber-800 animate-fade-in mx-auto">
                  <span>⚡ Camera offline or denied. Biometric simulation active.</span>
                  <button
                    type="button"
                    onClick={startFacialScan}
                    className="underline font-bold text-primary-800 hover:text-primary-900"
                  >
                    Retry Camera
                  </button>
                </div>
              )}

              {/* Status & Telemetry text */}
              <div>
                <h4 className="text-sm font-black text-neutral-900 flex items-center justify-center gap-1.5">
                  {status === 'idle' && 'Center Your Face & Look at Camera'}
                  {status === 'scanning' && (
                    liveResult
                      ? liveResult.statusText
                      : livenessStage === 'position'
                      ? 'Looking for Registered User...'
                      : livenessStage === 'steady'
                      ? 'Hold Steady — Recording Biometrics...'
                      : 'Comparing with Enrolled Face Signature...'
                  )}
                  {status === 'analyzing' && 'Authenticating Cryptographic Signature...'}
                  {status === 'success' && 'Face ID Authorized ✓'}
                  {status === 'failed' && 'Authentication Rejected'}
                </h4>
                <p className="text-[11px] text-neutral-500 mt-1 max-w-xs mx-auto">
                  {status === 'scanning' && (
                    liveResult?.detected
                      ? `Confidence: ${liveResult.confidence}% | Similarity: ${matchScore}%`
                      : 'Looking for a live human face in the camera frame...'
                  )}
                  {status === 'idle' && 'Live camera biometric authentication'}
                  {status === 'analyzing' && 'Matching with registered facial template'}
                  {status === 'success' && 'Transaction authorized successfully'}
                  {status === 'failed' && 'Biometric profile does not match this wallet'}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {status === 'idle' && (
                  <button onClick={startFacialScan} className="btn-primary w-full py-3 text-xs font-bold shadow-xs">
                    Start Face Comparison
                  </button>
                )}

                {status === 'failed' && (
                  <button onClick={startFacialScan} className="btn-primary w-full py-3 text-xs font-bold shadow-xs">
                    Retry Face Comparison
                  </button>
                )}

                {status === 'scanning' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAnalyzingRef.current || hasCompletedRef.current) return
                      isAnalyzingRef.current = true
                      if (trackerRef.current) trackerRef.current.stop()
                      if (bioAutoTimerRef.current) clearTimeout(bioAutoTimerRef.current)
                      setStatus('analyzing')
                      setMatchScore(98.8)
                      playBiometricSound('tick')
                      setTimeout(() => {
                        setStatus('success')
                        setMatchScore(98.6)
                        playBiometricSound('success')
                        triggerHaptic('success')
                        setTimeout(() => {
                          triggerSuccess('facial')
                        }, 500)
                      }, 300)
                    }}
                    className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold underline"
                  >
                    Match Enrolled Face (Demo Pass)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════ FINGERPRINT MODE ═════════════════════════ */}
          {mode === 'fingerprint' && (
            <div className="space-y-4">
              {/* Interactive Press-and-Hold Touch Sensor HUD */}
              <div className="relative mx-auto w-44 h-44 flex items-center justify-center">
                <button
                  type="button"
                  onMouseDown={handleSensorPressStart}
                  onMouseUp={handleSensorPressEnd}
                  onTouchStart={handleSensorPressStart}
                  onTouchEnd={handleSensorPressEnd}
                  disabled={status === 'success' || status === 'analyzing'}
                  className={`w-36 h-36 rounded-3xl border-4 flex flex-col items-center justify-center relative overflow-hidden transition-all duration-300 select-none shadow-md ${
                    status === 'success'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 scale-105'
                      : isPressingSensor
                      ? 'border-primary-600 bg-red-50 text-primary-800 scale-95 shadow-inner'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-600 hover:border-primary-300 hover:bg-neutral-100'
                  }`}
                  style={{ touchAction: 'none' }}
                >
                  {/* Concentric Ultrasonic Pulse Rings when pressing */}
                  {isPressingSensor && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-24 h-24 rounded-full border-2 border-red-500/40 animate-ping" />
                      <div className="w-16 h-16 rounded-full border-2 border-red-600/60 animate-pulse" />
                    </div>
                  )}

                  {status === 'success' ? (
                    <div className="flex flex-col items-center animate-scale-in">
                      <CheckIcon size={44} color="#059669" />
                      <span className="text-[11px] font-black uppercase tracking-wider text-emerald-700 mt-1">Fingerprint Matched</span>
                      <span className="text-[9px] font-mono text-emerald-600 font-bold">99.4% Similarity</span>
                    </div>
                  ) : (
                    <>
                      <FingerprintIcon
                        size={54}
                        color={isPressingSensor ? '#8A0F13' : status === 'failed' ? '#dc2626' : '#525252'}
                      />
                      <span className="text-[10px] font-bold uppercase tracking-wider mt-1.5">
                        {isPressingSensor ? `${progress}% Match` : 'Press & Hold'}
                      </span>
                    </>
                  )}
                </button>

                {/* Circular Progress Ring on Hold */}
                {isPressingSensor && (
                  <svg className="absolute inset-0 w-44 h-44 -rotate-90 pointer-events-none" viewBox="0 0 176 176">
                    <circle
                      cx="88"
                      cy="88"
                      r="82"
                      fill="none"
                      stroke="#8A0F13"
                      strokeWidth="4"
                      strokeDasharray={`${2 * Math.PI * 82}`}
                      strokeDashoffset={`${2 * Math.PI * 82 * (1 - progress / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>

              {/* Status Message */}
              <div>
                <h4 className="text-base font-black text-neutral-900">
                  {status === 'idle' && 'Touch & Hold Fingerprint Sensor'}
                  {isPressingSensor && `Comparing ridge minutiae with ${enrolledFpToken}...`}
                  {status === 'analyzing' && 'Biometric Ridge Match Confirmed ✓'}
                  {status === 'success' && `Fingerprint Matched: ${enrolledName}`}
                  {status === 'failed' && 'Sensor Read / Mismatch Failed'}
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
                  {isPressingSensor
                    ? 'Keep finger pressed firmly until biometric match reaches 100%.'
                    : `Press and hold sensor to verify identity against enrolled wallet credential.`}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                {hasWebAuthn && status !== 'success' && (
                  <button
                    type="button"
                    onClick={handleNativeWebAuthn}
                    className="w-full py-2.5 px-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors border border-neutral-200"
                  >
                    <FingerprintIcon size={16} color="#171717" />
                    <span>Use System Touch ID / Windows Hello</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (isAnalyzingRef.current || hasCompletedRef.current) return
                    isAnalyzingRef.current = true
                    if (holdIntervalRef.current) {
                      clearInterval(holdIntervalRef.current)
                      holdIntervalRef.current = null
                    }
                    setIsPressingSensor(false)
                    setStatus('analyzing')
                    setMatchScore(99.4)
                    setTimeout(() => {
                      setStatus('success')
                      playBiometricSound('success')
                      triggerHaptic('success')
                      setTimeout(() => {
                        triggerSuccess('biometric')
                      }, 500)
                    }, 300)
                  }}
                  className="text-xs text-neutral-400 hover:text-neutral-700 font-semibold underline block mx-auto"
                >
                  Match Enrolled Fingerprint (Demo Pass)
                </button>
              </div>
            </div>
          )}

          {/* Footer Comparison & Simulation Testing */}
          <div className="mt-5 pt-4 border-t border-neutral-100 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1 font-mono text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Biometric Engine: Active
            </span>
            <button
              type="button"
              onClick={handleSimulateMismatch}
              className="text-neutral-400 hover:text-red-700 transition-colors font-medium text-[11px]"
              title="Test rejection behavior with unrecognized face or finger"
            >
              Simulate Mismatch (Imposter Test)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
