import { createClient } from '@supabase/supabase-js';

const COMP_MAP = {
  BENL: {
    default: ['Vika', 'DSM Keukens', 'Dovy', 'Diapal'],
    Badkamers: ['Groep Wouters', 'De Badbeke', 'X2O', 'Facq', 'Vanmarcke'],
  },
  BEFR: {
    default: ['Dovy', 'Ixina', 'Vandenborre', 'DSM Cuisines'],
    'Salle de bains': ['Sanijura', 'Mobalpa', 'X2O', 'Facq', 'Vanmarcke'],
  },
};

function getPositionBucket(pos) {
  if (pos === null || pos === undefined) return 'Not ranked';
  if (pos <= 3) return 'Top 3';
  if (pos <= 10) return '4-10';
  if (pos <= 20) return '11-20';
  return '20+';
}

export default async function handler(req, res) {
  const { market = 'BENL' } = req.query;
  const compMap = COMP_MAP[market] || COMP_MAP.BENL;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  try {
    // 1. Fetch latest SERP data for the market
    const { data: serpRows, error: serpErr } = await supabase
      .from('latest_serp')
      .select('*')
      .eq('market', market);

    if (serpErr) throw new Error(serpErr.message);
    if (!serpRows || serpRows.length === 0) {
      return res.status(200).json({ data: [], compMap });
    }

    // 2. Fetch all competitor positions for these snapshots
    const snapshotIds = serpRows.map((r) => r.snapshot_id);
    const { data: compRows, error: compErr } = await supabase
      .from('competitor_positions')
      .select('snapshot_id, competitor_name, position')
      .in('snapshot_id', snapshotIds);

    if (compErr) throw new Error(compErr.message);

    // 3. Build a map: snapshot_id → { competitor_name: position }
    const compBySnapshot = {};
    for (const c of compRows || []) {
      if (!compBySnapshot[c.snapshot_id]) compBySnapshot[c.snapshot_id] = {};
      compBySnapshot[c.snapshot_id][c.competitor_name] = c.position;
    }

    // 4. Merge and shape the response
    const data = serpRows.map((r) => {
      const pos = r.pos_dedecker;
      const competitors = compBySnapshot[r.snapshot_id] || {};
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

    return res.status(200).json({ data, compMap });
  } catch (err) {
    console.error('Supabase error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
