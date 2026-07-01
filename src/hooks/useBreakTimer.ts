import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

export interface BreakDepartment {
  lunchStartTime?: string | null;
  lunchEndTime?: string | null;
  snacksStartTime?: string | null;
  snacksEndTime?: string | null;
}

export function useBreakTimer(department?: BreakDepartment | null) {
  const [activeBreak, setActiveBreak] = useState<'LUNCH' | 'SNACKS' | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isBreakActive, setIsBreakActive] = useState<boolean>(false);

  const notifiedLunchStart = useRef(false);
  const notifiedLunchEnd = useRef(false);
  const notifiedSnacksStart = useRef(false);
  const notifiedSnacksEnd = useRef(false);

  useEffect(() => {
    let currentDay = new Date().getDate();

    const checkTime = () => {
      const now = new Date();
      // Reset notifications on a new day
      if (now.getDate() !== currentDay) {
        currentDay = now.getDate();
        notifiedLunchStart.current = false;
        notifiedLunchEnd.current = false;
        notifiedSnacksStart.current = false;
        notifiedSnacksEnd.current = false;
      }

      if (!department) {
        setActiveBreak(null);
        setIsBreakActive(false);
        setTimeRemaining('');
        return;
      }

      const { lunchStartTime, lunchEndTime, snacksStartTime, snacksEndTime } = department;

      const toMinutes = (timeStr?: string | null) => {
        if (!timeStr) return -1;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
      };

      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const nowSeconds = now.getSeconds();

      const lunchStart = toMinutes(lunchStartTime);
      const lunchEnd = toMinutes(lunchEndTime);
      const snacksStart = toMinutes(snacksStartTime);
      const snacksEnd = toMinutes(snacksEndTime);

      let currentActive: 'LUNCH' | 'SNACKS' | null = null;
      let endMinutes = 0;

      // Check Lunch
      if (lunchStart !== -1 && lunchEnd !== -1) {
        if (nowMinutes >= lunchStart && nowMinutes < lunchEnd) {
          currentActive = 'LUNCH';
          endMinutes = lunchEnd;
          if (!notifiedLunchStart.current) {
            toast.success('Your lunch time begins!');
            notifiedLunchStart.current = true;
          }
        } else if (nowMinutes >= lunchEnd && !notifiedLunchEnd.current && notifiedLunchStart.current) {
          toast('Lunch time ended.', { icon: 'ℹ️' });
          notifiedLunchEnd.current = true;
        }
      }

      // Check Snacks
      if (snacksStart !== -1 && snacksEnd !== -1) {
        if (nowMinutes >= snacksStart && nowMinutes < snacksEnd) {
          currentActive = 'SNACKS';
          endMinutes = snacksEnd;
          if (!notifiedSnacksStart.current) {
            toast.success('Your snacks time begins!');
            notifiedSnacksStart.current = true;
          }
        } else if (nowMinutes >= snacksEnd && !notifiedSnacksEnd.current && notifiedSnacksStart.current) {
          toast('Snacks time ended.', { icon: 'ℹ️' });
          notifiedSnacksEnd.current = true;
        }
      }

      setActiveBreak(currentActive);
      setIsBreakActive(!!currentActive);

      if (currentActive) {
        const remainingTotalSeconds = (endMinutes - nowMinutes) * 60 - nowSeconds;
        const m = Math.floor(remainingTotalSeconds / 60);
        const s = remainingTotalSeconds % 60;
        setTimeRemaining(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
      } else {
        setTimeRemaining('');
      }
    };

    checkTime();
    const interval = setInterval(checkTime, 1000);
    return () => clearInterval(interval);
  }, [department]);

  return { activeBreak, timeRemaining, isBreakActive };
}
