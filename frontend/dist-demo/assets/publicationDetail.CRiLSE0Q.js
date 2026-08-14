import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import{l as O}from"./index.pbqrtUCb.js";import{s as f,e as pe,f as ue,g as me,i as $,d as B,j as T,c as M,h as ge}from"./auth.BgcrufBo.js";document.addEventListener("DOMContentLoaded",()=>{const k=me(),v=localStorage.getItem("username"),P=localStorage.getItem("token"),h=new URLSearchParams(window.location.search).get("id");let U=!1;const l={container:document.getElementById("publication-detail-container"),content:document.getElementById("publication-content"),ratingModal:document.getElementById("ratingModal"),ratingForm:document.getElementById("ratingForm"),ratingModalTitle:document.getElementById("ratingModalTitle"),ratingPublicationId:document.getElementById("ratingPublicationId"),ratingRaterUsername:document.getElementById("ratingRaterUsername"),ratingRateeUsername:document.getElementById("ratingRateeUsername"),preflightModal:document.getElementById("preflightModal"),preflightTitle:document.getElementById("preflightTitle"),preflightMessage:document.getElementById("preflightMessage"),preflightContinueBtn:document.getElementById("preflightContinueBtn"),completeTaskModal:document.getElementById("completeTaskModal"),completeTaskConfirmBtn:document.getElementById("completeTaskConfirmBtn"),evidenceDropzone:document.getElementById("evidenceDropzone"),evidenceFileInput:document.getElementById("evidenceFileInput"),evidencePreviewContainer:document.getElementById("evidencePreviewContainer"),evidenceRequiredMessage:document.getElementById("evidenceRequiredMessage"),evidenceLimitMessage:document.getElementById("evidence-limit-message")};let _=[];if(!h){f("No se ha especificado una publicación.",()=>{window.location.href="contract_interaction.html"});return}async function R(){try{await pe();const e=localStorage.getItem("token"),a=localStorage.getItem("username"),n=ue(),t=fetch(`${k}/api/platform-settings`).then(async r=>r.ok?r.json():{}),s=a?`?user=${a}`:"",c=fetch(`${k}/api/publications/${h}${s}`),[o,i,d]=await Promise.all([n,t,c]);if(!d.ok){const r=await d.json();throw new Error(r.message||"Error al cargar la publicación.")}const p=await d.json();if(!a||!e){const r="publication-detail.html"+window.location.search;if(p.category==="donation"){const u=p.beneficiary_referral_code?`&ref=${encodeURIComponent(p.beneficiary_referral_code)}`:"";window.location.href=`register.html?returnTo=${encodeURIComponent(r)}${u}`;return}else{window.location.href=`register.html?returnTo=${encodeURIComponent(r)}`;return}}p.preflight_modal&&!U&&z(p.preflight_modal),F(p,i),Y()}catch(e){console.error("Error al inicializar la página de detalle:",e),l.content.innerHTML=`<p class="error-message">No se pudo cargar la publicación. ${e.message}</p>`}}R();function j(e){const n=String(e||"").replace(/\r\n/g,`
`).split(`
`).map(o=>o.replace(/[ \t]+$/g,"")),t=n.filter(o=>o.trim().length>0).map(o=>(o.match(/^[ \t]*/)||[""])[0].length),s=t.length?Math.min(...t):0;return n.map(o=>o.slice(s)).join(`
`).trim()}function z(e){l.preflightModal&&(l.preflightTitle.textContent=e.title,l.preflightMessage.textContent=e.message,l.preflightModal.style.display="flex",l.preflightContinueBtn.onclick=()=>{l.preflightModal.style.display="none",U=!0})}function N(e,a){return a?.pre_launch_mode_enabled?"BLUE IOU":"BLUE"}function F(e,a){window.currentPublication=e,window.maxEvidenceImages=parseInt(a?.max_images_evidence||"2",10);const n=e.category==="donation",t=H(e.author_average_rating,e.author_ratings_count),s=$(e.author_username),c=B.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(e.author_username)}" class="profile-link">${s}</a>`:s;let o="";if(n&&e.beneficiary_username){const E=$(e.beneficiary_username);o=`<div class="detail-beneficiary" style="margin-top: 8px; font-size: 0.95rem; color: #e83e8c;">🎁 Campaña a beneficio de: <strong>${B.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(e.beneficiary_username)}" class="profile-link">@${E}</a>`:`@${E}`}</strong></div>`}const i=K(e),d=`
            <button class="share-link-button" data-action="share" aria-label="Compartir publicación">
                <svg class="share-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                Compartir
            </button>
        `,p=N(e,a),{messageHTML:r,actionHTML:u,acceptButtonHTML:m,duplicateCompleteButtonHTML:g}=Q(e,i.isExpired,p),{mainText:y,steps:x}=V(e.description),C=G(x,e.form_fields,e.user_acceptance_status);n||e.is_sell_post,n?`${w(e.goal_amount)}${p}`:`${w(e.blue_cost)}${p}`;const I=n?`<div class="donation-meta-badge-detail">Meta: ${w(e.goal_amount)} ${p}</div>`:"";let S="";if(n){const E=parseFloat(e.current_amount||0),L=parseFloat(e.goal_amount||0),q=L>0?Math.min(100,Math.floor(E/L*100)):0;S=`
                <div class="donation-progress-container detail-progress">
                    <div class="donation-progress-labels">
                        <span><strong>${w(E)}</strong> recaudados de ${w(L)} ${p}</span>
                        <span>${q}%</span>
                    </div>
                    <div class="donation-progress-bar">
                        <div class="donation-progress-fill" style="width: ${q}%"></div>
                    </div>
                </div>
            `}const ie=parseFloat(e.base_blue_cost||e.blue_cost||0),re=parseFloat(e.current_multiplier||1),ce=w(e.blue_cost),le=`
            <div class="multiplier-brief-line" style="margin-top: 8px; padding: 5px 12px; background: rgba(2, 132, 199, 0.07); border: 1px solid rgba(2, 132, 199, 0.2); border-radius: 30px; font-size: 0.78rem; color: #0369a1; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; flex-wrap: nowrap; white-space: nowrap; max-width: 100%; overflow-x: auto;">
                <span>Base <strong>${w(ie)}</strong></span>
                <span style="opacity: 0.6; font-weight: 400;">x</span>
                <span>Mult. <strong>${re}x</strong></span>
                <span style="opacity: 0.6; font-weight: 400;">=</span>
                <strong style="color: #0284c7;">${ce} ${p}</strong>
            </div>
        `,de=`
            <div class="detail-header">
                ${I}
                <h1 class="detail-title">${$(e.title)}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${c}</strong> ${t}
                    <span class="detail-date">el ${new Date(e.created_at).toLocaleDateString()}</span>
                    ${i.html}
                </div>
                ${le}
                ${o}
            </div>

            <div class="share-button-container">
                ${m||""}
                ${d}
            </div>

            ${S}

            <hr>

            ${e.image_urls&&e.image_urls.length>0?`
                <div class="cause-carousel-wrapper" style="margin: 20px 0; border-radius: 12px; overflow: hidden; position: relative; background: #000;">
                    <div class="cause-carousel-track" onscroll="const idx = Math.round(this.scrollLeft / this.offsetWidth); this.parentElement.querySelectorAll('.carousel-dot').forEach((d, i) => d.style.background = i === idx ? 'white' : 'rgba(255,255,255,0.4)');" style="display: flex; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
                        ${e.image_urls.map(E=>`<img src="${T(E)}" alt="Imagen de publicación" loading="lazy" style="flex: 0 0 100%; width: 100%; max-height: 280px; object-fit: cover; scroll-snap-align: center; cursor: pointer;">`).join("")}
                    </div>
                    ${e.image_urls.length>1?`
                        <button class="carousel-arrow carousel-arrow-left" onclick="event.preventDefault(); event.stopPropagation(); this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: -this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen anterior" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s; z-index: 2;">❮</button>
                        <button class="carousel-arrow carousel-arrow-right" onclick="event.preventDefault(); event.stopPropagation(); this.parentElement.querySelector('.cause-carousel-track').scrollBy({left: this.parentElement.offsetWidth, behavior: 'smooth'})" aria-label="Imagen siguiente" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:36px;height:36px;border-radius:50%;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.2);color:white;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;opacity:0.7;transition:opacity 0.3s; z-index: 2;">❯</button>
                        <div class="carousel-dots" style="position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:6px;pointer-events: none;">
                            ${e.image_urls.map((E,L)=>`<span class="carousel-dot" style="width:8px;height:8px;border-radius:50%;background:${L===0?"white":"rgba(255,255,255,0.4)"};transition:background 0.3s;"></span>`).join("")}
                        </div>
                    `:""}
                </div>
            `:""}

            <div class="detail-description">
                ${O(j(y))}
            </div>

            ${C}

            <hr>
            
            <div class="detail-actions-section">
                ${g||""}
                ${r}
                ${u}
            </div>

            ${J(e)}
        `;l.content.innerHTML=de}function V(e){const a="[[INSTRUCTIONS_STEPS]]",n="[[/INSTRUCTIONS_STEPS]]";if(!e||!e.includes(a))return{mainText:e||"",steps:[]};const t=e.indexOf(a),s=e.indexOf(n);if(s===-1)return{mainText:e||"",steps:[]};const c=e.slice(0,t).trim(),o=e.slice(t+a.length,s).split(`
`).map(i=>i.trim()).filter(i=>i.length>0);return{mainText:c,steps:o}}function G(e,a=null,n=null){return!e||e.length===0?"":`
            <div class="detail-steps">
                <h3 class="detail-steps-title">Sigue las instrucciones paso a paso sin saltar ninguno</h3>
                <ol class="detail-steps-flow">
                    ${e.map((s,c)=>{const o=c+1,i=String(o),d=a&&a[i]&&a[i].length>0;let p="";if(d){const r=a[i].map((u,m)=>{const g=typeof u=="string"?u:u?.label||`Campo ${m+1}`;return(typeof u=="object"&&u?.type==="textarea"?"textarea":"text")==="textarea"?`
                            <div class="step-form-field-user">
                                <label for="form-step-${o}-field-${m}">${$(g)}</label>
                                <textarea 
                                    id="form-step-${o}-field-${m}" 
                                    class="step-form-input step-form-textarea" 
                                    data-step="${o}" 
                                    data-field="${T(g)}"
                                    placeholder="Escribe tu respuesta detallada..." 
                                    maxlength="5000"
                                    rows="4"
                                    required></textarea>
                                <span class="step-form-char-count" data-for="form-step-${o}-field-${m}">0 / 5000</span>
                            </div>
                        `:`
                            <div class="step-form-field-user">
                                <label for="form-step-${o}-field-${m}">${$(g)}</label>
                                <input type="text" 
                                       id="form-step-${o}-field-${m}" 
                                       class="step-form-input" 
                                       data-step="${o}" 
                                       data-field="${T(g)}"
                                       placeholder="Escribe tu respuesta..." 
                                       maxlength="1000"
                                       required>
                            </div>
                        `}).join("");p=`
                    <div class="step-form-container" data-step="${o}">
                        <div class="step-form-header">
                            <span class="step-form-icon">📝</span>
                            <span class="step-form-label">Completa los siguientes datos:</span>
                        </div>
                        <div class="step-form-fields-user">
                            ${r}
                        </div>
                    </div>
                `}return`
                <li class="detail-step-item">
                    <div class="detail-step-node">
                        <span class="detail-step-index">${o}</span>
                    </div>
                    <div class="detail-step-content">
                        <div class="detail-step-badge">Paso ${o}</div>
                        <div class="detail-step-text">${O(s)}</div>
                        ${p}
                    </div>
                </li>
            `}).join("")}
                </ol>
            </div>
        `}function J(e){if(e.author_username!==v||!e.participants||e.participants.length===0)return"";const a=e.category==="donation";return`
            <div class="detail-participants-section">
                <h2>Participantes</h2>
                <ul class="participants-list">
                    ${e.participants.map(t=>{const s=H(t.average_rating,t.ratings_count),c=oe(t.status);let o="";const i=$(t.username),d=B.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(t.username)}" class="profile-link">${i}</a>`:i,p=t.accepted_at?`<span class="participant-accepted-at">Solicitó: ${W(t.accepted_at)}</span>`:"";if(t.status==="pending_approval")o=`
                    <button class="action-button approve" data-action="approve" data-user="${T(t.username)}">Aprobar</button>
                    <button class="action-button discard" data-action="discard" data-user="${T(t.username)}">Descartar</button>
                `;else if(t.status==="approved"){if(t.phone_number){const g=`https://wa.me/${t.phone_number.replace(/\D/g,"")}`;o+=`
                        <a href="${g}" target="_blank" class="action-button whatsapp-button" title="Contactar por WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Contactar
                        </a>
                    `}}else t.status==="completed"&&(o=`
                    <button class="action-button confirm" data-action="confirm-payment" data-user="${T(t.username)}">Confirmar Pago</button>
                `);let r="";t.form_responses&&Object.keys(t.form_responses).length>0&&(r=`
                    <div class="participant-form-responses">
                        <div class="form-responses-header">
                            <span class="form-responses-icon">📝</span>
                            <span class="form-responses-title">Respuestas del formulario:</span>
                        </div>
                        <div class="form-responses-content">
                            ${Object.entries(t.form_responses).map(([y,x])=>{const C=Object.entries(x).map(([I,S])=>`
                        <div class="form-response-field">
                            <span class="form-response-label">${$(I)}:</span>
                            <span class="form-response-value">${$(S)}</span>
                        </div>
                    `).join("");return`
                        <div class="form-response-step">
                            <span class="form-response-step-badge">Paso ${y}</span>
                            ${C}
                        </div>
                    `}).join("")}
                        </div>
                    </div>
                `);const u=a&&t.blue_cost?`<span class="participant-donation-amount">+${w(t.blue_cost)} BLUE</span>`:"";let m="";return t.evidence_urls&&t.evidence_urls.length>0&&(m=`
                    <div class="participant-evidence" style="margin-top: 10px;">
                        <button type="button" class="action-button view-evidence-btn" data-evidence="${encodeURIComponent(JSON.stringify(t.evidence_urls))}" style="font-size: 0.85rem; padding: 6px 12px;">Ver Evidencias</button>
                    </div>
                `),`
                <li class="participant-item ${t.form_responses?"has-responses":""}">
                    <div class="participant-info">
                        <strong>${d}</strong>
                        <span class="rating-display">${s}</span>
                        ${u}
                        ${p}
                    </div>
                    <div class="participant-status">
                        <span class="status-badge ${t.status}">${c}</span>
                        ${o}
                    </div>
                    ${m}
                    ${r}
                </li>
            `}).join("")}
                </ul>
            </div>
        `}function W(e){const a=new Date(e),n={day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"};return a.toLocaleDateString("es-ES",n)}function Q(e,a,n="BLUE"){const t=v,s=e.category==="donation";if(e.is_quick_sale){let r="",u="";if(a)return r='<div class="status-info">Esta Venta Rápida ha expirado.</div>',{messageHTML:r,actionHTML:u};const m=t===e.author_username,g=t===e.target_username,y=!e.target_username;if(m){const x=`${window.location.origin}/publication-detail.html?id=${e.id}`;u=`
                    <div class="qr-code-container">
                        <h2>Comparte este QR para recibir tu pago</h2>
                        <p>El enlace de pago es válido por 5 minutos desde su creación.</p>
                        <div id="qrCodeOutput_detail"></div>
                        <input type="text" id="qrCodeUrl_detail" value="${x}" readonly>
                        <button id="copyQrCodeUrl_detail" class="action-button">Copiar Enlace</button>
                    </div>
                `,setTimeout(()=>{typeof QRCode<"u"&&new QRCode(document.getElementById("qrCodeOutput_detail"),{text:x,width:200,height:200}),document.getElementById("copyQrCodeUrl_detail")?.addEventListener("click",()=>{document.getElementById("qrCodeUrl_detail").select(),document.execCommand("copy"),f("¡Enlace copiado al portapapeles!")})},100)}else g||y&&!m?(r=`<div class="action-message">Estás a punto de pagar <strong>${w(e.blue_cost)} ${n}</strong> a <strong>${$(e.author_username)}</strong>.</div>`,u='<button class="action-button confirm" data-action="pay-quick-sale">Pagar Ahora</button>'):r='<div class="status-info">No tienes permiso para ver o actuar en esta venta.</div>';return{messageHTML:r,actionHTML:u,acceptButtonHTML:"",duplicateCompleteButtonHTML:""}}const c=e.user_acceptance_status;let o="",i="",d="",p="";if(t===e.author_username){const r=e.participants.some(y=>["approved","completed"].includes(y.status)),u=e.participants.every(y=>y.status==="confirmed_paid"),m=!r,g=!u&&!a;e.participants.length===0&&!a&&(o='<div class="status-pending">Aún no hay solicitudes para esta tarea.</div>'),g&&(i+=`<button class="action-button pause" data-action="toggle-pause">${e.is_paused?"Reanudar Solicitudes":"Pausar Solicitudes"}</button>`),i+=`<button class="action-button delete" data-action="delete" ${m?"":"disabled"}>Eliminar Tarea</button>`,m||(o+='<div class="status-info">No puedes eliminar una tarea con participantes activos.</div>')}else{if(a)return o='<div class="status-info">Esta tarea ha expirado y ya no acepta nuevos participantes.</div>',{messageHTML:o,actionHTML:i,acceptButtonHTML:d};if(s)d=`
                    <div class="donation-detail-flow">
                        <div class="donation-input-group">
                            <input type="number" step="any" placeholder="Monto a donar" class="donation-input" id="detail-don-input" min="1">
                            <button class="donation-btn detail-don-btn" data-action="direct-donation">Donar Ahora</button>
                        </div>
                    </div>
                `;else{const r=e.is_sell_post?"Comprar":"Aceptar Tarea",u=e.is_sell_post?"comprado":"realizado";switch(c){case"pending_approval":o='<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>',i='<button class="action-button desist" data-action="desist" style="background-color: #4b5563; color: white;">Retirar solicitud</button>';break;case"approved":{const m=e.is_sell_post?"He Recibido, Pagar":"He culminado";d=`
                            <div class="detail-primary-actions">
                                <span class="detail-primary-note">¡Has sido aprobado! Ahora puedes proceder a realizar la tarea.</span>
                                <div style="display: flex; gap: 12px; margin-top: 12px; flex-wrap: wrap;">
                                    <button class="action-button complete" data-action="complete" style="flex: 1; min-width: 150px;">${m}</button>
                                    <button class="action-button desist" data-action="desist" style="flex: 1; min-width: 150px; background-color: #ef4444; color: white;">Abandonar tarea</button>
                                </div>
                            </div>
                        `,p=`<button class="action-button complete" data-action="complete">${m}</button>`;break}case"completed":o=`<p class="action-message status-pending">Has marcado la tarea como ${u}. Esperando confirmación final del autor.</p>`;break;case"confirmed_paid":e.available_slots>0&&(d=`<button class="action-button accept" data-action="accept">${r} de nuevo</button>`);break;case"not_participating":default:e.available_slots>0&&!e.is_paused?d=`<button class="action-button accept" data-action="accept">${r}</button>`:e.is_paused?o='<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>':o='<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>';break}}}return{messageHTML:o,actionHTML:i,acceptButtonHTML:d,duplicateCompleteButtonHTML:p}}function K(e){if(!e.expires_at)return{html:"",isExpired:!1};const a=new Date,t=new Date(e.expires_at)-a;if(t<=0)return{html:'<span class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</span>',isExpired:!0};const s=Math.floor(t/(1e3*60*60*24)),c=Math.floor(t%(1e3*60*60*24)/(1e3*60*60)),o=Math.floor(t%(1e3*60*60)/(1e3*60));let i="";return s>1?i=`Vence en ${s} días`:s===1?i=`Vence en ${s} día`:c>1?i=`Vence en ${c} horas`:c===1?i=`Vence en ${c} hora`:o>0?i=`Vence en ${o} min`:i="Vence en <1 min",{html:`<span class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${i}</span>`,isExpired:!1}}function X(){const e={},a=document.querySelectorAll(".step-form-container"),n=5e3;return a.forEach(t=>{const s=t.getAttribute("data-step"),c=t.querySelectorAll(".step-form-input");c.length>0&&(e[s]={},c.forEach(o=>{const i=o.getAttribute("data-field"),d=o.value.trim();i&&d&&(e[s][i]=d.replace(/\0/g,"").substring(0,n))}),Object.keys(e[s]).length===0&&delete e[s])}),e}document.addEventListener("input",e=>{if(e.target.classList.contains("step-form-textarea")){const a=e.target,n=parseInt(a.getAttribute("maxlength"),10)||5e3,t=a.value.length,s=a.parentElement.querySelector(".step-form-char-count");s&&(s.textContent=`${t} / ${n}`,t>n*.9?s.style.color="#ff4444":t>n*.7?s.style.color="#ff9800":s.style.color="")}});function Y(){l.content.addEventListener("click",Z),l.ratingForm.addEventListener("submit",ae);const e=l.ratingModal.querySelector(".rating-close-button");e&&e.addEventListener("click",()=>l.ratingModal.style.display="none"),window.addEventListener("click",t=>{t.target==l.ratingModal&&(l.ratingModal.style.display="none"),t.target==l.completeTaskModal&&(l.completeTaskModal.style.display="none")});const a=l.completeTaskModal?.querySelectorAll(".complete-close-button, .complete-cancel-button");a&&a.forEach(t=>t.addEventListener("click",()=>l.completeTaskModal.style.display="none"));const n=document.getElementById("evidenceLightboxModal");n&&(n.querySelector(".lightbox-close-button").addEventListener("click",()=>n.style.display="none"),n.addEventListener("click",s=>{s.target===n&&(n.style.display="none")}),l.content.addEventListener("click",s=>{const c=s.target.closest(".view-evidence-btn");if(c){const i=c.getAttribute("data-evidence");if(i)try{const d=JSON.parse(decodeURIComponent(i)),p=document.getElementById("lightboxImagesContainer");p.innerHTML=d.map(r=>`
                                <img src="${T(r)}" style="max-height: 80vh; max-width: 100%; object-fit: contain; scroll-snap-align: center; border-radius: 8px;">
                            `).join(""),n.style.display="flex"}catch(d){console.error("Error parsing evidence urls",d)}}const o=s.target.closest(".cause-carousel-track img, .card-images-container img");if(o){const i=window.currentPublication?.image_urls||[];if(i.length>0){const d=document.getElementById("lightboxImagesContainer");d.innerHTML=i.map(u=>`
                            <img src="${T(u)}" style="max-height: 85vh; max-width: 100%; object-fit: contain; scroll-snap-align: center; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                        `).join("");const p=o.getAttribute("src"),r=i.indexOf(p);r!==-1&&d.children[r]&&setTimeout(()=>{d.children[r].scrollIntoView({behavior:"auto",block:"center",inline:"center"})},50),n.style.display="flex"}}})),ne()}async function Z(e){const a=e.target.closest("[data-action]");if(!a)return;const n=a.dataset.action,t=a.dataset.user;let s,c={},o="POST";switch(n){case"pay-quick-sale":M(`¿Confirmas el pago de ${document.querySelector(".detail-cost-badge").innerText} a ${document.querySelector(".detail-meta strong").innerText}?`,async()=>{s=`/api/quick-sale/${h}/pay`,c={buyerUsername:v},await b(s,"POST",c)});return;case"accept":s=`/publications/${h}/accept`,c={acceptorUsername:v};break;case"direct-donation":{const p=document.getElementById("detail-don-input"),r=parseFloat(p?.value);if(!r||r<=0||isNaN(r)){f("Indica un monto válido para donar.");return}const u=document.querySelector(".detail-meta strong").textContent.trim();M(`¿Deseas donar ${r} BLUE a ${u}?

Recuerda que esto generará un compromiso de reciprocidad RED equivalente en tu cuenta.`,async()=>{await b(`/publications/${h}/accept`,"POST",{acceptorUsername:v,donationAmount:r})});return}case"approve":s=`/publications/${h}/approve`,c={approverUsername:v,userToApprove:t};break;case"complete":const i=X(),d=document.querySelectorAll(".step-form-input[required]");if(d.length>0){let p=!0;if(d.forEach(r=>{r.value.trim()?r.classList.remove("input-error"):(p=!1,r.classList.add("input-error"))}),!p){f("Por favor, completa todos los campos requeridos antes de marcar como culminada.");return}}window.currentPublication?.requires_evidence?l.completeTaskModal&&(l.completeTaskModal.style.display="flex",l.completeTaskConfirmBtn.onclick=async()=>{if(_.length===0){f("El creador de esta publicación exige imágenes como evidencia. Por favor sube al menos una imagen.");return}await A(h,i,_)}):await A(h,i,[]);return;case"desist":{const r=a&&a.textContent.toLowerCase().includes("solicitud")?"¿Deseas retirar tu solicitud para esta tarea? Tu postulación será eliminada y el cupo quedará libre para otros postulantes.":"¿Deseas abandonar esta tarea? Tu participación se cancelará y el cupo se liberará de inmediato para otros ayudantes.";M(r,async()=>{await b(`/publications/${h}/desist`,"POST",{acceptorUsername:v}),window.location.reload()});return}case"confirm-payment":try{const p=document.querySelector(".detail-meta strong a")?.innerText||document.querySelector(".detail-meta strong")?.innerText;await te(h,p,t)}catch(p){f("Error JS: "+p.message)}return;case"delete":M("¿Deseas eliminar esta tarea? Esta acción no se puede deshacer.",async()=>{await b(`/publications/${h}`,"DELETE",{deleterUsername:v}),window.location.href="contract_interaction.html"});return;case"discard":M(`¿Seguro que quieres descartar la solicitud de ${t}?`,async()=>{await b(`/publications/${h}/discard`,"POST",{discarderUsername:v,userToDiscard:t})});return;case"toggle-pause":s=`/publications/${h}/toggle-pause`,c={username:v};break;case"share":await ee();return;default:return}await b(s,o,c)}async function ee(){try{const e=document.getElementById("publication-content"),a=e.querySelector(".detail-title").textContent,n=e.querySelector(".detail-meta strong").textContent,t=window.location.href,s=`Hola!
Te comparto esta publicacion,te puede ser util

"${a}" por ${n}
Puedes ver los detalles aquí:`;if(navigator.share)await navigator.share({title:`Tarea en WintonCoin: ${a}`,text:s,url:t}),f("¡Gracias por compartir!");else{const c=`${s}
${t}`;await copyTextToClipboard(c),f("¡Mensaje para compartir copiado al portapapeles!")}}catch(e){console.error("Error al compartir la publicación:",e),e.name!=="AbortError"&&f(e.message||"Ocurrió un error al intentar compartir.")}}async function te(e,a,n){try{console.log("DEBUG: Enviando confirm-payment al servidor...",{pubId:e,authorUsername:a,acceptorUsername:n});const t=await b(`/publications/${e}/confirm-payment`,"POST",{confirmerUsername:v,workerUsername:n});console.log("DEBUG: Respuesta confirm-payment:",t),t?se(e,a,n):console.log("DEBUG: result fue nulo, modal no abierto.")}catch(t){console.error("DEBUG: Error capturado en confirmPaymentAndRate:",t),f("Error inesperado: "+t.message)}}async function ae(e){e.preventDefault();const a=new FormData(e.target),n=Object.fromEntries(a.entries());try{await b("/rate","POST",n),l.ratingModal.style.display="none"}catch{}}async function b(e,a="POST",n=null){try{const t={"Content-Type":"application/json"};P&&(t.Authorization="Bearer "+P);const s={method:a,headers:t};n&&(s.body=JSON.stringify(n));const c=await fetch(`${k}${e}`,s),o=await c.text();let i;try{i=JSON.parse(o)}catch{throw console.error("Respuesta no-JSON del servidor:",o),f(o||"Error inesperado del servidor."),new Error("Respuesta no-JSON del servidor")}if(!c.ok){if(ge(c))return null;if(c.status===403&&i.code==="LEGAL_ACCEPTANCE_REQUIRED")return new Promise((d,p)=>{window.showLegalAcceptanceModal(i.pending_documents,async r=>{console.log("[LEGAL] Términos aceptados desde modal (detalle de tarea). Reintentando...");try{const u=await b(e,a,n);d(u)}catch(u){p(u)}},()=>{p(new Error("Acción cancelada: Debes aceptar los términos y condiciones vigentes."))})});throw f(i.message||`Error en el servidor: ${c.status}`),new Error(i.message)}return i.message&&f(i.message),R(),i}catch(t){return console.error(`Error en fetchFromServer (${e}):`,t),null}}async function A(e,a,n){let t=`/publications/${e}/complete`,s={completerUsername:v,evidence_urls:n};a&&Object.keys(a).length>0&&(s.formResponses=a),l.completeTaskModal&&(l.completeTaskModal.style.display="none"),await b(t,"POST",s)}function ne(){!l.evidenceDropzone||!l.evidenceFileInput||(l.evidenceDropzone.addEventListener("click",()=>l.evidenceFileInput.click()),l.evidenceDropzone.addEventListener("dragover",e=>{e.preventDefault(),l.evidenceDropzone.classList.add("dragover")}),l.evidenceDropzone.addEventListener("dragleave",()=>l.evidenceDropzone.classList.remove("dragover")),l.evidenceDropzone.addEventListener("drop",e=>{e.preventDefault(),l.evidenceDropzone.classList.remove("dragover"),D(e.dataTransfer.files)}),l.evidenceFileInput.addEventListener("change",e=>D(e.target.files)),l.evidenceLimitMessage&&setInterval(()=>{const e=window.maxEvidenceImages||2;l.evidenceLimitMessage.textContent=`Puedes subir hasta ${e} imagen${e!==1?"es":""}.`},1e3))}async function D(e){const a=window.maxEvidenceImages||2,n=a-_.length;if(n<=0){f(`Solo puedes subir un máximo de ${a} imágenes de evidencia.`);return}const t=Array.from(e).slice(0,n);for(const s of t){if(!s.type.startsWith("image/"))continue;const c=document.createElement("div");c.className="media-preview-item";const o=document.createElement("img");o.src=URL.createObjectURL(s);const i=document.createElement("div");i.className="upload-progress";const d=document.createElement("button");d.className="remove-btn",d.innerHTML="&times;",d.type="button",d.style.display="none",c.appendChild(o),c.appendChild(i),c.appendChild(d),l.evidencePreviewContainer.appendChild(c);const p=new FormData;p.append("images",s);try{const r=localStorage.getItem("token"),u=await fetch(`${k}/api/media/upload`,{method:"POST",headers:{...r&&{Authorization:`Bearer ${r}`}},body:p});if(u.ok){const m=await u.json();if(m.urls&&m.urls.length>0){const g=m.urls[0];_.push(g),i.style.width="100%",setTimeout(()=>i.style.display="none",500),o.classList.add("loaded"),d.style.display="block",d.onclick=y=>{y.stopPropagation(),_=_.filter(x=>x!==g),c.remove()}}}else c.remove(),f("Error al subir la imagen.")}catch(r){console.error(r),c.remove(),f("Error de red al subir la imagen.")}}}function w(e){const n=(Number(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),t=n.split(",");return t.length===2?`${t[0]},<span class="decimal-part">${t[1]}</span>`:n}function oe(e){return{open:"Abierta",pending_approval:"Pendiente",approved:"Aprobado",completed:"Culminado",confirmed_paid:"Pagado"}[e]||e}function H(e,a){if(a===0)return'<span class="no-rating">Sin calificaciones</span>';const n="★".repeat(Math.round(e))+"☆".repeat(5-Math.round(e));return`<span class="stars" title="${parseFloat(e).toFixed(1)} de 5">${n}</span> <span class="rating-count">(${a})</span>`}function se(e,a,n){l.ratingForm.reset(),l.ratingPublicationId.value=e,l.ratingRaterUsername.value=a,l.ratingRateeUsername.value=n,l.ratingModalTitle.textContent=`Calificar a ${n}`,l.ratingModal.style.display="flex"}});
//# sourceMappingURL=publicationDetail.CRiLSE0Q.js.map
