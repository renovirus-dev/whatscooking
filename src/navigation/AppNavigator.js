// ============================================
// FILE: src/navigation/AppNavigator.js
// ============================================
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  StatusBar,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';

// =============================================
// SAFE IMPORTS - every screen wrapped in try/catch
// =============================================
function makePlaceholder(name) {
  return function PlaceholderScreen() {
    const insets = useSafeAreaInsets();
    return (
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F9FA',
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        padding: 20,
      }}>
        <Text style={{ fontSize: 50 }}>🚧</Text>
        <Text style={{
          fontSize: 20,
          fontWeight: 'bold',
          color: '#2C3E50',
          marginTop: 16,
          textAlign: 'center',
        }}>
          {name}
        </Text>
        <Text style={{ fontSize: 13, color: '#7F8C8D', marginTop: 8 }}>
          Coming Soon
        </Text>
      </View>
    );
  };
}

// =============================================
// AUTH SCREENS
// =============================================
let LoginScreen, RegisterScreen;
try { LoginScreen    = require('../screens/auth/LoginScreen').default;    }
catch(e) { LoginScreen    = makePlaceholder('Login');    }
try { RegisterScreen = require('../screens/auth/RegisterScreen').default; }
catch(e) { RegisterScreen = makePlaceholder('Register'); }

// =============================================
// USER SCREENS
// =============================================
let HomeScreen, ExploreScreen, RestaurantDetailScreen,
    FavoritesScreen, ProfileScreen, EditProfileScreen,
    FavoriteDishesScreen;

try { HomeScreen             = require('../screens/user/HomeScreen').default;             }
catch(e) { HomeScreen             = makePlaceholder('Home');              }
try { ExploreScreen          = require('../screens/user/ExploreScreen').default;          }
catch(e) { ExploreScreen          = makePlaceholder('Explore');           }
try { RestaurantDetailScreen = require('../screens/user/RestaurantDetailScreen').default; }
catch(e) { RestaurantDetailScreen = makePlaceholder('Restaurant Detail'); }
try { FavoritesScreen        = require('../screens/user/FavoritesScreen').default;        }
catch(e) { FavoritesScreen        = makePlaceholder('Favorites');         }
try { ProfileScreen          = require('../screens/user/ProfileScreen').default;          }
catch(e) { ProfileScreen          = makePlaceholder('Profile');           }
try { EditProfileScreen      = require('../screens/user/EditProfileScreen').default;      }
catch(e) { EditProfileScreen      = makePlaceholder('Edit Profile');      }
try { FavoriteDishesScreen   = require('../screens/user/FavoriteDishesScreen').default;   }
catch(e) { FavoriteDishesScreen   = makePlaceholder('Favourite Dishes');  }

// =============================================
// OWNER SCREENS
// =============================================
let OwnerDashboardScreen, ManageMenuScreen, AddMenuItemScreen,
    DailyMenuScreen, RestaurantSetupScreen,
    SubscriptionScreen, AnalyticsScreen;

try { OwnerDashboardScreen  = require('../screens/owner/OwnerDashboardScreen').default;  }
catch(e) { OwnerDashboardScreen  = makePlaceholder('Dashboard');          }
try { ManageMenuScreen      = require('../screens/owner/ManageMenuScreen').default;      }
catch(e) { ManageMenuScreen      = makePlaceholder('Menu');               }
try { AddMenuItemScreen     = require('../screens/owner/AddMenuItemScreen').default;     }
catch(e) { AddMenuItemScreen     = makePlaceholder('Add Item');           }
try { DailyMenuScreen       = require('../screens/owner/DailyMenuScreen').default;       }
catch(e) { DailyMenuScreen       = makePlaceholder('Daily Menu');         }
try { RestaurantSetupScreen = require('../screens/owner/RestaurantSetupScreen').default; }
catch(e) { RestaurantSetupScreen = makePlaceholder('Setup');              }
try { SubscriptionScreen    = require('../screens/owner/SubscriptionScreen').default;    }
catch(e) { SubscriptionScreen    = makePlaceholder('Subscription');       }
try { AnalyticsScreen       = require('../screens/owner/AnalyticsScreen').default;       }
catch(e) { AnalyticsScreen       = makePlaceholder('Analytics');          }

// =============================================
// ADMIN SCREENS
// =============================================
let AdminDashboardScreen, ManageRestaurantsScreen;
try { AdminDashboardScreen    = require('../screens/admin/AdminDashboardScreen').default;    }
catch(e) { AdminDashboardScreen    = makePlaceholder('Admin');   }
try { ManageRestaurantsScreen = require('../screens/admin/ManageRestaurantsScreen').default; }
catch(e) { ManageRestaurantsScreen = makePlaceholder('Manage');  }

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

