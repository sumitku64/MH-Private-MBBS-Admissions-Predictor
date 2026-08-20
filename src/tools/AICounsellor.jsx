import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, X } from 'lucide-react';
import { API_BASE } from '../lib/api';
import { useUser } from '../context/UserContext';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
        'max-w-[85%] min-w-0 rounded-2xl px-4 py-3 text-[13px] leading-relaxed overflow-x-auto',
        isUser
          ? 'bg-indigo-600 text-white rounded-br-sm'
          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-sm prose prose-sm prose-slate max-w-none',
      ].join(' ')}>
        {isUser ? (
          <pre className="whitespace-pre-wrap font-[inherit]">{msg.text}</pre>
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({node, ...props}) => <div className="overflow-x-auto my-3"><table className="min-w-full text-left text-xs text-slate-600 border border-slate-200 rounded-md overflow-hidden" {...props} /></div>,
              thead: ({node, ...props}) => <thead className="bg-slate-50 border-b border-slate-200 text-slate-700" {...props} />,
              th: ({node, ...props}) => <th className="px-3 py-2 font-semibold" {...props} />,
              td: ({node, ...props}) => <td className="px-3 py-2 border-t border-slate-100" {...props} />,
              p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
              a: ({node, ...props}) => <a className="text-indigo-600 hover:underline font-medium" {...props} />,
              strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
              h3: ({node, ...props}) => <h3 className="text-sm font-bold text-slate-900 mt-4 mb-2" {...props} />,
            }}
          >
            {msg.text}
          </ReactMarkdown>
        )}
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
  const { profile, chatHistory, saveChatMessages } = useUser();

  const initialApi = chatHistory ?? [];
  const initialUi = [
    { role: 'dhruv', text: WELCOME, time: 'System' },
    ...initialApi.map(m => ({
      role: m.role === 'assistant' ? 'dhruv' : 'user',
      text: m.content,
      time: 'Saved',
    })),
  ];

  const [uiMessages, setUiMessages] = useState(initialUi);
  const [apiHistory, setApiHistory] = useState(initialApi);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [showCTA, setShowCTA] = useState(false);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  // Reset chat when switching accounts
  useEffect(() => {
    const api = chatHistory ?? [];
    setApiHistory(api);
    setUiMessages([
      { role: 'dhruv', text: WELCOME, time: 'System' },
      ...api.map(m => ({
        role: m.role === 'assistant' ? 'dhruv' : 'user',
        text: m.content,
        time: 'Saved',
      })),
    ]);
  }, [profile.phone]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uiMessages, streaming]);

  const clearChat = () => {
    if (streaming) abortRef.current?.abort();
    setApiHistory([]);
    setUiMessages([{ role: 'dhruv', text: WELCOME, time: 'System' }]);
    saveChatMessages([]);
  };

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
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: newApiHistory,
          profile: profile.isRegistered ? profile : null 
        }),
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

      const finalHistory = [...newApiHistory, { role: 'assistant', content: accumulated }];
      setApiHistory(finalHistory);
      saveChatMessages(finalHistory);
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error('CHAT ERROR:', err);

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
  }, [streaming, apiHistory, userMsgCount, profile]);

  const [isOpen, setIsOpen] = useState(false);

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 transition-all"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-black text-sm">D</div>
        <div>
          <p className="text-sm font-bold text-slate-900">Dhruv</p>
          <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            AI Admissions Counsellor
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={clearChat} className="text-[11px] font-bold text-slate-400 hover:text-indigo-600 transition-colors">
            Clear Chat
          </button>
          <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 bg-slate-50">
        <div className="px-4">
          {uiMessages.map((m, i) => <Bubble key={i} msg={m} />)}
          {streaming && uiMessages[uiMessages.length - 1]?.role !== 'dhruv' && <ThinkingDots />}
        </div>
        {showCTA && <CTABanner />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 p-3 shrink-0">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send(input)}
            placeholder="Ask a question..."
            className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-900 placeholder-slate-400"
            disabled={streaming}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-colors"
          >
            {streaming ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
