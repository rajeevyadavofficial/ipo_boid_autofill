import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Image,
  Linking,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons, FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as NavigationBar from 'expo-navigation-bar';
import ProfilePic from '../../assets/profile.jpg';
import PaymentQr from '../../assets/payment.png';
import { StatusBar, setStatusBarBackgroundColor } from 'expo-status-bar';
import { COLORS } from '../../utils/theme';

export default function MoreSidebar({ visible, onClose, onOpenBoidModal, onOpenOpenIpos, onOpenUpcomingIpos }) {
  const insets = useSafeAreaInsets();
  const [showDonate, setShowDonate] = React.useState(false);
  const [showFeedback, setShowFeedback] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isFeedbackFocused, setIsFeedbackFocused] = React.useState(false);
  const feedbackInputRef = React.useRef(null);
  const [slideAnim] = React.useState(new Animated.Value(320));

  React.useEffect(() => {
    if (showFeedback) {
      setTimeout(() => feedbackInputRef.current?.focus(), 300);
    }
  }, [showFeedback]);

  React.useEffect(() => {
    if (visible && Platform.OS === 'android') {
      setStatusBarBackgroundColor(COLORS.primary, true);
      NavigationBar.setBackgroundColorAsync(COLORS.primary);
      NavigationBar.setButtonStyleAsync('light');
    }
  }, [visible]);

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 0 : 320,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible, slideAnim]);

  const handleFeedbackSubmit = async () => {
    if (!feedbackText.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('https://ipo-backend-zzjb.onrender.com/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: feedbackText, deviceInfo: Platform.OS }),
      });
      if (res.ok) {
        alert('Feedback submitted successfully. Thank you!');
        setFeedbackText('');
        setShowFeedback(false);
      } else {
        alert('Failed to submit feedback.');
      }
    } catch (e) {
      alert('Network error. Could not submit feedback.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sections = [
    {
      title: 'IPO Tools',
      items: [
        { label: 'Accounts', icon: 'people', onPress: () => { onClose(); onOpenBoidModal(); } },
        { label: 'Open IPOs', icon: 'flash', onPress: () => { onClose(); onOpenOpenIpos(); } },
        { label: 'Upcoming', icon: 'calendar', onPress: () => { onClose(); onOpenUpcomingIpos(); } },
      ],
    },
    {
      title: 'Community',
      items: [
        { label: 'Support', icon: 'heart', family: 'fontawesome', onPress: () => setShowDonate(v => !v), active: showDonate },
        { label: 'Feedback', icon: 'chatbubbles', onPress: () => setShowFeedback(v => !v), active: showFeedback },
      ],
    },
  ];

  if (!visible && slideAnim._value === 320) return null;

  const renderIcon = (item) => {
    if (item.family === 'fontawesome') {
      return <FontAwesome name={item.icon} size={22} color="#fff" />;
    }
    return <Ionicons name={item.icon} size={24} color="#fff" />;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <StatusBar style="light" backgroundColor={COLORS.primary} />
      <View style={styles.overlay}>
        <View style={[styles.systemInset, { top: 0, height: insets.top }]} />
        <View style={[styles.systemInset, { bottom: 0, height: insets.bottom }]} />
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View
          style={[
            styles.sidebar,
            {
              transform: [{ translateX: slideAnim }],
              marginTop: insets.top,
              marginBottom: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>More</Text>
              <Text style={styles.headerSub}>MeroShare tools and settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          >
            {sections.map(section => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.grid}>
                  {section.items.map(item => (
                    <TouchableOpacity
                      key={item.label}
                      style={[styles.gridTile, item.active && styles.gridTileActive]}
                      onPress={item.onPress}
                      activeOpacity={0.82}
                    >
                      <View style={styles.tileIcon}>{renderIcon(item)}</View>
                      <Text style={styles.tileText}>{item.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}

            {showDonate && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Support Project</Text>
                <Text style={styles.panelText}>Your support helps keep backend services running.</Text>
                <View style={styles.qrWrapper}>
                  <Image source={PaymentQr} style={styles.qrImage} />
                </View>
                <Text style={styles.panelHint}>Scan to donate</Text>
              </View>
            )}

            {showFeedback && (
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Submit Feedback</Text>
                <TextInput
                  ref={feedbackInputRef}
                  style={[styles.feedbackInput, isFeedbackFocused && styles.feedbackInputFocused]}
                  multiline
                  placeholder="Type your message here..."
                  placeholderTextColor={COLORS.mutedText}
                  value={feedbackText}
                  onChangeText={setFeedbackText}
                  onFocus={() => setIsFeedbackFocused(true)}
                  onBlur={() => setIsFeedbackFocused(false)}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={[styles.submitBtn, (!feedbackText.trim() || isSubmitting) && { opacity: 0.5 }]}
                  onPress={handleFeedbackSubmit}
                  disabled={!feedbackText.trim() || isSubmitting}
                >
                  <MaterialIcons name="send" size={19} color="#fff" />
                  <Text style={styles.submitText}>{isSubmitting ? 'Sending...' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.devCard}>
              <Image source={ProfilePic} style={styles.devAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.devName}>Rajeev Yadav</Text>
                <Text style={styles.devRole}>Full-stack Developer</Text>
                <View style={styles.devSocials}>
                  <TouchableOpacity onPress={() => Linking.openURL('https://github.com/rajeevyadav-official')}>
                    <Ionicons name="logo-github" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL('https://facebook.com/rajeev.yadav.official01')}>
                    <Ionicons name="logo-facebook" size={22} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL('https://mail.google.com/mail/?view=cm&fs=1&to=rajeevyadav.official01@gmail.com')}>
                    <MaterialIcons name="email" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: COLORS.overlay,
  },
  systemInset: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: COLORS.primary,
    zIndex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  sidebar: {
    width: '86%',
    maxWidth: 380,
    backgroundColor: COLORS.primary,
    alignSelf: 'stretch',
    borderLeftWidth: 1,
    borderLeftColor: COLORS.border,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  headerSub: {
    marginTop: 2,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
  },
  content: {
    flex: 1,
    paddingHorizontal: 14,
  },
  section: {
    paddingTop: 18,
  },
  sectionTitle: {
    color: COLORS.mutedText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  gridTile: {
    width: '31.5%',
    minHeight: 94,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  gridTileActive: {
    backgroundColor: COLORS.accent,
  },
  tileIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },
  tileText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  panel: {
    marginTop: 14,
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  panelTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 6,
  },
  panelText: {
    color: COLORS.mutedText,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrWrapper: {
    alignSelf: 'center',
    backgroundColor: COLORS.text,
    padding: 10,
    borderRadius: 10,
  },
  qrImage: {
    width: 150,
    height: 150,
  },
  panelHint: {
    marginTop: 10,
    color: COLORS.mutedText,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'center',
  },
  feedbackInput: {
    minHeight: 76,
    maxHeight: 110,
    color: COLORS.text,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  feedbackInputFocused: {
    borderColor: COLORS.accent,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accent,
    marginTop: 10,
    borderRadius: 10,
    paddingVertical: 11,
  },
  submitText: {
    color: COLORS.text,
    fontWeight: '900',
    fontSize: 14,
  },
  devCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 14,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  devAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: COLORS.accent,
  },
  devName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '900',
  },
  devRole: {
    color: COLORS.mutedText,
    fontSize: 12,
    marginTop: 2,
  },
  devSocials: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 9,
  },
});
