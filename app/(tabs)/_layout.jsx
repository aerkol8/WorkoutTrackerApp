import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#BB86FC',
        tabBarStyle: { backgroundColor: '#121212' },
        headerStyle: { backgroundColor: '#121212' },
        headerTitleStyle: { color: '#fff' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <Ionicons name="stats-chart" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="workout"
        options={{
          title: 'Training',
          tabBarIcon: ({ color }) => <Ionicons name="barbell" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="exercises"
        options={{
          title: 'Exercises',
          tabBarIcon: ({ color }) => <Ionicons name="list" size={28} color={color} />,
        }}
      />
      <Tabs.Screen
        name="nutrition"
        options={{
          title: 'Nutrition',
          tabBarIcon: ({ color }) => <Ionicons name="restaurant" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routine/[id]"
        options={{
          href: null,
          title: 'Training',
          headerShown: true,
        }}
      />
    </Tabs>
  );
}
