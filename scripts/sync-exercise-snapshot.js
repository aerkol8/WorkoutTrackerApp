const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'exerciseCatalogSnapshot.json');
const ALIAS_OUTPUT_PATH = path.join(PROJECT_ROOT, 'data', 'exerciseAliases.generated.json');
const SEED_PATH = path.join(PROJECT_ROOT, 'data', 'exercises.json');
const DEFAULT_EXTERNAL_DATASET_PATH = '/tmp/exercises-dataset-analysis/data/exercises.json';
const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'with', 'to']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeExerciseName(value = '') {
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

function tokenize(value = '') {
  return normalizeExerciseName(value)
    .split(' ')
    .filter(token => token && !STOP_WORDS.has(token));
}

function buildSignature(value = '') {
  return tokenize(value).sort().join(' ');
}

function toDisplayName(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, prefix, char) => `${prefix}${char.toUpperCase()}`)
    .replace(/\bSmr\b/g, 'SMR')
    .replace(/\bEz\b/g, 'EZ')
    .replace(/\bIi\b/g, 'II')
    .replace(/\bIii\b/g, 'III');
}

function toBodyPartFamily(value = '') {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return '';
  if (normalized.includes('arm')) return 'arms';
  if (normalized.includes('back')) return 'back';
  if (normalized.includes('chest')) return 'chest';
  if (normalized.includes('shoulder') || normalized.includes('delt')) return 'shoulders';
  if (
    normalized.includes('leg')
    || normalized.includes('quad')
    || normalized.includes('hamstring')
    || normalized.includes('glute')
    || normalized.includes('calf')
    || normalized.includes('adductor')
    || normalized.includes('abductor')
  ) {
    return 'legs';
  }
  if (normalized.includes('waist') || normalized.includes('core') || normalized.includes('abs') || normalized.includes('oblique')) return 'abs';
  if (normalized.includes('cardio')) return 'cardio';
  if (normalized.includes('neck')) return 'neck';
  return normalized;
}

function toTargetFamily(value = '') {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return '';
  if (normalized.includes('pectoral') || normalized.includes('chest')) return 'chest';
  if (normalized.includes('biceps')) return 'biceps';
  if (normalized.includes('triceps')) return 'triceps';
  if (normalized.includes('brachialis')) return 'brachialis';
  if (normalized.includes('brachioradialis') || normalized.includes('forearm')) return 'forearms';
  if (normalized.includes('lat')) return 'lats';
  if (normalized.includes('upper back') || normalized.includes('mid back') || normalized.includes('trap')) return 'upper back';
  if (normalized.includes('lower back')) return 'lower back';
  if (normalized.includes('glute')) return 'glutes';
  if (normalized.includes('hamstring')) return 'hamstrings';
  if (normalized.includes('quad')) return 'quads';
  if (normalized.includes('calf')) return 'calves';
  if (normalized.includes('delt') || normalized.includes('shoulder')) return 'shoulders';
  if (normalized.includes('abs') || normalized.includes('core') || normalized.includes('oblique')) return 'abs';
  if (normalized.includes('adductor')) return 'adductors';
  if (normalized.includes('abductor')) return 'abductors';
  if (normalized.includes('cardiovascular')) return 'cardio';
  return normalized;
}

function normalizeBodyPart(value = '') {
  const family = toBodyPartFamily(value);
  if (family === 'arms') return 'Arms';
  if (family === 'back') return 'Back';
  if (family === 'chest') return 'Chest';
  if (family === 'shoulders') return 'Shoulders';
  if (family === 'legs') return 'Legs';
  if (family === 'abs') return 'Abs';
  if (family === 'cardio') return 'Cardio';
  if (family === 'neck') return 'Neck';
  return toDisplayName(value || 'General');
}

