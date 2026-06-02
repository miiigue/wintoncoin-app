import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css                           */import{g as b}from"./config.Br4uoD7s.js";const E=b();let g="config";document.addEventListener("DOMContentLoaded",async()=>{console.log("[MOMENTUM ADMIN] Inicializando panel..."),_(),await v("config"),N()});function _(){const t=document.querySelectorAll(".mma-tab");t.forEach(e=>{e.addEventListener("click",async()=>{const r=e.dataset.panel;if(r===g)return;t.forEach(n=>n.classList.remove("--active")),e.classList.add("--active"),document.querySelectorAll(".mma-panel").forEach(n=>n.classList.remove("--active"));const a=document.getElementById(`mma-panel-${r}`);a&&a.classList.add("--active"),g=r,await v(r)})})}async function v(t){switch(t){case"config":await $();break;case"applicants":await f();break;case"profiles":await T();break;case"campaigns":await u();break;case"verify":await M();break}}async function $(){try{const t=await c("/api/momentum/admin/config");if(!t.ok)throw new Error("Error al cargar config");const e=await t.json();if(p("mma-cfg-multiplier",e.multiplier),p("mma-cfg-phase",e.phase_name),p("mma-cfg-total-slots",e.total_slots),p("mma-cfg-occupied",e.occupied_slots),e.phase_end_date){const a=new Date(e.phase_end_date).toISOString().slice(0,16);p("mma-cfg-end-date",a)}}catch(t){console.error("[MOMENTUM ADMIN] Error cargando config:",t),o("Error al cargar configuración.","error")}}async function w(){const t={multiplier:parseFloat(document.getElementById("mma-cfg-multiplier")?.value)||1,phase_name:document.getElementById("mma-cfg-phase")?.value||"",total_slots:parseInt(document.getElementById("mma-cfg-total-slots")?.value)||0,occupied_slots:parseInt(document.getElementById("mma-cfg-occupied")?.value)||0,phase_end_date:document.getElementById("mma-cfg-end-date")?.value||null};try{const e=await c("/api/momentum/admin/config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(t)});if(e.ok)o("✅ Configuración guardada correctamente.","success");else{const r=await e.json();o(r.message||"Error al guardar.","error")}}catch(e){console.error("[MOMENTUM ADMIN] Error guardando config:",e),o("Error de conexión.","error")}}async function f(){const t=document.getElementById("mma-applicants-list");if(t){t.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const e=await c("/api/momentum/admin/applicants");if(!e.ok)throw new Error("Error");const r=await e.json();if(r.length===0){t.innerHTML='<div class="mmd-empty">No hay postulantes pendientes.</div>';return}t.innerHTML=`
            <div class="mma-table-wrap">
                <table class="mma-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nickname</th>
                            <th>Plataforma</th>
                            <th>Seguidores</th>
                            <th>Link</th>
                            <th>Nicho</th>
                            <th>Asignar Tier</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${r.map(a=>`
                            <tr>
                                <td><strong>${i(a.username)}</strong></td>
                                <td>${i(a.nickname)}</td>
                                <td>${i(a.social_platform)}</td>
                                <td>${(a.followers_count||0).toLocaleString("es-ES")}</td>
                                <td><a href="${y(a.social_link)}" target="_blank" rel="noopener" style="color: var(--mm-blue);">Ver ↗</a></td>
                                <td>${i(a.niche||"—")}</td>
                                <td>
                                    <select class="mma-tier-select" data-profile-id="${a.id}">
                                        <option value="">Seleccionar...</option>
                                        <option value="VISIONARIO">👀 Visionario</option>
                                        <option value="BRONCE">🥉 Bronce</option>
                                        <option value="PLATA">🥈 Plata</option>
                                        <option value="ORO">🥇 Oro</option>
                                    </select>
                                    <button class="mmd-btn mmd-btn--gold mmd-btn--small mma-assign-tier-btn" 
                                            data-profile-id="${a.id}" style="margin-left: 4px;">
                                        ✓
                                    </button>
                                </td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `,t.querySelectorAll(".mma-assign-tier-btn").forEach(a=>{a.addEventListener("click",()=>I(a.dataset.profileId))})}catch(e){console.error("[MOMENTUM ADMIN] Error cargando postulantes:",e),t.innerHTML='<div class="mmd-empty">Error al cargar postulantes.</div>'}}}async function I(t){const r=document.querySelector(`select[data-profile-id="${t}"]`)?.value;if(!r){o("Selecciona un tier primero.","error");return}try{const a=await c(`/api/momentum/admin/profiles/${t}/tier`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tier:r})}),n=await a.json();a.ok?(o(`✅ Tier ${r} asignado correctamente.`,"success"),await f()):o(n.message||"Error al asignar tier.","error")}catch{o("Error de conexión.","error")}}async function T(){const t=document.getElementById("mma-profiles-list");if(t){t.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const e=await c("/api/momentum/admin/profiles");if(!e.ok)throw new Error("Error");const r=await e.json();if(r.length===0){t.innerHTML='<div class="mmd-empty">No hay influencers registrados.</div>';return}t.innerHTML=`
            <div class="mma-stats-row">
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.length}</div>
                    <div class="mma-stat-card__label">Total Influencers</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.filter(a=>a.tier==="VISIONARIO").length}</div>
                    <div class="mma-stat-card__label">👀 Visionario</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.filter(a=>a.tier==="BRONCE").length}</div>
                    <div class="mma-stat-card__label">🥉 Bronce</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.filter(a=>a.tier==="PLATA").length}</div>
                    <div class="mma-stat-card__label">🥈 Plata</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.filter(a=>a.tier==="ORO").length}</div>
                    <div class="mma-stat-card__label">🥇 Oro</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${r.filter(a=>a.tier==="PLATINO").length}</div>
                    <div class="mma-stat-card__label">💎 Platino</div>
                </div>
            </div>
            <div class="mma-table-wrap">
                <table class="mma-table">
                    <thead>
                        <tr>
                            <th>Nickname</th>
                            <th>Usuario</th>
                            <th>Tier</th>
                            <th>Plataforma</th>
                            <th>Seguidores</th>
                            <th>Creado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${r.map(a=>{const n=`<span class="mmd-status-badge --${a.tier.toLowerCase()}">${a.tier}</span>`,s=new Date(a.created_at).toLocaleDateString("es-ES");return`
                                <tr>
                                    <td><strong>${i(a.nickname)}</strong></td>
                                    <td>${i(a.username)}</td>
                                    <td>${n}</td>
                                    <td>${i(a.social_platform)}</td>
                                    <td>${(a.followers_count||0).toLocaleString("es-ES")}</td>
                                    <td>${s}</td>
                                </tr>
                            `}).join("")}
                    </tbody>
                </table>
            </div>
        `}catch(e){console.error("[MOMENTUM ADMIN] Error cargando perfiles:",e),t.innerHTML='<div class="mmd-empty">Error al cargar influencers.</div>'}}}async function u(){const t=document.getElementById("mma-campaigns-list");if(t){t.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const e=await c("/api/momentum/admin/campaigns");if(!e.ok)throw new Error("Error");const r=await e.json();if(r.length===0){t.innerHTML='<div class="mmd-empty">No hay campañas creadas. ¡Crea la primera arriba!</div>';return}t.innerHTML=`
            <div class="mma-table-wrap">
                <table class="mma-table">
                    <thead>
                        <tr>
                            <th>Título</th>
                            <th>Estado</th>
                            <th>Tipo</th>
                            <th>👀 Visionario</th>
                            <th>🥉 Bronce</th>
                            <th>🥈 Plata</th>
                            <th>🥇 Oro</th>
                            <th>💎 Platino</th>
                            <th>Creada</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${r.map(a=>{const n=a.is_active,s=n?'<span class="mmd-status-badge --aprobado">Activa</span>':'<span class="mmd-status-badge --rechazado">Inactiva</span>',d=a.allow_multiple?'<span class="mmd-status-badge" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2);">Repetible</span>':'<span class="mmd-status-badge" style="background: rgba(156, 163, 175, 0.1); color: #9ca3af;">Única</span>',l=new Date(a.created_at).toLocaleDateString("es-ES");return`
                                <tr>
                                    <td><strong>${i(a.title)}</strong></td>
                                    <td>${s}</td>
                                    <td>${d}</td>
                                    <td>${parseFloat(a.base_pay_visionario||0).toLocaleString("es-ES")}</td>
                                    <td>${parseFloat(a.base_pay_bronce).toLocaleString("es-ES")}</td>
                                    <td>${parseFloat(a.base_pay_plata).toLocaleString("es-ES")}</td>
                                    <td>${parseFloat(a.base_pay_oro).toLocaleString("es-ES")}</td>
                                    <td>${parseFloat(a.base_pay_platino||0).toLocaleString("es-ES")}</td>
                                    <td>${l}</td>
                                    <td>
                                        <button class="mmd-btn mmd-btn--ghost mmd-btn--small mma-toggle-status-btn" 
                                                data-id="${a.id}" data-active="${n}">
                                            ${n?"⏸️ Pausar":"▶️ Activar"}
                                        </button>
                                    </td>
                                </tr>
                            `}).join("")}
                    </tbody>
                </table>
            </div>
        `,t.querySelectorAll(".mma-toggle-status-btn").forEach(a=>{a.addEventListener("click",()=>L(a.dataset.id,a.dataset.active==="true"))})}catch(e){console.error("[MOMENTUM ADMIN] Error cargando campañas:",e),t.innerHTML='<div class="mmd-empty">Error al cargar campañas.</div>'}}}async function S(){const t=document.getElementById("mma-camp-title")?.value?.trim(),e=document.getElementById("mma-camp-desc")?.value?.trim(),r=parseFloat(document.getElementById("mma-camp-visionario")?.value)||0,a=parseFloat(document.getElementById("mma-camp-bronce")?.value)||0,n=parseFloat(document.getElementById("mma-camp-plata")?.value)||0,s=parseFloat(document.getElementById("mma-camp-oro")?.value)||0,d=parseFloat(document.getElementById("mma-camp-platino")?.value)||0,l=document.getElementById("mma-camp-multiple")?.checked||!1;if(!t){o("El título de la campaña es obligatorio.","error");return}if(r<=0&&a<=0&&n<=0&&s<=0&&d<=0){o("Al menos un pago base debe ser mayor a 0.","error");return}try{const m=await c("/api/momentum/admin/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:t,description:e,base_pay_visionario:r,base_pay_bronce:a,base_pay_plata:n,base_pay_oro:s,base_pay_platino:d,allow_multiple:l})}),h=await m.json();m.ok?(o("🎯 Campaña creada exitosamente.","success"),document.getElementById("mma-camp-title").value="",document.getElementById("mma-camp-desc").value="",document.getElementById("mma-camp-visionario").value="",document.getElementById("mma-camp-bronce").value="",document.getElementById("mma-camp-plata").value="",document.getElementById("mma-camp-oro").value="",document.getElementById("mma-camp-platino").value="",document.getElementById("mma-camp-multiple").checked=!1,await u()):o(h.message||"Error al crear campaña.","error")}catch{o("Error de conexión.","error")}}async function L(t,e){const r=e?"pausar":"reactivar",a=!e;if(confirm(`¿Estás seguro de que deseas ${r} esta campaña?`))try{const n=await c(`/api/momentum/admin/campaigns/${t}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:a})});if(n.ok)o(`Campaña ${a?"reactivada":"pausada"} correctamente.`,"success"),await u();else{const s=await n.json();o(s.message||`Error al ${r}.`,"error")}}catch{o("Error de conexión.","error")}}async function M(){const t=document.getElementById("mma-verify-list");if(t){t.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const e=await c("/api/momentum/admin/submissions?status=PENDIENTE");if(!e.ok)throw new Error("Error");const r=await e.json();if(r.length===0){t.innerHTML='<div class="mmd-empty">🎉 No hay entregas pendientes de verificación.</div>';return}t.innerHTML=r.map(a=>{const n=new Date(a.submitted_at).toLocaleDateString("es-ES");return`
                <div class="mma-verify-card" id="mma-verify-${a.id}">
                    <div class="mma-verify-card__header">
                        <div>
                            <div class="mma-verify-card__user">${i(a.nickname)} (@${i(a.username)})</div>
                            <div class="mma-verify-card__campaign">
                                🎯 ${i(a.campaign_title)} · Tier: ${a.tier} · Enviado: ${n}
                            </div>
                        </div>
                        <span class="mmd-status-badge --pendiente">Pendiente</span>
                    </div>
                    <a href="${y(a.proof_link)}" target="_blank" rel="noopener" class="mma-verify-card__link">
                        📎 ${i(a.proof_link)}
                    </a>
                    <div class="mma-verify-card__actions">
                        <input type="number" step="0.01" min="0" placeholder="Bono extra (opcional)" 
                               class="mma-bonus-input" data-id="${a.id}">
                        <input type="text" placeholder="Nota (obligatoria para rechazar)" 
                               class="mma-note-input" data-id="${a.id}">
                        <button class="mmd-btn mmd-btn--gold mmd-btn--small mma-approve-btn" data-id="${a.id}">
                            ✅ Aprobar
                        </button>
                        <button class="mmd-btn mmd-btn--ghost mmd-btn--small mma-reject-btn" data-id="${a.id}" 
                                style="border-color: var(--mm-red); color: var(--mm-red);">
                            ❌ Rechazar
                        </button>
                    </div>
                </div>
            `}).join(""),t.querySelectorAll(".mma-approve-btn").forEach(a=>{a.addEventListener("click",()=>B(a.dataset.id))}),t.querySelectorAll(".mma-reject-btn").forEach(a=>{a.addEventListener("click",()=>k(a.dataset.id))})}catch(e){console.error("[MOMENTUM ADMIN] Error cargando submissions:",e),t.innerHTML='<div class="mmd-empty">Error al cargar entregas.</div>'}}}async function B(t){const e=document.querySelector(`.mma-bonus-input[data-id="${t}"]`),r=document.querySelector(`.mma-note-input[data-id="${t}"]`),a=parseFloat(e?.value)||0,n=r?.value?.trim()||"";try{const s=await c(`/api/momentum/admin/submissions/${t}/approve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bonus_extra:a,admin_note:n})}),d=await s.json();if(s.ok){const l=parseFloat(d.paid_amount).toLocaleString("es-ES",{maximumFractionDigits:4});o(`✅ Aprobada — ${l} BLUE IOU acreditados.`,"success");const m=document.getElementById(`mma-verify-${t}`);m&&(m.style.opacity="0",m.style.transform="translateX(100px)",m.style.transition="all 0.4s ease",setTimeout(()=>m.remove(),400))}else o(d.message||"Error al aprobar.","error")}catch{o("Error de conexión.","error")}}async function k(t){const e=document.querySelector(`.mma-note-input[data-id="${t}"]`),r=e?.value?.trim();if(!r){o("La nota es OBLIGATORIA para rechazar una entrega.","error"),e&&(e.style.borderColor="var(--mm-red)",e.focus());return}if(confirm("¿Rechazar esta entrega? Esta acción es irreversible."))try{const a=await c(`/api/momentum/admin/submissions/${t}/reject`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({admin_note:r})}),n=await a.json();if(a.ok){o("❌ Entrega rechazada.","info");const s=document.getElementById(`mma-verify-${t}`);s&&(s.style.opacity="0",s.style.transform="translateX(-100px)",s.style.transition="all 0.4s ease",setTimeout(()=>s.remove(),400))}else o(n.message||"Error al rechazar.","error")}catch{o("Error de conexión.","error")}}function N(){const t=document.getElementById("mma-save-config");t&&t.addEventListener("click",w);const e=document.getElementById("mma-create-campaign-btn");e&&e.addEventListener("click",S)}async function c(t,e={}){return fetch(`${E}${t}`,{...e,credentials:"include"})}function p(t,e){const r=document.getElementById(t);r&&e!==null&&e!==void 0&&(r.value=e)}function o(t,e="info"){const r=document.getElementById("mmd-toast");r&&(r.textContent=t,r.className=`mmd-toast --${e} --visible`,setTimeout(()=>{r.classList.remove("--visible")},4e3))}function i(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}function y(t){return t?t.replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""}
//# sourceMappingURL=momentumAdmin.7_m-i2Os.js.map
