// components/main/DeveloperSidebar.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  Animated,
  Dimensions,
  StyleSheet,
  TouchableWithoutFeedback,
  Image,
  ScrollView,
} from 'react-native';
import { FontAwesome, MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';

// Import your profile picture
import ProfilePic from '../../assets/profile.jpg';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DeveloperSidebar({
  visible,
  onClose,
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const portfolioUrl = 'https://yadavrajeev.com.np'; 

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : SCREEN_WIDTH,
      useNativeDriver: true,
      stiffness: 120,
    }).start();

    Animated.timing(overlayAnim, {
      toValue: visible ? 0.5 : 0,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [visible]);

  const openLink = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  const sendEmail = () => {
    Linking.openURL('mailto:rajeevyadav.official01@gmail.com');
  };

  return (
    <>
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateX: slideAnim }],
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >

        <ScrollView showsVerticalScrollIndicator={false}>
          <LinearGradient colors={['#6a11cb', '#2575fc']} style={styles.banner}>
            <View style={styles.bannerContent}>
              <View style={styles.avatar}>
                <Image
                  source={ProfilePic}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              </View>
              <Text style={styles.bannerTitle}>Er. Rajeev Yadav</Text>
              <Text style={styles.bannerSubtitle}>App Developer</Text>
            </View>
          </LinearGradient>

          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          <View style={styles.content}>
            <Text style={styles.aboutText}>
              Passionate Mobile & Web Developer dedicated to building high-quality, user-friendly applications that solve real-world problems.
            </Text>

            <View style={styles.iconRow}>
               <TouchableOpacity onPress={() => openLink('https://github.com/rajeevyadavofficial')}>
                <FontAwesome name="github" size={36} color="#333" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://www.linkedin.com/in/rajeev-yadav-936853259/')}>
                <FontAwesome name="linkedin-square" size={36} color="#0077B5" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://www.instagram.com/iiam.rajeev/')}>
                <FontAwesome name="instagram" size={36} color="#C13584" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={sendEmail}>
                <MaterialIcons name="email" size={36} color="#D44638" style={styles.icon} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.separator} />

            <View style={styles.qrContainer}>
              <QRCode value={portfolioUrl} size={120} color="#2575fc" backgroundColor="#fff" />
              <Text style={styles.qrCaption}>Scan for Portfolio</Text>
              <TouchableOpacity onPress={() => openLink(portfolioUrl)}>
                <Text style={styles.portfolioLink}>yadavrajeev.com.np</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: SCREEN_WIDTH * 0.85,
    height: '100%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    zIndex: 100,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: -3, height: 0 },
    shadowRadius: 6,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SCREEN_WIDTH,
    height: '100%',
    backgroundColor: '#000',
    zIndex: 99,
  },
  banner: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    borderTopLeftRadius: 20,
    borderBottomRightRadius: 40,
  },
  bannerContent: {
    alignItems: 'center',
  },
  avatar: {
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#fff',
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: 16,
    color: '#f0f0f0',
    marginTop: 4,
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  closeText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 30,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 30,
  },
  icon: {
    marginHorizontal: 10,
  },
  separator: {
    width: '100%',
    height: 1,
    backgroundColor: '#eee',
    marginBottom: 30,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrCaption: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  portfolioLink: {
    marginTop: 4,
    fontSize: 12,
    color: '#2575fc',
    textDecorationLine: 'underline',
  },
});
