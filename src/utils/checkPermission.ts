import { prisma } from '@/lib/prisma';

// ─────────────────────────────────────────────────────────────────────────────
// SCHEMA TRUTH (verified against prisma/schema.prisma):
//
//  AttendanceLog  → FK: employeeId → User.id  | relation name: user
//  Leave          → FK: employeeId → User.id  | relation name: user
//  Task           → FK: assignedToId → User.id | relation name: assignedTo
//  User (Employee)→ scoped by id (Own) | departmentId (Department)
//  Payroll        → FK: employeeId → User.id  | relation name: user
//
//  Permissions priority (highest → lowest):
//    1. UserPermission.matrix  (per-user override)
//    2. Role.permissions[]     (merged; "All" > "Department" > "Own" > "No")
//    3. Designation.permissions (role-level baseline)
// ─────────────────────────────────────────────────────────────────────────────

/** Safely parse a value that may be a stringified JSON object or already an object */
function safeParseJson(val: any): Record<string, any> {
  if (!val) return {};
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return {}; }
  }
  if (typeof val === 'object') return val as Record<string, any>;
  return {};
}

/** Rank scopes so we can pick the most permissive one when merging roles */
function scopeRank(scope: string): number {
  const s = scope.toLowerCase().trim();
  if (s === 'all' || s === 'global') return 4;
  if (s === 'department') return 3;
  if (s === 'own' || s === 'enabled' || s === 'yes') return 2;
  return 0; // 'no' / empty
}

/** Extract the scope string for a specific action from a module permission object */
function extractScope(modPerms: Record<string, any>, action: string): string {
  const a = action.toLowerCase();
  let rawVal: any;

  if (a === 'read' || a === 'access' || a === 'view') {
    rawVal =
      modPerms.read  ?? modPerms.Read  ??
      modPerms.access ?? modPerms.Access ??
      modPerms.view  ?? modPerms.View;
  } else if (a === 'create') {
    rawVal = modPerms.create ?? modPerms.Create;
  } else if (a === 'edit') {
    rawVal = modPerms.edit ?? modPerms.Edit;
  } else if (a === 'delete') {
    rawVal = modPerms.delete ?? modPerms.Delete;
  }

  if (typeof rawVal === 'string') return rawVal.trim();
  if (rawVal === true) return 'Own';
  return 'No';
}

