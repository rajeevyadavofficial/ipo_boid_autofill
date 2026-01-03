import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import styles from '../../styles/styles';

const WebViewContainer = forwardRef(
  ({ currentUrl, onResultExtracted }, ref) => {
    const webViewRef = useRef();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);

    useImperativeHandle(ref, () => ({
      reload: () => webViewRef.current?.reload(),
      injectJavaScript: (script) => {
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    const checkBlockCode = `
      (function() {
        const bodyText = document.body.innerText;
        if (document.title === "Request Rejected" || bodyText.includes("Request Rejected") || bodyText.includes("Connection failed")) {
          window.ReactNativeWebView.postMessage("WAF_BLOCK");
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
      <View style={{ flex: 1, backgroundColor: '#343a40', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="cloud-offline-outline" size={64} color="#6200EE" />
        <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          CDSC Server Busy
        </Text>
        <Text style={{ color: '#aaa', fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
          The CDSC website is currently rejecting requests or is under heavy load. Please try again.
        </Text>
        <TouchableOpacity 
          style={{ backgroundColor: '#6200EE', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 30 }}
          onPress={() => {
            setError(false);
            webViewRef.current?.reload();
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Refresh Page</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ flex: 1 }}>
        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          scalesPageToFit={false}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36"
          cacheEnabled={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
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
          renderError={renderErrorView}
          onMessage={(event) => {
            const data = event.nativeEvent.data;
            if (data === "WAF_BLOCK") {
              setError(true);
            } else {
              console.log('📨 Result from WebView:', data);
              onResultExtracted?.(data);
            }
          }}
        />
        {loading && !error && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: '#343a40', justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#6200EE" />
            <Text style={{ color: 'white', marginTop: 10 }}>Connecting to CDSC...</Text>
          </View>
        )}
        {error && renderErrorView()}
      </View>
    );
  }
);

export default WebViewContainer;
