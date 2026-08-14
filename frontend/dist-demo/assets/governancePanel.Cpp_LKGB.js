import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                    */import"./index.pbqrtUCb.js";import{g as de,s as u,c as G,e as Le,p as Se}from"./auth.BgcrufBo.js";window.getApiUrl=de;window.showCustomAlert=u;window.showCustomConfirm=G;document.addEventListener("DOMContentLoaded",async()=>{await Le(),Se();const ce=de(),Z=localStorage.getItem("token"),j=new URLSearchParams(window.location.search),L=j.get("focus")==="vote"&&!!j.get("id");function O(){const e=window.location.pathname.split("/").pop()+window.location.search;window.location.href=`login.html?returnTo=${encodeURIComponent(e)}`}if(!Z){O();return}function s(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}async function y(e,t={}){const a={"Content-Type":"application/json",Authorization:`Bearer ${Z}`,...t.headers||{}};delete t.headers;const n=await fetch(`${ce}${e}`,{headers:a,...t});if(n.status===401)throw u("Sesión expirada. Inicia sesión nuevamente."),O(),new Error("Sesión expirada");const c=await n.json();if(!n.ok)throw new Error(c.error||c.message||`Error ${n.status}`);return c}function S(e){return e?new Date(e).toLocaleString("es-ES",{timeZone:"America/Bogota",dateStyle:"medium",timeStyle:"short"}):"—"}function X(e,t){if(!e)return"—";try{const a=typeof e=="string"?JSON.parse(e):e;if(typeof a!="object"||a===null)return s(String(e));if(t==="membership_change"&&a.action){const n={add:"Agregar",remove:"Remover",update:"Actualizar"},c={supervisor:"Supervisor",auxiliary:"Auxiliar"},o=n[a.action]||a.action,l=c[a.role]||"",r=a.userId?`usuario #${a.userId}`:"";return a.action==="remove"?s(`${o} ${r}`):s(`${o} ${r} como ${l}`).trim()}return s(t==="config_change"?String(e):JSON.stringify(a))}catch{return s(String(e))}}const ue={allow_new_registrations:"Permitir Nuevos Registros",allow_new_publications:"Permitir Nuevas Publicaciones",public_profiles_enabled:"Perfiles Públicos",debt_system_enabled:"Sistema de Compromisos (Tokens RED)",debt_cycle_days:"Ciclo de Compromiso RED — Días",debt_cycle_hours:"Ciclo de Compromiso RED — Horas",debt_cycle_minutes:"Ciclo de Compromiso RED — Minutos",blue_escrow_days:"Depósito BLUE (Escrow) — Días",blue_escrow_hours:"Depósito BLUE (Escrow) — Horas",blue_escrow_minutes:"Depósito BLUE (Escrow) — Minutos",platform_commission_percentage:"Comisión de Plataforma (%)",booster_system_enabled:"Sistema de Impulsores",booster_custom_frequency_enabled:"Impulsores — Activar Intervalo de Pago Personalizado (Switch)",booster_payment_frequency_days:"Impulsores — Intervalo de Pago Personalizado (Días)",booster_payment_frequency_hours:"Impulsores — Intervalo de Pago Personalizado (Horas)",booster_payment_frequency_minutes:"Impulsores — Intervalo de Pago Personalizado (Minutos)",referral_system_enabled:"Sistema de Referidos",referral_reward_amount:"Recompensa por Referido (BLUE)",referral_reward_after_expiry:"Recompensa después de la Promo (BLUE)",referral_codes_expiry_date:"Vigencia de Códigos de Referido",referral_bonus_amount:"Recompensa por Referido Legacy (Monto BLUE)",referral_bonus_enabled:"Recompensa por Referido Legacy (Switch Habilitado)",welcome_bonus_enabled:"Bono de Bienvenida",welcome_bonus_amount:"Monto del Bono de Bienvenida (BLUE)",global_app_interstitial_enabled:"General — Activar Modal Diario Intersticial",daily_modal_title:"Modal Diario — Título Informativo",daily_modal_mon:"Modal Diario — Mensaje de Lunes",daily_modal_tue:"Modal Diario — Mensaje de Martes",daily_modal_wed:"Modal Diario — Mensaje de Miércoles",daily_modal_thu:"Modal Diario — Mensaje de Jueves",daily_modal_fri:"Modal Diario — Mensaje de Viernes",daily_modal_sat:"Modal Diario — Mensaje de Sábado",daily_modal_sun:"Modal Diario — Mensaje de Domingo",pre_launch_mode_enabled:"Modo Pre-Lanzamiento",allow_request_publications:'Permitir Publicaciones de "Solicitud"',allow_sell_publications:'Permitir Publicaciones de "Venta"',allow_donation_publications:'Permitir Publicaciones de "Donación"',allow_quick_sale_publications:'Permitir Publicaciones de "Venta Rápida"',p2p_enabled:"P2P — Habilitado",p2p_price_min:"P2P — Precio Mínimo (USD)",p2p_price_max:"P2P — Precio Máximo (USD)",p2p_fee_percentage:"P2P — Comisión (%)",p2p_payment_window_minutes:"P2P — Ventana de Pago (min)",p2p_extension_minutes:"P2P — Extensión (min)",p2p_extension_limit:"P2P — Límite de Extensiones",p2p_cash_min_rating:"P2P — Reputación Mínima para Efectivo",gov_quorum_percentage:"Gobernanza — Quórum Requerido (%)",gov_timelock_hours:"Gobernanza — Time-Lock (horas)",gov_request_expiry_hours:"Gobernanza — Expiración de Solicitud (horas)",gov_reminder_threshold_hours:"Gobernanza — Umbral de Recordatorio (horas)",gov_reminder_cooldown_hours:"Gobernanza — Enfriamiento entre Recordatorios (horas)",gov_vote_reward_blue:"Gobernanza — Recompensa por Voto (BLUE IOU)",red_credit_base_limit:"Scoring — Límite Base RED (Nuevos Usuarios)",red_credit_culture_quiz:"Scoring — Bono por Cuestionario de Cultura (RED)",red_credit_referral:"Scoring — Bono por Referido Activo (RED)",red_credit_monthly_activity:"Scoring — Bono por Alta Actividad Mensual (>20) (RED)",red_credit_early_payment:"Scoring — Bono por Amortización Anticipada (<5 días) (RED)",web3_protocol_paused:"Web3 — Protocolo Pausado (Emergencia)",web3_max_transaction_amount:"Web3 — Límite Máximo por Transacción (BLUE)",web3_founders_wallet:"Web3 — Billetera de Fundadores (Treasury)",web3_treasury_withdrawal:"Web3 — Retiro de Excedentes del Treasury (BLUE)"};function pe(e){return ue[e]||e}function R(e){return{pending:"Pendiente",approved:"Aprobada",rejected:"Rechazada",executed:"Ejecutada",expired:"Expirada",cancelled:"Cancelada"}[e]||e}function ee(e){return e==="config_change"?"Configuración":e==="membership_change"?"Membresía":e}const te=document.querySelectorAll(".nav-link[data-section]"),me=document.querySelectorAll(".admin-section");function k(){document.body.classList.remove("gov-mobile-nav-open");const e=document.getElementById("govMobileMenuBtn");e&&e.setAttribute("aria-expanded","false")}function ge(){const e=document.body.classList.toggle("gov-mobile-nav-open"),t=document.getElementById("govMobileMenuBtn");t&&t.setAttribute("aria-expanded",e?"true":"false")}function q(e){me.forEach(n=>n.classList.remove("active-section")),te.forEach(n=>n.classList.remove("active"));const t=document.getElementById(`${e}-section`),a=document.querySelector(`.nav-link[data-section="${e}"]`);t&&t.classList.add("active-section"),a&&a.classList.add("active"),e==="status"?ye():e==="council"?be():e==="requests"&&T(),k()}te.forEach(e=>{e.addEventListener("click",t=>{const a=e.getAttribute("data-section");if(a){if(t.preventDefault(),L){k(),u("Estás en modo votación. Solo puedes ver y votar la solicitud asignada.");return}q(a)}})});let m=null;async function ve(){try{const e=await y("/api/governance/me");return e.isGuardian?(m=e.guardian,!0):(document.querySelector(".admin-grid-container").innerHTML=`
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
                </div>`,document.getElementById("govErrorLoginBtn")?.addEventListener("click",O),!1}}if(!await ve())return;function V(e){const t=document.querySelector(".admin-grid-container");if(t){if(L){t.classList.add("gov-vote-focus");return}t.classList.toggle("gov-vote-focus",!!e)}}if(L){document.querySelector(".admin-grid-container")?.classList.add("gov-vote-focus");const e=document.getElementById("requests-section"),t=e?.querySelector("h1"),a=e?.querySelector(":scope > p");t&&!t.dataset.defaultSaved&&(t.dataset.defaultSaved="1",t.dataset.defaultText=t.textContent,t.textContent="Tu voto es requerido"),a&&!a.dataset.defaultSaved&&(a.dataset.defaultSaved="1",a.dataset.defaultText=a.textContent,a.textContent="Revisa los detalles de la solicitud y confirma tu decisión."),document.querySelector("#requests-section .gov-tabs")?.style.setProperty("display","none"),document.getElementById("requests-list-container")?.style.setProperty("display","none")}const oe=j.get("id");oe?(q("requests"),setTimeout(()=>M(parseInt(oe,10)),400)):q("status"),document.getElementById("govLogoutBtn")?.addEventListener("click",e=>{e.preventDefault(),k(),localStorage.removeItem("token"),window.location.href="login.html"}),document.getElementById("govMobileMenuBtn")?.addEventListener("click",()=>ge()),document.getElementById("govMobileBackdrop")?.addEventListener("click",()=>k());async function ye(){const e=document.getElementById("guardian-status-container");e.innerHTML='<div class="loading-spinner"></div>';try{const t=await y("/api/governance/me");if(!t.isGuardian){e.innerHTML=`
                    <div class="gov-empty-state">
                        <p style="font-size: 1.5rem;">🚫</p>
                        <p><strong>No eres guardián</strong></p>
                        <p>Tu cuenta no tiene rol de guardián en el sistema Winton-Consensus.</p>
                    </div>`;return}m=t.guardian,e.innerHTML=`
                <div class="gov-card">
                    <h3>Información del Guardián</h3>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Usuario</span>
                        <span class="gov-info-value">${s(m.username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Rol</span>
                        <span class="gov-info-value" style="text-transform: capitalize;">${s(m.role)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Estado</span>
                        <span class="gov-status-badge ${m.status}">${R(m.status)}</span>
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
                </div>`}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}async function be(){const e=document.getElementById("council-container");e.innerHTML='<div class="loading-spinner"></div>';try{const a=(await y("/api/governance/guardians")).guardians||[];if(a.length===0){e.innerHTML=`
                    <div class="gov-empty-state">
                        <p style="font-size: 1.5rem;">👥</p>
                        <p><strong>Sin guardianes registrados</strong></p>
                    </div>`;return}const n=a.filter(i=>i.status==="active"),c=n.filter(i=>i.role==="supervisor"),o=n.filter(i=>i.role==="auxiliary"),l={supervisor:"Supervisor",auxiliary:"Auxiliar"},r={active:"Activo",inactive:"Inactivo"},g=a.map(i=>{const h=Number(i.vote_count)||0,x=Number(i.proposal_count)||0;return`
                <tr>
                    <td style="font-family: monospace; color: #9CA3AF;">${Number(i.user_id)||"—"}</td>
                    <td>${s(i.username)}</td>
                    <td><span class="gov-role-tag ${s(i.role)}">${l[i.role]||s(i.role)}</span></td>
                    <td><span class="gov-status-badge ${s(i.status)}">${r[i.status]||s(i.status)}</span></td>
                    <td style="text-align: center; font-weight: 600;">${h}</td>
                    <td style="text-align: center; color: #9CA3AF;">${x}</td>
                    <td>${S(i.created_at)}</td>
                </tr>`}).join("");e.innerHTML=`
                <div class="gov-council-summary">
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${n.length}</div>
                        <div class="gov-summary-label">Activos</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${c.length}</div>
                        <div class="gov-summary-label">Supervisores</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${o.length}</div>
                        <div class="gov-summary-label">Auxiliares</div>
                    </div>
                    <div class="gov-summary-item">
                        <div class="gov-summary-number">${a.length}</div>
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
                        <tbody>${g}</tbody>
                    </table>
                </div>`}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}let C="pending";document.querySelectorAll(".gov-tab[data-filter]").forEach(e=>{e.addEventListener("click",()=>{document.querySelectorAll(".gov-tab").forEach(t=>t.classList.remove("active")),e.classList.add("active"),C=e.getAttribute("data-filter"),document.getElementById("request-detail-container").style.display="none",document.getElementById("requests-list-container").style.display="",T()})});async function T(){const e=document.getElementById("requests-list-container");e.innerHTML='<div class="loading-spinner"></div>';try{const t=C!=="all"?`?status=${C}`:"?limit=50",a=await y(`/api/governance/requests${t}`);if(!a.requests||a.requests.length===0){e.innerHTML=`<div class="gov-empty-state"><p>No hay solicitudes ${C!=="all"?R(C).toLowerCase()+"s":""}.</p></div>`;return}e.innerHTML=a.requests.map(o=>`
                <div class="gov-request-card" data-request-id="${o.id}">
                    <div class="gov-request-header">
                        <span class="gov-request-id">#${o.id}</span>
                        <span class="gov-status-badge ${o.status}">${R(o.status)}</span>
                    </div>
                    <div class="gov-request-desc">${s(o.description)}</div>
                    <div class="gov-request-meta">
                        <span>${ee(o.action_type)}</span>
                        <span>Por: ${s(o.requester_username||"?")}</span>
                        <span>Expira: ${S(o.expires_at)}</span>
                        ${o.approve_count!==void 0?`<span>✅ ${o.approve_count} | ❌ ${o.reject_count}</span>`:""}
                    </div>
                </div>
            `).join(""),e.querySelectorAll(".gov-request-card").forEach(o=>{o.addEventListener("click",()=>{M(parseInt(o.getAttribute("data-request-id"),10))})});const n=a.requests.filter(o=>o.status==="pending").length,c=document.getElementById("pendingRequestsBadge");c&&(c.textContent=n>0?n:"")}catch(t){e.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(t.message)}</p></div>`}}async function M(e){const t=document.getElementById("request-detail-container"),a=document.getElementById("requests-list-container"),n=document.querySelector("#requests-section .gov-tabs");a&&(a.style.display="none"),n&&(n.style.display="none"),t.style.display="block",t.innerHTML='<div class="loading-spinner"></div>',document.getElementById("requests-section")?.scrollIntoView({behavior:"smooth",block:"start"});try{const o=(await y(`/api/governance/requests/${e}`)).request,l=o.quorum||{},r=m&&o.requester_id===m.userId,g=m?.userId,i=(o.votes||[]).some(d=>Number(d.guardian_user_id)===Number(g)),h=o.status==="pending"&&m&&m.status==="active"&&!r&&!i,x=o.status==="pending"&&r,I=o.status==="approved"&&m&&m.status==="active",Q=x||I,Y=(o.votes||[]).map(d=>`
                <li>
                    <span>${s(d.guardian_username)} <span style="color:#6B7280;">(${d.guardian_role})</span></span>
                    <span class="gov-status-badge ${d.vote==="approve"?"active":"rejected"}">${d.vote==="approve"?"Aprobó":"Rechazó"}</span>
                </li>
            `).join("")||'<li style="color:#6B7280;">Aún no hay votos.</li>',E=l.approved?.supervisor||0,A=l.totals?.supervisor||1,$=Math.round(E/A*100);t.innerHTML=`
                <div class="gov-card" style="border-color: var(--admin-primary);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                        <h3 style="margin: 0;">Solicitud #${o.id}</h3>
                        <span class="gov-status-badge ${o.status}">${R(o.status)}</span>
                    </div>

                    <div class="gov-info-row">
                        <span class="gov-info-label">Tipo</span>
                        <span class="gov-info-value">${ee(o.action_type)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Proponente</span>
                        <span class="gov-info-value">${s(o.requester_username)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Descripción</span>
                        <span class="gov-info-value">${s(o.description)}</span>
                    </div>
                    ${o.target_key?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Configuración</span>
                        <span class="gov-info-value">${s(pe(o.target_key))}</span>
                    </div>`:""}
                    ${o.old_value?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Anterior</span>
                        <span class="gov-info-value">${X(o.old_value,o.action_type)}</span>
                    </div>`:""}
                    ${o.new_value?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Valor Propuesto</span>
                        <span class="gov-info-value">${X(o.new_value,o.action_type)}</span>
                    </div>`:""}
                    <div class="gov-info-row">
                        <span class="gov-info-label">Creada</span>
                        <span class="gov-info-value">${S(o.created_at)}</span>
                    </div>
                    <div class="gov-info-row">
                        <span class="gov-info-label">Expira</span>
                        <span class="gov-info-value">${S(o.expires_at)}</span>
                    </div>
                    ${o.execution_time?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Ejecución Programada</span>
                        <span class="gov-info-value">${S(o.execution_time)}</span>
                    </div>`:o.action_type==="membership_change"&&o.status==="pending"?`
                    <div class="gov-info-row">
                        <span class="gov-info-label">Time-Lock</span>
                        <span class="gov-info-value">Al aprobar el quórum, el sistema esperará las horas configuradas en el panel admin antes de ejecutar el cambio.</span>
                    </div>`:""}

                    <div class="gov-detail-section">
                        <h4>Quórum de Supervisores</h4>
                        <div class="gov-quorum-bar">
                            <div class="gov-quorum-fill" style="width: ${$}%; background: ${$>=67?"#059669":"#3B82F6"};"></div>
                        </div>
                        <p style="font-size: 0.8rem; color: #9CA3AF;">
                            ${E} de ${A} supervisores aprobaron (umbral: ${l.thresholds?.supervisor||l.supThreshold||"?"})
                        </p>
                    </div>

                    <div class="gov-detail-section">
                        <h4>Votos Registrados</h4>
                        <ul class="gov-vote-list">${Y}</ul>
                    </div>

                    ${i&&o.status==="pending"&&!r?`
                    <div class="gov-vote-done-notice">
                        <strong>Ya emitiste tu voto</strong> en esta solicitud. No puedes cambiarlo ni votar de nuevo (así evitamos dobles firmas y confusiones).
                    </div>`:""}

                    ${h?`
                    <div class="gov-vote-buttons">
                        <button type="button" class="gov-btn-approve" id="voteApproveBtn">✅ Aprobar</button>
                        <button type="button" class="gov-btn-reject" id="voteRejectBtn">❌ Rechazar</button>
                    </div>`:""}

                    <div style="display: flex; gap: 12px; margin-top: 20px;">
                        ${L?"":'<button type="button" id="backToListBtn" style="flex: 1; padding: 10px; border-radius: 8px; background: transparent; border: 1px solid var(--admin-border); color: var(--admin-text-secondary); cursor: pointer; font-family: inherit; font-size: 0.9rem;">← Volver a la Lista</button>'}
                        ${x?'<button id="cancelRequestBtn" data-reason="withdraw" style="flex: 1; padding: 10px; border-radius: 8px; background: #D97706; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Retirar mi Solicitud</button>':""}
                        ${I?'<button id="cancelRequestBtn" data-reason="timelock" style="flex: 1; padding: 10px; border-radius: 8px; background: #6B7280; border: none; color: white; cursor: pointer; font-family: inherit; font-size: 0.9rem; font-weight: 600;">Cancelar (Time-Lock)</button>':""}
                    </div>
                </div>`,document.getElementById("backToListBtn")?.addEventListener("click",()=>{V(!1),t.style.display="none",a&&(a.style.display=""),n&&(n.style.display="")}),document.getElementById("voteApproveBtn")?.addEventListener("click",()=>ae(o.id,"approve")),document.getElementById("voteRejectBtn")?.addEventListener("click",()=>ae(o.id,"reject")),document.getElementById("cancelRequestBtn")?.addEventListener("click",d=>{const p=d.currentTarget.getAttribute("data-reason");fe(o.id,p)}),V(h)}catch(c){V(!1),t.innerHTML=`<div class="gov-empty-state"><p style="color: #EF4444;">Error: ${s(c.message)}</p></div>`}}async function ae(e,t){const n=`Usted está votando para ${t==="approve"?"APROBAR":"RECHAZAR"} la solicitud #${e}.

Esta acción no se puede deshacer. Una vez confirmada, no podrá cambiar su voto.

¿Está de acuerdo?`;G(n,async()=>{const c=document.getElementById("voteApproveBtn"),o=document.getElementById("voteRejectBtn"),l=r=>{[c,o].forEach(g=>{g&&(g.disabled=r,g.style.opacity=r?"0.5":"1")})};l(!0);try{const r=await y(`/api/governance/requests/${e}/vote`,{method:"POST",body:JSON.stringify({vote:t})});u(r.message||"Voto registrado exitosamente."),await M(e),L||T()}catch(r){l(!1),u(`Error al votar: ${r.message}`)}})}async function fe(e,t){const a=t==="withdraw"?`¿Confirmas que deseas RETIRAR tu solicitud #${e}? Podrás crear una nueva con los datos correctos.`:`¿Confirmas la CANCELACIÓN de la solicitud #${e} durante la ventana de Time-Lock? Esta acción no se puede deshacer.`;G(a,async()=>{try{const n=await y(`/api/governance/requests/${e}/cancel`,{method:"POST"});u(n.message||"Solicitud cancelada."),M(e),T()}catch(n){u(`Error: ${n.message}`)}})}const F=document.getElementById("govActionType"),ne=document.getElementById("configFields"),se=document.getElementById("membershipFields"),H=document.getElementById("govMemberAction"),he=document.getElementById("govMemberRoleGroup");let D=[],W=!1,v=-1;async function re(){if(!W)try{D=(await y("/api/governance/settings-catalog")).settings||[],W=!0}catch(e){console.error("Error loading settings catalog:",e)}}const _=document.getElementById("govSettingSearch"),P=document.getElementById("govTargetKey"),z=document.getElementById("govOldValue"),b=document.getElementById("govSettingDropdown");function J(e){if(e.length===0){b.innerHTML='<div class="gov-autocomplete-item" style="color: #6B7280; cursor: default;">No se encontraron configuraciones.</div>',b.classList.add("visible");return}v=-1,b.innerHTML=e.map((t,a)=>`
            <div class="gov-autocomplete-item" data-index="${a}" data-key="${s(t.key)}" data-value="${s(t.currentValue)}" data-label="${s(t.label)}">
                <span class="item-label">${s(t.label)}</span>
                <span class="item-key">(${s(t.key)})</span>
                <span class="item-value">Actual: ${s(t.currentValue)}</span>
            </div>
        `).join(""),b.classList.add("visible"),b.querySelectorAll(".gov-autocomplete-item[data-key]").forEach(t=>{t.addEventListener("click",()=>ie(t))})}function ie(e){const t=e.getAttribute("data-key"),a=e.getAttribute("data-value"),n=e.getAttribute("data-label");P.value=t,_.value=`${n} (${t})`,z.value=a,b.classList.remove("visible"),document.getElementById("govNewValue").focus()}_?.addEventListener("focus",async()=>{await re(),J(D)}),_?.addEventListener("input",()=>{const e=_.value.toLowerCase().trim();if(P.value="",z.value="",!e){J(D);return}const t=D.filter(a=>a.label.toLowerCase().includes(e)||a.key.toLowerCase().includes(e));J(t)}),_?.addEventListener("keydown",e=>{const t=b.querySelectorAll(".gov-autocomplete-item[data-key]");t.length&&(e.key==="ArrowDown"?(e.preventDefault(),v=Math.min(v+1,t.length-1),t.forEach((a,n)=>a.classList.toggle("highlighted",n===v)),t[v]?.scrollIntoView({block:"nearest"})):e.key==="ArrowUp"?(e.preventDefault(),v=Math.max(v-1,0),t.forEach((a,n)=>a.classList.toggle("highlighted",n===v)),t[v]?.scrollIntoView({block:"nearest"})):e.key==="Enter"&&v>=0?(e.preventDefault(),ie(t[v])):e.key==="Escape"&&b.classList.remove("visible"))}),document.addEventListener("click",e=>{!e.target.closest("#govSettingSearch")&&!e.target.closest("#govSettingDropdown")&&b?.classList.remove("visible")}),F?.addEventListener("change",async()=>{const e=F.value;ne.style.display=e==="config_change"?"block":"none",se.style.display=e==="membership_change"?"block":"none",e==="config_change"&&await re()}),H?.addEventListener("change",()=>{he.style.display=H.value==="remove"?"none":"block"}),document.getElementById("createRequestForm")?.addEventListener("submit",async e=>{e.preventDefault();const t=F.value,a=document.getElementById("govDescription").value.trim();if(!t||!a){u("Completa todos los campos obligatorios.");return}let n=null,c=null,o=null;if(t==="config_change"){if(n=P.value.trim(),c=z.value.trim(),o=document.getElementById("govNewValue").value.trim(),!n){u("Selecciona una configuración de la lista.");return}if(!o){u("Ingresa el nuevo valor propuesto.");return}}else if(t==="membership_change"){const l=H.value,r=parseInt(document.getElementById("govMemberUserId").value,10),g=document.getElementById("govMemberRole").value;if(!r){u("Especifica el ID del usuario.");return}n=`guardian:${r}`,o={action:l,userId:r,role:l!=="remove"?g:void 0}}try{const l=await y("/api/governance/requests",{method:"POST",body:JSON.stringify({actionType:t,targetKey:n,oldValue:c,newValue:o,description:a})});u(l.message||"Solicitud creada exitosamente."),document.getElementById("createRequestForm").reset(),_.value="",P.value="",z.value="",ne.style.display="none",se.style.display="none",W=!1,q("requests")}catch(l){u(`Error: ${l.message}`)}});const U=document.getElementById("bgAction"),Ee=document.getElementById("bgGuardiansCard"),N=document.getElementById("bgGuardiansList");let le=0;function K(){le++;const e=le,t=document.createElement("div");t.className="bg-guardian-row",t.setAttribute("data-row-idx",e),t.style.cssText="display: flex; gap: 10px; align-items: flex-end; margin-bottom: 10px; flex-wrap: wrap;",t.innerHTML=`
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
            </div>`,N.appendChild(t),t.querySelector(".bg-remove-guardian").addEventListener("click",()=>{t.remove(),_e()})}function _e(){N.querySelectorAll(".bg-guardian-row").forEach((t,a)=>{const n=t.querySelector("label");n&&(n.textContent="ID del Usuario")})}function xe(){const e=N.querySelectorAll(".bg-guardian-row"),t=[];for(const a of e){const n=a.querySelector(".bg-guardian-userId"),c=a.querySelector(".bg-guardian-role"),o=parseInt(n.value,10),l=c.value;if(!o||o<=0)return{error:"Todos los campos de ID de usuario deben contener un número válido mayor a 0."};if(!["supervisor","auxiliary"].includes(l))return{error:'El rol debe ser "supervisor" o "auxiliary".'};if(t.some(r=>r.userId===o))return{error:`El usuario con ID ${o} está duplicado. Cada guardián debe ser único.`};t.push({userId:o,role:l})}return{guardians:t}}U?.addEventListener("change",()=>{Ee.style.display=U.value==="reset_guardians"?"block":"none",U.value==="reset_guardians"&&N.children.length===0&&(K(),K())}),document.getElementById("bgAddGuardianBtn")?.addEventListener("click",K),document.querySelectorAll(".bg-toggle-visibility").forEach(e=>{e.addEventListener("click",()=>{const t=document.getElementById(e.getAttribute("data-target"));if(!t)return;const a=t.type==="password";t.type=a?"text":"password",e.textContent=a?"🙈":"👁️",e.title=a?"Ocultar código":"Mostrar código"})}),document.getElementById("breakGlassForm")?.addEventListener("submit",async e=>{e.preventDefault();const t=[document.getElementById("bgCode1").value.trim(),document.getElementById("bgCode2").value.trim(),document.getElementById("bgCode3").value.trim()].filter(Boolean),a=U.value,n=document.getElementById("bgReason").value.trim();if(t.length<3){u("Se requieren al menos 3 códigos de recuperación válidos (esquema 3 de 5).");return}if(!a){u("Selecciona una acción de emergencia.");return}if(n.length<10){u("La razón de emergencia debe tener al menos 10 caracteres.");return}let c={action:a,reason:n};if(a==="reset_guardians"){const{guardians:o,error:l}=xe();if(l){u(l);return}if(o.length<2){u("Debes definir al menos 2 nuevos guardianes.");return}if(o.filter(g=>g.role==="supervisor").length<2){u("Se requieren al menos 2 supervisores entre los nuevos guardianes.");return}c.guardians=o}G("PROTOCOLO BREAK GLASS: Esta acción desactivará TODOS los guardianes actuales, invalidará los códigos de recuperación existentes y asignará nuevos guardianes. Se generarán nuevos códigos que deberás guardar de forma segura. Esta operación es IRREVERSIBLE. ¿Confirmas la ejecución?",async()=>{const o=document.getElementById("bgSubmitBtn"),l=o.textContent;o.disabled=!0,o.textContent="Ejecutando...";try{const r=await y("/api/governance/break-glass",{method:"POST",body:JSON.stringify({codes:t,action:c})});if(document.getElementById("breakGlassForm").style.display="none",r.newRecoveryCodes){let Q=function(){if(i)return;i=!0,h="";const d=document.getElementById("bgCodesDisplay");d&&(d.innerHTML='<p style="color: #6B7280; text-align: center; padding: 20px;">Los códigos han sido eliminados de la pantalla por seguridad.</p>');const p=document.getElementById("bgCopyCodesBtn"),f=document.getElementById("bgDownloadCodesBtn"),w=document.getElementById("bgClearCodesBtn");p&&(p.disabled=!0,p.style.opacity="0.3"),f&&(f.disabled=!0,f.style.opacity="0.3"),w&&(w.textContent="Códigos eliminados",w.disabled=!0);const B=document.getElementById("bgCountdown");B&&(B.textContent="0:00")},$=function(){document.hidden&&!i?document.querySelectorAll(".bg-code-text").forEach(d=>{d.style.filter="blur(8px)"}):i||document.querySelectorAll(".bg-code-text").forEach(d=>{d.style.filter="none"})},i=!1,h=r.newRecoveryCodes.join(`
`);const x=r.newRecoveryCodes.map((d,p)=>`<div style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0,0,0,0.3); border-radius: 8px; margin-bottom: 6px; font-family: monospace; font-size: 0.95rem; color: var(--admin-text);">
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
                                <div id="bgCodesDisplay" style="margin-bottom: 16px;">${x}</div>
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
                            </div>`;const Y=setTimeout(Q,3e5);let E=3e5/1e3;const A=setInterval(()=>{if(E--,E<=0){clearInterval(A);return}const d=Math.floor(E/60),p=E%60,f=document.getElementById("bgCountdown");f&&(f.textContent=`${d}:${String(p).padStart(2,"0")}`)},1e3);document.addEventListener("visibilitychange",$),document.getElementById("bgConfirmSaved")?.addEventListener("change",d=>{const p=document.getElementById("bgClearCodesBtn");p&&(p.disabled=!d.target.checked,p.style.opacity=d.target.checked?"1":"0.5",p.style.cursor=d.target.checked?"pointer":"not-allowed",d.target.checked&&(p.style.background="#DC2626"))}),document.getElementById("bgClearCodesBtn")?.addEventListener("click",()=>{clearTimeout(Y),clearInterval(A),Q(),document.removeEventListener("visibilitychange",$)}),document.getElementById("bgCopyCodesBtn")?.addEventListener("click",()=>{i||copyTextToClipboard(h).then(()=>u("Códigos copiados al portapapeles. Recuerda limpiar el clipboard después de guardarlos.")).catch(()=>u("No se pudieron copiar automáticamente. Cópialos manualmente."))}),document.getElementById("bgDownloadCodesBtn")?.addEventListener("click",()=>{if(i)return;const d=new Date().toISOString().replace(/[:.]/g,"-").slice(0,19),p=`WINTON-CONSENSUS — CÓDIGOS DE RECUPERACIÓN BREAK GLASS
Generados: ${new Date().toLocaleString("es-ES")}
${"═".repeat(60)}

${r.newRecoveryCodes.map((we,Be)=>`Código ${Be+1}: ${we}`).join(`
`)}

${"═".repeat(60)}
ADVERTENCIA: Guarda este archivo en un lugar seguro y offline.
Estos códigos NO se pueden recuperar si se pierden.
`,f=new Blob([p],{type:"text/plain"}),w=URL.createObjectURL(f),B=document.createElement("a");B.href=w,B.download=`winton-recovery-codes-${d}.txt`,B.click(),URL.revokeObjectURL(w)})}u(r.message||"Break Glass ejecutado exitosamente.")}catch(r){o.disabled=!1,o.textContent=l,u(`Error en Break Glass: ${r.message}`)}})})});
//# sourceMappingURL=governancePanel.Cpp_LKGB.js.map