/** Find a module key case-insensitively from a permissions map */
function findModuleKey(perms: Record<string, any>, moduleName: string): string | undefined {
  return Object.keys(perms).find(k => k.toLowerCase() === moduleName.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// checkPermission — synchronous, works off session-user's cached permissions
// ─────────────────────────────────────────────────────────────────────────────
export const checkPermission = (user: any, moduleName: string, action: string = 'access'): boolean => {
  if (!user) return false;

  // 🚀 GOD MODE BYPASS FOR DEVELOPER
  if (user.email === 'dev@fixanyphoto.com') return true;

  // 👑 SUPER ADMIN BYPASS
  if (
    user.userType === 'SUPER_ADMIN' ||
    user.userType === 'ADMIN' ||
    String(user.designation?.name || user.designation || '').toLowerCase().includes('super admin')
  ) {
    return true;
  }

  const perms = safeParseJson(user.permissions);
  const key = findModuleKey(perms, moduleName);
  const modPerms = key ? perms[key] : {};

  const getScope = (val: any) => {
    if (typeof val === 'string') return val.toLowerCase().trim();
    if (val === true) return 'enabled';
    return 'no';
  };

  const accessScope = getScope(modPerms.access || modPerms.Access || modPerms.view || modPerms.read);
  const readScope   = getScope(modPerms.read   || modPerms.Read);
  const createScope = getScope(modPerms.create || modPerms.Create);
  const editScope   = getScope(modPerms.edit   || modPerms.Edit);
  const deleteScope = getScope(modPerms.delete || modPerms.Delete);

  const isAllowed = (scope: string) => ['enabled', 'own', 'all', 'department', 'true'].includes(scope);

  const a = action.toLowerCase();
  if ((a === 'access' || a === 'read' || a === 'view') && (isAllowed(accessScope) || isAllowed(readScope))) return true;
  if (a === 'create' && isAllowed(createScope)) return true;
  if (a === 'edit'   && isAllowed(editScope))   return true;
  if (a === 'delete' && isAllowed(deleteScope)) return true;

  return false;
};

// ─────────────────────────────────────────────────────────────────────────────
// getPermissionScopeSync — synchronous scope check from session user cache
// ─────────────────────────────────────────────────────────────────────────────
export const getPermissionScopeSync = (user: any, moduleName: string, action: string = 'read'): 'no' | 'own' | 'department' | 'all' => {
  if (!user) return 'no';

  if (user.email === 'dev@fixanyphoto.com') return 'all';

  if (
    user.userType === 'SUPER_ADMIN' ||
    user.userType === 'ADMIN' ||
    String(user.designation?.name || user.designation || '').toLowerCase().includes('super admin')
  ) {
    return 'all';
  }

  const perms = safeParseJson(user.permissions);
  const key = findModuleKey(perms, moduleName);
  const modPerms = key ? perms[key] : {};

  const raw = extractScope(modPerms, action);
  const lower = raw.toLowerCase().trim();

  if (lower === 'all' || lower === 'global') return 'all';
  if (lower === 'department') return 'department';
  if (lower === 'own' || lower === 'enabled' || lower === 'yes') return 'own';

  // Fallback: check 'access' field for read-type actions
  if (action.toLowerCase() === 'read' || action.toLowerCase() === 'view' || action.toLowerCase() === 'access') {
    const accessVal = (modPerms.access || modPerms.Access || '').toLowerCase().trim();
    if (accessVal === 'enabled' || accessVal === 'yes' || accessVal === 'own') return 'own';
    if (accessVal === 'all') return 'all';
    if (accessVal === 'department') return 'department';
  }
  return 'no';
};

// ─────────────────────────────────────────────────────────────────────────────
// getScopedWhereClause — BULLETPROOF async DB-driven permission scoping
//
// Permission resolution priority:
//   UserPermission.matrix (override) > Role.permissions (merged) > Designation.permissions
//
// Verified WHERE clause field names (from schema.prisma):
//   Employees  (User model)    own → { id: userId }           dept → { departmentId }
//   Tasks      (Task model)    own → { assignedToId: userId }  dept → { assignedTo: { departmentId } }
//   Attendance (AttendanceLog) own → { employeeId: userId }   dept → { user: { departmentId } }
//   Leaves     (Leave model)   own → { employeeId: userId }   dept → { user: { departmentId } }
//   Payroll    (Payroll model) own → { employeeId: userId }   dept → { user: { departmentId } }
// ─────────────────────────────────────────────────────────────────────────────
export const getScopedWhereClause = async (
  sessionUser: any,
  moduleName: string,
  action: 'read' | 'edit' | 'delete' | 'access' | 'view' | 'create' = 'read',
  _overrideEmployeeIdField?: string // kept for backward compat — no longer used
): Promise<Record<string, any>> => {

  // ── Step 1: Validate identity ─────────────────────────────────────────────
  const identityEmail = sessionUser?.email;
  const identityId    = sessionUser?.id;

  if (!identityEmail && !identityId) {
    console.error('🔒 [PERMISSION] DENIED — no email or id in session', sessionUser);
    return { id: 'ERR_NO_SESSION_IDENTITY' };
  }

  try {
    // ── Step 2: Fetch real DB user with ALL permission-bearing relations ──────
    const dbUser = await prisma.user.findUnique({
      where: identityEmail ? { email: identityEmail } : { id: identityId },
      include: {
        customDesignation: true,    // Designation.permissions — baseline RBAC matrix
        roles:             true,    // Role[].permissions      — role-based overrides
        userPermission:    true,    // UserPermission.matrix   — per-user overrides (highest priority)
      } as any
    });

    if (!dbUser) {
      console.error(`🔒 [PERMISSION] DENIED — user not found in DB (email=${identityEmail}, id=${identityId})`);
      return { id: 'ERR_USER_NOT_FOUND_IN_DB' };
    }

    // ── Step 3: Admin / God-mode bypass ──────────────────────────────────────
    const userType     = String(dbUser.userType || '').toLowerCase();
    const designName   = String((dbUser as any).customDesignation?.name || '').toLowerCase();
    const hasAdminRole = (dbUser as any).roles?.some((r: any) =>
      ['admin', 'super admin', 'superadmin'].includes((r.name || '').toLowerCase().trim())
    );

    const isGlobalAdmin =
      userType === 'super_admin' ||
      userType === 'admin'       ||
      hasAdminRole               ||
      designName.includes('super admin') ||
      dbUser.email === 'dev@fixanyphoto.com';

    if (isGlobalAdmin) {
      console.log(`✅ [PERMISSION] ${dbUser.email} → Module: ${moduleName} | Level: ALL (admin bypass)`);
      return {}; // unrestricted
    }

    // ── Step 4: Build merged permissions (Designation → Roles → UserOverride) ─
    let mergedPerms: Record<string, any> = {};

    // 4a. Baseline: Designation permissions
    if ((dbUser as any).customDesignation?.permissions) {
      const dPerms = safeParseJson((dbUser as any).customDesignation.permissions);
      mergedPerms = { ...mergedPerms, ...dPerms };
    }

    // 4b. Role permissions — merge; most permissive scope wins per module per action
    if ((dbUser as any).roles?.length) {
      for (const role of (dbUser as any).roles) {
        const rPerms = safeParseJson(role.permissions);
        for (const [modKey, modVal] of Object.entries(rPerms)) {
          if (!mergedPerms[modKey]) {
            mergedPerms[modKey] = modVal;
          } else {
            const existing = mergedPerms[modKey] as Record<string, any>;
            const incoming = modVal as Record<string, any>;
            const merged: Record<string, any> = { ...existing };
            for (const [aKey, aVal] of Object.entries(incoming)) {
              const existingRank = scopeRank(String(existing[aKey] || 'No'));
              const incomingRank = scopeRank(String(aVal || 'No'));
              if (incomingRank > existingRank) merged[aKey] = aVal;
            }
            mergedPerms[modKey] = merged;
          }
        }
      }
    }

    // 4c. Per-user override: UserPermission.matrix (highest priority)
    if ((dbUser as any).userPermission?.matrix) {
      const uPerms = safeParseJson((dbUser as any).userPermission.matrix);
      mergedPerms = { ...mergedPerms, ...uPerms };
    }

    // ── Step 5: Resolve this module's permission level ────────────────────────
    const modKey   = findModuleKey(mergedPerms, moduleName);
    const modPerms = modKey ? mergedPerms[modKey] : {};

    const rawScope   = extractScope(modPerms, action);
    const levelLower = rawScope.toLowerCase().trim();

    console.log(
      `🛡️ [PERMISSION] User: ${dbUser.email} | Module: ${moduleName} | Action: ${action} | ` +
      `Level: "${rawScope}" | DeptId: ${dbUser.departmentId || 'none'}`
    );

    // ── Step 6: Return WHERE clause based on scope ────────────────────────────
    const mod = moduleName.toLowerCase();

    // Global access — no restrictions
    if (levelLower === 'all' || levelLower === 'global' || levelLower === 'enabled') {
      return {};
    }

    // Department scope
    if (levelLower === 'department') {
      if (!dbUser.departmentId) {
        console.warn(
          `⚠️ [PERMISSION] User ${dbUser.email} has Department scope for ${moduleName} ` +
          `but has no departmentId assigned!`
        );
        return { id: 'ERR_NO_DEPT_ASSIGNED_TO_USER' };
      }

      switch (mod) {
        case 'employees':
        case 'team':
          // User model — filter directly by departmentId
          return { departmentId: dbUser.departmentId };

        case 'announcements':
        case 'announcement':
          return {
            OR: [
              { targetType: 'GLOBAL' },
              { targetType: 'DEPARTMENT', targetDepartment: dbUser.department || '' }
            ]
          };

        case 'tasks':
          // Task model — filter via assignedTo (User) relation
          return { assignedTo: { departmentId: dbUser.departmentId } };

        case 'attendance':
          // AttendanceLog model — filter via user (User) relation
          return { user: { departmentId: dbUser.departmentId } };

        case 'leaves':
        case 'leave':
          // Leave model — filter via user (User) relation
          return { user: { departmentId: dbUser.departmentId } };

        case 'payroll':
        case 'payrolls':
          // Payroll model — filter via user (User) relation
          return { user: { departmentId: dbUser.departmentId } };

        default:
          console.warn(
            `⚠️ [PERMISSION] Unknown module "${moduleName}" for Department scope — ` +
            `using generic user.departmentId filter`
          );
          return { user: { departmentId: dbUser.departmentId } };
      }
    }

    // Own scope — default for all non-admin users
    if (levelLower === 'own' || levelLower === 'yes') {
      switch (mod) {
        case 'employees':
        case 'team':
          // User model — own record
          return { id: dbUser.id };

        case 'announcements':
        case 'announcement':
          return {
            OR: [
              { targetType: 'GLOBAL' },
              { targetType: 'DEPARTMENT', targetDepartment: dbUser.department || '' },
              { targetType: 'INDIVIDUAL', targetUserId: dbUser.id }
            ]
          };

        case 'tasks':
          // Task model — own assigned tasks (FK: assignedToId)
          return { assignedToId: dbUser.id };

        case 'attendance':
          // AttendanceLog model — own logs (FK: employeeId)
          return { employeeId: dbUser.id };

        case 'leaves':
        case 'leave':
          // Leave model — own leaves (FK: employeeId)
          return { employeeId: dbUser.id };

        case 'payroll':
        case 'payrolls':
          // Payroll model — own payrolls (FK: employeeId)
          return { employeeId: dbUser.id };

        default:
          console.warn(
            `⚠️ [PERMISSION] Unknown module "${moduleName}" for Own scope — ` +
            `using generic employeeId filter`
          );
          return { employeeId: dbUser.id };
      }
    }

    // No permission — return impossible condition so query returns 0 rows safely
    console.warn(
      `🚫 [PERMISSION] User ${dbUser.email} has NO permission for ${moduleName}:${action} — blocking query`
    );
    return { id: 'ERR_PERMISSION_DENIED_NO_ACCESS' };

  } catch (error: any) {
    console.error('🔥 [PERMISSION] CRITICAL ERROR in getScopedWhereClause:', error?.message || error);
    console.error('🔥 [PERMISSION] Stack:', error?.stack);
    return { id: 'ERR_TRY_CATCH_FAILURE' };
  }
};
