import React, { useState } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, Alert, 
  TextInput, Modal, ScrollView, KeyboardAvoidingView, Platform
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { signOut, user, isGuest } = useAuth();
  const { 
    profile, 
    measurements, 
    updateProfile, 
    addMeasurement, 
    deleteMeasurement,
    getLatestMeasurement,
    getBFPChange
  } = useProfile();
  const router = useRouter();

  const [showMeasurementModal, setShowMeasurementModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [waist, setWaist] = useState('');
  const [neck, setNeck] = useState('');
  const [hip, setHip] = useState('');
  const [tempHeight, setTempHeight] = useState(profile.height?.toString() || '');
  const [tempGender, setTempGender] = useState(profile.gender || 'male');

  const latestMeasurement = getLatestMeasurement();
  const bfpChange = getBFPChange();

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive', 
          onPress: async () => {
            await signOut();
            router.replace('/login');
          }
        },
      ]
    );
  };

  const handleSaveSettings = () => {
    if (!tempHeight || parseFloat(tempHeight) < 100 || parseFloat(tempHeight) > 250) {
      Alert.alert('Error', 'Please enter a valid height (100-250 cm)');
      return;
    }
    updateProfile({ height: tempHeight, gender: tempGender });
    setShowSettingsModal(false);
    Alert.alert('Success', 'Settings saved');
  };

  const handleAddMeasurement = () => {
    if (!profile.height) {
      Alert.alert('Error', 'Please set your height in settings first');
      return;
    }

    if (!waist || !neck) {
      Alert.alert('Error', 'Waist and neck measurements are required');
      return;
    }

    if (profile.gender === 'female' && !hip) {
      Alert.alert('Error', 'Hip measurement is required for women');
      return;
    }

    const result = addMeasurement(waist, neck, hip);
    
    if (result.success) {
      Alert.alert('Success', `Body Fat: ${result.bfp}%`);
      setShowMeasurementModal(false);
      setWaist('');
      setNeck('');
      setHip('');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleDeleteMeasurement = (id) => {
    Alert.alert(
      'Delete Measurement',
      'Are you sure you want to delete this record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMeasurement(id) }
      ]
    );
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getBFPCategory = (bfp, gender) => {
    if (gender === 'male') {
      if (bfp < 6) return { label: 'Essential', color: '#FF6B6B' };
      if (bfp < 14) return { label: 'Athletic', color: '#4ECDC4' };
      if (bfp < 18) return { label: 'Fitness', color: '#45B7D1' };
      if (bfp < 25) return { label: 'Average', color: '#96CEB4' };
      return { label: 'Obese', color: '#CF6679' };
    } else {
      if (bfp < 14) return { label: 'Essential', color: '#FF6B6B' };
      if (bfp < 21) return { label: 'Athletic', color: '#4ECDC4' };
      if (bfp < 25) return { label: 'Fitness', color: '#45B7D1' };
      if (bfp < 32) return { label: 'Average', color: '#96CEB4' };
      return { label: 'Obese', color: '#CF6679' };
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Ionicons 
          name={isGuest ? "person-outline" : "person-circle"} 
          size={60} 
          color="#BB86FC" 
          style={styles.avatar}
        />
        
        <Text style={styles.userType}>
          {isGuest ? 'Guest Mode' : 'Registered User'}
        </Text>
        
        {!isGuest && user?.email && (
          <Text style={styles.email}>{user.email}</Text>
        )}

        {isGuest && (
          <Text style={styles.guestInfo}>
            Your data is stored only on this device
          </Text>
        )}
      </View>

      {/* Body Fat Card */}
      <View style={styles.bfpCard}>
        <View style={styles.bfpHeader}>
          <Text style={styles.bfpTitle}>Body Fat %</Text>
          <TouchableOpacity 
            style={styles.addMeasurementBtn}
            onPress={() => setShowMeasurementModal(true)}
          >
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.addMeasurementText}>New</Text>
          </TouchableOpacity>
        </View>

        {latestMeasurement ? (
          <View style={styles.bfpContent}>
            <View style={styles.bfpMainRow}>
              <Text style={styles.bfpValue}>{latestMeasurement.bfp}%</Text>
              {bfpChange !== null && (
                <View style={[styles.bfpChangeBadge, { backgroundColor: bfpChange > 0 ? '#CF667933' : '#4ECDC433' }]}>
                  <Ionicons 
                    name={bfpChange > 0 ? 'arrow-up' : 'arrow-down'} 
                    size={14} 
                    color={bfpChange > 0 ? '#CF6679' : '#4ECDC4'} 
                  />
                  <Text style={[styles.bfpChangeText, { color: bfpChange > 0 ? '#CF6679' : '#4ECDC4' }]}>
                    {Math.abs(bfpChange)}%
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.bfpCategoryRow}>
              <View style={[styles.categoryBadge, { backgroundColor: getBFPCategory(latestMeasurement.bfp, latestMeasurement.gender).color + '33' }]}>
                <Text style={[styles.categoryText, { color: getBFPCategory(latestMeasurement.bfp, latestMeasurement.gender).color }]}>
                  {getBFPCategory(latestMeasurement.bfp, latestMeasurement.gender).label}
                </Text>
              </View>
              <Text style={styles.bfpDate}>{formatDate(latestMeasurement.date)}</Text>
            </View>
          </View>
        ) : (
          <View style={styles.emptyBfp}>
            <Ionicons name="body-outline" size={40} color="#444" />
            <Text style={styles.emptyBfpText}>No measurements yet</Text>
            <Text style={styles.emptyBfpSubtext}>
              Tap "New" to record your body measurements
            </Text>
          </View>
        )}
      </View>

      {/* Measurement History */}
      {measurements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEASUREMENT HISTORY</Text>
          {measurements.slice(0, 10).map((m, index) => {
            const category = getBFPCategory(m.bfp, m.gender);
            return (
              <TouchableOpacity 
                key={m.id} 
                style={styles.historyItem}
                onLongPress={() => handleDeleteMeasurement(m.id)}
              >
                <View style={styles.historyLeft}>
                  <Text style={styles.historyDate}>{formatDate(m.date)}</Text>
                  <Text style={styles.historyDetails}>
                    Waist: {m.waist}cm • Neck: {m.neck}cm
                    {m.hip ? ` • Hip: ${m.hip}cm` : ''}
                  </Text>
                </View>
                <View style={styles.historyRight}>
                  <Text style={[styles.historyBfp, { color: category.color }]}>{m.bfp}%</Text>
                  {index < measurements.length - 1 && (
                    <Text style={styles.historyChange}>
                      {m.bfp > measurements[index + 1].bfp ? '↑' : m.bfp < measurements[index + 1].bfp ? '↓' : '='}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.historyHint}>Long press to delete</Text>
        </View>
      )}

      {/* Settings Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SETTINGS</Text>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={() => {
            setTempHeight(profile.height?.toString() || '');
            setTempGender(profile.gender || 'male');
            setShowSettingsModal(true);
          }}
        >
          <Ionicons name="body-outline" size={24} color="#BB86FC" />
          <View style={styles.menuTextContainer}>
            <Text style={styles.menuText}>Body Settings</Text>
            <Text style={styles.menuSubtext}>
              {profile.height ? `${profile.height}cm • ${profile.gender === 'male' ? 'Male' : 'Female'}` : 'Not set'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ACCOUNT</Text>
        
        <TouchableOpacity 
          style={styles.menuItem}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={24} color="#CF6679" />
          <Text style={[styles.menuText, { marginLeft: 15, flex: 1 }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={24} color="#666" />
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ABOUT</Text>
        
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Version</Text>
          <Text style={styles.infoValue}>1.0.0</Text>
        </View>
      </View>

      <View style={{ height: 50 }} />

      {/* Measurement Modal */}
      <Modal visible={showMeasurementModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Measurement</Text>
            <TouchableOpacity onPress={() => setShowMeasurementModal(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.measurementInfo}>
              📏 Measure in the morning, relaxed, without clothes
            </Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Waist (cm) *</Text>
              <Text style={styles.inputHint}>Measure at navel level</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 85"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={waist}
                onChangeText={setWaist}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Neck (cm) *</Text>
              <Text style={styles.inputHint}>Measure below Adam's apple</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 38"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={neck}
                onChangeText={setNeck}
              />
            </View>

            {profile.gender === 'female' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Hip (cm) *</Text>
                <Text style={styles.inputHint}>Measure at widest point</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 95"
                  placeholderTextColor="#666"
                  keyboardType="numeric"
                  value={hip}
                  onChangeText={setHip}
                />
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleAddMeasurement}>
              <Text style={styles.saveBtnText}>Calculate & Save</Text>
            </TouchableOpacity>

            <Text style={styles.formulaNote}>
              Using US Navy body fat formula
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettingsModal} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Body Settings</Text>
            <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
              <Ionicons name="close-circle" size={32} color="#CF6679" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Height (cm)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., 175"
                placeholderTextColor="#666"
                keyboardType="numeric"
                value={tempHeight}
                onChangeText={setTempHeight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Gender</Text>
              <View style={styles.genderRow}>
                <TouchableOpacity 
                  style={[styles.genderBtn, tempGender === 'male' && styles.genderBtnActive]}
                  onPress={() => setTempGender('male')}
                >
                  <Ionicons name="male" size={24} color={tempGender === 'male' ? '#fff' : '#888'} />
                  <Text style={[styles.genderText, tempGender === 'male' && styles.genderTextActive]}>Male</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.genderBtn, tempGender === 'female' && styles.genderBtnActive]}
                  onPress={() => setTempGender('female')}
                >
                  <Ionicons name="female" size={24} color={tempGender === 'female' ? '#fff' : '#888'} />
                  <Text style={[styles.genderText, tempGender === 'female' && styles.genderTextActive]}>Female</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSettings}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212', 
    padding: 20 
  },
  profileCard: {
    backgroundColor: '#1E1E1E',
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  avatar: {
    marginBottom: 12,
  },
  userType: {
    color: '#BB86FC',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  email: {
    color: '#ccc',
    fontSize: 13,
    marginBottom: 8,
  },
  guestInfo: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // BFP Card
  bfpCard: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  bfpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  bfpTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  addMeasurementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#BB86FC',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  addMeasurementText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  bfpContent: {
    alignItems: 'center',
  },
  bfpMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bfpValue: {
    color: '#BB86FC',
    fontSize: 48,
    fontWeight: 'bold',
  },
  bfpChangeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 2,
  },
  bfpChangeText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  bfpCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  categoryBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  bfpDate: {
    color: '#666',
    fontSize: 12,
  },
  emptyBfp: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyBfpText: {
    color: '#666',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptyBfpSubtext: {
    color: '#444',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },

  // History
  historyItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  historyLeft: {
    flex: 1,
  },
  historyDate: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  historyDetails: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  historyRight: {
    alignItems: 'flex-end',
  },
  historyBfp: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyChange: {
    color: '#666',
    fontSize: 12,
  },
  historyHint: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 5,
    fontStyle: 'italic',
  },

  // Section
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#BB86FC',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 12,
    letterSpacing: 1,
  },
  menuItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  menuTextContainer: {
    flex: 1,
    marginLeft: 15,
  },
  menuText: {
    color: 'white',
    fontSize: 15,
  },
  menuSubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  infoItem: {
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  infoValue: {
    color: '#BB86FC',
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Modal
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
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
  },
  measurementInfo: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  inputHint: {
    color: '#666',
    fontSize: 11,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E1E1E',
    color: '#fff',
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  genderRow: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 8,
  },
  genderBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E1E1E',
    padding: 15,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  genderBtnActive: {
    backgroundColor: '#BB86FC',
    borderColor: '#BB86FC',
  },
  genderText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#fff',
  },
  saveBtn: {
    backgroundColor: '#BB86FC',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  formulaNote: {
    color: '#444',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 15,
    fontStyle: 'italic',
  },
});
