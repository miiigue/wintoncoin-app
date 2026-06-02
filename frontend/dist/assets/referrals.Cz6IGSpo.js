import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.Dk_Cx65J.js";import{showCustomAlert as i}from"./alerts.CawRDXDp.js";import{g as b}from"./config.Br4uoD7s.js";import"./auth.PfzP10z-.js";function c(){const d=b(),s=localStorage.getItem("username"),a={codeSection:document.getElementById("referral-code-section"),historySection:document.getElementById("referral-history-section"),referredUsersList:document.getElementById("referred-users-list")};if(!s){i("Debes iniciar sesión para ver esta página.",()=>{window.location.href="index.html"});return}l();async function l(){try{const e=await fetch(`${d}/api/users/${s}/referral-info`);if(!e.ok){const t=await e.json();throw new Error(t.message||"Error al cargar la información de referidos.")}const r=await e.json();p(r)}catch(e){console.error("Error al cargar datos de referidos:",e),a.codeSection.innerHTML='<p class="error-message">No se pudo cargar tu código de referido.</p>',a.historySection.innerHTML='<p class="error-message">No se pudo cargar tu historial de referidos.</p>'}}function p(e){u(e.referral_code),m(e.referred_users)}function u(e){if(!e){a.codeSection.innerHTML='<p class="error-message">No se pudo generar tu código de referido. Contacta a soporte.</p>';return}const r=`${window.location.origin}/register.html?ref=${e}`;a.codeSection.innerHTML=`
            <h4>Tu Código de Referido</h4>
            <div style="text-align: center; margin: 1.5rem 0;">
                <p class="referral-code-display" style="font-size: 2rem; font-weight: 800; color: #4F46E5; margin: 0; letter-spacing: 2px; line-height: 1.2;">
                    ${e}
                </p>
                <button id="copyCodeBtn" class="action-button" style="margin-top: 1rem;">
                    Copiar Código
                </button>
            </div>
            <p class="referral-description">Comparte este código o el enlace de abajo con tus amigos. Cuando se registren, ¡ambos recibirán una recompensa!</p>
            <div class="referral-link-container">
                <input type="text" id="referralLinkInput" value="${r}" readonly>
                <button id="copyLinkBtn" class="action-button">Copiar Enlace</button>
            </div>
        `,document.getElementById("copyCodeBtn").addEventListener("click",()=>{navigator.clipboard?navigator.clipboard.writeText(e).then(()=>{i("¡Código copiado al portapapeles!")}).catch(o=>{console.error("Error al copiar código:",o),t(e)}):t(e)}),document.getElementById("copyLinkBtn").addEventListener("click",()=>{const o=document.getElementById("referralLinkInput");o.select(),o.setSelectionRange(0,99999),navigator.clipboard?navigator.clipboard.writeText(o.value).then(()=>{i("¡Enlace de referido copiado al portapapeles!")}).catch(n=>{t(o.value)}):t(o.value)});function t(o){const n=document.createElement("textarea");n.value=o,n.style.top="0",n.style.left="0",n.style.position="fixed",document.body.appendChild(n),n.focus(),n.select();try{document.execCommand("copy"),i("¡Copiado al portapapeles!")}catch(y){console.error("Fallback: Oops, unable to copy",y)}document.body.removeChild(n)}}function m(e){if(!e||e.length===0){a.referredUsersList.innerHTML='<p class="empty-message">Aún no has referido a ningún usuario. ¡Comparte tu código!</p>';return}const r=`
            <table id="referrals-table">
                <thead>
                    <tr>
                        <th>Usuario Registrado</th>
                        <th>Fecha de Registro</th>
                        <th>BLUE iou acumulado</th>
                    </tr>
                </thead>
                <tbody>
                    ${e.map(t=>f(t)).join("")}
                </tbody>
            </table>
        `;a.referredUsersList.innerHTML=r}function f(e){const r=h(e.created_at),t=g(e.total_booster_blue);return`<tr><td>${window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${e.referred_username}" class="profile-link">${e.referred_username}</a>`:e.referred_username}</td><td>${r}</td><td>${t}</td></tr>`}function g(e){const r=Number(e);return Number.isFinite(r)?r.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}):"0,0000"}function h(e){const r=new Date(e);if(Number.isNaN(r.getTime()))return"--/--/--";const t=String(r.getDate()).padStart(2,"0"),o=String(r.getMonth()+1).padStart(2,"0"),n=String(r.getFullYear()).slice(-2);return`${t}/${o}/${n}`}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",c):c();
//# sourceMappingURL=referrals.Cz6IGSpo.js.map
