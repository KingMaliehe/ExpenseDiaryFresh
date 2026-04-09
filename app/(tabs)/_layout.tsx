// app/(tabs)/_layout.tsx
import { Tabs, Redirect } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { useAuthStore } from '../../src/store/authStore';
import { Colors, Radius } from '../../src/theme';

function TabIcon({ focused, label, emoji }: { focused: boolean; label: string; emoji: string }) {
  return (
    <View style={[styles.tabIcon, focused && styles.tabIconActive]}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.tabLabel, { color: focused ? Colors.accent : Colors.subtle }]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  const { session } = useAuthStore();
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Home" emoji="🏠" />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Transactions" emoji="📋" />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={styles.addBtn}>
              <Text style={styles.addBtnText}>+</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Budgets" emoji="🎯" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} label="Profile" emoji="👤" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 70,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabIcon: { alignItems: 'center', gap: 3 },
  tabIconActive: {},
  emoji: { fontSize: 20 },
  tabLabel: { fontSize: 10, fontWeight: '500' },
  addBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  addBtnText: { fontSize: 28, color: Colors.bg, fontWeight: '300', marginTop: -2 },
});
