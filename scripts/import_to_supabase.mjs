/**
 * Import Excel data into Supabase.
 * Usage: node scripts/import_to_supabase.js
 *
 * Requires env vars:
 *   SUPABASE_URL=https://zmzyvnvjgpxecehjtqfr.supabase.co
 *   SUPABASE_SERVICE_KEY=<service_role key>
 */

import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function readExcel(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) { console.warn(`File not found: ${filename}`); return null; }
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws);
}

function toNum(val) {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toBool(val) {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') return ['true', '1', 'yes', 'vrai'].includes(val.toLowerCase());
  return Boolean(val);
}

async function upsertBatch(rows, table) {
  const BATCH = 200;
  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase.from(table).upsert(rows.slice(i, i + BATCH), { onConflict: table === 'keywords' ? 'keyword,market' : undefined });
    if (error) { console.error(`Error upserting ${table}:`, error.message); throw error; }
  }
}

async function importMarket(market, kwFile, kwCompetitors, extraFile, extraCompetitors) {
  const scanDate = new Date().toISOString().split('T')[0];
  console.log(`\n=== Importing ${market} (scan_date: ${scanDate}) ===`);

  const rows = readExcel(kwFile);
  if (!rows) return;
  const extraRows = extraFile ? readExcel(extraFile) : null;

  const extraMap = {};
  if (extraRows) {
    for (const r of extraRows) {
      const kw = (r.keyword || '').toLowerCase().trim();
      extraMap[kw] = r;
    }
  }

  // 1. Upsert keywords
  const kwPayload = rows.map((r) => ({
    keyword: (r.keyword || '').trim(),
    market,
    volume: toNum(r.volume) || 0,
    category: (r.category || r.Category || 'Non catégorisé').toString().trim(),
    subcategory: r.subcategory ? r.subcategory.toString().trim() : null,
    cpc: toNum(r.cpc) || 0,
  })).filter((r) => r.keyword);

  await upsertBatch(kwPayload, 'keywords');
  console.log(`  ✓ ${kwPayload.length} keywords upserted`);

  // 2. Fetch inserted keyword IDs
  const { data: kwIds, error: kwErr } = await supabase
    .from('keywords')
    .select('id, keyword')
    .eq('market', market);
  if (kwErr) throw kwErr;

  const kwIdMap = {};
  for (const k of kwIds) kwIdMap[k.keyword.toLowerCase().trim()] = k.id;

  // 3. Upsert serp_snapshots
  const snapPayload = rows.map((r) => {
    const kw = (r.keyword || '').toLowerCase().trim();
    const kwId = kwIdMap[kw];
    if (!kwId) return null;
    return {
      keyword_id: kwId,
      scan_date: scanDate,
      pos_dedecker: toNum(r.client_pos ?? r.pos_dedecker),
      url_dedecker: r.client_url || r.url_dedecker || null,
      has_ai: toBool(r.has_ai_overview ?? r.has_ai),
      dedecker_in_ai: toBool(r.client_in_ai ?? r.dedecker_in_ai),
    };
  }).filter(Boolean);

  await upsertBatch(snapPayload, 'serp_snapshots');
  console.log(`  ✓ ${snapPayload.length} serp_snapshots upserted`);

  // 4. Fetch snapshot IDs
  const { data: snapIds, error: snapErr } = await supabase
    .from('serp_snapshots')
    .select('id, keyword_id')
    .eq('scan_date', scanDate);
  if (snapErr) throw snapErr;

  const snapIdMap = {};
  for (const s of snapIds) snapIdMap[s.keyword_id] = s.id;

  // 5. Upsert competitor_positions
  const compPayload = [];
  for (const r of rows) {
    const kw = (r.keyword || '').toLowerCase().trim();
    const kwId = kwIdMap[kw];
    if (!kwId) continue;
    const snapId = snapIdMap[kwId];
    if (!snapId) continue;

    for (const [field, name] of Object.entries(kwCompetitors)) {
      const pos = toNum(r[field]);
      compPayload.push({ snapshot_id: snapId, competitor_name: name, position: pos });
    }

    if (extraMap[kw]) {
      const ex = extraMap[kw];
      for (const [field, name] of Object.entries(extraCompetitors)) {
        const pos = toNum(ex[field]);
        compPayload.push({ snapshot_id: snapId, competitor_name: name, position: pos });
      }
    }
  }

  // Upsert competitor positions in batches
  const BATCH = 200;
  for (let i = 0; i < compPayload.length; i += BATCH) {
    const { error } = await supabase
      .from('competitor_positions')
      .upsert(compPayload.slice(i, i + BATCH), { onConflict: 'snapshot_id,competitor_name' });
    if (error) { console.error('Error upserting competitor_positions:', error.message); throw error; }
  }
  console.log(`  ✓ ${compPayload.length} competitor positions upserted`);
}

async function main() {
  try {
    await importMarket(
      'BENL',
      'Keyword_Research_DeDecker_BENL_FINAL.xlsx',
      {
        'vika.be_pos': 'Vika',
        'dsmkeukens.be_pos': 'DSM Keukens',
        'dovykeukens.be_pos': 'Dovy',
        'diapal.be_pos': 'Diapal',
        'ilwa.be_pos': 'Ilwa',
      },
      'Keywords_SERP_Final_badkamers_dedecker.xlsx',
      {
        'groepwouters.be_pos': 'Groep Wouters',
        'debadbeke.be_pos': 'De Badbeke',
        'x2o.be_pos': 'X2O',
        'facq.be_pos': 'Facq',
        'vanmarcke.com_pos': 'Vanmarcke',
      }
    );

    await importMarket(
      'BEFR',
      'Keywords_SERP_Final_FR-Dedecker.xlsx',
      {
        'cuisinesdovy.be_pos': 'Dovy',
        'ixina.be_pos': 'Ixina',
        'vandenborrekitchen.be_pos': 'Vandenborre',
        'dsmcuisines.be_pos': 'DSM Cuisines',
      },
      'Keywords_SERP_Final_salle_de_bains.xlsx',
      {
        'sanijura.be_pos': 'Sanijura',
        'mobalpa.be_pos': 'Mobalpa',
        'x2o.be_pos': 'X2O',
        'facq.be_pos': 'Facq',
        'vanmarcke.com_pos': 'Vanmarcke',
      }
    );

    console.log('\n✅ Import complete!');
  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    process.exit(1);
  }
}

main();