// =============================================
// LOADING SCREEN
// =============================================
function LoadingScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#F8F9FA',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
    }}>
      <Text style={{ fontSize: 60, marginBottom: 20 }}>🍳</Text>
      <ActivityIndicator size="large" color="#FF6B35" />
      <Text style={{ fontSize: 16, color: '#7F8C8D', marginTop: 16 }}>
        Loading What's Cooking...
      </Text>
    </View>
  );
}

// =============================================
// WELCOME SCREEN
// =============================================
function WelcomeScreen({ onGuest, onLogin, onRegister }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#FF6B35' }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          alignItems: 'center',
          paddingHorizontal: 32,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 32,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={{ fontSize: 80, marginBottom: 16 }}>🍳</Text>
        <Text style={{
          fontSize: 32, fontWeight: 'bold',
          color: '#FFFFFF', textAlign: 'center', marginBottom: 8,
        }}>
          What's Cooking
        </Text>
        <Text style={{
          fontSize: 16, color: 'rgba(255,255,255,0.85)',
          textAlign: 'center', marginBottom: 40, lineHeight: 24,
        }}>
          Discover daily menus from restaurants near you
        </Text>

        <TouchableOpacity
          style={{
            backgroundColor: '#FFFFFF', paddingVertical: 14,
            borderRadius: 12, width: '100%',
            alignItems: 'center', marginBottom: 12,
          }}
          onPress={onLogin}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FF6B35', fontSize: 18, fontWeight: 'bold' }}>
            Sign In
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            paddingVertical: 14, borderRadius: 12,
            width: '100%', alignItems: 'center',
            borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)',
            marginBottom: 12,
          }}
          onPress={onRegister}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
            Create Account
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ paddingVertical: 14, marginTop: 8 }}
          onPress={onGuest}
          activeOpacity={0.7}
        >
          <Text style={{
            color: 'rgba(255,255,255,0.8)', fontSize: 16,
            fontWeight: '600', textDecorationLine: 'underline',
          }}>
            Browse as Guest
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// =============================================
// GUEST FAVORITES SCREEN
// =============================================
function GuestFavoritesScreen({ onLogin }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{
      flex: 1, backgroundColor: '#F8F9FA',
      paddingBottom: insets.bottom,
    }}>
      <View style={{
        flex: 1, justifyContent: 'center',
        alignItems: 'center', padding: 32,
      }}>
        <Text style={{ fontSize: 70, marginBottom: 16 }}>❤️</Text>
        <Text style={{
          fontSize: 22, fontWeight: 'bold',
          color: '#2C3E50', marginBottom: 8,
        }}>
          Save Your Favorites
        </Text>
        <Text style={{
          fontSize: 14, color: '#7F8C8D',
          textAlign: 'center', marginBottom: 24,
        }}>
          Sign in to save restaurants and track your favorite meals
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: '#FF6B35',
            paddingHorizontal: 32, paddingVertical: 12,
            borderRadius: 12,
          }}
          onPress={onLogin}
          activeOpacity={0.8}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
            Sign In
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// =============================================
// GUEST PROFILE SCREEN
// =============================================
function GuestProfileScreen({ onLogin, onRegister }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F8F9FA' }}
      contentContainerStyle={{
        flexGrow: 1, justifyContent: 'center',
        alignItems: 'center', padding: 32,
        paddingBottom: insets.bottom + 32,
      }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={{ fontSize: 70, marginBottom: 16 }}>👤</Text>
      <Text style={{
        fontSize: 24, fontWeight: 'bold',
        color: '#2C3E50', marginBottom: 8,
      }}>
        Guest Mode
      </Text>
      <Text style={{
        fontSize: 14, color: '#7F8C8D',
        textAlign: 'center', marginBottom: 32, lineHeight: 22,
      }}>
        Sign in to save favorites, leave reviews and access all features
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: '#FF6B35',
          paddingHorizontal: 48, paddingVertical: 14,
          borderRadius: 12, width: '100%',
          alignItems: 'center', marginBottom: 12,
        }}
        onPress={onLogin}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>
          Sign In
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 48, paddingVertical: 14,
          borderRadius: 12, width: '100%', alignItems: 'center',
          borderWidth: 2, borderColor: '#FF6B35',
        }}
        onPress={onRegister}
        activeOpacity={0.8}
      >
        <Text style={{ color: '#FF6B35', fontSize: 18, fontWeight: 'bold' }}>
          Create Account
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// =============================================
// TAB ICON HELPER
// =============================================
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

// =============================================
// TAB BAR SCREEN OPTIONS
// =============================================
const tabBarScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarActiveTintColor:   '#FF6B35',
  tabBarInactiveTintColor: '#95A5A6',
  tabBarHideOnKeyboard: true,
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

