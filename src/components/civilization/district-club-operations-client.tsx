type Operations = { districtName: string; checkedAt: string;
  metrics: Record<string, number>; disclosure: string };

export function DistrictClubOperationsClient({ data }: { data: Operations }) {
  const friendly = (text: string) => text.replaceAll(/([A-Z])/g, " $1").toLowerCase();
  return <section className="rounded-2xl border border-border bg-surface p-5 sm:p-7">
    <h2 className="font-display text-xl font-semibold text-foreground">Club operations dashboard</h2>
    <p className="mt-2 text-sm text-secondary">{data.districtName} · updated {new Date(data.checkedAt).toLocaleString()}</p>
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Object.entries(data.metrics).map(([key, value]) => <div key={key}
        className="rounded-xl border border-border bg-background p-4">
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="mt-1 text-xs leading-5 text-secondary">{friendly(key)}</p>
      </div>)}
    </div>
    <p className="mt-3 text-xs leading-6 text-secondary">{data.disclosure}</p>
  </section>;
}
