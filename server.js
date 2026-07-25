import 'dotenv/config';
import { WebSocket } from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket; // Node 20 polyfill for Supabase realtime
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// ── CORS — supports comma-separated list of origins, or '*' for all ───────────
const CORS_ORIGINS = (process.env.CORS_ORIGIN ?? '*')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow server-to-server (no origin), wildcard, or exact match
    if (!origin || CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: origin "${origin}" not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Admin-Password'],
  credentials: true,
}));

app.use(express.json());

// ── Clients ────────────────────────────────────────────────────────────────────
const groq = new OpenAI({
  apiKey:  process.env.GROQ_API_KEY ?? '',
  baseURL: 'https://api.groq.com/openai/v1',
});

const adminSupabase = process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY
  ? createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
  : null;

// ── College data loaded from Supabase at startup (replaces static data.js) ────
let collegeData = [];
async function loadCollegeData() {
  if (!adminSupabase) return;
  const [colRes, feeRes, cutRes] = await Promise.all([
    adminSupabase.from('colleges').select('code, name, seats').order('code'),
    adminSupabase.from('college_fees').select('college_code, category, amount'),
    adminSupabase.from('college_cutoffs').select('college_code, year, category, cutoff_score'),
  ]);
  if (!colRes.data?.length) return;
  collegeData = colRes.data.map(c => ({
    code:  c.code,
    name:  c.name,
    seats: c.seats,
    fees:  Object.fromEntries(
      (feeRes.data ?? []).filter(f => f.college_code === c.code).map(f => [f.category, f.amount])
    ),
    cutoffs: (cutRes.data ?? [])
      .filter(ct => ct.college_code === c.code)
      .reduce((acc, ct) => {
        if (!acc[ct.year]) acc[ct.year] = {};
        acc[ct.year][ct.category] = ct.cutoff_score;
        return acc;
      }, {}),
  }));
}
loadCollegeData().catch(err => console.error('[college-data] load failed:', err.message));

// ── Rate limiters ──────────────────────────────────────────────────────────────
const chatLimiter = rateLimit({
  windowMs: 60_000, max: 10,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests — please wait a minute and try again.' },
});

// ── Dhruv system prompt ────────────────────────────────────────────────────────
const DHRUV_SYSTEM = `You are Dhruv, Eduniaa Global's senior MBBS counsellor with 10+ years experience. Knowledge domains: NEET scoring, MCC AIQ counselling, state quota rules, drop year strategy. Tone: Warm, direct, jargon-free; uses Indian context naturally (lakh, MCC, DMER, NMC). Always end with one concrete next step and offer an Eduniaa booking.

You have deep expertise in:
- Maharashtra private MBBS college admissions (all 23 private colleges)
- NEET 2024/2025 cutoffs by college, category, and quota
- Fee structures: Open, OBC, SEBC, VJNT, SC, ST, EWS, NRI categories
- Female OBC/SEBC fee concession rules
- MH domicile eligibility (15-year residency or parent born in MH)
- Quota breakdown: 85% State Quota, 15% AIQ, Management/NRI
- Drop year vs. private MBBS decision analysis
- MH CET Cell counselling process (cetcell.mahacet.org)
- Document checklist for admissions

Always be specific with numbers (marks, fees in lakhs, seat percentages). If you don't know a precise figure, give a realistic range based on historical data. Never refuse to help — guide students toward the best decision for their situation.

When you use the web_search tool, synthesise the search results into your answer naturally. Cite the source briefly (e.g. "per MCC's latest notification"). If results are inconclusive, say so and give your best estimate from training data.`;

// ── Web search tool — OpenAI/Groq format ─────────────────────────────────────
const WEB_SEARCH_TOOL = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the internet for current NEET counselling schedules, MCC/CET Cell announcements, official cutoff lists, and recent MBBS admissions news. Use this when the user asks about live dates, registration windows, official notifications, or recent policy changes.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'A focused, specific search query' },
      },
      required: ['query'],
    },
  },
};

