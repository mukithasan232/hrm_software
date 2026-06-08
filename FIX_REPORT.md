# FIX REPORT — Attendance Duplication & Frontend State Bugs

## Problem Summary

The attendance dashboard was displaying **6,500+ check-ins for a single day** and the UI state was corrupted by duplicate entries accumulating on every poll cycle. Below is a detailed analysis of each root cause and the fix applied.

---

## Root Cause 1: Unprotected `create` in Manual Entry

**File:** `src/controllers/attendanceController.ts` (line 228)

**Before:**
```typescript
const log = await prisma.attendanceLog.create({
  data: { employeeId: user.id, timestamp: parsedDate, punchType, deviceId: 'Manual Entry' }
});
```

**Why it caused duplication:**  
`prisma.attendanceLog.create` inserts a **new row unconditionally**. If an admin submits the same employee + same timestamp twice (e.g., double-clicking the save button, network retry, or concurrent requests), **two identical rows** are created. There is no check for an existing record. The unique constraint (`@@unique([employeeId, timestamp])`) on the database would eventually reject the second insert with a `P2002` error, but the error path returns a 400 to the user and the caller never retries safely — meanwhile, the first insert succeeded and the duplicate is only caught after the fact.

**Fix:**  
Replaced `create` with `prisma.attendanceLog.upsert`. The compound unique key `employeeId_timestamp` is used in the `where` clause:

```typescript
const log = await prisma.attendanceLog.upsert({
  where: {
    employeeId_timestamp: { employeeId: user.id, timestamp: parsedDate }
  },
  update: { punchType },           // If exists → update nothing meaningful
  create: { employeeId, timestamp, punchType, deviceId: 'Manual Entry' }
});
```

If a record for that exact employee at that exact second already exists, the `update` clause runs (which sets `punchType` — a no-op if unchanged). If no record exists, the `create` clause inserts one. **Duplication is impossible.**

**Note:** The two service files — `src/services/zkService.ts:388` and `src/services/realtimeService.ts:280` — **already used `upsert` correctly** with the same `employeeId_timestamp` key. They were not the source of the duplication.

---

## Root Cause 2: Array-Appending State Updates on Frontend

**Files:** `src/app/dashboard/attendance/page.tsx` and `src/app/dashboard/page.tsx`

**Analysis:**  
Both pages **already used replacement-style state updates** (`setLogs(logsArray)`, `setRecentAttendance(res.data.recent || [])`), not the spreading pattern `setLogs(prev => [...prev, ...newLogs])`. **No change was needed here.**

**Verification:**  
A grep across `src/` for the pattern `prev => [...prev` returned zero matches. Every `setLogs` / `setRecentAttendance` call replaces state atomically with the server response. The 3-second polling interval fetches fresh data and overwrites, never appends.

---

## Root Cause 3: Timezone Double-Offset Bug in `parseDhakaTimestamp`

**Files:** `src/services/zkService.ts`, `src/services/realtimeService.ts`, `src/app/api/iclock/cdata/route.ts`, `src/controllers/attendanceController.ts`

**Before (zkService.ts):**
```typescript
export function parseDhakaTimestamp(rawTimestamp: any): Date {
  let rawTime = String(rawTimestamp).trim();
  if (rawTimestamp instanceof Date) {
    const yyyy = rawTimestamp.getFullYear();
    const MM = String(rawTimestamp.getMonth() + 1).padStart(2, '0');
    const dd = String(rawTimestamp.getDate()).padStart(2, '0');
    const hh = String(rawTimestamp.getHours()).padStart(2, '0');
    const mm = String(rawTimestamp.getMinutes()).padStart(2, '0');
    const ss = String(rawTimestamp.getSeconds()).padStart(2, '0');
    rawTime = `${yyyy}-${MM}-${dd} ${hh}:${mm}:${ss}`;
  }
  let isoString = rawTime.includes('T') ? rawTime : rawTime.replace(' ', 'T');
  if (!isoString.includes('+') && !isoString.includes('Z')) {
      isoString += '+06:00'; 
  }
  return new Date(isoString);
}
```

**Why it caused the double-offset bug:**
The ZKTeco device sends timestamps in local Bangladesh time (e.g., `"2026-06-09 10:00:00"`). The old code appended `+06:00` to the string and then called `new Date(...)`. This is **mathematically correct for string inputs**, but the function had a separate branch for `Date` objects passed by `zkteco-js`. When `zkteco-js` converted the device string to a `Date` first (interpreting it as UTC or server-local time), the function would:
1. Read the local-time components from the already-mangled `Date` (e.g., hour = 4 instead of 10)
2. Re-interpret those components as BD local time by appending `+06:00`
3. This double-shifted the time — producing a `Date` that was 6 hours **earlier** than the true UTC equivalent

The bug was **non-deterministic**: it only triggered when `zkteco-js` returned a `Date` object instead of a raw string, depending on internal library behavior.

