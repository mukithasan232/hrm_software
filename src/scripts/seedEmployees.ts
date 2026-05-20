import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';

// ─── Seed Data ────────────────────────────────────────────────────────────────

const departments = ['Engineering', 'Finance', 'Operations', 'Sales', 'Marketing', 'HR', 'Product'];

const executiveDesignations = [
  'Software Engineer', 'Business Analyst', 'Financial Analyst',
  'Operations Executive', 'Sales Executive', 'Marketing Executive',
  'Product Executive', 'QA Engineer', 'Data Analyst', 'DevOps Engineer',
];

const managerDesignations = [
  'Engineering Manager', 'Finance Manager', 'Operations Manager',
  'Sales Manager', 'Marketing Manager',
];

const firstNames = [
  'Aiden', 'Bella', 'Carlos', 'Diana', 'Ethan', 'Fatima', 'George', 'Hina',
  'Ivan', 'Julia', 'Kevin', 'Layla', 'Marcus', 'Nina', 'Omar', 'Priya',
  'Quinn', 'Rachel', 'Sam', 'Tanya', 'Umar', 'Vera', 'Will', 'Xia',
  'Yusuf', 'Zara', 'Alex', 'Brooke', 'Chris', 'Dana',
];

const lastNames = [
  'Khan', 'Smith', 'Rodriguez', 'Wang', 'Johnson', 'Ali', 'Brown', 'Malik',
  'Lee', 'Patel', 'Davis', 'Hussain', 'Miller', 'Ahmed', 'Wilson', 'Sharma',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris',
  'Martin', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Lewis', 'Walker',
];

const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomSalary = (min: number, max: number) =>
  Math.round((Math.random() * (max - min) + min) / 1000) * 1000;

// ─── Build Employee List ───────────────────────────────────────────────────────

interface EmployeeSeed {
  employeeId: string;
  name: string;
  email: string;
  password: string;
  role: any;
  department: string;
  designation: string;
  baseSalary: number;
  joiningDate: Date;
}

const buildEmployees = async (): Promise<EmployeeSeed[]> => {
  const hashed = await bcrypt.hash('password123', 10);
  const employees: EmployeeSeed[] = [];
  let idx = 1;

  const make = (
    role: string,
    department: string,
    designation: string,
    salaryMin: number,
    salaryMax: number,
    n: number,
  ) => {
    for (let i = 0; i < n; i++, idx++) {
      const firstName = firstNames[idx - 1] ?? `Emp${idx}`;
      const lastName = lastNames[idx - 1] ?? 'User';
      const name = `${firstName} ${lastName}`;
      employees.push({
        employeeId: `EMP${String(idx).padStart(3, '0')}`,
        name,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hrm.test`,
        password: hashed,
        role: role as any,
        department,
        designation,
        baseSalary: getRandomSalary(salaryMin, salaryMax),
        joiningDate: new Date(
          Date.now() - Math.random() * 3 * 365 * 24 * 60 * 60 * 1000, // up to 3 yrs ago
        ),
      });
    }
  };

  // 1 Admin
  make('Admin', 'HR', 'System Administrator', 120000, 150000, 1);
  // 2 HRs
  make('HR', 'HR', 'HR Manager', 80000, 100000, 2);
  // 5 Managers (one per designation)
  for (let i = 0; i < 5; i++, idx++) {
    const firstName = firstNames[idx - 1] ?? `Mgr${idx}`;
    const lastName = lastNames[idx - 1] ?? 'User';
    const name = `${firstName} ${lastName}`;
    employees.push({
      employeeId: `EMP${String(idx).padStart(3, '0')}`,
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hrm.test`,
      password: hashed,
      role: 'Manager' as any,
      department: departments[i],
      designation: managerDesignations[i],
      baseSalary: getRandomSalary(90000, 120000),
      joiningDate: new Date(Date.now() - Math.random() * 3 * 365 * 24 * 60 * 60 * 1000),
    });
  }
  // 22 Executives
  for (let i = 0; i < 22; i++, idx++) {
    const firstName = firstNames[idx - 1] ?? `Exec${idx}`;
    const lastName = lastNames[idx - 1] ?? 'User';
    const name = `${firstName} ${lastName}`;
    employees.push({
      employeeId: `EMP${String(idx).padStart(3, '0')}`,
      name,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@hrm.test`,
      password: hashed,
      role: 'Executive' as any,
      department: getRandomItem(departments),
      designation: getRandomItem(executiveDesignations),
      baseSalary: getRandomSalary(50000, 80000),
      joiningDate: new Date(Date.now() - Math.random() * 3 * 365 * 24 * 60 * 60 * 1000),
    });
  }

  return employees;
};

// ─── Main ─────────────────────────────────────────────────────────────────────

const seed = async () => {
  try {
    console.log('🔌  Connecting to Database via Prisma…');
    await prisma.$connect();
    console.log('✅  Connected.\n');

    // Wipe existing seed data
    const deleted = await prisma.user.deleteMany({});
    console.log(`🗑   Cleared ${deleted.count} existing user(s).\n`);

    const employees = await buildEmployees();
    await prisma.user.createMany({
      data: employees
    });

    console.log('🌱  Seeded 30 employees:');
    console.log('   • 1  Admin  (EMP001) — aiden.khan@hrm.test');
    console.log('   • 2  HRs   (EMP002–EMP003)');
    console.log('   • 5  Managers (EMP004–EMP008)');
    console.log('   • 22 Executives (EMP009–EMP030)');
    console.log('\n🔑  Universal password: password123');
    console.log('\n✔   Done!\n');

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  }
};

seed();

