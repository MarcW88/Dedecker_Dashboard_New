import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

type CompMapType = Record<string, Record<string, string[]>>;
const COMP_MAP: CompMapType = {
  BENL: {
    default: ['Vika', 'DSM Keukens', 'Dovy', 'Diapal'],
    Badkamers: ['Groep Wouters', 'De Badbeke', 'X2O', 'Facq', 'Vanmarcke'],
  },
  BEFR: {
    default: ['Dovy', 'Ixina', 'Vandenborre', 'DSM Cuisines'],
    'Salle de bains': ['Sanijura', 'Mobalpa', 'X2O', 'Facq', 'Vanmarcke'],
  },
};

function getPositionBucket(pos: number | null | undefined): string {
  if (pos === null || pos === undefined) return 'Not ranked';
  if (pos <= 3) return 'Top 3';
  if (pos <= 10) return '4-10';
  if (pos <= 20) return '11-20';
  return '20+';
}

function calcDelta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return previous - current; // positive = improved (rank number got smaller)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const marketParam = Array.isArray(req.query.market) ? req.query.market[0] : (req.query.market ?? 'BENL');
  const market = (marketParam as string);
  const compMap = COMP_MAP[market] || COMP_MAP['BENL'];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase environment variables are not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Date selection: explicit to/from or legacy single date
  const toParam = Array.isArray(req.query.to) ? req.query.to[0] : (req.query.to as string | undefined);
  const fromParam = Array.isArray(req.query.from) ? req.query.from[0] : (req.query.from as string | undefined);
  const legacyDateParam = Array.isArray(req.query.date) ? req.query.date[0] : (req.query.date as string | undefined);

  const toDate = toParam || legacyDateParam;

  try {
    // 1. Fetch target (to) SERP data
    let serpQuery = supabase
      .from(toDate ? 'serp_snapshots' : 'latest_serp')
      .select(toDate
        ? 'id, scan_date, pos_dedecker, url_dedecker, has_ai, dedecker_in_ai, keywords!inner(keyword, market, volume, category, subcategory, cpc)'
        : '*'
      );

    if (toDate) {
      serpQuery = serpQuery.eq('scan_date', toDate).eq('keywords.market', market);
    } else {
      serpQuery = serpQuery.eq('market', market);
    }

    const { data: rawRows, error: serpErr } = await serpQuery;

    if (serpErr) throw new Error(serpErr.message);
    if (!rawRows || rawRows.length === 0) {
      return res.status(200).json({ data: [], compMap });
    }

    // Normalize rows
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serpRows = rawRows.map((r: any) => {
      if (toDate && r.keywords) {
        const kw = r.keywords;
        return { ...kw, snapshot_id: r.id, scan_date: r.scan_date, pos_dedecker: r.pos_dedecker, url_dedecker: r.url_dedecker, has_ai: r.has_ai, dedecker_in_ai: r.dedecker_in_ai };
      }
      return r;
    });

    const toSnapshotIds = serpRows.map((r: any) => r.snapshot_id || r.id);

    // 2. Target competitor positions
    const { data: compRows, error: compErr } = await supabase
      .from('competitor_positions')
      .select('snapshot_id, competitor_name, position')
      .in('snapshot_id', toSnapshotIds);

    if (compErr) throw new Error(compErr.message);

    const compBySnapshot: Record<number, Record<string, number | null>> = {};
    for (const c of compRows || []) {
      if (!compBySnapshot[c.snapshot_id]) compBySnapshot[c.snapshot_id] = {};
      compBySnapshot[c.snapshot_id][c.competitor_name] = c.position;
    }

    // 3. Determine comparison (from) date
    let fromDate = fromParam || null;
    if (!fromDate && toDate) {
      const { data: allDates } = await supabase
        .from('serp_snapshots')
        .select('scan_date, keywords!inner(market)')
        .eq('keywords.market', market)
        .lt('scan_date', toDate)
        .order('scan_date', { ascending: false });

      const uniqueDates = [...new Set((allDates || []).map((r: { scan_date: string }) => r.scan_date))];
      fromDate = uniqueDates[0] || null;
    }

    // 4. Fetch previous (from) SERP data
    let fromByKeyword: Record<string, any> = {};
    if (fromDate) {
      const { data: prevRows } = await supabase
        .from('serp_snapshots')
        .select('id, scan_date, pos_dedecker, has_ai, dedecker_in_ai, keywords!inner(keyword, market)')
        .eq('scan_date', fromDate)
        .eq('keywords.market', market);

      if (prevRows) {
        const fromSnapshotIds = prevRows.map((r: any) => r.id);
        const { data: prevCompRows } = await supabase
          .from('competitor_positions')
          .select('snapshot_id, competitor_name, position')
          .in('snapshot_id', fromSnapshotIds);

        const prevCompBySnapshot: Record<number, Record<string, number | null>> = {};
        for (const c of prevCompRows || []) {
          if (!prevCompBySnapshot[c.snapshot_id]) prevCompBySnapshot[c.snapshot_id] = {};
          prevCompBySnapshot[c.snapshot_id][c.competitor_name] = c.position;
        }

        for (const r of prevRows) {
          const kw = (r as any).keywords?.keyword;
          if (!kw) continue;
          fromByKeyword[kw] = {
            pos_dedecker: r.pos_dedecker,
            has_ai: r.has_ai,
            dedecker_in_ai: r.dedecker_in_ai,
            competitors: prevCompBySnapshot[r.id] || {},
          };
        }
      }
    }

    // 5. Build response with deltas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = serpRows.map((r: any) => {
      const pos = r.pos_dedecker as number | null;
      const snapshotId = r.snapshot_id || r.id;
      const competitors = compBySnapshot[snapshotId as number] || {};
      const prev = fromByKeyword[r.keyword] || null;

      const row: Record<string, unknown> = {
        keyword: r.keyword,
        volume: r.volume || 0,
        category: r.category || 'Non catégorisé',
        subcategory: r.subcategory || null,
        cpc: r.cpc || 0,
        pos_dedecker: pos,
        url_dedecker: r.url_dedecker || '',
        has_ai: r.has_ai || false,
        dedecker_in_ai: r.dedecker_in_ai || false,
        position_bucket: getPositionBucket(pos),
        scan_date: r.scan_date,
        ...competitors,
      };

      if (prev) {
        row.pos_prev = prev.pos_dedecker ?? null;
        row.delta = calcDelta(pos, prev.pos_dedecker);
        row.has_ai_prev = prev.has_ai ?? false;
        row.dedecker_in_ai_prev = prev.dedecker_in_ai ?? false;

        for (const [name, prevPos] of Object.entries(prev.competitors as Record<string, number | null>)) {
          const curPos = competitors[name] ?? null;
          row[`${name}_prev`] = prevPos ?? null;
          row[`${name}_delta`] = calcDelta(curPos as number | null, prevPos as number | null);
        }

        // Also track competitors that exist now but not before
        for (const [name, curPos] of Object.entries(competitors)) {
          if (!(name in prev.competitors)) {
            row[`${name}_prev`] = null;
            row[`${name}_delta`] = null;
          }
        }
      }

      return row;
    });

    return res.status(200).json({
      data,
      compMap,
      scanDate: toDate || null,
      fromDate,
      toDate,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Supabase error:', msg);
    return res.status(500).json({ error: msg });
  }
}
