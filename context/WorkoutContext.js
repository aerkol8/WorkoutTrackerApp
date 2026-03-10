import React, { createContext, useState, useContext, useEffect, useRef, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import exerciseData from '../data/exercises.json';
import exerciseCatalogSnapshot from '../data/exerciseCatalogSnapshot.json';
import { useAuth } from './AuthContext';
import {
  buildSeedCatalog,
  computeMuscleDashboard,
  enrichWorkoutData,
  fetchWgerCatalog,
  getRecentPRs,
  mergeCatalogs,
} from '../utils/exerciseCatalog';
import { EXERCISE_CACHE_TTL_MS, STORAGE_KEYS } from '../utils/storage';
import { toLocalDateKey } from '../utils/date';

const WorkoutContext = createContext(null);
const seedCatalog = buildSeedCatalog(exerciseData);
const snapshotCatalog = mergeCatalogs(seedCatalog, exerciseCatalogSnapshot);

export const WorkoutProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState([]);
  const [library, setLibrary] = useState(snapshotCatalog);
  const [catalogMeta, setCatalogMeta] = useState({
    source: 'snapshot',
    syncedAt: null,
    remoteAvailable: exerciseCatalogSnapshot.length > 0,
    lastError: null,
  });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const lastSavedRef = useRef(null);

  const enrichData = (nextRoutines, nextHistory, catalog = library) => (
    enrichWorkoutData({ routines: nextRoutines, history: nextHistory }, catalog)
  );

  const refreshExerciseCatalog = async (force = false) => {
    try {
      const cachedCatalog = await AsyncStorage.getItem(STORAGE_KEYS.exerciseCatalog);
      const cachedSyncedAt = await AsyncStorage.getItem(STORAGE_KEYS.exerciseCatalogSyncedAt);
      const parsedCache = cachedCatalog ? JSON.parse(cachedCatalog) : [];
      const mergedCache = mergeCatalogs(snapshotCatalog, parsedCache);
      const syncedAt = cachedSyncedAt || null;
      const isStale = !syncedAt || (Date.now() - new Date(syncedAt).getTime()) > EXERCISE_CACHE_TTL_MS;

      if (!cachedCatalog) {
        await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalog, JSON.stringify(snapshotCatalog));
      }

      if (mergedCache.length) {
        setLibrary(mergedCache);
        setCatalogMeta({
          source: parsedCache.length ? 'cache' : 'snapshot',
          syncedAt,
          remoteAvailable: mergedCache.some(item => item.source === 'wger'),
          lastError: null,
        });
      }

      const shouldFetchRemote = force || isStale || !parsedCache.length;
      if (!shouldFetchRemote) {
        return { success: true, fromCache: true };
      }

      const remoteCatalog = await fetchWgerCatalog();
      if (!remoteCatalog.length) {
        return { success: true, fromCache: true };
      }
      const mergedRemote = mergeCatalogs(snapshotCatalog, remoteCatalog);
      const timestamp = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalog, JSON.stringify(mergedRemote));
      await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogSyncedAt, timestamp);
      setLibrary(mergedRemote);
      setCatalogMeta({
        source: 'wger',
        syncedAt: timestamp,
        remoteAvailable: true,
        lastError: null,
      });
      return { success: true, fromCache: false };
    } catch (error) {
      setCatalogMeta(prev => ({
        ...prev,
        lastError: error.message || 'Exercise catalog sync failed',
      }));
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    refreshExerciseCatalog();
  }, []);

  useEffect(() => {
    if (!library.length || (!routines.length && !history.length)) return;

    const enriched = enrichData(routines, history, library);
    const currentPayload = JSON.stringify({ routines, history });
    const enrichedPayload = JSON.stringify(enriched);

    if (currentPayload !== enrichedPayload) {
      setRoutines(enriched.routines);
      setHistory(enriched.history);
    }
  }, [library]);

  useEffect(() => {
    if (!user && !isGuest) {
      setRoutines([]);
      setHistory([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (!user && !isGuest) return;

    setRoutines([]);
    setHistory([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const storedRoutines = await AsyncStorage.getItem(STORAGE_KEYS.routines);
          const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.history);
          const routinesData = storedRoutines ? JSON.parse(storedRoutines) : [];
          const historyData = storedHistory ? JSON.parse(storedHistory) : [];
          const enriched = enrichData(routinesData, historyData, library);

          setRoutines(enriched.routines);
          setHistory(enriched.history);
          setLoadedUserId('guest');
          setDataLoaded(true);
          lastSavedRef.current = JSON.stringify(enriched);
        } else if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            const routinesData = docSnap.exists() ? (docSnap.data().routines || []) : [];
            const historyData = docSnap.exists() ? (docSnap.data().history || []) : [];
            const enriched = enrichData(routinesData, historyData, library);

            setRoutines(enriched.routines);
            setHistory(enriched.history);
            lastSavedRef.current = JSON.stringify(enriched);
            setLoadedUserId(user.uid);
            setDataLoaded(true);
          });
        }
      } catch (e) {
        console.error('Data could not be loaded:', e);
      }
    };

    loadData();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isGuest, library]);

  useEffect(() => {
    if (!user && !isGuest) return;
    if (!dataLoaded) return;

    const currentId = isGuest ? 'guest' : user?.uid;
    if (!currentId || loadedUserId !== currentId) return;

    const saveData = async () => {
      try {
        const payloadStr = JSON.stringify({ routines, history });
        if (lastSavedRef.current === payloadStr) return;

        if (isGuest) {
          await AsyncStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routines));
          await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
        } else if (user?.uid) {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            routines,
            history,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }

        lastSavedRef.current = payloadStr;
      } catch (e) {
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          return;
        }
        console.error('Workout data could not be saved:', e);
      }
    };

    saveData();
  }, [routines, history, user, isGuest, dataLoaded, loadedUserId]);

  const exportBackupData = () => ({
    routines,
    history,
  });

  const importBackupData = (payload = {}) => {
    const nextRoutines = Array.isArray(payload.routines) ? payload.routines : [];
    const nextHistory = Array.isArray(payload.history) ? payload.history : [];
    const enriched = enrichData(nextRoutines, nextHistory, library);

    setRoutines(enriched.routines);
    setHistory(enriched.history);
    lastSavedRef.current = null;
    setDataLoaded(true);
    setLoadedUserId(isGuest ? 'guest' : user?.uid || loadedUserId);
    return { success: true, routines: enriched.routines.length, history: enriched.history.length };
  };

  const addRoutine = (name) => {
    const newRoutine = {
      id: Date.now().toString(),
      name,
      exercises: [],
    };
    setRoutines(prev => [...prev, newRoutine]);
  };

  const deleteRoutine = (routineId) => {
    setRoutines(prev => prev.filter(routine => routine.id !== routineId));
  };

  const addExerciseToSpecificRoutine = (routineId, exercise) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id !== routineId) return routine;

      return {
        ...routine,
        exercises: [
          ...routine.exercises,
          {
            ...exercise,
            workoutId: Date.now().toString(),
            sets: [{ id: Date.now(), weight: '0', reps: '10', isDone: false, restSeconds: 0 }],
          },
        ],
      };
    }));
  };

  const deleteExerciseFromRoutine = (routineId, workoutId) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => (
      routine.id === routineId
        ? { ...routine, exercises: routine.exercises.filter(exercise => exercise.workoutId !== workoutId) }
        : routine
    )));
  };

  const updateSetData = (routineId, workoutId, setIndex, field, value) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id !== routineId) return routine;

      return {
        ...routine,
        exercises: routine.exercises.map(exercise => {
          if (exercise.workoutId !== workoutId) return exercise;
          const nextSets = [...exercise.sets];
          nextSets[setIndex] = { ...nextSets[setIndex], [field]: value };
          return { ...exercise, sets: nextSets };
        }),
      };
    }));
  };

  const addNewSet = (routineId, workoutId) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id !== routineId) return routine;

      return {
        ...routine,
        exercises: routine.exercises.map(exercise => {
          if (exercise.workoutId !== workoutId) return exercise;
          const lastSet = exercise.sets[exercise.sets.length - 1];
          return {
            ...exercise,
            sets: [
              ...exercise.sets,
              {
                id: Date.now(),
                weight: lastSet?.weight || '0',
                reps: lastSet?.reps || '10',
                isDone: false,
                restSeconds: lastSet?.restSeconds ?? 0,
              },
            ],
          };
        }),
      };
    }));
  };

  const toggleSetStatus = (routineId, workoutId, setIndex) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => {
      if (routine.id !== routineId) return routine;

      return {
        ...routine,
        exercises: routine.exercises.map(exercise => {
          if (exercise.workoutId !== workoutId) return exercise;
          const nextSets = [...exercise.sets];
          nextSets[setIndex] = { ...nextSets[setIndex], isDone: !nextSets[setIndex].isDone };
          return { ...exercise, sets: nextSets };
        }),
      };
    }));
  };

  const calculate1RM = (weight, reps) => {
    const w = parseFloat(weight) || 0;
    const r = parseFloat(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    return Math.round(w * (1 + r / 30));
  };

  const getExerciseBest1RM = (exerciseIdentifier, excludeEntryId = null) => {
    let best1RM = 0;
    history.forEach(entry => {
      if (excludeEntryId && entry.id === excludeEntryId) return;
      entry.exercises?.forEach(exercise => {
        const isSameExercise = exercise.catalogExerciseId
          ? exercise.catalogExerciseId === exerciseIdentifier
          : exercise.name?.toLowerCase() === String(exerciseIdentifier).toLowerCase();
        if (!isSameExercise) return;

        exercise.sets?.forEach(set => {
          const rm = calculate1RM(set.weight, set.reps);
          if (rm > best1RM) best1RM = rm;
        });
      });
    });
    return best1RM;
  };

  const finishWorkout = (sessionData) => {
    const enrichedSession = enrichData([], [{ exercises: sessionData.exercises }], library).history[0];

    const exercisesWithPR = (enrichedSession?.exercises || []).map(exercise => {
      let best1RM = 0;

      exercise.sets?.forEach(set => {
        const rm = calculate1RM(set.weight, set.reps);
        if (rm > best1RM) best1RM = rm;
      });

      const exerciseIdentifier = exercise.catalogExerciseId || exercise.name;
      const previousBest = getExerciseBest1RM(exerciseIdentifier);
      const isPR = best1RM > previousBest && best1RM > 0;

      return {
        ...exercise,
        best1RM,
        previousBest,
        isPR,
      };
    });

    const prCount = exercisesWithPR.filter(exercise => exercise.isPR).length;
    const newEntry = {
      ...sessionData,
      exercises: exercisesWithPR,
      prCount,
      id: Date.now().toString(),
      dateISO: toLocalDateKey(new Date()),
      dateString: new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }),
    };

    setHistory(prev => [newEntry, ...prev]);
  };

  const deleteHistoryEntry = (id) => {
    setHistory(prev => prev.filter(entry => entry.id !== id));
  };

  const resetRoutineProgress = (routineId) => {
    setRoutines(prevRoutines => prevRoutines.map(routine => (
      routine.id !== routineId
        ? routine
        : {
            ...routine,
            exercises: (routine.exercises || []).map(exercise => ({
              ...exercise,
              sets: (exercise.sets || []).map(set => ({ ...set, isDone: false })),
            })),
          }
    )));
  };

  const dashboard7 = useMemo(() => computeMuscleDashboard(history, 7, library), [history, library]);
  const dashboard30 = useMemo(() => computeMuscleDashboard(history, 30, library), [history, library]);
  const recentPRs = useMemo(() => getRecentPRs(history), [history]);

  return (
    <WorkoutContext.Provider value={{
      routines,
      history,
      library,
      catalogMeta,
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
      getExerciseBest1RM,
      refreshExerciseCatalog,
      exportBackupData,
      importBackupData,
      dashboard7,
      dashboard30,
      recentPRs,
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
