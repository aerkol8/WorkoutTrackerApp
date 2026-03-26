import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../context/AuthContext';

WebBrowser.maybeCompleteAuthSession();

const APP_SCHEME = 'fullpot';
const GOOGLE_REDIRECT_PATH = 'oauthredirect';
const GOOGLE_IOS_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '').trim();
const GOOGLE_ANDROID_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '').trim();
const GOOGLE_WEB_CLIENT_ID = String(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '').trim();

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInAsGuest } = useAuth();
  const [authInFlight, setAuthInFlight] = useState(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const handledGoogleResponseRef = useRef(null);

  const googleFallbackClientId = GOOGLE_WEB_CLIENT_ID || GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID;
  const googleClientIdForPlatform = useMemo(
    () => Platform.select({
      ios: GOOGLE_IOS_CLIENT_ID || googleFallbackClientId,
      android: GOOGLE_ANDROID_CLIENT_ID || googleFallbackClientId,
      default: GOOGLE_WEB_CLIENT_ID || googleFallbackClientId,
    }),
    [googleFallbackClientId]
  );
  const googleEnabled = Boolean(googleClientIdForPlatform);

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest(
    {
      clientId: googleFallbackClientId || 'missing-google-client-id',
      iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
      androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
      webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
      selectAccount: true,
    },
    {
      scheme: APP_SCHEME,
      path: GOOGLE_REDIRECT_PATH,
    }
  );

  useEffect(() => {
    let isMounted = true;

    if (Platform.OS !== 'ios') {
      setAppleAvailable(false);
      return () => {
        isMounted = false;
      };
    }

    AppleAuthentication.isAvailableAsync()
      .then((isAvailable) => {
        if (isMounted) {
          setAppleAvailable(isAvailable);
        }
      })
      .catch(() => {
        if (isMounted) {
          setAppleAvailable(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!googleResponse || handledGoogleResponseRef.current === googleResponse) {
      return;
    }

    let isCurrent = true;
    handledGoogleResponseRef.current = googleResponse;

    if (googleResponse.type !== 'success') {
      setAuthInFlight(current => (current === 'google' ? null : current));

      if (googleResponse.type === 'error') {
        Alert.alert(
          'Google Sign-In Failed',
          googleResponse.error?.message || 'Could not complete Google sign-in.'
        );
      }
      return;
    }

    const finalizeGoogleSignIn = async () => {
      try {
        const idToken = googleResponse.params?.id_token || googleResponse.authentication?.idToken || null;
        const accessToken =
          googleResponse.params?.access_token || googleResponse.authentication?.accessToken || null;

        if (!idToken && !accessToken) {
          if (!isCurrent) return;
          setAuthInFlight(null);
          Alert.alert('Google Sign-In Failed', 'Google did not return a usable sign-in token.');
          return;
        }

        const result = await signInWithGoogle({ idToken, accessToken });
        if (!isCurrent) return;

        setAuthInFlight(null);

        if (!result.success) {
          Alert.alert('Google Sign-In Failed', result.error || 'Could not complete Google sign-in.');
          return;
        }

        if (result.migrated) {
          Alert.alert('Guest Data Linked', 'Your local guest data was copied into this account.');
        }
      } catch (error) {
        if (!isCurrent) return;
        setAuthInFlight(null);
        Alert.alert('Google Sign-In Failed', error.message || 'Could not complete Google sign-in.');
      }
    };

    finalizeGoogleSignIn();

    return () => {
      isCurrent = false;
    };
  }, [googleResponse, signInWithGoogle]);

  const handleGoogleSignIn = async () => {
    if (!googleEnabled || !googleRequest) {
      Alert.alert(
        'Google Sign-In Unavailable',
        'Set the Google client IDs in your Expo environment before using Google sign-in.'
      );
      return;
    }

    setAuthInFlight('google');

    try {
      await promptGoogleAsync();
    } catch (error) {
      setAuthInFlight(null);
      Alert.alert('Google Sign-In Failed', error.message || 'Could not start Google sign-in.');
    }
  };

  const handleAppleSignIn = async () => {
    if (!appleAvailable) {
      Alert.alert(
        'Apple Sign-In Unavailable',
        Platform.OS === 'ios'
          ? 'Apple sign-in is not available on this device.'
          : 'Apple sign-in can only be completed on an Apple device.'
      );
      return;
    }

    setAuthInFlight('apple');

    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const result = await signInWithApple({
        idToken: appleCredential.identityToken,
        rawNonce,
      });

      if (!result.success) {
        Alert.alert('Apple Sign-In Failed', result.error || 'Could not complete Apple sign-in.');
        return;
      }

      if (result.migrated) {
        Alert.alert('Guest Data Linked', 'Your local guest data was copied into this account.');
      }
    } catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Sign-In Failed', error.message || 'Could not complete Apple sign-in.');
      }
    } finally {
      setAuthInFlight(null);
    }
  };

  const handleGuestLogin = async () => {
    setAuthInFlight('guest');

    const result = await signInAsGuest();
    setAuthInFlight(null);

    if (!result.success) {
      Alert.alert('Guest Login Failed', result.error || 'Guest login failed.');
    }
  };

  const isBusy = authInFlight !== null;

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="barbell" size={80} color="#BB86FC" style={styles.logo} />
        <Text style={styles.title}>Workout Tracker</Text>
        <Text style={styles.title}>FullPot</Text>
        <Text style={styles.subtitle}>Choose how you want to continue</Text>

        <TouchableOpacity
          style={[styles.button, styles.googleButton, (!googleEnabled || !googleRequest || isBusy) && styles.disabledButton]}
          onPress={handleGoogleSignIn}
          disabled={!googleEnabled || !googleRequest || isBusy}
        >
          {authInFlight === 'google' ? (
            <ActivityIndicator color="#121212" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#121212" />
              <Text style={styles.googleButtonText}>CONTINUE WITH GOOGLE</Text>
            </>
          )}
        </TouchableOpacity>

        {Platform.OS === 'ios' ? (
          <View
            style={[styles.appleButtonWrap, (isBusy || !appleAvailable) && styles.disabledAppleWrap]}
            pointerEvents={isBusy || !appleAvailable ? 'none' : 'auto'}
          >
            {authInFlight === 'apple' ? (
              <View style={styles.appleLoadingOverlay}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.appleFallbackButton, styles.disabledButton]}
            onPress={handleAppleSignIn}
            disabled
          >
            <Ionicons name="logo-apple" size={20} color="#666" />
            <Text style={styles.appleFallbackText}>APPLE SIGN-IN IS AVAILABLE ON IOS</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.guestButton, isBusy && styles.disabledButton]}
          onPress={handleGuestLogin}
          disabled={isBusy}
        >
          {authInFlight === 'guest' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="person-outline" size={20} color="#fff" />
              <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          The first account sign-in can import your local guest data one time without deleting the copy on
          this device.
        </Text>

        {!googleEnabled && (
          <Text style={styles.configHint}>
            Add `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`, and
            `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to enable Google sign-in.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  logo: {
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: '#BB86FC',
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: '#E6E1E5',
    fontSize: 17,
    textAlign: 'center',
    marginBottom: 36,
  },
  button: {
    height: 56,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  googleButton: {
    backgroundColor: '#F2F2F2',
  },
  googleButtonText: {
    color: '#121212',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.8,
  },
  appleButtonWrap: {
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  appleButton: {
    width: '100%',
    height: 56,
  },
  appleLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000AA',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  disabledAppleWrap: {
    opacity: 0.45,
  },
  appleFallbackButton: {
    backgroundColor: '#1E1E1E',
    borderWidth: 1,
    borderColor: '#333',
  },
  appleFallbackText: {
    color: '#666',
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.7,
  },
  guestButton: {
    backgroundColor: '#2C2C2C',
  },
  guestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.8,
  },
  disabledButton: {
    opacity: 0.55,
  },
  infoText: {
    color: '#B0A7B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 10,
  },
  configHint: {
    color: '#7B7284',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 14,
  },
});
