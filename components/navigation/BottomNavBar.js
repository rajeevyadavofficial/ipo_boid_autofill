import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavBar({
  onOpenBoidModal,
  onOpenBulkCheck,
  onOpenUpcomingIpos,
  onOpenDeveloperInfo,
}) {
  const insets = useSafeAreaInsets();

  const baseHeight = 56;
  const totalHeight = baseHeight + (insets.bottom || 0);

  return (
    <View
      style={[
        styles.container,
        {
          height: totalHeight,
          paddingBottom: insets.bottom || 8,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* BOID Manager Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenBoidModal}>
        <Ionicons name="document-text-outline" size={24} color="#fff" />
        <Text style={styles.label}>BOIDs</Text>
      </TouchableOpacity>

      {/* Bulk Check Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenBulkCheck}>
        <MaterialCommunityIcons name="robot-outline" size={24} color="#FFD700" />
        <Text style={[styles.label, { color: '#FFD700' }]}>Bulk Check</Text>
      </TouchableOpacity>

      {/* Upcoming IPOs Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenUpcomingIpos}>
        <Ionicons name="calendar-outline" size={24} color="#fff" />
        <Text style={styles.label}>Upcoming IPOs</Text>
      </TouchableOpacity>

      {/* Developer Info Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenDeveloperInfo}>
        <FontAwesome name="user-circle" size={24} color="#fff" />
        <Text style={styles.label}>Developer</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 12,
    backgroundColor: '#333a56',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  navButton: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
  },
});
