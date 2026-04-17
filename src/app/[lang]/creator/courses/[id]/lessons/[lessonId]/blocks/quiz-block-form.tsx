"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import type { Locale } from "@/lib/locales";
import type {
  QuizBlockData,
  QuizOption,
  QuizQuestion,
} from "@/lib/actions/content-blocks";

type Dict = {
  titleLabel: string;
  titleHelp: string;
  thresholdLabel: string;
  thresholdHelp: string;
  questionHeading: string;
  questionTextLabel: string;
  questionExplanationLabel: string;
  questionExplanationHelp: string;
  removeQuestionCta: string;
  addQuestionCta: string;
  optionHeading: string;
  optionTextLabel: string;
  correctOptionLabel: string;
  markCorrectLabel: string;
  removeOptionCta: string;
  addOptionCta: string;
  minQuestionsHint: string;
  minOptionsHint: string;
  saveCta: string;
  savingLabel: string;
  cancelCta: string;
  genericError: string;
  missingCorrectError: string;
};

type ActionResult =
  | { ok: true; data: { id: string; lessonId: string; courseId: string } }
  | { ok: false; error: string; code: string };

function shortId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}

function emptyOption(): QuizOption {
  return { id: shortId(), text: "" };
}

function emptyQuestion(): QuizQuestion {
  const a = emptyOption();
  const b = emptyOption();
  return {
    id: shortId(),
    text: "",
    options: [a, b],
    correctOptionId: a.id,
  };
}

