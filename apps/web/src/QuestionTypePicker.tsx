import { useState } from "react";
import { ArrowLeft, LoaderCircle, Plus } from "lucide-react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { hostToken, request } from "./api";
import { usePreferences } from "./preferences";
import {
  makeBlankQuestion,
  questionTypeItems,
  type Translate,
} from "./question-tools";
import type { Question, Quiz } from "./types";

export function QuestionTypeGrid({
  tr,
  onSelect,
  disabled,
}: {
  tr: Translate;
  onSelect: (type: Question["type"]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="question-type-grid">
      {questionTypeItems.map((item) => (
        <button
          type="button"
          className={`question-type-card type-${item.type.toLowerCase()}`}
          key={item.type}
          disabled={disabled}
          onClick={() => onSelect(item.type)}
        >
          <span className="question-type-icon">{item.icon}</span>
          <span>
            <b>{tr(item.vi, item.en)}</b>
            <small>{tr(item.viDescription, item.enDescription)}</small>
          </span>
          <Plus />
        </button>
      ))}
    </div>
  );
}

export default function QuestionTypePicker() {
  const { tr } = usePreferences();
  const nav = useNavigate();
  const token = hostToken();
  const [creating, setCreating] = useState<Question["type"] | null>(null);
  const [error, setError] = useState("");

  if (!token) return <Navigate to="/login" replace />;

  async function create(type: Question["type"]) {
    setCreating(type);
    setError("");
    try {
      const quiz = await request<Quiz>("/quizzes", {
        method: "POST",
        token,
        body: JSON.stringify({
          title: tr("Quiz chưa đặt tên", "Untitled quiz"),
          description: "",
          category: "Technology",
          coverColor: "#2B9FBD",
          status: "DRAFT",
        }),
      });
      await request<Question>(`/quizzes/${quiz.id}/questions`, {
        method: "POST",
        token,
        body: JSON.stringify(makeBlankQuestion(type, tr)),
      });
      nav(`/editor/${quiz.id}`);
    } catch (caught) {
      setError((caught as Error).message);
      setCreating(null);
    }
  }

  return (
    <main className="question-type-picker-page">
      <header className="question-type-picker-header">
        <Link className="button button-ghost" to="/">
          <ArrowLeft /> {tr("Trang chủ", "Home")}
        </Link>
        <div>
          <b>RankRush Studio</b>
          <small>{tr("Trình tạo quiz", "Quiz creator")}</small>
        </div>
      </header>
      <section className="question-type-picker-shell">
        <span className="eyebrow">
          {tr("BẮT ĐẦU SÁNG TẠO", "START CREATING")}
        </span>
        <h1>{tr("Chọn dạng câu hỏi", "Choose a question type")}</h1>
        <p>
          {tr(
            "Bạn có thể thêm và kết hợp nhiều dạng câu hỏi trong cùng một quiz.",
            "Mix and match different question types in the same quiz.",
          )}
        </p>
        {creating && (
          <div className="picker-creating">
            <LoaderCircle className="spin-icon" />
            {tr("Đang tạo quiz...", "Creating your quiz...")}
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <QuestionTypeGrid
          tr={tr}
          disabled={Boolean(creating)}
          onSelect={(type) => void create(type)}
        />
      </section>
    </main>
  );
}
