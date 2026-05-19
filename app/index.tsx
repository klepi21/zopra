import React from 'react';
import { StyleSheet, View, ActivityIndicator, Text } from 'react-native';

export default function EntryScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Όνομα Ζώο Πράγμα</Text>
      <ActivityIndicator size="large" color="#FF3B30" style={styles.loader} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
    letterSpacing: 1,
  },
  loader: {
    marginTop: 10,
  },
});
