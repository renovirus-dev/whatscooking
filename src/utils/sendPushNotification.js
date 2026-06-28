// ============================================
// FILE: src/utils/sendPushNotification.js
// ============================================

// ✅ Call this from your backend or Firebase Cloud Function
// NEVER expose secret keys in your app

export const sendPushNotification = async ({
  expoPushToken,
  title,
  body,
  data = {},
}) => {
  const message = {
    to:    expoPushToken,
    sound: 'default',
    title,
    body,
    data,
    priority:           'high',
    channelId:          'default',
    badge:              1,
  };

  try {
    const response = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method:  'POST',
        headers: {
          Accept:         'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      }
    );

    const result = await response.json();
    console.log('Push sent:', result);
    return { success: true, result };
  } catch (err) {
    console.error('sendPushNotification error:', err);
    return { success: false, error: err.message };
  }
};