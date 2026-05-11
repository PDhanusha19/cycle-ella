import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text } from 'react-native';
import { colors } from '../theme/colors';

// Auth Screens
import SplashScreen from '../screens/onboarding/SplashScreen';
import OnboardingScreen from '../screens/onboarding/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import OTPScreen from '../screens/auth/OTPScreen';

// Onboarding Screens
import HealthProfileScreen from '../screens/onboarding/HealthProfileScreen';
import BMIScreen from '../screens/onboarding/BMIScreen';
import QuestionnaireScreen from '../screens/onboarding/QuestionnaireScreen';
import PeriodHistoryScreen from '../screens/onboarding/PeriodHistoryScreen';

// Main Screens
import DashboardScreen from '../screens/main/DashboardScreen';
import FoodLogScreen from '../screens/main/FoodLogScreen';
import PeriodTrackerScreen from '../screens/main/PeriodTrackerScreen';
import TipsScreen from '../screens/main/TipsScreen';
import ProgressScreen from '../screens/main/ProgressScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import RemindersScreen from '../screens/main/RemindersScreen';
import GynoScreen from '../screens/main/GynoScreen';
import ChatbotScreen from '../screens/main/ChatbotScreen';
import SettingsScreen from '../screens/main/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabIcon({ emoji, label, focused }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, paddingTop: 2 }}>
      <Text style={{ fontSize: 20 }}>{emoji}</Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color: focused ? colors.pink : colors.textSecondary }}>{label}</Text>
      {focused && <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: colors.pink }} />}
    </View>
  );
}

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: false,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
        height: 72,
        paddingBottom: 8,
        paddingTop: 4,
      },
    }}
  >
    <Tab.Screen
      name="Dashboard"
      component={DashboardScreen}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} /> }}
    />
    <Tab.Screen
      name="FoodLog"
      component={FoodLogScreen}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="🍱" label="Food" focused={focused} /> }}
    />
    <Tab.Screen
      name="PeriodTracker"
      component={PeriodTrackerScreen}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="📅" label="Tracker" focused={focused} /> }}
    />
    <Tab.Screen
      name="Tips"
      component={TipsScreen}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="💡" label="Tips" focused={focused} /> }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} /> }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => (
  <NavigationContainer>
    <Stack.Navigator
      initialRouteName="Splash"
      screenOptions={{ headerShown: false }}
    >
      {/* Onboarding */}
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingScreen} />

      {/* Auth */}
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="OTP" component={OTPScreen} />

      {/* Setup */}
      <Stack.Screen name="HealthProfile" component={HealthProfileScreen} />
      <Stack.Screen name="BMI" component={BMIScreen} />
      <Stack.Screen name="Questionnaire" component={QuestionnaireScreen} />
      <Stack.Screen name="PeriodHistory" component={PeriodHistoryScreen} />

      {/* Main App */}
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Progress" component={ProgressScreen} />
      <Stack.Screen name="Reports" component={ReportsScreen} />
      <Stack.Screen name="Reminders" component={RemindersScreen} />
      <Stack.Screen name="Gyno" component={GynoScreen} />
      <Stack.Screen name="Chatbot" component={ChatbotScreen} />
    </Stack.Navigator>
  </NavigationContainer>
);

export default AppNavigator;
