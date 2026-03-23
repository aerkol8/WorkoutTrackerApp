import React, { useState, useMemo } from 'react';
import { 
  View, Text, FlatList, 
  TouchableOpacity, Modal, Alert,
  ScrollView, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNutrition } from '../../context/NutritionContext';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/nutritionStyles';
import AddMealModal from '../../components/AddMealModal';
import {
  buildNutritionDayInsights,
  buildNutritionPeriodSummary,
  buildWeeklyMacroSeries,
  getGoalStatus,
} from '../../utils/nutritionInsights';
import { toLocalDateKey } from '../../utils/date';

// Meal types
const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { id: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { id: 'snack', label: 'Snack', icon: 'cafe-outline' },
  { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
];

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

export default function NutritionScreen() {
  const { 
    getMealsForDate, 
    getTotalMacros, 
    addMeal, 
    deleteMeal, 
    updateMeal,
    searchFood,
    getTodayKey,
    getDaysWithMeals,
    copyMealsToDate,
    favoriteFoods,
    addFavorite,
    removeFavorite,
    isFavorite,
    recentSearches,
    dailyGoals,
    getGoalProgress,
    updateDailyGoals,
    getRecentMeals,
    mealTemplates,
    addMealTemplate,
    removeMealTemplate,
    scanHistory,
    rememberBarcodeScan,
    clearScanHistory,
    dailyMeals,
  } = useNutrition();
  const { user, isGuest } = useAuth();
  const usdaProxyEnabled = Boolean(String(process.env.EXPO_PUBLIC_USDA_PROXY_URL || '').trim());

  // SELECTED DATE STATES
  const [selectedDate, setSelectedDate] = useState(getTodayKey());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedMealType, setSelectedMealType] = useState('all');

  // Modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [editingMeal, setEditingMeal] = useState(null);
  const [addingMealType, setAddingMealType] = useState('breakfast');
  const [modalLaunchMode, setModalLaunchMode] = useState('search');
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [goalDraft, setGoalDraft] = useState({
    calories: String(dailyGoals.calories),
    protein: String(dailyGoals.protein),
    carbs: String(dailyGoals.carbs),
    fat: String(dailyGoals.fat),
  });

  // MEALS FOR SELECTED DAY
  const allMeals = getMealsForDate(selectedDate);
  const allMacros = getTotalMacros(selectedDate);
  const daysWithMeals = getDaysWithMeals();
  const isToday = selectedDate === getTodayKey();
  const customMealCount = allMeals.filter(meal => meal.isCustom).length;
  const goalProgress = getGoalProgress(selectedDate);
  const recentMeals = getRecentMeals();
  const dayInsights = useMemo(
    () => buildNutritionDayInsights(allMeals, allMacros, dailyGoals),
    [allMeals, allMacros, dailyGoals]
  );
  const weeklySeries = useMemo(
    () => buildWeeklyMacroSeries(dailyMeals, selectedDate),
    [dailyMeals, selectedDate]
  );
  const monthlySummary = useMemo(
    () => buildNutritionPeriodSummary(dailyMeals, selectedDate, 30, dailyGoals),
    [dailyMeals, selectedDate, dailyGoals]
  );

  // MEAL TIME 
  const currentMeals = useMemo(() => {
    if (selectedMealType === 'all') return allMeals;
    return allMeals.filter(m => m.mealType === selectedMealType);
  }, [allMeals, selectedMealType]);

  // MACRO FOR SELECTED MEAL TIME
  const macros = useMemo(() => {
    if (selectedMealType === 'all') {
      return allMacros;
    }
    const meals = currentMeals;
    return {
      calories: meals.reduce((sum, m) => sum + (m.calories || 0), 0),
      protein: meals.reduce((sum, m) => sum + (m.protein || 0), 0),
      carbs: meals.reduce((sum, m) => sum + (m.carbs || 0), 0),
      fat: meals.reduce((sum, m) => sum + (m.fat || 0), 0),
    };
  }, [selectedMealType, allMacros, currentMeals]);

  
  const getMacrosByMealType = (mealType) => {
    const meals = allMeals.filter(m => m.mealType === mealType);
    return {
      calories: meals.reduce((sum, m) => sum + (m.calories || 0), 0),
      count: meals.length
    };
  };

  // Format date
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === getTodayKey()) return 'Today';
    if (dateStr === toLocalDateKey(yesterday)) return 'Yesterday';

    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'long',
      year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
    });
  };

  // CHANGING DATE
  const changeDate = (direction) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + direction);
    const newDate = toLocalDateKey(current);
    if (newDate <= getTodayKey()) {
      setSelectedDate(newDate);
    }
  };

  // CALENDAR DAYS
  const currentMonthDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    
    const days = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      days.push(toLocalDateKey(dateObj));
    }
    return days;
  }, [calendarMonth]);

  // Format month name
  const calendarMonthTitle = useMemo(() => {
    return calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }, [calendarMonth]);

  // PREV MOTNH
  const goToPreviousMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setCalendarMonth(newMonth);
  };

  // NEXT MONTH
  const goToNextMonth = () => {
    const newMonth = new Date(calendarMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setCalendarMonth(newMonth);
  };

  // Go to specific month
  const openCalendar = () => {
    const selectedDateObj = new Date(selectedDate);
    setCalendarMonth(new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1));
    setShowCalendar(true);
  };

  // Copy from past day
  const handleCopyFromDate = (fromDate) => {
    Alert.alert(
      'Copy Meals',
      `Copy meals from ${formatDate(fromDate)} to ${formatDate(selectedDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Copy', 
          onPress: () => {
            copyMealsToDate(fromDate, selectedDate);
            setShowCopyModal(false);
            Alert.alert('Success', 'Meals copied! Tap on them to edit.');
          }
        }
      ]
    );
  };

  const handleEditMeal = (meal) => {
    setEditingMeal(meal);
    setAddingMealType(meal.mealType || 'breakfast');
    setModalLaunchMode('search');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMeal(null);
    setModalLaunchMode('search');
  };

  const handleSaveGoals = () => {
    updateDailyGoals(goalDraft);
    setShowGoalsModal(false);
  };

  const handleQuickRepeatMeal = (meal, { fromTemplate = false } = {}) => {
    const templatePortion = Number(meal.servingQuantity) > 0
      ? Number(meal.servingQuantity)
      : (parseGramValue(meal.portion) || 100);
    const templateMultiplier = fromTemplate && meal.macrosPer100
      ? templatePortion / 100
      : 1;

    addMeal({
      name: meal.name,
      brand: meal.brand,
      calories: Math.round((Number(meal.calories) || 0) * templateMultiplier),
      protein: Math.round((Number(meal.protein) || 0) * templateMultiplier),
      carbs: Math.round((Number(meal.carbs) || 0) * templateMultiplier),
      fat: Math.round((Number(meal.fat) || 0) * templateMultiplier),
      portion: fromTemplate && meal.macrosPer100 ? `${templatePortion}g` : meal.portion,
      mealType: selectedMealType !== 'all' ? selectedMealType : (meal.mealType || 'breakfast'),
      source: meal.source,
      sourceId: meal.sourceId || null,
      servingSize: meal.servingSize || null,
      servingQuantity: meal.servingQuantity || null,
      barcode: meal.barcode || null,
      image: meal.image || null,
      isVerified: Boolean(meal.isVerified),
      isCustom: Boolean(meal.isCustom),
    }, selectedDate);
  };

  const handleSaveTemplate = (meal) => {
    const saved = addMealTemplate(meal);
    Alert.alert(saved ? 'Saved' : 'Already Added', saved ? 'Meal template is ready to reuse.' : 'This meal is already in your templates.');
  };

  const openGoalsModal = () => {
    setGoalDraft({
      calories: String(dailyGoals.calories),
      protein: String(dailyGoals.protein),
      carbs: String(dailyGoals.carbs),
      fat: String(dailyGoals.fat),
    });
    setShowGoalsModal(true);
  };

  // Delete meal
  const handleDeleteMeal = (mealId) => {
    Alert.alert(
      'Delete Meal',
      'Are you sure you want to delete this meal?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMeal(mealId, selectedDate) }
      ]
    );
  };

  const openAddMealModal = (mealType = 'breakfast', launchMode = 'search') => {
    setAddingMealType(mealType);
    setModalLaunchMode(launchMode);
    setModalVisible(true);
  };

  const renderListHeader = () => (
    <>
      <View style={styles.dateSelector}>
        <TouchableOpacity onPress={() => changeDate(-1)} style={styles.dateArrow}>
          <Ionicons name="chevron-back" size={28} color="#BB86FC" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.dateDisplay}
          onPress={openCalendar}
        >
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Ionicons name="calendar-outline" size={18} color="#BB86FC" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          onPress={() => changeDate(1)} 
          style={styles.dateArrow}
          disabled={isToday}
        >
          <Ionicons name="chevron-forward" size={28} color={isToday ? '#444' : '#BB86FC'} />
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Total</Text>
          <View style={styles.summaryActions}>
            <TouchableOpacity 
              style={styles.copyBtn}
              onPress={openGoalsModal}
            >
              <Ionicons name="options-outline" size={18} color="#BB86FC" />
              <Text style={styles.copyBtnText}>Goals</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.copyBtn}
              onPress={() => setShowCopyModal(true)}
            >
              <Ionicons name="copy-outline" size={18} color="#BB86FC" />
              <Text style={styles.copyBtnText}>Copy</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.calorieText}>{macros.calories} kcal</Text>
        
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{macros.protein}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{macros.carbs}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>
          <View style={styles.macroItem}>
            <Text style={styles.macroValue}>{macros.fat}g</Text>
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
        </View>
      </View>

      <View style={styles.goalsCard}>
        <View style={styles.goalsHeader}>
          <Text style={styles.goalsTitle}>Daily Targets</Text>
          <Text style={styles.goalsSubtitle}>
            {selectedDate === getTodayKey() ? 'Today' : formatDate(selectedDate)}
          </Text>
        </View>
        {[
          { key: 'calories', label: 'Calories', unit: 'kcal', color: '#BB86FC' },
          { key: 'protein', label: 'Protein', unit: 'g', color: '#4ECDC4' },
          { key: 'carbs', label: 'Carbs', unit: 'g', color: '#FFB74D' },
          { key: 'fat', label: 'Fat', unit: 'g', color: '#F06292' },
        ].map(item => (
          <View key={item.key} style={styles.goalRow}>
            <View style={styles.goalRowHeader}>
              <View style={styles.goalLabelGroup}>
                <Text style={styles.goalLabel}>{item.label}</Text>
                {(() => {
                  const status = getGoalStatus(goalProgress[item.key].current, goalProgress[item.key].goal);
                  return (
                    <View
                      style={[
                        styles.goalStatusBadge,
                        status.tone === 'good' && styles.goalStatusBadgeGood,
                        status.tone === 'high' && styles.goalStatusBadgeHigh,
                      ]}
                    >
                      <Text
                        style={[
                          styles.goalStatusText,
                          status.tone === 'good' && styles.goalStatusTextGood,
                          status.tone === 'high' && styles.goalStatusTextHigh,
                        ]}
                      >
                        {status.label}
                      </Text>
                    </View>
                  );
                })()}
              </View>
              <Text style={styles.goalValue}>
                {goalProgress[item.key].current}/{goalProgress[item.key].goal} {item.unit}
              </Text>
            </View>
            <View style={styles.goalTrack}>
              <View
                style={[
                  styles.goalFill,
                  { width: `${Math.min(goalProgress[item.key].ratio, 1) * 100}%`, backgroundColor: item.color },
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.insightsCard}>
        <View style={styles.insightsHeader}>
          <Text style={styles.insightsTitle}>Daily Insights</Text>
          <Text style={styles.insightsSubtitle}>{dayInsights.totalMeals} meals tracked</Text>
        </View>
        <Text style={styles.insightsLead}>{dayInsights.recommendation}</Text>

        <View style={styles.insightStatRow}>
          <View style={styles.insightStatCard}>
            <Text style={styles.insightStatLabel}>Protein Leader</Text>
            <Text style={styles.insightStatValue} numberOfLines={1}>
              {dayInsights.topProteinMeal?.name || 'No data'}
            </Text>
            <Text style={styles.insightStatMeta}>
              {dayInsights.topProteinMeal ? `${dayInsights.topProteinMeal.protein || 0}g protein` : 'Log a meal first'}
            </Text>
          </View>

          <View style={styles.insightStatCard}>
            <Text style={styles.insightStatLabel}>Biggest Meal</Text>
            <Text style={styles.insightStatValue} numberOfLines={1}>
              {dayInsights.topCalorieMeal?.name || 'No data'}
            </Text>
            <Text style={styles.insightStatMeta}>
              {dayInsights.topCalorieMeal ? `${dayInsights.topCalorieMeal.calories || 0} kcal` : 'Waiting for entries'}
            </Text>
          </View>
        </View>

        <View style={styles.sourceBreakdownRow}>
          {dayInsights.sourceBreakdown.length > 0 ? (
            dayInsights.sourceBreakdown.slice(0, 3).map(item => (
              <View key={item.source} style={styles.sourceBreakdownChip}>
                <Text style={styles.sourceBreakdownLabel}>{item.label}</Text>
                <Text style={styles.sourceBreakdownMeta}>{item.count} items</Text>
              </View>
            ))
          ) : (
            <View style={styles.sourceBreakdownEmpty}>
              <Text style={styles.sourceBreakdownEmptyText}>Source badges will appear after your first meal.</Text>
            </View>
          )}
        </View>

        <View style={styles.macroSplitSection}>
          <Text style={styles.macroSplitTitle}>Macro Balance</Text>
          {dayInsights.macroSplit.map(item => (
            <View key={item.key} style={styles.macroSplitRow}>
              <View style={styles.macroSplitHeader}>
                <Text style={styles.macroSplitLabel}>{item.label}</Text>
                <Text style={styles.macroSplitMeta}>{Math.round(item.ratio * 100)}%</Text>
              </View>
              <View style={styles.macroSplitTrack}>
                <View
                  style={[
                    styles.macroSplitFill,
                    { width: item.ratio > 0 ? `${Math.max(8, item.ratio * 100)}%` : '0%', backgroundColor: item.color },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.weeklyChartCard}>
        <View style={styles.weeklyChartHeader}>
          <View>
            <Text style={styles.weeklyChartTitle}>7-Day Trend</Text>
            <Text style={styles.weeklyChartSubtitle}>Calories and macros across the last week</Text>
          </View>
          <Text style={styles.weeklyChartRange}>{weeklySeries[0]?.label} - {weeklySeries[6]?.label}</Text>
        </View>

        {[
          { key: 'calories', label: 'Calories', unit: 'kcal', color: '#BB86FC' },
          { key: 'protein', label: 'Protein', unit: 'g', color: '#4ECDC4' },
          { key: 'carbs', label: 'Carbs', unit: 'g', color: '#FFB74D' },
          { key: 'fat', label: 'Fat', unit: 'g', color: '#F06292' },
        ].map(metric => {
          const maxValue = Math.max(...weeklySeries.map(item => item[metric.key] || 0), 1);
          const averageValue = Math.round(
            weeklySeries.reduce((sum, item) => sum + (item[metric.key] || 0), 0) / Math.max(weeklySeries.length, 1)
          );

          return (
            <View key={metric.key} style={styles.weeklyMetricSection}>
              <View style={styles.weeklyMetricHeader}>
                <Text style={styles.weeklyMetricLabel}>{metric.label}</Text>
                <Text style={styles.weeklyMetricMeta}>avg {averageValue} {metric.unit}</Text>
              </View>
              <View style={styles.weeklyBarsRow}>
                {weeklySeries.map(item => (
                  <View key={`${metric.key}-${item.date}`} style={styles.weeklyBarItem}>
                    <View style={styles.weeklyBarTrack}>
                      <View
                        style={[
                          styles.weeklyBarFill,
                          {
                            height: (item[metric.key] || 0) > 0
                              ? `${Math.max(6, ((item[metric.key] || 0) / maxValue) * 100)}%`
                              : '0%',
                            backgroundColor: metric.color,
                            opacity: item.date === selectedDate ? 1 : 0.82,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.weeklyBarValue}>{item[metric.key] || 0}</Text>
                    <Text style={styles.weeklyBarLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.periodSummaryCard}>
        <View style={styles.periodSummaryHeader}>
          <View>
            <Text style={styles.periodSummaryTitle}>30-Day Snapshot</Text>
            <Text style={styles.periodSummarySubtitle}>Rolling summary ending on {formatDate(selectedDate)}</Text>
          </View>
          <View style={styles.periodConsistencyBadge}>
            <Text style={styles.periodConsistencyText}>
              {Math.round(monthlySummary.loggingConsistency * 100)}% logged
            </Text>
          </View>
        </View>

        <View style={styles.periodStatsRow}>
          <View style={styles.periodStatCard}>
            <Text style={styles.periodStatValue}>{monthlySummary.daysLogged}</Text>
            <Text style={styles.periodStatLabel}>Days Tracked</Text>
          </View>
          <View style={styles.periodStatCard}>
            <Text style={styles.periodStatValue}>{monthlySummary.averages.calories}</Text>
            <Text style={styles.periodStatLabel}>Avg kcal</Text>
          </View>
          <View style={styles.periodStatCard}>
            <Text style={styles.periodStatValue}>{monthlySummary.averages.protein}g</Text>
            <Text style={styles.periodStatLabel}>Avg Protein</Text>
          </View>
        </View>

        <View style={styles.periodGoalGrid}>
          {[
            { key: 'calories', label: 'Calories' },
            { key: 'protein', label: 'Protein' },
            { key: 'carbs', label: 'Carbs' },
            { key: 'fat', label: 'Fat' },
          ].map(item => (
            <View key={item.key} style={styles.periodGoalItem}>
              <Text style={styles.periodGoalLabel}>{item.label}</Text>
              <Text style={styles.periodGoalValue}>
                {monthlySummary.goalHitDays[item.key]}/{monthlySummary.daysLogged || monthlySummary.days}
              </Text>
              <Text style={styles.periodGoalMeta}>on-track days</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickAddRow} contentContainerStyle={styles.quickAddRowContent}>
        <TouchableOpacity
          style={[styles.quickAddCard, styles.quickAddCardPrimary]}
          onPress={() => openAddMealModal(selectedMealType !== 'all' ? selectedMealType : 'breakfast', 'barcode')}
        >
          <Ionicons name="barcode-outline" size={22} color="#BB86FC" />
          <Text style={styles.quickAddTitle}>Barcode</Text>
          <Text style={styles.quickAddMeta}>Fast packaged food lookup</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => openAddMealModal(selectedMealType !== 'all' ? selectedMealType : 'breakfast', 'favorites')}
        >
          <Ionicons name="heart-outline" size={22} color="#CF6679" />
          <Text style={styles.quickAddTitle}>Favorites</Text>
          <Text style={styles.quickAddMeta}>{favoriteFoods.length} saved foods</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => openAddMealModal(selectedMealType !== 'all' ? selectedMealType : 'breakfast', 'templates')}
        >
          <Ionicons name="albums-outline" size={22} color="#D8DDFF" />
          <Text style={styles.quickAddTitle}>Templates</Text>
          <Text style={styles.quickAddMeta}>{mealTemplates.length} reusable meals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAddCard}
          onPress={() => openAddMealModal(selectedMealType !== 'all' ? selectedMealType : 'breakfast', 'custom')}
        >
          <Ionicons name="create-outline" size={22} color="#FFCC80" />
          <Text style={styles.quickAddTitle}>Custom</Text>
          <Text style={styles.quickAddMeta}>{customMealCount} today</Text>
        </TouchableOpacity>
      </ScrollView>

      {recentSearches.length > 0 ? (
        <View style={styles.offInfoCard}>
          <View style={styles.offInfoHeader}>
            <Ionicons name="globe-outline" size={18} color="#BB86FC" />
            <Text style={styles.offInfoTitle}>
              {usdaProxyEnabled ? 'USDA + OpenFoodFacts Search' : 'OpenFoodFacts Search'}
            </Text>
          </View>
          <Text style={styles.offInfoText}>
            {usdaProxyEnabled
              ? 'Text search uses USDA first with OpenFoodFacts fallback. Barcode search starts with OpenFoodFacts.'
              : 'Best results come from exact product names or barcode digits.'}
          </Text>
        </View>
      ) : null}

      {recentMeals.length > 0 ? (
        <View style={styles.recentMealsCard}>
          <Text style={styles.recentMealsTitle}>Quick Repeat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentMealsRail}>
            {recentMeals.map(meal => (
              <TouchableOpacity
                key={`${meal.name}-${meal.brand}-${meal.source}`}
                style={styles.recentMealChip}
                onPress={() => handleQuickRepeatMeal(meal)}
              >
                <Text style={styles.recentMealChipName}>{meal.name}</Text>
                <Text style={styles.recentMealChipMeta}>
                  {meal.calories} kcal • {meal.portion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {mealTemplates.length > 0 ? (
        <View style={styles.recentMealsCard}>
          <Text style={styles.recentMealsTitle}>Meal Templates</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentMealsRail}>
            {mealTemplates.map(template => (
              <View key={template.id} style={styles.templateChip}>
                <TouchableOpacity style={styles.templateChipBody} onPress={() => handleQuickRepeatMeal(template, { fromTemplate: true })}>
                  <Text style={styles.recentMealChipName}>{template.name}</Text>
                  <Text style={styles.recentMealChipMeta}>
                    {(() => {
                      const defaultPortion = Number(template.servingQuantity) > 0
                        ? Number(template.servingQuantity)
                        : (parseGramValue(template.portion) || 100);
                      const calories = template.macrosPer100
                        ? Math.round((Number(template.calories) || 0) * (defaultPortion / 100))
                        : (Number(template.calories) || 0);
                      return `${calories} kcal • ${template.macrosPer100 ? `${defaultPortion}g` : template.portion}`;
                    })()}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.templateDeleteBtn} onPress={() => removeMealTemplate(template.id)}>
                  <Ionicons name="close" size={16} color="#CF6679" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.mealTypeTabs}
        contentContainerStyle={styles.mealTypeTabsContent}
      >
        <TouchableOpacity
          style={[styles.mealTypeTab, selectedMealType === 'all' && styles.mealTypeTabActive]}
          onPress={() => setSelectedMealType('all')}
        >
          <Ionicons name="apps-outline" size={18} color={selectedMealType === 'all' ? '#fff' : '#888'} />
          <Text style={[styles.mealTypeTabText, selectedMealType === 'all' && styles.mealTypeTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        {MEAL_TYPES.map(type => {
          const stats = getMacrosByMealType(type.id);
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.mealTypeTab, selectedMealType === type.id && styles.mealTypeTabActive]}
              onPress={() => setSelectedMealType(type.id)}
            >
              <Ionicons name={type.icon} size={18} color={selectedMealType === type.id ? '#fff' : '#888'} />
              <Text style={[styles.mealTypeTabText, selectedMealType === type.id && styles.mealTypeTabTextActive]}>
                {type.label}
              </Text>
              {stats.count > 0 && (
                <Text style={styles.mealTypeCalories}>{stats.calories}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.mealActionsHint}>
        <Text style={styles.mealActionsHintText}>Tap to edit, use Delete to remove, hold to save as template.</Text>
      </View>
    </>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={currentMeals}
        style={styles.mealsList}
        keyExtractor={(item) => item.id}
        nestedScrollEnabled
        ListHeaderComponent={renderListHeader}
        renderItem={({ item }) => {
          const mealTypeInfo = MEAL_TYPES.find(t => t.id === item.mealType) || MEAL_TYPES[0];
          return (
            <View style={styles.mealCard}>
              <TouchableOpacity 
                style={styles.mealCardMain}
                onPress={() => handleEditMeal(item)}
                onLongPress={() => handleSaveTemplate(item)}
                activeOpacity={0.7}
              >
                <View style={styles.mealTypeIcon}>
                  <Ionicons name={mealTypeInfo.icon} size={20} color="#BB86FC" />
                </View>
                <View style={styles.mealInfo}>
                  <View style={styles.mealHeaderRow}>
                    <Text style={styles.mealName}>{item.name}</Text>
                    <View style={styles.mealBadgeRow}>
                      {item.source ? (
                        <Text style={styles.sourcePill}>
                          {item.source === 'off' ? 'OFF' : item.source.toUpperCase()}
                        </Text>
                      ) : null}
                      {item.isCustom ? <Text style={styles.customPill}>CUSTOM</Text> : null}
                      {item.isVerified ? <Text style={styles.verifiedPill}>VERIFIED</Text> : null}
                    </View>
                  </View>
                  {item.brand ? <Text style={styles.mealBrand}>{item.brand}</Text> : null}
                  <Text style={styles.mealMacros}>
                    {item.portion} • {item.calories} kcal • P:{item.protein}g • C:{item.carbs}g • F:{item.fat}g
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDeleteMeal(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#CF6679" />
                <Text style={styles.deleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedMealType === 'all' 
                ? 'No meals logged for this day' 
                : `No ${MEAL_TYPES.find(t => t.id === selectedMealType)?.label || ''} logged`}
            </Text>
            {daysWithMeals.length > 0 && selectedMealType === 'all' && (
              <TouchableOpacity 
                style={styles.copyFromPastBtn}
                onPress={() => setShowCopyModal(true)}
              >
                <Ionicons name="copy-outline" size={16} color="#BB86FC" />
                <Text style={styles.copyFromPastText}>Copy from past day</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        contentContainerStyle={styles.mealsListContent}
      />

      {/* ADDING MEAL BUTTON */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => openAddMealModal(selectedMealType !== 'all' ? selectedMealType : 'breakfast')}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>

      {/* ADD MEAL MODAL */}
      <AddMealModal
        visible={modalVisible}
        onClose={closeModal}
        editingMeal={editingMeal}
        addingMealType={addingMealType}
        searchFood={searchFood}
        addMeal={addMeal}
        updateMeal={updateMeal}
        selectedDate={selectedDate}
        favoriteFoods={favoriteFoods}
        addFavorite={addFavorite}
        removeFavorite={removeFavorite}
        isFavorite={isFavorite}
        recentSearches={recentSearches}
        mealTemplates={mealTemplates}
        addMealTemplate={addMealTemplate}
        removeMealTemplate={removeMealTemplate}
        scanHistory={scanHistory}
        rememberBarcodeScan={rememberBarcodeScan}
        clearScanHistory={clearScanHistory}
        isGuest={isGuest}
        user={user}
        launchMode={modalLaunchMode}
      />

      {/* CALENDAR MODAL */}
      <Modal visible={showCalendar} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Date</Text>
            <TouchableOpacity onPress={() => setShowCalendar(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          {/* Month navigation */}
          <View style={styles.monthNavigation}>
            <TouchableOpacity onPress={goToPreviousMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-back" size={28} color="#BB86FC" />
            </TouchableOpacity>
            <Text style={styles.monthNavTitle}>{calendarMonthTitle}</Text>
            <TouchableOpacity onPress={goToNextMonth} style={styles.monthNavBtn}>
              <Ionicons name="chevron-forward" size={28} color="#BB86FC" />
            </TouchableOpacity>
          </View>

          {/* Go to today button */}
          <TouchableOpacity 
            style={styles.todayBtn}
            onPress={() => {
              setSelectedDate(getTodayKey());
              setCalendarMonth(new Date());
              setShowCalendar(false);
            }}
          >
            <Ionicons name="today-outline" size={20} color="#BB86FC" />
            <Text style={styles.todayBtnText}>Go to Today</Text>
          </TouchableOpacity>

          {/* Calendar grid */}
          <View style={styles.calendarGrid}>
            {currentMonthDays.map(date => {
              const hasMeals = daysWithMeals.includes(date);
              const isSelected = date === selectedDate;
              const isTodayDate = date === getTodayKey();
              const dateObj = new Date(date);
              const dayNum = dateObj.getDate();
              const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
              
              return (
                <TouchableOpacity
                  key={date}
                  style={[
                    styles.calendarDay,
                    isSelected && styles.calendarDaySelected,
                    hasMeals && !isSelected && styles.calendarDayHasMeals,
                    isTodayDate && !isSelected && styles.calendarDayToday
                  ]}
                  onPress={() => {
                    setSelectedDate(date);
                    setShowCalendar(false);
                  }}
                >
                  <Text style={[
                    styles.calendarDayNum,
                    isSelected && styles.calendarDayNumSelected,
                    isTodayDate && !isSelected && styles.calendarDayNumToday
                  ]}>
                    {dayNum}
                  </Text>
                  <Text style={styles.calendarDayName}>{dayName}</Text>
                  {hasMeals && (
                    <Text style={styles.calendarDayCalories}>
                      {getTotalMacros(date).calories}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </Modal>

      {/* DATE PICKER MODAL (Logged days) */}
      <Modal visible={showDatePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Logged Days</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.dayItem, isToday && styles.dayItemActive]}
            onPress={() => {
              setSelectedDate(getTodayKey());
              setShowDatePicker(false);
            }}
          >
            <Text style={styles.dayItemDate}>Today</Text>
            <Text style={styles.dayItemMacros}>
              {getTotalMacros(getTodayKey()).calories} kcal
            </Text>
          </TouchableOpacity>

          <Text style={styles.sectionTitle}>Past Days</Text>
          
          <ScrollView style={{ flex: 1 }}>
            {daysWithMeals
              .filter(date => date !== getTodayKey())
              .map(date => (
                <TouchableOpacity 
                  key={date}
                  style={[styles.dayItem, selectedDate === date && styles.dayItemActive]}
                  onPress={() => {
                    setSelectedDate(date);
                    setShowDatePicker(false);
                  }}
                >
                  <View>
                    <Text style={styles.dayItemDate}>{formatDate(date)}</Text>
                    <Text style={styles.dayItemCount}>
                      {getMealsForDate(date).length} meals
                    </Text>
                  </View>
                  <Text style={styles.dayItemMacros}>
                    {getTotalMacros(date).calories} kcal
                  </Text>
                </TouchableOpacity>
              ))}
            {daysWithMeals.filter(d => d !== getTodayKey()).length === 0 && (
              <Text style={styles.emptyText}>No past records yet</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* COPY MODAL */}
      <Modal visible={showCopyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Copy From Day</Text>
            <TouchableOpacity onPress={() => setShowCopyModal(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <Text style={styles.copyInfo}>
            Select a day below to copy meals to {formatDate(selectedDate)}.
          </Text>
          
          <ScrollView style={{ flex: 1 }}>
            {daysWithMeals
              .filter(date => date !== selectedDate)
              .map(date => {
                const dateMacros = getTotalMacros(date);
                const dateMeals = getMealsForDate(date);
                return (
                  <TouchableOpacity 
                    key={date}
                    style={styles.copyDayItem}
                    onPress={() => handleCopyFromDate(date)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dayItemDate}>{formatDate(date)}</Text>
                      <Text style={styles.dayItemCount}>
                        {dateMeals.length} meals • {dateMacros.calories} kcal
                      </Text>
                      <Text style={styles.copyDayMeals} numberOfLines={2}>
                        {dateMeals.map(m => m.name).join(', ')}
                      </Text>
                    </View>
                    <Ionicons name="copy" size={24} color="#BB86FC" />
                  </TouchableOpacity>
                );
              })}
            {daysWithMeals.filter(d => d !== selectedDate).length === 0 && (
              <Text style={styles.emptyText}>No days to copy from</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={showGoalsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Daily Goals</Text>
            <TouchableOpacity onPress={() => setShowGoalsModal(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <View style={styles.goalInputGroup}>
            <Text style={styles.goalInputLabel}>Calories</Text>
            <TextInput
              style={styles.goalInput}
              keyboardType="numeric"
              value={goalDraft.calories}
              onChangeText={(value) => setGoalDraft(prev => ({ ...prev, calories: value }))}
            />
          </View>
          <View style={styles.goalInputGroup}>
            <Text style={styles.goalInputLabel}>Protein (g)</Text>
            <TextInput
              style={styles.goalInput}
              keyboardType="numeric"
              value={goalDraft.protein}
              onChangeText={(value) => setGoalDraft(prev => ({ ...prev, protein: value }))}
            />
          </View>
          <View style={styles.goalInputGroup}>
            <Text style={styles.goalInputLabel}>Carbs (g)</Text>
            <TextInput
              style={styles.goalInput}
              keyboardType="numeric"
              value={goalDraft.carbs}
              onChangeText={(value) => setGoalDraft(prev => ({ ...prev, carbs: value }))}
            />
          </View>
          <View style={styles.goalInputGroup}>
            <Text style={styles.goalInputLabel}>Fat (g)</Text>
            <TextInput
              style={styles.goalInput}
              keyboardType="numeric"
              value={goalDraft.fat}
              onChangeText={(value) => setGoalDraft(prev => ({ ...prev, fat: value }))}
            />
          </View>

          <TouchableOpacity style={styles.goalSaveBtn} onPress={handleSaveGoals}>
            <Text style={styles.goalSaveBtnText}>Save Goals</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}
