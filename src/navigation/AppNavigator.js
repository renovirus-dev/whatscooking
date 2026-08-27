// ============================================
// FILE: src/navigation/AppNavigator.js
// ============================================
import React, {
  useState, useEffect, useCallback,
} from 'react';
import {
  View, Text, ActivityIndicator,
  TouchableOpacity, ScrollView, StatusBar,
  Platform, useWindowDimensions,
} from 'react-native';
import { NavigationContainer }        from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import { Ionicons }                   from '@expo/vector-icons';
import { useSafeAreaInsets }          from 'react-native-safe-area-context';
import AsyncStorage                   from '@react-native-async-storage/async-storage';
import { useAuth }                    from '../hooks/useAuth';
import { useNotifications }           from '../context/NotificationContext';
import { checkAppUpdate }             from '../utils/checkAppUpdate';

const PRIMARY = '#FF6B35';
const DARK    = '#2C3E50';
const MUTED   = '#7F8C8D';
const BG      = '#F8F9FA';

const ONBOARDING_KEY = '@whatscooking_onboarding_complete';

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
let LoginScreen, RegisterScreen, OnboardingScreen;
try { LoginScreen      = require('../screens/auth/LoginScreen').default;      }
catch (e) { LoginScreen      = makePlaceholder('Login');      }
try { RegisterScreen   = require('../screens/auth/RegisterScreen').default;   }
catch (e) { RegisterScreen   = makePlaceholder('Register');   }
try { OnboardingScreen = require('../screens/auth/OnboardingScreen').default; }
catch (e) { OnboardingScreen = makePlaceholder('Onboarding'); }

let HomeScreen, ExploreScreen, RestaurantDetailScreen,
    FavoritesScreen, ProfileScreen, EditProfileScreen,
    FavoriteDishesScreen, NotificationsScreen,
    PrivacyPolicyScreen;

try { HomeScreen             = require('../screens/user/HomeScreen').default;             }
catch (e) { HomeScreen             = makePlaceholder('Home');             }
try { ExploreScreen          = require('../screens/user/ExploreScreen').default;          }
catch (e) { ExploreScreen          = makePlaceholder('Explore');          }
try { RestaurantDetailScreen = require('../screens/user/RestaurantDetailScreen').default; }
catch (e) { RestaurantDetailScreen = makePlaceholder('Restaurant Detail'); }
try { FavoritesScreen        = require('../screens/user/FavoritesScreen').default;        }
catch (e) { FavoritesScreen        = makePlaceholder('Favorites');        }
try { ProfileScreen          = require('../screens/user/ProfileScreen').default;          }
catch (e) { ProfileScreen          = makePlaceholder('Profile');          }
try { EditProfileScreen      = require('../screens/user/EditProfileScreen').default;      }
catch (e) { EditProfileScreen      = makePlaceholder('Edit Profile');     }
try { FavoriteDishesScreen   = require('../screens/user/FavoriteDishesScreen').default;   }
catch (e) { FavoriteDishesScreen   = makePlaceholder('Favourite Dishes'); }
try { NotificationsScreen    = require('../screens/user/NotificationsScreen').default;    }
catch (e) { NotificationsScreen    = makePlaceholder('Notifications');    }
try { PrivacyPolicyScreen    = require('../screens/user/PrivacyPolicyScreen').default;    }
catch (e) { PrivacyPolicyScreen    = makePlaceholder('Privacy Policy');   }

let OwnerDashboardScreen, ManageMenuScreen, AddMenuItemScreen,
    DailyMenuScreen, RestaurantSetupScreen,
    SubscriptionScreen, AnalyticsScreen, MenuScannerScreen;

