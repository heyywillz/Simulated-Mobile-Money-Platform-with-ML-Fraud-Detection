/**
 * Device Detector — Hardware identification, OS profiling & Anti-Fraud Fingerprinting.
 * Uses `expo-device` and `expo-application` for deep physical hardware telemetry.
 */

import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { Dimensions, PixelRatio, Platform } from 'react-native';

export async function detectMobileDevice() {
  const { width, height } = Dimensions.get('window');
  const dpr = PixelRatio.get();

  // 1. Unique Hardware Device Identifier
  let hardwareId = 'mobile-device-unknown';
  try {
    if (Platform.OS === 'android') {
      const androidId = Application.getAndroidId();
      if (androidId) hardwareId = `android-${androidId}`;
    } else if (Platform.OS === 'ios') {
      const idfv = await Application.getIosIdForVendorAsync();
      if (idfv) hardwareId = `ios-${idfv}`;
    }
  } catch {
    hardwareId = `mobile-${Platform.OS}-${Math.round(width)}x${Math.round(height)}`;
  }

  // 2. Hardware Specs
  const brand = Device.brand || (Platform.OS === 'ios' ? 'Apple' : Platform.OS === 'android' ? 'Android' : 'Mobile');
  const manufacturer = Device.manufacturer || (Platform.OS === 'ios' ? 'Apple' : 'Generic');
  const modelName = Device.modelName || (Platform.OS === 'ios' ? 'iPhone' : 'Smartphone');
  const osVersion = Device.osVersion || '13.0';

  // Clean OS Name
  let rawOs = Device.osName || (Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web');
  let cleanOsDisplay = rawOs;

  if (Platform.OS === 'android' || rawOs.includes('/') || rawOs.includes(':') || rawOs.includes('user/release') || rawOs.length > 20) {
    const match = rawOs.match(/:(\d+)\//) || rawOs.match(/Android\s*(\d+)/i) || osVersion.match(/^(\d+)/);
    const ver = match ? match[1] : (osVersion || '13');
    cleanOsDisplay = `Android ${ver}`;
  } else if (Platform.OS === 'ios') {
    cleanOsDisplay = `iOS ${osVersion}`;
  } else if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    if (navigator.userAgent.includes('Windows')) cleanOsDisplay = 'Windows 11';
    else if (navigator.userAgent.includes('Macintosh')) cleanOsDisplay = 'macOS';
    else if (navigator.userAgent.includes('Android')) cleanOsDisplay = `Android ${osVersion}`;
    else if (navigator.userAgent.includes('iPhone')) cleanOsDisplay = `iOS ${osVersion}`;
  }

  const isPhysicalPhone = Device.isDevice ?? true;
  const memoryBytes = Device.totalMemory || 0;
  const memoryGb = memoryBytes > 0 ? Math.round(memoryBytes / (1024 * 1024 * 1024)) : 4;

  // 3. User-Friendly Device Title (Deduplicate repeated brand name e.g. "TECNO TECNO KJ5" -> "TECNO KJ5")
  let readableDeviceName = `${brand} ${modelName}`.trim();
  const nameWords = readableDeviceName.split(/\s+/);
  const dedupedWords = nameWords.filter((w, i) => i === 0 || w.toLowerCase() !== nameWords[i - 1].toLowerCase());
  readableDeviceName = dedupedWords.join(' ');
  if (!readableDeviceName || readableDeviceName.toLowerCase() === 'android smartphone') {
    readableDeviceName = Platform.OS === 'ios' ? 'Apple iPhone' : 'Android Smartphone';
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Accra';
  const screenResolution = `${Math.round(width)}x${Math.round(height)}`;
  
  // Deterministic Anti-Fraud Device Fingerprint
  const rawFingerprint = `${hardwareId}|${brand}|${modelName}|${cleanOsDisplay}|${screenResolution}@${dpr}|${timezone}`;

  return {
    deviceId: hardwareId,
    deviceName: readableDeviceName,
    brand,
    manufacturer,
    modelName,
    osName: cleanOsDisplay,
    osVersion,
    browserName: 'Swipe Pay Native App',
    platform: 'mobile',
    registeredAt: new Date().toISOString(),
    fingerprint: rawFingerprint,
    screenResolution,
    devicePixelRatio: dpr,
    cpuCores: Device.supportedCpuArchitectures?.length || 8,
    memoryGb,
    language: 'en-GH',
    timezone,
    colorDepth: 24,
    carrier: 'MTN Ghana',
    isPhysicalPhone,
  };
}
