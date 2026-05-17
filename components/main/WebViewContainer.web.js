// E:\ipo-app\frontend\components\main\WebViewContainer.web.js
import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/theme';

const WebViewContainer = forwardRef((props, ref) => {
  const { currentUrl } = props;
  const [key, setKey] = useState(0);

  useImperativeHandle(ref, () => ({
    reload: () => {
      setKey(prev => prev + 1);
    },
    injectJavaScript: (script) => {
      console.log('WebView.injectJavaScript is not supported on web. Script:', script);
    },
  }));

  const handleOpenInChrome = () => {
    Linking.openURL(currentUrl).catch(err => console.error("Couldn't load page", err));
  };

  const handleManualRefresh = () => {
    setKey(prev => prev + 1);
  };

  const isResultSite = currentUrl && currentUrl.includes('iporesult.cdsc.com.np');

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
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
        borderBottomColor: 'rgba(255,255,255,0.1)',
        elevation: 4
      }}>
        <TouchableOpacity
          onPress={handleManualRefresh}
          style={{ flexDirection: 'row', alignItems: 'center' }}
        >
          <Ionicons name="refresh-circle-outline" size={24} color="white" />
          <Text style={{ color: 'white', marginLeft: 6, fontWeight: '600', fontSize: 14 }}>Reload</Text>
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, textTransform: 'uppercase' }} numberOfLines={1}>
                {currentUrl}
            </Text>
        </View>

        <TouchableOpacity
          onPress={handleOpenInChrome}
          style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.accent, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
        >
          <Text style={{ color: 'white', marginRight: 6, fontSize: 12, fontWeight: 'bold' }}>OPEN</Text>
          <Ionicons name="open-outline" size={16} color="white" />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' }}>
        {isResultSite ? (
            <View style={{ padding: 40, alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={80} color={COLORS.accent} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginTop: 20, textAlign: 'center' }}>
                    Security Restriction
                </Text>
                <Text style={{ fontSize: 14, color: COLORS.mutedText, marginTop: 10, textAlign: 'center', lineHeight: 20 }}>
                    The CDSC Result page blocks being loaded inside other websites for security reasons.
                </Text>
                <TouchableOpacity
                    onPress={handleOpenInChrome}
                    style={{ marginTop: 30, backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 30, elevation: 2 }}
                >
                    <Text style={{ color: 'white', fontWeight: 'bold' }}>Launch CDSC Results</Text>
                </TouchableOpacity>
            </View>
        ) : (
            <iframe
                key={key}
                src={currentUrl}
                style={{ width: '100%', height: '100%', border: 'none' }}
                title="MeroShare WebView"
            />
        )}
      </View>

      <View style={{ padding: 15, backgroundColor: COLORS.surface, borderTopWidth: 1, borderColor: COLORS.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name="information-circle" size={20} color={COLORS.accent} />
            <Text style={{ color: COLORS.mutedText, fontSize: 12, flex: 1 }}>
                <Text style={{ fontWeight: 'bold', color: COLORS.text }}>Web Limitation:</Text> Auto-automation (result checking) works on your phone via the native app. In the browser, please use the Bulk Check API feature instead.
            </Text>
        </View>
      </View>
    </View>
  );
});

export default WebViewContainer;
