import { BACKUP_VERSION } from './storage';

const emptyWorkout = { routines: [], history: [] };
const emptyNutrition = {
  dailyMeals: {},
  favoriteFoods: [],
  recentSearches: [],
  dailyGoals: { calories: 2200, protein: 160, carbs: 220, fat: 70 },
  mealTemplates: [],
  scanHistory: [],
};
const emptyProfile = { profile: { gender: 'male', height: '' }, measurements: [] };

export function createBackupPayload({ isGuest, workout, nutrition, profile }) {
  return {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    authMode: isGuest ? 'guest' : 'user',
    workout: {
      routines: workout?.routines || [],
      history: workout?.history || [],
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
  const parsed = JSON.parse(rawText);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid backup payload');
  }

  if (parsed.backupVersion !== BACKUP_VERSION) {
    throw new Error(`Unsupported backup version: ${parsed.backupVersion}`);
  }

  return {
    backupVersion: parsed.backupVersion,
    exportedAt: parsed.exportedAt || null,
    authMode: parsed.authMode || 'guest',
    workout: {
      ...emptyWorkout,
      ...(parsed.workout || {}),
    },
    nutrition: {
      ...emptyNutrition,
      ...(parsed.nutrition || {}),
    },
    profile: {
      ...emptyProfile,
      ...(parsed.profile || {}),
    },
  };
}
