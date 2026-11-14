'use strict';
const { Contract, Interface, getAddress } = require('ethers');

// Field order and integer widths are part of the signed EIP-712 schema.
const fields = [
  ['payer','address'], ['payee','address'], ['amount','uint256'],
  ['blueAmount','uint256'], ['redAmount','uint256'], ['feeBps','uint16'],
  ['duration','uint48'], ['nonce','uint256'], ['deadline','uint256'],
  ['agreementHash','bytes32'], ['payerStateHash','bytes32']
].map(([name,type]) => ({name,type}));
const tuple = fields.map(({name,type}) => type+' '+name).join(',');
const iface = new Interface([
  'function processAuthorizedPayment(('+tuple+') payment, bytes signature) returns (uint256)',
  'event PaymentProcessed(address indexed payer,address indexed payee,uint256 amount,uint256 fee,uint256 blueUsed,uint256 redCreated,uint256 lotId)',
  'event DebtAmortized(address indexed user,uint256 amountAmortized,bool maturedOnly)'
]);

function paymentRequest(contracts, message) {
  return {domain:{name:'WintonPayment',version:'6',chainId:'11155420',
    verifyingContract:getAddress(contracts.PaymentAuthorization)}, types:{Payment:fields},
    primaryType:'Payment',message};
}
async function quotePayment(provider, contracts, payer, amount) {
  const block = await provider.getBlock('latest');
  const overrides = {blockTag:block.number};
  const engine = new Contract(contracts.PaymentEngine,['function paymentStateHash(address) view returns(bytes32)'],provider);
  const auth = new Contract(contracts.PaymentAuthorization,['function nonces(address) view returns(uint256)'],provider);
  const cfg = new Contract(contracts.ProtocolConfig,['function activeConfig() view returns(uint128 maxPayment,uint48 duration,uint16 feeBps)'],provider);
  const blue = new Contract(contracts.BlueTokenV6,['function balanceOf(address) view returns(uint256)'],provider);
  const ledger = new Contract(contracts.CommitmentLedger,['function matured(address) view returns(uint256)'],provider);
  const [config,balance,due,nonce,payerStateHash] = await Promise.all([
    cfg.activeConfig(overrides),blue.balanceOf(payer,overrides),ledger.matured(payer,overrides),
    auth.nonces(payer,overrides),engine.paymentStateHash(payer,overrides)
  ]);
  if (amount <= 0n || amount > config.maxPayment || due > balance)
    throw Error('El importe o la deuda vencida impide este pago V6');
  const fee = amount * config.feeBps / 10000n;
  const total = amount + fee;
  const blueAmount = balance - due < total ? balance - due : total;
  return {fee,blueAmount,redAmount:total-blueAmount,duration:config.duration,feeBps:config.feeBps,nonce,payerStateHash,block};
}
function paymentCall(contracts, message, signature) {
  return {to:getAddress(contracts.PaymentEngine),value:'0',
    data:iface.encodeFunctionData('processAuthorizedPayment',[message,signature]),label:'Pago V6 autorizado por el usuario'};
}
function confirmedPayment(receipt, contracts, payment) {
  const logs = receipt.logs.filter(l => getAddress(l.address) === getAddress(contracts.PaymentEngine) &&
    l.topics[0] === iface.getEvent('PaymentProcessed').topicHash);
  if(receipt.status !== 1 || logs.length !== 1) throw Error('Falta la confirmación única del pago V6');
  const e = iface.parseLog(logs[0]).args;
  const fee = BigInt(payment.amount)*BigInt(payment.feeBps)/10000n;
  if(e.payer !== getAddress(payment.payer) || e.payee !== getAddress(payment.payee) ||
    e.amount !== BigInt(payment.amount) || e.fee !== fee || e.blueUsed !== BigInt(payment.blueAmount) ||
    e.redCreated !== BigInt(payment.redAmount) || e.blueUsed+e.redCreated !== e.amount+fee)
    throw Error('El pago V6 confirmado no coincide con la autorización');
  return {netAmount:e.amount,fee:e.fee};
}
module.exports = {iface,paymentRequest,paymentCall,confirmedPayment,quotePayment};
