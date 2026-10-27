import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_PATH = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/moneda_boceto_usuario_perfecta.png';

async function generatePerfectCoin() {
  console.log('Generando moneda con el trazo continuo del boceto...');

  const svgFinal = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Gradiente rubí metálico institucional -->
      <linearGradient id="ruby3D" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f87171" />
        <stop offset="30%" stop-color="#dc2626" />
        <stop offset="70%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>

      <!-- Bisel de luz superior reflectante -->
      <linearGradient id="edgeLight" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.85" />
        <stop offset="100%" stop-color="#ef4444" stop-opacity="0.2" />
      </linearGradient>

      <!-- Sombra suave proyectada -->
      <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="12" stdDeviation="12" flood-color="#000000" flood-opacity="0.6" />
      </filter>

      <!-- Resplandor neón exterior -->
      <filter id="neonRingGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="6" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    <!-- Anillo concéntrico carmesí neón enmarcando la moneda -->
    <circle cx="512" cy="512" r="440" fill="none" stroke="#dc2626" stroke-width="8" stroke-opacity="0.9" filter="url(#neonRingGlow)" />

    <!-- Sombra unificada de la letra R -->
    <path d="
      M 310,270 L 460,270 Q 690,270 690,410 Q 690,520 520,530 L 675,730 L 725,730 L 725,765 L 610,765 L 490,550 L 450,550 L 450,730 L 510,730 L 510,765 L 340,765 L 340,730 L 400,730 L 400,550 L 320,550 L 320,490 L 400,490 L 400,320 L 310,320 Z
      M 450,320 L 450,490 L 520,490 Q 625,490 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.55)" filter="url(#dropShadow)" transform="translate(4, 10)" />

    <!-- Trazo unificado 3D de la R del boceto del usuario -->
    <path d="
      M 310,270 L 460,270 Q 690,270 690,410 Q 690,520 520,530 L 675,730 L 725,730 L 725,765 L 610,765 L 490,550 L 450,550 L 450,730 L 510,730 L 510,765 L 340,765 L 340,730 L 400,730 L 400,550 L 320,550 L 320,490 L 400,490 L 400,320 L 310,320 Z
      M 450,320 L 450,490 L 520,490 Q 625,490 625,410 Q 625,320 450,320 Z
    " fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

    <!-- Bisel interior de luz reflectante 3D -->
    <path d="
      M 314,274 L 456,274 Q 682,274 682,410 Q 682,516 516,526 L 671,726 L 721,726 L 721,761 L 614,761 L 494,546 L 454,546 L 454,726 L 506,726 L 506,761 L 344,761 L 344,726 L 396,726 L 396,546 L 324,546 L 324,494 L 396,494 L 396,324 L 314,324 Z
    " fill="none" stroke="url(#edgeLight)" stroke-width="3" opacity="0.75" />
  </svg>
  `;

  // Mascara circular para recortar el disco con transparencia alfa
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  // Disco plateado cepillado central limpio
  const silverPlateSvg = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="silverPlate" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="40%" stop-color="#cbd5e1"/>
        <stop offset="75%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#64748b"/>
      </radialGradient>
    </defs>
    <circle cx="512" cy="512" r="395" fill="url(#silverPlate)"/>
  </svg>
  `;

  const glyphBuffer = await sharp(Buffer.from(svgFinal)).png().toBuffer();
  const silverPlateBuffer = await sharp(Buffer.from(silverPlateSvg)).png().toBuffer();

  const sourceCoin = 'C:/Users/migue/OneDrive/Escritorio/WINTONCOIN/smart-contract/frontend/public/assets/icons/red-logo-high-res.png';

  await sharp(sourceCoin)
    .resize(1024, 1024)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: silverPlateBuffer, blend: 'over' },
      { input: glyphBuffer, blend: 'over' }
    ])
    .png({ quality: 100 })
    .toFile(OUTPUT_PATH);

  console.log('✅ Moneda fiel y unificada creada en:', OUTPUT_PATH);
}

generatePerfectCoin().catch(console.error);
