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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { 
  generateCaptchaExtractionScript, 
  generateFinalSubmissionScript,
  generateCompanySelectionScript,
  reloadForFreshCaptcha, 
  fetchIPOsDirectly 
} from '../../utils/BulkCheckStrategy';
import { getApiBaseUrl } from '../../utils/config';

export default function BulkCheckPanel({ 
  savedBoids, 
  ipoName, 
  webViewRef,
  visible,
  results,
  setResults,
  onModeChange,
  onWebViewMessage, // The setter function from MainApp
  autoCheckBoid, // NEW: Individual BOID to check automatically
  onAutoCheckComplete // NEW: Callback when done
}) {
  const [viewMode, setViewMode] = useState('selection'); // 'selection' | 'checking' | 'results'
  const [aiProvider, setAiProvider] = useState('jury'); // 'jury' (Masterpiece), 'gemini' (Free) or 'openai' (Paid)

  // Notify parent when viewMode changes
  useEffect(() => {
    onModeChange?.(viewMode);
  }, [viewMode, onModeChange]);

  const [bulkCheckState, setBulkCheckState] = useState({
    progress: 0,
    currentIndex: 0,
    currentCaptcha: null, // New field
    results: [],
    summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0, totalShares: 0 }
  });

  // --- MANUAL FALLBACK STATES ---
  const [manualPrompt, setManualPrompt] = useState({
    visible: false,
    imageBase64: null,
    boid: '',
    resolvePromise: null
  });
  const [manualInput, setManualInput] = useState('');

  const messageHandlerRef = useRef(null);

  // Dispatch message to the active handler
  const handleWebViewMessage = (event) => {
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
    if (savedBoids.length === 0) {
      alert('No BOIDs saved. Please add BOIDs first.');
      return;
    }

    setViewMode('checking');
    setBulkCheckState({
      progress: 0,
      currentIndex: 0,
      results: [],
      summary: { total: targetBoids.length, allotted: 0, notAllotted: 0, errors: 0, totalShares: 0 }
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
      setBulkCheckState(prev => ({ ...prev, currentIndex: i, progress: Math.round((i / targetBoids.length) * 100) }));

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
          
          // STEP 2: Solve from RN - Send as actual file via FormData
          console.log(`[Bulk] Step 2: Solving Captcha via ${aiProvider} for ${boidString}`);
          console.log(`[Bulk] Image size: ${extractionMsg.imageSize} bytes, type: ${extractionMsg.mimeType}`);
          
          // Create FormData and append image file using React Native's file object format
          const formData = new FormData();
          formData.append('image', {
            uri: `data:${extractionMsg.mimeType};base64,${extractionMsg.imageBase64}`,
            name: 'captcha.png',
            type: extractionMsg.mimeType
          });
          formData.append('provider', aiProvider);
          
          const solveResponse = await fetch(`${API_URL}/captcha/solve`, {
            method: 'POST',
            body: formData,
            headers: {
              'Accept': 'application/json',
              // Note: Do NOT set Content-Type header when using FormData
            }
          });

          // PRE-FETCH DIAGNOSTICS: Catch HTML responses (Render errors)
          const rawResponse = await solveResponse.text();
          let solveData;
          try {
            solveData = JSON.parse(rawResponse);
          } catch (e) {
            console.error(`❌ [Bulk] JSON Parse Error for solve. Status: ${solveResponse.status}`);
            console.error(`❌ [Bulk] Response starts with: ${rawResponse.substring(0, 100)}`);
            throw new Error(`Server returned HTML instead of JSON (${solveResponse.status}). Please check if API URL "${API_URL}" is correct.`);
          }
          
          if (!solveData.success) throw new Error(`${aiProvider} solve failed: ` + (solveData.error || 'Check backend logs'));

          // Update UI with solved captcha
          console.log(`✅ [Bulk] Captcha solved: ${solveData.captchaText}`);
          setBulkCheckState(prev => ({ ...prev, currentCaptcha: solveData.captchaText }));

          let finalCaptcha = solveData.captchaText;

          // --- MANUAL FALLBACK TRIGGER ---
          // If captcha is obviously junk or we're on final retry and still unsure
          const looksInvalid = finalCaptcha.length !== 5;
          if (looksInvalid || (attempts >= MAX_ATTEMPTS && !success)) {
            console.log(`📡 [Bulk] AI Uncertainty detected. Invoking Manual Fallback...`);
            
            const manualCode = await new Promise((resolve) => {
              setManualPrompt({
                visible: true,
                imageBase64: extractionMsg.imageBase64,
                boid: boidString,
                resolvePromise: resolve
              });
            });
            
            if (manualCode) {
              finalCaptcha = manualCode;
              console.log(`🧑‍💻 [Manual] User provided code: ${finalCaptcha}`);
            } else {
              throw new Error('Manual entry cancelled');
            }
          }

          // STEP 3: Final Submission
          console.log(`[Bulk] Step 3: Submitting form for ${boidString}`);
          const submitScript = generateFinalSubmissionScript(boidString, finalCaptcha);
          webViewRef.current?.injectJavaScript(submitScript);

          const resultMsg = await waitForMessage('BULK_CHECK_RESULT', boidString, 20000);
          handleResult(resultMsg);
          success = true; // Mark as done to break while loop

        } catch (error) {
          console.warn(`[Bulk] Attempt ${attempts} failed for ${boidString}:`, error.message);
          
          // If all attempts failed OR if it's a non-captcha error, stop and report
          const isCaptchaError = error.message.includes('Captcha');
          
          if (!isCaptchaError || attempts >= MAX_ATTEMPTS) {
            handleResult({
              boid: boidString,
              status: 'error',
              error: error.message,
              success: false
            });
            break; // Stop retrying this BOID
          }
          
          // Wait a bit before retrying to let the site settle
          await sleep(2000);
        }
      }

      // Pacing delay (respecting rate limits)
      if (i < targetBoids.length - 1) {
        const delay = aiProvider === 'gemini' ? 6000 : 1000;
        await sleep(delay);
      }
    }

    setBulkCheckState(prev => ({ ...prev, progress: 100 }));
    if (onAutoCheckComplete) onAutoCheckComplete();
    setViewMode('results');
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

  const handleResult = (data) => {
    setBulkCheckState(prev => {
      const newResults = [...prev.results, data];
      const newSummary = {
        total: prev.summary.total,
        allotted: newResults.filter(r => r?.status === 'allotted').length,
        notAllotted: newResults.filter(r => r?.status === 'not-allotted').length,
        errors: newResults.filter(r => r?.status === 'error').length,
        totalShares: newResults.reduce((sum, r) => sum + (r?.shares || 0), 0)
      };

      return {
        ...prev,
        results: newResults,
        summary: newSummary
      };
    });

    // Update parent global results for the list labels
    if (setResults && data.status !== 'error') {
      const resultText = data.status === 'allotted' 
        ? `🎉 Congratulations! Alloted quantity : ${data.shares}` 
        : `❌ Sorry, not alloted for the entered BOID.`;

      setResults((prevResults) => {
        const matchingBoid = savedBoids.find(b => b.boid === data.boid);
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

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const exportToCSV = async () => {
    const { results } = bulkCheckState;
    
    let csv = 'BOID,Status,Shares,Timestamp\n';
    results.forEach(r => {
      csv += `${r?.boid || 'N/A'},${r?.status || 'unknown'},${r?.shares || 0},${r?.timestamp || 'N/A'}\n`;
    });

    try {
      await Share.share({
        message: csv,
        title: `IPO Results`,
      });
    } catch (error) {
      console.error('Error sharing CSV:', error);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'allotted':
        return <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />;
      case 'not-allotted':
        return <Ionicons name="close-circle" size={20} color="#F44336" />;
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
          
          {/* AI Provider Toggle */}
          <View style={panelStyles.providerContainer}>
            <Text style={panelStyles.providerLabel}>AI Engine:</Text>
            <View style={panelStyles.toggleWrapper}>
              <TouchableOpacity 
                style={[panelStyles.toggleOption, aiProvider === 'jury' && panelStyles.toggleActive]}
                onPress={() => setAiProvider('jury')}
              >
                <Text style={[panelStyles.toggleText, aiProvider === 'jury' && panelStyles.toggleTextActive]}>⚖️ Jury (Best)</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[panelStyles.toggleOption, aiProvider === 'gemini' && panelStyles.toggleActive]}
                onPress={() => setAiProvider('gemini')}
              >
                <Text style={[panelStyles.toggleText, aiProvider === 'gemini' && panelStyles.toggleTextActive]}>Gemini</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[panelStyles.toggleOption, aiProvider === 'openai' && panelStyles.toggleActive]}
                onPress={() => setAiProvider('openai')}
              >
                <Text style={[panelStyles.toggleText, aiProvider === 'openai' && panelStyles.toggleTextActive]}>GPT-4o</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          <TouchableOpacity  
            style={panelStyles.bulkCheckButton}
            onPress={handleBulkCheck}
          >
            <Ionicons name="play" size={20} color="white" />
            <Text style={panelStyles.bulkCheckText}>Start Bulk Check</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. PROGRESS / CHECKING MODE */}
      {viewMode === 'checking' && (
        <View style={panelStyles.progressContainer}>
          <Text style={panelStyles.progressText}>
            Checking IPO Results... {bulkCheckState.progress}%
          </Text>
          <View style={panelStyles.progressBar}>
            <View 
              style={[
                panelStyles.progressFill, 
                { width: `${bulkCheckState.progress}%` }
              ]} 
            />
          </View>
          <Text style={panelStyles.progressDetail}>
            Checking {bulkCheckState.currentIndex + 1} of {savedBoids.length}
          </Text>
        </View>
      )}

      {/* 3. RESULTS DISPLAY (Shown during checking and after finish) */}
      {(viewMode === 'checking' || viewMode === 'results') && (
        <View style={panelStyles.resultsContainer}>
          <View style={panelStyles.resultsHeader}>
            <Text style={panelStyles.resultsTitle}>
              {viewMode === 'checking' ? 'Progress' : 'Checking Complete!'}
            </Text>
            {viewMode === 'results' && (
              <TouchableOpacity onPress={exportToCSV} style={panelStyles.exportButton}>
                <Ionicons name="download-outline" size={18} color="#6200EE" />
                <Text style={panelStyles.exportText}>Export</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={panelStyles.summaryRow}>
            <View style={panelStyles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={panelStyles.summaryText}>{bulkCheckState.summary.allotted} Allotted</Text>
            </View>
            <View style={panelStyles.summaryItem}>
              <Ionicons name="close-circle" size={16} color="#F44336" />
              <Text style={panelStyles.summaryText}>{bulkCheckState.summary.notAllotted} Not Allotted</Text>
            </View>
            {bulkCheckState.summary.totalShares > 0 && (
              <View style={panelStyles.summaryItem}>
                <Ionicons name="stats-chart" size={16} color="#6200EE" />
                <Text style={[panelStyles.summaryText, { fontWeight: 'bold', color: '#6200EE' }]}>
                  {bulkCheckState.summary.totalShares} Total Shares
                </Text>
              </View>
            )}
          </View>

          <ScrollView style={panelStyles.resultsList}>
            {bulkCheckState.results.map((result, index) => (
              <View key={index} style={panelStyles.resultItem}>
                {getStatusIcon(result.status)}
                <View style={panelStyles.resultDetails}>
                  <Text style={panelStyles.resultBoid}>{result.boid}</Text>
                  <Text style={panelStyles.resultStatus}>
                    {result.status === 'allotted' 
                      ? `✅ ${result.message || `${result.shares} shares`}` 
                      : result.status === 'not-allotted'
                      ? `❌ ${result.message || 'Not allotted'}`
                      : `⚠️ ${result.error}`}
                  </Text>
                </View>
              </View>
            ))}
            {viewMode === 'checking' && (
              <View style={panelStyles.checkingIndicator}>
                 <ActivityIndicator size="small" color="#6200EE" />
                 <View>
                    <Text style={panelStyles.checkingIndicatorText}>Processing next BOID...</Text>
                    {bulkCheckState.currentCaptcha && (
                      <Text style={panelStyles.captchaFeedback}>
                        {aiProvider.charAt(0).toUpperCase() + aiProvider.slice(1)} Solved: <Text style={panelStyles.captchaCode}>{bulkCheckState.currentCaptcha}</Text>
                      </Text>
                    )}
                 </View>
              </View>
            )}
          </ScrollView>

          {viewMode === 'results' && (
            <TouchableOpacity 
              style={panelStyles.doneButton}
              onPress={() => {
                setViewMode('selection');
                setBulkCheckState({
                  progress: 0,
                  currentIndex: 0,
                  results: [],
                  summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0 }
                });
              }}
            >
              <Text style={panelStyles.doneButtonText}>Done / Check Another</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* 4. MANUAL FALLBACK OVERLAY (Safe "Non-Modal" Implementation) */}
      {manualPrompt.visible && (
        <View style={[StyleSheet.absoluteFill, panelStyles.manualModalOverlay, { elevation: 100, zIndex: 100 }]}>
          <View style={panelStyles.manualModalContent}>
            <View style={panelStyles.manualHeader}>
              <Ionicons name="eye" size={24} color="#6200EE" />
              <Text style={panelStyles.manualTitle}>AI is unsure. Help required!</Text>
            </View>
            
            <Text style={panelStyles.manualSubtitle}>Please solve this captcha for BOID ending in ...{manualPrompt.boid.slice(-4)}</Text>
            
            {manualPrompt.imageBase64 && (
              <View style={panelStyles.captchaDisplayContainer}>
                <View style={panelStyles.captchaFrame}>
                    <Text style={{fontSize: 30, letterSpacing: 4, fontWeight: 'bold'}}>{manualInput || '_____'}</Text>
                    <ActivityIndicator size="small" color="#6200EE" style={{position:'absolute', right: 10}} />
                </View>
                <Text style={panelStyles.noticeText}>Check the website above the modal! (It has the image)</Text>
              </View>
            )}

            <TextInput
              style={panelStyles.manualInput}
              placeholder="Enter 5 Digits"
              keyboardType="number-pad"
              maxLength={5}
              value={manualInput}
              onChangeText={setManualInput}
              autoFocus
            />

            <View style={panelStyles.manualActions}>
              <TouchableOpacity 
                style={panelStyles.manualCancel}
                onPress={() => {
                  manualPrompt.resolvePromise(null);
                  setManualPrompt(prev => ({ ...prev, visible: false }));
                  setManualInput('');
                }}
              >
                <Text style={panelStyles.manualCancelText}>Skip</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[panelStyles.manualSubmit, manualInput.length !== 5 && panelStyles.manualSubmitDisabled]}
                disabled={manualInput.length !== 5}
                onPress={() => {
                  manualPrompt.resolvePromise(manualInput);
                  setManualPrompt(prev => ({ ...prev, visible: false }));
                  setManualInput('');
                }}
              >
                <Text style={panelStyles.manualSubmitText}>Submit & Resume</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
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
  resultsContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 2,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exportText: {
    color: '#6200EE',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  resultsList: {
    maxHeight: 250,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  resultDetails: {
    flex: 1,
  },
  resultBoid: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  resultStatus: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  checkingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  checkingIndicatorText: {
    fontSize: 13,
    color: '#6200EE',
    fontStyle: 'italic',
  },
  captchaFeedback: {
    fontSize: 12,
    color: '#4B5563',
    marginTop: 4,
  },
  captchaCode: {
    fontWeight: 'bold',
    color: '#10B981',
    letterSpacing: 1,
  },
  doneButton: {
    backgroundColor: '#6200EE',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: 'bold',
  },
  // Manual Modal Styles
  manualModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 20,
  },
  manualModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    elevation: 20,
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
});
