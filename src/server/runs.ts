import "server-only";
import { publicContent, type PuzzleInput } from "@/shared/puzzle";
import { difficultyForStreak, type RunState } from "@/shared/run";
import { AppError, game, uid } from "./access";
import { query, sql } from "./db";
import { generatePuzzle } from "./deepseek";

export function publicRun(row: Record<string, unknown>): RunState {
  return {
    id: String(row.id),
    status: row.status === "ended" ? "ended" : "active",
    streak: Number(row.streak) || 0,
    locale: String(row.locale || "zh"),
    currentPuzzleId: (row.current_puzzle_id as string) || null,
    currentSessionId: (row.current_session_id as string) || null,
    endedReason: (row.ended_reason as string) || null,
  };
}

export async function currentRun(visitorId: string) {
  const [row] = await query(
    sql`SELECT * FROM runs WHERE visitor_id=${visitorId} AND status='active' ORDER BY created_at DESC LIMIT 1`,
  );
  return row ? publicRun(row) : null;
}

async function insertGenerated(
  visitorId: string,
  locale: "zh" | "en",
  streak: number,
  avoidTitles: string[],
) {
  const content = await generatePuzzle({
    language: locale,
    difficulty: difficultyForStreak(streak),
    avoidTitles,
  });
  const pid = uid(),
    revision = uid(),
    sid = uid();
  await query(
    sql`WITH created AS (INSERT INTO puzzles(id,owner_id,visibility,revision) VALUES (${pid},${visitorId},'run',${revision}) RETURNING id) INSERT INTO revisions(id,puzzle_id,public_content,secret_content) SELECT ${revision},id,${JSON.stringify(publicContent(content))}::jsonb,${JSON.stringify(content)}::jsonb FROM created`,
  );
  await query(
    sql`INSERT INTO sessions(id,visitor_id,puzzle_id,revision_id) VALUES (${sid},${visitorId},${pid},${revision})`,
  );
  return { puzzleId: pid, sessionId: sid, title: content.title };
}

export async function startRun(visitorId: string, locale: "zh" | "en") {
  const existing = await currentRun(visitorId);
  if (existing?.currentSessionId) {
    return {
      run: existing,
      game: await game(existing.currentSessionId, visitorId),
    };
  }
  const id = uid();
  const made = await insertGenerated(visitorId, locale, 0, []);
  await query(
    sql`INSERT INTO runs(id,visitor_id,locale,current_puzzle_id,current_session_id,titles) VALUES (${id},${visitorId},${locale},${made.puzzleId},${made.sessionId},${JSON.stringify([made.title])}::jsonb)`,
  );
  const [row] = await query(sql`SELECT * FROM runs WHERE id=${id}`);
  return { run: publicRun(row), game: await game(made.sessionId, visitorId) };
}

export async function rerollRun(runId: string, visitorId: string) {
  const [row] = await query(
    sql`SELECT * FROM runs WHERE id=${runId} AND visitor_id=${visitorId}`,
  );
  if (!row || row.status !== "active") throw new AppError("not_found", 404);
  const titles = Array.isArray(row.titles) ? row.titles.map(String) : [];
  const locale = row.locale === "en" ? "en" : "zh";
  const made = await insertGenerated(
    visitorId,
    locale,
    Number(row.streak),
    titles,
  );
  await query(
    sql`UPDATE runs SET current_puzzle_id=${made.puzzleId},current_session_id=${made.sessionId},titles=${JSON.stringify([...titles, made.title])}::jsonb,updated_at=now() WHERE id=${runId} AND status='active'`,
  );
  const [updated] = await query(sql`SELECT * FROM runs WHERE id=${runId}`);
  return { run: publicRun(updated), game: await game(made.sessionId, visitorId) };
}

export async function advanceRun(runId: string, visitorId: string) {
  const [row] = await query(
    sql`SELECT * FROM runs WHERE id=${runId} AND visitor_id=${visitorId}`,
  );
  if (!row || row.status !== "active") throw new AppError("not_found", 404);
  if (!row.current_session_id) throw new AppError("not_found", 404);
  const [session] = await query(
    sql`SELECT status FROM sessions WHERE id=${row.current_session_id} AND visitor_id=${visitorId}`,
  );
  if (session?.status !== "solved") throw new AppError("run_not_ready", 409);
  const titles = Array.isArray(row.titles) ? row.titles.map(String) : [];
  const locale = row.locale === "en" ? "en" : "zh";
  const made = await insertGenerated(
    visitorId,
    locale,
    Number(row.streak),
    titles,
  );
  await query(
    sql`UPDATE runs SET current_puzzle_id=${made.puzzleId},current_session_id=${made.sessionId},titles=${JSON.stringify([...titles, made.title])}::jsonb,updated_at=now() WHERE id=${runId} AND status='active'`,
  );
  const [updated] = await query(sql`SELECT * FROM runs WHERE id=${runId}`);
  return { run: publicRun(updated), game: await game(made.sessionId, visitorId) };
}

export async function endRun(
  runId: string,
  visitorId: string,
  reason: string,
) {
  const [row] = await query(
    sql`UPDATE runs SET status='ended',ended_reason=${reason},updated_at=now() WHERE id=${runId} AND visitor_id=${visitorId} AND status='active' RETURNING *`,
  );
  if (!row) {
    const [existing] = await query(
      sql`SELECT * FROM runs WHERE id=${runId} AND visitor_id=${visitorId}`,
    );
    if (!existing) throw new AppError("not_found", 404);
    return publicRun(existing);
  }
  return publicRun(row);
}

export async function collectRunPuzzle(runId: string, visitorId: string) {
  const [row] = await query(
    sql`SELECT * FROM runs WHERE id=${runId} AND visitor_id=${visitorId}`,
  );
  if (!row?.current_puzzle_id) throw new AppError("not_found", 404);
  const [p] = await query(
    sql`UPDATE puzzles SET visibility='private' WHERE id=${row.current_puzzle_id} AND owner_id=${visitorId} AND visibility='run' RETURNING id`,
  );
  if (!p) throw new AppError("not_found", 404);
  return { id: p.id as string };
}

export async function endRunForSession(
  sessionId: string,
  visitorId: string,
  reason: string,
) {
  const [row] = await query(
    sql`SELECT id FROM runs WHERE visitor_id=${visitorId} AND current_session_id=${sessionId} AND status='active'`,
  );
  if (row) await endRun(row.id as string, visitorId, reason);
}