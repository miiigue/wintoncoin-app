'use strict';
const {inspect} = require('../src/services/v6CandidateStatus');

test('el candidato V6 está desactivado por defecto', async () => {
  await expect(inspect({})).resolves.toEqual({success:true, configured:false});
});
test('falla cerrado si no hay identidad Demo explícita', async () => {
  await expect(inspect({WINTON_V6_CANDIDATE_ENABLED:'true'})).rejects.toThrow('Entorno incorrecto');
});
test('falla cerrado si no hay huella de manifiesto', async () => {
  await expect(inspect({WINTON_V6_CANDIDATE_ENABLED:'true', IS_DEMO_ENV:'true', WINTON_ENVIRONMENT_ID:'demo'})).rejects.toThrow('Huella ausente');
});
