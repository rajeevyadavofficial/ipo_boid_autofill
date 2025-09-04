import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';

export default function BoidListItem({
  item,
  index,
  result,
  fillBoid,
  deleteBoid,
  startEdit,
}) {
  const isAllotted = result?.toLowerCase().includes('congrat');

  return (
    <TouchableOpacity
      style={styles.boidCard}
      activeOpacity={0.7}
      onPress={() => fillBoid(item.boid, index)}
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

      {/* Action buttons */}
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
    </TouchableOpacity>
  );
}
