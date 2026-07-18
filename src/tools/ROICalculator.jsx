import { useState, useMemo } from 'react';

function calcEMI(principal, annualRate, months) {
  if (principal <= 0) return 0;
  const r = annualRate / 100 / 12;
  return Math.round(principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1));
}

function fmtRs(n) {
  const a = Math.abs(n), s = n < 0 ? '-' : '';
  if (a >= 10000000) return `${s}₹${(a / 10000000).toFixed(2)} Cr`;
  if (a >= 100000)   return `${s}₹${(a / 100000).toFixed(1)}L`;
  if (a >= 1000)     return `${s}₹${(a / 1000).toFixed(0)}K`;
  return `${s}₹${a}`;
}

// Values stored as ₹Lakhs
function fmtLakh(l) {
  const a = Math.abs(l), s = l < 0 ? '-' : '';
  if (a >= 100) return `${s}₹${(a / 100).toFixed(2)} Cr`;
  if (a >= 1)   return `${s}₹${a.toFixed(0)}L`;
  return `${s}₹${(a * 100).toFixed(0)}K`;
}

function buildCashFlow(params, isPrivate) {
  const { investmentL, pgGapYears, residencyK, salaryK } = params;

  const totalFees = isPrivate ? investmentL * 100000 : 300000;
  const annualFee = totalFees / 4.5;
  const loan      = isPrivate ? totalFees * 0.8 : 0;
  const emiMo     = loan > 0 ? calcEMI(loan, 8.5, 120) : 0;

  // Timeline
  const internYear  = 5;
  const careerStart = internYear + 1 + pgGapYears + (pgGapYears > 0 ? 3 : 0);
  const loanEndYear = careerStart + 10;

  const data = [];
  let cum = 0;

  for (let yr = 0; yr <= 40; yr++) {
    let flow = 0;

    if (yr < 5)  flow -= annualFee;                           // MBBS fees
    if (yr === internYear) flow += 18000 * 12;                // Internship ₹18K/mo

    if (pgGapYears > 0 && yr > internYear && yr <= internYear + pgGapYears)
      flow += 15000 * 12;                                     // Gap-year tutoring

    if (pgGapYears > 0 && yr > internYear + pgGapYears && yr <= internYear + pgGapYears + 3)
      flow += residencyK * 1000 * 12;                         // PG residency stipend

    if (yr >= careerStart) {
      const careerYr = yr - careerStart;
      flow += salaryK * 1000 * Math.pow(1.06, careerYr) * 12; // Career salary (6%/yr growth)
      if (isPrivate && yr < loanEndYear) flow -= emiMo * 12;  // Loan EMI
    }

    cum += flow;
    data.push({ year: yr, value: Math.round(cum / 100000) }); // store as ₹L
  }

  return { data, careerStart, loan, emiMo };
}

