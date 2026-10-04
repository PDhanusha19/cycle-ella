import { createNavigationContainerRef } from '@react-navigation/native';

// Lets code outside the component tree (the axios interceptor in api.js,
// which fires on a 401 from anywhere) force navigation back to Login
// without needing a `navigation` prop passed down through everything.
export const navigationRef = createNavigationContainerRef();

export function resetToLogin() {
  if (navigationRef.isReady()) {
    navigationRef.reset({ index: 0, routes: [{ name: 'Login' }] });
  }
}
