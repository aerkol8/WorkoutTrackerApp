import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const ProfileContext = createContext(null);

export const ProfileProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [profile, setProfile] = useState({
    gender: 'male', // 'male' or 'female'
    height: '', // cm
  });
  const [measurements, setMeasurements] = useState([]); // Array of measurement records
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const lastSavedRef = useRef(null); // Track last saved data to prevent duplicate saves

  // --- DATA LOADING ---
  useEffect(() => {
    if (!user && !isGuest) return;

    setProfile({ gender: 'male', height: '' });
    setMeasurements([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const storedProfile = await AsyncStorage.getItem('@profile');
          const storedMeasurements = await AsyncStorage.getItem('@measurements');
          setProfile(storedProfile ? JSON.parse(storedProfile) : { gender: 'male', height: '' });
          setMeasurements(storedMeasurements ? JSON.parse(storedMeasurements) : []);
          setLoadedUserId('guest');
          setDataLoaded(true);
        } else if (user) {
          const userDocRef = doc(db, 'profiles', user.uid);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              lastSavedRef.current = JSON.stringify({ profile: data.profile, measurements: data.measurements });
              setProfile(data.profile || { gender: 'male', height: '' });
              setMeasurements(data.measurements || []);
            } else {
              lastSavedRef.current = JSON.stringify({ profile: { gender: 'male', height: '' }, measurements: [] });
              setProfile({ gender: 'male', height: '' });
              setMeasurements([]);
            }
            setLoadedUserId(user.uid);
            setDataLoaded(true);
          });
        }
      } catch (e) {
        console.error("Failed to load profile data:", e);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isGuest]);

  // --- DATA SAVING ---
  useEffect(() => {
    if (!user && !isGuest) return;
    if (!dataLoaded) return;

    const currentId = isGuest ? 'guest' : user?.uid;
    if (!currentId || loadedUserId !== currentId) return;

    // Check if data actually changed (prevent duplicate saves)
    const currentData = JSON.stringify({ profile, measurements });
    if (!isGuest && lastSavedRef.current === currentData) {
      return; // Data hasn't changed, skip save
    }

    const saveData = async () => {
      try {
        if (isGuest) {
          await AsyncStorage.setItem('@profile', JSON.stringify(profile));
          await AsyncStorage.setItem('@measurements', JSON.stringify(measurements));
        } else if (user && user.uid) {
          lastSavedRef.current = currentData;
          const userDocRef = doc(db, 'profiles', user.uid);
          await setDoc(userDocRef, {
            profile,
            measurements,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          return;
        }
        console.error("Failed to save profile data:", e);
      }
    };

    saveData();
  }, [profile, measurements, user, isGuest, dataLoaded, loadedUserId]);

  // Clear on logout
  useEffect(() => {
    if (!user && !isGuest) {
      setProfile({ gender: 'male', height: '' });
      setMeasurements([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  // --- FUNCTIONS ---

  // Update profile (gender, height)
  const updateProfile = (newData) => {
    setProfile(prev => ({ ...prev, ...newData }));
  };

  // Calculate Body Fat Percentage using US Navy formula
  const calculateBFP = (waist, neck, hip, gender, height) => {
    const w = parseFloat(waist);
    const n = parseFloat(neck);
    const h = parseFloat(hip);
    const ht = parseFloat(height);

    if (!w || !n || !ht || w <= n) return null;

    if (gender === 'male') {
      // Men: BFP = 495/(1.0324 - 0.19077*log10(waist-neck) + 0.15456*log10(height)) - 450
      const bfp = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(ht)) - 450;
      return Math.max(0, Math.min(60, bfp)); // Clamp between 0-60%
    } else {
      // Women: BFP = 495/(1.29579 - 0.35004*log10(waist+hip-neck) + 0.22100*log10(height)) - 450
      if (!h) return null;
      const bfp = 495 / (1.29579 - 0.35004 * Math.log10(w + h - n) + 0.22100 * Math.log10(ht)) - 450;
      return Math.max(0, Math.min(60, bfp)); // Clamp between 0-60%
    }
  };

  // Add new measurement
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
      height: height,
      gender: profile.gender,
      bfp: Math.round(bfp * 10) / 10, // Round to 1 decimal
    };

    setMeasurements(prev => [newMeasurement, ...prev]);
    return { success: true, bfp: newMeasurement.bfp };
  };

  // Delete measurement
  const deleteMeasurement = (id) => {
    setMeasurements(prev => prev.filter(m => m.id !== id));
  };

  // Get latest measurement
  const getLatestMeasurement = () => {
    return measurements.length > 0 ? measurements[0] : null;
  };

  // Get BFP change compared to previous measurement
  const getBFPChange = () => {
    if (measurements.length < 2) return null;
    const latest = measurements[0].bfp;
    const previous = measurements[1].bfp;
    return Math.round((latest - previous) * 10) / 10;
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
      calculateBFP
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
