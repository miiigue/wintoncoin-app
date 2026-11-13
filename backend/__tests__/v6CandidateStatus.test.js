'use strict';
const {inspect} = require('../src/services/v6CandidateStatus');

test('el candidato V6 está desactivado por defecto', async () => {
  await expect(inspect({})).resolves.toEqual({success:true, configured:false});
});
test('falla cerrado si no hay identidad Demo explícita', async () => {
  await expect(inspect({WINTON_V6_CANDIDATE_ENABLED:'true'})).rejects.toThrow('Entorno incorrecto');
});
test('rechaza un manifiesto que no coincide con la huella configurada antes de consultar la red', async () => {
  await expect(inspect({WINTON_V6_MANIFEST_SHA256:'0'.repeat(64), IS_DEMO_ENV:'true', WINTON_ENVIRONMENT_ID:'demo'})).rejects.toThrow('Huella incorrecta');
});
