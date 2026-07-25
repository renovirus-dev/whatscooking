// ============================================
// FILE: src/navigation/AppNavigator.js
// ============================================
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ActivityIndicator,
  TouchableOpacity, ScrollView, StatusBar,
} from 'react-native';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { Ionicons }                   from '@expo/vector-icons';
import { useSafeAreaInsets }          from 'react-native-safe-area-context';
import { useAuth }                    from '../hooks/useAuth';
import { useNotifications }           from '../context/NotificationContext';

// ─── Brand Colors ─────────────────────────────
const PRIMARY   = '#FF6B35';
const DARK      = '#2C3E50';
const MUTED     = '#7F8C8D';
const BG        = '#F8F9FA';

// ─────────────────────────────────────────────
// PLACEHOLDER FACTORY
// ─────────────────────────────────────────────
function makePlaceholder(name) {
  return function PlaceholderScreen() {
    const insets = useSafeAreaInsets();
    return (
      <View style={{
        flex:            1,
        justifyContent:  'center',
        alignItems:      'center',
        backgroundColor: BG,
        paddingTop:      insets.top,
        paddingBottom:   insets.bottom,
        padding:         20,
        gap:             12,
      }}>
        <Text style={{ fontSize: 50 }}>🚧</Text>
        <Text style={{
          fontSize:   20,
          fontWeight: 'bold',
          color:      DARK,
          textAlign:  'center',
        }}>
          {name}
        </Text>
        <Text style={{ fontSize: 13, color: MUTED }}>
          Coming Soon
        </Text>
      </View>
    );
  };
}

// ─────────────────────────────────────────────
// SAFE IMPORTS
// ─────────────────────────────────────────────

// ── Auth ──────────────────────────────────────
let LoginScreen, RegisterScreen;
try { LoginScreen    = require('../screens/auth/LoginScreen').default;    }
catch { LoginScreen    = makePlaceholder('Login');    }
try { RegisterScreen = require('../screens/auth/RegisterScreen').default; }
catch { RegisterScreen = makePlaceholder('Register'); }

// ── User ──────────────────────────────────────
let HomeScreen, ExploreScreen, RestaurantDetailScreen,
    FavoritesScreen, ProfileScreen, EditProfileScreen,
    FavoriteDishesScreen, NotificationsScreen;

try { HomeScreen             = require('../screens/user/HomeScreen').default;             }
catch { HomeScreen             = makePlaceholder('Home');              }
try { ExploreScreen          = require('../screens/user/ExploreScreen').default;          }
catch { ExploreScreen          = makePlaceholder('Explore');           }
try { RestaurantDetailScreen = require('../screens/user/RestaurantDetailScreen').default; }
catch { RestaurantDetailScreen = makePlaceholder('Restaurant Detail'); }
try { FavoritesScreen        = require('../screens/user/FavoritesScreen').default;        }
catch { FavoritesScreen        = makePlaceholder('Favorites');         }
try { ProfileScreen          = require('../screens/user/ProfileScreen').default;          }
catch { ProfileScreen          = makePlaceholder('Profile');           }
try { EditProfileScreen      = require('../screens/user/EditProfileScreen').default;      }
catch { EditProfileScreen      = makePlaceholder('Edit Profile');      }
try { FavoriteDishesScreen   = require('../screens/user/FavoriteDishesScreen').default;   }
catch { FavoriteDishesScreen   = makePlaceholder('Favourite Dishes');  }
try { NotificationsScreen    = require('../screens/user/NotificationsScreen').default;    }
catch { NotificationsScreen    = makePlaceholder('Notifications');     }

// ── Owner ─────────────────────────────────────
let OwnerDashboardScreen, ManageMenuScreen, AddMenuItemScreen,
    DailyMenuScreen, RestaurantSetupScreen,
    SubscriptionScreen, AnalyticsScreen, MenuScannerScreen;

