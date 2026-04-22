import './src/i18n';
import { enableScreens } from 'react-native-screens';
enableScreens();

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import Mapbox from '@rnmapbox/maps';

// Configure how foreground notifications are displayed
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
import RootNavigator from './src/navigation/RootNavigator';
import { MAPBOX_ACCESS_TOKEN } from './src/config/env';
import { useSettingsStore } from './src/stores/settingsStore';
import { syncLanguageFromStore } from './src/i18n';

// Disable console in production to avoid JS thread blocking on Android
if (!__DEV__) {
  console.log = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.error = () => {};
}

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

// Keep splash visible until app is ready
SplashScreen.preventAutoHideAsync();

function App() {
  const language = useSettingsStore((s) => s.language);
  useEffect(() => {
    syncLanguageFromStore(language);
  }, [language]);

  useEffect(() => {
    // Hide splash as soon as component mounts (app is ready)
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

export default App;
