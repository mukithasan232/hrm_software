# 🚀 HRM System - Enterprise Human Resource Management System

![Next.js](https://img.shields.io/badge/Next.js-15+-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?style=for-the-badge&logo=prisma)
![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)
![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)

Welcome to the **HRM System**, a comprehensive, highly scalable, and white-label SaaS-ready Human Resource Management application. Designed for modern enterprises, it streamlines organizational operations, automates attendance via hardware integration, manages payroll processing, evaluates performance, and orchestrates tasks seamlessly.

---

## ✨ Key Features & Modules

### ⏱️ Advanced Attendance & Time Tracking
- **Hardware Integration**: Real-time biometric attendance syncing via ZKTeco devices (`node-zklib` & `zkteco-js`).
- **Geolocation & Remote Work**: Location tracking (Latitude/Longitude/Address) for remote check-ins.
- **Smart Logs**: Automatic calculation of Overtime (OT), Early Leaves, and Missing Check-outs.

### 👥 Comprehensive Employee Management
- **Centralized Directory**: Detailed employee profiles, document management, and social links.
- **Shift Management**: Support for In-house, Remote, and Hybrid shifts with customizable lunch/snack breaks.
- **Hierarchical Structure**: Organize employees by Departments and dynamically linked Designations.

### 🔐 Dynamic Role-Based Access Control (RBAC)
- **Granular Permissions**: Advanced JSON-based permission matrices for designations and individual users.
- **Custom Leave Configurations**: Specify weekend days and leave allocations per designation.

### 🌴 Automated Leave Management
- **Multi-Type Leaves**: Manage Sick, Casual, Annual, and Emergency leaves.
- **Approval Workflow**: Multi-level leave requests with file attachments and real-time status updates.

### 💰 Payroll & Compensation
- **Automated Processing**: Generate monthly payrolls based on present/absent days, base salary, and approved overtime.

### 📈 Performance Evaluation
- **Metrics Tracking**: Task scores, manager ratings, and punctuality assessments.
- **Employee of the Month (EOTM)**: Recognize top performers easily via the built-in rating system.

### ✅ Intelligent Task Management
- **Custom Views**: Switch between Kanban boards and List views.
- **Collaboration**: File attachments, embedded comments, priority tags, and status tracking (Todo, In Progress, Pending, Completed).

### 🤖 AI Assistant & System Integrations
- **Built-in AI Assistant**: Integrated AI (powered by Google / OpenAI) for HR-related queries and assistance.
- **Real-Time Communications**: Websocket integration (Socket.io) for live notifications and updates.
- **Email Delivery**: Custom SMTP configuration with dynamic HTML email templates for welcome emails, leave updates, and alerts.

### 🎨 White-Label SaaS & Customization
- **Tenant Settings**: Brand the portal with custom company names, logos, favicons, and primary/secondary color schemes.
- **Dark Mode & Localization**: Built-in support for multiple themes and languages.

---

## 🛠️ Technology Stack

### Frontend Architecture
- **Framework**: [Next.js (App Router)](https://nextjs.org/) & React 19
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **UI Components**: Shadcn/ui & Radix UI (Headless components)
- **State Management**: Zustand
- **Data Fetching**: SWR
- **Charts & Reports**: Recharts & jsPDF/exceljs for data export

### Backend Architecture
- **Core Environment**: Node.js & Express (Custom Server wrapper for background workers)
- **Database & ORM**: MySQL / MariaDB via [Prisma](https://www.prisma.io/)
- **Real-time Engine**: Socket.io
- **Background Jobs**: Node-cron (Scheduled ZKTeco syncs & maintenance tasks)
- **Authentication**: Custom JWT / bcryptjs flow

---

## 🚀 Local Setup & Installation

Follow these steps to get the project running on your local development machine.

### 1. Clone the Repository
```bash
git clone https://github.com/mukithasan232/hrm_software.git
cd hrm_software
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file and configure your local settings:
```bash
cp .env.example .env
```
Ensure the following key variables are set:
- `DATABASE_URL`: Your MySQL/MariaDB connection string.
- `NEXT_PUBLIC_APP_URL`: Base URL for the application.
- Authentication secrets and SMTP credentials.

### 4. Database Setup & Seeding
Generate the Prisma client and push the schema to your local database:
```bash
npx prisma generate
npm run db:push
```
To bootstrap the application with required initial data (Admins, default Roles):
```bash
npm run db:seed
```

### 5. Start Development Server
Boot up the custom Node.js server along with the Next.js frontend and background workers:
```bash
npm run dev
```
The application will be accessible at `http://localhost:3000`.

---

## 🌐 Production Deployment

For deploying to production environments (VPS, AWS, Vercel/Render for Next.js combined with a custom Node server for workers):

1. **Build the Application:**
   ```bash
   npm run build
   ```
   *This compiles the Next.js application, generates the Prisma client, and transpiles background worker scripts.*

2. **Start the Production Server:**
   ```bash
   npm run start
   ```
   *This command runs the custom server (`server.cjs`), boots background workers (like `zk-sync-worker.js`), and serves the frontend securely.*

*(Note: If utilizing Docker, refer to the provided `Dockerfile` and `docker-compose.yml` in the repository.)*

---
*Developed & Maintained by the HRM System Core Team.*
