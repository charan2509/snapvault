import { useState, useRef } from "react";
import { Download, Copy, Check, RotateCcw } from "lucide-react";
import { retrieveContent } from "../api";

interface Props {
  onBack: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

export default function RetrieveView({ onBack }: Props) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [status, setStatus] = useState<Status>("idle");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("").toUpperCase();
  const isComplete = digits.every((d) => d.length === 1 && /[A-Za-z]/.test(d));

  const handleDigitChange = (idx: number, val: string) => {
    const ch = val.replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
    const next = [...digits];
    next[idx] = ch;
    setDigits(next);
    if (ch && idx < 3) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4);
    const next = ["", "", "", ""];
    pasted.split("").forEach((ch, i) => { next[i] = ch; });
    setDigits(next);
    inputs.current[Math.min(pasted.length, 3)]?.focus();
  };

  const handleRetrieve = async () => {
    if (!isComplete) return;
    setStatus("loading");
    setError("");
    setContent("");
    try {
      const res = await retrieveContent(code);
      setContent(res.content);
      setStatus("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setStatus("error");
    }
  };

  const handleCopyContent = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleReset = () => {
    setDigits(["", "", "", ""]);
    setStatus("idle");
    setContent("");
    setError("");
    setCopied(false);
    inputs.current[0]?.focus();
  };

  return (
    <div className="view-panel">
      <button className="back-btn" id="retrieve-back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="view-header">
        <div className="view-icon-wrap view-icon-retrieve">
          <Download size={22} strokeWidth={2} />
        </div>
        <h2 className="view-title">Retrieve Content</h2>
        <p className="view-desc">Enter the 4-letter code to retrieve your clipboard content.</p>
      </div>

      <div className="retrieve-form">
        <div className="code-input-row">
          {digits.map((d, i) => (
            <input
              key={i}
              id={`code-input-${i}`}
              ref={(el) => { inputs.current[i] = el; }}
              className={`code-input ${status === "error" ? "input-error" : ""}`}
              type="text"
              maxLength={1}
              value={d}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              onPaste={handlePaste}
              disabled={status === "loading"}
              placeholder="·"
              autoFocus={i === 0}
            />
          ))}
        </div>

        {status === "error" && (
          <div className="alert alert-error">{error}</div>
        )}

        {status !== "success" && (
          <button
            id="retrieve-submit-btn"
            className="primary-btn"
            onClick={handleRetrieve}
            disabled={!isComplete || status === "loading"}
          >
            {status === "loading" ? (
              <span className="btn-loading"><span className="spinner" /> Fetching…</span>
            ) : (
              "Retrieve Content →"
            )}
          </button>
        )}
      </div>

      {status === "success" && (
        <div className="result-panel">
          <div className="result-header">
            <span className="result-label">Content for code</span>
            <span className="result-code-badge">{code}</span>
          </div>
          <textarea
            id="retrieved-content-textarea"
            className="text-area result-textarea"
            readOnly
            value={content}
            rows={10}
          />
          <div className="result-actions">
            <button
              id="copy-content-btn"
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopyContent}
            >
              {copied
                ? <><Check size={15} strokeWidth={2.5} /> Copied!</>
                : <><Copy size={15} strokeWidth={2} /> Copy Content</>
              }
            </button>
            <button id="retrieve-again-btn" className="secondary-btn" onClick={handleReset}>
              <RotateCcw size={14} strokeWidth={2} /> Try Another Code
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
