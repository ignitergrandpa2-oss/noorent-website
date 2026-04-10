const url = 'https://juskbhdjagjlyrfiywzk.supabase.co/rest/v1/categories';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2tiaGRqYWdqbHlyZml5d3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMyMTIsImV4cCI6MjA5MDM0OTIxMn0.xHIvbQrNlxPBSo-kDRsif_PwgScX7nn7ikS2TbRVILo';

const categoriesList = [
    "POS",
    "Printers",
    "Printers::LaserJet Printers",
    "Printers::Thermal Printers",
    "Printers::Barcode Printers",
    "Scanners",
    "Laptops",
    "Accessories",
    "Accessories::Power Cables",
    "Accessories::VGA Cables",
    "Accessories::Mouse",
    "Accessories::Keyboard",
    "Accessories::Mouse & Keyboard Set",
    "Accessories::Adapters & Chargers",
    "Accessories::USB Flash Drives",
    "Accessories::Other Accessories",
    
    // User requested Accessories sub-products (formatted for Subcategory dropdown)
    "Accessories::Adapters & Chargers - Adapter 12v 2a",
    "Accessories::Adapters & Chargers - Adapter 12v 3a",
    "Accessories::Adapters & Chargers - Adapter 12v 4a",
    "Accessories::Adapters & Chargers - Adapter 12v 5A",
    "Accessories::Adapters & Chargers - Adapter 12v 8a",
    "Accessories::Adapters & Chargers - Adapter 48v, 54v",
    "Accessories::Adapters & Chargers - Adapter Thermal 24v",
    "Accessories::Adapters & Chargers - Adapter Zebra 24v",
    "Accessories::Adapters & Chargers - Adapter 5v",
    "Accessories::Adapters & Chargers - Adapter Hp 130w",
    "Accessories::Adapters & Chargers - Adapter Dell XPS",

    // User requested Printers sub-products
    "Printers::LaserJet Printers - Laserjet Printer 1136",
    "Printers::LaserJet Printers - Laserjet Printer 402",
    "Printers::LaserJet Printers - Laserjet Printer m15w",
    "Printers::LaserJet Printers - Laserjet Printer 1505",
    "Printers::LaserJet Printers - Laserjet Printer Canon 6030",
    "Printers::LaserJet Printers - Laserjet Printer E50145"
];

async function seed() {
    try {
        console.log("Deleting old categories (except ID 0 if any)...");
        // Actually, let's just delete all and insert fresh
        await fetch(`${url}?id=gt.0`, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        console.log("Inserting new categories...");
        const rows = categoriesList.map(name => ({ name }));
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(rows)
        });

        if (!res.ok) {
            console.error("Error inserting:", await res.text());
        } else {
            console.log("Categories successfully inserted:", (await res.json()).length);
        }
    } catch (e) {
        console.error("Failed:", e);
    }
}

seed();
