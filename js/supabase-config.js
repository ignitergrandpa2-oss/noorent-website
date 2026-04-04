import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://juskbhdjagjlyrfiywzk.supabase.co';
// WARNING: NEVER use sb_secret_* keys in the frontend. Use the "anon" public key instead.
const supabaseKey = 'YOUR_PUBLIC_ANON_KEY_HERE';

export const supabase = createClient(supabaseUrl, supabaseKey);
