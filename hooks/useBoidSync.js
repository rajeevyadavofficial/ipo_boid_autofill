import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

const API_URL = 'https://ipo-backend-d8nv.onrender.com/api';

export const useBoidSync = () => {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState(null);

  // Encrypt BOID data using AES-256
  const encryptBoidData = (boidList, googleId) => {
    try {
      const jsonString = JSON.stringify(boidList);
      const encrypted = CryptoJS.AES.encrypt(jsonString, googleId).toString();
      return encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw error;
    }
  };

  // Decrypt BOID data
  const decryptBoidData = (encryptedData, googleId) => {
    try {
      const decrypted = CryptoJS.AES.decrypt(encryptedData, googleId);
      const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Decryption error:', error);
      return [];
    }
  };

  // Merge local and cloud BOID data (avoid duplicates)
  const mergeBoidData = (localBoids, cloudBoids) => {
    const merged = [...cloudBoids];
    
    localBoids.forEach(localBoid => {
      const exists = merged.some(b => b.boidNumber === localBoid.boidNumber);
      if (!exists) {
        merged.push(localBoid);
      }
    });
    
    return merged;
  };

  // Sync BOID data to cloud
  const syncToCloud = useCallback(async (boidList, googleId) => {
    try {
      setSyncing(true);
      setSyncError(null);

      const encryptedData = encryptBoidData(boidList, googleId);

      const response = await fetch(`${API_URL}/boid/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleId, encryptedBoidData: encryptedData })
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      console.log('✅ BOID data synced to cloud');
      return { success: true, lastSynced: data.lastSynced };
    } catch (error) {
      console.error('Sync to cloud error:', error);
      setSyncError(error.message);
      return { success: false, error: error.message };
    } finally {
      setSyncing(false);
    }
  }, []);

  // Sync BOID data from cloud
  const syncFromCloud = useCallback(async (googleId) => {
    try {
      setSyncing(true);
      setSyncError(null);

      const response = await fetch(`${API_URL}/boid/sync?googleId=${googleId}`);
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Sync failed');
      }

      if (!data.encryptedBoidData) {
        console.log('No cloud data found');
        return { success: true, boidList: [] };
      }

      const decryptedBoids = decryptBoidData(data.encryptedBoidData, googleId);
      console.log('✅ BOID data synced from cloud');
      
      return { success: true, boidList: decryptedBoids, lastSynced: data.lastSynced };
    } catch (error) {
      console.error('Sync from cloud error:', error);
      setSyncError(error.message);
      return { success: false, error: error.message, boidList: [] };
    } finally {
      setSyncing(false);
    }
  }, []);

  // Full sync: merge local and cloud, then upload
  const fullSync = useCallback(async (googleId) => {
    try {
      // Get local BOIDs
      const localData = await AsyncStorage.getItem('boidList');
      const localBoids = localData ? JSON.parse(localData) : [];

      // Get cloud BOIDs
      const cloudResult = await syncFromCloud(googleId);
      
      if (!cloudResult.success) {
        return cloudResult;
      }

      // Merge
      const mergedBoids = mergeBoidData(localBoids, cloudResult.boidList);

      // Save merged data locally
      await AsyncStorage.setItem('boidList', JSON.stringify(mergedBoids));

      // Upload merged data to cloud
      const uploadResult = await syncToCloud(mergedBoids, googleId);

      return {
        success: uploadResult.success,
        boidList: mergedBoids,
        merged: mergedBoids.length !== localBoids.length
      };
    } catch (error) {
      console.error('Full sync error:', error);
      return { success: false, error: error.message };
    }
  }, [syncFromCloud, syncToCloud]);

  return {
    syncing,
    syncError,
    syncToCloud,
    syncFromCloud,
    fullSync,
    encryptBoidData,
    decryptBoidData,
    mergeBoidData
  };
};
