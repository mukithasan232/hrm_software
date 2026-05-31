# 🚀 CI/CD Pipeline Setup Guide

## Overview

This project uses **GitHub Actions** for fully automated deployments:

| Push To | Web | Mobile |
|---------|-----|--------|
| `main` branch | ✅ SSH deploy → Hostinger VPS | ✅ EAS OTA → **production** channel |
| `preview` branch | ❌ (web only on `main`) | ✅ EAS OTA → **preview** channel |
| `v*.*.*` tag | ❌ | ✅ Full native EAS build |
| Manual trigger | ✅ `workflow_dispatch` | ✅ `workflow_dispatch` (with build option) |

```
git push origin main
      │
      ├─► Job 1: TypeScript Check + Lint (gate)
      │
      ├─► Job 2: SSH → Hostinger VPS
      │           git pull → pnpm install → prisma generate → next build → pm2 restart
      │
      └─► Job 3: Expo EAS OTA Update
                  npm ci → eas update --branch production
```

---

## 🔐 GitHub Secrets Setup

Go to your repository on GitHub:
**Settings → Secrets and variables → Actions → New repository secret**

### Web Deployment (Hostinger VPS)

| Secret Name | Value | Where to find it |
|---|---|---|
| `HOSTINGER_HOST` | Your VPS IP address | Hostinger Control Panel → VPS → Details |
| `HOSTINGER_USERNAME` | SSH username (e.g. `root`) | Hostinger → VPS → SSH Access |
| `HOSTINGER_PASSWORD` | SSH password | Hostinger → VPS → SSH Access |
| `HOSTINGER_PORT` | SSH port (usually `22`) | Hostinger → VPS → SSH Access |

> **🔒 Recommended:** Use SSH key-based auth instead of password.
> See [SSH Key Setup](#-ssh-key-based-auth-recommended) below.

### Mobile OTA (Expo EAS)

| Secret Name | Value | Where to find it |
|---|---|---|
| `EXPO_TOKEN` | Expo personal access token | See [Expo Token Setup](#-expo-token-setup) below |

---

## 🔑 Expo Token Setup

1. Go to **[expo.dev](https://expo.dev)**
2. Click your profile avatar → **Account Settings**
3. Navigate to **Access Tokens** (left sidebar)
4. Click **Create Token** → give it a name like `github-actions-hrm`
5. Copy the token immediately (it's shown only once)
6. Add it to GitHub Secrets as `EXPO_TOKEN`

---

## 📱 EAS One-Time Initialization (do this once locally)

EAS OTA updates require your project to be registered with Expo's servers.

```bash
# 1. Install EAS CLI
npm install -g eas-cli

# 2. Log in to Expo
eas login

# 3. Navigate to the mobile app
cd hrm_mobile/hrm-mobile

# 4. Initialize EAS for this project (creates/links a project on expo.dev)
eas init

# 5. Create the update channels
eas channel:create production
eas channel:create preview

# 6. Link channels to branches
eas branch:create production
eas branch:create preview

# 7. Update eas.json with your project ID (shown after eas init)
# Replace YOUR_PROJECT_ID in eas.json with the actual UUID from expo.dev
```

After running `eas init`, update `app.json` to add the `extra.eas.projectId` field:

```json
{
  "expo": {
    "name": "hrm-mobile",
    "slug": "hrm-mobile",
    "extra": {
      "eas": {
        "projectId": "YOUR_PROJECT_UUID_HERE"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/YOUR_PROJECT_UUID_HERE"
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

---

## 🔒 SSH Key-Based Auth (Recommended)

Password auth in CI/CD is less secure. Use key-based auth instead:

```bash
# 1. Generate an ED25519 key pair locally
ssh-keygen -t ed25519 -C "github-actions-hrm" -f ~/.ssh/hrm_deploy_key

# 2. Copy the PUBLIC key to your VPS
ssh-copy-id -i ~/.ssh/hrm_deploy_key.pub user@YOUR_VPS_IP

# 3. Add the PRIVATE key as a GitHub Secret
cat ~/.ssh/hrm_deploy_key
# Copy the output → GitHub Secrets → HOSTINGER_SSH_KEY
```

Then in `deploy.yml`, replace:
```yaml
password: ${{ secrets.HOSTINGER_PASSWORD }}
```
with:
```yaml
key: ${{ secrets.HOSTINGER_SSH_KEY }}
```

---

## ⚙️ VPS Prerequisites

Make sure your Hostinger VPS has these installed before the first deploy:

```bash
# On your VPS via SSH:

# 1. Node.js 20 (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
nvm install 20 && nvm use 20

# 2. pnpm
npm install -g pnpm

# 3. PM2 (process manager)
npm install -g pm2

# 4. Clone the repo (first time only)
cd ~
git clone https://github.com/YOUR_ORG/YOUR_REPO.git hrm_software

# 5. Set up environment variables
cp hrm_software/.env.example hrm_software/.env
nano hrm_software/.env   # Add DATABASE_URL, JWT_SECRET, etc.

# 6. Start the server with PM2
cd hrm_software
npm run build            # First build
pm2 start server.js --name hrm-server
pm2 save                 # Auto-restart on reboot
pm2 startup              # Generate startup script
```

---

## 📁 File Locations

| File | Purpose |
|---|---|
| `hrm_software/.github/workflows/deploy.yml` | Main CI/CD pipeline (web + mobile OTA) |
| `hrm_mobile/hrm-mobile/.github/workflows/mobile-cicd.yml` | Standalone mobile pipeline |
| `hrm_mobile/hrm-mobile/eas.json` | EAS build profiles configuration |

---

## 🔁 Workflow Reference

### Trigger a Web-Only Deploy
```bash
git push origin main
```

### Trigger a Mobile OTA to Preview
```bash
git push origin preview
```

### Trigger a Full Native Build (tag release)
```bash
git tag v1.2.0
git push origin v1.2.0
```

### Trigger Manually (GitHub UI)
Go to **Actions → 🚀 CI/CD — Web Deploy + Mobile OTA → Run workflow**

---

## 🐛 Troubleshooting

| Error | Fix |
|---|---|
| `Permission denied (publickey)` | Add public key to VPS `~/.ssh/authorized_keys` |
| `eas: command not found` | The `expo-github-action` installs it — check `EXPO_TOKEN` is set |
| `Cannot find project directory` | Update the `cd` path in `deploy.yml` to match your VPS folder structure |
| `PM2 not found` | Run `npm install -g pm2` on the VPS |
| OTA update not appearing | Make sure `runtimeVersion` in `app.json` matches the installed app build |
| `EXPO_TOKEN invalid` | Regenerate token at expo.dev — tokens can expire |
