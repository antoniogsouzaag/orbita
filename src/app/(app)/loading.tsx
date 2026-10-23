export default function Loading() {
  return <div role="status" aria-label="Carregando página" className="mx-auto max-w-6xl space-y-6 px-4 pt-24 sm:px-6">
    <div className="loading-shimmer h-8 w-48 rounded-xl" />
    <div className="loading-shimmer h-4 w-72 max-w-full rounded-lg" />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="card h-48 space-y-5 p-5"><div className="loading-shimmer h-4 w-28 rounded" /><div className="loading-shimmer h-16 rounded-xl" /><div className="loading-shimmer h-3 w-2/3 rounded" /></div>)}
    </div>
    <span className="sr-only">Preparando seu espaço…</span>
  </div>;
}