try { OwnerDashboardScreen  = require('../screens/owner/OwnerDashboardScreen').default;  }
catch { OwnerDashboardScreen  = makePlaceholder('Dashboard');      }
try { ManageMenuScreen      = require('../screens/owner/ManageMenuScreen').default;      }
catch { ManageMenuScreen      = makePlaceholder('Manage Menu');    }
try { AddMenuItemScreen     = require('../screens/owner/AddMenuItemScreen').default;     }
catch { AddMenuItemScreen     = makePlaceholder('Add Item');       }
try { DailyMenuScreen       = require('../screens/owner/DailyMenuScreen').default;       }
catch { DailyMenuScreen       = makePlaceholder('Daily Menu');     }
try { RestaurantSetupScreen = require('../screens/owner/RestaurantSetupScreen').default; }
catch { RestaurantSetupScreen = makePlaceholder('Setup');          }
try { SubscriptionScreen    = require('../screens/owner/SubscriptionScreen').default;    }
catch { SubscriptionScreen    = makePlaceholder('Subscription');   }
try { AnalyticsScreen       = require('../screens/owner/AnalyticsScreen').default;       }
catch { AnalyticsScreen       = makePlaceholder('Analytics');      }
// ✅ Menu Scanner
try { MenuScannerScreen     = require('../screens/owner/MenuScannerScreen').default;     }
catch { MenuScannerScreen     = makePlaceholder('Menu Scanner');   }

// ── Admin ─────────────────────────────────────
let AdminDashboardScreen, ImageDownloadScreen;

