import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import styles from '../../styles/styles';

const WebViewContainer = forwardRef(
  (props, ref) => {
    const { currentUrl, onResultExtracted, onMessage } = props;
    const webViewRef = useRef();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0); // Used to force reload

    useImperativeHandle(ref, () => ({
      reload: () => {
        setError(false);
        setKey(prev => prev + 1);
      },
      injectJavaScript: (script) => {
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    const handleOpenInChrome = () => {
      Linking.openURL(currentUrl).catch(err => console.error("Couldn't load page", err));
    };

    const handleManualRefresh = () => {
      setError(false);
      setKey(prev => prev + 1);
    };

    const checkBlockCode = `
      (function() {
        try {
          const bodyText = document.body.innerText;
          if (document.title === "Request Rejected" || bodyText.includes("Request Rejected") || bodyText.includes("Connection failed")) {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'WAF_BLOCK' }));
          } else {
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'PAGE_LOADED', title: document.title }));
          }
        } catch (e) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SCRIPT_ERROR', error: e.message }));
        }
      })();
      true;
    `;

    const injectionCode = `
      (function() {
        const interval = setInterval(() => {
          const btn = document.querySelector('button[type="submit"]');
          if (btn && !btn.disabled && !btn.dataset.bound) {
            btn.dataset.bound = "true";
            btn.addEventListener("click", function() {
              setTimeout(() => {
                const body = document.body.innerText.toLowerCase();
                let result = "No result found";
                if (body.includes("congrat")) {
                  result = "🎉 Congratulations!";
                } else if (body.includes("sorry")) {
                  result = "❌ Sorry, not allotted";
                }
                window.ReactNativeWebView.postMessage(result);
              }, 1000);
            });
            clearInterval(interval);
          }
        }, 500);
      })();
      true;
    `;

    const renderErrorView = () => (
      <View style={{ flex: 1, backgroundColor: '#f8f9fa', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="cloud-offline-outline" size={64} color="#F44336" />
        <Text style={{ color: '#333', fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          Connection Failed
        </Text>
        <Text style={{ color: '#666', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
          It will be back when CDSC server will be back.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#6200EE', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 30 }}
          onPress={handleManualRefresh}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        {/* Top Control Bar */}
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          paddingHorizontal: 15, 
          paddingVertical: 10,
          paddingTop: (props.topInset || 0) + 12, 
          backgroundColor: '#333a56', 
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(255,255,255,0.1)'
        }}>
          <TouchableOpacity 
            onPress={handleManualRefresh} 
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            <Ionicons name="refresh-circle-outline" size={24} color="white" />
            <Text style={{ color: 'white', marginLeft: 6, fontWeight: '600', fontSize: 14 }}>Refresh</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={handleOpenInChrome} 
            style={{ flexDirection: 'row', alignItems: 'center', padding: 6 }}
          >
            <Text style={{ color: 'white', marginRight: 6, fontSize: 14, fontWeight: '500' }}>Browser</Text>
            <Ionicons name="globe-outline" size={20} color="white" />
          </TouchableOpacity>
        </View>

        <WebView
          ref={webViewRef}
          key={key} // Key change forces full re-mount/reload
          source={{ uri: currentUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={false} // We handle loading manually to avoid default spinner
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => {
            setLoading(false);
            webViewRef.current.injectJavaScript(checkBlockCode);
            webViewRef.current.injectJavaScript(injectionCode);
          }}
          onError={() => setError(true)}
          renderError={() => <View />} // We handle error view manually below
          onMessage={(event) => {
            const rawData = event.nativeEvent.data;
            onMessage?.(event);
            try {
              const data = JSON.parse(rawData);
              if (data.type === 'WAF_BLOCK') {
                setError(true);
              }
            } catch (e) {
              if (rawData === "WAF_BLOCK") setError(true);
              else onResultExtracted?.(rawData);
            }
          }}
        />
        
        {loading && !error && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#6200EE" />
          </View>
        )}
        
        {error && (
          <View style={StyleSheet.absoluteFillObject}>
            {renderErrorView()}
          </View>
        )}
      </View>
    );
  }
);

export default WebViewContainer;

