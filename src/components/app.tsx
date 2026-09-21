"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import type { Game, PublicPuzzle } from "@/shared/puzzle";
import type { Compass, RunState } from "@/shared/run";

type Cfg = {
  mode: string;
  model: string;
  hasDeepSeek?: boolean;
};
type View = "play" | "create" | "about";

const answers: Record<string, [string, string]> = {
  yes: ["是", "Yes"],
  no: ["不是", "No"],
  irrelevant: ["不重要", "Irrelevant"],
  uncertain: ["暂时无法判断", "Uncertain"],
};
const errors: Record<string, [string, string]> = {
  key_required: ["需要密钥。", "A key is required."],
  key_rejected: ["密钥被拒绝。", "The key was rejected."],
  generate_failed: ["这一碗没煲成，再试一次。", "Generation failed. Try again."],
  deepseek_unavailable: ["还不能现煮题目。", "Puzzle generation is unavailable."],
  run_not_ready: ["先过关再进下一案。", "Solve the current case first."],
  origin_rejected: ["请求来源被拒绝。", "Origin rejected."],
  provider_rate_limit: ["模型限流，稍后再试。", "Rate limited. Try again later."],
  upstream_failed: ["模型暂时没有回答。", "The model did not answer."],
  game_finished: ["这一局已经结束。", "This game has ended."],
  too_large: ["内容过长。", "That is too long."],
  request_pending: ["上一问还在处理。", "A request is still running."],
};

function t(zh: string, en: string, isEn: boolean) {
  return isEn ? en : zh;
}
function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d={d} />
    </svg>
  );
}