try { AdminDashboardScreen = require('../screens/admin/AdminDashboardScreen').default; }
catch { AdminDashboardScreen = makePlaceholder('Admin Dashboard'); }
try { ImageDownloadScreen  = require('../screens/admin/ImageDownloadScreen').default;  }
catch { ImageDownloadScreen  = makePlaceholder('Image Manager');   }

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─────────────────────────────────────────────
// LOADING SCREEN
// ✅ Has timeout to prevent hanging forever
// ─────────────────────────────────────────────
function LoadingScreen({ onTimeout }) {
  const insets = useSafeAreaInsets();

  // ✅ Show "taking too long?" after 8 seconds
  const [showTimeout, setShowTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShowTimeout(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={{
      flex:            1,
      justifyContent:  'center',
      alignItems:      'center',
      backgroundColor: BG,
      paddingTop:      insets.top,
      paddingBottom:   insets.bottom,
      gap:             16,
    }}>
      <Text style={{ fontSize: 60 }}>🍳</Text>
      <ActivityIndicator size="large" color={PRIMARY} />
      <Text style={{ fontSize: 16, color: MUTED }}>
        Loading What's Cooking...
      </Text>
      {showTimeout && (
        <View style={{ alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Text style={{ fontSize: 13, color: MUTED, textAlign: 'center' }}>
            Taking longer than expected...
          </Text>
          <TouchableOpacity
            onPress={onTimeout}
            style={{
              backgroundColor:   PRIMARY,
              paddingHorizontal: 24,
              paddingVertical:   10,
              borderRadius:      8,
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>
              Continue as Guest
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// WELCOME SCREEN
// ─────────────────────────────────────────────
function WelcomeScreen({ onGuest, onLogin, onRegister }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: PRIMARY }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow:          1,
          justifyContent:    'center',
          alignItems:        'center',
          paddingHorizontal: 32,
          paddingTop:        insets.top + 32,
          paddingBottom:     insets.bottom + 32,
          gap:               12,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <Text style={{ fontSize: 80 }}>🍳</Text>

        <Text style={{
          fontSize:   32,
          fontWeight: 'bold',
          color:      '#FFFFFF',
          textAlign:  'center',
        }}>
          What's Cooking
        </Text>

        <Text style={{
          fontSize:     16,
          color:        'rgba(255,255,255,0.85)',
          textAlign:    'center',
          lineHeight:   24,
          marginBottom: 16,
        }}>
          Discover daily menus from restaurants near you
        </Text>

        {/* Features preview */}
        <View style={{
          backgroundColor:   'rgba(255,255,255,0.15)',
          borderRadius:      16,
          padding:           20,
          width:             '100%',
          gap:               10,
          marginBottom:      8,
        }}>
          {[
            { icon: '🍽️', text: 'Browse daily menus from local restaurants' },
            { icon: '📍', text: 'Find restaurants near you'                 },
            { icon: '⭐', text: 'Save favorites and write reviews'           },
            { icon: '🔔', text: 'Get notified about daily specials'          },
          ].map((item, i) => (
            <View
              key={i}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
            >
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <Text style={{
                color:    'rgba(255,255,255,0.9)',
                fontSize: 14,
                flex:     1,
              }}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        {/* Sign In */}
        <TouchableOpacity
          style={{
            backgroundColor: '#FFFFFF',
            paddingVertical: 15,
            borderRadius:    12,
            width:           '100%',
            alignItems:      'center',
          }}
          onPress={onLogin}
          activeOpacity={0.8}
        >
          <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: 'bold' }}>
            Sign In
          </Text>
        </TouchableOpacity>

        {/* Create Account */}
        <TouchableOpacity
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingVertical: 15,
            borderRadius:    12,
            width:           '100%',
            alignItems:      'center',
            borderWidth:     2,
            borderColor:     'rgba(255,255,255,0.5)',
          }}
          onPress={onRegister}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
            Create Account
          </Text>
        </TouchableOpacity>

        {/* Guest */}
        <TouchableOpacity
          style={{ paddingVertical: 12 }}
          onPress={onGuest}
          activeOpacity={0.7}
        >
          <Text style={{
            color:              'rgba(255,255,255,0.8)',
            fontSize:           15,
            fontWeight:         '600',
            textDecorationLine: 'underline',
          }}>
            Browse as Guest
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// GUEST FAVORITES SCREEN
// ─────────────────────────────────────────────
function GuestFavoritesScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flex:            1,
      backgroundColor: BG,
      justifyContent:  'center',
      alignItems:      'center',
      padding:         32,
      paddingBottom:   insets.bottom + 32,
      gap:             12,
    }}>
      <Text style={{ fontSize: 70 }}>❤️</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: DARK }}>
        Save Your Favorites
      </Text>
      <Text style={{
        fontSize:   14,
        color:      MUTED,
        textAlign:  'center',
        lineHeight: 22,
      }}>
        Sign in to save restaurants and track your favorite meals
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor:   PRIMARY,
          paddingHorizontal: 32,
          paddingVertical:   12,
          borderRadius:      12,
          flexDirection:     'row',
          alignItems:        'center',
          gap:               8,
          marginTop:         8,
        }}
        onPress={onLogin}
        activeOpacity={0.8}
      >
        <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
          Sign In
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─────────────────────────────────────────────
// GUEST PROFILE SCREEN
// ─────────────────────────────────────────────
function GuestProfileScreen({ onLogin, onRegister }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{
        flexGrow:       1,
        justifyContent: 'center',
        alignItems:     'center',
        padding:        32,
        paddingBottom:  insets.bottom + 32,
        gap:            12,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 70 }}>👤</Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: DARK }}>
        Guest Mode
      </Text>
      <Text style={{
        fontSize:   14,
        color:      MUTED,
        textAlign:  'center',
        lineHeight: 22,
        marginBottom: 8,
      }}>
        Sign in to save favorites, leave reviews and access all features
      </Text>

      {/* Benefits list */}
      {[
        '⭐ Save favorite restaurants',
        '🍽️ Track favorite dishes',
        '✍️ Write reviews',
        '🔔 Get push notifications',
      ].map((benefit, i) => (
        <View
          key={i}
          style={{
            flexDirection:     'row',
            alignItems:        'center',
            backgroundColor:   '#FFFFFF',
            padding:           12,
            borderRadius:      10,
            width:             '100%',
            gap:               12,
          }}
        >
          <Text style={{ fontSize: 20 }}>{benefit.split(' ')[0]}</Text>
          <Text style={{ color: DARK, fontSize: 14, flex: 1 }}>
            {benefit.split(' ').slice(1).join(' ')}
          </Text>
        </View>
      ))}

      {/* Sign In */}
      <TouchableOpacity
        style={{
          backgroundColor: PRIMARY,
          paddingVertical: 14,
          borderRadius:    12,
          width:           '100%',
          alignItems:      'center',
          marginTop:       8,
        }}
        onPress={onLogin}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
          Sign In
        </Text>
      </TouchableOpacity>

      {/* Create Account */}
      <TouchableOpacity
        style={{
          backgroundColor: '#FFFFFF',
          paddingVertical: 14,
          borderRadius:    12,
          width:           '100%',
          alignItems:      'center',
          borderWidth:     2,
          borderColor:     PRIMARY,
        }}
        onPress={onRegister}
        activeOpacity={0.8}
      >
        <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: 'bold' }}>
          Create Account
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// TAB ICON HELPER
// ─────────────────────────────────────────────
function getTabIcon(routeName, focused) {
  const icons = {
    Home:      focused ? 'home'            : 'home-outline',
    Explore:   focused ? 'compass'         : 'compass-outline',
    Favorites: focused ? 'heart'           : 'heart-outline',
    Profile:   focused ? 'person'          : 'person-outline',
    Dashboard: focused ? 'grid'            : 'grid-outline',
    Menu:      focused ? 'restaurant'      : 'restaurant-outline',
    Daily:     focused ? 'today'           : 'today-outline',
  };
  return icons[routeName] || 'ellipse-outline';
}

