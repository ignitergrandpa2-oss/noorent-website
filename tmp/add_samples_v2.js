const https = require('https');

const supabaseUrl = 'https://juskbhdjagjlyrfiywzk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp1c2tiaGRqYWdqbHlyZml5d3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NzMyMTIsImV4cCI6MjA5MDM0OTIxMn0.xHIvbQrNlxPBSo-kDRsif_PwgScX7nn7ikS2TbRVILo';

const products = [
    {
        name: "HP LaserJet P2015dn",
        brand: "HP",
        model_number: "P2015dn",
        category: "Printers",
        description: "Professional monochrome laser printer with automatic duplexing and networking.",
        price: "17,500/-",
        show_price: true,
        stock_status: "In Stock",
        availability: true,
        warranty: "6 Months"
    },
    {
        name: "HP LaserJet P1505",
        brand: "HP",
        model_number: "P1505",
        category: "Printers",
        description: "Compact and reliable monochrome laser printer for home or small office use.",
        price: "17,000/-",
        show_price: true,
        stock_status: "In Stock",
        availability: true,
        warranty: "6 Months"
    },
    {
        name: "HP LaserJet P402dn",
        brand: "HP",
        model_number: "P402dn",
        category: "Printers",
        description: "High-performance laser printer with fast printing speeds and robust security features.",
        price: "31,000/-",
        show_price: true,
        stock_status: "In Stock",
        availability: true,
        warranty: "1 Year"
    },
    {
        name: "HP LaserJet Pro M15w",
        brand: "HP",
        model_number: "M15w",
        category: "Printers",
        description: "World's smallest laser in its class, with wireless printing and mobile setup.",
        price: "25,000/-",
        show_price: true,
        stock_status: "In Stock",
        availability: true,
        warranty: "1 Year"
    },
    {
        name: "BIXOLON SRP-352plusIII Thermal Printer",
        brand: "BIXOLON",
        model_number: "SRP-352plusIII",
        category: "Printers",
        description: "Premium 3-inch thermal POS printer with high speed and high reliability.",
        price: "8,500/-",
        show_price: true,
        stock_status: "In Stock",
        availability: true,
        warranty: "1 Year"
    }
];

function postProduct(prod) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(prod);
        const options = {
            hostname: 'juskbhdjagjlyrfiywzk.supabase.co',
            port: 443,
            path: '/rest/v1/products',
            method: 'POST',
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (d) => body += d);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Added: ${prod.name}`);
                    resolve();
                } else {
                    console.error(`Error adding ${prod.name}: ${res.statusCode} - ${body}`);
                    reject(new Error(body));
                }
            });
        });

        req.on('error', (e) => {
            console.error(`Request error: ${e.message}`);
            reject(e);
        });

        req.write(data);
        req.end();
    });
}

async function addAll() {
    for (const p of products) {
        await postProduct(p).catch(() => {});
    }
    console.log("Finished adding samples.");
}

addAll();
