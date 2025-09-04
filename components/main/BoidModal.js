import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ToastAndroid,
  Linking,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import styles from '../../styles/styles';
import useBoidModal from '../../hooks/useBoidModal';
import BoidListItem from './BoidListItem';

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
        result={match?.result}
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
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <TouchableOpacity
              onPress={() => setShowForm((prev) => !prev)}
              style={[styles.saveButton, { flex: 1, marginRight: 5 }]}
            >
              <Text style={styles.saveButtonText}>
                {showForm ? 'Cancel' : 'Add BOID'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setResults([]);
                ToastAndroid.show('Results cleared', ToastAndroid.SHORT);
              }}
              style={[
                styles.saveButton,
                { backgroundColor: '#F44336', flex: 1, marginLeft: 5 },
              ]}
            >
              <Text style={styles.saveButtonText}>Clear Results</Text>
            </TouchableOpacity>
          </View>

          {/* Congratulation or Sorry Message */}
          {results.length > 0 && total > 0 && (
            <Text
              style={{
                textAlign: 'center',
                fontWeight: 'bold',
                marginBottom: 10,
                color: allotted > 0 ? 'green' : 'red',
              }}
            >
              {allotted > 0
                ? `🎉 Congratulations ${allotted}/${total} allotted !`
                : `😔 Sorry ${allotted}/${total} allotted !`}
            </Text>
          )}

          {/* Input Form */}
          {showForm && (
            <>
              <TextInput
                style={styles.input}
                placeholder="Enter 16-digit BOID starting with 13"
                keyboardType="numeric"
                maxLength={16}
                value={boidInput}
                onChangeText={setBoidInput}
              />
              <TextInput
                style={styles.input}
                placeholder="Enter Nickname (optional)"
                value={nicknameInput}
                onChangeText={setNicknameInput}
              />
              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveOrUpdateBoid}
              >
                <Text style={styles.saveButtonText}>
                  {editIndex !== null ? 'Update BOID' : 'Save BOID'}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* List of Saved BOIDs */}
          <FlatList
            data={savedBoids}
            keyExtractor={(_, index) => index.toString()}
            renderItem={renderItem}
          />

          {/* Footer / Developer Info */}
          <View style={styles.developerContainer}>
            <Text style={styles.developerText}>
              Made with ❤️ by Er. Rajeev Yadav
            </Text>
            <View style={styles.iconRow}>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://github.com/rajeevyadavofficial')
                }
              >
                <FontAwesome
                  name="github"
                  size={24}
                  color="#333"
                  style={styles.icon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL(
                    'https://www.linkedin.com/in/rajeev-yadav-936853259/'
                  )
                }
              >
                <FontAwesome
                  name="linkedin-square"
                  size={24}
                  color="#0077B5"
                  style={styles.icon}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() =>
                  Linking.openURL('https://www.instagram.com/iiam.rajeev/')
                }
              >
                <FontAwesome
                  name="instagram"
                  size={24}
                  color="#C13584"
                  style={styles.icon}
                />
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}
