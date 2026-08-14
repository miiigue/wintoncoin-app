import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import{l as u}from"./index.pbqrtUCb.js";import{s as g,g as U}from"./auth.BgcrufBo.js";function v(){const d=U(),c=localStorage.getItem("username"),m=new Map,o={historyUsername:document.getElementById("historyUsername"),authoredList:document.getElementById("authored-publications-list"),completedList:document.getElementById("completed-publications-list")};if(!c){g("Debes iniciar sesión para ver tu historial.",()=>{window.location.href="index.html"});return}o.historyUsername.textContent=`Historial para ${c}`,k(),f();async function f(){try{const e=localStorage.getItem("token"),t=e?{Authorization:`Bearer ${e}`}:{},a=await fetch(`${d}/api/me/history`,{headers:t});if(!a.ok)throw new Error("No se pudo cargar el historial.");const s=await a.json();$(s.authored),_(s.completed),S(s.donations||[])}catch(e){console.error("Error al cargar el historial:",e),o.authoredList.innerHTML='<p class="error-message">Error al cargar tus publicaciones.</p>',o.completedList.innerHTML='<p class="error-message">Error al cargar tus tareas completadas.</p>';const t=document.getElementById("donations-list");t&&(t.innerHTML='<p class="error-message">Error al cargar tus donaciones.</p>')}}function $(e){if(o.authoredList.innerHTML="",e.length===0){o.authoredList.innerHTML="<p>No has creado ninguna publicación todavía.</p>";return}e.forEach(t=>{t.is_humanitarian||m.set(String(t.id),t);const a=document.createElement("div");a.className="publication-item history-item",a.innerHTML=E(t),o.authoredList.appendChild(a),t.is_humanitarian||L(t.id)})}async function L(e){try{const a=await(await fetch(`${d}/publications/${e}/participants`)).json(),s=document.querySelector(`.participants-list[data-pub-id="${e}"]`);if(!s)return;if(a.length===0){s.innerHTML='<li class="no-participants">Aún no hay participantes para esta tarea.</li>';return}s.innerHTML=a.map(n=>T(e,n)).join("")}catch(t){console.error(`Error cargando participantes para la pub ${e}:`,t)}}function _(e){if(o.completedList.innerHTML="",e.length===0){o.completedList.innerHTML="<p>No has completado ninguna tarea todavía.</p>";return}e.forEach(t=>{const a=document.createElement("div");a.className="publication-item history-item",a.innerHTML=x(t),o.completedList.appendChild(a)})}function E(e){const t=b(e,{view:"authored"});return e.is_humanitarian?`
                <h3><a href="causa-solidaria.html?id=${e.id}" class="profile-link" style="color: #a5b4fc; text-decoration: underline; font-weight: bold;">${i(e.title)}</a></h3>
                <div class="history-badges">${t}</div>
                <p class="pub-description">${u(e.description||"")}</p>
                <div class="humanitarian-progress-summary" style="margin-top: 12px; font-size: 0.85em; padding: 10px; border-radius: 8px; background: rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 4px; border: 1px solid rgba(255,255,255,0.08);">
                    <div style="display:flex; justify-content:space-between;">
                        <span>Meta de Recaudación:</span>
                        <strong>${l(e.blue_cost)} BLUE IOU</strong>
                    </div>
                    <div style="display:flex; justify-content:space-between;">
                        <span>Recaudado Disponible:</span>
                        <strong style="color: #e83e8c;">${l(e.current_amount||0)} BLUE IOU</strong>
                    </div>
                </div>
            `:`
            <h3>${e.title}</h3>
            <div class="history-badges">${t}</div>
            <p class="pub-description">${u(e.description)}</p>
            <div class="participants-section">
                <h4>Participantes</h4>
                <ul class="participants-list" data-pub-id="${e.id}"><li class="loading-participants">Cargando...</li></ul>
            </div>
        `}function T(e,t){const a=C(t.average_rating,t.ratings_count),s=h(t.status);let n="";const r=m.get(String(e)),p=!!r?.is_deleted,D=M(r,t),P=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${t.acceptor_username}" class="profile-link">${t.acceptor_username}</a>`:t.acceptor_username;return p||(t.status==="pending_approval"?n=`<button class="action-button approve" data-pub-id="${e}" data-user-to-approve="${t.acceptor_username}">Aprobar</button>`:t.status==="completed"&&(n=`<button class="action-button confirm" data-pub-id="${e}" data-worker-username="${t.acceptor_username}">Confirmar Pago</button>`)),`
            <li class="participant-item">
                <div class="participant-info">
                    <strong>${P}</strong>
                    <span class="rating-display">${a}</span>
                </div>
                <div class="participant-status">
                    <span class="status-badge ${t.status}">${s}</span>
                    ${n}
                </div>
                ${D}
            </li>
        `}function x(e){const t=h(e.user_acceptance_status),a=b(e,{view:"completed"}),s=w(e),n=A(e.form_responses),r=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${e.author_username}" class="profile-link">${e.author_username}</a>`:e.author_username;return`
            <div class="publication-details">
                <h3>${e.title}</h3>
                <div class="history-badges">${a}</div>
                <p class="pub-description">${u(e.description)}</p>
                ${n}
                <ul class="pub-meta-list">
                    <li>Autor: <strong>${r}</strong></li>
                    <li>Costo: <strong>${l(e.blue_cost)} BLUE</strong></li>
                    <li>Estado: <span class="status-badge ${e.user_acceptance_status}">${t}</span></li>
                </ul>
                ${s}
            </div>
        `}function l(e){const a=(Number(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),s=a.split(",");return s.length===2?`${s[0]},<span class="decimal-part">${s[1]}</span>`:a}function h(e){return{open:"Abierta",pending_approval:"Pendiente de Aprobación",approved:"Aprobada",completed:"Culminada",confirmed_paid:"Finalizada y Pagada"}[e]||e}function A(e){if(!e||Object.keys(e).length===0)return"";const t=Object.entries(e).flatMap(([,a])=>Object.entries(a||{})).map(([a,s])=>`
                <div class="history-form-item">
                    <span class="history-form-label">${i(a)}:</span>
                    <span class="history-form-value">${i(s)}</span>
                </div>
            `).join("");return t?`
            <div class="history-form-responses">
                <h4>Tus respuestas</h4>
                <div class="history-form-grid">
                    ${t}
                </div>
            </div>
        `:""}function b(e,{view:t}){const a=[];if(e.is_humanitarian){const p={pending:'<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24;">PENDIENTE</span>',approved:'<span class="status-badge active" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399;">ACTIVA</span>',rejected:'<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">RECHAZADA</span>',completed:'<span class="status-badge completed" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa;">CULMINADA</span>'};return a.push(p[e.status]||`<span class="status-badge">${e.status.toUpperCase()}</span>`),a.join(" ")}e.is_deleted||e.deleted_at;const s=!!e.is_expired||e.expires_at&&new Date(e.expires_at)<new Date,n=!!e.is_completed_publication,r=!!e.is_paused;return s?a.push('<span class="status-badge expired">EXPIRADA</span>'):n?a.push('<span class="status-badge completed">COMPLETADA</span>'):r?a.push('<span class="status-badge pausada">PAUSADA</span>'):a.push('<span class="status-badge active">ACTIVA</span>'),a.join(" ")}function i(e){return String(e||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function M(e,t){if(!e||e.category!=="request"||t.status!=="confirmed_paid")return"";const a=i(e.author_username||"");return`<div class="payment-direction"><small>Pago aplicado: BLUE → ${i(t.acceptor_username||"")} | RED → ${a}</small></div>`}function w(e){if(!e||e.category!=="request"||e.user_acceptance_status!=="confirmed_paid")return"";const t=i(e.author_username||"");return`<div class="payment-direction"><small>Pago aplicado: BLUE → ${i(c||"")} | RED → ${t}</small></div>`}function C(e,t){if(t===0)return'<span class="no-rating">Sin calif.</span>';const a="★".repeat(Math.round(e))+"☆".repeat(5-Math.round(e));return`<span class="stars" title="${parseFloat(e).toFixed(1)} de 5">${a}</span> <span class="rating-count">(${t})</span>`}o.authoredList.addEventListener("click",async e=>{const t=e.target,a=t.dataset.pubId;if(t.classList.contains("approve")){const s=t.dataset.userToApprove;await y(`/publications/${a}/approve`,{approverUsername:c,userToApprove:s})}if(t.classList.contains("confirm")){const s=t.dataset.workerUsername;await y(`/publications/${a}/confirm-payment`,{confirmerUsername:c,workerUsername:s})}});async function y(e,t){try{const a=localStorage.getItem("token"),s={"Content-Type":"application/json"};a&&(s.Authorization=`Bearer ${a}`);const n=await fetch(`${d}${e}`,{method:"POST",headers:s,body:JSON.stringify(t)}),r=await n.json();g(r.message),n.ok&&f()}catch{g("Error de red al realizar la acción.")}}function k(){const e=document.querySelectorAll(".tab-button"),t=document.querySelectorAll(".tab-content"),a=document.querySelector(".history-tabs");a&&a.addEventListener("wheel",s=>{if(s.deltaY===0)return;s.preventDefault();let n=0;s.deltaMode===1?n=s.deltaY*33:s.deltaMode===2?n=s.deltaY*a.clientWidth:n=s.deltaY,a.scrollLeft+=n},{passive:!1}),e.forEach(s=>{s.addEventListener("click",()=>{const n=s.dataset.tab;e.forEach(r=>r.classList.remove("active")),s.classList.add("active"),t.forEach(r=>{r.classList.remove("active"),r.id===`tab-${n}`?(r.style.display="block",setTimeout(()=>{r.classList.add("active")},20)):r.style.display="none"})})}),t.forEach(s=>{s.classList.contains("active")?s.style.display="block":s.style.display="none"})}function S(e){const t=document.getElementById("donations-list");if(t){if(t.innerHTML="",e.length===0){t.innerHTML="<p>No has realizado ninguna donación todavía.</p>";return}e.forEach(a=>{const s=document.createElement("div");s.className="publication-item history-item",s.innerHTML=H(a),t.appendChild(s)})}}function H(e){let t="";e.donation_status==="on_hold"?t='<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #fbbf24;">EN ESPERA POR KYC</span>':e.donation_status==="released"?t='<span class="status-badge active" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #34d399;">ACREDITADA</span>':e.donation_status==="refunded"?t='<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171;">REEMBOLSADA</span>':t=`<span class="status-badge">${e.donation_status.toUpperCase()}</span>`;let a="";const s=String(e.cause_status).toLowerCase();s==="pending"?a='<span class="status-badge pending" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); color: rgba(251, 191, 36, 0.8); font-size: 0.75em;">Causa Pendiente</span>':s==="approved"?a='<span class="status-badge active" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: rgba(52, 211, 153, 0.8); font-size: 0.75em;">Causa Activa</span>':s==="completed"?a='<span class="status-badge completed" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); color: rgba(96, 165, 250, 0.8); font-size: 0.75em;">Causa Culminada</span>':s==="rejected"&&(a='<span class="status-badge rejected" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: rgba(248, 113, 113, 0.8); font-size: 0.75em;">Causa Rechazada</span>');const n=new Date(e.donation_created_at),r=n.toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric"})+" a las "+n.toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})+" hs";return`
            <h3><a href="causa-solidaria.html?id=${e.cause_id}" class="profile-link" style="color: #a5b4fc; text-decoration: underline; font-weight: bold;">${i(e.cause_title)}</a></h3>
            <div class="history-badges" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-bottom:8px;">
                ${t}
                ${a}
            </div>
            <ul class="pub-meta-list" style="margin-top:12px; font-size:0.85em; color:rgba(255,255,255,0.7); display:flex; flex-direction:column; gap:4px;">
                <li>Monto Donado: <strong style="color:#e83e8c;">${l(e.amount)} BLUE IOU</strong></li>
                <li>Fecha de Donación: <strong>${r}</strong></li>
                <li>Creador de la Causa: <strong>@${i(e.creator_username)}</strong></li>
            </ul>
        `}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",v):v();
//# sourceMappingURL=history.CZt0sER-.js.map
