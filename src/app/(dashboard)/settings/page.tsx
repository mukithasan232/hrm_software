'use client';
import React from 'react';
import Link from 'next/link';
import { Shield, Paintbrush, Link as LinkIcon, Volume2, Puzzle, Settings2, Users, Database, Server, BellRing } from 'lucide-react';
import PageGuard from '@/components/auth/PageGuard';
import { useTranslation } from '@/context/LanguageContext';

const SETTINGS_CARDS = [
  {
    title: 'Database Setup',
    description: 'Manage database connection and credentials.',
    icon: Database,
    href: '/settings/database',
    color: 'text-purple-500',
    bg: 'bg-purple-500/10'
  },
  {
    title: 'System Config',
    description: 'Manage master configurations and super admin.',
    icon: Server,
    href: '/settings/system',
    color: 'text-slate-500',
    bg: 'bg-slate-500/10'
  },
  {
    title: 'Modules Config',
    description: 'Enable or disable core system modules dynamically.',
    icon: Settings2,
    href: '/settings/modules',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    titleKey: 'adminSettings.appearance',
    descKey: 'adminSettings.appearanceDesc',
    icon: Paintbrush,
    href: '/settings/appearance',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10'
  },
  {
    titleKey: 'adminSettings.designationPermission',
    descKey: 'adminSettings.designationPermissionDesc',
    icon: Shield,
    href: '/settings/roles',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10'
  },
  {
    titleKey: 'adminSettings.integrations',
    descKey: 'adminSettings.integrationsDesc',
    icon: Puzzle,
    href: '/settings/integrations',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10'
  },
  {
    titleKey: 'adminSettings.notificationSounds',
    descKey: 'adminSettings.notificationSoundsDesc',
    icon: Volume2,
    href: '/settings/notifications',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10'
  },
  {
    title: 'Notification Preferences',
    description: 'Manage email alerts and system notifications.',
    icon: BellRing,
    href: '/settings/notifications',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
  {
    titleKey: 'adminSettings.connectedApps',
    descKey: 'adminSettings.connectedAppsDesc',
    icon: LinkIcon,
    href: '/settings/shortcuts',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10'
  },
];

export default function SettingsIndexPage() {
  const { t } = useTranslation();

  return (
    <PageGuard moduleName="Settings">
      <div className="p-6 max-w-6xl mx-auto min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Settings2 className="w-8 h-8 text-brand-primary" />
            {t('adminSettings.title' as any)}
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-2">
            {t('adminSettings.subtitle' as any)}
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
                {(card as any).title || t((card as any).titleKey)}
              </h3>
              <p className="text-sm text-slate-500 dark:text-gray-400 leading-relaxed">
                {(card as any).description || t((card as any).descKey)}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </PageGuard>
  );
}
