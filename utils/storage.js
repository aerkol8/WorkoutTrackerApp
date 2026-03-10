export const STORAGE_KEYS = {
  guestMode: '@guestMode',
  routines: '@routines',
  history: '@history',
  nutrition: '@nutrition',
  favoriteFoods: '@favorite_foods',
  recentSearches: '@nutrition_recent_searches',
  nutritionGoals: '@nutrition_goals',
  mealTemplates: '@nutrition_meal_templates',
  scanHistory: '@nutrition_scan_history',
  profile: '@profile',
  measurements: '@measurements',
  exerciseCatalog: '@exercise_catalog_cache',
  exerciseCatalogSyncedAt: '@exercise_catalog_synced_at',
};

export const BACKUP_VERSION = 1;
export const EXERCISE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 7;
