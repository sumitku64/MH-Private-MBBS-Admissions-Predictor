import { useState } from 'react';
import jsPDF from 'jspdf';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman & Nicobar Islands', 'Chandigarh', 'D&NH and D&D', 'Delhi (NCT)',
  'Lakshadweep', 'Puducherry', 'Jammu & Kashmir', 'Ladakh', 'Outside India',
];

const CATEGORIES = [
  { value: 'open', label: 'Open / General' },
  { value: 'obc',  label: 'OBC' },
  { value: 'sebc', label: 'SEBC (Maratha)' },
  { value: 'vjnt', label: 'VJNT / NT / SBC' },
  { value: 'sc',   label: 'SC (Scheduled Caste)' },
  { value: 'st',   label: 'ST (Scheduled Tribe)' },
  { value: 'ews',  label: 'EWS' },
  { value: 'nri',  label: 'NRI / OCI / PIO' },
];

const RESERVATION_TABLE = [
  { cat: 'Open',           pct: '50%',  seats: '~75 per college' },
  { cat: 'OBC',            pct: '19%',  seats: '~28 per college' },
  { cat: 'SEBC (Maratha)', pct: '10%',  seats: '~15 per college*' },
  { cat: 'VJNT + NT + SBC',pct: '11%',  seats: '~16 per college' },
  { cat: 'SC',             pct: '13%',  seats: '~19 per college' },
  { cat: 'ST',             pct: '7%',   seats: '~10 per college' },
];

function getDomicileStatus(birthState, cls10, cls12, domicileCert) {
  if (domicileCert === 'Maharashtra') return 'ELIGIBLE';
  const bornMH       = birthState === 'Maharashtra';
  const bothSchoolMH = cls10 === 'Maharashtra' && cls12 === 'Maharashtra';
  const only12MH     = cls12 === 'Maharashtra';
  if (bornMH && bothSchoolMH) return 'STRONG_CONDITIONAL';
  if (bornMH || bothSchoolMH) return 'CONDITIONAL';
  if (only12MH)               return 'PARTIAL';
  return 'NOT_ELIGIBLE';
}

const STATUS_META = {
  ELIGIBLE: {
    icon: '✅',
    label: 'Fully Eligible — MH Domicile Confirmed',
    bar: 'bg-emerald-50 border-emerald-300 text-emerald-900',
    desc: 'You hold an MH Domicile Certificate. You have access to the full MH State Quota (85% of all private MBBS seats).',
  },
  STRONG_CONDITIONAL: {
    icon: '🟢',
    label: 'Very Strong Case — Apply for Certificate Immediately',
    bar: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    desc: 'Born in Maharashtra and completed schooling here — you have an extremely strong domicile claim. Apply at Tehsildar immediately; approval is typically straightforward.',
  },
  CONDITIONAL: {
    icon: '⚠️',
    label: 'Conditionally Eligible — Must Obtain MH Domicile Certificate',
    bar: 'bg-amber-50 border-amber-300 text-amber-900',
    desc: 'You appear to meet MH domicile eligibility criteria but do not yet hold the certificate. Apply at your local Tehsildar\'s office now. Processing: 15–30 days.',
  },
  PARTIAL: {
    icon: '⚠️',
    label: 'Partial — Class 12 in MH Alone Is Insufficient',
    bar: 'bg-amber-50 border-amber-200 text-amber-900',
    desc: 'Studying Class 12 in Maharashtra alone without 15 cumulative years of residence or MH parentage typically does not meet domicile criteria. Consult an Eduniaa counsellor for a case-by-case assessment.',
  },
  NOT_ELIGIBLE: {
    icon: '❌',
    label: 'Not Eligible for MH State Quota',
    bar: 'bg-rose-50 border-rose-300 text-rose-900',
    desc: 'You do not meet MH domicile criteria based on the information provided. You can still access 15% AIQ seats and Management Quota seats nationally — no domicile required.',
  },
};

const FULLY_ELIGIBLE   = new Set(['ELIGIBLE', 'STRONG_CONDITIONAL']);
const COND_ELIGIBLE    = new Set(['CONDITIONAL', 'PARTIAL']);

