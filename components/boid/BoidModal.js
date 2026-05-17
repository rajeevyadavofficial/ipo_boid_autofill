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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import styles from '../../styles/styles';
import useBoidModal from '../../hooks/useBoidModal';
import BoidListItem from './BoidListItem';
import BoidModalTopBar from './BoidModalTopBar';
import BoidModalForm from './BoidModalForm';
import Toast from 'react-native-toast-message';
import { COLORS } from '../../utils/theme';

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
  onOpenMerShareAccounts,
  onOpenBulkApply,
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
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
        <View style={{ flex: 1, padding: 16 }}>


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
                  <Ionicons name="people-outline" size={48} color={COLORS.accent} />
                  <Text style={{ color: COLORS.mutedText, marginTop: 10 }}>No BOIDs saved yet. Tap "+ Add BOID" to start.</Text>
                </View>
              )}

              {/* Clear All Button */}
              <TouchableOpacity
                onPress={handleClearAll}
                style={localStyles.clearAllButton}
              >
                <Ionicons name="trash-bin-outline" size={18} color={COLORS.text} />
                <Text style={localStyles.clearAllText}>Clear All BOIDs</Text>
              </TouchableOpacity>

            </ScrollView>
        </View>
      </View>

      {/* PIN Confirmation Modal */}
      <Modal
        visible={showPinModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
      >
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
                style={[localStyles.pinBtn, { backgroundColor: COLORS.surface }]}
                onPress={() => setShowPinModal(false)}
              >
                <Text style={{ color: COLORS.text, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[localStyles.pinBtn, { backgroundColor: COLORS.accent }]}
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
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  clearAllText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  meroShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    gap: 8,
  },
  meroShareText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 14,
  },
  pinOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pinBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    width: '80%',
    alignItems: 'center',
    elevation: 10,
  },
  pinTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  pinSubtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    width: '100%',
    fontSize: 18,
    textAlign: 'center',
    letterSpacing: 8,
    color: COLORS.text,
  },
  pinError: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 8,
  },
  pinBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  bulkApplyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
    gap: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  bulkApplyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