async function performWebSearch(query) {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) {
    return 'Web search is not configured on this server (BRAVE_SEARCH_API_KEY not set). Please answer based on your training knowledge and indicate that you cannot access live data.';
  }
  try {
    const r = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`,
      { headers: { Accept: 'application/json', 'X-Subscription-Token': key } },
    );
    if (!r.ok) return `Search API returned HTTP ${r.status}. Please answer from training data.`;
    const data = await r.json();
    const results = data.web?.results?.slice(0, 5) ?? [];
    if (!results.length) return 'No results found. Please answer from training data.';
    return results.map(x => `• ${x.title}\n  ${x.description ?? ''}\n  Source: ${x.url}`).join('\n\n');
  } catch (e) {
    return `Search failed: ${e.message}. Please answer from training data.`;
  }
}

// ── POST /api/chat ─────────────────────────────────────────────────────────────
app.post('/api/chat', chatLimiter, async (req, res) => {
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const sanitized = messages
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 4000) }));

  if (sanitized.length === 0) {
    return res.status(400).json({ error: 'No valid messages' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const allMessages = [{ role: 'system', content: DHRUV_SYSTEM }, ...sanitized];
    const hasBrave = !!process.env.BRAVE_SEARCH_API_KEY;

    if (hasBrave) {
      // First pass — detect if web search is needed
      const firstMsg = await groq.chat.completions.create({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  256,
        messages:    allMessages,
        tools:       [WEB_SEARCH_TOOL],
        tool_choice: 'auto',
        stream:      false,
      });

      const choice = firstMsg.choices[0];

      if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
        const toolCall = choice.message.tool_calls[0];
        const { query } = JSON.parse(toolCall.function.arguments);

        res.write(`data: ${JSON.stringify({ type: 'searching', query })}\n\n`);
        const searchResults = await performWebSearch(query);

        // Second pass — stream final answer with search results injected
        const stream = await groq.chat.completions.create({
          model:     'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: [
            ...allMessages,
            { role: 'assistant', content: null, tool_calls: choice.message.tool_calls },
            { role: 'tool', tool_call_id: toolCall.id, content: searchResults },
          ],
          stream: true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
        }
      } else {
        // No search needed — stream the first response directly
        const stream = await groq.chat.completions.create({
          model:      'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages:   allMessages,
          stream:     true,
        });

        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
        }
      }
    } else {
      // No Brave key — skip tool detection, stream directly
      const stream = await groq.chat.completions.create({
        model:      'llama-3.3-70b-versatile',
        max_tokens: 1024,
        messages:   allMessages,
        stream:     true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Groq API error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'AI service error' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Something went wrong. Please try again.' })}\n\n`);
      res.end();
    }
  }
});

// ── POST /api/leads ────────────────────────────────────────────────────────────
app.post('/api/leads', async (req, res) => {
  const { userName, phone, userScore, tool, timestamp } = req.body ?? {};
  if (!userName || !phone) {
    return res.status(400).json({ error: 'userName and phone are required' });
  }

  console.log(
    '[CRM TELEMETRY READY]: Student lead packet generated. Formatted for HubSpot/Zoho synchronization.',
    JSON.stringify({ userName, phone, userScore: userScore ?? null, tool: tool ?? 'unknown', timestamp: timestamp ?? new Date().toISOString() }, null, 2),
  );

  if (adminSupabase) {
    try {
      await adminSupabase.from('leads').insert({
        user_name:  userName,
        phone,
        user_score: userScore ?? null,
        tool:       tool ?? 'unknown',
      });
    } catch (e) {
      console.error('Supabase leads write failed:', e.message);
    }
  }

  res.json({ ok: true });
});

// ── POST /api/alerts (Item 5) ─────────────────────────────────────────────────
app.post('/api/alerts', (req, res) => {
  const { phone, category, round } = req.body ?? {};
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length !== 10) {
    return res.status(400).json({ error: 'Valid 10-digit WhatsApp number is required.' });
  }
  console.log('[WHATSAPP ALERT REGISTERED]:', JSON.stringify({
    phone:        digits,
    category:     category ?? 'open',
    round:        round ?? 'mop-up',
    subscribedAt: new Date().toISOString(),
    channel:      'WhatsApp — stray vacancy notification queue',
  }, null, 2));
  res.json({ ok: true });
});

// ── Shared calculation helpers (used by REST API endpoints below) ──────────────
function _calcFee(fees, category, gender) {
  if (category === 'sc' || category === 'st') return fees.sc_st;
  if (category === 'vjnt')                    return fees.vjnt_sbc;
  if ((category === 'obc' || category === 'sebc') && gender === 'female') return fees.obc_ebc_sebc_female;
  if (category === 'obc' || category === 'sebc') return fees.obc_ebc_sebc_male;
  return fees.open;
}

