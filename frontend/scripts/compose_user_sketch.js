import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_IMAGE = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/opt_red_plata_fiel2_1792112346018.jpg';
const OUTPUT_FILE = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/moneda_boceto_usuario.png';

/**
 * Superpone el glifo exacto del boceto del usuario sobre el disco plateado
 */
async function generateFinalSketchCoin() {
  console.log('Generando moneda con el boceto exacto del usuario...');

  // 1. Mascara circular de 472px de radio
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  // 2. SVG del boceto centrado y ajustado al tamaño de la moneda
  // Basado en el trazo a mano alzada del usuario:
  // - Asta vertical centrada
  // - Barra superior (serif) extendida hacia la izquierda
  // - Bucle de la R
  // - Raya horizontal en el medio cruzando el asta
  // - Pata diagonal con base serif apoyada limpiamente en la línea base
  const glyphSvg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ruby3D" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f87171" />
          <stop offset="25%" stop-color="#dc2626" />
          <stop offset="70%" stop-color="#991b1b" />
          <stop offset="100%" stop-color="#450a0a" />
        </linearGradient>
        <linearGradient id="edgeHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#fecaca" stop-opacity="0.9" />
          <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.4" />
        </linearGradient>
        <filter id="shadowDepth" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="2" dy="8" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
        </filter>
        <filter id="outerGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Anillo concéntrico interior en rojo rubí sutil -->
      <circle cx="512" cy="512" r="435" fill="none" stroke="#ef4444" stroke-width="6" stroke-opacity="0.8" filter="url(#outerGlow)" />

      <!-- Sombra proyectada del glifo -->
      <g filter="url(#shadowDepth)">
        <!-- Barra superior extendida hacia la izquierda -->
        <rect x="330" y="275" width="220" height="42" rx="4" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Asta vertical -->
        <rect x="420" y="275" width="70" height="450" rx="4" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Pie serif base asta -->
        <rect x="375" y="700" width="160" height="35" rx="4" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Raya horizontal central del boceto -->
        <rect x="340" y="475" width="160" height="40" rx="4" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Bucle superior de la R -->
        <path d="M 450,275 C 670,275 670,515 450,515 Z" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Pata diagonal -->
        <polygon points="460,490 530,490 690,710 620,710" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
        <!-- Pie serif de la pata diagonal -->
        <rect x="610" y="700" width="105" height="35" rx="4" fill="rgba(0,0,0,0.5)" transform="translate(4, 6)" />
      </g>

      <!-- Glifo 3D en rojo rubí con biseles metálicos -->
      <g>
        <!-- Bucle superior R relleno -->
        <path d="M 450,275 C 670,275 670,515 450,515 Z" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />
        <!-- Hueco interior del bucle -->
        <path d="M 490,335 C 595,335 595,455 490,455 Z" fill="#b9bec7" opacity="0.1" />
        <path d="M 490,335 C 595,335 595,455 490,455 Z" fill="none" stroke="#450a0a" stroke-width="4" />

        <!-- Pata diagonal -->
        <polygon points="465,490 535,490 685,705 615,705" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

        <!-- Asta vertical principal -->
        <rect x="420" y="275" width="70" height="440" rx="4" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

        <!-- Barra superior extendida a la izquierda (techo/serif del boceto) -->
        <rect x="330" y="275" width="160" height="42" rx="4" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

        <!-- Raya horizontal central del boceto -->
        <rect x="345" y="475" width="150" height="40" rx="4" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

        <!-- Pies inferiores serif de apoyo limpio -->
        <rect x="375" y="695" width="160" height="30" rx="3" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />
        <rect x="605" y="695" width="115" height="30" rx="3" fill="url(#ruby3D)" stroke="#7f1d1d" stroke-width="4" />

        <!-- Resplandor y bisel superior reflectivo -->
        <line x1="335" y1="279" x2="485" y2="279" stroke="url(#edgeHighlight)" stroke-width="3" />
        <line x1="350" y1="479" x2="485" y2="479" stroke="url(#edgeHighlight)" stroke-width="3" />
        <line x1="380" y1="698" x2="530" y2="698" stroke="url(#edgeHighlight)" stroke-width="3" />
        <line x1="610" y1="698" x2="715" y2="698" stroke="url(#edgeHighlight)" stroke-width="3" />
      </g>
    </svg>
  `;

  // Componer sobre el disco plateado limpio
  // Primero limpiamos el centro del disco con un círculo plateado radial
  const cleanCenterSvg = `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="silverPlateGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#e2e8f0" />
          <stop offset="40%" stop-color="#cbd5e1" />
          <stop offset="75%" stop-color="#94a3b8" />
          <stop offset="100%" stop-color="#64748b" />
        </radialGradient>
      </defs>
      <circle cx="512" cy="512" r="390" fill="url(#silverPlateGrad)" />
    </svg>
  `;

  const glyphBuffer = Buffer.from(glyphSvg);
  const cleanCenterBuffer = Buffer.from(cleanCenterSvg);

  await sharp(BASE_IMAGE)
    .resize(1024, 1024)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: cleanCenterBuffer, blend: 'over' },
      { input: glyphBuffer, blend: 'over' }
    ])
    .png({ quality: 100 })
    .toFile(OUTPUT_FILE);

  console.log('✅ Moneda fiel al boceto del usuario creada en:', OUTPUT_FILE);
}

generateFinalSketchCoin().catch(console.error);
