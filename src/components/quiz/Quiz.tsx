import { useContext, useState } from 'react';
import { saveQuizScore } from '../../utils/storage';
import { H2 } from '../content/Prose';
import { TopicContext } from '../content/topicContext';
import QuizQuestion, { type QuizQuestionData } from './QuizQuestion';

function countCorrect(answers: (number | null)[], questions: QuizQuestionData[]): number {
  return answers.filter((answer, index) => answer === questions[index]?.answer).length;
}

/** Template block 9: 3 to 5 MCQs with instant feedback. The score is saved per topic. */
export default function Quiz({ questions }: { questions: QuizQuestionData[] }) {
  const topicKey = useContext(TopicContext);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));

  const done = answers.every((answer) => answer !== null);
  const score = countCorrect(answers, questions);

  const pick = (questionIndex: number, optionIndex: number) => {
    if (answers[questionIndex] != null) return; // already answered
    const next = answers.map((answer, index) => (index === questionIndex ? optionIndex : answer));
    setAnswers(next);
    if (topicKey && next.every((answer) => answer !== null)) {
      saveQuizScore(topicKey, { score: countCorrect(next, questions), total: questions.length });
    }
  };

  return (
    <section>
      <H2>Quick quiz</H2>
      <div className="space-y-4">
        {questions.map((question, index) => (
          <QuizQuestion
            key={index}
            number={index + 1}
            question={question}
            picked={answers[index] ?? null}
            onPick={(optionIndex) => pick(index, optionIndex)}
          />
        ))}
      </div>
      <div role="status" className="mt-4 flex flex-wrap items-center gap-3">
        {done && (
          <>
            <p className="font-semibold">
              Your score: {score} / {questions.length}
            </p>
            <button
              type="button"
              onClick={() => setAnswers(questions.map(() => null))}
              className="tap rounded-lg border border-slate-300 px-4 font-medium hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Try again
            </button>
          </>
        )}
      </div>
    </section>
  );
}
