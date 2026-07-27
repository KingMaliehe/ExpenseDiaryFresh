// src/services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { formatMoney } from '../lib/currency';
import { useAuthStore } from '../store/authStore';

// Format an amount in the user's chosen currency, no decimals (alerts are terse).
// Read from the store directly so callers don't have to thread currency through.
function money(n: number): string {
  const currency = useAuthStore.getState().profile?.currency;
  return formatMoney(n, currency, { decimals: false });
}

// Configure how notifications appear when the app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    // shouldShowAlert was split into banner + list in newer expo-notifications.
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('budget-alerts', {
      name: 'Budget Alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#d4a843',
    });
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export async function sendBudgetAlert(categoryName: string, percent: number, spent: number, limit: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `⚠️ Budget alert: ${categoryName}`,
      body: `You've used ${percent}% of your ${categoryName} budget (${money(spent)} of ${money(limit)}).`,
      sound: true,
      data: { type: 'budget_alert', category: categoryName },
    },
    trigger: null, // Send immediately
  });
}

export async function sendOverBudgetAlert(categoryName: string, overage: number) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: `🚨 Over budget: ${categoryName}`,
      body: `You've exceeded your ${categoryName} budget by ${money(overage)}.`,
      sound: true,
      data: { type: 'over_budget', category: categoryName },
    },
    trigger: null,
  });
}