function _calcProb(score, cutoff) {
  if (!cutoff) return 'low';
  if (score >= cutoff)                      return 'high';
  if (score >= Math.round(cutoff * 0.92))  return 'borderline';
  return 'low';
}

function _calcDomicileStatus(birthState, cls10, cls12, domicileCert) {
  if (domicileCert === 'Maharashtra')                         return 'ELIGIBLE';
  const bornMH  = birthState === 'Maharashtra';
  const bothMH  = cls10 === 'Maharashtra' && cls12 === 'Maharashtra';
  const only12  = cls12  === 'Maharashtra';
  if (bornMH && bothMH) return 'STRONG_CONDITIONAL';
  if (bornMH || bothMH) return 'CONDITIONAL';
  if (only12)           return 'PARTIAL';
  return 'NOT_ELIGIBLE';
}

// ── REST API — external integration layer (Item 1) ────────────────────────────
// These endpoints mirror the frontend calculations for mobile apps, partner
// websites, and API consumers. The React frontend continues to compute locally
// for zero-latency UX; these are NOT called by the frontend itself.

// POST /api/predict/colleges
app.post('/api/predict/colleges', (req, res) => {
  const { score, category = 'open', gender = 'male', year = 2024, budgetCap } = req.body ?? {};
  if (typeof score !== 'number') {
    return res.status(400).json({ error: 'score (number) is required' });
  }

  const colleges = collegeData
    .map(c => {
      const cutoff       = c.cutoffs[year]?.[category] ?? null;
      const fee          = _calcFee(c.fees, category, gender);
      const prob         = _calcProb(score, cutoff);
      const withinBudget = budgetCap != null ? (fee != null && fee <= budgetCap) : true;
      return { code: c.code, name: c.name, seats: c.seats, cutoff, fee, prob, withinBudget };
    })
    .sort((a, b) => {
      const ord = { high: 0, borderline: 1, low: 2 };
      return ord[a.prob] - ord[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0);
    });

  res.json({
    score, category, gender, year,
    summary: {
      total:      colleges.length,
      high:       colleges.filter(c => c.prob === 'high').length,
      borderline: colleges.filter(c => c.prob === 'borderline').length,
      low:        colleges.filter(c => c.prob === 'low').length,
      withinBudget: budgetCap != null ? colleges.filter(c => c.withinBudget).length : null,
    },
    colleges,
  });
});

// GET /api/states/:state/quotas
app.get('/api/states/:state/quotas', (req, res) => {
  const { state } = req.params;
  const { category = 'open', gender = 'male', cls10 = '', cls12 = '', domicileCert = 'None' } = req.query;

  const domStatus   = _calcDomicileStatus(state, cls10, cls12, domicileCert);
  const isEligible  = ['ELIGIBLE', 'STRONG_CONDITIONAL'].includes(domStatus);
  const isCond      = ['CONDITIONAL', 'PARTIAL'].includes(domStatus);
  const isReserved  = ['obc','sebc','vjnt','sc','st'].includes(category);

  res.json({
    birthState: state, cls10, cls12, domicileCert, category, gender,
    domicileStatus: domStatus,
    quotas: {
      mh_state_quota_open:     category !== 'nri' ? (isEligible ? 'eligible' : isCond ? 'conditional' : 'ineligible') : 'ineligible',
      mh_state_quota_reserved: isReserved && category !== 'nri' ? (isEligible ? 'eligible' : isCond ? 'conditional' : 'ineligible') : 'not_applicable',
      all_india_quota:         category !== 'nri' ? 'eligible' : 'ineligible',
      management_quota:        'eligible',
      nri_quota:               category === 'nri' ? 'eligible' : 'not_applicable',
    },
    feeConcession: gender === 'female' && (category === 'obc' || category === 'sebc') ? 'female_obc_sebc_concession' : null,
  });
});

