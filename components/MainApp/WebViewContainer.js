import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { WebView } from 'react-native-webview';
import styles from './styles';

const WebViewContainer = forwardRef(
  ({ currentUrl, onResultExtracted }, ref) => {
    const webViewRef = useRef();

    useImperativeHandle(ref, () => ({
      reload: () => webViewRef.current?.reload(),
      injectJavaScript: (script) => {
        webViewRef.current?.injectJavaScript(script);
      },
    }));

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

    return (
      <WebView
        ref={webViewRef}
        source={{ uri: currentUrl }}
        style={styles.webView}
        javaScriptEnabled
        domStorageEnabled
        mixedContentMode="always"
        scalesPageToFit={false}
        onLoadEnd={() => {
          webViewRef.current.injectJavaScript(injectionCode);
        }}
        onMessage={(event) => {
          const result = event.nativeEvent.data;
          console.log('📨 Result from WebView:', result);
          onResultExtracted?.(result);
        }}
      />
    );
  }
);

export default WebViewContainer;
