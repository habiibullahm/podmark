// RLS + sync-semantics check for the Neon schema: `npm run db:verify`.
// DATABASE_URL = the branch owner's connection string (never commit it).
//
// Simulates two users through request.jwt.claims (pg_session_jwt's fallback
// when no JWT session is initialised), so no real accounts are needed. Each
// write mimics the Data API's upsert (resolution=merge-duplicates):
// INSERT ... ON CONFLICT (...) DO UPDATE SET <payload cols> = EXCLUDED.<col>.
// Rows belong to two fixed fake user ids and are deleted at the end, so it is
// safe to run against the live branch.
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const A = "db-verify-user-a", B = "db-verify-user-b";
const T = {
  episodes: { k: ["id"], row: { id: "verify-ep", title: "Verify", show: "Probe" }, change: { title: "Verify v2" } },
  notes: { k: ["id"], row: { id: "verify-note", episode_id: "verify-ep", type: "note", text: "n" }, change: { text: "n2" } },
  freeform_notes: { k: ["episode_id"], row: { episode_id: "verify-ep", text: "f" }, change: { text: "f2" } },
  ai_summaries: { k: ["episode_id"], row: { episode_id: "verify-ep", bullets: ["a"] }, change: { bullets: ["a", "b"] } },
  folders: { k: ["id"], row: { id: "verify-folder", name: "F", color: "red", episode_ids: ["verify-ep"] }, change: { name: "F2" } },
  settings: { k: [], row: { daily_goal_target: 30, notifications_enabled: true, export_format: "obsidian" }, change: { daily_goal_target: 45 } },
  activity: { k: ["date"], row: { date: "2026-10-10", minutes: 5 }, change: { minutes: 7.5 } },
  progress: { k: ["episode_id"], row: { episode_id: "verify-ep", seconds: 10 }, change: { seconds: 20.5 } },
  transcripts: { k: ["episode_id"], row: { episode_id: "verify-ep", segments: JSON.stringify([{ start: 0, end: 1, text: "hi" }]) }, change: { segments: "[]" } },
};
let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };
const run = async (sql, params) => { try { return { rows: (await c.query(sql, params)).rows }; } catch (e) { return { err: e.code, msg: e.message }; } };
async function as(user) {
  await c.query("reset role");
  await c.query("select set_config('request.jwt.claims', $1, false)", [user ? JSON.stringify({ sub: user, role: "authenticated" }) : ""]);
  await c.query(user === null ? "set role anonymous" : "set role authenticated");
}
function upsertSql(table, row) {
  const cols = Object.keys(row);
  const conflict = ["user_id", ...T[table].k].join(",");
  return {
    sql: `insert into ${table} (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) on conflict (${conflict}) do update set ${cols.map((x) => `${x}=excluded.${x}`).join(",")} returning *`,
    params: Object.values(row),
  };
}
const upsert = (t, row) => { const { sql, params } = upsertSql(t, row); return run(sql, params); };
const keyFilter = (t, row) => T[t].k.map((k) => `${k} = '${row[k]}'`).concat(["true"]).join(" and ");

try {
  await as(A);
  // Direct calls are denied (auth schema is cloud_admin-owned); defaults and
  // policies still resolve — the per-table checks below prove that.
  const direct = await run("select auth.user_id() u");
  ok("direct auth.user_id() from authenticated is denied (expected)", direct.err === "42501", direct.err ?? "allowed");
  for (const [t, s] of Object.entries(T)) {
    await as(A);
    const ins = await upsert(t, s.row);
    ok(`${t}: insert fills user_id from claims`, ins.rows?.[0]?.user_id === A, ins.msg);
    const t0 = ins.rows?.[0]?.updated_at;
    await new Promise((r) => setTimeout(r, 50));
    const upd = await upsert(t, { ...s.row, ...s.change });
    const [ck, cv] = Object.entries(s.change)[0];
    const got = upd.rows?.[0]?.[ck];
    ok(`${t}: on-conflict update applies`, upd.rows?.length === 1 && JSON.stringify(typeof cv === "string" && cv.startsWith("[") ? JSON.parse(cv) : cv) === JSON.stringify(typeof got === "string" && !isNaN(got) ? Number(got) : got), upd.msg);
    ok(`${t}: updated_at bumped by trigger`, upd.rows?.[0] && new Date(upd.rows[0].updated_at) > new Date(t0));
    const del = await upsert(t, { ...s.row, deleted_at: new Date().toISOString() });
    ok(`${t}: soft-delete tombstone`, del.rows?.[0]?.deleted_at != null, del.msg);
    const hard = await run(`delete from ${t} where user_id = $1`, [A]);
    ok(`${t}: hard DELETE denied`, hard.err === "42501", hard.err ?? `deleted ${hard.rows?.length}`);

    await as(B);
    const read = await run(`select count(*)::int n from ${t} where user_id = $1`, [A]);
    ok(`${t}: B cannot read A`, read.rows?.[0]?.n === 0, read.msg);
    const bupd = await run(`update ${t} set updated_at = now() where user_id = $1 returning 1`, [A]);
    ok(`${t}: B cannot update A`, bupd.rows?.length === 0, bupd.msg);
    const spoof = await upsert(t, { ...s.row, user_id: A });
    ok(`${t}: B cannot insert as A`, spoof.err === "42501", spoof.err ?? "inserted!");
    const own = await upsert(t, s.row);
    ok(`${t}: B's same-key row is separate`, own.rows?.[0]?.user_id === B, own.msg);
    await as(A);
    const still = await run(`select deleted_at from ${t} where ${keyFilter(t, s.row)}`);
    ok(`${t}: A's row untouched by B`, still.rows?.length === 1 && still.rows[0].deleted_at != null, still.msg);

    await as(null);
    const anon = await run(`select 1 from ${t} limit 1`);
    ok(`${t}: anonymous denied`, anon.err === "42501", anon.err ?? "readable!");
    await as("");
    const nosub = await upsert(t, s.row);
    ok(`${t}: no sub claim cannot write`, Boolean(nosub.err), nosub.err ?? "wrote!");
  }
} finally {
  await c.query("reset role");
  for (const t of Object.keys(T)) await c.query(`delete from ${t} where user_id in ($1,$2)`, [A, B]);
  console.log(`\n${pass} passed, ${fail} failed (test rows cleaned up)`);
  await c.end();
  process.exitCode = fail ? 1 : 0;
}
