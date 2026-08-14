import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{g as N,h as H,s as m,c as z}from"./auth.BgcrufBo.js";const E=N();function R(e,o){if(!o||o<=0||e<=0)return"0.0";const t=e/o*100;if(t>=.1)return t.toFixed(1);const n=t.toFixed(10).match(/^0\.0*[1-9]/);return n?n[0]:t.toFixed(6).replace(/\.?0+$/,"")}document.addEventListener("DOMContentLoaded",async()=>{const e=document.getElementById("balanceHintClickable");e&&e.addEventListener("click",()=>{window.location.href="booster-profile.html"});const t=new URLSearchParams(window.location.search).get("id");if(!t||isNaN(parseInt(t))){O("No se especificó una causa válida.",!0);return}await F(parseInt(t))});async function F(e){const o=document.getElementById("solidarioPageContainer"),t=document.getElementById("solidarioLoading");try{const a=localStorage.getItem("token"),n=a?{Authorization:`Bearer ${a}`}:{},i=await fetch(`${E}/api/humanitarian/causes/${e}`,{headers:n});if(H(i))return;if(!i.ok){const p=await i.json().catch(()=>({}));throw new Error(p.message||"Causa no encontrada.")}const s=await i.json();if(!s.success||!s.cause){O("Causa no encontrada o no disponible.");return}t.style.display="none";const r=s.cause,g=localStorage.getItem("username"),y=r.creator_username===g;if(!a){const p="causa-solidaria.html"+window.location.search,v=r.beneficiary_referral_code?`&ref=${encodeURIComponent(r.beneficiary_referral_code)}`:"";window.location.href=`register.html?returnTo=${encodeURIComponent(p)}${v}`;return}const f=s.donations||{donations:[],summary:{}};window.currentCause=r,o.innerHTML=q(r,f),V(r),G(r),Y(f),J(r),K(r),y&&ee(r)}catch(a){console.error("[SOLIDARIO] Error al cargar causa:",a),t&&(t.style.display="none"),a.message&&(a.message.includes("401")||a.message.includes("Acceso denegado")||a.message.includes("Token"))?O("Debes iniciar sesión para ver esta causa.",!0):O(a.message||"Error al cargar la causa.")}}function q(e,o){const t=parseFloat(e.current_amount)||0,a=parseFloat(e.goal_amount)||0,n=o.summary||{},i=n.total_on_hold||0,s=(n.count_released||0)+(n.count_on_hold||0),r=t+i,g=a>0?Math.min(t/a*100,100):0,y=a>0?Math.min(i/a*100,100-g):0,f=new Date(e.created_at),p=f.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"})+" a las "+f.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit",hour12:!1})+" hs",v=e.status==="completed"||a>0&&r>=a,L='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',B='<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 14 20 9 15 4"></polyline><path d="M4 20v-7a4 4 0 0 1 4-4h12"></path></svg>',M=localStorage.getItem("username"),I=e.creator_username===M,T=I&&(e.status==="pending"||e.status==="approved");let _="";T&&(_=`
            <button id="solidarioDetailCancelBtn" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.3s; box-shadow: none;">
                🛑 Cancelar y Cerrar Causa Actual
            </button>
        `);let S=`profile.html?user=${encodeURIComponent(e.creator_username)}`,D="",A=!1;if(e.evidence_urls&&Array.isArray(e.evidence_urls)&&e.evidence_urls.length>1){const b=e.evidence_urls[1];b&&b.trim()!==""&&(S=b.trim(),D=' target="_blank" rel="noopener noreferrer"',A=!0)}let l=`profile.html?user=${encodeURIComponent(e.beneficiary_username)}`,h="",u=!1;if(e.beneficiary_socials&&e.beneficiary_socials.trim()!==""){const b=e.beneficiary_socials.trim().split(/\s+/);b[0]&&b[0].trim()!==""&&(l=b[0].trim(),h=' target="_blank" rel="noopener noreferrer"',u=!0)}const d=j(S,A),c=j(l,u);let C="";return I&&(C=`
            <div class="author-toolbar">
                <div class="author-toolbar-title">
                    ⚙️ Panel de Control de tu Causa
                </div>
                <div class="author-toolbar-actions">
                    <button class="author-btn author-btn-edit" id="authorEditCauseBtn">
                        ✏️ Editar Causa
                    </button>
                    <button class="author-btn author-btn-update" id="authorPublishUpdateBtn">
                        📢 Publicar Novedad
                    </button>
                </div>
            </div>
        `),`
        <!-- HEADER: Navegación + Badge -->
        <div class="solidario-header">
            <a href="contract_interaction.html" class="solidario-back-btn" id="solidarioBackBtn">
                ← Volver
            </a>
            <div class="solidario-badge-container">
                ${_}
            </div>
        </div>

        ${C}

        <!-- TARJETA PRINCIPAL -->
        
        <div class="solidario-cause-card ${(e.evidence_urls||[]).filter(w=>w&&(w.toLowerCase().includes("/uploads/")||/\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(w))).length>0?"has-images":""}" style="position: relative;">
            ${(()=>{const b=(e.evidence_urls||[]).filter(w=>{if(!w||typeof w!="string")return!1;const k=w.toLowerCase();return k.includes("/uploads/")||/\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(k)});return b.length===0?"":(window._currentCauseRealImages=b,`
                    <div class="cause-carousel-wrapper" style="margin: -20px -20px 20px -20px; border-radius: 16px 16px 0 0; overflow: hidden; position: relative; background: #0a0a14;">
                        <div class="cause-carousel-track" onscroll="const idx = Math.round(this.scrollLeft / this.offsetWidth); this.parentElement.querySelectorAll('.carousel-dot').forEach((d, i) => d.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.4)');" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch;">
                            ${b.map(w=>`<img src="${P(w)}" alt="Evidencia de causa" loading="lazy" style="flex: 0 0 100%; width: 100%; height: 280px; object-fit: cover; scroll-snap-align: center; cursor: pointer;">`).join("")}
                        </div>
                        ${b.length>1?`
                            <button class="carousel-arrow carousel-arrow-left" onclick="this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: -this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen anterior" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s;">❮</button>
                            <button class="carousel-arrow carousel-arrow-right" onclick="this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen siguiente" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s;">❯</button>
                            <div class="carousel-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;">
                                ${b.map((w,k)=>`<span class="carousel-dot" style="width:8px;height:8px;border-radius:50%;background:${k===0?"white":"rgba(255,255,255,0.4)"};transition:background 0.3s;"></span>`).join("")}
                            </div>
                        `:""}
                    </div>
                `)})()}
            <h1 class="solidario-cause-title" id="solidarioCauseTitle">${x(e.title)}</h1>
            <div class="solidario-cause-meta">
                <span>👤 Creador: <strong><a href="${S}"${D} class="profile-link" style="color: #a5b4fc; text-decoration: underline;">${d}${x(e.creator_username||"Creador")}</a></strong></span>
                ${e.beneficiary_username&&e.beneficiary_username!==e.creator_username?`<span>💖 Beneficiario: <strong><a href="${l}"${h} class="profile-link" style="color: #a5b4fc; text-decoration: underline;">${c}${x(e.beneficiary_username)}</a>${e.foundation_name?` (${x(e.foundation_name)})`:""}</strong></span>`:""}
                <span>📅 ${p}</span>
            </div>
            <div class="solidario-cause-story" id="solidarioCauseStory">${x(e.story)}</div>
        </div>

        <!-- BARRA DE PROGRESO (OPCIÓN A) -->
        <div class="solidario-progress-section" id="solidarioProgressSection">
            <div class="solidario-progress-amounts">
                <span class="solidario-progress-current">
                    ${$(r)} <span class="unit">BLUE IOU</span>
                </span>
                <span class="solidario-progress-goal">
                    Meta: ${$(a)} BLUE IOU
                </span>
            </div>
            
            <div class="solidario-progress-bar-wrapper">
                <div class="solidario-progress-bar-fill" style="width: ${g.toFixed(1)}%; background: #e83e8c; border-radius: ${y>0?"3px 0 0 3px":"3px"};"></div>
                ${y>0?`<div class="solidario-progress-bar-fill-hold" style="width: ${y.toFixed(1)}%; background: repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 10px, rgba(232, 62, 140, 0.6) 10px, rgba(232, 62, 140, 0.6) 20px); border-radius: 0 3px 3px 0;"></div>`:""}
            </div>
            
            <div class="solidario-progress-percentage-wrapper" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
                <span class="solidario-progress-percentage">${R(r,a)}% total recaudado</span>
            </div>

            <div class="solidario-breakdown" style="font-size: 0.8em; color: rgba(255,255,255,0.6); margin-top: 8px; padding: 10px; border-radius: 8px; background: rgba(0,0,0,0.15); display: flex; flex-direction: column; gap: 4px;">
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#e83e8c; margin-right:6px;"></span>Disponible:</span>
                    <strong>${$(t)} BLUE IOU</strong>
                </div>
                ${i>0?`
                <div style="display:flex; justify-content:space-between;">
                    <span><span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:rgba(232,62,140,0.5); margin-right:6px;"></span>En espera (KYC):</span>
                    <strong>${$(i)} BLUE IOU</strong>
                </div>`:""}
            </div>
        </div>

        <!-- BOTONES DE ACCIÓN -->
        <div class="solidario-actions" id="solidarioActions">
            <button class="solidario-btn-donate" id="solidarioDonateBtn"
                ${v?"disabled":""} style="display:flex; align-items:center; justify-content:center; gap:8px; background-color: #e83e8c; color: white;">
                ${v?"Meta Alcanzada":`${L} Donar BLUE IOU`}
            </button>
            <button class="solidario-btn-share" id="solidarioShareBtn" style="display:flex; align-items:center; justify-content:center; gap:8px;">
                ${B} Compartir
            </button>
        </div>

        <!-- SISTEMA DE PESTAÑAS (TABS) -->
        <div class="solidario-tabs">
            <button class="solidario-tab-btn active" id="tabDonationsBtn">Donaciones (${s})</button>
            <button class="solidario-tab-btn" id="tabUpdatesBtn">Novedades (<span id="updatesCountBadge">0</span>)</button>
            <button class="solidario-tab-btn" id="tabHistoryBtn">Historial de Cambios</button>
        </div>

        <!-- CONTENIDO PESTAÑA: DONACIONES -->
        <div class="solidario-tab-content active" id="tabContentDonations">
            <div class="solidario-donations-section" id="solidarioDonationsSection" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div class="solidario-donations-title" style="display:flex; align-items:center; gap:8px;">
                    <span style="color:#e83e8c;">${L}</span> ${s} ${s===1?"Donación recibida":"Donaciones recibidas"}
                </div>
                <div id="solidarioDonationsList">
                    <!-- Se llena dinámicamente -->
                </div>
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: NOVEDADES -->
        <div class="solidario-tab-content" id="tabContentUpdates">
            <div class="solidario-donations-section" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div id="updatesListContainer">
                    <div class="solidario-empty-donations">No hay novedades registradas todavía.</div>
                </div>
            </div>
        </div>

        <!-- CONTENIDO PESTAÑA: HISTORIAL -->
        <div class="solidario-tab-content" id="tabContentHistory">
            <div class="solidario-donations-section" style="margin-top:0; border:1px solid rgba(255,255,255,0.06); border-radius:16px;">
                <div id="historyListContent">
                    <div class="solidario-empty-donations">No hay historial de cambios registrado.</div>
                </div>
            </div>
        </div>
    `}function V(e){const o=document.getElementById("solidarioDonateBtn");!o||o.disabled||o.addEventListener("click",async()=>{try{const t=localStorage.getItem("token"),a=localStorage.getItem("username");if(!t||!a){m("Debes iniciar sesión para donar.");return}const n=await fetch(`${E}/api/users/${a}/booster-profile`,{headers:{Authorization:`Bearer ${t}`}});if(!n.ok){m("Error al obtener tu saldo de impulsor.");return}const i=await n.json(),s=parseFloat(i.base_eligible_booster_blue!==void 0?i.base_eligible_booster_blue:i.total_booster_blue)||0;document.getElementById("donorBalanceDisplay").textContent=$(s);const r=await fetch(`${E}/api/auth/status`,{headers:{Authorization:`Bearer ${t}`}});let g=!1;r.ok&&(g=(await r.json()).kyc_verified===!0);const y=document.getElementById("donateKycWarning");y&&(y.style.display=g?"none":"flex"),document.getElementById("donateModalOverlay").classList.add("active"),W(e,s)}catch(t){console.error("[SOLIDARIO] Error al preparar donación:",t),m("Error al obtener tu saldo. Intenta nuevamente.")}})}function W(e,o){const t=document.getElementById("donateModalOverlay"),a=document.getElementById("donateCancelBtn"),n=document.getElementById("donateConfirmBtn"),i=document.getElementById("donateAmountInput"),s=document.getElementById("donateTermsCheckbox");i.value="",s?(s.checked=!1,n.disabled=!0,s.onchange=()=>{n.disabled=!s.checked}):n.disabled=!1,n.textContent="Confirmar Donación";const r=()=>{t.classList.remove("active")};a.onclick=r,t.onclick=g=>{g.target===t&&r()},n.onclick=async()=>{const g=i.value.replace(",","."),y=parseFloat(g);if(isNaN(y)||y<=0){m("Ingresa un monto válido.");return}if(y>o){m(`Saldo insuficiente. Tienes ${$(o)} BLUE IOU disponibles.`);return}n.disabled=!0,n.textContent="Procesando...";try{const f=localStorage.getItem("token"),p=await fetch(`${E}/api/humanitarian/causes/${e.id}/donate`,{method:"POST",headers:{"Content-Type":"application/json",...f?{Authorization:`Bearer ${f}`}:{}},body:JSON.stringify({amount:y,accepted_terms:!0})}),v=await p.json();if(!p.ok)throw new Error(v.message||"Error al procesar la donación.");r(),m(v.message||"¡Donación procesada exitosamente!"),setTimeout(()=>{window.location.reload()},2500)}catch(f){console.error("[SOLIDARIO] Error al donar:",f),m(f.message||"Error al procesar la donación."),n.disabled=!1,n.textContent="Confirmar Donación"}}}function G(e){const o=document.getElementById("solidarioShareBtn");o&&o.addEventListener("click",()=>{const t=window.location.href,a=`💙 Ayuda a ${e.beneficiary_username||"un usuario"} con su causa "${e.title}" en WintonCoin.

Dona tus BLUE IOU y marca la diferencia:`;if(navigator.share)navigator.share({title:`Winton Solidario: ${e.title}`,text:a,url:t}).catch(()=>{});else{const n=`${a}
${t}`,i=`https://wa.me/?text=${encodeURIComponent(n)}`;window.open(i,"_blank")}})}function J(e){const o=document.getElementById("solidarioDetailCancelBtn");o&&o.addEventListener("click",t=>{t.preventDefault(),t.stopPropagation(),z("¿Estás seguro de que deseas cancelar y cerrar esta causa? Si lo haces, ya no podrás recibir más donaciones en esta y quedará marcada como culminada.",async()=>{o.disabled=!0,o.textContent="Cancelando...";try{const a=localStorage.getItem("token"),n=await fetch(`${E}/api/humanitarian/causes/${e.id}/cancel`,{method:"POST",headers:{Authorization:`Bearer ${a}`}}),i=await n.json();n.ok?m(i.message||"Causa cancelada exitosamente.",()=>{window.location.reload()}):(m(i.message||"Error al cancelar la causa."),o.disabled=!1,o.textContent="🛑 Cancelar y Cerrar Causa Actual")}catch(a){console.error("Error canceling cause:",a),m("Error de red al intentar cancelar."),o.disabled=!1,o.textContent="🛑 Cancelar y Cerrar Causa Actual"}})})}function Y(e){const o=document.getElementById("solidarioDonationsList");if(!o)return;const t=e.donations||[];if(t.length===0){o.innerHTML=`
            <div class="solidario-empty-donations">
                <p>Aún no hay donaciones. ¡Sé el primero en apoyar!</p>
            </div>
        `;return}o.innerHTML=t.map(a=>{const n=parseFloat(a.amount),i=new Date(a.created_at).toLocaleDateString("es-ES",{month:"short",day:"numeric"}),s=a.status==="released"?"released":"on_hold",r=a.status==="released"?"Acreditada":"En espera",g=a.donation_type==="referral",y=g?"Por código":"Donado",f=g?"referral":"voluntary";return`
            <div class="solidario-donation-item">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="solidario-donation-user">@${x(a.donor_username)}</div>
                        <span class="donation-type-badge ${f}">${y}</span>
                    </div>
                    <span style="font-size:0.75em; color:#64748B;">${i}</span>
                </div>
                <div style="text-align:right;">
                    <div class="solidario-donation-amount">${$(n)} BLUE IOU</div>
                    <span class="solidario-donation-status ${s}">${r}</span>
                </div>
            </div>
        `}).join("")}function j(e,o){if(!o)return'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; opacity:0.8;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>';const t=e.toLowerCase();return t.includes("instagram.com")||t.includes("instagr.am")?'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#e83e8c;"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>':t.includes("facebook.com")||t.includes("fb.com")?'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#1877F2;"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>':t.includes("twitter.com")||t.includes("x.com")?'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#cbd5e1;"><path d="M4 4l11.733 16h4.267l-11.733 -16z"></path><path d="M4 20l6.768 -6.768m2.46 -2.46l6.772 -6.772"></path></svg>':t.includes("youtube.com")||t.includes("youtu.be")?'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; color:#FF0000;"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>':'<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:4px; opacity:0.8;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>'}function x(e){if(!e)return"";const o=document.createElement("div");return o.appendChild(document.createTextNode(e)),o.innerHTML}function P(e){return e?e.replace(/"/g,"&quot;").replace(/'/g,"&#39;"):""}function $(e){return(parseFloat(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})}function O(e,o=!1){const t=document.getElementById("solidarioPageContainer");t.innerHTML=`
        <div class="solidario-error">
            <h2>⚠️</h2>
            <p>${x(e)}</p>
            ${o?'<p><a href="login.html">Iniciar sesión</a></p>':""}
            <p><a href="contract_interaction.html">Volver al inicio</a></p>
        </div>
    `}function K(e){const o=document.getElementById("tabDonationsBtn"),t=document.getElementById("tabUpdatesBtn"),a=document.getElementById("tabHistoryBtn"),n=document.getElementById("tabContentDonations"),i=document.getElementById("tabContentUpdates"),s=document.getElementById("tabContentHistory");o&&(o.onclick=()=>U(o,n),t.onclick=()=>{U(t,i),Q(e.id)},a.onclick=()=>{U(a,s),Z(e.id)},X(e.id))}function U(e,o){document.querySelectorAll(".solidario-tab-btn").forEach(t=>t.classList.remove("active")),document.querySelectorAll(".solidario-tab-content").forEach(t=>t.classList.remove("active")),e.classList.add("active"),o.classList.add("active")}async function X(e){try{const o=await fetch(`${E}/api/humanitarian/causes/${e}/updates`);if(o.ok){const t=await o.json();if(t.success&&t.updates){const a=document.getElementById("updatesCountBadge");a&&(a.textContent=t.updates.length)}}}catch(o){console.error("Error al obtener cantidad de novedades:",o)}}async function Q(e){const o=document.getElementById("updatesListContainer");if(o)try{const t=await fetch(`${E}/api/humanitarian/causes/${e}/updates`);if(!t.ok)throw new Error("No se pudieron obtener las novedades.");const a=await t.json();if(!a.success||!a.updates||a.updates.length===0){o.innerHTML='<div class="solidario-empty-donations">No hay novedades registradas todavía.</div>';return}o.innerHTML=a.updates.map(n=>{const i=new Date(n.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})+" hs";return`
                <div class="update-item">
                    <div class="update-item-header">
                        <span class="update-item-title">${x(n.update_title)}</span>
                        <span class="update-item-date">${i}</span>
                    </div>
                    <div class="update-item-body">${x(n.update_text)}</div>
                </div>
            `}).join("")}catch(t){o.innerHTML=`<div class="solidario-empty-donations" style="color:#ef4444;">${t.message}</div>`}}async function Z(e){const o=document.getElementById("historyListContent");if(o)try{const t=await fetch(`${E}/api/humanitarian/causes/${e}/history`);if(!t.ok)throw new Error("No se pudo obtener el historial de ediciones.");const a=await t.json();if(!a.success||!a.history||a.history.length===0){o.innerHTML='<div class="solidario-empty-donations">No hay historial de cambios registrado para la historia principal de la causa.</div>';return}o.innerHTML=a.history.map(n=>{const i=new Date(n.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})+" hs";return`
                <div class="history-item">
                    <div class="history-item-header">
                        <span>Editado por <strong class="history-item-editor">@${x(n.editor_username)}</strong></span>
                        <span>${i}</span>
                    </div>
                    <div class="history-diff-container">
                        <div class="diff-section removed">
                            <strong>Antes:</strong><br>
                            ${x(n.old_story)}
                        </div>
                        <div class="diff-section added">
                            <strong>Después:</strong><br>
                            ${x(n.new_story)}
                        </div>
                    </div>
                </div>
            `}).join("")}catch(t){o.innerHTML=`<div class="solidario-empty-donations" style="color:#ef4444;">${t.message}</div>`}}function ee(e){const o=document.getElementById("authorEditCauseBtn"),t=document.getElementById("authorPublishUpdateBtn"),a=document.getElementById("editCauseModalOverlay"),n=document.getElementById("publishUpdateModalOverlay"),i=document.getElementById("editCancelBtn"),s=document.getElementById("editConfirmBtn"),r=document.getElementById("editGoalInput"),g=document.getElementById("editStoryInput"),y=document.getElementById("editStoryCounter"),f=document.getElementById("editStoryLimitWarning"),p=document.getElementById("editCauseDropzone"),v=document.getElementById("editCauseFileInput"),L=document.getElementById("editCausePreviewContainer");let B=[];const M=document.getElementById("updateCancelBtn"),I=document.getElementById("updateConfirmBtn"),T=document.getElementById("updateTitleInput"),_=document.getElementById("updateTextInput");if(!o)return;function S(){L.innerHTML="",B.forEach((l,h)=>{const u=document.createElement("div");u.style.position="relative",u.style.width="70px",u.style.height="70px",u.style.borderRadius="8px",u.style.overflow="hidden",u.style.border="1px solid rgba(255,255,255,0.1)";const d=document.createElement("img");d.src=l,d.style.width="100%",d.style.height="100%",d.style.objectFit="cover";const c=document.createElement("button");c.innerHTML="&times;",c.style.position="absolute",c.style.top="2px",c.style.right="2px",c.style.width="18px",c.style.height="18px",c.style.background="rgba(239, 68, 68, 0.9)",c.style.color="white",c.style.border="none",c.style.borderRadius="50%",c.style.cursor="pointer",c.style.display="flex",c.style.alignItems="center",c.style.justifyContent="center",c.style.fontSize="12px",c.onclick=C=>{C.preventDefault(),C.stopPropagation(),B.splice(h,1),S()},u.appendChild(d),u.appendChild(c),L.appendChild(u)})}const D=()=>{if(B=[],L.innerHTML="",p){p.style.borderColor="rgba(255,255,255,0.15)";const l=p.querySelector("p");l&&(l.textContent="Arrastra nuevas imágenes o haz clic aquí")}};p&&v&&(p.onclick=l=>{l.stopPropagation(),v.click()},v.onclick=l=>{l.stopPropagation()},p.ondragover=l=>{l.preventDefault(),p.style.borderColor="#3B82F6"},p.ondragleave=()=>{p.style.borderColor="rgba(255,255,255,0.15)"},p.ondrop=async l=>{l.preventDefault(),p.style.borderColor="rgba(255,255,255,0.15)";const h=Array.from(l.dataTransfer.files);await A(h)},v.onchange=async()=>{const l=Array.from(v.files);await A(l),v.value=""});async function A(l){const h=localStorage.getItem("token"),u=l.filter(C=>C.type.startsWith("image/"));if(u.length===0)return;if(B.length+u.length>3){m("Solo puedes agregar un máximo de 3 nuevas imágenes por cada actualización.");return}const d=p.querySelector("p"),c=d?d.textContent:"";d&&(d.textContent="Subiendo...");try{for(const C of u){const b=new FormData;b.append("images",C),b.append("max_images",3);const w=await fetch(`${E}/api/media/upload`,{method:"POST",headers:{Authorization:`Bearer ${h}`},body:b}),k=await w.json();if(!w.ok)throw new Error(k.message||"Error al subir la imagen.");k.urls&&k.urls.length>0&&B.push(k.urls[0])}S()}catch(C){m(`Error al subir imágenes: ${C.message}`)}finally{d&&(d.textContent=c)}}o.onclick=()=>{r.value=e.goal_amount,g.value=e.story,y.textContent=`${e.story.length} caracteres`,f.style.display="none",D(),a.classList.add("active")},i.onclick=()=>{a.classList.remove("active"),D()},g.oninput=()=>{const l=g.value.length;y.textContent=`${l} caracteres (min 100)`;const h=e.story.length,u=Math.abs(h-l);(h>0?u/h*100:0)>15?f.style.display="inline":f.style.display="none"},s.onclick=async()=>{const l=localStorage.getItem("token"),h=r.value.trim(),u=g.value.trim();if(isNaN(parseFloat(h))||parseFloat(h)<=0){m("Por favor, ingresa una meta válida.");return}if(u.length<100){m("La historia debe tener al menos 100 caracteres.");return}s.disabled=!0,s.textContent="Guardando...";try{const d=await fetch(`${E}/api/humanitarian/causes/${e.id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${l}`},body:JSON.stringify({goal_amount:parseFloat(h),story:u,new_evidence_urls:B})}),c=await d.json();if(!d.ok)throw new Error(c.message||"Error al actualizar causa.");a.classList.remove("active"),D(),m("Causa actualizada exitosamente.",()=>{window.location.reload()})}catch(d){m(d.message)}finally{s.disabled=!1,s.textContent="Guardar Cambios"}},t.onclick=()=>{T.value="",_.value="",n.classList.add("active")},M.onclick=()=>{n.classList.remove("active")},I.onclick=async()=>{const l=localStorage.getItem("token"),h=T.value.trim(),u=_.value.trim();if(h.length<5){m("El título de la novedad debe tener al menos 5 caracteres.");return}if(u.length<20){m("El contenido de la novedad debe tener al menos 20 caracteres.");return}I.disabled=!0,I.textContent="Publicando...";try{const d=await fetch(`${E}/api/humanitarian/causes/${e.id}/updates`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${l}`},body:JSON.stringify({update_title:h,update_text:u})}),c=await d.json();if(!d.ok)throw new Error(c.message||"Error al publicar novedad.");n.classList.remove("active"),m("Novedad publicada y correos transaccionales enviados con éxito.",()=>{window.location.reload()})}catch(d){m(d.message)}finally{I.disabled=!1,I.textContent="Publicar y Notificar"}}}document.addEventListener("click",e=>{const o=e.target.closest(".cause-carousel-track img, .card-images-container img");if(o){const t=document.getElementById("evidenceLightboxModal"),a=document.getElementById("lightboxImagesContainer");if(t&&a){const i=(window.currentCause?.evidence_urls||[]).filter(s=>{if(!s||typeof s!="string")return!1;const r=s.toLowerCase();return r.includes("/uploads/")||/\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(r)});if(i.length>0){a.innerHTML=i.map(g=>`
                    <img src="${P(g)}" style="max-height: 85vh; max-width: 100%; object-fit: contain; scroll-snap-align: center; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                `).join("");const s=o.getAttribute("src"),r=i.indexOf(s);r!==-1&&a.children[r]&&setTimeout(()=>{a.children[r].scrollIntoView({behavior:"auto",block:"center",inline:"center"})},50),t.style.display="flex"}}}if(e.target.closest(".lightbox-close-button")||e.target.id==="evidenceLightboxModal"){const t=document.getElementById("evidenceLightboxModal");t&&(t.style.display="none")}});
//# sourceMappingURL=causaSolidaria.BiE7XSro.js.map
