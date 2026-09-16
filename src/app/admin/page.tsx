import { AdminGate } from "@/components/admin/AdminGate";
import { LeadsDashboard } from "@/components/admin/LeadsDashboard";

export const metadata = { title: "Admin — Stardom Admissions" };

export default function AdminPage() {
  return (
    <main className="flex-1 bg-(--color-paper-dim)">
      <AdminGate>
        <LeadsDashboard />
      </AdminGate>
    </main>
  );
}