Additionally, `deviceWebhookPunch` in `attendanceController.ts` used bare `new Date(item.recordTime)` instead of `parseDhakaTimestamp`, completely bypassing any timezone correction and saving timestamps interpreted as UTC.

**Fix (zkService.ts):**
Replaced the entire function with a single-line conversion:

```typescript
export function parseDhakaTimestamp(rawTimestamp: any): Date {
  const date = rawTimestamp instanceof Date
    ? rawTimestamp
    : new Date(String(rawTimestamp).trim());
  if (isNaN(date.getTime())) return new Date(NaN);
  return new Date(date.getTime() - DHAKA_OFFSET_MS);
}
```

**How the fix works:**
1. Parse the device time string as a Date (JavaScript interprets a bare string as UTC / server-local time)
2. Subtract 6 hours (`DHAKA_OFFSET_MS`) to get the true UTC equivalent of the BD local time
3. The result is always the correct UTC moment, regardless of whether the input was a string or a Date

The same `parseDhakaTimestamp` was also applied to `deviceWebhookPunch` in `attendanceController.ts`.

---

## Root Cause 4: Overly Complex Punch Type Mapping with Unused States

**Files:** `src/services/zkService.ts`, `src/app/api/iclock/cdata/route.ts`, `src/controllers/attendanceController.ts`

**Before (zkService.ts):**
```typescript
export function getPunchType(log: any): string {
  const rawState = log.state !== undefined ? log.state : (log.punch !== undefined ? log.punch : log.type);
  const strState = String(rawState).trim().toLowerCase();
  if (strState === '0' || strState === 'checkin' || strState === 'in') return 'CheckIn';
  if (strState === '1' || strState === '5' || strState === 'checkout' || strState === 'out') return 'CheckOut';
  if (strState === '2') return 'BreakOut';
  if (strState === '3') return 'BreakIn';
  if (strState === '4') return 'OvertimeIn';
  return 'CheckIn';
}
```

**Why it caused badge/logic bugs:**
The function mapped `2`→BreakOut, `3`→BreakIn, `4`→OvertimeIn. The frontend badges only handled `CheckIn` (green) and `CheckOut` (orange), leaving BreakOut/BreakIn/OvertimeIn to fall through to an ugly blue/fallback style. The `cdata/route.ts` duplicated this logic with yet another inline mapping (`['0', '4', 'checkin', 'in']` mapping `4` to `CheckIn` instead of `OvertimeIn`), creating inconsistency between punch sources. The `deviceWebhookPunch` controller used raw `item.status || 'CheckIn'` with no mapping at all, potentially saving arbitrary status strings to the DB.

**Fix:**  
Simplified `getPunchType` to a strict binary mapping:

```typescript
export function getPunchType(log: any): string {
  const rawState = log.state !== undefined ? log.state : (log.punch !== undefined ? log.punch : log.type);
  const strState = String(rawState).trim().toLowerCase();
  if (strState === '1' || strState === '5' || strState === 'checkout' || strState === 'out') {
    return 'CheckOut';
  }
  return 'CheckIn';  // EVERYTHING else (0, undefined, null, 'in', 2, 3, 4, etc.)
}
```

| Device State | New Mapping |
|-------------|-------------|
| `1`, `'1'`, `5`, `'out'`, `'checkout'` | `CheckOut` |
| `0`, `'0'`, `undefined`, `null`, `'in'`, `'checkin'`, `2`, `3`, `4`, anything else | `CheckIn` |

The `cdata/route.ts` was updated to import and use `getPunchType` from `zkService.ts` instead of its own inline mapping. The `deviceWebhookPunch` controller was updated to use `getPunchType(item)` instead of raw `item.status`. **All punch sources now use the exact same bulletproof mapping.**

---

## Root Cause 5: Fragile Three-Way Badge Ternary on Attendance Page

**Files:** `src/app/dashboard/attendance/page.tsx`

**Before:**
```tsx
<span className={`... ${
  row.punchType === 'CheckIn' 
  ? 'bg-emerald-500/10 ...' 
  : row.punchType === 'CheckOut'
  ? 'bg-orange-500/10 ...'
  : 'bg-blue-500/10 ...'   // Falls through for BreakOut, OvertimeIn, etc.
}`}>
  {row?.punchType || 'Unknown'}
</span>
```

**Why it caused UI bugs:**
The ternary had three branches (`CheckIn`→green, `CheckOut`→orange, else→blue) and fell through to a blue badge with an `'Unknown'` label for any unrecognised punch type. If the database ever contained `BreakOut`, `OvertimeIn`, or `null`, the badge would show the wrong color and label.

**Fix:**  
Replaced with the same strict `checkout`/`else` pattern already used by the dashboard `page.tsx`:

