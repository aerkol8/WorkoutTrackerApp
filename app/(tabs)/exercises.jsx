import React, { useMemo, useState } from 'react';
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
      <Text style={styles.muscleTileValue}>{formatSetUnits(item.total)}</Text>
      <Text style={styles.muscleTileUnit}>set units</Text>
      <Text style={styles.muscleTileMeta}>
        {item.directSets} direct • {item.assistedSets} assist
      </Text>
      <Text style={styles.muscleTileSub}>{getLastTrainedLabel(item)}</Text>
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

export default function ExercisesScreen() {
  const [tab, setTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBodyPart, setSelectedBodyPart] = useState('all');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const { library, catalogMeta, dashboard7, dashboard30, recentPRs, refreshExerciseCatalog } = useWorkout();

  const bodyParts = useMemo(() => (
    ['all', ...Array.from(new Set((library || []).map(item => item.bodyPart).filter(Boolean))).sort()]
  ), [library]);

  const filteredExercises = useMemo(() => (
    (library || [])
      .filter(exercise => {
        const q = searchQuery.trim().toLowerCase();
        const matchesQuery = !q ||
          exercise.name.toLowerCase().includes(q) ||
          exercise.bodyPart.toLowerCase().includes(q) ||
          (exercise.primaryMuscles || []).some(muscle => muscle.toLowerCase().includes(q)) ||
          (exercise.equipment || []).some(item => item.toLowerCase().includes(q));
        const matchesBodyPart = selectedBodyPart === 'all' || exercise.bodyPart === selectedBodyPart;
        return matchesQuery && matchesBodyPart;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
  ), [library, searchQuery, selectedBodyPart]);

  const weeklyMuscles = useMemo(
    () => dashboard7.muscles.filter(item => item.total > 0).slice(0, 6),
    [dashboard7]
  );
  const monthlyLeaders = useMemo(
    () => dashboard30.muscles.filter(item => item.total > 0).slice(0, 8),
    [dashboard30]
  );
  const mediaCoverage = useMemo(() => {
    const imageCount = library.filter(item => (item.images || []).length > 0).length;
    const videoCount = library.filter(item => (item.videos || []).length > 0).length;
    return { imageCount, videoCount };
  }, [library]);

  const syncedText = catalogMeta.syncedAt
    ? new Date(catalogMeta.syncedAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
    : 'Bundled snapshot';

  const weeklyCoverage = dashboard7.totalMuscles
    ? Math.round((dashboard7.trainedMuscleCount / dashboard7.totalMuscles) * 100)
    : 0;
  const monthlyCoverage = dashboard30.totalMuscles
    ? Math.round((dashboard30.trainedMuscleCount / dashboard30.totalMuscles) * 100)
    : 0;

  const openMediaLink = async (url) => {
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Media Error', 'This media link could not be opened.');
    }
  };

  const selectedExerciseAccent = getExerciseAccent(selectedExercise || {});

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
                <Text style={styles.heroTitle}>Set-based weekly balance</Text>
                <Text style={styles.heroMeta}>
                  Direct sets count as 1. Assisting sets count as 0.5. This is easier to read than tonnage.
                </Text>
              </View>
              <TouchableOpacity style={styles.syncBtn} onPress={() => refreshExerciseCatalog(true)}>
                <Ionicons name="sync-outline" size={18} color="#BB86FC" />
                <Text style={styles.syncBtnText}>Refresh</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.heroPills}>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>{library.length} exercises</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>sync {syncedText}</Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>
                  {catalogMeta.source === 'snapshot'
                    ? 'snapshot ready'
                    : catalogMeta.source === 'cache'
                      ? 'cached sync'
                      : catalogMeta.source === 'wger'
                        ? 'manual sync'
                        : 'catalog ready'}
                </Text>
              </View>
              <View style={styles.heroPill}>
                <Text style={styles.heroPillText}>
                  media {mediaCoverage.imageCount} img • {mediaCoverage.videoCount} vid
                </Text>
              </View>
            </View>

            {catalogMeta.lastError ? (
              <Text style={styles.warningText}>Last sync issue: {catalogMeta.lastError}</Text>
            ) : null}
            {dashboard30.unmappedCount > 0 ? (
              <View style={styles.warningBadge}>
                <Ionicons name="alert-circle-outline" size={16} color="#FFB74D" />
                <Text style={styles.warningBadgeText}>
                  {dashboard30.unmappedCount} legacy movement still needs mapping
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.statsRow}>
            <DashboardStatCard
              label="7D set units"
              value={formatSetUnits(dashboard7.totalSetUnits)}
              meta={`${dashboard7.trainedMuscleCount} muscles hit`}
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
              <Text style={styles.sectionTitle}>7 Day Focus</Text>
              <Text style={styles.sectionSubtitle}>What you actually trained most this week</Text>
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
              renderValue={item => `${formatSetUnits(item.total)}u`}
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
                    <Text style={styles.balanceValue}>{formatSetUnits(item.total)} units</Text>
                  </View>
                  <View style={styles.balanceTrack}>
                    <View style={[styles.balanceFill, { width: `${Math.max(12, item.intensity * 100)}%` }]} />
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

          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.libraryCard} onPress={() => setSelectedExercise(item)}>
                <View style={styles.libraryIcon}>
                  <Ionicons name="barbell-outline" size={24} color="#BB86FC" />
                </View>
                <View style={styles.libraryInfo}>
                  <Text style={styles.libraryName}>{item.name}</Text>
                  <Text style={styles.libraryMeta}>
                    {item.bodyPart} • {item.target}
                  </Text>
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
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>No exercises found.</Text>}
            contentContainerStyle={{ paddingBottom: 24 }}
          />
        </>
      )}

      <Modal visible={Boolean(selectedExercise)} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedExercise?.name}</Text>
            <TouchableOpacity onPress={() => setSelectedExercise(null)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {selectedExercise?.images?.[0] ? (
              <>
                <Image source={{ uri: selectedExercise.images[0] }} style={styles.detailImage} resizeMode="cover" />
                {selectedExercise.images.length > 1 ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaRail}>
                    {selectedExercise.images.slice(1).map(image => (
                      <Image key={image} source={{ uri: image }} style={styles.detailThumb} resizeMode="cover" />
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
                <Text style={styles.detailFallbackText}>No exercise-specific image in current catalog</Text>
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
            {(selectedExercise?.videos || []).length ? (
              <View style={styles.videoList}>
                {selectedExercise.videos.map(video => (
                  <TouchableOpacity key={video} style={styles.videoButton} onPress={() => openMediaLink(video)}>
                    <Ionicons name="play-circle-outline" size={18} color="#4ECDC4" />
                    <Text style={styles.videoButtonText} numberOfLines={1}>Open video</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <Text style={styles.detailEmptyText}>No video URL available for this exercise.</Text>
            )}

            <View style={styles.detailStatsCard}>
              <Text style={styles.detailStatsLabel}>Source</Text>
              <Text style={styles.detailStatsValue}>{selectedExercise?.source?.toUpperCase()}</Text>
              <Text style={styles.detailStatsLabel}>Media</Text>
              <Text style={styles.detailStatsValue}>
                {(selectedExercise?.images?.length || 0)} images • {(selectedExercise?.videos?.length || 0)} videos
              </Text>
              <Text style={styles.detailStatsLabel}>Status</Text>
              <Text style={styles.detailStatsValue}>
                {selectedExercise?.source === 'seed'
                  ? 'Seed fallback entry: no media expected'
                  : selectedExercise?.source === 'snapshot'
                    ? 'Bundled snapshot entry'
                  : ((selectedExercise?.images?.length || 0) + (selectedExercise?.videos?.length || 0)) > 0
                    ? 'Media exists in source'
                    : 'wger record has no media'}
              </Text>
            </View>
          </ScrollView>
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
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
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
    maxHeight: 42,
    marginBottom: 16,
  },
  filterRailContent: {
    gap: 8,
    paddingRight: 20,
  },
  filterChip: {
    backgroundColor: '#1A1C22',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  filterChipActive: {
    backgroundColor: '#BB86FC',
  },
  filterChipText: {
    color: '#777',
    fontWeight: '600',
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
    backgroundColor: '#241934',
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
  libraryMeta: {
    color: '#A0A2AA',
    fontSize: 12,
    marginTop: 4,
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
  detailImage: {
    width: '100%',
    height: 220,
    borderRadius: 22,
    backgroundColor: '#1E1E1E',
    marginBottom: 18,
  },
  mediaRail: {
    gap: 10,
    paddingBottom: 8,
    marginTop: -4,
    marginBottom: 8,
  },
  detailThumb: {
    width: 96,
    height: 96,
    borderRadius: 16,
    backgroundColor: '#1E1E1E',
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
});
