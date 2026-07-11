'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Paintbrush, Save, RefreshCw, Image as ImageIcon,
  Globe, Palette, CheckCircle2, AlertCircle, Sparkles, Eye, ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { useBrand } from '@/context/BrandContext';

import { useRouter } from 'next/navigation';

// ── types ─────────────────────────────────────────────────────────────────────

interface AppearanceSettings {
  id?: string;
  companyName: string;
  companyAddress?: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
}

// ── preset palette ─────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Violet',  color: '#8b5cf6' },
  { label: 'Indigo',  color: '#6366f1' },
  { label: 'Blue',    color: '#3b82f6' },
  { label: 'Sky',     color: '#0ea5e9' },
  { label: 'Cyan',    color: '#06b6d4' },
  { label: 'Teal',    color: '#14b8a6' },
  { label: 'Emerald', color: '#10b981' },
  { label: 'Lime',    color: '#84cc16' },
  { label: 'Yellow',  color: '#eab308' },
  { label: 'Amber',   color: '#f59e0b' },
  { label: 'Orange',  color: '#f97316' },
  { label: 'Rose',    color: '#f43f5e' },
  { label: 'Pink',    color: '#ec4899' },
  { label: 'Fuchsia', color: '#d946ef' },
  { label: 'Slate',   color: '#64748b' },
  { label: 'Zinc',    color: '#71717a' },
];

// ── file drop zone ─────────────────────────────────────────────────────────────

