/**
 * LiveCameraPreview — Cross-platform live front/back camera feed for React Native & Web.
 * Uses `expo-camera` (CameraView) on Native (iOS/Android) and `navigator.mediaDevices` on Web.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, Camera, useCameraPermissions } from 'expo-camera';
import { THEME, FONTS } from '../theme';

export function LiveCameraPreview({
  style,
  facing = 'front',
  children,
  isActive = true,
  onReady,
  showToggleFacing = false,
}) {
  const [currentFacing, setCurrentFacing] = useState(facing);
  const [nativePermission, requestNativePermission] = useCameraPermissions();
  const [webStream, setWebStream] = useState(null);
  const [webPermissionDenied, setWebPermissionDenied] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const videoRef = useRef(null);

  // Sync facing prop changes
  useEffect(() => {
    setCurrentFacing(facing);
  }, [facing]);

  // ─── Native Camera Permissions & Auto-Request ──────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' && isActive) {
      (async () => {
        try {
          const status = await Camera.getCameraPermissionsAsync();
          if (!status.granted) {
            const requested = await Camera.requestCameraPermissionsAsync();
            if (requested.granted) {
              setIsInitializing(false);
              onReady?.();
            }
          } else {
            setIsInitializing(false);
            onReady?.();
          }
        } catch {
          requestNativePermission();
        }
      })();
    }
  }, [Platform.OS, isActive]);

  // ─── Web Camera Stream Management ──────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'web' || !isActive) return;

    let activeStream = null;

    const startWebCamera = async () => {
      setIsInitializing(true);
      setWebPermissionDenied(false);

      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: currentFacing === 'front' ? 'user' : 'environment',
              width: { ideal: 640 },
              height: { ideal: 640 },
            },
            audio: false,
          });

          activeStream = stream;
          setWebStream(stream);
          setIsInitializing(false);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
          onReady?.();
        } catch (err) {
          console.warn('Web camera error:', err?.message);
          setIsInitializing(false);
          setWebPermissionDenied(true);
        }
      } else {
        setIsInitializing(false);
        setWebPermissionDenied(true);
      }
    };

    startWebCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [Platform.OS, isActive, currentFacing]);

  // Attach web stream to video element when ready
  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current && webStream) {
      videoRef.current.srcObject = webStream;
      videoRef.current.play().catch(() => {});
    }
  }, [webStream]);

  const toggleFacing = () => {
    setCurrentFacing((prev) => (prev === 'front' ? 'back' : 'front'));
  };

  // ─── Web Render ───────────────────────────────────────────────
  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, style]}>
        {isActive && !webPermissionDenied ? (
          <View style={StyleSheet.absoluteFill}>
            {/* Embedded HTML5 Video Element for Web */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#000',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: currentFacing === 'front' ? 'scaleX(-1)' : 'none',
                }}
              />
            </div>
          </View>
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
            <Ionicons name="camera-outline" size={44} color={THEME.primary} style={{ marginBottom: 6 }} />
            <Text style={styles.fallbackTitle}>Camera Access Required</Text>
            <Text style={styles.fallbackSub}>Allow browser camera permissions to enable live scan</Text>
          </View>
        )}

        {/* Overlay Children (Scan Lines, Reticle, Liveness Badges) */}
        {children}

        {showToggleFacing && (
          <TouchableOpacity style={styles.flipBtn} onPress={toggleFacing} activeOpacity={0.8}>
            <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // ─── Native Render (iOS / Android) ────────────────────────────
  const hasNativePerm = nativePermission?.granted;

  return (
    <View style={[styles.container, style]}>
      {isActive && hasNativePerm ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={currentFacing}
          onCameraReady={() => {
            setIsInitializing(false);
            onReady?.();
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.fallbackContainer]}>
          <Ionicons name="camera-outline" size={44} color={THEME.primary} style={{ marginBottom: 6 }} />
          <Text style={styles.fallbackTitle}>
            {!hasNativePerm ? 'Camera Permission Needed' : 'Starting Camera Sensor...'}
          </Text>
          {!hasNativePerm && (
            <TouchableOpacity
              style={styles.grantPermBtn}
              onPress={() => requestNativePermission()}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-checkmark-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
              <Text style={styles.grantPermBtnText}>Allow Camera Access</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Overlay Children */}
      {children}

      {showToggleFacing && hasNativePerm && (
        <TouchableOpacity style={styles.flipBtn} onPress={toggleFacing} activeOpacity={0.8}>
          <Ionicons name="camera-reverse" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F8FAFC',
  },
  fallbackTitle: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    fontWeight: '800',
    color: THEME.text,
    textAlign: 'center',
  },
  fallbackSub: {
    fontFamily: FONTS.regular,
    fontSize: 10,
    color: THEME.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  grantPermBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  grantPermBtnText: {
    fontFamily: FONTS.bold,
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  flipBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
});
