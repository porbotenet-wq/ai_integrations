import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/shared/api/client';
import { Send, Bot, User, Loader2, Sparkles } from 'lucide-react';

interface Props {
  objectId: number;
  objectName: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'Какой общий прогресс по объекту?',
  'Какие работы отстают от плана?',
  'Прогноз завершения по текущим темпам?',
  'Какие материалы в дефиците?',
  'Сводка по фасадам',
];

export function AIChatTab({ objectId, objectName }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Привет! Я AI-аналитик проекта "${objectName}". Задайте вопрос о прогрессе, план/факте, поставках или любых данных объекта.`,
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const askMutation = useMutation({
    mutationFn: (question: string) =>
      api.post<{ answer: string; data_context?: any }>('/api/analytics/ask', {
        question,
        object_id: objectId,
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
      const msg = err?.message?.includes('ANTHROPIC')
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

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] min-h-[400px]">
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

      {/* Quick questions */}
      {messages.length <= 2 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-2">
          {QUICK_QUESTIONS.map((q) => (
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
