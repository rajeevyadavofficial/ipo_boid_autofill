import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ToastAndroid,
  Linking,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import styles from '../../styles/styles';

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
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (visible) {
      setShowForm(false);
    }
  }, [visible]);

  const saveOrUpdateBoid = async () => {
    if (!/^13\d{14}$/.test(boidInput)) {
      ToastAndroid.show(
        'BOID must be 16 digits and start with 13',
        ToastAndroid.SHORT
      );
      return;
    }

    if (
      editIndex === null &&
      savedBoids.some((item) => item.boid === boidInput)
    ) {
      ToastAndroid.show('BOID already exists', ToastAndroid.SHORT);
      return;
    }

    const entry = { boid: boidInput, nickname: nicknameInput.trim() || null };

    if (editIndex !== null) {
      Alert.alert('Update BOID', 'Are you sure?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            const updated = [...savedBoids];
            updated[editIndex] = entry;
            await saveBoidsToStorage(updated);
            ToastAndroid.show('BOID updated', ToastAndroid.SHORT);
            resetForm();
            setShowForm(false);
          },
        },
      ]);
    } else {
      const updated = [...savedBoids, entry];
      await saveBoidsToStorage(updated);
      ToastAndroid.show('BOID saved', ToastAndroid.SHORT);
      resetForm();
      setShowForm(false);
    }
  };

  const checkBoidResult = (boid, index) => {
    setCurrentCheckingBoid({
      boid,
      nickname: savedBoids[index].nickname,
    });

    const script = `
      document.getElementById('boid').value = '${boid}';
      var event = new Event('input', { bubbles: true });
      document.getElementById('boid').dispatchEvent(event);
      true;
    `;
    webViewRef.current.injectJavaScript(script);

    ToastAndroid.show(
      'BOID filled. Now solve CAPTCHA and tap "View Result".',
      ToastAndroid.LONG
    );
    setVisible(false);
  };

  const deleteBoid = (index) => {
    Alert.alert('Delete BOID', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = [...savedBoids];
          updated.splice(index, 1);
          await saveBoidsToStorage(updated);
          ToastAndroid.show('Deleted', ToastAndroid.SHORT);
        },
      },
    ]);
  };

  const startEdit = (item, index) => {
    setBoidInput(item.boid);
    setNicknameInput(item.nickname || '');
    setEditIndex(index);
    setShowForm(true);
  };

  const renderItem = ({ item, index }) => {
    const match = results.find((r) => r.boid === item.boid);
    const result = match?.result;
    const isAllotted = result?.toLowerCase().includes('congrat');

    return (
      <TouchableOpacity
        style={styles.boidCard}
        activeOpacity={0.7}
        onPress={() => checkBoidResult(item.boid, index)}
      >
        {/* Vertical label */}
        {result && (
          <View
            style={[
              styles.verticalLabel,
              { backgroundColor: isAllotted ? 'green' : 'red' },
            ]}
          >
            <Text style={styles.verticalLabelText}>
              {isAllotted ? 'Alloted!' : 'Not Alloted!'}
            </Text>
          </View>
        )}

        {/* Main content */}
        <View style={{ flex: 1, paddingLeft: result ? 22 : 0 }}>
          <Text style={styles.nicknameText}>
            {item.nickname || 'No nickname'}
          </Text>
          <Text style={styles.boidCodeText}>{item.boid}</Text>
        </View>

        <View style={styles.boidActions}>
          <TouchableOpacity
            onPress={() => startEdit(item, index)}
            style={{ marginLeft: 10 }}
          >
            <Ionicons name="create-outline" size={20} color="#FF9800" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteBoid(index)}
            style={{ marginLeft: 12 }}
          >
            <Ionicons name="trash-outline" size={20} color="#F44336" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Count Allotted BOIDs
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

          {/* Input Form (conditionally shown) */}
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
