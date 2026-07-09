import { useState, useEffect } from 'react';
import { differenceInMinutes } from 'date-fns';

export const useLiveOfficeHour = (checkInTime: string | Date | null) => {
  const [elapsedString, setElapsedString] = useState<string>('—');

  useEffect(() => {
    if (!checkInTime) {
      setElapsedString('—');
      return;
    }

    const calculateElapsed = () => {
      const now = new Date();
      const checkIn = new Date(checkInTime);
      
      // Prevent negative times if clock is out of sync
      if (now < checkIn) return '0h 0m'; 

      const totalMins = differenceInMinutes(now, checkIn);
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;
      
      setElapsedString(`${hours}h ${mins}m`);
    };

    // Calculate immediately on mount
    calculateElapsed();

    // Update every 1 minute
    const interval = setInterval(calculateElapsed, 60000);
    
    return () => clearInterval(interval);
  }, [checkInTime]);

  return elapsedString;
};
