import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, Platform } from 'react-native';
let GoogleSignin;
if (Platform.OS !== 'web') {
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
}
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getApiBaseUrl } from '../utils/config';
import { COLORS } from '../utils/theme';

export default function GoogleSignIn({ onSignInSuccess, onSignOut, buttonText = 'Sign in with Google to backup accounts' }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const API_URL = getApiBaseUrl();

  useEffect(() => {
    if (Platform.OS === 'web') return;
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
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        onSignInSuccess?.(parsedUser);
      }
    } catch (error) {
      console.error('Error checking sign-in status:', error);
    }
  };

  const handleSignIn = async () => {
    if (Platform.OS === 'web') {
      alert('Google Sign-In is only available on mobile devices.');
      return;
    }
    try {
      setLoading(true);
      
      // Check if Google Play Services are available
      await GoogleSignin.hasPlayServices();
      
      // Sign in
      await GoogleSignin.signIn();
      
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

      // Account Manager handles the explicit backup action after sign-in
      if (onSignInSuccess) {
        onSignInSuccess(userData);
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
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut();
      }
      await AsyncStorage.removeItem('googleUser');
      setUser(null);
      if (onSignOut) {
        onSignOut();
      }
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#4285F4" />
        <Text style={styles.loadingText}>Signing in...</Text>
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
      <Text style={styles.signInText}>{buttonText}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    marginTop: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: COLORS.mutedText,
  },
  signInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.text,
    fontWeight: '500',
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
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
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 2,
  },
  signOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  signOutText: {
    fontSize: 12,
    color: COLORS.text,
  },
});
