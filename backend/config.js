const path = require('path');

// Determina el entorno. Si NODE_ENV no está definido, se asume 'development'.
const env = process.env.NODE_ENV || 'development';

// Construye la ruta al archivo .env específico para el entorno.
// Esto busca el archivo en la carpeta raíz del proyecto (un nivel arriba de /backend).
const envPath = path.resolve(__dirname, `../.env.${env}`);

// Carga las variables de entorno desde el archivo correspondiente.
const result = require('dotenv').config({ path: envPath });

if (result.error) {
    // Solo muestra un error si el archivo que no se encuentra no es el de producción.
    // Es común no tener un .env.production en el entorno de desarrollo local.
    if (env !== 'production') {
        console.warn(`Advertencia: No se pudo encontrar el archivo de entorno en ${envPath}. Asegúrate de que exista.`);
    }
}

// Opcional: exportar el entorno actual para usarlo en otras partes de la app si es necesario.
module.exports = {
    NODE_ENV: env
};

