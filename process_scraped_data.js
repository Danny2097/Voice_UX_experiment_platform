const fs = require('fs');
const path = require('path');
const https = require('https');

const INPUT_FILE = '.firecrawl/nike_products_hires.json';
const IMG_DIR = 'experiment_images';
const JSON_OUTPUT = 'local-api/data/nike-clothing.json';
const CSV_OUTPUT = 'experiment_images/nike-clothing.csv';

// Ensure directories exist
if (!fs.existsSync(IMG_DIR)) fs.mkdirSync(IMG_DIR, { recursive: true });

async function downloadImage(url, dest) {
    // Attempt to up-res if it looks like a small thumbnail
    let targetUrl = url;
    if (url.includes('t_web_pdp_535_v2')) {
        targetUrl = url.replace('t_web_pdp_535_v2', 't_PDP_1728_v1');
    } else if (url.includes('t_PDP_144_v1')) {
        targetUrl = url.replace('t_PDP_144_v1', 't_PDP_1728_v1');
    }
    
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(targetUrl, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${targetUrl}: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

async function run() {
    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    // Extract JSON from the Firecrawl result (which might have header info)
    const jsonMatch = rawData.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        console.error('No JSON found in input file');
        return;
    }
    
    const data = JSON.parse(jsonMatch[0]);
    const products = data.products || [];
    
    const processedItems = [];
    const csvRows = ['id,title,subtitle,category,description,image,tags'];
    
    console.log(`Processing ${products.length} products...`);
    
    for (const p of products) {
        if (!p.title || !p.image || p.image.includes('no longer available') || !p.id) {
            continue;
        }
        
        // Clean ID for filename
        const safeId = p.id.replace(/[^a-z0-9]/gi, '_');
        const ext = p.image.split('.').pop().split('?')[0] || 'png';
        const imgFilename = `${safeId}.${ext}`;
        const imgPath = path.join(IMG_DIR, imgFilename);
        
        try {
            console.log(`Downloading image for ${p.title}...`);
            await downloadImage(p.image, imgPath);
            
            // Use local path for the CSV/JSON that the local-api will serve
            // Note: In the experiment.html, we might need to handle local image serving
            // but for now we follow the user's request to store them in experiment_images
            const localImageSource = `/experiment_images/${imgFilename}`;
            
            const item = {
                id: p.id,
                title: p.title,
                subtitle: p.subtitle || '',
                category: p.category || '',
                description: p.description || '',
                image: localImageSource,
                tags: p.tags || []
            };
            
            processedItems.push(item);
            
            // CSV row
            const tagsStr = `"${(item.tags || []).join(', ')}"`;
            csvRows.push(`"${item.id}","${item.title.replace(/"/g, '""')}","${item.subtitle.replace(/"/g, '""')}","${item.category.replace(/"/g, '""')}","${item.description.replace(/"/g, '""')}","${item.image}",${tagsStr}`);
            
            if (processedItems.length >= 50) break;
        } catch (err) {
            console.error(`Failed to process ${p.title}:`, err.message);
        }
    }
    
    // Save JSON for local-api
    fs.writeFileSync(JSON_OUTPUT, JSON.stringify({ count: processedItems.length, items: processedItems }, null, 2));
    
    // Save CSV
    fs.writeFileSync(CSV_OUTPUT, csvRows.join('\n'));
    
    console.log(`DONE! Processed ${processedItems.length} items.`);
    console.log(`JSON: ${JSON_OUTPUT}`);
    console.log(`CSV: ${CSV_OUTPUT}`);
    console.log(`Images: ${IMG_DIR}/`);
}

run().catch(console.error);
