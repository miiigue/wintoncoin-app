'use strict';

const fs = require('fs');
const path = require('path');

const frontend = (...parts) => fs.readFileSync(
    path.join(__dirname, '../../frontend/src', ...parts),
    'utf8'
);

describe('mensajes y rendimiento del Prelanzamiento', () => {
    test('el feed explica el estado sin invitar a una publicación bloqueada', () => {
        const source = frontend('components', 'dashboard', 'PublicationsFeed.jsx');
        expect(source).toContain('En Prelanzamiento puedes explorar las publicaciones habilitadas por la plataforma.');
        expect(source).not.toContain('Sé el primero en publicar');
    });

    test('el modal no promete fechas ni garantiza seguridad', () => {
        const source = frontend('components', 'dashboard', 'PublicationTypeModal.jsx');
        expect(source).toContain('hasta que el lanzamiento sea aprobado');
        expect(source).not.toMatch(/muy pronto|espacio seguro/i);
    });

    test('la búsqueda aplica una espera de 250 ms y limpiar es inmediato', () => {
        const source = frontend('components', 'dashboard', 'PublicationsFeed.jsx');
        expect(source).toContain('setTimeout(() => setDebouncedSearchText(searchText), 250)');
        expect(source).toContain("setDebouncedSearchText('')");
    });

    test('el login muestra una confirmación neutral una sola vez en Dashboard', () => {
        const login = frontend('pages', 'Login.jsx');
        const dashboard = frontend('pages', 'Dashboard.jsx');
        expect(login).toContain("'Sesión iniciada correctamente.'");
        expect(dashboard).toContain("sessionStorage.removeItem('winton_login_notice')");
        expect(dashboard).toContain('aria-live="polite"');
        expect(login).not.toMatch(/espacio seguro/i);
    });
});
