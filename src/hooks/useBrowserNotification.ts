import { useCallback, useEffect } from 'react';

export const useBrowserNotification = () => {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const triggerNotification = useCallback((title: string, body: string, icon = '/favicon.ico') => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      // Native Browser Popup
      const notification = new Notification(title, { body, icon });
      
      // Optional: Play sound
      const audio = new Audio('/sounds/notify.mp3');
      audio.play().catch(e => console.log('Audio play blocked by browser', e));

      // Focus window on click
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    } else {
      // Fallback: If permission denied, use react-hot-toast (or existing toast library)
      // handled elsewhere or add toast here if needed
    }
  }, []);

  return { triggerNotification };
};
