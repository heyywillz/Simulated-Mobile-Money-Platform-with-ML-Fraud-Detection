import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Modal,
  TextInput,
  Share,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';
import { formatCurrency } from '@momo/shared';

export function QrCodeModal({
  visible,
  user,
  onClose,
  onScanResult,
}) {
  const [tab, setTab] = useState('my_qr');
  const [amount, setAmount] = useState('');

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Pay ${user?.fullName || 'me'} with Swipe Pay MoMo (${user?.phoneNumber || '0241234567'})${amount ? ` for ${formatCurrency(parseFloat(amount))}` : ''}`,
      });
    } catch {}
  };

  const handleQuickScan = (target) => {
    onScanResult({
      phoneNumber: target.phone,
      name: target.name,
      amount: target.amount,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, SHADOWS.cardElevated]}>
          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'my_qr' && styles.tabActive]}
              onPress={() => setTab('my_qr')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="qr-code-outline"
                size={16}
                color={tab === 'my_qr' ? THEME.primary : THEME.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'my_qr' && styles.tabTextActive]}>
                My QR Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'scan' && styles.tabActive]}
              onPress={() => setTab('scan')}
              activeOpacity={0.8}
            >
              <Ionicons
                name="scan-outline"
                size={16}
                color={tab === 'scan' ? THEME.primary : THEME.textSecondary}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabText, tab === 'scan' && styles.tabTextActive]}>
                Scan & Pay
              </Text>
            </TouchableOpacity>
          </View>

          {tab === 'my_qr' ? (
            <View style={styles.body}>
              <View style={styles.qrFrame}>
                {/* SVG/Pixel Simulation QR Matrix */}
                <View style={styles.qrGrid}>
                  <View style={styles.qrCornerTL} />
                  <View style={styles.qrCornerTR} />
                  <View style={styles.qrCornerBL} />
                  <View style={styles.qrCenterIcon}>
                    <Text style={styles.qrCenterText}>SP</Text>
                  </View>
                  <Text style={styles.qrMatrixPattern}>
                    █████▒▒█████▒▒█████{'\n'}
                    ██▒▒█▒▒██▒▒█▒▒██▒▒█{'\n'}
                    █████▒▒█████▒▒█████{'\n'}
                    ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒{'\n'}
                    ██▒▒██▒▒██▒▒██▒▒██▒{'\n'}
                    ▒▒██▒▒██▒▒██▒▒██▒▒█{'\n'}
                    █████▒▒▒▒▒▒▒▒▒█████{'\n'}
                    ██▒▒█▒▒████▒▒▒██▒▒█{'\n'}
                    █████▒▒████▒▒▒█████
                  </Text>
                </View>
              </View>

              <Text style={styles.qrName}>{user?.fullName || 'Swipe Pay User'}</Text>
              <Text style={styles.qrPhone}>{user?.phoneNumber || '0241234567'}</Text>

              {/* Amount Input */}
              <View style={styles.amountInputWrap}>
                <Text style={styles.amountPrefix}>GH₵</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="Set Request Amount (Optional)"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                />
              </View>

              {/* Share & Copy Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: THEME.primary }, SHADOWS.crimsonGlow]}
                  onPress={handleShare}
                  activeOpacity={0.85}
                >
                  <Ionicons name="share-social-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.actionBtnText}>Share QR Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.body}>
              <View style={styles.scannerFrame}>
                <View style={styles.scannerLaser} />
                <Ionicons name="scan-outline" size={48} color="rgba(255,255,255,0.4)" style={{ marginBottom: 8 }} />
                <Text style={styles.scannerHint}>Align Merchant or User QR code within frame</Text>
              </View>

              {/* Demo Scan Targets */}
              <Text style={styles.demoSectionTitle}>Tap to Simulate Live QR Scan:</Text>
              <View style={styles.quickList}>
                <TouchableOpacity
                  style={styles.quickItem}
                  onPress={() => handleQuickScan({ name: 'ShopRite Accra Mall', phone: '0249887766', amount: 150 })}
                  activeOpacity={0.8}
                >
                  <View style={styles.quickIconWrap}>
                    <MaterialCommunityIcons name="cart-outline" size={20} color={THEME.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickName}>ShopRite Accra Mall</Text>
                    <Text style={styles.quickSub}>Merchant Till #98877 • GH₵ 150.00</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={THEME.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickItem}
                  onPress={() => handleQuickScan({ name: 'Kofi Mensah (Personal)', phone: '0241234567' })}
                  activeOpacity={0.8}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons name="person-outline" size={20} color={THEME.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickName}>Kofi Mensah</Text>
                    <Text style={styles.quickSub}>0241234567 (Peer-to-Peer)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={THEME.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.quickItem}
                  onPress={() => handleQuickScan({ name: 'ECG Prepaid Meter 0421', phone: '0302112233', amount: 80 })}
                  activeOpacity={0.8}
                >
                  <View style={styles.quickIconWrap}>
                    <Ionicons name="flash-outline" size={20} color={THEME.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.quickName}>ECG Prepaid Bill</Text>
                    <Text style={styles.quickSub}>Meter #0421889 • GH₵ 80.00</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={THEME.primary} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Close */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 22,
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 14,
    padding: 4,
    width: '100%',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.card,
  },
  tabText: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  tabTextActive: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '800',
  },
  body: {
    width: '100%',
    alignItems: 'center',
  },
  qrFrame: {
    width: 200,
    height: 200,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...SHADOWS.card,
  },
  qrGrid: {
    width: 170,
    height: 170,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  qrCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 36,
    height: 36,
    borderWidth: 5,
    borderColor: THEME.primary,
    borderRadius: 8,
  },
  qrCornerTR: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 36,
    height: 36,
    borderWidth: 5,
    borderColor: THEME.primary,
    borderRadius: 8,
  },
  qrCornerBL: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 36,
    height: 36,
    borderWidth: 5,
    borderColor: THEME.primary,
    borderRadius: 8,
  },
  qrCenterIcon: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  qrCenterText: {
    fontFamily: FONTS.black,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  qrMatrixPattern: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 10,
    lineHeight: 14,
    color: '#1F2937',
    textAlign: 'center',
    letterSpacing: 2,
  },
  qrName: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '900',
    color: THEME.text,
    marginTop: 4,
  },
  qrPhone: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: 14,
  },
  amountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.borderLight,
    paddingHorizontal: 14,
    height: 48,
    width: '100%',
    marginBottom: 14,
  },
  amountPrefix: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '800',
    color: THEME.primary,
    marginRight: 6,
  },
  amountInput: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 13,
    color: THEME.text,
    fontWeight: '600',
  },
  btnRow: {
    width: '100%',
  },
  actionBtn: {
    height: 48,
    flexDirection: 'row',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontFamily: FONTS.bold,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  scannerFrame: {
    width: '100%',
    height: 140,
    backgroundColor: '#111827',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 14,
  },
  scannerLaser: {
    position: 'absolute',
    top: '50%',
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: THEME.primary,
  },
  scannerHint: {
    fontFamily: FONTS.medium,
    color: '#9CA3AF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  demoSectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textMuted,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  quickList: {
    width: '100%',
    gap: 8,
  },
  quickItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  quickIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: THEME.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickName: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
  },
  quickSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  closeBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textMuted,
  },
});
