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
      <View>
        <TextInput
          style={styles.input}
          placeholder="Enter 16-digit BOID starting with 13"
          keyboardType="numeric"
          maxLength={16}
          value={boidInput}
          onChangeText={setBoidInput}
        />
        <Text style={{ 
          position: 'absolute', 
          right: 15, 
          top: 15, 
          fontSize: 12, 
          color: boidInput.length === 16 ? '#4CAF50' : '#888'
        }}>
          {boidInput.length}/16
        </Text>
      </View>
      
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
