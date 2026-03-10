const BODY_PART_CONFIG = {
  abs: { primary: ['Abs'], secondary: ['Obliques'], equipment: ['Bodyweight'] },
  arms: { primary: ['Biceps', 'Triceps'], secondary: ['Forearms'], equipment: ['Barbell'] },
  back: { primary: ['Lats', 'Upper Back'], secondary: ['Rear Delts', 'Lower Back'], equipment: ['Cable'] },
  chest: { primary: ['Chest'], secondary: ['Front Delts', 'Triceps'], equipment: ['Barbell'] },
  legs: { primary: ['Quads', 'Hamstrings'], secondary: ['Glutes', 'Calves'], equipment: ['Barbell'] },
  shoulders: { primary: ['Shoulders'], secondary: ['Upper Back', 'Triceps'], equipment: ['Dumbbell'] },
};

const TARGET_TO_MUSCLE = {
  core: { primary: ['Abs'], secondary: ['Obliques'] },
  biceps: { primary: ['Biceps'], secondary: ['Forearms'] },
  triceps: { primary: ['Triceps'], secondary: ['Shoulders'] },
  chest: { primary: ['Chest'], secondary: ['Triceps', 'Front Delts'] },
  shoulders: { primary: ['Shoulders'], secondary: ['Upper Back'] },
  lats: { primary: ['Lats'], secondary: ['Biceps', 'Upper Back'] },
  upper: { primary: ['Upper Back'], secondary: ['Rear Delts'] },
  lower: { primary: ['Lower Back'], secondary: ['Glutes'] },
  quads: { primary: ['Quads'], secondary: ['Glutes'] },
  hamstrings: { primary: ['Hamstrings'], secondary: ['Glutes', 'Calves'] },
  glutes: { primary: ['Glutes'], secondary: ['Hamstrings'] },
  calves: { primary: ['Calves'], secondary: [] },
};

export const EXERCISE_ALIASES = {
  'cable bar pushdown': 'cable triceps pushdown',
  'machine chest press': 'chest press machine',
  'lat pulldown': 'lat pull down',
  'incline dumbell press': 'incline dumbbell press',
};

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

export function normalizeExerciseName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferBodyPart(primaryMuscles = [], fallbackBodyPart = '') {
  const first = primaryMuscles[0]?.toLowerCase();
  if (first?.includes('chest')) return 'Chest';
  if (first?.includes('lat') || first?.includes('back')) return 'Back';
  if (first?.includes('quad') || first?.includes('hamstring') || first?.includes('glute') || first?.includes('calf')) return 'Legs';
  if (first?.includes('shoulder') || first?.includes('delt')) return 'Shoulders';
  if (first?.includes('biceps') || first?.includes('triceps') || first?.includes('forearm')) return 'Arms';
  if (first?.includes('abs') || first?.includes('oblique')) return 'Abs';
  return fallbackBodyPart || 'Full Body';
}

function inferTarget(primaryMuscles = [], fallbackTarget = '') {
  return primaryMuscles[0] || fallbackTarget || 'General';
}

function inferEquipmentFromName(name = '', fallback = []) {
  const normalized = normalizeExerciseName(name);
  const equipment = [...fallback];
  if (normalized.includes('barbell')) equipment.push('Barbell');
  if (normalized.includes('dumbbell')) equipment.push('Dumbbell');
  if (normalized.includes('cable')) equipment.push('Cable');
  if (normalized.includes('machine')) equipment.push('Machine');
  if (normalized.includes('bodyweight') || normalized.includes('plank') || normalized.includes('push up')) equipment.push('Bodyweight');
  if (normalized.includes('smith')) equipment.push('Smith Machine');
  return uniqueValues(equipment.length ? equipment : ['Bodyweight']);
}

function coerceMuscleName(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return coerceMuscleName(value.name || value.name_en || value.name_original || value.common_name || value.exercise_base);
  }
  return String(value)
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function normalizeLegacyExercise(exercise = {}) {
  const bodyPartKey = normalizeExerciseName(exercise.bodyPart);
  const targetKey = normalizeExerciseName(exercise.target);
  const bodyConfig = BODY_PART_CONFIG[bodyPartKey] || {};
  const targetConfig = TARGET_TO_MUSCLE[targetKey] || {};
  const primaryMuscles = uniqueValues([...(targetConfig.primary || []), ...(bodyConfig.primary || [])]);
  const secondaryMuscles = uniqueValues([...(targetConfig.secondary || []), ...(bodyConfig.secondary || [])]);

  return {
    id: `seed-${exercise.id}`,
    sourceId: String(exercise.id),
    name: exercise.name,
    bodyPart: exercise.bodyPart || inferBodyPart(primaryMuscles),
    target: exercise.target || inferTarget(primaryMuscles),
    primaryMuscles,
    secondaryMuscles,
    equipment: inferEquipmentFromName(exercise.name, bodyConfig.equipment || []),
    images: [],
    videos: [],
    source: 'seed',
  };
}

