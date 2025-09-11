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
  appVersion = '1.0.2',
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const portfolioUrl = 'https://yadavrajeev.com.np'; // QR Code link

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
      {/* Overlay */}
      {visible && (
        <TouchableWithoutFeedback onPress={onClose}>
          <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
        </TouchableWithoutFeedback>
      )}

      {/* Sidebar */}
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
          {/* Gradient Banner with Profile */}
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
              <Text style={styles.bannerBio}>
                Building apps with ❤️ and code
              </Text>
            </View>
          </LinearGradient>

          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {/* Info Section */}
          <View style={styles.content}>
            <Text style={styles.infoText}>
              This app is made with ❤️ and passion. Connect with me on social
              media or via email.
            </Text>

            {/* Social Icons */}
            <View style={styles.iconRow}>
              <TouchableOpacity
                onPress={() =>
                  openLink('https://github.com/rajeevyadavofficial')
                }
              >
                <FontAwesome
                  name="github"
                  size={36}
                  color="#333"
                  style={styles.icon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  openLink(
                    'https://www.linkedin.com/in/rajeev-yadav-936853259/'
                  )
                }
              >
                <FontAwesome
                  name="linkedin-square"
                  size={36}
                  color="#0077B5"
                  style={styles.icon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() =>
                  openLink('https://www.instagram.com/iiam.rajeev/')
                }
              >
                <FontAwesome
                  name="instagram"
                  size={36}
                  color="#C13584"
                  style={styles.icon}
                />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openLink('https://www.facebook.com/iiam.rajeev')}
              >
                <FontAwesome
                  name="facebook-square"
                  size={36}
                  color="#4267B2"
                  style={styles.icon}
                />
              </TouchableOpacity>

              <TouchableOpacity onPress={sendEmail}>
                <MaterialIcons
                  name="email"
                  size={36}
                  color="#D44638"
                  style={styles.icon}
                />
              </TouchableOpacity>
            </View>

            {/* App Info Section */}
            <View style={styles.appInfo}>
              <Text style={styles.appInfoText}>App Version: {appVersion}</Text>
              <Text style={styles.appInfoText}>Made in Nepal 🇳🇵</Text>
            </View>

            {/* QR Code Section */}
            <View style={styles.qrContainer}>
              <QRCode
                value={portfolioUrl}
                size={120}
                color="#2575fc"
                backgroundColor="#fff"
              />
              <Text style={styles.qrCaption}>Scan to visit my Portfolio</Text>
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
    paddingVertical: 30,
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
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#fff',
  },
  bannerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#f0f0f0',
    marginTop: 4,
  },
  bannerBio: {
    fontSize: 12,
    color: '#e0e0e0',
    marginTop: 6,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  closeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  closeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    padding: 20,
  },
  infoText: {
    fontSize: 15,
    color: '#555',
    marginBottom: 20,
    lineHeight: 22,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  icon: {
    marginVertical: 10,
    marginHorizontal: 8,
  },
  appInfo: {
    marginTop: 20,
  },
  appInfoText: {
    fontSize: 13,
    color: '#777',
    marginBottom: 4,
  },
  qrContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  qrCaption: {
    fontSize: 12,
    color: '#555',
    marginTop: 8,
  },
});
