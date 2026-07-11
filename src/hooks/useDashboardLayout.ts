import { useState, useEffect } from 'react';

type LayoutState = {
  summaryZone: string[];
  detailZone: string[];
};

export const useDashboardLayout = (isAdmin: boolean) => {
  const DEFAULT_LAYOUT: LayoutState = isAdmin ? {
    summaryZone: ['punch-status', 'absent-days', 'leaves-remaining', 'break-countdown'],
    detailZone: ['global-stream', 'notice-board', 'weekly-attendance', 'late-today', 'checked-out']
  } : {
    summaryZone: ['punch-status', 'break-countdown', 'absent-days', 'leaves-remaining', 'leaves-pending'],
    detailZone: ['global-stream', 'notice-board', 'my-punches', 'weekly-attendance']
  };

  const STORAGE_KEY = `dashboard_layout_${isAdmin ? 'admin' : 'emp'}`;

  // The persisted "source of truth" layout
  const [savedLayout, setSavedLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  // The in-progress draft layout (only active while editing)
  const [draftLayout, setDraftLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.summaryZone && parsed.detailZone) {
          // Inject checked-out for existing admin layouts if missing
          if (isAdmin && !parsed.summaryZone.includes('checked-out') && !parsed.detailZone.includes('checked-out')) {
             parsed.detailZone.push('checked-out');
             localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          }
          setSavedLayout(parsed);
          setDraftLayout(parsed);
        } else {
          setSavedLayout(DEFAULT_LAYOUT);
          setDraftLayout(DEFAULT_LAYOUT);
        }
      } else {
        setSavedLayout(DEFAULT_LAYOUT);
        setDraftLayout(DEFAULT_LAYOUT);
      }
    } catch (e) {
      console.warn('Failed to load dashboard layout', e);
    }
    setIsLoaded(true);
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Persist the draft to localStorage and promote it to savedLayout.
   * Called when the user clicks "Save Layout".
   */
  const persistLayout = (layout: LayoutState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (e) {
      console.warn('Failed to persist dashboard layout', e);
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
