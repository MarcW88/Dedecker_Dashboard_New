import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, LabelList,
} from 'recharts';
import { Row, CompMap } from '@/lib/types';

const COLOR_MAP: Record<string, string> = {
  DeDecker: '#8B7355',
  Vika: '#C4956A', 'DSM Keukens': '#D4A87C', Dovy: '#B07D56',
  Diapal: '#D9B99B', Ixina: '#C48B5C', Vandenborre: '#DDB892',
  'DSM Cuisines': '#CB9B6A',
  X2O: '#4A90A4', Facq: '#6AAFC3', Vanmarcke: '#82C0D2',
  'Groep Wouters': '#3D7A8C', 'De Badbeke': '#5B9FB3',
  Sanijura: '#4E8FA0', Mobalpa: '#72B5C8',
};

export default function CompetitorChart({ data, compMap }: { data: Row[]; compMap: CompMap }) {
  const total = data.length;
  const allComp = [
    ...(compMap.default || []),
    ...Object.entries(compMap).filter(([k]) => k !== 'default').flatMap(([, v]) => v as string[]),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const visRows = [
    {
      name: 'DeDecker',
      Ranked: data.filter((r) => r.pos_dedecker != null).length,
      'Top 20': data.filter((r) => r.pos_dedecker != null && r.pos_dedecker <= 20).length,
      'Top 10': data.filter((r) => r.pos_dedecker != null && r.pos_dedecker <= 10).length,
    },
    ...allComp.map((c) => ({
      name: c,
      Ranked: data.filter((r) => r[c] != null).length,
      'Top 20': data.filter((r) => (r[c] as number) <= 20).length,
      'Top 10': data.filter((r) => (r[c] as number) <= 10).length,
    })),
  ].sort((a, b) => b.Ranked - a.Ranked);

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-dedecker-dark mb-3">Competitive Landscape — Share of Visibility</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm">
          <h4 className="text-xs text-stone-500 font-medium mb-2">Total Ranked Keywords</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={visRows} layout="vertical" margin={{ left: 60, right: 50, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 11 }} domain={[0, total]} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip formatter={(v) => [`${v} / ${total}`, 'Ranked']} />
              <Bar dataKey="Ranked" radius={[0, 4, 4, 0]}>
                {visRows.map((r) => (
                  <Cell key={r.name} fill={COLOR_MAP[r.name] || '#aaa'} />
                ))}
                <LabelList dataKey="Ranked" position="right" style={{ fontSize: 11 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-4 shadow-sm overflow-auto">
          <h4 className="text-xs text-stone-500 font-medium mb-2">Summary</h4>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-stone-100">
                {['Competitor', `Ranked / ${total}`, 'Ranked %', `Top 10 / ${total}`, 'Top 10 %'].map((h) => (
                  <th key={h} className="text-left py-2 px-2 text-stone-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visRows.map((r) => (
                <tr key={r.name} className={`border-b border-stone-50 hover:bg-stone-50 ${r.name === 'DeDecker' ? 'font-semibold' : ''}`}>
                  <td className="py-1.5 px-2 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: COLOR_MAP[r.name] || '#aaa' }} />
                    {r.name}
                  </td>
                  <td className="py-1.5 px-2">{r.Ranked}</td>
                  <td className="py-1.5 px-2">{((r.Ranked / total) * 100).toFixed(1)}%</td>
                  <td className="py-1.5 px-2">{r['Top 10']}</td>
                  <td className="py-1.5 px-2">{((r['Top 10'] / total) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
