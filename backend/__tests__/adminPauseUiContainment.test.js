'use strict';

const fs = require('fs');
const path = require('path');

describe('panel de pausa V5 desde la billetera propietaria', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../../frontend/src/pages/AdminWeb3Panel.jsx'), 'utf8');
    const routes = fs.readFileSync(path.resolve(__dirname, '../src/routes/adminRoutes.js'), 'utf8');

    test('no usa la ruta heredada ni una clave del servidor', () => {
        expect(source).not.toContain("'/api/admin/web3/pause'");
        expect(source).not.toContain('handleTogglePause');
        expect(source).not.toContain('PRIVATE_KEY');
    });

    test('muestra los cuatro estados y exige confirmación fuerte antes de firmar', () => {
        for (const label of ['CoreProtocol', 'Bóveda CollateralVault', 'Exchange FIFO', 'Tesorería ProtocolTreasury']) {
            expect(source).toContain(label);
        }
        expect(source).toContain('hasVerifiedPauseSuite');
        expect(source).toContain('Estado no verificado');
        expect(source).toContain("'No verificado'");
        expect(source).toContain('PAUSAR SUITE ECONOMICA');
        expect(source).toContain('administerContract(`pause_${target}`');
        expect(source).toContain('billetera propietaria debe confirmarla de forma independiente');
        expect(source).not.toContain('Reanudar');
        const positions = ["['protocol'", "['exchange'", "['treasury'", "['vault'"]
            .map((target) => source.indexOf(target));
        expect(positions.every((position) => position >= 0)).toBe(true);
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    test('registra preparación y confirmación sin almacenar claves privadas', () => {
        expect(routes).toContain("eventType:'web3.owner_operation.prepared'");
        expect(routes).toContain("'web3.owner_operation.confirmed'");
        expect(routes).toContain("'web3.owner_operation.pending'");
        expect(routes).not.toContain('privateKey');
        expect(routes).not.toContain('mnemonic');
    });
});
