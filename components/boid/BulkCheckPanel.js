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
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { getApiBaseUrl } from '../../utils/config';
import { COLORS } from '../../utils/theme';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const RESULT_COLORS = {
  success: '#198754',
  danger: '#dc3545',
  warning: COLORS.accent,
  muted: 'rgba(255,255,255,0.54)',
};

const RESULT_CARD_COLORS = {
  success: '#198754',
  danger: '#dc3545',
  warning: '#5e6ea7',
};

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
  setUseAiModel,
  onClose,
  onOpenAccountManager,
}) {
  const insets = useSafeAreaInsets();
  const [viewMode, setViewMode] = useState('selection'); 
  const [internalUseAiModel, setInternalUseAiModel] = useState(true);

  // Prioritize prop state if available
  const isAiPropFunctional = typeof useAiModel === 'boolean' && setUseAiModel;
  const activeAiModel = isAiPropFunctional ? useAiModel : internalUseAiModel;

  const toggleAiModel = () => {
    if (isAiPropFunctional) {
      setUseAiModel(!useAiModel);
    } else {
      setInternalUseAiModel(!internalUseAiModel);
    }
  };


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
    summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0, captchaErrors: 0, skipped: 0, totalShares: 0 },
    currentCheckingNickname: '',
    currentCheckingBoid: ''
  });

  const [enabledBoids, setEnabledBoids] = useState(
    new Map(savedBoids.map(b => [b.boid, true]))
  );

  // Sync enabledBoids when savedBoids change
  useEffect(() => {
    setEnabledBoids(prev => {
      const next = new Map(prev);
      savedBoids.forEach(b => {
        if (!next.has(b.boid)) next.set(b.boid, true);
      });
      return next;
    });
  }, [savedBoids]);

  const toggleBoid = (boid) => {
    setEnabledBoids(prev => {
      const next = new Map(prev);
      next.set(boid, !next.get(boid));
      return next;
    });
  };

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
      console.log(`[Single] Individual auto-check triggered for: ${autoCheckBoid}`);
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

    setViewMode('selection');
    setCapturedImageUri(null); // Clear previous image

    // Filter by enabled boids unless specificBoids is provided
    const finalTargetBoids = isArray
      ? specificBoids
      : targetBoids.filter(b => enabledBoids.get(b.boid));

    if (finalTargetBoids.length === 0) {
      alert('No accounts selected. Please enable at least one account.');
      return;
    }

    // Initialize results with 'pending' status for the live view
    const initialResults = finalTargetBoids.map(b => ({
      boid: b.boid,
      nickname: b.nickname || 'Unknown',
      status: 'pending'
    }));

    setBulkCheckState({
      progress: 0,
      currentIndex: 0,
      results: initialResults,
      summary: { total: finalTargetBoids.length, allotted: 0, notAllotted: 0, errors: 0, captchaErrors: 0, skipped: 0, totalShares: 0 },
      currentCheckingNickname: '',
      currentCheckingBoid: ''
    });

    const API_URL = getApiBaseUrl();

    // STEP 0: Auto-select company if ipoName is provided
    if (ipoName) {
      console.log(`[Bulk] Step 0: Auto-selecting company "${ipoName}"`);
      const selectionScript = generateCompanySelectionScript(ipoName);
      webViewRef.current?.injectJavaScript(selectionScript);
      await sleep(2000);
    }

    for (let i = 0; i < finalTargetBoids.length; i++) {
      if (i > 0) {
        await sleep(Math.floor(Math.random() * 1000));
      }

      const boidObj = finalTargetBoids[i];
      const boidString = typeof boidObj === 'string' ? boidObj : boidObj.boid;
      // Clear previous captcha image when starting new BOID
      setBulkCheckState(prev => ({
        ...prev,
        currentIndex: i,
        progress: Math.round((i / finalTargetBoids.length) * 100),
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
          if (activeAiModel) {
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

              const solveData = await solveResponse.json();

              if (solveData.success && (solveData.status === 'completed' || solveData.captchaText)) {
                console.log(`[Bulk] Captcha solved directly: ${solveData.captchaText}`);
                finalCaptcha = solveData.captchaText;
                setBulkCheckState(prev => ({ ...prev, currentCaptcha: finalCaptcha }));
                if (finalCaptcha.length === 5) solveSuccess = true;
              } else if (solveData.success && solveData.jobId) {
                console.log(`[Bulk] Job ${solveData.jobId} queued. Polling...`);
                let pollAttempts = 0;
                const MAX_POLL = 40; // Wait up to 80 seconds
                while (pollAttempts < MAX_POLL) {
                  await sleep(2000);
                  pollAttempts++;
                  try {
                    const stRes = await fetch(`${API_URL}/captcha/status/${solveData.jobId}`);
                    const stData = await stRes.json();
                    if (stData.status === 'completed' && stData.captchaText) {
                      finalCaptcha = stData.captchaText;
                      console.log(`[Bulk] Polling result for ${solveData.jobId}: ${finalCaptcha}`);
                      setBulkCheckState(prev => ({ ...prev, currentCaptcha: finalCaptcha }));
                      if (finalCaptcha.length === 5) solveSuccess = true;
                      break;
                    } else if (stData.status === 'failed') {
                      throw new Error(stData.error || 'Job failed in worker');
                    }
                  } catch (pollErr) {
                    console.warn(`[Bulk] Poll Error (Attempt ${pollAttempts}): ${pollErr.message}`);
                  }
                }
              }
            } catch (err) {
              console.warn(`[Bulk] AI Solve failed: ${err.message}`);
            }
          } else {
            console.log(`[Bulk] AI Model disabled. Skipping to manual entry...`);
          }

          // --- MANUAL FALLBACK TRIGGER ---
          // If AI is off, or AI solve failed/looks invalid
          let needsManual = !activeAiModel || !solveSuccess || finalCaptcha.length !== 5;

          if (needsManual) {
            // Automatic retry if AI solve just looked junk but we have attempts left
            if (activeAiModel && attempts < MAX_ATTEMPTS && !solveSuccess) {
              console.log(`[Bulk] AI solve junk. Retrying ${attempts}/${MAX_ATTEMPTS}...`);
              await sleep(1000);
              continue;
            }

            console.log(`[Bulk] Triggering Manual Fallback...`);
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
              console.log(`[Manual] User provided code: ${finalCaptcha}`);
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
          console.log(`[Bulk] Result received for ${boidString}:`, JSON.stringify(resultMsg));

          // Check for captcha-specific errors from the site
          const lowerError = (resultMsg.error || '').toLowerCase();
          const isCaptchaError = resultMsg.status === 'error' && (
            lowerError.includes('captcha') ||
            lowerError.includes('try again') ||
            lowerError.includes('incorrect')
          );

          if (isCaptchaError) {
             if (attempts < MAX_ATTEMPTS) {
                console.log(`[Bulk] Captcha error detected. Retrying ${attempts}/${MAX_ATTEMPTS}...`);
                continue;
             } else {
                console.log(`[Bulk] 3 failures reached. Switching to Manual Fallback for current BOID...`);
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
                  console.log(`[Manual] User provided code after 3 attempts: ${manualCode}`);
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
        setShowPreviewModal(false);
      } catch (captureErr) {
        console.error('Capture error:', captureErr);
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

  const maskBoid = (boid) => {
    if (!boid || boid.length < 16) return boid;
    return boid.substring(0, 6) + '********' + boid.substring(14);
  };

  const resetBulkCheckState = () => {
    setBulkCheckState({
      progress: 0,
      currentIndex: 0,
      currentCaptcha: null,
      currentCaptchaImage: null,
      results: [],
      summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0, captchaErrors: 0, skipped: 0, totalShares: 0 },
      currentCheckingNickname: '',
      currentCheckingBoid: '',
    });
    setCapturedImageUri(null);
    setShowPreviewModal(false);
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
      // Find and update existing pending result if possible
      const index = prev.results.findIndex(r => r.boid === data.boid);
      let newResults;
      if (index !== -1) {
        newResults = [...prev.results];
        newResults[index] = { ...newResults[index], ...resultItem };
      } else {
        newResults = [...prev.results, resultItem];
      }

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
        progress: (newResults.filter(r => r.status !== 'pending').length / prev.summary.total) * 100,
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
        ? `Congratulations Alloted!!! Alloted quantity : ${data.shares}`
        : `Sorry, not alloted for the entered BOID.`;

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
        return <Ionicons name="checkmark-circle" size={20} color={RESULT_COLORS.success} />;
      case 'not-allotted':
        return <Ionicons name="close-circle" size={20} color={RESULT_COLORS.danger} />;
      case 'skipped':
        return <Ionicons name="play-skip-forward-circle" size={20} color={RESULT_COLORS.muted} />;
      case 'captcha-error':
        return <Ionicons name="alert-circle" size={20} color={RESULT_COLORS.warning} />;
      case 'error':
        return <Ionicons name="alert-circle" size={20} color={RESULT_COLORS.warning} />;
      default:
        return <ActivityIndicator size="small" color={COLORS.accent} />;
    }
  };

  const getBoidStatusMeta = (boid) => {
    const entry = bulkCheckState.results.find((item) => item.boid === boid);
    const isCurrent = bulkCheckState.currentCheckingBoid === boid;

    if (isCurrent) {
      return { label: 'Checking', tone: 'active' };
    }

    if (!entry) {
      return { label: '', tone: 'none' };
    }

    switch (entry.status) {
      case 'pending':
        return { label: 'Queued', tone: 'queued' };
      case 'allotted':
        return { label: entry.shares ? `Allotted ${entry.shares}` : 'Allotted', tone: 'success' };
      case 'not-allotted':
        return { label: 'Not Allotted', tone: 'danger' };
      case 'skipped':
        return { label: 'Skipped', tone: 'muted' };
      case 'captcha-error':
        return { label: 'Captcha Error', tone: 'warning' };
      case 'error':
        return { label: 'Error', tone: 'warning' };
      default:
        return { label: '', tone: 'none' };
    }
  };

  const isCheckingActive = !!bulkCheckState.currentCheckingBoid;
  const hasCheckResults = bulkCheckState.results.length > 0;
  const isCheckComplete = hasCheckResults && !isCheckingActive && bulkCheckState.results.every(item => item.status !== 'pending');
  const isBulkCheckRunning = hasCheckResults && !isCheckComplete;
  const selectedBoidCount = Array.from(enabledBoids.values()).filter(Boolean).length;


  return (
    <View style={panelStyles.container}>

      {/* Header bar — MeroShare Dark Blue */}
      <View style={[panelStyles.headerShell, { paddingTop: insets.top + 10 }]}>
        <View style={panelStyles.headerRow}>
          <View style={panelStyles.headerTitleWrap}>
            <View>
              <Text style={panelStyles.headerTitle}>Bulk Check</Text>
            </View>
          </View>
          {onClose && viewMode === 'selection' && (
            <TouchableOpacity
              onPress={onClose}
              style={panelStyles.headerCloseButton}
            >
              <Ionicons name="close" size={20} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

       {/* 1. SELECTION MODE: User selects company and accounts */}
       {viewMode === 'selection' && (
         <ScrollView
           style={{ flex: 1 }}
           contentContainerStyle={{ paddingBottom: 28, flexGrow: 1 }}
           showsVerticalScrollIndicator={false}
           keyboardShouldPersistTaps="handled"
         >
           <View style={panelStyles.selectionTop}>
              {ipoName && (
                <View style={panelStyles.companyBanner}>
                  <Text style={panelStyles.companyBannerLabel}>Selected IPO</Text>
                  <Text style={panelStyles.companyBannerTitle}>{ipoName}</Text>
                  <Text style={panelStyles.companyBannerHint}>Select company from Home screen.</Text>
                </View>
              )}
           </View>
           <View style={panelStyles.selectionView}>

            {/* Auto Check Toggle — MeroShare Colors */}
            <TouchableOpacity
              onPress={toggleAiModel}
              style={[
                panelStyles.modeCard,
                activeAiModel ? panelStyles.modeCardActive : panelStyles.modeCardInactive,
              ]}
            >
              <View style={panelStyles.modeCardTop}>
                <View style={panelStyles.modeCardCopy}>
                  <Text style={panelStyles.modeCardEyebrow}>Captcha</Text>
                  <Text style={[panelStyles.modeCardTitle, activeAiModel && panelStyles.modeCardTitleActive]}>
                    {activeAiModel ? 'Auto Bulk Check' : 'Manual Check'}
                  </Text>
                </View>
                <View style={[panelStyles.switchTrack, activeAiModel && panelStyles.switchTrackActive]}>
                  <View style={[panelStyles.switchThumb, activeAiModel && panelStyles.switchThumbActive]} />
                </View>
              </View>
            </TouchableOpacity>
            <Text style={panelStyles.accountManagerHint}>
              You can add BOIDs from Account Manager.
            </Text>
          </View>

          {/* Account Selection List */}
          <View style={{ paddingHorizontal: 16 }}>
            <View style={panelStyles.accountsPremiumHeader}>
              <View>
                <Text style={panelStyles.accountsPremiumTitle}>BOID Cards</Text>
                <Text style={panelStyles.accountsPremiumSubtitle}>
                  {isBulkCheckRunning
                    ? `${bulkCheckState.summary.total || 0} accounts in progress`
                    : isCheckComplete
                      ? `${bulkCheckState.summary.total || 0} accounts checked`
                      : `${savedBoids.length} saved accounts`}
                </Text>
              </View>
              {savedBoids.length > 3 && !isCheckComplete && (
                <TouchableOpacity
                  style={[
                    panelStyles.headerBulkCheckButton,
                    (savedBoids.length === 0 || selectedBoidCount === 0 || isBulkCheckRunning) && panelStyles.headerBulkCheckButtonDisabled,
                  ]}
                  onPress={() => handleBulkCheck()}
                  disabled={savedBoids.length === 0 || selectedBoidCount === 0 || isBulkCheckRunning}
                >
                  <Text style={panelStyles.headerBulkCheckButtonText}>
                    {isBulkCheckRunning ? `${Math.round(bulkCheckState.progress)}%` : `Start (${selectedBoidCount})`}
                  </Text>
                </TouchableOpacity>
              )}
              {hasCheckResults && (
                <View style={panelStyles.resultMiniStats}>
                  <View style={[panelStyles.resultMiniPill, panelStyles.resultMiniPillSuccess]}>
                    <Text style={panelStyles.resultMiniValue}>{bulkCheckState.summary.allotted}</Text>
                  </View>
                  <View style={[panelStyles.resultMiniPill, panelStyles.resultMiniPillDanger]}>
                    <Text style={panelStyles.resultMiniValue}>{bulkCheckState.summary.notAllotted}</Text>
                  </View>
                </View>
              )}
            </View>
            {false && <View style={panelStyles.accountsHeader}>
              {onOpenAccountManager && (
                <TouchableOpacity
                  onPress={onOpenAccountManager}
                  style={panelStyles.addAccountButton}
                >
                  <Text style={panelStyles.addAccountButtonText}>Add BOID</Text>
                </TouchableOpacity>
              )}
            </View>}
            {false && savedBoids.length > 0 && (
              <View style={panelStyles.selectionToolsRow}>
                <TouchableOpacity
                  style={panelStyles.selectionToolButton}
                  onPress={() => {
                    const next = new Map(savedBoids.map(b => [b.boid, true]));
                    setEnabledBoids(next);
                  }}
                >
                  <Text style={panelStyles.selectionToolText}>Select All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={panelStyles.selectionToolButton}
                  onPress={() => {
                    const next = new Map(savedBoids.map(b => [b.boid, false]));
                    setEnabledBoids(next);
                  }}
                >
                  <Text style={panelStyles.selectionToolText}>Clear All</Text>
                </TouchableOpacity>
              </View>
            )}
            {savedBoids.length === 0 && (
              <View style={panelStyles.emptyAccountsCard}>
                <Text style={panelStyles.emptyAccountsTitle}>No BOIDs added yet</Text>
                <Text style={panelStyles.emptyAccountsText}>
                  You can add BOIDs from Account Manager.
                </Text>
              </View>
            )}
            {savedBoids.map((item, index) => {
              const isEnabled = enabledBoids.get(item.boid);
              const statusMeta = getBoidStatusMeta(item.boid);
              const isResultTone = ['success', 'danger', 'warning'].includes(statusMeta.tone);
              const isActiveTone = statusMeta.tone === 'active';
              const statusIconName =
                statusMeta.tone === 'success' ? 'checkmark' :
                statusMeta.tone === 'danger' ? 'close' :
                statusMeta.tone === 'warning' ? 'alert' :
                statusMeta.tone === 'active' ? 'sync' :
                statusMeta.tone === 'muted' ? 'remove' :
                statusMeta.tone === 'queued' ? 'time-outline' :
                'person';
              const cardForeground = isResultTone || isActiveTone ? COLORS.text : COLORS.text;
              const cardMutedText = isResultTone || isActiveTone ? 'rgba(255,255,255,0.82)' : COLORS.mutedText;
              const shouldShowStatus = statusMeta.tone !== 'none';
              return (
                <View
                  key={index}
                  style={[
                    localStyles.accountCard,
                    !isEnabled && !isBulkCheckRunning && !hasCheckResults && panelStyles.accountCardMuted,
                    statusMeta.tone === 'success' && panelStyles.accountCardSuccess,
                    statusMeta.tone === 'danger' && panelStyles.accountCardDanger,
                    statusMeta.tone === 'warning' && panelStyles.accountCardWarning,
                    statusMeta.tone === 'active' && panelStyles.accountCardActive,
                  ]}
                >
                  <View style={[
                    panelStyles.statusOrb,
                    statusMeta.tone === 'success' && panelStyles.statusOrbSuccess,
                    statusMeta.tone === 'danger' && panelStyles.statusOrbDanger,
                    statusMeta.tone === 'warning' && panelStyles.statusOrbWarning,
                    statusMeta.tone === 'active' && panelStyles.statusOrbActive,
                    statusMeta.tone === 'queued' && panelStyles.statusOrbQueued,
                    statusMeta.tone === 'muted' && panelStyles.statusOrbMuted,
                  ]}>
                    {isActiveTone ? (
                      <ActivityIndicator size="small" color={COLORS.text} />
                    ) : (
                      <Ionicons
                        name={statusIconName}
                        size={18}
                        color={isResultTone || isActiveTone ? COLORS.text : COLORS.accent}
                      />
                    )}
                  </View>
                  <View style={panelStyles.accountIdentity}>
                    <View style={{ flex: 1 }}>
                      <View style={panelStyles.cardTopRow}>
                        <Text style={[localStyles.accountNickname, { color: cardForeground }]}>{item.nickname || 'Unknown'}</Text>
                        {shouldShowStatus && (
                          <View style={[
                            panelStyles.inlineStatusPill,
                            statusMeta.tone === 'success' && panelStyles.inlineStatusSuccess,
                            statusMeta.tone === 'danger' && panelStyles.inlineStatusDanger,
                            statusMeta.tone === 'warning' && panelStyles.inlineStatusWarning,
                            statusMeta.tone === 'active' && panelStyles.inlineStatusActive,
                            statusMeta.tone === 'queued' && panelStyles.inlineStatusQueued,
                            statusMeta.tone === 'muted' && panelStyles.inlineStatusMuted,
                          ]}>
                            <Text style={[
                              panelStyles.inlineStatusText,
                              statusMeta.tone === 'success' && panelStyles.inlineStatusTextSuccess,
                              statusMeta.tone === 'danger' && panelStyles.inlineStatusTextDanger,
                              statusMeta.tone === 'warning' && panelStyles.inlineStatusTextWarning,
                              statusMeta.tone === 'active' && panelStyles.inlineStatusTextActive,
                              statusMeta.tone === 'queued' && panelStyles.inlineStatusTextQueued,
                              statusMeta.tone === 'muted' && panelStyles.inlineStatusTextMuted,
                            ]}>
                              {statusMeta.label}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={[localStyles.accountBoid, { color: cardMutedText }]}>{maskBoid(item.boid)}</Text>
                      {isActiveTone && (
                        <View style={panelStyles.cardProgressTrack}>
                          <View style={[panelStyles.cardProgressFill, { width: `${Math.max(8, bulkCheckState.progress)}%` }]} />
                        </View>
                      )}
                    </View>
                  </View>
                  {!isBulkCheckRunning && !hasCheckResults && (
                    <View style={panelStyles.accountActions}>
                      <TouchableOpacity
                        onPress={() => handleBulkCheck([item])}
                        style={panelStyles.quickCheckButton}
                      >
                        <Text style={panelStyles.quickCheckButtonText}>Check</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => toggleBoid(item.boid)}
                        style={[
                          panelStyles.selectionToggleSwitch,
                          isEnabled ? panelStyles.selectionToggleEnabled : panelStyles.selectionToggleDisabled,
                        ]}
                      >
                        <View
                          style={[
                            panelStyles.selectionToggleThumb,
                            isEnabled && panelStyles.selectionToggleThumbEnabled,
                          ]}
                        />
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Start Button */}
          <View style={[panelStyles.startFooter, panelStyles.startFooterInline]}>
            {isCheckComplete ? (
              <TouchableOpacity
                style={panelStyles.bulkCheckButton}
                onPress={resetBulkCheckState}
              >
                <Text style={panelStyles.bulkCheckText}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  panelStyles.bulkCheckButton,
                  (savedBoids.length === 0 || selectedBoidCount === 0 || isBulkCheckRunning) && panelStyles.bulkCheckButtonDisabled,
                ]}
                onPress={() => handleBulkCheck()}
                disabled={savedBoids.length === 0 || selectedBoidCount === 0 || isBulkCheckRunning}
              >
                <Text style={panelStyles.bulkCheckText}>
                  {isBulkCheckRunning
                    ? `Checking ${Math.round(bulkCheckState.progress)}%`
                    : `Start Bulk Check (${selectedBoidCount})`}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      )}

      {/* 2. CHECKING & RESULTS VIEW (Inline) */}
      {false && (<>
        <View style={panelStyles.inlineStageContainer}>
          {/* HIDDEN BRANDED SHARE CARD FOR VIEWSHOT - MOVED OUTSIDE CONDITIONAL TO PREVENT HANGS */}
          <View style={{ position: 'absolute', opacity: 0, left: -5000 }}>
            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
              <View style={panelStyles.shareCard}>
                <LinearGradient
                  colors={[COLORS.primary, COLORS.accent]}
                  style={panelStyles.shareCardHeader}
                >
                  <Image source={require('../../assets/icon.png')} style={panelStyles.shareLogo} />
                  <View>
                    <Text style={panelStyles.shareAppName}>IPO RESULT - BOID AUTOFILLER</Text>
                    <Text style={panelStyles.shareAppTagline}>Check results with confidence</Text>
                  </View>
                </LinearGradient>

                <View style={panelStyles.shareCardBody}>
                  {ipoName && (
                    <View style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.accent }}>
                      <Text style={{ fontSize: 8, color: COLORS.mutedText, fontWeight: '900', letterSpacing: 0.5 }}>COMPANY</Text>
                      <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: 'bold' }} numberOfLines={1}>{ipoName}</Text>
                    </View>
                  )}
                  <Text style={panelStyles.shareCardTitle}>IPO Allotment Status</Text>
                  <View style={panelStyles.summaryGridSmall}>
                    <View style={panelStyles.shareSumItem}>
                      <Text style={[panelStyles.shareSumCount, { color: RESULT_COLORS.success }]}>{bulkCheckState.summary.allotted}</Text>
                      <Text style={panelStyles.shareSumLabel}>Allotted</Text>
                    </View>
                    <View style={panelStyles.shareSumItem}>
                      <Text style={[panelStyles.shareSumCount, { color: COLORS.mutedText }]}>{bulkCheckState.summary.total}</Text>
                      <Text style={panelStyles.shareSumLabel}>Total Checked</Text>
                    </View>
                  </View>

                      {/* Summary Emotive Message */}
                      <View style={{ alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{
                          fontSize: 24,
                          fontWeight: 'bold',
                          color: bulkCheckState.summary.allotted > 0 ? RESULT_COLORS.success : RESULT_COLORS.danger,
                          textAlign: 'center'
                        }}>
                          {bulkCheckState.summary.allotted > 0 ? "Congratulations! 🎉" : "Better luck next time! 🍀"}
                        </Text>
                        <Text style={{ color: COLORS.mutedText, fontSize: 13, marginTop: 4 }}>
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

                        let statusColor = RESULT_COLORS.danger; // default red
                        if (isAllotted) statusColor = RESULT_COLORS.success;
                        if (isSkipped) statusColor = RESULT_COLORS.muted;
                        if (item.status === 'captcha-error') statusColor = RESULT_COLORS.warning;

                        let statusLabel = 'NOT ALLOTTED';
                        if (isAllotted) statusLabel = `ALLOTTED: ${item.shares} UNITS` ;
                        if (isSkipped) statusLabel = 'SKIPPED';
                        if (item.status === 'captcha-error') statusLabel = 'CAPTCHA ERROR';

                        return (
                          <View key={idx} style={[panelStyles.resultCard, { marginBottom: 8, elevation: 0, borderWidth: 1, borderColor: COLORS.primary }]}>
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

           <View style={panelStyles.inlineStageHeader}>
             <View style={{ flex: 1 }}>
               <Text style={panelStyles.inlineStageTitle}>
                 {viewMode === 'checking' ? 'Checking in progress' : 'Bulk Check Complete'}
               </Text>
             </View>
             {viewMode === 'results' && (
               <TouchableOpacity onPress={() => setViewMode('selection')} style={panelStyles.inlineStageClose}>
                 <Ionicons name="close" size={22} color={COLORS.text} />
               </TouchableOpacity>
             )}
           </View>

           <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {ipoName && (
                <View style={panelStyles.companyBannerCompact}>
                  <Text style={panelStyles.companyBannerLabel}>IPO Company</Text>
                  <Text style={panelStyles.companyBannerTitle}>{ipoName}</Text>
                </View>
              )}
           </View>

          {/* Progress Bar */}
          <View style={[panelStyles.fsProgressContainer, { height: 8, borderRadius: 4 }]}>
              <View style={[panelStyles.fsProgressFill, { width: `${bulkCheckState.progress}%`, borderRadius: 4 }]} />
          </View>

          {/* Current Status / Captcha */}
          {viewMode === 'checking' && (
            <View style={{ flex: 1 }}>
              <View style={panelStyles.fsStatusSection}>
                 <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 15 }}>
                  <View>
                    <Text style={panelStyles.fsStatusText}>
                      Processing {bulkCheckState.currentIndex + 1} of {bulkCheckState.summary.total}
                    </Text>
                    <Text style={[panelStyles.fsNickname, { color: COLORS.accent }]}>
                      {bulkCheckState.currentCheckingNickname || bulkCheckState.currentCheckingBoid || 'Starting...'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', backgroundColor: COLORS.surface, padding: 8, borderRadius: 10 }}>
                     <Text style={{ fontSize: 18, fontWeight: '900', color: COLORS.accent }}>
                       {Math.round(bulkCheckState.progress)}%
                     </Text>
                     <Text style={{ fontSize: 8, color: COLORS.accent, fontWeight: 'bold' }}>COMPLETED</Text>
                  </View>
                </View>

                {/* Summary Mini Grid during progress */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 15, width: '100%' }}>
                  <View style={{ flex: 1, backgroundColor: COLORS.surface, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: RESULT_COLORS.success }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: RESULT_COLORS.success }}>{bulkCheckState.summary.allotted}</Text>
                    <Text style={{ fontSize: 8, color: RESULT_COLORS.success, fontWeight: 'bold' }}>ALLOTTED</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: COLORS.surface, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: RESULT_COLORS.danger }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: RESULT_COLORS.danger }}>{bulkCheckState.summary.notAllotted}</Text>
                    <Text style={{ fontSize: 8, color: RESULT_COLORS.danger, fontWeight: 'bold' }}>NOT ALLOTTED</Text>
                  </View>
                  <View style={{ flex: 1, backgroundColor: COLORS.surface, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: RESULT_COLORS.warning }}>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', color: RESULT_COLORS.warning }}>{bulkCheckState.summary.captchaErrors + bulkCheckState.summary.errors}</Text>
                    <Text style={{ fontSize: 8, color: RESULT_COLORS.warning, fontWeight: 'bold' }}>ERRORS</Text>
                  </View>
                </View>

                {bulkCheckState.currentCaptchaImage ? (
                  <View style={panelStyles.fsCaptchaContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                       <ActivityIndicator size="small" color={COLORS.accent} />
                       <Text style={panelStyles.fsCaptchaLabel}>Solving Captcha...</Text>
                    </View>
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
                  <View style={{alignItems: 'center', marginVertical: 20, backgroundColor: COLORS.surface, padding: 20, borderRadius: 12, width: '100%'}}>
                     <ActivityIndicator size="large" color={COLORS.accent} />
                     <Text style={{color: COLORS.mutedText, marginTop: 10, fontWeight: '600'}}>Extremely Fast Extraction...</Text>
                  </View>
                )}
              </View>

              {/* LIVE RESULTS LIST */}
              <View style={{ flex: 1, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                <FlatList
                  data={bulkCheckState.results}
                  keyExtractor={(_, idx) => idx.toString()}
                  contentContainerStyle={{ padding: 15 }}
                  renderItem={({ item }) => {
                    const isPending = item.status === 'pending';
                    const isAllotted = item.status === 'allotted';
                    const isSkipped = item.status === 'skipped';
                    const isCaptchaErr = item.status === 'captcha-error';

                    let statusColor = isPending ? COLORS.mutedText : RESULT_COLORS.danger;
                    if (isAllotted) statusColor = RESULT_COLORS.success;
                    if (isSkipped) statusColor = RESULT_COLORS.muted;
                    if (isCaptchaErr) statusColor = RESULT_COLORS.warning;

                    let statusLabel = isPending ? 'Pending...' : 'Not Allotted';
                    if (isAllotted) statusLabel = `ALLOTTED: ${item.shares} UNITS` ;
                    if (isSkipped) statusLabel = 'SKIPPED';
                    if (isCaptchaErr) statusLabel = 'CAPTCHA ERROR';

                    return (
                      <View style={[
                        panelStyles.resultCard,
                        {
                          opacity: isPending ? 0.7 : 1,
                          marginBottom: 10,
                          backgroundColor: item.boid === bulkCheckState.currentCheckingBoid ? COLORS.surface : COLORS.text,
                          borderColor: item.boid === bulkCheckState.currentCheckingBoid ? COLORS.accent : COLORS.primary,
                          borderWidth: item.boid === bulkCheckState.currentCheckingBoid ? 1.5 : 1
                        }
                      ]}>
                        <View style={[panelStyles.resultCardIndicator, { backgroundColor: statusColor }]} />
                        <View style={panelStyles.resultCardContent}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                              <Text style={[panelStyles.resultCardNickname, item.boid === bulkCheckState.currentCheckingBoid && { fontWeight: '900', color: COLORS.accent }]}>
                                {item.nickname}
                              </Text>
                              <Text style={panelStyles.resultCardBoid}>{maskBoid(item.boid)}</Text>
                            </View>
                            <View style={[panelStyles.resultBadge, { backgroundColor: statusColor + '15', paddingHorizontal: 8, paddingVertical: 3 }]}>
                              {isPending ? (
                                <ActivityIndicator size={10} color={statusColor} style={{ marginRight: 4 }} />
                              ) : null}
                              <Text style={[panelStyles.resultBadgeText, { color: statusColor, fontWeight: '800' }]}>
                                {statusLabel}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  }}
                />
              </View>
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
                      <Text style={[panelStyles.resultsTitle, { color: bulkCheckState.summary.allotted > 0 ? RESULT_COLORS.success : RESULT_COLORS.danger }]}>
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

                {ipoName && (
                  <View style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 10, marginBottom: 15, borderLeftWidth: 3, borderLeftColor: COLORS.accent }}>
                    <Text style={{ fontSize: 8, color: COLORS.mutedText, fontWeight: '900', letterSpacing: 1, marginBottom: 1 }}>SELECTED COMPANY</Text>
                    <Text style={{ fontSize: 14, color: COLORS.text, fontWeight: 'bold' }}>{ipoName}</Text>
                  </View>
                )}

                {/* Summary Section */}
                <View style={panelStyles.summaryGrid}>
                   <View style={[panelStyles.summaryCard, { backgroundColor: COLORS.surface, borderColor: RESULT_COLORS.success }]}>
                      <Ionicons name="checkmark-circle" size={20} color={RESULT_COLORS.success} />
                      <View>
                        <Text style={[panelStyles.summaryCount, { color: RESULT_COLORS.success }]}>{bulkCheckState.summary.allotted}</Text>
                        <Text style={panelStyles.summaryLabel}>Allotted</Text>
                      </View>
                   </View>

                   <View style={[panelStyles.summaryCard, { backgroundColor: COLORS.surface, borderColor: RESULT_COLORS.danger }]}>
                      <Ionicons name="close-circle" size={20} color={RESULT_COLORS.danger} />
                      <View>
                        <Text style={[panelStyles.summaryCount, { color: RESULT_COLORS.danger }]}>{bulkCheckState.summary.notAllotted}</Text>
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

                    let statusColor = RESULT_COLORS.danger; // Red
                    if (isAllotted) statusColor = RESULT_COLORS.success;
                    if (isSkipped) statusColor = RESULT_COLORS.muted;
                    if (isCaptchaErr) statusColor = RESULT_COLORS.warning;

                    let statusLabel = 'NOT ALLOTTED';
                    if (isAllotted) statusLabel = `ALLOTTED: ${item.shares} UNITS` ;
                    if (isSkipped) statusLabel = 'SKIPPED';
                    if (isCaptchaErr) statusLabel = 'CAPTCHA ERROR';

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
                        <Ionicons name="close" size={24} color={COLORS.text} />
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
                      <ActivityIndicator color={COLORS.accent} size="large" />
                      <Text style={{ marginTop: 10, color: COLORS.mutedText }}>Generating report...</Text>
                    </View>
                  )}

                  <View style={panelStyles.popupActions}>
                     <TouchableOpacity style={panelStyles.popupBtnShare} onPress={handleShareResult} disabled={isSharing}>
                       <Ionicons name="logo-whatsapp" size={18} color="white" />
                       <Text style={panelStyles.popupBtnShareText}>Share</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
          </Modal>
        </View>
      </>)}  {/* End Legacy Inline View */}

      <View style={panelStyles.hiddenCaptureSurface}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }}>
          <View style={panelStyles.shareCard}>
            <LinearGradient
              colors={[COLORS.primary, COLORS.accent]}
              style={panelStyles.shareCardHeader}
            >
              <Image source={require('../../assets/icon.png')} style={panelStyles.shareLogo} />
              <View>
                <Text style={panelStyles.shareAppName}>IPO RESULT - BOID AUTOFILLER</Text>
                <Text style={panelStyles.shareAppTagline}>Check results with confidence</Text>
              </View>
            </LinearGradient>

            <View style={panelStyles.shareCardBody}>
              {ipoName && (
                <View style={{ backgroundColor: COLORS.primary, padding: 8, borderRadius: 8, marginBottom: 12, borderLeftWidth: 3, borderLeftColor: COLORS.accent }}>
                  <Text style={{ fontSize: 8, color: COLORS.mutedText, fontWeight: '900', letterSpacing: 0.5 }}>COMPANY</Text>
                  <Text style={{ fontSize: 13, color: COLORS.text, fontWeight: 'bold' }} numberOfLines={1}>{ipoName}</Text>
                </View>
              )}
              <Text style={panelStyles.shareCardTitle}>IPO Allotment Status</Text>
              <View style={panelStyles.summaryGridSmall}>
                <View style={panelStyles.shareSumItem}>
                  <Text style={[panelStyles.shareSumCount, { color: RESULT_COLORS.success }]}>{bulkCheckState.summary.allotted}</Text>
                  <Text style={panelStyles.shareSumLabel}>Allotted</Text>
                </View>
                <View style={panelStyles.shareSumItem}>
                  <Text style={[panelStyles.shareSumCount, { color: COLORS.mutedText }]}>{bulkCheckState.summary.total}</Text>
                  <Text style={panelStyles.shareSumLabel}>Total Checked</Text>
                </View>
              </View>
            </View>
          </View>
        </ViewShot>
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

    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  headerShell: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  headerCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  headerStatPill: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerStatValue: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerStatLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  selectionTop: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  companyBanner: {
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 1,
  },
  companyBannerCompact: {
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 6,
  },
  companyBannerLabel: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  companyBannerTitle: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: '700',
  },
  companyBannerHint: {
    marginTop: 7,
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.mutedText,
    fontWeight: '600',
  },
  selectionView: {
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  sectionDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: COLORS.mutedText,
  },
  modeCard: {
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
  },
  modeCardActive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.accent,
  },
  modeCardInactive: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
  },
  modeCardCompact: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modeCardCompactText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  modeCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  modeCardCopy: {
    flex: 1,
  },
  modeCardEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.mutedText,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  modeCardTitle: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  modeCardTitleActive: {
    color: COLORS.text,
  },
  modeCardDescription: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.mutedText,
  },
  switchTrack: {
    width: 52,
    height: 30,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    padding: 3,
    justifyContent: 'center',
  },
  switchTrackActive: {
    backgroundColor: COLORS.accent,
  },
  switchTrackCompact: {
    width: 42,
    height: 24,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  switchThumbCompact: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  bulkControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accountsHeader: {
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  accountsSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.mutedText,
  },
  selectionToolsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  accountsPremiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  accountsPremiumTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.text,
  },
  accountsPremiumSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mutedText,
  },
  headerBulkCheckButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  headerBulkCheckButtonDisabled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    opacity: 0.55,
  },
  headerBulkCheckButtonText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '900',
  },
  resultMiniStats: {
    flexDirection: 'row',
    gap: 8,
  },
  resultMiniPill: {
    minWidth: 38,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  resultMiniPillSuccess: {
    backgroundColor: RESULT_CARD_COLORS.success,
  },
  resultMiniPillDanger: {
    backgroundColor: RESULT_CARD_COLORS.danger,
  },
  resultMiniValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '900',
  },
  selectionToolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  selectionToolText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.accent,
  },
  addAccountButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addAccountButtonTop: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  addAccountButtonText: {
    fontSize: 12,
    color: COLORS.text,
    fontWeight: '800',
  },
  accountManagerHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 17,
    color: COLORS.mutedText,
    fontWeight: '600',
  },
  emptyAccountsCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyAccountsIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    marginBottom: 14,
  },
  emptyAccountsTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  emptyAccountsText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.mutedText,
  },
  emptyAccountsButton: {
    marginTop: 16,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyAccountsButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  accountCardMuted: {
    opacity: 0.6,
  },
  accountCardSuccess: {
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: RESULT_CARD_COLORS.success,
    shadowColor: RESULT_CARD_COLORS.success,
    shadowOpacity: 0.28,
    elevation: 4,
  },
  accountCardDanger: {
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: RESULT_CARD_COLORS.danger,
    shadowColor: RESULT_CARD_COLORS.danger,
    shadowOpacity: 0.24,
    elevation: 4,
  },
  accountCardWarning: {
    borderColor: 'rgba(255,255,255,0.30)',
    backgroundColor: RESULT_CARD_COLORS.warning,
    shadowColor: RESULT_CARD_COLORS.warning,
    shadowOpacity: 0.24,
    elevation: 4,
  },
  accountCardActive: {
    borderColor: 'rgba(255,255,255,0.32)',
    backgroundColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.28,
    elevation: 4,
  },
  statusOrb: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 12,
  },
  statusOrbSuccess: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  statusOrbDanger: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  statusOrbWarning: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  statusOrbActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.26)',
  },
  statusOrbQueued: {
    backgroundColor: 'rgba(94,110,167,0.18)',
    borderColor: 'rgba(94,110,167,0.38)',
  },
  statusOrbMuted: {
    opacity: 0.7,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  inlineStatusPill: {
    minHeight: 28,
    maxWidth: 122,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineStatusSuccess: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  inlineStatusDanger: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  inlineStatusWarning: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  inlineStatusActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderColor: 'rgba(255,255,255,0.25)',
  },
  inlineStatusQueued: {
    backgroundColor: 'rgba(94,110,167,0.18)',
    borderColor: 'rgba(94,110,167,0.38)',
  },
  inlineStatusMuted: {
    opacity: 0.74,
  },
  inlineStatusText: {
    color: COLORS.mutedText,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  inlineStatusTextSuccess: {
    color: COLORS.text,
  },
  inlineStatusTextDanger: {
    color: COLORS.text,
  },
  inlineStatusTextWarning: {
    color: COLORS.text,
  },
  inlineStatusTextActive: {
    color: COLORS.text,
  },
  inlineStatusTextQueued: {
    color: COLORS.text,
  },
  inlineStatusTextMuted: {
    color: COLORS.mutedText,
  },
  accountIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  accountAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountAvatarMuted: {
    backgroundColor: COLORS.primary,
  },
  accountAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.accent,
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  quickCheckButton: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    borderWidth: 1,
    borderColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  quickCheckButtonText: {
    fontSize: 11,
    color: COLORS.text,
    fontWeight: '800',
  },
  selectionToggleSwitch: {
    width: 52,
    height: 30,
    borderRadius: 999,
    padding: 3,
    justifyContent: 'center',
  },
  selectionToggleEnabled: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  selectionToggleDisabled: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  selectionToggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
  },
  selectionToggleThumbEnabled: {
    alignSelf: 'flex-end',
  },
  cardProgressTrack: {
    marginTop: 10,
    height: 4,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  cardProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: COLORS.text,
  },
  startFooter: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    backgroundColor: COLORS.primary,
  },
  startFooterInline: {
    marginTop: 4,
  },
  inlineStageContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: COLORS.primary,
  },
  inlineStageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  inlineStageTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  inlineStageClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bulkCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
    backgroundColor: COLORS.accent,
    paddingVertical: 17,
    paddingHorizontal: 18,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    elevation: 8,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
  },
  bulkCheckButtonDisabled: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    opacity: 0.55,
    shadowOpacity: 0,
    elevation: 0,
  },
  bulkCheckText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  progressContainer: {
    padding: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    marginBottom: 12,
  },
  progressText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  progressBar: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  progressDetail: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 8,
    textAlign: 'right',
  },
  // PREVIEW STYLES
  previewContainer: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.accent,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  previewImage: {
    width: '100%',
    height: 400,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
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
    color: COLORS.mutedText,
    fontWeight: '600',
  },

  // SHARE CARD STYLES (HIDDEN)
  hiddenCaptureSurface: {
    position: 'absolute',
    opacity: 0,
    left: -5000,
    top: 0,
  },
  shareCard: {
    width: 320,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.surface,
  },
  shareAppName: {
    color: COLORS.text,
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
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 15,
  },
  summaryGridSmall: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 30,
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: COLORS.primary,
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
    color: COLORS.mutedText,
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
    color: COLORS.mutedText,
  },
  shareCardFooter: {
    backgroundColor: COLORS.primary,
    padding: 12,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  shareFooterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  shareFooterText: {
    fontSize: 9,
    fontWeight: '700',
    color: COLORS.mutedText,
  },

  // STICKY BOTTOM ACTIONS
  stickyFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    flexDirection: 'row',
    gap: 10,
    elevation: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  btnDownload: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  btnShare: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RESULT_COLORS.success,
    borderRadius: 12,
    gap: 8,
  },
  btnShareText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  btnFinish: {
    flex: 1,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnFinishText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },

  resultsContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
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
    marginBottom: 22,
  },
  resultsTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.text,
  },
  resultsSubtitle: {
    fontSize: 13,
    color: COLORS.mutedText,
    marginTop: 4,
  },
  batchBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  batchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  summaryCount: {
    fontSize: 20,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 11,
    color: COLORS.mutedText,
    fontWeight: '600',
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
    borderBottomColor: COLORS.primary,
  },
  resultStatusDot: (allotted) => ({
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: allotted ? RESULT_COLORS.success : RESULT_COLORS.danger,
  }),
  resultDetails: {
    flex: 1,
  },
  resultBoid: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.mutedText,
  },
  nicknameBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  nicknameBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.mutedText,
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
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.accent,
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  shareImageButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  doneButtonFull: {
    flex: 1,
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  doneButtonText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: 'bold',
  },
  checkingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginTop: 10,
  },
  checkingIndicatorText: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: '600',
  },
  // Manual Modal Styles
   manualModalOverlay: {
     flex: 1,
     backgroundColor: 'rgba(0,0,0,0.7)',
     justifyContent: 'flex-start',
   },
  manualModalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    color: COLORS.accent,
  },
  manualSubtitle: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginBottom: 20,
  },
  manualNickname: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.accent,
    textAlign: 'center',
    marginBottom: 15,
    textTransform: 'uppercase',
  },
  captchaDisplayContainer: {
    marginBottom: 20,
    alignItems: 'center',
  },
  captchaFrame: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  noticeText: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 8,
    fontStyle: 'italic',
  },
  manualInput: {
    backgroundColor: COLORS.primary,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 15,
    fontSize: 20,
    textAlign: 'center',
    fontWeight: 'bold',
    letterSpacing: 8,
    marginBottom: 20,
    color: COLORS.text,
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
    color: COLORS.mutedText,
    fontWeight: '600',
  },
  manualSubmit: {
    flex: 2,
    backgroundColor: COLORS.accent,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  manualSubmitDisabled: {
    backgroundColor: COLORS.surface,
    opacity: 0.55,
  },
  manualSubmitText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  // Full Screen Modal Styles
  fsContainer: {
    flex: 1,
    backgroundColor: COLORS.primary,
  },
  fsHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  fsTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  fsProgressContainer: {
    height: 8,
    backgroundColor: COLORS.border,
    width: '100%',
  },
  fsProgressFill: {
    height: '100%',
    backgroundColor: COLORS.accent,
  },
  fsStatusSection: {
    backgroundColor: COLORS.surface,
    padding: 22,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  fsStatusText: {
    fontSize: 14,
    color: COLORS.mutedText,
    marginBottom: 4,
  },
  fsNickname: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    marginBottom: 15,
  },
  fsCaptchaContainer: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    width: '100%',
  },
  fsCaptchaLabel: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  fsCaptchaImage: {
    width: 200,
    height: 80,
    marginBottom: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
  },
  fsCaptchaSolved: {
    fontSize: 16,
    fontWeight: 'bold',
    color: RESULT_COLORS.success,
  },
  fsListContainer: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
  },
  fsFooter: {
    padding: 20,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
    borderColor: COLORS.accent,
    backgroundColor: COLORS.surface,
  },
  doneButtonFull: {
    flex: 2,
    backgroundColor: COLORS.accent,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultNickname: {
    fontSize: 12,
    color: COLORS.accent,
    fontWeight: 'bold',
    backgroundColor: COLORS.primary,
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
    backgroundColor: COLORS.surface,
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
    color: COLORS.text,
  },
  popupImageContainer: {
    width: '100%',
    height: 400,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  popupBtnDownloadText: {
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  popupBtnShare: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: RESULT_COLORS.success,
    padding: 15,
    borderRadius: 12,
    gap: 8,
  },
  popupBtnShareText: {
    color: COLORS.text,
    fontWeight: 'bold',
  },
  btnShareReport: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    gap: 8,
  },
  btnShareReportText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  btnFinishSmall: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  btnFinishSmallText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Phase 11 Refined Cards
  resultCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    marginBottom: 12,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  resultCardIndicator: {
    width: 6,
    height: '100%',
  },
  resultCardContent: {
    flex: 1,
    padding: 14,
    paddingLeft: 12,
  },
  resultCardNickname: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  resultCardBoid: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 5,
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
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    gap: 8,
    height: 58,
    elevation: 4,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
  },
  btnTakeScreenshotText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  btnFinishRefined: {
    flex: 1,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    height: 58,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnFinishRefinedText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  manualErrorText: {
    color: RESULT_COLORS.danger,
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'rgba(220,53,69,0.14)',
    padding: 8,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: RESULT_COLORS.danger,
  },
  manualSubmitText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  manualSubmitDisabled: {
    opacity: 0.5,
    backgroundColor: COLORS.surface,
  },
  totalBadgeRefined: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: COLORS.accent,
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  totalBadgeValue: {
    color: COLORS.text,
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

const localStyles = StyleSheet.create({
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
  accountNickname: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.text,
  },
  accountBoid: {
    fontSize: 12,
    color: COLORS.mutedText,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
});