export function QuizBlockForm({
  lang,
  courseId,
  lessonId,
  initial,
  dict,
  action,
  mode,
}: {
  lang: Locale;
  courseId: string;
  lessonId: string;
  initial?: { id: string; data: QuizBlockData };
  dict: Dict;
  action: (formData: FormData) => Promise<ActionResult>;
  mode: "new" | "edit";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState<string>(initial?.data.title ?? "");
  const [threshold, setThreshold] = useState<number>(
    initial?.data.passThresholdPercent ?? 70,
  );
  const [questions, setQuestions] = useState<QuizQuestion[]>(
    initial?.data.questions?.length ? initial.data.questions : [emptyQuestion()],
  );
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(qid: string, patch: Partial<QuizQuestion>) {
    setQuestions((prev) => prev.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(qid: string) {
    setQuestions((prev) => (prev.length <= 1 ? prev : prev.filter((q) => q.id !== qid)));
  }

  function addOption(qid: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid && q.options.length < 8
          ? { ...q, options: [...q.options, emptyOption()] }
          : q,
      ),
    );
  }

  function removeOption(qid: string, oid: string) {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qid) return q;
        if (q.options.length <= 2) return q;
        const nextOptions = q.options.filter((o) => o.id !== oid);
        const nextCorrect =
          q.correctOptionId === oid ? nextOptions[0]?.id ?? "" : q.correctOptionId;
        return { ...q, options: nextOptions, correctOptionId: nextCorrect };
      }),
    );
  }

  function updateOptionText(qid: string, oid: string, text: string) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid
          ? {
              ...q,
              options: q.options.map((o) => (o.id === oid ? { ...o, text } : o)),
            }
          : q,
      ),
    );
  }

  function markCorrect(qid: string, oid: string) {
    updateQuestion(qid, { correctOptionId: oid });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    for (const q of questions) {
      if (!q.options.some((o) => o.id === q.correctOptionId)) {
        setError(dict.missingCorrectError);
        return;
      }
    }

    const payload: QuizBlockData = {
      passThresholdPercent: threshold,
      questions: questions.map((q) => ({
        id: q.id,
        text: q.text.trim(),
        options: q.options.map((o) => ({ id: o.id, text: o.text.trim() })),
        correctOptionId: q.correctOptionId,
        ...(q.explanation && q.explanation.trim()
          ? { explanation: q.explanation.trim() }
          : {}),
      })),
    };
    if (title.trim()) payload.title = title.trim();

    const formData = new FormData();
    formData.set("lang", lang);
    formData.set("payload", JSON.stringify(payload));
    if (mode === "new") {
      formData.set("lessonId", lessonId);
    } else if (initial?.id) {
      formData.set("id", initial.id);
    }

    startTransition(async () => {
      const result = await action(formData);
      if (result.ok) {
        const flag = mode === "new" ? "block-created" : "block-saved";
        router.push(
          `/${lang}/creator/courses/${courseId}/lessons/${lessonId}?saved=${flag}`,
        );
        router.refresh();
      } else {
        setError(dict.genericError);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label htmlFor="quizTitle" className="text-sm font-medium">
          {dict.titleLabel}
        </label>
        <input
          id="quizTitle"
          type="text"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-describedby="quiz-title-help"
          className="min-h-11 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="quiz-title-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.titleHelp}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="quizThreshold" className="text-sm font-medium">
          {dict.thresholdLabel}
        </label>
        <input
          id="quizThreshold"
          type="number"
          min={0}
          max={100}
          step={1}
          value={threshold}
          onChange={(e) => {
            const n = Number.parseInt(e.target.value, 10);
            setThreshold(Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 70);
          }}
          aria-describedby="quiz-threshold-help"
          className="min-h-11 w-32 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
        />
        <p id="quiz-threshold-help" className="text-xs text-zinc-600 dark:text-zinc-400">
          {dict.thresholdHelp}
        </p>
      </div>

      <ol className="flex flex-col gap-6">
        {questions.map((q, qIndex) => (
          <li
            key={q.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/15"
          >
            <fieldset className="flex flex-col gap-4">
              <legend className="text-sm font-semibold">
                {dict.questionHeading.replace("{n}", String(qIndex + 1))}
              </legend>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`quiz-q-${q.id}-text`}
                  className="text-sm font-medium"
                >
                  {dict.questionTextLabel}
                </label>
                <textarea
                  id={`quiz-q-${q.id}-text`}
                  value={q.text}
                  onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
                  maxLength={1000}
                  required
                  rows={2}
                  className="min-h-20 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                />
              </div>

              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-medium">{dict.optionHeading}</legend>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {dict.correctOptionLabel}
                </p>
                <ul className="flex flex-col gap-2">
                  {q.options.map((o, oIndex) => {
                    const radioId = `quiz-q-${q.id}-correct-${o.id}`;
                    const textId = `quiz-q-${q.id}-option-${o.id}`;
                    const isCorrect = q.correctOptionId === o.id;
                    return (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center gap-2 sm:flex-nowrap"
                      >
                        <div className="flex min-h-11 items-center gap-2 rounded-md border border-black/10 px-2 dark:border-white/15">
                          <input
                            id={radioId}
                            type="radio"
                            name={`quiz-q-${q.id}-correct`}
                            checked={isCorrect}
                            onChange={() => markCorrect(q.id, o.id)}
                            aria-label={dict.markCorrectLabel}
                            className="h-5 w-5"
                          />
                          <span className="text-xs text-zinc-600 dark:text-zinc-400">
                            {String.fromCharCode(65 + oIndex)}
                          </span>
                        </div>
                        <label htmlFor={textId} className="sr-only">
                          {dict.optionTextLabel}
                        </label>
                        <input
                          id={textId}
                          type="text"
                          value={o.text}
                          onChange={(e) =>
                            updateOptionText(q.id, o.id, e.target.value)
                          }
                          maxLength={300}
                          required
                          className="min-h-11 flex-1 rounded-md border border-black/15 bg-transparent px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => removeOption(q.id, o.id)}
                          disabled={q.options.length <= 2}
                          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-3 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
                        >
                          {dict.removeOptionCta}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {q.options.length <= 2 ? (
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {dict.minOptionsHint}
                  </p>
                ) : null}
                <div>
                  <button
                    type="button"
                    onClick={() => addOption(q.id)}
                    disabled={q.options.length >= 8}
                    className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
                  >
                    {dict.addOptionCta}
                  </button>
                </div>
              </fieldset>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor={`quiz-q-${q.id}-explain`}
                  className="text-sm font-medium"
                >
                  {dict.questionExplanationLabel}
                </label>
                <textarea
                  id={`quiz-q-${q.id}-explain`}
                  value={q.explanation ?? ""}
                  onChange={(e) =>
                    updateQuestion(q.id, { explanation: e.target.value })
                  }
                  maxLength={1000}
                  rows={2}
                  aria-describedby={`quiz-q-${q.id}-explain-help`}
                  className="min-h-20 rounded-md border border-black/15 bg-transparent px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20"
                />
                <p
                  id={`quiz-q-${q.id}-explain-help`}
                  className="text-xs text-zinc-600 dark:text-zinc-400"
                >
                  {dict.questionExplanationHelp}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => removeQuestion(q.id)}
                  disabled={questions.length <= 1}
                  className="inline-flex min-h-11 items-center justify-center rounded-md border border-red-500/40 px-4 text-sm font-medium text-red-700 hover:bg-red-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 dark:text-red-300"
                >
                  {dict.removeQuestionCta}
                </button>
              </div>
            </fieldset>
          </li>
        ))}
      </ol>

      {questions.length <= 1 ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {dict.minQuestionsHint}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          onClick={addQuestion}
          disabled={questions.length >= 20}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-black/15 px-4 text-sm font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.addQuestionCta}
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-800 dark:border-red-400/30 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center justify-center rounded-md bg-foreground px-6 text-base font-semibold text-background hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current disabled:opacity-60"
        >
          {pending ? dict.savingLabel : dict.saveCta}
        </button>
        <Link
          href={`/${lang}/creator/courses/${courseId}/lessons/${lessonId}`}
          className="inline-flex min-h-12 items-center justify-center rounded-md border border-black/15 px-6 text-base font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current dark:border-white/20 dark:hover:bg-white/5"
        >
          {dict.cancelCta}
        </Link>
      </div>
    </form>
  );
}
