import React, { useState, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';

export type HeaderItemKey = 'departments' | 'date' | 'sync' | 'export';

interface ItemDef {
  id: HeaderItemKey;
  label: string;
}

const ALL_ITEMS: ItemDef[] = [
  { id: 'departments', label: 'All Departments' },
  { id: 'date', label: 'Date Range Picker' },
  { id: 'sync', label: 'Sync Data (Admin Only)' },
  { id: 'export', label: 'Export Options' }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentOrder: HeaderItemKey[];
  onSave: (newOrder: HeaderItemKey[]) => void;
}

export default function HeaderCustomizationModal({ isOpen, onClose, currentOrder, onSave }: Props) {
  const [items, setItems] = useState<ItemDef[]>([]);

  useEffect(() => {
    const mapped = currentOrder.map(key => ALL_ITEMS.find(i => i.id === key)).filter(Boolean) as ItemDef[];
    const missing = ALL_ITEMS.filter(i => !currentOrder.includes(i.id));
    setItems([...mapped, ...missing]);
  }, [currentOrder, isOpen]);

  if (!isOpen) return null;

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    
    const newItems = Array.from(items);
    const [reorderedItem] = newItems.splice(result.source.index, 1);
    newItems.splice(result.destination.index, 0, reorderedItem);
    
    setItems(newItems);
  };

  const handleSave = () => {
    onSave(items.map(i => i.id));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Customize Layout</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Drag and drop to reorder the filters and action buttons.
          </p>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="header-items">
              {(provided) => (
                <div 
                  {...provided.droppableProps} 
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {items.map((item, index) => (
                    <Draggable key={item.id} draggableId={item.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border ${snapshot.isDragging ? 'border-indigo-500 shadow-md' : 'border-slate-200 dark:border-white/10'} rounded-xl`}
                        >
                          <div {...provided.dragHandleProps} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-grab active:cursor-grabbing">
                            <GripVertical className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-white/10 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-sm">
            Save Layout
          </button>
        </div>
      </div>
    </div>
  );
}
