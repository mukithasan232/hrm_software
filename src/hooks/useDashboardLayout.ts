import { useState, useEffect } from 'react';

type LayoutState = {
  summaryZone: string[];
  detailZone: string[];
};

export const useDashboardLayout = (isAdmin: boolean) => {
  const DEFAULT_LAYOUT: LayoutState = isAdmin ? {
    summaryZone: ['punch-status', 'absent-days', 'leaves-remaining'],
    detailZone: ['notice-board', 'weekly-attendance', 'department-overview', 'late-today']
  } : {
    summaryZone: ['punch-status', 'absent-days', 'leaves-remaining', 'leaves-pending'],
    detailZone: ['notice-board', 'my-punches', 'weekly-attendance']
  };

  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(`dashboard_layout_${isAdmin ? 'admin' : 'emp'}`);
      if (savedLayout) {
        const parsed = JSON.parse(savedLayout);
        if (parsed.summaryZone && parsed.detailZone) {
          setLayout(parsed);
        }
      } else {
        setLayout(DEFAULT_LAYOUT);
      }
    } catch (e) {
      console.warn("Failed to load dashboard layout", e);
    }
    setIsLoaded(true);
  }, [isAdmin]); // Reload layout if role changes

  const saveLayout = (newLayout: LayoutState) => {
    setLayout(newLayout);
    try {
      localStorage.setItem(`dashboard_layout_${isAdmin ? 'admin' : 'emp'}`, JSON.stringify(newLayout));
    } catch (e) {
      console.warn("Failed to save dashboard layout", e);
    }
  };

  const handleDragEnd = (result: any) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const newLayout = { ...layout };
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

    saveLayout(newLayout);
  };

  return {
    layout,
    isLoaded,
    handleDragEnd,
    setLayout: saveLayout
  };
};
