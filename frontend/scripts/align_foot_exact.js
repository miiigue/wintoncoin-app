import sharp from 'sharp';

// Archivo base: red_coin_2a_perfecta_con_barra_derecha.png
// Medidas detectadas:
// Top serif X = 290
// Mid bar X = 289
// Foot base X = 313 -> ¡Faltan exactamente 23px a la izquierda para alcanzar X = 290!

const INPUT = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_2a_perfecta_con_barra_derecha.png';
const OUTPUT = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_2a_pie_alineado_perfecto.png';

async function alignFoot() {
  const image = sharp(INPUT);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  // Modificar directamente el búfer crudo con interpolación y biselado
  // Zona del pie: Y de 676 a 740, X de 290 a 316
  // Copiamos la textura, color rojo metálico 3D y bisel del pie desde X [313..336] desplazándola exactamente 23px a la izquierda hacia X [290..313].
  // Para que el bisel y sombra queden impecables:
  // Tomamos una franja de la punta del pie actual (ancho 28px) y la extendemos hacia la izquierda para que termine en X = 290.

  const targetLeftX = 290;
  const currentFootLeftX = 313;
  const shift = currentFootLeftX - targetLeftX; // 23 píxeles

  // Vamos a clonar el buffer
  const outData = Buffer.from(data);

  // 1. En la zona del pie (Y entre 675 y 740):
  // El fuste vertical se ensancha en la base. Queremos que el borde izquierdo del pie se extienda hasta X = targetLeftX.
  for (let y = 675; y <= 740; y++) {
    // Buscar el borde izquierdo actual del pie en esta línea Y
    let currentX = -1;
    for (let x = 250; x < 400; x++) {
      const idx = (y * width + x) * channels;
      const r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
      if (a > 100 && r > 90 && r > g * 1.3 && r > b * 1.3) {
        currentX = x;
        break;
      }
    }

    if (currentX !== -1) {
      // Calcular nuevo X proporcionalmente extendido hacia targetLeftX
      // La base plana del pie está en Y de 690 a 738
      // Desplazamos el borde izquierdo hacia targetLeftX (290)
      const newStartX = Math.max(targetLeftX, currentX - shift);
      
      // Rellenamos desde newStartX hasta currentX copiando la muestra del pie
      for (let nx = newStartX; nx < currentX; nx++) {
        const destIdx = (y * width + nx) * channels;
        // Mapear al perfil interior del pie para mantener la textura 3D cepillada y luz biselada
        const srcX = currentX + (nx - newStartX) % 15;
        const srcIdx = (y * width + srcX) * channels;

        outData[destIdx] = data[srcIdx];
        outData[destIdx + 1] = data[srcIdx + 1];
        outData[destIdx + 2] = data[srcIdx + 2];
        outData[destIdx + 3] = data[srcIdx + 3];
      }

      // Aplicar bisel de borde oscuro/iluminado en el nuevo extremo izquierdo
      for (let nx = newStartX; nx <= newStartX + 3; nx++) {
        const borderIdx = (y * width + nx) * channels;
        // Borde biselado
        if (nx === newStartX) {
          outData[borderIdx] = Math.round(outData[borderIdx] * 0.7);
          outData[borderIdx + 1] = Math.round(outData[borderIdx + 1] * 0.6);
          outData[borderIdx + 2] = Math.round(outData[borderIdx + 2] * 0.6);
        } else if (nx === newStartX + 1 || nx === newStartX + 2) {
          // Luz reflectante en el bisel
          outData[borderIdx] = Math.min(255, Math.round(outData[borderIdx] * 1.25));
          outData[borderIdx + 1] = Math.min(255, Math.round(outData[borderIdx + 1] * 1.1));
          outData[borderIdx + 2] = Math.min(255, Math.round(outData[borderIdx + 2] * 1.1));
        }
      }

      // Proyectar sombra sutil a la izquierda en el disco de titanio
      for (let sx = newStartX - 8; sx < newStartX; sx++) {
        if (sx > 250) {
          const shadowIdx = (y * width + sx) * channels;
          const factor = 0.85 + ((sx - (newStartX - 8)) / 8) * 0.1;
          outData[shadowIdx] = Math.round(outData[shadowIdx] * factor);
          outData[shadowIdx + 1] = Math.round(outData[shadowIdx + 1] * factor);
          outData[shadowIdx + 2] = Math.round(outData[shadowIdx + 2] * factor);
        }
      }
    }
  }

  await sharp(outData, { raw: { width, height, channels } })
    .png({ quality: 100 })
    .toFile(OUTPUT);

  console.log('✅ Archivo generado con éxito:', OUTPUT);
}

alignFoot().catch(console.error);
