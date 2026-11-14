export interface QuizQuestionData {
  q: string;
  options: string[];
  /** Position of the correct option, starting from 0. */
  answer: number;
  /** Shown after answering: why the correct option is correct. */
  why: string;
}

interface QuizQuestionProps {
  number: number;
  question: QuizQuestionData;
  /** Option the learner picked, or null if not answered yet. */
  picked: number | null;
  onPick: (optionIndex: number) => void;
}

export default function QuizQuestion({ number, question, picked, onPick }: QuizQuestionProps) {
  const answered = picked !== null;
  const correct = picked === question.answer;

  return (
    <fieldset className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <legend className="px-1 font-medium">
        {number}. {question.q}
      </legend>
      <div className="mt-2 grid gap-2">
        {question.options.map((option, index) => {
          let look =
            'border-slate-300 hover:border-brand-500 dark:border-slate-600 dark:hover:border-brand-400';
          if (answered && index === question.answer) {
            look = 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50';
          } else if (answered && index === picked) {
            look = 'border-red-500 bg-red-50 dark:bg-red-950/50';
          } else if (answered) {
            look = 'border-slate-200 opacity-70 dark:border-slate-700';
          }
          return (
            <button
              key={index}
              type="button"
              disabled={answered}
              aria-pressed={index === picked}
              onClick={() => onPick(index)}
              className={`min-h-11 rounded-lg border px-3 py-2 text-left ${look}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      <p role="status" className="mt-3 text-sm leading-6">
        {answered && (
          <>
            <strong
              className={
                correct
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-red-700 dark:text-red-400'
              }
            >
              {correct ? '✅ Correct. ' : '❌ Not quite. '}
            </strong>
            {question.why}
          </>
        )}
      </p>
    </fieldset>
  );
}
