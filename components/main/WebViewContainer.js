import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import styles from '../../styles/styles';
import WebViewStrategies from '../../utils/WebViewStrategies';
import { COLORS } from '../../utils/theme';

const WebViewContainer = forwardRef(
  (props, ref) => {
    const { currentUrl, onResultExtracted, onMessage } = props;
    const webViewRef = useRef();
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0); // Used to force reload
    const [userAgent, setUserAgent] = useState(null);
    const [webViewConfig, setWebViewConfig] = useState(WebViewStrategies.getWebViewConfig());

    useEffect(() => {
      let mounted = true;

      const loadStrategy = async () => {
        const nextUserAgent = await WebViewStrategies.getUserAgent();
        if (!mounted) return;
        setUserAgent(nextUserAgent);
        setWebViewConfig(WebViewStrategies.getWebViewConfig());
      };

      loadStrategy();

      return () => {
        mounted = false;
      };
    }, [key]);

    const reloadWithCurrentStrategy = async () => {
      setError(false);
      setLoading(true);
      setWebViewConfig(WebViewStrategies.getWebViewConfig());
      setUserAgent(await WebViewStrategies.getUserAgent());
      setKey(prev => prev + 1);
    };

    const tryNextStrategy = async () => {
      const hasNext = WebViewStrategies.switchToNextStrategy();
      if (!hasNext) {
        setError(true);
        return;
      }
      await reloadWithCurrentStrategy();
    };

    useImperativeHandle(ref, () => ({
      reload: () => {
        reloadWithCurrentStrategy();
      },
      injectJavaScript: (script) => {
        webViewRef.current?.injectJavaScript(script);
      },
    }));

    const handleOpenInChrome = () => {
      Linking.openURL(currentUrl).catch(err => console.error("Couldn't load page", err));
    };

    const handleManualRefresh = () => {
      reloadWithCurrentStrategy();
    };

    const bridgeBootstrapCode = `
      (function() {
        window.__IPOBridgePost = function(payload) {
          try {
            var message = typeof payload === 'string' ? payload : JSON.stringify(payload);
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(message);
              return true;
            }
          } catch (error) {}
          return false;
        };

        window.open = function(url) {
          try {
            if (url) {
              window.location.href = url;
            }
          } catch (error) {}
          return null;
        };
      })();
      true;
    `;

    const checkBlockCode = `
      (function() {
        const bridgePost = window.__IPOBridgePost || function(payload) {
          const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
          window.ReactNativeWebView.postMessage(message);
        };
        try {
          const bodyText = document.body.innerText;
          if (document.title === "Request Rejected" || bodyText.includes("Request Rejected") || bodyText.includes("Connection failed")) {
            bridgePost({ type: 'WAF_BLOCK' });
          } else {
            bridgePost({ type: 'PAGE_LOADED', title: document.title });
          }
        } catch (e) {
          bridgePost({ type: 'SCRIPT_ERROR', error: e.message });
        }
      })();
      true;
    `;

    const normalizePageCode = `
      (function() {
        try {
          document.documentElement.style.background = '#222944';
          if (document.body) {
            document.body.style.background = '#222944';
            document.body.style.margin = '0';
            document.body.style.width = '100%';
            document.body.style.maxWidth = '100%';
            document.body.style.overflowX = 'hidden';
          }

          var meta = document.querySelector('meta[name="viewport"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'viewport';
            document.head.appendChild(meta);
          }
          meta.content = 'width=device-width, initial-scale=1, maximum-scale=1.05, user-scalable=no';

          var css = [
            'html, body { width: 100% !important; min-width: 100% !important; max-width: 100% !important; margin: 0 !important; overflow-x: hidden !important; background: #222944 !important; }',
            'body > * { max-width: 100vw !important; }',
            '.container, .container-fluid, .main, app-root, .app-root, .content, .content-wrapper, .page-wrapper { width: 100% !important; max-width: 100vw !important; overflow-x: hidden !important; box-sizing: border-box !important; }',
            '.container, .container-fluid { padding-left: 6px !important; padding-right: 6px !important; }',
            '.card, .form-control, .ng-select { max-width: calc(100vw - 12px) !important; box-sizing: border-box !important; }'
          ].join('\\n');
          var style = document.getElementById('ipo-webview-normalizer');
          if (!style) {
            style = document.createElement('style');
            style.id = 'ipo-webview-normalizer';
            document.head.appendChild(style);
          }
          style.textContent = css;
        } catch (e) {}
      })();
      true;
    `;

    const injectionCode = `
      (function() {
        const bridgePost = window.__IPOBridgePost || function(payload) {
          const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
          window.ReactNativeWebView.postMessage(message);
        };

        function getCompanyName() {
          // Selector for CDSC portal's ng-select selected value label
          const label = document.querySelector('ng-select[name="companyName"] .ng-value-label') ||
                        document.querySelector('.ng-value-label');
          return label ? label.innerText.trim() : "";
        }

        function reportCompany() {
          const name = getCompanyName();
          if (name && name !== "Select company") {
            bridgePost({
              type: 'COMPANY_SELECTED',
              company: name
            });
            console.log("Captured Company:", name);
            return true;
          }
          return false;
        }

        // 1. Initial Capture
        let lastReported = "";
        const initInterval = setInterval(() => {
          const current = getCompanyName();
          if (current) {
            reportCompany();
            lastReported = current;
            clearInterval(initInterval);
          }
        }, 1000);

        // 2. Observer for Dynamic Changes (Angular)
        const observer = new MutationObserver(() => {
          const current = getCompanyName();
          if (current && current !== lastReported) {
             reportCompany();
             lastReported = current;
          }
        });

        // Watch the whole body for ng-select updates
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });

        // 3. Keep standard button binding
        const btnInterval = setInterval(() => {
          const btn = document.querySelector('button[type="submit"], button.btn, .btn');
          if (btn && !btn.disabled && !btn.dataset.bound) {
            btn.dataset.bound = "true";
            btn.addEventListener("click", function() {
              setTimeout(() => {
                const body = document.body.innerText.toLowerCase();
                let result = "No result found";
                if (body.includes("congrat")) {
                  result = "Congratulations!";
                } else if (body.includes("sorry")) {
                  result = "Sorry, not allotted";
                }
                bridgePost(result);
              }, 1000);
            });
          }
        }, 2000);
      })();
      true;
    `;

    const renderErrorView = () => (
      <View style={{ flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Ionicons name="cloud-offline-outline" size={64} color={COLORS.accent} />
        <Text style={{ color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginTop: 20, textAlign: 'center' }}>
          Connection Failed
        </Text>
        <Text style={{ color: COLORS.mutedText, fontSize: 14, marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
          It will be back when CDSC server will be back.
        </Text>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25, marginTop: 30 }}
          onPress={handleManualRefresh}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );

    return (
      <View style={{ flex: 1, backgroundColor: COLORS.primary, overflow: 'hidden' }}>
        {/* Top Control Bar */}
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 15,
          paddingVertical: 10,
          paddingTop: (props.topInset || 0) + 12,
          backgroundColor: COLORS.surface,
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

        <View style={{ flex: 1, width: '100%', backgroundColor: COLORS.primary, overflow: 'hidden' }}>
        <WebView
          ref={webViewRef}
          key={key} // Key change forces full re-mount/reload
          source={{ uri: currentUrl }}
          style={styles.webView}
          containerStyle={{ flex: 1, width: '100%', backgroundColor: COLORS.primary }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mixedContentMode="always"
          thirdPartyCookiesEnabled={true}
          sharedCookiesEnabled={true}
          cacheEnabled={webViewConfig.cacheEnabled}
          cacheMode="LOAD_CACHE_ELSE_NETWORK"
          incognito={webViewConfig.incognito}
          userAgent={userAgent || undefined}
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={true}
          androidLayerType="hardware"
          androidHardwareAccelerationDisabled={false}
          textZoom={100}
          pullToRefreshEnabled={true}
          allowsBackForwardNavigationGestures={true}
          originWhitelist={['*']}
          applicationNameForUserAgent="Chrome Mobile"
          injectedJavaScriptBeforeContentLoaded={`${bridgeBootstrapCode}\n${normalizePageCode}`}
          startInLoadingState={false} // We handle loading manually to avoid default spinner
          onLoadStart={() => {
            setLoading(true);
            setError(false);
          }}
          onLoadEnd={() => {
            setLoading(false);
            webViewRef.current?.injectJavaScript(normalizePageCode);
            webViewRef.current?.injectJavaScript(checkBlockCode);
            webViewRef.current?.injectJavaScript(injectionCode);
          }}
          onHttpError={(syntheticEvent) => {
            if (syntheticEvent.nativeEvent.statusCode >= 500) {
              tryNextStrategy();
            }
          }}
          onError={() => {
            tryNextStrategy();
          }}
          renderError={() => <View />} // We handle error view manually below
          onMessage={(event) => {
            const rawData = event.nativeEvent.data;
            onMessage?.(event);
            try {
              const data = JSON.parse(rawData);
              if (data.type === 'WAF_BLOCK') {
                tryNextStrategy();
              } else if (data.type === 'PAGE_LOADED') {
                WebViewStrategies.resetStrategy();
              }
            } catch (e) {
              if (rawData === "WAF_BLOCK") tryNextStrategy();
              else onResultExtracted?.(rawData);
            }
          }}
        />
        </View>

        {loading && !error && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: COLORS.overlay, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={COLORS.accent} />
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
