import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Share,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';
import { StatusBadge } from './StatusBadge';
import { formatCurrency, TRANSACTION_TYPE_LABELS } from '@momo/shared';

export function DigitalReceipt({ transaction, onClose }) {
  const formattedAmount = formatCurrency(transaction.amount, transaction.currency || 'GHS');
  const typeLabel = TRANSACTION_TYPE_LABELS[transaction.type] || transaction.type;
  const isDeduction = ['send', 'cash_out', 'pay_bill', 'buy_goods'].includes(transaction.type);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Swipe Pay MoMo Transaction Receipt\n\nRef: ${transaction.id}\nType: ${typeLabel}\nAmount: ${formattedAmount}\nStatus: ${transaction.status.toUpperCase()}\nDate: ${new Date(transaction.createdAt).toLocaleString()}\nRecipient: ${transaction.receiverName || transaction.receiver}`,
      });
    } catch {
      // Ignored
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={[styles.receiptCard, SHADOWS.cardElevated]}>
        {/* Header Tear Edge Simulation */}
        <View style={styles.tearEdge}>
          {Array.from({ length: 14 }).map((_, idx) => (
            <View key={idx} style={styles.tearTriangle} />
          ))}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand & Security Header */}
          <View style={styles.brandHeader}>
            <Image
              source={require('../../assets/swipe-pay-red-logo.png')}
              style={styles.logoBadgeImage}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.brandTitle}>Swipe Pay MoMo</Text>
              <Text style={styles.brandSubtitle}>Official Digital Transaction Receipt</Text>
            </View>
            <View style={styles.verifiedShield}>
              <Ionicons name="shield-checkmark" size={18} color={THEME.success} />
            </View>
          </View>

          {/* Amount Display */}
          <View style={styles.amountBox}>
            <Text style={styles.amountLabel}>Total Transacted</Text>
            <Text
              style={[
                styles.amountValue,
                isDeduction ? styles.deductionText : styles.creditText,
              ]}
            >
              {isDeduction ? '-' : '+'} {formattedAmount}
            </Text>
            <View style={styles.statusBadgeWrap}>
              <StatusBadge status={transaction.status} size="md" />
            </View>
          </View>

          {/* Security Alert Banner (If not completed) */}
          {transaction.status !== 'completed' && transaction.reason && (
            <View
              style={[
                styles.alertBanner,
                transaction.status === 'blocked'
                  ? styles.alertBlocked
                  : styles.alertFlagged,
              ]}
            >
              <Ionicons
                name={transaction.status === 'blocked' ? 'shield-outline' : 'alert-circle-outline'}
                size={22}
                color={transaction.status === 'blocked' ? THEME.primary : '#D97706'}
              />
              <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>
                  {transaction.status === 'blocked'
                    ? 'Security Block Enforced'
                    : 'Queued for AI Defense Review'}
                </Text>
                <Text style={styles.alertDescription}>
                  {transaction.reason}
                </Text>
              </View>
            </View>
          )}

          {/* Transaction Metadata Breakdown */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>TRANSACTION DETAILS</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Reference ID</Text>
            <Text style={styles.detailValueBold} numberOfLines={1}>
              {transaction.id}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Transaction Type</Text>
            <Text style={styles.detailValue}>{typeLabel}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Sender</Text>
            <Text style={styles.detailValue}>{transaction.sender}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Recipient / Biller</Text>
            <Text style={styles.detailValueBold}>
              {transaction.receiverName
                ? `${transaction.receiverName} (${transaction.receiver})`
                : transaction.receiver}
            </Text>
          </View>

          {transaction.reference && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reference Note</Text>
              <Text style={styles.detailValue}>{transaction.reference}</Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Timestamp</Text>
            <Text style={styles.detailValue}>
              {new Date(transaction.createdAt).toLocaleString('en-GB', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Ghana E-Levy</Text>
            <Text style={[styles.detailValue, { color: THEME.success }]}>Exempt (Under GHS 100)</Text>
          </View>

          {/* AI Security & Audit Telemetry */}
          <View style={styles.sectionDivider}>
            <Text style={styles.sectionTitle}>SECURITY & GEOLOCATION TELEMETRY</Text>
          </View>

          <View style={styles.telemetryCard}>
            <View style={styles.telemetryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="location-outline" size={14} color="#64748B" />
                <Text style={styles.telemetryLabel}>GPS Coordinates:</Text>
              </View>
              <Text style={styles.telemetryValue}>
                {transaction.location?.city || 'Sunyani'},{' '}
                {transaction.location?.region || 'Bono Region'},{' '}
                {transaction.location?.country || 'Ghana'}
              </Text>
            </View>
            <View style={styles.telemetryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="phone-portrait-outline" size={14} color="#64748B" />
                <Text style={styles.telemetryLabel}>Device Platform:</Text>
              </View>
              <Text style={styles.telemetryValue}>
                {transaction.deviceProfile?.platform === 'web'
                  ? 'Web Client (Browser)'
                  : 'Native Mobile App (Client)'}
              </Text>
            </View>
            <View style={styles.telemetryRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Ionicons name="lock-closed-outline" size={14} color="#64748B" />
                <Text style={styles.telemetryLabel}>Auth Verification:</Text>
              </View>
              <Text style={styles.telemetryValue}>
                {transaction.authLayersPassed?.join(' + ').toUpperCase() ||
                  'PASSWORD AUTHENTICATED'}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.shareBtn]}
            activeOpacity={0.8}
            onPress={handleShare}
          >
            <Ionicons name="share-social-outline" size={18} color={THEME.text} style={{ marginRight: 6 }} />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.doneBtn]}
            activeOpacity={0.8}
            onPress={onClose}
          >
            <Ionicons name="checkmark-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  receiptCard: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tearEdge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: THEME.primary,
    height: 10,
    overflow: 'hidden',
  },
  tearTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderTopWidth: 10,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FFFFFF',
  },
  scrollContent: {
    padding: 20,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  logoBadgeImage: {
    width: 42,
    height: 42,
    resizeMode: 'contain',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedShield: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: THEME.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
  },
  brandSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textMuted,
  },
  amountBox: {
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    marginBottom: 16,
  },
  amountLabel: {
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: THEME.textSecondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  amountValue: {
    fontFamily: FONTS.black,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  deductionText: {
    color: THEME.text,
  },
  creditText: {
    color: THEME.success,
  },
  statusBadgeWrap: {
    marginTop: 8,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginBottom: 16,
  },
  alertFlagged: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  alertBlocked: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  alertDescription: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  sectionDivider: {
    marginTop: 8,
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '800',
    color: THEME.textMuted,
    letterSpacing: 0.8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  detailLabel: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
  },
  detailValue: {
    fontFamily: FONTS.medium,
    fontSize: 13,
    fontWeight: '600',
    color: THEME.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  detailValueBold: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  telemetryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    fontFamily: FONTS.medium,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  telemetryValue: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    maxWidth: '65%',
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: THEME.border,
  },
  shareBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.text,
  },
  doneBtn: {
    backgroundColor: THEME.primary,
  },
  doneBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
