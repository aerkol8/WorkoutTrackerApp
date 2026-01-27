import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../../context/WorkoutContext';

export default function WorkoutSelector() {
  const { routines, addRoutine, deleteRoutine } = useWorkout();
  const [modalVisible, setModalVisible] = useState(false);
  const [routineName, setRoutineName] = useState('');
  const router = useRouter();

  const handleCreate = () => {
    if (routineName.trim()) {
      addRoutine(routineName);
      setRoutineName('');
      setModalVisible(false);
    }
  };
  return (
    <View style={styles.container}>
      <FlatList
        data={routines}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.routineCard} 
            onPress={() => router.push(`/routine/${item.id}`)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.routineName}>{item.name}</Text>
              <Text style={styles.exerciseCount}>{item.exercises.length} Exercises</Text>
            </View>

            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Delete Workout Day',
                  `Delete ${item.name}?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => deleteRoutine(item.id) },
                  ]
                );
              }}
              style={styles.deleteBtn}
            >
              <Ionicons name="trash-outline" size={20} color="#CF6679" />
            </TouchableOpacity>

            <Ionicons name="chevron-forward" size={24} color="#BB86FC" />
          </TouchableOpacity>
        )}
      />

      {/* FAB Button */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Ionicons name="add" size={35} color="white" />
      </TouchableOpacity>

      {/* New Template Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Workout Day</Text>
            <TextInput
              style={styles.input}
              placeholder="E.g., Push Day, Leg Day..."
              placeholderTextColor="#888"
              value={routineName}
              onChangeText={setRoutineName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCreate} style={styles.createBtn}>
                <Text style={styles.createBtnText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  routineCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  exerciseCount: {
    color: '#888',
  },
  deleteBtn: {
    padding: 10,
    marginRight: 10,
    backgroundColor: '#2A1A1A',
    borderRadius: 10,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 30,
    backgroundColor: '#BB86FC',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    padding: 25,
    borderRadius: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#333',
    color: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    marginRight: 20,
  },
  createBtn: {
    backgroundColor: '#BB86FC',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  createBtnText: {
    color: 'white',
    fontWeight: 'bold',
  },
});