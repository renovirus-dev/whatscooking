// react-native-web's Alert.alert is a no-op, so on web every confirmation and
// error popup silently disappears. This maps it onto the browser dialogs.
import { Alert, Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  Alert.alert = (title, message, buttons) => {
    const text = [title, message].filter(Boolean).join('\n\n');
    const list = Array.isArray(buttons) ? buttons : [];

    if (list.length === 0) {
      window.alert(text);
      return;
    }

    const cancel = list.find((b) => b.style === 'cancel');
    const actions = list.filter((b) => b !== cancel);

    if (actions.length === 0) {
      window.alert(text);
      cancel?.onPress?.();
      return;
    }

    if (actions.length === 1) {
      if (!cancel) {
        window.alert(text);
        actions[0].onPress?.();
        return;
      }
      if (window.confirm(text)) actions[0].onPress?.();
      else cancel.onPress?.();
      return;
    }

    // Three or more choices: offer each action in turn.
    for (const action of actions) {
      if (window.confirm(`${text}\n\nOK = ${action.text || 'Continue'}`)) {
        action.onPress?.();
        return;
      }
    }
    cancel?.onPress?.();
  };
}
