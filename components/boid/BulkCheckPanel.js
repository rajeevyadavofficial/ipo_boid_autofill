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
  reloadForFreshCaptcha, 
  fetchIPOsDirectly 
} from '../../utils/BulkCheckStrategy';
import { getApiBaseUrl } from '../../utils/config';

export default function BulkCheckPanel({ 
  savedBoids, 
  ipoName, 
  webViewRef,
  visible,
  onModeChange,
  onWebViewMessage // The setter function from MainApp
}) {
  const [viewMode, setViewMode] = useState('selection'); // 'selection' | 'checking' | 'results'

  // Notify parent when viewMode changes
  useEffect(() => {
    onModeChange?.(viewMode);
  }, [viewMode, onModeChange]);

  const [bulkCheckState, setBulkCheckState] = useState({
    progress: 0,
    currentIndex: 0,
    results: [],
    summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0 }
  });

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

  const handleBulkCheck = async () => {
    if (savedBoids.length === 0) {
      alert('No BOIDs saved. Please add BOIDs first.');
      return;
    }

    setViewMode('checking');
    setBulkCheckState({
      progress: 0,
      currentIndex: 0,
      results: [],
      summary: { total: savedBoids.length, allotted: 0, notAllotted: 0, errors: 0 }
    });

    const API_URL = getApiBaseUrl();

    for (let i = 0; i < savedBoids.length; i++) {
      const boid = savedBoids[i].boid;
      setBulkCheckState(prev => ({ ...prev, currentIndex: i, progress: Math.round((i / savedBoids.length) * 100) }));

      try {
        // STEP 1: Extract Captcha
        console.log(`[Bulk] Step 1: Extracting Captcha for ${boid}`);
        const extractScript = generateCaptchaExtractionScript(boid, i === 0);
        webViewRef.current?.injectJavaScript(extractScript);

        const extractionMsg = await waitForMessage('CAPTCHA_IMAGE_READY', boid, 10000);
        
        // STEP 2: Solve from RN (Avoid CORS)
        console.log(`[Bulk] Step 2: Solving Captcha via Gemini for ${boid}`);
        const solveResponse = await fetch(`${API_URL}/captcha/solve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: extractionMsg.imageBase64 })
        });
        const solveData = await solveResponse.json();
        
        if (!solveData.success) throw new Error('AI solve failed: ' + (solveData.error || 'Check backend logs'));

        // STEP 3: Final Submission
        console.log(`[Bulk] Step 3: Submitting form for ${boid}`);
        const submitScript = generateFinalSubmissionScript(boid, solveData.captchaText);
        webViewRef.current?.injectJavaScript(submitScript);

        const resultMsg = await waitForMessage('BULK_CHECK_RESULT', boid, 20000);
        handleResult(resultMsg);

      } catch (error) {
        console.error(`[Bulk] Error checking ${boid}:`, error);
        handleResult({
          boid,
          status: 'error',
          error: error.message,
          success: false
        });
      }

      if (i < savedBoids.length - 1) await sleep(3000);
    }

    setBulkCheckState(prev => ({ ...prev, progress: 100 }));
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
        allotted: newResults.filter(r => r.status === 'allotted').length,
        notAllotted: newResults.filter(r => r.status === 'not-allotted').length,
        errors: newResults.filter(r => r.status === 'error').length
      };

      return {
        ...prev,
        results: newResults,
        summary: newSummary
      };
    });
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const exportToCSV = async () => {
    const { results } = bulkCheckState;
    
    let csv = 'BOID,Status,Shares,Timestamp\n';
    results.forEach(r => {
      csv += `${r.boid},${r.status},${r.shares || 0},${r.timestamp}\n`;
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
    <View style={styles.container}>
      {/* 1. SELECTION MODE: User selects company in WebView */}
      {viewMode === 'selection' && (
        <View style={styles.selectionView}>
          <View style={styles.instructionContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#6200EE" />
            <Text style={styles.instructionText}>
              Please select the <Text style={styles.bold}>IPO Company</Text> from the dropdown in the website above, then click Start.
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.bulkCheckButton}
            onPress={handleBulkCheck}
          >
            <Ionicons name="play" size={20} color="white" />
            <Text style={styles.bulkCheckText}>Start Bulk Check</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* 2. PROGRESS / CHECKING MODE */}
      {viewMode === 'checking' && (
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            Checking IPO Results... {bulkCheckState.progress}%
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${bulkCheckState.progress}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressDetail}>
            Checking {bulkCheckState.currentIndex + 1} of {savedBoids.length}
          </Text>
        </View>
      )}

      {/* 3. RESULTS DISPLAY (Shown during checking and after finish) */}
      {(viewMode === 'checking' || viewMode === 'results') && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {viewMode === 'checking' ? 'Progress' : 'Checking Complete!'}
            </Text>
            {viewMode === 'results' && (
              <TouchableOpacity onPress={exportToCSV} style={styles.exportButton}>
                <Ionicons name="download-outline" size={18} color="#6200EE" />
                <Text style={styles.exportText}>Export</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.summaryText}>{bulkCheckState.summary.allotted} Allotted</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={16} color="#F44336" />
              <Text style={styles.summaryText}>{bulkCheckState.summary.notAllotted} Not Allotted</Text>
            </View>
          </View>

          <ScrollView style={styles.resultsList}>
            {bulkCheckState.results.map((result, index) => (
              <View key={index} style={styles.resultItem}>
                {getStatusIcon(result.status)}
                <View style={styles.resultDetails}>
                  <Text style={styles.resultBoid}>{result.boid}</Text>
                  <Text style={styles.resultStatus}>
                    {result.status === 'allotted' 
                      ? `✅ ${result.shares} shares` 
                      : result.status === 'not-allotted'
                      ? '❌ Not allotted'
                      : `⚠️ ${result.error}`}
                  </Text>
                </View>
              </View>
            ))}
            {viewMode === 'checking' && (
              <View style={styles.checkingIndicator}>
                 <ActivityIndicator size="small" color="#6200EE" />
                 <Text style={styles.checkingIndicatorText}>Processing next BOID...</Text>
              </View>
            )}
          </ScrollView>

          {viewMode === 'results' && (
            <TouchableOpacity 
              style={styles.doneButton}
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
              <Text style={styles.doneButtonText}>Done / Check Another</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
