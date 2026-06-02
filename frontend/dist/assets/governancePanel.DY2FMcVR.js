import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                    */import"./index.Dk_Cx65J.js";import{showCustomAlert as u,showCustomConfirm as z,initializeAlertListeners as Se}from"./alerts.CawRDXDp.js";import{g as de}from"./config.Br4uoD7s.js";import"./auth.PfzP10z-.js";window.getApiUrl=de;window.showCustomAlert=u;window.showCustomConfirm=z;document.addEventListener("DOMContentLoaded",async()=>{Se();const ce=de(),Q=localStorage.getItem("token"),V=new URLSearchParams(window.location.search),S=V.get("focus")==="vote"&&!!V.get("id");function F(){const e=window.location.pathname.split("/").pop()+window.location.search;window.location.href=`login.html?returnTo=${encodeURIComponent(e)}`}if(!Q){F();return}function s(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function y(e,t={}){const o={"Content-Type":"application/json",Authorization:`Bearer ${Q}`,...t.headers||{}};delete t.headers;const a=await fetch(`${ce}${e}`,{headers:o,...t});if(a.status===401)throw u("Sesión expirada. Inicia sesión nuevamente."),F(),new Error("Sesión expirada");const c=await a.json();if(!a.ok)throw new Error(c.error||c.message||`Error ${a.status}`);return c}function C(e){return e?new Date(e).toLocaleString("es-ES",{timeZone:"America/Bogota",dateStyle:"medium",timeStyle:"short"}):"—"}function X(e,t){if(!e)return"—";try{const o=typeof e=="string"?JSON.parse(e):e;if(typeof o!="object"||o===null)return s(String(e));if(t==="membership_change"&&o.action){const a={add:"Agregar",remove:"Remover",update:"Actualizar"},c={supervisor:"Supervisor",auxiliary:"Auxiliar"},n=a[o.action]||o.action,l=c[o.role]||"",i=o.userId?`usuario #${o.userId}`:"";return o.action==="remove"?s(`${n} ${i}`):s(`${n} ${i} como ${l}`).trim()}return s(t==="config_change"?String(e):JSON.stringify(o))}catch{return s(String(e))}}const ue={allow_new_registrations:"Permitir Nuevos Registros",allow_new_publications:"Permitir Nuevas Publicaciones",public_profiles_enabled:"Perfiles Públicos",debt_system_enabled:"Sistema de Deuda (Tokens RED)",debt_cycle_days:"Ciclo de Deuda RED — Días",debt_cycle_hours:"Ciclo de Deuda RED — Horas",debt_cycle_minutes:"Ciclo de Deuda RED — Minutos",blue_escrow_days:"Depósito BLUE (Escrow) — Días",blue_escrow_hours:"Depósito BLUE (Escrow) — Horas",blue_escrow_minutes:"Depósito BLUE (Escrow) — Minutos",platform_commission_percentage:"Comisión de Plataforma (%)",booster_system_enabled:"Sistema de Impulsores",referral_system_enabled:"Sistema de Referidos",referral_reward_amount:"Recompensa por Referido (BLUE)",referral_reward_after_expiry:"Recompensa después de la Promo (BLUE)",referral_codes_expiry_date:"Vigencia de Códigos de Referido",welcome_bonus_enabled:"Bono de Bienvenida",welcome_bonus_amount:"Monto del Bono de Bienvenida (BLUE)",pre_launch_mode_enabled:"Modo Pre-Lanzamiento",allow_request_publications:'Permitir Publicaciones de "Solicitud"',allow_sell_publications:'Permitir Publicaciones de "Venta"',allow_donation_publications:'Permitir Publicaciones de "Donación"',allow_quick_sale_publications:'Permitir Publicaciones de "Venta Rápida"',p2p_enabled:"P2P — Habilitado",p2p_price_min:"P2P — Precio Mínimo (USD)",p2p_price_max:"P2P — Precio Máximo (USD)",p2p_fee_percentage:"P2P — Comisión (%)",p2p_payment_window_minutes:"P2P — Ventana de Pago (min)",p2p_extension_minutes:"P2P — Extensión (min)",p2p_extension_limit:"P2P — Límite de Extensiones",p2p_cash_min_rating:"P2P — Reputación Mínima para Efectivo"};function pe(e){return ue[e]||e}function k(e){return{pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada",executed:"Ejecutada",expired:"Expirada",cancelled:"Cancelada"}[e]||e}function ee(e){return e==="config_change"?"Configuración":e==="membership_change"?"Membresía":e}const te=document.querySelectorAll(".nav-link[data-section]"),ge=document.querySelectorAll(".admin-section");function R(){document.body.classList.remove("gov-mobile-nav-open");const e=document.getElementById("govMobileMenuBtn");e&&e.setAttribute("aria-expanded","false")}function me(){const e=document.body.classList.toggle("gov-mobile-nav-open"),t=document.getElementById("govMobileMenuBtn");t&&t.setAttribute("aria-expanded",e?"true":"false")}function q(e){ge.forEach(a=>a.classList.remove("active-section")),te.forEach(a=>a.classList.remove("active"));const t=document.getElementById(`${e}-section`),o=document.querySelector(`.nav-link[data-section="${e}"]`);t&&t.classList.add("active-section"),o&&o.classList.add("active"),e==="status"?ye():e==="council"?be():e==="requests"&&T(),R()}te.forEach(e=>{e.addEventListener("click",t=>{const o=e.getAttribute("data-section");if(o){if(t.preventDefault(),S){R(),u("Estás en modo votación. Solo puedes ver y votar la solicitud asignada.");return}q(o)}})});let g=null;async function ve(){try{const e=await y("/api/governance/me");return e.isGuardian?(g=e.guardian,!0):(document.querySelector(".admin-grid-container").innerHTML=`
                    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: var(--admin-bg);">
                        <div style="text-align: center; max-width: 400px; padding: 40px;">
                            <p style="font-size: 2rem; margin-bottom: 16px;">🚫</p>
                            <h2 style="color: var(--admin-text); margin-bottom: 12px;">Acceso Denegado</h2>
                            <p style="color: var(--admin-text-secondary); line-height: 1.6; margin-bottom: 24px;">
                                Tu cuenta no tiene permisos de guardián en el sistema Winton-Consensus.
                                Solo los guardianes activos pueden acceder a este panel.
                            </p>
                            <button onclick="history.back()" style="padding: 10px 24px; border-radius: 8px; background: var(--admin-primary); color: white; border: none; cursor: pointer; font-size: 0.95rem;">Volver</button>
                        </div>
                    </div>`,!1)}catch(e){return document.querySelector(".admin-grid-container").innerHTML=`
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; width: 100vw; background: var(--admin-bg);">
                    <div style="text-align: center; max-width: 400px; padding: 40px;">
                        <p style="font-size: 2rem; margin-bottom: 16px;">⚠️</p>
                        <h2 style="color: var(--admin-text); margin-bottom: 12px;">Error de Acceso</h2>
                        <p style="color: #EF4444; margin-bottom: 24px;">${s(e.message)}</p>
                        <button id="govErrorLoginBtn" style="padding: 10px 24px; border-radius: 8px; background: var(--admin-primary); color: white; border: none; cursor: pointer; font-size: 0.95rem;">Iniciar Sesión</button>
                    </div>
                </div>`,document.getElementById("govErrorLoginBtn")?.addEventListener("click",F),!1}}if(!await ve())return;function G(e){const t=document.querySelector(".admin-grid-container");if(t){if(S){t.classList.add("gov-vote-focus");return}t.classList.toggle("gov-vote-focus",!!e)}}if(S){document.querySelector(".admin-grid-container")?.classList.add("gov-vote-focus");const e=document.getElementById("requests-section"),t=e?.querySelector("h1"),o=e?.querySelector(":scope > p");t&&!t.dataset.defaultSaved&&(t.dataset.defaultSaved="1",t.dataset.defaultText=t.textContent,t.textContent="Tu voto es requerido"),o&&!o.dataset.defaultSaved&&(o.dataset.defaultSaved="1",o.dataset.defaultText=o.textContent,o.textContent="Revisa los detalles de la solicitud y confirma tu decisión."),document.querySelector("#requests-section .gov-tabs")?.style.setProperty("display","none"),document.getElementById("requests-list-container")?.style.setProperty("display","none")}const ne=V.get("id");ne?(q("requests"),setTimeout(()=>D(parseInt(ne,10)),400)):q("status"),document.getElementById("govLogoutBtn")?.addEventListener("click",e=>{e.preventDefault(),R(),localStorage.removeItem("token"),window.location.href="login.html"}),document.getElementById("govMobileMenuBtn")?.addEventListener("click",()=>me()),document.getElementById("govMobileBackdrop")?.addEventListener("click",()=>R());async function ye(){const e=document.getElementById("guardian-status-container");e.innerHTML='<div class="loading-spinner"></div>';try{const t=await y("/api/governance/me");if(!t.isGuardian){e.innerHTML=`
                    <div class="gov-empty-state">
                        <p style="font-size: 1.5rem;">🚫</p>
                        <p><strong>No eres guardián</strong></p>
                        <p>Tu cuenta no tiene rol de guardián en el sistema Winton-Consensus.</p>
                    </div>`;return}g=t.guardian,e.innerHTML=`
                <div class="gov-card">
                    <h3>Información del Guardián</h3>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Usuario</span>
                        <span class="gov-info-value">${s(g.username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Rol</span>
                        <span class="gov-info-value" style="text-transform: capitalize;">${s(g.role)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Estado</span>
                        <span class="gov-status-badge ${g.status}">${k(g.status)}</span>
                    </div>
                </div>

                <div class="gov-card">
                    <h3>Seguridad</h3>
                    <div class="gov-webauthn-status registered">
                        <span style="font-size: 1.5rem;">🔒</span>
                        <div>
                            <strong>Votación protegida por JWT</strong>
                            <p style="margin: 4px 0 0; font-size: 0.85rem; color: #9CA3AF;">
                                Tus votos se validan con tu sesión autenticada. La verificación biométrica estará disponible próximamente.
                            </p>
                        </div>
                    </div>
                </div>`}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}async function be(){const e=document.getElementById("council-container");e.innerHTML='<div class="loading-spinner"></div>';try{const o=(await y("/api/governance/guardians")).guardians||[];if(o.length===0){e.innerHTML=`
                    <div class="gov-empty-state">
                        <p style="font-size: 1.5rem;">👥</p>
                        <p><strong>Sin guardianes registrados</strong></p>
                    </div>`;return}const a=o.filter(r=>r.status==="active"),c=a.filter(r=>r.role==="supervisor"),n=a.filter(r=>r.role==="auxiliary"),l={supervisor:"Supervisor",auxiliary:"Auxiliar"},i={active:"Activo",inactive:"Inactivo"},m=o.map(r=>{const h=Number(r.vote_count)||0,w=Number(r.proposal_count)||0;return`
                <tr>
                    <td style="font-family: monospace; color: #9CA3AF;">${Number(r.user_id)||"—"}</td>
                    <td>${s(r.username)}</td>
                    <td><span class="gov-role-tag ${s(r.role)}">${l[r.role]||s(r.role)}</span></td>
                    <td><span class="gov-status-badge ${s(r.status)}">${i[r.status]||s(r.status)}</span></td>
                    <td style="text-align: center; font-weight: 600;">${h}</td>
                    <td style="text-align: center; color: #9CA3AF;">${w}</td>
                    <td>${C(r.created_at)}</td>
                </tr>`}).join("");e.innerHTML=`
                <div class="gov-council-summary">
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${a.length}</div>
                        <div class="gov-summary-label">Activos</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${c.length}</div>
                        <div class="gov-summary-label">Supervisores</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${n.length}</div>
                        <div class="gov-summary-label">Auxiliares</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${o.length}</div>
                        <div class="gov-summary-label">Total Registrados</div>
                    </div>
                </div>

                <div class="gov-card" style="padding: 0; overflow: hidden;">
                    <table class="gov-council-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th style="text-align: center;">Votos</th>
                                <th style="text-align: center;">Propuestas</th>
                                <th>Miembro desde</th>
                            </tr>
                        </thead>
                        <tbody>${m}</tbody>
                    </table>
                </div>`}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}let _="pending";document.querySelectorAll(".gov-tab[data-filter]").forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll(".gov-tab").forEach(t=>t.classList.remove("active")),e.classList.add("active"),_=e.getAttribute("data-filter"),document.getElementById("request-detail-container").style.display="none",document.getElementById("requests-list-container").style.display="",T()})});async function T(){const e=document.getElementById("requests-list-container");e.innerHTML='<div class="loading-spinner"></div>';try{const t=_!=="all"?`?status=${_}`:"?limit=50",o=await y(`/api/governance/requests${t}`);if(!o.requests||o.requests.length===0){e.innerHTML=`<div class="gov-empty-state"><p>No hay solicitudes ${_!=="all"?k(_).toLowerCase()+"s":""}.</p></div>`;return}e.innerHTML=o.requests.map(n=>`
                <div class="gov-request-card" data-request-id="${n.id}">
                    <div class="gov-request-header">
                        <span class="gov-request-id">#${n.id}</span>
                        <span class="gov-status-badge ${n.status}">${k(n.status)}</span>
                    </div>
                    <div class="gov-request-desc">${s(n.description)}</div>
                    <div class="gov-request-meta">
                        <span>${ee(n.action_type)}</span>
                        <span>Por: ${s(n.requester_username||"?")}</span>
                        <span>Expira: ${C(n.expires_at)}</span>
                        ${n.approve_count!==void 0?`<span>✅ ${n.approve_count} | ❌ ${n.reject_count}</span>`:""}
                    </div>
                </div>
            `).join(""),e.querySelectorAll(".gov-request-card").forEach(n=>{n.addEventListener("click",()=>{D(parseInt(n.getAttribute("data-request-id"),10))})});const a=o.requests.filter(n=>n.status==="pending").length,c=document.getElementById("pendingRequestsBadge");c&&(c.textContent=a>0?a:"")}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}async function D(e){const t=document.getElementById("request-detail-container"),o=document.getElementById("requests-list-container"),a=document.querySelector("#requests-section .gov-tabs");o&&(o.style.display="none"),a&&(a.style.display="none"),t.style.display="block",t.innerHTML='<div class="loading-spinner"></div>',document.getElementById("requests-section")?.scrollIntoView({behavior:"smooth",block:"start"});try{const n=(await y(`/api/governance/requests/${e}`)).request,l=n.quorum||{},i=g&&n.requester_id===g.userId,m=g?.userId,r=(n.votes||[]).some(d=>Number(d.guardian_user_id)===Number(m)),h=n.status==="pending"&&g&&g.status==="active"&&!i&&!r,w=n.status==="pending"&&i,I=n.status==="approved"&&g&&g.status==="active",Y=w||I,Z=(n.votes||[]).map(d=>`
                <li>
                    <span>${s(d.guardian_username)} <span style="color:#6B7280;">(${d.guardian_role})</span></span>
                    <span class="gov-status-badge ${d.vote==="approve"?"active":"rejected"}">${d.vote==="approve"?"Aprobó":"Rechazó"}</span>
                </li>
            `).join("")||'<li style="color:#6B7280;">Aún no hay votos.</li>',E=l.approved?.supervisor||0,$=l.totals?.supervisor||1,A=Math.round(E/$*100);t.innerHTML=`
                <div class="gov-card" style="border-color: var(--admin-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Solicitud #${n.id}</h3>
                        <span class="gov-status-badge ${n.status}">${k(n.status)}</span>
                    </div>

                    <div class="gov-info-row">
                        <span class="gov-info-label">Tipo</span>
                        <span class="gov-info-value">${ee(n.action_type)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Proponente</span>
                        <span class="gov-info-value">${s(n.requester_username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Descripción</span>
                        <span class="gov-info-value">${s(n.description)}</span>
                    </div>
                    ${n.target_key?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Configuración</span>
                        <span class="gov-info-value">${s(pe(n.target_key))}</span>
                    </div>`:""}
                    ${n.old_value?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Anterior</span>
                        <span class="gov-info-value">${X(n.old_value,n.action_type)}</span>
                    </div>`:""}
                    ${n.new_value?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Propuesto</span>
                        <span class="gov-info-value">${X(n.new_value,n.action_type)}</span>
                    </div>`:""}
                    <div class="gov-info-row">
                        <span class="gov-info-label">Creada</span>
                        <span class="gov-info-value">${C(n.created_at)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Expira</span>
                        <span class="gov-info-value">${C(n.expires_at)}</span>
                    </div>
                    ${n.execution_time?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Ejecución Programada</span>
                        <span class="gov-info-value">${C(n.execution_time)}</span>
                    </div>`:n.action_type==="membership_change"&&n.status==="pending"?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Time-Lock</span>
                        <span class="gov-info-value">Al aprobar el quórum, el sistema esperará las horas configuradas en el panel admin antes de ejecutar el cambio.</span>
                    </div>`:""}

                    <div class="gov-detail-section">
                        <h4>Quórum de Supervisores</h4>
                        <div class="gov-quorum-bar">
                            <div class="gov-quorum-fill" style="width: ${A}%; background: ${A>=67?"#059669":"#3B82F6"};"></div>
                        </div>
                        <p style="font-size: 0.8rem; color: #9CA3AF;">
                            ${E} de ${$} supervisores aprobaron (umbral: ${l.thresholds?.supervisor||l.supThreshold||"?"})
                        </p>
                    </div>

                    <div class="gov-detail-section">
                        <h4>Votos Registrados</h4>
                        <ul class="gov-vote-list">${Z}</ul>
                    </div>

                    ${r&&n.status==="pending"&&!i?`
                    <div class="gov-vote-done-notice">
                        <strong>Ya emitiste tu voto</strong> en esta solicitud. No puedes cambiarlo ni votar de nuevo (así evitamos dobles firmas y confusiones).
                    </div>`:""}

                    ${h?`
                    <div class="gov-vote-buttons">
                        <button type="button" class="gov-btn-approve" id="voteApproveBtn">✅ Aprobar</button>
                        <button type="button" class="gov-btn-reject" id="voteRejectBtn">❌ Rechazar</button>
                    </div>`:""}

                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        ${S?"":'<button type="button" id="backToListBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: transparent; border: 1px solid var(--admin-border); color: var(--admin-text-secondary); cursor: pointer; font-family: inherit; font-size: 0.9rem;">← Volver a la Lista</button>'}
                        ${w?'<button id="cancelRequestBtn" data-reason="withdraw" style="flex: 1; padding: 10px; border-radius: 8px; background: #D97706; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Retirar mi Solicitud</button>':""}
                        ${I?'<button id="cancelRequestBtn" data-reason="timelock" style="flex: 1; padding: 10px; border-radius: 8px; background: #6B7280; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Cancelar (Time-Lock)</button>':""}
                    </div>
                </div>`,document.getElementById("backToListBtn")?.addEventListener("click",()=>{G(!1),t.style.display="none",o&&(o.style.display=""),a&&(a.style.display="")}),document.getElementById("voteApproveBtn")?.addEventListener("click",()=>oe(n.id,"approve")),document.getElementById("voteRejectBtn")?.addEventListener("click",()=>oe(n.id,"reject")),document.getElementById("cancelRequestBtn")?.addEventListener("click",d=>{const p=d.currentTarget.getAttribute("data-reason");fe(n.id,p)}),G(h)}catch(c){G(!1),t.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(c.message)}</p></div>`}}async function oe(e,t){const a=`Usted está votando para ${t==="approve"?"APROBAR":"RECHAZAR"} la solicitud #${e}.

Esta acción no se puede deshacer. Una vez confirmada, no podrá cambiar su voto.

¿Está de acuerdo?`;z(a,async()=>{const c=document.getElementById("voteApproveBtn"),n=document.getElementById("voteRejectBtn"),l=i=>{[c,n].forEach(m=>{m&&(m.disabled=i,m.style.opacity=i?"0.5":"1")})};l(!0);try{const i=await y(`/api/governance/requests/${e}/vote`,{method:"POST",body:JSON.stringify({vote:t})});u(i.message||"Voto registrado exitosamente."),await D(e),S||T()}catch(i){l(!1),u(`Error al votar: ${i.message}`)}})}async function fe(e,t){const o=t==="withdraw"?`¿Confirmas que deseas RETIRAR tu solicitud #${e}? Podrás crear una nueva con los datos correctos.`:`¿Confirmas la CANCELACIÓN de la solicitud #${e} durante la ventana de Time-Lock? Esta acción no se puede deshacer.`;z(o,async()=>{try{const a=await y(`/api/governance/requests/${e}/cancel`,{method:"POST"});u(a.message||"Solicitud cancelada."),D(e),T()}catch(a){u(`Error: ${a.message}`)}})}const j=document.getElementById("govActionType"),ae=document.getElementById("configFields"),se=document.getElementById("membershipFields"),H=document.getElementById("govMemberAction"),he=document.getElementById("govMemberRoleGroup");let P=[],J=!1,v=-1;async function ie(){if(!J)try{P=(await y("/api/governance/settings-catalog")).settings||[],J=!0}catch(e){console.error("Error loading settings catalog:",e)}}const x=document.getElementById("govSettingSearch"),M=document.getElementById("govTargetKey"),N=document.getElementById("govOldValue"),b=document.getElementById("govSettingDropdown");function K(e){if(e.length===0){b.innerHTML='<div class="gov-autocomplete-item" style="color: #6B7280; cursor: default;">No se encontraron configuraciones.</div>',b.classList.add("visible");return}v=-1,b.innerHTML=e.map((t,o)=>`
            <div class="gov-autocomplete-item" data-index="${o}" data-key="${s(t.key)}" data-value="${s(t.currentValue)}" data-label="${s(t.label)}">
                <span class="item-label">${s(t.label)}</span>
                <span class="item-key">(${s(t.key)})</span>
                <span class="item-value">Actual: ${s(t.currentValue)}</span>
            </div>
        `).join(""),b.classList.add("visible"),b.querySelectorAll(".gov-autocomplete-item[data-key]").forEach(t=>{t.addEventListener("click",()=>re(t))})}function re(e){const t=e.getAttribute("data-key"),o=e.getAttribute("data-value"),a=e.getAttribute("data-label");M.value=t,x.value=`${a} (${t})`,N.value=o,b.classList.remove("visible"),document.getElementById("govNewValue").focus()}x?.addEventListener("focus",async()=>{await ie(),K(P)}),x?.addEventListener("input",()=>{const e=x.value.toLowerCase().trim();if(M.value="",N.value="",!e){K(P);return}const t=P.filter(o=>o.label.toLowerCase().includes(e)||o.key.toLowerCase().includes(e));K(t)}),x?.addEventListener("keydown",e=>{const t=b.querySelectorAll(".gov-autocomplete-item[data-key]");t.length&&(e.key==="ArrowDown"?(e.preventDefault(),v=Math.min(v+1,t.length-1),t.forEach((o,a)=>o.classList.toggle("highlighted",a===v)),t[v]?.scrollIntoView({block:"nearest"})):e.key==="ArrowUp"?(e.preventDefault(),v=Math.max(v-1,0),t.forEach((o,a)=>o.classList.toggle("highlighted",a===v)),t[v]?.scrollIntoView({block:"nearest"})):e.key==="Enter"&&v>=0?(e.preventDefault(),re(t[v])):e.key==="Escape"&&b.classList.remove("visible"))}),document.addEventListener("click",e=>{!e.target.closest("#govSettingSearch")&&!e.target.closest("#govSettingDropdown")&&b?.classList.remove("visible")}),j?.addEventListener("change",async()=>{const e=j.value;ae.style.display=e==="config_change"?"block":"none",se.style.display=e==="membership_change"?"block":"none",e==="config_change"&&await ie()}),H?.addEventListener("change",()=>{he.style.display=H.value==="remove"?"none":"block"}),document.getElementById("createRequestForm")?.addEventListener("submit",async e=>{e.preventDefault();const t=j.value,o=document.getElementById("govDescription").value.trim();if(!t||!o){u("Completa todos los campos obligatorios.");return}let a=null,c=null,n=null;if(t==="config_change"){if(a=M.value.trim(),c=N.value.trim(),n=document.getElementById("govNewValue").value.trim(),!a){u("Selecciona una configuración de la lista.");return}if(!n){u("Ingresa el nuevo valor propuesto.");return}}else if(t==="membership_change"){const l=H.value,i=parseInt(document.getElementById("govMemberUserId").value,10),m=document.getElementById("govMemberRole").value;if(!i){u("Especifica el ID del usuario.");return}a=`guardian:${i}`,n={action:l,userId:i,role:l!=="remove"?m:void 0}}try{const l=await y("/api/governance/requests",{method:"POST",body:JSON.stringify({actionType:t,targetKey:a,oldValue:c,newValue:n,description:o})});u(l.message||"Solicitud creada exitosamente."),document.getElementById("createRequestForm").reset(),x.value="",M.value="",N.value="",ae.style.display="none",se.style.display="none",J=!1,q("requests")}catch(l){u(`Error: ${l.message}`)}});const O=document.getElementById("bgAction"),Ee=document.getElementById("bgGuardiansCard"),U=document.getElementById("bgGuardiansList");let le=0;function W(){le++;const e=le,t=document.createElement("div");t.className="bg-guardian-row",t.setAttribute("data-row-idx",e),t.style.cssText="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap;",t.innerHTML=`
            <div style="flex: 1; min-width: 120px;">
                <label style="display: block; margin-bottom: 4px; font-size: 0.8rem; color: #9CA3AF;">ID del Usuario</label>
                <input type="number" class="bg-guardian-userId" placeholder="Ej: 5" min="1" required
                       style="width: 100%; padding: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); border-radius: 8px; color: var(--admin-text); font-size: 0.9rem; box-sizing: border-box;">
            </div>
            <div style="flex: 1; min-width: 160px;">
                <label style="display: block; margin-bottom: 4px; font-size: 0.8rem; color: #9CA3AF;">Rol</label>
                <select class="bg-guardian-role" required
                        style="width: 100%; padding: 10px; background: var(--admin-bg); border: 1px solid var(--admin-border); border-radius: 8px; color: var(--admin-text); font-size: 0.9rem; box-sizing: border-box;">
                    <option value="supervisor">Supervisor</option>
                    <option value="auxiliary">Auxiliar</option>
                </select>
            </div>
            <div style="flex: 0 0 auto;">
                <button type="button" class="bg-remove-guardian" title="Eliminar guardián" style="padding: 10px 14px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; color: #EF4444; cursor: pointer; font-size: 0.9rem;">&times;</button>
            </div>`,U.appendChild(t),t.querySelector(".bg-remove-guardian").addEventListener("click",()=>{t.remove(),xe()})}function xe(){U.querySelectorAll(".bg-guardian-row").forEach((t,o)=>{const a=t.querySelector("label");a&&(a.textContent="ID del Usuario")})}function we(){const e=U.querySelectorAll(".bg-guardian-row"),t=[];for(const o of e){const a=o.querySelector(".bg-guardian-userId"),c=o.querySelector(".bg-guardian-role"),n=parseInt(a.value,10),l=c.value;if(!n||n<=0)return{error:"Todos los campos de ID de usuario deben contener un número válido mayor a 0."};if(!["supervisor","auxiliary"].includes(l))return{error:'El rol debe ser "supervisor" o "auxiliary".'};if(t.some(i=>i.userId===n))return{error:`El usuario con ID ${n} está duplicado. Cada guardián debe ser único.`};t.push({userId:n,role:l})}return{guardians:t}}O?.addEventListener("change",()=>{Ee.style.display=O.value==="reset_guardians"?"block":"none",O.value==="reset_guardians"&&U.children.length===0&&(W(),W())}),document.getElementById("bgAddGuardianBtn")?.addEventListener("click",W),document.querySelectorAll(".bg-toggle-visibility").forEach(e=>{e.addEventListener("click",()=>{const t=document.getElementById(e.getAttribute("data-target"));if(!t)return;const o=t.type==="password";t.type=o?"text":"password",e.textContent=o?"🙈":"👁️",e.title=o?"Ocultar código":"Mostrar código"})}),document.getElementById("breakGlassForm")?.addEventListener("submit",async e=>{e.preventDefault();const t=[document.getElementById("bgCode1").value.trim(),document.getElementById("bgCode2").value.trim(),document.getElementById("bgCode3").value.trim()].filter(Boolean),o=O.value,a=document.getElementById("bgReason").value.trim();if(t.length<3){u("Se requieren al menos 3 códigos de recuperación válidos (esquema 3 de 5).");return}if(!o){u("Selecciona una acción de emergencia.");return}if(a.length<10){u("La razón de emergencia debe tener al menos 10 caracteres.");return}let c={action:o,reason:a};if(o==="reset_guardians"){const{guardians:n,error:l}=we();if(l){u(l);return}if(n.length<2){u("Debes definir al menos 2 nuevos guardianes.");return}if(n.filter(m=>m.role==="supervisor").length<2){u("Se requieren al menos 2 supervisores entre los nuevos guardianes.");return}c.guardians=n}z("PROTOCOLO BREAK GLASS: Esta acción desactivará TODOS los guardianes actuales, invalidará los códigos de recuperación existentes y asignará nuevos guardianes. Se generarán nuevos códigos que deberás guardar de forma segura. Esta operación es IRREVERSIBLE. ¿Confirmas la ejecución?",async()=>{const n=document.getElementById("bgSubmitBtn"),l=n.textContent;n.disabled=!0,n.textContent="Ejecutando...";try{const i=await y("/api/governance/break-glass",{method:"POST",body:JSON.stringify({codes:t,action:c})});if(document.getElementById("breakGlassForm").style.display="none",i.newRecoveryCodes){let Y=function(){if(r)return;r=!0,h="";const d=document.getElementById("bgCodesDisplay");d&&(d.innerHTML='<p style="color: #6B7280; text-align: center; padding: 20px;">Los códigos han sido eliminados de la pantalla por seguridad.</p>');const p=document.getElementById("bgCopyCodesBtn"),f=document.getElementById("bgDownloadCodesBtn"),B=document.getElementById("bgClearCodesBtn");p&&(p.disabled=!0,p.style.opacity="0.3"),f&&(f.disabled=!0,f.style.opacity="0.3"),B&&(B.textContent="Códigos eliminados",B.disabled=!0);const L=document.getElementById("bgCountdown");L&&(L.textContent="0:00")},A=function(){document.hidden&&!r?document.querySelectorAll(".bg-code-text").forEach(d=>{d.style.filter="blur(8px)"}):r||document.querySelectorAll(".bg-code-text").forEach(d=>{d.style.filter="none"})},r=!1,h=i.newRecoveryCodes.join(`
`);const w=i.newRecoveryCodes.map((d,p)=>`<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-bottom: 6px; font-family: monospace; font-size: 0.95rem; color: var(--admin-text);">
                                <span style="color: #6B7280; min-width: 24px;">${p+1}.</span>
                                <span class="bg-code-text" style="flex: 1; word-break: break-all;">${s(d)}</span>
                            </div>`).join(""),I=document.getElementById("bgRecoveryCodesResult");I.style.display="block",I.innerHTML=`
                            <div class="gov-card" style="border-color: #F59E0B; background: rgba(245, 158, 11, 0.05);">
                                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                                    <span style="font-size: 1.5rem;">🔑</span>
                                    <div>
                                        <h3 style="color: #F59E0B; margin: 0;">Nuevos Códigos de Recuperación</h3>
                                        <p style="color: #EF4444; font-weight: 700; font-size: 0.85rem; margin: 4px 0 0;">GUARDA ESTOS CÓDIGOS EN UN LUGAR SEGURO. NO SE MOSTRARÁN DE NUEVO.</p>
                                    </div>
                                </div>
                                <div id="bgCodesDisplay" style="margin-bottom: 16px;">${w}</div>
                                <div style="display: flex; gap: 10px; margin-bottom: 12px;">
                                    <button type="button" id="bgCopyCodesBtn" class="action-button" style="flex: 1; background: #D97706;">Copiar Códigos al Portapapeles</button>
                                    <button type="button" id="bgDownloadCodesBtn" class="action-button" style="flex: 1; background: #059669;">Descargar como Archivo</button>
                                </div>
                                <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; margin-bottom: 12px;">
                                    <p style="color: #F59E0B; font-size: 0.85rem; margin: 0 0 8px 0; font-weight: 600;">
                                        Los códigos se borrarán automáticamente en <span id="bgCountdown">5:00</span> minutos por seguridad.
                                    </p>
                                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.85rem; color: var(--admin-text);">
                                        <input type="checkbox" id="bgConfirmSaved" style="width: 18px; height: 18px; accent-color: #059669; cursor: pointer;">
                                        Confirmo que he guardado los códigos de forma segura
                                    </label>
                                </div>
                                <button type="button" id="bgClearCodesBtn" class="action-button" disabled style="width: 100%; background: #374151; opacity: 0.5; cursor: not-allowed;">
                                    Borrar códigos de pantalla y continuar
                                </button>
                                <p style="color: #9CA3AF; font-size: 0.75rem; margin-top: 10px; text-align: center;">
                                    Los guardianes han sido restablecidos. Si copiaste al portapapeles, recuerda limpiar el clipboard después.
                                </p>
                            </div>`;const Z=setTimeout(Y,3e5);let E=3e5/1e3;const $=setInterval(()=>{if(E--,E<=0){clearInterval($);return}const d=Math.floor(E/60),p=E%60,f=document.getElementById("bgCountdown");f&&(f.textContent=`${d}:${String(p).padStart(2,"0")}`)},1e3);document.addEventListener("visibilitychange",A),document.getElementById("bgConfirmSaved")?.addEventListener("change",d=>{const p=document.getElementById("bgClearCodesBtn");p&&(p.disabled=!d.target.checked,p.style.opacity=d.target.checked?"1":"0.5",p.style.cursor=d.target.checked?"pointer":"not-allowed",d.target.checked&&(p.style.background="#DC2626"))}),document.getElementById("bgClearCodesBtn")?.addEventListener("click",()=>{clearTimeout(Z),clearInterval($),Y(),document.removeEventListener("visibilitychange",A)}),document.getElementById("bgCopyCodesBtn")?.addEventListener("click",()=>{r||navigator.clipboard.writeText(h).then(()=>u("Códigos copiados al portapapeles. Recuerda limpiar el clipboard después de guardarlos.")).catch(()=>u("No se pudieron copiar automáticamente. Cópialos manualmente."))}),document.getElementById("bgDownloadCodesBtn")?.addEventListener("click",()=>{if(r)return;const d=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19),p=`WINTON-CONSENSUS — CÓDIGOS DE RECUPERACIÓN BREAK GLASS
Generados: ${new Date().toLocaleString("es-ES")}
${"═".repeat(60)}

${i.newRecoveryCodes.map((Be,Le)=>`Código ${Le+1}: ${Be}`).join(`
`)}

${"═".repeat(60)}
ADVERTENCIA: Guarda este archivo en un lugar seguro y offline.
Estos códigos NO se pueden recuperar si se pierden.
`,f=new Blob([p],{type:"text/plain"}),B=URL.createObjectURL(f),L=document.createElement("a");L.href=B,L.download=`winton-recovery-codes-${d}.txt`,L.click(),URL.revokeObjectURL(B)})}u(i.message||"Break Glass ejecutado exitosamente.")}catch(i){n.disabled=!1,n.textContent=l,u(`Error en Break Glass: ${i.message}`)}})})});
//# sourceMappingURL=governancePanel.DY2FMcVR.js.map
