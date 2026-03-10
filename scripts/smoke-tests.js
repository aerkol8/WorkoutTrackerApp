const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const transformModulesCommonjs = require('@babel/plugin-transform-modules-commonjs');

const projectRoot = path.resolve(__dirname, '..');
const originalJsLoader = Module._extensions['.js'];

Module._extensions['.js'] = function codexTranspile(module, filename) {
  const isProjectJs = filename.startsWith(path.join(projectRoot, 'utils'));
  if (!isProjectJs) {
    return originalJsLoader(module, filename);
  }

  const source = fs.readFileSync(filename, 'utf8');
  const { code } = babel.transformSync(source, {
    filename,
    plugins: [transformModulesCommonjs],
    babelrc: false,
    configFile: false,
  });
  module._compile(code, filename);
};

const { createBackupPayload, parseBackupString, serializeBackup } = require('../utils/backup.js');
const {
  buildSeedCatalog,
  computeMuscleDashboard,
  enrichWorkoutData,
  getExerciseVolumeScore,
} = require('../utils/exerciseCatalog.js');
const {
  dedupeFoods,
  isBarcodeQuery,
  rankOpenFoodFactsResults,
  scoreOpenFoodFactsResult,
} = require('../utils/nutritionSearch.js');
const {
  buildMacroSplit,
  buildNutritionDayInsights,
  buildNutritionPeriodSummary,
  buildWeeklyMacroSeries,
  getGoalStatus,
} = require('../utils/nutritionInsights.js');
const { toLocalDateKey } = require('../utils/date.js');

const backup = createBackupPayload({
  isGuest: true,
  workout: { routines: [{ id: '1', exercises: [] }], history: [] },
  nutrition: {
    dailyMeals: { '2026-03-09': [] },
    favoriteFoods: [],
    recentSearches: ['eggs'],
    dailyGoals: { calories: 2400, protein: 170, carbs: 230, fat: 75 },
    mealTemplates: [{ id: 't1', name: 'Eggs', calories: 280 }],
    scanHistory: [{ barcode: '12345678', label: 'Milk' }],
  },
  profile: { profile: { gender: 'male', height: '180' }, measurements: [] },
});

const parsedBackup = parseBackupString(serializeBackup(backup));
assert.equal(parsedBackup.backupVersion, 1);
assert.equal(parsedBackup.authMode, 'guest');
assert.equal(parsedBackup.nutrition.recentSearches[0], 'eggs');
assert.equal(parsedBackup.nutrition.dailyGoals.protein, 170);
assert.equal(parsedBackup.nutrition.mealTemplates[0].name, 'Eggs');
assert.equal(parsedBackup.nutrition.scanHistory[0].barcode, '12345678');

const seedCatalog = buildSeedCatalog([
  { id: '1', name: 'Barbell Curl', bodyPart: 'Arms', target: 'Biceps' },
]);
const enriched = enrichWorkoutData({
  routines: [{ id: 'r1', exercises: [{ name: 'Barbell Curl', sets: [{ weight: '20', reps: '10', isDone: true }] }] }],
  history: [{ id: 'h1', dateISO: '2026-03-09', exercises: [{ name: 'Barbell Curl', sets: [{ weight: '20', reps: '10', isDone: true }] }] }],
}, seedCatalog);

assert.equal(enriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.ok(enriched.routines[0].exercises[0].primaryMuscles.includes('Biceps'));

const score = getExerciseVolumeScore(enriched.history[0].exercises[0]);
assert.equal(score.score, 200);

const dashboard = computeMuscleDashboard(enriched.history, 30);
assert.equal(dashboard.topMuscles[0].muscle, 'Biceps');

assert.equal(isBarcodeQuery('1234567890123'), true);
assert.equal(isBarcodeQuery('chicken'), false);
assert.equal(dedupeFoods([
  { name: 'Rice', brand: 'A', source: 'usda' },
  { name: 'Rice', brand: 'A', source: 'usda' },
]).length, 1);

const rankedFoods = rankOpenFoodFactsResults([
  { name: 'Greek Yogurt', brand: 'A', source: 'off', calories: 90, protein: 10, carbs: 4, fat: 0, image: 'x' },
  { name: 'Yogurt', brand: 'Greek Farm', source: 'off', calories: 90, protein: 8, carbs: 5, fat: 1 },
], 'greek yogurt');
assert.equal(rankedFoods[0].name, 'Greek Yogurt');
assert.ok(scoreOpenFoodFactsResult(rankedFoods[0], 'greek yogurt') > scoreOpenFoodFactsResult(rankedFoods[1], 'greek yogurt'));

const macroSplit = buildMacroSplit({ protein: 40, carbs: 50, fat: 20 });
assert.equal(macroSplit.length, 3);
assert.ok(macroSplit[0].ratio > 0);

const dayInsights = buildNutritionDayInsights([
  { name: 'Eggs', protein: 24, calories: 280, source: 'custom', isCustom: true },
  { name: 'Yogurt', protein: 18, calories: 180, source: 'off' },
], { calories: 460, protein: 42, carbs: 12, fat: 24 }, { calories: 2200, protein: 160 });
assert.equal(dayInsights.topProteinMeal.name, 'Eggs');
assert.equal(dayInsights.topCalorieMeal.name, 'Eggs');
assert.equal(dayInsights.sourceBreakdown[0].label, 'Custom');
assert.ok(dayInsights.recommendation.toLowerCase().includes('protein'));

const weeklySeries = buildWeeklyMacroSeries({
  '2026-03-03': [{ calories: 500, protein: 30, carbs: 50, fat: 10 }],
  '2026-03-09': [{ calories: 900, protein: 70, carbs: 60, fat: 30 }],
}, '2026-03-09');
assert.equal(weeklySeries.length, 7);
assert.equal(weeklySeries[0].date, '2026-03-03');
assert.equal(weeklySeries[6].calories, 900);
assert.equal(weeklySeries[6].protein, 70);

assert.equal(getGoalStatus(80, 100).label, 'Low');
assert.equal(getGoalStatus(100, 100).label, 'On Track');
assert.equal(getGoalStatus(120, 100).label, 'Over');

const monthlySummary = buildNutritionPeriodSummary({
  '2026-03-08': [{ calories: 2000, protein: 150, carbs: 180, fat: 60 }],
  '2026-03-09': [{ calories: 2100, protein: 165, carbs: 190, fat: 65 }],
}, '2026-03-09', 7, { calories: 2200, protein: 160, carbs: 220, fat: 70 });
assert.equal(monthlySummary.daysLogged, 2);
assert.equal(monthlySummary.averages.calories, 2050);
assert.equal(monthlySummary.goalHitDays.protein, 2);

const localDate = new Date(2026, 2, 10, 0, 0, 0);
assert.equal(toLocalDateKey(localDate), '2026-03-10');

console.log('Smoke tests passed');
