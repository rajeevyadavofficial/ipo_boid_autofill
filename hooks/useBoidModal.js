// hooks/useBoidModal.js
import { useState, useEffect } from 'react';
import { Alert, ToastAndroid } from 'react-native';

export default function useBoidModal({
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

  return {
    showForm,
    setShowForm,
    saveOrUpdateBoid,
    checkBoidResult,
    deleteBoid,
    startEdit,
  };
}
