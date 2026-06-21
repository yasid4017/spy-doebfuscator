const multer = require('multer');
const Deobfuscator = require('../utils/deobfuscator');

// ===== KONFIGURASI MULTER (Memory Storage untuk Vercel) =====
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB
    },
    fileFilter: (req, file, cb) => {
        const ext = file.originalname.split('.').pop().toLowerCase();
        if (ext === 'lua' || ext === 'txt' || !ext) {
            cb(null, true);
        } else {
            cb(new Error('Only .lua and .txt files are allowed'));
        }
    }
});

// ===== MIDDLEWARE WRAPPER untuk Vercel =====
function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

// ===== MAIN HANDLER =====
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only POST method
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            error: 'Method not allowed. Use POST.'
        });
    }

    try {
        // Parse multipart form data
        await runMiddleware(req, res, upload.single('file'));

        // Validasi file
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No file uploaded'
            });
        }

        // Baca file dari buffer
        const script = req.file.buffer.toString('utf8');

        // Validasi konten
        if (!script || script.trim().length === 0) {
            return res.status(400).json({
                success: false,
                error: 'File is empty'
            });
        }

        console.log(`[${new Date().toISOString()}] Processing: ${req.file.originalname}`);
        console.log(`[${new Date().toISOString()}] Size: ${script.length} chars`);

        // Inisialisasi deobfuscator
        const deobfuscator = new Deobfuscator();
        const result = deobfuscator.deobfuscate(script);

        // Log hasil
        if (result.success) {
            console.log(`[${new Date().toISOString()}] Success: ${result.obfuscator}`);
        } else {
            console.log(`[${new Date().toISOString()}] Failed: ${result.error}`);
        }

        // Kirim response
        res.status(200).json(result);

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error:`, error);

        if (error instanceof multer.MulterError) {
            if (error.code === 'FILE_TOO_LARGE') {
                return res.status(400).json({
                    success: false,
                    error: 'File too large. Maximum size is 10MB'
                });
            }
            return res.status(400).json({
                success: false,
                error: `Upload error: ${error.message}`
            });
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Internal server error'
        });
    }
};