// ─────────────────────────────────────────────
// TAB SCREEN OPTIONS
// ─────────────────────────────────────────────
const tabBarScreenOptions = ({ route }) => ({
  headerShown:             false,
  tabBarActiveTintColor:   PRIMARY,
  tabBarInactiveTintColor: '#95A5A6',
  tabBarHideOnKeyboard:    true,
  tabBarStyle: {
    backgroundColor: '#FFFFFF',
    borderTopColor:  '#E0E0E0',
    borderTopWidth:  1,
    paddingTop:      6,
  },
  tabBarIcon: ({ color, size, focused }) => (
    <Ionicons
      name={getTabIcon(route.name, focused)}
      size={size}
      color={color}
    />
  ),
});

// ─────────────────────────────────────────────
// NOTIFICATION BADGE ICON
// ─────────────────────────────────────────────
function ProfileTabIcon({ color, size, focused }) {
  let unreadCount = 0;
  try {
    const ctx = useNotifications();
    unreadCount = ctx?.unreadCount || 0;
  } catch {}

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons
        name={focused ? 'person' : 'person-outline'}
        size={size}
        color={color}
      />
      {unreadCount > 0 && (
        <View style={{
          position:          'absolute',
          top:               -2,
          right:             -6,
          backgroundColor:   '#FF3B30',
          borderRadius:      8,
          minWidth:          16,
          height:            16,
          justifyContent:    'center',
          alignItems:        'center',
          paddingHorizontal: 3,
        }}>
          <Text style={{
            color:      '#FFFFFF',
            fontSize:   9,
            fontWeight: 'bold',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────
// HEADER STYLES
// ─────────────────────────────────────────────
const headerStyle = {
  headerStyle:      { backgroundColor: PRIMARY },
  headerTintColor:  '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' },
};

const adminHeaderStyle = {
  headerShown:      true,
  headerStyle:      { backgroundColor: DARK },
  headerTintColor:  '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' },
};

// ─────────────────────────────────────────────
// AUTH STACK
// ─────────────────────────────────────────────
function AuthStack({ initialRoute = 'Login' }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Login"    component={LoginScreen}    />
      <Stack.Screen name="Register" component={RegisterScreen} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// GUEST TABS
// ─────────────────────────────────────────────
function GuestTabs({ onLogin, onRegister }) {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen name="Home"    component={HomeScreen}    />
      <Tab.Screen name="Explore" component={ExploreScreen} />
      <Tab.Screen name="Favorites">
        {() => <GuestFavoritesScreen onLogin={onLogin} />}
      </Tab.Screen>
      <Tab.Screen name="Profile">
        {() => (
          <GuestProfileScreen
            onLogin={onLogin}
            onRegister={onRegister}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────
// USER TABS
// ─────────────────────────────────────────────
function UserTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen name="Home"      component={HomeScreen}      />
      <Tab.Screen name="Explore"   component={ExploreScreen}   />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: (props) => <ProfileTabIcon {...props} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────
// OWNER TABS
// ─────────────────────────────────────────────
function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen
        name="Dashboard"
        component={OwnerDashboardScreen}
        options={{ tabBarLabel: 'Dashboard' }}
      />
      <Tab.Screen
        name="Menu"
        component={ManageMenuScreen}
        options={{ tabBarLabel: 'My Menu' }}
      />
      <Tab.Screen
        name="Daily"
        component={DailyMenuScreen}
        options={{ tabBarLabel: "Today's" }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon:  (props) => <ProfileTabIcon {...props} />,
        }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────
// USER NAVIGATOR
// ─────────────────────────────────────────────
function UserNavigator() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="UserTabs"
        component={UserTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || 'Restaurant',
        })}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="FavoriteDishes"
        component={FavoriteDishesScreen}
        options={{ title: 'Favourite Dishes' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <Stack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: 'My Favorites' }}
      />
      {/* ✅ Users can also view subscription info */}
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: 'Subscription Plans' }}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// OWNER NAVIGATOR
// ✅ Added MenuScanner route
// ─────────────────────────────────────────────
function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      {/* Main tabs */}
      <Stack.Screen
        name="OwnerTabs"
        component={OwnerTabs}
        options={{ headerShown: false }}
      />

      {/* Restaurant setup */}
      <Stack.Screen
        name="RestaurantSetup"
        component={RestaurantSetupScreen}
        options={({ route }) => ({
          title: route.params?.restaurant
            ? 'Edit Restaurant'
            : 'Setup Restaurant',
        })}
      />

      {/* Add / Edit menu item */}
      <Stack.Screen
        name="AddMenuItem"
        component={AddMenuItemScreen}
        options={({ route }) => ({
          title: route.params?.item ? 'Edit Item' : 'Add Menu Item',
        })}
      />

      {/* ✅ Menu Scanner */}
      <Stack.Screen
        name="MenuScanner"
        component={MenuScannerScreen}
        options={{
          title:       '📷 Scan Menu',
          headerShown: false, // Scanner has its own header
        }}
      />

      {/* View as customer */}
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || 'Restaurant',
        })}
      />

      {/* Subscription */}
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: 'Subscription Plans' }}
      />

      {/* Analytics */}
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />

      {/* Edit profile */}
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />

      {/* Notifications */}
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />

      {/* Owner Dashboard (from ProfileScreen) */}
      <Stack.Screen
        name="OwnerDashboard"
        component={OwnerDashboardScreen}
        options={{ title: 'My Dashboard' }}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// ADMIN NAVIGATOR
