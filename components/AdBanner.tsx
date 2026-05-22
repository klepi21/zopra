import React, { useState } from 'react';
import { View, StyleSheet, Platform, Text } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// Use Google's official Test Ad IDs for now
const adUnitId = TestIds.BANNER;

/*
const adUnitIdReal = __DEV__ 
  ? TestIds.BANNER
  : Platform.OS === 'ios'
    ? 'ca-app-pub-7198509049220853/9334049240' // Real iOS Banner Ad Unit
    : 'ca-app-pub-3940256099942544/6300978111'; // Android still uses Test ID until provided
*/

export default function AdBanner() {
  const [isAdFailed, setIsAdFailed] = useState(false);

  if (isAdFailed) {
    return (
      <View style={styles.placeholderContainer}>
        <Text style={styles.placeholderText}>Διαφήμιση</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.error('Banner Ad failed to load:', error);
          setIsAdFailed(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    backgroundColor: 'transparent',
  },
  placeholderContainer: {
    width: '100%',
    height: 50,
    backgroundColor: '#1E233C',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    borderRadius: 8,
  },
  placeholderText: {
    color: '#55627E',
    fontSize: 12,
    fontWeight: '700',
  }
});
