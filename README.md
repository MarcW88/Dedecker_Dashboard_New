# DeDecker Dashboard — Next.js

Semantic Analysis Dashboard for DeDecker Keukens. Built with Next.js + Tailwind + Recharts.

## Setup

```bash
npm install
npm run dev
```

## Data files

Place the Excel files in the `/data/` folder:

**Belgium NL:**
- `Keyword_Research_DeDecker_BENL_FINAL.xlsx`
- `Keywords_SERP_Final_badkamers_dedecker.xlsx`

**Belgium FR:**
- `Keywords_SERP_Final_FR-Dedecker.xlsx`
- `Keywords_SERP_Final_salle_de_bains.xlsx`

> Note: Excel files are in `.gitignore` and not committed to the repo.
> For Vercel deployment, migrate data to Supabase (see roadmap below).

## Deployment on Vercel

1. Push to GitHub
2. Import repo on vercel.com
3. Deploy (no build config needed)

> **Important**: Excel files won't work on Vercel (no filesystem).  
> Migrate to Supabase: replace `/pages/api/data.js` with Supabase queries.

## Roadmap

- [x] Password gate
- [x] Market selector (BE NL / BE FR)
- [x] KPI cards
- [x] Category performance chart
- [x] Competitive landscape
- [x] AI Overview analysis
- [x] Keyword explorer with filters + CSV export
- [ ] Supabase integration (replace Excel files)
- [ ] Monthly ranking automation (GitHub Actions → DataForSEO → Supabase)
- [ ] Historical trends / evolution charts

## Password

`dedecker2026` (change in `pages/index.js` or move to env var)
