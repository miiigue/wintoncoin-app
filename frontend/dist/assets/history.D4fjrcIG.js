import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import{l as f}from"./index.Dk_Cx65J.js";import{showCustomAlert as d}from"./alerts.CawRDXDp.js";import{g as C}from"./config.Br4uoD7s.js";import"./auth.PfzP10z-.js";function $(){const l=C(),c=localStorage.getItem("username"),p=new Map,r={historyUsername:document.getElementById("historyUsername"),authoredList:document.getElementById("authored-publications-list"),completedList:document.getElementById("completed-publications-list")};if(!c){d("Debes iniciar sesión para ver tu historial.",()=>{window.location.href="index.html"});return}r.historyUsername.textContent=`Historial para ${c}`,u();async function u(){try{const t=localStorage.getItem("token"),e=t?{Authorization:`Bearer ${t}`}:{},a=await fetch(`${l}/api/me/history`,{headers:e});if(!a.ok)throw new Error("No se pudo cargar el historial.");const s=await a.json();v(s.authored),L(s.completed)}catch(t){console.error("Error al cargar el historial:",t),r.authoredList.innerHTML='<p class="error-message">Error al cargar tus publicaciones.</p>',r.completedList.innerHTML='<p class="error-message">Error al cargar tus tareas completadas.</p>'}}function v(t){if(r.authoredList.innerHTML="",t.length===0){r.authoredList.innerHTML="<p>No has creado ninguna publicación todavía.</p>";return}t.forEach(e=>{p.set(String(e.id),e);const a=document.createElement("div");a.className="publication-item history-item",a.innerHTML=_(e),r.authoredList.appendChild(a),y(e.id)})}async function y(t){try{const a=await(await fetch(`${l}/publications/${t}/participants`)).json(),s=document.querySelector(`.participants-list[data-pub-id="${t}"]`);if(!s)return;if(a.length===0){s.innerHTML='<li class="no-participants">Aún no hay participantes para esta tarea.</li>';return}s.innerHTML=a.map(n=>T(t,n)).join("")}catch(e){console.error(`Error cargando participantes para la pub ${t}:`,e)}}function L(t){if(r.completedList.innerHTML="",t.length===0){r.completedList.innerHTML="<p>No has completado ninguna tarea todavía.</p>";return}t.forEach(e=>{const a=document.createElement("div");a.className="publication-item history-item",a.innerHTML=w(e),r.completedList.appendChild(a)})}function _(t){const e=g(t,{view:"authored"});return`
            <h3>${t.title}</h3>
            <div class="history-badges">${e}</div>
            <p class="pub-description">${f(t.description)}</p>
            <div class="participants-section">
                <h4>Participantes</h4>
                <ul class="participants-list" data-pub-id="${t.id}"><li class="loading-participants">Cargando...</li></ul>
            </div>
        `}function T(t,e){const a=H(e.average_rating,e.ratings_count),s=m(e.status);let n="";const o=p.get(String(t)),P=!!o?.is_deleted,S=E(o,e),k=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${e.acceptor_username}" class="profile-link">${e.acceptor_username}</a>`:e.acceptor_username;return P||(e.status==="pending_approval"?n=`<button class="action-button approve" data-pub-id="${t}" data-user-to-approve="${e.acceptor_username}">Aprobar</button>`:e.status==="completed"&&(n=`<button class="action-button confirm" data-pub-id="${t}" data-worker-username="${e.acceptor_username}">Confirmar Pago</button>`)),`
            <li class="participant-item">
                <div class="participant-info">
                    <strong>${k}</strong>
                    <span class="rating-display">${a}</span>
                </div>
                <div class="participant-status">
                    <span class="status-badge ${e.status}">${s}</span>
                    ${n}
                </div>
                ${S}
            </li>
        `}function w(t){const e=m(t.user_acceptance_status),a=g(t,{view:"completed"}),s=A(t),n=M(t.form_responses),o=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${t.author_username}" class="profile-link">${t.author_username}</a>`:t.author_username;return`
            <div class="publication-details">
                <h3>${t.title}</h3>
                <div class="history-badges">${a}</div>
                <p class="pub-description">${f(t.description)}</p>
                ${n}
                <ul class="pub-meta-list">
                    <li>Autor: <strong>${o}</strong></li>
                    <li>Costo: <strong>${b(t.blue_cost)} BLUE</strong></li>
                    <li>Estado: <span class="status-badge ${t.user_acceptance_status}">${e}</span></li>
                </ul>
                ${s}
            </div>
        `}function b(t){const a=(Number(t)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),s=a.split(",");return s.length===2?`${s[0]},<span class="decimal-part">${s[1]}</span>`:a}function m(t){return{open:"Abierta",pending_approval:"Pendiente de Aprobación",approved:"Aprobada",completed:"Culminada",confirmed_paid:"Finalizada y Pagada"}[t]||t}function M(t){if(!t||Object.keys(t).length===0)return"";const e=Object.entries(t).flatMap(([,a])=>Object.entries(a||{})).map(([a,s])=>`
                <div class="history-form-item">
                    <span class="history-form-label">${i(a)}:</span>
                    <span class="history-form-value">${i(s)}</span>
                </div>
            `).join("");return e?`
            <div class="history-form-responses">
                <h4>Tus respuestas</h4>
                <div class="history-form-grid">
                    ${e}
                </div>
            </div>
        `:""}function g(t,{view:e}){const a=[];t.is_deleted||t.deleted_at;const s=!!t.is_expired||t.expires_at&&new Date(t.expires_at)<new Date,n=!!t.is_completed_publication,o=!!t.is_paused;return s?a.push('<span class="status-badge expired">EXPIRADA</span>'):n?a.push('<span class="status-badge completed">COMPLETADA</span>'):o?a.push('<span class="status-badge pausada">PAUSADA</span>'):a.push('<span class="status-badge active">ACTIVA</span>'),a.join(" ")}function i(t){return String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function E(t,e){if(!t||t.category!=="request"||e.status!=="confirmed_paid")return"";const a=i(t.author_username||"");return`<div class="payment-direction"><small>Pago aplicado: BLUE → ${i(e.acceptor_username||"")} | RED → ${a}</small></div>`}function A(t){if(!t||t.category!=="request"||t.user_acceptance_status!=="confirmed_paid")return"";const e=i(t.author_username||"");return`<div class="payment-direction"><small>Pago aplicado: BLUE → ${i(c||"")} | RED → ${e}</small></div>`}function H(t,e){if(e===0)return'<span class="no-rating">Sin calif.</span>';const a="★".repeat(Math.round(t))+"☆".repeat(5-Math.round(t));return`<span class="stars" title="${parseFloat(t).toFixed(1)} de 5">${a}</span> <span class="rating-count">(${e})</span>`}r.authoredList.addEventListener("click",async t=>{const e=t.target,a=e.dataset.pubId;if(e.classList.contains("approve")){const s=e.dataset.userToApprove;await h(`/publications/${a}/approve`,{approverUsername:c,userToApprove:s})}if(e.classList.contains("confirm")){const s=e.dataset.workerUsername;await h(`/publications/${a}/confirm-payment`,{confirmerUsername:c,workerUsername:s})}});async function h(t,e){try{const a=localStorage.getItem("token"),s={"Content-Type":"application/json"};a&&(s.Authorization=`Bearer ${a}`);const n=await fetch(`${l}${t}`,{method:"POST",headers:s,body:JSON.stringify(e)}),o=await n.json();d(o.message),n.ok&&u()}catch(a){console.error("Error en postToServer:",a),d("Error de red al realizar la acción.")}}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",$):$();
//# sourceMappingURL=history.D4fjrcIG.js.map
