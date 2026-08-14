import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{s as w,g as $,h as b}from"./auth.BgcrufBo.js";function c(){const d=$(),a=localStorage.getItem("token"),i=localStorage.getItem("username"),r={historyList:document.getElementById("p2pOrdersHistoryList")};if(!a||!i){w("Debes iniciar sesión para ver tu historial.",()=>{window.location.href="index.html"});return}l();async function l(){r.historyList.innerHTML='<div class="loading-spinner"></div>';try{const e=await fetch(`${d}/api/p2p/orders`,{headers:{Authorization:`Bearer ${a}`}});if(b(e))return;if(!e.ok)throw new Error("No se pudieron cargar órdenes.");const s=await e.json();p(s)}catch(e){console.error(e),r.historyList.innerHTML='<p class="empty-message">No se pudo cargar el historial.</p>'}}function p(e){const s=Array.isArray(e)?e:[],y=new Set(["released","cancelled","expired"]),o=s.filter(t=>y.has(t.status)).sort((t,n)=>new Date(n.created_at)-new Date(t.created_at));if(o.length===0){r.historyList.innerHTML='<p class="empty-message">Aún no tienes historial.</p>';return}r.historyList.innerHTML=o.map(t=>{const n=t.buyer_username===i,h=n?t.seller_username:t.buyer_username,g=u(t.status),f=`p2p-status ${t.status}`,L=m(t.created_at);return`
                <div class="p2p-order-card">
                    <div><strong>${n?"Comprando":"Vendiendo"}</strong> con ${h}</div>
                    <div class="p2p-order-meta">
                        <span>${t.fiat_amount} ${t.currency}</span>
                        <span>${Number(t.blue_amount).toFixed(4)} BLUE</span>
                        <span class="${f}">${g}</span>
                        <span class="p2p-order-date">${L}</span>
                    </div>
                </div>
            `}).join("")}function u(e){return{released:"liberada",cancelled:"cancelada",expired:"expirada"}[e]||e}function m(e){if(!e)return"";const s=new Date(e);return Number.isNaN(s.getTime())?"":s.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c();
//# sourceMappingURL=p2pHistory.CHNVKEyM.js.map
