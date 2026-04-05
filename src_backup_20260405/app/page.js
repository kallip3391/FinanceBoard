import { redirect } from 'next/navigation';

export default function Home() {
  // Redirect main page to the dashboard (holdings) page
  redirect('/holdings');
}
