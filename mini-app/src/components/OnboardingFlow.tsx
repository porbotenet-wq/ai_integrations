import { useState, useRef, useEffect } from 'react';
import { JOB_INSTRUCTIONS, getRandomQuizQuestions, isQuizPassed } from '@/data/jobInstructions';
import type { AppRole, QuizQuestion } from '@/data/jobInstructions';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, BookOpen, HelpCircle, Trophy, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface OnboardingFlowProps {
  role: AppRole;
  userName: string;
  onComplete: () => void;
}

type Step = 'reading' | 'quiz' | 'result';

export function OnboardingFlow({ role, userName, onComplete }: OnboardingFlowProps) {
  const instruction = JOB_INSTRUCTIONS[role];

  const [step, setStep] = useState<Step>('reading');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [readSeconds, setReadSeconds] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (step === 'reading') {
      timerRef.current = setInterval(() => setReadSeconds((s) => s + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) setScrolledToBottom(true);
  };

  const canProceedToQuiz = scrolledToBottom && readSeconds >= 30;

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);

  const startQuiz = () => {
    setQuestions(getRandomQuizQuestions(role));
    setCurrentQ(0);
    setAnswers([]);
    setSelectedOption(null);
    setStep('quiz');
  };

  const handleAnswer = (optionIndex: number) => {
    if (selectedOption !== null) return;
    setSelectedOption(optionIndex);
  };

  const handleNext = () => {
    if (selectedOption === null) return;
    const newAnswers = [...answers, selectedOption];
    setAnswers(newAnswers);

    if (currentQ + 1 < questions.length) {
      setCurrentQ((q) => q + 1);
      setSelectedOption(null);
    } else {
      // Record attempt in DB
      const result = isQuizPassed(questions, newAnswers);
      const answersJson = questions.map((q, i) => ({
        questionId: q.id,
        selectedIndex: newAnswers[i],
        correct: newAnswers[i] === q.correctIndex,
      }));
      supabase.rpc('record_onboarding_attempt', {
        p_role: role,
        p_score: result.score,
        p_total: result.total,
        p_passed: result.passed,
        p_answers: answersJson,
        p_read_seconds: readSeconds,
      }).then(() => {});
      setStep('result');
    }
  };

  const quizResult =
    step === 'result' && questions.length > 0
      ? isQuizPassed(questions, answers)
      : null;

  const retryDelay = useRef(0);
  const [retryCountdown, setRetryCountdown] = useState(0);

  const handleRetry = () => {
    retryDelay.current = 600;
    setRetryCountdown(600);
    const t = setInterval(() => {
      setRetryCountdown((c) => {
        if (c <= 1) { clearInterval(t); return 0; }
        return c - 1;
      });
    }, 1000);
    setScrolledToBottom(false);
    setReadSeconds(0);
    setStep('reading');
    setTimeout(() => scrollRef.current?.scrollTo({ top: 0 }), 100);
  };

  // READING
  if (step === 'reading') {
    return (
      <div className="flex flex-col h-screen bg-muted/30">
        <div className="bg-card border-b px-4 py-3 flex items-center gap-3 shadow-sm">
          <BookOpen className="text-primary shrink-0" size={22} />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Шаг 1 из 2 — Ознакомьтесь с инструкцией</p>
            <p className="font-semibold text-sm text-foreground truncate">{instruction.title}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-xs">
            {Math.floor(readSeconds / 60)}:{String(readSeconds % 60).padStart(2, '0')}
          </Badge>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-6"
        >
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-primary">
            👋 Добро пожаловать, <strong>{userName}</strong>! Перед началом работы прочитайте
            должностную инструкцию до конца. После этого вам будет предложен короткий квиз.
          </div>

          {instruction.sections.map((section) => (
            <div key={section.heading} className="bg-card rounded-xl shadow-sm p-4">
              <h3 className="font-bold text-base text-foreground mb-2">{section.heading}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                {section.content}
              </p>
            </div>
          ))}

          <div className="h-4" />
        </div>

        <div className="bg-card border-t px-4 py-3 space-y-2">
          {!scrolledToBottom && (
            <p className="text-xs text-center text-muted-foreground">
              📖 Прокрутите до конца инструкции, чтобы продолжить
            </p>
          )}
          {scrolledToBottom && !canProceedToQuiz && (
            <p className="text-xs text-center text-orange-500">
              ⏱ Минимальное время чтения: 30 сек. Осталось: {30 - readSeconds} сек.
            </p>
          )}
          <Button onClick={startQuiz} disabled={!canProceedToQuiz} className="w-full" size="lg">
            Я прочитал — перейти к проверке
          </Button>
        </div>
      </div>
    );
  }

  // QUIZ
  if (step === 'quiz') {
    const q = questions[currentQ];
    const progress = ((currentQ) / questions.length) * 100;

    return (
      <div className="flex flex-col h-screen bg-muted/30">
        <div className="bg-card border-b px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <HelpCircle className="text-primary" size={20} />
              <span className="text-sm font-semibold text-foreground">
                Шаг 2 из 2 — Проверка знаний
              </span>
            </div>
            <span className="text-sm font-bold text-primary">
              {currentQ + 1} / {questions.length}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4">
          <div className="bg-card rounded-xl shadow-sm p-5">
            <p className="text-base font-semibold text-foreground leading-relaxed">{q.question}</p>
          </div>

          <div className="space-y-3">
            {q.options.map((option, idx) => {
              const isSelected = selectedOption === idx;
              return (
                <button
                  key={idx}
                  onClick={() => handleAnswer(idx)}
                  className={`w-full text-left px-4 py-4 rounded-xl border-2 transition-all text-sm
                    ${isSelected
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5'
                    }`}
                >
                  <span className="font-bold mr-2 text-muted-foreground">
                    {['А', 'Б', 'В', 'Г'][idx]}.
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          <p className="text-xs text-center text-muted-foreground mt-2">
            Выберите один вариант ответа
          </p>
        </div>

        <div className="bg-card border-t px-4 py-3">
          <Button onClick={handleNext} disabled={selectedOption === null} className="w-full" size="lg">
            {currentQ + 1 < questions.length ? 'Следующий вопрос →' : 'Завершить проверку'}
          </Button>
        </div>
      </div>
    );
  }

  // RESULT
  if (step === 'result' && quizResult) {
    const passed = quizResult.passed;

    return (
      <div className="flex flex-col h-screen bg-muted/30">
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
          <div
            className={`w-24 h-24 rounded-full flex items-center justify-center
              ${passed ? 'bg-green-100' : 'bg-red-100'}`}
          >
            {passed ? (
              <Trophy className="text-green-600" size={48} />
            ) : (
              <XCircle className="text-red-500" size={48} />
            )}
          </div>

          <div className="text-center">
            <h2 className={`text-2xl font-bold ${passed ? 'text-green-700' : 'text-red-600'}`}>
              {passed ? 'Аттестация пройдена!' : 'Попытка не засчитана'}
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              {passed
                ? `Добро пожаловать в команду, ${userName}!`
                : 'Вернитесь к инструкции и попробуйте снова'}
            </p>
          </div>

          <div className="bg-card rounded-2xl shadow-sm p-6 w-full max-w-xs text-center">
            <p className="text-4xl font-black text-foreground">
              {quizResult.score}
              <span className="text-2xl text-muted-foreground">/{quizResult.total}</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">правильных ответов</p>
            <div className="flex gap-2 justify-center mt-3">
              {questions.map((q, i) => {
                const correct = answers[i] === q.correctIndex;
                return correct ? (
                  <CheckCircle2 key={i} size={20} className="text-green-500" />
                ) : (
                  <XCircle key={i} size={20} className="text-red-400" />
                );
              })}
            </div>
          </div>

          {!passed && (
            <div className="bg-card rounded-xl shadow-sm p-4 w-full space-y-3">
              <p className="text-sm font-semibold text-foreground">Правильные ответы:</p>
              {questions.map((q, i) => {
                const correct = answers[i] === q.correctIndex;
                if (correct) return null;
                return (
                  <div key={i} className="text-xs text-muted-foreground border-l-2 border-red-400 pl-3">
                    <p className="font-medium text-foreground">{q.question}</p>
                    <p className="text-green-700 mt-1">✓ {q.options[q.correctIndex]}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-card border-t px-4 py-3">
          {passed ? (
            <Button onClick={onComplete} className="w-full bg-green-600 hover:bg-green-700" size="lg">
              Начать работу →
            </Button>
          ) : (
            <div className="space-y-2">
              {retryCountdown > 0 && (
                <p className="text-xs text-center text-orange-500">
                  ⏱ Повторная попытка через {Math.floor(retryCountdown / 60)}:{String(retryCountdown % 60).padStart(2, '0')}
                </p>
              )}
              <Button
                onClick={handleRetry}
                disabled={retryCountdown > 0}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <RefreshCw size={16} className="mr-2" />
                {retryCountdown > 0 ? 'Подождите...' : 'Перечитать инструкцию'}
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return null;
}
