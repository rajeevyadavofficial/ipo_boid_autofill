// components/MainAppV2/UrlBar.js
import React from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import styles from '../../styles/styles';

export default function UrlBar({ webUrl, setWebUrl, onGoPress, onRefresh }) {
  return (
    <View style={styles.urlBar}>
      <TextInput
        value={webUrl}
        onChangeText={setWebUrl}
        style={styles.urlInput}
        placeholder="Enter URL"
        autoCapitalize="none"
      />

      <TouchableOpacity onPress={onGoPress} style={styles.goButton}>
        <Ionicons name="arrow-forward-circle" size={28} color="#fff" />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          const defaultURL = 'https://iporesult.cdsc.com.np/';
          setWebUrl(defaultURL);
          onRefresh();
        }}
        style={styles.refreshButton}
      >
        <Ionicons name="refresh" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}