function normalizeEquipment(value = '') {
  const normalized = normalizeExerciseName(value);
  if (!normalized) return 'Bodyweight';
  if (normalized === 'body weight') return 'Bodyweight';
  if (normalized === 'leverage machine') return 'Machine';
  if (normalized === 'smith machine') return 'Smith Machine';
  if (normalized === 'ez barbell') return 'EZ Barbell';
  if (normalized === 'medicine ball') return 'Medicine Ball';
  if (normalized === 'stability ball') return 'Stability Ball';
  if (normalized === 'foam roll') return 'Foam Roll';
  if (normalized === 'roller') return 'Roller';
  if (normalized === 'assisted') return 'Assisted';
  if (normalized === 'weighted') return 'Weighted';
  return toDisplayName(normalized);
}

function normalizeMuscleName(value = '') {
  const family = toTargetFamily(value);
  if (!family) return null;
  if (family === 'chest') return 'Chest';
  if (family === 'biceps') return 'Biceps';
  if (family === 'triceps') return 'Triceps';
  if (family === 'brachialis') return 'Brachialis';
  if (family === 'forearms') return 'Forearms';
  if (family === 'lats') return 'Lats';
  if (family === 'upper back') return 'Upper Back';
  if (family === 'lower back') return 'Lower Back';
  if (family === 'glutes') return 'Glutes';
  if (family === 'hamstrings') return 'Hamstrings';
  if (family === 'quads') return 'Quads';
  if (family === 'calves') return 'Calves';
  if (family === 'shoulders') return 'Shoulders';
  if (family === 'abs') return 'Abs';
  if (family === 'adductors') return 'Adductors';
  if (family === 'abductors') return 'Abductors';
  if (family === 'cardio') return 'Cardio';
  return toDisplayName(value);
}

function normalizeExternalExercise(item = {}) {
  const name = toDisplayName(item.name || '');
  const bodyPart = normalizeBodyPart(item.body_part || item.category);
  const target = normalizeMuscleName(item.target) || normalizeMuscleName(item.muscle_group) || bodyPart;
  const primaryMuscles = uniqueValues([
    normalizeMuscleName(item.target),
    normalizeMuscleName(item.muscle_group),
  ]);
  const secondaryMuscles = uniqueValues([
    ...(item.secondary_muscles || []).map(normalizeMuscleName),
    normalizeMuscleName(item.muscle_group),
  ]).filter(muscle => !primaryMuscles.includes(muscle));

  return {
    id: `snapshot-${normalizeExerciseName(name) || String(item.id || '')}`,
    externalId: String(item.id || ''),
    name,
    normalizedName: normalizeExerciseName(name),
    signature: buildSignature(name),
    bodyPart,
    bodyPartFamily: toBodyPartFamily(bodyPart),
    target,
    targetFamily: toTargetFamily(target),
    primaryMuscles,
    secondaryMuscles,
    equipment: uniqueValues([normalizeEquipment(item.equipment)]),
    images: item.image ? [item.image] : [],
    videos: item.gif_url ? [item.gif_url] : [],
    source: 'snapshot',
  };
}

function normalizeCatalogComparable(item = {}) {
  const equipment = Array.isArray(item.equipment) ? item.equipment[0] : item.equipment;
  return {
    id: String(item.id || ''),
    name: item.name || '',
    normalizedName: normalizeExerciseName(item.name),
    signature: buildSignature(item.name),
    bodyPart: item.bodyPart || '',
    bodyPartFamily: toBodyPartFamily(item.bodyPart || item.body_part),
    target: item.target || item.muscle_group || '',
    targetFamily: toTargetFamily(item.target || item.muscle_group),
    equipment: normalizeExerciseName(equipment),
  };
}

