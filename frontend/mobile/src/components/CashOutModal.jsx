import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Switch,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';
import { PinPad } from './PinPad';
import { DigitalReceipt } from './DigitalReceipt';

const AGENTS = [
  { name: 'Kwame Mensah Ventures', code: '024881923', location: 'Sunyani Main Market' },
  { name: 'Abena Star Kiosk', code: '055192837', location: 'Accra Circle Hub' },
  { name: 'Kofi Express MoMo Hub', code: '020491823', location: 'Kumasi Kejetia' },
  { name: 'Airport City Forex & MoMo', code: '024109283', location: 'Airport City, Accra' },
];

export function CashOutModal({
  visible,
  deviceProfile,
  location,
  hasBiometrics,
  onSubmit,
  onClose,
  onSuccess,
}) {
  const [isCashOutAllowed, setIsCashOutAllowed] = useState(false);
  const [countdown, setCountdown] = useState(300);
  const [step, setStep] = useState('settings');
  const [selectedAgent, setSelectedAgent] = useState(AGENTS[0]);
  const [customAgentCode, setCustomAgentCode] = useState('');
  const [amount, setAmount] = useState('100');
  const [completedTx, setCompletedTx] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Timer when Cash Out is allowed
  useEffect(() => {
    let timer;
    if (isCashOutAllowed && countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown <= 0) {
      setIsCashOutAllowed(false);
      setCountdown(300);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isCashOutAllowed, countdown]);

  const parsedAmount = parseFloat(amount) || 0;
  const fee = Math.min(parsedAmount * 0.01, 10);
  const totalDeduction = parsedAmount + fee;

  const handleSimulateAgentPrompt = () => {
    if (parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    setError(null);
    setStep('incoming');
  };

  const handleConfirmPrompt = () => {
    setStep('pin');
  };

  const handleExecuteCashOut = async (pinOrPassword, authLayers = ['password']) => {
    setIsProcessing(true);
    setStep('processing');
    setError(null);

    const activeCode = customAgentCode.trim() || selectedAgent.code;
    const activeName = customAgentCode.trim() ? `Agent #${customAgentCode.trim()}` : selectedAgent.name;

    const payload = {
      amount: parsedAmount,
      receiver: activeCode,
      receiverName: `${activeName} (MoMo Agent)`,
      agentCode: activeCode,
      pin: pinOrPassword || '123456',
      password: pinOrPassword || '123456',
      reference: 'Agent Cash Out Withdrawal',
      deviceProfile: deviceProfile || {
        deviceId: 'mobile-client-01',
        fingerprint: 'fp-mobile-sim',
        platform: 'mobile',
        registeredAt: new Date().toISOString(),
      },
      location,
      authLayersPassed: authLayers,
    };

    try {
      const response = await onSubmit(payload);
      const tx = response.transaction || {
        id: response.transactionId,
        type: 'cash_out',
        amount: parsedAmount,
        currency: 'GHS',
        sender: 'You',
        receiver: activeCode,
        receiverName: activeName,
        reference: 'Agent Cash Out Withdrawal',
        status: response.status,
        reason: response.reason,
        caseId: response.caseId,
        deviceProfile: payload.deviceProfile,
        location: payload.location,
        authLayersPassed: authLayers,
        createdAt: new Date().toISOString(),
      };

      setCompletedTx(tx);
      onSuccess(tx);
      setStep('receipt');
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Cash out could not be processed.';
      setError(msg);
      setStep('settings');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleModalClose = () => {
    setStep('settings');
    setIsCashOutAllowed(false);
    setCountdown(300);
    setError(null);
    setCompletedTx(null);
    onClose();
  };

  const formatTimer = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleModalClose}
    >
      <View style={styles.modalBackdrop}>
        {step === 'receipt' && completedTx ? (
          <DigitalReceipt
            transaction={completedTx}
            onClose={handleModalClose}
          />
        ) : (
          <View style={[styles.modalSheet, SHADOWS.cardElevated]}>
            <View style={styles.sheetHandle} />

            {/* Title Bar */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>Cash Out (Agent)</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>
                  Authentic Ghana MoMo Agent Withdrawal
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleModalClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* STEP 1: SETTINGS & PERMISSION */}
            {step === 'settings' && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formScroll}
              >
                {/* Ghana MoMo Allow Cash Out Toggle */}
                <View style={styles.permissionCard}>
                  <View style={styles.permissionInfo}>
                    <Text style={styles.permissionTitle}>Allow Cash Out</Text>
                    <Text style={styles.permissionSubtitle}>
                      Enable to authorize nearby registered MoMo agents to initiate a cash withdrawal.
                    </Text>
                  </View>
                  <Switch
                    value={isCashOutAllowed}
                    onValueChange={(val) => {
                      setIsCashOutAllowed(val);
                      if (val) setCountdown(300);
                    }}
                    trackColor={{ false: '#D1D5DB', true: THEME.primary }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {isCashOutAllowed && (
                  <View style={styles.timerBadge}>
                    <Ionicons name="time-outline" size={14} color="#92400E" style={{ marginRight: 6 }} />
                    <Text style={styles.timerText}>
                      Window Active: {formatTimer(countdown)} remaining
                    </Text>
                  </View>
                )}

                {/* Amount to Withdraw */}
                <Text style={styles.inputLabel}>Withdrawal Amount (GH₵)</Text>
                <View style={styles.amountInputWrap}>
                  <Text style={styles.currencyPrefix}>GH₵</Text>
                  <TextInput
                    style={styles.amountInput}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor="#9CA3AF"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>

                {/* Fee Preview */}
                <View style={styles.feePreview}>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>Cash Out Amount:</Text>
                    <Text style={styles.feeVal}>GH₵ {parsedAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.feeRow}>
                    <Text style={styles.feeLabel}>MoMo Agent Fee (1% max GH₵ 10):</Text>
                    <Text style={styles.feeVal}>+ GH₵ {fee.toFixed(2)}</Text>
                  </View>
                  <View style={[styles.feeRow, styles.feeRowTotal]}>
                    <Text style={styles.feeTotalLabel}>Total Wallet Deduction:</Text>
                    <Text style={styles.feeTotalVal}>GH₵ {totalDeduction.toFixed(2)}</Text>
                  </View>
                </View>

                {/* Select Registered MoMo Agent */}
                <Text style={styles.inputLabel}>Select MoMo Agent Kiosk</Text>
                <View style={styles.agentList}>
                  {AGENTS.map((agent) => (
                    <TouchableOpacity
                      key={agent.code}
                      style={[
                        styles.agentItem,
                        selectedAgent.code === agent.code && styles.agentItemActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => {
                        setSelectedAgent(agent);
                        setCustomAgentCode('');
                      }}
                    >
                      <View style={styles.agentAvatar}>
                        <MaterialCommunityIcons name="storefront-outline" size={20} color={THEME.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.agentName}>{agent.name}</Text>
                        <Text style={styles.agentMeta}>
                          Code: {agent.code} • {agent.location}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>

                {error && <Text style={styles.formErrorText}>{error}</Text>}

                {/* Simulate Agent Prompt Action */}
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    SHADOWS.crimsonGlow,
                    !isCashOutAllowed && { opacity: 0.5 },
                  ]}
                  activeOpacity={0.8}
                  disabled={!isCashOutAllowed}
                  onPress={handleSimulateAgentPrompt}
                >
                  <Text style={styles.primaryBtnText}>
                    {isCashOutAllowed
                      ? 'Simulate Agent Withdrawal Request'
                      : 'Toggle "Allow Cash Out" Above'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP 2: INCOMING AGENT PROMPT */}
            {step === 'incoming' && (
              <View style={styles.promptWrap}>
                <View style={styles.promptBadge}>
                  <Ionicons name="notifications-outline" size={13} color="#B45309" style={{ marginRight: 4 }} />
                  <Text style={styles.promptBadgeText}>INCOMING AGENT PROMPT</Text>
                </View>
                <Text style={styles.promptTitle}>Authorize MoMo Withdrawal</Text>
                <Text style={styles.promptSubtitle}>
                  Agent <Text style={{ fontFamily: FONTS.bold, color: THEME.text }}>{selectedAgent.name}</Text> (Code: {selectedAgent.code}) has requested a cash out deduction.
                </Text>

                <View style={styles.promptCard}>
                  <View style={styles.promptRow}>
                    <Text style={styles.promptLabel}>Amount to Hand Over:</Text>
                    <Text style={styles.promptValBold}>GH₵ {parsedAmount.toFixed(2)}</Text>
                  </View>
                  <View style={styles.promptRow}>
                    <Text style={styles.promptLabel}>Service Fee:</Text>
                    <Text style={styles.promptVal}>GH₵ {fee.toFixed(2)}</Text>
                  </View>
                  <View style={styles.promptDivider} />
                  <View style={styles.promptRow}>
                    <Text style={styles.promptTotalLabel}>Total Deduction:</Text>
                    <Text style={styles.promptTotalVal}>GH₵ {totalDeduction.toFixed(2)}</Text>
                  </View>
                </View>

                <View style={styles.promptActions}>
                  <TouchableOpacity
                    style={styles.declineBtn}
                    activeOpacity={0.7}
                    onPress={() => setStep('settings')}
                  >
                    <Text style={styles.declineBtnText}>Decline</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.primaryBtn, { flex: 1, marginTop: 0 }]}
                    activeOpacity={0.8}
                    onPress={handleConfirmPrompt}
                  >
                    <Text style={styles.primaryBtnText}>Enter Password to Authorize</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: PASSWORD PAD */}
            {step === 'pin' && (
              <PinPad
                length={6}
                title="Enter MoMo Password"
                subtitle={`Authorize Agent Cash Out of GH₵ ${totalDeduction.toFixed(2)}`}
                hasBiometrics={hasBiometrics}
                onBiometricPress={() => handleExecuteCashOut('123456', ['biometric'])}
                onComplete={(password) => handleExecuteCashOut(password, ['password'])}
                onCancel={() => setStep('incoming')}
              />
            )}

            {/* PROCESSING */}
            {step === 'processing' && (
              <View style={styles.processingWrap}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.processingTitle}>Authorizing Cash Out...</Text>
                <Text style={styles.processingSubtitle}>
                  Validating agent token and verifying AI risk signals
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 20,
    maxHeight: '90%',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginBottom: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    fontFamily: FONTS.black,
    fontSize: 20,
    fontWeight: '800',
    color: THEME.text,
  },
  modalSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  formScroll: {
    paddingBottom: 20,
  },
  permissionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  permissionInfo: {
    flex: 1,
    paddingRight: 10,
  },
  permissionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  permissionSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginBottom: 14,
  },
  timerText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  inputLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    marginTop: 10,
    marginBottom: 6,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  currencyPrefix: {
    fontFamily: FONTS.bold,
    fontSize: 20,
    fontWeight: '800',
    color: THEME.primary,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    height: 54,
    fontFamily: FONTS.black,
    fontSize: 24,
    fontWeight: '800',
    color: THEME.text,
  },
  feePreview: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feeLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  feeVal: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  feeRowTotal: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 6,
    marginTop: 2,
  },
  feeTotalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  feeTotalVal: {
    fontFamily: FONTS.black,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
  },
  agentList: {
    gap: 8,
    marginTop: 4,
  },
  agentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  agentItemActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  agentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  agentMeta: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  formErrorText: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  primaryBtn: {
    backgroundColor: THEME.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  primaryBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  promptWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  promptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  promptBadgeText: {
    fontFamily: FONTS.bold,
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  promptTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4,
  },
  promptSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  promptCard: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  promptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  promptLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: '#64748B',
  },
  promptVal: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  promptValBold: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  promptDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 4,
  },
  promptTotalLabel: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.text,
  },
  promptTotalVal: {
    fontFamily: FONTS.black,
    fontSize: 16,
    fontWeight: '900',
    color: THEME.primary,
  },
  promptActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 20,
  },
  declineBtn: {
    flex: 0.45,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  processingWrap: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  processingTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
  },
  processingSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
  },
});
