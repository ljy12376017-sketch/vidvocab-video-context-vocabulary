import { SearchExperience } from "@/components/SearchExperience";
import { missingSecrets } from "@/lib/env";

export default function HomePage() {
  const missingPlaceholders = missingSecrets();

  return (
    <main className="min-h-screen">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-[#ff6b4a]/25 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[#2ec4b6]/25 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-64 w-64 rounded-full bg-[#ffd166]/30 blur-3xl" />
      </div>
      <SearchExperience missingPlaceholders={missingPlaceholders} />
    </main>
  );
}
