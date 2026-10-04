import { Alert, Platform } from 'react-native';

// react-native-web's Alert.alert is a no-op stub (see
// node_modules/react-native-web/dist/exports/Alert) — it never shows a
// dialog and never calls any button's onPress, so any confirm-then-act flow
// (like signing out) silently does nothing on web. window.confirm is the
// real equivalent there.
export function confirmAsync(title, message, confirmLabel = 'OK') {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
