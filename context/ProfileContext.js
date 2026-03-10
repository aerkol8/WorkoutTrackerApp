import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS } from '../utils/storage';

const ProfileContext = createContext(null);
const emptyProfileState = { gender: 'male', height: '' };

export const ProfileProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [profile, setProfile] = useState(emptyProfileState);
  const [measurements, setMeasurements] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const lastSavedRef = useRef(null);

  useEffect(() => {
    if (!user && !isGuest) return;

    setProfile(emptyProfileState);
    setMeasurements([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const storedProfile = await AsyncStorage.getItem(STORAGE_KEYS.profile);
          const storedMeasurements = await AsyncStorage.getItem(STORAGE_KEYS.measurements);
          const nextState = {
            profile: storedProfile ? JSON.parse(storedProfile) : emptyProfileState,
            measurements: storedMeasurements ? JSON.parse(storedMeasurements) : [],
          };

          setProfile(nextState.profile);
          setMeasurements(nextState.measurements);
          setLoadedUserId('guest');
          setDataLoaded(true);
          lastSavedRef.current = JSON.stringify(nextState);
        } else if (user) {
          const userDocRef = doc(db, 'profiles', user.uid);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            const nextState = docSnap.exists()
              ? {
                  profile: docSnap.data().profile || emptyProfileState,
                  measurements: docSnap.data().measurements || [],
                }
              : {
                  profile: emptyProfileState,
                  measurements: [],
                };

            setProfile(nextState.profile);
            setMeasurements(nextState.measurements);
            setLoadedUserId(user.uid);
            setDataLoaded(true);
            lastSavedRef.current = JSON.stringify(nextState);
          });
        }
      } catch (e) {
        console.error('Failed to load profile data:', e);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isGuest]);

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!dataLoaded) return;

    const currentId = isGuest ? 'guest' : user?.uid;
    if (!currentId || loadedUserId !== currentId) return;

    const saveData = async () => {
      try {
        const nextState = { profile, measurements };
        const currentData = JSON.stringify(nextState);
        if (!isGuest && lastSavedRef.current === currentData) return;

        if (isGuest) {
          await AsyncStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile));
          await AsyncStorage.setItem(STORAGE_KEYS.measurements, JSON.stringify(measurements));
        } else if (user?.uid) {
          const userDocRef = doc(db, 'profiles', user.uid);
          await setDoc(userDocRef, {
            profile,
            measurements,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }

        lastSavedRef.current = currentData;
      } catch (e) {
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          return;
        }
        console.error('Failed to save profile data:', e);
      }
    };

    saveData();
  }, [profile, measurements, user, isGuest, dataLoaded, loadedUserId]);

  useEffect(() => {
    if (!user && !isGuest) {
      setProfile(emptyProfileState);
      setMeasurements([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  const exportBackupData = () => ({
    profile,
    measurements,
  });

  const importBackupData = (payload = {}) => {
    setProfile(payload.profile || emptyProfileState);
    setMeasurements(payload.measurements || []);
    lastSavedRef.current = null;
    setDataLoaded(true);
    setLoadedUserId(isGuest ? 'guest' : user?.uid || loadedUserId);
    return { success: true };
  };

  const updateProfile = (newData) => {
    setProfile(prev => ({ ...prev, ...newData }));
  };

  const calculateBFP = (waist, neck, hip, gender, height) => {
    const w = parseFloat(waist);
    const n = parseFloat(neck);
    const h = parseFloat(hip);
    const ht = parseFloat(height);

    if (!w || !n || !ht || w <= n) return null;

    if (gender === 'male') {
      const bfp = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(ht)) - 450;
      return Math.max(0, Math.min(60, bfp));
    }

    if (!h) return null;
    const bfp = 495 / (1.29579 - 0.35004 * Math.log10(w + h - n) + 0.22100 * Math.log10(ht)) - 450;
    return Math.max(0, Math.min(60, bfp));
  };

  const addMeasurement = (waist, neck, hip = null) => {
    const height = parseFloat(profile.height);
    if (!height) return { success: false, error: 'Please set your height first' };

    const bfp = calculateBFP(waist, neck, hip, profile.gender, height);
    if (bfp === null) return { success: false, error: 'Invalid measurements' };

    const newMeasurement = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      waist: parseFloat(waist),
      neck: parseFloat(neck),
      hip: hip ? parseFloat(hip) : null,
      height,
      gender: profile.gender,
      bfp: Math.round(bfp * 10) / 10,
    };

    setMeasurements(prev => [newMeasurement, ...prev]);
    return { success: true, bfp: newMeasurement.bfp };
  };

  const deleteMeasurement = (id) => {
    setMeasurements(prev => prev.filter(measurement => measurement.id !== id));
  };

  const getLatestMeasurement = () => measurements.length > 0 ? measurements[0] : null;

  const getBFPChange = () => {
    if (measurements.length < 2) return null;
    return Math.round((measurements[0].bfp - measurements[1].bfp) * 10) / 10;
  };

  return (
    <ProfileContext.Provider value={{
      profile,
      measurements,
      updateProfile,
      addMeasurement,
      deleteMeasurement,
      getLatestMeasurement,
      getBFPChange,
      calculateBFP,
      exportBackupData,
      importBackupData,
    }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};
