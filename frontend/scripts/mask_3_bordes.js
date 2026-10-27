import sharp from 'sharp';

const source = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_3_bordes_perfectos_1792346489519.jpg';
const dest = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_3_bordes_alineados_transparente.png';

async function process() {
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
  const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  await sharp(source)
    .resize(1024, 1024)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png({ quality: 100 })
    .toFile(dest);

  console.log('OK: Moneda con los 3 bordes alineados y barra derecha procesada con transparencia pura.');
}

process().catch(console.error);
