import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWorkout } from '../../context/WorkoutContext';

export default function ExercisesScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const { library } = useWorkout();

  // Search filter
  const filteredExercises = (library || [])
    .filter((ex) => {
      const name = (ex?.name ?? '').toLowerCase();
      const bodyPart = (ex?.bodyPart ?? '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return name.includes(q) || bodyPart.includes(q);
    })
    .slice()
    .sort((a, b) => {
      const byBody = String(a?.bodyPart ?? '').localeCompare(String(b?.bodyPart ?? ''), 'en', {
        sensitivity: 'base',
      });
      if (byBody !== 0) return byBody;
      return String(a?.name ?? '').localeCompare(String(b?.name ?? ''), 'en', { sensitivity: 'base' });
    });

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercise or muscle group..."
          placeholderTextColor="#666"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconContainer}>
              <Ionicons name="barbell-outline" size={24} color="#BB86FC" />
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{item.name.toUpperCase()}</Text>
              <View style={styles.tagContainer}>
                <Text style={styles.tagText}>{item.bodyPart}</Text>
                <Text style={[styles.tagText, { backgroundColor: '#333' }]}>{item.target}</Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No exercises found matching your search.</Text>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 15,
  },
  searchSection: {
    flexDirection: 'row',
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    alignItems: 'center',
    paddingHorizontal: 15,
    marginBottom: 20,
    marginTop: 10,
    height: 50,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: 'white',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    padding: 15,
    borderRadius: 15,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  iconContainer: {
    width: 50,
    height: 50,
    backgroundColor: '#2A1D3D',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoContainer: {
    flex: 1,
    marginRight: 10,
  },
  name: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 5,
  },
  tagContainer: {
    flexDirection: 'row',
  },
  tagText: {
    color: '#BB86FC',
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
    marginRight: 5,
    textTransform: 'uppercase',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 50,
  },
});