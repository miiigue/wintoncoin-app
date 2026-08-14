import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{s,g as C}from"./auth.BgcrufBo.js";function d(){const p=C(),c=localStorage.getItem("username"),i={codeSection:document.getElementById("referral-code-section"),historySection:document.getElementById("referral-history-section"),referredUsersList:document.getElementById("referred-users-list")};if(!c){s("Debes iniciar sesión para ver esta página.",()=>{window.location.href="index.html"});return}function l(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}u();async function u(){try{const e=await fetch(`${p}/api/users/${c}/referral-info`);if(!e.ok){const a=await e.json();throw new Error(a.message||"Error al cargar la información de referidos.")}const t=await e.json();f(t)}catch(e){console.error("Error al cargar datos de referidos:",e),i.codeSection.innerHTML='<p class="error-message">No se pudo cargar tu código de referido.</p>',i.historySection.innerHTML='<p class="error-message">No se pudo cargar tu historial de referidos.</p>'}}function f(e){m(e.referral_code),g(e.referred_users)}function m(e){if(!e){i.codeSection.innerHTML='<p class="error-message">No se pudo generar tu código de referido. Contacta a soporte.</p>';return}const t=l(e),a=`${window.location.origin}/register.html?ref=${t}`;i.codeSection.innerHTML=`
            <h4>Tu Código de Referido</h4>
            <div style="text-align: center; margin: 1.5rem 0;">
                <p class="referral-code-display" style="font-size: 2rem; font-weight: 800; color: #4F46E5; margin: 0; letter-spacing: 2px; line-height: 1.2;">
                    ${t}
                </p>
                <button id="copyCodeBtn" class="action-button" style="margin-top: 1rem;">
                    Copiar Código
                </button>
            </div>
            <p class="referral-description">Comparte este código o el enlace de abajo con tus amigos. Cuando se registren, ¡ambos recibirán una recompensa!</p>
            <div class="referral-link-container">
                <input type="text" id="referralLinkInput" value="${a}" readonly>
                <button id="copyLinkBtn" class="action-button">Copiar Enlace</button>
            </div>
        `,document.getElementById("copyCodeBtn").addEventListener("click",()=>{navigator.clipboard?navigator.clipboard.writeText(e).then(()=>{s("¡Código copiado al portapapeles!")}).catch(r=>{console.error("Error al copiar código:",r),o(e)}):o(e)}),document.getElementById("copyLinkBtn").addEventListener("click",()=>{const r=document.getElementById("referralLinkInput");r.select(),r.setSelectionRange(0,99999),navigator.clipboard?navigator.clipboard.writeText(r.value).then(()=>{s("¡Enlace de referido copiado al portapapeles!")}).catch(n=>{o(r.value)}):o(r.value)});function o(r){const n=document.createElement("textarea");n.value=r,n.style.top="0",n.style.left="0",n.style.position="fixed",document.body.appendChild(n),n.focus(),n.select();try{document.execCommand("copy"),s("¡Copiado al portapapeles!")}catch(L){console.error("Fallback: Oops, unable to copy",L)}document.body.removeChild(n)}}function g(e){if(!e||e.length===0){i.referredUsersList.innerHTML='<p class="empty-message">Aún no has referido a ningún usuario. ¡Comparte tu código!</p>';return}const t=`
            <table id="referrals-table">
                <thead>
                    <tr>
                        <th style="width: 80px; text-align: center;">KYC</th>
                        <th>Usuario</th>
                        <th>Fecha de Registro</th>
                        <th>BLUE iou acumulado</th>
                    </tr>
                </thead>
                <tbody>
                    ${e.map(a=>h(a)).join("")}
                </tbody>
            </table>
        `;i.referredUsersList.innerHTML=t}function h(e){const t=b(e.created_at),a=y(e.total_booster_blue),o=l(e.referred_username),r=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${o}" class="profile-link">${o}</a>`:o;return`<tr><td style="text-align: center;">${e.kyc_verified?'<span style="color: #10B981; font-weight: bold; font-size: 1.1rem; display: block; text-align: center;" title="KYC Aprobado">✅</span>':'<span style="color: #F59E0B; font-weight: bold; font-size: 1.1rem; display: block; text-align: center;" title="KYC Pendiente">⏳</span>'}</td><td>${r}</td><td>${t}</td><td>${a}</td></tr>`}function y(e){const t=Number(e);return Number.isFinite(t)?t.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}):"0,0000"}function b(e){const t=new Date(e);if(Number.isNaN(t.getTime()))return"--/--/--";const a=String(t.getDate()).padStart(2,"0"),o=String(t.getMonth()+1).padStart(2,"0"),r=String(t.getFullYear()).slice(-2);return`${a}/${o}/${r}`}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",d):d();
//# sourceMappingURL=referrals.DC1VLWwc.js.map
