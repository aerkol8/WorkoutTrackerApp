const fs = require('node:fs');
const path = require('node:path');

const OUTPUT_PATH = path.resolve(__dirname, '../data/exerciseCatalogSnapshot.json');

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeExerciseName(value = '') {
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

function coerceName(value) {
  if (!value) return null;
  if (typeof value === 'object') {
    return coerceName(value.name || value.name_en || value.name_original || value.common_name || value.exercise_base);
  }
  return String(value)
    .split(/[_-]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function resolveReferenceNames(values = [], lookup = new Map()) {
  return uniqueValues((values || []).map(value => {
    if (typeof value === 'number') return lookup.get(value) || null;
    if (typeof value === 'object') return coerceName(value.name || value.common_name || value);
    return coerceName(value);
  }));
}

function normalizeWgerExercise(item = {}, referenceMaps = {}) {
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

async function fetchWgerCatalog() {
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

  for (const url of candidateUrls) {
    try {
      const rows = await fetchPaginated(url);
      const normalized = rows
        .map(item => normalizeWgerExercise(item, referenceMaps))
        .filter(item => item.name);
      if (normalized.length) {
        return normalized.sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
      }
    } catch (error) {
      continue;
    }
  }

  return [];
}

function inferBodyPartFromMuscles(primaryMuscles = [], fallback = '') {
  return inferBodyPart(primaryMuscles, fallback || 'Strength');
}

async function fetchOpenSnapshotCatalog() {
  const response = await fetch('https://raw.githubusercontent.com/exercemus/exercises/minified/minified-exercises.json');
  if (!response.ok) {
    throw new Error(`snapshot request failed: ${response.status}`);
  }

  const data = await response.json();
  const exercises = Array.isArray(data?.exercises) ? data.exercises : [];

  return exercises
    .map((item, index) => {
      const primaryMuscles = uniqueValues((item.primary_muscles || []).map(coerceName));
      const secondaryMuscles = uniqueValues((item.secondary_muscles || []).map(coerceName));
      const bodyPart = inferBodyPartFromMuscles(primaryMuscles, item.category);

      return {
        id: `snapshot-${normalizeExerciseName(item.name) || index}`,
        sourceId: item.name || String(index),
        name: item.name,
        bodyPart,
        target: inferTarget(primaryMuscles, item.category || bodyPart),
        primaryMuscles,
        secondaryMuscles,
        equipment: uniqueValues((item.equipment || []).map(coerceName)),
        images: (item.images || []).filter(Boolean),
        videos: item.video ? [item.video] : [],
        source: 'snapshot',
      };
    })
    .filter(item => item.name)
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}

async function main() {
  let snapshot = await fetchWgerCatalog();
  if (!snapshot.length) {
    snapshot = await fetchOpenSnapshotCatalog();
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(snapshot, null, 2));
  console.log(`Wrote ${snapshot.length} exercises to ${OUTPUT_PATH}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
