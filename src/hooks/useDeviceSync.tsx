import { useState } from 'react';
import toast from 'react-hot-toast';

export interface SyncResult {
  success: boolean;
  action: 'created' | 'updated';
  enrollNumber: number;
}

export function useDeviceSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'queued' | 'error'>('idle');

  const syncToDevice = async (employeeId: string): Promise<boolean> => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncStatus('syncing');

    // Prevent closing modal or fast operations from destroying toast context
    const toastId = toast.loading('Syncing to device...');

    try {
      const response = await fetch(`/api/employees/${employeeId}/sync-to-device`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.status === 200) {
        toast.success('User synced to ZKTeco device ✓', { id: toastId });
        setSyncStatus('success');
        return true;
      } else if (response.status === 503) {
        toast.custom(
          (t) => (
            <div className={`bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded shadow-lg ${t.visible ? 'animate-enter' : 'animate-leave'}`}>
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Device offline — sync queued. Will retry automatically.
                  </p>
                </div>
              </div>
            </div>
          ),
          { id: toastId, duration: 4000 }
        );
        setSyncStatus('queued');
        return true; // Queued is considered a handled state, not a hard failure
      } else {
        const errorMsg = data.error || 'Failed to sync to device';
        toast.error(errorMsg, { id: toastId });
        setSyncError(errorMsg);
        setSyncStatus('error');
        return false;
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Network error during sync';
      toast.error(errorMsg, { id: toastId });
      setSyncError(errorMsg);
      setSyncStatus('error');
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return { syncToDevice, isSyncing, syncError, syncStatus };
}