// ─────────────────────────────────────────────
function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
      />
      <Stack.Screen
        name="ImageDownload"
        component={ImageDownloadScreen}
        options={{
          ...adminHeaderStyle,
          title: '🖼️ Image Manager',
        }}
      />
      {/* ✅ Admin can also view restaurant details */}
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          ...adminHeaderStyle,
          title: route.params?.name || 'Restaurant',
        })}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// GUEST NAVIGATOR
// ✅ Added more routes guests can access
// ─────────────────────────────────────────────
function GuestNavigator({ onLogin, onRegister }) {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="GuestTabs"
        options={{ headerShown: false }}
      >
        {() => (
          <GuestTabs
            onLogin={onLogin}
            onRegister={onRegister}
          />
        )}
      </Stack.Screen>

      {/* Guests can view restaurant details */}
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || 'Restaurant',
        })}
      />

      {/* Auth screens accessible from guest */}
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ title: 'Sign In' }}
      />
      <Stack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Create Account' }}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// ROOT APP NAVIGATOR
// ─────────────────────────────────────────────
export default function AppNavigator() {
  const { user, userProfile, loading } = useAuth();
  const [isGuest, setIsGuest]          = useState(false);
  const [authScreen, setAuthScreen]    = useState(null);

  // ✅ Reset guest/auth state when user logs in
  useEffect(() => {
    if (user) {
      setIsGuest(false);
      setAuthScreen(null);
    }
  }, [user]);

  // ✅ Loading timeout handler
  const handleLoadingTimeout = useCallback(() => {
    setIsGuest(true);
  }, []);

  // ── Loading ─────────────────────────────────
  if (loading) {
    return <LoadingScreen onTimeout={handleLoadingTimeout} />;
  }

  return (
    <NavigationContainer>
      {(() => {
        // ── Logged in ──────────────────────────
        if (user) {
          // Wait for profile to load
          if (!userProfile) {
            return <LoadingScreen onTimeout={handleLoadingTimeout} />;
          }

          // Route by role
          if (userProfile.role === 'admin')            return <AdminNavigator />;
          if (userProfile.role === 'restaurant_owner') return <OwnerNavigator />;
          return <UserNavigator />;
        }

        // ── Auth screens ───────────────────────
        if (authScreen) {
          return (
            <AuthStack
              initialRoute={authScreen === 'login' ? 'Login' : 'Register'}
            />
          );
        }

        // ── Guest mode ─────────────────────────
        if (isGuest) {
          return (
            <GuestNavigator
              onLogin={() => {
                setIsGuest(false);
                setAuthScreen('login');
              }}
              onRegister={() => {
                setIsGuest(false);
                setAuthScreen('register');
              }}
            />
          );
        }

        // ── Welcome screen ─────────────────────
        return (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Welcome">
              {() => (
                <WelcomeScreen
                  onGuest={()    => setIsGuest(true)}
                  onLogin={()    => setAuthScreen('login')}
                  onRegister={() => setAuthScreen('register')}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        );
      })()}
    </NavigationContainer>
  );
}