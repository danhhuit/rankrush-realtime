import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import type { Locale } from "./preferences";
import type { Question } from "./types";

const storageKey = "rr_question_voice_enabled";

function speak(question: Pick<Question, "prompt" | "options">, locale: Locale) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const optionText = question.options
    .map(
      (option, index) =>
        `${String.fromCharCode(65 + index)}. ${option.text}`,
    )
    .join(". ");
  const utterance = new SpeechSynthesisUtterance(
    [question.prompt, optionText].filter(Boolean).join(". "),
  );
  utterance.lang = locale === "vi" ? "vi-VN" : "en-US";
  const voice = window.speechSynthesis
    .getVoices()
    .find((item) =>
      item.lang.toLowerCase().startsWith(locale === "vi" ? "vi" : "en"),
    );
  if (voice) utterance.voice = voice;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export default function QuestionVoice({
  question,
  locale,
  tr,
}: {
  question?: Pick<Question, "id" | "prompt" | "options"> | null;
  locale: Locale;
  tr: (vi: string, en: string) => string;
}) {
  const supported = "speechSynthesis" in window;
  const [enabled, setEnabled] = useState(
    () => localStorage.getItem(storageKey) === "true",
  );

  useEffect(() => {
    if (enabled && question) speak(question, locale);
    return () => window.speechSynthesis?.cancel();
  }, [enabled, locale, question?.id]);

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(storageKey, String(next));
    if (!next) window.speechSynthesis?.cancel();
  }

  return (
    <button
      type="button"
      className={`icon-button question-voice-toggle ${enabled ? "active" : ""}`}
      disabled={!supported}
      title={
        supported
          ? enabled
            ? tr("Tắt giọng đọc câu hỏi", "Turn off question voice")
            : tr("Bật giọng đọc câu hỏi", "Turn on question voice")
          : tr(
              "Trình duyệt không hỗ trợ giọng đọc",
              "Speech is not supported by this browser",
            )
      }
      aria-pressed={enabled}
      onClick={toggle}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
    </button>
  );
}
