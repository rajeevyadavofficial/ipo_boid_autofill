import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
  ToastAndroid,
  Alert,
  SafeAreaView,
  Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons';

export default function MainApp() {
  const webViewRef = useRef(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [boidInput, setBoidInput] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [savedBoids, setSavedBoids] = useState([]);
  const [editIndex, setEditIndex] = useState(null);
  const [webUrl, setWebUrl] = useState('https://iporesult.cdsc.com.np/');
  const [currentUrl, setCurrentUrl] = useState(
    'https://iporesult.cdsc.com.np/'
  );

  useEffect(() => {
    (async () => {
      const data = await AsyncStorage.getItem('savedBoids');
      if (data) setSavedBoids(JSON.parse(data));
    })();
  }, []);

  const saveBoidsToStorage = async (data) => {
    setSavedBoids(data);
    await AsyncStorage.setItem('savedBoids', JSON.stringify(data));
  };

  const resetForm = () => {
    setBoidInput('');
    setNicknameInput('');
    setEditIndex(null);
  };

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

    const entry = {
      boid: boidInput,
      nickname: nicknameInput.trim() || null,
    };

    if (editIndex !== null) {
      Alert.alert('Update BOID', 'Are you sure you want to update this BOID?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Update',
          onPress: async () => {
            const updated = [...savedBoids];
            updated[editIndex] = entry;
            await saveBoidsToStorage(updated);
            ToastAndroid.show('BOID updated', ToastAndroid.SHORT);
            resetForm();
          },
        },
      ]);
    } else {
      const updated = [...savedBoids, entry];
      await saveBoidsToStorage(updated);
      ToastAndroid.show('BOID saved', ToastAndroid.SHORT);
      resetForm();
    }
  };

  const fillBoid = (boid) => {
    const script = `
      document.getElementById('boid').value = '${boid}';
      var event = new Event('input', { bubbles: true });
      document.getElementById('boid').dispatchEvent(event);
      true;
    `;
    webViewRef.current.injectJavaScript(script);
    setModalVisible(false);
    ToastAndroid.show('BOID autofilled', ToastAndroid.SHORT);
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
  };

  const handleRefresh = () => {
    if (webViewRef.current) {
      webViewRef.current.reload(); // Reload the WebView content
      ToastAndroid.show('Page refreshed', ToastAndroid.SHORT); // Show toast notification
    }
  };

  return (
    <>
      <View style={styles.urlBar}>
        <TextInput
          value={webUrl}
          onChangeText={setWebUrl}
          style={styles.urlInput}
          placeholder="Enter URL"
          autoCapitalize="none"
        />
        <TouchableOpacity
          onPress={() => setCurrentUrl(webUrl)}
          style={styles.goButton}
        >
          <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            const defaultURL = 'https://iporesult.cdsc.com.np/';
            setWebUrl(defaultURL);
            setCurrentUrl(defaultURL);
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <SafeAreaView style={styles.container}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always" // Allows mixed content (HTTP content over HTTPS)
          scalesPageToFit={false}
          injectedJavaScriptBeforeContentLoaded={`(function() {
          var meta = document.createElement('meta');
          meta.name = 'viewport';
          meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
          document.getElementsByTagName('head')[0].appendChild(meta);
          document.body.style.msTouchAction = 'manipulation';
          document.body.style.touchAction = 'manipulation';
          document.documentElement.style.touchAction = 'none';
          document.documentElement.style.msTouchAction = 'none';
        })(); true;`}
        />

        <TouchableOpacity
          style={styles.popupButton}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.popupButtonText}>☰</Text>
        </TouchableOpacity>

        <Modal visible={modalVisible} animationType="slide" transparent>
          <TouchableOpacity
            style={styles.modalContainer}
            activeOpacity={1}
            onPressOut={() => {
              setModalVisible(false);
              resetForm();
            }}
          >
            <TouchableOpacity
              activeOpacity={1}
              style={styles.modalContent}
              onPress={() => {}}
            >
              <Text style={styles.modalTitle}>
                {editIndex !== null ? 'Edit BOID' : 'Save or Select BOID'}
              </Text>

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

              <FlatList
                data={savedBoids}
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item, index }) => (
                  <View style={styles.boidCard}>
                    <TouchableOpacity
                      onPress={() => fillBoid(item.boid)}
                      style={{ flex: 1 }}
                    >
                      <Text style={styles.nicknameText}>
                        {item.nickname || 'No nickname'}
                      </Text>
                      <Text style={styles.boidCodeText}>{item.boid}</Text>
                    </TouchableOpacity>

                    <View style={styles.boidActions}>
                      <TouchableOpacity onPress={() => startEdit(item, index)}>
                        <Ionicons
                          name="create-outline"
                          size={20}
                          color="#FF9800"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => deleteBoid(index)}
                        style={{ marginLeft: 12 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#F44336"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              />

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                style={styles.closeButton}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>

              <View style={styles.developerContainer}>
                <Text style={styles.developerText}>
                  Made with ❤️ by Rajeev Yadav
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
                      Linking.openURL(
                        'https://www.instagram.com/iiam.rajeev/?hl=en'
                      )
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
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webView: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  popupButton: {
    position: 'absolute',
    right: 20,
    bottom: 60,
    backgroundColor: '#6200EE',
    padding: 12,
    borderRadius: 50,
    elevation: 5,
    zIndex: 10,
  },
  popupButtonText: {
    color: '#fff',
    fontSize: 22,
  },

  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#000000aa',
  },
  modalContent: {
    backgroundColor: 'white',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#aaa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  saveButton: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    alignItems: 'center',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  boidCard: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 10,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 3,
  },
  nicknameText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  boidCodeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#666',
    marginTop: 2,
  },
  boidActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 10,
    alignSelf: 'center',
  },
  closeText: {
    color: '#6200EE',
    fontWeight: 'bold',
  },
  developerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  developerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: 'row',
    gap: 12,
  },
  icon: {
    marginHorizontal: 6,
  },

  //////////////
  urlBar: {
    position: 'absolute',
    top: 50,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffffee',
    borderRadius: 8,
    paddingHorizontal: 10,
    zIndex: 10,
    elevation: 5,
  },
  urlInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
  },
  goButton: {
    marginTop: 6,
    marginBottom: 6,
    marginLeft: 8,
    backgroundColor: '#6200EE',
    padding: 6,
    borderRadius: 50,
  },

  refreshButton: {
    marginLeft: 6,
    backgroundColor: '#2196F3',
    padding: 6,
    borderRadius: 50,
  },
});
