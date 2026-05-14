import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect the root page to our login page
  redirect('/login');
}
