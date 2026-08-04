import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface DonutChartProps { title: string; data: { name: string; value: number }[]; colors: string[]; }
interface Row { keyword: string; volume?: number; category?: string; has_ai?: boolean; dedecker_in_ai?: boolean; pos_dedecker?: number | null; [key: string]: unknown; }

function DonutChart({ title, data, colors }: DonutChartProps) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
      <h4 className="text-xs text-stone-500 font-medium mb-1">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value">
            {data.map((_, i) => <Cell key={i} fill={colors[i]} />)}
          </Pie>
          <Tooltip formatter={(v) => [v, '']} />
          <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function AIOverviewChart({ data, fromDate, toDate }: { data: Row[]; fromDate?: string; toDate?: string }) {
  const total = data.length;
  const withAI = data.filter((r: Row) => r.has_ai).length;
  const withoutAI = total - withAI;
  const inAI = data.filter((r: Row) => r.dedecker_in_ai).length;
  const notInAI = withAI - inAI;

  const aiKeywords = data
    .filter((r: Row) => r.has_ai)
    .sort((a: Row, b: Row) => (b.volume || 0) - (a.volume || 0))
    .slice(0, 50);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-dedecker-dark mb-3">AI Overview Analysis</h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DonutChart
          title={`AI Overview — ${withAI} / ${total} keywords`}
          data={[
            { name: 'With AI Overview', value: withAI },
            { name: 'Without', value: withoutAI },
          ]}
          colors={['#8B7355', '#e5e0db']}
        />
        <DonutChart
          title={`DeDecker in AI — ${inAI} citations`}
          data={[
            { name: 'DeDecker Cited', value: inAI },
            { name: 'Not Cited', value: Math.max(0, notInAI) },
          ]}
          colors={['#8B7355', '#c9a59a']}
        />
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm overflow-auto">
          <h4 className="text-xs text-stone-500 font-medium mb-2">Top AI Keywords</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                {['Keyword', 'Vol', 'Pos', 'In AI'].map((h) => (
                  <th key={h} className="text-left py-1.5 px-1 text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {aiKeywords.map((r: Row, i: number) => (
                <tr key={i} className="border-b border-stone-50 hover:bg-stone-50">
                  <td className="py-1 px-1 truncate max-w-[140px]">{r.keyword}</td>
                  <td className="py-1 px-1">{(r.volume || 0).toLocaleString()}</td>
                  <td className="py-1 px-1">{r.pos_dedecker ?? '—'}</td>
                  <td className="py-1 px-1">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${r.dedecker_in_ai ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-400'}`}>
                      {r.dedecker_in_ai ? 'Yes' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
