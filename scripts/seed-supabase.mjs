// Run once to populate Supabase from the static data.js file:
//   node scripts/seed-supabase.mjs
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { collegeData } from '../src/data.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY,
);

async function seed() {
  console.log(`Seeding ${collegeData.length} colleges into Supabase…\n`);

  for (const college of collegeData) {
    // 1. Upsert college master record
    const { data: col, error: colErr } = await supabase
      .from('colleges')
      .upsert({ code: college.code, name: college.name, seats: college.seats }, { onConflict: 'code' })
      .select('id')
      .single();

    if (colErr) {
      console.error(`  ✗ ${college.code}: ${colErr.message}`);
      continue;
    }

    // 2. Upsert fee rows
    const feeRows = Object.entries(college.fees).map(([category, annual_fee]) => ({
      college_id: col.id, category, annual_fee,
    }));
    const { error: feeErr } = await supabase
      .from('college_fees')
      .upsert(feeRows, { onConflict: 'college_id,category' });
    if (feeErr) console.warn(`  ⚠ fees for ${college.code}: ${feeErr.message}`);

    // 3. Upsert cutoff rows
    const cutoffRows = [];
    for (const [year, cats] of Object.entries(college.cutoffs)) {
      for (const [category, cutoff_score] of Object.entries(cats)) {
        cutoffRows.push({ college_id: col.id, year: parseInt(year), category, cutoff_score });
      }
    }
    const { error: cutErr } = await supabase
      .from('college_cutoffs')
      .upsert(cutoffRows, { onConflict: 'college_id,year,category' });
    if (cutErr) console.warn(`  ⚠ cutoffs for ${college.code}: ${cutErr.message}`);

    console.log(`  ✓ ${college.name}`);
  }

  console.log('\nSeed complete.');
}

seed().catch(err => { console.error(err); process.exit(1); });
