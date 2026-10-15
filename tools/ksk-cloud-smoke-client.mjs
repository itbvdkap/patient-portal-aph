import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [envPath, from, to, cohort] = process.argv.slice(2);
const values = {};
for (const line of readFileSync(envPath, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
  const match = line.match(/^([^#=\s]+)=(.*)$/);
  if (match) values[match[1]] = match[2].trim().replace(/^"|"$/g, "");
}
const url = values.SUPABASE_URL, key = values.SUPABASE_SERVICE_ROLE_KEY || values.SUPABASE_SECRET_KEY;
if (!url?.startsWith("https://") || !key) throw new Error("Missing protected Supabase configuration.");
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const hash = createHash("sha256").update(randomUUID()).digest("hex");
const queued = await client.rpc("portal_ksk_enqueue", { p_branch: "CN1", p_operation: "report", p_hash: hash, p_input: { from, to, cohort } });
if (queued.error || typeof queued.data !== "string") throw new Error("Failed to enqueue cloud read smoke test.");
const id = queued.data;
try {
  let row;
  for (let attempt = 0; attempt < 90; attempt++) {
    const result = await client.from("portal_ksk_jobs").select("status,result,expires_at").eq("id", id).eq("branch", "CN1").maybeSingle();
    if (result.error || !result.data) throw new Error("Failed to poll cloud read smoke test.");
    row = result.data;
    if (row.status === "done") break;
    if (row.status === "failed") throw new Error("Outbound worker reported a read failure.");
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (row?.status !== "done") throw new Error("Outbound worker timed out.");
  const data = row.result;
  if (data?.scope?.branch !== "CN1" || data.scope.mode !== "his" || data.cohorts?.length !== 1 || data.cohorts[0].id !== cohort)
    throw new Error("Cloud result scope validation failed.");
  console.log(JSON.stringify({ branch: data.scope.branch, mode: data.scope.mode, cohorts: data.cohorts.length, members: data.members.length,
    visits: data.visits.length, charges: data.charges.length, labs: data.labs.length, imaging: data.imaging.length, jobCompleted: true }));
} finally {
  await client.from("portal_ksk_jobs").delete().eq("id", id).eq("branch", "CN1");
}
