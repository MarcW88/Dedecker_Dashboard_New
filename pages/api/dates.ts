import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const marketParam = Array.isArray(req.query.market) ? req.query.market[0] : (req.query.market ?? 'BENL');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase env vars missing' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('serp_snapshots')
    .select('scan_date, keywords!inner(market)')
    .eq('keywords.market', marketParam)
    .order('scan_date', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const dates = [...new Set((data || []).map((r: { scan_date: string }) => r.scan_date))];
  return res.status(200).json({ dates });
}
