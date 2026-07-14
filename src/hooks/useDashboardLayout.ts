import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

type LayoutState = {
  summaryZone: string[];
  detailZone: string[];
};

export const useDashboardLayout = (isAdmin: boolean) => {
  const { user, updateUser } = useAuth();

  const DEFAULT_LAYOUT: LayoutState = isAdmin ? {
    summaryZone: ['punch-status', 'absent-days', 'leaves-remaining', 'break-countdown'],
    detailZone: ['global-stream', 'notice-board', 'weekly-attendance', 'late-today', 'checked-out']
  } : {
    summaryZone: ['punch-status', 'break-countdown', 'absent-days', 'leaves-remaining', 'leaves-pending'],
    detailZone: ['global-stream', 'notice-board', 'my-punches', 'weekly-attendance']
  };

  // The persisted "source of truth" layout
  const [savedLayout, setSavedLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  // The in-progress draft layout (only active while editing)
  const [draftLayout, setDraftLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from user context on mount
  useEffect(() => {
    if (user) {
      try {
        const userConfig = (user as any).dashboardConfig;
        if (userConfig && typeof userConfig === 'object' && userConfig.summaryZone && userConfig.detailZone) {
          setSavedLayout(userConfig);
          setDraftLayout(userConfig);
        } else {
          setSavedLayout(DEFAULT_LAYOUT);
          setDraftLayout(DEFAULT_LAYOUT);
        }
      } catch (e) {
        console.warn('Failed to parse user dashboard layout', e);
        setSavedLayout(DEFAULT_LAYOUT);
        setDraftLayout(DEFAULT_LAYOUT);
      }
    }
    setIsLoaded(true);
  }, [user, isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Persist the draft to the database via API and promote it to savedLayout.
   * Called when the user clicks "Save Layout".
   */
  const persistLayout = async (layout: LayoutState) => {
    try {
      await api.patch('/user/preferences', { dashboardConfig: layout });
      // Update user in context so we don't need a page reload
      updateUser({ dashboardConfig: layout } as any);
    } catch (e) {
      console.error('Failed to persist dashboard layout via API', e);
    }
    setSavedLayout(layout);
    setDraftLayout(layout);
  };

  /**
   * Revert draftLayout back to the last saved state.
   * Called when the user clicks "Cancel".
   */
  const revertDraft = () => {
    setDraftLayout(savedLayout);
  };

  /**
   * Handle a drag-end event — updates draft ONLY (does NOT persist).
   * isDragDisabled should be false when isEditing is true.
   */
  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newLayout = { ...draftLayout };
    const sourceZoneId = source.droppableId as keyof LayoutState;
    const destZoneId = destination.droppableId as keyof LayoutState;

    const sourceItems = Array.from(newLayout[sourceZoneId]);
    sourceItems.splice(source.index, 1);

    if (sourceZoneId === destZoneId) {
      sourceItems.splice(destination.index, 0, draggableId);
      newLayout[sourceZoneId] = sourceItems;
    } else {
      const destItems = Array.from(newLayout[destZoneId]);
      destItems.splice(destination.index, 0, draggableId);
      newLayout[sourceZoneId] = sourceItems;
      newLayout[destZoneId] = destItems;
    }

    // Update draft only — do NOT save to localStorage yet
    setDraftLayout(newLayout);
  };

  return {
    layout: draftLayout,      // Always render from draftLayout
    savedLayout,
    draftLayout,
    isLoaded,
    handleDragEnd,
    persistLayout,
    revertDraft,
  };
};
