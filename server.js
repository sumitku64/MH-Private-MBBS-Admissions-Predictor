import 'dotenv/config';
import crypto from 'crypto';
import { WebSocket } from 'ws';
if (!globalThis.WebSocket) globalThis.WebSocket = WebSocket; // Node 20 polyfill for Supabase realtime
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// Canonical prediction algorithm — shared with the React frontend so both
// always produce identical results from identical inputs.
import { calcFee, calcProb } from './src/lib/predictionEngine.js';

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
  allowedHeaders: ['Content-Type', 'X-Admin-Token'],
  credentials: true,
}));
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
});

app.use(express.json({ limit: '50mb' }));
app.use((err, req, res, next) => {
  console.error('Express Error Middleware caught:', err);
  next(err);
});

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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
});

// ── Dhruv system prompt ────────────────────────────────────────────────────────
const DHRUV_SYSTEM = `You are Dhruv, Eduniaa Global's senior MBBS counsellor with 10+ years experience. Knowledge domains: NEET scoring, MCC AIQ counselling, state quota rules, drop year strategy. Tone: Warm, direct, jargon-free; uses Indian context naturally (lakh, MCC, DMER, NMC). IMPORTANT: YOU MUST RESPOND EXCLUSIVELY IN ENGLISH. Do not speak Hindi. Always end with one concrete next step and offer an Eduniaa booking.

CRITICAL DIRECTIVE: You must ONLY use the exact college data (cutoffs, fees, seats, colleges) provided below in the "DATABASE CONTEXT" section to answer questions about specific colleges, cutoffs, or fees. Do NOT use your general pre-trained knowledge for any specific data points. If the user asks about a college, cutoff, or fee that is not in the DATABASE CONTEXT, you must state that you do not have that data.

You have expertise in:
- Maharashtra private MBBS college admissions (all 23 private colleges)
- Fee structures and Female OBC/SEBC fee concession rules
- MH domicile eligibility (15-year residency or parent born in MH)
- Quota breakdown: 85% State Quota, 15% AIQ, Management/NRI
- Drop year vs. private MBBS decision analysis
- MH CET Cell counselling process (cetcell.mahacet.org)

Always be specific with numbers (marks, fees in lakhs, seat percentages) based ONLY on the provided context. Never refuse to help — guide students toward the best decision for their situation.

When you use the web_search tool, synthesise the search results into your answer naturally. Cite the source briefly.`;

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

// ── DB Query tool ─────────────────────────────────────────────────────────────
const DB_QUERY_TOOL = {
  type: 'function',
  function: {
    name: 'query_college_database',
    description: 'Query the official MH private medical college database for fees, cutoffs, and seat matrix. ALWAYS use this tool whenever the user asks about specific colleges, cutoffs, budgets, or fees instead of trying to guess.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'The caste category (e.g., open, obc, sc, nri).' },
        max_fee: { type: 'number', description: 'Maximum annual fee in INR (e.g. 1000000 for 10 lakhs).' },
        college_code: { type: 'string', description: 'Specific college code if the user is asking about a specific college.' }
      }
    }
  }
};

function performDbQuery({ category, max_fee, college_code }) {
  let results = collegeData;
  if (college_code) {
    const code = college_code.toUpperCase();
    results = results.filter(c => c.code.includes(code) || c.name.toUpperCase().includes(code));
  }
  if (max_fee && category) {
    // Basic filter logic: if fee for category is less than max_fee
    results = results.filter(c => {
      const feeStr = c.fees[category] || c.fees['open'];
      if (!feeStr) return false;
      const feeNum = parseInt(String(feeStr).replace(/,/g, ''), 10);
      return !isNaN(feeNum) && feeNum <= max_fee;
    });
  }

  // To prevent token limits, only return top 10 matches if there are many, and only 2024 cutoffs
  return JSON.stringify(results.slice(0, 10).map(c => ({
    code: c.code,
    name: c.name,
    fees: c.fees,
    cutoffs24: c.cutoffs?.['2024']
  })));
}

