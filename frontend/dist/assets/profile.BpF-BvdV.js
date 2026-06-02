import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.Dk_Cx65J.js";import{g as w}from"./config.Br4uoD7s.js";import{showCustomAlert as y}from"./alerts.CawRDXDp.js";import"./auth.PfzP10z-.js";function l(){const d=w(),s=new URLSearchParams(window.location.search),o=s.get("username")||s.get("user"),a={profileHeader:document.getElementById("profile-header"),ratingsList:document.getElementById("ratings-list")};if(!o){c("No se ha especificado un perfil de usuario.",!0);return}p();async function p(){try{const e=await fetch(`${d}/users/${o}/profile`);if(!e.ok){const n=await e.json();throw new Error(n.message||`Error ${e.status}`)}const t=await e.json();g(t)}catch(e){console.error("Error al cargar el perfil:",e),c(e.message,!0)}}function g(e){f(e.user),m(e.ratings)}function f(e){const t=h(e.average_rating,e.ratings_count);let n="";if(e.web3_wallet_address){const r=e.web3_wallet_address;n=`
                <div class="profile-wallet-container" style="display: flex; align-items: center; justify-content: center; margin-top: 10px; background: rgba(255,255,255,0.05); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; margin-left: auto; margin-right: auto;">
                    <span style="color: #888; font-size: 14px; margin-right: 8px;">Billetera Web3:</span>
                    <span id="walletAddressText" style="font-family: monospace; font-size: 14px; color: #fff; margin-right: 10px;">${r.substring(0,6)+"..."+r.substring(r.length-4)}</span>
                    <button id="copyWalletBtn" data-address="${r}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center; justify-content: center;" title="Copiar dirección">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `}a.profileHeader.innerHTML=`
            <h1 class="profile-username">${e.username}</h1>
            <div class="profile-rating">${t}</div>
            ${n}
        `,e.web3_wallet_address&&document.getElementById("copyWalletBtn").addEventListener("click",function(){const r=this.dataset.address;navigator.clipboard.writeText(r).then(()=>{const i=this.innerHTML;this.innerHTML='<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>',setTimeout(()=>{this.innerHTML=i},2e3)}).catch(i=>{console.error("Error al copiar: ",i)})})}function m(e){if(e.length===0){a.ratingsList.innerHTML='<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';return}a.ratingsList.innerHTML=e.map(t=>u(t)).join("")}function u(e){const t="★".repeat(e.rating)+"☆".repeat(5-e.rating),n=new Date(e.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"});return`
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${e.rater_username}</strong></span>
                    <span class="rating-item-stars">${t}</span>
                </div>
                ${e.comment?`<p class="rating-item-comment">"${e.comment}"</p>`:""}
                <div class="rating-item-footer"><span>${n}</span></div>
            </div>
        `}function c(e,t=!1){a.profileHeader.innerHTML="",a.ratingsList.innerHTML="",y(e,()=>{t&&(window.location.href="contract_interaction.html")})}function h(e,t){if(t===0)return'<span class="no-rating">Sin calificaciones</span>';const n=parseFloat(e).toFixed(1),r="★".repeat(Math.round(e))+"☆".repeat(5-Math.round(e));return`
            <span class="stars" title="${n} de 5 estrellas">${r}</span> 
            <span class="rating-summary"><strong>${n}</strong> de 5 (${t} calificaciones)</span>
        `}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",l):l();
//# sourceMappingURL=profile.BpF-BvdV.js.map
