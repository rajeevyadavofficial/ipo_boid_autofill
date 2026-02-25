import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Share,
  Modal,
  FlatList,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  generateCaptchaExtractionScript, 
  generateFinalSubmissionScript,
  generateCompanySelectionScript,
  reloadForFreshCaptcha, 
  fetchIPOsDirectly
} from '../../utils/BulkCheckStrategy';
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiBaseUrl } from '../../utils/config';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export default function BulkCheckPanel({ 
  savedBoids, 
  ipoName, 
  webViewRef,
  visible,
  results,
  setResults,
  onModeChange,
  onWebViewMessage, 
  autoCheckBoid, 
  onAutoCheckComplete,
  useAiModel,
  setUseAiModel
}) {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState('selection'); 



  // Notify parent when viewMode changes
  useEffect(() => {
    onModeChange?.(viewMode);
  }, [viewMode, onModeChange]);

  const viewShotRef = useRef(null);
  const [isSharing, setIsSharing] = useState(false);
  const [capturedImageUri, setCapturedImageUri] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [bulkCheckState, setBulkCheckState] = useState({
    progress: 0,
    currentIndex: 0,
    currentCaptcha: null, 
    currentCaptchaImage: null, 
    results: [],
    summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0, totalShares: 0 },
    currentCheckingNickname: '',
    currentCheckingBoid: ''
  });

  const [manualPrompt, setManualPrompt] = useState({
    visible: false,
    imageBase64: null,
    boid: '',
    nickname: '',
    resolvePromise: null,
    error: ''
  });
  const [manualInput, setManualInput] = useState('');

  const messageHandlerRef = useRef(null);

  // Dispatch message to the active handler
  const handleWebViewMessage = async (event) => {
    let data;
    try {
      data = JSON.parse(event.nativeEvent.data);
    } catch (e) { return; }



    if (messageHandlerRef.current) {
      messageHandlerRef.current(event);
    }
  };

  // Register our handler with the bridge
  useEffect(() => {
    if (onWebViewMessage) {
      onWebViewMessage(() => handleWebViewMessage);
    }
  }, [onWebViewMessage]);

  // Handle individual auto-check request
  useEffect(() => {
    if (autoCheckBoid && viewMode === 'selection') {
      console.log(`🚀 [Single] Individual auto-check triggered for: ${autoCheckBoid}`);
      handleBulkCheck([autoCheckBoid]);
    }
  }, [autoCheckBoid]);

  const handleBulkCheck = async (specificBoids = null) => {
    // FIX: onPress passes an event object, so we must check if specificBoids is actually an array
    const isArray = Array.isArray(specificBoids);
    const targetBoids = isArray ? specificBoids : savedBoids;
    
    if (targetBoids.length === 0) {
      alert('No BOIDs saved. Please add BOIDs first.');
      return;
    }

    setViewMode('checking');
    setCapturedImageUri(null); // Clear previous image
    setBulkCheckState({
      progress: 0,
      currentIndex: 0,
      results: [],
      summary: { total: targetBoids.length, allotted: 0, notAllotted: 0, errors: 0, totalShares: 0 },
      currentCheckingNickname: '',
      currentCheckingBoid: ''
    });

    const API_URL = getApiBaseUrl();

    // STEP 0: Auto-select company if ipoName is provided
    if (ipoName) {
      console.log(`[Bulk] Step 0: Auto-selecting company "${ipoName}"`);
      const selectionScript = generateCompanySelectionScript(ipoName);
      webViewRef.current?.injectJavaScript(selectionScript);
      await sleep(2000); // Wait for dropdown animation and selection to settle
    }

    for (let i = 0; i < targetBoids.length; i++) {
      const boidObj = targetBoids[i];
      const boidString = typeof boidObj === 'string' ? boidObj : boidObj.boid;
      // Clear previous captcha image when starting new BOID
      setBulkCheckState(prev => ({ 
        ...prev, 
        currentIndex: i, 
        progress: Math.round((i / targetBoids.length) * 100),
        currentCaptchaImage: null,
        currentCaptcha: null,
        currentCheckingNickname: boidObj?.nickname || 'Unknown',
        currentCheckingBoid: boidString
      }));

      let attempts = 0;
      const MAX_ATTEMPTS = 3;
      let success = false;

      while (attempts < MAX_ATTEMPTS && !success) {
        attempts++;
        try {
          // STEP 1: Surgical Extraction (refresh captcha if NOT first attempt of first BOID)
          const isFirstEver = (i === 0 && attempts === 1);
          const shouldRefresh = !isFirstEver;
          
          if (attempts > 1) {
            console.log(`[Bulk] 🔄 Retry Attempt ${attempts} for ${boidString}...`);
          }
          
          console.log(`[Bulk] Step 1: Extracting Captcha for ${boidString} (Refresh: ${shouldRefresh})`);
          const extractScript = generateCaptchaExtractionScript(boidString, shouldRefresh);
          webViewRef.current?.injectJavaScript(extractScript);

          const extractionMsg = await waitForMessage('CAPTCHA_IMAGE_READY', boidString, 15000);
          
          // Update UI with zoomed captcha image immediately
          setBulkCheckState(prev => ({ ...prev, currentCaptchaImage: extractionMsg.imageBase64 }));
          
          let finalCaptcha = "";
          let solveSuccess = false;

          // STEP 2: Solve (AI or Manual)
          if (useAiModel) {
            console.log(`[Bulk] Step 2: Solving Captcha via TrOCR Engine for ${boidString}`);
            try {
              const formData = new FormData();
              formData.append('image', {
                uri: `data:${extractionMsg.mimeType};base64,${extractionMsg.imageBase64}`,
                name: 'captcha.png',
                type: extractionMsg.mimeType
              });

              const solveResponse = await fetch(`${API_URL}/captcha/solve`, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
              });

              const rawResponse = await solveResponse.text();
              const solveData = JSON.parse(rawResponse);
              
              if (solveData.success) {
                console.log(`✅ [Bulk] Captcha solved via AI: ${solveData.captchaText}`);
                finalCaptcha = solveData.captchaText;
                setBulkCheckState(prev => ({ ...prev, currentCaptcha: finalCaptcha }));
                if (finalCaptcha.length === 5) solveSuccess = true;
              }
            } catch (err) {
              console.warn(`⚠️ [Bulk] AI Solve failed: ${err.message}`);
            }
          } else {
            console.log(`[Bulk] AI Model disabled. Skipping to manual entry...`);
          }

          // --- MANUAL FALLBACK TRIGGER ---
          // If AI is off, or AI solve failed/looks invalid
          let needsManual = !useAiModel || !solveSuccess || finalCaptcha.length !== 5;
          
          if (needsManual) {
            // Automatic retry if AI solve just looked junk but we have attempts left
            if (useAiModel && attempts < MAX_ATTEMPTS && !solveSuccess) {
              console.log(`📡 [Bulk] AI solve junk. Retrying ${attempts}/${MAX_ATTEMPTS}...`);
              await sleep(1000);
              continue;
            }

            console.log(`📡 [Bulk] Triggering Manual Fallback...`);
            const manualCode = await new Promise((resolve) => {
              setManualPrompt({
                visible: true,
                imageBase64: extractionMsg.imageBase64,
                boid: boidString,
                nickname: boidObj?.nickname || 'Unknown',
                resolvePromise: resolve,
                error: attempts > 1 ? 'Incorrect captcha. Please try again.' : ''
              });
            });
            
            if (manualCode) {
              finalCaptcha = manualCode;
              console.log(`🧑‍💻 [Manual] User provided code: ${finalCaptcha}`);
            } else {
              // Mark as skipped instead of error
              handleResult({
                boid: boidString,
                nickname: boidObj?.nickname || 'Unknown',
                status: 'skipped',
                success: false
              });
              success = true; // Break retry loop
              continue;
            }
          }

          // STEP 3: Final Submission
          console.log(`[Bulk] Step 3: Submitting form for ${boidString}`);
          const submitScript = generateFinalSubmissionScript(boidString, finalCaptcha);
          webViewRef.current?.injectJavaScript(submitScript);

          const resultMsg = await waitForMessage('BULK_CHECK_RESULT', boidString, 20000);
          console.log(`[Bulk] 📩 Result received for ${boidString}:`, JSON.stringify(resultMsg));
          
          // Check for captcha-specific errors from the site
          const lowerError = (resultMsg.error || '').toLowerCase();
          const isCaptchaError = resultMsg.status === 'error' && (
            lowerError.includes('captcha') || 
            lowerError.includes('try again') || 
            lowerError.includes('incorrect')
          );

          if (isCaptchaError) {
             if (attempts < MAX_ATTEMPTS) {
                console.log(`⚠️ [Bulk] Captcha error detected. Retrying ${attempts}/${MAX_ATTEMPTS}...`);
                continue; 
             } else {
                console.log(`📡 [Bulk] 3 failures reached. Switching to Manual Fallback for current BOID...`);
                const manualCode = await new Promise((resolve) => {
                  setManualPrompt({
                    visible: true,
                    imageBase64: extractionMsg.imageBase64,
                    boid: boidString,
                    nickname: boidObj?.nickname || 'Unknown',
                    resolvePromise: resolve,
                    error: 'Incorrect captcha. Please try again.'
                  });
                });
                
                if (manualCode) {
                  console.log(`🧑‍💻 [Manual] User provided code after 3 attempts: ${manualCode}`);
                  const subScript = generateFinalSubmissionScript(boidString, manualCode);
                  webViewRef.current?.injectJavaScript(subScript);
                  const manualResult = await waitForMessage('BULK_CHECK_RESULT', boidString, 20000);
                  handleResult(manualResult);
                  success = true;
                  continue;
                } else {
                  // Mark as skipped
                  handleResult({
                    boid: boidString,
                    nickname: boidObj?.nickname || 'Unknown',
                    status: 'skipped',
                    success: false
                  });
                  success = true;
                  continue;
                }
             }
          }

          handleResult(resultMsg);
          success = true; // Mark as done to break while loop

        } catch (err) {
          console.error(`❌ [Bulk] Loop Error for ${boidString}:`, err);
          handleResult({
            boid: boidString,
            status: 'error',
            error: err.message,
            success: false
          });
          success = true;
        }
      }

      // Pacing delay (respecting rate limits)
      if (i < targetBoids.length - 1) {
        const delay = 1000;
        await sleep(delay);
      }
    }

    setBulkCheckState(prev => ({ ...prev, progress: 100, currentCheckingBoid: '', currentCheckingNickname: '' }));
    if (onAutoCheckComplete) onAutoCheckComplete();
    
    // AUTO-GENERATE SHARE CARD AFTER FINISHING
    setTimeout(async () => {
      try {
        if (!viewShotRef.current) {
          console.warn('[Bulk] viewShotRef not ready, retrying...');
          await sleep(500);
          if (!viewShotRef.current) throw new Error('ViewShot ref still null');
        }
        
        const uri = await captureRef(viewShotRef, {
          format: 'png',
          quality: 0.9,
        });
        setCapturedImageUri(uri);
        setViewMode('results');
        setShowPreviewModal(true); // Open popup automatically
      } catch (captureErr) {
        console.error('Capture error:', captureErr);
        setViewMode('results'); 
      }
    }, 1000);
  };

  // Generic message waiter
  const waitForMessage = (type, boid, timeoutMs) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        messageHandlerRef.current = null;
        reject(new Error(`Timeout waiting for ${type}`));
      }, timeoutMs);

      messageHandlerRef.current = (event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === type && data.boid === boid) {
            clearTimeout(timeout);
            messageHandlerRef.current = null;
            resolve(data);
          } else if (data.type === 'BULK_CHECK_RESULT' && data.status === 'error' && data.boid === boid) {
            // Catch error messages even if we were waiting for IMAGE_READY
            clearTimeout(timeout);
            messageHandlerRef.current = null;
            reject(new Error(data.error));
          }
        } catch (e) {
          console.error('Parse error:', e);
        }
      };
    });
  };

  const handleShareResult = async () => {
    try {
      console.log('📤 Starting share process. URI:', capturedImageUri);
      if (!capturedImageUri) {
        Toast.show({
          type: 'error',
          text1: 'No image found',
          text2: 'Please wait for the report to generate.'
        });
        return;
      }

      setIsSharing(true);

      if (!(await Sharing.isAvailableAsync())) {
        Toast.show({
          type: 'error',
          text1: 'Sharing not available',
          text2: 'Your device does not support sharing.'
        });
        return;
      }

      let sharePath = capturedImageUri;
      try {
        // Attempt to rename for a professional experience
        const customPath = `${FileSystem.cacheDirectory}Ipo_result.png`;
        await FileSystem.copyAsync({
          from: capturedImageUri,
          to: customPath
        });
        sharePath = customPath;
        console.log('✅ Renamed image for sharing:', sharePath);
      } catch (copyErr) {
        console.warn('⚠️ Rename failed, falling back to original URI:', copyErr.message);
      }

      await Sharing.shareAsync(sharePath, {
        mimeType: 'image/png',
        dialogTitle: 'Share IPO Results',
        UTI: 'public.png',
      });
    } catch (err) {
      console.error('❌ Share error:', err);
      Toast.show({
        type: 'error',
        text1: 'Sharing Failed',
        text2: err.message
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveToLibrary = async () => {
    try {
      if (!capturedImageUri) return;
      
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Gallery access is required to save results'
        });
        return;
      }

      await MediaLibrary.saveToLibraryAsync(capturedImageUri);
      Toast.show({
        type: 'success',
        text1: 'Saved to Gallery',
        text2: 'IPO Result image has been saved'
      });
    } catch (err) {
      console.error('Save error:', err);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: err.message
      });
    }
  };

  const maskBoid = (boid) => {
    if (!boid || boid.length < 16) return boid;
    return boid.substring(0, 6) + '********' + boid.substring(14);
  };

  const handleResult = (data) => {
    const matchingBoid = savedBoids.find(b => b.boid === data.boid);
    const nickname = matchingBoid?.nickname || data.nickname || 'Unknown';

    // Centralized Status Labeling
    let finalStatus = data.status;
    if (finalStatus === 'error' || !finalStatus) {
      const lowerErr = (data.error || '').toLowerCase();
      if (lowerErr.includes('captcha') || lowerErr.includes('try again') || lowerErr.includes('incorrect')) {
        finalStatus = 'captcha-error';
      } else {
        finalStatus = 'error';
      }
    }

    const resultItem = { ...data, status: finalStatus, nickname };

    setBulkCheckState(prev => {
      const newResults = [...prev.results, resultItem];
      
      // Detailed Summary Counts
      const allotted = newResults.filter(r => r.status === 'allotted').length;
      const notAllotted = newResults.filter(r => r.status === 'not-allotted').length;
      const skipped = newResults.filter(r => r.status === 'skipped').length;
      const captchaErrors = newResults.filter(r => r.status === 'captcha-error').length;
      const genericErrors = newResults.filter(r => r.status === 'error').length;

      const newSummary = {
        total: prev.summary.total,
        allotted,
        notAllotted,
        skipped,
        captchaErrors,
        errors: genericErrors,
        totalShares: newResults.reduce((sum, r) => sum + (r?.shares || 0), 0)
      };

      return {
        ...prev,
        results: newResults,
        summary: newSummary,
        progress: (newResults.length / prev.summary.total) * 100,
        currentIndex: prev.currentIndex + 1,
        currentCheckingNickname: '',
        currentCheckingBoid: '',
        currentCaptchaImage: '',
        currentCaptcha: ''
      };
    });

    // Update parent global results for the list labels
    if (setResults && data.status !== 'error') {
      const resultText = data.status === 'allotted' 
        ? `🎉 Congratulations Alloted!!! Alloted quantity : ${data.shares}` 
        : `❌ Sorry, not alloted for the entered BOID.`;

      setResults((prevResults) => {
        const index = prevResults.findIndex((item) => item.boid === data.boid);
        
        if (index >= 0) {
          const updated = [...prevResults];
          updated[index].result = resultText;
          return updated;
        }
        
        return [
          ...prevResults,
          {
            boid: data.boid,
            nickname: matchingBoid?.nickname || null,
            result: resultText,
          },
        ];
      });
    }
  };





  const getStatusIcon = (status) => {
    switch (status) {
      case 'allotted':
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'not-allotted':
        return <Ionicons name="close-circle" size={20} color="#F44336" />;
      case 'skipped':
        return <Ionicons name="play-skip-forward-circle" size={20} color="#9E9E9E" />;
      case 'captcha-error':
        return <Ionicons name="alert-circle" size={20} color="#FF9800" />;
      case 'error':
        return <Ionicons name="alert-circle" size={20} color="#FF9800" />;
      default:
        return <ActivityIndicator size="small" color="#6200EE" />;
    }
  };


  return (
    <View style={panelStyles.container}>
      {/* 1. SELECTION MODE: User selects company in WebView */}
      {viewMode === 'selection' && (
        <View style={panelStyles.selectionView}>
          <View style={panelStyles.instructionContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#6200EE" />
            <Text style={panelStyles.instructionText}>
              Please select the <Text style={panelStyles.bold}>IPO Company</Text> from the dropdown in the website above.
            </Text>
          </View>

          {/* New Toggle Placement */}
          <TouchableOpacity 
            onPress={() => setUseAiModel(!useAiModel)}
            style={{ 
              backgroundColor: useAiModel ? '#F3E5F5' : '#F5F5F5', 
              marginHorizontal: 15, 
              padding: 12, 
              borderRadius: 12, 
              marginBottom: 15,
              borderWidth: 1,
              borderColor: useAiModel ? '#E1BEE7' : '#E0E0E0'
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="hardware-chip-outline" size={20} color={useAiModel ? "#6A1B9A" : "#757575"} />
                <Text style={{ fontWeight: 'bold', color: useAiModel ? '#4A148C' : '#616161', marginLeft: 8 }}>
                  High-Precision Solver
                </Text>
              </View>
              <View 
                style={{ 
                  width: 46, 
                  height: 24, 
                  backgroundColor: useAiModel ? '#6A1B9A' : '#BDBDBD', 
                  borderRadius: 12, 
                  padding: 2,
                  justifyContent: 'center',
                  alignItems: useAiModel ? 'flex-end' : 'flex-start'
                }}
              >
                <View style={{ width: 20, height: 20, backgroundColor: 'white', borderRadius: 10, elevation: 2 }} />
              </View>
            </View>
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'flex-start' }}>
               <Ionicons 
                 name={useAiModel ? "checkmark-circle" : "information-circle-outline"} 
                 size={14} 
                 color={useAiModel ? "#6A1B9A" : "#757575"} 
                 style={{ marginTop: 1 }} 
               />
               <Text style={{ fontSize: 11, color: useAiModel ? '#6A1B9A' : '#757575', marginLeft: 4, flex: 1, fontWeight: '600' }}>
                 {useAiModel ? "TrOCR Engine Enabled (94.24% Accuracy)" : "Use high-precision AI to skip manual captcha"}
               </Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity  
            style={panelStyles.bulkCheckButton}
            onPress={handleBulkCheck}
          >
            <Ionicons name="play" size={20} color="white" />
            <Text style={panelStyles.bulkCheckText}>Start Bulk Check</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. FULL SCREEN MODAL for CHECKING & RESULTS */}
      <Modal 
        visible={viewMode === 'checking' || viewMode === 'results'} 
        animationType="slide"
        onRequestClose={() => {
            if (viewMode === 'results') setViewMode('selection');
        }}
      >
        <View style={[panelStyles.fsContainer, { paddingTop: insets.top }]}>
          {/* HIDDEN BRANDED SHARE CARD FOR VIEWSHOT - MOVED OUTSIDE CONDITIONAL TO PREVENT HANGS */}
          <View style={{ position: 'absolute', opacity: 0, left: -5000 }}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
              <View style={panelStyles.shareCard}>
                <LinearGradient
                  colors={['#6200EE', '#4A148C']}
                  style={panelStyles.shareCardHeader}
                >
                  <Image source={require('../../assets/icon.png')} style={panelStyles.shareLogo} />
                  <View>
                    <Text style={panelStyles.shareAppName}>IPO RESULT - BOID AUTOFILLER</Text>
                    <Text style={panelStyles.shareAppTagline}>Check results with confidence</Text>
                  </View>
                </LinearGradient>

                <View style={panelStyles.shareCardBody}>
                  <Text style={panelStyles.shareCardTitle}>IPO Allotment Status</Text>
                  <View style={panelStyles.summaryGridSmall}>
                    <View style={panelStyles.shareSumItem}>
                      <Text style={[panelStyles.shareSumCount, { color: '#10B981' }]}>{bulkCheckState.summary.allotted}</Text>
                      <Text style={panelStyles.shareSumLabel}>Allotted</Text>
                    </View>
                    <View style={panelStyles.shareSumItem}>
                      <Text style={[panelStyles.shareSumCount, { color: '#6B7280' }]}>{bulkCheckState.summary.total}</Text>
                      <Text style={panelStyles.shareSumLabel}>Total Checked</Text>
                    </View>
                  </View>

                      {/* Summary Emotive Message */}
                      <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ 
                          fontSize: 24, 
                          fontWeight: 'bold', 
                          color: bulkCheckState.summary.allotted > 0 ? '#059669' : '#DC2626',
                          textAlign: 'center'
                        }}>
                          {bulkCheckState.summary.allotted > 0 ? "Congratulations! 🎉" : "Better luck next time! 🍀"}
                        </Text>
                        <Text style={{ color: '#6B7280', fontSize: 13, marginTop: 4 }}>
                          {bulkCheckState.summary.allotted > 0 
                            ? `You got allotted in ${bulkCheckState.summary.allotted} account(s)!` 
                            : "No allotment found in any of the accounts."}
                        </Text>
                      </View>

                      {/* All Results List - Card Styled Synchronized with Screen */}
                      {bulkCheckState.results.map((item, idx) => {
                        const isAllotted = item.status === 'allotted';
                        const isSkipped = item.status === 'skipped';
                        const isError = item.status === 'error' || item.status === 'captcha-error';
                        
                        let statusColor = '#EF4444'; // default red
                        if (isAllotted) statusColor = '#10B981';
                        if (isSkipped) statusColor = '#9E9E9E';
                        if (item.status === 'captcha-error') statusColor = '#FF9800';

                        let statusLabel = 'Not Allotted';
                        if (isAllotted) statusLabel = `Allotted: ${item.shares} Units`;
                        if (isSkipped) statusLabel = 'Skipped';
                        if (item.status === 'captcha-error') statusLabel = 'Captcha Error';

                        return (
                          <View key={idx} style={[panelStyles.resultCard, { marginBottom: 8, elevation: 0, borderWidth: 1, borderColor: '#F3F4F6' }]}>
                            <View style={[
                              panelStyles.resultCardIndicator, 
                              { backgroundColor: statusColor }
                            ]} />
                            <View style={[panelStyles.resultCardContent, { padding: 8 }]}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View>
                                  <Text style={[panelStyles.resultCardNickname, { fontSize: 13 }]}>{item.nickname}</Text>
                                  <Text style={[panelStyles.resultCardBoid, { fontSize: 10 }]}>{maskBoid(item.boid)}</Text>
                                </View>
                                <View style={[
                                  panelStyles.resultBadge,
                                  { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: statusColor + '10' }
                                ]}>
                                  <Ionicons 
                                    name={isAllotted ? "trophy" : (isSkipped ? "play-skip-forward" : "close-circle-outline")} 
                                    size={10} 
                                    color={statusColor} 
                                  />
                                  <Text style={[
                                    panelStyles.resultBadgeText,
                                    { fontSize: 10, color: statusColor }
                                  ]}>
                                    {statusLabel}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                </View>

                <View style={panelStyles.shareCardFooter}>
                  <View style={panelStyles.shareFooterInfo}>
                    <Ionicons name="logo-google-playstore" size={12} color="#4B5563" />
                    <Text style={panelStyles.shareFooterText}>Download our app from Google Play Store</Text>
                  </View>
                </View>
              </View>
            </ViewShot>
          </View>

          {/* Header */}
          <View style={panelStyles.fsHeader}>
             <View>
               <Text style={panelStyles.fsTitle}>
                 {viewMode === 'checking' ? 'Bulk Check in Progress...' : 'Check Complete!'}
               </Text>

             </View>
             
             {viewMode === 'results' && (
               <TouchableOpacity onPress={() => setViewMode('selection')}>
                 <Ionicons name="close" size={24} color="#333" />
               </TouchableOpacity>
             )}
          </View>

          {/* Progress Bar */}
          <View style={panelStyles.fsProgressContainer}>
              <View style={[panelStyles.fsProgressFill, { width: `${bulkCheckState.progress}%` }]} />
          </View>

          {/* Current Status / Captcha */}
          {viewMode === 'checking' && (
            <View style={panelStyles.fsStatusSection}>
               <Text style={panelStyles.fsStatusText}>
                 Checking {bulkCheckState.currentIndex + 1} of {bulkCheckState.summary.total}
               </Text>
                <Text style={panelStyles.fsNickname}>
                  {bulkCheckState.currentCheckingNickname || bulkCheckState.currentCheckingBoid || '...'}
                </Text>
               
               {bulkCheckState.currentCaptchaImage ? (
                 <View style={panelStyles.fsCaptchaContainer}>
                    <Text style={panelStyles.fsCaptchaLabel}>Solving Captcha:</Text>
                    <Image 
                      source={{ uri: `data:image/png;base64,${bulkCheckState.currentCaptchaImage}` }} 
                      style={panelStyles.fsCaptchaImage}
                      resizeMode="contain"
                    />
                    {bulkCheckState.currentCaptcha && (
                      <Text style={panelStyles.fsCaptchaSolved}>Input: {bulkCheckState.currentCaptcha}</Text>
                    )}
                 </View>
               ) : (
                 <View style={{alignItems: 'center', marginVertical: 20}}>
                    <ActivityIndicator size="large" color="#6200EE" />
                    <Text style={{color: '#666', marginTop: 10}}>Extracting Captcha...</Text>
                 </View>
               )}
            </View>
          )}

          {/* RESULTS MODE - LIST VIEW RESTORED */}
          {viewMode === 'results' && (
            <View style={{ flex: 1 }}>
              <ScrollView 
                contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
              >
                <View style={[panelStyles.resultsHeader, { alignItems: 'center' }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[panelStyles.resultsTitle, { color: bulkCheckState.summary.allotted > 0 ? '#059669' : '#DC2626' }]}>
                        {bulkCheckState.summary.allotted > 0 ? "Congratulations! 🎉" : "Sorry, Better luck next time! 🍀"}
                      </Text>
                      <Text style={panelStyles.resultsSubtitle}>
                        {bulkCheckState.summary.allotted > 0 
                          ? `You were allotted in ${bulkCheckState.summary.allotted} account(s).` 
                          : "No allotment found in any accounts."}
                      </Text>
                    </View>
                   <View style={panelStyles.totalBadgeRefined}>
                      <Text style={panelStyles.totalBadgeValue}>{bulkCheckState.summary.total}</Text>
                      <Text style={panelStyles.totalBadgeLabel}>CHECKED</Text>
                   </View>
                </View>

                {/* Summary Section */}
                <View style={panelStyles.summaryGrid}>
                   <View style={[panelStyles.summaryCard, { backgroundColor: '#ECFDF5', borderColor: '#10B981' }]}>
                      <Ionicons name="checkmark-circle" size={20} color="#059669" />
                      <View>
                        <Text style={[panelStyles.summaryCount, { color: '#047857' }]}>{bulkCheckState.summary.allotted}</Text>
                        <Text style={panelStyles.summaryLabel}>Allotted</Text>
                      </View>
                   </View>
                   
                   <View style={[panelStyles.summaryCard, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                      <Ionicons name="close-circle" size={20} color="#DC2626" />
                      <View>
                        <Text style={[panelStyles.summaryCount, { color: '#B91C1C' }]}>{bulkCheckState.summary.notAllotted}</Text>
                        <Text style={panelStyles.summaryLabel}>Not Allotted</Text>
                      </View>
                   </View>
                </View>

                {/* Professional Result Cards */}
                <View style={{ marginBottom: 20 }}>
                  {bulkCheckState.results.map((item, index) => {
                    const isAllotted = item.status === 'allotted';
                    const isSkipped = item.status === 'skipped';
                    const isCaptchaErr = item.status === 'captcha-error';
                    
                    let statusColor = '#EF4444'; // Red
                    if (isAllotted) statusColor = '#10B981';
                    if (isSkipped) statusColor = '#9E9E9E';
                    if (isCaptchaErr) statusColor = '#FF9800';

                    let statusLabel = 'Not Allotted';
                    if (isAllotted) statusLabel = `Allotted: ${item.shares} Units`;
                    if (isSkipped) statusLabel = 'Skipped';
                    if (isCaptchaErr) statusLabel = 'Captcha Error';

                    return (
                      <View key={index} style={panelStyles.resultCard}>
                        <View style={[
                          panelStyles.resultCardIndicator, 
                          { backgroundColor: statusColor }
                        ]} />
                        <View style={panelStyles.resultCardContent}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                              <Text style={panelStyles.resultCardNickname}>{item.nickname}</Text>
                              <Text style={panelStyles.resultCardBoid}>{maskBoid(item.boid)}</Text>
                            </View>
                            <View style={[
                              panelStyles.resultBadge,
                              { backgroundColor: statusColor + '10' }
                            ]}>
                              <Ionicons 
                                name={isAllotted ? "trophy" : (isSkipped ? "play-skip-forward" : "close-circle-outline")} 
                                size={14} 
                                color={statusColor} 
                              />
                              <Text style={[
                                panelStyles.resultBadgeText,
                                { color: statusColor }
                              ]}>
                                {statusLabel}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>

              {/* REFINED ACTION BUTTONS (BOTTOM) */}
              <View style={[panelStyles.stickyFooter, { paddingBottom: Math.max(20, insets.bottom + 10) }]}>
                 <TouchableOpacity 
                   style={panelStyles.btnTakeScreenshot}
                   onPress={() => setShowPreviewModal(true)}
                 >
                   <Ionicons name="camera-outline" size={22} color="white" />
                   <Text style={panelStyles.btnTakeScreenshotText}>Take Screenshot</Text>
                 </TouchableOpacity>

                 <TouchableOpacity 
                   style={panelStyles.btnFinishRefined}
                   onPress={() => {
                     setViewMode('selection');
                     setShowPreviewModal(false);
                     setBulkCheckState({
                       progress: 0,
                       currentIndex: 0,
                       currentCaptcha: null,
                       currentCaptchaImage: null,
                       currentCheckingBoid: '',
                       currentCheckingNickname: '',
                       results: [],
                       summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0, totalShares: 0 }
                     });
                     setCapturedImageUri(null);
                   }}
                 >
                   <Text style={panelStyles.btnFinishRefinedText}>Done</Text>
                 </TouchableOpacity>
              </View>
            </View>
          )}

          {/* PREVIEW MODAL (POPUP) */}
          <Modal
            visible={showPreviewModal}
            transparent
            animationType="fade"
            onRequestClose={() => setShowPreviewModal(false)}
          >
            <View style={panelStyles.popupOverlay}>
               <View style={panelStyles.popupContent}>
                  <View style={panelStyles.popupHeader}>
                     <Text style={panelStyles.popupTitle}>Branded Report</Text>
                     <TouchableOpacity onPress={() => setShowPreviewModal(false)}>
                        <Ionicons name="close" size={24} color="#333" />
                     </TouchableOpacity>
                  </View>

                  {capturedImageUri ? (
                    <View style={panelStyles.popupImageContainer}>
                      <Image 
                        source={{ uri: capturedImageUri }} 
                        style={panelStyles.popupImage} 
                        resizeMode="contain"
                      />
                    </View>
                  ) : (
                    <View style={panelStyles.popupLoading}>
                      <ActivityIndicator color="#6200EE" size="large" />
                      <Text style={{ marginTop: 10, color: '#666' }}>Generating report...</Text>
                    </View>
                  )}

                  <View style={panelStyles.popupActions}>
                     <TouchableOpacity style={panelStyles.popupBtnDownload} onPress={handleSaveToLibrary}>
                       <Ionicons name="download-outline" size={20} color="#6200EE" />
                       <Text style={panelStyles.popupBtnDownloadText}>Save</Text>
                     </TouchableOpacity>

                     <TouchableOpacity style={panelStyles.popupBtnShare} onPress={handleShareResult} disabled={isSharing}>
                       <Ionicons name="logo-whatsapp" size={18} color="white" />
                       <Text style={panelStyles.popupBtnShareText}>Share</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
          </Modal>
        </View>

        {manualPrompt.visible && (
          <View style={[StyleSheet.absoluteFill, panelStyles.manualModalOverlay, { zIndex: 9999, paddingTop: insets.top + 20 }]}>
             <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ flex: 1 }}
            >
              <ScrollView 
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                contentContainerStyle={{ padding: 20 }}
              >
                <View style={panelStyles.manualModalContent}>
                  <Text style={panelStyles.manualNickname}>
                    {manualPrompt.nickname || 'Checking...'}
                  </Text>

                  {manualPrompt.error ? (
                    <Text style={panelStyles.manualErrorText}>
                      {manualPrompt.error}
                    </Text>
                  ) : null}
                  
                  {manualPrompt.imageBase64 && (
                    <View style={panelStyles.captchaDisplayContainer}>
                       <View style={panelStyles.captchaFrame}>
                          <Image 
                             source={{ uri: `data:image/png;base64,${manualPrompt.imageBase64}` }} 
                             style={{ width: 260, height: 100 }} 
                             resizeMode="contain"
                          />
                       </View>
                    </View>
                  )}

                  <TextInput
                    style={panelStyles.manualInput}
                    placeholder="Enter 5 Digits"
                    keyboardType="number-pad"
                    maxLength={5}
                    value={manualInput}
                    onChangeText={(text) => {
                      setManualInput(text);
                      if (text.length === 5) {
                        // Auto-submit on 5th digit!
                        setTimeout(() => {
                          manualPrompt.resolvePromise(text);
                          setManualPrompt(prev => ({ ...prev, visible: false, error: '' }));
                          setManualInput('');
                        }, 100); 
                      }
                    }}
                    autoFocus
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                      if (manualInput.length === 5) {
                        manualPrompt.resolvePromise(manualInput);
                        setManualPrompt(prev => ({ ...prev, visible: false }));
                        setManualInput('');
                      }
                    }}
                  />

                  <View style={panelStyles.manualActions}>
                    <TouchableOpacity 
                      style={[panelStyles.manualCancel, { width: '100%', borderRightWidth: 0 }]}
                      onPress={() => {
                        manualPrompt.resolvePromise(null);
                        setManualPrompt(prev => ({ ...prev, visible: false, error: '' }));
                        setManualInput('');
                      }}
                    >
                      <Text style={panelStyles.manualCancelText}>Skip This Account</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        )}
      </Modal>

    </View>
  );
}

const panelStyles = StyleSheet.create({
  // New Styles for Selection View
  selectionView: {
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 12,
  },
  instructionContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#312E81',
    lineHeight: 20,
    flex: 1,
  },
  bold: {
    fontWeight: 'bold',
    color: '#6200EE',
  },
  providerContainer: {
    marginBottom: 16,
  },
  providerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  toggleWrapper: {
    flexDirection: 'row',
    backgroundColor: '#E0E7FF',
    borderRadius: 8,
    padding: 4,
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  toggleActive: {
    backgroundColor: 'white',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '500', 
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#6200EE',
    fontWeight: '700',
  },
  bulkCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    padding: 14,
    borderRadius: 10,
    gap: 8,
    elevation: 3,
  },
  bulkCheckText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 10,
  },
  progressBar: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
  },
  progressDetail: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'right',
  },
  // PREVIEW STYLES
  previewContainer: {
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6200EE',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  generatingCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  generatingText: {
    marginTop: 15,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '600',
  },

  // SHARE CARD STYLES (HIDDEN)
  shareCard: {
    width: 320,
    backgroundColor: 'white',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  shareCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    gap: 12,
  },
  shareLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'white',
  },
  shareAppName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  shareAppTagline: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 9,
    fontWeight: '600',
  },
  shareCardBody: {
    padding: 20,
  },
  shareCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 15,
  },
  summaryGridSmall: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  shareSumItem: {
    alignItems: 'center',
  },
  shareSumCount: {
    fontSize: 24,
    fontWeight: '900',
  },
  shareSumLabel: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  shareResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    paddingLeft: 10,
  },
  shareResultText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  shareCardFooter: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  shareFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareFooterText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#4B5563',
  },

  // STICKY BOTTOM ACTIONS
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    padding: 16,
    flexDirection: 'row',
    gap: 10,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  btnDownload: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  btnShare: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    borderRadius: 12,
    gap: 8,
  },
  btnShareText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnFinish: {
    flex: 1,
    backgroundColor: '#6200EE',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnFinishText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },

  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  resultsTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },
  resultsSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  batchBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  batchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
  },
  summaryCount: {
    fontSize: 18,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#4B5563',
    fontWeight: '500',
  },
  resultsList: {
    maxHeight: 300,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  resultStatusDot: (allotted) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: allotted ? '#10B981' : '#EF4444',
  }),
  resultDetails: {
    flex: 1,
  },
  resultBoid: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
  },
  nicknameBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nicknameBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4B5563',
    textTransform: 'uppercase',
  },
  resultStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  shareImageButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    borderWidth: 1.5,
    borderColor: '#6200EE',
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareImageButtonText: {
    color: '#6200EE',
    fontSize: 14,
    fontWeight: 'bold',
  },
  doneButtonFull: {
    flex: 1,
    backgroundColor: '#6200EE',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  checkingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: '#F5F3FF',
    borderRadius: 10,
    marginTop: 10,
  },
  checkingIndicatorText: {
    fontSize: 13,
    color: '#6200EE',
    fontWeight: '600',
  },
  // Manual Modal Styles
   manualModalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0,0,0,0.7)', 
     justifyContent: 'flex-start',
   },
  manualModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  manualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  manualTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#6200EE',
  },
  manualSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 20,
  },
  manualNickname: {
    fontSize: 22,
    fontWeight: '900',
    color: '#6200EE',
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  captchaDisplayContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  captchaFrame: {
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    fontStyle: 'italic',
  },
  manualInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 15,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 20,
    color: '#111827',
  },
  manualActions: {
    flexDirection: 'row',
    gap: 12,
  },
  manualCancel: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
  },
  manualCancelText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  manualSubmit: {
    flex: 2,
    backgroundColor: '#6200EE',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualSubmitDisabled: {
    backgroundColor: '#D1D5DB',
  },
  manualSubmitText: {
    color: 'white',
    fontWeight: 'bold',
  },
  // Full Screen Modal Styles
  fsContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  fsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  fsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  fsProgressContainer: {
    height: 4,
    backgroundColor: '#E5E7EB',
    width: '100%',
  },
  fsProgressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
  },
  fsStatusSection: {
    backgroundColor: 'white',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    marginBottom: 10,
  },
  fsStatusText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  fsNickname: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 15,
  },
  fsCaptchaContainer: {
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    width: '100%',
  },
  fsCaptchaLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  fsCaptchaImage: {
    width: 200,
    height: 80,
    marginBottom: 10,
    backgroundColor: 'white',
    borderRadius: 4,
  },
  fsCaptchaSolved: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  fsListContainer: {
    flex: 1,
    backgroundColor: 'white',
    paddingHorizontal: 20,
  },
  fsFooter: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    flexDirection: 'row',
    gap: 12,
  },
  exportButtonOutlined: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#6200EE',
    backgroundColor: 'white',
  },
  doneButtonFull: {
    flex: 2,
    backgroundColor: '#6200EE',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultNickname: {
    fontSize: 12,
    color: '#6200EE',
    fontWeight: 'bold',
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  // Phase 10 Popup Styles
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupContent: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  popupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  popupImageContainer: {
    width: '100%',
    height: 400,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  popupImage: {
    width: '100%',
    height: '100%',
  },
  popupLoading: {
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popupActions: {
    flexDirection: 'row',
    gap: 12,
  },
  popupBtnDownload: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    padding: 15,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  popupBtnDownloadText: {
    color: '#6200EE',
    fontWeight: 'bold',
  },
  popupBtnShare: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#25D366',
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  popupBtnShareText: {
    color: 'white',
    fontWeight: 'bold',
  },
  btnShareReport: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    borderRadius: 12,
    gap: 8,
  },
  btnShareReportText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnFinishSmall: {
    flex: 1,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6200EE',
  },
  btnFinishSmallText: {
    color: '#6200EE',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Phase 11 Refined Cards
  resultCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  resultCardIndicator: {
    width: 6,
    height: '100%',
  },
  resultCardContent: {
    flex: 1,
    padding: 12,
    paddingLeft: 10,
  },
  resultCardNickname: {
    fontSize: 15,
    fontWeight: '800',
    color: '#111827',
  },
  resultCardBoid: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  resultBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  btnTakeScreenshot: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    borderRadius: 14,
    gap: 8,
    height: 56, // Increased height
    elevation: 4,
    shadowColor: '#6200EE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  btnTakeScreenshotText: {
    color: 'white',
    fontSize: 16, // Professional size
    fontWeight: '900',
  },
  btnFinishRefined: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    height: 56, // Increased height
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnFinishRefinedText: {
    color: '#4B5563',
    fontSize: 15,
    fontWeight: 'bold',
  },
  manualErrorText: {
    color: '#F44336',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#FFEBEE',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  manualSubmitText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 15,
  },
  manualSubmitDisabled: {
    opacity: 0.5,
    backgroundColor: '#D1D5DB',
  },
  totalBadgeRefined: {
    backgroundColor: '#6200EE',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#6200EE',
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  totalBadgeValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
  },
  totalBadgeLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: -2,
  },
});
