import sharp from 'sharp';

async function scanX() {
  const { data, info } = await sharp('C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_2a_perfecta_con_barra_derecha.png')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  // Analizar 3 franjas de altura Y:
  // 1. Serif superior (Y aprox 280 a 360)
  // 2. Barra media (Y aprox 470 a 530)
  // 3. Pie/base (Y aprox 680 a 740)

  function getMinX(minY, maxY) {
    let minX = width;
    let foundY = -1;
    for (let y = minY; y <= maxY; y++) {
      for (let x = 200; x < 500; x++) {
        const idx = (y * width + x) * channels;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        // Es rojo del glifo si r > 80 y r > g * 1.5 y r > b * 1.5 y a > 100
        if (a > 100 && r > 90 && r > g * 1.4 && r > b * 1.4) {
          if (x < minX) {
            minX = x;
            foundY = y;
          }
        }
      }
    }
    return { minX, foundY };
  }

  const top = getMinX(280, 360);
  const mid = getMinX(470, 540);
  const foot = getMinX(680, 750);

  console.log('Top serif minX:', top);
  console.log('Mid bar minX:', mid);
  console.log('Foot base minX:', foot);
}

scanX().catch(console.error);
