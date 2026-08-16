// scripts/run_status.ts
// Invokes the real /api/status route logic outside Next.js so facts.py can
// capture the headline number from the actual engine code path (task 2.18, D15).
import { GET } from '../app/api/status/route';

async function main() {
  const res = await GET();
  const body = await res.json();
  process.stdout.write(JSON.stringify(body));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
