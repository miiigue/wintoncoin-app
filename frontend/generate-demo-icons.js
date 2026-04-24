import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Apuntamos a la carpeta estricta de iconos
const iconsDir = path.resolve(__dirname, 'public/assets/icons');

if (!fs.existsSync(iconsDir)) {
    console.error('❌ Error: El directorio de iconos no existe en:', iconsDir);
    process.exit(1);
}

console.log('==================================================');
console.log('🔮 Inyectando ADN DEMO a los iconos institucionales...');
console.log('==================================================');

const files = fs.readdirSync(iconsDir);
let count = 0;

async function generateDemoBadges() {
    for (const file of files) {
        // Ignoramos archivos que no sean iconos de PWA originales
        if (!file.startsWith('icon-') || !file.endsWith('.png')) continue;
        
        const inputPath = path.join(iconsDir, file);
        // Generamos un espejo con el prefijo "demo-"
        const outputPath = path.join(iconsDir, file.replace('icon-', 'demo-icon-'));
        
        try {
            // Obtenemos las dimensiones del icono original
            const metadata = await sharp(inputPath).metadata();
            
            // Creamos una placa roja del mismo tamaño
            const redOverlay = await sharp({
                create: {
                    width: metadata.width,
                    height: metadata.height,
                    channels: 4,
                    background: { r: 206, g: 70, b: 169, alpha: 1 } // Rosa Magenta (#CE46A9)
                }
            }).png().toBuffer();

            // Multiplicamos las capas: el blanco se vuelve del color, el negro sigue oscuro
            await sharp(inputPath)
                .composite([{ input: redOverlay, blend: 'multiply' }])
                .toFile(outputPath);
                
            console.log(`✅ Renderizado completo (Magenta): ${path.basename(outputPath)}`);
            count++;
        } catch (error) {
            console.error(`❌ Fallo crítico en capa superior para el archivo ${file}:`, error.message);
        }
    }
    console.log('==================================================');
    console.log(`🎉 ¡Operación Completa! Se han clonado y mutado ${count} iconos al entorno Demo.`);
    console.log('Ya estás protegido contra confusiones de testing en la app del celular.');
}

generateDemoBadges();
