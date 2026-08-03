export default function KPICards({ data }) {
  const total = data.length;
  const totalVolume = data.reduce((s, r) => s + (r.volume || 0), 0);
  const ranked = data.filter((r) => r.pos_dedecker !== null && r.pos_dedecker !== undefined).length;
  const top10 = data.filter((r) => r.pos_dedecker <= 10).length;
  const top3 = data.filter((r) => r.pos_dedecker <= 3).length;
  const avgPos = ranked
    ? (data.reduce((s, r) => s + (r.pos_dedecker != null ? r.pos_dedecker : 100), 0) / total).toFixed(1)
    : 'N/A';
  const aiTotal = data.filter((r) => r.has_ai).length;
  const aiPct = total ? ((aiTotal / total) * 100).toFixed(0) : 0;
  const inAi = data.filter((r) => r.dedecker_in_ai).length;
  const inAiPct = aiTotal ? ((inAi / aiTotal) * 100).toFixed(0) : 0;

  const cards = [
    { label: 'Total Volume', value: totalVolume.toLocaleString() },
    { label: 'Keywords', value: total },
    { label: 'Ranked', value: `${ranked}`, sub: `${((ranked / total) * 100).toFixed(0)}%` },
    { label: 'Top 10', value: `${top10}`, sub: `${top3} in top 3` },
    { label: 'Avg Position', value: avgPos },
    { label: 'AI Overview', value: `${aiPct}%`, sub: `${aiTotal} keywords` },
    { label: 'DeDecker in AI', value: `${inAiPct}%`, sub: `${inAi} citations` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{c.label}</p>
          <p className="text-2xl font-semibold text-dedecker-dark mt-1">{c.value}</p>
          {c.sub && <p className="text-xs text-stone-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
