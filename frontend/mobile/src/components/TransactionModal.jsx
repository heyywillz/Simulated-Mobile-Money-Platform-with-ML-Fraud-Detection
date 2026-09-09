import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';
import { PinPad } from './PinPad';
import { DigitalReceipt } from './DigitalReceipt';

const PRESET_AMOUNTS = [10, 20, 50, 100, 200, 500];

const NETWORKS = [
  { id: 'mtn', name: 'MTN MoMo', code: '024/054/055' },
  { id: 'telecel', name: 'Telecel Cash', code: '020/050' },
  { id: 'at', name: 'AT Money', code: '027/057/026' },
  { id: 'bank', name: 'Ghana Bank', code: 'Instant ACH' },
];

const BILLERS = [
  { id: 'ecg', name: 'ECG Electricity (Prepaid)', category: 'Power', icon: 'flash' },
  { id: 'gwcl', name: 'Ghana Water Company (GWCL)', category: 'Water', icon: 'water' },
  { id: 'dstv', name: 'DSTV / GOtv Ghana', category: 'TV', icon: 'tv' },
  { id: 'fiber', name: 'MTN Broadband Fiber', category: 'Internet', icon: 'wifi' },
  { id: 'starlink', name: 'Starlink Internet Africa', category: 'Internet', icon: 'globe' },
  { id: 'school', name: 'University / School Fees', category: 'Education', icon: 'school' },
];

const POPULAR_MERCHANTS = [
  { name: 'Melcom Superstore', code: 'MEL-492019', cat: 'Retail' },
  { name: 'Shell Airport City', code: 'SHL-883102', cat: 'Fuel' },
  { name: 'Shoprite Accra Mall', code: 'SHP-110294', cat: 'Groceries' },
  { name: 'KFC Ring Road Central', code: 'KFC-201948', cat: 'Food' },
];

const DATA_BUNDLES = [
  { id: 'd1', name: '1.5GB Always-On (24h)', price: 10, data: '1.5 GB' },
  { id: 'd2', name: '4.5GB Non-Expiry Bundle', price: 25, data: '4.5 GB' },
  { id: 'd3', name: '10GB Heavy User (30 Days)', price: 50, data: '10.0 GB' },
  { id: 'd4', name: '25GB Turbo Mega (60 Days)', price: 100, data: '25.0 GB' },
];

const QUICK_CONTACTS = [
  { name: 'Ama Tetteh', phone: '0241234567', network: 'mtn' },
  { name: 'Kwame Mensah', phone: '0559876543', network: 'mtn' },
  { name: 'Abena Osei', phone: '0205551234', network: 'telecel' },
];

