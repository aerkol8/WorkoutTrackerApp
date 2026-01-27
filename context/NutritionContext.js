import React, { createContext, useState, useContext, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';
import { useAuth } from './AuthContext';

const NutritionContext = createContext(null);

export const NutritionProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const [dailyMeals, setDailyMeals] = useState({}); // { "2026-01-26": [meal1, meal2...] }
  const [favoriteFoods, setFavoriteFoods] = useState([]); 
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadedUserId, setLoadedUserId] = useState(null);
  const searchCacheRef = useRef(new Map());
  const isLocalChangeRef = useRef(false); // Flag to prevent save on snapshot updates
  const lastSavedRef = useRef(null); // Track last saved data to prevent duplicate saves

  // Today's date (YYYY-MM-DD format)
  const getTodayKey = () => new Date().toISOString().split('T')[0];

  // --- DATA LOADING ---
  useEffect(() => {
    if (!user && !isGuest) return;

    setDailyMeals({});
    setFavoriteFoods([]);
    setDataLoaded(false);
    setLoadedUserId(null);

    let unsubscribe = null;

    const loadData = async () => {
      try {
        if (isGuest) {
          const stored = await AsyncStorage.getItem('@nutrition');
          const storedFavs = await AsyncStorage.getItem('@favorite_foods');
          setDailyMeals(stored ? JSON.parse(stored) : {});
          setFavoriteFoods(storedFavs ? JSON.parse(storedFavs) : []);
          setLoadedUserId('guest');
          setDataLoaded(true);
        } else if (user) {
          const userDocRef = doc(db, 'nutrition', user.uid);
          unsubscribe = onSnapshot(userDocRef, (docSnap) => {
            // Mark as remote change to prevent save loop
            isLocalChangeRef.current = false;
            if (docSnap.exists()) {
              const data = docSnap.data();
              lastSavedRef.current = JSON.stringify({ dailyMeals: data.dailyMeals, favoriteFoods: data.favoriteFoods });
              setDailyMeals(data.dailyMeals || {});
              setFavoriteFoods(data.favoriteFoods || []);
            } else {
              lastSavedRef.current = JSON.stringify({ dailyMeals: {}, favoriteFoods: [] });
              setDailyMeals({});
              setFavoriteFoods([]);
            }
            setLoadedUserId(user.uid);
            setDataLoaded(true);
          });
        }
      } catch (e) {
        console.error("Nutrition data could not be loaded:", e);
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
    const currentData = JSON.stringify({ dailyMeals, favoriteFoods });
    if (!isGuest && lastSavedRef.current === currentData) {
      return; // Data hasn't changed, skip save
    }

    const saveData = async () => {
      try {
        if (isGuest) {
          await AsyncStorage.setItem('@nutrition', JSON.stringify(dailyMeals));
          await AsyncStorage.setItem('@favorite_foods', JSON.stringify(favoriteFoods));
        } else if (user && user.uid) {
          lastSavedRef.current = currentData;
          const userDocRef = doc(db, 'nutrition', user.uid);
          await setDoc(userDocRef, {
            dailyMeals,
            favoriteFoods,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      } catch (e) {
        if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
          return;
        }
        console.error("Beslenme verileri kaydedilemedi:", e);
      }
    };

    saveData();
  }, [dailyMeals, favoriteFoods, user, isGuest, dataLoaded, loadedUserId]);

  // Clear on logout
  useEffect(() => {
    if (!user && !isGuest) {
      setDailyMeals({});
      setFavoriteFoods([]);
      setDataLoaded(false);
      setLoadedUserId(null);
    }
  }, [user, isGuest]);

  // --- FAVORITE FUNCTIONS ---

  // Favorilere ekle
  const addFavorite = (food) => {
    // Zaten favorilerde mi kontrol et
    const exists = favoriteFoods.some(f => 
      f.name === food.name && f.brand === food.brand
    );
    if (exists) return false;

    const favoriteFood = {
      id: Date.now().toString(),
      name: food.name,
      brand: food.brand || '',
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fat: food.fat,
      servingSize: food.servingSize || null,
      servingQuantity: food.servingQuantity || null,
      addedAt: new Date().toISOString()
    };

    setFavoriteFoods(prev => [favoriteFood, ...prev]);
    return true;
  };

  // Remove from favorites
  const removeFavorite = (foodId) => {
    setFavoriteFoods(prev => prev.filter(f => f.id !== foodId));
  };

  // Favorilerde mi kontrol et
  const isFavorite = (food) => {
    return favoriteFoods.some(f => 
      f.name === food.name && f.brand === food.brand
    );
  };

  // --- FUNCTIONS ---

  // Yemek ekle
  const addMeal = (meal, date = getTodayKey()) => {
    const newMeal = {
      id: Date.now().toString(),
      ...meal,
      addedAt: new Date().toISOString()
    };
    
    setDailyMeals(prev => ({
      ...prev,
      [date]: [...(prev[date] || []), newMeal]
    }));
  };

  // Yemek sil
  const deleteMeal = (mealId, date = getTodayKey()) => {
    setDailyMeals(prev => ({
      ...prev,
      [date]: (prev[date] || []).filter(m => m.id !== mealId)
    }));
  };

  // Update meal
  const updateMeal = (mealId, updatedData, date = getTodayKey()) => {
    setDailyMeals(prev => ({
      ...prev,
      [date]: (prev[date] || []).map(m => 
        m.id === mealId ? { ...m, ...updatedData, updatedAt: new Date().toISOString() } : m
      )
    }));
  };

  // Get meals for a specific day
  const getMealsForDate = (date = getTodayKey()) => {
    return dailyMeals[date] || [];
  };

  // Get total calories for a specific day
  const getTotalCalories = (date = getTodayKey()) => {
    const meals = dailyMeals[date] || [];
    return meals.reduce((sum, meal) => sum + (meal.calories || 0), 0);
  };

  // Get total macros for a specific day
  const getTotalMacros = (date = getTodayKey()) => {
    const meals = dailyMeals[date] || [];
    return {
      calories: meals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein: meals.reduce((sum, m) => sum + (m.protein || 0), 0),
      carbs: meals.reduce((sum, m) => sum + (m.carbs || 0), 0),
      fat: meals.reduce((sum, m) => sum + (m.fat || 0), 0),
    };
  };

  // Get days with meal records (sorted by date)
  const getDaysWithMeals = () => {
    return Object.keys(dailyMeals)
      .filter(date => dailyMeals[date] && dailyMeals[date].length > 0)
      .sort((a, b) => new Date(b) - new Date(a)); // En yeniden eskiye
  };

  // Copy a day's meals to another day
  const copyMealsToDate = (fromDate, toDate) => {
    const mealsToClone = dailyMeals[fromDate] || [];
    if (mealsToClone.length === 0) return false;

    const clonedMeals = mealsToClone.map(meal => ({
      ...meal,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      addedAt: new Date().toISOString(),
      copiedFrom: fromDate
    }));

    setDailyMeals(prev => ({
      ...prev,
      [toDate]: [...(prev[toDate] || []), ...clonedMeals]
    }));

    return true;
  };

  // OpenFoodFacts API'den yemek ara (World endpoint)
  const searchFood = async (query) => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return [];

    const cacheKey = normalizedQuery;
    const cached = searchCacheRef.current.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
      return cached.results;
    }

    const fetchWithTimeout = async (url, timeoutMs) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res;
      } finally {
        clearTimeout(timeoutId);
      }
    };

    const mapAndFilter = (products) => (products || [])
      .map(product => {
        const kcalFromKj = product.nutriments?.energy_100g
          ? Math.round(Number(product.nutriments.energy_100g) / 4.184)
          : 0;
        const calories = Math.round(
          product.nutriments?.['energy-kcal_100g'] ||
          product.nutriments?.['energy-kcal'] ||
          kcalFromKj ||
          0
        );
        const protein = Math.round(product.nutriments?.proteins_100g || product.nutriments?.proteins || 0);
        const carbs = Math.round(product.nutriments?.carbohydrates_100g || product.nutriments?.carbohydrates || 0);
        const fat = Math.round(product.nutriments?.fat_100g || product.nutriments?.fat || 0);
        return {
        id: product.id || product.code,
        name: product.product_name || product.product_name_tr || product.product_name_en || product.generic_name_tr || product.generic_name || '',
        brand: product.brands || '',
        calories,
        protein,
        carbs,
        fat,
        servingSize: product.serving_size || null,
        servingQuantity: product.serving_quantity || null,
        image: product.image_small_url || null
      }})
      .filter(item => {
        const hasName = item.name && item.name.trim().length > 0;
        const hasCalories = item.calories > 0;
        const hasMacros = item.protein > 0 || item.carbs > 0 || item.fat > 0;
        return hasName && (hasCalories || hasMacros);
      });

    try {
      const worldUrl = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(normalizedQuery)}&search_simple=1&action=process&json=1&page_size=50&fields=id,code,product_name,product_name_tr,product_name_en,generic_name_tr,generic_name,brands,nutriments,serving_size,serving_quantity,image_small_url`;
      let worldResponse;
      try {
        worldResponse = await fetchWithTimeout(worldUrl, 20000);
      } catch (e) {
        if (e.name === 'AbortError') {
          // Bir kez daha dene
          worldResponse = await fetchWithTimeout(worldUrl, 20000);
        } else {
          throw e;
        }
      }

      const worldData = await worldResponse.json();
      const worldResults = mapAndFilter(worldData.products);

      searchCacheRef.current.set(cacheKey, { results: worldResults, timestamp: Date.now() });
      return worldResults;
    } catch (e) {
      if (cached) return cached.results;
      if (e.name === 'AbortError') {
        console.log("Search request timed out");
        return [];
      }
      console.error("Food search failed:", e);
      return [];
    }
  };

  return (
    <NutritionContext.Provider value={{
      dailyMeals,
      favoriteFoods,
      addMeal,
      deleteMeal,
      updateMeal,
      getMealsForDate,
      getTotalCalories,
      getTotalMacros,
      getDaysWithMeals,
      copyMealsToDate,
      searchFood,
      getTodayKey,
      addFavorite,
      removeFavorite,
      isFavorite
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
