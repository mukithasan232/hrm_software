# 🚀 Fix Any Photo - HRM System

Welcome to the **Fix Any Photo - HRM (Human Resource Management) System**. This is a comprehensive, scalable, and highly customizable SaaS-ready HR application built to streamline operations, track attendance, manage payroll, evaluate performance, and orchestrate tasks within the organization.

---

## ✨ Key Features

- **📊 Dashboard Analytics**: Comprehensive overview of HR metrics, attendance trends, and real-time updates.
- **⏱️ Real-time Attendance & Punches**: Biometric hardware integration (ZKTeco), manual punch handling, overtime calculation, early leave, and missing out detection.
- **🌴 Leave Management**: Configurable leave policies (Sick, Casual, Annual, Emergency), multi-level approvals, and attachments.
- **👥 Employee Management**: Centralized employee directory, detailed profiles, remote/in-house shift allocation, and document management.
- **💰 Payroll Processing**: Automated calculations based on present/absent days, base salary, overtime, and deductions.
- **🔐 Granular RBAC (Role-Based Access Control)**: Dynamic designation-based permissions and highly customizable user-role matrices.
- **📈 Performance Management**: Task scores, manager ratings, punctuality metrics, and Employee of the Month (EOTM) tracking.
- **✅ Task Management**: Todo/Kanban views, task prioritization, file attachments, and integrated comments.
- **🏢 Organizational Structure**: Departments, shifts, and team hierarchies.
- **📢 Announcements & Notifications**: Global, departmental, or individual announcements with in-app and email notifications.
- **🤖 AI Assistant Integration**: Built-in AI chat assistant powered by Google/OpenAI for quick HR queries.
- **🎨 White-Label & Customization**: Dynamic tenant branding (logo, primary/secondary colors) and dark mode support.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js (v16+)](https://nextjs.org/) & React 19
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: Radix UI (via Shadcn/ui - inferred), Lucide React (Icons)
- **State Management**: Zustand
- **Data Fetching**: SWR

### Backend
- **Core Environment**: Node.js & Express (Custom Server)
- **Database ORM**: [Prisma](https://www.prisma.io/)
- **Database**: MySQL / MariaDB
- **Real-time Communication**: Socket.io
- **Background Jobs**: Node-cron (Scheduled tasks & workers)
- **Hardware Integration**: `zkteco-js` & `node-zklib` for biometric synchronization

---

## 📂 Project Structure

```text
├── .github/                # GitHub Actions & CI/CD workflows
├── prisma/                 # Database models and migrations
│   └── schema.prisma       # Prisma Database schema
├── public/                 # Static assets (images, fonts, etc.)
├── scripts/                # Utility scripts (e.g., fetch ZKTeco users)
├── src/
│   └── app/                # Next.js App Router root
│       ├── (auth)/         # Authentication routes
│       ├── (dashboard)/    # Main Application Views
│       │   ├── admin/      # Administrator controls
│       │   ├── attendance/ # Attendance logs and punch syncing
│       │   ├── dashboard/  # Main analytics widgets
│       │   ├── employees/  # Employee directory & profiles
│       │   ├── leaves/     # Leave requests & approvals
│       │   ├── payroll/    # Salary & payroll processing
│       │   ├── performance/# Performance reviews & ratings
│       │   ├── reports/    # Generated HR reports
│       │   ├── settings/   # Tenant, system & AI settings
│       │   ├── tasks/      # Task boards & assignments
│       │   └── team/       # Departments and designations
│       └── api/            # Next.js API Routes
├── workers/                # Background sync workers (e.g., ZK Sync)
├── server.cjs              # Custom Express/Node server entry point
├── package.json            # Project dependencies & scripts
├── next.config.ts          # Next.js configuration
└── tailwind.config.ts      # Tailwind CSS configuration
```

---

## 🚀 Local Setup & Installation

Follow these steps to get the project running on your local machine.

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd hrm_software
```

### 2. Install Dependencies

Since the project uses a `package-lock.json`, use `npm` to install packages:

```bash
npm install
```

### 3. Setup Environment Variables

Copy the example environment file and configure your local settings:

```bash
cp .env.example .env
```
Make sure to provide the necessary keys inside `.env`, especially:
- `DATABASE_URL` (Your MySQL/MariaDB connection string)
- SMTP credentials for email notifications
- Authentication secrets

### 4. Setup Prisma & Database

Generate the Prisma client and push the schema to your local database:

```bash
npx prisma generate
npm run db:push
```
*(Optional)* If you need to seed initial admin data:
```bash
npm run db:seed
```

### 5. Run the Development Server

Start the custom server and Next.js frontend:

```bash
npm run dev
```

Your application should now be running at `http://localhost:3000` (or the port specified in your `.env`).

---

## 🌐 Deployment Guide

To deploy the application for production:

1. **Build the application:**
   ```bash
   npm run build
   ```
   *This command generates the Prisma client, builds the Next.js app, and compiles the worker scripts.*

2. **Start the production server:**
   ```bash
   npm run start
   ```
   *This automatically runs any pending DB schema pushes (with caution in production), starts the background ZK-sync workers, and boots up the main custom server.*

For containerized deployments, a `Dockerfile` and `docker-compose.yml` are included in the root directory.

---
*Maintained by the Fix Any Photo Core Team.*
