export default function Loading() {
  return <div role="status" className="grid min-h-[50vh] place-content-center rounded-2xl border border-border bg-surface text-center">
    <p className="text-lg font-semibold text-foreground">Preparing replay...</p>
    <p className="mt-2 text-sm text-secondary">Loading the saved simulation run.</p>
  </div>;
}
