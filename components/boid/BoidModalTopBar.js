// components/main/BoidModalTopBar.js
import React from 'react';
import { View, Text, TouchableOpacity, ToastAndroid } from 'react-native';
import styles from '../../styles/styles';

export default function BoidModalTopBar({ showForm, setShowForm, setResults }) {
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
  );
}
