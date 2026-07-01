// ============================================
// FILE: src/utils/sendPushNotification.js
// ============================================

// ✅ Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ─── Send single push notification ───────────
export const sendPushNotification = async ({
  expoPushToken,
  title,
  body,
  data     = {},
  sound    = 'default',
  badge    = 1,
  priority = 'high',
  channelId = 'default',
}) => {
  // ✅ Guard — skip if no token
  if (!expoPushToken) {
    console.log('sendPushNotification: no token provided, skipping');
    return { success: false, error: 'No push token' };
  }

  // ✅ Guard — only send to valid Expo push tokens
  if (!expoPushToken.startsWith('ExponentPushToken[') &&
      !expoPushToken.startsWith('ExpoPushToken[')) {
    console.warn(
      'sendPushNotification: invalid token format:',
      expoPushToken
    );
    return { success: false, error: 'Invalid token format' };
  }

  const message = {
    to:       expoPushToken,
    title,
    body,
    data,
    sound,
    badge,
    priority,
    channelId,
  };

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method:  'POST',
      headers: {
        Accept:         'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(
        `HTTP error: ${response.status} ${response.statusText}`
      );
    }

    const result = await response.json();

    // ✅ Check Expo's response for delivery errors
    if (result?.data?.status === 'error') {
      console.error(
        'Expo push error:',
        result.data.message
      );
      return {
        success: false,
        error:   result.data.message,
      };
    }

    console.log('✅ Push sent successfully:', result);
    return { success: true, result };

  } catch (err) {
    console.error('sendPushNotification error:', err);
    return { success: false, error: err.message };
  }
};

// ─── Send to multiple tokens at once ──────────
// ✅ Expo supports batching up to 100 notifications
// per request — much more efficient than one by one
export const sendPushNotificationBatch = async ({
  tokens,       // array of expoPushTokens
  title,
  body,
  data      = {},
  sound     = 'default',
  badge     = 1,
  priority  = 'high',
  channelId = 'default',
}) => {
  // ✅ Filter out invalid or missing tokens
  const validTokens = (tokens || []).filter(token =>
    token &&
    (token.startsWith('ExponentPushToken[') ||
     token.startsWith('ExpoPushToken['))
  );

  if (validTokens.length === 0) {
    console.log('sendPushNotificationBatch: no valid tokens');
    return {
      success:  false,
      sent:     0,
      error:    'No valid tokens',
    };
  }

  // ✅ Build one message per token
  const messages = validTokens.map(token => ({
    to:       token,
    title,
    body,
    data,
    sound,
    badge,
    priority,
    channelId,
  }));

  // ✅ Chunk into groups of 100 (Expo's limit)
  const chunks     = [];
  const CHUNK_SIZE = 100;
  for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
    chunks.push(messages.slice(i, i + CHUNK_SIZE));
  }

  let totalSent   = 0;
  let totalErrors = 0;
  const errors    = [];

  // ✅ Send each chunk
  for (const chunk of chunks) {
    try {
      const response = await fetch(EXPO_PUSH_URL, {
        method:  'POST',
        headers: {
          Accept:         'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });

      if (!response.ok) {
        throw new Error(
          `HTTP error: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();

      // ✅ Count successes and errors from Expo response
      if (Array.isArray(result?.data)) {
        result.data.forEach(item => {
          if (item.status === 'ok') {
            totalSent++;
          } else {
            totalErrors++;
            errors.push(item.message || 'Unknown error');
          }
        });
      } else {
        totalSent += chunk.length;
      }

    } catch (err) {
      console.error('Batch push chunk error:', err);
      totalErrors += chunk.length;
      errors.push(err.message);
    }
  }

  console.log(
    `✅ Batch push complete: ${totalSent} sent, ${totalErrors} errors`
  );

  return {
    success:    totalErrors === 0,
    sent:       totalSent,
    errors:     totalErrors,
    errorList:  errors,
    total:      validTokens.length,
  };
};

// ─── Send notification to a specific role ─────
// ✅ Helper to send to all users or filtered by role
// users = array of user objects from Firestore
export const sendNotificationToRole = async ({
  users = [],
  role,          // 'all' | 'customer' | 'restaurant_owner'
  title,
  body,
  data = {},
}) => {
  // Filter by role
  let targetUsers = users;
  if (role && role !== 'all') {
    targetUsers = users.filter(u => u.role === role);
  }

  // Extract valid push tokens
  const tokens = targetUsers
    .map(u => u.expoPushToken)
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      success: false,
      error:   `No push tokens found for role: ${role}`,
      sent:    0,
    };
  }

  return sendPushNotificationBatch({
    tokens,
    title,
    body,
    data,
  });
};

// ─── Format notification for common types ─────
// ✅ Helper to build consistent notification messages
export const buildNotification = {

  // New menu posted by restaurant
  newMenu: (restaurantName) => ({
    title: `🍽️ New Menu Posted!`,
    body:  `${restaurantName} has posted today's menu. Check it out!`,
    data:  { type: 'menu_update' },
  }),

  // Promotion / special offer
  promotion: (restaurantName, offerText) => ({
    title: `🎉 Special Offer!`,
    body:  `${restaurantName}: ${offerText}`,
    data:  { type: 'promotion' },
  }),

  // New review on restaurant
  newReview: (restaurantName, rating) => ({
    title: `⭐ New Review`,
    body:  `${restaurantName} received a ${rating}-star review`,
    data:  { type: 'review' },
  }),

  // Admin broadcast
  broadcast: (message) => ({
    title: `📢 What's Cooking`,
    body:  message,
    data:  { type: 'broadcast' },
  }),

  // Welcome new user
  welcome: (firstName) => ({
    title: `👋 Welcome, ${firstName}!`,
    body:  `Discover amazing restaurants near you on What's Cooking`,
    data:  { type: 'welcome' },
  }),
};