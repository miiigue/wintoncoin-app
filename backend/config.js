const path = require('path');

// Determina el entorno. Si NODE_ENV no está definido, se asume 'development'.
const env = process.env.NODE_ENV || 'development';

// Construye la ruta al archivo .env específico para el entorno.
// Esto busca el archivo en la carpeta raíz del proyecto (un nivel arriba de /backend).
const envPath = path.resolve(__dirname, `../.env.${env}`);

// Carga las variables de entorno desde el archivo correspondiente.
const result = require('dotenv').config({ path: envPath });

if (result.error) {
    // Intentar cargar desde el archivo local de la carpeta backend (ej: backend/.env.demo.local)
    const fallbackPath = path.resolve(__dirname, `./.env.${env}.local`);
    const fallbackResult = require('dotenv').config({ path: fallbackPath });
    
    if (fallbackResult.error && env !== 'production') {
        console.warn(`Advertencia: No se pudo encontrar el archivo de entorno en ${envPath} ni en ${fallbackPath}. Asegúrate de que exista.`);
    }
}

// Opcional: exportar el entorno actual para usarlo en otras partes de la app si es necesario.
module.exports = {
    NODE_ENV: env
};

