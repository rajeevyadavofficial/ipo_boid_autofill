import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';
import useBoidModal from '../../hooks/useBoidModal';
import BoidListItem from './BoidListItem';
import BoidModalTopBar from './BoidModalTopBar';
import BoidModalForm from './BoidModalForm';
import GoogleSignIn from '../GoogleSignIn';
import Toast from 'react-native-toast-message';

export default function BoidModal({
  visible,
  setVisible,
  boidInput,
  nicknameInput,
  setBoidInput,
  setNicknameInput,
  savedBoids,
  setSavedBoids,
  editIndex,
  setEditIndex,
  saveBoidsToStorage,
  resetForm,
  webViewRef,
  setResults,
  setCurrentCheckingBoid,
}) {
  const {
    showForm,
    setShowForm,
    saveOrUpdateBoid,
    checkBoidResult,
    deleteBoid,
    startEdit,
  } = useBoidModal({
    visible,
    boidInput,
    nicknameInput,
    setBoidInput,
    setNicknameInput,
    savedBoids,
    setSavedBoids,
    editIndex,
    setEditIndex,
    saveBoidsToStorage,
    resetForm,
    webViewRef,
    setVisible,
    setResults,
    setCurrentCheckingBoid,
  });

  // --- Clear All with PIN ---
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleClearAll = () => {
    if (savedBoids.length === 0) {
      Toast.show({ type: 'info', text1: 'No BOIDs to clear' });
      return;
    }
    setPinInput('');
    setPinError('');
    setShowPinModal(true);
  };

  const confirmClearAll = () => {
    if (pinInput === '1234') {
      saveBoidsToStorage([]);
      setShowPinModal(false);
      Toast.show({ type: 'success', text1: '✅ All BOIDs cleared!' });
    } else {
      setPinError('❌ Incorrect PIN. Please try again.');
    }
  };

  const renderItem = ({ item, index }) => {
    if (!item || !item.boid) return null;
    return (
      <BoidListItem
        item={item}
        index={index}
        fillBoid={checkBoidResult}
        deleteBoid={deleteBoid}
        startEdit={startEdit}
      />
    );
  };

  const safeSavedBoids = Array.isArray(savedBoids) 
    ? savedBoids.filter(item => item && typeof item === 'object' && item.boid)
    : [];

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent>
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPressOut={() => {
            setVisible(false);
            resetForm();
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalContent}
            onPress={() => {}}
          >
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#6200EE' }}>BOID Manager</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Manage your saved BOIDs</Text>
              </View>
              <TouchableOpacity 
                onPress={() => {
                  setVisible(false);
                  resetForm();
                }}
                style={{ padding: 10, backgroundColor: '#FFEBEE', borderRadius: 20 }}
              >
                <Ionicons name="close" size={24} color="#F44336" />
              </TouchableOpacity>
            </View>

            <BoidModalTopBar
              showForm={showForm}
              setShowForm={setShowForm}
            />

            <ScrollView 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 30 }}
            >
              {/* Input Form */}
              {showForm && (
                <BoidModalForm
                  boidInput={boidInput}
                  nicknameInput={nicknameInput}
                  setBoidInput={setBoidInput}
                  setNicknameInput={setNicknameInput}
                  saveOrUpdateBoid={saveOrUpdateBoid}
                  editIndex={editIndex}
                />
              )}

              {/* List of Saved BOIDs */}
              <FlatList
                data={safeSavedBoids}
                keyExtractor={(_, index) => index.toString()}
                renderItem={renderItem}
                scrollEnabled={false}
              />

              {/* Empty state */}
              {safeSavedBoids.length === 0 && (
                <View style={{ alignItems: 'center', marginTop: 30, opacity: 0.5 }}>
                  <Ionicons name="people-outline" size={48} color="#999" />
                  <Text style={{ color: '#999', marginTop: 10 }}>No BOIDs saved yet. Tap "+ Add BOID" to start.</Text>
                </View>
              )}

              {/* Clear All Button */}
              <TouchableOpacity
                onPress={handleClearAll}
                style={localStyles.clearAllButton}
              >
                <Ionicons name="trash-bin-outline" size={18} color="#F44336" />
                <Text style={localStyles.clearAllText}>Clear All BOIDs</Text>
              </TouchableOpacity>

              {/* Google Sign-In for Cloud Backup */}
              <GoogleSignIn 
                onSignInSuccess={(user, boidList) => {
                  if (boidList) {
                    setSavedBoids(boidList);
                  }
                }}
              />
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* PIN Confirmation Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={localStyles.pinOverlay}>
          <View style={localStyles.pinBox}>
            <Text style={localStyles.pinTitle}>🔒 Confirm Clear All</Text>
            <Text style={localStyles.pinSubtitle}>Enter PIN to delete all {savedBoids.length} saved BOIDs.</Text>
            <TextInput
              style={localStyles.pinInput}
              value={pinInput}
              onChangeText={text => { setPinInput(text); setPinError(''); }}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={4}
              placeholder="Enter PIN"
              placeholderTextColor="#aaa"
              autoFocus
            />
            {pinError ? <Text style={localStyles.pinError}>{pinError}</Text> : null}
            <View style={{ flexDirection: 'row', marginTop: 16, gap: 10 }}>
              <TouchableOpacity
                style={[localStyles.pinBtn, { backgroundColor: '#eee' }]}
                onPress={() => setShowPinModal(false)}
              >
                <Text style={{ color: '#333', fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.pinBtn, { backgroundColor: '#F44336' }]}
                onPress={confirmClearAll}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const localStyles = StyleSheet.create({
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F44336',
    backgroundColor: '#FFF8F8',
    gap: 8,
  },
  clearAllText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 14,
  },
  pinOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    elevation: 10,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    color: '#333',
  },
  pinError: {
    color: '#F44336',
    fontSize: 12,
    marginTop: 8,
  },
  pinBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
});