try { OwnerDashboardScreen  = require('../screens/owner/OwnerDashboardScreen').default;  }
catch (e) { OwnerDashboardScreen  = makePlaceholder('Dashboard');    }
try { ManageMenuScreen      = require('../screens/owner/ManageMenuScreen').default;      }
catch (e) { ManageMenuScreen      = makePlaceholder('Manage Menu');  }
try { AddMenuItemScreen     = require('../screens/owner/AddMenuItemScreen').default;     }
catch (e) { AddMenuItemScreen     = makePlaceholder('Add Item');     }
try { DailyMenuScreen       = require('../screens/owner/DailyMenuScreen').default;       }
catch (e) { DailyMenuScreen       = makePlaceholder('Daily Menu');   }
try { RestaurantSetupScreen = require('../screens/owner/RestaurantSetupScreen').default; }
catch (e) { RestaurantSetupScreen = makePlaceholder('Setup');        }
try { SubscriptionScreen    = require('../screens/owner/SubscriptionScreen').default;    }
catch (e) { SubscriptionScreen    = makePlaceholder('Subscription'); }
try { AnalyticsScreen       = require('../screens/owner/AnalyticsScreen').default;       }
catch (e) { AnalyticsScreen       = makePlaceholder('Analytics');   }
try { MenuScannerScreen     = require('../screens/owner/MenuScannerScreen').default;     }
catch (e) { MenuScannerScreen     = makePlaceholder('Menu Scanner'); }

let AdminDashboardScreen, ImageDownloadScreen;
try { AdminDashboardScreen = require('../screens/admin/AdminDashboardScreen').default; }
catch (e) { AdminDashboardScreen = makePlaceholder('Admin Dashboard'); }
try { ImageDownloadScreen  = require('../screens/admin/ImageDownloadScreen').default;  }
catch (e) { ImageDownloadScreen  = makePlaceholder('Image Manager');   }

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// ─────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────
function LoadingScreen({ onTimeout }) {
  const insets = useSafeAreaInsets();
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
function WelcomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: PRIMARY }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
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
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 80 }}>🍳</Text>
        <Text style={{ fontSize: 32, fontWeight: 'bold', color: '#FFFFFF', textAlign: 'center' }}>
          What's Cooking
        </Text>
        <Text style={{
          fontSize: 16, color: 'rgba(255,255,255,0.85)',
          textAlign: 'center', lineHeight: 24, marginBottom: 16,
        }}>
          Discover daily menus from restaurants near you
        </Text>

        <View style={{
          backgroundColor: 'rgba(255,255,255,0.15)',
          borderRadius: 16, padding: 20, width: '100%',
          gap: 10, marginBottom: 8,
        }}>
          {[
            { icon: '🍽️', text: 'Browse daily menus from local restaurants' },
            { icon: '📍', text: 'Find restaurants near you' },
            { icon: '⭐', text: 'Save favorites and write reviews' },
            { icon: '🔔', text: 'Get notified about daily specials' },
          ].map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 20 }}>{item.icon}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 14, flex: 1 }}>
                {item.text}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={{
            backgroundColor: '#FFFFFF', paddingVertical: 15,
            borderRadius: 12, width: '100%', alignItems: 'center',
          }}
          onPress={() => navigation.navigate('Login')}
          activeOpacity={0.8}
        >
          <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: 'bold' }}>
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingVertical: 15, borderRadius: 12, width: '100%',
            alignItems: 'center', borderWidth: 2,
            borderColor: 'rgba(255,255,255,0.5)',
          }}
          onPress={() => navigation.navigate('Register')}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
            Create Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ paddingVertical: 12 }}
          onPress={() => navigation.replace('GuestTabs')}
          activeOpacity={0.7}
        >
          <Text style={{
            color: 'rgba(255,255,255,0.8)', fontSize: 15,
            fontWeight: '600', textDecorationLine: 'underline',
          }}>
            Browse as Guest
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────
// GUEST FAVORITES / PROFILE SCREENS
// ─────────────────────────────────────────────
function GuestFavoritesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flex: 1, backgroundColor: BG, justifyContent: 'center',
      alignItems: 'center', padding: 32,
      paddingBottom: insets.bottom + 32, gap: 12,
    }}>
      <Text style={{ fontSize: 70 }}>❤️</Text>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: DARK }}>
        Save Your Favorites
      </Text>
      <Text style={{ fontSize: 14, color: MUTED, textAlign: 'center', lineHeight: 22 }}>
        Sign in to save restaurants and track your favorite meals
      </Text>
      <TouchableOpacity
        style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: PRIMARY, paddingHorizontal: 32,
          paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 8,
        }}
        onPress={() => navigation.navigate('Login')}
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

function GuestProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: BG }}
      contentContainerStyle={{
        flexGrow: 1, justifyContent: 'center', alignItems: 'center',
        padding: 32, paddingBottom: insets.bottom + 32, gap: 12,
      }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 70 }}>👤</Text>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: DARK }}>
        Guest Mode
      </Text>
      <Text style={{
        fontSize: 14, color: MUTED, textAlign: 'center',
        lineHeight: 22, marginBottom: 8,
      }}>
        Sign in to access all features
      </Text>

      {[
        '⭐ Save favorite restaurants',
        '🍽️ Track favorite dishes',
        '✍️ Write reviews',
        '🔔 Get push notifications',
      ].map((benefit, i) => (
        <View key={i} style={{
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#FFFFFF', padding: 12,
          borderRadius: 10, width: '100%', gap: 12,
        }}>
          <Text style={{ fontSize: 20 }}>{benefit.split(' ')[0]}</Text>
          <Text style={{ color: DARK, fontSize: 14, flex: 1 }}>
            {benefit.split(' ').slice(1).join(' ')}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        style={{
          backgroundColor: PRIMARY, paddingVertical: 14,
          borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 8,
        }}
        onPress={() => navigation.navigate('Login')}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
          Sign In
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          backgroundColor: '#FFFFFF', paddingVertical: 14,
          borderRadius: 12, width: '100%', alignItems: 'center',
          borderWidth: 2, borderColor: PRIMARY,
        }}
        onPress={() => navigation.navigate('Register')}
        activeOpacity={0.8}
      >
        <Text style={{ color: PRIMARY, fontSize: 18, fontWeight: 'bold' }}>
          Create Account
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{ marginTop: 16, paddingVertical: 8 }}
        onPress={() => navigation.replace('Welcome')}
        activeOpacity={0.7}
      >
        <Text style={{
          color: MUTED, fontSize: 14,
          textDecorationLine: 'underline',
        }}>
          Back to Welcome
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ─────────────────────────────────────────────
// TAB HELPERS
// ─────────────────────────────────────────────
function getTabIcon(routeName, focused) {
  const icons = {
    Home:      focused ? 'home'       : 'home-outline',
    Explore:   focused ? 'compass'    : 'compass-outline',
    Favorites: focused ? 'heart'      : 'heart-outline',
    Profile:   focused ? 'person'     : 'person-outline',
    Dashboard: focused ? 'grid'       : 'grid-outline',
    Menu:      focused ? 'restaurant' : 'restaurant-outline',
    Daily:     focused ? 'today'      : 'today-outline',
  };
  return icons[routeName] || 'ellipse-outline';
}

// ✅ DYNAMIC: Responsive configuration based on browser orientation
const getTabBarScreenOptions = (route, isLandscape) => {
  const isWeb = Platform.OS === 'web';
  
  let tabHeight = undefined;
  let tabPaddingBottom = undefined;

  if (isWeb) {
    if (isLandscape) {
      tabHeight = 52;         // Compact row-style layout for landscape
      tabPaddingBottom = 4;
    } else {
      tabHeight = 76;         // Tall layout to sit safely above phone gesture bar in portrait
      tabPaddingBottom = 20;
    }
  }

  return {
    headerShown:             false,
    tabBarActiveTintColor:   PRIMARY,
    tabBarInactiveTintColor: '#95A5A6',
    tabBarHideOnKeyboard:    true,
    // Beside-icon on landscape fits horizontally and looks extremely clean
    tabBarLabelPosition:     isWeb && isLandscape ? 'beside-icon' : 'below-icon',
    tabBarStyle: {
      backgroundColor: '#FFFFFF',
      borderTopColor:  '#E0E0E0',
      borderTopWidth:  1,
      paddingTop:      6,
      height:          tabHeight,
      paddingBottom:   tabPaddingBottom,
    },
    tabBarItemStyle: {
      justifyContent: 'center',
      alignItems:     'center',
      paddingVertical: 2,
    },
    tabBarLabelStyle: {
      fontSize:     11,
      fontWeight:   '600',
      marginTop:    isWeb && isLandscape ? 0 : 2,
      marginBottom: 0,
    },
    tabBarIcon: ({ color, size, focused }) => (
      <Ionicons
        name={getTabIcon(route.name, focused)}
        size={isWeb ? 20 : size}
        color={color}
      />
    ),
  };
};

