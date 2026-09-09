import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME, FONTS } from '../theme';

export function StatusBadge({ status, size = 'sm' }) {
  const getBadgeStyle = () => {
    switch (status) {
      case 'completed':
        return {
          container: styles.completedBg,
          text: styles.completedText,
          label: 'Completed',
          iconName: 'checkmark-circle',
          iconColor: '#16A34A',
        };
      case 'flagged':
        return {
          container: styles.flaggedBg,
          text: styles.flaggedText,
          label: 'Flagged',
          iconName: 'alert-circle',
          iconColor: THEME.primary,
        };
      case 'under_review':
        return {
          container: styles.reviewBg,
          text: styles.reviewText,
          label: 'Under Review',
          iconName: 'time',
          iconColor: '#B45309',
        };
      case 'blocked':
        return {
          container: styles.blockedBg,
          text: styles.blockedText,
          label: 'Blocked',
          iconName: 'ban',
          iconColor: '#FFFFFF',
        };
      case 'pending':
      default:
        return {
          container: styles.pendingBg,
          text: styles.pendingText,
          label: 'Pending',
          iconName: 'hourglass-outline',
          iconColor: '#6B7280',
        };
    }
  };

  const badge = getBadgeStyle();
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <View
      style={[
        styles.baseBadge,
        size === 'sm' ? styles.smBadge : styles.mdBadge,
        badge.container,
      ]}
    >
      <Ionicons name={badge.iconName} size={iconSize} color={badge.iconColor} style={{ marginRight: 4 }} />
      <Text
        style={[
          styles.baseText,
          size === 'sm' ? styles.smText : styles.mdText,
          badge.text,
        ]}
      >
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  baseBadge: {
    flexDirection: 'row',
    borderRadius: 9999,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  mdBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  baseText: {
    fontFamily: FONTS.bold,
    fontWeight: '700',
  },
  smText: {
    fontSize: 11,
  },
  mdText: {
    fontSize: 13,
  },
  completedBg: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  completedText: {
    color: '#166534',
  },
  flaggedBg: {
    backgroundColor: THEME.primaryLight,
    borderWidth: 1,
    borderColor: THEME.primaryBorder,
  },
  flaggedText: {
    color: THEME.primary,
  },
  reviewBg: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reviewText: {
    color: '#B45309',
  },
  blockedBg: {
    backgroundColor: THEME.primary,
  },
  blockedText: {
    color: '#FFFFFF',
  },
  pendingBg: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pendingText: {
    color: '#6B7280',
  },
});
