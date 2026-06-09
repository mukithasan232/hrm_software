'use client';
import { Toaster } from 'react-hot-toast';

export function ToasterProvider() {
  return (
    <Toaster 
      position="top-right"
      containerStyle={{
        top: 80,
        right: 16,
        zIndex: 99999,
      }}
      toastOptions={{
        style: {
          background: '#1e293b',
          color: '#fff',
          border: '1px solid #334155',
        },
      }} 
    />
  );
}
