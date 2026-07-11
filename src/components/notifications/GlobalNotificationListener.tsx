'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

const fetcher = (url: string) => api.get(url).then(res => res.data);

export default function GlobalNotificationListener() {
  const { user } = useAuth();
  const [prevCount, setPrevCount] = useState(0);

  // Only poll if user is an admin or super admin
  const isAdmin = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r?.name || '').toLowerCase().includes('admin')) || 
                  (typeof user?.designation === 'string' && user.designation.toLowerCase().includes('admin')) ||
                  ((user?.designation as any)?.name?.toLowerCase().includes('admin'));

  // Poll every 5 seconds
  const { data } = useSWR(
    isAdmin ? '/notifications?unread=true&limit=1' : null,
    fetcher,
    { refreshInterval: 5000 }
  );

  useEffect(() => {
    if (data) {
      // Assuming API returns { data: [latestNotif], meta: { totalUnread: X } }
      const unreadCount = data.meta?.totalUnread || data.meta?.totalRecords || 0;
      
      if (unreadCount > prevCount && unreadCount > 0) {
        // Play notification sound
        const audio = new Audio('/sounds/notify.mp3');
        audio.play().catch(err => console.warn('Autoplay blocked by browser:', err));

        // Show toast for the latest notification
        if (data.data && data.data.length > 0) {
          const latest = data.data[0];
          toast.success(latest.titleEn || latest.messageEn || 'New Notification', { icon: '🔔' });
        }

        setPrevCount(unreadCount);
      } else if (unreadCount < prevCount) {
        // User read some notifications
        setPrevCount(unreadCount);
      }
    }
  }, [data, prevCount]);

  return null;
}
