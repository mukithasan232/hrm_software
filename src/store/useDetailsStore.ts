import { create } from 'zustand';

export type EntityType = 'task' | 'employee' | 'department' | 'leave' | 'attendance' | 'user' | null;

interface DetailsState {
  isOpen: boolean;
  entityType: EntityType;
  entityId: string | number | null;
  entityData: any | null; // Optional initial data
  openDetails: (type: EntityType, id: string | number, data?: any) => void;
  closeDetails: () => void;
}

export const useDetailsStore = create<DetailsState>((set) => ({
  isOpen: false,
  entityType: null,
  entityId: null,
  entityData: null,
  openDetails: (type, id, data) => set({ isOpen: true, entityType: type, entityId: id, entityData: data || null }),
  closeDetails: () => set({ isOpen: false, entityType: null, entityId: null, entityData: null }),
}));
