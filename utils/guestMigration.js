import { STORAGE_KEYS } from './storage';

const emptyWorkout = {
  routines: [],
  history: [],
  exerciseAliases: {},
};

const emptyNutrition = {
  dailyMeals: {},
  favoriteFoods: [],
  recentSearches: [],
  dailyGoals: { calories: 2200, protein: 160, carbs: 220, fat: 70 },
  mealTemplates: [],
  scanHistory: [],
};

const emptyProfile = {
  profile: { gender: 'male', height: '' },
  measurements: [],
};

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function asObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback;
  }

  return value;
}

export function createGuestMigrationStatusKey(userId = '') {
  return `${STORAGE_KEYS.guestMigrationStatusPrefix}${userId}`;
}

export function normalizeGuestSnapshot(rawSnapshot = {}) {
  const workout = asObject(rawSnapshot.workout);
  const nutrition = asObject(rawSnapshot.nutrition);
  const profileRoot = asObject(rawSnapshot.profile);
  const profileValues = asObject(profileRoot.profile);

  return {
    workout: {
      ...emptyWorkout,
      routines: asArray(workout.routines),
      history: asArray(workout.history),
      exerciseAliases: asObject(workout.exerciseAliases),
    },
    nutrition: {
      ...emptyNutrition,
      dailyMeals: asObject(nutrition.dailyMeals),
      favoriteFoods: asArray(nutrition.favoriteFoods),
      recentSearches: asArray(nutrition.recentSearches),
      dailyGoals: {
        ...emptyNutrition.dailyGoals,
        ...asObject(nutrition.dailyGoals),
      },
      mealTemplates: asArray(nutrition.mealTemplates),
      scanHistory: asArray(nutrition.scanHistory),
    },
    profile: {
      ...emptyProfile,
      profile: {
        ...emptyProfile.profile,
        ...profileValues,
      },
      measurements: asArray(profileRoot.measurements),
    },
  };
}

export function hasGuestSnapshotData(snapshot = {}) {
  const normalized = normalizeGuestSnapshot(snapshot);

  return Boolean(
    normalized.workout.routines.length ||
      normalized.workout.history.length ||
      Object.keys(normalized.workout.exerciseAliases).length ||
      Object.keys(normalized.nutrition.dailyMeals).length ||
      normalized.nutrition.favoriteFoods.length ||
      normalized.nutrition.recentSearches.length ||
      normalized.nutrition.mealTemplates.length ||
      normalized.nutrition.scanHistory.length ||
      normalized.profile.measurements.length ||
      String(normalized.profile.profile.height || '').trim()
  );
}

export function hasRemoteAccountData(snapshot = {}) {
  const normalized = normalizeGuestSnapshot(snapshot);

  return Boolean(
    normalized.workout.routines.length ||
      normalized.workout.history.length ||
      Object.keys(normalized.workout.exerciseAliases).length ||
      Object.keys(normalized.nutrition.dailyMeals).length ||
      normalized.nutrition.favoriteFoods.length ||
      normalized.nutrition.mealTemplates.length ||
      normalized.nutrition.scanHistory.length ||
      normalized.profile.measurements.length ||
      String(normalized.profile.profile.height || '').trim()
  );
}

export function buildGuestMigrationWritePayloads(snapshot = {}, { timestamp } = {}) {
  const normalized = normalizeGuestSnapshot(snapshot);
  const updatedAt = timestamp || new Date().toISOString();

  return {
    workout: {
      routines: normalized.workout.routines,
      history: normalized.workout.history,
      exerciseAliases: normalized.workout.exerciseAliases,
      guestMigratedAt: updatedAt,
      updatedAt,
    },
    nutrition: {
      dailyMeals: normalized.nutrition.dailyMeals,
      favoriteFoods: normalized.nutrition.favoriteFoods,
      dailyGoals: normalized.nutrition.dailyGoals,
      mealTemplates: normalized.nutrition.mealTemplates,
      scanHistory: normalized.nutrition.scanHistory,
      guestMigratedAt: updatedAt,
      updatedAt,
    },
    profile: {
      profile: normalized.profile.profile,
      measurements: normalized.profile.measurements,
      guestMigratedAt: updatedAt,
      updatedAt,
    },
  };
}
