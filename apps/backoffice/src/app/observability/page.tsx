export default function ObservabilityPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Observability</h1>
      <p className="mt-2 text-sm text-[var(--brand-taupe)]">
        Health dos serviços fundamentais (strangler). Em produção ligar a
        métricas/tracing.
      </p>
      <ul className="mt-6 space-y-2 text-sm">
        {[
          "gateway",
          "identity",
          "accounts",
          "marketplace",
          "catalog",
          "orders",
          "payments",
          "wallet",
          "billing",
        ].map((svc) => (
          <li
            key={svc}
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-3"
          >
            <span className="font-mono text-[13px]">{svc}</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
              skeleton / monolith
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
