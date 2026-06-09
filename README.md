# HRM & Payroll Management Portal

A full-stack, comprehensive Human Resource Management and Payroll SaaS application built specifically for seamless employee tracking, automated payroll generation, and biometric hardware integration.

## 🏗️ Architecture Overview

The application is built on a modern, robust monolithic stack designed for maximum performance, SEO indexing, and type-safe database queries.

* **Frontend:** [Next.js 16](https://nextjs.org/) (App Router), React 19, Tailwind CSS 4.
* **Backend:** Next.js Route Handlers (Node.js).
* **Database:** MariaDB/MySQL manipulated via [Prisma ORM](https://www.prisma.io/).
* **Hardware Integration:** `zkteco-js` for real-time TCP/IP biometric device synchronization.
* **Authentication:** Custom JWT stateless authentication with advanced Role-Based Access Control (RBAC).

---

## 💻 Local Setup Instructions

### 1. Prerequisites
- **Node.js**: `v22+` recommended (must support Next.js 15+ constraints).
- **Package Manager**: `pnpm` (run `npm install -g pnpm` or `corepack enable pnpm`).
- **Database**: A running instance of MySQL or MariaDB.

### 2. Installation
Clone the repository and install the strict dependencies:

```bash
git clone <repository_url>
cd fap-hrm
pnpm install
```

### 3. Environment Variables
Copy the example environment file and fill in your local details:

```bash
cp .env.example .env
```

Ensure `DATABASE_URL` accurately points to your local MySQL instance.

### 4. Database Bootstrap
Initialize the database, push the schema, and seed the default admin account:

```bash
npm run db:bootstrap
```

> **Default Admin Credentials:**
> - **Email:** `admin@example.com`
> - **Password:** `admin123`

### 5. Running the Application
Start the Next.js development server alongside the background worker process:

```bash
npm run dev
```

The portal will be accessible at `http://localhost:3000`.

---

## 🗄️ Database Management & Migrations

Because the project uses Prisma ORM, your database schema is entirely managed by `prisma/schema.prisma`. 

### For Local Development (Rapid Prototyping)
When you make a change to `schema.prisma`, sync it to your local database using:
```bash
npx prisma db push
```

### For Production Deployments (Data Preservation)
> [!WARNING]
> Do **not** use `db push` on a live production database that holds critical employee data, as it can forcefully drop columns and cause data loss during schema conflicts.

Instead, generate a safe migration file before deploying:
```bash
npx prisma migrate dev --name describe_your_change
```
Then, on your production server during deployment, run:
```bash
npx prisma migrate deploy
```

---

## 🚀 Production Deployment (Docker / Coolify)

This application is containerized and optimized for platforms like Coolify or standalone Docker Swarms. It uses a strict `npm install --legacy-peer-deps` within an Alpine Linux container to guarantee Next.js and React 19 stability.

### Building the Image
```bash
docker build -t hrm-portal .
```

### Running the Container
Ensure you pass the required `DATABASE_URL` during runtime.
```bash
docker run -p 3000:3000 -e DATABASE_URL="mysql://user:pass@host:3306/db" hrm-portal
```

### Coolify Integration
If deploying via Coolify, simply connect the Git repository. The included `Dockerfile` and `entrypoint.sh` scripts are perfectly tailored to automatically:
1. Bypass React 19 version mismatches.
2. Synchronize the database schema.
3. Boot the Next.js production server alongside the ZKTeco background worker using PM2.
