// app/page.tsx
// Routing index. Redirects to /mission for users starting fresh.
// Also surfaces direct links to /mission and /judge for the judge's itinerary.
//
// This is a server component: no client-side state needed here.

import { redirect } from 'next/navigation';

// The canonical entry point is /mission. A direct visit to / redirects there.
// The judge's itinerary (task 3.3) deep-links to /judge directly.
export default function RootPage() {
  redirect('/mission');
}
