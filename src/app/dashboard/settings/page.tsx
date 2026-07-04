'use client';
import React from 'react';
import Link from 'next/link';
import { Shield, Paintbrush, Link as LinkIcon, Volume2, Puzzle, Settings2, Users } from 'lucide-react';
import PageGuard from '@/components/auth/PageGuard';

const SETTINGS_CARDS = [
  {
    title: 'Appearance',
    description: 'Customize branding, logo, favicon, and theme colors',
    icon: Paintbrush,
    href: '/dashboard/settings/appearance',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10'
  },
  {
    title: 'Designation & Permission',
    description: 'Manage user designations and their access privileges',
    icon: Shield,
    href: '/dashboard/settings/roles',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  {
    title: 'Integrations',
    description: 'Configure external integrations and third-party services',
    icon: Puzzle,
    href: '/dashboard/settings/integrations',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    title: 'Notification Sounds',
    description: 'Configure the audio cues for in-app notifications',
    icon: Volume2,
    href: '/dashboard/settings/notifications',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10'
  },
  {
    title: 'Connected Apps',
    description: 'Manage external apps available in the top navigation bar',
    icon: LinkIcon,
    href: '/dashboard/settings/shortcuts',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
];

export default function SettingsIndexPage() {
  return (
    <PageGuard moduleName="Settings">
      <div className="p-6 max-w-6xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-brand-primary" />
            Admin Settings
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-2">
            Manage your system configurations, integrations, and preferences.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SETTINGS_CARDS.map((card, index) => (
            <Link 
              key={index}
              href={card.href}
              className="group flex flex-col p-6 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 shadow-sm hover:shadow-xl dark:shadow-2xl transition-all duration-300 hover:-translate-y-1"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${card.bg} ${card.color} group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
                {card.title}
              </h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                {card.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </PageGuard>
  );
}