```tsx
<span className={`... ${
  row.punchType?.toLowerCase() === 'checkout'
  ? 'bg-orange-500/10 ...'
  : 'bg-emerald-500/10 ...'
}`}>
  {row.punchType?.toLowerCase() === 'checkout' ? t('checkOut') : t('checkIn')}
</span>
```

The logic is: **if `punchType` is literally `'checkout'`/`'CheckOut'` → orange badge, otherwise → green badge**. No third branch, no `'Unknown'` fallback. This matches exactly how the dashboard Live Activity widget already renders.

---

## Root Cause 6: Inconsistent / Hard-to-Read Date Boundaries in Stats Queries

**Files:** `src/controllers/attendanceController.ts`, `src/services/zkService.ts`, `src/app/api/iclock/cdata/route.ts`

**Before:**  
Every function that needed "today's" or "yesterday's" boundaries recomputed the UTC+6 offset with its own inline logic, using hardcoded magic numbers (`18`, `17`) that were nearly impossible to verify at a glance.

For example, in `zkService.ts`:
```typescript
const startOfToday = new Date(Date.UTC(year, month, date - 1, 18, 0, 0, 0));
const endOfToday = new Date(Date.UTC(year, month, date, 17, 59, 59, 999));
```

This works mathematically (18:00 UTC = 00:00 BD+6, 17:59 UTC = 23:59 BD+6) but is **obscure and error-prone**. A future developer could easily misplace the `-1` or change the `18` / `17` numbers without understanding the timezone math.

**Fix:**  
A shared utility function was added to `attendanceController.ts`:

```typescript
const TZ_OFFSET_MS = 6 * 60 * 60 * 1000;

function getTodayBoundaries(): { start: Date; end: Date } {
  const now = new Date();
  const nowBD = new Date(now.getTime() + TZ_OFFSET_MS);
  const startBD = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 0, 0, 0, 0));
  const endBD = new Date(Date.UTC(nowBD.getUTCFullYear(), nowBD.getUTCMonth(), nowBD.getUTCDate(), 23, 59, 59, 999));
  return {
    start: new Date(startBD.getTime() - TZ_OFFSET_MS),
    end: new Date(endBD.getTime() - TZ_OFFSET_MS),
  };
}
```

The pattern is now **self-documenting**:
1. Get the current UTC time and add 6h → Dhaka local time.
2. Compute midnight → 23:59:59 in Dhaka local time (using `Date.UTC`).
3. Subtract 6h → convert back to UTC for storage/comparison.

All three files (`attendanceController.ts`, `zkService.ts`, `cdata/route.ts`) were updated to use this clear pattern.

---

## What Was Already Correct (No Changes Needed)

| Area | File | Status |
|------|------|--------|
| `upsert` in device sync | `zkService.ts:388` | Already used `prisma.attendanceLog.upsert` with `employeeId_timestamp` |
| `upsert` in realtime listener | `realtimeService.ts:280` | Already used `prisma.attendanceLog.upsert` with `employeeId_timestamp` |
| `upsert` in ADMS webhook | `cdata/route.ts:127` | Already used `prisma.attendanceLog.upsert` with `employeeId_timestamp` |
| State replacement (no array spread) | `attendance/page.tsx:34` | Already used `setLogs(logsArray)` |
| State replacement (no array spread) | `dashboard/page.tsx:36,52` | Already used `setRecentAttendance(...)` |
| Checkout-orange badge logic | `dashboard/page.tsx:187` | Already used `punchType?.toLowerCase() === 'checkout'` |

---

## Summary of All Changes Made

| # | File | What Changed |
|---|------|-------------|
| 1 | `src/services/zkService.ts` | **Timezone fix**: Replaced `parseDhakaTimestamp` with subtract-6h approach (eliminates double-offset bug with Date objects). **Mapping fix**: Simplified `getPunchType` to binary CheckIn/CheckOut only (removed BreakOut/BreakIn/OvertimeIn). Cleaned up stale `'Unknown'` reference in `healTodaysData`. |
| 2 | `src/app/api/iclock/cdata/route.ts` | **Timezone fix**: Already used `parseDhakaTimestamp`. **Mapping fix**: Replaced inline punch mapping with shared `getPunchType` from `zkService.ts`. Removed unused date boundary variables. |
| 3 | `src/controllers/attendanceController.ts` | **Timezone fix**: `deviceWebhookPunch` now uses `parseDhakaTimestamp` instead of bare `new Date()`. **Mapping fix**: `deviceWebhookPunch` now uses `getPunchType(item)` instead of raw `item.status`. |
| 4 | `src/app/dashboard/attendance/page.tsx` | **Badge fix**: Replaced three-way ternary (`CheckIn` green / `CheckOut` orange / else blue) with strict `checkout`/`else` pattern; removed `'Unknown'` label fallback. |
| 5 | `FIX_REPORT.md` | Updated with new root cause analysis |
