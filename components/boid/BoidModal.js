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
  const [useAiModel, setUseAiModel] = React.useState(true);
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
        autoCheck={(item) => setAutoCheckBoid(item)} // Single Auto Check
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
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#6200EE' }}>BOID Manager</Text>
              <Text style={{ fontSize: 12, color: '#666' }}>Manage and check your IPO results</Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setVisible(false);
                resetForm();
              }}
              style={{ 
                padding: 10, 
                backgroundColor: '#FFEBEE', 
                borderRadius: 20 
              }}
            >
              <Ionicons name="close" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>



          <BoidModalTopBar
            showForm={showForm}
            setShowForm={setShowForm}
            setResults={setResults}
          />

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
              useAiModel={useAiModel}
              setUseAiModel={setUseAiModel}
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