function ProfileTabIcon({ color, size, focused }) {
  let unreadCount = 0;
  try {
    const ctx = useNotifications();
    unreadCount = ctx?.unreadCount || 0;
  } catch {}

  const isWeb = Platform.OS === 'web';

  return (
    <View style={{ position: 'relative' }}>
      <Ionicons
        name={focused ? 'person' : 'person-outline'}
        size={isWeb ? 20 : size}
        color={color}
      />
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute', top: -2, right: -6,
          backgroundColor: '#FF3B30', borderRadius: 8,
          minWidth: 16, height: 16, justifyContent: 'center',
          alignItems: 'center', paddingHorizontal: 3,
        }}>
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </Text>
        </View>
      )}
    </View>
  );
}

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
// GUEST TABS
// ─────────────────────────────────────────────
function GuestTabs() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Tab.Navigator screenOptions={({ route }) => getTabBarScreenOptions(route, isLandscape)}>
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Explore"   component={ExploreScreen} />
      <Tab.Screen name="Favorites" component={GuestFavoritesScreen} />
      <Tab.Screen name="Profile"   component={GuestProfileScreen} />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────
// USER TABS
// ─────────────────────────────────────────────
function UserTabs() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Tab.Navigator screenOptions={({ route }) => getTabBarScreenOptions(route, isLandscape)}>
      <Tab.Screen name="Home"      component={HomeScreen} />
      <Tab.Screen name="Explore"   component={ExploreScreen} />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: (props) => <ProfileTabIcon {...props} /> }}
      />
    </Tab.Navigator>
  );
}

