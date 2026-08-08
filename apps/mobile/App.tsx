import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { initDatabase } from './src/offline/database';
import { setupAutoSync } from './src/offline/syncService';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import ProjectsScreen from './src/screens/ProjectsScreen';
import DailyReportScreen from './src/screens/DailyReportScreen';
import ExpensesScreen from './src/screens/ExpensesScreen';
import InventoryScreen from './src/screens/InventoryScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 1 },
  },
});

const COLORS = {
  primary: '#2563eb',
  inactive: '#94a3b8',
  bg: '#f8fafc',
  card: '#ffffff',
};

const TabNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color, size }) => {
        const icons: Record<string, string> = {
          Dashboard: focused ? 'home' : 'home-outline',
          Projects: focused ? 'folder' : 'folder-outline',
          Reports: focused ? 'clipboard' : 'clipboard-outline',
          Expenses: focused ? 'cash' : 'cash-outline',
          More: focused ? 'menu' : 'menu-outline',
        };
        return <Ionicons name={(icons[route.name] || 'ellipse') as any} size={size} color={color} />;
      },
      tabBarActiveTintColor: COLORS.primary,
      tabBarInactiveTintColor: COLORS.inactive,
      tabBarStyle: {
        backgroundColor: COLORS.card,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        paddingBottom: 5,
        paddingTop: 5,
        height: 60,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
      headerStyle: { backgroundColor: COLORS.card },
      headerTintColor: '#1e293b',
      headerTitleStyle: { fontWeight: '700' },
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Dashboard' }} />
    <Tab.Screen name="Projects" component={ProjectsScreen} options={{ title: 'Projects' }} />
    <Tab.Screen name="Reports" component={DailyReportScreen} options={{ title: 'Reports' }} />
    <Tab.Screen name="Expenses" component={ExpensesScreen} options={{ title: 'Expenses' }} />
    <Tab.Screen name="More" component={InventoryScreen} options={{ title: 'Inventory' }} />
  </Tab.Navigator>
);

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        await initDatabase();
        const token = await SecureStore.getItemAsync('accessToken');
        setIsAuthenticated(!!token);
        if (token) {
          setupAutoSync(60000);
        }
      } catch (error) {
        console.error('Init error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loaderText}>Loading Construction ERP...</Text>
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="dark" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {!isAuthenticated ? (
              <Stack.Screen name="Login" component={LoginScreen} />
            ) : (
              <Stack.Screen name="Main" component={TabNavigator} />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
};

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    gap: 16,
  },
  loaderText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
});

export default App;
