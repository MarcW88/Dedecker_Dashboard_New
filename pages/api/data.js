import path from 'path';
import * as XLSX from 'xlsx';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');

function readExcel(filename) {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) return null;
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

function getPositionBucket(pos) {
  if (pos === null || pos === undefined || isNaN(pos)) return 'Not ranked';
  if (pos <= 3) return 'Top 3';
  if (pos <= 10) return '4-10';
  if (pos <= 20) return '11-20';
  return '20+';
}

function processMarketBENL(rows, rowsBad) {
  const compMap = {
    default: ['Vika', 'DSM Keukens', 'Dovy', 'Diapal'],
    Badkamers: ['Groep Wouters', 'De Badbeke', 'X2O', 'Facq', 'Vanmarcke'],
  };

  const badMap = {};
  if (rowsBad) {
    for (const r of rowsBad) {
      const kw = (r.keyword || '').toLowerCase().trim();
      badMap[kw] = {
        'Groep Wouters': toNum(r['groepwouters.be_pos']),
        'De Badbeke': toNum(r['debadbeke.be_pos']),
        'X2O': toNum(r['x2o.be_pos']),
        'Facq': toNum(r['facq.be_pos']),
        'Vanmarcke': toNum(r['vanmarcke.com_pos']),
      };
    }
  }

  const data = rows.map((r) => {
    const kw = (r.keyword || '').toLowerCase().trim();
    const pos = toNum(r.client_pos ?? r.pos_dedecker);
    const bad = badMap[kw] || {};
    return {
      keyword: r.keyword || '',
      volume: toNum(r.volume) || 0,
      category: (r.category || r.Category || 'Non catégorisé').toString().trim(),
      cpc: toNum(r.cpc) || 0,
      pos_dedecker: pos,
      url_dedecker: r.client_url || r.url_dedecker || '',
      has_ai: toBool(r.has_ai_overview ?? r.has_ai),
      dedecker_in_ai: toBool(r.client_in_ai ?? r.dedecker_in_ai),
      position_bucket: getPositionBucket(pos),
      Vika: toNum(r['vika.be_pos']),
      'DSM Keukens': toNum(r['dsmkeukens.be_pos']),
      Dovy: toNum(r['dovykeukens.be_pos']),
      Diapal: toNum(r['diapal.be_pos']),
      Ilwa: toNum(r['ilwa.be_pos']),
      ...bad,
    };
  });

  return { data, compMap };
}

function processMarketBEFR(rows, rowsSdb) {
  const compMap = {
    default: ['Dovy', 'Ixina', 'Vandenborre', 'DSM Cuisines'],
    'Salle de bains': ['Sanijura', 'Mobalpa', 'X2O', 'Facq', 'Vanmarcke'],
  };

  const sdbMap = {};
  if (rowsSdb) {
    for (const r of rowsSdb) {
      const kw = (r.keyword || '').toLowerCase().trim();
      sdbMap[kw] = {
        Sanijura: toNum(r['sanijura.be_pos']),
        Mobalpa: toNum(r['mobalpa.be_pos']),
        X2O: toNum(r['x2o.be_pos']),
        Facq: toNum(r['facq.be_pos']),
        Vanmarcke: toNum(r['vanmarcke.com_pos']),
      };
    }
  }

  const data = rows.map((r) => {
    const kw = (r.keyword || '').toLowerCase().trim();
    const pos = toNum(r.client_pos ?? r.pos_dedecker);
    const sdb = sdbMap[kw] || {};
    return {
      keyword: r.keyword || '',
      volume: toNum(r.volume) || 0,
      category: (r.category || r.Category || 'Non catégorisé').toString().trim(),
      cpc: toNum(r.cpc) || 0,
      pos_dedecker: pos,
      url_dedecker: r.client_url || r.url_dedecker || '',
      has_ai: toBool(r.has_ai_overview ?? r.has_ai),
      dedecker_in_ai: toBool(r.client_in_ai ?? r.dedecker_in_ai),
      position_bucket: getPositionBucket(pos),
      Dovy: toNum(r['cuisinesdovy.be_pos']),
      Ixina: toNum(r['ixina.be_pos']),
      Vandenborre: toNum(r['vandenborrekitchen.be_pos']),
      'DSM Cuisines': toNum(r['dsmcuisines.be_pos']),
      ...sdb,
    };
  });

  return { data, compMap };
}

export default function handler(req, res) {
  const { market = 'BENL' } = req.query;

  try {
    if (market === 'BENL') {
      const rows = readExcel('Keyword_Research_DeDecker_BENL_FINAL.xlsx');
      const rowsBad = readExcel('Keywords_SERP_Final_badkamers_dedecker.xlsx');
      if (!rows) return res.status(404).json({ error: 'BENL data file not found' });
      const result = processMarketBENL(rows, rowsBad);
      return res.status(200).json(result);
    } else {
      const rows = readExcel('Keywords_SERP_Final_FR-Dedecker.xlsx');
      const rowsSdb = readExcel('Keywords_SERP_Final_salle_de_bains.xlsx');
      if (!rows) return res.status(404).json({ error: 'BEFR data file not found' });
      const result = processMarketBEFR(rows, rowsSdb);
      return res.status(200).json(result);
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
