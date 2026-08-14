import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css                           */import"./index.pbqrtUCb.js";import{c as y,g as B}from"./auth.BgcrufBo.js";const $=B();let v="config";document.addEventListener("DOMContentLoaded",async()=>{console.log("[MOMENTUM ADMIN] Inicializando panel..."),w(),await f("config"),j()});function w(){const e=document.querySelectorAll(".mma-tab");e.forEach(t=>{t.addEventListener("click",async()=>{const n=t.dataset.panel;if(n===v)return;e.forEach(r=>r.classList.remove("--active")),t.classList.add("--active"),document.querySelectorAll(".mma-panel").forEach(r=>r.classList.remove("--active"));const a=document.getElementById(`mma-panel-${n}`);a&&a.classList.add("--active"),v=n,await f(n)})})}async function f(e){switch(e){case"config":await L();break;case"applicants":await E();break;case"profiles":await M();break;case"campaigns":await g();break;case"verify":await N();break}}async function L(){try{const e=await c("/api/momentum/admin/config");if(!e.ok)throw new Error("Error al cargar config");const t=await e.json();if(u("mma-cfg-multiplier",t.multiplier),u("mma-cfg-phase",t.phase_name),u("mma-cfg-total-slots",t.total_slots),u("mma-cfg-occupied",t.occupied_slots),t.phase_end_date){const a=new Date(t.phase_end_date).toISOString().slice(0,16);u("mma-cfg-end-date",a)}}catch(e){console.error("[MOMENTUM ADMIN] Error cargando config:",e),o("Error al cargar configuración.","error")}}async function T(){const e={multiplier:parseFloat(document.getElementById("mma-cfg-multiplier")?.value)||1,phase_name:document.getElementById("mma-cfg-phase")?.value||"",total_slots:parseInt(document.getElementById("mma-cfg-total-slots")?.value)||0,occupied_slots:parseInt(document.getElementById("mma-cfg-occupied")?.value)||0,phase_end_date:document.getElementById("mma-cfg-end-date")?.value||null};try{const t=await c("/api/momentum/admin/config",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(e)});if(t.ok)o("✅ Configuración guardada correctamente.","success");else{const n=await t.json();o(n.message||"Error al guardar.","error")}}catch(t){console.error("[MOMENTUM ADMIN] Error guardando config:",t),o("Error de conexión.","error")}}async function E(){const e=document.getElementById("mma-applicants-list");if(e){e.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const t=await c("/api/momentum/admin/applicants");if(!t.ok)throw new Error("Error");const n=await t.json();if(n.length===0){e.innerHTML='<div class="mmd-empty">No hay postulantes pendientes.</div>';return}e.innerHTML=`
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
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
                            ${n.map(a=>`
                                <tr>
                                    <td><strong>${s(a.username)}</strong></td>
                                    <td>${s(a.nickname)}</td>
                                    <td>${s(a.social_platform)}</td>
                                    <td>${(a.followers_count||0).toLocaleString("es-ES")}</td>
                                    <td><a href="${b(a.social_link)}" target="_blank" rel="noopener" style="color: var(--mma-blue); font-weight: 600;">Ver ↗</a></td>
                                    <td>${s(a.niche||"—")}</td>
                                    <td>
                                        <select class="mma-tier-select" data-profile-id="${a.id}">
                                            <option value="">Seleccionar...</option>
                                            <option value="VISIONARIO">👀 Visionario</option>
                                            <option value="BRONCE">🥉 Bronce</option>
                                            <option value="PLATA">🥈 Plata</option>
                                            <option value="ORO">🥇 Oro</option>
                                        </select>
                                        <button class="mma-btn mma-btn--gold mma-btn--small mma-assign-tier-btn" 
                                                data-profile-id="${a.id}" style="margin-left: 6px;">
                                            ✓ Asignar
                                        </button>
                                    </td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `,e.querySelectorAll(".mma-assign-tier-btn").forEach(a=>{a.addEventListener("click",()=>S(a.dataset.profileId))})}catch(t){console.error("[MOMENTUM ADMIN] Error cargando postulantes:",t),e.innerHTML='<div class="mmd-empty">Error al cargar postulantes.</div>'}}}async function S(e){const n=document.querySelector(`select[data-profile-id="${e}"]`)?.value;if(!n){o("Selecciona un tier primero.","error");return}try{const a=await c(`/api/momentum/admin/profiles/${e}/tier`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({tier:n})}),r=await a.json();a.ok?(o(`✅ Tier ${n} asignado correctamente.`,"success"),await E()):o(r.message||"Error al asignar tier.","error")}catch{o("Error de conexión.","error")}}async function M(){const e=document.getElementById("mma-profiles-list");if(e){e.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const t=await c("/api/momentum/admin/profiles");if(!t.ok)throw new Error("Error");const n=await t.json();if(n.length===0){e.innerHTML='<div class="mmd-empty">No hay influencers registrados.</div>';return}e.innerHTML=`
            <div class="mma-stats-row">
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.length}</div>
                    <div class="mma-stat-card__label">Total Influencers</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.filter(a=>a.tier==="VISIONARIO").length}</div>
                    <div class="mma-stat-card__label">👀 Visionario</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.filter(a=>a.tier==="BRONCE").length}</div>
                    <div class="mma-stat-card__label">🥉 Bronce</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.filter(a=>a.tier==="PLATA").length}</div>
                    <div class="mma-stat-card__label">🥈 Plata</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.filter(a=>a.tier==="ORO").length}</div>
                    <div class="mma-stat-card__label">🥇 Oro</div>
                </div>
                <div class="mma-stat-card">
                    <div class="mma-stat-card__value">${n.filter(a=>a.tier==="PLATINO").length}</div>
                    <div class="mma-stat-card__label">💎 Platino</div>
                </div>
            </div>
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
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
                            ${n.map(a=>{const r=`<span class="mma-badge --${a.tier.toLowerCase()}">${a.tier}</span>`,i=new Date(a.created_at).toLocaleDateString("es-ES");return`
                                    <tr>
                                        <td><strong>${s(a.nickname)}</strong></td>
                                        <td>${s(a.username)}</td>
                                        <td>${r}</td>
                                        <td>${s(a.social_platform)}</td>
                                        <td>${(a.followers_count||0).toLocaleString("es-ES")}</td>
                                        <td>${i}</td>
                                    </tr>
                                `}).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `}catch(t){console.error("[MOMENTUM ADMIN] Error cargando perfiles:",t),e.innerHTML='<div class="mmd-empty">Error al cargar influencers.</div>'}}}let h=[];async function g(){const e=document.getElementById("mma-campaigns-list");if(e){e.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const t=await c("/api/momentum/admin/campaigns");if(!t.ok)throw new Error("Error");const n=await t.json();if(h=n,n.length===0){e.innerHTML='<div class="mmd-empty">No hay campañas creadas. ¡Crea la primera arriba!</div>';return}e.innerHTML=`
            <div class="mma-table-wrap">
                <div class="mma-table-scroll">
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
                            ${n.map(a=>{const r=a.is_active,i=r?'<span class="mma-badge --aprobado">Activa</span>':'<span class="mma-badge --rechazado">Inactiva</span>',l=a.allow_multiple?'<span class="mma-badge --visionario">Repetible</span>':'<span class="mma-badge --pendiente">Única</span>',d=new Date(a.created_at).toLocaleDateString("es-ES");return`
                                    <tr>
                                        <td><strong>${s(a.title)}</strong></td>
                                        <td>${i}</td>
                                        <td>${l}</td>
                                        <td>${parseFloat(a.base_pay_visionario||0).toLocaleString("es-ES")}</td>
                                        <td>${parseFloat(a.base_pay_bronce).toLocaleString("es-ES")}</td>
                                        <td>${parseFloat(a.base_pay_plata).toLocaleString("es-ES")}</td>
                                        <td>${parseFloat(a.base_pay_oro).toLocaleString("es-ES")}</td>
                                        <td>${parseFloat(a.base_pay_platino||0).toLocaleString("es-ES")}</td>
                                        <td>${d}</td>
                                        <td>
                                            <button class="mma-btn mma-btn--ghost mma-btn--small mma-toggle-status-btn" 
                                                    data-id="${a.id}" data-active="${r}">
                                                ${r?"⏸️ Pausar":"▶️ Activar"}
                                            </button>
                                            <button class="mma-btn mma-btn--ghost mma-btn--small mma-edit-campaign-btn" style="margin-left: 5px;" data-id="${a.id}">
                                                ✏️ Editar
                                            </button>
                                        </td>
                                    </tr>
                                `}).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `,e.querySelectorAll(".mma-toggle-status-btn").forEach(a=>{a.addEventListener("click",()=>C(a.dataset.id,a.dataset.active==="true"))}),e.querySelectorAll(".mma-edit-campaign-btn").forEach(a=>{a.addEventListener("click",()=>F(a.dataset.id))})}catch(t){console.error("[MOMENTUM ADMIN] Error cargando campañas:",t),e.innerHTML='<div class="mmd-empty">Error al cargar campañas.</div>'}}}async function k(){const e=document.getElementById("mma-camp-title")?.value?.trim(),t=document.getElementById("mma-camp-desc")?.value?.trim(),n=parseFloat(document.getElementById("mma-camp-visionario")?.value)||0,a=parseFloat(document.getElementById("mma-camp-bronce")?.value)||0,r=parseFloat(document.getElementById("mma-camp-plata")?.value)||0,i=parseFloat(document.getElementById("mma-camp-oro")?.value)||0,l=parseFloat(document.getElementById("mma-camp-platino")?.value)||0,d=document.getElementById("mma-camp-multiple")?.checked||!1;if(!e){o("El título de la campaña es obligatorio.","error");return}if(n<=0&&a<=0&&r<=0&&i<=0&&l<=0){o("Al menos un pago base debe ser mayor a 0.","error");return}try{const m=await c("/api/momentum/admin/campaigns",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:e,description:t,base_pay_visionario:n,base_pay_bronce:a,base_pay_plata:r,base_pay_oro:i,base_pay_platino:l,allow_multiple:d})}),p=await m.json();m.ok?(o("🎯 Campaña creada exitosamente.","success"),document.getElementById("mma-camp-title").value="",document.getElementById("mma-camp-desc").value="",document.getElementById("mma-camp-visionario").value="",document.getElementById("mma-camp-bronce").value="",document.getElementById("mma-camp-plata").value="",document.getElementById("mma-camp-oro").value="",document.getElementById("mma-camp-platino").value="",document.getElementById("mma-camp-multiple").checked=!1,await g()):o(p.message||"Error al crear campaña.","error")}catch{o("Error de conexión.","error")}}function C(e,t){const n=t?"pausar":"reactivar",a=!t;y(`¿Estás seguro de que deseas ${n} esta campaña?`,async()=>{try{const r=await c(`/api/momentum/admin/campaigns/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({is_active:a})});if(r.ok)o(`Campaña ${a?"reactivada":"pausada"} correctamente.`,"success"),await g();else{const i=await r.json();o(i.message||`Error al ${n}.`,"error")}}catch{o("Error de conexión.","error")}})}async function N(){const e=document.getElementById("mma-verify-list");if(e){e.innerHTML='<div class="mmd-loading"><div class="mmd-spinner"></div></div>';try{const t=await c("/api/momentum/admin/submissions?status=PENDIENTE");if(!t.ok)throw new Error("Error");const n=await t.json();if(n.length===0){e.innerHTML='<div class="mmd-empty">🎉 No hay entregas pendientes de verificación.</div>';return}e.innerHTML=n.map(a=>{const r=new Date(a.submitted_at).toLocaleDateString("es-ES"),i=a.proof_link&&(a.proof_link.startsWith("http://")||a.proof_link.startsWith("https://"))?a.proof_link:"#";return`
                <div class="mma-verify-card" id="mma-verify-${a.id}">
                    <div class="mma-verify-card__header">
                        <div>
                            <div class="mma-verify-card__user">${s(a.nickname)} (@${s(a.username)})</div>
                            <div class="mma-verify-card__campaign">
                                🎯 ${s(a.campaign_title)} · Tier: <strong>${s(a.tier)}</strong> · Enviado: ${r}
                            </div>
                        </div>
                        <span class="mma-badge --pendiente">Pendiente</span>
                    </div>
                    <a href="${b(i)}" target="_blank" rel="noopener noreferrer" class="mma-verify-card__link">
                        📎 ${s(a.proof_link)} ↗
                    </a>
                    <div class="mma-verify-card__actions">
                        <input type="number" step="0.01" min="0" placeholder="Bono extra (opcional)" 
                               class="mma-bonus-input" data-id="${a.id}">
                        <input type="text" placeholder="Nota (obligatoria para rechazar)" 
                               class="mma-note-input" data-id="${a.id}">
                        <button class="mma-btn mma-btn--gold mma-btn--small mma-approve-btn" data-id="${a.id}">
                            ✅ Aprobar
                        </button>
                        <button class="mma-btn mma-btn--ghost mma-btn--small mma-reject-btn" data-id="${a.id}" 
                                style="border-color: var(--mma-red); color: var(--mma-red);">
                            ❌ Rechazar
                        </button>
                    </div>
                </div>
            `}).join(""),e.querySelectorAll(".mma-approve-btn").forEach(a=>{a.addEventListener("click",()=>O(a.dataset.id))}),e.querySelectorAll(".mma-reject-btn").forEach(a=>{a.addEventListener("click",()=>A(a.dataset.id))})}catch(t){console.error("[MOMENTUM ADMIN] Error cargando submissions:",t),e.innerHTML='<div class="mmd-empty">Error al cargar entregas.</div>'}}}async function O(e){const t=document.querySelector(`.mma-bonus-input[data-id="${e}"]`),n=document.querySelector(`.mma-note-input[data-id="${e}"]`),a=parseFloat(t?.value)||0,r=n?.value?.trim()||"";try{const i=await c(`/api/momentum/admin/submissions/${e}/approve`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bonus_extra:a,admin_note:r})}),l=await i.json();if(i.ok){const d=parseFloat(l.paid_amount).toLocaleString("es-ES",{maximumFractionDigits:4});o(`✅ Aprobada — ${d} BLUE IOU acreditados.`,"success");const m=document.getElementById(`mma-verify-${e}`);m&&(m.style.opacity="0",m.style.transform="translateX(100px)",m.style.transition="all 0.4s ease",setTimeout(()=>m.remove(),400))}else o(l.message||"Error al aprobar.","error")}catch{o("Error de conexión.","error")}}function A(e){const t=document.querySelector(`.mma-note-input[data-id="${e}"]`),n=t?.value?.trim();if(!n){o("La nota es OBLIGATORIA para rechazar una entrega.","error"),t&&(t.style.borderColor="var(--mm-red)",t.focus());return}y("¿Rechazar esta entrega? Esta acción es irreversible.",async()=>{try{const a=await c(`/api/momentum/admin/submissions/${e}/reject`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({admin_note:n})}),r=await a.json();if(a.ok){o("❌ Entrega rechazada.","info");const i=document.getElementById(`mma-verify-${e}`);i&&(i.style.opacity="0",i.style.transform="translateX(-100px)",i.style.transition="all 0.4s ease",setTimeout(()=>i.remove(),400))}else o(r.message||"Error al rechazar.","error")}catch{o("Error de conexión.","error")}})}function j(){const e=document.getElementById("mma-save-config");e&&e.addEventListener("click",T);const t=document.getElementById("mma-create-campaign-btn");t&&t.addEventListener("click",k)}async function c(e,t={}){return fetch(`${$}${e}`,{...t,credentials:"include"})}function u(e,t){const n=document.getElementById(e);n&&t!==null&&t!==void 0&&(n.value=t)}function o(e,t="info"){const n=document.getElementById("mmd-toast");n&&(n.textContent=e,n.className=`mmd-toast --${t} --visible`,setTimeout(()=>{n.classList.remove("--visible")},4e3))}function s(e){if(!e)return"";const t=document.createElement("div");return t.textContent=e,t.innerHTML}function b(e){return e?e.replace(/"/g,"&quot;").replace(/'/g,"&#39;").replace(/</g,"&lt;").replace(/>/g,"&gt;"):""}function F(e){const t=h.find(a=>a.id==e);if(!t)return;document.getElementById("edit-camp-id").value=t.id,document.getElementById("edit-camp-title").value=t.title||"",document.getElementById("edit-camp-desc").value=t.description||"",document.getElementById("edit-camp-visionario").value=parseFloat(t.base_pay_visionario||0),document.getElementById("edit-camp-bronce").value=parseFloat(t.base_pay_bronce||0),document.getElementById("edit-camp-plata").value=parseFloat(t.base_pay_plata||0),document.getElementById("edit-camp-oro").value=parseFloat(t.base_pay_oro||0),document.getElementById("edit-camp-platino").value=parseFloat(t.base_pay_platino||0),document.getElementById("edit-camp-multiple")&&(document.getElementById("edit-camp-multiple").checked=!!t.allow_multiple);const n=document.getElementById("mmaEditCampaignModal");n&&(n.style.display="block")}function _(){const e=document.getElementById("mmaEditCampaignModal");e&&(e.style.display="none")}async function P(){const e=document.getElementById("edit-camp-id").value,t=document.getElementById("edit-camp-title").value.trim(),n=document.getElementById("edit-camp-desc").value.trim(),a=parseFloat(document.getElementById("edit-camp-visionario").value)||0,r=parseFloat(document.getElementById("edit-camp-bronce").value)||0,i=parseFloat(document.getElementById("edit-camp-plata").value)||0,l=parseFloat(document.getElementById("edit-camp-oro").value)||0,d=parseFloat(document.getElementById("edit-camp-platino").value)||0,m=document.getElementById("edit-camp-multiple")?.checked||!1;if(!t){o("El título de la campaña es obligatorio.","error");return}try{const p=await c(`/api/momentum/admin/campaigns/${e}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:t,description:n,base_pay_visionario:a,base_pay_bronce:r,base_pay_plata:i,base_pay_oro:l,base_pay_platino:d,allow_multiple:m})}),I=await p.json();p.ok?(o("Campaña actualizada exitosamente.","success"),_(),g()):o(I.message||"Error al actualizar la campaña.","error")}catch(p){console.error("[MOMENTUM ADMIN] Error actualizando campaña:",p),o("Error de red o servidor.","error")}}document.addEventListener("DOMContentLoaded",()=>{const e=document.getElementById("btn-save-edit-campaign");e&&e.addEventListener("click",P);const t=document.getElementById("closeEditCampaignModal");t&&t.addEventListener("click",_)});
//# sourceMappingURL=momentumAdmin.DmGMEvmr.js.map