function scoreCandidate(localItem, externalItem) {
  const localTokens = tokenize(localItem.name);
  const externalTokens = tokenize(externalItem.name);
  if (!localTokens.length || !externalTokens.length) return 0;

  const localSet = new Set(localTokens);
  const externalSet = new Set(externalTokens);
  const shared = localTokens.filter(token => externalSet.has(token));
  if (!shared.length) return 0;

  const sharedRatio = shared.length / localSet.size;
  const candidateCoverage = shared.length / externalSet.size;
  let score = sharedRatio * 60;
  score += candidateCoverage * 15;

  if (externalItem.normalizedName.includes(localItem.normalizedName)) score += 10;
  if (localItem.normalizedName.includes(externalItem.normalizedName)) score += 8;
  if (localItem.bodyPartFamily && localItem.bodyPartFamily === externalItem.bodyPartFamily) score += 10;
  if (localItem.targetFamily && localItem.targetFamily === externalItem.targetFamily) score += 10;
  if (localItem.equipment && localItem.equipment === externalItem.equipment[0]?.toLowerCase()) score += 8;
  if (localTokens[0] && localTokens[0] === externalTokens[0]) score += 4;
  if (localTokens[localTokens.length - 1] && localTokens[localTokens.length - 1] === externalTokens[externalTokens.length - 1]) score += 4;
  if (externalItem.images.length) score += 1;
  if (externalItem.videos.length) score += 1;

  return Math.round(score * 100) / 100;
}

function mergeCatalogItems(existingItem, externalItem) {
  return {
    id: existingItem.id,
    sourceId: externalItem.externalId || existingItem.sourceId || existingItem.name,
    name: externalItem.name,
    bodyPart: externalItem.bodyPart || existingItem.bodyPart,
    target: externalItem.target || existingItem.target,
    primaryMuscles: uniqueValues([...(externalItem.primaryMuscles || []), ...(existingItem.primaryMuscles || [])]),
    secondaryMuscles: uniqueValues([...(externalItem.secondaryMuscles || []), ...(existingItem.secondaryMuscles || [])]),
    equipment: uniqueValues([...(externalItem.equipment || []), ...(existingItem.equipment || [])]),
    images: uniqueValues([...(existingItem.images || []), ...(externalItem.images || [])]),
    videos: uniqueValues([...(existingItem.videos || []), ...(externalItem.videos || [])]),
    source: 'snapshot',
  };
}

function buildExternalLookups(externalItems) {
  const byExact = new Map();
  const bySignature = new Map();

  externalItems.forEach(item => {
    byExact.set(item.normalizedName, item);

    const list = bySignature.get(item.signature) || [];
    list.push(item);
    bySignature.set(item.signature, list);
  });

  return { byExact, bySignature };
}

function matchExistingSnapshot(existingSnapshot, externalItems) {
  const existingComparable = existingSnapshot.map(normalizeCatalogComparable);
  const { byExact, bySignature } = buildExternalLookups(externalItems);
  const usedExternalIds = new Set();
  const matchesBySnapshotId = new Map();
  const matchesByExternalId = new Map();

  const assignMatch = (snapshotItem, externalItem, reason, score = 0) => {
    if (!snapshotItem || !externalItem) return;
    const externalKey = externalItem.externalId || externalItem.id;
    if (usedExternalIds.has(externalKey) || matchesBySnapshotId.has(snapshotItem.id)) return;
    usedExternalIds.add(externalKey);
    matchesBySnapshotId.set(snapshotItem.id, { externalItem, reason, score });
    matchesByExternalId.set(externalKey, snapshotItem.id);
  };

  existingComparable.forEach(item => {
    const exact = byExact.get(item.normalizedName);
    if (exact) assignMatch(item, exact, 'exact', 999);
  });

  existingComparable.forEach(item => {
    if (matchesBySnapshotId.has(item.id)) return;
    const signatureMatches = bySignature.get(item.signature) || [];
    if (signatureMatches.length === 1) {
      assignMatch(item, signatureMatches[0], 'signature', 950);
    }
  });

  return { matchesBySnapshotId, matchesByExternalId };
}

