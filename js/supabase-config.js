import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = 'https://juskbhdjagjlyrfiywzk.supabase.co';
const supabaseKey = 'sb_secret_i_hoPVFZRNObgAZdj3_YGQ_NAuEcVwA';

export const supabase = createClient(supabaseUrl, supabaseKey);
