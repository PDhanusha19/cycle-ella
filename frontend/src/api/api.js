import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform, Alert } from 'react-native';
import useStore from '../store/useStore';
import { resetToLogin } from '../navigation/navigationRef';

// A standalone EAS build (the installed APK) has no Metro dev server
// running inside it, so Constants.expoConfig.hostUri is always undefined
// there — there is nothing to "detect" a host from. It must be supplied at
// build time instead, via app.json's extra.apiUrl, which is what this
// checks first. This used to fall through to a hardcoded LAN IP, which
// silently went stale the moment the dev machine's IP changed (different
// wifi, DHCP renewal, etc.) — every request then hung for the full 30s
// timeout below and failed with no server response, which the login screen
// mislabeled as "Invalid credentials" instead of a connection failure.
// Update extra.apiUrl (and rebuild) whenever the backend's address changes.
//
// Inside Expo Go / a dev client, Metro's own LAN IP (hostUri) is always
// live and correct, so it still takes priority there over a possibly-stale
// configured apiUrl. On web, hostUri is never populated (that's an Expo
// Go/dev-client manifest field only), so the page's own hostname is used
// instead — it's already pointed at wherever Metro is being served from.
const CONFIGURED_API_URL = Constants.expoConfig?.extra?.apiUrl;
const FALLBACK_HOST = '192.168.8.141'; // last resort only — see note above
const metroHost = Platform.OS === 'web'
  ? (typeof window !== 'undefined' ? window.location.hostname : null)
  : Constants.expoConfig?.hostUri?.split(':')?.[0];
const BASE_URL = metroHost
  ? `http://${metroHost}:3000/api`
  : (CONFIGURED_API_URL || `http://${FALLBACK_HOST}:3000/api`);

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