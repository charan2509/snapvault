import { useState } from "react";
import { Upload, CheckCircle, Copy, Check, RotateCcw } from "lucide-react";
import { pasteContent } from "../api";

interface Props {
  onBack: () => void;
}

type Status = "idle" | "loading" | "success" | "error";

export default function PasteView({ onBack }: Props) {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handlePaste = async () => {
    if (!text.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await pasteContent(text);
      setCode(res.code);
      setStatus("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setError(msg);
      setStatus("error");
    }
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const handleReset = () => {
    setText("");
    setCode("");
    setStatus("idle");
    setError("");
    setCopied(false);
  };

  return (
    <div className="view-panel">
      <button className="back-btn" id="paste-back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="view-header">
        <div className="view-icon-wrap view-icon-paste">
          <Upload size={22} strokeWidth={2} />
        </div>
        <h2 className="view-title">Paste Your Content</h2>
        <p className="view-desc">Type or paste your text below. You'll receive a unique 4-letter code.</p>
      </div>

      {status !== "success" ? (
        <div className="paste-form">
          <textarea
            id="paste-textarea"
            className="text-area"
            placeholder="Paste or type your content here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            disabled={status === "loading"}
          />
          <div className="char-count">{text.length} characters</div>

          {status === "error" && (
            <div className="alert alert-error">{error}</div>
          )}

          <button
            id="paste-submit-btn"
            className="primary-btn"
            onClick={handlePaste}
            disabled={!text.trim() || status === "loading"}
          >
            {status === "loading" ? (
              <span className="btn-loading"><span className="spinner" /> Uploading…</span>
            ) : (
              "Generate Code →"
            )}
          </button>
        </div>
      ) : (
        <div className="success-panel">
          <div className="success-icon-wrap">
            <CheckCircle size={48} strokeWidth={1.5} className="success-svg" />
          </div>
          <p className="success-msg">Your content is saved! Share this code:</p>

          <div className="code-display" id="generated-code-display">
            {code.split("").map((ch, i) => (
              <span key={i} className="code-letter">{ch}</span>
            ))}
          </div>

          <div className="success-actions">
            <button
              id="copy-code-btn"
              className={`copy-btn ${copied ? "copied" : ""}`}
              onClick={handleCopyCode}
            >
              {copied
                ? <><Check size={15} strokeWidth={2.5} /> Copied!</>
                : <><Copy size={15} strokeWidth={2} /> Copy Code</>
              }
            </button>

            <button id="paste-again-btn" className="secondary-btn" onClick={handleReset}>
              <RotateCcw size={14} strokeWidth={2} /> Paste Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
