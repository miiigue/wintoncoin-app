import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const CLEAN_PLATE = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df/opt2_r_pura_1792111151481.jpg';
const OUTPUT_DIR = 'C:/Users/migue/.gemini/antigravity-ide/brain/e030020f-c64e-45ca-b8da-23b754c6e4df';

async function generateCleanRefinedCoins() {
  console.log('Generando monedas refinadas sobre disco limpio de titanio/plata...');

  // Máscara circular para transparencia
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff"/></svg>';
  const mask = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  // Parche plateado central para borrar cualquier letra previa del disco y dejar la plata pura
  const silverPlateSvg = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="silverPlate" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#f8fafc"/>
        <stop offset="35%" stop-color="#e2e8f0"/>
        <stop offset="70%" stop-color="#cbd5e1"/>
        <stop offset="90%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#64748b"/>
      </radialGradient>
    </defs>
    <circle cx="512" cy="512" r="395" fill="url(#silverPlate)"/>
  </svg>
  `;
  const silverPatch = await sharp(Buffer.from(silverPlateSvg)).png().toBuffer();

  // Base limpia
  const baseCleanPlate = await sharp(CLEAN_PLATE)
    .resize(1024, 1024)
    .composite([
      { input: mask, blend: 'dest-in' },
      { input: silverPatch, blend: 'over' }
    ])
    .toBuffer();

  // 1. VARIANTE A: "R Cripto Clásica"
  // Tiene la barra superior izquierda, la raya horizontal en el medio, y base limpia con terminación plana
  const svgVarA = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradRubyA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="25%" stop-color="#dc2626" />
        <stop offset="65%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <linearGradient id="bevelLightA" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fecaca" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.3" />
      </linearGradient>
      <filter id="shadowA" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
      </filter>
    </defs>

    <!-- Aro fino carmesí -->
    <circle cx="512" cy="512" r="435" fill="none" stroke="#dc2626" stroke-width="14" stroke-opacity="0.85" />
    <circle cx="512" cy="512" r="443" fill="none" stroke="#450a0a" stroke-width="3" />

    <!-- Sombra -->
    <path d="
      M 315,260 L 460,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.55)" filter="url(#shadowA)" transform="translate(3, 8)" />

    <!-- Glifo 3D -->
    <path d="
      M 315,260 L 460,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#gradRubyA)" stroke="#7f1d1d" stroke-width="4" />

    <!-- Bisel de brillo -->
    <path d="
      M 318,264 L 456,264 Q 682,264 682,410 Q 682,516 525,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 318,325 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#bevelLightA)" stroke-width="3" opacity="0.8" />
  </svg>
  `;

  // 2. VARIANTE B: "R Cripto con Corona Superior (Estilo 2A + Raya Media)"
  // Conserva las 2 crestas superiores tipo Bitcoin, pero tiene la raya media de tu boceto y base plana sin patas abajo
  const svgVarB = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradRubyB" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="25%" stop-color="#dc2626" />
        <stop offset="65%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <linearGradient id="bevelLightB" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fecaca" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.3" />
      </linearGradient>
      <filter id="shadowB" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
      </filter>
    </defs>

    <circle cx="512" cy="512" r="435" fill="none" stroke="#dc2626" stroke-width="14" stroke-opacity="0.85" />
    <circle cx="512" cy="512" r="443" fill="none" stroke="#450a0a" stroke-width="3" />

    <!-- Sombra -->
    <path d="
      M 410,210 L 460,210 L 460,260 L 515,260 L 515,210 L 565,210 L 565,260 Q 695,260 695,410 Q 695,520 540,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 L 315,260 L 410,260 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.55)" filter="url(#shadowB)" transform="translate(3, 8)" />

    <!-- Glifo 3D -->
    <path d="
      M 410,210 L 460,210 L 460,260 L 515,260 L 515,210 L 565,210 L 565,260 Q 695,260 695,410 Q 695,520 540,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 315,320 L 315,260 L 410,260 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#gradRubyB)" stroke="#7f1d1d" stroke-width="4" />

    <!-- Bisel de brillo -->
    <path d="
      M 415,215 L 455,215 L 455,265 L 520,265 L 520,215 L 560,215 L 560,265 Q 687,265 687,410 Q 687,515 535,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 320,325 L 320,265 L 415,265 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#bevelLightB)" stroke-width="3" opacity="0.8" />
  </svg>
  `;

  // 3. VARIANTE C: "R Divisa FinTech Pura"
  // Sin crestas arriba, con la raya horizontal cruzando el medio como símbolo de divisa institucional y terminación plana
  const svgVarC = `
  <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="gradRubyC" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="25%" stop-color="#dc2626" />
        <stop offset="65%" stop-color="#991b1b" />
        <stop offset="100%" stop-color="#450a0a" />
      </linearGradient>
      <linearGradient id="bevelLightC" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fecaca" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#7f1d1d" stop-opacity="0.3" />
      </linearGradient>
      <filter id="shadowC" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="3" dy="10" stdDeviation="10" flood-color="#000000" flood-opacity="0.6" />
      </filter>
    </defs>

    <circle cx="512" cy="512" r="435" fill="none" stroke="#dc2626" stroke-width="14" stroke-opacity="0.85" />
    <circle cx="512" cy="512" r="443" fill="none" stroke="#450a0a" stroke-width="3" />

    <!-- Sombra -->
    <path d="
      M 345,260 L 515,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 345,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="rgba(0,0,0,0.55)" filter="url(#shadowC)" transform="translate(3, 8)" />

    <!-- Glifo 3D -->
    <path d="
      M 345,260 L 515,260 Q 690,260 690,410 Q 690,520 530,535 L 685,735 L 735,735 L 735,765 L 610,765 L 485,555 L 450,555 L 450,735 L 515,735 L 515,765 L 345,765 L 345,735 L 395,735 L 395,555 L 315,555 L 315,495 L 395,495 L 395,320 L 345,320 Z
      M 450,320 L 450,495 L 525,495 Q 625,495 625,410 Q 625,320 450,320 Z
    " fill="url(#gradRubyC)" stroke="#7f1d1d" stroke-width="4" />

    <!-- Bisel de brillo -->
    <path d="
      M 350,265 L 510,265 Q 682,265 682,410 Q 682,515 525,530 L 680,730 L 730,730 L 730,760 L 615,760 L 490,550 L 445,550 L 445,730 L 510,730 L 510,760 L 350,760 L 350,730 L 400,730 L 400,550 L 320,550 L 320,500 L 400,500 L 400,325 L 350,325 Z
      M 445,325 L 445,500 L 520,500 Q 617,500 617,410 Q 617,325 445,325 Z
    " fill="none" stroke="url(#bevelLightC)" stroke-width="3" opacity="0.8" />
  </svg>
  `;

  const files = [
    { name: 'moneda_red_corregida_A.png', svg: svgVarA },
    { name: 'moneda_red_corregida_B.png', svg: svgVarB },
    { name: 'moneda_red_corregida_C.png', svg: svgVarC }
  ];

  for (const item of files) {
    const glyphBuf = await sharp(Buffer.from(item.svg)).png().toBuffer();
    const destPath = path.join(OUTPUT_DIR, item.name);

    await sharp(baseCleanPlate)
      .composite([{ input: glyphBuf, blend: 'over' }])
      .png({ quality: 100 })
      .toFile(destPath);

    console.log(`✅ Creada: ${destPath}`);
  }
}

generateCleanRefinedCoins().catch(console.error);
