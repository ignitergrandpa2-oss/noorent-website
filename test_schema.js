import { supabase } from './js/supabase-config.js';

async function testAddColumn() {
    try {
        const payload = {
            subcategory: "test_sub"
        };
        const { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', '123456'); // dummy id
        console.log("Update Error:", error);

        const { data:catData, error:catError } = await supabase
            .from('categories')
            .insert({ name: 'TestCat', subcategories: ['Sub1', 'Sub2'] });
        console.log("Insert Cat Error:", catError);
    } catch (e) {
        console.error(e);
    }
}
testAddColumn();
