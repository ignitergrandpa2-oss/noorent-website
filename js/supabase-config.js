import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = window?.SUPABASE_URL || 'https://juskbhdjagjlyrfiywzk.supabase.co';
const supabaseKey = window?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2tiaGRqYWdqbHlyZml5d3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMyMTIsImV4cCI6MjA5MDM0OTIxMn0.xHIvbQrNlxPBSo-kDRsif_PwgScX7nn7ikS2TbRVILo';

if (!supabaseUrl || !supabaseKey) {
  console.error("Supabase credentials missing! Ensure SUPABASE_URL and SUPABASE_ANON_KEY are set.");
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage
  }
});


