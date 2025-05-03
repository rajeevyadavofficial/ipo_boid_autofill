import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Video } from 'expo-av'; // using expo-video

export default function SplashScreen({ onFinish }) {
  const [isResourcesLoaded, setIsResourcesLoaded] = useState(false);
  const [isVideoFinished, setIsVideoFinished] = useState(false);

  useEffect(() => {
    // Start loading resources as soon as splash starts
    loadResources();
  }, []);

  useEffect(() => {
    // When both video and resources are ready, trigger onFinish
    if (isResourcesLoaded && isVideoFinished) {
      onFinish();
    }
  }, [isResourcesLoaded, isVideoFinished]);

  const loadResources = async () => {
    try {
      // TODO: Your loading logic here
      await new Promise((resolve) => setTimeout(resolve, 3000)); // Simulating 3 seconds loading
      setIsResourcesLoaded(true);
    } catch (error) {
      console.error('Failed loading resources', error);
    }
  };

  return (
    <View style={styles.container}>
      <Video
        source={require('../assets/splash.mp4')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={(status) => {
          if (status.didJustFinish) {
            setIsVideoFinished(true);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
});
