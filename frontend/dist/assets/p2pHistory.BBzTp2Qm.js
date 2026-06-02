import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.Dk_Cx65J.js";import{showCustomAlert as w}from"./alerts.CawRDXDp.js";import{g as $}from"./config.Br4uoD7s.js";import{h as b}from"./auth.PfzP10z-.js";function c(){const d=$(),a=localStorage.getItem("token"),i=localStorage.getItem("username"),s={historyList:document.getElementById("p2pOrdersHistoryList")};if(!a||!i){w("Debes iniciar sesión para ver tu historial.",()=>{window.location.href="index.html"});return}p();async function p(){s.historyList.innerHTML='<div class="loading-spinner"></div>';try{const e=await fetch(`${d}/api/p2p/orders`,{headers:{Authorization:`Bearer ${a}`}});if(b(e))return;if(!e.ok)throw new Error("No se pudieron cargar órdenes.");const r=await e.json();l(r)}catch(e){console.error(e),s.historyList.innerHTML='<p class="empty-message">No se pudo cargar el historial.</p>'}}function l(e){const r=Array.isArray(e)?e:[],y=new Set(["released","cancelled","expired"]),o=r.filter(t=>y.has(t.status)).sort((t,n)=>new Date(n.created_at)-new Date(t.created_at));if(o.length===0){s.historyList.innerHTML='<p class="empty-message">Aún no tienes historial.</p>';return}s.historyList.innerHTML=o.map(t=>{const n=t.buyer_username===i,h=n?t.seller_username:t.buyer_username,g=u(t.status),f=`p2p-status ${t.status}`,L=m(t.created_at);return`
                <div class="p2p-order-card">
                    <div><strong>${n?"Comprando":"Vendiendo"}</strong> con ${h}</div>
                    <div class="p2p-order-meta">
                        <span>${t.fiat_amount} ${t.currency}</span>
                        <span>${Number(t.blue_amount).toFixed(4)} BLUE</span>
                        <span class="${f}">${g}</span>
                        <span class="p2p-order-date">${L}</span>
                    </div>
                </div>
            `}).join("")}function u(e){return{released:"liberada",cancelled:"cancelada",expired:"expirada"}[e]||e}function m(e){if(!e)return"";const r=new Date(e);return Number.isNaN(r.getTime())?"":r.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c();
//# sourceMappingURL=p2pHistory.BBzTp2Qm.js.map
