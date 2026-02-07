
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMAGEN FUENTE: Moneda Azul/Plata
const SOURCE_IMAGE = 'C:/Users/migue/.gemini/antigravity/brain/ec75cf89-9bc0-4e4b-b4c5-d3c36c62de13/uploaded_media_1770345735932.png';

// DESTINO: Carpeta original de iconos
const OUTPUT_DIR = path.resolve(__dirname, 'public/assets/icons');

// Asegurar que el directorio existe
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Lista completa de tamaños estándar para PWA/Web/Móvil
const sizes = [
    { name: 'favicon.ico', width: 32 }, // Legacy
    { name: 'favicon-16x16.png', width: 16 },
    { name: 'favicon-32x32.png', width: 32 },
    { name: 'icon-48x48.png', width: 48 },
    { name: 'icon-64x64.png', width: 64 },
    { name: 'icon-72x72.png', width: 72 },
    { name: 'icon-96x96.png', width: 96 },
    { name: 'icon-128x128.png', width: 128 },
    { name: 'icon-144x144.png', width: 144 },
    { name: 'icon-152x152.png', width: 152 },
    { name: 'icon-192x192.png', width: 192 }, // Principal Android
    { name: 'apple-touch-icon.png', width: 180 }, // iOS
    { name: 'icon-384x384.png', width: 384 },
    { name: 'icon-512x512.png', width: 512 }, // PWA Splash
    { name: 'logo-high-res.png', width: 1024 }
];

async function generateBlueIcons() {
    console.log(`Procesando Moneda Azul desde: ${SOURCE_IMAGE}`);

    try {
        const image = sharp(SOURCE_IMAGE);

        for (const size of sizes) {
            const outputPath = path.join(OUTPUT_DIR, size.name);

            await image
                .resize(size.width, size.width, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 },
                    kernel: sharp.kernel.lanczos3
                })
                .toFile(outputPath);

            console.log(`✅ Generado en icons: ${size.name} (${size.width}x${size.width})`);
        }

        console.log('\n¡Iconos actualizados en public/assets/icons!');

    } catch (error) {
        console.error('❌ Error:', error);
    }
}

generateBlueIcons();
