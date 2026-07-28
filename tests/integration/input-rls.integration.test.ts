import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const url = process.env.H2O_TEST_SUPABASE_URL;
const anon = process.env.H2O_TEST_SUPABASE_ANON_KEY;
const emailA = process.env.H2O_TEST_USER_A_EMAIL;
const passwordA = process.env.H2O_TEST_USER_A_PASSWORD;
const orgA = process.env.H2O_TEST_ORG_A_ID;
const orgB = process.env.H2O_TEST_ORG_B_ID;
const enabled = Boolean(url && anon && emailA && passwordA && orgA && orgB);

describe.skipIf(!enabled)("Input Session RLS against real Supabase", () => {
  it("allows own workspace and denies a different workspace", async () => {
    const client = createClient(url!, anon!, { auth: { persistSession: false } });
    const { error: authError } = await client.auth.signInWithPassword({ email: emailA!, password: passwordA! });
    expect(authError).toBeNull();
    const own = await client.from("input_sessions").select("id,organization_id").eq("organization_id", orgA!).limit(1);
    expect(own.error).toBeNull();
    const foreign = await client.from("input_sessions").select("id,organization_id").eq("organization_id", orgB!).limit(5);
    expect(foreign.error).toBeNull();
    expect(foreign.data).toEqual([]);
  });
});
