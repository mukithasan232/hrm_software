'use client';
import { useState, useEffect } from 'react';

const BACKEND = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : '';

export function getAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null;
  
  if (avatarPath.startsWith('http')) return avatarPath;
  
  // If it's just a filename (no slashes)
  if (!avatarPath.includes('/')) {
    return `${BACKEND}/uploads/avatars/${avatarPath}`;
  }
  
  // If it starts with / (e.g. /uploads/avatars/...)
  if (avatarPath.startsWith('/')) {
    return `${BACKEND}${avatarPath}`;
  }
  
  return `${BACKEND}/${avatarPath}`;
}

interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

export default function Avatar({ src, alt, name, className, fallbackClassName }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  
  const parsedSrc = getAvatarUrl(src);
  const initials = String(name || '').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  // Reset error state if src changes
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const defaultClasses = "h-8 w-8 rounded-full object-cover";
  const defaultFallbackClasses = "h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-bold bg-gradient-to-tr from-brand-primary to-brand-secondary";

  if (parsedSrc && !imgError) {
    return (
      <img
        src={parsedSrc}
        alt={alt || name || 'Avatar'}
        className={className || defaultClasses}
        onError={() => setImgError(true)}
      />
    );
  }

  const baseFallback = "flex items-center justify-center text-white text-xs font-bold bg-gradient-to-tr from-brand-primary to-brand-secondary";
  const finalFallbackClass = fallbackClassName || `${className || defaultClasses} ${baseFallback}`.replace('object-cover', '');

  return (
    <div className={finalFallbackClass}>
      {initials}
    </div>
  );
}
