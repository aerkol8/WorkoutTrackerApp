import React, { useState, useEffect } from 'react';
import { 
  View, Text, FlatList, TextInput, 
  TouchableOpacity, Modal, ActivityIndicator, Alert,
  Keyboard, TouchableWithoutFeedback, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/nutritionStyles';

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
  isGuest,
  user,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState(null);
  const [portion, setPortion] = useState('100');
  const [modalTab, setModalTab] = useState('search');
  
  // Custom meal states
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [entryType, setEntryType] = useState(null); // 'per100g' veya 'perPiece'
  const [customAmount, setCustomAmount] = useState('100'); // gram miktarı

  // Initialize editing meal
  useEffect(() => {
    if (editingMeal && visible) {
      const currentPortion = parseFloat(editingMeal.portion) || 100;
      setSelectedFood({
        name: editingMeal.name,
        brand: editingMeal.brand,
        calories: Math.round((editingMeal.calories / currentPortion) * 100),
        protein: Math.round((editingMeal.protein / currentPortion) * 100),
        carbs: Math.round((editingMeal.carbs / currentPortion) * 100),
        fat: Math.round((editingMeal.fat / currentPortion) * 100),
      });
      setPortion(currentPortion.toString());
    }
  }, [editingMeal, visible]);

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
    setModalTab('search');
    setPortion('100');
    setEntryType(null);
    setCustomAmount('100');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || loading) return;
    setLoading(true);
    try {
      const results = await searchFood(searchQuery);
      setSearchResults(results || []);
    } catch (error) {
      Alert.alert('Error', 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFood = (food) => {
    setSelectedFood(food);
    if (food.servingQuantity) {
      setPortion(food.servingQuantity.toString());
    } else {
      setPortion('100');
    }
  };

  const handleAddMeal = () => {
    if (!selectedFood) return;

    const multiplier = parseFloat(portion) / 100;
    const mealData = {
      name: selectedFood.name,
      brand: selectedFood.brand,
      calories: Math.round(selectedFood.calories * multiplier),
      protein: Math.round(selectedFood.protein * multiplier),
      carbs: Math.round(selectedFood.carbs * multiplier),
      fat: Math.round(selectedFood.fat * multiplier),
      portion: `${portion}g`,
      mealType: addingMealType
    };

    if (editingMeal) {
      updateMeal(editingMeal.id, mealData, selectedDate);
    } else {
      addMeal(mealData, selectedDate);
    }
    
    handleClose();
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
      // Per piece entry, use directly
      finalCalories = Math.round(calories);
      finalProtein = Math.round(protein);
      finalCarbs = Math.round(carbs);
      finalFat = Math.round(fat);
      portionText = '1 piece';
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
      mealType: addingMealType
    };

    addMeal(meal, selectedDate);
    handleClose();
  };

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
              {/* TAB SELECTOR: Search / Favorites */}
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
              </View>

              {modalTab === 'search' ? (
                <>
                  {/* SEARCH */}
                  <View style={styles.searchRow}>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search food (e.g., chicken, rice...)"
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

                  {/* CREATE CUSTOM MEAL BUTTON */}
                  <TouchableOpacity 
                    style={styles.customMealBtn}
                    onPress={() => setShowCustomForm(true)}
                  >
                    <Ionicons name="create-outline" size={20} color="#BB86FC" />
                    <Text style={styles.customMealBtnText}>Create custom meal</Text>
                  </TouchableOpacity>

                  {loading ? (
                    <ActivityIndicator size="large" color="#BB86FC" style={{ marginTop: 50 }} />
                  ) : (
                    <FlatList
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
                              <Text style={styles.resultMacros}>
                                100g: {item.calories} kcal • P:{item.protein}g • C:{item.carbs}g • F:{item.fat}g
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
                          <Text style={styles.emptyText}>No results found</Text>
                        ) : null
                      }
                    />
                  )}
                </>
              ) : (
                /* FAVORITES TAB */
                <FlatList
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
                        <Text style={styles.resultMacros}>
                          100g: {item.calories} kcal • P:{item.protein}g • C:{item.carbs}g • F:{item.fat}g
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
              )}
            </>
          ) : showCustomForm ? (
            /* CUSTOM MEAL FORM */
            <KeyboardAvoidingView 
              style={styles.customFormContainer} 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <Text style={styles.customFormTitle}>Create Custom Meal</Text>
              
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
                    onPress={() => setEntryType('perPiece')}
                  >
                    <Ionicons name="nutrition-outline" size={32} color="#BB86FC" />
                    <View style={styles.entryTypeBtnContent}>
                      <Text style={styles.entryTypeBtnTitle}>Per piece/serving</Text>
                      <Text style={styles.entryTypeBtnDesc}>
                        Enter total values for one serving
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
                      : '📝 Enter total values for 1 piece/serving'}
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
                    Calories {entryType === 'per100g' ? '/ 100g' : '/ 1 piece'} (optional)
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
                        Protein {entryType === 'per100g' ? '/ 100g' : ''}
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
                        Carbs {entryType === 'per100g' ? '/ 100g' : ''}
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
                        Fat {entryType === 'per100g' ? '/ 100g' : ''}
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
                        {entryType === 'per100g' ? `${customAmount || 100}g` : '1 piece'}
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
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </KeyboardAvoidingView>
          ) : (
            /* PORTION INPUT */
            <View style={styles.portionContainer}>
              <Text style={styles.selectedName}>{selectedFood.name}</Text>
              <Text style={styles.selectedInfo}>
                100g: {selectedFood.calories} kcal
              </Text>
              {selectedFood.servingSize ? (
                <Text style={styles.servingHint}>
                  1 serving = {selectedFood.servingSize}
                </Text>
              ) : null}

              <Text style={styles.portionLabel}>Amount (grams)</Text>
              <TextInput
                style={styles.portionInput}
                keyboardType="numeric"
                value={portion}
                onChangeText={setPortion}
                placeholder="100"
                placeholderTextColor="#666"
              />

              <View style={styles.quickPortions}>
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
              </View>

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>To be added</Text>
                <Text style={styles.previewCalories}>
                  {Math.round(selectedFood.calories * (parseFloat(portion) / 100))} kcal
                </Text>
                <Text style={styles.previewMacros}>
                  P: {Math.round(selectedFood.protein * (parseFloat(portion) / 100))}g • 
                  C: {Math.round(selectedFood.carbs * (parseFloat(portion) / 100))}g • 
                  F: {Math.round(selectedFood.fat * (parseFloat(portion) / 100))}g
                </Text>
              </View>

              <View style={styles.buttonRow}>
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
    </Modal>
  );
}
