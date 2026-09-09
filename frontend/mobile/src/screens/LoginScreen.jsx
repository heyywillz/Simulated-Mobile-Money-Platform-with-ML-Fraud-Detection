/**
 * LoginScreen — Multi-factor authentication interface for Swipe Pay Mobile:
 *   - Account Email
 *   - Ghana Card Number
 *   - Secret Password
 *   - Biometric Key Selection: Facial Liveness Scan OR Fingerprint Sensor
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';

export function LoginScreen({
  onLogin,
  onBiometricLogin,
  hasBiometrics,
  onSwitchToSignup,
  isLoading,
  error,
}) {
  const [email, setEmail] = useState('');
  const [ghanaCard, setGhanaCard] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [biometricType, setBiometricType] = useState('facial');
  const [localError, setLocalError] = useState(null);

  const displayError = localError || error;

  const handleQuickDemoFill = () => {
    setEmail('aninakwa3144@gmail.com');
    setGhanaCard('GHA-334444444-3');
    setPassword('@mista223');
    setLocalError(null);
  };

  const handleSubmit = async () => {
    setLocalError(null);

    if (!email.trim()) {
      setLocalError('Please enter your account email');
      return;
    }
    if (!ghanaCard.trim()) {
      setLocalError('Please enter your Ghana Card ID (e.g. GHA-334444444-3)');
      return;
    }
    if (!password) {
      setLocalError('Please enter your account password');
      return;
    }

    const res = await onLogin({
      email: email.trim(),
      ghanaCard: ghanaCard.trim(),
      password,
      biometricType,
    });

    if (!res?.success) {
      setLocalError(res?.error || 'Authentication failed. Check your credentials.');
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F7" />
      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Brand Header */}
        <View style={s.brandHeader}>
          <Image
            source={require('../../assets/swipe-pay-red-logo.png')}
            style={s.brandLogoImage}
          />
          <Text style={s.brandTitle}>Swipe Pay</Text>
          <Text style={s.brandSubtitle}>
            AI-Protected Mobile Money Platform
          </Text>
        </View>

        {/* Demo Autofill Banner */}
        <View style={s.demoBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="flash-outline" size={13} color={THEME.primary} style={{ marginRight: 4 }} />
              <Text style={s.demoLabel}>Demo Account Credentials</Text>
            </View>
            <TouchableOpacity onPress={handleQuickDemoFill} style={s.demoFillBtn} activeOpacity={0.7}>
              <Text style={s.demoFillBtnText}>Auto-Fill</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.demoSubText}>aninakwa3144@gmail.com • GHA-334444444-3</Text>
        </View>

        {/* Main Card */}
        <View style={[s.card, SHADOWS.cardElevated]}>
          <View style={s.cardHeader}>
            <View style={s.cardHeaderIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={20} color={THEME.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Sign In to Wallet</Text>
              <Text style={s.cardSubtitle}>
                Enter account credentials and choose your biometric key
              </Text>
            </View>
          </View>

          {/* Email Input */}
          <Text style={s.fieldLabel}>ACCOUNT EMAIL</Text>
          <View style={s.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={s.inputIcon} />
            <TextInput
              style={s.textInput}
              placeholder="e.g. name@momo.gh or gmail.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={(v) => { setEmail(v); setLocalError(null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Ghana Card Number */}
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>GHANA CARD NUMBER</Text>
          <View style={s.inputWrap}>
            <Ionicons name="card-outline" size={18} color="#9CA3AF" style={s.inputIcon} />
            <TextInput
              style={[s.textInput, { fontFamily: FONTS.bold }]}
              placeholder="GHA-334444444-3"
              placeholderTextColor="#9CA3AF"
              value={ghanaCard}
              onChangeText={(v) => { setGhanaCard(v); setLocalError(null); }}
              autoCapitalize="characters"
              autoCorrect={false}
            />
          </View>

          {/* Password */}
          <Text style={[s.fieldLabel, { marginTop: 14 }]}>ACCOUNT PASSWORD</Text>
          <View style={s.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={s.inputIcon} />
            <TextInput
              style={s.textInput}
              placeholder="Enter your secret password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={(v) => { setPassword(v); setLocalError(null); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 8 }}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Choose Biometric Verification */}
          <Text style={[s.fieldLabel, { marginTop: 16 }]}>CHOOSE BIOMETRIC VERIFICATION</Text>
          <View style={s.bioGrid}>
            <TouchableOpacity
              style={[
                s.bioOptionCard,
                biometricType === 'facial' && s.bioOptionCardActive,
              ]}
              onPress={() => setBiometricType('facial')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  s.bioIconWrap,
                  biometricType === 'facial' && s.bioIconWrapActive,
                ]}
              >
                <Ionicons
                  name="scan-outline"
                  size={20}
                  color={biometricType === 'facial' ? '#FFFFFF' : '#6B7280'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.bioOptionTitle,
                    biometricType === 'facial' && s.bioOptionTitleActive,
                  ]}
                >
                  Facial Scan
                </Text>
                <Text style={s.bioOptionSub}>Live Face ID</Text>
              </View>
              {biometricType === 'facial' && (
                <Ionicons name="checkmark-circle" size={18} color={THEME.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                s.bioOptionCard,
                biometricType === 'fingerprint' && s.bioOptionCardActive,
              ]}
              onPress={() => setBiometricType('fingerprint')}
              activeOpacity={0.7}
            >
              <View
                style={[
                  s.bioIconWrap,
                  biometricType === 'fingerprint' && s.bioIconWrapActive,
                ]}
              >
                <Ionicons
                  name="finger-print-outline"
                  size={20}
                  color={biometricType === 'fingerprint' ? '#FFFFFF' : '#6B7280'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    s.bioOptionTitle,
                    biometricType === 'fingerprint' && s.bioOptionTitleActive,
                  ]}
                >
                  Fingerprint
                </Text>
                <Text style={s.bioOptionSub}>Touch Sensor</Text>
              </View>
              {biometricType === 'fingerprint' && (
                <Ionicons name="checkmark-circle" size={18} color={THEME.primary} />
              )}
            </TouchableOpacity>
          </View>

          {/* Error Banner */}
          {displayError && (
            <View style={s.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color={THEME.primary} style={{ marginRight: 6 }} />
              <Text style={s.errorText}>{displayError}</Text>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[s.submitBtn, SHADOWS.crimsonGlow, isLoading && s.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={s.submitBtnText}>
                  Proceed to {biometricType === 'facial' ? 'Face Scan' : 'Fingerprint'}
                </Text>
                <Ionicons name="arrow-forward" size={16} color="#FFFFFF" style={{ marginLeft: 6 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Switch to Signup */}
        <TouchableOpacity style={s.switchLink} onPress={onSwitchToSignup} activeOpacity={0.7}>
          <Text style={s.switchLinkText}>
            Don't have an account? <Text style={s.switchLinkBold}>Create Wallet</Text>
          </Text>
        </TouchableOpacity>

        {/* Security Badge */}
        <View style={s.securityBadge}>
          <Ionicons name="shield-checkmark-outline" size={14} color={THEME.textMuted} style={{ marginBottom: 4 }} />
          <Text style={s.securityBadgeText}>
            Protected by AI Account Takeover Defense & Ghana Banking Security Standards
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 0,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  // Brand
  brandHeader: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  brandLogoImage: {
    width: 60,
    height: 60,
    resizeMode: 'contain',
    marginBottom: 10,
  },
  brandTitle: {
    fontFamily: FONTS.black,
    fontSize: 24,
    fontWeight: '900',
    color: THEME.text,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 12,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },

  // Demo Box
  demoBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  demoLabel: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    fontWeight: '700',
    color: THEME.text,
  },
  demoSubText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
  },
  demoFillBtn: {
    backgroundColor: THEME.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  demoFillBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardHeaderIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTitle: {
    fontFamily: FONTS.bold,
    fontSize: 16,
    fontWeight: '800',
    color: THEME.text,
  },
  cardSubtitle: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },

  fieldLabel: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '700',
    color: '#374151',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    height: 46,
    fontFamily: FONTS.medium,
    fontSize: 14,
    color: THEME.text,
  },

  // Biometric selector
  bioGrid: {
    gap: 8,
    marginTop: 4,
  },
  bioOptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  bioOptionCardActive: {
    borderColor: THEME.primary,
    backgroundColor: '#FEF2F2',
  },
  bioIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  bioIconWrapActive: {
    backgroundColor: THEME.primary,
  },
  bioOptionTitle: {
    fontFamily: FONTS.bold,
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  bioOptionTitleActive: {
    color: THEME.primary,
  },
  bioOptionSub: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
  },

  // Submit button
  submitBtn: {
    height: 48,
    backgroundColor: THEME.primary,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Error Box
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
  },
  errorText: {
    flex: 1,
    fontFamily: FONTS.medium,
    fontSize: 12,
    color: THEME.primary,
  },

  // Switch Link
  switchLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  switchLinkText: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textMuted,
  },
  switchLinkBold: {
    fontFamily: FONTS.bold,
    color: THEME.primary,
    fontWeight: '700',
  },

  // Security Badge
  securityBadge: {
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
  },
  securityBadgeText: {
    fontFamily: FONTS.regular,
    fontSize: 11,
    color: THEME.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
});
