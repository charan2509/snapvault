import { useState } from "react";
import { Clipboard, Upload, Download } from "lucide-react";
import "./App.css";
import PasteView from "./components/PasteView";
import RetrieveView from "./components/RetrieveView";

type Mode = "home" | "paste" | "retrieve";

function App() {
  const [mode, setMode] = useState<Mode>("home");

  return (
    <div className="app-root">
      <div className="bg-blob blob-1" />
      <div className="bg-blob blob-2" />
      <div className="bg-blob blob-3" />

      <div className="app-container">
        <header className="app-header">
          <button className="logo-btn" onClick={() => setMode("home")} id="logo-home-btn">
            <Clipboard size={28} strokeWidth={2} className="logo-svg" />
            <span className="logo-text">SnapVault</span>
          </button>
          <p className="logo-tagline">Snap it. Vault it. Share it.</p>
        </header>

        <main className="app-main">
          {mode === "home" && (
            <div className="home-view">
              <h1 className="home-title">Your text. Anywhere. Instantly.</h1>
              <p className="home-subtitle">
                Snap your content into SnapVault and get a unique 4-letter code.
                <br />
                Share the code — retrieve it from any device, no login needed.
              </p>
              <div className="action-cards">
                <button
                  id="btn-paste-mode"
                  className="action-card card-paste"
                  onClick={() => setMode("paste")}
                >
                  <div className="card-icon-wrap card-icon-paste">
                    <Upload size={24} strokeWidth={2} />
                  </div>
                  <div className="card-body">
                    <h2>Paste</h2>
                    <p>Upload your text &amp; get a shareable code</p>
                  </div>
                  <span className="card-arrow">→</span>
                </button>

                <button
                  id="btn-retrieve-mode"
                  className="action-card card-retrieve"
                  onClick={() => setMode("retrieve")}
                >
                  <div className="card-icon-wrap card-icon-retrieve">
                    <Download size={24} strokeWidth={2} />
                  </div>
                  <div className="card-body">
                    <h2>Retrieve</h2>
                    <p>Enter a code to get your clipboard content</p>
                  </div>
                  <span className="card-arrow">→</span>
                </button>
              </div>
            </div>
          )}

          {mode === "paste" && <PasteView onBack={() => setMode("home")} />}
          {mode === "retrieve" && <RetrieveView onBack={() => setMode("home")} />}
        </main>

        <footer className="app-footer">
          <p>Codes auto-expire in 2 hrs · No account needed · Just share the code</p>
          <p className="footer-credit">
            Made by <strong>Charan </strong> ·{" "}
            <a href="mailto:haricharan7701@gmail.com" className="footer-email">haricharan7701@gmail.com</a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
