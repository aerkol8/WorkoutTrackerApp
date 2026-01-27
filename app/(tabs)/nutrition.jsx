import React, { useState, useMemo } from 'react';
import { 
  View, Text, FlatList, 
  TouchableOpacity, Modal, Alert,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNutrition } from '../../context/NutritionContext';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/nutritionStyles';
import AddMealModal from '../../components/AddMealModal';

// Meal types
const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: 'sunny-outline' },
  { id: 'lunch', label: 'Lunch', icon: 'restaurant-outline' },
  { id: 'snack', label: 'Snack', icon: 'cafe-outline' },
  { id: 'dinner', label: 'Dinner', icon: 'moon-outline' },
];

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
    isFavorite
  } = useNutrition();
  const { user, isGuest } = useAuth();

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

  // MEALS FOR SELECTED DAY
  const allMeals = getMealsForDate(selectedDate);
  const allMacros = getTotalMacros(selectedDate);
  const daysWithMeals = getDaysWithMeals();
  const isToday = selectedDate === getTodayKey();

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
    if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

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
    const newDate = current.toISOString().split('T')[0];
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
      days.push(dateObj.toISOString().split('T')[0]);
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
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingMeal(null);
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

  const openAddMealModal = (mealType = 'breakfast') => {
    setAddingMealType(mealType);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* DATE SELECTOR */}
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

      {/* DAILY SUMMARY CARD */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryTitle}>Total</Text>
          {/* Copy button */}
          <TouchableOpacity 
            style={styles.copyBtn}
            onPress={() => setShowCopyModal(true)}
          >
            <Ionicons name="copy-outline" size={18} color="#BB86FC" />
            <Text style={styles.copyBtnText}>Copy</Text>
          </TouchableOpacity>
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

      {/* MEAL TYPE TABS */}
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

      {/* FOOD LIST */}
      <FlatList
        data={currentMeals}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const mealTypeInfo = MEAL_TYPES.find(t => t.id === item.mealType) || MEAL_TYPES[0];
          return (
            <TouchableOpacity 
              style={styles.mealCard}
              onPress={() => handleEditMeal(item)}
              activeOpacity={0.7}
            >
              <View style={styles.mealTypeIcon}>
                <Ionicons name={mealTypeInfo.icon} size={20} color="#BB86FC" />
              </View>
              <View style={styles.mealInfo}>
                <Text style={styles.mealName}>{item.name}</Text>
                {item.brand ? <Text style={styles.mealBrand}>{item.brand}</Text> : null}
                <Text style={styles.mealMacros}>
                  {item.portion} • {item.calories} kcal • P:{item.protein}g • C:{item.carbs}g • F:{item.fat}g
                </Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteMeal(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={20} color="#CF6679" />
              </TouchableOpacity>
            </TouchableOpacity>
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
        contentContainerStyle={{ paddingBottom: 100 }}
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
        isGuest={isGuest}
        user={user}
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
    </View>
  );
}

