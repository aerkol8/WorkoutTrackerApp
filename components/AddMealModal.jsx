import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, FlatList, TextInput, 
  TouchableOpacity, Modal, ActivityIndicator, Alert,
  Keyboard, TouchableWithoutFeedback, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../styles/nutritionStyles';

function parseGramValue(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(',', '.');
  if (!normalized) return null;

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const match = normalized.match(/^(\d+(?:\.\d+)?)\s*g$/);
  if (!match) return null;

  const grams = Number(match[1]);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function parseServingCount(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return null;

  const count = Number(normalized);
  return Number.isFinite(count) && count > 0 ? count : null;
}

function parseServingCountFromLabel(value) {
  const normalized = String(value || '').trim().replace(',', '.');
  if (!normalized) return 1;

  const multipliedMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*x\b/i);
  if (multipliedMatch) {
    const multipliedCount = Number(multipliedMatch[1]);
    if (Number.isFinite(multipliedCount) && multipliedCount > 0) {
      return multipliedCount;
    }
  }

  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) return direct;

  const leadingNumber = normalized.match(/^(\d+(?:\.\d+)?)/);
  if (!leadingNumber) return 1;

  const parsed = Number(leadingNumber[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function stripServingMultiplier(label) {
  const normalized = String(label || '').trim();
  if (!normalized) return '1 serving';

  const multipliedMatch = normalized.match(/^\d+(?:[.,]\d+)?\s*x\s*(.+)$/i);
  if (!multipliedMatch?.[1]) return normalized;

  return multipliedMatch[1].trim() || '1 serving';
}

function resolveInitialPortion(food) {
  const serving = parseGramValue(food?.servingQuantity);
  if (serving) return serving;

  const portionGrams = parseGramValue(food?.portion);
  if (portionGrams) return portionGrams;

  return 100;
}

function isServingBasedFood(food) {
  return Boolean(food?.macrosPer100 === false);
}

function buildServingLabel(food, servingsCount) {
  const baseLabel = String(food?.portion || '1 serving').trim();
  if (!servingsCount || Math.abs(servingsCount - 1) < 0.0001) {
    return baseLabel;
  }
  return `${servingsCount} x ${baseLabel}`;
}

function normalizeServingBasedFood(food = {}) {
  const baseServings = parseServingCountFromLabel(food.portion);
  const normalizeMacro = (value) => Math.round(((Number(value) || 0) / baseServings) * 100) / 100;

  return {
    ...food,
    portion: stripServingMultiplier(food.portion),
    calories: normalizeMacro(food.calories),
    protein: normalizeMacro(food.protein),
    carbs: normalizeMacro(food.carbs),
    fat: normalizeMacro(food.fat),
    macrosPer100: false,
  };
}

const SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
const SEARCH_CACHE_MAX_ENTRIES = 40;

export default function AddMealModal({
  visible,
  onClose,
  editingMeal,
  addingMealType,
  searchFood,
  addMeal,
  updateMeal,
  selectedDate,
  favoriteFoods,
  addFavorite,
  removeFavorite,
  isFavorite,
  recentSearches,
  mealTemplates,
  addMealTemplate,
  removeMealTemplate,
  scanHistory,
  rememberBarcodeScan,
  clearScanHistory,
  isGuest,
  user,
  launchMode = 'search',
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [portion, setPortion] = useState('100');
  const [portionMode, setPortionMode] = useState('grams');
  const [modalTab, setModalTab] = useState('search');
  
  // Custom meal states
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customPortionLabel, setCustomPortionLabel] = useState('1 piece');
  const [entryType, setEntryType] = useState(null); // 'per100g' veya 'exactServing'
  const [customAmount, setCustomAmount] = useState('100'); // gram miktarı
  const searchIsBarcode = /^[0-9]{8,14}$/.test(searchQuery.trim());
  const hasSearchQuery = Boolean(searchQuery.trim());
  const usdaProxyEnabled = Boolean(String(process.env.EXPO_PUBLIC_USDA_PROXY_URL || '').trim());
  const searchRequestIdRef = useRef(0);
  const searchResultsCacheRef = useRef(new Map());
  const searchInFlightRef = useRef(new Map());
  const autoLaunchBarcodeRef = useRef(false);
  const suggestedQueries = ['chicken breast', 'greek yogurt', 'banana', 'rice'];
  const [showScanner, setShowScanner] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);

  // Initialize editing meal
  useEffect(() => {
    if (editingMeal?.isCustom && visible) {
      setShowCustomForm(true);
      setSelectedFood(null);
      setModalTab('search');
      setSearchQuery('');
      setSearchResults([]);
      setPortionMode('grams');
      setPortion('100');
      setCustomName(editingMeal.name || '');
      setCustomCalories(String(editingMeal.calories || ''));
      setCustomProtein(String(editingMeal.protein || ''));
      setCustomCarbs(String(editingMeal.carbs || ''));
      setCustomFat(String(editingMeal.fat || ''));
      setCustomPortionLabel(editingMeal.portion || '1 piece');
      setEntryType('exactServing');
      return;
    }

    if (editingMeal && visible) {
      const gramPortion = parseGramValue(editingMeal.portion);

      if (gramPortion) {
        const multiplier = gramPortion / 100;
        setPortionMode('grams');
        setSelectedFood({
          name: editingMeal.name,
          brand: editingMeal.brand,
          calories: Math.round((editingMeal.calories / multiplier) * 100) / 100,
          protein: Math.round((editingMeal.protein / multiplier) * 100) / 100,
          carbs: Math.round((editingMeal.carbs / multiplier) * 100) / 100,
          fat: Math.round((editingMeal.fat / multiplier) * 100) / 100,
          source: editingMeal.source,
          sourceId: editingMeal.sourceId,
          isVerified: editingMeal.isVerified,
          barcode: editingMeal.barcode,
          image: editingMeal.image,
          servingSize: editingMeal.servingSize,
          servingQuantity: editingMeal.servingQuantity,
          macrosPer100: true,
        });
        setPortion(gramPortion.toString());
        return;
      }

      const normalizedServingFood = normalizeServingBasedFood(editingMeal);
      setPortionMode('servings');
      setSelectedFood({
        name: normalizedServingFood.name,
        brand: normalizedServingFood.brand,
        calories: normalizedServingFood.calories,
        protein: normalizedServingFood.protein,
        carbs: normalizedServingFood.carbs,
        fat: normalizedServingFood.fat,
        source: normalizedServingFood.source,
        sourceId: normalizedServingFood.sourceId,
        isVerified: normalizedServingFood.isVerified,
        barcode: normalizedServingFood.barcode,
        image: normalizedServingFood.image,
        servingSize: normalizedServingFood.servingSize,
        servingQuantity: normalizedServingFood.servingQuantity,
        macrosPer100: false,
        portion: normalizedServingFood.portion,
      });
      setPortion(parseServingCountFromLabel(editingMeal.portion).toString());
    }
  }, [editingMeal, visible]);

  useEffect(() => {
    if (!visible || editingMeal) return;

    autoLaunchBarcodeRef.current = false;

    if (launchMode === 'favorites') {
      setModalTab('favorites');
      setShowCustomForm(false);
      setSelectedFood(null);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    if (launchMode === 'custom') {
      setModalTab('search');
      setShowCustomForm(true);
      setSelectedFood(null);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    if (launchMode === 'templates') {
      setModalTab('templates');
      setShowCustomForm(false);
      setSelectedFood(null);
      setSearchQuery('');
      setSearchResults([]);
      return;
    }

    setModalTab('search');
    setShowCustomForm(false);
    setSelectedFood(null);
    setSearchResults([]);
    setSearchQuery('');
  }, [visible, launchMode, editingMeal]);

  useEffect(() => {
    if (!visible || editingMeal || launchMode !== 'barcode' || autoLaunchBarcodeRef.current) return;
    autoLaunchBarcodeRef.current = true;
    openScanner();
  }, [visible, editingMeal, launchMode, cameraPermission]);

  const resetState = () => {
    setSelectedFood(null);
    setSearchQuery('');
    setSearchResults([]);
    setLoading(false);
    setShowCustomForm(false);
    setCustomName('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomCarbs('');
    setCustomFat('');
    setCustomPortionLabel('1 piece');
    setModalTab('search');
    setPortion('100');
    setPortionMode('grams');
    setEntryType(null);
    setCustomAmount('100');
    setShowScanner(false);
    setHasScanned(false);
    setTorchEnabled(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const executeSearch = async (query) => {
    const normalized = String(query || '').trim();
    const requestId = Date.now();
    searchRequestIdRef.current = requestId;

    if (!normalized) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const cacheKey = normalized.toLowerCase();
    const cachedEntry = searchResultsCacheRef.current.get(cacheKey);
    if (
      cachedEntry &&
      Array.isArray(cachedEntry.results) &&
      (Date.now() - cachedEntry.timestamp) < SEARCH_CACHE_TTL_MS
    ) {
      if (searchRequestIdRef.current === requestId) {
        setSearchResults(cachedEntry.results);
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      let pendingRequest = searchInFlightRef.current.get(cacheKey);
      if (!pendingRequest) {
        const createdRequest = searchFood(normalized)
          .then(results => (Array.isArray(results) ? results : []))
          .finally(() => {
            const activeRequest = searchInFlightRef.current.get(cacheKey);
            if (activeRequest === createdRequest) {
              searchInFlightRef.current.delete(cacheKey);
            }
          });
        searchInFlightRef.current.set(cacheKey, createdRequest);
        pendingRequest = createdRequest;
      }

      const results = await pendingRequest;
      if (searchRequestIdRef.current === requestId) {
        setSearchResults(results || []);
        const safeResults = Array.isArray(results) ? results : [];
        const nextCache = searchResultsCacheRef.current;
        nextCache.set(cacheKey, {
          timestamp: Date.now(),
          results: safeResults,
        });
        while (nextCache.size > SEARCH_CACHE_MAX_ENTRIES) {
          const oldestKey = nextCache.keys().next().value;
          if (oldestKey === undefined) break;
          nextCache.delete(oldestKey);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      if (searchRequestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  };

  const handleSearch = async () => {
    await executeSearch(searchQuery);
  };

  const handleRecentSearch = (value) => {
    setSearchQuery(value);
  };

  const openScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Camera Permission', 'Camera permission is required to scan barcodes.');
        setModalTab('search');
        return;
      }
    }
    setHasScanned(false);
    setTorchEnabled(false);
    setShowScanner(true);
  };

  const handleBarcodeScanned = ({ data }) => {
    if (!data || hasScanned) return;
    setHasScanned(true);
    setShowScanner(false);
    setTorchEnabled(false);
    rememberBarcodeScan?.(String(data));
    setSearchQuery(String(data));
  };

  useEffect(() => {
    if (!visible || modalTab !== 'search' || showCustomForm || selectedFood) return;

    const normalized = searchQuery.trim();
    if (!normalized) {
      setSearchResults([]);
      setLoading(false);
      return;
    }

    const timeoutMs = searchIsBarcode ? 250 : 450;
    const timeoutId = setTimeout(() => {
      executeSearch(searchQuery);
    }, timeoutMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, visible, modalTab, showCustomForm, selectedFood, searchIsBarcode]);

  const handleSelectFood = (food) => {
    if (isServingBasedFood(food)) {
      const normalizedServingFood = normalizeServingBasedFood(food);
      const defaultServings = parseServingCountFromLabel(food?.portion);
      setSelectedFood(normalizedServingFood);
      setPortionMode('servings');
      setPortion(String(defaultServings));
      return;
    }

    setSelectedFood(food);
    setPortionMode('grams');
    setPortion(resolveInitialPortion(food).toString());
  };

  const handleAddMeal = () => {
    if (!selectedFood) return;
    const isServingMode = portionMode === 'servings';
    const grams = isServingMode ? null : parseGramValue(portion);
    const servings = isServingMode ? parseServingCount(portion) : null;

    if (!isServingMode && !grams) {
      Alert.alert('Invalid Amount', 'Please enter a valid gram amount.');
      return;
    }
    if (isServingMode && !servings) {
      Alert.alert('Invalid Amount', 'Please enter a valid serving count.');
      return;
    }

    const baseAmount = isServingMode
      ? 1
      : (selectedFood.macrosPer100 === false ? resolveInitialPortion(selectedFood) : 100);
    const effectiveAmount = isServingMode ? servings : grams;
    const multiplier = effectiveAmount / baseAmount;
    const mealData = {
      name: selectedFood.name,
      brand: selectedFood.brand,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: Math.round(selectedFood.protein * multiplier),
      carbs: Math.round(selectedFood.carbs * multiplier),
      fat: Math.round(selectedFood.fat * multiplier),
      portion: isServingMode ? buildServingLabel(selectedFood, servings) : `${grams}g`,
      mealType: addingMealType,
      source: selectedFood.source || 'custom',
      sourceId: selectedFood.sourceId || null,
      servingSize: selectedFood.servingSize || null,
      servingQuantity: selectedFood.servingQuantity || null,
      barcode: selectedFood.barcode || null,
      image: selectedFood.image || null,
      isVerified: Boolean(selectedFood.isVerified),
      isCustom: Boolean(selectedFood.isCustom || selectedFood.source === 'custom'),
    };

    if (editingMeal) {
      updateMeal(editingMeal.id, mealData, selectedDate);
    } else {
      addMeal(mealData, selectedDate);
    }

    if (mealData.barcode) {
      rememberBarcodeScan?.(mealData.barcode, mealData.name);
    }
    
    handleClose();
  };

  const handleSaveTemplate = () => {
    if (!selectedFood) return;
    const isServingMode = portionMode === 'servings';
    const grams = isServingMode ? null : parseGramValue(portion);
    const servings = isServingMode ? parseServingCount(portion) : null;

    if (!isServingMode && !grams) {
      Alert.alert('Invalid Amount', 'Please enter a valid gram amount before saving template.');
      return;
    }
    if (isServingMode && !servings) {
      Alert.alert('Invalid Amount', 'Please enter a valid serving count before saving template.');
      return;
    }

    const saved = addMealTemplate?.(
      isServingMode
        ? {
            name: selectedFood.name,
            brand: selectedFood.brand,
            calories: Math.round((Number(selectedFood.calories) || 0) * servings),
            protein: Math.round((Number(selectedFood.protein) || 0) * servings),
            carbs: Math.round((Number(selectedFood.carbs) || 0) * servings),
            fat: Math.round((Number(selectedFood.fat) || 0) * servings),
            portion: buildServingLabel(selectedFood, servings),
            mealType: addingMealType,
            source: selectedFood.source || 'custom',
            sourceId: selectedFood.sourceId || null,
            servingSize: selectedFood.servingSize || null,
            servingQuantity: selectedFood.servingQuantity || null,
            barcode: selectedFood.barcode || null,
            image: selectedFood.image || null,
            isVerified: Boolean(selectedFood.isVerified),
            isCustom: Boolean(selectedFood.isCustom || selectedFood.source === 'custom'),
            macrosPer100: false,
          }
        : {
            name: selectedFood.name,
            brand: selectedFood.brand,
            calories: Math.round(selectedFood.calories),
            protein: Math.round(selectedFood.protein),
            carbs: Math.round(selectedFood.carbs),
            fat: Math.round(selectedFood.fat),
            portion: `${grams}g`,
            mealType: addingMealType,
            source: selectedFood.source || 'custom',
            sourceId: selectedFood.sourceId || null,
            servingSize: selectedFood.servingSize || null,
            servingQuantity: grams,
            barcode: selectedFood.barcode || null,
            image: selectedFood.image || null,
            isVerified: Boolean(selectedFood.isVerified),
            isCustom: Boolean(selectedFood.isCustom || selectedFood.source === 'custom'),
            macrosPer100: true,
          }
    );

    Alert.alert(saved ? 'Saved' : 'Already Added', saved ? 'Meal template saved.' : 'This template already exists.');
  };

  const handleAddCustomMeal = () => {
    if (!customName.trim()) {
      Alert.alert('Error', 'Food name is required');
      return;
    }

    const protein = parseFloat(customProtein) || 0;
    const carbs = parseFloat(customCarbs) || 0;
    const fat = parseFloat(customFat) || 0;

    let calories = parseFloat(customCalories) || 0;
    if (!customCalories.trim() && (protein > 0 || carbs > 0 || fat > 0)) {
      calories = Math.round((protein * 4) + (carbs * 4) + (fat * 9));
    }

    if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) {
      Alert.alert('Error', 'Enter at least calories or macro values');
      return;
    }

    const brandName = isGuest ? 'Guest' : (user?.email?.split('@')[0] || 'User');

    let finalCalories, finalProtein, finalCarbs, finalFat, portionText;

    if (entryType === 'per100g') {
      // Per 100g entry, calculate based on amount
      const amount = parseFloat(customAmount) || 100;
      const multiplier = amount / 100;
      finalCalories = Math.round(calories * multiplier);
      finalProtein = Math.round(protein * multiplier);
      finalCarbs = Math.round(carbs * multiplier);
      finalFat = Math.round(fat * multiplier);
      portionText = `${amount}g`;
    } else {
      // Exact serving entry, use directly
      finalCalories = Math.round(calories);
      finalProtein = Math.round(protein);
      finalCarbs = Math.round(carbs);
      finalFat = Math.round(fat);
      portionText = customPortionLabel.trim() || '1 piece';
    }

    const meal = {
      name: customName.trim(),
      brand: brandName,
      calories: finalCalories,
      protein: finalProtein,
      carbs: finalCarbs,
      fat: finalFat,
      portion: portionText,
      isCustom: true,
      mealType: addingMealType,
      source: 'custom',
      sourceId: null,
      barcode: null,
      image: null,
      isVerified: false,
    };

    if (editingMeal) {
      updateMeal(editingMeal.id, meal, selectedDate);
    } else {
      addMeal(meal, selectedDate);
    }
    handleClose();
  };

  const parsedPortion = parseGramValue(portion);
  const portionMultiplier = parsedPortion ? parsedPortion / 100 : 0;
  const servingCount = parseServingCount(portion);
  const servingMultiplier = servingCount || 0;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{editingMeal ? 'Edit Meal' : 'Add Meal'}</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          {!selectedFood && !showCustomForm ? (
            <>
              {/* TAB SELECTOR: Search / Favorites / Templates */}
              <View style={styles.modalTabs}>
                <TouchableOpacity 
                  style={[styles.modalTabBtn, modalTab === 'search' && styles.modalTabBtnActive]}
                  onPress={() => setModalTab('search')}
                >
                  <Ionicons name="search" size={18} color={modalTab === 'search' ? '#fff' : '#888'} />
                  <Text style={[styles.modalTabText, modalTab === 'search' && styles.modalTabTextActive]}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalTabBtn, modalTab === 'favorites' && styles.modalTabBtnActive]}
                  onPress={() => setModalTab('favorites')}
                >
                  <Ionicons name="heart" size={18} color={modalTab === 'favorites' ? '#fff' : '#888'} />
                  <Text style={[styles.modalTabText, modalTab === 'favorites' && styles.modalTabTextActive]}>
                    Favorites {favoriteFoods.length > 0 && `(${favoriteFoods.length})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalTabBtn, modalTab === 'templates' && styles.modalTabBtnActive]}
                  onPress={() => setModalTab('templates')}
                >
                  <Ionicons name="albums-outline" size={18} color={modalTab === 'templates' ? '#fff' : '#888'} />
                  <Text style={[styles.modalTabText, modalTab === 'templates' && styles.modalTabTextActive]}>
                    Templates {mealTemplates.length > 0 && `(${mealTemplates.length})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {modalTab === 'search' ? (
                <>
                  {/* SEARCH */}
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder={launchMode === 'barcode' ? 'Type barcode digits' : 'Search food or barcode'}
                      placeholderTextColor="#666"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} disabled={loading}>
                      {loading ? (
                        <ActivityIndicator size="small" color="white" />
                      ) : (
                        <Ionicons name="search" size={24} color="white" />
                      )}
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.searchHelperText}>
                    {searchIsBarcode
                      ? usdaProxyEnabled
                        ? 'Barcode mode: OpenFoodFacts first, USDA fallback if needed.'
                        : 'Barcode mode: OpenFoodFacts product lookup is running automatically.'
                      : usdaProxyEnabled
                        ? 'Text search: USDA first, OpenFoodFacts fallback for broader coverage.'
                        : 'Search runs on OpenFoodFacts and updates automatically while you type.'}
                  </Text>

                  {!hasSearchQuery ? (
                    <>
                      <View style={styles.quickAccessRow}>
                        <TouchableOpacity
                          style={[styles.quickAccessCard, styles.quickAccessCardAccent]}
                          onPress={() => {
                            setModalTab('favorites');
                            setSearchQuery('');
                          }}
                        >
                          <Ionicons name="heart" size={20} color="#CF6679" />
                          <Text style={styles.quickAccessTitle}>Favorites</Text>
                          <Text style={styles.quickAccessMeta}>{favoriteFoods.length} saved foods</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.quickAccessCard}
                          onPress={() => setShowCustomForm(true)}
                        >
                          <Ionicons name="create-outline" size={20} color="#BB86FC" />
                          <Text style={styles.quickAccessTitle}>Custom Meal</Text>
                          <Text style={styles.quickAccessMeta}>Add your own macros</Text>
                        </TouchableOpacity>
                      </View>

                      <TouchableOpacity
                        style={[styles.barcodeCard, searchIsBarcode && styles.barcodeCardActive]}
                        onPress={openScanner}
                        activeOpacity={0.85}
                      >
                        <View style={styles.barcodeIconWrap}>
                          <Ionicons name="barcode-outline" size={22} color={searchIsBarcode ? '#121212' : '#BB86FC'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.barcodeTitle}>Barcode-friendly search</Text>
                          <Text style={styles.barcodeSubtitle}>
                            Scan with camera or paste EAN/UPC digits to jump straight to packaged foods.
                          </Text>
                        </View>
                        <Ionicons name="scan-outline" size={22} color={searchIsBarcode ? '#121212' : '#BB86FC'} />
                      </TouchableOpacity>
                    </>
                  ) : null}

                  {!hasSearchQuery && recentSearches?.length ? (
                    <View style={styles.recentSearchSection}>
                      <Text style={styles.recentSearchTitle}>Recent searches</Text>
                      <View style={styles.recentSearchRow}>
                        {recentSearches.map(item => (
                          <TouchableOpacity
                            key={item}
                            style={styles.recentSearchChip}
                            onPress={() => handleRecentSearch(item)}
                          >
                            <Text style={styles.recentSearchChipText}>{item}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  {!hasSearchQuery ? (
                    <View style={styles.discoverySection}>
                      <Text style={styles.discoveryTitle}>Try these searches</Text>
                      <View style={styles.discoveryChipRow}>
                        {suggestedQueries.map(item => (
                          <TouchableOpacity
                            key={item}
                            style={styles.discoveryChip}
                            onPress={() => handleRecentSearch(item)}
                          >
                            <Text style={styles.discoveryChipText}>{item}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : null}

                  <View style={styles.resultsContainer}>
                    {loading ? (
                      <ActivityIndicator size="large" color="#BB86FC" style={{ marginTop: 50 }} />
                    ) : (
                      <FlatList
                        style={styles.resultsList}
                        contentContainerStyle={styles.resultsListContent}
                        keyboardShouldPersistTaps="handled"
                        data={searchResults}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => {
                        const isItemFavorite = isFavorite(item);
                        return (
                          <TouchableOpacity 
                            style={styles.resultItem}
                            onPress={() => handleSelectFood(item)}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={styles.resultName}>{item.name}</Text>
                              {item.brand ? <Text style={styles.resultBrand}>{item.brand}</Text> : null}
                              <View style={styles.resultBadgeRow}>
                                <Text style={styles.resultSourceBadge}>
                                  {item.source === 'off' ? 'OFF' : item.source.toUpperCase()}
                                </Text>
                                {item.isVerified ? <Text style={styles.resultVerifiedBadge}>VERIFIED</Text> : null}
                              </View>
                              <Text style={styles.resultMacros}>
                                {item.macrosPer100 === false
                                  ? `${item.portion || '1 serving'}: ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`
                                  : `100g: ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`}
                              </Text>
                              {item.servingSize ? (
                                <Text style={styles.servingInfo}>1 serving: {item.servingSize}</Text>
                              ) : null}
                            </View>
                            <TouchableOpacity 
                              onPress={() => isItemFavorite ? null : addFavorite(item)}
                              style={styles.favoriteBtn}
                            >
                              <Ionicons 
                                name={isItemFavorite ? "heart" : "heart-outline"} 
                                size={24} 
                                color={isItemFavorite ? "#CF6679" : "#888"} 
                              />
                            </TouchableOpacity>
                            <Ionicons name="add-circle" size={28} color="#BB86FC" />
                          </TouchableOpacity>
                        );
                        }}
                        ListEmptyComponent={
                          searchQuery && !loading ? (
                            <View style={styles.searchEmptyState}>
                              <Ionicons name={searchIsBarcode ? 'barcode-outline' : 'search-outline'} size={42} color="#444" />
                              <Text style={styles.searchEmptyTitle}>
                                {searchIsBarcode ? 'No barcode match found' : 'No foods found'}
                              </Text>
                              <Text style={styles.searchEmptyText}>
                                {searchIsBarcode
                                  ? 'Try another barcode or search by product name.'
                                  : 'Try a more exact product name or include the brand.'}
                              </Text>
                              <TouchableOpacity
                                style={styles.searchEmptyAction}
                                onPress={() => setShowCustomForm(true)}
                              >
                                <Ionicons name="create-outline" size={16} color="#BB86FC" />
                                <Text style={styles.searchEmptyActionText}>Create custom meal instead</Text>
                              </TouchableOpacity>
                            </View>
                          ) : null
                        }
                      />
                    )}
                  </View>
                </>
              ) : modalTab === 'favorites' ? (
                /* FAVORITES TAB */
                <View style={styles.resultsContainer}>
                  <FlatList
                    style={styles.resultsList}
                    contentContainerStyle={styles.resultsListContent}
                    keyboardShouldPersistTaps="handled"
                    data={favoriteFoods}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.resultItem}
                      onPress={() => handleSelectFood(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        {item.brand ? <Text style={styles.resultBrand}>{item.brand}</Text> : null}
                        <View style={styles.resultBadgeRow}>
                          <Text style={styles.resultSourceBadge}>
                            {item.source === 'off' ? 'OFF' : item.source?.toUpperCase() || 'SAVE'}
                          </Text>
                          {item.isVerified ? <Text style={styles.resultVerifiedBadge}>VERIFIED</Text> : null}
                        </View>
                        <Text style={styles.resultMacros}>
                          {item.macrosPer100 === false
                            ? `${item.portion || '1 serving'}: ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`
                            : `100g: ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`}
                        </Text>
                        {item.servingSize ? (
                          <Text style={styles.servingInfo}>1 serving: {item.servingSize}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity 
                        onPress={() => removeFavorite(item.id)}
                        style={styles.favoriteBtn}
                      >
                        <Ionicons name="heart-dislike" size={24} color="#CF6679" />
                      </TouchableOpacity>
                      <Ionicons name="add-circle" size={28} color="#BB86FC" />
                    </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyFavorites}>
                        <Ionicons name="heart-outline" size={48} color="#444" />
                        <Text style={styles.emptyFavoritesText}>No favorite foods yet</Text>
                        <Text style={styles.emptyFavoritesSubtext}>
                          Tap the ❤️ icon in search results{'\n'}to add to favorites
                        </Text>
                      </View>
                    }
                  />
                </View>
              ) : (
                <View style={styles.resultsContainer}>
                  <FlatList
                    style={styles.resultsList}
                    contentContainerStyle={styles.resultsListContent}
                    keyboardShouldPersistTaps="handled"
                    data={mealTemplates}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.resultItem}
                      onPress={() => handleSelectFood(item)}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={styles.resultName}>{item.name}</Text>
                        {item.brand ? <Text style={styles.resultBrand}>{item.brand}</Text> : null}
                        <View style={styles.resultBadgeRow}>
                          <Text style={styles.resultSourceBadge}>
                            {item.source === 'off' ? 'OFF' : item.source?.toUpperCase() || 'TEMPLATE'}
                          </Text>
                          <Text style={styles.templateBadge}>TEMPLATE</Text>
                        </View>
                        <Text style={styles.resultMacros}>
                          {item.macrosPer100
                            ? `100g: ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`
                            : `${item.portion} • ${item.calories} kcal • P:${item.protein}g • C:${item.carbs}g • F:${item.fat}g`}
                        </Text>
                        {item.macrosPer100 && item.servingQuantity ? (
                          <Text style={styles.servingInfo}>Default amount: {item.servingQuantity}g</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity 
                        onPress={() => removeMealTemplate(item.id)}
                        style={styles.favoriteBtn}
                      >
                        <Ionicons name="trash-outline" size={22} color="#CF6679" />
                      </TouchableOpacity>
                      <Ionicons name="add-circle" size={28} color="#BB86FC" />
                    </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyFavorites}>
                        <Ionicons name="albums-outline" size={48} color="#444" />
                        <Text style={styles.emptyFavoritesText}>No meal templates yet</Text>
                        <Text style={styles.emptyFavoritesSubtext}>
                          Save a meal from the portion screen or long press a logged meal.
                        </Text>
                      </View>
                    }
                  />
                </View>
              )}
            </>
          ) : showCustomForm ? (
            /* CUSTOM MEAL FORM */
            <KeyboardAvoidingView 
              style={styles.customFormContainer} 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <Text style={styles.customFormTitle}>{editingMeal ? 'Edit Custom Meal' : 'Create Custom Meal'}</Text>
              
              {!entryType ? (
                /* STEP 1: Entry type selection */
                <View style={styles.entryTypeContainer}>
                  <Text style={styles.entryTypeQuestion}>
                    How would you like to enter the nutritional values?
                  </Text>
                  
                  <TouchableOpacity 
                    style={styles.entryTypeBtn}
                    onPress={() => setEntryType('per100g')}
                  >
                    <Ionicons name="scale-outline" size={32} color="#BB86FC" />
                    <View style={styles.entryTypeBtnContent}>
                      <Text style={styles.entryTypeBtnTitle}>Per 100 grams</Text>
                      <Text style={styles.entryTypeBtnDesc}>
                        Enter values per 100g, then specify the amount
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.entryTypeBtn}
                    onPress={() => setEntryType('exactServing')}
                  >
                    <Ionicons name="nutrition-outline" size={32} color="#BB86FC" />
                    <View style={styles.entryTypeBtnContent}>
                      <Text style={styles.entryTypeBtnTitle}>Exact serving</Text>
                      <Text style={styles.entryTypeBtnDesc}>
                        Enter total values for 1 piece, 1 cup, 2 tbsp, etc.
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.backBtn}
                    onPress={() => setShowCustomForm(false)}
                  >
                    <Text style={styles.backBtnText}>Back</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* STEP 2: Value entry */
                <ScrollView 
                  style={styles.customFormScroll}
                  contentContainerStyle={styles.customFormScrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.customFormSubtitle}>
                    {entryType === 'per100g' 
                      ? '📝 Enter values per 100 grams' 
                      : '📝 Enter total values for the serving you actually eat'}
                  </Text>
                  
                  <Text style={styles.inputLabel}>Food Name *</Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="E.g., Homemade rice"
                    placeholderTextColor="#666"
                    value={customName}
                    onChangeText={setCustomName}
                  />

                  <Text style={styles.inputLabel}>
                    Calories {entryType === 'per100g' ? '/ 100g' : '/ serving'} (optional)
                  </Text>
                  <TextInput
                    style={styles.customInput}
                    placeholder="Leave empty to calculate from macros"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={customCalories}
                    onChangeText={setCustomCalories}
                  />

                  <View style={styles.macroInputRow}>
                    <View style={styles.macroInputItem}>
                      <Text style={styles.inputLabel}>
                        Protein {entryType === 'per100g' ? '/ 100g' : '/ serving'}
                      </Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={customProtein}
                        onChangeText={setCustomProtein}
                      />
                    </View>
                    <View style={styles.macroInputItem}>
                      <Text style={styles.inputLabel}>
                        Carbs {entryType === 'per100g' ? '/ 100g' : '/ serving'}
                      </Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={customCarbs}
                        onChangeText={setCustomCarbs}
                      />
                    </View>
                    <View style={styles.macroInputItem}>
                      <Text style={styles.inputLabel}>
                        Fat {entryType === 'per100g' ? '/ 100g' : '/ serving'}
                      </Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="0"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={customFat}
                        onChangeText={setCustomFat}
                      />
                    </View>
                  </View>

                  {entryType === 'per100g' && (
                    <>
                      <Text style={styles.inputLabel}>Amount (grams) *</Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="100"
                        placeholderTextColor="#666"
                        keyboardType="numeric"
                        value={customAmount}
                        onChangeText={setCustomAmount}
                      />
                      <View style={styles.quickPortionsCustom}>
                        {['50', '100', '150', '200', '250'].map((g) => (
                          <TouchableOpacity 
                            key={g}
                            style={[styles.quickBtnSmall, customAmount === g && styles.quickBtnSmallActive]}
                            onPress={() => setCustomAmount(g)}
                          >
                            <Text style={[styles.quickBtnSmallText, customAmount === g && styles.quickBtnSmallTextActive]}>{g}g</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  {entryType !== 'per100g' && (
                    <>
                      <Text style={styles.inputLabel}>Serving label *</Text>
                      <TextInput
                        style={styles.customInput}
                        placeholder="Examples: 1 piece, 3 whites, 1 bowl"
                        placeholderTextColor="#666"
                        value={customPortionLabel}
                        onChangeText={setCustomPortionLabel}
                      />
                    </>
                  )}

                  {/* Preview */}
                  {(customCalories || customProtein || customCarbs || customFat) && (
                    <View style={styles.customPreviewCard}>
                      <Text style={styles.customPreviewTitle}>To be added:</Text>
                      <Text style={styles.customPreviewCalories}>
                        {(() => {
                          const cal = parseFloat(customCalories) || ((parseFloat(customProtein) || 0) * 4 + (parseFloat(customCarbs) || 0) * 4 + (parseFloat(customFat) || 0) * 9);
                          if (entryType === 'per100g') {
                            return Math.round(cal * (parseFloat(customAmount) || 100) / 100);
                          }
                          return Math.round(cal);
                        })()} kcal
                      </Text>
                      <Text style={styles.customPreviewPortion}>
                        {entryType === 'per100g' ? `${customAmount || 100}g` : (customPortionLabel || '1 piece')}
                      </Text>
                    </View>
                  )}

                  <Text style={styles.calorieHint}>
                    💡 Calorie calculation: Protein×4 + Carbs×4 + Fat×9
                  </Text>

                  <View style={styles.buttonRow}>
                    <TouchableOpacity 
                      style={styles.backBtn}
                      onPress={() => setEntryType(null)}
                    >
                      <Text style={styles.backBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.addBtn}
                      onPress={handleAddCustomMeal}
                    >
                      <Text style={styles.addBtnText}>{editingMeal ? 'Update' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          ) : (
            /* PORTION INPUT */
            <View style={styles.portionContainer}>
              <Text style={styles.selectedName}>{selectedFood.name}</Text>
              <View style={styles.selectedBadgeRow}>
                <Text style={styles.resultSourceBadge}>
                  {selectedFood.source === 'off' ? 'OFF' : selectedFood.source?.toUpperCase() || 'FOOD'}
                </Text>
                {selectedFood.isVerified ? <Text style={styles.resultVerifiedBadge}>VERIFIED</Text> : null}
              </View>
              <Text style={styles.selectedInfo}>
                {portionMode === 'servings'
                  ? `${selectedFood.portion || '1 serving'}: ${selectedFood.calories} kcal`
                  : `100g: ${selectedFood.calories} kcal`}
              </Text>
              {selectedFood.servingSize ? (
                <Text style={styles.servingHint}>
                  1 serving = {selectedFood.servingSize}
                </Text>
              ) : null}

              <Text style={styles.portionLabel}>
                {portionMode === 'servings' ? 'Serving count' : 'Amount (grams)'}
              </Text>
              <TextInput
                style={styles.portionInput}
                keyboardType="numeric"
                value={portion}
                onChangeText={setPortion}
                placeholder={portionMode === 'servings' ? '1' : '100'}
                placeholderTextColor="#666"
              />

              <View style={styles.quickPortions}>
                {portionMode === 'servings' ? (
                  ['0.5', '1', '1.5', '2'].map((count) => (
                    <TouchableOpacity
                      key={count}
                      style={styles.quickBtn}
                      onPress={() => setPortion(count)}
                    >
                      <Text style={styles.quickBtnText}>{count}x</Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <>
                    {/* If serving info exists, show it first */}
                    {selectedFood.servingQuantity ? (
                      <TouchableOpacity 
                        style={[styles.quickBtn, styles.servingBtn]}
                        onPress={() => setPortion(selectedFood.servingQuantity.toString())}
                      >
                        <Text style={styles.quickBtnText}>1 serving</Text>
                        <Text style={styles.quickBtnSubtext}>({selectedFood.servingQuantity}g)</Text>
                      </TouchableOpacity>
                    ) : null}
                    {['50', '100', '150', '200'].map((p) => (
                      <TouchableOpacity 
                        key={p} 
                        style={styles.quickBtn}
                        onPress={() => setPortion(p)}
                      >
                        <Text style={styles.quickBtnText}>{p}g</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </View>

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>To be added</Text>
                <Text style={styles.previewCalories}>
                  {Math.round(
                    selectedFood.calories * (portionMode === 'servings' ? servingMultiplier : portionMultiplier)
                  )} kcal
                </Text>
                <Text style={styles.previewMacros}>
                  P: {Math.round(
                    selectedFood.protein * (portionMode === 'servings' ? servingMultiplier : portionMultiplier)
                  )}g • 
                  C: {Math.round(
                    selectedFood.carbs * (portionMode === 'servings' ? servingMultiplier : portionMultiplier)
                  )}g • 
                  F: {Math.round(
                    selectedFood.fat * (portionMode === 'servings' ? servingMultiplier : portionMultiplier)
                  )}g
                </Text>
              </View>

              <View style={styles.buttonRow}>
                {!editingMeal ? (
                  <TouchableOpacity 
                    style={styles.secondaryActionBtn}
                    onPress={handleSaveTemplate}
                  >
                    <Text style={styles.secondaryActionBtnText}>Save Template</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity 
                  style={styles.backBtn}
                  onPress={() => {
                    if (editingMeal) {
                      handleClose();
                    } else {
                      setSelectedFood(null);
                    }
                  }}
                >
                  <Text style={styles.backBtnText}>{editingMeal ? 'Cancel' : 'Back'}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.addBtn}
                  onPress={handleAddMeal}
                >
                  <Text style={styles.addBtnText}>{editingMeal ? 'Update' : 'Add'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      <Modal visible={showScanner} animationType="slide" presentationStyle="fullScreen">
        <SafeAreaView style={styles.scannerSafeArea} edges={['top', 'bottom']}>
        <View style={styles.scannerContainer}>
          <View style={styles.scannerHeader}>
            <View>
              <Text style={styles.scannerTitle}>Scan Barcode</Text>
              <Text style={styles.scannerSubtitle}>Center EAN or UPC code inside the frame</Text>
            </View>
            <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.scannerCloseBtn}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <View style={styles.scannerViewport}>
            {cameraPermission?.granted ? (
                <CameraView
                  style={styles.scannerCamera}
                  facing="back"
                  enableTorch={torchEnabled}
                  barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
            ) : (
              <View style={styles.scannerFallback}>
                <Ionicons name="camera-outline" size={40} color="#666" />
                <Text style={styles.scannerFallbackText}>Camera permission is required.</Text>
              </View>
            )}
            <View pointerEvents="none" style={styles.scannerOverlay}>
              <View style={styles.scannerFrame} />
            </View>
          </View>

          <View style={styles.scannerControls}>
            <TouchableOpacity style={styles.scannerActionBtn} onPress={() => setTorchEnabled(prev => !prev)}>
              <Ionicons name={torchEnabled ? 'flash' : 'flash-off'} size={18} color="#BB86FC" />
              <Text style={styles.scannerActionBtnText}>{torchEnabled ? 'Torch On' : 'Torch Off'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.scannerActionBtn} onPress={() => setHasScanned(false)}>
              <Ionicons name="refresh-outline" size={18} color="#BB86FC" />
              <Text style={styles.scannerActionBtnText}>Scan Again</Text>
            </TouchableOpacity>
          </View>

          {scanHistory?.length ? (
            <View style={styles.scanHistorySection}>
              <View style={styles.scanHistoryHeader}>
                <Text style={styles.scanHistoryTitle}>Recent scans</Text>
                <TouchableOpacity
                  onPress={() => {
                    Alert.alert(
                      'Clear Scan History',
                      'Remove all saved barcode scans?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear', style: 'destructive', onPress: () => clearScanHistory?.() },
                      ]
                    );
                  }}
                >
                  <Text style={styles.scanHistoryClearText}>Clear</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scanHistoryRow}>
                {scanHistory.map(item => (
                  <TouchableOpacity
                    key={`${item.barcode}-${item.scannedAt}`}
                    style={styles.scanHistoryChip}
                    onPress={() => {
                      setShowScanner(false);
                      setTorchEnabled(false);
                      setSearchQuery(item.barcode);
                    }}
                  >
                    <Text style={styles.scanHistoryChipLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.scanHistoryChipMeta}>{item.barcode}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <TouchableOpacity style={styles.scannerManualBtn} onPress={() => setShowScanner(false)}>
            <Ionicons name="keypad-outline" size={18} color="#BB86FC" />
            <Text style={styles.scannerManualBtnText}>Enter barcode manually</Text>
          </TouchableOpacity>
        </View>
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
