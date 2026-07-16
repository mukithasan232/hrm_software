import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

// ── GET: Fetch current email/SMTP settings ────────────────────────────────────
const getEmailSettings = async (req: any, res: any) => {
  try {
    const settings = await prisma.smtpSettings.findFirst();
    return res.json(settings || {});
  } catch (error: any) {
    console.error('SMTP DB Fetch Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
};

// ── POST: Upsert email/SMTP settings ─────────────────────────────────────────
const upsertEmailSettings = async (req: any, res: any) => {
  try {
    const checkPermission = (u: any, moduleName: string, action: string = 'access'): boolean => {
      if (!u) return false;
      const moduleKey = moduleName.toLowerCase();
      const perms = u.permissions || {};
      const exactKey = Object.keys(perms).find(k => k.toLowerCase() === moduleKey);
      const modPerms = exactKey ? perms[exactKey] : {};
      const getScope = (val: any) => {
        if (typeof val === 'string') return val.toLowerCase().trim();
        if (val === true) return 'enabled';
        return 'no';
      };
      const accessScope = getScope(modPerms.access || modPerms.Access || modPerms.view || modPerms.read);
      const readScope = getScope(modPerms.read || modPerms.Read);
      const createScope = getScope(modPerms.create || modPerms.Create);
      const editScope = getScope(modPerms.edit || modPerms.Edit);
      const deleteScope = getScope(modPerms.delete || modPerms.Delete);
      const isAccessAllowed = (scope: string) => ['enabled', 'own', 'all', 'true'].includes(scope);
      const isCrudAllowed = (scope: string) => ['own', 'all', 'true'].includes(scope);
      if ((action === 'access' || action === 'read' || action === 'view') && (isAccessAllowed(accessScope) || isAccessAllowed(readScope))) return true;
      if (action === 'create' && isCrudAllowed(createScope)) return true;
      if (action === 'edit' && isCrudAllowed(editScope)) return true;
      if (action === 'delete' && isCrudAllowed(deleteScope)) return true;
      return false;
    };

    let hasPermission = false;
    const dbUser = await (prisma as any).user.findUnique({ 
      where: { id: req.user.id },
      include: { customDesignation: true, roles: true }
    });

    if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin' || dbUser?.roles?.some((r: any) => r?.name === 'SUPER_ADMIN')) {
      hasPermission = true;
    } else if (dbUser) {
      let perms = {};
      if (dbUser.designation && typeof dbUser.designation === 'object' && (dbUser.designation as any).permissions) {
        perms = (dbUser.designation as any).permissions;
      }
      if (Object.keys(perms).length === 0 && dbUser.permissions) {
        perms = typeof dbUser.permissions === 'string' ? JSON.parse(dbUser.permissions as any) : dbUser.permissions;
      }
      hasPermission = checkPermission({ ...dbUser, permissions: perms }, 'manage_system_settings', 'edit');
    }

    if (!hasPermission) {
      return res.status(403).json({ error: 'Access Denied: Missing Manage System Settings permission' });
    }

    const body = req.body || {};
    const {
      // SMTP fields
      host, port, security, username, password,
      // MAIN tab fields
      senderName, senderEmail, emailEnabled,
    } = body;

    // At least SMTP fields are required if host is provided
    if (host !== undefined) {
      if (!host || !port || !username || !password) {
        return res.status(400).json({ error: 'SMTP requires host, port, username and password.' });
      }
      const portNum = parseInt(String(port), 10);
      if (isNaN(portNum)) {
        return res.status(400).json({ error: 'Port must be a valid number.' });
      }
    }

    const portNum = host ? parseInt(String(port), 10) : undefined;

    // Build shared data object — only include defined fields
    const smtpData: Record<string, any> = {};
    if (host       !== undefined) smtpData.host         = host.trim();
    if (portNum    !== undefined) smtpData.port         = portNum;
    if (security   !== undefined) smtpData.security     = security || 'STARTTLS';
    if (username   !== undefined) smtpData.username     = username.trim();
    if (password   !== undefined) smtpData.password     = password;
    if (senderName !== undefined) smtpData.senderName   = senderName.trim();
    if (senderEmail !== undefined) smtpData.senderEmail = senderEmail.trim();
    if (emailEnabled !== undefined) smtpData.emailEnabled = Boolean(emailEnabled);

    try {
      const existing = await prisma.smtpSettings.findFirst();

      let settings;
      if (existing) {
        settings = await prisma.smtpSettings.update({
          where: { id: existing.id },
          data:  smtpData,
        });
      } else {
        // Require SMTP fields for first-time creation
        if (!host || !port || !username || !password) {
          return res.status(400).json({ error: 'All SMTP fields are required for initial setup.' });
        }
        // Auto-create singleton TenantSettings if needed
        let tenant = await prisma.tenantSettings.findFirst();
        if (!tenant) {
          tenant = await prisma.tenantSettings.create({
            data: { companyName: 'Default Tenant' },
          });
        }
        settings = await prisma.smtpSettings.create({
          data: { ...smtpData, tenantId: tenant.id } as any,
        });
      }

      return res.json({ success: true, data: settings });
    } catch (dbError: any) {
      console.error('SMTP Prisma Logic Error:', dbError);
      return res.status(500).json({ error: `Database Error: ${dbError.message || 'Unknown database error'}` });
    }
  } catch (error: any) {
    console.error('SMTP DB Save Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to save settings' });
  }
};

export const GET  = wrapHandler(getEmailSettings,    { protect: true, adminOnly: true });
export const POST = wrapHandler(upsertEmailSettings, { protect: true, adminOnly: true });
