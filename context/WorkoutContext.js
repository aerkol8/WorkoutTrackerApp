import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import exerciseData from '../data/exercises.json';
import { useAuth } from './AuthContext';

const WorkoutContext = createContext(null);

export const WorkoutProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState([]);
  const [library, setLibrary] = useState([]); // Exercise library state
  const [dataLoaded, setDataLoaded] = useState(false); // Data loaded from source?
  const [loadedUserId, setLoadedUserId] = useState(null); // Which user's data was loaded
  const lastSavedRef = useRef(null); // Track last saved data to prevent duplicate saves

  // Clear state when auth is completely signed out
  useEffect(() => {
    if (!user && !isGuest) {
      setRoutines([]);
      setHistory([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  // --- DATA LOADING (Firestore or AsyncStorage) ---
  useEffect(() => {
    if (!user && !isGuest) return; // Wait if not logged in

    // Clear state when user mode changes to prevent leaks
    setRoutines([]);
    setHistory([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          // GUEST MODE: Load from AsyncStorage
          const storedRoutines = await AsyncStorage.getItem('@routines');
          const storedHistory = await AsyncStorage.getItem('@history');

          const routinesData = storedRoutines ? JSON.parse(storedRoutines) : [];
          const historyData = storedHistory ? JSON.parse(storedHistory) : [];

          setRoutines(routinesData);
          setHistory(historyData);

          setLoadedUserId('guest');
          setDataLoaded(true);

          lastSavedRef.current = JSON.stringify({ routines: routinesData, history: historyData });
        } else if (user) {
          // USER LOGGED IN: Load from Firestore (real-time)
          const userDocRef = doc(db, 'users', user.uid);
          
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const routinesData = data.routines || [];
              const historyData = data.history || [];

              setRoutines(routinesData);
              setHistory(historyData);

              lastSavedRef.current = JSON.stringify({ routines: routinesData, history: historyData });
            } else {
              setRoutines([]);
              setHistory([]);

              lastSavedRef.current = JSON.stringify({ routines: [], history: [] });
            }
            setLoadedUserId(user.uid);
            setDataLoaded(true);
          });
        }

        // Load exercises directly from JSON
        setLibrary(exerciseData);
      } catch (e) {
        console.error("Data could not be loaded:", e);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isGuest]);

  // --- DATA SAVING (Firestore or AsyncStorage) ---
  useEffect(() => {
    // If user logged out, don't save anything
    if (!user && !isGuest) return;
    if (!dataLoaded) return; // Don't save if not yet loaded from source
    
    const currentId = isGuest ? 'guest' : user?.uid;
    if (!currentId || loadedUserId !== currentId) return; // Don't save with different user data

    const saveData = async () => {
      try {
        const payloadStr = JSON.stringify({ routines, history });
        if (lastSavedRef.current === payloadStr) return;

        if (isGuest) {
          // GUEST MODE: Save to AsyncStorage
          await AsyncStorage.setItem('@routines', JSON.stringify(routines));
          await AsyncStorage.setItem('@history', JSON.stringify(history));
        } else if (user && user.uid) {
          // USER LOGGED IN: Save to Firestore (user.uid check again)
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            routines,
            history,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }

        lastSavedRef.current = payloadStr;
      } catch (e) {
        // Ignore permission errors silently (may happen during logout)
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          console.log("Logged out, save skipped");
          return;
        }
        console.error("Veriler kaydedilemedi:", e);
      }
    };

    saveData();
  }, [routines, history, user, isGuest, dataLoaded, loadedUserId]);

  // --- LIBRARY FUNCTIONS ---
  // Library is loaded directly from data/exercises.json

  // --- ROUTINE (WORKOUT DAY) FUNCTIONS ---
  const addRoutine = (name) => {
    const newRoutine = {
      id: Date.now().toString(),
      name: name,
      exercises: []
    };
    setRoutines([...routines, newRoutine]);
  };

  const deleteRoutine = (routineId) => {
    setRoutines((prev) => prev.filter((r) => r.id !== routineId));
  };

  const addExerciseToSpecificRoutine = (routineId, exercise) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id === routineId) {
        return {
          ...routine,
          exercises: [
            ...routine.exercises, 
            { 
              ...exercise, 
              workoutId: Date.now().toString(),
              sets: [{ id: Date.now(), weight: "0", reps: "10", isDone: false, restSeconds: 0 }] 
            }
          ]
        };
      }
      return routine;
    }));
  };

  const deleteExerciseFromRoutine = (routineId, workoutId) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id === routineId) {
        return {
          ...routine,
          exercises: routine.exercises.filter(ex => ex.workoutId !== workoutId)
        };
      }
      return routine;
    }));
  };

  // --- SET MANAGEMENT ---
  const updateSetData = (routineId, workoutId, setIndex, field, value) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id === routineId) {
        return {
          ...routine,
          exercises: routine.exercises.map(ex => {
            if (ex.workoutId === workoutId) {
              const newSets = [...ex.sets];
              newSets[setIndex] = { ...newSets[setIndex], [field]: value };
              return { ...ex, sets: newSets };
            }
            return ex;
          })
        };
      }
      return routine;
    }));
  };

  const addNewSet = (routineId, workoutId) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id === routineId) {
        return {
          ...routine,
          exercises: routine.exercises.map(ex => {
            if (ex.workoutId === workoutId) {
              const lastSet = ex.sets[ex.sets.length - 1];
              return {
                ...ex,
                sets: [...ex.sets, { 
                  id: Date.now(), 
                  weight: lastSet?.weight || "0", 
                  reps: lastSet?.reps || "10", 
                  isDone: false,
                  restSeconds: lastSet?.restSeconds ?? 0,
                }]
              };
            }
            return ex;
          })
        };
      }
      return routine;
    }));
  };

  const toggleSetStatus = (routineId, workoutId, setIndex) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id === routineId) {
        return {
          ...routine,
          exercises: routine.exercises.map(ex => {
            if (ex.workoutId === workoutId) {
              const newSets = [...ex.sets];
              newSets[setIndex] = { ...newSets[setIndex], isDone: !newSets[setIndex].isDone };
              return { ...ex, sets: newSets };
            }
            return ex;
          })
        };
      }
      return routine;
    }));
  };

  // --- 1RM CALCULATION ---
  // Formula: 1RM = Weight × (1 + Reps / 30)
  const calculate1RM = (weight, reps) => {
    const w = parseFloat(weight) || 0;
    const r = parseFloat(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    return Math.round(w * (1 + r / 30));
  };

  // Find the best 1RM in all history for an exercise
  const getExerciseBest1RM = (exerciseName, excludeEntryId = null) => {
    let best1RM = 0;
    history.forEach(entry => {
      if (excludeEntryId && entry.id === excludeEntryId) return;
      entry.exercises?.forEach(ex => {
        if (ex.name?.toLowerCase() === exerciseName?.toLowerCase()) {
          ex.sets?.forEach(set => {
            const rm = calculate1RM(set.weight, set.reps);
            if (rm > best1RM) best1RM = rm;
          });
        }
      });
    });
    return best1RM;
  };

  // --- GEÇMİŞ YÖNETİMİ ---
  const finishWorkout = (sessionData) => {
    // Her egzersiz için PR kontrolü yap
    const exercisesWithPR = sessionData.exercises.map(ex => {
      let best1RM = 0;
      let bestSet = null;
      
      // Bu egzersizin bu antrenmandaki en iyi 1RM'ini bul
      ex.sets?.forEach((set, idx) => {
        const rm = calculate1RM(set.weight, set.reps);
        if (rm > best1RM) {
          best1RM = rm;
          bestSet = idx;
        }
      });

      // Geçmişteki en iyi 1RM'i bul
      const previousBest = getExerciseBest1RM(ex.name);
      const isPR = best1RM > previousBest && best1RM > 0;

      return {
        ...ex,
        best1RM,
        previousBest,
        isPR,
      };
    });

    const prCount = exercisesWithPR.filter(ex => ex.isPR).length;

    const newEntry = {
      ...sessionData,
      exercises: exercisesWithPR,
      prCount,
      id: Date.now().toString(),
      dateISO: new Date().toISOString().split('T')[0],
      dateString: new Date().toLocaleDateString('en-US', { 
          weekday: 'long', day: 'numeric', month: 'long' 
      })
    };
    setHistory(prev => [newEntry, ...prev]);
  };

  const deleteHistoryEntry = (id) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const resetRoutineProgress = (routineId) => {
    setRoutines((prevRoutines) =>
      prevRoutines.map((routine) => {
        if (routine.id !== routineId) return routine;
        return {
          ...routine,
          exercises: (routine.exercises || []).map((ex) => ({
            ...ex,
            sets: (ex.sets || []).map((s) => ({ ...s, isDone: false })),
          })),
        };
      })
    );
  };

  return (
    <WorkoutContext.Provider value={{ 
      routines, 
      history, 
      library, // Kütüphane listesini dışarı veriyoruz
      addRoutine, 
      deleteRoutine,
      addExerciseToSpecificRoutine, 
      deleteExerciseFromRoutine, 
      finishWorkout, 
      addNewSet,
      updateSetData,
      toggleSetStatus,
      deleteHistoryEntry,
      resetRoutineProgress,
      calculate1RM,
      getExerciseBest1RM
    }}>
      {children}
    </WorkoutContext.Provider>
  );
};

export const useWorkout = () => {
  const ctx = useContext(WorkoutContext);
  if (!ctx) throw new Error('useWorkout must be used within a WorkoutProvider');
  return ctx;
};