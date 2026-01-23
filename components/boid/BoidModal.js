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

  const renderItem = ({ item, index }) => {
    const match = results.find((r) => r.boid === item.boid);
    return (
      <BoidListItem
        item={item}
        index={index}
        result={match?.result}
        fillBoid={checkBoidResult}
        deleteBoid={deleteBoid}
        startEdit={startEdit}
      />
    );
  };

  const [panelMode, setPanelMode] = React.useState('selection');
  const [isMinimized, setIsMinimized] = React.useState(false); 

  const total = savedBoids.length;
  const allotted = results.filter((r) =>
    r.result?.toLowerCase().includes('congrat')
  ).length;

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
              savedBoids={savedBoids}
              ipoName={ipoName}
              webViewRef={webViewRef}
              visible={visible}
              onModeChange={setPanelMode}
              onWebViewMessage={onWebViewMessage}
            />

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
                  data={savedBoids}
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
