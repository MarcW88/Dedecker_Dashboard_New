import { useState, useMemo } from 'react';

function posStyle(val) {
  if (val === null || val === undefined || isNaN(Number(val))) return 'bg-stone-100 text-stone-400';
  const n = Number(val);
  if (n <= 3) return 'bg-green-100 text-green-700';
  if (n <= 10) return 'bg-lime-100 text-lime-700';
  if (n <= 20) return 'bg-yellow-50 text-yellow-600';
  if (n <= 50) return 'bg-orange-50 text-orange-500';
  return 'bg-red-50 text-red-400';
}

export default function KeywordTable({ data, compMap }) {
  const [search, setSearch] = useState('');
  const [filterBucket, setFilterBucket] = useState('All');
  const [filterAI, setFilterAI] = useState('All');
  const [filterCat, setFilterCat] = useState('All');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const categories = useMemo(() => ['All', ...new Set(data.map((r) => r.category).filter(Boolean))].sort(), [data]);
  const allComp = useMemo(() => [
    ...(compMap.default || []),
    ...Object.entries(compMap).filter(([k]) => k !== 'default').flatMap(([, v]) => v),
  ].filter((v, i, a) => a.indexOf(v) === i), [compMap]);

  const filtered = useMemo(() => {
    let rows = data;
    if (search) rows = rows.filter((r) => r.keyword.toLowerCase().includes(search.toLowerCase()));
    if (filterBucket !== 'All') rows = rows.filter((r) => r.position_bucket === filterBucket);
    if (filterCat !== 'All') rows = rows.filter((r) => r.category === filterCat);
    if (filterAI === 'With AI Overview') rows = rows.filter((r) => r.has_ai);
    else if (filterAI === 'DeDecker in AI') rows = rows.filter((r) => r.dedecker_in_ai);
    else if (filterAI === 'AI Gap') rows = rows.filter((r) => r.has_ai && !r.dedecker_in_ai);
    return rows.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  }, [data, search, filterBucket, filterAI, filterCat]);

  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const csvDownload = () => {
    const headers = ['keyword', 'volume', 'category', 'pos_dedecker', ...allComp, 'has_ai', 'dedecker_in_ai'];
    const rows = [headers.join(','), ...filtered.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'dedecker_keywords.csv'; a.click();
  };

  return (
    <div className="mb-6">
      <div className="flex flex-wrap gap-2 mb-3 items-center justify-between">
        <h3 className="text-sm font-semibold text-dedecker-dark">Keyword Explorer</h3>
        <button onClick={csvDownload} className="text-xs bg-taupe-dark text-white px-3 py-1.5 rounded-lg hover:opacity-90">
          Export CSV
        </button>
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          type="text" placeholder="Search keyword..." value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-taupe w-48"
        />
        {[
          { label: 'Position', value: filterBucket, set: (v) => { setFilterBucket(v); setPage(0); }, opts: ['All', 'Top 3', '4-10', '11-20', '20+', 'Not ranked'] },
          { label: 'Category', value: filterCat, set: (v) => { setFilterCat(v); setPage(0); }, opts: categories },
          { label: 'AI', value: filterAI, set: (v) => { setFilterAI(v); setPage(0); }, opts: ['All', 'With AI Overview', 'DeDecker in AI', 'AI Gap'] },
        ].map((f) => (
          <select key={f.label} value={f.value} onChange={(e) => f.set(e.target.value)}
            className="border border-stone-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-taupe bg-white">
            {f.opts.map((o) => <option key={o}>{o}</option>)}
          </select>
        ))}
        <span className="text-xs text-stone-400 self-center">{filtered.length} keywords</span>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100 bg-stone-50">
              {['Keyword', 'Vol', 'Category', 'DeDecker', ...allComp, 'AI', 'In AI'].map((h) => (
                <th key={h} className="text-left py-2.5 px-3 text-stone-500 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((r, i) => (
              <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                <td className="py-2 px-3 font-medium max-w-[200px] truncate">{r.keyword}</td>
                <td className="py-2 px-3">{(r.volume || 0).toLocaleString()}</td>
                <td className="py-2 px-3 text-stone-500">{r.category}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${posStyle(r.pos_dedecker)}`}>
                    {r.pos_dedecker ?? '—'}
                  </span>
                </td>
                {allComp.map((c) => (
                  <td key={c} className="py-2 px-3">
                    <span className={`px-2 py-0.5 rounded text-xs ${posStyle(r[c])}`}>
                      {r[c] ?? '—'}
                    </span>
                  </td>
                ))}
                <td className="py-2 px-3">
                  {r.has_ai ? <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" title="AI Overview" /> : '—'}
                </td>
                <td className="py-2 px-3">
                  {r.dedecker_in_ai ? <span className="text-green-600 font-medium">✓</span> : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex gap-2 mt-3 items-center justify-end text-xs text-stone-500">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50">← Prev</button>
          <span>Page {page + 1} / {totalPages}</span>
          <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page === totalPages - 1} className="px-3 py-1.5 border border-stone-200 rounded-lg disabled:opacity-40 hover:bg-stone-50">Next →</button>
        </div>
      )}
    </div>
  );
}