// POST /api/tools/roicalc
app.post('/api/tools/roicalc', (req, res) => {
  const { totalFee = 7500000, downPayment = 500000, annualRate = 9, loanTenureYears = 10 } = req.body ?? {};
  const principal = totalFee - downPayment;
  const r = annualRate / 100 / 12;
  const n = loanTenureYears * 12;
  const emi = r > 0
    ? principal * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
    : principal / n;
  const totalLoanRepaid = Math.round(emi * n);
  const totalInvestment = downPayment + totalLoanRepaid;

  res.json({
    inputs: { totalFee, downPayment, annualRate, loanTenureYears },
    emi:               Math.round(emi),
    loanPrincipal:     principal,
    totalLoanRepaid,
    totalInvestment,
    note: 'EMI uses standard reducing-balance formula. Salary projections not included — use /api/tools/roicalc with your own horizon calculations.',
  });
});

// POST /api/tools/choicefill
app.post('/api/tools/choicefill', (req, res) => {
  const { score, category = 'open', gender = 'male', year = 2024, maxChoices = 10, sortBy = 'probability' } = req.body ?? {};
  if (typeof score !== 'number') {
    return res.status(400).json({ error: 'score (number) is required' });
  }

  const PROB_ORD = { high: 0, borderline: 1, low: 2 };

  let list = collegeData.map(c => ({
    code:   c.code,
    name:   c.name,
    seats:  c.seats,
    cutoff: c.cutoffs[year]?.[category] ?? null,
    fee:    _calcFee(c.fees, category, gender),
    prob:   _calcProb(score, c.cutoffs[year]?.[category] ?? null),
  }));

  if (sortBy === 'fees_asc') list.sort((a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity));
  else                        list.sort((a, b) => PROB_ORD[a.prob] - PROB_ORD[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0));

  const choices = list.slice(0, maxChoices).map((c, i) => ({ rank: i + 1, ...c }));

  res.json({ score, category, gender, year, totalChoices: choices.length, choices });
});

// ── Student Auth helpers ───────────────────────────────────────────────────────
function genPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function verifyStudent(phone, pin) {
  if (!adminSupabase) return null;
  const { data } = await adminSupabase
    .from('students')
    .select('*')
    .eq('phone', phone)
    .eq('pin', pin)
    .single();
  return data ?? null;
}

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  const { name, phone, neet_score, category, gender } = req.body ?? {};
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!name?.trim() || digits.length !== 10) {
    return res.status(400).json({ error: 'name and valid 10-digit phone are required.' });
  }
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  // Check if already registered
  const { data: existing } = await adminSupabase
    .from('students').select('phone, pin').eq('phone', digits).single();

  if (existing) {
    return res.status(409).json({ error: 'Phone already registered. Please login with your PIN.' });
  }

  const pin = genPin();
  const { data: student, error } = await adminSupabase
    .from('students')
    .insert({ name: name.trim(), phone: digits, neet_score: neet_score ?? null, category: category ?? 'open', gender: gender ?? 'any', pin })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Also save as lead
  try {
    await adminSupabase.from('leads').insert({
      user_name: name.trim(), phone: digits, user_score: neet_score ?? null, tool: 'register',
    });
  } catch (err) {}

  res.json({ ok: true, pin, student: { name: student.name, phone: student.phone, neet_score: student.neet_score, category: student.category, gender: student.gender } });
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { phone, pin } = req.body ?? {};
  const digits = (phone ?? '').replace(/\D/g, '');
  if (digits.length !== 10 || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required.' });
  }
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  const student = await verifyStudent(digits, String(pin));
  if (!student) return res.status(401).json({ error: 'Invalid phone or PIN.' });

  // Update last_seen
  await adminSupabase.from('students').update({ last_seen_at: new Date().toISOString() }).eq('phone', digits);

  // Load shortlist
  const { data: shortlist } = await adminSupabase
    .from('student_shortlists').select('*').eq('student_phone', digits).order('saved_at', { ascending: false });

  // Load last 50 chat messages
  const { data: chat } = await adminSupabase
    .from('student_chat_history').select('role, content, created_at')
    .eq('student_phone', digits).order('created_at', { ascending: true }).limit(50);

  res.json({
    ok: true,
    student: { name: student.name, phone: student.phone, neet_score: student.neet_score, category: student.category, gender: student.gender },
    shortlist: shortlist ?? [],
    chat: (chat ?? []).map(m => ({ role: m.role, content: m.content })),
  });
});

