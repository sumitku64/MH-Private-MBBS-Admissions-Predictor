import { useState, useRef, useEffect, useCallback } from 'react';

const SUGGESTIONS = [
  'What NEET score do I need for private MBBS in Maharashtra?',
  'How much are the fees for different categories?',
  'Should I drop a year or take private MBBS now?',
  'What is the MH domicile requirement?',
  'How does female OBC fee concession work?',
  'What documents do I need for MH MBBS counselling?',
];

const WELCOME = `Hi! I'm Dhruv, your senior MH MBBS admissions counsellor at Eduniaa Global. 👋

I can help you with:
  • NEET scores & college cutoffs for all 23 private MH colleges
  • Fee structures across all categories (Open, OBC, SEBC, SC/ST, NRI)
  • Drop year vs. private MBBS decision framework
  • Domicile & quota eligibility (State / AIQ / Management)
  • MH CET Cell counselling process & documentation

Ask me anything, or pick a suggested question below!`;

function now() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function Bubble({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} gap-2.5 mb-4`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-black shrink-0 mt-1">
          D
        </div>
      )}
      <div className={[
        'max-w-[75%] rounded-2xl px-4 py-3 text-sm',
        isUser
          ? 'bg-indigo-600 text-white rounded-br-sm'
          : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm shadow-sm',
      ].join(' ')}>
        <pre className="whitespace-pre-wrap font-[inherit] text-[13px] leading-relaxed">{msg.text}</pre>
        <p className={`text-[10px] mt-1.5 ${isUser ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.time}</p>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-[10px] font-bold shrink-0 mt-1">
          You
        </div>
      )}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-2.5 mb-4">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[11px] font-black shrink-0">D</div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1.5">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="w-2 h-2 bg-slate-300 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function CTABanner() {
  return (
    <div className="mx-5 mb-4 p-4 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-2xl text-white shadow-lg">
      <p className="text-sm font-bold mb-1">Want personalised guidance?</p>
      <p className="text-[12px] text-indigo-100 mb-3 leading-relaxed">
        Book a 1-on-1 session with a real Eduniaa counsellor for your specific score, category, and college shortlist.
      </p>
      <a
        href="https://eduniaa.com/book"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-white text-indigo-700 font-bold text-xs px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
      >
        Book a Free Session →
      </a>
    </div>
  );
}

export default function AICounsellor() {
  const [uiMessages, setUiMessages] = useState([
    { role: 'dhruv', text: WELCOME, time: 'Now' },
  ]);
  const [apiHistory, setApiHistory] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [showCTA, setShowCTA] = useState(false);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiMessages, streaming]);

  const send = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    const userTime = now();
    const newApiHistory = [...apiHistory, { role: 'user', content: text }];

    setUiMessages(prev => [...prev, { role: 'user', text, time: userTime }]);
    setApiHistory(newApiHistory);
    setInput('');
    setStreaming(true);

    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);
    if (newCount >= 3) setShowCTA(true);

    const dhruvTime = now();
    let accumulated = '';

    setUiMessages(prev => [...prev, { role: 'dhruv', text: '', time: dhruvTime, streaming: true }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newApiHistory }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;

          try {
            const parsed = JSON.parse(payload);
            if (parsed.type === 'delta') {
              accumulated += parsed.text;
              setUiMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'dhruv', text: accumulated, time: dhruvTime, streaming: true };
                return updated;
              });
            } else if (parsed.type === 'error') {
              accumulated = parsed.message;
              setUiMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: 'dhruv', text: accumulated, time: dhruvTime };
                return updated;
              });
            }
          } catch {
            // malformed JSON line — skip
          }
        }
      }

      setUiMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'dhruv', text: accumulated, time: dhruvTime };
        return updated;
      });

      setApiHistory(prev => [...prev, { role: 'assistant', content: accumulated }]);
    } catch (err) {
      if (err.name === 'AbortError') return;

      const errMsg = 'Sorry, I had trouble connecting. Please try again in a moment.';
      setUiMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: 'dhruv', text: errMsg, time: dhruvTime };
        return updated;
      });
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, apiHistory, userMsgCount]);

  return (
    <div className="flex h-full">
      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-3 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm">D</div>
          <div>
            <p className="text-sm font-bold text-slate-900">Dhruv</p>
            <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              AI Admissions Counsellor · Online
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2.5 py-0.5">P0 — Live</span>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto py-5 bg-slate-50">
          <div className="px-5">
            {uiMessages.map((m, i) => <Bubble key={i} msg={m} />)}
            {streaming && uiMessages[uiMessages.length - 1]?.role !== 'dhruv' && <ThinkingDots />}
          </div>
          {showCTA && <CTABanner />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask about NEET scores, fees, domicile, counselling…"
              className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 placeholder-slate-400"
              disabled={streaming}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || streaming}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
            >
              {streaming ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {/* Suggestions sidebar — hidden on mobile to give chat full width */}
      <div className="hidden md:block w-64 shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
        <div className="p-4">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Suggested Questions</p>
          <div className="space-y-2">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                disabled={streaming}
                className="w-full text-left text-[12px] text-slate-600 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 border border-slate-200 hover:border-indigo-200 rounded-lg px-3 py-2.5 transition-colors leading-relaxed disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] font-bold text-amber-700 mb-1">⚠ Disclaimer</p>
            <p className="text-[10px] text-amber-600 leading-relaxed">
              Dhruv provides guidance based on MH CET Cell official data. Always verify with official sources before making decisions.
            </p>
          </div>

          <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <p className="text-[11px] font-bold text-indigo-700 mb-1">💡 Pro Tip</p>
            <p className="text-[10px] text-indigo-600 leading-relaxed">
              Pair Dhruv's advice with the NEET Predictor tool for a complete admissions strategy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