function buildFinalSnapshot(existingSnapshot, externalItems) {
  const { matchesBySnapshotId, matchesByExternalId } = matchExistingSnapshot(existingSnapshot, externalItems);
  const finalItems = [];
  const generatedAliases = {};

  externalItems.forEach(externalItem => {
    const externalKey = externalItem.externalId || externalItem.id;
    const snapshotId = matchesByExternalId.get(externalKey);
    if (!snapshotId) {
      finalItems.push({
        id: externalItem.id,
        sourceId: externalItem.externalId || externalItem.name,
        name: externalItem.name,
        bodyPart: externalItem.bodyPart,
        target: externalItem.target,
        primaryMuscles: externalItem.primaryMuscles,
        secondaryMuscles: externalItem.secondaryMuscles,
        equipment: externalItem.equipment,
        images: externalItem.images,
        videos: externalItem.videos,
        source: 'snapshot',
      });
      return;
    }

    const existingItem = existingSnapshot.find(item => item.id === snapshotId);
    const merged = mergeCatalogItems(existingItem, externalItem);
    finalItems.push(merged);

    if (normalizeExerciseName(existingItem.name) !== normalizeExerciseName(merged.name)) {
      generatedAliases[existingItem.name] = merged.name;
    }
  });

  existingSnapshot.forEach(existingItem => {
    if (matchesBySnapshotId.has(existingItem.id)) return;
    finalItems.push({
      ...existingItem,
      images: uniqueValues(existingItem.images || []),
      videos: uniqueValues(existingItem.videos || []),
      source: 'snapshot',
    });
  });

  const finalByName = new Map();
  finalItems.forEach(item => {
    const key = normalizeExerciseName(item.name);
    if (!key) return;
    finalByName.set(key, item);
  });

  return {
    snapshot: Array.from(finalByName.values()).sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    generatedAliases,
  };
}

function buildSeedAliases(seedItems, finalSnapshot, startingAliases = {}) {
  const aliases = { ...startingAliases };
  const finalComparable = finalSnapshot.map(normalizeCatalogComparable);
  const byExact = new Map(finalComparable.map(item => [item.normalizedName, item]));
  const bySignature = new Map();

  finalComparable.forEach(item => {
    const list = bySignature.get(item.signature) || [];
    list.push(item);
    bySignature.set(item.signature, list);
  });

  seedItems.forEach(seedItem => {
    const comparable = normalizeCatalogComparable(seedItem);
    const exact = byExact.get(comparable.normalizedName);
    if (exact) return;

    const signatureMatches = bySignature.get(comparable.signature) || [];
    if (signatureMatches.length === 1) {
      aliases[seedItem.name] = signatureMatches[0].name;
    }
  });

  return Object.fromEntries(
    Object.entries(aliases)
      .filter(([alias, target]) => alias && target && normalizeExerciseName(alias) !== normalizeExerciseName(target))
      .sort((a, b) => a[0].localeCompare(b[0], 'en', { sensitivity: 'base' }))
  );
}

function main() {
  const externalDatasetPath = path.resolve(
    process.argv[2] || process.env.EXERCISE_DATASET_PATH || DEFAULT_EXTERNAL_DATASET_PATH
  );

  if (!fs.existsSync(externalDatasetPath)) {
    throw new Error(`External dataset not found at ${externalDatasetPath}`);
  }

  const seed = readJson(SEED_PATH);
  const existingSnapshot = readJson(OUTPUT_PATH);
  const externalRaw = readJson(externalDatasetPath);
  const externalItems = externalRaw.map(normalizeExternalExercise);
  const { snapshot, generatedAliases } = buildFinalSnapshot(existingSnapshot, externalItems);
  const seedAliases = buildSeedAliases(seed, snapshot, generatedAliases);

  writeJson(OUTPUT_PATH, snapshot);
  writeJson(ALIAS_OUTPUT_PATH, seedAliases);

  console.log(`Wrote ${snapshot.length} exercises to ${OUTPUT_PATH}`);
  console.log(`Wrote ${Object.keys(seedAliases).length} generated aliases to ${ALIAS_OUTPUT_PATH}`);
}

main();
