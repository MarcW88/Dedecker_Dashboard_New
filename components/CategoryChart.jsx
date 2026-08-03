import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const BUCKET_COLORS = {
  'Top 3': '#8B7355',
  '4-10': '#B8A99A',
  '11-20': '#D4C4B5',
  '20+': '#E5DDD4',
  'Not ranked': '#c9a59a',
};
const BUCKETS = ['Top 3', '4-10', '11-20', '20+', 'Not ranked'];

export default function CategoryChart({ data }) {
  const catMap = {};
  for (const row of data) {
    const cat = row.category || 'Other';
    if (!catMap[cat]) catMap[cat] = { category: cat, 'Top 3': 0, '4-10': 0, '11-20': 0, '20+': 0, 'Not ranked': 0, total: 0 };
    catMap[cat][row.position_bucket] = (catMap[cat][row.position_bucket] || 0) + 1;
    catMap[cat].total += 1;
  }

  const chartData = Object.values(catMap).sort((a, b) => b.total - a.total);

  const tableData = chartData.map((c) => ({
    Category: c.category,
    Keywords: c.total,
    Volume: data.filter((r) => r.category === c.category).reduce((s, r) => s + (r.volume || 0), 0),
    'Top 10': (c['Top 3'] || 0) + (c['4-10'] || 0),
    'Not Ranked': c['Not ranked'] || 0,
    'Avg Pos': (() => {
      const rows = data.filter((r) => r.category === c.category);
      const avg = rows.reduce((s, r) => s + (r.pos_dedecker != null ? r.pos_dedecker : 100), 0) / rows.length;
      return avg.toFixed(1);
    })(),
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-dedecker-dark mb-3">Position Distribution by Category</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
            <XAxis dataKey="category" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {BUCKETS.map((b) => (
              <Bar key={b} dataKey={b} stackId="a" fill={BUCKET_COLORS[b]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm overflow-auto">
        <h3 className="text-sm font-semibold text-dedecker-dark mb-3">Category Summary</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-stone-100">
              {['Category', 'Keywords', 'Volume', 'Top 10', 'Avg Pos', 'Not Ranked'].map((h) => (
                <th key={h} className="text-left py-2 px-1 text-stone-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.sort((a, b) => b.Volume - a.Volume).map((row, i) => (
              <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                <td className="py-1.5 px-1 font-medium">{row.Category}</td>
                <td className="py-1.5 px-1">{row.Keywords}</td>
                <td className="py-1.5 px-1">{row.Volume.toLocaleString()}</td>
                <td className="py-1.5 px-1">{row['Top 10']}</td>
                <td className="py-1.5 px-1">{row['Avg Pos']}</td>
                <td className="py-1.5 px-1">{row['Not Ranked']}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
