import React from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomNavBar({
  onOpenBoidModal,
  onOpenUpcomingIpos,
  onOpenDeveloperInfo,
}) {
  const insets = useSafeAreaInsets();

  const baseHeight = 56; // nav bar height without safe area
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
      {/* BOID Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenBoidModal}>
        <Ionicons name="document-text-outline" size={24} color="#fff" />
        <Text style={styles.label}>Saved BOIDs</Text>
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
    // borderTopWidth: 1,
    // borderColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 8,
  },
  navButton: {
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  label: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});
