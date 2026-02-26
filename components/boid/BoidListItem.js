import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';
import Toast from 'react-native-toast-message';

export default function BoidListItem({
  item,
  index,
  fillBoid,
  deleteBoid,
  startEdit,
}) {
  const [isVisible, setIsVisible] = useState(false);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(item.boid);
    if (Platform.OS === 'android') {
       Toast.show({
         type: 'success',
         text1: 'Copied!',
         text2: 'BOID copied to clipboard'
       });
    } else {
       alert('BOID copied to clipboard');
    }
  };

  // Mask logic: First 6 visible, then 8 stars, last 2 visible
  const getMaskedBoid = (boid) => {
    if (!boid || boid.length < 16) return boid;
    return boid.substring(0, 6) + '********' + boid.substring(14);
  };

  return (
    <TouchableOpacity
      style={styles.boidCard}
      activeOpacity={0.7}
      onPress={() => fillBoid(item.boid, index)}
    >
      {/* Main content */}
      <View style={{ flex: 1 }}>
        <Text style={styles.nicknameText}>
          {item.nickname || 'No nickname'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.boidCodeText}>
            {isVisible ? item.boid : getMaskedBoid(item.boid)}
          </Text>
          <TouchableOpacity 
            onPress={() => setIsVisible(!isVisible)} 
            style={{ marginLeft: 8, padding: 4 }}
          >
             <Ionicons name={isVisible ? "eye-off-outline" : "eye-outline"} size={16} color="#666" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Actions */}
      <View style={styles.boidActions}>
        <TouchableOpacity onPress={copyToClipboard} style={{ marginRight: 12 }}>
          <Ionicons name="copy-outline" size={20} color="#555" />
        </TouchableOpacity>
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
