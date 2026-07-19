-- ═══════════════════════════════════════════════════════════════════
-- Migration 4 — AIQ (All India Quota) cutoff data
-- Source: neetugguidance.in (client-provided reference, July 2026)
-- Run this in Supabase SQL Editor. Safe to re-run (idempotent).
-- ═══════════════════════════════════════════════════════════════════

-- ── Table 1: Round-wise AIQ cutoffs 2025 (MBBS / BDS / BSc Nursing) ──
CREATE TABLE IF NOT EXISTS aiq_round_cutoffs (
  id       SERIAL PRIMARY KEY,
  course   TEXT NOT NULL,   -- 'mbbs' | 'bds' | 'nursing'
  category TEXT NOT NULL,   -- 'UR' | 'OBC' | 'EWS' | 'SC' | 'ST'
  round    INT  NOT NULL,   -- 1..5
  air      INT,             -- All India Rank (closing)
  score    INT,             -- NEET score at closing rank
  UNIQUE (course, category, round)
);

-- ── Table 2: State-wise AIQ MBBS cutoffs, year-wise ──
CREATE TABLE IF NOT EXISTS aiq_state_cutoffs (
  id        SERIAL PRIMARY KEY,
  state     TEXT NOT NULL,  -- 'ALL INDIA' or state/UT name
  category  TEXT NOT NULL,
  year      INT  NOT NULL,
  last_rank INT,
  score     INT,
  UNIQUE (state, category, year)
);

ALTER TABLE aiq_round_cutoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE aiq_state_cutoffs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_aiq_round ON aiq_round_cutoffs;
CREATE POLICY anon_read_aiq_round ON aiq_round_cutoffs FOR SELECT USING (true);

DROP POLICY IF EXISTS anon_read_aiq_state ON aiq_state_cutoffs;
CREATE POLICY anon_read_aiq_state ON aiq_state_cutoffs FOR SELECT USING (true);

-- ── Seed: Round-wise 2025 ──
INSERT INTO aiq_round_cutoffs (course, category, round, air, score) VALUES
  -- MBBS
  ('mbbs','UR',1,21190,534),('mbbs','UR',2,24949,529),('mbbs','UR',3,26178,527),('mbbs','UR',4,27332,525),('mbbs','UR',5,27360,525),
  ('mbbs','OBC',1,21452,534),('mbbs','OBC',2,25108,528),('mbbs','OBC',3,26231,527),('mbbs','OBC',4,27307,525),('mbbs','OBC',5,27421,525),
  ('mbbs','EWS',1,25599,528),('mbbs','EWS',2,28920,524),('mbbs','EWS',3,29997,522),('mbbs','EWS',4,30862,521),('mbbs','EWS',5,30921,521),
  ('mbbs','SC',1,110389,457),('mbbs','SC',2,132649,443),('mbbs','SC',3,136392,441),('mbbs','SC',4,138863,440),('mbbs','SC',5,139123,439),
  ('mbbs','ST',1,145625,436),('mbbs','ST',2,156601,429),('mbbs','ST',3,162975,425),('mbbs','ST',4,164804,425),
  -- BDS
  ('bds','UR',1,38223,513),('bds','UR',2,47936,504),('bds','UR',3,49462,502),('bds','UR',4,55845,497),
  ('bds','OBC',1,41398,510),('bds','OBC',2,50293,502),('bds','OBC',3,51192,501),('bds','OBC',4,57481,495),
  ('bds','EWS',1,48617,503),('bds','EWS',2,54132,498),('bds','EWS',3,60380,493),('bds','EWS',4,61023,492),
  ('bds','SC',1,160911,497),('bds','SC',2,176287,418),('bds','SC',3,189221,411),('bds','SC',4,204162,403),
  ('bds','ST',1,206111,402),('bds','ST',2,231324,389),('bds','ST',3,241599,384),('bds','ST',4,263071,374),
  -- BSc Nursing
  ('nursing','UR',1,79963,478),('nursing','UR',2,93235,469),('nursing','UR',3,100396,464),('nursing','UR',4,91244,470),
  ('nursing','OBC',1,87262,473),('nursing','OBC',2,98580,465),('nursing','OBC',3,106257,460),('nursing','OBC',4,93730,468),
  ('nursing','EWS',1,97367,466),('nursing','EWS',2,103704,462),('nursing','EWS',3,104434,461),('nursing','EWS',4,75943,481),
  ('nursing','SC',1,220525,395),('nursing','SC',2,245319,382),('nursing','SC',3,245360,382),('nursing','SC',4,243260,383)
