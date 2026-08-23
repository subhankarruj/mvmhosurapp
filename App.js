import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { UserProvider } from './src/context/UserContext';
import { NotificationProvider } from './src/context/NotificationContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import UpdateBanner from './src/components/UpdateBanner';
import { navigationRef } from './src/navigation/RootNavigation';

export default function App() {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <UserProvider>
          <NotificationProvider navigationRef={navigationRef}>
            <NavigationContainer ref={navigationRef}>
              <AppNavigator />
            </NavigationContainer>
            <UpdateBanner />
          </NotificationProvider>
        </UserProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