export function TransactionModal({
  visible,
  type,
  deviceProfile,
  location,
  hasBiometrics,
  onSubmit,
  onClose,
  onSuccess,
}) {
  // Flow steps: input -> pin -> step_up -> processing -> receipt
  const [step, setStep] = useState('input');
  const [amount, setAmount] = useState('50');
  const [receiver, setReceiver] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [reference, setReference] = useState('');
  const [selectedNetwork, setSelectedNetwork] = useState(NETWORKS[0].id);
  const [selectedBiller, setSelectedBiller] = useState(BILLERS[0]);
  const [selectedDataBundle, setSelectedDataBundle] = useState(DATA_BUNDLES[0]);
  const [airtimeMode, setAirtimeMode] = useState('airtime');
  const [depositMethod, setDepositMethod] = useState('agent');
  const [completedTx, setCompletedTx] = useState(null);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [stepUpProgress, setStepUpProgress] = useState(0);

  const getTitle = () => {
    switch (type) {
      case 'send':
        return 'Send Money';
      case 'pay_bill':
        return 'Pay Bills';
      case 'buy_goods':
        return 'Buy Goods';
      case 'cash_in':
        return 'Cash In (Deposit)';
      case 'airtime':
        return 'Airtime & Data Bundles';
    }
  };

  const getSubtitle = () => {
    switch (type) {
      case 'send':
        return 'Instant MoMo transfer to any Ghanaian network or bank';
      case 'pay_bill':
        return 'Official utility bills, subscriptions & fees';
      case 'buy_goods':
        return 'Instant settlement to registered merchant tills';
      case 'cash_in':
        return 'Zero-fee wallet deposit via agent, card, or bank';
      case 'airtime':
        return 'Instant airtime recharge and high-speed internet bundles';
    }
  };

  const handleProceedToPin = () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }
    if (type === 'send' && (!receiver || receiver.trim().length < 9)) {
      setError('Please enter a valid 10-digit recipient phone number');
      return;
    }
    if (type === 'pay_bill' && !receiver.trim()) {
      setError('Please enter your account / meter number');
      return;
    }
    if (type === 'buy_goods' && !receiver.trim()) {
      setError('Please enter or select a merchant till code');
      return;
    }
    if (type === 'airtime' && (!receiver || receiver.trim().length < 9)) {
      setError('Please enter a valid phone number for recharge');
      return;
    }

    setError(null);
    setStep('pin');
  };

  const handleExecuteTransaction = async (pinOrPassword, authLayers = ['password']) => {
    setIsProcessing(true);
    setStep('processing');
    setError(null);

    const numAmount = parseFloat(amount);
    const calculatedRef = reference.trim() || (
      type === 'airtime'
        ? `${airtimeMode === 'data' ? selectedDataBundle.name : 'Airtime Top-Up'} (${selectedNetwork.toUpperCase()})`
        : type === 'cash_in'
        ? `Wallet Deposit via ${depositMethod.toUpperCase()}`
        : `${getTitle()} - Mobile Client`
    );

    const finalReceiver =
      receiver.trim() ||
      (type === 'cash_in' ? `DEP-${depositMethod.toUpperCase()}` : 'MERCH-001');

    const finalReceiverName =
      receiverName.trim() ||
      (type === 'pay_bill'
        ? selectedBiller.name
        : type === 'buy_goods'
        ? 'Merchant Store'
        : type === 'airtime'
        ? `${selectedNetwork.toUpperCase()} Top-Up`
        : undefined);

    const payload = {
      amount: numAmount,
      receiver: finalReceiver,
      receiverName: finalReceiverName,
      pin: pinOrPassword || '123456',
      password: pinOrPassword || '123456',
      reference: calculatedRef,
      recipientPhone: (type === 'send' || type === 'airtime') ? receiver.trim() : undefined,
      biller: type === 'pay_bill' ? selectedBiller.name : undefined,
      merchantCode: type === 'buy_goods' ? receiver.trim() : undefined,
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
        type: type === 'cash_in' ? 'cash_in' : type === 'pay_bill' ? 'pay_bill' : type === 'buy_goods' ? 'buy_goods' : 'send',
        amount: numAmount,
        currency: 'GHS',
        sender: 'You',
        receiver: payload.receiver || 'Recipient',
        receiverName: payload.receiverName,
        reference: payload.reference,
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

      // If flagged or under review, trigger Step-Up Biometric Authentication
      if (response.status === 'flagged' || response.status === 'under_review') {
        setStep('step_up');
      } else {
        setStep('receipt');
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Transaction could not be processed.';
      setError(msg);
      setStep('input');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSimulateStepUp = () => {
    setStepUpProgress(20);
    const interval = setInterval(() => {
      setStepUpProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setStep('receipt');
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  const handleModalClose = () => {
    setStep('input');
    setAmount('50');
    setReceiver('');
    setReceiverName('');
    setReference('');
    setError(null);
    setCompletedTx(null);
    onClose();
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
            {/* Header Handle */}
            <View style={styles.sheetHandle} />

            {/* Title Bar */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>{getTitle()}</Text>
                <Text style={styles.modalSubtitle} numberOfLines={1}>{getSubtitle()}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={handleModalClose}
                activeOpacity={0.7}
              >
                <Ionicons name="close" size={18} color={THEME.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* STEP 1: INPUT FORM */}
            {step === 'input' && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.formScroll}
              >
                {/* 1. Send Money Network Selector */}
                {type === 'send' && (
                  <>
                    <Text style={styles.inputLabel}>Select Destination Network</Text>
                    <View style={styles.networkGrid}>
                      {NETWORKS.map((net) => (
                        <TouchableOpacity
                          key={net.id}
                          style={[
                            styles.networkCard,
                            selectedNetwork === net.id && styles.networkCardActive,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => setSelectedNetwork(net.id)}
                        >
                          <Text
                            style={[
                              styles.networkName,
                              selectedNetwork === net.id && styles.networkNameActive,
                            ]}
                          >
                            {net.name}
                          </Text>
                          <Text style={styles.networkCode}>{net.code}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Quick Contacts */}
                    <Text style={styles.inputLabel}>Frequent Contacts</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickContactsScroll}>
                      {QUICK_CONTACTS.map((c) => (
                        <TouchableOpacity
                          key={c.phone}
                          style={styles.contactChip}
                          activeOpacity={0.7}
                          onPress={() => {
                            setReceiver(c.phone);
                            setReceiverName(c.name);
                            setSelectedNetwork(c.network);
                          }}
                        >
                          <View style={styles.contactAvatar}>
                            <Ionicons name="person" size={14} color={THEME.primary} />
                          </View>
                          <View>
                            <Text style={styles.contactName}>{c.name}</Text>
                            <Text style={styles.contactPhone}>{c.phone}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <Text style={styles.inputLabel}>Recipient Phone Number</Text>
                    <View style={styles.phoneInputWrap}>
                      <Text style={styles.phonePrefix}>+233</Text>
                      <TextInput
                        style={styles.phoneInput}
                        keyboardType="phone-pad"
                        placeholder="024 123 4567"
                        placeholderTextColor="#9CA3AF"
                        value={receiver}
                        onChangeText={setReceiver}
                      />
                    </View>

                    <Text style={styles.inputLabel}>Recipient Name (Optional)</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. Ama Tetteh"
                      placeholderTextColor="#9CA3AF"
                      value={receiverName}
                      onChangeText={setReceiverName}
                    />
                  </>
                )}

                {/* 2. Airtime & Data Bundles */}
                {type === 'airtime' && (
                  <>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.toggleBtn, airtimeMode === 'airtime' && styles.toggleBtnActive]}
                        onPress={() => setAirtimeMode('airtime')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="call-outline"
                          size={16}
                          color={airtimeMode === 'airtime' ? THEME.primary : THEME.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.toggleBtnText, airtimeMode === 'airtime' && styles.toggleBtnTextActive]}>
                          Airtime
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleBtn, airtimeMode === 'data' && styles.toggleBtnActive]}
                        onPress={() => setAirtimeMode('data')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="cellular-outline"
                          size={16}
                          color={airtimeMode === 'data' ? THEME.primary : THEME.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.toggleBtnText, airtimeMode === 'data' && styles.toggleBtnTextActive]}>
                          Internet Data
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.inputLabel}>Phone Number for Recharge</Text>
                    <View style={styles.phoneInputWrap}>
                      <Text style={styles.phonePrefix}>+233</Text>
                      <TextInput
                        style={styles.phoneInput}
                        keyboardType="phone-pad"
                        placeholder="024 123 4567"
                        placeholderTextColor="#9CA3AF"
                        value={receiver}
                        onChangeText={setReceiver}
                      />
                    </View>

                    {airtimeMode === 'data' && (
                      <>
                        <Text style={styles.inputLabel}>Select High-Speed Data Package</Text>
                        <View style={styles.bundleList}>
                          {DATA_BUNDLES.map((bundle) => (
                            <TouchableOpacity
                              key={bundle.id}
                              style={[
                                styles.bundleCard,
                                selectedDataBundle.id === bundle.id && styles.bundleCardActive,
                              ]}
                              activeOpacity={0.7}
                              onPress={() => {
                                setSelectedDataBundle(bundle);
                                setAmount(String(bundle.price));
                              }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.bundleName}>{bundle.name}</Text>
                                <Text style={styles.bundleData}>{bundle.data}</Text>
                              </View>
                              <Text style={styles.bundlePrice}>GH₵ {bundle.price.toFixed(2)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* 3. Pay Bills */}
                {type === 'pay_bill' && (
                  <>
                    <Text style={styles.inputLabel}>Select Utility / Service Biller</Text>
                    <View style={styles.billerGrid}>
                      {BILLERS.map((biller) => (
                        <TouchableOpacity
                          key={biller.id}
                          style={[
                            styles.billerCard,
                            selectedBiller.id === biller.id && styles.billerCardActive,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => setSelectedBiller(biller)}
                        >
                          <View style={styles.billerIconWrap}>
                            <Ionicons name={biller.icon} size={18} color={THEME.primary} />
                          </View>
                          <Text
                            style={[
                              styles.billerName,
                              selectedBiller.id === biller.id && styles.billerNameActive,
                            ]}
                          >
                            {biller.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Account / Smartcard / Meter Number</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. ECG-0421889 or Acc #102938"
                      placeholderTextColor="#9CA3AF"
                      value={receiver}
                      onChangeText={setReceiver}
                    />
                  </>
                )}

                {/* 4. Buy Goods & Merchant Payments */}
                {type === 'buy_goods' && (
                  <>
                    <Text style={styles.inputLabel}>Popular Merchant Tills</Text>
                    <View style={styles.merchantList}>
                      {POPULAR_MERCHANTS.map((m) => (
                        <TouchableOpacity
                          key={m.code}
                          style={[
                            styles.merchantCard,
                            receiver === m.code && styles.merchantCardActive,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => {
                            setReceiver(m.code);
                            setReceiverName(m.name);
                          }}
                        >
                          <View style={styles.merchantIconWrap}>
                            <MaterialCommunityIcons name="storefront-outline" size={18} color={THEME.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.merchantName}>{m.name}</Text>
                            <Text style={styles.merchantCode}>Till: {m.code} • {m.cat}</Text>
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={THEME.textMuted} />
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.inputLabel}>Or Enter Merchant Till Code</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="e.g. TILL-551122"
                      placeholderTextColor="#9CA3AF"
                      value={receiver}
                      onChangeText={setReceiver}
                    />
                  </>
                )}

                {/* 5. Cash In (Deposit) */}
                {type === 'cash_in' && (
                  <>
                    <Text style={styles.inputLabel}>Deposit Channel</Text>
                    <View style={styles.depositMethodRow}>
                      {[
                        { id: 'agent', label: 'MoMo Agent', icon: 'business-outline' },
                        { id: 'card', label: 'Debit Card', icon: 'card-outline' },
                        { id: 'bank', label: 'Bank Transfer', icon: 'wallet-outline' },
                      ].map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.depositTab,
                            depositMethod === m.id && styles.depositTabActive,
                          ]}
                          activeOpacity={0.7}
                          onPress={() => setDepositMethod(m.id)}
                        >
                          <Ionicons
                            name={m.icon}
                            size={16}
                            color={depositMethod === m.id ? THEME.primary : THEME.textSecondary}
                            style={{ marginBottom: 4 }}
                          />
                          <Text
                            style={[
                              styles.depositTabText,
                              depositMethod === m.id && styles.depositTabTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <View style={styles.depositInfoCard}>
                      <Ionicons name="information-circle-outline" size={18} color={THEME.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.depositInfoText}>
                        {depositMethod === 'agent'
                          ? 'Zero-fee instant deposit credited by any authorized Ghana MoMo Agent.'
                          : depositMethod === 'card'
                          ? 'Instant top-up via Visa, Mastercard, or Gh-Link card.'
                          : 'Direct instant ACH / GhIPSS settlement from any Ghanaian commercial bank.'}
                      </Text>
                    </View>
                  </>
                )}

                {/* Amount Input & Presets */}
                <Text style={styles.inputLabel}>Amount (GH₵)</Text>
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

                {/* Preset Chips */}
                <View style={styles.presetChipsRow}>
                  {PRESET_AMOUNTS.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[
                        styles.presetChip,
                        amount === String(val) && styles.presetChipActive,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => setAmount(String(val))}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          amount === String(val) && styles.presetChipTextActive,
                        ]}
                      >
                        +{val}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Reference / Memo */}
                <Text style={styles.inputLabel}>Reference / Purpose</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Optional reference memo"
                  placeholderTextColor="#9CA3AF"
                  value={reference}
                  onChangeText={setReference}
                />

                {/* Fee & E-Levy Summary */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Transaction Fee:</Text>
                    <Text style={[styles.summaryVal, { color: THEME.success }]}>GH₵ 0.00 (Promo)</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Ghana E-Levy:</Text>
                    <Text style={[styles.summaryVal, { color: THEME.success }]}>Exempt (Under GH₵ 100)</Text>
                  </View>
                </View>

                {/* Error Banner */}
                {error && <Text style={styles.formErrorText}>{error}</Text>}

                {/* Submit Action */}
                <TouchableOpacity
                  style={[styles.primaryBtn, SHADOWS.crimsonGlow]}
                  activeOpacity={0.8}
                  onPress={handleProceedToPin}
                >
                  <Text style={styles.primaryBtnText}>
                    Continue (GH₵ {parseFloat(amount) ? parseFloat(amount).toFixed(2) : '0.00'})
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* STEP 2: PASSWORD PAD */}
            {step === 'pin' && (
              <PinPad
                length={6}
                title="Enter MoMo Password"
                subtitle={`Authorize ${getTitle()} of GH₵ ${parseFloat(amount) ? parseFloat(amount).toFixed(2) : '0.00'}`}
                hasBiometrics={hasBiometrics}
                onBiometricPress={() => handleExecuteTransaction('123456', ['biometric'])}
                onComplete={(password) => handleExecuteTransaction(password, ['password'])}
                onCancel={() => setStep('input')}
              />
            )}

            {/* STEP 3: STEP-UP BIOMETRIC AUTHENTICATION */}
            {step === 'step_up' && (
              <View style={styles.stepUpWrap}>
                <View style={styles.stepUpBadge}>
                  <Ionicons name="shield-outline" size={14} color="#B45309" style={{ marginRight: 6 }} />
                  <Text style={styles.stepUpBadgeText}>AI DEFENSE STEP-UP REQUIRED</Text>
                </View>
                <Text style={styles.stepUpTitle}>High Risk Signal Detected</Text>
                <Text style={styles.stepUpSubtitle}>
                  Our AI defense system detected an atypical transaction pattern. Please complete biometric verification to proceed.
                </Text>

                {stepUpProgress > 0 ? (
                  <View style={styles.stepUpProgressBox}>
                    <ActivityIndicator size="large" color={THEME.primary} />
                    <Text style={styles.stepUpProgressText}>
                      Verifying Face & Fingerprint Token ({stepUpProgress}%)...
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={[styles.primaryBtn, { width: '100%' }]}
                    activeOpacity={0.8}
                    onPress={handleSimulateStepUp}
                  >
                    <Ionicons name="finger-print" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>Authorize with Biometrics</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* PROCESSING */}
            {step === 'processing' && (
              <View style={styles.processingWrap}>
                <ActivityIndicator size="large" color={THEME.primary} />
                <Text style={styles.processingTitle}>Processing Transaction...</Text>
                <Text style={styles.processingSubtitle}>
                  Running ATOD fraud score analysis and telemetry checks
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
    marginBottom: 14,
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
  presetChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 6,
  },
  presetChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetChipActive: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
  },
  presetChipText: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  presetChipTextActive: {
    color: THEME.primary,
  },
  networkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 6,
  },
  networkCard: {
    width: '48%',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  networkCardActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  networkName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  networkNameActive: {
    color: THEME.primary,
  },
  networkCode: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  quickContactsScroll: {
    marginBottom: 8,
  },
  contactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  contactAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: THEME.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactName: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
    color: THEME.text,
  },
  contactPhone: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: THEME.textSecondary,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
  },
  phonePrefix: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: THEME.text,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    height: 48,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: THEME.text,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 4,
    marginBottom: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.card,
  },
  toggleBtnText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  toggleBtnTextActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '700',
  },
  bundleList: {
    gap: 8,
    marginBottom: 8,
  },
  bundleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  bundleCardActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  bundleName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  bundleData: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  bundlePrice: {
    fontFamily: FONTS.black,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
  },
  billerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  billerCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  billerCardActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  billerIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  billerName: {
    flex: 1,
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text,
  },
  billerNameActive: {
    color: THEME.primary,
  },
  merchantList: {
    gap: 8,
    marginBottom: 8,
  },
  merchantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  merchantCardActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  merchantIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  merchantCode: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  depositMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  depositTab: {
    flex: 1,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  depositTabActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: THEME.primary,
  },
  depositTabText: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  depositTabTextActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '700',
  },
  depositInfoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginBottom: 8,
  },
  depositInfoText: {
    flex: 1,
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#166534',
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: '#64748B',
  },
  summaryVal: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '700',
  },
  formErrorText: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'center',
  },
  primaryBtn: {
    flexDirection: 'row',
    backgroundColor: THEME.primary,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  primaryBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stepUpWrap: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  stepUpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  stepUpBadgeText: {
    fontFamily: FONTS.bold,
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
  },
  stepUpTitle: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 6,
  },
  stepUpSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 20,
    lineHeight: 18,
  },
  stepUpProgressBox: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  stepUpProgressText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.primary,
    fontWeight: '700',
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
