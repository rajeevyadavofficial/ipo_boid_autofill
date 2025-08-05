import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from './styles';

export default function BoidListItem({
  item,
  index,
  fillBoid,
  deleteBoid,
  startEdit,
}) {
  return (
    <View style={styles.boidCard}>
      <TouchableOpacity onPress={() => fillBoid(item.boid)} style={{ flex: 1 }}>
        <Text style={styles.nicknameText}>
          {item.nickname || 'No nickname'}
        </Text>
        <Text style={styles.boidCodeText}>{item.boid}</Text>
      </TouchableOpacity>

      <View style={styles.boidActions}>
        <TouchableOpacity onPress={() => startEdit(item, index)}>
          <Ionicons name="create-outline" size={20} color="#FF9800" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteBoid(index)}
          style={{ marginLeft: 12 }}
        >
          <Ionicons name="trash-outline" size={20} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );
}
