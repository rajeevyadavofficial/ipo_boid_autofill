// components/main/DeveloperSidebar.js
import React, { useRef, useEffect, useState } from 'react';
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
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import { FontAwesome, MaterialIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { getApiBaseUrl } from '../../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateDOMInspectionScript } from '../../utils/diagnosticScripts';

// Import your profile picture
import ProfilePic from '../../assets/profile.jpg';

const SCREEN_WIDTH = Dimensions.get('window').width;

export default function DeveloperSidebar({
  visible,
  onClose,
  appVersion = '1.0.2',
  webViewRef,
  onWebViewMessage, 
}) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef(null);

  const portfolioUrl = 'https://yadavrajeev.com.np'; 

  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);

  // Backend Overrides
  const [backendOverride, setBackendOverride] = useState('');
  
  const getEffectiveApiUrl = () => {
    return backendOverride || getApiBaseUrl();
  };

  // Load backend override on mount
  useEffect(() => {
    (async () => {
        const stored = await AsyncStorage.getItem('backend_override');
        if (stored) setBackendOverride(stored);
    })();
  }, []);

  const saveBackendOverride = async (url) => {
    setBackendOverride(url);
    await AsyncStorage.setItem('backend_override', url);
  };

  // Harvest Mode States
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [harvestText, setHarvestText] = useState('');
  const [harvestCount, setHarvestCount] = useState(0);
  const [currentCaptcha, setCurrentCaptcha] = useState(null);
  const [isExtracting, setIsExtracting] = useState(false);
  
  // DOM Inspection State
  const [selectedCondition, setSelectedCondition] = useState('NOT_ALLOTTED'); // NOT_ALLOTTED, ALLOTTED, INVALID_CAPTCHA

  // In-memory script for Zoom & Focus
  const zoomScript = `
    (function zoomToCaptcha() {
      const captchaImg = document.querySelector('img[alt="captcha"]');
      if (!captchaImg) return;
      
      const header = document.querySelector('.header-nav');
      if (header) header.style.display = 'none';
      const container = document.querySelector('.container');
      if (container) {
        container.style.marginTop = '0';
        container.style.padding = '10px';
      }
      
      const captchaGroup = captchaImg.closest('.form-group') || captchaImg.parentElement;
      if (captchaGroup) {
        captchaImg.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    })();
    true;
  `;

  const resetWebView = `
    (function resetView() {
      const header = document.querySelector('.header-nav');
      if (header) header.style.display = 'block';
      const container = document.querySelector('.container');
      if (container) {
        container.style.marginTop = '';
        container.style.padding = '';
      }
    })();
    true;
  `;

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

    if (visible) {
      fetchSyncTime();
      updateHarvestCount();
    }
  }, [visible]);

  const fetchSyncTime = async () => {
    try {
      const response = await fetch(`${getEffectiveApiUrl()}/admin/settings`);
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (e) {
        console.warn(`[Sidebar] JSON Parse error. Status: ${response.status}`);
        return;
      }
      if (data.success && data.data) {
        setLastSyncedAt(data.data.lastSyncAt);
      }
    } catch (e) {
      console.warn('Failed to fetch sync time:', e.message);
    }
  };

  const updateHarvestCount = async () => {
    try {
      const res = await fetch(`${getEffectiveApiUrl()}/dataset/count`);
      const data = await res.json();
      if (data.success) setHarvestCount(data.count);
    } catch (e) {}
  };

  const openLink = async (url) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) await Linking.openURL(url);
  };

  const sendEmail = () => {
    Linking.openURL('mailto:rajeevyadav.official01@gmail.com');
  };

  const handleSyncData = async () => {
    setIsSyncing(true);
    try {
      const API_URL = `${getEffectiveApiUrl()}/admin/sync-ipos`;
      const response = await fetch(API_URL, { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        setLastSyncedAt(new Date());
        Alert.alert('✅ Data Fresh', `Added: ${data.stats.added}, Updated: ${data.stats.updated}`);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      Alert.alert('❌ Sync Error', 'Could not refresh data: ' + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleHarvestToggle = () => {
    const newState = !isHarvesting;
    setIsHarvesting(newState);
    if (newState) {
      webViewRef.current?.injectJavaScript(zoomScript);
      fetchNextCaptcha();
    } else {
      webViewRef.current?.injectJavaScript(resetWebView);
      setCurrentCaptcha(null);
    }
  };

  const fetchNextCaptcha = (shouldRefresh = false) => {
    setIsExtracting(true);
    const extractionScript = `
      (function() {
        const captchaImg = document.querySelector('img[alt="captcha"]');
        if (!captchaImg) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'CONSOLE_LOG', message: '⚠️ Captcha not found' }));
          return;
        }
        
        const oldSrc = captchaImg.src;
        let attempts = 0;

        function doExtract() {
          const scale = 3;
          const canvas = document.createElement('canvas');
          canvas.width = (captchaImg.naturalWidth || 150) * scale;
          canvas.height = (captchaImg.naturalHeight || 40) * scale;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(captchaImg, 0, 0, canvas.width, canvas.height);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'HARVEST_CAPTCHA_IMAGE',
            imageBase64: canvas.toDataURL('image/png').split(',')[1]
          }));
        }

        if (${shouldRefresh}) {
          console.log('🔄 Triggering refresh...');
          
          // Method 1: Precise target based on diagnostic scan
          const directBtn = document.querySelector('button[tooltip="Reload Captcha"]');
          
          if (directBtn) {
            console.log('🎯 Found specific refresh button!');
            directBtn.click();
          } else {
            // Method 2: Scan siblings (Robust fallback)
            let clicked = false;
            const parent = captchaImg.parentElement;
            if (parent) {
               const siblings = parent.parentElement?.children;
               if (siblings) {
                 for (let i = 0; i < siblings.length; i++) {
                   const sib = siblings[i];
                   if (sib !== parent) {
                     // Check for button inside sibling
                     const btn = sib.querySelector('button') || sib;
                     if (btn && (btn.innerHTML.includes('arrow') || btn.innerHTML.includes('refresh') || Object.keys(btn).some(k => k.startsWith('__react')))) {
                        btn.click();
                        clicked = true;
                        break;
                     }
                   }
                 }
               }
            }
            
            if (!clicked) {
               console.log('⚠️ Fallback to image click');
               captchaImg.click();
            }
          }

          let pollInterval = setInterval(() => {
            attempts++;
            const currentImg = document.querySelector('img[alt="captcha"]');
            if (currentImg && currentImg.src !== oldSrc) {
              clearInterval(pollInterval);
              setTimeout(doExtract, 500); // Small delay for rendering
            } else if (attempts > 30) {
              clearInterval(pollInterval);
              doExtract(); // Fallback to current if no change
            }
          }, 200);
        } else {
          doExtract();
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(extractionScript);
    if (isHarvesting) webViewRef.current?.injectJavaScript(zoomScript);
  };

  const handleInAppMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'HARVEST_CAPTCHA_IMAGE') {
        setCurrentCaptcha(`data:image/png;base64,${data.imageBase64}`);
        setIsExtracting(false);
      } else if (data.type === 'DOM_INSPECTION_RESULT') {
        console.log('🔍 [DOM INSPECTION] Found', data.data.patterns.length, 'patterns');
        
        // Automatically save to backend
        fetch(`${getEffectiveApiUrl()}/dataset/save-inspection`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            condition: selectedCondition,
            data: data.data
          })
        })
        .then(res => res.json())
        .then(saveResult => {
          console.log('✅ Saved to backend:', saveResult);
          
          // Format results for display
          let message = `Condition: ${selectedCondition}\n`;
          message += `Found ${data.data.patterns.length} matching elements\n\n`;
          
          if (data.data.patterns.length > 0) {
            data.data.patterns.forEach((pattern, idx) => {
              message += `${idx + 1}. ${pattern.patternName}\n`;
              message += `   Text: "${pattern.text.substring(0, 60)}..."\n`;
              message += `   Tag: <${pattern.tagName.toLowerCase()}${pattern.className ? ' class="' + pattern.className + '"' : ''}>\n\n`;
            });
          } else {
            message += 'No matching patterns found.\n';
            message += 'Make sure the message is visible on screen.';
          }
          
          message += `\n✅ Results saved to backend!`;
          
          Alert.alert('🔍 DOM Inspection Complete', message);
        })
        .catch(err => {
          console.error('❌ Failed to save to backend:', err);
          Alert.alert('Error', 'Failed to save results to backend');
        });
        
        // Also log full details to console
        console.log('📊 Full inspection data:', JSON.stringify(data.data, null, 2));
      } else if (data.type === 'DOM_DIAGNOSTICS') {
        console.log('📡 [DOM DEBUG] Result:', data.info);
        
        // Send to backend via new endpoint
        fetch(`${getEffectiveApiUrl()}/dataset/debug-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'DOM_DIAGNOSTICS', info: data.info })
        }).catch(err => console.warn('Diagnostic send failed:', err));

        Alert.alert('DIAGNOSTIC DATA', 'Technical info sent to backend.');
      } else if (data.type === 'REFRESH_BUTTON_SCAN') {
        console.log('🔍 [REFRESH SCAN] Results:', data.data);
        
        // Send to backend for analysis
        fetch(`${getEffectiveApiUrl()}/dataset/debug-log`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'REFRESH_BUTTON_SCAN', info: data.data })
        }).catch(err => console.warn('Scan send failed:', err));
        
        const summary = `Found ${data.data.clickableElements.length} clickable elements near captcha`;
        Alert.alert('🔍 Scan Complete', summary + '\n\nData sent to backend for analysis.');
      } else if (data.type === 'CONSOLE_LOG') {
        console.log('🌐 [WEBVIEW]:', data.message);
      }
    } catch (e) {
      console.warn('Sidebar message parse error:', e);
    }
  };


  const handleSaveAndNext = async () => {
    if (!harvestText.trim()) return;
    if (!currentCaptcha) return;

    setIsExtracting(true);
    try {
      const response = await fetch(`${getEffectiveApiUrl()}/dataset/save-labeled`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: currentCaptcha,
          text: harvestText.toUpperCase().trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        setHarvestCount(prev => prev + 1);
        setHarvestText('');
        fetchNextCaptcha(true);
        // Keep focus for rapid entry
        setTimeout(() => {
            inputRef.current?.focus();
        }, 100);
      } else {
        Alert.alert('Error', data.error);
        setIsExtracting(false);
      }
    } catch (e) {
      Alert.alert('Network Error', e.message);
      setIsExtracting(false);
    }
  };

  const scanRefreshButton = () => {
    const scanScript = `
      (function() {
        try {
          const captchaImg = document.querySelector('img[alt="captcha"]');
          if (!captchaImg) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ 
              type: 'CONSOLE_LOG', 
              message: '⚠️ Captcha image not found' 
            }));
            return;
          }

          // Get all relevant information
          const results = {
            captchaInfo: {
              tag: captchaImg.tagName,
              src: captchaImg.src.substring(0, 100) + '...',
              alt: captchaImg.alt,
              id: captchaImg.id,
              className: captchaImg.className
            },
            parentInfo: null,
            siblings: [],
            clickableElements: []
          };

          // Scan parent
          const parent = captchaImg.parentElement;
          if (parent) {
            results.parentInfo = {
              tag: parent.tagName,
              id: parent.id,
              className: parent.className,
              childCount: parent.children.length,
              html: parent.outerHTML.substring(0, 500)
            };

            // Scan all siblings of the parent
            const parentSiblings = Array.from(parent.parentElement?.children || []);
            parentSiblings.forEach((sibling, idx) => {
              if (sibling !== parent) {
                results.siblings.push({
                  index: idx,
                  tag: sibling.tagName,
                  id: sibling.id,
                  className: sibling.className,
                  innerHTML: sibling.innerHTML.substring(0, 200),
                  hasOnclick: !!sibling.onclick || sibling.hasAttribute('onclick'),
                  onclickStr: sibling.getAttribute('onclick') || 'none'
                });
              }
            });
          }

          // Scan for ALL clickable elements in the vicinity
          const container = captchaImg.closest('.form-group, .captcha-container, div[class*="captcha"]') || captchaImg.parentElement?.parentElement;
          if (container) {
            const clickables = container.querySelectorAll('button, i, span, a, div[onclick], [class*="refresh"], [class*="reload"], [title*="refresh"], [title*="reload"]');
            clickables.forEach((el, idx) => {
              results.clickableElements.push({
                index: idx,
                tag: el.tagName,
                id: el.id,
                className: el.className,
                title: el.title || '',
                innerHTML: el.innerHTML.substring(0, 150),
                outerHTML: el.outerHTML.substring(0, 300),
                hasOnclick: !!el.onclick || el.hasAttribute('onclick'),
                onclickStr: el.getAttribute('onclick') || 'none',
                ariaLabel: el.getAttribute('aria-label') || 'none'
              });
            });
          }

          // Send to React Native
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'REFRESH_BUTTON_SCAN',
            data: results
          }));

        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ 
            type: 'CONSOLE_LOG', 
            message: '❌ Scan error: ' + e.message 
          }));
        }
      })();
      true;
    `;
    webViewRef.current?.injectJavaScript(scanScript);
  };

  const inspectTextElements = () => {
    const conditionNames = {
      'NOT_ALLOTTED': 'Not Allotted Message',
      'ALLOTTED': 'Allotted Message',
      'INVALID_CAPTCHA': 'Invalid Captcha Error'
    };
    
    const inspectionScript = generateDOMInspectionScript();
    webViewRef.current?.injectJavaScript(inspectionScript);
    
    Alert.alert(
      '🔍 DOM Inspection Started', 
      `Scanning for: ${conditionNames[selectedCondition]}\n\nMake sure the message is visible on screen!\n\nResults will be saved automatically.`
    );
  };

  useEffect(() => {
    if (visible && isHarvesting) {
        onWebViewMessage(() => handleInAppMessage);
    }
  }, [visible, isHarvesting]);

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

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
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
            
            <View style={styles.harvestSection}>
              <View style={styles.harvestHeader}>
                <Text style={styles.sectionHeader}>🎯 Harvest Mode</Text>
                <TouchableOpacity 
                  onPress={handleHarvestToggle}
                  style={[styles.toggleBtn, isHarvesting ? styles.toggleBtnActive : styles.toggleBtnInactive]}
                >
                  <Text style={styles.toggleText}>{isHarvesting ? 'ON' : 'OFF'}</Text>
                </TouchableOpacity>
              </View>

              {isHarvesting ? (
                <View style={styles.harvestControls}>
                  <View style={styles.statsRow}>
                    <Text style={styles.statLabel}>Collected: <Text style={styles.statVal}>{harvestCount}</Text></Text>
                    <TouchableOpacity onPress={() => fetchNextCaptcha(true)}>
                      <Ionicons name="refresh-circle" size={24} color="#2575fc" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.captchaBox}>
                    {isExtracting ? (
                      <ActivityIndicator size="small" color="#2575fc" />
                    ) : currentCaptcha ? (
                      <Image 
                        source={{ uri: currentCaptcha }} 
                        style={styles.harvestImg} 
                        resizeMode="contain"
                      />
                    ) : (
                        <Text style={styles.placeholderText}>Capturing...</Text>
                    )}
                  </View>

                  <View style={styles.inputRow}>
                    <View style={styles.textInputWrapper}>
                        <Text style={styles.inputLabel}>ENTER TEXT</Text>
                        <TextInput
                            ref={inputRef}
                            style={styles.harvestInput}
                            value={harvestText}
                            onChangeText={setHarvestText}
                            placeholder="ABC123"
                            autoCapitalize="characters"
                            maxLength={6}
                            keyboardType="numeric"
                            blurOnSubmit={false}
                            onSubmitEditing={handleSaveAndNext}
                        />
                    </View>
                    <TouchableOpacity 
                        style={[styles.saveBtn, !harvestText && styles.btnDisabled]} 
                        onPress={handleSaveAndNext}
                        disabled={!harvestText || isExtracting}
                    >
                        <Ionicons name="send" size={24} color="white" />
                    </TouchableOpacity>
                </View>
                </View>
              ) : (
                <Text style={styles.harvestTip}>Enable to collect & label captchas for your custom ML model.</Text>
              )}
            </View>

            <View style={styles.appInfoSection}>
               <Text style={styles.sectionHeader}>System Overrides</Text>
               
               <TouchableOpacity 
                  style={[styles.syncButton, { backgroundColor: '#FF9500', marginTop: 10 }]} 
                  onPress={() => fetchNextCaptcha(true)}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text style={styles.syncButtonText}>FORCE REFRESH</Text>
                </TouchableOpacity>

               <TouchableOpacity 
                  style={[styles.syncButton, { backgroundColor: '#9C27B0', marginTop: 10 }]} 
                  onPress={scanRefreshButton}
                >
                  <Ionicons name="search" size={20} color="white" />
                  <Text style={styles.syncButtonText}>SCAN REFRESH BUTTON</Text>
                </TouchableOpacity>

               {/* DOM Inspection Section */}
               <View style={{ marginTop: 20, marginBottom: 10 }}>
                 <Text style={styles.sectionHeader}>🔍 DOM Inspection</Text>
                 <Text style={styles.inputLabel}>SELECT CONDITION TO SCAN</Text>
                 <View style={styles.toggleWrapper}>
                   <TouchableOpacity 
                     style={[styles.toggleOption, selectedCondition === 'NOT_ALLOTTED' && styles.toggleActive]}
                     onPress={() => setSelectedCondition('NOT_ALLOTTED')}
                   >
                     <Text style={[styles.toggleText, selectedCondition === 'NOT_ALLOTTED' && styles.toggleTextActive]}>❌ Not Allotted</Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={[styles.toggleOption, selectedCondition === 'ALLOTTED' && styles.toggleActive]}
                     onPress={() => setSelectedCondition('ALLOTTED')}
                   >
                     <Text style={[styles.toggleText, selectedCondition === 'ALLOTTED' && styles.toggleTextActive]}>🎉 Allotted</Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={[styles.toggleOption, selectedCondition === 'INVALID_CAPTCHA' && styles.toggleActive]}
                     onPress={() => setSelectedCondition('INVALID_CAPTCHA')}
                   >
                     <Text style={[styles.toggleText, selectedCondition === 'INVALID_CAPTCHA' && styles.toggleTextActive]}>⚠️ Invalid</Text>
                   </TouchableOpacity>
                 </View>
               </View>

               <TouchableOpacity 
                  style={[styles.syncButton, { backgroundColor: '#FF5722', marginTop: 10 }]} 
                  onPress={inspectTextElements}
                >
                  <Ionicons name="search-outline" size={20} color="white" />
                  <Text style={styles.syncButtonText}>SCAN CURRENT CONDITION</Text>
                </TouchableOpacity>

               <View style={styles.overrideBox}>
                  <Text style={styles.inputLabel}>BACKEND URL</Text>
                  <TextInput 
                    style={styles.overrideInput}
                    value={backendOverride}
                    onChangeText={saveBackendOverride}
                    placeholder="http://192.168.1.XX:3000/api"
                    autoCapitalize="none"
                  />
                  <Text style={styles.overrideTip}>Current: {getEffectiveApiUrl()} (Must end with /api)</Text>
               </View>

               <TouchableOpacity 
                  style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]} 
                  onPress={handleSyncData}
                  disabled={isSyncing}
               >
                 {isSyncing ? (
                   <ActivityIndicator size="small" color="white" />
                 ) : (
                   <Ionicons name="cloud-download-outline" size={20} color="white" />
                 )}
                 <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing...' : 'Refresh Online Data'}</Text>
               </TouchableOpacity>

               {lastSyncedAt && (
                 <Text style={styles.lastSyncedText}>
                   Last Synced: {new Date(lastSyncedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                 </Text>
               )}
            </View>

            <View style={styles.iconRow}>
               <TouchableOpacity onPress={() => openLink('https://github.com/rajeevyadavofficial')}>
                <FontAwesome name="github" size={32} color="#333" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://www.linkedin.com/in/rajeev-yadav-936853259/')}>
                <FontAwesome name="linkedin-square" size={32} color="#0077B5" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openLink('https://www.instagram.com/iiam.rajeev/')}>
                <FontAwesome name="instagram" size={32} color="#C13584" style={styles.icon} />
              </TouchableOpacity>
              <TouchableOpacity onPress={sendEmail}>
                <MaterialIcons name="email" size={32} color="#D44638" style={styles.icon} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.qrContainer}>
              <QRCode value={portfolioUrl} size={100} color="#2575fc" backgroundColor="#fff" />
              <Text style={styles.qrCaption}>Scan for Portfolio</Text>
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
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  icon: {
    marginVertical: 10,
    marginHorizontal: 8,
  },
  appInfoSection: {
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 20,
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: '#6200EE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 10,
    marginBottom: 20,
    elevation: 2,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  lastSyncedText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
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
  harvestSection: {
    backgroundColor: '#f8f9fa',
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  harvestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    minWidth: 50,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: '#28a745',
  },
  toggleBtnInactive: {
    backgroundColor: '#6c757d',
  },
  toggleText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  harvestControls: {
    gap: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
  },
  statVal: {
    fontWeight: 'bold',
    color: '#333',
  },
  captchaBox: {
    height: 80,
    backgroundColor: 'white',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  harvestImg: {
    width: '100%',
    height: '100%',
  },
  placeholderText: {
    color: '#adb5bd',
    fontSize: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
  },
  textInputWrapper: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 10,
    color: '#6c757d',
    fontWeight: 'bold',
    marginBottom: 4,
    marginLeft: 4,
  },
  harvestInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#ced4da',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#212529',
    letterSpacing: 2,
  },
  saveBtn: {
    backgroundColor: '#2575fc',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
  },
  btnDisabled: {
    backgroundColor: '#adb5bd',
  },
  harvestTip: {
    fontSize: 12,
    color: '#6c757d',
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 18,
  },
  overrideBox: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#dee2e6',
    marginBottom: 20,
  },
  overrideInput: {
    fontSize: 14,
    color: '#212529',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#2575fc',
    marginBottom: 6,
  },
  overrideTip: {
    fontSize: 10,
    color: '#6c757d',
    fontStyle: 'italic',
  },
  debugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF3B30',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

