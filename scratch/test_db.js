import { supabase } from './js/supabase-config.js';

async function testTables() {
    console.log("Checking tables...");
    
    const { data: bData, error: bError } = await supabase.from('business_info').select('*').limit(1);
    console.log("business_info:", bError ? bError.message : "Exists", bData);

    const { data: sData, error: sError } = await supabase.from('settings').select('*').limit(1);
    console.log("settings:", sError ? sError.message : "Exists", sData);

    const { data: oData, error: oError } = await supabase.from('orders').select('*').limit(1);
    console.log("orders:", oError ? oError.message : "Exists");

    const { data: lData, error: lError } = await supabase.from('leads').select('*').limit(1);
    console.log("leads:", lError ? lError.message : "Exists");
}

testTables();
