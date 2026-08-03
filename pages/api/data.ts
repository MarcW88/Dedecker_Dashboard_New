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

  // Optional: specific date for historical view
  const dateParam = Array.isArray(req.query.date) ? req.query.date[0] : req.query.date;

  try {
    // 1. Fetch SERP data — specific date or latest
    let serpQuery = supabase
      .from(dateParam ? 'serp_snapshots' : 'latest_serp')
      .select(dateParam
        ? 'id, scan_date, pos_dedecker, url_dedecker, has_ai, dedecker_in_ai, keywords!inner(keyword, market, volume, category, subcategory, cpc)'
        : '*'
      );

    if (dateParam) {
      serpQuery = serpQuery.eq('scan_date', dateParam).eq('keywords.market', market);
    } else {
      serpQuery = serpQuery.eq('market', market);
    }

    const { data: rawRows, error: serpErr } = await serpQuery;

    if (serpErr) throw new Error(serpErr.message);
    if (!rawRows || rawRows.length === 0) {
      return res.status(200).json({ data: [], compMap });
    }

    // Normalize rows for both date-specific and latest_serp queries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const serpRows = rawRows.map((r: any) => {
      if (dateParam && r.keywords) {
        const kw = r.keywords;
        return { ...kw, snapshot_id: r.id, scan_date: r.scan_date, pos_dedecker: r.pos_dedecker, url_dedecker: r.url_dedecker, has_ai: r.has_ai, dedecker_in_ai: r.dedecker_in_ai };
      }
      return r;
    });

    // 2. Fetch all competitor positions for these snapshots
    const snapshotIds = serpRows.map((r: any) => r.snapshot_id || r.id);
    const { data: compRows, error: compErr } = await supabase
      .from('competitor_positions')
      .select('snapshot_id, competitor_name, position')
      .in('snapshot_id', snapshotIds);

    if (compErr) throw new Error(compErr.message);

    // 3. Build a map: snapshot_id → { competitor_name: position }
    const compBySnapshot: Record<number, Record<string, number | null>> = {};
    for (const c of compRows || []) {
      if (!compBySnapshot[c.snapshot_id]) compBySnapshot[c.snapshot_id] = {};
      compBySnapshot[c.snapshot_id][c.competitor_name] = c.position;
    }

    // 4. Merge and shape the response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = serpRows.map((r: any) => {
      const pos = r.pos_dedecker as number | null;
      const snapshotId = r.snapshot_id || r.id;
      const competitors = compBySnapshot[snapshotId as number] || {};
      return {
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
    });

    // 5. Fetch previous scan date for comparison (if exists)
    const { data: allDates } = await supabase
      .from('serp_snapshots')
      .select('scan_date, keywords!inner(market)')
      .eq('keywords.market', market)
      .order('scan_date', { ascending: false });

    const uniqueDates = [...new Set((allDates || []).map((r: { scan_date: string }) => r.scan_date))];
    const currentDate = uniqueDates[0];
    const prevDate = uniqueDates[1] || null;

    let prevByKeyword: Record<string, number | null> = {};
    if (prevDate) {
      const { data: prevRows } = await supabase
        .from('serp_snapshots')
        .select('pos_dedecker, keywords!inner(keyword, market)')
        .eq('scan_date', prevDate)
        .eq('keywords.market', market);

      for (const r of prevRows || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const keyword = (r as any).keywords?.keyword;
        if (keyword) prevByKeyword[keyword] = r.pos_dedecker;
      }
    }

    // 6. Add delta to each row
    const dataWithDelta = data.map((row) => {
      const posPrev = prevByKeyword[row.keyword] ?? null;
      const delta = row.pos_dedecker != null && posPrev != null
        ? posPrev - row.pos_dedecker  // positive = improved (lower rank number)
        : null;
      return { ...row, pos_prev: posPrev, delta };
    });

    return res.status(200).json({ data: dataWithDelta, compMap, scanDate: currentDate, prevDate });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Supabase error:', msg);
    return res.status(500).json({ error: msg });
  }
}
