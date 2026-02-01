import React, { createContext, useState, useContext, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { auth } from '../config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // Firebase user
  const [isGuest, setIsGuest] = useState(false); // Guest mode
  const [loading, setLoading] = useState(true); // Is loading?

  // Check user status when app opens
  useEffect(() => {
    let unsubscribe;
    const checkAuthStatus = async () => {
      try {
        // Check guest mode first
        const guestMode = await AsyncStorage.getItem('@guestMode');
        if (guestMode === 'true') {
          setIsGuest(true);
          setUser(null);
          setLoading(false);
          return;
        }

        // Firebase auth durumunu dinle
          unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
          if (firebaseUser) {
            setUser(firebaseUser);
            setIsGuest(false);
          } else {
            setUser(null);
          }
          setLoading(false);
        });

      } catch (error) {
        console.error('Auth check error:', error);
        setLoading(false);
      }

      checkAuthStatus();

        return ()=> {
          if(typeof unsubscribe ==='function')
                unsubscribe();
        };
    };

  }, []);

  // Sign in with email
  const signIn = async (email, password) => {
    try {
      await AsyncStorage.removeItem('@guestMode');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Sign up with email
  const signUp = async (email, password) => {
    try {
      await AsyncStorage.removeItem('@guestMode');
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      setUser(userCredential.user);
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Sign in as guest
  const signInAsGuest = async () => {
    try {
      await AsyncStorage.setItem('@guestMode', 'true');
      setIsGuest(true);
      setUser(null);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      if (!isGuest) {
        await firebaseSignOut(auth);
      }
      await AsyncStorage.removeItem('@guestMode');
      setUser(null);
      setIsGuest(false);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isGuest,
      loading,
      signIn,
      signUp,
      signInAsGuest,
      signOut,
      isAuthenticated: user !== null || isGuest
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
