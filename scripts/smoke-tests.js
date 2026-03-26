const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const babel = require('@babel/core');
const transformModulesCommonjs = require('@babel/plugin-transform-modules-commonjs');

const projectRoot = path.resolve(__dirname, '..');
const originalJsLoader = Module._extensions['.js'];

process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL = 'https://media.example.com';

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
  mergeCatalogs,
  normalizeExerciseName,
} = require('../utils/exerciseCatalog.js');
const guestMigration = require('../utils/guestMigration.js');
const {
  dedupeFoods,
  isBarcodeQuery,
  normalizeUsdaFood,
  rankHybridFoodResults,
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

const {
  buildGuestMigrationWritePayloads: buildGuestMigrationPayloads,
  createGuestMigrationStatusKey: guestMigrationStatusKey,
  hasGuestSnapshotData: guestSnapshotHasData,
  hasRemoteAccountData: remoteAccountHasData,
  normalizeGuestSnapshot: normalizeMigrationSnapshot,
} = guestMigration;

const backup = createBackupPayload({
  isGuest: true,
  workout: {
    routines: [{ id: '1', exercises: [] }],
    history: [],
    exerciseAliases: { 'cable bar pushdown': 'Cable Triceps Pushdown' },
  },
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
assert.equal(parsedBackup.workout.exerciseAliases['cable bar pushdown'], 'Cable Triceps Pushdown');
assert.equal(parsedBackup.nutrition.recentSearches[0], 'eggs');
assert.equal(parsedBackup.nutrition.dailyGoals.protein, 170);
assert.equal(parsedBackup.nutrition.mealTemplates[0].name, 'Eggs');
assert.equal(parsedBackup.nutrition.scanHistory[0].barcode, '12345678');

assert.throws(() => parseBackupString('{bad json'), /Invalid JSON format/);
assert.throws(
  () => parseBackupString(JSON.stringify({ backupVersion: 999 })),
  /Unsupported backup version: 999/
);

const parsedWithInvalidTypes = parseBackupString(JSON.stringify({
  backupVersion: 1,
  workout: { routines: 'invalid', history: null, exerciseAliases: [] },
  nutrition: {
    dailyMeals: [],
    favoriteFoods: 'invalid',
    recentSearches: {},
    dailyGoals: 'invalid',
    mealTemplates: {},
    scanHistory: null,
  },
  profile: { profile: [], measurements: {} },
}));
assert.deepEqual(parsedWithInvalidTypes.workout.routines, []);
assert.deepEqual(parsedWithInvalidTypes.workout.history, []);
assert.deepEqual(parsedWithInvalidTypes.workout.exerciseAliases, {});
assert.deepEqual(parsedWithInvalidTypes.nutrition.favoriteFoods, []);
assert.deepEqual(parsedWithInvalidTypes.nutrition.dailyMeals, {});
assert.equal(parsedWithInvalidTypes.nutrition.dailyGoals.calories, 2200);
assert.deepEqual(parsedWithInvalidTypes.profile.measurements, []);

const normalizedMigrationSnapshot = normalizeMigrationSnapshot({
  workout: { routines: 'bad', history: [{ id: 'h1' }], exerciseAliases: [] },
  nutrition: { dailyMeals: [], favoriteFoods: [{ id: 'fav-1' }] },
  profile: { profile: { height: '181' }, measurements: {} },
});
assert.deepEqual(normalizedMigrationSnapshot.workout.routines, []);
assert.equal(normalizedMigrationSnapshot.workout.history.length, 1);
assert.equal(normalizedMigrationSnapshot.nutrition.favoriteFoods.length, 1);
assert.equal(normalizedMigrationSnapshot.profile.profile.height, '181');
assert.deepEqual(normalizedMigrationSnapshot.profile.measurements, []);
assert.equal(guestMigrationStatusKey('user-123'), '@guest_migration_status:user-123');
assert.equal(guestSnapshotHasData({ workout: { history: [{ id: '1' }] } }), true);
assert.equal(guestSnapshotHasData({}), false);
assert.equal(remoteAccountHasData({ profile: { profile: { height: '175' } } }), true);
assert.equal(remoteAccountHasData({}), false);

const migrationPayloads = buildGuestMigrationPayloads({
  workout: { routines: [{ id: 'r1' }], history: [], exerciseAliases: { squat: 'Back Squat' } },
  nutrition: {
    dailyMeals: { '2026-03-25': [{ id: 'm1' }] },
    favoriteFoods: [],
    dailyGoals: { calories: 2500 },
    mealTemplates: [],
    scanHistory: [],
  },
  profile: {
    profile: { gender: 'male', height: '182' },
    measurements: [{ id: 'p1' }],
  },
}, { timestamp: '2026-03-25T10:00:00.000Z' });
assert.equal(migrationPayloads.workout.guestMigratedAt, '2026-03-25T10:00:00.000Z');
assert.equal(migrationPayloads.nutrition.dailyGoals.calories, 2500);
assert.equal(migrationPayloads.profile.measurements.length, 1);

const seedCatalog = buildSeedCatalog([
  { id: '1', name: 'Barbell Curl', bodyPart: 'Arms', target: 'Biceps' },
]);
assert.deepEqual(seedCatalog[0].primaryMuscles, ['Biceps']);
assert.ok(!seedCatalog[0].primaryMuscles.includes('Triceps'));

const mergedCatalog = mergeCatalogs(
  [{ id: 'seed-1', name: 'Barbell Curl', source: 'seed', primaryMuscles: ['Biceps', 'Triceps'], secondaryMuscles: ['Forearms'], equipment: ['Barbell'], images: [], videos: [] }],
  [{ id: 'snapshot-1', name: 'Barbell Curl', source: 'snapshot', primaryMuscles: ['Biceps'], secondaryMuscles: ['Forearms'], equipment: ['Barbell'], images: [], videos: ['x'] }]
);
assert.equal(mergedCatalog[0].source, 'snapshot');
assert.deepEqual(mergedCatalog[0].primaryMuscles, ['Biceps']);
assert.equal(normalizeExerciseName('Dumbell Shrugs'), normalizeExerciseName('Dumbbell Shrug'));
assert.equal(normalizeExerciseName('Cable Crunches'), normalizeExerciseName('Cable Crunch'));
assert.equal(normalizeExerciseName('Leg Extension'), normalizeExerciseName('Leg Extensions'));
assert.equal(normalizeExerciseName('Face Pulls'), normalizeExerciseName('Face Pull'));

const enriched = enrichWorkoutData({
  routines: [{ id: 'r1', exercises: [{ name: 'Barbell Curl', sets: [{ weight: '20', reps: '10', isDone: true }] }] }],
  history: [{ id: 'h1', dateISO: '2026-03-09', exercises: [{ name: 'Barbell Curl', sets: [{ weight: '20', reps: '10', isDone: true }] }] }],
}, seedCatalog);

assert.equal(enriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.ok(enriched.routines[0].exercises[0].primaryMuscles.includes('Biceps'));

const tricepsCatalog = buildSeedCatalog([
  { id: '2', name: 'Cable Triceps Pushdown', bodyPart: 'Arms', target: 'Triceps' },
]);
const aliasEnriched = enrichWorkoutData({
  routines: [{ id: 'r2', exercises: [{ name: 'Cable Bar Pushdown', sets: [{ weight: '30', reps: '12', isDone: true }] }] }],
  history: [],
}, tricepsCatalog, {
  customAliases: { 'cable bar pushdown': 'cable triceps pushdown' },
});
assert.equal(aliasEnriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.equal(aliasEnriched.routines[0].exercises[0].catalogExerciseId, 'seed-2');

const facePullCatalog = [
  {
    id: 'snapshot-face-pull',
    sourceId: 'face-pull',
    name: 'Face Pull',
    bodyPart: 'Shoulders',
    target: 'Rear Delts',
    primaryMuscles: ['Shoulders'],
    secondaryMuscles: ['Upper Back'],
    equipment: ['Cable'],
    images: [],
    videos: [],
    source: 'snapshot',
  },
];
const facePullAliasEnriched = enrichWorkoutData({
  routines: [{ id: 'r-face', exercises: [{ name: 'Face Pulls', sets: [{ isDone: true }] }] }],
  history: [],
}, facePullCatalog);
assert.equal(facePullAliasEnriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.equal(facePullAliasEnriched.routines[0].exercises[0].catalogExerciseId, 'snapshot-face-pull');

const shoulderCatalog = buildSeedCatalog([
  { id: '53', name: 'Shoulder Press Machine', bodyPart: 'Shoulders', target: 'Deltoids' },
  { id: '8', name: 'Lateral Raise', bodyPart: 'Shoulders', target: 'Deltoids' },
]);
const shoulderAliasEnriched = enrichWorkoutData({
  routines: [{
    id: 'r3',
    exercises: [
      { name: 'Machine Shoulder Press', sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
      { name: 'Lateral Raises', sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
    ],
  }],
  history: [],
}, shoulderCatalog);
assert.equal(shoulderAliasEnriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.equal(shoulderAliasEnriched.routines[0].exercises[1].mappingStatus, 'mapped');
assert.ok(shoulderAliasEnriched.routines[0].exercises[1].primaryMuscles.includes('Shoulders'));

const generatedAliasCatalog = [
  {
    id: 'snapshot-machine-crunch',
    sourceId: '1000',
    name: 'Machine Crunch',
    bodyPart: 'Abs',
    target: 'Abs',
    primaryMuscles: ['Abs'],
    secondaryMuscles: [],
    equipment: ['Machine'],
    images: [],
    videos: [],
    source: 'snapshot',
  },
];
const generatedAliasEnriched = enrichWorkoutData({
  routines: [{ id: 'r-generated', exercises: [{ name: 'Crunch Machine', sets: [{ isDone: true }] }] }],
  history: [],
}, generatedAliasCatalog);
assert.equal(generatedAliasEnriched.routines[0].exercises[0].mappingStatus, 'mapped');
assert.equal(generatedAliasEnriched.routines[0].exercises[0].catalogExerciseId, 'snapshot-machine-crunch');

const mediaCatalog = [
  {
    id: 'snapshot-pull-up',
    sourceId: '1234',
    name: 'Pull-Up',
    bodyPart: 'Back',
    target: 'Lats',
    primaryMuscles: ['Lats'],
    secondaryMuscles: ['Biceps'],
    equipment: ['Bodyweight'],
    images: ['images/1234-example.jpg'],
    videos: ['videos/1234-example.gif'],
    source: 'snapshot',
  },
];
const mediaEnriched = enrichWorkoutData({
  routines: [{ id: 'r-media', exercises: [{ name: 'Pull Up', sets: [{ isDone: true }] }] }],
  history: [],
}, mediaCatalog);
assert.equal(mediaEnriched.routines[0].exercises[0].images[0], 'https://media.example.com/images/1234-example.jpg');
assert.equal(mediaEnriched.routines[0].exercises[0].videos[0], 'https://media.example.com/videos/1234-example.gif');
assert.equal(mediaEnriched.routines[0].exercises[0].imageRefs[0], 'images/1234-example.jpg');
assert.equal(mediaEnriched.routines[0].exercises[0].videoRefs[0], 'videos/1234-example.gif');

const score = getExerciseVolumeScore(enriched.history[0].exercises[0]);
assert.equal(score.score, 200);

const dashboard = computeMuscleDashboard(enriched.history, 30);
assert.equal(dashboard.topMuscles[0].muscle, 'Biceps');

const todayIso = toLocalDateKey(new Date());
const sixDaysAgo = new Date();
sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
const eightDaysAgo = new Date();
eightDaysAgo.setDate(eightDaysAgo.getDate() - 8);
const windowHistory = [
  {
    id: 'w-7',
    dateISO: toLocalDateKey(sevenDaysAgo),
    exercises: [
      { name: 'Shoulder Press Machine', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
      { name: 'Lateral Raise', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
    ],
  },
  {
    id: 'w-6-multi-primary',
    dateISO: toLocalDateKey(sixDaysAgo),
    exercises: [{ name: 'Machine Press', mappingStatus: 'mapped', primaryMuscles: ['Shoulders', 'Front Delts'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] }],
  },
  {
    id: 'w-8-old',
    dateISO: toLocalDateKey(eightDaysAgo),
    exercises: [{ name: 'Shoulder Press', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] }],
  },
  {
    id: 'w-today-abs',
    dateISO: todayIso,
    exercises: [{ name: 'Crunch', mappingStatus: 'mapped', primaryMuscles: ['Abs'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] }],
  },
];
const windowDashboard = computeMuscleDashboard(windowHistory, 7, []);
const windowShoulders = windowDashboard.muscles.find(item => item.muscle === 'Shoulders');
assert.equal(windowShoulders?.directSets, 9);

const exactBoundaryHistory = [
  {
    id: 'only-7',
    dateISO: toLocalDateKey(sevenDaysAgo),
    exercises: [
      { name: 'Shoulder Press Machine', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
      { name: 'Lateral Raise', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] },
    ],
  },
  {
    id: 'old-8',
    dateISO: toLocalDateKey(eightDaysAgo),
    exercises: [{ name: 'Shoulder Press', mappingStatus: 'mapped', primaryMuscles: ['Shoulders'], secondaryMuscles: [], sets: [{ isDone: true }, { isDone: true }, { isDone: true }] }],
  },
];
const exactBoundaryDashboard = computeMuscleDashboard(exactBoundaryHistory, 7, []);
const exactBoundaryShoulders = exactBoundaryDashboard.muscles.find(item => item.muscle === 'Shoulders');
assert.equal(exactBoundaryShoulders?.directSets, 6);

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

const normalizedUsda = normalizeUsdaFood({
  fdcId: 123,
  description: 'Greek Yogurt',
  brandOwner: 'USDA Brand',
  gtinUpc: '111222333444',
  servingSize: 170,
  servingSizeUnit: 'g',
  foodNutrients: [
    { nutrientNumber: '208', value: 120 },
    { nutrientNumber: '203', value: 15 },
    { nutrientNumber: '205', value: 8 },
    { nutrientNumber: '204', value: 0 },
  ],
});
assert.equal(normalizedUsda.source, 'usda');
assert.equal(normalizedUsda.name, 'Greek Yogurt');
assert.equal(normalizedUsda.barcode, '111222333444');
assert.equal(normalizedUsda.macrosPer100, false);

const hybridTextRanked = rankHybridFoodResults([
  { id: 'off-1', source: 'off', name: 'Greek Yogurt', brand: 'Brand A', calories: 90, protein: 10, carbs: 4, fat: 0 },
  { id: 'usda-1', source: 'usda', name: 'Greek Yogurt', brand: 'USDA', calories: 95, protein: 10, carbs: 5, fat: 0, isVerified: true },
], 'greek yogurt', { barcode: false });
assert.equal(hybridTextRanked[0].source, 'usda');

const hybridBarcodeRanked = rankHybridFoodResults([
  { id: 'usda-2', source: 'usda', name: 'Milk', brand: 'USDA', barcode: '12345678', calories: 60, protein: 3, carbs: 5, fat: 2, isVerified: true },
  { id: 'off-2', source: 'off', name: 'Milk', brand: 'OFF', barcode: '12345678', calories: 62, protein: 3, carbs: 5, fat: 2 },
], '12345678', { barcode: true });
assert.equal(hybridBarcodeRanked[0].source, 'off');

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

const exerciseCatalogModulePath = require.resolve('../utils/exerciseCatalog.js');
delete process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL;
delete require.cache[exerciseCatalogModulePath];
const { mergeCatalogs: mergeCatalogsWithoutMediaBase } = require('../utils/exerciseCatalog.js');
const unresolvedSnapshotCatalog = mergeCatalogsWithoutMediaBase([], [
  {
    id: 'snapshot-local-video',
    name: 'Local Video Demo',
    source: 'snapshot',
    primaryMuscles: ['Chest'],
    secondaryMuscles: [],
    equipment: ['Bodyweight'],
    images: ['images/demo.jpg'],
    videos: ['videos/demo.gif'],
  },
]);
assert.equal(unresolvedSnapshotCatalog[0].images.length, 0);
assert.equal(unresolvedSnapshotCatalog[0].videos.length, 0);
assert.equal(unresolvedSnapshotCatalog[0].imageRefs[0], 'images/demo.jpg');
assert.equal(unresolvedSnapshotCatalog[0].videoRefs[0], 'videos/demo.gif');
assert.equal(unresolvedSnapshotCatalog[0].unresolvedImageCount, 1);
assert.equal(unresolvedSnapshotCatalog[0].unresolvedVideoCount, 1);
assert.equal(unresolvedSnapshotCatalog[0].mediaConfigRequired, true);

console.log('Smoke tests passed');
