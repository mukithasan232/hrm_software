# UI/UX Boilerplate Export

This folder contains a clean, extracted version of the Dashboard layout and UI/UX components. All business logic, API calls, and domain-specific state have been removed.

## Setup Instructions

1. **Create a new Next.js project:**
   ```bash
   npx create-next-app@latest my-app
   cd my-app
   ```

2. **Install required dependencies:**
   ```bash
   npm install lucide-react next-themes clsx tailwind-merge
   npm install -D tailwindcss @tailwindcss/typography
   ```

3. **Copy the exported files:**
   - Copy everything from `components/` to your project's `components/` folder (or `src/components/`).
   - Copy `styles/globals.css` and replace your project's `app/globals.css` (or `src/app/globals.css`).
   - Copy `config/tailwind.config.ts` to your project's root folder (if using Tailwind v3, otherwise it's just available for reference).

4. **Integrate the Layout:**
   - In your `app/layout.tsx`, wrap the body content with the `ThemeProvider`:
     ```tsx
     import { ThemeProvider } from '@/components/ThemeProvider';
     
     // ...
     
     <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
       {children}
     </ThemeProvider>
     ```
   - In your Dashboard route layout (e.g., `app/(dashboard)/layout.tsx`), use the exported `DashboardLayout`:
     ```tsx
     import DashboardLayout from '@/components/layout';
     
     export default function Layout({ children }: { children: React.ReactNode }) {
       return <DashboardLayout>{children}</DashboardLayout>;
     }
     ```

5. **Customize:**
   - Update the dummy links in `Sidebar.tsx` to match your application's routes.
   - Customize the theme colors in `globals.css` or `tailwind.config.ts`.
