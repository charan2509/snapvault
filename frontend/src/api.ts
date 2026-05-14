const BASE = "http://localhost:8000";

export interface PasteResponse {
  code: string;
  created_at: string;
}

export interface RetrieveResponse {
  code: string;
  content: string;
  created_at: string;
}

export async function pasteContent(content: string): Promise<PasteResponse> {
  const res = await fetch(`${BASE}/api/paste`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to paste content.");
  }
  return res.json();
}

export async function retrieveContent(code: string): Promise<RetrieveResponse> {
  const res = await fetch(`${BASE}/api/retrieve/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Failed to retrieve content.");
  }
  return res.json();
}
