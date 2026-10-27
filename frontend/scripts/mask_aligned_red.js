import sharp from 'sharp';

const source = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_alineada_perf_1792345535160.jpg';
const dest = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_opcion_2a_alineada_perfecta.png';

async function process() {
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
  const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  await sharp(source)
    .resize(1024, 1024)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png({ quality: 100 })
    .toFile(dest);

  console.log('OK: Creada moneda con transparencia y bordes alineados.');
}

process().catch(console.error);
