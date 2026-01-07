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
        try {
          // Diagnostic logging
          console.log('[CDSC Debug] Page loaded, checking for errors...');
          console.log('[CDSC Debug] Document title:', document.title);
          console.log('[CDSC Debug] Body text length:', document.body.innerText.length);
          
          const bodyText = document.body.innerText;
          
          // Check for error messages
          if (document.title === "Request Rejected" || bodyText.includes("Request Rejected") || bodyText.includes("Connection failed")) {
            console.log('[CDSC Debug] Error detected:', bodyText.substring(0, 200));
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'WAF_BLOCK',
              title: document.title,
              bodyPreview: bodyText.substring(0, 500)
            }));
          } else {
            console.log('[CDSC Debug] Page loaded successfully');
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PAGE_LOADED',
              title: document.title
            }));
          }
        } catch (e) {
          console.error('[CDSC Debug] Error in checkBlockCode:', e);
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRIPT_ERROR',
            error: e.message
          }));
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
          source={{
            uri: currentUrl,
            headers: {
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Referer': 'https://iporesult.cdsc.com.np/',
              'Sec-Fetch-Dest': 'document',
              'Sec-Fetch-Mode': 'navigate',
              'Sec-Fetch-Site': 'same-origin',
              'Upgrade-Insecure-Requests': '1'
            }
          }}
          style={styles.webView}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          scalesPageToFit={false}
          userAgent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          cacheEnabled={false}
          incognito={true}
          sharedCookiesEnabled={true}
          thirdPartyCookiesEnabled={true}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          onLoadStart={() => {
            console.log('🔄 [WebView] Load started:', currentUrl);
            setLoading(true);
            setError(false);
          }}
          onLoadProgress={({ nativeEvent }) => {
            console.log('📊 [WebView] Load progress:', nativeEvent.progress);
          }}
          onLoadEnd={() => {
            console.log('✅ [WebView] Load ended');
            setLoading(false);
            webViewRef.current.injectJavaScript(checkBlockCode);
            webViewRef.current.injectJavaScript(injectionCode);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ [WebView] Error:', nativeEvent);
            setError(true);
          }}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('🌐 [WebView] HTTP Error:', nativeEvent.statusCode, nativeEvent.description);
          }}
          renderError={renderErrorView}
          onMessage={(event) => {
            const rawData = event.nativeEvent.data;
            console.log('📨 [WebView] Message received:', rawData);
            
            try {
              const data = JSON.parse(rawData);
              console.log('📨 [WebView] Parsed message:', data);
              
              if (data.type === 'WAF_BLOCK') {
                console.error('🚫 [WebView] WAF Block detected:', data);
                setError(true);
              } else if (data.type === 'PAGE_LOADED') {
                console.log('✅ [WebView] Page loaded successfully:', data.title);
              } else if (data.type === 'SCRIPT_ERROR') {
                console.error('⚠️ [WebView] Script error:', data.error);
              }
            } catch (e) {
              // Legacy string messages (result extraction)
              if (rawData === "WAF_BLOCK") {
                setError(true);
              } else {
                console.log('📨 [WebView] Result:', rawData);
                onResultExtracted?.(rawData);
              }
            }
          }}
          onShouldStartLoadWithRequest={(request) => {
            console.log('🔗 [WebView] Navigation request:', request.url);
            return true;
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
