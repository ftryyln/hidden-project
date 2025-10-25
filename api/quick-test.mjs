import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" }, // paksa schema public
});

try {
    // 2.1: cek konek basic
    const pong = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    console.log("REST root status:", pong.status);

    // 2.2: cek tabel benar-benar ada
    const { data: tables, error: e0 } = await supabase.rpc("pg_tables"); // kadang diblok, jadi lanjut ke query langsung
    if (e0) console.log("pg_tables skipped:", e0.message);

    // 2.3: SELECT tabel yang sering kamu pakai
    const t1 = await supabase.from("profiles").select("id, email").limit(1);
    console.log("profiles:", t1.error?.message || t1.data);

    const t2 = await supabase.from("guild_user_roles").select("role").limit(1);
    console.log("guild_user_roles:", t2.error?.message || t2.data);
} catch (e) {
    console.error("Quick test failed:", e);
}
