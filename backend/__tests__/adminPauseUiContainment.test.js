'use strict';

const fs = require('fs');
const path = require('path');

describe('panel de pausa V5 en modo preparación', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/AdminWeb3Panel.jsx'), 'utf8');

    test('no contiene una ruta de firma o envío para pausas', () => {
        expect(source).not.toContain("'/api/admin/web3/pause'");
        expect(source).not.toContain('handleTogglePause');
        expect(source).not.toContain("administerContract('pause_");
    });

    test('muestra los cuatro estados y exige paquete externo con segunda aprobación', () => {
        for (const label of ['CoreProtocol', 'Bóveda CollateralVault', 'Exchange FIFO', 'Tesorería ProtocolTreasury']) {
            expect(source).toContain(label);
        }
        expect(source).toContain('Este panel no firma ni transmite pausas');
        expect(source).toContain('segunda aprobación expresa');
        expect(source).toContain('hasVerifiedPauseSuite');
        expect(source).toContain('Estado no verificado');
        expect(source).toContain("'No verificado'");
        expect(source).not.toContain('Reanudar');
    });
});
