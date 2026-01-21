#!/usr/bin/env node
/**
 * Script para generar iconos PNG desde el SVG base
 * 
 * Requisitos: npm install sharp
 * Uso: node generate-pngs.js
 */

const fs = require('fs');
const path = require('path');

// Intentar usar sharp si está disponible
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('⚠️  El paquete "sharp" no está instalado.');
    console.log('   Ejecuta: npm install sharp');
    console.log('');
    console.log('   Alternativa: Abre generate-icons.html en tu navegador');
    console.log('   para generar los iconos manualmente.');
    process.exit(1);
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const maskableSizes = [192, 512];

// Usar PNG si existe, sino SVG
const pngPath = path.join(__dirname, 'icon.png');
const svgPath = path.join(__dirname, 'icon.svg');
const sourcePath = fs.existsSync(pngPath) ? pngPath : svgPath;
const outputDir = __dirname;

async function generateIcons() {
    console.log('🎨 Generando iconos PWA para WintonCoin...\n');

    // Leer imagen fuente (PNG o SVG)
    console.log('Usando:', sourcePath);
    const sourceBuffer = fs.readFileSync(sourcePath);

    // Generar iconos normales
    for (const size of sizes) {
        const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);
        await sharp(sourceBuffer)
            .resize(size, size)
            .png()
            .toFile(outputPath);
        console.log(`✅ Generado: icon-${size}x${size}.png`);
    }

    // Generar iconos maskable (con padding de 10%)
    for (const size of maskableSizes) {
        const outputPath = path.join(outputDir, `icon-maskable-${size}x${size}.png`);
        const innerSize = Math.round(size * 0.8); // 80% del tamaño (10% padding cada lado)
        const padding = Math.round(size * 0.1);

        await sharp(sourceBuffer)
            .resize(innerSize, innerSize)
            .extend({
                top: padding,
                bottom: padding,
                left: padding,
                right: padding,
                background: { r: 26, g: 26, b: 46, alpha: 1 } // #1a1a2e
            })
            .png()
            .toFile(outputPath);
        console.log(`✅ Generado: icon-maskable-${size}x${size}.png`);
    }

    console.log('\n🎉 ¡Todos los iconos generados exitosamente!');
}

generateIcons().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
