import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ToastAndroid,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';
import useBoidModal from '../../hooks/useBoidModal';
import BoidListItem from './BoidListItem';
import BoidModalTopBar from './BoidModalTopBar';
import BoidModalFooter from './BoidModalFooter';
import BoidModalForm from './BoidModalForm';
import BoidModalResultMessage from './BoidModalResultMessage';
import GoogleSignIn from '../GoogleSignIn';
import BulkCheckPanel from './BulkCheckPanel';

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
  results,
  setResults,
  setCurrentCheckingBoid,
  ipoName, 
  onWebViewMessage, // Message bridge
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

  const [panelMode, setPanelMode] = React.useState('selection');
  const [isMinimized, setIsMinimized] = React.useState(false); 
  const [autoCheckBoid, setAutoCheckBoid] = React.useState(null);

  const renderItem = ({ item, index }) => {
    if (!item || !item.boid) return null; // Safety check
    const match = Array.isArray(results) ? results.find((r) => r?.boid === item.boid) : undefined;
    
    return (
      <BoidListItem
        item={item}
        index={index}
        result={match?.result}
        fillBoid={checkBoidResult}
        autoCheck={(boid) => setAutoCheckBoid(boid)} // Single Auto Check
        deleteBoid={deleteBoid}
        startEdit={startEdit}
      />
    );
  };

  // Safety check: ensure savedBoids is always a valid array of objects
  const safeSavedBoids = Array.isArray(savedBoids) 
    ? savedBoids.filter(item => item && typeof item === 'object' && item.boid)
    : [];

  const total = safeSavedBoids.length;
  const allotted = Array.isArray(results) ? results.filter((r) =>
    typeof r?.result === 'string' && r.result.toLowerCase().includes('congrat')
  ).length : 0;

  const isChecking = panelMode === 'checking';

  // Minimize view: Only a small floating button at the bottom
  if (isMinimized && visible) {
    return (
      <Modal visible={visible} animationType="none" transparent>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' }} pointerEvents="box-none">
          <TouchableOpacity 
            style={{ 
              backgroundColor: '#6200EE', 
              paddingHorizontal: 20,
              paddingVertical: 12,
              margin: 20, 
              borderRadius: 30, 
              flexDirection: 'row', 
              alignItems: 'center', 
              justifyContent: 'center',
              elevation: 8,
              alignSelf: 'center'
            }}
            onPress={() => setIsMinimized(false)}
          >
            <Ionicons name="expand" size={20} color="white" />
            <Text style={{ color: 'white', fontWeight: 'bold', marginLeft: 8 }}>Resume Bulk Check</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
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
          {/* Top Bar with Minimize Toggle */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <BoidModalTopBar
                showForm={showForm}
                setShowForm={setShowForm}
                setResults={setResults}
              />
            </View>
            <TouchableOpacity 
              onPress={() => setIsMinimized(true)}
              style={{ padding: 8, marginLeft: 10 }}
            >
              <Ionicons name="contract" size={24} color="#6200EE" />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 30 }}
          >
            {/* Congratulation or Sorry Message */}
            {!isChecking && (
              <BoidModalResultMessage results={results} total={total} />
            )}

            {/* Bulk Check Panel */}
            <BulkCheckPanel 
              savedBoids={safeSavedBoids}
              ipoName={ipoName}
              webViewRef={webViewRef}
              visible={visible}
              results={results}
              setResults={setResults}
              onModeChange={setPanelMode}
              onWebViewMessage={onWebViewMessage}
              autoCheckBoid={autoCheckBoid}
              onAutoCheckComplete={() => setAutoCheckBoid(null)}
            />
            
            {/* 
            <View style={{ padding: 10, backgroundColor: '#FFF3E0', marginBottom: 10, borderRadius: 5 }}>
                 <Text style={{ textAlign: 'center', color: '#E65100' }}>⚠️ Bulk Check & Google Sign-In Disabled for Debugging</Text>
            </View>
            */}

            {/* Existing Features Section */}
            {!isChecking && (
              <View>
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

                {/* Google Sign-In for Cloud Backup */}
                <GoogleSignIn 
                  onSignInSuccess={(user, boidList) => {
                    if (boidList) {
                      setSavedBoids(boidList);
                    }
                  }}
                />
              </View>
            )}

            {/* Footer / Developer Info */}
            <BoidModalFooter />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