function EligibilityIcon({ status }) {
  if (status === 'yes')
    return <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center shrink-0"><span className="text-emerald-600 text-[10px] font-black">✓</span></div>;
  if (status === 'conditional')
    return <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center shrink-0"><span className="text-amber-600 text-[10px] font-black">~</span></div>;
  if (status === 'dim')
    return <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0"><span className="text-slate-400 text-[10px] font-black">—</span></div>;
  return <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0"><span className="text-rose-500 text-[10px] font-black">✗</span></div>;
}

const SELECT_CLS = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white';

export default function DomicileMatrix() {
  const [birthState,   setBirthState]   = useState('');
  const [cls10,        setCls10]        = useState('');
  const [cls12,        setCls12]        = useState('');
  const [domicileCert, setDomicileCert] = useState('');
  const [category,     setCategory]     = useState('');
  const [gender,       setGender]       = useState('male');
  const [submitted,    setSubmitted]    = useState(false);

  const ready = domicileCert !== '' && category !== '';

  const domStatus = submitted ? getDomicileStatus(birthState, cls10, cls12, domicileCert) : null;
  const meta = domStatus ? STATUS_META[domStatus] : null;

  const isNRI      = category === 'nri';
  const isReserved = ['obc', 'sebc', 'vjnt', 'sc', 'st'].includes(category);
  const femaleConcession = gender === 'female' && (category === 'obc' || category === 'sebc');

  const stateEligible = FULLY_ELIGIBLE.has(domStatus)
    ? 'yes'
    : COND_ELIGIBLE.has(domStatus)
    ? 'conditional'
    : 'no';

  const quotaRows = submitted ? [
    {
      quota: 'MH State Quota — Open Seats',
      pct: '42.5% of total',
      status: !isNRI ? stateEligible : 'no',
      note: isNRI
        ? 'NRI/OCI candidates are not eligible for MH State Quota seats.'
        : stateEligible === 'yes'
          ? 'You qualify — compete with all MH domicile candidates in state counselling.'
          : stateEligible === 'conditional'
          ? 'Requires a valid MH Domicile Certificate before counselling registration opens.'
          : 'You currently do not hold or qualify for an MH domicile certificate.',
      fee: 'Open category fees (₹12L–₹25L/year)',
    },
    {
      quota: `MH State Quota — Reserved (${category.toUpperCase()})`,
      pct: isReserved ? 'Category share of 42.5%' : 'N/A',
      status: isReserved && !isNRI ? stateEligible : 'no',
      note: !isReserved
        ? 'Reserved quota applies only to OBC / SEBC / VJNT / SC / ST candidates.'
        : stateEligible === 'yes'
          ? femaleConcession
            ? 'Eligible — female OBC/SEBC concession fees apply.'
            : 'Eligible — reduced category fees apply.'
          : stateEligible === 'conditional'
          ? 'Requires valid MH Domicile Certificate + MH caste certificate from your local authority.'
          : 'Both MH domicile and MH caste certificate are required for reserved state quota seats.',
      fee: femaleConcession ? 'Female concession fees (reduced rate)' : isReserved ? 'Category-reduced fees' : '—',
    },
    {
      quota: 'All India Quota (AIQ)',
      pct: '15% of total',
      status: !isNRI ? 'yes' : 'no',
      note: isNRI
        ? 'NRI/OCI candidates use the NRI quota; AIQ is for domestic students only.'
        : 'No domicile required — open to all-India students via MCC/NTA counselling. Compete nationally.',
      fee: 'Market rate; no category fee concession applies in AIQ seats',
    },
    {
      quota: 'Management Quota',
      pct: '15% of total',
      status: 'yes',
      note: 'No domicile required. Direct college admission; requires lower NEET score but significantly higher fees.',
      fee: 'Institutional fee — highest tier (₹20L–₹30L/year)',
    },
    {
      quota: 'NRI / OCI / PIO Quota',
      pct: '5% + unfilled seats',
      status: isNRI ? 'yes' : 'dim',
      note: isNRI
        ? 'Primary quota for NRI/OCI/PIO candidates. No domicile required.'
        : 'Reserved for NRI/OCI/PIO candidates only — not available to Indian residents.',
      fee: 'USD-denominated or institutional NRI fees',
    },
  ] : [];

  const actionSteps =
    domStatus === 'STRONG_CONDITIONAL' || domStatus === 'CONDITIONAL' ? [
      'Apply at your local Tehsildar\'s office for an MH Domicile Certificate',
      'Carry originals + copies: proof of 15-year MH residence (school LCs, Aadhaar, ration card)',
      'If born in MH: birth certificate + at least one parent\'s birth certificate',
      'Processing time is 15–30 days — apply before MH CET Cell registration opens',
      'Keep digital + physical copies of the issued certificate ready for counselling day',
    ] : domStatus === 'PARTIAL' ? [
      'Class 12 in MH alone likely does not qualify — seek legal or counsellor advice before applying',
      'Compile proof of total cumulative Maharashtra residency across all years of schooling and family',
      'If a parent was born in Maharashtra, you may still qualify — bring their birth certificate',
      'In the meantime, plan around AIQ (15%) and Management Quota as your primary routes',
      'Book an Eduniaa session for a personalised document-by-document assessment',
    ] : domStatus === 'NOT_ELIGIBLE' ? [
      'You cannot access MH State Quota — focus entirely on AIQ (15%) and Management Quota',
      'Register on the MCC / NTA portal for AIQ counselling — no domicile certificate needed',
      'Contact college admission offices directly for Management Quota seat availability and fees',
      'Consider applying in your home state if a nearby government or private medical college is an option',
      'Talk to an Eduniaa counsellor for an out-of-state student strategy tailored to your NEET score',
    ] : [];

  function handleExportPDF() {
    if (!submitted || !meta) return;
    const doc  = new jsPDF({ unit: 'mm', format: 'a4' });
    const W    = 210;
    const M    = 18;
    const TW   = W - M * 2;
    let   y    = 22;

    const line  = (txt, size = 10, style = 'normal', clr = [0, 0, 0]) => {
      doc.setFontSize(size); doc.setFont('helvetica', style); doc.setTextColor(...clr);
      doc.text(txt, M, y); y += size * 0.5 + 1.5;
    };
    const wrap = (txt, size = 9, clr = [80, 80, 80]) => {
      doc.setFontSize(size); doc.setFont('helvetica', 'normal'); doc.setTextColor(...clr);
      const lines = doc.splitTextToSize(txt, TW);
      doc.text(lines, M, y); y += lines.length * (size * 0.42 + 0.8) + 1;
    };
    const rule = (clr = [210, 215, 225]) => {
      doc.setDrawColor(...clr); doc.line(M, y, W - M, y); y += 4;
    };

    // Header
    line('EDUNIAA GLOBAL', 20, 'bold', [79, 70, 229]);
    line('MH MBBS Domicile + Quota Eligibility Report', 11, 'normal', [80, 80, 80]);
    line(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'long' })}`, 8, 'normal', [150, 150, 150]);
    y += 3; rule();

    // Eligibility status
    line('Eligibility Status', 12, 'bold');
    y += 1;
    line(meta.label, 11, 'bold', [30, 90, 50]);
    wrap(meta.desc, 9.5); y += 2; rule();

    // 4-factor
    line('Your 4-Factor Domicile Assessment', 12, 'bold');
    y += 1;
    [
      ['Birth State',           birthState || 'Not provided'],
      ['Class 10 Schooling',    cls10       || 'Not provided'],
      ['Class 12 Schooling',    cls12       || 'Not provided'],
      ['Domicile Certificate',  domicileCert === 'None' ? 'None held' : domicileCert === 'Maharashtra' ? 'MH Certificate (confirmed)' : domicileCert || 'Not provided'],
    ].forEach(([k, v]) => {
      doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text(`${k}:`, M, y);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(70, 70, 70);
      doc.text(v, M + 52, y); y += 6;
    });
    y += 2; rule();

    // Quota eligibility table
    line('Quota Eligibility Breakdown', 12, 'bold');
    y += 1;
    const statusLabel = s => s === 'yes' ? '[ELIGIBLE]' : s === 'conditional' ? '[CONDITIONAL]' : s === 'dim' ? '[N/A]' : '[INELIGIBLE]';
    quotaRows.forEach(row => {
      doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(0);
      doc.text(row.quota, M, y);
      doc.setFont('helvetica', 'normal');
      doc.text(statusLabel(row.status), W - M - 30, y);
      y += 4.5;
      wrap(row.note, 8.5, [100, 100, 100]); y += 1;
    });
    y += 2; rule();

    // Action steps
    if (actionSteps.length > 0) {
      line(domStatus === 'NOT_ELIGIBLE' ? 'Your Action Plan' : 'Steps to Secure Your MH Domicile Certificate', 12, 'bold');
      y += 1;
      actionSteps.forEach(step => { wrap(`• ${step}`, 9); });
      y += 2; rule();
    }

    // Footer
    doc.setFontSize(7.5); doc.setFont('helvetica', 'italic'); doc.setTextColor(160);
    doc.text('This report is for informational purposes only. Verify eligibility with Eduniaa Global before submitting applications.', M, y);
    y += 4;
    doc.text('Eduniaa Global Admission Tool Suite v1.0  ·  eduniaa.com', M, y);

    doc.save('eduniaa-domicile-eligibility.pdf');
  }

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* ── Form panel ── */}
      <div className="w-full md:w-80 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-80 md:max-h-none">
        <div className="p-5 space-y-5">
          <div>
            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">Domicile + Quota Matrix</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">4-factor MH MBBS eligibility analyser</p>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">1 · Birth State</label>
            <select value={birthState} onChange={e => { setBirthState(e.target.value); setSubmitted(false); }} className={SELECT_CLS}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">2 · Class 10 Schooling State</label>
            <select value={cls10} onChange={e => { setCls10(e.target.value); setSubmitted(false); }} className={SELECT_CLS}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">3 · Class 12 Schooling State</label>
            <select value={cls12} onChange={e => { setCls12(e.target.value); setSubmitted(false); }} className={SELECT_CLS}>
              <option value="">Select state…</option>
              {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">4 · Domicile Certificate Held</label>
            <select value={domicileCert} onChange={e => { setDomicileCert(e.target.value); setSubmitted(false); }} className={SELECT_CLS}>
              <option value="">Select…</option>
              <option value="None">No certificate held</option>
              <option value="Maharashtra">Yes — Maharashtra</option>
              <option value="Other">Yes — Another state</option>
            </select>
            {domicileCert === 'Other' && (
              <p className="text-[10px] text-amber-600 mt-1.5 leading-relaxed">
                A domicile certificate from another state does not help for MH State Quota.
              </p>
            )}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Category / Caste</label>
            <div className="space-y-1.5">
              {CATEGORIES.map(c => (
                <button key={c.value}
                  onClick={() => { setCategory(c.value); setSubmitted(false); }}
                  className={[
                    'w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition-all',
                    category === c.value
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Gender</label>
            <div className="flex gap-2">
              {[{ v: 'male', l: 'Male' }, { v: 'female', l: 'Female' }].map(({ v, l }) => (
                <button key={v}
                  onClick={() => { setGender(v); setSubmitted(false); }}
                  className={[
                    'flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                    gender === v
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => setSubmitted(true)} disabled={!ready}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-40">
            Check Eligibility →
          </button>

          {submitted && (
            <button
              onClick={handleExportPDF}
              className="w-full py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download Eligibility PDF
            </button>
          )}
        </div>
      </div>

      {/* ── Results panel ── */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        {!submitted ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <span className="text-5xl">📋</span>
            <h3 className="text-lg font-bold text-slate-700">Domicile + Quota Matrix</h3>
            <p className="text-slate-400 text-sm max-w-sm leading-relaxed">
              Fill in your birth state, schooling states, domicile certificate status, and category — see exactly which MH MBBS quotas apply to you with colour-coded eligibility signals.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-5">

            {/* Status banner */}
            <div className={`border rounded-xl p-4 flex items-start gap-3 shadow-sm ${meta.bar}`}>
              <span className="text-2xl mt-0.5 shrink-0">{meta.icon}</span>
              <div>
                <p className="font-bold text-sm">{meta.label}</p>
                <p className="text-xs mt-0.5 leading-relaxed opacity-80">{meta.desc}</p>
              </div>
            </div>

            {/* Quota eligibility matrix */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex-1">Quota Eligibility Breakdown</h3>
                <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Eligible</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Conditional</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />Locked</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {quotaRows.map((row, i) => (
                  <div key={i} className={`px-5 py-4 flex items-start gap-4 ${row.status === 'dim' ? 'opacity-40' : ''}`}>
                    <div className="mt-0.5"><EligibilityIcon status={row.status} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-slate-900">{row.quota}</p>
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-semibold">{row.pct}</span>
                        {row.status === 'conditional' && (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Certificate Required</span>
                        )}
                      </div>
                      <p className="text-[12px] text-slate-500 mt-0.5 leading-relaxed">{row.note}</p>
                      {(row.status === 'yes' || row.status === 'conditional') && row.fee !== '—' && (
                        <p className="text-[11px] text-indigo-600 font-semibold mt-1">Fee tier: {row.fee}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4-factor domicile assessment */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Your 4-Factor Domicile Assessment</h3>
              </div>
              <div className="px-5 py-4 space-y-2">
                {[
                  { label: '1 · Birth State',         value: birthState || 'Not provided',    isMH: birthState === 'Maharashtra' },
                  { label: '2 · Class 10 State',       value: cls10 || 'Not provided',         isMH: cls10 === 'Maharashtra' },
                  { label: '3 · Class 12 State',       value: cls12 || 'Not provided',         isMH: cls12 === 'Maharashtra' },
                  { label: '4 · Domicile Certificate', value: domicileCert === 'None' ? 'None held' : domicileCert === 'Maharashtra' ? 'MH Certificate ✓' : domicileCert === 'Other' ? 'Another state' : 'Not provided', isMH: domicileCert === 'Maharashtra' },
                ].map(({ label, value, isMH }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <span className="text-[12px] text-slate-500 font-medium">{label}</span>
                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${isMH ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Reservation breakdown */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
                <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">MH State Quota — Reservation Breakdown</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Reservation</th>
                    <th className="text-left px-5 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wide">Approx. Seats</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {RESERVATION_TABLE.map((r, i) => (
                    <tr key={i}
                      className={[
                        'transition-colors',
                        r.cat.toLowerCase().includes(category) || (category === 'open' && r.cat === 'Open')
                          ? 'bg-indigo-50' : 'hover:bg-slate-50',
                      ].join(' ')}>
                      <td className="px-5 py-3 text-slate-700 font-medium">{r.cat}</td>
                      <td className="px-5 py-3 text-slate-900 font-bold">{r.pct}</td>
                      <td className="px-5 py-3 text-slate-500">{r.seats}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-5 py-3 text-[10px] text-slate-400 border-t border-slate-100">
                * SEBC (Maratha) reservation is subject to Supreme Court orders — verify before relying on it. Seat counts based on ~150 total seats per college.
              </p>
            </div>

            {/* Action steps */}
            {actionSteps.length > 0 && (
              <div className={`rounded-xl p-4 border ${domStatus === 'NOT_ELIGIBLE' ? 'bg-blue-50 border-blue-200' : 'bg-amber-50 border-amber-200'}`}>
                <p className={`text-sm font-bold mb-2.5 ${domStatus === 'NOT_ELIGIBLE' ? 'text-blue-800' : 'text-amber-800'}`}>
                  {domStatus === 'NOT_ELIGIBLE' ? '📌 Your Action Plan' : '📋 Steps to Secure Your MH Domicile Certificate'}
                </p>
                <ul className={`space-y-1.5 text-[12px] leading-relaxed ${domStatus === 'NOT_ELIGIBLE' ? 'text-blue-700' : 'text-amber-700'}`}>
                  {actionSteps.map((s, i) => <li key={i} className="flex gap-2"><span className="shrink-0">•</span><span>{s}</span></li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
