import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.Dk_Cx65J.js";import{g as C}from"./config.Br4uoD7s.js";import{h as B}from"./auth.PfzP10z-.js";import{showCustomAlert as d}from"./alerts.CawRDXDp.js";const h=C();document.addEventListener("DOMContentLoaded",async()=>{const e=new URLSearchParams(window.location.search).get("id");if(!e||isNaN(parseInt(e))){f("No se especificó una causa válida.",!0);return}await I(parseInt(e))});async function I(t){const e=document.getElementById("solidarioPageContainer"),n=document.getElementById("solidarioLoading");try{const a=localStorage.getItem("token"),o=a?{Authorization:`Bearer ${a}`}:{},s=await fetch(`${h}/api/humanitarian/causes/${t}`,{headers:o});if(B(s))return;if(!s.ok){const c=await s.json().catch(()=>({}));throw new Error(c.message||"Causa no encontrada.")}const i=await s.json();if(!i.success||!i.cause){f("Causa no encontrada o no disponible.");return}n.style.display="none";const r=i.cause,l=i.donations||{donations:[],summary:{}};e.innerHTML=$(r,l),D(r),L(r),A(l),S(r)}catch(a){console.error("[SOLIDARIO] Error al cargar causa:",a),a.message&&(a.message.includes("401")||a.message.includes("Acceso denegado")||a.message.includes("Token"))?f("Debes iniciar sesión para ver esta causa.",!0):f(a.message||"Error al cargar la causa.")}}function $(t,e){const n=parseFloat(t.current_amount)||0,a=parseFloat(t.goal_amount)||0,o=e.summary||{},s=o.total_on_hold||0,i=(o.count_released||0)+(o.count_on_hold||0),r=n+s,l=a>0?Math.min(n/a*100,100):0,c=a>0?Math.min(s/a*100,100-l):0,p=l+c,m=new Date(t.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"}),v=t.status==="completed"||a>0&&r>=a,y='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',w='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>',x=localStorage.getItem("username"),E=t.beneficiary_username===x&&(t.status==="pending"||t.status==="approved");let b="";return E&&(b=`
            <button id="solidarioDetailCancelBtn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: none;">
                🛑 Cancelar y Cerrar Causa Actual
            </button>
        `),`
        <!-- HEADER: Navegación + Badge -->
        <div class="solidario-header">
            <a href="contract_interaction.html" class="solidario-back-btn" id="solidarioBackBtn">
                ← Volver
            </a>
            <div class="solidario-badge-container">
                ${b}
            </div>
        </div>

        <!-- TARJETA PRINCIPAL -->
        <div class="solidario-cause-card">
            <h1 class="solidario-cause-title" id="solidarioCauseTitle">${g(t.title)}</h1>
            <div class="solidario-cause-meta">
                <span>👤 ${g(t.beneficiary_username||"Beneficiario")}</span>
                <span>📅 ${m}</span>
                <span style="display:flex; align-items:center; gap:4px; color:#e83e8c;">${y} ${i} ${i===1?"donación":"donaciones"}</span>
            </div>
            <div class="solidario-cause-story" id="solidarioCauseStory">${g(t.story)}</div>
        </div>

        <!-- BARRA DE PROGRESO (OPCIÓN A) -->
        <div class="solidario-progress-section" id="solidarioProgressSection">
            <div class="solidario-progress-amounts">
                <span class="solidario-progress-current">
                    ${u(r)} <span class="unit">BLUE IOU</span>
                </span>
                <span class="solidario-progress-goal">
                    Meta: ${u(a)} BLUE IOU
                </span>
            </div>
            
            <div class="solidario-progress-bar-wrapper">
                <div class="solidario-progress-bar-fill" style="width: ${l.toFixed(1)}%; background: #e83e8c; border-radius: ${c>0?"3px 0 0 3px":"3px"};"></div>
                ${c>0?`<div class="solidario-progress-bar-fill-hold" style="width: ${c.toFixed(1)}%; background: repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 10px, rgba(232, 62, 140, 0.6) 10px, rgba(232, 62, 140, 0.6) 20px); border-radius: 0 3px 3px 0;"></div>`:""}
            </div>
            
            <div class="solidario-progress-percentage-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span class="solidario-progress-percentage">${p.toFixed(1)}% total recaudado</span>
            </div>

            <div class="solidario-breakdown" style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-top: 8px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 4px;">
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#e83e8c; margin-right:6px;"></span>Disponible:</span>
                    <strong>${u(n)} BLUE IOU</strong>
                </div>
                ${s>0?`
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:rgba(232,62,140,0.5); margin-right:6px;"></span>En espera (KYC):</span>
                    <strong>${u(s)} BLUE IOU</strong>
                </div>`:""}
            </div>
        </div>

        <!-- BOTONES DE ACCIÓN -->
        <div class="solidario-actions" id="solidarioActions">
            <button class="solidario-btn-donate" id="solidarioDonateBtn"
                ${v?"disabled":""} style="display:flex; align-items:center; justify-content:center; gap:8px; background-color: #e83e8c; color: white;">
                ${v?"Meta Alcanzada":`${y} Donar BLUE IOU`}
            </button>
            <button class="solidario-btn-share" id="solidarioShareBtn" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                ${w} Compartir
            </button>
        </div>

        <!-- LISTA DE DONACIONES -->
        <div class="solidario-donations-section" id="solidarioDonationsSection">
            <div class="solidario-donations-title" style="display:flex; align-items:center; gap:8px;">
                <span style="color:#e83e8c;">${y}</span> Donaciones recibidas
            </div>
            <div id="solidarioDonationsList">
                <!-- Se llena dinámicamente -->
            </div>
        </div>
    `}function D(t){const e=document.getElementById("solidarioDonateBtn");!e||e.disabled||e.addEventListener("click",async()=>{try{const n=localStorage.getItem("token"),a=localStorage.getItem("username");if(!n||!a){d("Debes iniciar sesión para donar.");return}const o=await fetch(`${h}/api/users/${a}/booster-profile`,{headers:{Authorization:`Bearer ${n}`}});if(!o.ok){d("Error al obtener tu saldo de impulsor.");return}const s=await o.json(),i=parseFloat(s.total_booster_blue)||0;document.getElementById("donorBalanceDisplay").textContent=u(i);const r=await fetch(`${h}/api/auth/status`,{headers:{Authorization:`Bearer ${n}`}});let l=!1;r.ok&&(l=(await r.json()).is_verified===!0);const c=document.getElementById("donateKycWarning");c&&(c.style.display=l?"none":"flex"),document.getElementById("donateModalOverlay").classList.add("active"),k(t,i)}catch(n){console.error("[SOLIDARIO] Error al preparar donación:",n),d("Error al obtener tu saldo. Intenta nuevamente.")}})}function k(t,e){const n=document.getElementById("donateModalOverlay"),a=document.getElementById("donateCancelBtn"),o=document.getElementById("donateConfirmBtn"),s=document.getElementById("donateAmountInput");s.value="",o.disabled=!1,o.textContent="Confirmar Donación";const i=()=>{n.classList.remove("active")};a.onclick=i,n.onclick=r=>{r.target===n&&i()},o.onclick=async()=>{const r=s.value.replace(",","."),l=parseFloat(r);if(isNaN(l)||l<=0){d("Ingresa un monto válido.");return}if(l>e){d(`Saldo insuficiente. Tienes ${u(e)} BLUE IOU disponibles.`);return}o.disabled=!0,o.textContent="Procesando...";try{const c=localStorage.getItem("token"),p=await fetch(`${h}/api/humanitarian/causes/${t.id}/donate`,{method:"POST",headers:{"Content-Type":"application/json",...c?{Authorization:`Bearer ${c}`}:{}},body:JSON.stringify({amount:l})}),m=await p.json();if(!p.ok)throw new Error(m.message||"Error al procesar la donación.");i(),d(m.message||"¡Donación procesada exitosamente!"),setTimeout(()=>{window.location.reload()},2500)}catch(c){console.error("[SOLIDARIO] Error al donar:",c),d(c.message||"Error al procesar la donación."),o.disabled=!1,o.textContent="Confirmar Donación"}}}function L(t){const e=document.getElementById("solidarioShareBtn");e&&e.addEventListener("click",()=>{const n=window.location.href,a=`💙 Ayuda a ${t.beneficiary_username||"un usuario"} con su causa "${t.title}" en WintonCoin.

Dona tus BLUE IOU y marca la diferencia:
${n}`;if(navigator.share)navigator.share({title:`Winton Solidario: ${t.title}`,text:a,url:n}).catch(()=>{});else{const o=`https://wa.me/?text=${encodeURIComponent(a)}`;window.open(o,"_blank")}})}function S(t){const e=document.getElementById("solidarioDetailCancelBtn");e&&e.addEventListener("click",async n=>{if(n.preventDefault(),n.stopPropagation(),confirm("¿Estás seguro de que deseas cancelar y cerrar esta causa? Si lo haces, ya no podrás recibir más donaciones en esta y quedará marcada como culminada.")){e.disabled=!0,e.textContent="Cancelando...";try{const a=localStorage.getItem("token"),o=await fetch(`${h}/api/humanitarian/causes/${t.id}/cancel`,{method:"POST",headers:{Authorization:`Bearer ${a}`}}),s=await o.json();o.ok?(alert(s.message||"Causa cancelada exitosamente."),window.location.reload()):(alert(s.message||"Error al cancelar la causa."),e.disabled=!1,e.textContent="🛑 Cancelar y Cerrar Causa Actual")}catch(a){console.error("Error canceling cause:",a),alert("Error de red al intentar cancelar."),e.disabled=!1,e.textContent="🛑 Cancelar y Cerrar Causa Actual"}}})}function A(t){const e=document.getElementById("solidarioDonationsList");if(!e)return;const n=t.donations||[];if(n.length===0){e.innerHTML=`
            <div class="solidario-empty-donations">
                <p>Aún no hay donaciones. ¡Sé el primero en apoyar!</p>
            </div>
        `;return}e.innerHTML=n.map(a=>{const o=parseFloat(a.amount),s=new Date(a.created_at).toLocaleDateString("es-ES",{month:"short",day:"numeric"}),i=a.status==="released"?"released":"on_hold",r=a.status==="released"?"Acreditada":"En espera";return`
            <div class="solidario-donation-item">
                <div>
                    <div class="solidario-donation-user">@${g(a.donor_username)}</div>
                    <span style="font-size:0.75em; color:#64748B;">${s}</span>
                </div>
                <div style="text-align:right;">
                    <div class="solidario-donation-amount">${u(o)} BLUE IOU</div>
                    <span class="solidario-donation-status ${i}">${r}</span>
                </div>
            </div>
        `}).join("")}function g(t){if(!t)return"";const e=document.createElement("div");return e.appendChild(document.createTextNode(t)),e.innerHTML}function u(t){return(parseFloat(t)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})}function f(t,e=!1){const n=document.getElementById("solidarioPageContainer");n.innerHTML=`
        <div class="solidario-error">
            <h2>⚠️</h2>
            <p>${g(t)}</p>
            ${e?'<p><a href="login.html">Iniciar sesión</a></p>':""}
            <p><a href="contract_interaction.html">Volver al inicio</a></p>
        </div>
    `}
//# sourceMappingURL=causaSolidaria.BPfjM1F8.js.map
