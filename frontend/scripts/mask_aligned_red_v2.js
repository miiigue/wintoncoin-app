import sharp from 'sharp';

const source = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/opt2_a_alineada_con_barra_derecha_1792345913372.jpg';
const dest = 'C:/Users/migue/.gemini/antigravity-ide/brain/fd6d1306-796b-4dbb-a3c7-b91756384e4b/red_coin_2a_perfecta_con_barra_derecha.png';

async function process() {
  const maskSvg = '<svg width="1024" height="1024"><circle cx="512" cy="512" r="472" fill="#ffffff" /></svg>';
  const maskBuffer = await sharp(Buffer.from(maskSvg)).png().toBuffer();

  await sharp(source)
    .resize(1024, 1024)
    .composite([{ input: maskBuffer, blend: 'dest-in' }])
    .png({ quality: 100 })
    .toFile(dest);

  console.log('OK: Moneda 2-A con barra derecha y bordes alineados procesada con transparencia pura.');
}

process().catch(console.error);
