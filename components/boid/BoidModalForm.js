// components/main/BoidModalForm.js
import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import styles from '../../styles/styles';

export default function BoidModalForm({
  boidInput,
  nicknameInput,
  setBoidInput,
  setNicknameInput,
  saveOrUpdateBoid,
  editIndex,
}) {
  return (
    <View>
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
      <TouchableOpacity style={styles.saveButton} onPress={saveOrUpdateBoid}>
        <Text style={styles.saveButtonText}>
          {editIndex !== null ? 'Update BOID' : 'Save BOID'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
