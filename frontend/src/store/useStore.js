import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useStore = create((set) => ({
  // Auth
  token: null,
  user: null,
  isLoggedIn: false,

  // Health Profile
  healthProfile: null,
  measurements: null,

  // Cycle
  currentPhase: null,
  periodLogs: [],

  // Food
  foodLogs: [],
  dailyNutrition: null,

  // Tips
  todaysTips: null,
  healthScore: 0,

  // PCOS
  pcosRisk: null,

  // Actions
  setToken: (token) => set({ token, isLoggedIn: !!token }),
  setUser: (user) => set({ user }),
  setHealthProfile: (healthProfile) => set({ healthProfile }),
  setMeasurements: (measurements) => set({ measurements }),
  setCurrentPhase: (currentPhase) => set({ currentPhase }),
  setPeriodLogs: (periodLogs) => set({ periodLogs }),
  setFoodLogs: (foodLogs) => set({ foodLogs }),
  setDailyNutrition: (dailyNutrition) => set({ dailyNutrition }),
  setTodaysTips: (todaysTips) => set({ todaysTips }),
  setHealthScore: (healthScore) => set({ healthScore }),
  setPcosRisk: (pcosRisk) => set({ pcosRisk }),

  // Load token from storage
  loadToken: async () => {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user');
    if (token) {
      set({
        token,
        isLoggedIn: true,
        user: userStr ? JSON.parse(userStr) : null
      });
    }
  },

  // Logout
  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    set({
      token: null,
      user: null,
      isLoggedIn: false,
      healthProfile: null,
      measurements: null,
      currentPhase: null,
      periodLogs: [],
      foodLogs: [],
      dailyNutrition: null,
      todaysTips: null,
      healthScore: 0,
      pcosRisk: null
    });
  }
}));

export default useStore;