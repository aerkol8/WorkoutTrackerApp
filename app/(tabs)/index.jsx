import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useWorkout } from '../../context/WorkoutContext';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { history, deleteHistoryEntry, calculate1RM } = useWorkout();
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState(null); 
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Open Detail Modal
  const openWorkoutDetail = (workout) => {
    setSelectedWorkout(workout);
    setIsModalVisible(true);
  };

  // Calendar markings
  const markedDates = {};
  (history || []).forEach(item => {
    if (item.dateISO) {
      markedDates[item.dateISO] = { selected: true, selectedColor: '#BB86FC' };
    }
  });

  const lastWorkout = history && history.length > 0 ? history[0] : null;

  return (
    <View style={styles.container}>
      {/* CALENDAR HEADER AND TOGGLE */}
      <TouchableOpacity 
        style={styles.calendarHeader} 
        onPress={() => setShowCalendar(!showCalendar)}
      >
        <Text style={styles.calendarHeaderText}>
          {showCalendar ? "HIDE CALENDAR" : "SHOW CALENDAR"}
        </Text>
        <Ionicons 
          name={showCalendar ? "chevron-up" : "calendar-outline"} 
          size={20} 
          color="#BB86FC" 
        />
      </TouchableOpacity>

      {showCalendar && (
        <Calendar
          theme={{
            backgroundColor: '#121212',
            calendarBackground: '#121212',
            dayTextColor: '#fff',
            monthTextColor: '#fff',
            todayTextColor: '#BB86FC',
            arrowColor: '#BB86FC',
          }}
          markedDates={markedDates}
        />
      )}

      {/*history for training*/}
      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={() => (
          <>
            {lastWorkout && !showCalendar && (
              <TouchableOpacity 
                style={styles.lastWorkoutCard}
                onPress={() => openWorkoutDetail(lastWorkout)}
              >
                <View style={styles.tagRow}>
                  <Text style={styles.tag}>LAST WORKOUT</Text>
                  {lastWorkout.prCount > 0 && (
                    <View style={styles.prBadge}>
                      <Ionicons name="star" size={12} color="#FFD700" />
                      <Text style={styles.prBadgeText}>{lastWorkout.prCount} PR</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.lastTitle}>{lastWorkout.routineName}</Text>
                <Text style={styles.lastDate}>{lastWorkout.dateString}</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statText}>⏱ {lastWorkout.duration}</Text>
                  <Text style={styles.statText}>🏋️ {lastWorkout.exercises?.length} Exercises</Text>
                </View>
              </TouchableOpacity>
            )}
            <Text style={styles.listTitle}>All History</Text>
          </>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.historyCard}
            onPress={() => openWorkoutDetail(item)}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{item.routineName}</Text>
                {item.prCount > 0 && (
                  <View style={styles.prBadgeSmall}>
                    <Ionicons name="star" size={10} color="#FFD700" />
                    <Text style={styles.prBadgeTextSmall}>{item.prCount}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => {
                Alert.alert(
                  'Delete History',
                  `Are you sure you want to delete ${item.routineName}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteHistoryEntry(item.id) },
                  ]
                );
              }}>
                <Ionicons name="trash-outline" size={18} color="#CF6679" />
              </TouchableOpacity>
            </View>
            <Text style={styles.cardDate}>{item.dateString} - {item.duration}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No workouts yet.</Text>}
        contentContainerStyle={{ padding: 20 }}
      />

      {/* DETAIL MODAL */}
      <Modal visible={isModalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View>
              <View style={styles.modalTitleRow}>
                <Text style={styles.modalTitle}>{selectedWorkout?.routineName}</Text>
                {selectedWorkout?.prCount > 0 && (
                  <View style={styles.prBadgeLarge}>
                    <Ionicons name="star" size={16} color="#FFD700" />
                    <Text style={styles.prBadgeTextLarge}>{selectedWorkout.prCount} PR</Text>
                  </View>
                )}
              </View>
              <Text style={styles.modalSubtitle}>{selectedWorkout?.dateString}</Text>
            </View>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.summaryStats}>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>DURATION</Text>
                <Text style={styles.statVal}>{selectedWorkout?.duration}</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statLabel}>EXERCISES</Text>
                <Text style={styles.statVal}>{selectedWorkout?.exercises?.length}</Text>
              </View>
              {selectedWorkout?.prCount > 0 && (
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>PR</Text>
                  <Text style={[styles.statVal, { color: '#FFD700' }]}>{selectedWorkout.prCount} ⭐</Text>
                </View>
              )}
            </View>

            {(selectedWorkout?.exercises || []).map((ex, idx) => (
              <View key={idx} style={[styles.detailExCard, ex.isPR && styles.detailExCardPR]}>
                <View style={styles.exNameRow}>
                  <Text style={styles.detailExName}>{ex.name?.toUpperCase()}</Text>
                  {ex.isPR && (
                    <View style={styles.prStarBadge}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <Text style={styles.prStarText}>PR!</Text>
                    </View>
                  )}
                </View>
                {ex.best1RM > 0 && (
                  <View style={styles.rmRow}>
                    <Text style={styles.rmLabel}>Estimated 1RM:</Text>
                    <Text style={[styles.rmValue, ex.isPR && { color: '#FFD700' }]}>{ex.best1RM} kg</Text>
                    {ex.previousBest > 0 && ex.isPR && (
                      <Text style={styles.rmImprove}>(+{ex.best1RM - ex.previousBest} kg)</Text>
                    )}
                  </View>
                )}
                <View style={styles.setsHeader}>
                  <Text style={styles.setHeaderText}>SET</Text>
                  <Text style={styles.setHeaderText}>KG</Text>
                  <Text style={styles.setHeaderText}>REPS</Text>
                  <Text style={styles.setHeaderText}>1RM</Text>
                </View>
                {ex.sets?.map((set, sIdx) => {
                  const set1RM = calculate1RM(set.weight, set.reps);
                  const isBestSet = set1RM === ex.best1RM && set1RM > 0;
                  return (
                    <View key={sIdx} style={[styles.setDetailRow, isBestSet && styles.setDetailRowBest]}>
                      <Text style={styles.setNum}>{sIdx + 1}</Text>
                      <Text style={styles.setVal}>{set.weight} kg</Text>
                      <Text style={styles.setVal}>{set.reps} reps</Text>
                      <Text style={[styles.setVal, isBestSet && { color: '#FFD700', fontWeight: 'bold' }]}>{set1RM}</Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#1E1E1E',
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  calendarHeaderText: { color: '#BB86FC', fontWeight: 'bold', marginRight: 10, letterSpacing: 1 },
  lastWorkoutCard: {
    backgroundColor: '#2A1D3D',
    padding: 20,
    borderRadius: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#BB86FC55'
  },
  tagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
  tag: { color: '#BB86FC', fontSize: 10, fontWeight: 'bold' },
  prBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D2A1D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD70055',
  },
  prBadgeText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  prBadgeSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D2A1D',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  prBadgeTextSmall: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', marginLeft: 3 },
  prBadgeLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D2A1D',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginLeft: 12,
    borderWidth: 1,
    borderColor: '#FFD70055',
  },
  prBadgeTextLarge: { color: '#FFD700', fontSize: 13, fontWeight: 'bold', marginLeft: 5 },
  lastTitle: { color: 'white', fontSize: 24, fontWeight: '900' },
  lastDate: { color: '#888', marginBottom: 15 },
  statsRow: { flexDirection: 'row', gap: 20 },
  statText: { color: '#ccc', fontWeight: '500' },
  listTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  historyCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { color: 'white', fontWeight: 'bold' },
  cardDate: { color: '#666', fontSize: 12, marginTop: 5 },
  emptyText: { color: '#444', textAlign: 'center', marginTop: 50 },
  
  // MODAL STYLES
  modalContent: { flex: 1, backgroundColor: '#121212', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 24, fontWeight: 'bold' },
  modalSubtitle: { color: '#888', fontSize: 14 },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 20 },
  statBox: { alignItems: 'center' },
  statLabel: { color: '#666', fontSize: 10, marginBottom: 5 },
  statVal: { color: '#BB86FC', fontSize: 18, fontWeight: 'bold' },
  detailExCard: { backgroundColor: '#1E1E1E', padding: 15, borderRadius: 15, marginBottom: 15 },
  detailExCardPR: { borderWidth: 1, borderColor: '#FFD70044' },
  exNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  prStarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#3D2A1D',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  prStarText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', marginLeft: 4 },
  rmRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#333' },
  rmLabel: { color: '#888', fontSize: 12 },
  rmValue: { color: '#BB86FC', fontSize: 14, fontWeight: 'bold', marginLeft: 8 },
  rmImprove: { color: '#4CAF50', fontSize: 12, marginLeft: 8 },
  detailExName: { color: 'white', fontWeight: 'bold' },
  setsHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, marginBottom: 5 },
  setHeaderText: { color: '#444', fontSize: 10, fontWeight: 'bold', flex: 1, textAlign: 'center' },
  setDetailRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#252525', padding: 10, borderRadius: 8, marginBottom: 5 },
  setDetailRowBest: { backgroundColor: '#2D2A1D', borderWidth: 1, borderColor: '#FFD70033' },
  setNum: { color: '#BB86FC', fontWeight: 'bold', flex: 1, textAlign: 'center' },
  setVal: { color: '#ccc', flex: 1, textAlign: 'center', fontSize: 14 }
});