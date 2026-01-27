import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const { signIn, signUp, signInAsGuest } = useAuth();

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const result = isSignUp 
      ? await signUp(email, password) 
      : await signIn(email, password);

    if (!result.success) {
      Alert.alert('Error', result.error);
    }
  };

  const handleGuestLogin = async () => {
    const result = await signInAsGuest();
    if (!result.success) {
      Alert.alert('Error', 'Guest login failed');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Ionicons name="barbell" size={80} color="#BB86FC" style={styles.logo} />
        <Text style={styles.title}>Workout Tracker</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? 'Create Account' : 'Sign In'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleAuth}>
          <Text style={styles.buttonText}>
            {isSignUp ? 'SIGN UP' : 'SIGN IN'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switchText}>
            {isSignUp 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.guestButton} onPress={handleGuestLogin}>
          <Ionicons name="person-outline" size={20} color="#666" />
          <Text style={styles.guestButtonText}>CONTINUE AS GUEST</Text>
        </TouchableOpacity>

        <Text style={styles.infoText}>
          In guest mode, your data is stored only on this device
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, justifyContent: 'center', padding: 30 },
  logo: { alignSelf: 'center', marginBottom: 20 },
  title: { color: '#BB86FC', fontSize: 32, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: 'white', fontSize: 20, textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: '#1E1E1E',
    color: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#BB86FC',
    padding: 18,
    borderRadius: 10,
    marginTop: 10,
  },
  buttonText: { color: 'white', fontSize: 16, fontWeight: 'bold', textAlign: 'center', letterSpacing: 1 },
  switchText: { color: '#BB86FC', textAlign: 'center', marginTop: 20, fontSize: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 30 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#333' },
  dividerText: { color: '#666', marginHorizontal: 10, fontSize: 12 },
  guestButton: {
    backgroundColor: '#1E1E1E',
    padding: 18,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  guestButtonText: { color: '#666', fontSize: 14, fontWeight: 'bold', marginLeft: 10, letterSpacing: 1 },
  infoText: { color: '#444', fontSize: 11, textAlign: 'center', marginTop: 15 },
});
