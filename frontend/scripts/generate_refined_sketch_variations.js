import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLUE_SOURCE = path.resolve(__dirname, '../public/assets/icons/logo-high-res.png');
const OUTPUT_DIR = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df';

/**
 * Crea las 3 variantes refinadas profesionales aplicando la idea del boceto:
 * Base: Matriz física exacta de la moneda BLUE (disco de titanio, bisel concéntrico, borde exterior).
 * Símbolo: R con trazo cripto proporcional y armónico con B.
 */
async function generateRefinedVariations() {
  console.log('Generando variantes profesionales refinadas basadas en la idea...');

  // 1. Extraer las propiedades base de BLUE
  // La moneda BLUE tiene:
  // - Borde exterior circular con antialiasing
  // - Bisel circular azul oscuro en r=430px
  // - Disco plateado central cepillado
  // - Símbolo B en azul oscuro con bisel interior y sombra

  // Reemplazamos el tono azul del anillo y los reflejos para convertirlo en el aro rojo carmesí de RED
  const blueImg = sharp(BLUE_SOURCE);

  // Variante 1: R Cripto Simétrica (Inspirada en el boceto: barra horizontal superior + barra media + base serif)
  // Geometría con las proporciones exactas de la 'B' de Bitcoin de BLUE:
  // Altura total: 540px, Ancho: 360px, Grosor de trazo: 76px
  const svgVar1 = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Gradiente idéntico al material de la B de BLUE pero en rojo carmesí / rubí metálico profundo -->
      <linearGradient id="redTokenGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#991b1b" />
        <stop offset="35%" stop-color="#7f1d1d" />
        <stop offset="70%" stop-color="#450a0a" />
        <stop offset="100%" stop-color="#2d0505" />
      </linearGradient>

      <!-- Bisel interior idéntico al relieve de BLUE -->
      <linearGradient id="redBevel" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#dc2626" stop-opacity="0.9" />
        <stop offset="40%" stop-color="#ef4444" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#1c0404" stop-opacity="0.8" />
      </linearGradient>

      <!-- Sombra profunda idéntica a la B de BLUE -->
      <filter id="coinDepth" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.55" />
      </filter>

      <!-- Anillo concéntrico biselado rojo -->
      <linearGradient id="ringBevel" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7f1d1d" />
        <stop offset="50%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
    </defs>

    <!-- Aro circular idéntico al de BLUE pero en tono carmesí oscuro biselado -->
    <circle cx="512" cy="512" r="432" fill="none" stroke="url(#ringBevel)" stroke-width="26" />
    <circle cx="512" cy="512" r="445" fill="none" stroke="#2d0505" stroke-width="3" />
    <circle cx="512" cy="512" r="419" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.6" />

    <!-- Sombra del glifo R -->
    <path d="
      M 315,260 L 450,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.5)" filter="url(#coinDepth)" transform="translate(2, 6)" />

    <!-- Glifo principal R en relieve 3D -->
    <path d="
      M 315,260 L 450,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#redTokenGrad)" stroke="#450a0a" stroke-width="3" />

    <!-- Bisel interior grabado (Idéntico a la B de BLUE) -->
    <path d="
      M 320,265 L 445,265 Q 682,265 682,410 Q 682,515 525,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 320,325 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#redBevel)" stroke-width="4" opacity="0.8" />
  </svg>
  `;

  // Variante 2: Proporción Espejo Puro de B (Las dos crestas arriba tipo Bitcoin como en la 2A, más la barra horizontal media de tu boceto)
  const svgVar2 = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="redTokenGrad2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#991b1b" />
        <stop offset="35%" stop-color="#7f1d1d" />
        <stop offset="70%" stop-color="#450a0a" />
        <stop offset="100%" stop-color="#2d0505" />
      </linearGradient>
      <linearGradient id="redBevel2" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#dc2626" stop-opacity="0.9" />
        <stop offset="40%" stop-color="#ef4444" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#1c0404" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="ringBevel2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7f1d1d" />
        <stop offset="50%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <filter id="coinDepth2" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.55" />
      </filter>
    </defs>

    <!-- Aro circular idéntico al de BLUE en carmesí -->
    <circle cx="512" cy="512" r="432" fill="none" stroke="url(#ringBevel2)" stroke-width="26" />
    <circle cx="512" cy="512" r="445" fill="none" stroke="#2d0505" stroke-width="3" />
    <circle cx="512" cy="512" r="419" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.6" />

    <!-- Sombra del glifo R -->
    <path d="
      M 410,210 L 460,210 L 460,260 L 515,260 L 515,210 L 565,210 L 565,260 Q 695,260 695,410 Q 695,520 540,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 L 315,260 L 410,260 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.5)" filter="url(#coinDepth2)" transform="translate(2, 6)" />

    <!-- Glifo principal R con corona cripto superior y barra media -->
    <path d="
      M 410,210 L 460,210 L 460,260 L 515,260 L 515,210 L 565,210 L 565,260 Q 695,260 695,410 Q 695,520 540,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 L 315,260 L 410,260 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#redTokenGrad2)" stroke="#450a0a" stroke-width="3" />

    <!-- Bisel interior -->
    <path d="
      M 415,215 L 455,215 L 455,265 L 520,265 L 520,215 L 560,215 L 560,265 Q 687,265 687,410 Q 687,515 535,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 320,325 L 320,265 L 415,265 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#redBevel2)" stroke-width="4" opacity="0.8" />
  </svg>
  `;

  // Variante 3: Modern Currency (Estilo Divisa Internacional limpia, barra media nítida y base serif)
  const svgVar3 = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="redTokenGrad3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#991b1b" />
        <stop offset="35%" stop-color="#7f1d1d" />
        <stop offset="70%" stop-color="#450a0a" />
        <stop offset="100%" stop-color="#2d0505" />
      </linearGradient>
      <linearGradient id="redBevel3" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#dc2626" stop-opacity="0.9" />
        <stop offset="40%" stop-color="#ef4444" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#1c0404" stop-opacity="0.8" />
      </linearGradient>
      <linearGradient id="ringBevel3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7f1d1d" />
        <stop offset="50%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <filter id="coinDepth3" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity="0.55" />
      </filter>
    </defs>

    <!-- Aro circular idéntico al de BLUE en carmesí -->
    <circle cx="512" cy="512" r="432" fill="none" stroke="url(#ringBevel3)" stroke-width="26" />
    <circle cx="512" cy="512" r="445" fill="none" stroke="#2d0505" stroke-width="3" />
    <circle cx="512" cy="512" r="419" fill="none" stroke="#dc2626" stroke-width="2" opacity="0.6" />

    <!-- Sombra del glifo R -->
    <path d="
      M 345,260 L 515,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 345,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.5)" filter="url(#coinDepth3)" transform="translate(2, 6)" />

    <!-- Glifo principal R (Sin barra superior izquierda, pero con la raya media y bases de tu idea) -->
    <path d="
      M 345,260 L 515,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 345,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#redTokenGrad3)" stroke="#450a0a" stroke-width="3" />

    <!-- Bisel interior -->
    <path d="
      M 350,265 L 510,265 Q 682,265 682,410 Q 682,515 525,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 350,325 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#redBevel3)" stroke-width="4" opacity="0.8" />
  </svg>
  `;

  // Extraemos el disco de fondo plateado de la moneda BLUE
  const silverBasePlate = await sharp(BLUE_SOURCE)
    .resize(1024, 1024)
    .composite([
      // Mascara circular para garantizar que no quede ningún resto azul exterior
      { input: Buffer.from('<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff"/></svg>'), blend: 'dest-in' }
    ])
    .toBuffer();

  // Renderizamos cada variante
  const variants = [
    { name: 'opcion_red_refinada_1.png', svg: svgVar1 },
    { name: 'opcion_red_refinada_2.png', svg: svgVar2 },
    { name: 'opcion_red_refinada_3.png', svg: svgVar3 }
  ];

  for (const v of variants) {
    const glyphBuf = await sharp(Buffer.from(v.svg)).png().toBuffer();
    const destPath = path.join(OUTPUT_DIR, v.name);

    await sharp(silverBasePlate)
      .composite([{ input: glyphBuf, blend: 'over' }])
      .png({ quality: 100 })
      .toFile(destPath);

    console.log(`✅ Creada: ${destPath}`);
  }
}

generateRefinedVariations().catch(console.error);