function FileDropZone({
  label, hint, accept, value, onChange, icon: Icon, accentColor,
}: {
  label: string; hint: string; accept: string;
  value: File | null; onChange: (f: File | null) => void;
  icon: React.ElementType; accentColor: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value) { setPreview(null); return; }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
        onClick={() => inputRef.current?.click()}
        className="relative cursor-pointer rounded-xl border-2 border-dashed transition-all duration-200 p-5 flex flex-col items-center gap-3 text-center"
        style={dragging ? { borderColor: accentColor, background: `${accentColor}15`, transform: 'scale(1.01)' }
          : { borderColor: 'rgba(148,163,184,0.3)' }}
      >
        {preview ? (
          <div className="flex flex-col items-center gap-2">
            <img src={preview} alt="preview" className="h-14 max-w-[160px] object-contain rounded-lg ring-1 ring-slate-200 dark:ring-white/10 bg-white/50 dark:bg-black/20 p-1" />
            <span className="text-xs font-medium" style={{ color: accentColor }}>{value?.name}</span>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center">
              <Icon className="w-5 h-5 text-slate-400 dark:text-gray-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-gray-300">
                Drop file or <span style={{ color: accentColor }}>browse</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{hint}</p>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={e => onChange(e.target.files?.[0] ?? null)} />
      </div>
    </div>
  );
}

// ── color picker panel ────────────────────────────────────────────────────────

type ColorTarget = 'primaryColor' | 'secondaryColor';

function ColorPickerPanel({
  title, badge, colorKey, settings, setSettings,
}: {
  title: string;
  badge: string;
  colorKey: ColorTarget;
  settings: AppearanceSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppearanceSettings>>;
}) {
  const currentColor = settings[colorKey] ?? '#000000';
  const [hexInput, setHexInput] = useState(currentColor);
  const isValid = /^#[0-9a-fA-F]{6}$/.test(hexInput ?? '');

  // keep hex input in sync when settings change from outside
  useEffect(() => { setHexInput(settings[colorKey] ?? '#000000'); }, [settings[colorKey]]);

  const setColor = (val: string) => {
    setHexInput(val);
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setSettings(s => ({ ...s, [colorKey]: val }));
    }
  };

  // Which presets are already chosen by the OTHER color
  const otherKey: ColorTarget = colorKey === 'primaryColor' ? 'secondaryColor' : 'primaryColor';
  const otherColor = settings[otherKey];

  return (
    <div
      className="flex-1 min-w-[260px] rounded-2xl border p-5 space-y-4 transition-all duration-200"
      style={{ borderColor: `${currentColor}30`, background: `${currentColor}06` }}
    >
      {/* header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-white/30"
            style={{ background: currentColor }}
          />
          {title}
        </h3>
        <span
          className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
          style={{ background: `${currentColor}20`, color: currentColor }}
        >
          {badge}
        </span>
      </div>

      {/* preset swatches — multi-selectable feel */}
      <div>
        <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider mb-2">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(({ label, color }) => {
            const isThisSelected  = currentColor === color;
            const isOtherSelected = otherColor  === color;
            return (
              <button
                key={color}
                type="button"
                title={`${label}${isOtherSelected ? ` (used as ${otherKey})` : ''}`}
                onClick={() => setColor(color)}
                className="relative w-7 h-7 rounded-full transition-all duration-150 hover:scale-110 focus:outline-none"
                style={{
                  background: color,
                  boxShadow: isThisSelected
                    ? `0 0 0 2px white, 0 0 0 4px ${color}, 0 4px 12px ${color}60`
                    : isOtherSelected
                    ? `0 0 0 2px ${color}60`
                    : undefined,
                  opacity: isOtherSelected && !isThisSelected ? 0.55 : 1,
                }}
              >
                {isThisSelected && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-white absolute inset-0 m-auto drop-shadow" />
                )}
                {/* little "used" dot on the other side */}
                {isOtherSelected && !isThisSelected && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-white border border-slate-300 dark:border-slate-700" />
                )}
              </button>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 dark:text-gray-600 mt-2">
          Dimmed swatches are already selected as the other color.
        </p>
      </div>

      {/* picker + hex */}
      <div className="flex items-start gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Picker</p>
          <input
            type="color"
            value={currentColor}
            onChange={e => setColor(e.target.value)}
            className="w-12 h-10 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer bg-transparent p-0.5"
          />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">Hex</p>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-md border border-slate-200 dark:border-white/20 flex-shrink-0"
              style={{ background: currentColor }}
            />
            <input
              type="text"
              value={hexInput}
              onChange={e => setColor(e.target.value)}
              maxLength={7}
              placeholder="#000000"
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 transition-all"
              style={{ '--tw-ring-color': `${currentColor}40` } as any}
            />
          </div>
          {!isValid && (hexInput ?? '').length > 0 && (
            <p className="text-[10px] text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Use #rrggbb format
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function AppearancePage() {
  const router = useRouter();
  const [settings, setSettings] = useState<AppearanceSettings>({
    companyName: 'FIX ANY PHOTO',
    companyAddress: '',
    logoUrl: null,
    faviconUrl: null,
    primaryColor: '#8b5cf6',
    secondaryColor: '#06b6d4',
  });
  const { brand: globalBrand, refreshBrand } = useBrand();
  const [logoFile, setLogoFile]     = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    api.get('/settings/appearance')
      .then(res => setSettings(prev => ({
        ...prev,
        ...res.data,
        primaryColor:   res.data.primaryColor   || '#8b5cf6',
        secondaryColor: res.data.secondaryColor || '#06b6d4',
      })))
      .catch(() => {
        // API unreachable or error — silently use defaults so the page still renders
        setSettings(prev => ({
          ...prev,
          primaryColor:   prev.primaryColor   || '#8b5cf6',
          secondaryColor: prev.secondaryColor || '#06b6d4',
        }));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const hexRe = /^#[0-9a-fA-F]{6}$/;
    if (!hexRe.test(settings.primaryColor))   return toast.error('Invalid primary color hex');
    if (!hexRe.test(settings.secondaryColor)) return toast.error('Invalid secondary color hex');

    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('companyName',    settings.companyName);
      if (settings.companyAddress !== undefined && settings.companyAddress !== null) {
        fd.append('companyAddress', settings.companyAddress);
      }
      fd.append('primaryColor',   settings.primaryColor);
      fd.append('secondaryColor', settings.secondaryColor);
      if (logoFile)    fd.append('logo',    logoFile);
      if (faviconFile) fd.append('favicon', faviconFile);

      const res = await api.put('/settings/appearance', fd);
      setSettings(res.data.settings);
      setLogoFile(null);
      setFaviconFile(null);
      if (logoFile || faviconFile) {
        toast.success('Logo uploaded successfully');
      } else {
        toast.success('Brand settings saved!');
      }
      refreshBrand(); // propagate new colors to all dashboard components instantly
      router.refresh(); // bust Next.js cache and refresh layout
    } catch (err: any) {
      toast.error(`Upload failed: ${err.response?.data?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const p = settings.primaryColor;
  const s = settings.secondaryColor;
  const gradient = `linear-gradient(135deg, ${p}, ${s})`;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Link href="/settings" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800 dark:text-gray-400 dark:hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Settings
      </Link>

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary shadow-lg shadow-brand-primary/50"
            >
              <Paintbrush className="w-5 h-5 text-white" />
            </span>
            Appearance
          </h1>
          <p className="text-slate-500 dark:text-gray-400 mt-1 text-sm">
            Customize branding, logo, favicon, and theme colors for a white-label experience.
          </p>
        </div>
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-semibold bg-brand-primary/15 border-brand-primary/40 text-brand-primary"
        >
          <Eye className="w-4 h-4" /> Live preview active
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* ── Company identity ─────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-4">
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-primary" /> Company Identity
          </h2>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
              Company / Brand Name
            </label>
            <input
              type="text"
              value={settings.companyName}
              onChange={e => setSettings(s => ({ ...s, companyName: e.target.value }))}
              placeholder="e.g. Fix Any Photo"
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all font-semibold"
            />
            <p className="text-xs text-slate-400 dark:text-gray-500">Shown in the browser tab, emails, and PDF reports.</p>
          </div>
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
              Company Address
            </label>
            <textarea
              value={settings.companyAddress || ''}
              onChange={e => setSettings(s => ({ ...s, companyAddress: e.target.value }))}
              placeholder="e.g. 123 Business Avenue, City, Country"
              rows={2}
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-primary/40 transition-all font-semibold resize-none"
            />
            <p className="text-xs text-slate-400 dark:text-gray-500">Shown in official documents like Salary Slips and Attendance Reports.</p>
          </div>
        </div>

        {/* ── Brand assets ─────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-5">
          <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-brand-primary" /> Brand Assets
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <FileDropZone
                label="Company Logo" hint="PNG, SVG or WebP · 240×60 px recommended"
                accept="image/png,image/svg+xml,image/webp,image/jpeg"
                value={logoFile} onChange={setLogoFile} icon={ImageIcon} accentColor={p}
              />
              {settings.logoUrl && !logoFile && (
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 px-1 bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-gray-200">Current Logo:</span> 
                      <span className="truncate max-w-[120px]" style={{ color: p }}>
                        {settings.logoUrl.startsWith('data:') ? 'Base64 Image Active' : settings.logoUrl.split('/').pop()}
                      </span>
                    </div>
                    {(() => {
                      const finalLogoSrc = settings.logoUrl.startsWith('data:') ? settings.logoUrl : `${settings.logoUrl}?t=${Date.now()}`;
                      return (
                        <img 
                          src={finalLogoSrc} 
                          alt="Current Company Logo" 
                          className="h-12 w-auto object-contain rounded-lg border border-slate-200 dark:border-white/20 bg-white"
                          onError={(e) => { 
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('default-logo-placeholder.png')) {
                              target.src = '/default-logo-placeholder.png';
                            }
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <FileDropZone
                label="Favicon" hint=".ico or 32×32 PNG for the browser tab"
                accept="image/x-icon,image/png,image/ico"
                value={faviconFile} onChange={setFaviconFile} icon={Globe} accentColor={s}
              />
              {settings.faviconUrl && !faviconFile && (
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-gray-400 px-1 bg-slate-50 dark:bg-white/5 rounded-xl p-3 border border-slate-200 dark:border-white/10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      <span className="font-semibold text-slate-700 dark:text-gray-200">Current Favicon:</span> 
                      <span className="truncate max-w-[120px]" style={{ color: s }}>
                        {settings.faviconUrl.startsWith('data:') ? 'Base64 Favicon Active' : settings.faviconUrl.split('/').pop()}
                      </span>
                    </div>
                    {(() => {
                      const finalFavSrc = settings.faviconUrl.startsWith('data:') ? settings.faviconUrl : `${settings.faviconUrl}?t=${Date.now()}`;
                      return (
                        <img 
                          src={finalFavSrc} 
                          alt="Current Favicon" 
                          className="h-8 w-8 object-contain rounded-lg border border-slate-200 dark:border-white/20 bg-white"
                          onError={(e) => { 
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('default-logo-placeholder.png')) {
                              target.src = '/default-logo-placeholder.png';
                            }
                          }}
                        />
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Brand colors — dual picker ────────────────────────────────────────── */}
        <div className="bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl p-6 shadow-sm dark:shadow-2xl space-y-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Palette className="w-4 h-4 text-brand-primary" /> Brand Colors
            </h2>
            {/* gradient swatch */}
            <div
              className="h-6 w-32 rounded-full border border-white/10 shadow-sm"
              style={{ background: gradient }}
              title="Your brand gradient"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <ColorPickerPanel
              title="Brand Color 1"
              badge="Primary"
              colorKey="primaryColor"
              settings={settings}
              setSettings={setSettings}
            />
            <ColorPickerPanel
              title="Brand Color 2"
              badge="Secondary"
              colorKey="secondaryColor"
              settings={settings}
              setSettings={setSettings}
            />
          </div>

          {/* Live preview bar */}
          <div className="rounded-xl overflow-hidden border border-slate-200 dark:border-white/10">
            <div className="h-2 w-full transition-all duration-500" style={{ background: gradient }} />
            <div className="p-4 bg-slate-50 dark:bg-black/20 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white shadow-md bg-gradient-to-br from-brand-primary to-brand-secondary"
                  style={{ background: gradient, boxShadow: `0 4px 14px ${p}50` }}
                >
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-white">{settings.companyName || 'Your Company'}</p>
                  <p className="text-xs text-slate-500 dark:text-gray-400">Live gradient preview</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-brand-primary"
                  style={{ backgroundColor: p, boxShadow: `0 4px 12px ${p}50` }}
                >
                  Primary
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-brand-secondary"
                  style={{ backgroundColor: s, boxShadow: `0 4px 12px ${s}50` }}
                >
                  Secondary
                </button>
                <button
                  type="button"
                  className="px-4 py-1.5 rounded-lg text-white text-xs font-semibold bg-gradient-to-r from-brand-primary to-brand-secondary"
                  style={{ background: gradient }}
                >
                  Gradient
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Save bar ─────────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/10 rounded-2xl px-6 py-4 shadow-sm dark:shadow-2xl flex-wrap">
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Changes take effect immediately for all users after saving.
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => { setLogoFile(null); setFaviconFile(null); }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-gray-400 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-white/10 transition-all"
            >
              <RefreshCw className="w-4 h-4" /> Reset files
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all disabled:opacity-50 hover:opacity-90 active:scale-[0.98] bg-brand-primary shadow-lg shadow-brand-primary/50"
            >
              {saving
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> Saving…</>
                : <><Save className="w-4 h-4" /> Save Appearance</>
              }
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
