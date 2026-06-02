import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import{e as y,l as A,a as T}from"./index.Dk_Cx65J.js";import{showCustomAlert as g,showCustomConfirm as L}from"./alerts.CawRDXDp.js";import{f as nt,g as st,a as U}from"./config.Br4uoD7s.js";import"./auth.PfzP10z-.js";document.addEventListener("DOMContentLoaded",()=>{const x=st(),f=localStorage.getItem("username"),C=localStorage.getItem("token"),v=new URLSearchParams(window.location.search).get("id");let P=!1;const l={container:document.getElementById("publication-detail-container"),content:document.getElementById("publication-content"),ratingModal:document.getElementById("ratingModal"),ratingForm:document.getElementById("ratingForm"),ratingModalTitle:document.getElementById("ratingModalTitle"),ratingPublicationId:document.getElementById("ratingPublicationId"),ratingRaterUsername:document.getElementById("ratingRaterUsername"),ratingRateeUsername:document.getElementById("ratingRateeUsername"),preflightModal:document.getElementById("preflightModal"),preflightTitle:document.getElementById("preflightTitle"),preflightMessage:document.getElementById("preflightMessage"),preflightContinueBtn:document.getElementById("preflightContinueBtn")};if(!f){g("Debes iniciar sesión para ver esta página.",()=>{window.location.href="index.html"});return}if(!v){g("No se ha especificado una publicación.",()=>{window.location.href="contract_interaction.html"});return}async function B(){try{const t=nt(),a=fetch(`${x}/api/platform-settings`).then(async r=>r.ok?r.json():{}),s=fetch(`${x}/api/publications/${v}?user=${f}`),[e,o,i]=await Promise.all([t,a,s]);if(!i.ok){const r=await i.json();throw new Error(r.message||"Error al cargar la publicación.")}const n=await i.json();n.preflight_modal&&!P&&I(n.preflight_modal),N(n,o),W()}catch(t){console.error("Error al inicializar la página de detalle:",t),l.content.innerHTML=`<p class="error-message">No se pudo cargar la publicación. ${t.message}</p>`}}B();function D(t){const s=String(t||"").replace(/\r\n/g,`
`).split(`
`).map(n=>n.replace(/[ \t]+$/g,"")),e=s.filter(n=>n.trim().length>0).map(n=>(n.match(/^[ \t]*/)||[""])[0].length),o=e.length?Math.min(...e):0;return s.map(n=>n.slice(o)).join(`
`).trim()}function I(t){l.preflightModal&&(l.preflightTitle.textContent=t.title,l.preflightMessage.textContent=t.message,l.preflightModal.style.display="flex",l.preflightContinueBtn.onclick=()=>{l.preflightModal.style.display="none",P=!0})}function q(t,a){const s=String(a?.platform_username||"Plataforma WintonCoin").toLowerCase(),e=String(t.author_username||"").toLowerCase();return e===s||e==="plataforma"}function O(t,a){return a?.pre_launch_mode_enabled&&q(t,a)?"BLUE iou":"BLUE"}function N(t,a){const s=t.category==="donation",e=k(t.author_average_rating,t.author_ratings_count),o=y(t.author_username),i=U.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(t.author_username)}" class="profile-link">${o}</a>`:o,n=J(t),r=`
            <button class="share-link-button" data-action="share" aria-label="Compartir publicación">
                <svg class="share-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                    <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                Compartir
            </button>
        `,d=O(t,a),{messageHTML:m,actionHTML:c,acceptButtonHTML:p,duplicateCompleteButtonHTML:u}=G(t,n.isExpired,d),{mainText:h,steps:$}=j(t.description),_=F($,t.form_fields,t.user_acceptance_status);s||t.is_sell_post,s?`${w(t.goal_amount)}${d}`:`${w(t.blue_cost)}${d}`;const E=s?`<div class="donation-meta-badge-detail">Meta: ${w(t.goal_amount)} BLUE</div>`:"";let M="";if(s){const H=parseFloat(t.current_amount||0),S=parseFloat(t.goal_amount||0),R=S>0?Math.min(100,Math.floor(H/S*100)):0;M=`
                <div class="donation-progress-container detail-progress">
                    <div class="donation-progress-labels">
                        <span><strong>${w(H)}</strong> recaudados de ${w(S)} BLUE</span>
                        <span>${R}%</span>
                    </div>
                    <div class="donation-progress-bar">
                        <div class="donation-progress-fill" style="width: ${R}%"></div>
                    </div>
                </div>
            `}const at=`
            <div class="detail-header">
                ${E}
                <h1 class="detail-title">${y(t.title)}</h1>
                <div class="detail-meta">
                    Publicado por <strong>${i}</strong> ${e}
                    <span class="detail-date">el ${new Date(t.created_at).toLocaleDateString()}</span>
                    ${n.html}
                </div>
            </div>

            <div class="share-button-container">
                ${p||""}
                ${r}
            </div>

            ${M}

            <hr>

            <div class="detail-description">
                ${A(D(h))}
            </div>

            ${_}

            <hr>
            
            <div class="detail-actions-section">
                ${u||""}
                ${m}
                ${c}
            </div>

            ${V(t)}
        `;l.content.innerHTML=at}function j(t){const a="[[INSTRUCTIONS_STEPS]]",s="[[/INSTRUCTIONS_STEPS]]";if(!t||!t.includes(a))return{mainText:t||"",steps:[]};const e=t.indexOf(a),o=t.indexOf(s);if(o===-1)return{mainText:t||"",steps:[]};const i=t.slice(0,e).trim(),n=t.slice(e+a.length,o).split(`
`).map(r=>r.trim()).filter(r=>r.length>0);return{mainText:i,steps:n}}function F(t,a=null,s=null){return!t||t.length===0?"":`
            <div class="detail-steps">
                <h3 class="detail-steps-title">Sigue las instrucciones paso a paso sin saltar ninguno</h3>
                <ol class="detail-steps-flow">
                    ${t.map((o,i)=>{const n=i+1,r=String(n),d=a&&a[r]&&a[r].length>0;let m="";if(d){const c=a[r].map((p,u)=>{const h=typeof p=="string"?p:p?.label||`Campo ${u+1}`;return(typeof p=="object"&&p?.type==="textarea"?"textarea":"text")==="textarea"?`
                            <div class="step-form-field-user">
                                <label for="form-step-${n}-field-${u}">${y(h)}</label>
                                <textarea 
                                    id="form-step-${n}-field-${u}" 
                                    class="step-form-input step-form-textarea" 
                                    data-step="${n}" 
                                    data-field="${T(h)}"
                                    placeholder="Escribe tu respuesta detallada..." 
                                    maxlength="5000"
                                    rows="4"
                                    required></textarea>
                                <span class="step-form-char-count" data-for="form-step-${n}-field-${u}">0 / 5000</span>
                            </div>
                        `:`
                            <div class="step-form-field-user">
                                <label for="form-step-${n}-field-${u}">${y(h)}</label>
                                <input type="text" 
                                       id="form-step-${n}-field-${u}" 
                                       class="step-form-input" 
                                       data-step="${n}" 
                                       data-field="${T(h)}"
                                       placeholder="Escribe tu respuesta..." 
                                       maxlength="1000"
                                       required>
                            </div>
                        `}).join("");m=`
                    <div class="step-form-container" data-step="${n}">
                        <div class="step-form-header">
                            <span class="step-form-icon">📝</span>
                            <span class="step-form-label">Completa los siguientes datos:</span>
                        </div>
                        <div class="step-form-fields-user">
                            ${c}
                        </div>
                    </div>
                `}return`
                <li class="detail-step-item">
                    <div class="detail-step-node">
                        <span class="detail-step-index">${n}</span>
                    </div>
                    <div class="detail-step-content">
                        <div class="detail-step-badge">Paso ${n}</div>
                        <div class="detail-step-text">${A(o)}</div>
                        ${m}
                    </div>
                </li>
            `}).join("")}
                </ol>
            </div>
        `}function V(t){if(t.author_username!==f||!t.participants||t.participants.length===0)return"";const a=t.category==="donation";return`
            <div class="detail-participants-section">
                <h2>Participantes</h2>
                <ul class="participants-list">
                    ${t.participants.map(e=>{const o=k(e.average_rating,e.ratings_count),i=tt(e.status);let n="";const r=y(e.username),d=U.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(e.username)}" class="profile-link">${r}</a>`:r,m=e.accepted_at?`<span class="participant-accepted-at">Solicitó: ${z(e.accepted_at)}</span>`:"";if(e.status==="pending_approval")n=`
                    <button class="action-button approve" data-action="approve" data-user="${T(e.username)}">Aprobar</button>
                    <button class="action-button discard" data-action="discard" data-user="${T(e.username)}">Descartar</button>
                `;else if(e.status==="approved"){if(e.phone_number){const u=`https://wa.me/${e.phone_number.replace(/\D/g,"")}`;n+=`
                        <a href="${u}" target="_blank" class="action-button whatsapp-button" title="Contactar por WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                            Contactar
                        </a>
                    `}}else e.status==="completed"&&(n=`
                    <button class="action-button confirm" data-action="confirm-payment" data-user="${T(e.username)}">Confirmar Pago</button>
                `);let c="";e.form_responses&&Object.keys(e.form_responses).length>0&&(c=`
                    <div class="participant-form-responses">
                        <div class="form-responses-header">
                            <span class="form-responses-icon">📝</span>
                            <span class="form-responses-title">Respuestas del formulario:</span>
                        </div>
                        <div class="form-responses-content">
                            ${Object.entries(e.form_responses).map(([h,$])=>{const _=Object.entries($).map(([E,M])=>`
                        <div class="form-response-field">
                            <span class="form-response-label">${y(E)}:</span>
                            <span class="form-response-value">${y(M)}</span>
                        </div>
                    `).join("");return`
                        <div class="form-response-step">
                            <span class="form-response-step-badge">Paso ${h}</span>
                            ${_}
                        </div>
                    `}).join("")}
                        </div>
                    </div>
                `);const p=a&&e.blue_cost?`<span class="participant-donation-amount">+${w(e.blue_cost)} BLUE</span>`:"";return`
                <li class="participant-item ${e.form_responses?"has-responses":""}">
                    <div class="participant-info">
                        <strong>${d}</strong>
                        <span class="rating-display">${o}</span>
                        ${p}
                        ${m}
                    </div>
                    <div class="participant-status">
                        <span class="status-badge ${e.status}">${i}</span>
                        ${n}
                    </div>
                    ${c}
                </li>
            `}).join("")}
                </ul>
            </div>
        `}function z(t){const a=new Date(t),s={day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"};return a.toLocaleDateString("es-ES",s)}function G(t,a,s="BLUE"){const e=f,o=t.category==="donation";if(t.is_quick_sale){let c="",p="";if(a)return c='<div class="status-info">Esta Venta Rápida ha expirado.</div>',{messageHTML:c,actionHTML:p};const u=e===t.author_username,h=e===t.target_username,$=!t.target_username;if(u){const _=`${window.location.origin}/publication-detail.html?id=${t.id}`;p=`
                    <div class="qr-code-container">
                        <h2>Comparte este QR para recibir tu pago</h2>
                        <p>El enlace de pago es válido por 5 minutos desde su creación.</p>
                        <div id="qrCodeOutput_detail"></div>
                        <input type="text" id="qrCodeUrl_detail" value="${_}" readonly>
                        <button id="copyQrCodeUrl_detail" class="action-button">Copiar Enlace</button>
                    </div>
                `,setTimeout(()=>{typeof QRCode<"u"&&new QRCode(document.getElementById("qrCodeOutput_detail"),{text:_,width:200,height:200}),document.getElementById("copyQrCodeUrl_detail")?.addEventListener("click",()=>{document.getElementById("qrCodeUrl_detail").select(),document.execCommand("copy"),g("¡Enlace copiado al portapapeles!")})},100)}else h||$&&!u?(c=`<div class="action-message">Estás a punto de pagar <strong>${w(t.blue_cost)} ${s}</strong> a <strong>${y(t.author_username)}</strong>.</div>`,p='<button class="action-button confirm" data-action="pay-quick-sale">Pagar Ahora</button>'):c='<div class="status-info">No tienes permiso para ver o actuar en esta venta.</div>';return{messageHTML:c,actionHTML:p,acceptButtonHTML:"",duplicateCompleteButtonHTML:""}}const i=t.user_acceptance_status;let n="",r="",d="",m="";if(e===t.author_username){const c=t.participants.some($=>["approved","completed"].includes($.status)),p=t.participants.every($=>$.status==="confirmed_paid"),u=!c,h=!p&&!a;t.participants.length===0&&!a&&(n='<div class="status-pending">Aún no hay solicitudes para esta tarea.</div>'),h&&(r+=`<button class="action-button pause" data-action="toggle-pause">${t.is_paused?"Reanudar Solicitudes":"Pausar Solicitudes"}</button>`),r+=`<button class="action-button delete" data-action="delete" ${u?"":"disabled"}>Eliminar Tarea</button>`,u||(n+='<div class="status-info">No puedes eliminar una tarea con participantes activos.</div>')}else{if(a)return n='<div class="status-info">Esta tarea ha expirado y ya no acepta nuevos participantes.</div>',{messageHTML:n,actionHTML:r,acceptButtonHTML:d};if(o)d=`
                    <div class="donation-detail-flow">
                        <div class="donation-input-group">
                            <input type="number" step="any" placeholder="Monto a donar" class="donation-input" id="detail-don-input" min="1">
                            <button class="donation-btn detail-don-btn" data-action="direct-donation">Donar Ahora</button>
                        </div>
                    </div>
                `;else{const c=t.is_sell_post?"Comprar":"Aceptar Tarea",p=t.is_sell_post?"comprado":"realizado";switch(i){case"pending_approval":n='<div class="status-pending">Tu solicitud ha sido enviada. Esperando aprobación del autor.</div>';break;case"approved":{const u=t.is_sell_post?"He Recibido, Pagar":"He culminado";d=`
                            <div class="detail-primary-actions">
                                <span class="detail-primary-note">¡Has sido aprobado! Ahora puedes proceder a realizar la tarea.</span>
                                <button class="action-button complete" data-action="complete">${u}</button>
                            </div>
                        `,m=`<button class="action-button complete" data-action="complete">${u}</button>`;break}case"completed":n=`<p class="action-message status-pending">Has marcado la tarea como ${p}. Esperando confirmación final del autor.</p>`;break;case"confirmed_paid":t.available_slots>0&&(d=`<button class="action-button accept" data-action="accept">${c} de nuevo</button>`);break;case"not_participating":default:t.available_slots>0&&!t.is_paused?d=`<button class="action-button accept" data-action="accept">${c}</button>`:t.is_paused?n='<div class="status-pending">El autor ha pausado las nuevas solicitudes para esta tarea.</div>':n='<div class="status-accepted">Todos los cupos para esta tarea están llenos.</div>';break}}}return{messageHTML:n,actionHTML:r,acceptButtonHTML:d,duplicateCompleteButtonHTML:m}}function J(t){if(!t.expires_at)return{html:"",isExpired:!1};const a=new Date,e=new Date(t.expires_at)-a;if(e<=0)return{html:'<span class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</span>',isExpired:!0};const o=Math.floor(e/(1e3*60*60*24)),i=Math.floor(e%(1e3*60*60*24)/(1e3*60*60)),n=Math.floor(e%(1e3*60*60)/(1e3*60));let r="";return o>1?r=`Vence en ${o} días`:o===1?r=`Vence en ${o} día`:i>1?r=`Vence en ${i} horas`:i===1?r=`Vence en ${i} hora`:n>0?r=`Vence en ${n} min`:r="Vence en <1 min",{html:`<span class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${r}</span>`,isExpired:!1}}function Q(){const t={},a=document.querySelectorAll(".step-form-container"),s=5e3;return a.forEach(e=>{const o=e.getAttribute("data-step"),i=e.querySelectorAll(".step-form-input");i.length>0&&(t[o]={},i.forEach(n=>{const r=n.getAttribute("data-field"),d=n.value.trim();r&&d&&(t[o][r]=d.replace(/\0/g,"").substring(0,s))}),Object.keys(t[o]).length===0&&delete t[o])}),t}document.addEventListener("input",t=>{if(t.target.classList.contains("step-form-textarea")){const a=t.target,s=parseInt(a.getAttribute("maxlength"),10)||5e3,e=a.value.length,o=a.parentElement.querySelector(".step-form-char-count");o&&(o.textContent=`${e} / ${s}`,e>s*.9?o.style.color="#ff4444":e>s*.7?o.style.color="#ff9800":o.style.color="")}});function W(){l.content.addEventListener("click",K),l.ratingForm.addEventListener("submit",Z);const t=l.ratingModal.querySelector(".rating-close-button");t&&t.addEventListener("click",()=>l.ratingModal.style.display="none"),window.addEventListener("click",a=>{a.target==l.ratingModal&&(l.ratingModal.style.display="none")})}async function K(t){const a=t.target.closest("[data-action]");if(!a)return;const s=a.dataset.action,e=a.dataset.user;let o,i={},n="POST";switch(s){case"pay-quick-sale":L(`¿Confirmas el pago de ${document.querySelector(".detail-cost-badge").innerText} a ${document.querySelector(".detail-meta strong").innerText}?`,async()=>{o=`/api/quick-sale/${v}/pay`,i={buyerUsername:f},await b(o,"POST",i)});return;case"accept":o=`/publications/${v}/accept`,i={acceptorUsername:f};break;case"direct-donation":{const m=document.getElementById("detail-don-input"),c=parseFloat(m?.value);if(!c||c<=0||isNaN(c)){g("Indica un monto válido para donar.");return}const p=document.querySelector(".detail-meta strong").textContent.trim();L(`¿Deseas donar ${c} BLUE a ${p}?

Recuerda que esto generará deuda RED en tu cuenta.`,async()=>{await b(`/publications/${v}/accept`,"POST",{acceptorUsername:f,donationAmount:c})});return}case"approve":o=`/publications/${v}/approve`,i={approverUsername:f,userToApprove:e};break;case"complete":o=`/publications/${v}/complete`;const r=Q();i={completerUsername:f};const d=document.querySelectorAll(".step-form-input[required]");if(d.length>0){let m=!0;if(d.forEach(c=>{c.value.trim()?c.classList.remove("input-error"):(m=!1,c.classList.add("input-error"))}),!m){g("Por favor, completa todos los campos requeridos antes de marcar como culminada.");return}}r&&Object.keys(r).length>0&&(i.formResponses=r);break;case"confirm-payment":try{const m=document.querySelector(".detail-meta strong a")?.innerText||document.querySelector(".detail-meta strong")?.innerText;await Y(v,m,e)}catch(m){g("Error JS: "+m.message)}return;case"delete":L("¿Deseas eliminar esta tarea? Esta acción no se puede deshacer.",async()=>{await b(`/publications/${v}`,"DELETE",{deleterUsername:f}),window.location.href="contract_interaction.html"});return;case"discard":L(`¿Seguro que quieres descartar la solicitud de ${e}?`,async()=>{await b(`/publications/${v}/discard`,"POST",{discarderUsername:f,userToDiscard:e})});return;case"toggle-pause":o=`/publications/${v}/toggle-pause`,i={username:f};break;case"share":await X();return;default:return}await b(o,n,i)}async function X(){try{const t=document.getElementById("publication-content"),a=t.querySelector(".detail-title").textContent,s=t.querySelector(".detail-meta strong").textContent,e=window.location.href,o=`Hola!
Te comparto esta publicacion,te puede ser util

"${a}" por ${s}
Puedes ver los detalles aquí:
${e}`;navigator.share?(await navigator.share({title:`Tarea en WintonCoin: ${a}`,text:o,url:e}),g("¡Gracias por compartir!")):(await navigator.clipboard.writeText(o),g("¡Mensaje para compartir copiado al portapapeles!"))}catch(t){console.error("Error al compartir la publicación:",t),g(t.message||"Ocurrió un error al intentar compartir.")}}async function Y(t,a,s){try{console.log("DEBUG: Enviando confirm-payment al servidor...",{pubId:t,authorUsername:a,acceptorUsername:s});const e=await b(`/publications/${t}/confirm-payment`,"POST",{confirmerUsername:f,workerUsername:s});console.log("DEBUG: Respuesta confirm-payment:",e),e?et(t,a,s):console.log("DEBUG: result fue nulo, modal no abierto.")}catch(e){console.error("DEBUG: Error capturado en confirmPaymentAndRate:",e),g("Error inesperado: "+e.message)}}async function Z(t){t.preventDefault();const a=new FormData(t.target),s=Object.fromEntries(a.entries());try{await b("/rate","POST",s),l.ratingModal.style.display="none"}catch{}}async function b(t,a="POST",s=null){try{const e={"Content-Type":"application/json"};C&&(e.Authorization="Bearer "+C);const o={method:a,headers:e};s&&(o.body=JSON.stringify(s));const i=await fetch(`${x}${t}`,o),n=await i.text();let r;try{r=JSON.parse(n)}catch{throw console.error("Respuesta no-JSON del servidor:",n),g(n||"Error inesperado del servidor."),new Error("Respuesta no-JSON del servidor")}if(!i.ok)throw g(r.message||`Error en el servidor: ${i.status}`),new Error(r.message);return r.message&&g(r.message),B(),r}catch(e){return console.error(`Error en fetchFromServer (${t}):`,e),null}}function w(t){const s=(Number(t)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),e=s.split(",");return e.length===2?`${e[0]},<span class="decimal-part">${e[1]}</span>`:s}function tt(t){return{open:"Abierta",pending_approval:"Pendiente",approved:"Aprobado",completed:"Culminado",confirmed_paid:"Pagado"}[t]||t}function k(t,a){if(a===0)return'<span class="no-rating">Sin calificaciones</span>';const s="★".repeat(Math.round(t))+"☆".repeat(5-Math.round(t));return`<span class="stars" title="${parseFloat(t).toFixed(1)} de 5">${s}</span> <span class="rating-count">(${a})</span>`}function et(t,a,s){l.ratingForm.reset(),l.ratingPublicationId.value=t,l.ratingRaterUsername.value=a,l.ratingRateeUsername.value=s,l.ratingModalTitle.textContent=`Calificar a ${s}`,l.ratingModal.style.display="flex"}});
//# sourceMappingURL=publicationDetail.BWd65ADs.js.map