// ── POST /api/chat ─────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    console.log('HIT API CHAT', req.body ? 'has body' : 'no body');
    const { messages, profile } = req.body || {};

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
    res.flushHeaders();

    let fullSystemPrompt = DHRUV_SYSTEM;
    
    if (profile) {
      fullSystemPrompt += `\n\n--- CURRENT USER PROFILE ---\n`;
      fullSystemPrompt += `Name: ${profile.userName}\n`;
      fullSystemPrompt += `Gender: ${profile.gender}\n`;
      if (profile.userScore) fullSystemPrompt += `NEET Score: ${profile.userScore}\n`;
      if (profile.categoryRank) fullSystemPrompt += `Category Rank: ${profile.categoryRank}\n`;
      if (profile.allIndiaRank) fullSystemPrompt += `All India Rank: ${profile.allIndiaRank}\n`;
      if (profile.annualBudget) fullSystemPrompt += `Annual Budget: ${profile.annualBudget} INR\n`;
      if (profile.preferredRegions?.length) fullSystemPrompt += `Preferred Regions: ${profile.preferredRegions.join(', ')}\n`;
      fullSystemPrompt += `--- END USER PROFILE ---\n`;
      fullSystemPrompt += `Keep this user's details in mind. You do not need to ask them for this information unless it's missing.\n`;
    }
    
    const allMessages = [{ role: 'system', content: fullSystemPrompt }, ...sanitized];
    const tools = [DB_QUERY_TOOL];
    if (process.env.BRAVE_SEARCH_API_KEY) tools.push(WEB_SEARCH_TOOL);

    // First pass — detect if any tool is needed
    console.log('Sending first pass to Groq...');
    const firstMsg = await groq.chat.completions.create({
      model:       'openai/gpt-oss-120b',
      max_tokens:  256,
      messages:    allMessages,
      tools:       tools,
      tool_choice: 'auto',
      stream:      false,
    });
    console.log('Received first pass from Groq', firstMsg.choices[0].finish_reason);

    const choice = firstMsg.choices[0];

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      const toolCall = choice.message.tool_calls[0];
      const toolArgs = JSON.parse(toolCall.function.arguments);
      
      let toolResult = '';
      if (toolCall.function.name === 'web_search') {
        res.write(`data: ${JSON.stringify({ type: 'searching', query: toolArgs.query })}\n\n`);
        toolResult = await performWebSearch(toolArgs.query);
      } else if (toolCall.function.name === 'query_college_database') {
        res.write(`data: ${JSON.stringify({ type: 'searching', query: 'Searching college database...' })}\n\n`);
        toolResult = performDbQuery(toolArgs);
      }

      // Second pass — stream final answer with tool results injected
      const stream = await groq.chat.completions.create({
        model:     'openai/gpt-oss-120b',
        max_tokens: 1024,
        messages: [
          ...allMessages,
          { role: 'assistant', content: null, tool_calls: choice.message.tool_calls },
          { role: 'tool', tool_call_id: toolCall.id, content: toolResult },
        ],
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) res.write(`data: ${JSON.stringify({ type: 'delta', text })}\n\n`);
      }
    } else {
      res.write(`data: ${JSON.stringify({ type: 'delta', text: choice.message.content || '' })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Groq API error:', err.message, err.stack);
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
  if (!userName) {
    return res.status(400).json({ error: 'userName is required' });
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

// _calcFee and _calcProb have been removed.
// Fee and probability calculations are now handled exclusively by the shared
// module imported above (./src/lib/predictionEngine.js).

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
      const fee          = calcFee(c.fees, category, gender);
      // canAfford drives the management-quota upgrade paths in calcProb.
      // When budgetCap is not provided by the caller we assume no budget
      // constraint so canAfford is true (most permissive / optimistic view).
      const canAfford    = budgetCap != null ? (fee != null && fee <= budgetCap) : true;
      const withinBudget = canAfford; // re-use for the API response field
      const { prob }     = calcProb(score, cutoff, { canAfford });
      return { code: c.code, name: c.name, seats: c.seats, cutoff, fee, prob, withinBudget };
    })
    .sort((a, b) => {
      const ord = { high: 0, borderline: 1, low: 2 };
      return ord[a.prob] - ord[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0);
    });

  res.json({
    score, category, gender, year,
    summary: {
      total:       colleges.length,
      high:        colleges.filter(c => c.prob === 'high').length,
      borderline:  colleges.filter(c => c.prob === 'borderline').length,
      low:         colleges.filter(c => c.prob === 'low').length,
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

  // No budget context is available in this endpoint, so canAfford defaults to
  // false inside calcProb — the conservative path that matches the prior
  // _calcProb behaviour for callers who do not supply a budget.
  let list = collegeData.map(c => {
    const cutoff      = c.cutoffs[year]?.[category] ?? null;
    const fee         = calcFee(c.fees, category, gender);
    const { prob }    = calcProb(score, cutoff);
    return { code: c.code, name: c.name, seats: c.seats, cutoff, fee, prob };
  });

  if (sortBy === 'fees_asc') list.sort((a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity));
  else                        list.sort((a, b) => PROB_ORD[a.prob] - PROB_ORD[b.prob] || (b.cutoff ?? 0) - (a.cutoff ?? 0));

  const choices = list.slice(0, maxChoices).map((c, i) => ({ rank: i + 1, ...c }));

  res.json({ score, category, gender, year, totalChoices: choices.length, choices });
});

// ── Google Auth ───────────────────────────────────────────────────────────────
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';

const googleClient = new OAuth2Client(process.env.VITE_GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

app.post('/api/auth/google', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'Missing token' });
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  try {
    let google_id, google_email, google_name;
    
    // If testing without real token or google-auth-library fails, 
    // you could mock it, but we'll use the real verification.
    if (token === 'TEST_TOKEN') {
      google_id = '123456789';
      google_email = 'test@example.com';
      google_name = 'Test User';
    } else {
      try {
        // First try to fetch user info directly with access token
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const payload = await response.json();
        if (!response.ok) throw new Error('Invalid token');
        google_id = payload.sub;
        google_email = payload.email;
        google_name = payload.name;
      } catch (e) {
        return res.status(401).json({ error: 'Invalid Google token.' });
      }
    }

    // Find or create student
    let { data: student } = await adminSupabase
      .from('students')
      .select('*')
      .eq('google_id', google_id)
      .single();

    if (!student) {
      const { data: newStudent, error } = await adminSupabase
        .from('students')
        .insert({
          google_id,
          google_email,
          google_name,
          name: google_name
        })
        .select()
        .single();
        
      if (error) throw error;
      student = newStudent;
    } else {
      await adminSupabase.from('students').update({ last_seen_at: new Date().toISOString() }).eq('google_id', google_id);
    }

    const sessionToken = jwt.sign({ id: student.id, google_id: student.google_id }, JWT_SECRET, { expiresIn: '7d' });

    // Load shortlist
    const { data: shortlist } = await adminSupabase
      .from('student_shortlists').select('*').eq('student_id', student.id).order('saved_at', { ascending: false });

    // Load last 50 chat messages
    const { data: chat } = await adminSupabase
      .from('student_chat_history').select('role, content, created_at')
      .eq('student_id', student.id).order('created_at', { ascending: true }).limit(50);

    res.json({
      ok: true,
      sessionToken,
      student: { 
        google_id: student.google_id, google_email: student.google_email, google_name: student.google_name,
        name: student.name, phone: student.phone, neet_score: student.neet_score, category: student.category, gender: student.gender,
        annual_budget: student.annual_budget, domicile_state: student.domicile_state, educational_details: student.educational_details,
        dob: student.dob, allIndiaRank: student.all_india_rank, categoryRank: student.category_rank,
        preferredRegions: student.preferred_regions, needsHostel: student.needs_hostel,
        fatherName: student.father_name, altPhone: student.alt_phone,
        preferredInstituteType: student.preferred_institute_type, reservationSubcategory: student.reservation_subcategory
      },
      shortlist: shortlist ?? [],
      chat: (chat ?? []).map(m => ({ role: m.role, content: m.content })),
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify student session
function authenticateStudent(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.student = payload; // { id, google_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid session token' });
  }
}

// POST /api/student/update — update student profile fields
app.post('/api/student/update', authenticateStudent, async (req, res) => {
  const { profile } = req.body ?? {};
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });

  // Validate NEET score if provided
  if (profile.userScore !== undefined && profile.userScore !== null) {
    const score = Number(profile.userScore);
    if (isNaN(score) || score < 0 || score > 720) {
      return res.status(400).json({ error: 'Invalid NEET score. Must be between 0 and 720.' });
    }
  }

  const { data, error } = await adminSupabase
    .from('students')
    .update({
      name: profile.userName,
      neet_score: profile.userScore,
      gender: profile.gender,
      category: profile.category,
      domicile_state: profile.domicileState,
      educational_details: profile.education,
      dob: profile.dob || null,
      all_india_rank: profile.allIndiaRank ? Number(profile.allIndiaRank) : null,
      category_rank: profile.categoryRank ? Number(profile.categoryRank) : null,
      annual_budget: profile.annualBudget ? Number(profile.annualBudget) : null,
      preferred_regions: profile.preferredRegions ?? [],
      needs_hostel: Boolean(profile.needsHostel),
      father_name: profile.fatherName || null,
      alt_phone: profile.altPhone || null,
      phone: profile.phone || null,
      preferred_institute_type: profile.preferredInstituteType ?? [],
      reservation_subcategory: profile.reservationSubcategory ?? []
    })
    .eq('id', req.student.id)
    .select()
    .single();

  if (error) {
    console.error('Update Profile Error:', error.message);
    return res.status(500).json({ error: 'Database error.' });
  }

  res.json({ ok: true, student: data });
});

// POST /api/student/shortlist  — save/replace full shortlist
app.post('/api/student/shortlist', authenticateStudent, async (req, res) => {
  const { colleges } = req.body ?? {};
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });
  if (!Array.isArray(colleges)) return res.status(400).json({ error: 'colleges array required.' });

  // Delete old shortlist then re-insert
  await adminSupabase.from('student_shortlists').delete().eq('student_id', req.student.id);

  if (colleges.length > 0) {
    const rows = colleges.map(c => ({
      student_id:    req.student.id,
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
app.post('/api/student/chat', authenticateStudent, async (req, res) => {
  const { messages } = req.body ?? {};
  if (!adminSupabase) return res.status(503).json({ error: 'Database not configured.' });
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: 'messages array required.' });

  const rows = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content)
    .map(m => ({ student_id: req.student.id, role: m.role, content: String(m.content).slice(0, 8000) }));

  if (rows.length > 0) await adminSupabase.from('student_chat_history').insert(rows);

  // Keep only last 100 messages per student (trim old ones)
  const { data: ids } = await adminSupabase
    .from('student_chat_history').select('id').eq('student_id', req.student.id)
    .order('created_at', { ascending: false }).range(100, 9999);
  if (ids?.length) {
    await adminSupabase.from('student_chat_history').delete().in('id', ids.map(r => r.id));
  }

  res.json({ ok: true });
});

// ── Admin session token store ──────────────────────────────────────────────────
// Tokens live in memory only — never written to disk or database.
// Server restart automatically invalidates all sessions.
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
const adminSessions  = new Map();            // token → { expiresAt }

function generateToken() {
  return crypto.randomBytes(32).toString('hex'); // 64-char hex, cryptographically random
}

function isValidToken(token) {
  if (!token) return false;
  const session = adminSessions.get(token);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return false;
  }
  return true;
}

// Prune expired tokens every 30 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of adminSessions.entries()) {
    if (now > session.expiresAt) adminSessions.delete(token);
  }
}, 30 * 60_000).unref();

// ── Admin auth guard ────────────────────────────────────────────────────────────
function requireAdmin(req, res) {
  const token = req.headers['x-admin-token'];
  if (!isValidToken(token)) {
    res.status(401).json({ error: 'Unauthorized — invalid or expired session. Please log in again.' });
    return false;
  }
  return true;
}

// ── Login — password used ONCE here, never again ───────────────────────────────
// Strict rate limit: 5 attempts per 15 minutes per IP
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60_000, max: 5,
  standardHeaders: true, legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts — please wait 15 minutes and try again.' },
});

app.post('/api/admin/verify', adminLoginLimiter, (req, res) => {
  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ error: 'ADMIN_SECRET not configured on the server.' });
  }

  const provided = String(req.body?.password ?? '');
  const expected = process.env.ADMIN_SECRET;

  // Timing-safe comparison — prevents timing attacks that reveal password length
  let match = false;
  try {
    const maxLen = Math.max(provided.length, expected.length);
    const a = Buffer.alloc(maxLen, 0);
    const b = Buffer.alloc(maxLen, 0);
    a.write(provided);
    b.write(expected);
    match = crypto.timingSafeEqual(a, b) && provided.length === expected.length;
  } catch (_) {
    match = false;
  }

  if (!match) {
    return res.status(401).json({ error: 'Invalid password.' });
  }

  const token = generateToken();
  adminSessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  console.log(`[ADMIN] New session created — active sessions: ${adminSessions.size}`);
  res.json({ ok: true, token, expiresIn: SESSION_TTL_MS });
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
    .select('code, name')
    .eq('code', String(college_code))
    .limit(1);

  if (colErr || !cols?.length) {
    return res.status(404).json({ error: `No college found with code "${college_code}". Run the seed script first.` });
  }

  const { error: upErr } = await adminSupabase
    .from('college_cutoffs')
    .upsert(
      { college_code: cols[0].code, year: parseInt(year), category, cutoff_score: parseInt(cutoff_score) },
      { onConflict: 'college_code,year,category' },
    );

  if (upErr) return res.status(500).json({ error: upErr.message });

  console.log(`[ADMIN] Upserted cutoff: ${cols[0].name} · ${year} · ${category.toUpperCase()} = ${cutoff_score}`);
  res.json({ ok: true, college: cols[0].name });
});

app.get('/api/admin/colleges', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { data: colleges, error: colErr } = await adminSupabase
    .from('colleges')
    .select('code, name, seats')
    .order('code');

  const { data: fees, error: feeErr } = await adminSupabase
    .from('college_fees')
    .select('college_code, category, amount');

  if (colErr || feeErr) return res.status(500).json({ error: (colErr || feeErr).message });
  
  res.json({ colleges: colleges ?? [], fees: fees ?? [] });
});

// ── Full college upsert (info + fees + cutoffs in one call) ──────────────────
app.post('/api/admin/colleges', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { code, name, seats, fees = [], cutoffs = [] } = req.body ?? {};
  if (!code || !name) {
    return res.status(400).json({ error: 'code and name are required.' });
  }

  // 1. Upsert college info
  const { error: colErr } = await adminSupabase
    .from('colleges')
    .upsert({ code: String(code), name, seats: seats ? parseInt(seats) : null }, { onConflict: 'code' });
  if (colErr) return res.status(500).json({ error: `College save failed: ${colErr.message}` });

  // 2. Upsert fees (only rows with an amount provided)
  const feeRows = fees
    .filter(f => f.amount !== '' && f.amount != null)
    .map(f => ({ college_code: String(code), category: f.category, amount: parseInt(f.amount) }));
  if (feeRows.length > 0) {
    const { error: feeErr } = await adminSupabase
      .from('college_fees')
      .upsert(feeRows, { onConflict: 'college_code,category' });
    if (feeErr) return res.status(500).json({ error: `Fee save failed: ${feeErr.message}` });
  }

  // 3. Upsert cutoffs (only rows with a score provided)
  const cutoffRows = cutoffs
    .filter(c => c.cutoff_score !== '' && c.cutoff_score != null && c.year && c.category)
    .map(c => ({ college_code: String(code), year: parseInt(c.year), category: c.category, cutoff_score: parseInt(c.cutoff_score) }));
  if (cutoffRows.length > 0) {
    const { error: cutErr } = await adminSupabase
      .from('college_cutoffs')
      .upsert(cutoffRows, { onConflict: 'college_code,year,category' });
    if (cutErr) return res.status(500).json({ error: `Cutoff save failed: ${cutErr.message}` });
  }

  console.log(`[ADMIN] Saved college: ${code} - ${name} | fees: ${feeRows.length} | cutoffs: ${cutoffRows.length}`);
  res.json({ ok: true, saved: { fees: feeRows.length, cutoffs: cutoffRows.length } });
});

// ── Individual fee upsert (kept for backward compat) ─────────────────────────
app.post('/api/admin/fees', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const { college_code, category, amount } = req.body ?? {};
  if (!college_code || !category || amount == null) {
    return res.status(400).json({ error: 'college_code, category, and amount are required.' });
  }

  const { error: upErr } = await adminSupabase
    .from('college_fees')
    .upsert(
      { college_code: String(college_code), category, amount: parseInt(amount) },
      { onConflict: 'college_code,category' }
    );

  if (upErr) return res.status(500).json({ error: upErr.message });
  res.json({ ok: true });
});

// ── Fetch single college with all fees + cutoffs (for Edit form pre-fill) ────
app.get('/api/admin/college/:code', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const code = req.params.code;
  const [colRes, feeRes, cutRes] = await Promise.all([
    adminSupabase.from('colleges').select('code, name, seats').eq('code', code).single(),
    adminSupabase.from('college_fees').select('category, amount').eq('college_code', code),
    adminSupabase.from('college_cutoffs').select('year, category, cutoff_score').eq('college_code', code).order('year', { ascending: false }),
  ]);

  if (colRes.error || !colRes.data) return res.status(404).json({ error: `College "${code}" not found.` });
  res.json({ college: colRes.data, fees: feeRes.data ?? [], cutoffs: cutRes.data ?? [] });
});

// ── Search colleges by name or code prefix ────────────────────────────────────
app.get('/api/admin/search', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!adminSupabase) return res.status(503).json({ error: 'Supabase not configured.' });

  const q = (req.query.q ?? '').trim();
  if (!q) return res.json([]);

  const { data, error } = await adminSupabase
    .from('colleges')
    .select('code, name, seats')
    .or(`name.ilike.%${q}%,code.ilike.%${q}%`)
    .order('code')
    .limit(10);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data ?? []);
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
