import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import useStore from '../store/useStore';
import { resetToLogin } from '../navigation/navigationRef';

// The backend runs on the same dev machine as the Metro bundler, so reuse
// Metro's own LAN IP instead of a hardcoded one — hardcoding it breaks every
// time this machine's IP changes (different wifi, DHCP renewal, etc.), which
// silently hangs every request until the 30s timeout below with no visible
// error. On web, Constants.expoConfig.hostUri is never populated (that's an
// Expo Go/dev-client manifest field, not something a plain browser page
// gets), so use the page's own hostname there instead — it's already
// pointed at wherever Metro is being served from. Falls back to a fixed IP
// only if neither is available (e.g. a production build, where this should
// be replaced with a real API URL).
const FALLBACK_HOST = '10.49.252.46';
const metroHost = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.location.hostname : null)
  : Constants.expoConfig?.hostUri?.split(':')?.[0];
const BASE_URL = `http://${metroHost || FALLBACK_HOST}:3000/api`;

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  }
});

api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.log('Token fetch error:', e);
  }
  return config;
});

// A stale/expired token used to fail silently — every screen just looked
// broken (empty data, chatbot falling back to unrelated FAQ answers) with
// no indication that re-logging in would fix it. This catches any 401 from
// `protect`-guarded routes globally, clears the dead session, and forces
// a clean return to Login instead of leaving the app in that confusing
// half-working state. Debounced so a burst of parallel requests failing
// together (e.g. the dashboard's ~6 concurrent calls) only triggers one
// redirect, not six.
let handling401 = false;
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && !handling401) {
      handling401 = true;
      await useStore.getState().logout();
      resetToLogin();
      Alert.alert('Session expired', 'Please log in again.');
      setTimeout(() => { handling401 = false; }, 1000);
    }
    return Promise.reject(error);
  }
);

export default api;