// =============================================
// GUEST TABS
// =============================================
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

// =============================================
// USER TABS
// =============================================
function UserTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen name="Home"      component={HomeScreen}      />
      <Tab.Screen name="Explore"   component={ExploreScreen}   />
      <Tab.Screen name="Favorites" component={FavoritesScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen}   />
    </Tab.Navigator>
  );
}

// =============================================
// OWNER TABS
// =============================================
function OwnerTabs() {
  return (
    <Tab.Navigator screenOptions={tabBarScreenOptions}>
      <Tab.Screen name="Dashboard" component={OwnerDashboardScreen} />
      <Tab.Screen name="Menu"      component={ManageMenuScreen}     />
      <Tab.Screen
        name="Daily"
        component={DailyMenuScreen}
        options={{ tabBarLabel: "Today's Menu" }}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// =============================================
// HEADER STYLES
// =============================================
const headerStyle = {
  headerStyle:      { backgroundColor: '#FF6B35' },
  headerTintColor:  '#FFFFFF',
  headerTitleStyle: { fontWeight: 'bold' },
};

// =============================================
// AUTH STACK
// =============================================
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

// =============================================
// USER NAVIGATOR
// =============================================
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
    </Stack.Navigator>
  );
}

// =============================================
// OWNER NAVIGATOR
// =============================================
function OwnerNavigator() {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen
        name="OwnerTabs"
        component={OwnerTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="RestaurantSetup"
        component={RestaurantSetupScreen}
        options={{ title: 'Setup Restaurant' }}
      />
      <Stack.Screen
        name="AddMenuItem"
        component={AddMenuItemScreen}
        options={({ route }) => ({
          title: route.params?.item ? 'Edit Item' : 'Add Menu Item',
        })}
      />
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || 'Restaurant',
        })}
      />
      <Stack.Screen
        name="Subscription"
        component={SubscriptionScreen}
        options={{ title: 'Subscription Plans' }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ title: 'Analytics' }}
      />
	  <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}

// =============================================
// ADMIN NAVIGATOR
// ✅ KEY FIX: headerShown false on ALL admin screens
// because AdminDashboardScreen has its own custom header
// with the sign out button built in
// =============================================
function AdminNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        // ✅ Hide the default stack header for ALL admin screens
        // AdminDashboardScreen has its own custom header
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="AdminDashboard"
        component={AdminDashboardScreen}
        // ✅ No header — custom header is inside AdminDashboardScreen
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ManageRestaurants"
        component={ManageRestaurantsScreen}
        // ✅ This screen gets its own header with back button
        options={{
          headerShown: true,
          title: 'Manage Restaurants',
          headerStyle:      { backgroundColor: '#2C3E50' },
          headerTintColor:  '#FFFFFF',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack.Navigator>
  );
}

// =============================================
// GUEST NAVIGATOR
// =============================================
function GuestNavigator({ onLogin, onRegister }) {
  return (
    <Stack.Navigator screenOptions={headerStyle}>
      <Stack.Screen name="GuestTabs" options={{ headerShown: false }}>
        {() => (
          <GuestTabs
            onLogin={onLogin}
            onRegister={onRegister}
          />
        )}
      </Stack.Screen>
      <Stack.Screen
        name="RestaurantDetail"
        component={RestaurantDetailScreen}
        options={({ route }) => ({
          title: route.params?.name || 'Restaurant',
        })}
      />
    </Stack.Navigator>
  );
}

// =============================================
// ROOT APP NAVIGATOR
// =============================================
export default function AppNavigator() {
  const { user, userProfile, loading } = useAuth();
  const [isGuest, setIsGuest]          = useState(false);
  const [authScreen, setAuthScreen]    = useState(null);

  useEffect(() => {
    if (user) {
      setIsGuest(false);
      setAuthScreen(null);
    }
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {(() => {
        // Logged in user
        if (user) {
          if (!userProfile) return <LoadingScreen />;
          if (userProfile.role === 'admin')
            return <AdminNavigator />;
          if (userProfile.role === 'restaurant_owner')
            return <OwnerNavigator />;
          return <UserNavigator />;
        }

        // Auth screens
        if (authScreen) {
          return (
            <AuthStack
              initialRoute={authScreen === 'login' ? 'Login' : 'Register'}
            />
          );
        }

        // Guest mode
        if (isGuest) {
          return (
            <GuestNavigator
              onLogin={()    => { setIsGuest(false); setAuthScreen('login');    }}
              onRegister={() => { setIsGuest(false); setAuthScreen('register'); }}
            />
          );
        }

        // Welcome screen
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