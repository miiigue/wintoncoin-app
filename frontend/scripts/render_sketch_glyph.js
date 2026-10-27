import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BLUE_LOGO_PATH = path.resolve(__dirname, '../public/assets/icons/logo-high-res.png');
const OUTPUT_SKETCH_DIR = path.resolve(__dirname, '../../puente-agentes/temp_renders');

if (!fs.existsSync(OUTPUT_SKETCH_DIR)) {
  fs.mkdirSync(OUTPUT_SKETCH_DIR, { recursive: true });
}

/**
 * Genera el trazado exacto de la R del usuario:
 * - Asta vertical principal con pie serif inferior plano.
 * - Barra horizontal superior (techo/serif de la R) que se extiende hacia la izquierda.
 * - Bucle redondeado superior.
 * - Barra horizontal en el medio cruzando el asta.
 * - Pata diagonal con terminación serif plana apoyada en la línea base.
 */
function createGlyphSvg(variant = 1) {
  // Dimensiones en lienzo 1024x1024 centrado en 512, 512
  // La R se ubica aproximadamente en x: 280 a 744, y: 220 a 800
  
  // Color rubí metálico profundo idéntico al contraste con la moneda BLUE
  const rubyGradient = `
    <defs>
      <linearGradient id="rubyMetallic" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#ef4444" />
        <stop offset="35%" stop-color="#b91c1c" />
        <stop offset="70%" stop-color="#881337" />
        <stop offset="100%" stop-color="#4c0519" />
      </linearGradient>
      <linearGradient id="innerGlow" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#fca5a5" stop-opacity="0.8" />
        <stop offset="50%" stop-color="#ef4444" stop-opacity="0.3" />
        <stop offset="100%" stop-color="#4c0519" stop-opacity="0.9" />
      </linearGradient>
      <filter id="bevel3D" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
        <feOffset in="blur" dx="-6" dy="-6" result="offsetLight" />
        <feOffset in="blur" dx="8" dy="10" result="offsetDark" />
        <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1.2" specularExponent="16" result="specular">
          <fePointLight x="300" y="200" z="400" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" result="specularLight" />
        <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000000" flood-opacity="0.65" />
      </filter>
      <filter id="redRimGlow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="8" result="glow" />
        <feComposite in="SourceGraphic" in2="glow" operator="over" />
      </filter>
    </defs>
  `;

  // Path SVG de la R dibujada por el usuario con proporciones 3D profesionales
  // Trazo principal:
  // - Asta vertical: x=380 a 460 (grosor 80px)
  // - Pie serif inferior: x=340 a 500, y=740 a 780
  // - Barra horizontal superior (techo hacia la izquierda): x=300 a 460, y=260 a 310
  // - Bucle de la R: desde y=260 bajando hasta y=510, extendiéndose hasta x=680
  // - Barra horizontal del medio (que atraviesa el centro como en el boceto): x=320 a 560, y=490 a 535
  // - Pata diagonal: desde (460, 500) hasta x=680, y=740 con serif plano (x=640 a 720, y=740 a 780)
  
  const pathR = `
    <!-- Sombra proyectada sobre el disco de plata -->
    <path d="
      M 320,290 L 460,290 Q 690,290 690,410 Q 690,520 530,530 L 680,740 L 730,740 L 730,780 L 630,780 L 510,550 L 460,550 L 460,740 L 510,740 L 510,780 L 330,780 L 330,740 L 380,740 L 380,550 L 310,550 L 310,490 L 380,490 L 380,350 L 320,350 Z
      M 460,350 L 460,490 L 530,490 Q 610,490 610,410 Q 610,350 460,350 Z
    " fill="rgba(0,0,0,0.5)" transform="translate(6, 12)" filter="url(#bevel3D)" />

    <!-- Glifo central en relieve metálico 3D carmesí rubí -->
    <path d="
      M 320,290 L 460,290 Q 690,290 690,410 Q 690,520 530,530 L 680,740 L 730,740 L 730,780 L 630,780 L 510,550 L 460,550 L 460,740 L 510,740 L 510,780 L 330,780 L 330,740 L 380,740 L 380,550 L 310,550 L 310,490 L 380,490 L 380,350 L 320,350 Z
      M 460,350 L 460,490 L 530,490 Q 610,490 610,410 Q 610,350 460,350 Z
    " fill="url(#rubyMetallic)" stroke="#991b1b" stroke-width="6" />

    <!-- Bisel interior iluminado de borde -->
    <path d="
      M 324,294 L 456,294 Q 682,294 682,410 Q 682,516 528,526 L 676,736 L 724,736 L 724,774 L 634,774 L 514,546 L 456,546 L 456,736 L 504,736 L 504,774 L 336,774 L 336,736 L 384,736 L 384,546 L 314,546 L 314,494 L 384,494 L 384,346 L 324,346 Z
    " fill="none" stroke="url(#innerGlow)" stroke-width="4" opacity="0.8" />
  `;

  return `
    <svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
      ${rubyGradient}
      <!-- Anillo interior fino carmesí -->
      <circle cx="512" cy="512" r="436" fill="none" stroke="#dc2626" stroke-width="12" stroke-opacity="0.85" filter="url(#redRimGlow)" />
      <circle cx="512" cy="512" r="436" fill="none" stroke="#7f1d1d" stroke-width="4" />
      ${pathR}
    </svg>
  `;
}

async function renderDraft() {
  // Extraer el disco de fondo plateado de la moneda BLUE limpiando la B azul
  // En la moneda BLUE, la B está en el centro.
  console.log('Generando vector del glifo del boceto del usuario...');
  const svg = createGlyphSvg();
  const svgBuffer = Buffer.from(svg);

  const outputPath = path.resolve(OUTPUT_SKETCH_DIR, 'boceto_usuario_vector.png');
  await sharp(svgBuffer).png().toFile(outputPath);
  console.log('✅ Boceto vectorizado generado en:', outputPath);
}

renderDraft().catch(console.error);
