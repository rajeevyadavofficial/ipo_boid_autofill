import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateBulkCheckScript, reloadForFreshCaptcha } from '../../utils/BulkCheckStrategy';

export default function BulkCheckPanel({ 
  savedBoids, 
  ipoName, 
  webViewRef,
  visible 
}) {
  const [bulkCheckState, setBulkCheckState] = useState({
    isChecking: false,
    progress: 0,
    currentIndex: 0,
    results: [],
    summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0 }
  });

  const messageHandlerRef = useRef(null);

  const handleBulkCheck = async () => {
    if (savedBoids.length === 0) {
      alert('No BOIDs saved. Please add BOIDs first.');
      return;
    }

    if (!ipoName) {
      alert('IPO name not available');
      return;
    }

    // Reset state
    setBulkCheckState({
      isChecking: true,
      progress: 0,
      currentIndex: 0,
      results: [],
      summary: { total: savedBoids.length, allotted: 0, notAllotted: 0, errors: 0 }
    });

    // Process each BOID sequentially
    for (let i = 0; i < savedBoids.length; i++) {
      const boid = savedBoids[i].boid;
      
      // Update current index
      setBulkCheckState(prev => ({
        ...prev,
        currentIndex: i,
        progress: Math.round((i / savedBoids.length) * 100)
      }));

      // Reload page for fresh captcha (except first iteration)
      if (i > 0) {
        webViewRef.current?.injectJavaScript(reloadForFreshCaptcha());
        await sleep(2000); // Wait for page reload
      }

      // Inject check script
      const script = generateBulkCheckScript(ipoName, boid);
      webViewRef.current?.injectJavaScript(script);

      // Wait for result
      await waitForResult(boid);

      // Delay before next check (rate limiting)
      if (i < savedBoids.length - 1) {
        await sleep(3000);
      }
    }

    // Mark as complete
    setBulkCheckState(prev => ({
      ...prev,
      isChecking: false,
      progress: 100
    }));
  };

  const waitForResult = (boid) => {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Timeout after 15 seconds
        handleResult({
          boid,
          status: 'error',
          error: 'Timeout - no response',
          success: false
        });
        resolve();
      }, 15000);

      messageHandlerRef.current = (event) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          
          if (data.type === 'BULK_CHECK_RESULT' && data.boid === boid) {
            clearTimeout(timeout);
            handleResult(data);
            resolve();
          }
        } catch (error) {
          console.error('Error parsing WebView message:', error);
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
        title: `IPO Results - ${ipoName}`,
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

  // Attach message handler to WebView
  React.useEffect(() => {
    if (visible && webViewRef.current && messageHandlerRef.current) {
      webViewRef.current.onMessage = messageHandlerRef.current;
    }
  }, [visible, messageHandlerRef.current]);

  return (
    <View style={styles.container}>
      {/* Bulk Check Button */}
      {!bulkCheckState.isChecking && bulkCheckState.results.length === 0 && (
        <TouchableOpacity 
          style={styles.bulkCheckButton}
          onPress={handleBulkCheck}
        >
          <Ionicons name="flash" size={20} color="white" />
          <Text style={styles.bulkCheckText}>Bulk Check All BOIDs</Text>
        </TouchableOpacity>
      )}

      {/* Progress Indicator */}
      {bulkCheckState.isChecking && (
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

      {/* Results Display */}
      {bulkCheckState.results.length > 0 && (
        <View style={styles.resultsContainer}>
          <View style={styles.resultsHeader}>
            <Text style={styles.resultsTitle}>
              {bulkCheckState.isChecking ? 'Checking...' : 'Results Complete!'}
            </Text>
            {!bulkCheckState.isChecking && (
              <TouchableOpacity onPress={exportToCSV} style={styles.exportButton}>
                <Ionicons name="download-outline" size={18} color="#6200EE" />
                <Text style={styles.exportText}>Export CSV</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.summaryText}>{bulkCheckState.summary.allotted} allotted</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={16} color="#F44336" />
              <Text style={styles.summaryText}>{bulkCheckState.summary.notAllotted} not allotted</Text>
            </View>
            {bulkCheckState.summary.errors > 0 && (
              <View style={styles.summaryItem}>
                <Ionicons name="alert-circle" size={16} color="#FF9800" />
                <Text style={styles.summaryText}>{bulkCheckState.summary.errors} errors</Text>
              </View>
            )}
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
          </ScrollView>

          {!bulkCheckState.isChecking && (
            <TouchableOpacity 
              style={styles.doneButton}
              onPress={() => setBulkCheckState({
                isChecking: false,
                progress: 0,
                currentIndex: 0,
                results: [],
                summary: { total: 0, allotted: 0, notAllotted: 0, errors: 0 }
              })}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
  },
  bulkCheckButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6200EE',
    padding: 14,
    borderRadius: 8,
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
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  progressText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6200EE',
  },
  progressDetail: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
  },
  resultsContainer: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
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
    color: '#333',
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
    gap: 12,
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryText: {
    fontSize: 12,
    color: '#666',
  },
  resultsList: {
    maxHeight: 200,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  resultDetails: {
    flex: 1,
  },
  resultBoid: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  doneButton: {
    backgroundColor: '#6200EE',
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
