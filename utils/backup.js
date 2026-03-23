import { BACKUP_VERSION } from './storage';

const emptyWorkout = { routines: [], history: [], exerciseAliases: {} };
const emptyNutrition = {
  dailyMeals: {},
  favoriteFoods: [],
  recentSearches: [],
  dailyGoals: { calories: 2200, protein: 160, carbs: 220, fat: 70 },
  mealTemplates: [],
  scanHistory: [],
};
const emptyProfile = { profile: { gender: 'male', height: '' }, measurements: [] };

function asArray(value, fallback = []) {
  return Array.isArray(value) ? value : fallback;
}

function asObject(value, fallback = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  return value;
}

export function createBackupPayload({ isGuest, workout, nutrition, profile }) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    authMode: isGuest ? 'guest' : 'user',
    workout: {
      routines: workout?.routines || [],
      history: workout?.history || [],
      exerciseAliases: workout?.exerciseAliases || {},
    },
    nutrition: {
      dailyMeals: nutrition?.dailyMeals || {},
      favoriteFoods: nutrition?.favoriteFoods || [],
      recentSearches: nutrition?.recentSearches || [],
      dailyGoals: nutrition?.dailyGoals || emptyNutrition.dailyGoals,
      mealTemplates: nutrition?.mealTemplates || [],
      scanHistory: nutrition?.scanHistory || [],
    },
    profile: {
      profile: profile?.profile || emptyProfile.profile,
      measurements: profile?.measurements || [],
    },
  };
}

export function serializeBackup(payload) {
  return JSON.stringify(payload, null, 2);
}

export function parseBackupString(rawText) {
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw new Error('Invalid JSON format');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup payload');
  }

  if (parsed.backupVersion !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.backupVersion}`);
  }

  const parsedWorkout = asObject(parsed.workout);
  const parsedExerciseAliases =
    parsedWorkout.exerciseAliases &&
    typeof parsedWorkout.exerciseAliases === 'object' &&
    !Array.isArray(parsedWorkout.exerciseAliases)
      ? parsedWorkout.exerciseAliases
      : {};

  const parsedNutrition = asObject(parsed.nutrition);
  const parsedProfile = asObject(parsed.profile);
  const parsedProfileRoot = asObject(parsedProfile.profile);

  return {
    backupVersion: parsed.backupVersion,
    exportedAt: parsed.exportedAt || null,
    authMode: parsed.authMode || 'guest',
    workout: {
      ...emptyWorkout,
      routines: asArray(parsedWorkout.routines),
      history: asArray(parsedWorkout.history),
      exerciseAliases: parsedExerciseAliases,
    },
    nutrition: {
      ...emptyNutrition,
      dailyMeals: asObject(parsedNutrition.dailyMeals),
      favoriteFoods: asArray(parsedNutrition.favoriteFoods),
      recentSearches: asArray(parsedNutrition.recentSearches),
      dailyGoals: {
        ...emptyNutrition.dailyGoals,
        ...asObject(parsedNutrition.dailyGoals),
      },
      mealTemplates: asArray(parsedNutrition.mealTemplates),
      scanHistory: asArray(parsedNutrition.scanHistory),
    },
    profile: {
      ...emptyProfile,
      profile: {
        ...emptyProfile.profile,
        ...parsedProfileRoot,
      },
      measurements: asArray(parsedProfile.measurements),
    },
  };
}
