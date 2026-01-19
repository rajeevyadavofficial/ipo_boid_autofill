import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, ToastAndroid } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBoidSync } from '../hooks/useBoidSync';

import { getApiBaseUrl } from '../utils/config';

export default function GoogleSignIn({ onSignInSuccess }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const { fullSync, syncing } = useBoidSync();
  
  const API_URL = getApiBaseUrl();

  useEffect(() => {
    // Configure Google Sign-In
    GoogleSignin.configure({
      webClientId: '1029543580064-0tp9epc16rki3fdms3tl1kj8cg96u5h3.apps.googleusercontent.com',
      offlineAccess: true,
    });

    // Check if user is already signed in
    checkSignInStatus();
  }, []);

  const checkSignInStatus = async () => {
    try {
      const userData = await AsyncStorage.getItem('googleUser');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error checking sign-in status:', error);
    }
  };

  const handleSignIn = async () => {
    try {
      setLoading(true);
      
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Sign in
      const userInfo = await GoogleSignin.signIn();
      
      // Get ID token
      const tokens = await GoogleSignin.getTokens();
      
      // Verify with backend
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: tokens.idToken })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Save user data
      const userData = {
        googleId: data.user.googleId,
        email: data.user.email,
        name: data.user.name,
        photoUrl: data.user.photoUrl
      };

      await AsyncStorage.setItem('googleUser', JSON.stringify(userData));
      setUser(userData);

      // Perform full sync
      const syncResult = await fullSync(userData.googleId);

      if (onSignInSuccess) {
        onSignInSuccess(userData, syncResult.boidList);
      }

      console.log('✅ Signed in successfully');
    } catch (error) {
      console.error('Sign-in error:', error);
      const errorMessage = error.message || JSON.stringify(error);
      alert(`Sign-in failed: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      await AsyncStorage.removeItem('googleUser');
      setUser(null);
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading || syncing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#4285F4" />
        <Text style={styles.loadingText}>
          {syncing ? 'Syncing BOIDs...' : 'Signing in...'}
        </Text>
      </View>
    );
  }

  if (user) {
    return (
      <View style={styles.userContainer}>
        <Image 
          source={{ uri: user.photoUrl }} 
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userEmail}>{user.email}</Text>
        </View>
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.signInButton} 
      onPress={handleSignIn}
      disabled={loading}
    >
      <Image 
        source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
        style={styles.googleLogo}
      />
      <Text style={styles.signInText}>Sign in with Google to backup BOIDs</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#5F6368',
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DADCE0',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  googleLogo: {
    width: 20,
    height: 20,
    marginRight: 12,
  },
  signInText: {
    fontSize: 14,
    color: '#3C4043',
    fontWeight: '500',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#202124',
  },
  userEmail: {
    fontSize: 12,
    color: '#5F6368',
    marginTop: 2,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#DADCE0',
  },
  signOutText: {
    fontSize: 12,
    color: '#5F6368',
  },
});
