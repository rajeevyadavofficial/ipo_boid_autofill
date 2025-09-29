import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ToastAndroid,
} from 'react-native';
import styles from '../../styles/styles';
import useBoidModal from '../../hooks/useBoidModal';
import BoidListItem from './BoidListItem';
import BoidModalTopBar from './BoidModalTopBar';
import BoidModalFooter from './BoidModalFooter';
import BoidModalForm from './BoidModalForm';
import BoidModalResultMessage from './BoidModalResultMessage';

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
        result={match?.result} // <-- just pass result
        fillBoid={checkBoidResult}
        deleteBoid={deleteBoid}
        startEdit={startEdit}
      />
    );
  };

  const total = savedBoids.length;
  const allotted = results.filter((r) =>
    r.result?.toLowerCase().includes('congrat')
  ).length;

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
          {/* Top Bar */}
          <BoidModalTopBar
            showForm={showForm}
            setShowForm={setShowForm}
            setResults={setResults}
          />

          {/* Congratulation or Sorry Message */}
          <BoidModalResultMessage results={results} total={total} />

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
          />

          {/* Footer / Developer Info */}
          <BoidModalFooter />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
