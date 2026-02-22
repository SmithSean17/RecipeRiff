import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

import RecipeListScreen from '../screens/recipes/RecipeListScreen';
import RecipeDetailScreen from '../screens/recipes/RecipeDetailScreen';
import RecipeFormScreen from '../screens/recipes/RecipeFormScreen';
import RiffModeScreen from '../screens/recipes/RiffModeScreen';
import CookScreen from '../screens/recipes/CookScreen';
import SaveRiffScreen from '../screens/recipes/SaveRiffScreen';
import StatsScreen from '../screens/stats/StatsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import type { BottomTabParamList, RecipesStackParamList } from '../types/navigation';

const Tab = createBottomTabNavigator<BottomTabParamList>();
const RecipesStack = createNativeStackNavigator<RecipesStackParamList>();

function RecipesNavigator() {
  return (
    <RecipesStack.Navigator screenOptions={{ headerShown: false }}>
      <RecipesStack.Screen name="RecipeList" component={RecipeListScreen} />
      <RecipesStack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
      <RecipesStack.Screen
        name="RecipeForm"
        component={RecipeFormScreen}
        options={{ presentation: 'modal' }}
      />
      <RecipesStack.Screen
        name="RiffMode"
        component={RiffModeScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <RecipesStack.Screen
        name="CookScreen"
        component={CookScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
      <RecipesStack.Screen
        name="SaveRiff"
        component={SaveRiffScreen}
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </RecipesStack.Navigator>
  );
}

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

export default function AppNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color }) => {
          let iconName: IoniconsName = 'book-outline';
          if (route.name === 'Recipes') iconName = focused ? 'book' : 'book-outline';
          else if (route.name === 'Stats') iconName = focused ? 'stats-chart' : 'stats-chart-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={22} color={color} />;
        },
        tabBarActiveTintColor: colors.amberDeep,
        tabBarInactiveTintColor: colors.barkLight,
        tabBarStyle: {
          backgroundColor: 'rgba(255,248,240,0.92)',
          borderTopColor: colors.border,
          paddingBottom: 6,
          paddingTop: 4,
          height: 56,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      })}
    >
      <Tab.Screen name="Recipes" component={RecipesNavigator} />
      <Tab.Screen name="Stats" component={StatsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}
