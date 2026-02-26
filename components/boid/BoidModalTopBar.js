// components/main/BoidModalTopBar.js
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import styles from '../../styles/styles';

export default function BoidModalTopBar({ showForm, setShowForm }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
      }}
    >
      <TouchableOpacity
        onPress={() => setShowForm((prev) => !prev)}
        style={[styles.saveButton, { flex: 1 }]}
      >
        <Text style={styles.saveButtonText}>
          {showForm ? 'Cancel' : '+ Add BOID'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
