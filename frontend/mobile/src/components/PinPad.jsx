import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, FONTS, SHADOWS } from '../theme';

export function PinPad({
  length = 6,
  onComplete,
  onBiometricPress,
  hasBiometrics = false,
  title = 'Enter MoMo Password',
  subtitle = 'Authorize transaction with your 6-digit password',
  error,
  onCancel,
}) {
  const [pin, setPin] = useState('');

  const handleDigit = (digit) => {
    if (pin.length < length) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === length) {
        onComplete(nextPin);
      }
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* PIN Dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                filled ? styles.dotFilled : styles.dotEmpty,
                error ? styles.dotError : null,
              ]}
            />
          );
        })}
      </View>

      {/* Error Message */}
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <View style={styles.errorSpacer} />
      )}

      {/* Keypad Grid */}
      <View style={styles.keypad}>
        {[
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
        ].map((row, rIdx) => (
          <View key={rIdx} style={styles.row}>
            {row.map((digit) => (
              <TouchableOpacity
                key={digit}
                style={[styles.key, SHADOWS.card]}
                activeOpacity={0.7}
                onPress={() => handleDigit(digit)}
              >
                <Text style={styles.keyText}>{digit}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {/* Bottom Row */}
        <View style={styles.row}>
          {hasBiometrics && onBiometricPress ? (
            <TouchableOpacity
              style={[styles.key, styles.specialKey]}
              activeOpacity={0.7}
              onPress={onBiometricPress}
            >
              <Ionicons name="finger-print-outline" size={20} color={THEME.primary} style={{ marginBottom: 2 }} />
              <Text style={styles.specialKeyText}>Biometric</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.key, styles.specialKey]}
              activeOpacity={0.7}
              onPress={handleClear}
            >
              <Ionicons name="trash-outline" size={18} color={THEME.textSecondary} style={{ marginBottom: 2 }} />
              <Text style={styles.specialKeyText}>Clear</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.key, SHADOWS.card]}
            activeOpacity={0.7}
            onPress={() => handleDigit('0')}
          >
            <Text style={styles.keyText}>0</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.key, styles.specialKey]}
            activeOpacity={0.7}
            onPress={handleBackspace}
          >
            <Ionicons name="backspace-outline" size={24} color={THEME.text} />
          </TouchableOpacity>
        </View>
      </View>

      {onCancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          activeOpacity={0.7}
          onPress={onCancel}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.bold,
    fontSize: 18,
    fontWeight: '800',
    color: THEME.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    fontSize: 13,
    color: THEME.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 14,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotEmpty: {
    backgroundColor: '#E5E7EB',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  dotFilled: {
    backgroundColor: THEME.primary,
    borderColor: THEME.primary,
  },
  dotError: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  errorText: {
    fontFamily: FONTS.medium,
    color: THEME.primary,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  errorSpacer: {
    height: 20,
  },
  keypad: {
    width: '100%',
    maxWidth: 320,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  key: {
    flex: 1,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: THEME.borderLight,
  },
  keyText: {
    fontFamily: FONTS.bold,
    fontSize: 22,
    fontWeight: '700',
    color: THEME.text,
  },
  specialKey: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  specialKeyText: {
    fontFamily: FONTS.bold,
    fontSize: 10,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  cancelButton: {
    marginTop: 18,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  cancelText: {
    fontFamily: FONTS.bold,
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
});
