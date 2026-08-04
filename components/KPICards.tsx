import { Row } from '@/lib/types';

function KPIDelta({ cur, prev, lowerIsBetter }: { cur: number; prev: number; lowerIsBetter?: boolean }) {
  const diff = cur - prev;
  if (Number.isNaN(diff)) return null;
  if (diff === 0) return <span className="text-[10px] text-stone-400 ml-1">=</span>;
  const good = lowerIsBetter ? diff < 0 : diff > 0;
  const sign = diff > 0 ? '▲' : '▼';
  return <span className={`text-[10px] ml-1 ${good ? 'text-green-600' : 'text-red-400'}`}>{sign}{Math.abs(diff).toFixed(1).replace(/\.0$/, '')}</span>;
}

export default function KPICards({ data, fromDate, toDate }: { data: Row[]; fromDate?: string; toDate?: string }) {
  const compare = fromDate !== toDate && fromDate != null && toDate != null;

  const total = data.length;
  const totalVolume = data.reduce((s, r) => s + (r.volume || 0), 0);
  const ranked = data.filter((r) => r.pos_dedecker !== null && r.pos_dedecker !== undefined).length;
  const top10 = data.filter((r) => r.pos_dedecker != null && r.pos_dedecker <= 10).length;
  const top3 = data.filter((r) => r.pos_dedecker != null && r.pos_dedecker <= 3).length;
  const avgPos = ranked
    ? (data.reduce((s, r) => s + (r.pos_dedecker != null ? r.pos_dedecker : 100), 0) / total).toFixed(1)
    : 'N/A';
  const aiTotal = data.filter((r) => r.has_ai).length;
  const aiPct = total ? ((aiTotal / total) * 100).toFixed(0) : '0';
  const inAi = data.filter((r) => r.dedecker_in_ai).length;
  const inAiPct = aiTotal ? ((inAi / aiTotal) * 100).toFixed(0) : '0';

  const prevRanked = data.filter((r) => r.pos_prev !== null && r.pos_prev !== undefined).length;
  const prevTop10 = data.filter((r) => r.pos_prev != null && r.pos_prev <= 10).length;
  const prevTop3 = data.filter((r) => r.pos_prev != null && r.pos_prev <= 3).length;
  const prevAvgPos = prevRanked
    ? (data.reduce((s, r) => s + (r.pos_prev != null ? r.pos_prev : 100), 0) / total).toFixed(1)
    : 'N/A';
  const prevAiTotal = data.filter((r) => r.has_ai_prev).length;
  const prevAiPct = total ? ((prevAiTotal / total) * 100).toFixed(0) : '0';
  const prevInAi = data.filter((r) => r.dedecker_in_ai_prev).length;
  const prevInAiPct = prevAiTotal ? ((prevInAi / prevAiTotal) * 100).toFixed(0) : '0';

  const cards = [
    { label: 'Total Volume', value: totalVolume.toLocaleString() },
    { label: 'Keywords', value: total },
    { label: 'Ranked', value: `${ranked}`, sub: `${((ranked / total) * 100).toFixed(0)}%`, delta: compare ? <KPIDelta cur={ranked} prev={prevRanked} /> : null },
    { label: 'Top 10', value: `${top10}`, sub: `${top3} in top 3`, delta: compare ? <KPIDelta cur={top10} prev={prevTop10} /> : null },
    { label: 'Avg Position', value: avgPos, delta: compare && prevAvgPos !== 'N/A' ? <KPIDelta cur={Number(avgPos)} prev={Number(prevAvgPos)} lowerIsBetter /> : null },
    { label: 'AI Overview', value: `${aiPct}%`, sub: `${aiTotal} keywords`, delta: compare ? <KPIDelta cur={Number(aiPct)} prev={Number(prevAiPct)} /> : null },
    { label: 'DeDecker in AI', value: `${inAiPct}%`, sub: `${inAi} citations`, delta: compare ? <KPIDelta cur={Number(inAiPct)} prev={Number(prevInAiPct)} /> : null },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-stone-500 font-medium uppercase tracking-wide">{c.label}</p>
          <p className="text-2xl font-semibold text-dedecker-dark mt-1">
            {c.value}
            {c.delta}
          </p>
          {c.sub && <p className="text-xs text-stone-400 mt-0.5">{c.sub}</p>}
        </div>
      ))}
    </div>
  );
}
