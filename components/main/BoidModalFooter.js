// components/main/BoidModalFooter.js
import React from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import styles from '../../styles/styles';

export default function BoidModalFooter() {
  return (
    <View style={styles.developerContainer}>
      <Text style={styles.developerText}>Made with ❤️ by Er. Rajeev Yadav</Text>
      <View style={styles.iconRow}>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://github.com/rajeevyadavofficial')
          }
        >
          <FontAwesome
            name="github"
            size={24}
            color="#333"
            style={styles.icon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL(
              'https://www.linkedin.com/in/rajeev-yadav-936853259/'
            )
          }
        >
          <FontAwesome
            name="linkedin-square"
            size={24}
            color="#0077B5"
            style={styles.icon}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() =>
            Linking.openURL('https://www.instagram.com/iiam.rajeev/')
          }
        >
          <FontAwesome
            name="instagram"
            size={24}
            color="#C13584"
            style={styles.icon}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}
