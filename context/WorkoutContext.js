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
  getRecentPRs,
  mergeCatalogs,
  normalizeExerciseName,
} from '../utils/exerciseCatalog';
import { EXERCISE_CATALOG_CACHE_VERSION, STORAGE_KEYS } from '../utils/storage';
import { toLocalDateKey } from '../utils/date';

const WorkoutContext = createContext(null);
const seedCatalog = buildSeedCatalog(exerciseData);
const snapshotCatalog = mergeCatalogs(seedCatalog, exerciseCatalogSnapshot);

export const WorkoutProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [routines, setRoutines] = useState([]);
  const [history, setHistory] = useState([]);
  const [exerciseAliases, setExerciseAliases] = useState({});
  const [library, setLibrary] = useState(snapshotCatalog);
  const [catalogMeta, setCatalogMeta] = useState({
    source: 'snapshot',
    syncedAt: null,
    remoteAvailable: false,
    lastError: null,
  });
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const lastSavedRef = useRef(null);
  const catalogRefreshInFlightRef = useRef(null);

  const sanitizeAliasMap = (rawValue = {}) => {
    if (!rawValue || typeof rawValue !== 'object' || Array.isArray(rawValue)) {
      return {};
    }

    return Object.entries(rawValue).reduce((acc, [legacyName, canonicalName]) => {
      const normalizedLegacy = normalizeExerciseName(legacyName);
      const canonicalText = String(canonicalName || '').trim();
      if (!normalizedLegacy || !canonicalText) return acc;
      acc[normalizedLegacy] = canonicalText;
      return acc;
    }, {});
  };

  const enrichData = (nextRoutines, nextHistory, catalog = library, aliases = exerciseAliases) => (
    enrichWorkoutData(
      { routines: nextRoutines, history: nextHistory },
      catalog,
      { customAliases: aliases }
    )
  );

  const refreshExerciseCatalog = async (force = false) => {
    if (catalogRefreshInFlightRef.current) {
      return catalogRefreshInFlightRef.current;
    }

    const task = (async () => {
      try {
        const cachedVersionRaw = await AsyncStorage.getItem(STORAGE_KEYS.exerciseCatalogVersion);
        const cachedVersion = Number(cachedVersionRaw || 0);
        const isLegacyCache = cachedVersion !== EXERCISE_CATALOG_CACHE_VERSION;
        const timestamp = new Date().toISOString();

        if (isLegacyCache) {
          await AsyncStorage.removeItem(STORAGE_KEYS.exerciseCatalog);
          await AsyncStorage.removeItem(STORAGE_KEYS.exerciseCatalogSyncedAt);
          await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogVersion, String(EXERCISE_CATALOG_CACHE_VERSION));
        }

        const cachedCatalog = await AsyncStorage.getItem(STORAGE_KEYS.exerciseCatalog);
        const cachedSyncedAt = await AsyncStorage.getItem(STORAGE_KEYS.exerciseCatalogSyncedAt);
        if (!cachedCatalog || force || isLegacyCache) {
          await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalog, JSON.stringify(snapshotCatalog));
          await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogSyncedAt, timestamp);
          await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogVersion, String(EXERCISE_CATALOG_CACHE_VERSION));
          setLibrary(snapshotCatalog);
          setCatalogMeta({
            source: 'snapshot',
            syncedAt: timestamp,
            remoteAvailable: false,
            lastError: null,
          });
          return { success: true, fromCache: false };
        }

        const parsedCache = JSON.parse(cachedCatalog);
        const mergedCache = mergeCatalogs(snapshotCatalog, parsedCache);
        if (mergedCache.length) {
          const nextSyncedAt = cachedSyncedAt || timestamp;
          if (!cachedSyncedAt) {
            await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogSyncedAt, nextSyncedAt);
          }
          setLibrary(mergedCache);
          setCatalogMeta({
            source: parsedCache.length ? 'cache' : 'snapshot',
            syncedAt: nextSyncedAt,
            remoteAvailable: false,
            lastError: null,
          });
          return { success: true, fromCache: true };
        }

        await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalog, JSON.stringify(snapshotCatalog));
        await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogSyncedAt, timestamp);
        await AsyncStorage.setItem(STORAGE_KEYS.exerciseCatalogVersion, String(EXERCISE_CATALOG_CACHE_VERSION));
        setLibrary(snapshotCatalog);
        setCatalogMeta({
          source: 'snapshot',
          syncedAt: timestamp,
          remoteAvailable: false,
          lastError: null,
        });
        return { success: true, fromCache: false };
      } catch (error) {
        setCatalogMeta(prev => ({
          ...prev,
          lastError: error.message || 'Exercise catalog load failed',
        }));
        return { success: false, error: error.message };
      } finally {
        catalogRefreshInFlightRef.current = null;
      }
    })();

    catalogRefreshInFlightRef.current = task;
    return task;
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
  }, [library, exerciseAliases]);

  useEffect(() => {
    if (!user && !isGuest) {
      setRoutines([]);
      setHistory([]);
      setExerciseAliases({});
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  useEffect(() => {
    if (!user && !isGuest) return;

    setRoutines([]);
    setHistory([]);
    setExerciseAliases({});
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const storedRoutines = await AsyncStorage.getItem(STORAGE_KEYS.routines);
          const storedHistory = await AsyncStorage.getItem(STORAGE_KEYS.history);
          const storedAliases = await AsyncStorage.getItem(STORAGE_KEYS.exerciseAliases);
          const routinesData = storedRoutines ? JSON.parse(storedRoutines) : [];
          const historyData = storedHistory ? JSON.parse(storedHistory) : [];
          const aliasesData = sanitizeAliasMap(storedAliases ? JSON.parse(storedAliases) : {});
          const enriched = enrichData(routinesData, historyData, library, aliasesData);

          setRoutines(enriched.routines);
          setHistory(enriched.history);
          setExerciseAliases(aliasesData);
          setLoadedUserId('guest');
          setDataLoaded(true);
          lastSavedRef.current = JSON.stringify({
            ...enriched,
            exerciseAliases: aliasesData,
          });
        } else if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            const routinesData = docSnap.exists() ? (docSnap.data().routines || []) : [];
            const historyData = docSnap.exists() ? (docSnap.data().history || []) : [];
            const aliasesData = sanitizeAliasMap(
              docSnap.exists() ? (docSnap.data().exerciseAliases || {}) : {}
            );
            const enriched = enrichData(routinesData, historyData, library, aliasesData);

            setRoutines(enriched.routines);
            setHistory(enriched.history);
            setExerciseAliases(aliasesData);
            lastSavedRef.current = JSON.stringify({
              ...enriched,
              exerciseAliases: aliasesData,
            });
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
        const payloadStr = JSON.stringify({ routines, history, exerciseAliases });
        if (lastSavedRef.current === payloadStr) return;

        if (isGuest) {
          await AsyncStorage.setItem(STORAGE_KEYS.routines, JSON.stringify(routines));
          await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
          await AsyncStorage.setItem(STORAGE_KEYS.exerciseAliases, JSON.stringify(exerciseAliases));
        } else if (user?.uid) {
          const userDocRef = doc(db, 'users', user.uid);
          await setDoc(userDocRef, {
            routines,
            history,
            exerciseAliases,
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
  }, [routines, history, exerciseAliases, user, isGuest, dataLoaded, loadedUserId]);

  const exportBackupData = () => ({
    routines,
    history,
    exerciseAliases,
  });

  const importBackupData = (payload = {}) => {
    const nextRoutines = Array.isArray(payload.routines) ? payload.routines : [];
    const nextHistory = Array.isArray(payload.history) ? payload.history : [];
    const nextAliases = sanitizeAliasMap(payload.exerciseAliases || payload.aliases || {});
    const enriched = enrichData(nextRoutines, nextHistory, library, nextAliases);

    setRoutines(enriched.routines);
    setHistory(enriched.history);
    setExerciseAliases(nextAliases);
    lastSavedRef.current = null;
    setDataLoaded(true);
    setLoadedUserId(isGuest ? 'guest' : user?.uid || loadedUserId);
    return { success: true, routines: enriched.routines.length, history: enriched.history.length };
  };

  const addExerciseAlias = (legacyName, canonicalName) => {
    const normalizedLegacy = normalizeExerciseName(legacyName);
    const normalizedCanonical = normalizeExerciseName(canonicalName);
    if (!normalizedLegacy || !normalizedCanonical) {
      return { success: false, error: 'Invalid exercise name' };
    }

    const matchedTarget = (library || []).find(
      item => normalizeExerciseName(item.name) === normalizedCanonical
    );
    if (!matchedTarget) {
      return { success: false, error: 'Target exercise not found in current catalog' };
    }

    setExerciseAliases(prev => ({
      ...prev,
      [normalizedLegacy]: matchedTarget.name,
    }));

    return { success: true, alias: normalizedLegacy, canonical: matchedTarget.name };
  };

  const removeExerciseAlias = (legacyName) => {
    const normalizedLegacy = normalizeExerciseName(legacyName);
    if (!normalizedLegacy) {
      return { success: false, error: 'Invalid exercise name' };
    }
    if (!exerciseAliases[normalizedLegacy]) {
      return { success: false, error: 'Alias not found' };
    }

    setExerciseAliases(prev => {
      const next = { ...prev };
      delete next[normalizedLegacy];
      return next;
    });
    return { success: true };
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
      exerciseAliases,
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
      addExerciseAlias,
      removeExerciseAlias,
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
