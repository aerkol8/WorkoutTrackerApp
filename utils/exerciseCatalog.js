import generatedExerciseAliases from '../data/exerciseAliases.generated.json';

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
  brachialis: { primary: ['Brachialis'], secondary: ['Biceps', 'Forearms'] },
  brachioradialis: { primary: ['Brachioradialis'], secondary: ['Forearms', 'Biceps'] },
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
  'back extension': 'Back Extension',
  'cable bar pushdown': 'Cable Triceps Pushdown (V-Bar)',
  'cable crunches': 'Cable Kneeling Crunch',
  'cable rear delt fly': 'Cable Rear Delt Row (Stirrups)',
  'cable row': 'Cable Seated Wide-Grip Row',
  'chest fly machine': 'Lever Seated Fly',
  'close grip lat pulldown': 'Band Close-Grip Pulldown',
  'dumbbell curl': 'Dumbbell Biceps Curl',
  'face pulls': 'face pull',
  'hammer curl': 'Dumbbell Hammer Curl',
  'incline dumbell press': 'Dumbbell Incline Bench Press',
  'machine chest fly': 'Lever Seated Fly',
  'machine chest press': 'Lever Chest Press',
  'lat pulldown': 'Cable Lat Pulldown Full Range Of Motion',
  'machine shoulder press': 'Lever Shoulder Press',
  'lateral raise machine': 'Lever Lateral Raise',
  'machine lateral raise': 'Lever Lateral Raise',
  'lateral raises': 'lateral raise',
  'dumbbell lateral raises': 'Dumbbell Lateral Raise',
  'overhead rope extension': 'Cable Overhead Triceps Extension (Rope Attachment)',
  'overhead rope triceps extension': 'Cable Overhead Triceps Extension (Rope Attachment)',
  'plate loaded chest press': 'Lever Chest Press',
  'plate loaded wide grip row': 'Cable Seated Wide-Grip Row',
  'reverse barbell curl': 'Barbell Reverse Curl',
  'rope hammer curl': 'Cable Hammer Curl (With Rope)',
  'shoulder press machine': 'Lever Shoulder Press',
  'shoulder press machine seated': 'Lever Shoulder Press',
  'seated shoulder press machine': 'Lever Shoulder Press',
  'shoulder press machine seat': 'Lever Shoulder Press',
  'shoulder press machine seaded': 'Lever Shoulder Press',
  'shoulder press (machine)': 'Lever Shoulder Press',
  'smith machine low incline press': 'Smith Incline Bench Press',
  'smith machine squat': 'Smith Squat',
  'triceps pushdown': 'Cable Triceps Pushdown (V-Bar)',
  'wide grip lat pulldown': 'Twin Handle Parallel Grip Lat Pulldown',
};

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

const SOURCE_PRIORITY = {
  snapshot: 4,
  cache: 3,
  seed: 2,
  legacy: 1,
};

const EXERCISE_MEDIA_BASE_URL = String(process.env.EXPO_PUBLIC_EXERCISE_MEDIA_BASE_URL || '')
  .trim()
  .replace(/\/+$/g, '');

export function normalizeExerciseName(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/\bdumbell\b/g, 'dumbbell')
    .replace(/\bbicep\b/g, 'biceps')
    .replace(/\braises\b/g, 'raise')
    .replace(/\bpresses\b/g, 'press')
    .replace(/\bflies\b/g, 'fly')
    .replace(/\bcrunches\b/g, 'crunch')
    .replace(/\bshrugs\b/g, 'shrug')
    .replace(/\bextensions\b/g, 'extension')
    .replace(/\bcurls\b/g, 'curl')
    .replace(/\brows\b/g, 'row')
    .replace(/\bpulls\b/g, 'pull')
    .replace(/\bpushdowns\b/g, 'pushdown')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const ISO_DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const LOCALIZED_MONTHS = {
  january: 0,
  januarys: 0,
  ocak: 0,
  february: 1,
  subat: 1,
  şubat: 1,
  march: 2,
  mart: 2,
  april: 3,
  nisan: 3,
  may: 4,
  mayis: 4,
  mayıs: 4,
  june: 5,
  haziran: 5,
  july: 6,
  temmuz: 6,
  august: 7,
  agustos: 7,
  ağustos: 7,
  september: 8,
  eylul: 8,
  eylül: 8,
  october: 9,
  ekim: 9,
  november: 10,
  kasim: 10,
  kasım: 10,
  december: 11,
  aralik: 11,
  aralık: 11,
};

function toDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeMonthToken(token = '') {
  return String(token || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parseLocalizedDateKey(text = '') {
  const cleaned = String(text || '')
    .trim()
    .replace(/[,/]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!cleaned) return null;

  const rawTokens = cleaned.split(' ').filter(Boolean);
  const tokens = rawTokens.map(normalizeMonthToken);
  const dayToken = tokens.find(token => /^\d{1,2}$/.test(token));
  const monthToken = tokens.find(token => LOCALIZED_MONTHS[token] !== undefined);
  if (!dayToken || !monthToken) return null;

  const parsedDay = Number(dayToken);
  if (!Number.isFinite(parsedDay) || parsedDay < 1 || parsedDay > 31) return null;
  const parsedMonth = LOCALIZED_MONTHS[monthToken];
  const yearToken = tokens.find(token => /^\d{4}$/.test(token));
  const parsedYear = Number(yearToken || new Date().getFullYear());
  if (!Number.isFinite(parsedYear) || parsedYear < 1970) return null;

  const candidate = new Date(parsedYear, parsedMonth, parsedDay);
  if (!Number.isFinite(candidate.getTime())) return null;
  if (
    candidate.getFullYear() !== parsedYear
    || candidate.getMonth() !== parsedMonth
    || candidate.getDate() !== parsedDay
  ) {
    return null;
  }

  return toDateKey(candidate);
}

function resolveHistoryEntryDateKey(entry = {}) {
  const candidates = [entry.dateISO, entry.date, entry.dateString];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate instanceof Date) {
      const key = toDateKey(candidate);
      if (key) return key;
      continue;
    }

    const rawText = String(candidate).trim();
    if (!rawText) continue;
    if (ISO_DATE_KEY_REGEX.test(rawText)) return rawText;

    const localizedKey = parseLocalizedDateKey(rawText);
    if (localizedKey) return localizedKey;

    const parsed = new Date(rawText);
    if (!Number.isFinite(parsed.getTime())) continue;

    const hasYear = /\b\d{4}\b/.test(rawText);
    if (!hasYear && parsed.getFullYear() < 2010) {
      const withCurrentYear = new Date(`${rawText} ${new Date().getFullYear()}`);
      if (Number.isFinite(withCurrentYear.getTime())) {
        const withCurrentYearKey = toDateKey(withCurrentYear);
        if (withCurrentYearKey) return withCurrentYearKey;
      }
    }

    const parsedKey = toDateKey(parsed);
    if (parsedKey) return parsedKey;
  }

  return null;
}

