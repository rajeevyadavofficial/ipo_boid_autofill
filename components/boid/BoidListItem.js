import React from 'react';
import { View, Text, TouchableOpacity, Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';
import Toast from 'react-native-toast-message';

export default function BoidListItem({
  item,
  index,
  result,
  fillBoid,
  autoCheck, // New prop
  deleteBoid,
  startEdit,
}) {
  const isAllotted = typeof result === 'string' && result.toLowerCase().includes('congrat');

  const handleShare = async () => {
    if (typeof result !== 'string') return;
    try {
      const message = `📊 IPO Result for ${item.nickname || item.boid}\n\n${result}\n\nCheck yours with IPO Autofill App! 🚀`;
      await Share.share({
        message,
        title: 'IPO Result Share',
      });
    } catch (error) {
      console.error('Sharing failed:', error);
    }
  };

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
            {isAllotted 
              ? ((typeof result === 'string' && result.match(/quantity\s*:\s*(\d+)/i)?.[1])
                ? `Alloted! (${result.match(/quantity\s*:\s*(\d+)/i)[1]})` 
                : 'Alloted!') 
              : 'Not Alloted!'}
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

      {/* Actions */}
      <View style={styles.boidActions}>
        {result ? (
          <TouchableOpacity onPress={handleShare} style={{ marginRight: 12 }}>
            <Ionicons name="share-social-outline" size={20} color="#6200EE" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => autoCheck(item.boid)} style={{ marginRight: 12 }}>
             <Ionicons name="hardware-chip-outline" size={20} color="#6200EE" />
          </TouchableOpacity>
        )}
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
