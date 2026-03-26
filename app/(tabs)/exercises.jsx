import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Image,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../../context/WorkoutContext';
import {
  buildExerciseAliasIndex,
  matchesExerciseSearch,
  suggestCatalogMatches,
} from '../../utils/exerciseCatalog';
import { resolveExerciseMediaCandidates, resolveExerciseMediaLink } from '../../utils/exerciseMedia';
import { toLocalDateKey } from '../../utils/date';

function formatSetUnits(value = 0) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getTileBackground(intensity = 0) {
  if (intensity >= 0.8) return '#33214A';
  if (intensity >= 0.55) return '#272132';
  if (intensity >= 0.3) return '#1F2128';
  return '#17191D';
}

function getLastTrainedLabel(item) {
  if (item?.lastTrainedDays === null || item?.lastTrainedDays === undefined) {
    return 'Not hit yet';
  }
  if (item.lastTrainedDays === 0) return 'Today';
  if (item.lastTrainedDays === 1) return '1 day ago';
  return `${item.lastTrainedDays} days ago`;
}

function getExerciseAccent(exercise = {}) {
  const bodyPart = String(exercise.bodyPart || '').toLowerCase();
  if (bodyPart.includes('chest')) return { start: '#51316F', end: '#241934', icon: 'body-outline' };
  if (bodyPart.includes('back')) return { start: '#214A5A', end: '#15252D', icon: 'git-branch-outline' };
  if (bodyPart.includes('leg')) return { start: '#4C3A21', end: '#241C11', icon: 'walk-outline' };
  if (bodyPart.includes('shoulder')) return { start: '#4E274C', end: '#231423', icon: 'triangle-outline' };
  if (bodyPart.includes('arm')) return { start: '#3B355E', end: '#1A1730', icon: 'barbell-outline' };
  if (bodyPart.includes('abs')) return { start: '#3E4A23', end: '#1C2411', icon: 'apps-outline' };
  return { start: '#2E3548', end: '#171B25', icon: 'fitness-outline' };
}

