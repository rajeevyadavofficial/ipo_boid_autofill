import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
} from 'react-native';
import styles from '../../styles/styles';
import { COLORS } from '../../utils/theme';

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
          placeholderTextColor={COLORS.mutedText}
        />
        <Text style={{ 
          position: 'absolute', 
          right: 15, 
          top: 15, 
          fontSize: 12, 
          color: boidInput.length === 16 ? COLORS.text : COLORS.mutedText
        }}>
          {boidInput.length}/16
        </Text>
      </View>
      
      <TextInput
        style={styles.input}
        placeholder="Enter Nickname (optional)"
        value={nicknameInput}
        onChangeText={setNicknameInput}
        placeholderTextColor={COLORS.mutedText}
      />
      <TouchableOpacity style={styles.saveButton} onPress={saveOrUpdateBoid}>
        <Text style={styles.saveButtonText}>
          {editIndex !== null ? 'Update BOID' : 'Save BOID'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
