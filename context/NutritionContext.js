import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';
import { STORAGE_KEYS } from '../utils/storage';
import { toLocalDateKey } from '../utils/date';
import {
  isBarcodeQuery,
  rankOpenFoodFactsResults,
  searchOpenFoodFacts,
} from '../utils/nutritionSearch';

const NutritionContext = createContext(null);
const defaultDailyGoals = { calories: 2200, protein: 160, carbs: 220, fat: 70 };

function parsePortionGrams(portionValue) {
  const normalized = String(portionValue || '').trim().toLowerCase().replace(',', '.');
  if (!normalized) return null;

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const gramMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*g$/);
  if (!gramMatch) return null;

  const grams = Number(gramMatch[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function normalizeMealTemplate(template = {}) {
  const calories = Number(template.calories) || 0;
  const protein = Number(template.protein) || 0;
  const carbs = Number(template.carbs) || 0;
  const fat = Number(template.fat) || 0;
  const portionGrams = parsePortionGrams(template.portion);

  if (typeof template.macrosPer100 === 'boolean') {
    return {
      ...template,
      calories,
      protein,
      carbs,
      fat,
    };
  }

  if (portionGrams) {
    const factor = 100 / portionGrams;
    return {
      ...template,
      calories: Math.round(calories * factor),
      protein: Math.round(protein * factor),
      carbs: Math.round(carbs * factor),
      fat: Math.round(fat * factor),
      servingQuantity: portionGrams,
      macrosPer100: true,
    };
  }

  return {
    ...template,
    calories,
    protein,
    carbs,
    fat,
    macrosPer100: false,
  };
}

export const NutritionProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [dailyMeals, setDailyMeals] = useState({});
  const [favoriteFoods, setFavoriteFoods] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [dailyGoals, setDailyGoals] = useState(defaultDailyGoals);
  const [mealTemplates, setMealTemplates] = useState([]);
  const [scanHistory, setScanHistory] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const searchCacheRef = useRef(new Map());
  const lastSavedRef = useRef(null);

  const getTodayKey = () => toLocalDateKey(new Date());

  useEffect(() => {
    if (!user && !isGuest) return;

    setDailyMeals({});
    setFavoriteFoods([]);
    setRecentSearches([]);
    setDailyGoals(defaultDailyGoals);
    setMealTemplates([]);
    setScanHistory([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const storedMeals = await AsyncStorage.getItem(STORAGE_KEYS.nutrition);
          const storedFavs = await AsyncStorage.getItem(STORAGE_KEYS.favoriteFoods);
          const storedRecent = await AsyncStorage.getItem(STORAGE_KEYS.recentSearches);
          const storedGoals = await AsyncStorage.getItem(STORAGE_KEYS.nutritionGoals);
          const storedTemplates = await AsyncStorage.getItem(STORAGE_KEYS.mealTemplates);
          const storedScans = await AsyncStorage.getItem(STORAGE_KEYS.scanHistory);
          const nextState = {
            dailyMeals: storedMeals ? JSON.parse(storedMeals) : {},
            favoriteFoods: storedFavs ? JSON.parse(storedFavs) : [],
            recentSearches: storedRecent ? JSON.parse(storedRecent) : [],
            dailyGoals: storedGoals ? JSON.parse(storedGoals) : defaultDailyGoals,
            mealTemplates: storedTemplates ? JSON.parse(storedTemplates).map(normalizeMealTemplate) : [],
            scanHistory: storedScans ? JSON.parse(storedScans) : [],
          };

          setDailyMeals(nextState.dailyMeals);
          setFavoriteFoods(nextState.favoriteFoods);
          setRecentSearches(nextState.recentSearches);
          setDailyGoals(nextState.dailyGoals);
          setMealTemplates(nextState.mealTemplates);
          setScanHistory(nextState.scanHistory);
          setLoadedUserId('guest');
          setDataLoaded(true);
          lastSavedRef.current = JSON.stringify(nextState);
        } else if (user) {
          const userDocRef = doc(db, 'nutrition', user.uid);
          unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
            const storedRecent = await AsyncStorage.getItem(STORAGE_KEYS.recentSearches);
            const storedGoals = await AsyncStorage.getItem(STORAGE_KEYS.nutritionGoals);
            const storedTemplates = await AsyncStorage.getItem(STORAGE_KEYS.mealTemplates);
            const storedScans = await AsyncStorage.getItem(STORAGE_KEYS.scanHistory);
            const nextState = docSnap.exists()
              ? {
                  dailyMeals: docSnap.data().dailyMeals || {},
                  favoriteFoods: docSnap.data().favoriteFoods || [],
                  recentSearches: storedRecent ? JSON.parse(storedRecent) : [],
                  dailyGoals: docSnap.data().dailyGoals || (storedGoals ? JSON.parse(storedGoals) : defaultDailyGoals),
                  mealTemplates: (docSnap.data().mealTemplates || (storedTemplates ? JSON.parse(storedTemplates) : []))
                    .map(normalizeMealTemplate),
                  scanHistory: docSnap.data().scanHistory || (storedScans ? JSON.parse(storedScans) : []),
                }
              : {
                  dailyMeals: {},
                  favoriteFoods: [],
                  recentSearches: storedRecent ? JSON.parse(storedRecent) : [],
                  dailyGoals: storedGoals ? JSON.parse(storedGoals) : defaultDailyGoals,
                  mealTemplates: storedTemplates ? JSON.parse(storedTemplates).map(normalizeMealTemplate) : [],
                  scanHistory: storedScans ? JSON.parse(storedScans) : [],
                };

            setDailyMeals(nextState.dailyMeals);
            setFavoriteFoods(nextState.favoriteFoods);
            setRecentSearches(nextState.recentSearches);
            setDailyGoals(nextState.dailyGoals);
            setMealTemplates(nextState.mealTemplates);
            setScanHistory(nextState.scanHistory);
            setLoadedUserId(user.uid);
            setDataLoaded(true);
            lastSavedRef.current = JSON.stringify(nextState);
          });
        }
      } catch (e) {
        console.error('Nutrition data could not be loaded:', e);
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
        const nextState = { dailyMeals, favoriteFoods, recentSearches, dailyGoals, mealTemplates, scanHistory };
        const currentData = JSON.stringify(nextState);
        if (!isGuest && lastSavedRef.current === currentData) return;

        await AsyncStorage.setItem(STORAGE_KEYS.recentSearches, JSON.stringify(recentSearches));
        await AsyncStorage.setItem(STORAGE_KEYS.nutritionGoals, JSON.stringify(dailyGoals));
        await AsyncStorage.setItem(STORAGE_KEYS.mealTemplates, JSON.stringify(mealTemplates));
        await AsyncStorage.setItem(STORAGE_KEYS.scanHistory, JSON.stringify(scanHistory));

        if (isGuest) {
          await AsyncStorage.setItem(STORAGE_KEYS.nutrition, JSON.stringify(dailyMeals));
          await AsyncStorage.setItem(STORAGE_KEYS.favoriteFoods, JSON.stringify(favoriteFoods));
        } else if (user?.uid) {
          const userDocRef = doc(db, 'nutrition', user.uid);
          await setDoc(userDocRef, {
            dailyMeals,
            favoriteFoods,
            dailyGoals,
            mealTemplates,
            scanHistory,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
        }

        lastSavedRef.current = currentData;
      } catch (e) {
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          return;
        }
        console.error('Nutrition data could not be saved:', e);
      }
    };

    saveData();
  }, [dailyMeals, favoriteFoods, recentSearches, dailyGoals, mealTemplates, scanHistory, user, isGuest, dataLoaded, loadedUserId]);

  useEffect(() => {
    if (!user && !isGuest) {
      setDailyMeals({});
      setFavoriteFoods([]);
      setRecentSearches([]);
      setDailyGoals(defaultDailyGoals);
      setMealTemplates([]);
      setScanHistory([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  const exportBackupData = () => ({
    dailyMeals,
    favoriteFoods,
    recentSearches,
    dailyGoals,
    mealTemplates,
    scanHistory,
  });

  const importBackupData = (payload = {}) => {
    setDailyMeals(payload.dailyMeals || {});
    setFavoriteFoods(payload.favoriteFoods || []);
    setRecentSearches(payload.recentSearches || []);
    setDailyGoals(payload.dailyGoals || defaultDailyGoals);
    setMealTemplates((payload.mealTemplates || []).map(normalizeMealTemplate));
    setScanHistory(payload.scanHistory || []);
    lastSavedRef.current = null;
    setDataLoaded(true);
    setLoadedUserId(isGuest ? 'guest' : user?.uid || loadedUserId);
    return { success: true };
  };

  const rememberSearch = (query) => {
    const normalized = query.trim();
    if (!normalized) return;

    setRecentSearches(prev => {
      const next = [normalized, ...prev.filter(item => item.toLowerCase() !== normalized.toLowerCase())];
      return next.slice(0, 8);
    });
  };

  const addFavorite = (food) => {
    const exists = favoriteFoods.some(item =>
      item.name === food.name && item.brand === food.brand && item.source === food.source
    );
    if (exists) return false;

    const favoriteFood = {
      id: Date.now().toString(),
      name: food.name,
      brand: food.brand || '',
      calories: food.calories || 0,
      protein: food.protein || 0,
      carbs: food.carbs || 0,
      fat: food.fat || 0,
      servingSize: food.servingSize || null,
      servingQuantity: food.servingQuantity || null,
      source: food.source || 'custom',
      sourceId: food.sourceId || null,
      barcode: food.barcode || null,
      image: food.image || null,
      isVerified: Boolean(food.isVerified),
      addedAt: new Date().toISOString(),
    };

    setFavoriteFoods(prev => [favoriteFood, ...prev]);
    return true;
  };

  const removeFavorite = (foodId) => {
    setFavoriteFoods(prev => prev.filter(food => food.id !== foodId));
  };

  const isFavorite = (food) => (
    favoriteFoods.some(item =>
      item.name === food.name && item.brand === food.brand && item.source === food.source
    )
  );

  const createTemplateFromMeal = (meal = {}) => {
    const calories = Number(meal.calories) || 0;
    const protein = Number(meal.protein) || 0;
    const carbs = Number(meal.carbs) || 0;
    const fat = Number(meal.fat) || 0;

    const portionGrams = parsePortionGrams(meal.portion);
    const servingQuantityRaw = Number(meal.servingQuantity);
    const valuesArePer100 = Boolean(meal.macrosPer100);
    const servingQuantity = portionGrams || (
      Number.isFinite(servingQuantityRaw) && servingQuantityRaw > 0
        ? servingQuantityRaw
        : null
    );
    const shouldNormalizePer100 = Boolean(!valuesArePer100 && portionGrams);
    const macrosPer100 = valuesArePer100 || shouldNormalizePer100;
    const factor = shouldNormalizePer100 ? (100 / portionGrams) : 1;

    return {
      id: Date.now().toString(),
      name: meal.name || 'Untitled Meal',
      brand: meal.brand || '',
      calories: Math.round(calories * factor),
      protein: Math.round(protein * factor),
      carbs: Math.round(carbs * factor),
      fat: Math.round(fat * factor),
      portion: meal.portion || '100g',
      source: meal.source || (meal.isCustom ? 'custom' : 'off'),
      sourceId: meal.sourceId || null,
      servingSize: meal.servingSize || null,
      servingQuantity,
      macrosPer100,
      barcode: meal.barcode || null,
      image: meal.image || null,
      isVerified: Boolean(meal.isVerified),
      isCustom: Boolean(meal.isCustom),
      mealType: meal.mealType || 'breakfast',
      createdAt: new Date().toISOString(),
    };
  };

  const addMealTemplate = (meal) => {
    const template = createTemplateFromMeal(meal);
    const exists = mealTemplates.some(item =>
      item.name === template.name &&
      item.brand === template.brand &&
      item.source === template.source &&
      item.portion === template.portion
    );
    if (exists) return false;
    setMealTemplates(prev => [template, ...prev].slice(0, 20));
    return true;
  };

  const removeMealTemplate = (templateId) => {
    setMealTemplates(prev => prev.filter(item => item.id !== templateId));
  };

  const rememberBarcodeScan = (barcode, foodName = '') => {
    const normalized = String(barcode || '').trim();
    if (!normalized) return;

    setScanHistory(prev => {
      const nextEntry = {
        barcode: normalized,
        label: foodName || normalized,
        scannedAt: new Date().toISOString(),
      };
      const deduped = prev.filter(item => item.barcode !== normalized);
      return [nextEntry, ...deduped].slice(0, 10);
    });
  };

  const clearScanHistory = () => {
    setScanHistory([]);
  };

  const addMeal = (meal, date = getTodayKey()) => {
    const newMeal = {
      id: Date.now().toString(),
      ...meal,
      addedAt: new Date().toISOString(),
    };

    setDailyMeals(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), newMeal],
    }));
  };

  const deleteMeal = (mealId, date = getTodayKey()) => {
    setDailyMeals(prev => ({
      ...prev,
      [date]: (prev[date] || []).filter(meal => meal.id !== mealId),
    }));
  };

  const updateMeal = (mealId, updatedData, date = getTodayKey()) => {
    setDailyMeals(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(meal =>
        meal.id === mealId ? { ...meal, ...updatedData, updatedAt: new Date().toISOString() } : meal
      ),
    }));
  };

  const getMealsForDate = (date = getTodayKey()) => dailyMeals[date] || [];

  const getTotalCalories = (date = getTodayKey()) => (
    (dailyMeals[date] || []).reduce((sum, meal) => sum + (meal.calories || 0), 0)
  );

  const getTotalMacros = (date = getTodayKey()) => {
    const meals = dailyMeals[date] || [];
    return {
      calories: meals.reduce((sum, meal) => sum + (meal.calories || 0), 0),
      protein: meals.reduce((sum, meal) => sum + (meal.protein || 0), 0),
      carbs: meals.reduce((sum, meal) => sum + (meal.carbs || 0), 0),
      fat: meals.reduce((sum, meal) => sum + (meal.fat || 0), 0),
    };
  };

  const getDaysWithMeals = () => (
    Object.keys(dailyMeals)
      .filter(date => dailyMeals[date] && dailyMeals[date].length > 0)
      .sort((a, b) => new Date(b) - new Date(a))
  );

  const updateDailyGoals = (nextGoals) => {
    setDailyGoals(prev => ({
      ...prev,
      ...Object.fromEntries(
        Object.entries(nextGoals || {}).map(([key, value]) => [key, Math.max(0, Number(value) || 0)])
      ),
    }));
  };

  const getGoalProgress = (date = getTodayKey()) => {
    const totals = getTotalMacros(date);
    return {
      calories: {
        current: totals.calories,
        goal: dailyGoals.calories,
        ratio: dailyGoals.calories > 0 ? Math.min(1.4, totals.calories / dailyGoals.calories) : 0,
      },
      protein: {
        current: totals.protein,
        goal: dailyGoals.protein,
        ratio: dailyGoals.protein > 0 ? Math.min(1.4, totals.protein / dailyGoals.protein) : 0,
      },
      carbs: {
        current: totals.carbs,
        goal: dailyGoals.carbs,
        ratio: dailyGoals.carbs > 0 ? Math.min(1.4, totals.carbs / dailyGoals.carbs) : 0,
      },
      fat: {
        current: totals.fat,
        goal: dailyGoals.fat,
        ratio: dailyGoals.fat > 0 ? Math.min(1.4, totals.fat / dailyGoals.fat) : 0,
      },
    };
  };

  const getRecentMeals = (limit = 6) => (
    Object.values(dailyMeals)
      .flatMap(meals => meals || [])
      .sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0))
      .filter((meal, index, arr) =>
        arr.findIndex(entry =>
          entry.name === meal.name &&
          entry.brand === meal.brand &&
          entry.source === meal.source
        ) === index
      )
      .slice(0, limit)
  );

  const copyMealsToDate = (fromDate, toDate) => {
    const mealsToClone = dailyMeals[fromDate] || [];
    if (!mealsToClone.length) return false;

    const clonedMeals = mealsToClone.map(meal => ({
      ...meal,
      id: Date.now().toString() + Math.random().toString(36).slice(2, 9),
      addedAt: new Date().toISOString(),
      copiedFrom: fromDate,
    }));

    setDailyMeals(prev => ({
      ...prev,
      [toDate]: [...(prev[toDate] || []), ...clonedMeals],
    }));

    return true;
  };

  const searchFood = async (query) => {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const barcode = isBarcodeQuery(normalizedQuery);
    const cacheKey = `${barcode ? 'barcode' : 'text'}:${normalizedQuery.toLowerCase()}`;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.results;
    }

    try {
      const rawResults = await searchOpenFoodFacts(normalizedQuery, { barcode });
      const results = rankOpenFoodFactsResults(rawResults, normalizedQuery);
      searchCacheRef.current.set(cacheKey, { results, timestamp: Date.now() });
      rememberSearch(normalizedQuery);
      return results;
    } catch (error) {
      console.error('Food search failed:', error);
      return cached?.results || [];
    }
  };

  return (
    <NutritionContext.Provider value={{
      dailyMeals,
      favoriteFoods,
      recentSearches,
      dailyGoals,
      mealTemplates,
      scanHistory,
      addMeal,
      deleteMeal,
      updateMeal,
      getMealsForDate,
      getTotalCalories,
      getTotalMacros,
      getDaysWithMeals,
      copyMealsToDate,
      getGoalProgress,
      updateDailyGoals,
      getRecentMeals,
      addMealTemplate,
      removeMealTemplate,
      rememberBarcodeScan,
      clearScanHistory,
      searchFood,
      getTodayKey,
      addFavorite,
      removeFavorite,
      isFavorite,
      exportBackupData,
      importBackupData,
    }}>
      {children}
    </NutritionContext.Provider>
  );
};

export const useNutrition = () => {
  const context = useContext(NutritionContext);
  if (!context) {
    throw new Error('useNutrition must be used within NutritionProvider');
  }
  return context;
};