async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
): Promise<T> {
  const res = await fetch("/api/" + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(key ? { authorization: "Bearer " + key } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.code || "server_error") as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data as T;
}

export default function App({ locale }: { locale: string }) {
  const en = locale === "en";
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [puzzles, setPuzzles] = useState<PublicPuzzle[]>([]);
  const [library, setLibrary] = useState<PublicPuzzle[]>([]);
  const [selected, setSelected] = useState<PublicPuzzle | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [run, setRun] = useState<RunState | null>(null);
  const [question, setQuestion] = useState("");
  const [guess, setGuess] = useState("");
  const [compass, setCompass] = useState<Compass | null>(null);
  const [compassLoading, setCompassLoading] = useState(false);
  const [cat, setCat] = useState<keyof Compass>("identity");
  const [modal, setModal] = useState<
    null | "library" | "guess" | "truth" | "rules" | "create"
  >(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<View>("play");
  const [byok, setByok] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    surface: "",
    solution: "",
    facts: "关键事实",
    hints: "",
  });
  const stream = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const label = (d: string) => answers[d]?.[en ? 1 : 0] || d;
  const explain = (e: unknown) => {
    const code = e instanceof Error ? (e as Error & { code?: string }).code || e.message : "";
    setError(errors[code]?.[en ? 1 : 0] || t("出了点问题。", "Something went wrong.", en));
  };
  async function runTask(fn: () => Promise<void>) {
    setLoading(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      explain(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const [c, list, lib, current] = await Promise.all([
          api<Cfg>("config"),
          api<PublicPuzzle[]>("puzzles"),
          api<{ puzzles: PublicPuzzle[] }>("library"),
          api<{ run: RunState | null }>("runs"),
        ]);
        setCfg(c);
        setPuzzles(list);
        setLibrary(lib.puzzles);
        setRun(current.run);
        const params = new URLSearchParams(location.search);
        const access = params.get("access");
        const id = params.get("id");
        const key = location.hash.replace(/^#key=/, "");
        if (access && id && key) {
          await api("access/exchange", "POST", { id, role: access, secret: key });
          history.replaceState(null, "", `/${locale}`);
          const nextLib = await api<{ puzzles: PublicPuzzle[] }>("library");
          setLibrary(nextLib.puzzles);
        }
        if (current.run?.currentSessionId) {
          const g = await api<Game>("sessions/" + current.run.currentSessionId);
          setGame(g);
          setSelected(g.puzzle);
        } else {
          setSelected(list[0] || null);
        }
      } catch (e) {
        explain(e);
      }
    })();
  }, [locale]);

  useEffect(() => {
    if (stream.current) stream.current.scrollTop = stream.current.scrollHeight;
  }, [game?.turns.length, compass]);

  const confirmed = useMemo(
    () =>
      game?.turns.filter((x) => x.kind === "question" && x.decision === "yes") ||
      [],
    [game],
  );
  const denied = useMemo(
    () =>
      game?.turns.filter((x) => x.kind === "question" && x.decision === "no") ||
      [],
    [game],
  );

  async function play(puzzle: PublicPuzzle) {
    await runTask(async () => {
      const g = await api<Game>("sessions", "POST", { puzzleId: puzzle.id });
      setSelected(puzzle);
      setGame(g);
      setCompass(null);
      setModal(null);
      setView("play");
    });
  }
  async function ensureGame() {
    if (game) return game;
    if (!selected) throw new Error("not_found");
    const g = await api<Game>("sessions", "POST", { puzzleId: selected.id });
    setGame(g);
    return g;
  }
  async function startRun() {
    await runTask(async () => {
      const r = await api<{ run: RunState; game: Game }>("runs", "POST", {
        locale,
      });
      setRun(r.run);
      setGame(r.game);
      setSelected(r.game.puzzle);
      setCompass(null);
      setModal(null);
      setNotice(t("无限探案已开启。", "Endless case opened.", en));
    });
  }
  async function advance() {
    if (!run) return;
    await runTask(async () => {
      const r = await api<{ run: RunState; game: Game }>(
        `runs/${run.id}/advance`,
        "POST",
        {},
      );
      setRun(r.run);
      setGame(r.game);
      setSelected(r.game.puzzle);
      setGuess("");
      setCompass(null);
      setModal(null);
    });
  }
  async function collect() {
    if (!run) return;
    await runTask(async () => {
      await api(`runs/${run.id}/collect`, "POST", {});
      const lib = await api<{ puzzles: PublicPuzzle[] }>("library");
      setLibrary(lib.puzzles);
      setNotice(t("已收入我的作品。", "Saved to your library.", en));
    });
  }
  async function ask(text: string) {
    const q = text.trim();
    if (!q) return;
    await runTask(async () => {
      const current = await ensureGame();
      const updated = await api<Game>(
        `sessions/${current.id}/questions`,
        "POST",
        {
          text: q,
          clientRequestId: crypto.randomUUID(),
          credentialSource: cfg?.mode === "byok_only" ? "byok" : "site",
        },
        cfg?.mode === "byok_only" ? byok : undefined,
      );
      setGame(updated);
      setQuestion("");
    });
  }
  async function submitGuess(e: FormEvent) {
    e.preventDefault();
    if (!guess.trim()) return;
    await runTask(async () => {
      const current = await ensureGame();
      const updated = await api<Game>(
        `sessions/${current.id}/guess`,
        "POST",
        {
          text: guess.trim(),
          clientRequestId: crypto.randomUUID(),
          credentialSource: cfg?.mode === "byok_only" ? "byok" : "site",
        },
        cfg?.mode === "byok_only" ? byok : undefined,
      );
      setGame(updated);
      if (updated.status === "solved") {
        setModal("truth");
        const cur = await api<{ run: RunState | null }>("runs");
        setRun(cur.run);
      }
    });
  }
  async function hint() {
    await runTask(async () => {
      const current = await ensureGame();
      setGame(
        await api<Game>(`sessions/${current.id}/hints`, "POST", {
          clientRequestId: crypto.randomUUID(),
        }),
      );
    });
  }
  async function reveal() {
    await runTask(async () => {
      const current = await ensureGame();
      const g = await api<Game>(`sessions/${current.id}/reveal`, "POST", {});
      setGame(g);
      if (run?.status === "active") {
        const cur = await api<{ run: RunState | null }>("runs");
        setRun(cur.run);
      }
      setModal("truth");
    });
  }
  async function loadCompass() {
    if (compassLoading) return;
    setCompassLoading(true);
    setError("");
    try {
      const current = await ensureGame();
      const r = await api<{ compass: Compass }>(
        `sessions/${current.id}/compass`,
        "POST",
        { refresh: true },
      );
      setCompass(r.compass);
      setNotice(
        t(
          "罗盘已更新：点下面的问句就会交给 Jev。",
          "Compass ready. Click a question to ask Jev.",
          en,
        ),
      );
    } catch (e) {
      explain(e);
    } finally {
      setCompassLoading(false);
    }
  }
  async function createPuzzle(e: FormEvent) {
    e.preventDefault();
    await runTask(async () => {
      const facts = draft.facts
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);
      const created = await api<{ id: string }>("puzzles", "POST", {
        schema_version: "1.0",
        language: locale,
        title: draft.title,
        surface: draft.surface,
        solution: draft.solution,
        facts: facts.map((text, i) => ({
          id: `f${i + 1}`,
          text,
          required: i === 0,
        })),
        hints: draft.hints
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean)
          .slice(0, 3),
        unknowns: [],
        character_claims: [],
        difficulty: "medium",
        tags: [],
        source: {
          kind: "original",
          author: t("玩家", "Player", en),
        },
      });
      const lib = await api<{ puzzles: PublicPuzzle[] }>("library");
      setLibrary(lib.puzzles);
      setModal(null);
      setNotice(t("题目已保存为私有。", "Saved as a private puzzle.", en));
      const p = lib.puzzles.find((x) => x.id === created.id);
      if (p) await play(p);
    });
  }

  const chips = compass?.[cat] || [];

  return (
    <div className="studio">
      <header className="topbar">
        <div className="brand">
          <div className="mark">
            <Icon d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
          </div>
          <div>
            <h1>
              {t("汤底", "Soupbase", en)}{" "}
              <span className="chip">{t("迷雾侦探社", "Fog Studio", en)}</span>
            </h1>
            <p>{t("水平思维互动推理 · Jev 坐堂，DeepSeek 现煮", "Lateral thinking · Jev judges, DeepSeek cooks", en)}</p>
          </div>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setModal("library")}>
            {selected?.title || t("题库", "Cases", en)}
          </button>
          <button className="ghost" onClick={startRun} disabled={loading || !cfg?.hasDeepSeek}>
            {t("无限探案", "Endless", en)}
            {run?.status === "active" ? (
              <span className="streak"> · {run.streak}</span>
            ) : null}
          </button>
          <button className="ghost" onClick={() => setModal("create")}>
            {t("创作", "Create", en)}
          </button>
          <button className="icon-btn" onClick={() => setModal("rules")} title={t("规则", "Rules", en)}>
            ?
          </button>
          <a className="icon-btn" href={en ? "/zh" : "/en"}>
            {en ? "中" : "EN"}
          </a>
        </div>
      </header>
      {notice ? <div className="notice">{notice}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <main className="shell">
        <section className="panel dossier">
          <div className="kicker">
            <span className="tag rose">{t("谜面档案", "Case file", en)}</span>
            <span className="tag">
              {selected?.difficulty || "—"}
              {run?.status === "active"
                ? ` · ${t("连过", "streak", en)} ${run.streak}`
                : ""}
            </span>
          </div>
          <h2 style={{ margin: "0 0 10px" }}>
            {game?.puzzle.title || selected?.title || t("选择一道汤", "Pick a case", en)}
          </h2>
          <div className="surface">
            {game?.puzzle.surface ||
              selected?.surface ||
              t("从题库打开一案，或开始无限探案。", "Open a catalog case, or start an endless run.", en)}
          </div>
          {game?.hints?.length ? (
            <ul className="facts">
              {game.hints.map((h) => (
                <li key={h} className="yes">
                  {h}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="row">
            <button className="warn" disabled={!selected || loading} onClick={hint}>
              {t("求助灵感", "Hint", en)}
            </button>
            <button
              className="primary"
              disabled={!selected || loading}
              onClick={() => setModal("guess")}
            >
              {t("陈述最终真相", "Submit the truth", en)}
            </button>
            <button className="danger" disabled={!selected || loading} onClick={reveal}>
              {t("揭底", "Reveal", en)}
            </button>
          </div>
          <div className="notebook">
            <div className="kicker">
              <strong>{t("探案手记", "Notebook", en)}</strong>
              <div className="tabs">
                <button className={view === "play" ? "on" : ""} onClick={() => setView("play")}>
                  {t("已证实", "Yes", en)} ({confirmed.length})
                </button>
                <button
                  className={view === "about" ? "on denied" : ""}
                  onClick={() => setView("about")}
                >
                  {t("已排除", "No", en)} ({denied.length})
                </button>
              </div>
            </div>
            {view !== "about" ? (
              confirmed.length ? (
                <ul className="facts">
                  {confirmed.map((x) => (
                    <li key={x.id} className="yes">
                      {x.input}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="empty">
                  {t("还没有被判定为「是」的问题。", "No confirmed questions yet.", en)}
                </div>
              )
            ) : denied.length ? (
              <ul className="facts">
                {denied.map((x) => (
                  <li key={x.id} className="no">
                    {x.input}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="empty">
                {t("还没有被判定为「不是」的问题。", "No ruled-out questions yet.", en)}
              </div>
            )}
          </div>
        </section>

        <section className="panel chamber">
          <div className="chamber-head">
            <div className="host">
              <div className="avatar">J</div>
              <div>
                <strong>{t("探案主理人 Jev", "Host Jev", en)}</strong>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {t("只回答是 / 不是 / 不重要 / 暂时无法判断", "Answers yes / no / irrelevant / uncertain", en)}
                </div>
              </div>
            </div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              {t("回合", "Turns", en)}{" "}
              <b className="streak">
                {game?.turns.filter((x) => x.kind === "question").length || 0}
              </b>
            </div>
          </div>
          <div className="stream" ref={stream}>
            <div className="bubble host">
              {t(
                "汤面已铺开。问是非问题；没有头绪时，用下面的调查罗盘。",
                "The surface is on the table. Ask yes/no questions, or use the compass.",
                en,
              )}
            </div>
            {game?.turns.map((turn) =>
              turn.kind === "question" ? (
                <div key={turn.id}>
                  <div className="bubble you">{turn.input}</div>
                  {turn.status === "complete" ? (
                    <div className="bubble host" style={{ marginTop: 8 }}>
                      <div
                        className={
                          "verdict " +
                          (turn.decision === "yes"
                            ? "yes"
                            : turn.decision === "no"
                              ? "no"
                              : "other")
                        }
                      >
                        {label(turn.decision)}
                      </div>
                    </div>
                  ) : turn.status === "failed" ? (
                    <div className="bubble host">{t("这一问没有结果。", "No result for that question.", en)}</div>
                  ) : null}
                </div>
              ) : (
                <div key={turn.id} className="bubble you">
                  {t("提交还原：", "Guess: ", en)}
                  {turn.input}
                  {turn.status === "complete" ? (
                    <div style={{ marginTop: 6, color: "var(--muted)" }}>
                      {turn.decision === "solved"
                        ? t("推理吻合。", "That solves it.", en)
                        : t("还没闭环。", "Not closed yet.", en)}
                    </div>
                  ) : null}
                </div>
              ),
            )}
          </div>
          <div className="compass">
            <div className="kicker">
              <span>{t("调查罗盘", "Compass", en)}</span>
              <button
                className="ghost"
                disabled={!selected || compassLoading}
                onClick={loadCompass}
              >
                {compassLoading
                  ? t("正在出题…", "Writing questions…", en)
                  : t("请 DeepSeek 出题", "Ask DeepSeek", en)}
              </button>
            </div>
            <div className="compass-tabs">
              {(["identity", "scene", "cause"] as const).map((key) => (
                <button
                  key={key}
                  className={cat === key ? "on" : ""}
                  onClick={() => setCat(key)}
                >
                  {key === "identity"
                    ? t("身份", "Identity", en)
                    : key === "scene"
                      ? t("场景", "Scene", en)
                      : t("因果", "Cause", en)}
                </button>
              ))}
            </div>
            <div className="chips">
              {compassLoading ? (
                <span className="compass-wait">
                  {t(
                    "DeepSeek 正在根据汤面写是非问句，通常要十几秒。出题期间仍可手打提问。",
                    "DeepSeek is writing yes/no questions from the surface. You can still type while it works.",
                    en,
                  )}
                </span>
              ) : chips.length ? (
                chips.map((q) => (
                  <button key={q} disabled={loading} onClick={() => ask(q)}>
                    {q}
                  </button>
                ))
              ) : (
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {t(
                    "点「请 DeepSeek 出题」后，这里会出现可点击的是非问句。",
                    "Click “Ask DeepSeek” to fill this row with clickable questions.",
                    en,
                  )}
                </span>
              )}
            </div>
          </div>
          <form
            className="composer"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <input
              ref={input}
              value={question}
              maxLength={100}
              placeholder={t("问一个可以用是或不是回答的问题", "Ask a yes/no question", en)}
              onChange={(e) => setQuestion(e.target.value)}
              disabled={!selected || loading}
            />
            <button className="primary" disabled={!selected || loading || !question.trim()}>
              {t("质询", "Ask", en)}
            </button>
          </form>
        </section>
      </main>

      {modal === "library" ? (
        <Modal title={t("案卷库", "Case library", en)} onClose={() => setModal(null)}>
          <h3 style={{ marginTop: 0 }}>{t("示例题", "Samples", en)}</h3>
          <div className="cards">
            {puzzles.map((p) => (
              <button key={p.id} className={"card" + (selected?.id === p.id ? " on" : "")} onClick={() => play(p)}>
                <h3>{p.title}</h3>
                <p>{p.surface}</p>
              </button>
            ))}
          </div>
          {library.length ? (
            <>
              <h3>{t("我的作品", "My puzzles", en)}</h3>
              <div className="cards">
                {library.map((p) => (
                  <button key={p.id} className="card" onClick={() => play(p)}>
                    <h3>{p.title}</h3>
                    <p>{p.surface}</p>
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </Modal>
      ) : null}

      {modal === "guess" && game ? (
        <Modal title={t("陈述最终推理", "State the truth", en)} onClose={() => setModal(null)}>
          <form className="form" onSubmit={submitGuess}>
            <label>{t("用自己的话还原前因后果。", "Explain what actually happened.", en)}</label>
            <textarea rows={5} value={guess} onChange={(e) => setGuess(e.target.value)} />
            <div className="row">
              <button type="button" className="ghost" onClick={() => setModal(null)}>
                {t("稍后", "Later", en)}
              </button>
              <button className="primary" disabled={loading || !guess.trim()}>
                {t("提交裁决", "Submit", en)}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {modal === "truth" && game?.solution ? (
        <Modal title={t("真相大白", "The solution", en)} onClose={() => setModal(null)}>
          <div className="surface">{game.solution}</div>
          <div className="row">
            {run && game.status === "solved" ? (
              <>
                <button className="ghost" onClick={collect}>
                  {t("收藏此题", "Keep this case", en)}
                </button>
                <button className="primary" onClick={advance}>
                  {t("下一案", "Next case", en)}
                </button>
              </>
            ) : (
              <button className="primary" onClick={() => setModal("library")}>
                {t("回到题库", "Back to library", en)}
              </button>
            )}
          </div>
        </Modal>
      ) : null}

      {modal === "rules" ? (
        <Modal title={t("什么是海龟汤？", "What is this?", en)} onClose={() => setModal(null)}>
          <p>
            {t(
              "主持人给出不可思议的汤面。你只问是非问题，逐步还原汤底。Jev 判定对错；DeepSeek 只负责现煮题目和调查罗盘，看不到你正在玩的汤底。",
              "The host gives a strange surface. Ask yes/no questions until you can reconstruct the solution. Jev judges; DeepSeek only cooks new cases and compass questions, and never sees the live solution.",
              en,
            )}
          </p>
          <p>
            {t("是：事实成立。不是：事实不成立。不重要：与破案无关。暂时无法判断：证据不足。", "Yes / no / irrelevant / uncertain.", en)}
          </p>
        </Modal>
      ) : null}

      {modal === "create" ? (
        <Modal title={t("写下你的汤", "Write a puzzle", en)} onClose={() => setModal(null)}>
          <form className="form" onSubmit={createPuzzle}>
            <label>{t("标题", "Title", en)}</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
            <label>{t("汤面", "Surface", en)}</label>
            <textarea rows={3} value={draft.surface} onChange={(e) => setDraft({ ...draft, surface: e.target.value })} required />
            <label>{t("汤底", "Solution", en)}</label>
            <textarea rows={4} value={draft.solution} onChange={(e) => setDraft({ ...draft, solution: e.target.value })} required />
            <label>{t("关键事实（一行一条，第一条为必答）", "Facts, one per line. First is required.", en)}</label>
            <textarea rows={3} value={draft.facts} onChange={(e) => setDraft({ ...draft, facts: e.target.value })} required />
            <label>{t("提示（可选，一行一条）", "Hints, optional", en)}</label>
            <textarea rows={2} value={draft.hints} onChange={(e) => setDraft({ ...draft, hints: e.target.value })} />
            <div className="row">
              <button type="button" className="ghost" onClick={() => setModal(null)}>
                {t("取消", "Cancel", en)}
              </button>
              <button className="primary" disabled={loading}>
                {t("保存并开局", "Save and play", en)}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <header>
          <strong>{title}</strong>
          <button className="icon-btn" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
