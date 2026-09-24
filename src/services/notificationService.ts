import { db } from './firebase';
import { doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';
import type { FCMDeviceSubscription } from '../types';

export function isPushSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function getNotificationPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestPushPermission(userUid: string): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Register or update device token record
      const dummyToken = `web_token_${userUid}_${Date.now()}`;
      const subRef = doc(db, 'fcm_subscriptions', userUid);
      
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isTablet = /iPad/i.test(navigator.userAgent);

      const sub: FCMDeviceSubscription = {
        token: dummyToken,
        userUid,
        deviceType: isTablet ? 'tablet' : (isMobile ? 'mobile' : 'desktop'),
        browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : 'Browser',
        updatedAt: new Date().toISOString()
      };

      await setDoc(subRef, sub);
      return true;
    }
    return false;
  } catch (err) {
    console.error("Error requesting push notification permission:", err);
    return false;
  }
}

export async function removePushSubscription(userUid: string): Promise<void> {
  try {
    const subRef = doc(db, 'fcm_subscriptions', userUid);
    await deleteDoc(subRef);
  } catch (err) {
    console.error("Error removing push subscription:", err);
  }
}

export function sendLocalBrowserNotification(title: string, body: string): void {
  if (isPushSupported() && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico'
    });
  }
}
