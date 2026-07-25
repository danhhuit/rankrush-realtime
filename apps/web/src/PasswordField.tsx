import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField(
  props: InputHTMLAttributes<HTMLInputElement> & { label: string },
) {
  const [visible, setVisible] = useState(false);
  const { label, ...input } = props;
  const id = `pw-${Math.random().toString(36).slice(2, 8)}`;
  return (
    <label htmlFor={id}>
      {label}
      <span className="password-wrap">
        <input
          id={id}
          type={visible ? "text" : "password"}
          {...input}
        />
        <button
          type="button"
          className="password-toggle"
          tabIndex={-1}
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  );
}