export function buildSeedCatalog(rawExercises = []) {
  return rawExercises.map(normalizeLegacyExercise);
}

function resolveReferenceNames(values = [], lookup = new Map()) {
  return uniqueValues((values || []).map(value => {
    if (typeof value === 'number') return lookup.get(value) || null;
    if (typeof value === 'object') return coerceMuscleName(value.name || value.common_name || value);
    return coerceMuscleName(value);
  }));
}

export function normalizeWgerExercise(item = {}, referenceMaps = {}) {
  const sourceId = String(
    item.exercise_base ||
    item.exerciseBase ||
    item.base_id ||
    item.id ||
    ''
  );
  const primaryMuscles = uniqueValues(
    resolveReferenceNames(item.muscles || item.muscles_primary || [], referenceMaps.muscles)
  );
  const secondaryMuscles = uniqueValues(
    resolveReferenceNames(item.muscles_secondary || item.secondary_muscles || [], referenceMaps.muscles)
  );
  const equipment = inferEquipmentFromName(
    item.name || item.exercise_name || item.original_name || '',
    resolveReferenceNames(item.equipment || [], referenceMaps.equipment)
  );
  const baseImages = item.images || referenceMaps.images?.get(sourceId) || [];
  const baseVideos = item.videos || referenceMaps.videos?.get(sourceId) || [];
  const categoryName =
    item.category?.name ||
    referenceMaps.categories?.get(item.category) ||
    referenceMaps.categories?.get(item.category_id) ||
    '';

  return {
    id: `wger-${sourceId}`,
    sourceId,
    name: item.name || item.exercise_name || item.original_name || '',
    bodyPart: categoryName || inferBodyPart(primaryMuscles),
    target: inferTarget(primaryMuscles, categoryName),
    primaryMuscles,
    secondaryMuscles,
    equipment,
    images: (baseImages || []).map(image => image.image || image.url || image).filter(Boolean),
    videos: (baseVideos || []).map(video => video.video || video.url || video).filter(Boolean),
    source: 'wger',
  };
}

export function buildExerciseLookup(catalog = []) {
  const lookup = new Map();
  catalog.forEach(item => {
    const normalized = normalizeExerciseName(item.name);
    if (normalized) lookup.set(normalized, item);
  });

  Object.entries(EXERCISE_ALIASES).forEach(([alias, canonical]) => {
    const target = lookup.get(normalizeExerciseName(canonical));
    if (target) lookup.set(normalizeExerciseName(alias), target);
  });

  return lookup;
}

function enrichExerciseItem(exercise, lookup) {
  const fallbackName = exercise?.name || '';
  const normalizedName = normalizeExerciseName(fallbackName);
  const matched = lookup.get(normalizedName);

  if (!matched) {
    return {
      ...exercise,
      source: exercise?.source || 'legacy',
      mappingStatus: 'unmapped',
    };
  }

  return {
    ...exercise,
    catalogExerciseId: matched.id,
    primaryMuscles: matched.primaryMuscles,
    secondaryMuscles: matched.secondaryMuscles,
    equipment: matched.equipment,
    bodyPart: matched.bodyPart,
    target: matched.target,
    source: matched.source,
    images: exercise?.images?.length ? exercise.images : matched.images,
    videos: exercise?.videos?.length ? exercise.videos : matched.videos,
    mappingStatus: 'mapped',
  };
}

function enrichRoutine(routine, lookup) {
  return {
    ...routine,
    exercises: (routine.exercises || []).map(exercise => enrichExerciseItem(exercise, lookup)),
  };
}

function enrichHistoryEntry(entry, lookup) {
  return {
    ...entry,
    exercises: (entry.exercises || []).map(exercise => enrichExerciseItem(exercise, lookup)),
  };
}

