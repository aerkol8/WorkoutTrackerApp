import React, { createContext, useState, useContext, useEffect } from 'react';
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  buildGuestMigrationWritePayloads,
  createGuestMigrationStatusKey,
  hasGuestSnapshotData,
  hasRemoteAccountData,
} from '../utils/guestMigration';
import { STORAGE_KEYS } from '../utils/storage';

const AuthContext = createContext(null);

const safeParseJson = (rawValue, fallback) => {
  if (!rawValue) return fallback;

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return fallback;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);

  const readGuestSnapshotFromStorage = async () => {
    const [
      routinesRaw,
      historyRaw,
      aliasesRaw,
      mealsRaw,
      favoriteFoodsRaw,
      recentSearchesRaw,
      nutritionGoalsRaw,
      mealTemplatesRaw,
      scanHistoryRaw,
      profileRaw,
      measurementsRaw,
    ] = await Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.routines),
      AsyncStorage.getItem(STORAGE_KEYS.history),
      AsyncStorage.getItem(STORAGE_KEYS.exerciseAliases),
      AsyncStorage.getItem(STORAGE_KEYS.nutrition),
      AsyncStorage.getItem(STORAGE_KEYS.favoriteFoods),
      AsyncStorage.getItem(STORAGE_KEYS.recentSearches),
      AsyncStorage.getItem(STORAGE_KEYS.nutritionGoals),
      AsyncStorage.getItem(STORAGE_KEYS.mealTemplates),
      AsyncStorage.getItem(STORAGE_KEYS.scanHistory),
      AsyncStorage.getItem(STORAGE_KEYS.profile),
      AsyncStorage.getItem(STORAGE_KEYS.measurements),
    ]);

    return {
      workout: {
        routines: safeParseJson(routinesRaw, []),
        history: safeParseJson(historyRaw, []),
        exerciseAliases: safeParseJson(aliasesRaw, {}),
      },
      nutrition: {
        dailyMeals: safeParseJson(mealsRaw, {}),
        favoriteFoods: safeParseJson(favoriteFoodsRaw, []),
        recentSearches: safeParseJson(recentSearchesRaw, []),
        dailyGoals: safeParseJson(nutritionGoalsRaw, undefined),
        mealTemplates: safeParseJson(mealTemplatesRaw, []),
        scanHistory: safeParseJson(scanHistoryRaw, []),
      },
      profile: {
        profile: safeParseJson(profileRaw, undefined),
        measurements: safeParseJson(measurementsRaw, []),
      },
    };
  };

  const migrateGuestDataIfNeeded = async (firebaseUser) => {
    if (!firebaseUser?.uid) {
      return { migrated: false, reason: 'missing_user' };
    }

    const statusKey = createGuestMigrationStatusKey(firebaseUser.uid);
    const existingStatus = await AsyncStorage.getItem(statusKey);
    if (existingStatus) {
      return { migrated: existingStatus === 'migrated', reason: existingStatus };
    }

    const guestSnapshot = await readGuestSnapshotFromStorage();
    if (!hasGuestSnapshotData(guestSnapshot)) {
      return { migrated: false, reason: 'no_local_data' };
    }

    const [workoutDoc, nutritionDoc, profileDoc] = await Promise.all([
      getDoc(doc(db, 'users', firebaseUser.uid)),
      getDoc(doc(db, 'nutrition', firebaseUser.uid)),
      getDoc(doc(db, 'profiles', firebaseUser.uid)),
    ]);

    const remoteSnapshot = {
      workout: workoutDoc.exists() ? workoutDoc.data() : {},
      nutrition: nutritionDoc.exists() ? nutritionDoc.data() : {},
      profile: profileDoc.exists() ? profileDoc.data() : {},
    };

    if (hasRemoteAccountData(remoteSnapshot)) {
      await AsyncStorage.setItem(statusKey, 'remote_has_data');
      return { migrated: false, reason: 'remote_has_data' };
    }

    const timestamp = new Date().toISOString();
    const payloads = buildGuestMigrationWritePayloads(guestSnapshot, { timestamp });

    const batch = writeBatch(db);
    batch.set(doc(db, 'users', firebaseUser.uid), payloads.workout, { merge: true });
    batch.set(doc(db, 'nutrition', firebaseUser.uid), payloads.nutrition, { merge: true });
    batch.set(doc(db, 'profiles', firebaseUser.uid), payloads.profile, { merge: true });
    await batch.commit();

    await AsyncStorage.setItem(statusKey, 'migrated');
    return { migrated: true, reason: 'migrated' };
  };

  useEffect(() => {
    let unsubscribe;

    const checkAuthStatus = async () => {
      try {
        const guestMode = await AsyncStorage.getItem(STORAGE_KEYS.guestMode);
        if (guestMode === 'true') {
          setIsGuest(true);
          setUser(null);
          setLoading(false);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            setIsGuest(false);
          } else {
            setUser(null);
          }
          setLoading(false);
        });
      } catch (error) {
        console.error('Auth check error:', error);
        setLoading(false);
      }
    };

    checkAuthStatus();

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const completeSocialSignIn = async (firebaseUser) => {
    try {
      const migration = await migrateGuestDataIfNeeded(firebaseUser);
      await AsyncStorage.removeItem(STORAGE_KEYS.guestMode);
      setUser(firebaseUser);
      setIsGuest(false);
      return { success: true, migrated: migration.migrated, migrationReason: migration.reason };
    } catch (error) {
      await firebaseSignOut(auth);
      return { success: false, error: error.message };
    }
  };

  const signInWithGoogle = async ({ idToken, accessToken }) => {
    try {
      const credential = GoogleAuthProvider.credential(idToken || null, accessToken || null);
      const userCredential = await signInWithCredential(auth, credential);
      return await completeSocialSignIn(userCredential.user);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signInWithApple = async ({ idToken, rawNonce }) => {
    try {
      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken,
        rawNonce,
      });
      const userCredential = await signInWithCredential(auth, credential);
      return await completeSocialSignIn(userCredential.user);
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signInAsGuest = async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.guestMode, 'true');
      setIsGuest(true);
      setUser(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const signOut = async () => {
    try {
      if (!isGuest) {
        await firebaseSignOut(auth);
      }
      await AsyncStorage.removeItem(STORAGE_KEYS.guestMode);
      setUser(null);
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isGuest,
      loading,
      signInWithGoogle,
      signInWithApple,
      signInAsGuest,
      signOut,
      isAuthenticated: user !== null || isGuest,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
