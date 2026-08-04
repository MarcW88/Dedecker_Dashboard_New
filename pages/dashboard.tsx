import { useEffect, useState, useMemo } from 'react';
import { Row, CompMap } from '../lib/types';
import { useRouter } from 'next/router';
import Head from 'next/head';
import KPICards from '../components/KPICards';
import CategoryChart from '../components/CategoryChart';
import CompetitorChart from '../components/CompetitorChart';
import AIOverviewChart from '../components/AIOverviewChart';
import KeywordTable from '../components/KeywordTable';
import DateRangePicker from '../components/DateRangePicker';

const BRANDING_CATS = new Set(['Branding', 'Marque et valeurs']);

export default function Dashboard() {
  const router = useRouter();
  const [market, setMarket] = useState('BENL');
  const [rawData, setRawData] = useState<Row[] | null>(null);
  const [compMap, setCompMap] = useState<CompMap>({ default: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalCat, setGlobalCat] = useState('All');
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [prevDate, setPrevDate] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem('auth') !== '1') {
      router.push('/');
    }
  }, [router]);

  // Fetch available scan dates when market changes
  useEffect(() => {
    fetch(`/api/dates?market=${market}`)
      .then((r) => r.json())
      .then((json) => {
        const dates: string[] = json.dates || [];
        setAvailableDates(dates);
        if (dates.length > 0) {
          setToDate(dates[0]);
          setFromDate(dates[1] || dates[0]);
        } else {
          setToDate('');
          setFromDate('');
        }
      })
      .catch(() => setAvailableDates([]));
  }, [market]);

  useEffect(() => {
    if (!fromDate || !toDate) return;
    setLoading(true);
    setError(null);
    setGlobalCat('All');
    const dateQuery = `&from=${fromDate}&to=${toDate}`;
    fetch(`/api/data?market=${market}${dateQuery}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) { setError(json.error); setLoading(false); return; }
        setRawData(json.data);
        setCompMap(json.compMap);
        setPrevDate(json.fromDate || null);
        setLoading(false);
      })
      .catch((e) => { setError(e.message); setLoading(false); });
  }, [market, fromDate, toDate]);

  const categories = useMemo(() => {
    if (!rawData) return [];
    return [...new Set(rawData.map((r) => r.category).filter((c) => c && !BRANDING_CATS.has(c)))].sort();
  }, [rawData]);

  const filteredData = useMemo(() => {
    if (!rawData) return [];
    const base = rawData.filter((r) => !BRANDING_CATS.has(r.category));
    if (globalCat === 'All') return base;
    return base.filter((r) => r.category === globalCat);
  }, [rawData, globalCat]);

  return (
    <>
      <Head>
        <title>DeDecker — Semantic Analysis</title>
      </Head>
      <div className="min-h-screen bg-dedecker-light">
        {/* Header */}
        <div className="bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <img src="/dedecker-logo.png" alt="DeDecker" className="h-9" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div>
              <h1 className="text-base font-semibold text-dedecker-dark leading-tight">DeDecker Keukens — Semantic Analysis</h1>
              <p className="text-xs text-stone-400">
                {market === 'BENL' ? 'Belgium NL' : 'Belgium FR'} · {loading ? '…' : `${filteredData.length} keywords`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {availableDates.length > 0 && (
              <DateRangePicker
                availableDates={availableDates}
                fromDate={fromDate}
                toDate={toDate}
                onChange={(from, to) => { setFromDate(from); setToDate(to); }}
              />
            )}
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="border border-stone-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:border-taupe"
            >
              <option value="BENL">Belgium NL</option>
              <option value="BEFR">Belgium FR</option>
            </select>
            <button
              onClick={() => { sessionStorage.removeItem('auth'); router.push('/'); }}
              className="text-xs text-stone-400 hover:text-stone-600"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="px-6 py-5 max-w-screen-2xl mx-auto">
          {/* Category filter */}
          <div className="flex gap-2 flex-wrap mb-5">
            {['All', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setGlobalCat(cat)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  globalCat === cat
                    ? 'bg-taupe-dark text-white border-taupe-dark'
                    : 'bg-white text-stone-600 border-stone-200 hover:border-taupe'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-64 text-stone-400 text-sm">
              Loading data…
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600 mb-4">
              <strong>Error:</strong> {error}
              <p className="text-xs mt-1 text-red-400">
                Check that NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in Vercel Environment Variables.
              </p>
            </div>
          )}

          {!loading && !error && filteredData.length > 0 && (
            <>
              <KPICards data={filteredData} fromDate={fromDate} toDate={toDate} />
              <CategoryChart data={filteredData} fromDate={fromDate} toDate={toDate} />
              <CompetitorChart data={filteredData} compMap={compMap} fromDate={fromDate} toDate={toDate} />
              <AIOverviewChart data={filteredData} fromDate={fromDate} toDate={toDate} />
              <KeywordTable data={filteredData} compMap={compMap} fromDate={fromDate} toDate={toDate} />
            </>
          )}
        </div>

        <footer className="text-center text-xs text-stone-400 py-4 border-t border-stone-100">
          DeDecker Keukens · Semantic Analysis Dashboard · 2026
        </footer>
      </div>
    </>
  );
}