export function enrichWorkoutData({ routines = [], history = [] }, catalog = []) {
  const lookup = buildExerciseLookup(catalog);
  return {
    routines: routines.map(routine => enrichRoutine(routine, lookup)),
    history: history.map(entry => enrichHistoryEntry(entry, lookup)),
  };
}

export function mergeCatalogs(seedCatalog = [], remoteCatalog = []) {
  if (!remoteCatalog.length) return seedCatalog;

  const byName = new Map();
  seedCatalog.forEach(item => {
    byName.set(normalizeExerciseName(item.name), item);
  });
  remoteCatalog.forEach(item => {
    byName.set(normalizeExerciseName(item.name), item);
  });
  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

function extractPaginatedResults(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.exercises)) return data.exercises;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

async function fetchPaginated(url) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl);
    if (!response.ok) {
      throw new Error(`wger request failed: ${response.status}`);
    }

    const data = await response.json();
    const items = extractPaginatedResults(data);
    results.push(...items);
    nextUrl = data?.next || null;
    if (Array.isArray(data)) nextUrl = null;
  }

  return results;
}

async function fetchReferenceMap(url, valueSelector = item => item.name) {
  try {
    const rows = await fetchPaginated(url);
    return new Map(rows.map(item => [item.id, valueSelector(item)]));
  } catch (error) {
    return new Map();
  }
}

async function fetchMediaMap(url, keyCandidates = ['exercise_base', 'exercise']) {
  try {
    const rows = await fetchPaginated(url);
    const mediaMap = new Map();
    rows.forEach(item => {
      const key = keyCandidates.map(candidate => item?.[candidate]).find(Boolean);
      if (!key) return;
      const normalizedKey = String(key);
      const list = mediaMap.get(normalizedKey) || [];
      const mediaUrl = item.image || item.url || item.video;
      if (mediaUrl) list.push(mediaUrl);
      mediaMap.set(normalizedKey, list);
    });
    return mediaMap;
  } catch (error) {
    return new Map();
  }
}

