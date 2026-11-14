const {chromium} = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({serviceWorkers:'block'});
  const page = await context.newPage();
  page.on('pageerror', error => console.log('PAGE ERROR', error.message));
  await page.addInitScript(() => { localStorage.setItem('token','ficticio'); localStorage.setItem('username','qa_local'); });
  let writes = 0;
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' && url.port === '4177' && !url.pathname.startsWith('/api/')) return route.continue();
    if (!url.pathname.startsWith('/api/')) return route.abort();
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) && url.pathname !== '/api/auth/refresh') writes++;
    let data = {success:true};
    if (url.pathname.endsWith('/deployment')) data = {success:true,chainId:'11155420',contracts:{FifoExchange:'0x0000000000000000000000000000000000000001'}};
    else if (url.pathname.endsWith('/exchange-queue')) data = {success:true,protocolVersion:'V6',capabilities:{exchangeRead:true,exchangeWrite:false},sellOrders:[],buyOrders:[],totalBlueForSale:0,totalUsdtWaiting:0};
    else if (url.pathname.endsWith('/wallet-identity')) data = {web3_wallet_address:'0x0000000000000000000000000000000000000002'};
    else if (url.pathname.includes('/exchange/')) data = {success:true,data:{orders:[],pendingRefunds:{BLUE:'0',USDT:'0'}}};
    else if (url.pathname.includes('/user/')) data = {success:true,blueBalance:'10',blueAvailable:'10',blueLocked:'0',redCommitment:'0',usdtWalletBalance:'10',credit:{isKYCVerified:true}};
    return route.fulfill({status:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:4177','Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'authorization,content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
  });
  try {
    await page.goto('http://127.0.0.1:4177/exchange.html');
    await page.getByText('Las operaciones del Exchange V6 aún no están disponibles.',{exact:false}).waitFor({timeout:30000});
    await page.locator('input[placeholder="0.0000"]').first().fill('1');
    const button = page.locator('button').filter({hasText:/Comprar BLUE/i}).last();
    await button.click();
    await page.getByText('Las operaciones del Exchange V6 todavía no están disponibles en Demo.',{exact:false}).waitFor();
    assert.equal(writes, 0);
    console.log('UI local: compra ficticia V6 bloqueada; 0 solicitudes económicas de escritura; tráfico externo bloqueado.');
  } catch (error) { console.log('Página:', (await page.locator('body').innerText()).slice(0, 1500)); throw error; }
  finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