ON CONFLICT (course, category, round) DO UPDATE SET air = EXCLUDED.air, score = EXCLUDED.score;

-- ── Seed: State-wise year-wise AIQ MBBS ──
INSERT INTO aiq_state_cutoffs (state, category, year, last_rank, score) VALUES
  -- ALL INDIA
  ('ALL INDIA','UR',2025,27360,525),('ALL INDIA','UR',2024,24842,652),('ALL INDIA','UR',2023,22663,611),('ALL INDIA','UR',2022,22237,597),
  ('ALL INDIA','OBC',2025,27421,525),('ALL INDIA','OBC',2024,24982,652),('ALL INDIA','OBC',2023,22784,611),('ALL INDIA','OBC',2022,22338,597),
  ('ALL INDIA','EWS',2025,30921,521),('ALL INDIA','EWS',2024,28702,647),('ALL INDIA','EWS',2023,24659,608),('ALL INDIA','EWS',2022,23202,596),
  ('ALL INDIA','SC',2025,139123,439),('ALL INDIA','SC',2024,133872,553),('ALL INDIA','SC',2023,123215,486),('ALL INDIA','SC',2022,119793,457),
  ('ALL INDIA','ST',2025,164804,425),('ALL INDIA','ST',2024,166849,527),('ALL INDIA','ST',2023,159636,453),('ALL INDIA','ST',2022,151846,424),
  -- ANDAMAN & NICOBAR
  ('Andaman & Nicobar','UR',2025,24933,529),('Andaman & Nicobar','UR',2024,25229,651),('Andaman & Nicobar','UR',2023,23535,610),
  ('Andaman & Nicobar','OBC',2025,26172,527),('Andaman & Nicobar','OBC',2024,25079,652),('Andaman & Nicobar','OBC',2023,23570,610),
  ('Andaman & Nicobar','EWS',2025,30455,522),('Andaman & Nicobar','EWS',2024,23864,654),('Andaman & Nicobar','EWS',2023,24793,607),
  ('Andaman & Nicobar','SC',2025,136392,441),('Andaman & Nicobar','SC',2024,137759,550),('Andaman & Nicobar','SC',2023,128978,480),
  ('Andaman & Nicobar','ST',2025,162177,426),('Andaman & Nicobar','ST',2024,144579,545),('Andaman & Nicobar','ST',2023,151143,560),
  -- ANDHRA PRADESH
  ('Andhra Pradesh','UR',2025,25334,528),('Andhra Pradesh','UR',2024,25004,652),
  ('Andhra Pradesh','OBC',2025,25539,528),('Andhra Pradesh','OBC',2024,24282,653),
  ('Andhra Pradesh','EWS',2025,27746,525),('Andhra Pradesh','EWS',2024,26779,650),
  ('Andhra Pradesh','SC',2025,124874,448),('Andhra Pradesh','SC',2024,130106,556),
  ('Andhra Pradesh','ST',2025,150789,433),('Andhra Pradesh','ST',2024,154000,537),
  -- ARUNACHAL PRADESH
  ('Arunachal Pradesh','UR',2025,27233,526),('Arunachal Pradesh','UR',2024,23271,655),('Arunachal Pradesh','UR',2023,22104,612),
  ('Arunachal Pradesh','OBC',2025,25985,527),('Arunachal Pradesh','OBC',2024,24820,652),('Arunachal Pradesh','OBC',2023,23510,610),
  ('Arunachal Pradesh','EWS',2025,25414,528),('Arunachal Pradesh','EWS',2024,28007,648),
  ('Arunachal Pradesh','SC',2025,136445,441),('Arunachal Pradesh','SC',2024,128844,557),('Arunachal Pradesh','SC',2023,119395,489),
  ('Arunachal Pradesh','ST',2025,134837,442),('Arunachal Pradesh','ST',2024,155094,536),
  -- ASSAM
  ('Assam','UR',2025,27316,525),('Assam','UR',2024,25029,652),('Assam','UR',2023,23523,610),('Assam','UR',2022,22706,596),
  ('Assam','OBC',2025,27078,526),('Assam','OBC',2024,24984,652),('Assam','OBC',2023,23540,610),('Assam','OBC',2022,22701,596),
  ('Assam','EWS',2025,30385,522),('Assam','EWS',2024,28243,648),('Assam','EWS',2023,24807,607),('Assam','EWS',2022,23062,595),
  ('Assam','SC',2025,138173,440),('Assam','SC',2024,135700,551),('Assam','SC',2023,128512,481),('Assam','SC',2022,122243,454),
  ('Assam','ST',2025,163863,425),('Assam','ST',2024,167635,527),('Assam','ST',2023,165354,448),('Assam','ST',2022,148437,427),
  -- BIHAR
  ('Bihar','UR',2025,27360,525),('Bihar','UR',2024,19612,660),('Bihar','UR',2023,22485,612),('Bihar','UR',2022,19297,603),
  ('Bihar','OBC',2025,20887,534),('Bihar','OBC',2024,21362,656),('Bihar','OBC',2023,23283,610),('Bihar','OBC',2022,19461,603),
  ('Bihar','EWS',2025,23353,531),('Bihar','EWS',2024,20744,657),('Bihar','EWS',2023,23495,610),('Bihar','EWS',2022,19452,603),
  ('Bihar','SC',2025,115420,454),('Bihar','SC',2024,134173,553),('Bihar','SC',2023,125412,484),('Bihar','SC',2022,107914,470),
  ('Bihar','ST',2025,163064,425),('Bihar','ST',2024,159542,533),('Bihar','ST',2023,159659,453),('Bihar','ST',2022,137021,439),
  -- CHANDIGARH
  ('Chandigarh','UR',2025,690,614),('Chandigarh','UR',2024,778,705),('Chandigarh','UR',2023,607,691),
  ('Chandigarh','OBC',2025,11273,552),('Chandigarh','OBC',2024,1754,696),('Chandigarh','OBC',2023,1787,678),
  ('Chandigarh','EWS',2025,1933,593),('Chandigarh','EWS',2024,1944,695),('Chandigarh','EWS',2023,2735,670),
  ('Chandigarh','SC',2025,14060,546),('Chandigarh','SC',2024,11544,671),('Chandigarh','SC',2023,14584,628),
  ('Chandigarh','ST',2025,46479,505),('Chandigarh','ST',2024,37027,638),('Chandigarh','ST',2023,24316,608),
  -- CHHATTISGARH
  ('Chhattisgarh','UR',2025,26284,527),('Chhattisgarh','UR',2024,24628,652),('Chhattisgarh','UR',2023,23389,610),('Chhattisgarh','UR',2022,22559,596),
  ('Chhattisgarh','OBC',2025,27421,525),('Chhattisgarh','OBC',2024,24699,652),('Chhattisgarh','OBC',2023,23382,610),('Chhattisgarh','OBC',2022,22578,596),
  ('Chhattisgarh','EWS',2025,30542,522),('Chhattisgarh','EWS',2024,26282,650),('Chhattisgarh','EWS',2023,24913,607),('Chhattisgarh','EWS',2022,23431,595),
  ('Chhattisgarh','SC',2025,120890,451),('Chhattisgarh','SC',2024,118666,565),('Chhattisgarh','SC',2023,127551,482),('Chhattisgarh','SC',2022,110384,468),
  ('Chhattisgarh','ST',2025,145338,436),('Chhattisgarh','ST',2024,150935,540),('Chhattisgarh','ST',2023,165222,448),('Chhattisgarh','ST',2022,146506,429),
  -- DADRA & NAGAR HAVELI
  ('Dadra & Nagar Haveli','UR',2025,10687,554),('Dadra & Nagar Haveli','UR',2024,12293,670),('Dadra & Nagar Haveli','UR',2023,20945,615),
  ('Dadra & Nagar Haveli','OBC',2025,11215,552),('Dadra & Nagar Haveli','OBC',2024,12259,670),('Dadra & Nagar Haveli','OBC',2023,13948,630),
  ('Dadra & Nagar Haveli','EWS',2025,12336,550),('Dadra & Nagar Haveli','EWS',2024,13142,670),('Dadra & Nagar Haveli','EWS',2023,14912,627),
  ('Dadra & Nagar Haveli','SC',2025,85166,474),('Dadra & Nagar Haveli','SC',2024,75797,601),('Dadra & Nagar Haveli','SC',2023,83800,527),
  ('Dadra & Nagar Haveli','ST',2025,85339,474),('Dadra & Nagar Haveli','ST',2024,100325,580),('Dadra & Nagar Haveli','ST',2023,110543,498),
  -- DELHI
  ('Delhi','UR',2025,3086,583),('Delhi','UR',2024,6924,680),('Delhi','UR',2023,1427,681),('Delhi','UR',2022,1069,675),
  ('Delhi','OBC',2025,16369,542),('Delhi','OBC',2024,3451,690),('Delhi','OBC',2023,3680,665),('Delhi','OBC',2022,3130,665),
  ('Delhi','EWS',2025,14868,545),('Delhi','EWS',2024,3780,690),('Delhi','EWS',2023,3500,665),('Delhi','EWS',2022,1773,670),
  ('Delhi','SC',2025,53612,499),('Delhi','SC',2024,20497,658),('Delhi','SC',2023,29053,600),('Delhi','SC',2022,18318,606),
  ('Delhi','ST',2025,87699,473),('Delhi','ST',2024,38108,637),('Delhi','ST',2023,62076,552),('Delhi','ST',2022,88550,494),
  -- GOA
  ('Goa','UR',2025,23562,531),('Goa','UR',2024,16029,665),('Goa','UR',2023,21898,613),('Goa','UR',2022,14964,614),
  ('Goa','OBC',2025,16989,541),('Goa','OBC',2024,14834,666),('Goa','OBC',2023,23052,611),('Goa','OBC',2022,17774,607),
  ('Goa','EWS',2025,29942,522),('Goa','EWS',2024,17658,661),('Goa','EWS',2023,16436,624),('Goa','EWS',2022,18422,605),
  ('Goa','SC',2025,101960,463),('Goa','SC',2024,81588,596),('Goa','SC',2023,95173,514),('Goa','SC',2022,104196,475),
  ('Goa','ST',2025,125649,448),('Goa','ST',2024,126409,559),('Goa','ST',2023,97384,512),('Goa','ST',2022,132031,444),
  -- GUJARAT
  ('Gujarat','UR',2025,27335,525),('Gujarat','UR',2024,24795,652),('Gujarat','UR',2023,23550,610),('Gujarat','UR',2022,22681,596),
  ('Gujarat','OBC',2025,27158,526),('Gujarat','OBC',2024,25056,652),('Gujarat','OBC',2023,23575,610),('Gujarat','OBC',2022,22712,596),
  ('Gujarat','EWS',2025,30862,521),('Gujarat','EWS',2024,27085,650),('Gujarat','EWS',2023,23840,609),('Gujarat','EWS',2022,23272,595),
  ('Gujarat','SC',2025,137679,440),('Gujarat','SC',2024,138322,549),('Gujarat','SC',2023,125407,484),('Gujarat','SC',2022,120556,456),
  ('Gujarat','ST',2025,161923,426),('Gujarat','ST',2024,168888,526),('Gujarat','ST',2023,165708,448),('Gujarat','ST',2022,153366,423),
  -- HARYANA
  ('Haryana','UR',2025,25252,528),('Haryana','UR',2024,16404,646),('Haryana','UR',2023,23624,610),('Haryana','UR',2022,22583,596),
  ('Haryana','OBC',2025,19520,536),('Haryana','OBC',2024,17849,661),('Haryana','OBC',2023,23675,610),('Haryana','OBC',2022,22654,596),
  ('Haryana','EWS',2025,30639,521),('Haryana','EWS',2024,17860,661),('Haryana','EWS',2023,25013,607),('Haryana','EWS',2022,21248,599),
  ('Haryana','SC',2025,136602,441),('Haryana','SC',2024,127722,558),('Haryana','SC',2023,98754,510),('Haryana','SC',2022,102342,477),
  ('Haryana','ST',2025,123642,449),('Haryana','ST',2024,125553,560),('Haryana','ST',2023,165200,448),('Haryana','ST',2022,138936,437),
  -- HIMACHAL PRADESH
  ('Himachal Pradesh','UR',2025,25290,528),('Himachal Pradesh','UR',2024,15425,665),('Himachal Pradesh','UR',2023,22268,612),('Himachal Pradesh','UR',2022,20827,600),
  ('Himachal Pradesh','OBC',2025,15996,542),('Himachal Pradesh','OBC',2024,13926,667),('Himachal Pradesh','OBC',2023,23611,610),('Himachal Pradesh','OBC',2022,19456,603),
  ('Himachal Pradesh','EWS',2025,23461,531),('Himachal Pradesh','EWS',2024,27413,649),('Himachal Pradesh','EWS',2023,23310,610),('Himachal Pradesh','EWS',2022,16410,610),
  ('Himachal Pradesh','SC',2025,130397,445),('Himachal Pradesh','SC',2024,133589,553),('Himachal Pradesh','SC',2023,117210,491),('Himachal Pradesh','SC',2022,98628,481),
  ('Himachal Pradesh','ST',2025,113394,455),('Himachal Pradesh','ST',2024,106570,575),('Himachal Pradesh','ST',2023,110709,498),('Himachal Pradesh','ST',2022,152915,423),
  -- JHARKHAND
  ('Jharkhand','UR',2025,27259,526),('Jharkhand','UR',2024,23839,654),('Jharkhand','UR',2023,22995,611),('Jharkhand','UR',2022,22554,596),
  ('Jharkhand','OBC',2025,27066,526),('Jharkhand','OBC',2024,22119,656),('Jharkhand','OBC',2023,23168,610),('Jharkhand','OBC',2022,22523,596),
  ('Jharkhand','EWS',2025,24950,529),('Jharkhand','EWS',2024,23557,654),('Jharkhand','EWS',2023,24682,607),('Jharkhand','EWS',2022,20350,601),
  ('Jharkhand','SC',2025,118086,452),('Jharkhand','SC',2024,134200,552),('Jharkhand','SC',2023,118599,490),('Jharkhand','SC',2022,121602,455),
  ('Jharkhand','ST',2025,136565,441),('Jharkhand','ST',2024,146906,543),('Jharkhand','ST',2023,144197,466),('Jharkhand','ST',2022,142970,433),
  -- KARNATAKA
  ('Karnataka','UR',2025,27224,526),('Karnataka','UR',2024,25076,652),('Karnataka','UR',2023,23386,610),('Karnataka','UR',2022,22601,596),
  ('Karnataka','OBC',2025,27190,526),('Karnataka','OBC',2024,25189,652),('Karnataka','OBC',2023,23508,610),('Karnataka','OBC',2022,22695,596),
  ('Karnataka','EWS',2025,30524,522),('Karnataka','EWS',2024,27135,650),('Karnataka','EWS',2023,24927,607),('Karnataka','EWS',2022,22824,596),
  ('Karnataka','SC',2025,136854,441),('Karnataka','SC',2024,135475,552),('Karnataka','SC',2023,129037,480),('Karnataka','SC',2022,120827,456),
  ('Karnataka','ST',2025,152995,431),('Karnataka','ST',2024,165453,529),('Karnataka','ST',2023,166044,448),('Karnataka','ST',2022,152852,423),
  -- KERALA
  ('Kerala','UR',2025,26117,527),('Kerala','UR',2024,23609,654),('Kerala','UR',2023,23567,610),('Kerala','UR',2022,22590,596),
  ('Kerala','OBC',2025,26525,526),('Kerala','OBC',2024,16304,664),('Kerala','OBC',2023,23666,610),('Kerala','OBC',2022,21063,600),
  ('Kerala','EWS',2025,30746,521),('Kerala','EWS',2024,28717,647),('Kerala','EWS',2023,24978,607),('Kerala','EWS',2022,23471,595),
  ('Kerala','SC',2025,138773,440),('Kerala','SC',2024,136857,550),('Kerala','SC',2023,128139,481),('Kerala','SC',2022,121599,455),
  ('Kerala','ST',2025,159265,428),('Kerala','ST',2024,163064,530),('Kerala','ST',2023,152748,459),('Kerala','ST',2022,153414,423),
  -- MADHYA PRADESH
  ('Madhya Pradesh','UR',2025,27095,526),('Madhya Pradesh','UR',2024,22785,655),('Madhya Pradesh','UR',2023,23315,610),('Madhya Pradesh','UR',2022,22478,596),
  ('Madhya Pradesh','OBC',2025,26707,526),('Madhya Pradesh','OBC',2024,21165,657),('Madhya Pradesh','OBC',2023,23366,610),('Madhya Pradesh','OBC',2022,22446,596),
  ('Madhya Pradesh','EWS',2025,30471,522),('Madhya Pradesh','EWS',2024,21228,657),('Madhya Pradesh','EWS',2023,24895,607),('Madhya Pradesh','EWS',2022,18985,605),
  ('Madhya Pradesh','SC',2025,137762,440),('Madhya Pradesh','SC',2024,130922,555),('Madhya Pradesh','SC',2023,126461,483),('Madhya Pradesh','SC',2022,120893,456),
  ('Madhya Pradesh','ST',2025,123716,449),('Madhya Pradesh','ST',2024,120887,563),('Madhya Pradesh','ST',2023,164309,449),('Madhya Pradesh','ST',2022,135758,440),
  -- MAHARASHTRA
  ('Maharashtra','UR',2025,27254,526),('Maharashtra','UR',2024,24924,652),('Maharashtra','UR',2023,23462,610),('Maharashtra','UR',2022,22544,596),
  ('Maharashtra','OBC',2025,27181,526),('Maharashtra','OBC',2024,25161,652),('Maharashtra','OBC',2023,23475,610),('Maharashtra','OBC',2022,22499,596),
  ('Maharashtra','EWS',2025,30555,522),('Maharashtra','EWS',2024,27899,649),('Maharashtra','EWS',2023,24908,607),('Maharashtra','EWS',2022,22140,597),
  ('Maharashtra','SC',2025,138010,440),('Maharashtra','SC',2024,137174,550),('Maharashtra','SC',2023,127414,482),('Maharashtra','SC',2022,121012,456),
  ('Maharashtra','ST',2025,164043,425),('Maharashtra','ST',2024,167467,527),('Maharashtra','ST',2023,165058,449),('Maharashtra','ST',2022,150303,426),
  -- MANIPUR
  ('Manipur','UR',2025,27330,525),('Manipur','UR',2024,25050,652),('Manipur','UR',2023,23562,610),('Manipur','UR',2022,22639,596),
  ('Manipur','OBC',2025,26166,527),('Manipur','OBC',2024,25073,652),('Manipur','OBC',2023,23547,610),('Manipur','OBC',2022,22310,597),
  ('Manipur','EWS',2025,29587,523),('Manipur','EWS',2024,28587,647),('Manipur','EWS',2023,24659,608),('Manipur','EWS',2022,23033,595),
  ('Manipur','SC',2025,132946,443),('Manipur','SC',2024,137242,550),('Manipur','SC',2023,121093,488),('Manipur','SC',2022,95920,485),
  ('Manipur','ST',2025,159217,428),('Manipur','ST',2024,144776,544),('Manipur','ST',2023,169088,445),('Manipur','ST',2022,150618,425),
  -- MEGHALAYA
  ('Meghalaya','UR',2025,27270,525),('Meghalaya','UR',2024,24090,653),('Meghalaya','UR',2023,14704,628),('Meghalaya','UR',2022,18342,606),
  ('Meghalaya','OBC',2025,25395,528),
  ('Meghalaya','SC',2025,134362,442),
  -- MIZORAM
  ('Mizoram','UR',2025,26055,527),('Mizoram','UR',2024,25036,652),('Mizoram','UR',2023,22536,611),('Mizoram','UR',2022,22596,596),
  ('Mizoram','OBC',2025,26060,527),('Mizoram','OBC',2024,25058,652),('Mizoram','OBC',2023,22728,611),('Mizoram','OBC',2022,22721,596),
  ('Mizoram','EWS',2025,29724,523),('Mizoram','EWS',2024,28776,647),('Mizoram','EWS',2023,24425,608),('Mizoram','EWS',2022,22206,597),
  ('Mizoram','SC',2025,134896,442),('Mizoram','SC',2024,133754,553),('Mizoram','SC',2023,122583,486),('Mizoram','SC',2022,119984,457),
  ('Mizoram','ST',2025,160582,427),('Mizoram','ST',2024,168640,526),('Mizoram','ST',2023,111423,497),('Mizoram','ST',2022,128925,447),
  -- NAGALAND
  ('Nagaland','UR',2025,27332,525),('Nagaland','UR',2024,25032,652),('Nagaland','UR',2023,22663,611),
  ('Nagaland','OBC',2025,26231,527),('Nagaland','OBC',2024,24982,652),('Nagaland','OBC',2023,22784,611),
  ('Nagaland','EWS',2025,29747,523),('Nagaland','EWS',2024,28836,647),('Nagaland','EWS',2023,24563,608),
  ('Nagaland','SC',2025,134865,442),('Nagaland','SC',2024,133872,553),('Nagaland','SC',2023,122695,486),
  ('Nagaland','ST',2025,162975,425),('Nagaland','ST',2024,168372,526),('Nagaland','ST',2023,157221,455),
  -- ODISHA
  ('Odisha','UR',2025,27313,525),('Odisha','UR',2024,25115,652),('Odisha','UR',2023,23610,610),('Odisha','UR',2022,22516,596),
  ('Odisha','OBC',2025,25668,528),('Odisha','OBC',2024,25212,651),('Odisha','OBC',2023,23549,610),('Odisha','OBC',2022,22490,596),
  ('Odisha','EWS',2025,30590,522),('Odisha','EWS',2024,26201,650),('Odisha','EWS',2023,24693,607),('Odisha','EWS',2022,22073,597),
  ('Odisha','SC',2025,138619,440),('Odisha','SC',2024,138639,549),('Odisha','SC',2023,127459,482),('Odisha','SC',2022,121247,455),
  ('Odisha','ST',2025,150856,433),('Odisha','ST',2024,159743,533),('Odisha','ST',2023,167675,446),('Odisha','ST',2022,151509,425),
  -- PONDICHERRY
  ('Pondicherry','UR',2025,26475,527),('Pondicherry','UR',2024,25167,652),('Pondicherry','UR',2023,16801,623),
  ('Pondicherry','OBC',2025,18356,538),('Pondicherry','OBC',2024,23741,654),('Pondicherry','OBC',2023,18751,620),
  ('Pondicherry','EWS',2025,26307,527),('Pondicherry','EWS',2024,26471,650),('Pondicherry','EWS',2023,21200,614),
  ('Pondicherry','SC',2025,139123,439),('Pondicherry','SC',2024,134502,552),('Pondicherry','SC',2023,127405,482),
  ('Pondicherry','ST',2025,164804,425),('Pondicherry','ST',2024,133791,569),('Pondicherry','ST',2023,167244,447),
  -- PUNJAB
  ('Punjab','UR',2025,26167,527),('Punjab','UR',2024,24800,652),('Punjab','UR',2023,23598,610),('Punjab','UR',2022,17948,606),
  ('Punjab','OBC',2025,26587,526),('Punjab','OBC',2024,25151,652),('Punjab','OBC',2023,22845,611),('Punjab','OBC',2022,22376,596),
  ('Punjab','EWS',2025,30372,522),('Punjab','EWS',2024,19705,660),('Punjab','EWS',2023,21129,614),('Punjab','EWS',2022,15022,614),
  ('Punjab','SC',2025,135201,442),('Punjab','SC',2024,128593,557),('Punjab','SC',2023,122672,486),('Punjab','SC',2022,86448,497),
  ('Punjab','ST',2025,154775,430),('Punjab','ST',2024,156695,535),('Punjab','ST',2023,120186,489),('Punjab','ST',2022,134544,441),
  -- RAJASTHAN
  ('Rajasthan','UR',2025,26500,526),('Rajasthan','UR',2024,19978,659),('Rajasthan','UR',2023,23630,610),('Rajasthan','UR',2022,22295,597),
  ('Rajasthan','OBC',2025,26445,527),('Rajasthan','OBC',2024,18373,661),('Rajasthan','OBC',2023,23150,610),('Rajasthan','OBC',2022,17330,608),
  ('Rajasthan','EWS',2025,18640,538),('Rajasthan','EWS',2024,20617,657),('Rajasthan','EWS',2023,24663,608),('Rajasthan','EWS',2022,22849,596),
  ('Rajasthan','SC',2025,136817,441),('Rajasthan','SC',2024,127188,558),('Rajasthan','SC',2023,123507,486),('Rajasthan','SC',2022,104448,475),
  ('Rajasthan','ST',2025,111274,457),('Rajasthan','ST',2024,129004,557),('Rajasthan','ST',2023,162273,451),('Rajasthan','ST',2022,129226,447),
  -- TAMIL NADU
  ('Tamil Nadu','UR',2025,26474,527),('Tamil Nadu','UR',2024,25194,652),('Tamil Nadu','UR',2023,23674,610),('Tamil Nadu','UR',2022,22675,596),
  ('Tamil Nadu','OBC',2025,26659,526),('Tamil Nadu','OBC',2024,21816,656),('Tamil Nadu','OBC',2023,23672,610),('Tamil Nadu','OBC',2022,22720,596),
  ('Tamil Nadu','EWS',2025,30921,521),('Tamil Nadu','EWS',2024,28698,647),('Tamil Nadu','EWS',2023,25005,607),('Tamil Nadu','EWS',2022,23501,595),
  ('Tamil Nadu','SC',2025,138462,440),('Tamil Nadu','SC',2024,137624,550),('Tamil Nadu','SC',2023,128892,480),('Tamil Nadu','SC',2022,122444,454),
  ('Tamil Nadu','ST',2025,164539,425),('Tamil Nadu','ST',2024,166849,527),('Tamil Nadu','ST',2023,169009,445),('Tamil Nadu','ST',2022,152724,423),
  -- TELANGANA
  ('Telangana','UR',2025,27235,526),('Telangana','UR',2024,25124,652),('Telangana','UR',2023,23560,610),('Telangana','UR',2022,22689,596),
  ('Telangana','OBC',2025,27277,525),('Telangana','OBC',2024,24993,652),('Telangana','OBC',2023,23569,610),('Telangana','OBC',2022,22719,596),
  ('Telangana','EWS',2025,29580,523),('Telangana','EWS',2024,28731,647),('Telangana','EWS',2023,24189,609),('Telangana','EWS',2022,22753,596),
  ('Telangana','SC',2025,138863,440),('Telangana','SC',2024,137400,550),('Telangana','SC',2023,127615,482),('Telangana','SC',2022,121948,456),
  ('Telangana','ST',2025,164465,425),('Telangana','ST',2024,167546,527),('Telangana','ST',2023,168731,445),('Telangana','ST',2022,148523,427),
  -- TRIPURA
  ('Tripura','UR',2025,27001,526),('Tripura','UR',2024,25019,652),('Tripura','UR',2023,21742,613),('Tripura','UR',2022,22347,597),
  ('Tripura','OBC',2025,25825,527),('Tripura','OBC',2024,24762,652),('Tripura','OBC',2023,22435,612),('Tripura','OBC',2022,21895,598),
  ('Tripura','EWS',2025,27007,526),('Tripura','EWS',2024,28061,648),('Tripura','EWS',2023,23648,610),('Tripura','EWS',2022,22992,595),
  ('Tripura','SC',2025,136300,441),('Tripura','SC',2024,131710,555),('Tripura','SC',2023,111081,497),('Tripura','SC',2022,114760,463),
  ('Tripura','ST',2025,164648,425),('Tripura','ST',2024,168407,526),('Tripura','ST',2023,152430,459),('Tripura','ST',2022,125167,451),
  -- UTTAR PRADESH
  ('Uttar Pradesh','UR',2025,26984,526),('Uttar Pradesh','UR',2024,22419,655),('Uttar Pradesh','UR',2023,23583,610),('Uttar Pradesh','UR',2022,22370,596),
  ('Uttar Pradesh','OBC',2025,27419,525),('Uttar Pradesh','OBC',2024,23861,654),('Uttar Pradesh','OBC',2023,22907,611),('Uttar Pradesh','OBC',2022,22440,596),
  ('Uttar Pradesh','EWS',2025,30810,521),('Uttar Pradesh','EWS',2024,21993,656),('Uttar Pradesh','EWS',2023,24025,609),('Uttar Pradesh','EWS',2022,23346,595),
  ('Uttar Pradesh','SC',2025,138523,440),('Uttar Pradesh','SC',2024,138004,550),('Uttar Pradesh','SC',2023,128213,481),('Uttar Pradesh','SC',2022,109358,469),
  ('Uttar Pradesh','ST',2025,163135,425),('Uttar Pradesh','ST',2024,136796,550),('Uttar Pradesh','ST',2023,164181,449),('Uttar Pradesh','ST',2022,150893,425),
  -- UTTARAKHAND
  ('Uttarakhand','UR',2025,26697,526),('Uttarakhand','UR',2024,19188,660),('Uttarakhand','UR',2023,23622,610),('Uttarakhand','UR',2022,21842,598),
  ('Uttarakhand','OBC',2025,26859,526),('Uttarakhand','OBC',2024,22076,656),('Uttarakhand','OBC',2023,23223,610),('Uttarakhand','OBC',2022,20167,601),
  ('Uttarakhand','EWS',2025,30491,522),('Uttarakhand','EWS',2024,19690,660),('Uttarakhand','EWS',2023,19220,618),('Uttarakhand','EWS',2022,23390,595),
  ('Uttarakhand','SC',2025,137197,441),('Uttarakhand','SC',2024,129699,556),('Uttarakhand','SC',2023,127661,482),('Uttarakhand','SC',2022,99509,480),
  ('Uttarakhand','ST',2025,159643,427),('Uttarakhand','ST',2024,160265,533),('Uttarakhand','ST',2023,126233,483),('Uttarakhand','ST',2022,138439,437),
  -- WEST BENGAL
  ('West Bengal','UR',2025,27296,525),('West Bengal','UR',2024,25123,652),('West Bengal','UR',2023,23398,610),('West Bengal','UR',2022,21304,599),
  ('West Bengal','OBC',2025,27406,525),('West Bengal','OBC',2024,25135,652),('West Bengal','OBC',2023,23410,610),('West Bengal','OBC',2022,22521,596),
  ('West Bengal','EWS',2025,30606,522),('West Bengal','EWS',2024,27298,650),('West Bengal','EWS',2023,23004,611),('West Bengal','EWS',2022,23278,595),
  ('West Bengal','SC',2025,137886,440),('West Bengal','SC',2024,138851,549),('West Bengal','SC',2023,126902,482),('West Bengal','SC',2022,121549,455),
  ('West Bengal','ST',2025,163931,425),('West Bengal','ST',2024,165708,529),('West Bengal','ST',2023,151899,460),('West Bengal','ST',2022,153436,423)
ON CONFLICT (state, category, year) DO UPDATE SET last_rank = EXCLUDED.last_rank, score = EXCLUDED.score;
