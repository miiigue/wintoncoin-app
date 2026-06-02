import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css                           */import{g as E}from"./config.Br4uoD7s.js";import{c as _}from"./auth.PfzP10z-.js";const r=E();let m=null,c=null;document.addEventListener("DOMContentLoaded",async()=>{if(console.log("[MOMENTUM DASHBOARD] Inicializando..."),m=localStorage.getItem("token"),!m){d("Debes iniciar sesión para acceder.","error"),setTimeout(()=>{window.location.href="index.html"},1500);return}const e=await _();if(!e||!e.isAuthenticated){window.location.href="index.html";return}const t=document.getElementById("mmd-username");t&&e.username&&(t.textContent=`@${e.username}`),await y(),D();const a=document.getElementById("mmd-main");a&&a.addEventListener("click",n=>{const i=n.target.closest(".mmd-submit-trigger"),s=n.target.closest(".mmd-campaign-card");if(i||s){const o=i||s;n.preventDefault(),n.stopPropagation();const l=o.dataset.campaignId||o.dataset.id,u=o.dataset.campaignTitle||o.dataset.title,b=o.dataset.campaignDesc;S(l,u,b)}})});async function y(){const e=document.getElementById("mmd-main"),t=document.getElementById("mmd-loading");try{const a=await fetch(`${r}/api/momentum/profile`,{headers:{Authorization:`Bearer ${m}`}});if(a.status===404){d("Primero debes postularte como creador.","info"),setTimeout(()=>{window.location.href="momentum-landing.html"},2e3);return}if(!a.ok)throw new Error("Error al cargar perfil");c=await a.json();const n=document.getElementById("mmd-tier-badge");if(n){const i={PENDIENTE:"⏳",BRONCE:"🥉",PLATA:"🥈",ORO:"🥇"};n.textContent=`${i[c.tier]||""} ${c.tier}`,n.className=`mmd-header__tier --${c.tier.toLowerCase()}`}if(c.tier==="PENDIENTE"){t&&(t.style.display="none"),e.innerHTML=`
                <div class="mmd-pending-state">
                    <div class="mmd-pending-state__icon">⏳</div>
                    <h2 class="mmd-pending-state__title">Perfil en Revisión</h2>
                    <p class="mmd-pending-state__desc">
                        Tu postulación está siendo evaluada por un administrador.
                        Pronto recibirás una notificación con tu nivel asignado y podrás acceder a las misiones.
                    </p>
                </div>
            `;return}t&&(t.style.display="none"),await f()}catch(a){console.error("[MOMENTUM DASHBOARD] Error:",a),t&&(t.style.display="none"),e&&(e.innerHTML=`
                <div class="mmd-empty">❌ Error al cargar tu perfil. Intenta recargar la página.</div>
            `)}}async function f(){const e=document.getElementById("mmd-main"),[t,a,n]=await Promise.all([h(),$(),B()]);e.innerHTML=`
        <!-- Saldos -->
        <section class="mmd-balance-row">
            ${I(t)}
        </section>

        <!-- Marketplace de Misiones -->
        <section class="mmd-campaigns">
            <h3 class="mmd-section-title">🎯 Misiones Disponibles</h3>
            <div class="mmd-campaigns-grid" id="mmd-campaigns-grid">
                ${L(a)}
            </div>
        </section>

        <!-- Historial de Entregas -->
        <section class="mmd-submissions">
            <h3 class="mmd-section-title">📋 Mis Entregas</h3>
            <div id="mmd-submissions-list">
                ${w(n)}
            </div>
        </section>
    `}async function h(){try{const e=await fetch(`${r}/api/momentum/balance`,{headers:{Authorization:`Bearer ${m}`}});return e.ok?await e.json():null}catch{return null}}async function $(){try{const e=await fetch(`${r}/api/momentum/campaigns`,{headers:{Authorization:`Bearer ${m}`}});return e.ok?await e.json():{campaigns:[]}}catch{return{campaigns:[]}}}async function B(){try{const e=await fetch(`${r}/api/momentum/submissions`,{headers:{Authorization:`Bearer ${m}`}});return e.ok?await e.json():[]}catch{return[]}}function I(e){if(!e)return`
            <div class="mmd-balance-card --confirmed">
                <div class="mmd-balance-card__label">Saldo Confirmado</div>
                <div class="mmd-balance-card__value">—</div>
                <div class="mmd-balance-card__unit">BLUE IOU</div>
            </div>
        `;const t=parseFloat(e.confirmed_balance).toLocaleString("es-ES",{maximumFractionDigits:4}),a=parseFloat(e.pending_verification).toLocaleString("es-ES",{maximumFractionDigits:4}),n=parseFloat(e.total_earned_momentum).toLocaleString("es-ES",{maximumFractionDigits:4});return`
        <div class="mmd-balance-card --confirmed">
            <div class="mmd-balance-card__label">Saldo Total Confirmado</div>
            <div class="mmd-balance-card__value">${t}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (acreditado)</div>
        </div>
        <div class="mmd-balance-card --pending">
            <div class="mmd-balance-card__label">Pendiente de Verificación</div>
            <div class="mmd-balance-card__value">${a}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (estimado)</div>
        </div>
        <div class="mmd-balance-card --info">
            <div class="mmd-balance-card__label">Ganado en Momentum</div>
            <div class="mmd-balance-card__value">${n}</div>
            <div class="mmd-balance-card__unit">BLUE IOU (total histórico)</div>
        </div>
    `}function L(e){const t=e?.campaigns||[];return t.length===0?'<div class="mmd-empty">🎯 No hay misiones disponibles en este momento. ¡Pronto habrá nuevas!</div>':t.map(a=>{const n=parseFloat(a.my_final_pay).toLocaleString("es-ES",{maximumFractionDigits:2}),i=parseFloat(a.my_base_pay).toLocaleString("es-ES",{maximumFractionDigits:2}),s=a.allow_multiple;return`
            <div class="mmd-campaign-card" 
                 data-campaign-id="${a.id}" 
                 data-campaign-title="${p(a.title)}" 
                 data-campaign-desc="${p(a.description)}">
                <div class="mmd-campaign-card__header">
                    <h4 class="mmd-campaign-card__title">
                        ${g(a.title)}
                        ${s?'<span class="mmd-status-badge" style="font-size: 0.6rem; vertical-align: middle; margin-left: 6px; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);">Repetible</span>':""}
                    </h4>
                    <span class="mmd-campaign-card__pay">${n} BLUE IOU</span>
                </div>
                <p class="mmd-campaign-card__desc">${g(a.description)}</p>
                <div class="mmd-campaign-card__footer">
                    <span class="mmd-campaign-card__meta">Base: ${i} × ${a.applied_multiplier}</span>
                    <button class="mmd-btn mmd-btn--gold mmd-btn--small mmd-submit-trigger" 
                            data-id="${a.id}" 
                            data-title="${p(a.title)}"
                            data-campaign-desc="${p(a.description)}">
                        📤 Entregar
                    </button>
                </div>
            </div>
        `}).join("")}function w(e){return!e||e.length===0?'<div class="mmd-empty">📋 Aún no has enviado entregas. ¡Selecciona una misión para comenzar!</div>':e.map(t=>{const a=`--${t.status.toLowerCase()}`,n={PENDIENTE:"Pendiente",APROBADO:"Aprobado",RECHAZADO:"Rechazado"},i=new Date(t.submitted_at).toLocaleDateString("es-ES"),s=t.paid_amount?`+${parseFloat(t.paid_amount).toLocaleString("es-ES",{maximumFractionDigits:2})} BLUE IOU`:"";return`
            <div class="mmd-submission-item">
                <div class="mmd-submission-item__left">
                    <div class="mmd-submission-item__title">${g(t.campaign_title)}</div>
                    <div class="mmd-submission-item__date">${i}</div>
                    ${t.admin_note?`<div class="mmd-submission-item__date" style="color: var(--mm-text-secondary);">📝 ${g(t.admin_note)}</div>`:""}
                </div>
                <div class="mmd-submission-item__right">
                    ${s?`<span style="color: var(--mm-green); font-weight: 700;">${s}</span>`:""}
                    <span class="mmd-status-badge ${a}">${n[t.status]||t.status}</span>
                </div>
            </div>
        `}).join("")}function D(){const e=document.getElementById("mmd-modal-overlay"),t=document.getElementById("mmd-modal-cancel"),a=document.getElementById("mmd-submit-form");t&&t.addEventListener("click",()=>v()),e&&e.addEventListener("click",n=>{n.target===e&&v()}),a&&a.addEventListener("submit",async n=>{n.preventDefault(),await T()})}function S(e,t,a){const n=document.getElementById("mmd-modal-overlay"),i=document.getElementById("mmd-modal-title"),s=document.getElementById("mmd-modal-subtitle"),o=document.getElementById("mmd-modal-mission-desc"),l=document.getElementById("mmd-modal-campaign-id"),u=document.getElementById("mmd-proof-link");i&&(i.textContent=`📋 Detalle: ${t}`),s&&(s.textContent="Revisa las instrucciones y pega el link de tu contenido."),o&&(o.textContent=a||"Sin descripción disponible."),l&&(l.value=e),u&&(u.value=""),n&&n.classList.add("--visible")}function v(){const e=document.getElementById("mmd-modal-overlay");e&&e.classList.remove("--visible")}async function T(){const e=document.getElementById("mmd-modal-campaign-id")?.value,t=document.getElementById("mmd-proof-link")?.value?.trim(),a=document.getElementById("mmd-modal-submit");if(!e||!t){d("Completa todos los campos.","error");return}a.disabled=!0,a.textContent="⏳ Enviando...";try{const n=await fetch(`${r}/api/momentum/submissions`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${m}`},body:JSON.stringify({campaign_id:parseInt(e),proof_link:t})}),i=await n.json();n.ok?(d(i.message||"¡Entrega enviada!","success"),v(),await f()):d(i.message||"Error al enviar entrega.","error")}catch(n){console.error("[MOMENTUM] Error en envío:",n),d("Error de conexión. Intenta nuevamente.","error")}finally{a.disabled=!1,a.textContent="📤 Enviar Entrega"}}function d(e,t="info"){const a=document.getElementById("mmd-toast");a&&(a.textContent=e,a.className=`mmd-toast --${t} --visible`,setTimeout(()=>{a.classList.remove("--visible")},4e3))}function g(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}function p(e){return e?e.replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""}
//# sourceMappingURL=momentumDashboard.D7aUGb0A.js.map
