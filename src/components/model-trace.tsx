"use client";
import { useState } from "react";
type TraceTurn = {
  id: string;
  input: string;
  status: string;
  decision: string;
  model: string | null;
  prompt_version: string | null;
  trace: { request: unknown; response: unknown } | null;
};
export function ModelTrace({
  sessionId,
  en,
}: {
  sessionId: string;
  en: boolean;
}) {
  const [turns, setTurns] = useState<TraceTurn[]>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function load() {
    if (turns || busy) return;
    setBusy(true);
    setError(false);
    try {
      const r = await fetch(`/api/sessions/${sessionId}/trace`, {
        cache: "no-store",
      });
      if (!r.ok) throw new Error();
      setTurns((await r.json()).turns);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <details
      className="model-trace"
      onToggle={(e) => {
        if (e.currentTarget.open) void load();
      }}
    >
      <summary>
        {en
          ? "Model request / response records"
          : "模型 Request / Response 记录"}
      </summary>
      <p className="muted small">
        {en
          ? "Structured SDK inputs and selected response fields, including the solution and grading rules. Authentication headers are not recorded. Failed and older calls may have no record."
          : "展示 SDK 请求参数与返回的结构化字段，包含汤底和判题规则，不记录鉴权头。失败或旧调用可能没有记录。"}
      </p>
      {busy && <p>{en ? "Loading…" : "读取中…"}</p>}
      {error && (
        <button onClick={() => void load()}>
          {en ? "Could not load. Retry" : "读取失败，点击重试"}
        </button>
      )}
      {turns?.length === 0 && (
        <p>{en ? "No model calls in this game." : "本局尚未调用模型。"}</p>
      )}
      {turns?.map((turn, i) => (
        <details key={turn.id}>
          <summary>
            {i + 1}. {turn.input}
          </summary>
          <p className="muted small">
            {turn.model} · {turn.prompt_version} ·{" "}
            {turn.decision || turn.status}
          </p>
          {turn.trace ? (
            <>
              <h3>Request</h3>
              <pre>{JSON.stringify(turn.trace.request, null, 2)}</pre>
              <h3>Response</h3>
              <pre>{JSON.stringify(turn.trace.response, null, 2)}</pre>
            </>
          ) : (
            <p>
              {en
                ? "No request / response was recorded for this turn."
                : "这条记录未保存 Request / Response。"}
            </p>
          )}
        </details>
      ))}
    </details>
  );
}
