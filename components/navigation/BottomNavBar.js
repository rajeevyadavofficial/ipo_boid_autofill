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
import { COLORS } from '../../utils/theme';

export default function BottomNavBar({
  onOpenHome,
  onOpenAccounts,
  onOpenBulkCheck,
  onOpenBulkApply,
  onOpenMore,
}) {
  const insets = useSafeAreaInsets();

  const safePadding = Math.max(insets.bottom, 12);
  const fixedHeight = 56 + safePadding;

  return (
    <View
      style={[
        styles.container,
        {
          height: fixedHeight,
          paddingBottom: safePadding,
        },
      ]}
      pointerEvents="box-none"
    >
      {/* Home Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenHome}>
        <Ionicons name="home-outline" size={23} color="#fff" />
        <Text style={styles.label}>Home</Text>
      </TouchableOpacity>

      {/* Accounts Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenAccounts}>
        <Ionicons name="people-outline" size={23} color="#fff" />
        <Text style={styles.label}>Accounts</Text>
      </TouchableOpacity>

      {/* Bulk Check Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenBulkCheck}>
        <Ionicons name="checkmark-done-circle-outline" size={23} color="#fff" />
        <Text style={[styles.label, { color: '#fff' }]}>Bulk Check</Text>
      </TouchableOpacity>

      {/* Bulk Apply Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenBulkApply}>
        <Ionicons name="rocket-outline" size={23} color="#fff" />
        <Text style={[styles.label, { color: '#fff' }]}>Bulk Apply</Text>
      </TouchableOpacity>

      {/* More Button */}
      <TouchableOpacity style={styles.navButton} onPress={onOpenMore}>
        <Ionicons name="grid-outline" size={23} color="#fff" />
        <Text style={styles.label}>More</Text>
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
    backgroundColor: COLORS.surface,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingTop: 8,
  },
  navButton: {
    alignItems: 'center',
    paddingHorizontal: 2,
    flex: 1,
  },
  label: {
    color: '#fff',
    fontSize: 9.5,
    marginTop: 4,
    textAlign: 'center',
  },
});
