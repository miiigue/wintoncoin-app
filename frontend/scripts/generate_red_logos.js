/**
 * ============================================================================
 * [WINTONCOIN] - GENERADOR DE SUITE MULTI-FORMATO: MONEDA RED (Compromiso RED)
 * ============================================================================
 * Genera la suite completa de iconos y formatos de la Moneda RED institucional
 * (Variación 2: Espejo Canónico de BLUE con disco de titanio/plata y glifo R carmesí).
 * Aplica máscara circular alfa con suavizado Lanczos3 para transparencia limpia.
 * ============================================================================
 */
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// IMAGEN MAESTRA APROBADA OFICIAL DEFINITIVA (Opción 2-A Perfeccionada)
// Paridad 1:1 con BLUE: Disco titanio/plata cepillada, relieve 3D rojo rubí,
// 3 bordes izquierdos rigurosamente alineados (serif, barra media y pie),
// barra horizontal derecha extendida y base limpia sin patas abajo.
const MASTER_IMAGE = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_3_bordes_alineados_transparente.png';

// DIRECTORIO DESTINO: public/assets/icons
const OUTPUT_DIR = path.resolve(__dirname, '../public/assets/icons');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Lista completa de formatos estandarizados
const SIZES = [
  { name: 'red-favicon.ico', width: 32 },
  { name: 'red-favicon-16x16.png', width: 16 },
  { name: 'red-favicon-32x32.png', width: 32 },
  { name: 'red-icon-48x48.png', width: 48 },
  { name: 'red-icon-64x64.png', width: 64 },
  { name: 'red-icon-72x72.png', width: 72 },
  { name: 'red-icon-96x96.png', width: 96 },
  { name: 'red-icon-128x128.png', width: 128 },
  { name: 'red-icon-144x144.png', width: 144 },
  { name: 'red-icon-152x152.png', width: 152 },
  { name: 'red-icon-192x192.png', width: 192 },
  { name: 'red-apple-touch-icon.png', width: 180 },
  { name: 'red-icon-384x384.png', width: 384 },
  { name: 'red-icon-512x512.png', width: 512 },
  { name: 'red-logo-high-res.png', width: 1024 }
];

async function generateRedIcons() {
  console.log(`[RED-COIN-GENERATOR] Procesando Moneda RED desde: ${MASTER_IMAGE}`);

  try {
    // 1. Crear máscara circular antialiasing pura en 1024x1024
    // La moneda en el render tiene su radio exterior en aprox 472px (diámetro 944px)
    const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
    const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

    // 2. Crear master con canal alfa transparente
    const transparentMaster = await sharp(MASTER_IMAGE)
      .resize(1024, 1024)
      .composite([{
        input: maskBuffer,
        blend: 'dest-in'
      }])
      .png({ compressionLevel: 9, quality: 100 })
      .toBuffer();

    // Guardar el master en la carpeta de icons
    const masterDest = path.join(OUTPUT_DIR, 'red-logo-high-res.png');
    fs.writeFileSync(masterDest, transparentMaster);
    console.log(`✅ [1024x1024] Creado master transparente: ${masterDest}`);

    // 3. Generar cada tamaño de la suite con Lanczos3 y transparencia
    for (const size of SIZES) {
      if (size.name === 'red-logo-high-res.png') continue;

      const outputPath = path.join(OUTPUT_DIR, size.name);

      await sharp(transparentMaster)
        .resize(size.width, size.width, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
          kernel: sharp.kernel.lanczos3
        })
        .png({ compressionLevel: 9 })
        .toFile(outputPath);

      console.log(`✅ [${size.width}x${size.width}] Generado formato: ${size.name}`);
    }

    console.log('\n🎉 ¡Suite de iconos y logos RED generada exitosamente en public/assets/icons!');
  } catch (error) {
    console.error('❌ Error al procesar suite de moneda RED:', error);
  }
}

generateRedIcons();
