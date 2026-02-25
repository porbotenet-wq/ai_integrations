import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Send, Bot, User, Loader2, Sparkles, History } from 'lucide-react';

interface Props {
  objectId: number;
  objectName: string;
  userRole?: string;
  telegramId?: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface HistoryMsg {
  id: number;
  role: string;
  text: string;
  created_at: string;
}

export function AIChatTab({ objectId, objectName, userRole, telegramId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load hints for role
  const { data: hintsData } = useQuery<{ hints: string[] }>({
    queryKey: ['ai-hints', userRole],
    queryFn: () => api.get(`/api/analytics/hints?role=${userRole || 'default'}`),
  });

  // Load history
  const { data: history } = useQuery<HistoryMsg[]>({
    queryKey: ['ai-history', objectId, telegramId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (telegramId) params.set('telegram_id', String(telegramId));
      params.set('limit', '50');
      return api.get(`/api/analytics/history/${objectId}?${params}`);
    },
  });

  // Populate from history once
  useEffect(() => {
    if (history && !historyLoaded) {
      const restored: Message[] = history.map((m) => ({
        id: `h-${m.id}`,
        role: m.role as 'user' | 'assistant',
        text: m.text,
        timestamp: new Date(m.created_at),
      }));
      if (restored.length > 0) {
        setMessages(restored);
      } else {
        setMessages([{
          id: 'welcome',
          role: 'assistant',
          text: `Привет! Я AI-аналитик проекта "${objectName}". Задайте вопрос о прогрессе, план/факте, поставках или любых данных объекта.`,
          timestamp: new Date(),
        }]);
      }
      setHistoryLoaded(true);
    }
  }, [history, historyLoaded, objectName]);

  const askMutation = useMutation({
    mutationFn: (question: string) =>
      api.post<{ answer: string; data_context?: any }>('/api/analytics/ask', {
        question,
        object_id: objectId,
        telegram_id: telegramId,
        role: userRole,
      }),
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: data.answer,
          timestamp: new Date(),
        },
      ]);
    },
    onError: (err: any) => {
      const msg = err?.message?.includes('API_KEY')
        ? 'AI-аналитика временно недоступна. API ключ не настроен.'
        : 'Ошибка при обработке запроса. Попробуйте позже.';
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', text: `⚠️ ${msg}`, timestamp: new Date() },
      ]);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (text?: string) => {
    const question = (text || input).trim();
    if (!question || askMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: 'user', text: question, timestamp: new Date() },
    ]);
    setInput('');
    askMutation.mutate(question);
  };

  const hints = hintsData?.hints || [];
  const showHints = messages.length <= 2;

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
      {/* History badge */}
      {history && history.length > 0 && messages.length > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 mb-1">
          <History size={10} className="text-tg-hint" />
          <span className="text-2xs text-tg-hint">{history.length} сообщений в истории</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {askMutation.isPending && (
          <div className="flex items-center gap-2 px-3 py-2">
            <Loader2 size={16} className="text-status-blue animate-spin" />
            <span className="text-xs text-tg-hint">Анализирую данные...</span>
          </div>
        )}

        <div ref={scrollRef} />
      </div>

      {/* Quick questions — role-dependent */}
      {showHints && hints.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
          {hints.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              disabled={askMutation.isPending}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-2xs
                bg-tg-section-bg text-tg-hint whitespace-nowrap flex-shrink-0
                active:bg-tg-button active:text-tg-button-text transition-colors"
            >
              <Sparkles size={10} />
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 pt-2 border-t border-tg-hint/10">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Задайте вопрос об объекте..."
          disabled={askMutation.isPending}
          className="flex-1 bg-tg-section-bg text-tg-text text-sm rounded-xl px-4 py-3
            placeholder:text-tg-hint/50 outline-none focus:ring-1 focus:ring-tg-button/30"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim() || askMutation.isPending}
          className="p-3 rounded-xl bg-tg-button text-tg-button-text
            disabled:opacity-30 active:opacity-80 transition-opacity touch-target"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
        ${isUser ? 'bg-tg-button/20' : 'bg-status-blue/10'}`}>
        {isUser ? <User size={14} className="text-tg-button" /> : <Bot size={14} className="text-status-blue" />}
      </div>
      <div className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed
        ${isUser
          ? 'bg-tg-button text-tg-button-text rounded-tr-md'
          : 'bg-tg-section-bg text-tg-text rounded-tl-md'}`}
      >
        <div className="whitespace-pre-wrap">{message.text}</div>
        <div className={`text-2xs mt-1 ${isUser ? 'text-tg-button-text/50' : 'text-tg-hint/50'}`}>
          {message.timestamp.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
