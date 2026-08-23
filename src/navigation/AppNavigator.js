import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import SplashScreen from '../screens/SplashScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AttendanceScreen from '../screens/AttendanceScreen';
import NotificationScreen from '../screens/NotificationScreen';
import BusTrackScreen from '../screens/BusTrackScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ModuleScreen from '../screens/ModuleScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import RegisterScreen from '../screens/RegisterScreen';
import { COLORS } from '../constants/colors';
import { SHADOWS } from '../utils/shadow';
import { ms, fs } from '../utils/responsive';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, label, focused }) {
  const { width } = useWindowDimensions();
  return (
    <View style={[styles.tabIconWrapper, { width: width / 3 }]}>
      <Text style={[styles.tabEmoji, focused && styles.tabEmojiFocused]}>{emoji}</Text>
      <Text
        style={[styles.tabLabel, focused && styles.tabLabelFocused]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="👤" label="Profile" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏠" label="Home" focused={focused} />
          ),
        }}
      />
      <Tab.Screen
        name="ModuleTab"
        component={ModuleScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⊞" label="Module" focused={focused} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Register" component={RegisterScreen} />
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="BusTrack" component={BusTrackScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="Notifications" component={NotificationScreen} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: ms(70, 0.3),
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    ...SHADOWS.tabBar,
  },
  tabIconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: ms(6),
    paddingHorizontal: ms(6),
  },
  tabEmoji: {
    fontSize: fs(22),
    opacity: 0.5,
  },
  tabEmojiFocused: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: fs(11),
    marginTop: ms(3),
    color: COLORS.tabInactive,
    fontWeight: '500',
    textAlign: 'center',
    includeFontPadding: false,
  },
  tabLabelFocused: {
    color: COLORS.tabActive,
    fontWeight: '700',
  },
});
