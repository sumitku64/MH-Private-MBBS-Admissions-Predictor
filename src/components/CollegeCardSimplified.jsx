import { Link } from 'react-router-dom';

export default function CollegeCardSimplified({ college }) {
  const pct = college.cutoff && college.userScore
    ? Math.min(100, Math.round((college.userScore / college.cutoff) * 100))
    : null;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{college.name}</h3>
            <p className="text-xs text-slate-500 font-medium">Code {college.code} · {college.seats} seats</p>
          </div>
          <div className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 rounded border border-green-100 uppercase tracking-wider shrink-0">
            {college.probabilityLabel || 'High Probability'}
          </div>
        </div>

        <div className="mb-6">
          <div className="flex justify-between text-xs font-bold mb-2">
            <span className="text-slate-700">Your score: {college.userScore ?? 'N/A'}</span>
            <span className="text-slate-500">Cutoff: {college.cutoff ?? 'N/A'}</span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${college.probabilityLabel === 'Borderline' ? 'bg-amber-400' : college.probabilityLabel === 'Low Probability' ? 'bg-red-500' : 'bg-green-500'}`}
              style={{ width: pct != null ? `${pct}%` : '0%' }}
            ></div>
          </div>
          <div className="text-[10px] text-slate-400 text-right mt-1 font-medium">
            {pct != null ? `${pct}% of cutoff` : 'No cutoff data'}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="font-black text-slate-900 text-lg">
            {college.fees ? `₹${college.fees.toLocaleString('en-IN')}` : 'N/A'}
            <span className="text-xs text-slate-500 font-medium">/yr</span>
          </div>
          <div className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-1 rounded">
            {college.quota || 'AIQ Route'}
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-slate-50/50">
        <Link
          to={`/college/${college.id}`}
          className="block w-full py-2.5 text-center text-sm font-bold text-indigo-600 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
        >
          View Details →
        </Link>
      </div>
    </div>
  );
}
