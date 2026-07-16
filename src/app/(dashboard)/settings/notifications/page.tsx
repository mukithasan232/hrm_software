'use client';
import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/LanguageContext';
import Link from 'next/link';
import { Volume2, Play, Save, Menu, Lightbulb, ArrowLeft, Briefcase, Clock, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/services/api';

type NotificationType = 'info' | 'success' | 'warning' | 'error';

export default function NotificationSettingsPage() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [volume, setVolume] = useState(100);
  const [soundConfig, setSoundConfig] = useState<Record<NotificationType, string>>({
    info: 'notification.mp3',
    success: 'notification.mp3',
    warning: 'notification.mp3',
    error: 'notification.mp3',
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('notificationSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.isEnabled === 'boolean') setIsEnabled(parsed.isEnabled);
        if (typeof parsed.volume === 'number') setVolume(parsed.volume);
        if (parsed.soundConfig) setSoundConfig(parsed.soundConfig);
      }
    } catch (e) {
      console.error("Failed to parse notification settings", e);
    }
    setIsLoaded(true);
  }, []);

  // ── Email Notification Preferences State ────────────────────────────────
  const [emailPrefs, setEmailPrefs] = useState({
    emailOnLeave: true,
    emailOnTask: true,
    emailOnLate: false,
    emailOnSystemAlert: true
  });
  const [emailLoading, setEmailLoading] = useState(true);
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    const fetchEmailPrefs = async () => {
      try {
        const res = await api.get('/settings/notifications');
        if (res.data) {
          setEmailPrefs({
            emailOnLeave: res.data.emailOnLeave ?? true,
            emailOnTask: res.data.emailOnTask ?? true,
            emailOnLate: res.data.emailOnLate ?? false,
            emailOnSystemAlert: res.data.emailOnSystemAlert ?? true,
          });
        }
      } catch (error) {
        console.error('Failed to load email preferences', error);
      } finally {
        setEmailLoading(false);
      }
    };
    fetchEmailPrefs();
  }, []);

  const toggleEmailPref = (key: keyof typeof emailPrefs) => {
    setEmailPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSaveEmail = async () => {
    setSavingEmail(true);
    try {
      await api.post('/settings/notifications', emailPrefs);
      toast.success('Email preferences saved successfully!');
    } catch (error) {
      toast.error('Failed to save email preferences');
    } finally {
      setSavingEmail(false);
    }
  };

  const soundOptions = [
    { label: 'Default Notification', value: 'notification.mp3' },
    { label: 'Chime', value: 'chime.mp3' },
    { label: 'Ding', value: 'ding.mp3' },
    { label: 'Pop', value: 'pop.mp3' },
    { label: 'Bell', value: 'bell.mp3' },
    { label: 'Swoosh', value: 'swoosh.mp3' },
    { label: 'Tada', value: 'tada.mp3' },
  ];

  const playPreview = (type: NotificationType) => {
    if (!isEnabled) {
      toast.error('Notification sounds are disabled');
      return;
    }
    
    try {
      const audio = new Audio('/sounds/' + soundConfig[type]);
      audio.volume = volume / 100;
      audio.play().catch(e => {
        console.error("Audio playback failed:", e);
        // We catch this because if the user doesn't have the audio files in public/sounds, it will throw an error
        toast.error(`Could not play ${soundConfig[type]}. Make sure the sound file exists.`);
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    // Here you would typically save to localStorage or make an API call
    localStorage.setItem('notificationSettings', JSON.stringify({
      isEnabled,
      volume,
      soundConfig
    }));
    toast.success("Sound settings updated successfully!");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>

      {/* ── Header Section ───────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          Notification Sounds
        </h1>
        <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
          Configure the audio cues for different types of in-app notifications to match your preference.
        </p>
      </div>

      {/* ── Settings Card Container ───────────────────────────────────────────── */}
      <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-8">
        
        {/* Row 1: Toggle */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Enable notification sounds</h3>
            <p className="text-sm text-slate-500 dark:text-gray-400">Play a short audio cue when a toast notification appears.</p>
          </div>
          {/* Custom Tailwind Toggle */}
          <button 
            type="button"
            disabled={!isLoaded}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${!isLoaded ? 'opacity-50 cursor-not-allowed ' : ''}${isEnabled ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
            role="switch"
            aria-checked={isEnabled}
            onClick={() => setIsEnabled(!isEnabled)}
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`}
            />
          </button>
        </div>

        {/* Row 2: Slider */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-800 dark:text-white">Volume</h3>
            <span className="text-sm font-bold text-brand-primary bg-brand-primary/10 px-2.5 py-0.5 rounded-md">{volume}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={volume} 
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-primary"
            disabled={!isLoaded || !isEnabled}
            style={{ opacity: isLoaded && isEnabled ? 1 : 0.5 }}
          />
        </div>

        {/* Section: Sound per notification type */}
        <div className="pt-6 border-t border-slate-200 dark:border-white/10">
          <h3 className="text-base font-semibold text-slate-800 dark:text-white mb-4">Sound per notification type</h3>
          
          <div className="space-y-3">
            {[
              { type: 'info', label: 'INFO', colorClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50' },
              { type: 'success', label: 'SUCCESS', colorClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' },
              { type: 'warning', label: 'WARNING', colorClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50' },
              { type: 'error', label: 'ERROR', colorClass: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50' },
            ].map((row) => (
              <div key={row.type} className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] transition-opacity ${!isEnabled ? 'opacity-50' : 'opacity-100'}`}>
                {/* Badge */}
                <div className="w-28 flex-shrink-0">
                  <span className={`px-3 py-1 text-[11px] font-bold tracking-wider uppercase rounded-full border ${row.colorClass}`}>
                    {row.label}
                  </span>
                </div>
                
                {/* Dropdown */}
                <div className="flex-1 px-4">
                  <select 
                    value={soundConfig[row.type as NotificationType]}
                    onChange={(e) => setSoundConfig({...soundConfig, [row.type]: e.target.value})}
                    disabled={!isLoaded || !isEnabled}
                    className="w-full max-w-[200px] bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 appearance-none cursor-pointer"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.5em 1.5em', paddingRight: '2.5rem' }}
                  >
                    {soundOptions.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                {/* Play Button */}
                <button 
                  onClick={() => playPreview(row.type as NotificationType)}
                  disabled={!isLoaded || !isEnabled}
                  className="flex items-center justify-center w-10 h-10 rounded-full border-2 border-slate-200 dark:border-white/10 text-slate-500 hover:text-brand-primary hover:border-brand-primary hover:bg-brand-primary/5 dark:text-gray-400 dark:hover:text-brand-primary transition-colors disabled:pointer-events-none"
                  title="Play preview"
                >
                  <Play className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Email Notification Preferences ─────────────────────────────────── */}
      <div className="pt-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            Email Notification Preferences
          </h2>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Manage which system events trigger an email notification to your inbox.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-6">
        {emailLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Leave Requests */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">Leave Requests</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Receive an email when an employee applies for leave.</p>
                </div>
              </div>
              <button 
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${emailPrefs.emailOnLeave ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                role="switch"
                aria-checked={emailPrefs.emailOnLeave}
                onClick={() => toggleEmailPref('emailOnLeave')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailPrefs.emailOnLeave ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Task Submissions */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">Task Submissions</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Receive an email when a task is marked for verification.</p>
                </div>
              </div>
              <button 
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${emailPrefs.emailOnTask ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                role="switch"
                aria-checked={emailPrefs.emailOnTask}
                onClick={() => toggleEmailPref('emailOnTask')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailPrefs.emailOnTask ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Late Attendance */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">Late Attendance</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Receive an email when an employee punches in late.</p>
                </div>
              </div>
              <button 
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${emailPrefs.emailOnLate ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                role="switch"
                aria-checked={emailPrefs.emailOnLate}
                onClick={() => toggleEmailPref('emailOnLate')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailPrefs.emailOnLate ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* System Alerts */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-4">
                <div className="p-2.5 bg-rose-100 dark:bg-rose-900/30 rounded-xl text-rose-600 dark:text-rose-400">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">System Alerts</h3>
                  <p className="text-sm text-slate-500 mt-0.5">Receive crucial system and security alerts.</p>
                </div>
              </div>
              <button 
                type="button"
                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${emailPrefs.emailOnSystemAlert ? 'bg-brand-primary' : 'bg-slate-200 dark:bg-slate-700'}`}
                role="switch"
                aria-checked={emailPrefs.emailOnSystemAlert}
                onClick={() => toggleEmailPref('emailOnSystemAlert')}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${emailPrefs.emailOnSystemAlert ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Save Email Action Button ─────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSaveEmail}
          disabled={savingEmail || emailLoading}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] bg-brand-primary shadow-lg shadow-brand-primary/50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingEmail ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} 
          {savingEmail ? 'Saving...' : 'Save Email Preferences'}
        </button>
      </div>

    </div>
  );
}
