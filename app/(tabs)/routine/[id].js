import React, { useState, useEffect, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator, TextInput, Vibration, AppState, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useWorkout } from '../../../context/WorkoutContext';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { toLocalDateKey } from '../../../utils/date';

// Notification settings
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ... RoutineDetail function ...


export default function RoutineDetail() {
  const { id } = useLocalSearchParams();
  const { 
    finishWorkout, 
    routines, 
    library,
    addExerciseToSpecificRoutine, 
    deleteExerciseFromRoutine,
    addNewSet,
    updateSetData,
    toggleSetStatus,
    resetRoutineProgress
  } = useWorkout();
  const router = useRouter();

  // --- STATES ---
  const [modalVisible, setModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Rest timer (between sets)
  const [restState, setRestState] = useState(null);
  const restStartTimeRef = useRef(null); // Rest start time
  const restDurationRef = useRef(0); // Total rest duration
  const workoutStartTimeRef = useRef(null); // Workout start time
  const appState = useRef(AppState.currentState);
  const notificationIdRef = useRef(null);

  const currentRoutine = routines.find(r => r.id === id);

  // Request notification permissions
  useEffect(() => {
    const requestPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permission not granted');
      }
    };
    requestPermissions();
  }, []);

  // Update timer when app returns from background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground
        
        // Update workout duration
        if (workoutStartTimeRef.current && isActive) {
          const elapsed = Math.floor((Date.now() - workoutStartTimeRef.current) / 1000);
          setSeconds(elapsed);
        }
        
        // Update rest duration
        if (restStartTimeRef.current && restState?.isRunning) {
          const elapsed = Math.floor((Date.now() - restStartTimeRef.current) / 1000);
          const remaining = Math.max(0, restDurationRef.current - elapsed);
          
          if (remaining <= 0) {
            // Time expired
            setRestState(null);
            Vibration.vibrate(200);
            restStartTimeRef.current = null;
          } else {
            // Update remaining time
            setRestState(prev => prev ? { ...prev, remainingSeconds: remaining } : null);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [restState?.isRunning, isActive]);

  // --- MODAL OPEN (Callback function) ---
  const openModal = () => {
    setModalVisible(true);
  };

  // --- SEARCH FILTER ---
  // We'll use this list while searching exercises in the modal
  const filteredExercises = (library || []).filter(ex =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.bodyPart.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (ex.primaryMuscles || []).some(muscle => muscle.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const handleResetTimer = () => {
    setIsActive(false);
    setSeconds(0);
    workoutStartTimeRef.current = null;
  };

  // --- TIMER LOGIC ---
  useEffect(() => {
    let interval = null;
    if (isActive) {
      // Record workout start time (when started for the first time)
      if (!workoutStartTimeRef.current) {
        workoutStartTimeRef.current = Date.now() - (seconds * 1000);
      }
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - workoutStartTimeRef.current) / 1000);
        setSeconds(elapsed);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  // --- REST COUNTDOWN ---
  useEffect(() => {
    if (!restState?.isRunning) return;
    if (restState.remainingSeconds <= 0) {
      cancelRestNotification(); 
      restStartTimeRef.current = null;
      setRestState(null);
      Vibration.vibrate(200);
      return;
    }

    const t = setTimeout(() => {
      setRestState((prev) => {
        if (!prev?.isRunning) return prev;
        return { ...prev, remainingSeconds: Math.max(0, prev.remainingSeconds - 1) };
      });
    }, 1000);

    return () => clearTimeout(t);
  }, [restState?.isRunning, restState?.remainingSeconds]);

  const formatCountdown = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Bildirim planla
  const scheduleRestNotification = async (restSeconds) => {
    try {
      // Cancel previous notification
      if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
      }
      
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '💪 Rest Complete!',
          body: 'Ready for the next set?',
          sound: true,
        },
        trigger: {
          seconds: restSeconds,
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        },
      });
      notificationIdRef.current = id;
    } catch (e) {
      console.log('Notification could not be scheduled:', e);
    }
  };

  
  const cancelRestNotification = async () => {
    try {
      if (notificationIdRef.current) {
        await Notifications.cancelScheduledNotificationAsync(notificationIdRef.current);
        notificationIdRef.current = null;
      }
    } catch (e) {
      console.log('Notification could not be canceled:', e);
    }
  };

  const startRest = async ({ routineId, workoutId, setIndex, seconds: restSeconds }) => {
    if (!restSeconds || restSeconds <= 0) return;
    
    // Record start time
    restStartTimeRef.current = Date.now();
    restDurationRef.current = restSeconds;
    
    // Bildirim planla
    await scheduleRestNotification(restSeconds);
    
    setRestState({
      routineId,
      workoutId,
      setIndex,
      remainingSeconds: restSeconds,
      isRunning: true,
    });
  };

  // Cancel rest notification when rest is canceled
  const cancelRest = async () => {
    await cancelRestNotification();
    restStartTimeRef.current = null;
    setRestState(null);
  };

  const isResting = Boolean(restState?.isRunning);
  const canMarkSets = isActive && !isResting;

  // timer format (00:00)
  const formatTime = (totalSecs) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // --- FINISH WORKOUT ---
 const handleFinishWorkout = () => {
  // Check if all sets of all exercises are marked as done
  const allSetsDone = currentRoutine.exercises.every(ex => 
    ex.sets.every(s => s.isDone)
  );

  if (!allSetsDone) {
    alert("Error: You have incomplete sets! Check all sets to finish.");
    return;
  }

  if (seconds < 10) {
    alert("You need to work out a bit more to save!");
    return;
  }

    const session = {
      routineName: currentRoutine.name,
      duration: formatTime(seconds),
      totalExercises: currentRoutine.exercises.length,
      exercises: currentRoutine.exercises,
      // Add to session object:
      dateISO: toLocalDateKey(new Date()), // "2024-01-24"
      dateString: new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' }), // "Wednesday January 24"
    };

    finishWorkout(session);
    resetRoutineProgress(id);
    setIsActive(false);
    setSeconds(0);
    setRestState(null);
    alert("Workout saved successfully!");
    router.replace('/'); 
  };

  // From here on the return (Visual Part) starts...

 return (
    <View style={styles.container}>
      {/* header: name and timer */}
    <View style={styles.workoutHeader}>
    <View>
        <Text style={styles.title}>{currentRoutine?.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.timerText}>{formatTime(seconds)}</Text>
        {/* reset 0 */}
        <TouchableOpacity onPress={handleResetTimer} style={{ marginLeft: 15 }}>
            <Ionicons name="refresh-circle" size={30} color="#888" />
        </TouchableOpacity>
        </View>
    </View>
  
  <TouchableOpacity 
    style={[styles.actionBtn, isActive ? styles.stopBtn : styles.startBtn]}
    onPress={() => setIsActive(!isActive)}
  >
    <Ionicons name={isActive ? "pause" : "play"} size={24} color="white" />
    <Text style={styles.btnText}>{isActive ? "Stop" : "Start"}</Text>
  </TouchableOpacity>
</View>
      
      
      <FlatList 
        data={currentRoutine?.exercises || []}
        keyExtractor={(item) => item.workoutId}
        renderItem={({ item }) => (
          <View style={styles.exerciseCard}>
            {/* 1. BAŞLIK: Hareket İsmi ve Silme Butonu */}
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>
                {/* İsmin geldiğinden emin oluyoruz, gelmezse ID basıyoruz ki nerede hata olduğunu görelim */}
                {item.name ? item.name.toUpperCase() : `ID: ${item.workoutId.slice(-4)}`}
              </Text>
              <TouchableOpacity 
                onPress={() => deleteExerciseFromRoutine(id, item.workoutId)}
                style={{ padding: 5 }}
              >
                <Ionicons name="trash-outline" size={20} color="#CF6679" />
              </TouchableOpacity>
            </View>

            {/* 2. SET LIST*/}
            {Array.isArray(item.sets) && item.sets.map((set, index) => {
              const restSeconds = Number(set?.restSeconds ?? 0);
              return (
                <View key={set.id || index.toString()}>
                  {/* Set line*/}
                  <View 
                    style={[
                      styles.setRow, 
                      set.isDone && { backgroundColor: '#1b332b' }
                    ]}
                  >
                    <Text style={styles.setNumber}>{index + 1}</Text>
                    
                    {/* weight */}
                    <View style={styles.setInputGroup}>
                      <TextInput
                        style={styles.setInput}
                        keyboardType="numeric"
                        value={set.weight}
                        placeholder="0"
                        placeholderTextColor="#666"
                        onChangeText={(val) => updateSetData(id, item.workoutId, index, 'weight', val)}
                      />
                      <Text style={styles.unitLabel}>kg</Text>
                    </View>

                    {/* Reps Input */}
                    <View style={styles.setInputGroup}>
                      <TextInput
                        style={styles.setInput}
                        keyboardType="numeric"
                        value={set.reps}
                        placeholder="0"
                        placeholderTextColor="#666"
                        onChangeText={(val) => updateSetData(id, item.workoutId, index, 'reps', val)}
                      />
                      <Text style={styles.unitLabel}>reps</Text>
                    </View>

                    {/* approve icon */}
                    <TouchableOpacity
                      onPress={() => {
                        if (!isActive) {
                          alert('Press Start first to mark sets.');
                          return;
                        }
                        if (isResting) return;

                        const willBecomeDone = !set.isDone;
                        toggleSetStatus(id, item.workoutId, index);
                        if (willBecomeDone && restSeconds > 0) {
                          startRest({ routineId: id, workoutId: item.workoutId, setIndex: index, seconds: restSeconds });
                        }
                      }}
                      style={[styles.checkBtn, (!canMarkSets) && { opacity: 0.35 }]}
                      disabled={!canMarkSets}
                    >
                      <Ionicons
                        name={set.isDone ? 'checkmark-circle' : 'checkmark-circle-outline'}
                        size={26}
                        color={set.isDone ? '#03DAC6' : '#444'}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* Rest row - right below set */}
                  <View style={styles.restRowInline}>
                    <Ionicons name="time-outline" size={14} color="#666" />
                    <Text style={styles.restLabelInline}>Rest:</Text>
                    <Text style={styles.restValueInline}>{restSeconds > 0 ? `${restSeconds}s` : '-'}</Text>
                    <TouchableOpacity
                      style={styles.restBtnSmall}
                      onPress={() => updateSetData(id, item.workoutId, index, 'restSeconds', String(restSeconds + 30))}
                    >
                      <Text style={styles.restBtnTextSmall}>+30</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.restBtnSmall}
                      onPress={() => updateSetData(id, item.workoutId, index, 'restSeconds', String(restSeconds + 60))}
                    >
                      <Text style={styles.restBtnTextSmall}>+60</Text>
                    </TouchableOpacity>
                    {restSeconds > 0 && (
                      <TouchableOpacity
                        style={styles.restBtnSmall}
                        onPress={() => updateSetData(id, item.workoutId, index, 'restSeconds', '0')}
                      >
                        <Ionicons name="close" size={14} color="#CF6679" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}

            {/* 3. adding sets*/}
            <TouchableOpacity 
              style={styles.addSetBtn} 
              onPress={() => addNewSet(id, item.workoutId)}
            >
              <Ionicons name="add" size={16} color="#BB86FC" />
              <Text style={styles.addSetText}>ADD SET</Text>
            </TouchableOpacity>
          </View>
        )}
  // Empty list message
  ListEmptyComponent={() => (
    <Text style={{ color: '#666', textAlign: 'center', marginTop: 50 }}>
      No exercises added yet. Press the + button below!
    </Text>
  )}
  contentContainerStyle={{ paddingBottom: 100 }} // Butonun altında kalmasın
/>

      {/* Active rest overlay */}
      {isResting ? (
        <View style={styles.restOverlay}>
          <View style={styles.restOverlayCard}>
            <Text style={styles.restOverlayTitle}>Rest</Text>
            <Text style={styles.restOverlayTime}>{formatCountdown(restState.remainingSeconds)}</Text>
            <TouchableOpacity
              style={styles.restCancelBtn}
              onPress={cancelRest}
            >
              <Text style={styles.restCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
        
    {isActive || seconds > 0 ? (
        <TouchableOpacity style={styles.finishBtn} onPress={handleFinishWorkout}>
          <Text style={styles.finishBtnText}>FINISH WORKOUT</Text>
        </TouchableOpacity>
      ) : null}

        {!isActive && (
    <TouchableOpacity style={styles.floatingAddBtn} onPress={openModal}>
        <Ionicons name="add" size={30} color="white" />
    </TouchableOpacity>
    )}

      {/* 2. SELECTION MODAL: Exercise Library */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
              <TextInput 
                style={styles.searchBar}
                placeholder="Search exercises..."
                placeholderTextColor="#888"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close-circle" size={32} color="#FF5252" />
              </TouchableOpacity>
          </View>

          <FlatList
              data={filteredExercises}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.apiItem} 
                    onPress={() => {
                      addExerciseToSpecificRoutine(id, item);
                      setModalVisible(false);
                      setSearchQuery('');
                    }}
                  >
                      <View>
                        <Text style={{color: 'white', fontWeight: 'bold'}}>{item.name.toUpperCase()}</Text>
                        <Text style={{color: '#888', fontSize: 12}}>
                          {item.bodyPart} • {(item.primaryMuscles || []).slice(0, 2).join(', ')}
                        </Text>
                      </View>
                      <Ionicons name="add-circle" size={28} color="#BB86FC" />
                  </TouchableOpacity>
              )}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212', padding: 20 },
  title: { color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  floatingAddBtn: { 
    position: 'absolute', bottom: 30, right: 30, backgroundColor: '#BB86FC', 
    width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' 
  },
  modalContainer: { flex: 1, backgroundColor: '#121212', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  searchBar: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    marginRight: 10,
    fontSize: 16,
  },
  apiItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  exerciseCard: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderLeftColor: '#BB86FC',
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333'
  },
  timerText: {
    color: '#BB86FC',
    fontSize: 32,
    fontWeight: '200',
    fontFamily: 'monospace' 
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
  },
  startBtn: { backgroundColor: '#03DAC6' }, 
  stopBtn: { backgroundColor: '#CF6679' },  
  btnText: { color: 'white', fontWeight: 'bold', marginLeft: 8 },
  finishBtn: {
    backgroundColor: '#BB86FC',
    padding: 18,
    borderRadius: 15,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30
  },
  finishBtnText: { color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
  exerciseHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#252525',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  setNumber: { color: '#BB86FC', fontWeight: 'bold', width: 25 },
  setInputGroup: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  setInput: {
    backgroundColor: '#333',
    color: 'white',
    padding: 5,
    borderRadius: 5,
    minWidth: 40,
    textAlign: 'center',
    fontSize: 14,
  },
  unitLabel: { color: '#888', marginLeft: 5, fontSize: 12 },
  checkBtn: {
    padding: 6,
    borderRadius: 10,
  },

  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  restLabel: { color: '#888', fontSize: 12 },
  restControls: { flexDirection: 'row', alignItems: 'center' },
  restValue: { color: '#BB86FC', fontWeight: 'bold', marginRight: 10, minWidth: 44, textAlign: 'right' },
  restBtn: {
    backgroundColor: '#2A1D3D',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  restBtnText: { color: '#BB86FC', fontSize: 12, fontWeight: '800' },
  
  // Inline rest row styles 
  restRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1A1A1A',
    marginBottom: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: -4,
  },
  restLabelInline: {
    color: '#666',
    fontSize: 11,
    marginLeft: 4,
  },
  restValueInline: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
    minWidth: 35,
  },
  restBtnSmall: {
    backgroundColor: '#2A1D3D',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginLeft: 6,
  },
  restBtnTextSmall: {
    color: '#BB86FC',
    fontSize: 10,
    fontWeight: 'bold',
  },

  restOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  restOverlayCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  restOverlayTitle: { color: '#BB86FC', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  restOverlayTime: { color: '#fff', fontSize: 48, fontWeight: '200', marginTop: 10, marginBottom: 14 },
  restCancelBtn: {
    backgroundColor: '#2A1A1A',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  restCancelText: { color: '#CF6679', fontWeight: '800' },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
    borderRadius: 8,
  },
  addSetText: { color: '#BB86FC', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  exerciseName: {
    color: '#BB86FC',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
});
