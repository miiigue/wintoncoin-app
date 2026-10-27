'use strict';
const {splitCollateralizedBuy,normalized}=require('../src/services/walletOperations');

describe('enrutamiento USDT cuando existe RED',()=>{
    test('sin RED toda la compra es ordinaria',()=>{
        expect(splitCollateralizedBuy(100n,0n,0n)).toEqual({secured:0n,ordinary:100n,budget:0n});
    });
    test('bloquea primero la cobertura completa y separa el excedente',()=>{
        expect(splitCollateralizedBuy(150n,100n,0n)).toEqual({secured:100n,ordinary:50n,budget:100n});
    });
    test('descuenta reservas existentes y considera comisión FIFO',()=>{
        expect(splitCollateralizedBuy(60n,99n,100n,40n,10n)).toEqual({secured:50n,ordinary:10n,budget:100n});
    });
});

describe('autorizaciones de garantía de órdenes existentes',()=>{
    test('normaliza importe y orden para autorización voluntaria',()=>{
        expect(normalized({action:'secureOrder',orderId:'7',amount:'12.5'}))
            .toEqual({action:'secureOrder',orderId:'7',amount:'12.5'});
    });
    test('la autorización automática solo acepta true explícito',()=>{
        expect(normalized({action:'autoCollateral',enabled:true})).toEqual({action:'autoCollateral',enabled:true});
        expect(normalized({action:'autoCollateral',enabled:'true'})).toEqual({action:'autoCollateral',enabled:false});
    });
});