function isGifMedia(url = '') {
  return /\.gif($|[?#])/i.test(String(url || '').trim());
}

function getExerciseMediaCounts(exercise = {}) {
  return {
    imageCount: Math.max((exercise.images || []).length, (exercise.imageRefs || []).length),
    videoCount: Math.max((exercise.videos || []).length, (exercise.videoRefs || []).length),
  };
}

function buildMediaItems(urls = [], refs = []) {
  const size = Math.max(urls.length, refs.length);
  return Array.from({ length: size }, (_, index) => ({
    key: refs[index] || urls[index] || `media-${index}`,
    uri: urls[index] || '',
    mediaRef: refs[index] || urls[index] || '',
  })).filter(item => item.uri || item.mediaRef);
}

function ResolvedMediaImage({ uri, mediaRef, style, resizeMode = 'cover', fallback = null }) {
  const candidates = useMemo(
    () => resolveExerciseMediaCandidates(mediaRef, uri),
    [mediaRef, uri]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCandidateIndex(0);
    setFailed(false);
  }, [candidates.join('|')]);

  const activeUri = candidates[candidateIndex];
  if (!activeUri || failed) return fallback;

  return (
    <Image
      key={activeUri}
      source={{ uri: activeUri }}
      style={style}
      resizeMode={resizeMode}
      onError={() => {
        if (candidateIndex < candidates.length - 1) {
          setCandidateIndex(prev => prev + 1);
          return;
        }
        setFailed(true);
      }}
    />
  );
}

function MediaUnavailableFallback({
  title = 'Media unavailable',
  subtitle = 'Current network mode cannot reach local exercise media.',
  style,
  compact = false,
}) {
  return (
    <View style={[styles.mediaUnavailableFallback, compact && styles.mediaUnavailableFallbackCompact, style]}>
      <View style={styles.mediaUnavailableIconWrap}>
        <Ionicons name="image-outline" size={compact ? 18 : 28} color="#C8D1E3" />
      </View>
      <Text style={[styles.mediaUnavailableTitle, compact && styles.mediaUnavailableTitleCompact]}>
        {title}
      </Text>
      {!compact ? (
        <Text style={styles.mediaUnavailableSubtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

const FRONT_BODY_LEFT = [
  { id: 'front-shoulders', label: 'Shoulders', muscles: ['Shoulders', 'Front Delts'] },
  { id: 'front-arms', label: 'Arms', muscles: ['Biceps', 'Triceps'] },
  { id: 'front-quads', label: 'Quads', muscles: ['Quads'] },
];
const FRONT_BODY_RIGHT = [
  { id: 'front-chest', label: 'Chest', muscles: ['Chest'] },
  { id: 'front-core', label: 'Core', muscles: ['Abs', 'Obliques'] },
  { id: 'front-calves', label: 'Calves', muscles: ['Calves'] },
];
const BACK_BODY_LEFT = [
  { id: 'back-upper', label: 'Upper Back', muscles: ['Upper Back'] },
  { id: 'back-lats', label: 'Lats', muscles: ['Lats'] },
  { id: 'back-hamstrings', label: 'Hamstrings', muscles: ['Hamstrings'] },
];
const BACK_BODY_RIGHT = [
  { id: 'back-rear-delts', label: 'Rear Delts', muscles: ['Rear Delts'] },
  { id: 'back-lower', label: 'Lower Back', muscles: ['Lower Back'] },
  { id: 'back-glutes', label: 'Glutes', muscles: ['Glutes'] },
];

const WEEKLY_TARGET_PROFILES = [
  { id: 'chest', label: 'Chest', muscles: ['Chest'], min: 8, max: 16 },
  { id: 'back', label: 'Back', muscles: ['Lats', 'Upper Back', 'Lower Back'], min: 10, max: 18 },
  { id: 'shoulders', label: 'Shoulders', muscles: ['Shoulders', 'Front Delts', 'Rear Delts'], min: 8, max: 16 },
  { id: 'arms', label: 'Arms', muscles: ['Biceps', 'Triceps', 'Forearms', 'Brachialis', 'Brachioradialis'], min: 6, max: 14 },
  { id: 'quads', label: 'Quads', muscles: ['Quads'], min: 8, max: 16 },
  { id: 'posterior', label: 'Posterior', muscles: ['Hamstrings', 'Glutes'], min: 8, max: 16 },
  { id: 'core', label: 'Core', muscles: ['Abs', 'Obliques'], min: 4, max: 10 },
];

function getRegionMetrics(muscleLookup, muscles = []) {
  const totals = muscles.reduce((acc, muscleName) => {
    const entry = muscleLookup.get(String(muscleName || '').toLowerCase());
    if (!entry) return acc;
    const directSets = Number(entry.directSets) || 0;
    const assistedSets = Number(entry.assistedSets) || 0;
    return {
      total: acc.total + (Number(entry.total) || 0),
      directSets: acc.directSets + directSets,
      assistedSets: acc.assistedSets + assistedSets,
      intensity: 0,
    };
  }, { total: 0, directSets: 0, assistedSets: 0, intensity: 0 });

  return {
    ...totals,
    intensity: Math.min(1, totals.directSets / 10),
  };
}

function getHeatNodeStyles(intensity = 0) {
  if (intensity >= 0.75) return { backgroundColor: '#5A2A3A', borderColor: '#FF7A9A', textColor: '#FFE6EE' };
  if (intensity >= 0.5) return { backgroundColor: '#3F304E', borderColor: '#D1A0FF', textColor: '#F2E7FF' };
  if (intensity >= 0.25) return { backgroundColor: '#273245', borderColor: '#7FB2FF', textColor: '#E2EEFF' };
  if (intensity > 0) return { backgroundColor: '#1F2734', borderColor: '#4E607A', textColor: '#CDD7E8' };
  return { backgroundColor: '#171B25', borderColor: '#2A3242', textColor: '#94A0B5' };
}

function getRegionAbbreviation(label = '') {
  const parts = String(label).split(' ').filter(Boolean);
  if (!parts.length) return '-';
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts.map(part => part.charAt(0).toUpperCase()).join('').slice(0, 3);
}

function buildSessionRhythm(history = [], days = 14) {
  const byDate = new Map();

  (history || []).forEach(entry => {
    const rawDate = entry?.dateISO || entry?.date || entry?.dateString;
    const parsed = new Date(rawDate);
    if (!Number.isFinite(parsed.getTime())) return;

    const key = toLocalDateKey(parsed);
    const completedSets = (entry.exercises || []).reduce((sum, exercise) => (
      sum + (exercise.sets || []).filter(set => set.isDone !== false).length
    ), 0);

    const prev = byDate.get(key) || { sessions: 0, setUnits: 0 };
    byDate.set(key, {
      sessions: prev.sessions + 1,
      setUnits: prev.setUnits + completedSets,
    });
  });

  const rows = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    const key = toLocalDateKey(date);
    const dayData = byDate.get(key) || { sessions: 0, setUnits: 0 };
    rows.push({
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2).toUpperCase(),
      day: date.getDate(),
      sessions: dayData.sessions,
      setUnits: dayData.setUnits,
    });
  }
  return rows;
}

function getRhythmCellTone(item, maxSetUnits = 0) {
  if (!item?.sessions) {
    return { bg: '#171C26', border: '#2A3345', text: '#8594AD' };
  }

  const ratio = maxSetUnits > 0 ? (item.setUnits || 0) / maxSetUnits : 0;
  if (ratio >= 0.75 || item.sessions >= 2) {
    return { bg: '#254B3C', border: '#4B8D72', text: '#D7FFEF' };
  }
  if (ratio >= 0.45) {
    return { bg: '#253E5A', border: '#4A769E', text: '#D9EBFF' };
  }
  return { bg: '#3A2F52', border: '#6A57A0', text: '#EBE2FF' };
}

function getMediaAvailability(exercise = {}) {
  const { imageCount, videoCount } = getExerciseMediaCounts(exercise);
  const source = String(exercise.source || '').toLowerCase();

  if (imageCount > 0 && videoCount > 0) return 'Image + video available';
  if (videoCount > 0) return 'Video available (generated poster for image)';
  if (imageCount > 0) return 'Image available';
  if (source === 'seed') return 'Generated visual only (legacy seed)';
  if (source === 'snapshot') return 'Generated visual only (no hosted media configured)';
  return 'Generated visual only';
}

function buildWeeklyTargetRows(muscleLookup) {
  return WEEKLY_TARGET_PROFILES.map(profile => {
    const directSets = profile.muscles.reduce((sum, muscle) => {
      const entry = muscleLookup.get(String(muscle).toLowerCase());
      return sum + (Number(entry?.directSets) || 0);
    }, 0);

    let status = 'on';
    if (directSets < profile.min) status = 'under';
    if (directSets > profile.max) status = 'high';

    return {
      ...profile,
      directSets,
      status,
      gapToMin: Math.max(0, profile.min - directSets),
      overBy: Math.max(0, directSets - profile.max),
    };
  });
}

function getTargetTone(status = 'on') {
  if (status === 'under') return { bg: '#2E2533', border: '#6A4B7A', text: '#E5D3FF', value: '#D5A4FF', label: 'Under' };
  if (status === 'high') return { bg: '#352525', border: '#7C4747', text: '#FFD7D7', value: '#FF9F9F', label: 'High' };
  return { bg: '#203229', border: '#3F7960', text: '#D8FFE9', value: '#7EF5B0', label: 'On Target' };
}

function DashboardStatCard({ label, value, meta, accent }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statMeta}>{meta}</Text>
    </View>
  );
}

function MuscleLoadTile({ item }) {
  return (
    <View style={[styles.muscleTile, { backgroundColor: getTileBackground(item.intensity) }]}>
      <View style={styles.muscleTileHeader}>
        <Text style={styles.muscleTileName} numberOfLines={1}>{item.muscle}</Text>
        <Text style={styles.muscleTileSessions}>{item.sessionCount}x</Text>
      </View>
      <Text style={styles.muscleTileValue}>{formatSetUnits(item.directSets || 0)}</Text>
      <Text style={styles.muscleTileUnit}>direct sets</Text>
      <Text style={styles.muscleTileMeta}>
        assist {item.assistedSets} • {getLastTrainedLabel(item)}
      </Text>
      <View style={styles.muscleTileTrack}>
        <View style={[styles.muscleTileFill, { width: `${Math.max(10, item.intensity * 100)}%` }]} />
      </View>
    </View>
  );
}

function InsightCard({ title, subtitle, items, emptyText, accent, renderValue }) {
  return (
    <View style={styles.insightCard}>
      <Text style={styles.insightTitle}>{title}</Text>
      <Text style={styles.insightSubtitle}>{subtitle}</Text>
      {items.length ? items.map(item => (
        <View key={item.id || item.muscle} style={styles.insightRow}>
          <View style={styles.insightRowMain}>
            <Text style={styles.insightItemLabel}>{item.muscle || item.name}</Text>
            {'lastTrainedDays' in item ? (
              <Text style={styles.insightItemSub}>{getLastTrainedLabel(item)}</Text>
            ) : null}
          </View>
          <Text style={[styles.insightItemValue, { color: accent }]}>
            {renderValue(item)}
          </Text>
        </View>
      )) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

function BodyMapFigure({ title, sideLabel, leftRegions, rightRegions, muscleLookup }) {
  const anatomyZones = [
    { key: `${title}-left-upper`, region: leftRegions[0], style: styles.bodyMapAnatomyZoneLeftUpper },
    { key: `${title}-right-upper`, region: rightRegions[0], style: styles.bodyMapAnatomyZoneRightUpper },
    { key: `${title}-left-mid`, region: leftRegions[1], style: styles.bodyMapAnatomyZoneLeftMid },
    { key: `${title}-right-mid`, region: rightRegions[1], style: styles.bodyMapAnatomyZoneRightMid },
    { key: `${title}-left-lower`, region: leftRegions[2], style: styles.bodyMapAnatomyZoneLeftLower },
    { key: `${title}-right-lower`, region: rightRegions[2], style: styles.bodyMapAnatomyZoneRightLower },
  ];

  const renderRegionChip = (region) => {
    const metrics = getRegionMetrics(muscleLookup, region.muscles);
    const heatStyle = getHeatNodeStyles(metrics.intensity);
    const directSets = Math.round(metrics.directSets * 10) / 10;
    const assistSets = Math.round(metrics.assistedSets * 10) / 10;
    return (
      <View
        key={region.id}
        style={[
          styles.bodyMapChip,
          { backgroundColor: heatStyle.backgroundColor, borderColor: heatStyle.borderColor },
        ]}
      >
        <Text style={[styles.bodyMapChipLabel, { color: heatStyle.textColor }]}>{region.label}</Text>
        <Text style={[styles.bodyMapChipValue, { color: heatStyle.textColor }]}>
          {directSets > 0
            ? `${formatSetUnits(directSets)} direct`
            : '-'}
        </Text>
        {assistSets > 0 ? (
          <Text style={[styles.bodyMapChipAssist, { color: heatStyle.textColor }]}>
            assist {formatSetUnits(assistSets)}
          </Text>
        ) : null}
      </View>
    );
  };

  const renderAnatomyZone = (region, zoneKey, zoneStyle) => {
    const metrics = getRegionMetrics(muscleLookup, region.muscles);
    const directSets = Math.round(metrics.directSets * 10) / 10;
    const tone = getHeatNodeStyles(metrics.intensity);

    return (
      <View
        key={zoneKey}
        style={[
          styles.bodyMapAnatomyZone,
          zoneStyle,
          {
            backgroundColor: tone.backgroundColor,
            borderColor: tone.borderColor,
          },
        ]}
      >
        <Text style={[styles.bodyMapAnatomyZoneLabel, { color: tone.textColor }]}>
          {getRegionAbbreviation(region.label)}
        </Text>
        <Text style={[styles.bodyMapAnatomyZoneValue, { color: tone.textColor }]}>
          {directSets > 0 ? formatSetUnits(directSets) : '-'}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.bodyMapFigureCard}>
      <View style={styles.bodyMapFigureHeader}>
        <Text style={styles.bodyMapFigureTitle}>{title}</Text>
        <Text style={styles.bodyMapFigureSub}>{sideLabel}</Text>
      </View>
      <View style={styles.bodyMapFigureContent}>
        <View style={styles.bodyMapAnatomy}>
          <View style={styles.bodyMapAnatomyHead} />
          <View style={styles.bodyMapAnatomyBody}>
            <View style={styles.bodyMapAnatomyTorso} />
            {anatomyZones.map(zone => renderAnatomyZone(zone.region, zone.key, zone.style))}
          </View>
          <Text style={styles.bodyMapAnatomyHint}>Direct sets by region</Text>
        </View>
        <View style={styles.bodyMapChipGrid}>
          <View style={styles.bodyMapColumn}>
            {leftRegions.map(renderRegionChip)}
          </View>
          <View style={styles.bodyMapColumn}>
            {rightRegions.map(renderRegionChip)}
          </View>
        </View>
      </View>
    </View>
  );
}

function WeeklyTargetCard({ row }) {
  const tone = getTargetTone(row.status);
  const helperText = row.status === 'under'
    ? `${row.gapToMin} set needed to reach minimum`
    : row.status === 'high'
      ? `${row.overBy} set above target range`
      : `Target range ${row.min}-${row.max} set`;

  return (
    <View style={[styles.targetCard, { backgroundColor: tone.bg, borderColor: tone.border }]}>
      <View style={styles.targetCardHeader}>
        <Text style={[styles.targetCardTitle, { color: tone.text }]}>{row.label}</Text>
        <Text style={[styles.targetCardBadge, { color: tone.value }]}>{tone.label}</Text>
      </View>
      <View style={styles.targetCardMetrics}>
        <Text style={[styles.targetCardValue, { color: tone.value }]}>{row.directSets}</Text>
        <Text style={[styles.targetCardRange, { color: tone.text }]}>target {row.min}-{row.max}</Text>
      </View>
      <Text style={[styles.targetCardMeta, { color: tone.text }]}>{helperText}</Text>
    </View>
  );
}

export default function ExercisesScreen() {
  const [tab, setTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedMediaFilter, setSelectedMediaFilter] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [selectedMediaPreview, setSelectedMediaPreview] = useState(null);
  const {
    library,
    history,
    exerciseAliases,
    catalogMeta,
    dashboard7,
    dashboard30,
    recentPRs,
    refreshExerciseCatalog,
    addExerciseAlias,
  } = useWorkout();

  const bodyParts = useMemo(() => (
    ['all', ...Array.from(new Set((library || []).map(item => item.bodyPart).filter(Boolean))).sort()]
  ), [library]);
  const aliasIndex = useMemo(
    () => buildExerciseAliasIndex(library, exerciseAliases),
    [library, exerciseAliases]
  );

  const filteredExercises = useMemo(() => (
    (library || [])
      .filter(exercise => {
        const matchesQuery = matchesExerciseSearch(exercise, searchQuery, aliasIndex);
        const matchesBodyPart = selectedBodyPart === 'all' || exercise.bodyPart === selectedBodyPart;
        const { imageCount, videoCount } = getExerciseMediaCounts(exercise);
        const matchesMedia = selectedMediaFilter === 'all'
          || (selectedMediaFilter === 'video' && videoCount > 0)
          || (selectedMediaFilter === 'image' && imageCount > 0);
        return matchesQuery && matchesBodyPart && matchesMedia;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  ), [aliasIndex, library, searchQuery, selectedBodyPart, selectedMediaFilter]);

  const weeklyMuscles = useMemo(
    () => dashboard7.muscles
      .filter(item => (item.directSets || 0) > 0)
      .sort((a, b) => (b.directSets || 0) - (a.directSets || 0))
      .slice(0, 6),
    [dashboard7]
  );
  const monthlyLeaders = useMemo(
    () => dashboard30.muscles
      .filter(item => (item.directSets || 0) > 0)
      .sort((a, b) => (b.directSets || 0) - (a.directSets || 0))
      .slice(0, 8),
    [dashboard30]
  );

  const syncedText = catalogMeta.syncedAt
    ? new Date(catalogMeta.syncedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'Bundled snapshot';

  const weeklyCoverage = dashboard7.totalMuscles
    ? Math.round((dashboard7.trainedMuscleCount / dashboard7.totalMuscles) * 100)
    : 0;
  const monthlyCoverage = dashboard30.totalMuscles
    ? Math.round((dashboard30.trainedMuscleCount / dashboard30.totalMuscles) * 100)
    : 0;
  const weeklyMuscleLookup = useMemo(() => {
    const lookup = new Map();
    (dashboard7.muscles || []).forEach(item => {
      lookup.set(String(item.muscle || '').toLowerCase(), item);
    });
    return lookup;
  }, [dashboard7.muscles]);
  const weeklyTargetRows = useMemo(
    () => buildWeeklyTargetRows(weeklyMuscleLookup),
    [weeklyMuscleLookup]
  );
  const weeklyDirectSetsTotal = useMemo(
    () => Math.round(weeklyTargetRows.reduce((sum, row) => sum + row.directSets, 0)),
    [weeklyTargetRows]
  );
  const onTargetCount = useMemo(
    () => weeklyTargetRows.filter(row => row.status === 'on').length,
    [weeklyTargetRows]
  );
  const unmappedSummary = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const counts = new Map();

    (history || []).forEach(entry => {
      const timestamp = new Date(entry.dateISO || entry.dateString || entry.date).getTime();
      if (!Number.isFinite(timestamp) || timestamp < threshold) return;

      (entry.exercises || []).forEach(exercise => {
        if (exercise.mappingStatus !== 'unmapped') return;
        const name = exercise.name || 'Unknown movement';
        counts.set(name, (counts.get(name) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 4);
  }, [history]);
  const unmappedWithSuggestions = useMemo(
    () => unmappedSummary.map(item => ({
      ...item,
      suggestions: suggestCatalogMatches(item.name, library, 2, exerciseAliases),
    })),
    [exerciseAliases, unmappedSummary, library]
  );
  const sessionRhythm14 = useMemo(() => buildSessionRhythm(history, 14), [history]);
  const rhythmMaxSetUnits = useMemo(
    () => Math.max(0, ...sessionRhythm14.map(item => item.setUnits || 0)),
    [sessionRhythm14]
  );
  const rhythmActiveDays = useMemo(
    () => sessionRhythm14.filter(item => item.sessions > 0).length,
    [sessionRhythm14]
  );
  const rhythmSessionCount = useMemo(
    () => sessionRhythm14.reduce((sum, item) => sum + (item.sessions || 0), 0),
    [sessionRhythm14]
  );
  const rhythmSetUnits = useMemo(
    () => sessionRhythm14.reduce((sum, item) => sum + (item.setUnits || 0), 0),
    [sessionRhythm14]
  );

  const handleMapUnmapped = (legacyName, mappedName) => {
    const result = addExerciseAlias(legacyName, mappedName);
    if (!result?.success) {
      Alert.alert('Mapping failed', result?.error || 'This mapping could not be saved.');
      return;
    }
    Alert.alert('Mapped', `"${legacyName}" now maps to "${result.canonical}".`);
  };

  const openMediaLink = async (mediaItem) => {
    const url = resolveExerciseMediaLink(mediaItem?.mediaRef || mediaItem, mediaItem?.uri || '');
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Media Error', 'This media link could not be opened.');
    }
  };

  const selectedExerciseAccent = getExerciseAccent(selectedExercise || {});
  const selectedExerciseMediaStatus = getMediaAvailability(selectedExercise || {});
  const selectedImageItems = buildMediaItems(selectedExercise?.images || [], selectedExercise?.imageRefs || []);
  const selectedVideoItems = buildMediaItems(selectedExercise?.videos || [], selectedExercise?.videoRefs || []);
  const inlineGifPreviews = selectedVideoItems.filter(video => isGifMedia(video.mediaRef || video.uri));
  const externalVideoLinks = selectedVideoItems.filter(video => !isGifMedia(video.mediaRef || video.uri));

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: 'pulse-outline' },
          { id: 'library', label: 'Library', icon: 'library-outline' },
        ].map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.tabButton, tab === item.id && styles.tabButtonActive]}
            onPress={() => setTab(item.id)}
          >
            <Ionicons name={item.icon} size={18} color={tab === item.id ? '#fff' : '#777'} />
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'dashboard' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={() => refreshExerciseCatalog(true)} tintColor="#BB86FC" />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroEyebrow}>Muscle Load</Text>
                <Text style={styles.heroTitle}>Direct-set weekly balance</Text>
                <Text style={styles.heroMeta}>
                  Main metric is direct sets. Assist sets are tracked as secondary context.
                </Text>
              </View>
              <TouchableOpacity style={styles.syncBtn} onPress={() => refreshExerciseCatalog(true)}>
                <Ionicons name="sync-outline" size={18} color="#BB86FC" />
                <Text style={styles.syncBtnText}>Reload</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroPills}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{library.length} exercises</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>loaded {syncedText}</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>
                  {catalogMeta.source === 'snapshot'
                    ? 'embedded catalog'
                    : catalogMeta.source === 'cache'
                      ? 'cached catalog'
                        : 'catalog ready'}
                </Text>
              </View>
            </View>

            {catalogMeta.lastError ? (
              <Text style={styles.warningText}>Catalog load issue: {catalogMeta.lastError}</Text>
            ) : null}
            {dashboard30.unmappedCount > 0 ? (
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle-outline" size={16} color="#FFB74D" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.warningBadgeText}>
                    {dashboard30.unmappedCount} legacy movement still needs mapping
                  </Text>
                  {unmappedWithSuggestions.length ? (
                    <View style={styles.unmappedList}>
                      {unmappedWithSuggestions.map(item => (
                        <View key={item.name} style={styles.unmappedItem}>
                          <View style={styles.unmappedItemHeader}>
                            <Text style={styles.unmappedChip}>{item.name}</Text>
                            <Text style={styles.unmappedCount}>{item.count}x in 30d</Text>
                          </View>
                          {item.suggestions.length ? (
                            <View style={styles.unmappedSuggestionRow}>
                              {item.suggestions.map(suggestion => (
                                <TouchableOpacity
                                  key={`${item.name}-${suggestion.id}`}
                                  style={styles.unmappedSuggestionBtn}
                                  onPress={() => handleMapUnmapped(item.name, suggestion.name)}
                                >
                                  <Text style={styles.unmappedSuggestionBtnText} numberOfLines={1}>
                                    Map to {suggestion.name}
                                  </Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          ) : (
                            <Text style={styles.unmappedNoSuggestionText}>
                              No quick match suggestion
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <DashboardStatCard
              label="7D direct sets"
              value={weeklyDirectSetsTotal}
              meta={`${onTargetCount}/${weeklyTargetRows.length} regions on target`}
              accent="#BB86FC"
            />
            <DashboardStatCard
              label="7D coverage"
              value={`${weeklyCoverage}%`}
              meta={`${dashboard7.trainedMuscleCount}/${dashboard7.totalMuscles || 0} mapped muscles`}
              accent="#4ECDC4"
            />
            <DashboardStatCard
              label="30D coverage"
              value={`${monthlyCoverage}%`}
              meta={`${dashboard30.trainedMuscleCount}/${dashboard30.totalMuscles || 0} mapped muscles`}
              accent="#FFB74D"
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Training Rhythm (14D)</Text>
              <Text style={styles.sectionSubtitle}>How consistently you trained over the last two weeks</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.rhythmRail}
              contentContainerStyle={styles.rhythmRailContent}
            >
              {sessionRhythm14.map(item => {
                const tone = getRhythmCellTone(item, rhythmMaxSetUnits);
                return (
                  <View key={item.key} style={styles.rhythmCell}>
                    <View
                      style={[
                        styles.rhythmDot,
                        { backgroundColor: tone.bg, borderColor: tone.border },
                      ]}
                    >
                      <Text style={[styles.rhythmDotValue, { color: tone.text }]}>
                        {item.sessions || '-'}
                      </Text>
                    </View>
                    <Text style={styles.rhythmDayText}>{item.label}</Text>
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.rhythmSummaryRow}>
              <Text style={styles.rhythmSummaryText}>{rhythmActiveDays}/14 active days</Text>
              <Text style={styles.rhythmSummaryText}>{rhythmSessionCount} sessions</Text>
              <Text style={styles.rhythmSummaryText}>{rhythmSetUnits} completed sets</Text>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Anatomy View (7D)</Text>
              <Text style={styles.sectionSubtitle}>Front and back focus map based on direct set count</Text>
            </View>
            <View style={styles.bodyMapRow}>
              <BodyMapFigure
                title="Front"
                sideLabel="Push + Core"
                leftRegions={FRONT_BODY_LEFT}
                rightRegions={FRONT_BODY_RIGHT}
                muscleLookup={weeklyMuscleLookup}
              />
              <BodyMapFigure
                title="Back"
                sideLabel="Pull + Posterior"
                leftRegions={BACK_BODY_LEFT}
                rightRegions={BACK_BODY_RIGHT}
                muscleLookup={weeklyMuscleLookup}
              />
            </View>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Weekly Target Zones</Text>
              <Text style={styles.sectionSubtitle}>Direct set count compared with practical weekly ranges</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.targetRail}
            >
              {weeklyTargetRows.map(row => (
                <WeeklyTargetCard key={row.id} row={row} />
              ))}
            </ScrollView>
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>7 Day Focus</Text>
              <Text style={styles.sectionSubtitle}>Most worked muscles by direct set count</Text>
            </View>
            {!weeklyMuscles.length ? (
              <Text style={styles.emptyText}>Finish a workout to populate your weekly muscle load.</Text>
            ) : (
              <View style={styles.tileGrid}>
                {weeklyMuscles.map(item => (
                  <MuscleLoadTile key={item.muscle} item={item} />
                ))}
              </View>
            )}
          </View>

          <View style={styles.dualInsightRow}>
            <InsightCard
              title="Needs Attention"
              subtitle="Lowest recent exposure"
              items={dashboard30.neglectedMuscles}
              emptyText="Train more mapped movements to unlock this."
              accent="#FFB74D"
              renderValue={item => `${formatSetUnits(item.directSets || 0)} direct`}
            />
            <InsightCard
              title="Recent PR"
              subtitle="Latest records"
              items={recentPRs}
              emptyText="No recent PRs yet."
              accent="#4ECDC4"
              renderValue={item => `${item.best1RM} kg`}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>30 Day Balance</Text>
              <Text style={styles.sectionSubtitle}>Longer trend across your main muscle groups</Text>
            </View>
            {!monthlyLeaders.length ? (
              <Text style={styles.emptyText}>Monthly balance appears once you build some history.</Text>
            ) : (
              monthlyLeaders.map(item => (
                <View key={item.muscle} style={styles.balanceRow}>
                  <View style={styles.balanceRowTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.balanceLabel}>{item.muscle}</Text>
                      <Text style={styles.balanceMeta}>
                        {item.directSets} direct • {item.assistedSets} assist • {item.sessionCount} sessions
                      </Text>
                    </View>
                    <Text style={styles.balanceValue}>{formatSetUnits(item.directSets || 0)} direct</Text>
                  </View>
                  <View style={styles.balanceTrack}>
                    <View style={[styles.balanceFill, { width: `${Math.max(12, (item.directIntensity || item.intensity || 0) * 100)}%` }]} />
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        <>
          <View style={styles.searchSection}>
            <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search exercise, muscle, equipment..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterRail}
            contentContainerStyle={styles.filterRailContent}
          >
            {bodyParts.map(item => (
              <TouchableOpacity
                key={item}
                style={[styles.filterChip, selectedBodyPart === item && styles.filterChipActive]}
                onPress={() => setSelectedBodyPart(item)}
              >
                <Text style={[styles.filterChipText, selectedBodyPart === item && styles.filterChipTextActive]}>
                  {item === 'all' ? 'All' : item}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mediaFilterRail}
            contentContainerStyle={styles.filterRailContent}
          >
            {[
              { id: 'all', label: 'All Media' },
              { id: 'video', label: 'With Video' },
              { id: 'image', label: 'With Image' },
            ].map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.filterChip, selectedMediaFilter === item.id && styles.filterChipActive]}
                onPress={() => setSelectedMediaFilter(item.id)}
              >
                <Text style={[styles.filterChipText, selectedMediaFilter === item.id && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={styles.libraryResultsMeta}>
            {filteredExercises.length} exercises • body: {selectedBodyPart === 'all' ? 'all' : selectedBodyPart} • media: {selectedMediaFilter}
          </Text>

          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id}
            renderItem={({ item }) => {
              const accent = getExerciseAccent(item);
              return (
                <TouchableOpacity style={styles.libraryCard} onPress={() => setSelectedExercise(item)}>
                  <View
                    style={[
                      styles.libraryIcon,
                      {
                        backgroundColor: accent.end,
                        borderColor: accent.start,
                      },
                    ]}
                  >
                    <Ionicons name={accent.icon} size={24} color="#E8DEFF" />
                  </View>
                  <View style={styles.libraryInfo}>
                    <Text style={styles.libraryName}>{item.name}</Text>
                    <View style={styles.libraryMetaRow}>
                      <Text style={styles.libraryMetaBadgePrimary}>{item.bodyPart || 'General'}</Text>
                      <Text style={styles.libraryMetaBadge}>{item.target || 'General'}</Text>
                    </View>
                    <View style={styles.tagRow}>
                      {item.primaryMuscles.slice(0, 2).map(tag => (
                        <Text key={tag} style={styles.primaryTag}>{tag}</Text>
                      ))}
                      {item.equipment.slice(0, 2).map(tag => (
                        <Text key={tag} style={styles.secondaryTag}>{tag}</Text>
                      ))}
                    </View>
                  </View>
                  <View style={styles.sourceBadge}>
                    <Text style={styles.sourceBadgeText}>{item.source.toUpperCase()}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No exercises found.</Text>}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </>
      )}

      <Modal visible={Boolean(selectedExercise)} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
            <TouchableOpacity
              onPress={() => {
                setSelectedExercise(null);
                setSelectedMediaPreview(null);
              }}
            >
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedImageItems[0] ? (
              <>
                <TouchableOpacity
                  activeOpacity={0.92}
                  style={styles.detailImageFrame}
                  onPress={() => setSelectedMediaPreview({
                    uri: selectedImageItems[0].uri,
                    mediaRef: selectedImageItems[0].mediaRef,
                    label: selectedExercise?.name || 'Exercise image',
                  })}
                >
                  <ResolvedMediaImage
                    uri={selectedImageItems[0].uri}
                    mediaRef={selectedImageItems[0].mediaRef}
                    style={styles.detailImage}
                    resizeMode="contain"
                    fallback={(
                      <MediaUnavailableFallback
                        style={styles.detailImage}
                        title="Image unavailable"
                        subtitle="Tunnel/mobile data cannot reach local exercise media. Generated visuals still work."
                      />
                    )}
                  />
                </TouchableOpacity>
                <Text style={styles.detailMediaHint}>Tap image to expand</Text>
                {selectedImageItems.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>
                    {selectedImageItems.slice(1).map(image => (
                      <TouchableOpacity
                        key={image.key}
                        activeOpacity={0.9}
                        style={styles.detailThumbFrame}
                        onPress={() => setSelectedMediaPreview({
                          uri: image.uri,
                          mediaRef: image.mediaRef,
                          label: selectedExercise?.name || 'Exercise image',
                        })}
                      >
                        <ResolvedMediaImage
                          uri={image.uri}
                          mediaRef={image.mediaRef}
                          style={styles.detailThumb}
                          resizeMode="contain"
                          fallback={<MediaUnavailableFallback style={styles.detailThumb} compact />}
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : null}
              </>
            ) : (
              <View style={[styles.detailImageFallback, { backgroundColor: selectedExerciseAccent.end }]}>
                <View style={[styles.detailImagePoster, { backgroundColor: selectedExerciseAccent.start }]}>
                  <Ionicons name={selectedExerciseAccent.icon} size={40} color="#F1E8FF" />
                  <Text style={styles.detailPosterTitle}>{selectedExercise?.bodyPart || 'Exercise'}</Text>
                  <Text style={styles.detailPosterSubtitle}>{selectedExercise?.target || 'Movement'}</Text>
                  <View style={styles.detailPosterTags}>
                    {(selectedExercise?.primaryMuscles || []).slice(0, 2).map(tag => (
                      <Text key={tag} style={styles.detailPosterTag}>{tag}</Text>
                    ))}
                  </View>
                </View>
                <Text style={styles.detailFallbackText}>Generated visual preview</Text>
              </View>
            )}

            <Text style={styles.detailLabel}>Primary muscles</Text>
            <View style={styles.detailTagRow}>
              {(selectedExercise?.primaryMuscles || []).map(tag => (
                <Text key={tag} style={styles.primaryTag}>{tag}</Text>
              ))}
            </View>

            <Text style={styles.detailLabel}>Secondary muscles</Text>
            <View style={styles.detailTagRow}>
              {(selectedExercise?.secondaryMuscles || []).map(tag => (
                <Text key={tag} style={styles.secondaryTag}>{tag}</Text>
              ))}
            </View>

            <Text style={styles.detailLabel}>Equipment</Text>
            <View style={styles.detailTagRow}>
              {(selectedExercise?.equipment || []).map(tag => (
                <Text key={tag} style={styles.secondaryTag}>{tag}</Text>
              ))}
            </View>

            <Text style={styles.detailLabel}>Videos</Text>
            {inlineGifPreviews.length ? (
              <View style={styles.inlineVideoList}>
                {inlineGifPreviews.map(video => (
                  <TouchableOpacity
                    key={video.key}
                    activeOpacity={0.92}
                    style={styles.inlineVideoCard}
                    onPress={() => setSelectedMediaPreview({
                      uri: video.uri,
                      mediaRef: video.mediaRef,
                      label: `${selectedExercise?.name || 'Exercise'} GIF`,
                    })}
                  >
                    <ResolvedMediaImage
                      uri={video.uri}
                      mediaRef={video.mediaRef}
                      style={styles.inlineVideoPreview}
                      resizeMode="contain"
                      fallback={(
                        <MediaUnavailableFallback
                          style={styles.inlineVideoPreview}
                          title="GIF unavailable"
                          subtitle="This preview needs local media access."
                        />
                      )}
                    />
                    <View style={styles.inlineVideoMeta}>
                      <Ionicons name="sparkles-outline" size={16} color="#4ECDC4" />
                      <Text style={styles.inlineVideoText}>GIF preview in app</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {externalVideoLinks.length ? (
              <View style={styles.videoList}>
                {externalVideoLinks.map(video => (
                  <TouchableOpacity key={video.key} style={styles.videoButton} onPress={() => openMediaLink(video)}>
                    <Ionicons name="open-outline" size={18} color="#4ECDC4" />
                    <Text style={styles.videoButtonText} numberOfLines={1}>Open external video</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            {!inlineGifPreviews.length && !externalVideoLinks.length ? (
              <Text style={styles.detailEmptyText}>No video URL available for this exercise.</Text>
            ) : null}

            <View style={styles.detailStatsCard}>
              <Text style={styles.detailStatsLabel}>Source</Text>
              <Text style={styles.detailStatsValue}>{selectedExercise?.source?.toUpperCase()}</Text>
              <Text style={styles.detailStatsLabel}>Media</Text>
              <Text style={styles.detailStatsValue}>
                {selectedImageItems.length} images • {selectedVideoItems.length} videos
              </Text>
              <Text style={styles.detailStatsLabel}>Status</Text>
              <Text style={styles.detailStatsValue}>
                {selectedExerciseMediaStatus}
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedMediaPreview)} animationType="fade" transparent>
        <View style={styles.previewModal}>
          <TouchableOpacity style={styles.previewBackdrop} activeOpacity={1} onPress={() => setSelectedMediaPreview(null)} />
          <View style={styles.previewContent}>
            <TouchableOpacity style={styles.previewCloseButton} onPress={() => setSelectedMediaPreview(null)}>
              <Ionicons name="close-circle" size={34} color="#F4F1FF" />
            </TouchableOpacity>
            {selectedMediaPreview?.uri || selectedMediaPreview?.mediaRef ? (
              <ResolvedMediaImage
                uri={selectedMediaPreview.uri}
                mediaRef={selectedMediaPreview.mediaRef}
                style={styles.previewImage}
                resizeMode="contain"
                fallback={(
                  <MediaUnavailableFallback
                    style={styles.previewImage}
                    title="Preview unavailable"
                    subtitle="Current network mode cannot reach local exercise media."
                  />
                )}
              />
            ) : null}
            <Text style={styles.previewCaption}>{selectedMediaPreview?.label || 'Media preview'}</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F1115',
    padding: 15,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#171920',
    padding: 4,
    borderRadius: 16,
    marginBottom: 18,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tabButtonActive: {
    backgroundColor: '#BB86FC',
  },
  tabText: {
    color: '#777',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  heroCard: {
    backgroundColor: '#191C27',
    borderRadius: 26,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2C3550',
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  heroEyebrow: {
    color: '#8EA2FF',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  heroMeta: {
    color: '#BEC7E5',
    marginTop: 10,
    lineHeight: 19,
  },
  heroPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  heroPill: {
    backgroundColor: '#111522',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroPillText: {
    color: '#D9DEEE',
    fontSize: 12,
    fontWeight: '700',
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111522',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 6,
  },
  syncBtnText: {
    color: '#BB86FC',
    fontWeight: '700',
  },
  warningText: {
    color: '#FFB74D',
    marginTop: 12,
  },
  warningBadge: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2C2417',
    padding: 10,
    borderRadius: 12,
  },
  warningBadgeText: {
    color: '#FFD089',
    fontSize: 12,
    flex: 1,
  },
  unmappedList: {
    marginTop: 8,
    gap: 8,
  },
  unmappedItem: {
    backgroundColor: '#3D2E1B',
    borderWidth: 1,
    borderColor: '#6C4F2A',
    borderRadius: 10,
    padding: 8,
    gap: 8,
  },
  unmappedItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  unmappedChip: {
    color: '#FFDFA9',
    fontSize: 10,
    backgroundColor: '#4A3820',
    borderWidth: 1,
    borderColor: '#70562F',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  unmappedCount: {
    color: '#F3C57D',
    fontSize: 10,
    fontWeight: '700',
  },
  unmappedSuggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  unmappedSuggestionBtn: {
    backgroundColor: '#1B2D43',
    borderWidth: 1,
    borderColor: '#385677',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  unmappedSuggestionBtnText: {
    color: '#CDE4FF',
    fontSize: 11,
    fontWeight: '700',
  },
  unmappedNoSuggestionText: {
    color: '#BFAE94',
    fontSize: 11,
  },
  aliasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#232B3A',
  },
  aliasLegacy: {
    color: '#F6DEB8',
    fontSize: 12,
    fontWeight: '700',
  },
  aliasCanonical: {
    color: '#9FB0CC',
    fontSize: 11,
    marginTop: 4,
  },
  aliasDeleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B2327',
    borderWidth: 1,
    borderColor: '#6D3A43',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  aliasDeleteText: {
    color: '#FFB3B3',
    fontSize: 11,
    fontWeight: '700',
  },
  mediaReadyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#232B3A',
  },
  mediaReadyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  mediaReadyName: {
    color: '#E7EDF8',
    fontWeight: '700',
    flex: 1,
  },
  mediaReadyMeta: {
    color: '#8FA4C4',
    fontSize: 11,
    fontWeight: '600',
  },
  mediaReadyAction: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A4A68',
    backgroundColor: '#1A2436',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  mediaReadyActionText: {
    color: '#CFE2FF',
    fontSize: 12,
    fontWeight: '700',
  },
  recommendationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#232B3A',
  },
  recommendationMain: {
    flex: 1,
  },
  recommendationName: {
    color: '#EAF2FF',
    fontSize: 14,
    fontWeight: '800',
  },
  recommendationMeta: {
    color: '#9FB0CC',
    fontSize: 11,
    marginTop: 4,
  },
  recommendationBadges: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  recommendationBadgeVideo: {
    color: '#BBFFE1',
    backgroundColor: '#235440',
    borderWidth: 1,
    borderColor: '#3D896A',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recommendationBadgeImage: {
    color: '#E7E8FF',
    backgroundColor: '#313760',
    borderWidth: 1,
    borderColor: '#5E66A8',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  recommendationBadgeFallback: {
    color: '#CFD7E8',
    backgroundColor: '#2B3240',
    borderWidth: 1,
    borderColor: '#4B5A73',
    fontSize: 10,
    fontWeight: '800',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  rhythmRail: {
    marginHorizontal: -2,
  },
  rhythmRailContent: {
    gap: 8,
    paddingRight: 8,
  },
  rhythmCell: {
    alignItems: 'center',
    width: 34,
    gap: 6,
  },
  rhythmDot: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rhythmDotValue: {
    fontSize: 10,
    fontWeight: '800',
  },
  rhythmDayText: {
    color: '#7F8CA1',
    fontSize: 10,
    fontWeight: '700',
  },
  rhythmSummaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rhythmSummaryText: {
    color: '#C9D3E6',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#1E2432',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#313E57',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  bodyMapRow: {
    flexDirection: 'column',
    gap: 10,
  },
  bodyMapFigureCard: {
    backgroundColor: '#131822',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#273349',
    padding: 12,
  },
  bodyMapFigureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  bodyMapFigureTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  bodyMapFigureSub: {
    color: '#9FB0CC',
    fontSize: 10,
    fontWeight: '700',
  },
  bodyMapFigureContent: {
    flexDirection: 'column',
    gap: 12,
  },
  bodyMapChipGrid: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
  },
  bodyMapColumn: {
    flex: 1,
    gap: 6,
  },
  bodyMapChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  bodyMapChipLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bodyMapChipValue: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: '700',
  },
  bodyMapChipAssist: {
    fontSize: 10,
    marginTop: 2,
    opacity: 0.85,
  },
  bodyMapAnatomy: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3C58',
    backgroundColor: '#121927',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bodyMapAnatomyHead: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: '#1E2D42',
    borderWidth: 1,
    borderColor: '#4A6386',
    marginBottom: 6,
  },
  bodyMapAnatomyBody: {
    width: 170,
    height: 220,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyMapAnatomyTorso: {
    position: 'absolute',
    top: 20,
    width: 68,
    height: 168,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: '#32496A',
    backgroundColor: '#182334',
  },
  bodyMapAnatomyZone: {
    position: 'absolute',
    width: 72,
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  bodyMapAnatomyZoneLeftUpper: {
    left: 2,
    top: 24,
  },
  bodyMapAnatomyZoneRightUpper: {
    right: 2,
    top: 24,
  },
  bodyMapAnatomyZoneLeftMid: {
    left: 8,
    top: 88,
  },
  bodyMapAnatomyZoneRightMid: {
    right: 8,
    top: 88,
  },
  bodyMapAnatomyZoneLeftLower: {
    left: 14,
    top: 154,
  },
  bodyMapAnatomyZoneRightLower: {
    right: 14,
    top: 154,
  },
  bodyMapAnatomyZoneLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  bodyMapAnatomyZoneValue: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  bodyMapAnatomyHint: {
    color: '#8EA2BF',
    fontSize: 10,
    marginTop: 8,
    fontWeight: '600',
  },
  targetRail: {
    gap: 10,
    paddingRight: 12,
  },
  targetCard: {
    width: 190,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  targetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  targetCardTitle: {
    fontSize: 13,
    fontWeight: '800',
  },
  targetCardBadge: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  targetCardMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  targetCardValue: {
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
  },
  targetCardRange: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  targetCardMeta: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#17191D',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#262A31',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: '#EFF2F7',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 10,
  },
  statMeta: {
    color: '#828A9D',
    fontSize: 11,
    marginTop: 5,
    lineHeight: 16,
  },
  sectionCard: {
    backgroundColor: '#15171C',
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#23272E',
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: '#8A91A1',
    fontSize: 12,
    marginTop: 5,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  muscleTile: {
    width: '48%',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2A2D35',
  },
  muscleTileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  muscleTileName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  muscleTileSessions: {
    color: '#BCA2F6',
    fontSize: 11,
    fontWeight: '800',
  },
  muscleTileValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 12,
  },
  muscleTileUnit: {
    color: '#B9BED0',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  muscleTileMeta: {
    color: '#9AA2B2',
    fontSize: 12,
    marginTop: 10,
  },
  muscleTileSub: {
    color: '#7E8699',
    fontSize: 11,
    marginTop: 4,
  },
  muscleTileTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#0C0D11',
    overflow: 'hidden',
    marginTop: 12,
  },
  muscleTileFill: {
    height: '100%',
    backgroundColor: '#BB86FC',
    borderRadius: 999,
  },
  dualInsightRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  insightCard: {
    flex: 1,
    backgroundColor: '#15171C',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#23272E',
  },
  insightTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  insightSubtitle: {
    color: '#848C9E',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
  },
  insightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#22252C',
  },
  insightRowMain: {
    flex: 1,
  },
  insightItemLabel: {
    color: '#ECEFF5',
    fontWeight: '600',
  },
  insightItemSub: {
    color: '#767F90',
    fontSize: 11,
    marginTop: 3,
  },
  insightItemValue: {
    fontWeight: '800',
  },
  balanceRow: {
    marginBottom: 14,
  },
  balanceRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  balanceLabel: {
    color: '#F0F3F9',
    fontSize: 14,
    fontWeight: '700',
  },
  balanceMeta: {
    color: '#8790A4',
    fontSize: 12,
    marginTop: 4,
  },
  balanceValue: {
    color: '#BB86FC',
    fontWeight: '800',
  },
  balanceTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#0D0F13',
    overflow: 'hidden',
    marginTop: 10,
  },
  balanceFill: {
    height: '100%',
    backgroundColor: '#BB86FC',
    borderRadius: 999,
  },
  searchSection: {
    flexDirection: 'row',
    backgroundColor: '#1A1C22',
    borderRadius: 14,
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 16,
    height: 52,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
  },
  filterRail: {
    minHeight: 48,
    marginBottom: 10,
  },
  mediaFilterRail: {
    minHeight: 48,
    marginBottom: 16,
  },
  libraryResultsMeta: {
    color: '#A4B1C7',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 10,
  },
  filterRailContent: {
    gap: 8,
    paddingRight: 20,
    alignItems: 'center',
  },
  filterChip: {
    backgroundColor: '#1A1E27',
    borderWidth: 1,
    borderColor: '#2D3448',
    paddingHorizontal: 15,
    paddingVertical: 11,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  filterChipText: {
    color: '#CED6EA',
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  libraryCard: {
    backgroundColor: '#17191D',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#272A31',
  },
  libraryIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  libraryInfo: {
    flex: 1,
    marginRight: 10,
  },
  libraryName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  libraryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  libraryMetaBadgePrimary: {
    color: '#F0E8FF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#43305D',
    borderColor: '#6D4C91',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  libraryMetaBadge: {
    color: '#DFE7F5',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: '#2A313D',
    borderColor: '#445064',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  primaryTag: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#3E2C5C',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  secondaryTag: {
    color: '#C5C7CE',
    fontSize: 11,
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sourceBadge: {
    backgroundColor: '#101010',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sourceBadgeText: {
    color: '#BB86FC',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 18,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    flex: 1,
  },
  detailImageFrame: {
    width: '100%',
    height: 320,
    borderRadius: 22,
    backgroundColor: '#171A22',
    borderWidth: 1,
    borderColor: '#232A37',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  detailImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#171A22',
  },
  detailMediaHint: {
    color: '#8E9AAF',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 16,
  },
  mediaRail: {
    gap: 10,
    paddingBottom: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  detailThumbFrame: {
    width: 96,
    height: 96,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#171A22',
    borderWidth: 1,
    borderColor: '#232A37',
  },
  detailThumb: {
    width: '100%',
    height: '100%',
    backgroundColor: '#171A22',
  },
  detailImageFallback: {
    width: '100%',
    height: 180,
    borderRadius: 22,
    marginBottom: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  detailImagePoster: {
    width: '100%',
    flex: 1,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderWidth: 1,
    borderColor: '#FFFFFF18',
  },
  detailPosterTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 12,
  },
  detailPosterSubtitle: {
    color: '#D8CFF0',
    fontSize: 13,
    marginTop: 6,
  },
  detailPosterTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
  },
  detailPosterTag: {
    color: '#F3EEFF',
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: '#FFFFFF18',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  detailFallbackText: {
    color: '#8A91A1',
    fontSize: 12,
    marginTop: 10,
  },
  detailLabel: {
    color: '#A0A0A0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 12,
  },
  detailTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  videoList: {
    gap: 10,
  },
  inlineVideoList: {
    gap: 12,
  },
  inlineVideoCard: {
    backgroundColor: '#171A22',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#263041',
    overflow: 'hidden',
  },
  inlineVideoPreview: {
    width: '100%',
    height: 260,
    backgroundColor: '#10131A',
  },
  inlineVideoMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inlineVideoText: {
    color: '#DCEBEB',
    fontWeight: '700',
  },
  videoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#171A22',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#263041',
  },
  videoButtonText: {
    color: '#DCEBEB',
    flex: 1,
    fontWeight: '700',
  },
  detailEmptyText: {
    color: '#7F8897',
    fontSize: 13,
  },
  detailStatsCard: {
    marginTop: 18,
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    padding: 16,
  },
  detailStatsLabel: {
    color: '#777',
    fontSize: 12,
    textTransform: 'uppercase',
  },
  detailStatsValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    marginTop: 4,
  },
  previewModal: {
    flex: 1,
    backgroundColor: '#000000E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    width: '100%',
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 54,
    paddingBottom: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 54,
    right: 18,
    zIndex: 2,
  },
  previewImage: {
    width: '100%',
    height: '78%',
  },
  mediaUnavailableFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#171A22',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  mediaUnavailableFallbackCompact: {
    paddingHorizontal: 8,
  },
  mediaUnavailableIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334057',
    backgroundColor: '#1D2431',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  mediaUnavailableTitle: {
    color: '#F2F5FB',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  mediaUnavailableTitleCompact: {
    fontSize: 10,
    marginTop: -2,
  },
  mediaUnavailableSubtitle: {
    color: '#9CA8BD',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
    maxWidth: 240,
  },
  previewCaption: {
    color: '#F4F1FF',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
  },
});
