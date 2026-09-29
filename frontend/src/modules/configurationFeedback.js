// Display selected diagnostics, never raw responses, HTML or RPC credentials.
export function safeDiagnostic(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/https?:\/\/[^\s"<>]+/gi, '[dirección del servicio omitida]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [oculto]')
    .replace(/\b(?:0x)?[a-f0-9]{64}\b/gi, '[identificador protegido]')
    .replace(/((?:private[_ -]?key|api[_ -]?key|secret|password|token)\s*[=:]\s*)[^\s,;]+/gi, '$1[oculto]').slice(0,1800);
}
export function configurationFeedback({key,label,value,status,data,invalidInput=false,networkError=false}) {
  const result={key,label,value,at:new Date().toISOString(),httpStatus:status||null};
  const body=data&&typeof data==='object'?data:{};
  const cause=safeDiagnostic(body.message||body.error||body.on_chain_sync?.error);
  if(typeof body.operationId==='string'&&/^[a-f0-9-]{36}$/i.test(body.operationId))result.operationId=body.operationId;
  const tx=body.txHash||body.on_chain_sync?.txHash;
  if(typeof tx==='string'&&/^0x[a-f0-9]{64}$/i.test(tx))result.txHash=tx;
  if(typeof body.code==='string'&&/^[A-Z0-9_]{1,64}$/.test(body.code))result.code=body.code;
  if(invalidInput)return {...result,kind:'error',title:'Revisa el valor ingresado',message:'El importe no tiene un formato válido. La solicitud no se envió.',action:'Usa un número no negativo. Los importes de gas admiten hasta 18 decimales.'};
  if(networkError)return {...result,kind:'warning',title:'No pudimos confirmar el resultado',message:'La conexión se interrumpió o el servidor tardó demasiado. El cambio podría haberse recibido.',action:'Consulta el valor vigente y el seguimiento de cambios antes de volver a guardar.'};
  if(status===202||body.pendingReconciliation)return {...result,kind:'warning',title:body.pendingReconciliation?'Confirmado en blockchain; registro pendiente':'Cambio pendiente de confirmación',message:cause||'El servidor registró la solicitud, pero todavía no confirmó su aplicación.',action:'Consulta “Seguimiento de cambios”. No repitas el envío mientras se confirma esta operación.'};
  if(status>=200&&status<300&&body.success===true)return {...result,kind:'success',title:'Cambio guardado correctamente',message:key.startsWith('red_credit_')?'La política se guardó. Se aplicará progresivamente a las cuentas, respetando sus excepciones.':key.startsWith('gas_sponsor_')?'La configuración de patrocinio quedó guardada.':'El contrato confirmó el cambio.',action:key.startsWith('red_credit_')?'Puedes consultar el progreso y las cuentas pendientes en “Seguimiento de cambios”.':'Puedes continuar configurando otros parámetros.'};
  let action='Revisa “Preparación del servicio” y el valor vigente antes de repetir el cambio.';
  if(status===401)action='Inicia nuevamente sesión como administrador y vuelve a comprobar el valor vigente.';
  else if(body.governance_required)action='Este cambio necesita aprobación de gobernanza. Solicítala por el procedimiento administrativo.';
  else if(status===403)action='Comprueba que tu cuenta tenga permiso para modificar este parámetro.';
  else if(status===429)action='Espera unos momentos antes de volver a consultar el servicio.';
  else if(/firmante/i.test(cause))action='Debe configurarse el firmante administrativo autorizado en el servidor. No pegues claves privadas en este panel ni en el chat.';
  else if(status===400)action='Corrige el valor según la indicación del servidor y vuelve a guardar.';
  return {...result,kind:'error',title:'No se confirmó el cambio',message:cause||'El servidor no devolvió una confirmación válida. No se puede asegurar que el cambio se haya aplicado.',action};
}
