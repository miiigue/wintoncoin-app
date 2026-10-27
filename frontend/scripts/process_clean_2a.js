import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Fuente base: opt2_a_con_barra_1792111445042.jpg que tiene el render 3D exacto del titanio cepillado
const BASE_IMG = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/opt2_a_con_barra_1792111445042.jpg';
const OUTPUT_FILE = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/opcion_2a_corregida_profesional.png';

async function processClean2A() {
  console.log('Procesando Opción 2-A corregida profesionalmente con máscara circular transparente...');

  // Mascara circular de 472px de radio sobre 1024x1024 para transparencia de fondo pura
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff"/></svg>';
  const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  await sharp(BASE_IMG)
    .resize(1024, 1024)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png({ quality: 100 })
    .toFile(OUTPUT_FILE);

  console.log('✅ Creada con éxito:', OUTPUT_FILE);
}

processClean2A().catch(console.error);