// ── SVG Line Chart ──────────────────────────────────────────────────────────
function Chart({ privateData, govtData }) {
  const MG = { t: 20, r: 50, b: 50, l: 90 };
  const VW = 720, VH = 320;
  const W = VW - MG.l - MG.r;   // 580
  const H = VH - MG.t - MG.b;   // 250

  const allVals = [...privateData, ...govtData].map(d => d.value);
  const minV = Math.min(0, ...allVals);
  const maxV = Math.max(0, ...allVals);
  const range = maxV - minV || 1;

  const xs = yr  => (yr  / 40) * W;
  const ys = val => H * (1 - (val - minV) / range);
  const toPath = arr => arr.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(d.year).toFixed(1)},${ys(d.value).toFixed(1)}`).join(' ');
  const zY = ys(0);

  // Key crossings
  const bePriv  = privateData.find((d, i) => i > 0 && d.value >= 0    && privateData[i - 1].value < 0);
  const catchUp = privateData.find((d, i) => i > 1 && d.value >= (govtData[i]?.value ?? 0) && privateData[i - 1].value < (govtData[i - 1]?.value ?? 0));

  const numYTicks = 6;
  const yTicks = Array.from({ length: numYTicks }, (_, i) => minV + (range / (numYTicks - 1)) * i);
  const xTicks = [0, 5, 10, 15, 20, 25, 30, 35, 40];

  const fmt = l => {
    const a = Math.abs(l), s = l < 0 ? '-' : '';
    if (a >= 100) return `${s}₹${(a / 100).toFixed(1)}Cr`;
    return `${s}₹${a.toFixed(0)}L`;
  };

  // Shading path under zero for private (investment zone)
  const negPts = bePriv
    ? privateData.filter(d => d.year <= bePriv.year)
    : privateData;
  const shadePath = `M${xs(0)},${zY} ${negPts.map(d => `L${xs(d.year).toFixed(1)},${ys(d.value).toFixed(1)}`).join(' ')} L${xs(bePriv?.year ?? 40)},${zY} Z`;

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full" style={{ minHeight: 200 }}>
      <g transform={`translate(${MG.l},${MG.t})`}>
        {/* Y grid lines */}
        {yTicks.map((v, i) => (
          <line key={i} x1={0} y1={ys(v)} x2={W} y2={ys(v)} stroke="#f1f5f9" strokeWidth={1} />
        ))}

        {/* Zero baseline */}
        {zY >= 0 && zY <= H && (
          <line x1={0} y1={zY} x2={W} y2={zY} stroke="#94a3b8" strokeWidth={1} strokeDasharray="6,4" />
        )}

        {/* Investment zone shading (private) */}
        {bePriv && <path d={shadePath} fill="#6366f1" fillOpacity={0.06} />}

        {/* Government line */}
        <path d={toPath(govtData)} fill="none" stroke="#10b981" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Private line */}
        <path d={toPath(privateData)} fill="none" stroke="#6366f1" strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />

        {/* Break-even marker */}
        {bePriv && (
          <>
            <circle cx={xs(bePriv.year)} cy={zY} r={5} fill="#6366f1" />
            <text x={xs(bePriv.year)} y={zY - 10} textAnchor="middle" fontSize={9} fill="#6366f1" fontWeight="bold">
              Break-even Yr {bePriv.year}
            </text>
          </>
        )}

        {/* Catch-up marker */}
        {catchUp && catchUp.year !== bePriv?.year && (
          <>
            <circle cx={xs(catchUp.year)} cy={ys(catchUp.value)} r={5} fill="white" stroke="#6366f1" strokeWidth={2} />
            <text x={xs(catchUp.year)} y={ys(catchUp.value) - 10} textAnchor="middle" fontSize={9} fill="#6366f1" fontWeight="bold">
              Catch-up Yr {catchUp.year}
            </text>
          </>
        )}

        {/* X axis */}
        <line x1={0} y1={H} x2={W} y2={H} stroke="#cbd5e1" strokeWidth={1} />
        {xTicks.map(t => (
          <g key={t} transform={`translate(${xs(t)},${H})`}>
            <line y2={5} stroke="#cbd5e1" />
            <text y={17} textAnchor="middle" fontSize={9} fill="#94a3b8">Yr {t}</text>
          </g>
        ))}
        <text x={W / 2} y={H + 40} textAnchor="middle" fontSize={10} fill="#94a3b8">Years from today</text>

        {/* Y axis */}
        <line x1={0} y1={0} x2={0} y2={H} stroke="#cbd5e1" strokeWidth={1} />
        {yTicks.map((v, i) => (
          <g key={i} transform={`translate(0,${ys(v)})`}>
            <line x2={-5} stroke="#cbd5e1" />
            <text x={-8} textAnchor="end" fontSize={9} fill="#94a3b8" dominantBaseline="middle">{fmt(v)}</text>
          </g>
        ))}

        {/* Legend box */}
        <g transform={`translate(${W - 160},10)`}>
          <rect x={0} y={-5} width={165} height={52} rx={6} fill="white" fillOpacity={0.95} stroke="#e2e8f0" />
          <line x1={10} y1={14} x2={30} y2={14} stroke="#6366f1" strokeWidth={2.5} />
          <circle cx={20} cy={14} r={3} fill="#6366f1" />
          <text x={36} y={18} fontSize={10} fill="#6366f1" fontWeight="bold">Private MBBS</text>
          <line x1={10} y1={30} x2={30} y2={30} stroke="#10b981" strokeWidth={2.5} />
          <circle cx={20} cy={30} r={3} fill="#10b981" />
          <text x={36} y={34} fontSize={10} fill="#10b981" fontWeight="bold">Government MBBS</text>
        </g>

        {/* Zero label */}
        {zY >= 0 && zY <= H && (
          <text x={-8} y={zY} textAnchor="end" fontSize={9} fill="#94a3b8" dominantBaseline="middle">₹0</text>
        )}
      </g>
    </svg>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ROICalculator() {
  const [investmentL, setInvestmentL] = useState(60);
  const [pgGapYears,  setPgGapYears]  = useState(0);
  const [residencyK,  setResidencyK]  = useState(40);
  const [salaryK,     setSalaryK]     = useState(100);

  const params = { investmentL, pgGapYears, residencyK, salaryK };

  const { data: privData, careerStart, loan, emiMo } = useMemo(
    () => buildCashFlow(params, true),
    [investmentL, pgGapYears, residencyK, salaryK]
  );
  const { data: govtData } = useMemo(
    () => buildCashFlow(params, false),
    [pgGapYears, residencyK, salaryK]
  );

  const privVal40 = privData[40]?.value ?? 0;
  const govtVal40 = govtData[40]?.value ?? 0;

  const bePriv  = privData.find((d, i) => i > 0 && d.value >= 0 && privData[i - 1].value < 0);
  const catchUp = privData.find((d, i) => i > 1 && d.value >= (govtData[i]?.value ?? 0) && privData[i - 1].value < (govtData[i - 1]?.value ?? 0));

  const totalInterest   = emiMo * 120 - loan;
  const totalCostWithInterest = investmentL * 100000 + totalInterest;
  const loanEndYear     = careerStart + 10;

  const summaryCards = [
    { label: 'Total Private Burden',  value: fmtRs(totalCostWithInterest), sub: 'fees + loan interest', borderCls: 'border-rose-100',    textCls: 'text-rose-700' },
    { label: 'Career Starts',          value: `Year ${careerStart}`,         sub: pgGapYears > 0 ? `${pgGapYears}yr prep + 3yr PG` : 'After MBBS + internship', borderCls: 'border-indigo-100', textCls: 'text-indigo-700' },
    { label: 'Loan Cleared By',        value: `Year ${loanEndYear}`,         sub: '10-year EMI plan',   borderCls: 'border-amber-100',   textCls: 'text-amber-700' },
    { label: 'Govt Advantage at Yr 40', value: fmtLakh(govtVal40 - privVal40), sub: 'cumulative wealth gap', borderCls: govtVal40 > privVal40 ? 'border-emerald-100' : 'border-indigo-100', textCls: govtVal40 > privVal40 ? 'text-emerald-700' : 'text-indigo-700' },
  ];

  const compRows = [
    ['Total tuition',        fmtRs(investmentL * 100000),       '₹3L (approx.)'],
    ['Education loan',       fmtRs(loan),                       'None'],
    ['Interest paid',        fmtRs(Math.max(0, totalInterest)), '₹0'],
    ['Total cost burden',    fmtRs(totalCostWithInterest),      '₹3L'],
    ['Monthly EMI',          loan > 0 ? `${fmtRs(emiMo)}/mo (10 yr)` : 'None', 'None'],
    ['Career starts',        `Year ${careerStart}`,             `Year ${careerStart}`],
    ['Loan cleared',         loan > 0 ? `Year ${loanEndYear}` : 'N/A', 'N/A'],
    ['Break-even',           bePriv ? `Year ${bePriv.year}` : 'Beyond Yr 40', '—'],
    ['Catch-up to Govt',     catchUp ? `Year ${catchUp.year}` : 'Beyond Yr 40', 'Baseline'],
    ['Cumulative at Yr 40',  fmtLakh(privVal40),                fmtLakh(govtVal40)],
  ];

  return (
    <div className="flex flex-col md:flex-row h-full">
      {/* ── Inputs ── */}
      <div className="w-full md:w-72 shrink-0 bg-white border-b md:border-b-0 md:border-r border-slate-200 overflow-y-auto max-h-80 md:max-h-none">
        <div className="p-5 space-y-6">
          <div>
            <h2 className="text-[11px] font-black text-slate-900 uppercase tracking-widest">MBBS ROI Calculator</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Lifetime economic yield of your MBBS degree</p>
          </div>

          {/* Investment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Private MBBS Cost</label>
              <span className="text-sm font-black text-indigo-600">₹{investmentL}L</span>
            </div>
            <input type="range" min={20} max={140} step={5} value={investmentL}
              onChange={e => setInvestmentL(parseInt(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>₹20L</span><span>₹140L</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">4.5-yr total tuition (all categories). Govt MBBS fixed at ₹3L.</p>
          </div>

          {/* PG Gap */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">PG Preparation Gap Years</label>
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map(y => (
                <button key={y} onClick={() => setPgGapYears(y)}
                  className={['flex-1 py-2 rounded-lg text-xs font-bold border transition-all',
                    pgGapYears === y
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300',
                  ].join(' ')}>
                  {y === 0 ? 'None' : `${y} yr`}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
              {pgGapYears === 0
                ? 'GP career begins directly after MBBS + internship'
                : `${pgGapYears} year prep → 3 year PG residency → specialist career`}
            </p>
          </div>

          {/* Residency Stipend */}
          <div className={pgGapYears === 0 ? 'opacity-35 pointer-events-none select-none' : ''}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">PG Residency Stipend</label>
              <span className="text-sm font-black text-indigo-600">₹{residencyK}K/mo</span>
            </div>
            <input type="range" min={20} max={80} step={5} value={residencyK}
              onChange={e => setResidencyK(parseInt(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>₹20K</span><span>₹80K</span>
            </div>
          </div>

          {/* Starting Salary */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Starting Monthly Salary</label>
              <span className="text-sm font-black text-indigo-600">₹{salaryK}K</span>
            </div>
            <input type="range" min={40} max={300} step={10} value={salaryK}
              onChange={e => setSalaryK(parseInt(e.target.value))}
              className="w-full accent-indigo-600" />
            <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
              <span>₹40K</span><span>₹3L</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">6% annual growth assumed for both pathways.</p>
          </div>

          {/* Auto-loan box */}
          <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5">
            <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider mb-2.5">Auto-calculated Loan (80% of fees)</p>
            <div className="space-y-1.5">
              {[
                ['Loan amount',        fmtRs(loan)],
                ['EMI @ 8.5% × 10yr', `${fmtRs(emiMo)}/month`],
                ['Total interest',     fmtRs(Math.max(0, totalInterest))],
                ['True total cost',    fmtRs(totalCostWithInterest)],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between items-center text-[11px]">
                  <span className="text-rose-700/70">{l}</span>
                  <span className="font-bold text-rose-800">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-auto bg-slate-50 p-6">
        <div className="max-w-4xl space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {summaryCards.map(({ label, value, sub, borderCls, textCls }) => (
              <div key={label} className={`bg-white border rounded-xl p-4 shadow-sm ${borderCls}`}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-black mt-1 ${textCls}`}>{value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 leading-tight">{sub}</p>
              </div>
            ))}
          </div>

          {/* Chart card */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3 flex items-center gap-2">
              <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest flex-1">
                Cumulative Wealth — Private vs. Government MBBS
              </h3>
              <span className="text-[10px] text-slate-400">6% annual salary growth · 40-year horizon</span>
            </div>
            <div className="p-4">
              <Chart privateData={privData} govtData={govtData} />
              <div className="mt-3 flex flex-wrap items-center gap-4 text-[10px] text-slate-500">
                {bePriv ? (
                  <span>
                    <strong className="text-indigo-700">● Break-even Yr {bePriv.year}</strong>
                    {' '}— Private MBBS investment fully recovered
                  </span>
                ) : (
                  <span className="text-amber-700 font-semibold">⚠ Private does not break even within 40 years with these parameters</span>
                )}
                {catchUp && catchUp.year !== bePriv?.year && (
                  <span>
                    <strong className="text-indigo-700">○ Catch-up Yr {catchUp.year}</strong>
                    {' '}— Private cumulative equals Government
                  </span>
                )}
                <span className="text-slate-400 text-[9px] ml-auto">Dashed line = ₹0 baseline</span>
              </div>
            </div>
          </div>

          {/* Comparison table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-3">
              <h3 className="text-[11px] font-black text-slate-600 uppercase tracking-widest">Private vs. Government MBBS — Full Comparison</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-slate-500 uppercase tracking-wide w-1/3">Metric</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-indigo-600 uppercase tracking-wide">
                    🏥 Private MBBS
                  </th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold text-emerald-600 uppercase tracking-wide">
                    🏛 Government MBBS
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {compRows.map(([metric, pv, gv]) => (
                  <tr key={metric} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-2.5 text-[12px] text-slate-500 font-medium">{metric}</td>
                    <td className="px-5 py-2.5 text-[12px] text-slate-700 font-semibold">{pv}</td>
                    <td className="px-5 py-2.5 text-[12px] text-slate-700 font-semibold">{gv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Insight banner */}
          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl p-5 text-white">
            <p className="font-bold text-sm mb-1">ROI Insight</p>
            <p className="text-[12px] text-indigo-100 leading-relaxed">
              {bePriv
                ? `At ₹${investmentL}L total investment and ₹${salaryK}K/month starting salary, your Private MBBS breaks even at Year ${bePriv.year}.${catchUp ? ` It takes until Year ${catchUp.year} for cumulative wealth to match the Government MBBS pathway — a ${catchUp.year - bePriv.year}-year gap.` : ' The Government pathway remains cumulatively ahead throughout the 40-year horizon due to its near-zero cost burden.'}`
                : `With ₹${investmentL}L investment and ₹${salaryK}K/month salary, the Private MBBS does not recover its full cost within 40 years. Try increasing the salary projection or switching to an OBC/SC/ST category fee tier to see break-even.`}
            </p>
            <a href="https://eduniaa.com/book" target="_blank" rel="noopener noreferrer"
              className="inline-block mt-3 bg-white text-indigo-700 font-bold text-xs px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors">
              Book a Financial Counselling Session →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