export async function fetchWgerCatalog() {
  const [muscles, equipment, categories, images, videos] = await Promise.all([
    fetchReferenceMap('https://wger.de/api/v2/muscle/?limit=200', item => item.name_en || item.common_name || item.name),
    fetchReferenceMap('https://wger.de/api/v2/equipment/?limit=200', item => item.name),
    fetchReferenceMap('https://wger.de/api/v2/exercisecategory/?limit=200', item => item.name),
    fetchMediaMap('https://wger.de/api/v2/exerciseimage/?limit=200'),
    fetchMediaMap('https://wger.de/api/v2/exercisevideo/?limit=200'),
  ]);

  const referenceMaps = { muscles, equipment, categories, images, videos };
  const candidateUrls = [
    'https://wger.de/api/v2/exercisebaseinfo/?limit=200&language=2',
    'https://wger.de/api/v2/exerciseinfo/?limit=200&language=2',
    'https://wger.de/api/v2/exercise/?limit=200&language=2',
  ];

  let rawExercises = [];
  for (const url of candidateUrls) {
    try {
      const rows = await fetchPaginated(url);
      const normalized = rows
        .map(item => normalizeWgerExercise(item, referenceMaps))
        .filter(item => item.name);
      if (normalized.length) {
        rawExercises = normalized;
        break;
      }
    } catch (error) {
      continue;
    }
  }

  return rawExercises
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

export function getExerciseVolumeScore(exercise = {}) {
  const primaryMuscles = exercise.primaryMuscles || [];
  const secondaryMuscles = exercise.secondaryMuscles || [];
  const completedSets = (exercise.sets || []).filter(set => set.isDone !== false);
  const score = completedSets.reduce((sum, set) => {
    const weight = Number(set.weight) || 0;
    const reps = Number(set.reps) || 0;
    return sum + weight * reps;
  }, 0);

  return {
    score: score > 0 ? score : completedSets.length * 10,
    primaryMuscles,
    secondaryMuscles,
    mappingStatus: exercise.mappingStatus || 'unmapped',
  };
}

function collectCatalogMuscles(catalog = []) {
  return uniqueValues(
    (catalog || []).flatMap(item => [
      ...(item.primaryMuscles || []),
      ...(item.secondaryMuscles || []),
    ])
  );
}

function getHistoryWithinDays(history = [], days = 7) {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return history.filter(entry => {
    const timestamp = new Date(entry.dateISO || entry.dateString || entry.date).getTime();
    return Number.isFinite(timestamp) && timestamp >= threshold;
  });
}

export function computeMuscleDashboard(history = [], days = 7, catalog = []) {
  const windowEntries = getHistoryWithinDays(history, days);
  const muscleMap = {};
  let unmappedCount = 0;

  collectCatalogMuscles(catalog).forEach(muscle => {
    muscleMap[muscle] = {
      muscle,
      total: 0,
      directSets: 0,
      assistedSets: 0,
      sessionCount: 0,
      lastTrainedAt: null,
    };
  });

  windowEntries.forEach(entry => {
    const workedThisSession = new Set();
    (entry.exercises || []).forEach(exercise => {
      const primaryMuscles = exercise.primaryMuscles || [];
      const secondaryMuscles = exercise.secondaryMuscles || [];
      const mappingStatus = exercise.mappingStatus || 'unmapped';
      const completedSets = (exercise.sets || []).filter(set => set.isDone !== false).length;

      if (mappingStatus === 'unmapped') {
        unmappedCount += 1;
        return;
      }

      if (!completedSets) return;

      primaryMuscles.forEach(muscle => {
        if (!muscleMap[muscle]) {
          muscleMap[muscle] = {
            muscle,
            total: 0,
            directSets: 0,
            assistedSets: 0,
            sessionCount: 0,
            lastTrainedAt: null,
          };
        }
        muscleMap[muscle].directSets += completedSets;
        muscleMap[muscle].total += completedSets;
        muscleMap[muscle].lastTrainedAt = entry.dateISO || entry.dateString || entry.date || muscleMap[muscle].lastTrainedAt;
        workedThisSession.add(muscle);
      });
      secondaryMuscles.forEach(muscle => {
        if (!muscleMap[muscle]) {
          muscleMap[muscle] = {
            muscle,
            total: 0,
            directSets: 0,
            assistedSets: 0,
            sessionCount: 0,
            lastTrainedAt: null,
          };
        }
        muscleMap[muscle].assistedSets += completedSets;
        muscleMap[muscle].total += completedSets * 0.5;
        muscleMap[muscle].lastTrainedAt = entry.dateISO || entry.dateString || entry.date || muscleMap[muscle].lastTrainedAt;
        workedThisSession.add(muscle);
      });
    });

    workedThisSession.forEach(muscle => {
      if (muscleMap[muscle]) {
        muscleMap[muscle].sessionCount += 1;
      }
    });
  });

  const entries = Object.values(muscleMap)
    .map(entry => ({
      ...entry,
      total: Math.round(entry.total * 10) / 10,
      lastTrainedDays: entry.lastTrainedAt
        ? Math.max(0, Math.floor((Date.now() - new Date(entry.lastTrainedAt).getTime()) / (24 * 60 * 60 * 1000)))
        : null,
    }))
    .sort((a, b) => b.total - a.total);

  const maxScore = entries[0]?.total || 0;
  const trainedEntries = entries.filter(entry => entry.total > 0);
  const neglectedPool = [...entries]
    .sort((a, b) => {
      if ((a.total === 0) !== (b.total === 0)) return a.total === 0 ? -1 : 1;
      if ((b.lastTrainedDays ?? -1) !== (a.lastTrainedDays ?? -1)) {
        return (b.lastTrainedDays ?? -1) - (a.lastTrainedDays ?? -1);
      }
      return a.total - b.total;
    });

  return {
    muscles: entries.map(entry => ({
      ...entry,
      intensity: maxScore ? Math.max(0.12, entry.total / maxScore) : 0,
    })),
    topMuscles: trainedEntries.slice(0, 3),
    neglectedMuscles: neglectedPool.slice(0, 3),
    trainedMuscleCount: trainedEntries.length,
    totalMuscles: entries.length,
    totalSetUnits: Math.round(trainedEntries.reduce((sum, entry) => sum + entry.total, 0) * 10) / 10,
    unmappedCount,
  };
}

export function getRecentPRs(history = [], limit = 3) {
  return history
    .flatMap(entry =>
      (entry.exercises || [])
        .filter(exercise => exercise.isPR)
        .map(exercise => ({
          id: `${entry.id}-${exercise.name}`,
          name: exercise.name,
          best1RM: exercise.best1RM,
          previousBest: exercise.previousBest,
          dateString: entry.dateString,
        }))
    )
    .slice(0, limit);
}
