import { AdminGate } from "@/components/admin/AdminGate";
import { LeadDetail } from "@/components/admin/LeadDetail";

export default async function AdminLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="flex-1 bg-(--color-paper-dim)">
      <AdminGate>
        <LeadDetail id={id} />
      </AdminGate>
    </main>
  );
}
