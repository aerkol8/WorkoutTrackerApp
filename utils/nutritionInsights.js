export function getSourceLabel(source = '') {
  const normalized = String(source || '').toLowerCase();
  if (normalized === 'off') return 'OFF';
  if (normalized === 'custom') return 'Custom';
  return normalized ? normalized.toUpperCase() : 'Unknown';
}

export function buildMacroSplit(totals = {}) {
  const proteinCalories = Math.max(0, Number(totals.protein) || 0) * 4;
  const carbCalories = Math.max(0, Number(totals.carbs) || 0) * 4;
  const fatCalories = Math.max(0, Number(totals.fat) || 0) * 9;
  const totalMacroCalories = proteinCalories + carbCalories + fatCalories;

  const buildItem = (key, label, value, color) => ({
    key,
    label,
    value,
    color,
    ratio: totalMacroCalories > 0 ? value / totalMacroCalories : 0,
  });

  return [
    buildItem('protein', 'Protein', proteinCalories, '#4ECDC4'),
    buildItem('carbs', 'Carbs', carbCalories, '#FFB74D'),
    buildItem('fat', 'Fat', fatCalories, '#F06292'),
  ];
}

export function buildNutritionDayInsights(meals = [], totals = {}, goals = {}) {
  const safeMeals = Array.isArray(meals) ? meals : [];
  const topProteinMeal = safeMeals.reduce((best, meal) => (
    !best || (meal.protein || 0) > (best.protein || 0) ? meal : best
  ), null);
  const topCalorieMeal = safeMeals.reduce((best, meal) => (
    !best || (meal.calories || 0) > (best.calories || 0) ? meal : best
  ), null);

  const sourceMap = safeMeals.reduce((acc, meal) => {
    const source = String(meal.source || (meal.isCustom ? 'custom' : 'unknown')).toLowerCase();
    acc[source] = (acc[source] || 0) + 1;
    return acc;
  }, {});

  const sourceBreakdown = Object.entries(sourceMap)
    .map(([source, count]) => ({
      source,
      label: getSourceLabel(source),
      count,
      ratio: safeMeals.length > 0 ? count / safeMeals.length : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const remainingProtein = Math.max(0, (Number(goals.protein) || 0) - (Number(totals.protein) || 0));
  const remainingCalories = Math.max(0, (Number(goals.calories) || 0) - (Number(totals.calories) || 0));
  const macroSplit = buildMacroSplit(totals);

  let recommendation = 'Start logging meals to unlock daily nutrition insights.';
  if (safeMeals.length > 0) {
    recommendation = remainingProtein > 25
      ? `Protein is ${Math.round(remainingProtein)}g under goal. Add one protein-focused meal.`
      : remainingCalories > 400
        ? `${Math.round(remainingCalories)} kcal left. A balanced meal can close the gap.`
        : 'Targets are close. Keep portions tight and use favorites for repeat meals.';
  }

  return {
    totalMeals: safeMeals.length,
    topProteinMeal,
    topCalorieMeal,
    sourceBreakdown,
    macroSplit,
    recommendation,
  };
}

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey) {
  if (!dateKey) return new Date();
  const [year, month, day] = String(dateKey).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function buildWeeklyMacroSeries(dailyMeals = {}, endDateKey) {
  const endDate = parseDateKey(endDateKey);
  const series = [];

  for (let index = 6; index >= 0; index -= 1) {
    const current = new Date(endDate);
    current.setDate(endDate.getDate() - index);
    const key = getDateKey(current);
    const meals = Array.isArray(dailyMeals[key]) ? dailyMeals[key] : [];
    const totals = meals.reduce((acc, meal) => ({
      calories: acc.calories + (Number(meal.calories) || 0),
      protein: acc.protein + (Number(meal.protein) || 0),
      carbs: acc.carbs + (Number(meal.carbs) || 0),
      fat: acc.fat + (Number(meal.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    series.push({
      date: key,
      label: current.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2),
      ...totals,
    });
  }

  return series;
}

export function getGoalStatus(current = 0, goal = 0) {
  if (!goal || goal <= 0) {
    return { label: 'No Goal', tone: 'neutral' };
  }

  const ratio = current / goal;
  if (ratio < 0.85) {
    return { label: 'Low', tone: 'low' };
  }
  if (ratio <= 1.05) {
    return { label: 'On Track', tone: 'good' };
  }
  return { label: 'Over', tone: 'high' };
}

export function buildNutritionPeriodSummary(dailyMeals = {}, endDateKey, days = 30, goals = {}) {
  const endDate = parseDateKey(endDateKey);
  const period = [];

  for (let index = days - 1; index >= 0; index -= 1) {
    const current = new Date(endDate);
    current.setDate(endDate.getDate() - index);
    const key = getDateKey(current);
    const meals = Array.isArray(dailyMeals[key]) ? dailyMeals[key] : [];
    const totals = meals.reduce((acc, meal) => ({
      calories: acc.calories + (Number(meal.calories) || 0),
      protein: acc.protein + (Number(meal.protein) || 0),
      carbs: acc.carbs + (Number(meal.carbs) || 0),
      fat: acc.fat + (Number(meal.fat) || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

    period.push({
      date: key,
      mealsCount: meals.length,
      ...totals,
    });
  }

  const loggedDays = period.filter(item => item.mealsCount > 0);
  const divisor = Math.max(loggedDays.length, 1);
  const totals = loggedDays.reduce((acc, item) => ({
    calories: acc.calories + item.calories,
    protein: acc.protein + item.protein,
    carbs: acc.carbs + item.carbs,
    fat: acc.fat + item.fat,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 });

  return {
    days,
    daysLogged: loggedDays.length,
    loggingConsistency: period.length > 0 ? loggedDays.length / period.length : 0,
    averages: {
      calories: Math.round(totals.calories / divisor),
      protein: Math.round(totals.protein / divisor),
      carbs: Math.round(totals.carbs / divisor),
      fat: Math.round(totals.fat / divisor),
    },
    goalHitDays: {
      calories: loggedDays.filter(item => getGoalStatus(item.calories, goals.calories).tone === 'good').length,
      protein: loggedDays.filter(item => getGoalStatus(item.protein, goals.protein).tone === 'good').length,
      carbs: loggedDays.filter(item => getGoalStatus(item.carbs, goals.carbs).tone === 'good').length,
      fat: loggedDays.filter(item => getGoalStatus(item.fat, goals.fat).tone === 'good').length,
    },
  };
}