function getDaysSinceDateKey(dateKey = '') {
  if (!ISO_DATE_KEY_REGEX.test(String(dateKey || ''))) return null;
  const [year, month, day] = String(dateKey).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (!Number.isFinite(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const value = Math.floor((today.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, value);
}

function buildTokenSignature(value = '') {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return '';
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .sort();
  return tokens.join(' ');
}

function getCatalogPriority(item = {}) {
  const source = String(item.source || 'legacy').toLowerCase();
  return SOURCE_PRIORITY[source] ?? 0;
}

function pickPreferredCatalogEntry(current, incoming) {
  if (!current) return incoming;
  if (!incoming) return current;

  const currentPriority = getCatalogPriority(current);
  const incomingPriority = getCatalogPriority(incoming);
  if (incomingPriority !== currentPriority) {
    return incomingPriority > currentPriority ? incoming : current;
  }

  const currentMedia = (current.images?.length || 0) + (current.videos?.length || 0);
  const incomingMedia = (incoming.images?.length || 0) + (incoming.videos?.length || 0);
  if (incomingMedia !== currentMedia) {
    return incomingMedia > currentMedia ? incoming : current;
  }

  const currentPrimaryCount = (current.primaryMuscles || []).length;
  const incomingPrimaryCount = (incoming.primaryMuscles || []).length;
  if (incomingPrimaryCount !== currentPrimaryCount) {
    return incomingPrimaryCount > currentPrimaryCount ? incoming : current;
  }

  return incoming;
}

function resolveTargetConfig(targetKey = '') {
  if (!targetKey) return {};
  if (TARGET_TO_MUSCLE[targetKey]) return TARGET_TO_MUSCLE[targetKey];

  const matched = Object.entries(TARGET_TO_MUSCLE)
    .filter(([key]) => targetKey.includes(key))
    .map(([, config]) => config);

  if (!matched.length) return {};

  return {
    primary: uniqueValues(matched.flatMap(config => config.primary || [])),
    secondary: uniqueValues(matched.flatMap(config => config.secondary || [])),
  };
}

function isAbsoluteUrl(value = '') {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function normalizeMediaRefs(values = []) {
  return uniqueValues(
    (values || [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  );
}

function resolveExerciseMediaUrl(value = '') {
  const rawValue = String(value || '').trim();
  if (!rawValue) return null;
  if (isAbsoluteUrl(rawValue)) return rawValue;
  if (!EXERCISE_MEDIA_BASE_URL) return null;
  return `${EXERCISE_MEDIA_BASE_URL}/${rawValue.replace(/^\/+/g, '')}`;
}

function resolveExerciseMediaList(values = []) {
  return uniqueValues((values || []).map(resolveExerciseMediaUrl).filter(Boolean));
}

function countUnresolvedMedia(values = []) {
  if (EXERCISE_MEDIA_BASE_URL) return 0;
  return (values || []).reduce((count, value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return count;
    return isAbsoluteUrl(rawValue) ? count : count + 1;
  }, 0);
}

function prepareCatalogEntry(item = {}) {
  const images = Array.isArray(item.images) ? item.images : [];
  const videos = Array.isArray(item.videos) ? item.videos : [];
  const imageRefs = normalizeMediaRefs(
    Array.isArray(item.imageRefs) && item.imageRefs.length ? item.imageRefs : images
  );
  const videoRefs = normalizeMediaRefs(
    Array.isArray(item.videoRefs) && item.videoRefs.length ? item.videoRefs : videos
  );
  const unresolvedImageCount = countUnresolvedMedia(imageRefs);
  const unresolvedVideoCount = countUnresolvedMedia(videoRefs);

  return {
    ...item,
    images: resolveExerciseMediaList(imageRefs),
    videos: resolveExerciseMediaList(videoRefs),
    imageRefs,
    videoRefs,
    mediaConfigRequired: unresolvedImageCount + unresolvedVideoCount > 0,
    unresolvedImageCount,
    unresolvedVideoCount,
  };
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

function canonicalizeMuscleName(value) {
  const raw = coerceMuscleName(value);
  if (!raw) return null;

  const normalized = normalizeExerciseName(raw);
  if (!normalized) return raw;

  if (normalized.includes('anterior deltoid') || normalized.includes('front delt')) return 'Front Delts';
  if (normalized.includes('posterior deltoid') || normalized.includes('rear delt')) return 'Rear Delts';
  if (normalized.includes('lateral deltoid') || normalized.includes('middle deltoid') || normalized.includes('medial deltoid')) return 'Shoulders';
  if (normalized.includes('deltoid') || normalized.includes('shoulder')) return 'Shoulders';
  if (normalized.includes('trapezius')) return 'Upper Back';
  if (normalized.includes('latissimus')) return 'Lats';
  if (normalized.includes('erector spinae')) return 'Lower Back';
  if (normalized.includes('pectoralis')) return 'Chest';
  if (normalized.includes('quadriceps')) return 'Quads';
  if (normalized.includes('hamstring')) return 'Hamstrings';
  if (normalized.includes('glute')) return 'Glutes';
  if (normalized.includes('gastrocnemius') || normalized.includes('soleus')) return 'Calves';
  if (normalized.includes('brachioradialis')) return 'Forearms';
  if (normalized.includes('abdominis')) return 'Abs';

  return raw;
}

function canonicalizeLoadMuscleName(value) {
  const raw = coerceMuscleName(value);
  if (!raw) return null;

  const normalized = normalizeExerciseName(raw);
  if (!normalized) return raw;

  if (normalized.includes('delt') || normalized.includes('deltoid') || normalized.includes('shoulder')) return 'Shoulders';
  if (normalized.includes('trapezius')) return 'Upper Back';
  if (normalized.includes('latissimus')) return 'Lats';
  if (normalized.includes('erector spinae')) return 'Lower Back';
  if (normalized.includes('pectoralis')) return 'Chest';
  if (normalized.includes('quadriceps')) return 'Quads';
  if (normalized.includes('hamstring')) return 'Hamstrings';
  if (normalized.includes('glute')) return 'Glutes';
  if (normalized.includes('gastrocnemius') || normalized.includes('soleus')) return 'Calves';
  if (normalized.includes('brachioradialis')) return 'Forearms';
  if (normalized.includes('abdominis')) return 'Abs';

  return raw;
}

export function normalizeLegacyExercise(exercise = {}) {
  const bodyPartKey = normalizeExerciseName(exercise.bodyPart);
  const targetKey = normalizeExerciseName(exercise.target);
  const bodyConfig = BODY_PART_CONFIG[bodyPartKey] || {};
  const targetConfig = resolveTargetConfig(targetKey);
  const hasTargetMapping = Boolean((targetConfig.primary || []).length || (targetConfig.secondary || []).length);
  const primaryMuscles = uniqueValues(
    hasTargetMapping ? (targetConfig.primary || []) : (bodyConfig.primary || [])
  );
  const secondaryMuscles = uniqueValues([
    ...(hasTargetMapping ? (targetConfig.secondary || []) : (bodyConfig.secondary || [])),
    ...(hasTargetMapping ? (bodyConfig.secondary || []) : []),
  ]);

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
  return rawExercises.map(normalizeLegacyExercise).map(prepareCatalogEntry);
}

export function buildExerciseLookup(catalog = [], customAliases = {}) {
  const lookup = new Map();
  const signatureCandidates = new Map();

  catalog.forEach(item => {
    const normalized = normalizeExerciseName(item.name);
    if (normalized) lookup.set(normalized, item);

    const signature = buildTokenSignature(item.name);
    if (!signature) return;
    const current = signatureCandidates.get(signature);
    if (!current) {
      signatureCandidates.set(signature, item);
      return;
    }
    if (current === null) return;
    const preferred = pickPreferredCatalogEntry(current, item);
    if (preferred.id !== current.id) {
      signatureCandidates.set(signature, null);
    } else if (current.id !== item.id) {
      signatureCandidates.set(signature, null);
    }
  });

  const mergedAliases = getMergedExerciseAliases(customAliases);

  Object.entries(mergedAliases).forEach(([alias, canonical]) => {
    const target = lookup.get(normalizeExerciseName(canonical));
    if (target) lookup.set(normalizeExerciseName(alias), target);
  });

  signatureCandidates.forEach((item, signature) => {
    if (!item) return;
    lookup.set(`sig:${signature}`, item);
  });

  return lookup;
}

function getMergedExerciseAliases(customAliases = {}) {
  return {
    ...(generatedExerciseAliases || {}),
    ...EXERCISE_ALIASES,
    ...(customAliases || {}),
  };
}

function getCatalogSearchKey(item = {}) {
  return item.id || normalizeExerciseName(item.name);
}

export function buildExerciseAliasIndex(catalog = [], customAliases = {}) {
  const lookup = new Map();
  const aliasIndex = new Map();

  (catalog || []).forEach(item => {
    const normalizedName = normalizeExerciseName(item?.name);
    if (!normalizedName) return;
    lookup.set(normalizedName, item);
  });

  Object.entries(getMergedExerciseAliases(customAliases)).forEach(([alias, canonical]) => {
    const normalizedAlias = normalizeExerciseName(alias);
    const target = lookup.get(normalizeExerciseName(canonical));
    if (!normalizedAlias || !target) return;
    const key = getCatalogSearchKey(target);
    const aliases = aliasIndex.get(key) || [];
    aliasIndex.set(key, uniqueValues([...aliases, normalizedAlias]));
  });

  return aliasIndex;
}

export function matchesExerciseSearch(exercise = {}, query = '', aliasIndex = new Map()) {
  const normalizedQuery = normalizeExerciseName(query);
  if (!normalizedQuery) return true;

  const searchTerms = uniqueValues([
    exercise.name,
    exercise.bodyPart,
    exercise.target,
    ...(exercise.primaryMuscles || []),
    ...(exercise.secondaryMuscles || []),
    ...(exercise.equipment || []),
    ...(aliasIndex.get(getCatalogSearchKey(exercise)) || []),
  ])
    .map(normalizeExerciseName)
    .filter(Boolean);

  return searchTerms.some(term => term.includes(normalizedQuery));
}

function enrichExerciseItem(exercise, lookup) {
  const fallbackName = exercise?.name || '';
  const normalizedName = normalizeExerciseName(fallbackName);
  const signature = buildTokenSignature(fallbackName);
  const ownImageRefs = normalizeMediaRefs(
    Array.isArray(exercise?.imageRefs) && exercise.imageRefs.length
      ? exercise.imageRefs
      : (exercise?.images || [])
  );
  const ownVideoRefs = normalizeMediaRefs(
    Array.isArray(exercise?.videoRefs) && exercise.videoRefs.length
      ? exercise.videoRefs
      : (exercise?.videos || [])
  );
  const matched =
    lookup.get(normalizedName) ||
    (signature ? lookup.get(`sig:${signature}`) : null);

  if (!matched) {
    return {
      ...exercise,
      source: exercise?.source || 'legacy',
      mappingStatus: 'unmapped',
    };
  }

  const matchedImageRefs = normalizeMediaRefs(matched.imageRefs || matched.images || []);
  const matchedVideoRefs = normalizeMediaRefs(matched.videoRefs || matched.videos || []);

  return {
    ...exercise,
    catalogExerciseId: matched.id,
    primaryMuscles: matched.primaryMuscles,
    secondaryMuscles: matched.secondaryMuscles,
    equipment: matched.equipment,
    bodyPart: matched.bodyPart,
    target: matched.target,
    source: matched.source,
    images: ownImageRefs.length ? resolveExerciseMediaList(ownImageRefs) : resolveExerciseMediaList(matchedImageRefs),
    videos: ownVideoRefs.length ? resolveExerciseMediaList(ownVideoRefs) : resolveExerciseMediaList(matchedVideoRefs),
    imageRefs: ownImageRefs.length ? ownImageRefs : matchedImageRefs,
    videoRefs: ownVideoRefs.length ? ownVideoRefs : matchedVideoRefs,
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

export function enrichWorkoutData({ routines = [], history = [] }, catalog = [], options = {}) {
  const lookup = buildExerciseLookup(catalog, options.customAliases || {});
  return {
    routines: routines.map(routine => enrichRoutine(routine, lookup)),
    history: history.map(entry => enrichHistoryEntry(entry, lookup)),
  };
}

export function suggestCatalogMatches(query = '', catalog = [], limit = 3, customAliases = {}) {
  const normalizedQuery = normalizeExerciseName(query);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery.split(' ').filter(Boolean);
  const aliasIndex = buildExerciseAliasIndex(catalog, customAliases);

  const scored = (catalog || [])
    .map(item => {
      const normalizedName = normalizeExerciseName(item.name);
      const nameTokens = normalizedName.split(' ').filter(Boolean);
      const aliases = aliasIndex.get(getCatalogSearchKey(item)) || [];
      const matchingTokens = queryTokens.filter(token => nameTokens.includes(token)).length;
      const aliasMatchingTokens = queryTokens.filter(token => aliases.some(alias => alias.includes(token))).length;
      const startsWith = normalizedName.startsWith(normalizedQuery);
      const contains = normalizedName.includes(normalizedQuery);
      const aliasStartsWith = aliases.some(alias => alias.startsWith(normalizedQuery));
      const aliasContains = aliases.some(alias => alias.includes(normalizedQuery));
      const hasVideo = (item.videos || []).length > 0;
      const hasImage = (item.images || []).length > 0;
      const score =
        (startsWith ? 6 : 0) +
        (contains ? 4 : 0) +
        (aliasStartsWith ? 5 : 0) +
        (aliasContains ? 3 : 0) +
        matchingTokens * 2 +
        aliasMatchingTokens * 2 +
        (hasVideo ? 2 : 0) +
        (hasImage ? 1 : 0);

      return { item, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.name.localeCompare(b.item.name, 'en', { sensitivity: 'base' });
    })
    .slice(0, limit)
    .map(entry => entry.item);

  return scored;
}

export function mergeCatalogs(seedCatalog = [], remoteCatalog = []) {
  const byName = new Map();

  [...(seedCatalog || []), ...(remoteCatalog || [])].forEach(item => {
    const normalizedName = normalizeExerciseName(item?.name);
    if (!normalizedName) return;
    const current = byName.get(normalizedName);
    byName.set(normalizedName, pickPreferredCatalogEntry(current, item));
  });

  return Array.from(byName.values())
    .map(prepareCatalogEntry)
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
      ...(item.primaryMuscles || []).map(canonicalizeLoadMuscleName),
      ...(item.secondaryMuscles || []).map(canonicalizeLoadMuscleName),
    ])
  );
}

function getHistoryWithinDays(history = [], days = 7) {
  const safeDays = Math.max(1, Number(days) || 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setDate(windowStart.getDate() - safeDays);
  const todayKey = toDateKey(today);
  const windowStartKey = toDateKey(windowStart);

  return history.filter(entry => {
    const dateKey = resolveHistoryEntryDateKey(entry);
    if (!dateKey) return false;
    return dateKey >= windowStartKey && dateKey <= todayKey;
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
    const entryDateKey = resolveHistoryEntryDateKey(entry);
    (entry.exercises || []).forEach(exercise => {
      const primaryMuscles = uniqueValues((exercise.primaryMuscles || []).map(canonicalizeLoadMuscleName));
      const secondaryMuscles = uniqueValues((exercise.secondaryMuscles || []).map(canonicalizeLoadMuscleName));
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
        muscleMap[muscle].lastTrainedAt = entryDateKey || muscleMap[muscle].lastTrainedAt;
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
        muscleMap[muscle].lastTrainedAt = entryDateKey || muscleMap[muscle].lastTrainedAt;
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
      lastTrainedDays: entry.lastTrainedAt ? getDaysSinceDateKey(entry.lastTrainedAt) : null,
    }))
    .sort((a, b) => {
      if (b.directSets !== a.directSets) return b.directSets - a.directSets;
      return b.total - a.total;
    });

  const maxDirectScore = entries[0]?.directSets || 0;
  const maxScore = entries[0]?.total || 0;
  const trainedEntries = entries.filter(entry => entry.directSets > 0);
  const neglectedPool = [...entries]
    .sort((a, b) => {
      if ((a.directSets === 0) !== (b.directSets === 0)) return a.directSets === 0 ? -1 : 1;
      if ((b.lastTrainedDays ?? -1) !== (a.lastTrainedDays ?? -1)) {
        return (b.lastTrainedDays ?? -1) - (a.lastTrainedDays ?? -1);
      }
      if (a.directSets !== b.directSets) return a.directSets - b.directSets;
      return a.total - b.total;
    });

  return {
    muscles: entries.map(entry => ({
      ...entry,
      intensity: maxDirectScore ? Math.max(0.12, entry.directSets / maxDirectScore) : 0,
      directIntensity: maxDirectScore ? Math.max(0.12, entry.directSets / maxDirectScore) : 0,
      assistedIntensity: maxScore ? Math.max(0.12, entry.total / maxScore) : 0,
    })),
    topMuscles: trainedEntries.slice(0, 3),
    neglectedMuscles: neglectedPool.slice(0, 3),
    trainedMuscleCount: trainedEntries.length,
    totalMuscles: entries.length,
    totalSetUnits: Math.round(trainedEntries.reduce((sum, entry) => sum + entry.directSets, 0) * 10) / 10,
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
