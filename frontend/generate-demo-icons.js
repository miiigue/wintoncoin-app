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
            // Procesamiento de Alta Performance (Sharp)
            // .greyscale(): Quitamos el azul original para no tener conflicto de balance térmico
            // .tint(): Rociamos el tono institucional 'Demo' en RBG
            await sharp(inputPath)
                .greyscale()      
                .tint({ r: 139, g: 92, b: 246 }) // #8B5CF6
                .toFile(outputPath);
            console.log(`✅ Renderizado completo: ${path.basename(outputPath)}`);
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
