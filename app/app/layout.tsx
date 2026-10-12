import { redirect } from "next/navigation";
import { getStore } from "@/lib/data";
import { SyncManager } from "@/components/shell/sync-manager";
import { TabBar } from "@/components/shell/tab-bar";
import { TopBar } from "@/components/shell/top-bar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const store = getStore();
  const actor = await store.getActor();
  if (!actor) {
    if (store.mode === "supabase" && (await store.getUser())) redirect("/onboarding");
    redirect("/comptoir");
  }
  const stats = await store.getStats(actor);
  return (
    <div className="min-h-dvh pb-28">
      <TopBar restaurantName={actor.restaurant.name} operatorName={actor.displayName} />
      <SyncManager restaurantName={actor.restaurant.name} />
      <div className="mx-auto max-w-md px-4">{children}</div>
      <TabBar openDisputes={stats.open_disputes} />
    </div>
  );
}