// ─────────────────────────────────────────────
// OWNER TABS
// ─────────────────────────────────────────────
function OwnerTabs() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  return (
    <Tab.Navigator screenOptions={({ route }) => getTabBarScreenOptions(route, isLandscape)}>
      <Tab.Screen name="Dashboard" component={OwnerDashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Menu"      component={ManageMenuScreen}     options={{ tabBarLabel: 'My Menu' }} />
      <Tab.Screen name="Daily"     component={DailyMenuScreen}      options={{ tabBarLabel: "Today's" }} />
      <Tab.Screen name="Explore"   component={ExploreScreen}        options={{ tabBarLabel: 'Explore' }} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: (props) => <ProfileTabIcon {...props} />,
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
      <Stack.Screen name="UserTabs"         component={UserTabs}               options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={({ route }) => ({ title: route.params?.name || 'Restaurant' })} />
      <Stack.Screen name="EditProfile"      component={EditProfileScreen}      options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="FavoriteDishes"   component={FavoriteDishesScreen}   options={{ title: 'Favourite Dishes' }} />
      <Stack.Screen name="Notifications"    component={NotificationsScreen}    options={{ title: 'Notifications' }} />
      <Stack.Screen name="Favorites"        component={FavoritesScreen}        options={{ title: 'Saved Restaurants' }} />
      <Stack.Screen name="Subscription"     component={SubscriptionScreen}     options={{ title: 'Subscription Plans' }} />
      <Stack.Screen name="PrivacyPolicy"    component={PrivacyPolicyScreen}    options={{ title: 'Privacy Policy' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// OWNER NAVIGATOR
// ─────────────────────────────────────────────
function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="OwnerTabs"        component={OwnerTabs}              options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantSetup"  component={RestaurantSetupScreen}  options={({ route }) => ({ title: route.params?.restaurant ? 'Edit Restaurant' : 'Setup Restaurant' })} />
      <Stack.Screen name="AddMenuItem"      component={AddMenuItemScreen}      options={({ route }) => ({ title: route.params?.item ? 'Edit Item' : 'Add Menu Item' })} />
      <Stack.Screen name="MenuScanner"      component={MenuScannerScreen}      options={{ headerShown: false }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={({ route }) => ({ title: route.params?.name || 'Restaurant' })} />
      <Stack.Screen name="Subscription"     component={SubscriptionScreen}     options={{ title: 'Subscription Plans' }} />
      <Stack.Screen name="Analytics"        component={AnalyticsScreen}        options={{ title: 'Analytics' }} />
      <Stack.Screen name="EditProfile"      component={EditProfileScreen}      options={{ title: 'Edit Profile' }} />
      <Stack.Screen name="Notifications"    component={NotificationsScreen}    options={{ title: 'Notifications' }} />
      <Stack.Screen name="OwnerDashboard"   component={OwnerDashboardScreen}   options={{ title: 'My Dashboard' }} />
      <Stack.Screen name="Favorites"        component={FavoritesScreen}        options={{ title: 'Saved Restaurants' }} />
      <Stack.Screen name="FavoriteDishes"   component={FavoriteDishesScreen}   options={{ title: 'Favourite Dishes' }} />
      <Stack.Screen name="Home"             component={HomeScreen}             options={{ title: "What's Cooking" }} />
      <Stack.Screen name="PrivacyPolicy"    component={PrivacyPolicyScreen}    options={{ title: 'Privacy Policy' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// ADMIN NAVIGATOR
// ─────────────────────────────────────────────
function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard"   component={AdminDashboardScreen} />
      <Stack.Screen name="ImageDownload"    component={ImageDownloadScreen}    options={{ ...adminHeaderStyle, title: '🖼️ Image Manager' }} />
      <Stack.Screen name="RestaurantDetail" component={RestaurantDetailScreen} options={({ route }) => ({ ...adminHeaderStyle, title: route.params?.name || 'Restaurant' })} />
      <Stack.Screen name="PrivacyPolicy"    component={PrivacyPolicyScreen}    options={{ ...adminHeaderStyle, title: 'Privacy Policy' }} />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// PUBLIC NAVIGATOR
// ─────────────────────────────────────────────
function PublicNavigator({ initialRoute, markOnboardingDone }) {
  return (
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Onboarding">
        {(props) => (
          <OnboardingScreen
            {...props}
            navigation={{
              ...props.navigation,
              replace: (screen) => {
                markOnboardingDone();
                props.navigation.replace(screen);
              },
            }}
            onGuestPress={() => {
              markOnboardingDone();
              props.navigation.replace('GuestTabs');
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Welcome" component={WelcomeScreen} />

      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen
            {...props}
            onBack={() => {
              if (props.navigation.canGoBack()) {
                props.navigation.goBack();
              } else {
                props.navigation.replace('Welcome');
              }
            }}
            onGuest={() => {
              props.navigation.reset({
                index:  0,
                routes: [{ name: 'GuestTabs' }],
              });
            }}
            onSwitchToRegister={() => {
              props.navigation.replace('Register');
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Register">
        {(props) => (
          <RegisterScreen
            {...props}
            onBack={() => {
              if (props.navigation.canGoBack()) {
                props.navigation.goBack();
              } else {
                props.navigation.replace('Welcome');
              }
            }}
            onGuest={() => {
              props.navigation.reset({
                index:  0,
                routes: [{ name: 'GuestTabs' }],
              });
            }}
            onSwitchToLogin={() => {
              props.navigation.replace('Login');
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="GuestTabs" component={GuestTabs} />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={{ ...headerStyle, headerShown: true }}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// ROOT APP NAVIGATOR
// ─────────────────────────────────────────────
export default function AppNavigator() {
  const { user, userProfile, loading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(value => setOnboardingDone(value === 'true'))
      .catch(()    => setOnboardingDone(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkAppUpdate(true);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const markOnboardingDone = useCallback(() => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
    setOnboardingDone(true);
  }, []);

  if (onboardingDone === null || loading) {
    return <LoadingScreen onTimeout={markOnboardingDone} />;
  }

  return (
    <NavigationContainer>
      {(() => {
        if (user) {
          if (!userProfile) return <LoadingScreen onTimeout={markOnboardingDone} />;
          if (userProfile.role === 'admin')            return <AdminNavigator />;
          if (userProfile.role === 'restaurant_owner') return <OwnerNavigator />;
          return <UserNavigator />;
        }

        return (
          <PublicNavigator
            initialRoute={onboardingDone ? 'Welcome' : 'Onboarding'}
            markOnboardingDone={markOnboardingDone}
          />
        );
      })()}
    </NavigationContainer>
  );
}