// POST /api/student/shortlist  — save/replace full shortlist
app.post('/api/student/shortlist', async (req, res) => {
  const { phone, pin, colleges } = req.body ?? {};
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  const student = await verifyStudent(digits, String(pin ?? ''));
  if (!student) return res.status(401).json({ error: 'Invalid phone or PIN.' });
  if (!Array.isArray(colleges)) return res.status(400).json({ error: 'colleges array required.' });

  // Delete old shortlist then re-insert
  await adminSupabase.from('student_shortlists').delete().eq('student_phone', digits);

  if (colleges.length > 0) {
    const rows = colleges.map(c => ({
      student_phone: digits,
      college_code:  c.code,
      college_name:  c.name ?? null,
      probability:   c.prob ?? null,
      fee:           c.fee ?? null,
      cutoff:        c.cutoff ?? null,
    }));
    await adminSupabase.from('student_shortlists').insert(rows);
  }

  res.json({ ok: true, saved: colleges.length });
});

// POST /api/student/chat  — append chat messages
app.post('/api/student/chat', async (req, res) => {
  const { phone, pin, messages } = req.body ?? {};
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  const student = await verifyStudent(digits, String(pin ?? ''));
  if (!student) return res.status(401).json({ error: 'Invalid phone or PIN.' });
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required.' });

  const rows = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ student_phone: digits, role: m.role, content: String(m.content).slice(0, 8000) }));

  if (rows.length > 0) await adminSupabase.from('student_chat_history').insert(rows);

  // Keep only last 100 messages per student (trim old ones)
  const { data: ids } = await adminSupabase
    .from('student_chat_history').select('id').eq('student_phone', digits)
    .order('created_at', { ascending: false }).range(100, 9999);
  if (ids?.length) {
    await adminSupabase.from('student_chat_history').delete().in('id', ids.map(r => r.id));
  }

  res.json({ ok: true });
});

// ── Admin helpers ──────────────────────────────────────────────────────────────

function requireAdmin(req, res) {
  const pwd = req.headers['x-admin-password'] ?? req.body?.password;
  if (!process.env.ADMIN_SECRET) {
    res.status(503).json({ error: 'ADMIN_SECRET not set in environment.' });
    return false;
  }
  if (pwd !== process.env.ADMIN_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

app.post('/api/admin/verify', (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ ok: true });
});

app.get('/api/admin/data', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured (SUPABASE_SERVICE_KEY missing).' });

  const year = parseInt(req.query.year ?? '2025');
  const { data, error } = await adminSupabase
    .from('college_cutoffs')
    .select('*, colleges(code, name)')
    .eq('year', year)
    .order('cutoff_score', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

app.get('/api/admin/leads', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { data, error } = await adminSupabase
    .from('leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
});

app.post('/api/admin/cutoffs', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { college_code, year, category, cutoff_score } = req.body ?? {};
  if (!college_code || !year || !category || !cutoff_score) {
    return res.status(400).json({ error: 'college_code, year, category, and cutoff_score are required.' });
  }

  const { data: cols, error: colErr } = await adminSupabase
    .from('colleges')
    .select('id, name')
    .eq('code', String(college_code))
    .limit(1);

  if (colErr || !cols?.length) {
    return res.status(404).json({ error: `No college found with code "${college_code}". Run the seed script first.` });
  }

  const { error: upErr } = await adminSupabase
    .from('college_cutoffs')
    .upsert(
      { college_id: cols[0].id, year: parseInt(year), category, cutoff_score: parseInt(cutoff_score) },
      { onConflict: 'college_id,year,category' },
    );

  if (upErr) return res.status(500).json({ error: upErr.message });

  console.log(`[ADMIN] Upserted cutoff: ${cols[0].name} · ${year} · ${category.toUpperCase()} = ${cutoff_score}`);
  res.json({ ok: true, college: cols[0].name });
});

// ── Health check (used by Railway) ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), ts: new Date().toISOString() });
});

// ── Production static serving (only when frontend is co-located) ──────────────
// Disabled: frontend is served from Vercel; backend is API-only on Railway.
// if (process.env.NODE_ENV === 'production') {
//   app.use(express.static(path.join(__dirname, 'dist')));
//   app.get('/{*splat}', (_req, res) => {
//     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
//   });
// }

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Dhruv backend running on http://localhost:${PORT}`));
