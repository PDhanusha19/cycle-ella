import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your backend URL
const BASE_URL = 'http://10.0.2.2:5000/api'; // Android emulator
// const BASE_URL = 'http://localhost:5000/api'; // iOS

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

// Add token to every request automatically
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;