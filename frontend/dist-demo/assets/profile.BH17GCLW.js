import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{g as N,s as u}from"./auth.BgcrufBo.js";function s(c){return c==null?"":String(c).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function z(){const c=N(),h=new URLSearchParams(window.location.search),v=h.get("username")||h.get("user")||localStorage.getItem("username"),$=localStorage.getItem("username"),p={profileHeader:document.getElementById("profile-header"),ratingsList:document.getElementById("ratings-list")};if(!v){w("Debes iniciar sesión para ver tu perfil de usuario.",!0),setTimeout(()=>{window.location.href="login.html"},2e3);return}M();async function M(){try{const t=await fetch(`${c}/users/${encodeURIComponent(v)}/profile`);if(!t.ok){const a=await t.json();throw new Error(a.message||`Error ${t.status}`)}const n=await t.json();D(n)}catch(t){console.error("Error al cargar el perfil:",t),w(t.message,!0)}}function D(t){I(t.user),j(t.ratings),$&&$===t.user.username&&(H(t.user.username),_(),x())}async function H(t){const n=document.getElementById("sos-my-case-section");if(n)try{const a=await fetch(`${c}/api/public/sos-venezuela/my-case?username=${encodeURIComponent(t)}`);if(!a.ok)return;const r=await a.json();if(!r.success||!r.has_case||!r.case){n.innerHTML="";return}const e=r.case;let o='<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">En Verificación Manual</span>';e.status==="approved"?o='<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Aprobado</span>':e.status==="disbursed"?o='<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Ayuda Desembolsada</span>':e.status==="rejected"&&(o='<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Rechazado</span>');let i="Necesidades Básicas Urgentes";e.affectation_level==="total_loss"?i="Pérdida Total de Vivienda / Enseres":e.affectation_level==="medical_emergency"?i="Emergencia Médica / Lesionados":e.affectation_level==="partial_damage"&&(i="Daño Parcial en Vivienda");const m=s(`${e.dependents_minors||0} menor(es), ${e.dependents_elderly||0} adulto(s) mayor(es), ${e.dependents_disabled||0} persona(s) con discapacidad`),B=s(`${e.state||""}, ${e.municipality||""}, ${e.sector||""} (${e.address_details||""})`);let L="";r.disbursements&&r.disbursements.length>0&&(L=`
                    <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                        <strong style="color: #0f172a; display: block; margin-bottom: 6px;">💸 Historial de Ayuda Humanitaria Recibida:</strong>
                        <div style="display: flex; flex-direction: column; gap: 6px;">
                            ${r.disbursements.map(l=>`
                                <div style="background: #ffffff; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                                    <div>
                                        <span style="font-weight: 600; color: #2563eb;">+${parseFloat(l.amount_blue).toFixed(2)} BLUE IOU</span>
                                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 8px;">${s(new Date(l.created_at).toLocaleDateString())}</span>
                                    </div>
                                    <span style="font-size: 0.85rem; color: #475569;">${s(l.notes||"Acreditado")}</span>
                                </div>
                            `).join("")}
                        </div>
                    </div>
                `);let S="";e.evidence_urls&&e.evidence_urls.length>0&&(S=`
                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 6px;">Fotos y Evidencias Adjuntas:</strong>
                                <div style="display: flex; flex-wrap: wrap; gap: 6px; align-items: center;">${e.evidence_urls.map(d=>{if(d.includes("drive.google.com")||d.includes("photos.app.goo.gl")||d.includes("photos.google.com"))return`<a href="${s(d)}" target="_blank" style="display: inline-flex; align-items: center; gap: 6px; background: #fff1f2; color: #be123c; padding: 6px 12px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: 500;">🔗 Enlace Google Fotos ↗</a>`;const b=d.startsWith("http")?d:d.startsWith("/")?`${c}${d}`:`${c}/${d}`;return`<a href="${s(b)}" target="_blank" title="Ver foto completa"><img src="${s(b)}" alt="Evidencia SOS" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid #fecdd3; margin-right: 6px;"></a>`}).join("")}</div>
                            </div>
                        `);let T="";r.history&&r.history.length>0&&(T=`
                            <div style="margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 10px;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 8px;">📋 Historial y Bitácora del Expediente:</strong>
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    ${r.history.map(l=>{const d=new Date(l.created_at),A=String(d.getDate()).padStart(2,"0"),b=String(d.getMonth()+1).padStart(2,"0"),q=d.getFullYear(),U=String(d.getHours()).padStart(2,"0"),O=String(d.getMinutes()).padStart(2,"0"),F=`${A}/${b}/${q} ${U}:${O}`;let g=l.event_type,f="#9f1239";return l.event_type==="registered"?(g="EXPEDIENTE CREADO",f="#0284c7"):l.event_type==="approved_for_aid"?(g="APROBADO PARA AYUDA",f="#166534"):l.event_type==="disbursed"?(g="AYUDA ENTREGADA",f="#6d28d9"):l.event_type==="info_requested"?(g="INFORMACIÓN ADICIONAL REQUERIDA",f="#b45309"):l.event_type==="rejected"&&(g="EXPEDIENTE RECHAZADO",f="#991b1b"),`
                                            <div style="background: #fafafa; padding: 10px 12px; border-radius: 8px; border-left: 4px solid ${f}; border-top: 1px solid #f1f5f9; border-right: 1px solid #f1f5f9; border-bottom: 1px solid #f1f5f9; display: flex; flex-direction: column; gap: 4px;">
                                                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem; color: #64748b;">
                                                    <span style="font-weight: bold; text-transform: uppercase; color: ${f};">${s(g)}</span>
                                                    <span>📅 ${F}</span>
                                                </div>
                                                <p style="margin: 0; font-size: 0.85rem; color: #334155;">${s(l.message)}</p>
                                            </div>
                                        `}).join("")}
                                </div>
                            </div>
                        `),n.innerHTML=`
                        <div style="background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%); border: 1px solid #fecdd3; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(219, 39, 119, 0.08); margin-bottom: 1.5rem; text-align: left;">
                            <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 1px solid #fecdd3; padding-bottom: 12px; margin-bottom: 12px;">
                                <h3 style="margin: 0; color: #9f1239; font-size: 1.25rem; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; flex: 1; min-width: 240px;">
                                    <span style="white-space: nowrap;">Mi caso</span>
                                    <span style="font-size: 0.9rem; color: #db2777; font-weight: normal; white-space: nowrap;">(#${s(e.dossier_number)})</span>
                                </h3>
                                <div style="flex-shrink: 0; margin-top: 2px;">
                                    ${o}
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 0.95rem; color: #334155;">
                                <div><strong>Cédula:</strong> ${s(e.id_document)}</div>
                                <div><strong>Edad:</strong> ${s(String(e.age||18))} años</div>
                                <div><strong>Ubicación:</strong> ${B}</div>
                                <div><strong>Censo Familiar:</strong> ${m}</div>
                                <div><strong>Gravedad:</strong> ${s(i)}</div>
                                <div><strong>Fecha de Registro:</strong> ${s(new Date(e.created_at).toLocaleDateString())}</div>
                            </div>

                            <div style="margin-top: 10px; background: rgba(255,255,255,0.7); padding: 10px 12px; border-radius: 8px; border: 1px solid #f1f5f9;">
                                <strong style="color: #0f172a; display: block; margin-bottom: 4px;">Relato / Solicitud:</strong>
                                <p style="margin: 0; font-size: 0.9rem; color: #475569; font-style: italic;">"${s(e.description)}"</p>
                            </div>

                            ${S}

                            ${L}

                            ${T}
                        </div>
                    `}catch(a){console.error("Error al cargar datos de Mi caso SOS:",a)}}function I(t){const n=R(t.average_rating,t.ratings_count);let a="";if(t.web3_wallet_address){const r=s(t.web3_wallet_address);a=`
                <div class="profile-wallet-container" style="display: flex; align-items: center; justify-content: center; margin-top: 10px; background: rgba(255,255,255,0.05); padding: 8px 15px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); width: fit-content; margin-left: auto; margin-right: auto;">
                    <span style="color: #888; font-size: 14px; margin-right: 8px;">Billetera Web3:</span>
                    <span id="walletAddressText" style="font-family: monospace; font-size: 14px; color: #fff; margin-right: 10px;">${r.substring(0,6)+"..."+r.substring(r.length-4)}</span>
                    <button id="copyWalletBtn" data-address="${r}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center; justify-content: center;" title="Copiar dirección">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `}p.profileHeader.innerHTML=`
            <h1 class="profile-username">${s(t.username)}</h1>
            <div class="profile-rating">${n}</div>
            ${a}
        `,t.web3_wallet_address&&document.getElementById("copyWalletBtn").addEventListener("click",function(){const r=this.dataset.address;copyTextToClipboard(r).then(()=>{const e=this.innerHTML;this.innerHTML='<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>',setTimeout(()=>{this.innerHTML=e},2e3)}).catch(e=>{console.error("Error al copiar: ",e)})})}function j(t){if(!t||t.length===0){p.ratingsList.innerHTML='<p class="empty-message">Este usuario aún no ha recibido ninguna calificación.</p>';return}p.ratingsList.innerHTML=t.map(n=>C(n)).join("")}function C(t){const n="★".repeat(t.rating||0)+"☆".repeat(5-(t.rating||0)),a=s(new Date(t.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"}));return`
            <div class="rating-item">
                <div class="rating-item-header">
                    <span class="rating-item-rater">De: <strong>${s(t.rater_username)}</strong></span>
                    <span class="rating-item-stars">${n}</span>
                </div>
                ${t.comment?`<p class="rating-item-comment">"${s(t.comment)}"</p>`:""}
                <div class="rating-item-footer"><span>${a}</span></div>
            </div>
        `}function w(t,n=!1){p.profileHeader&&(p.profileHeader.innerHTML=""),p.ratingsList&&(p.ratingsList.innerHTML=""),u(t,()=>{n&&(window.location.href="contract_interaction.html")})}function R(t,n){if(!n||n===0)return'<span class="no-rating">Sin calificaciones</span>';const a=parseFloat(t).toFixed(1),r="★".repeat(Math.round(t))+"☆".repeat(5-Math.round(t));return`
            <span class="stars" title="${a} de 5 estrellas">${r}</span> 
            <span class="rating-summary"><strong>${a}</strong> de 5 (${n} calificaciones)</span>
        `}async function _(){const t=document.getElementById("tutor-pending-requests-section");if(!t)return;const n=localStorage.getItem("token");if(n)try{const a=await fetch(`${c}/api/minor/tutor-requests/pending`,{headers:{Authorization:`Bearer ${n}`}});if(!a.ok)return;const r=await a.json();if(!r.pending_requests||r.pending_requests.length===0){t.innerHTML="";return}t.innerHTML=`
                <div class="tutor-pending-card" style="background: linear-gradient(135deg, #eff6ff 0%, #ffffff 100%); border: 1px solid #bfdbfe; border-radius: 12px; padding: 18px; margin-bottom: 1.5rem; text-align: left;">
                    <h3 style="margin: 0 0 12px 0; color: #1e40af; font-size: 1.15rem; display: flex; align-items: center; gap: 8px;">
                        <span>⚖️ Solicitudes de Tutela Legal Pendientes</span>
                        <span style="background: #2563eb; color: #fff; font-size: 0.75rem; padding: 2px 8px; border-radius: 999px;">${r.pending_requests.length}</span>
                    </h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${r.pending_requests.map(e=>`
                            <div style="background: #ffffff; padding: 12px; border-radius: 8px; border: 1px solid #dbeafe; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px;">
                                <div>
                                    <strong style="color: #0f172a; font-size: 1rem;">@${s(e.minor_username)}</strong>
                                    <span style="color: #64748b; font-size: 0.85rem; margin-left: 6px;">(${s(e.minor_email||"")})</span>
                                    <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">Solicitado el: ${s(new Date(e.created_at).toLocaleDateString())}</div>
                                </div>
                                <div style="display: flex; gap: 8px;">
                                    <button class="btn-tutor-approve" data-id="${e.request_id}" data-username="${s(e.minor_username)}" style="background: #059669; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Aprobar Tutela</button>
                                    <button class="btn-tutor-reject" data-id="${e.request_id}" data-username="${s(e.minor_username)}" style="background: #dc2626; color: #fff; border: none; padding: 8px 14px; border-radius: 6px; font-weight: 600; cursor: pointer;">Rechazar</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                </div>
            `,t.querySelectorAll(".btn-tutor-approve").forEach(e=>{e.addEventListener("click",function(){P(this.dataset.id,this.dataset.username)})}),t.querySelectorAll(".btn-tutor-reject").forEach(e=>{e.addEventListener("click",function(){E(this.dataset.id,"reject",!1)})})}catch(a){console.error("Error al cargar solicitudes de tutela:",a)}}let k=null;function P(t,n){k=t;const a=document.getElementById("tutorLegalApprovalModal"),r=document.getElementById("chkAcceptTutorTerms"),e=document.getElementById("btnConfirmTutorApprove");a&&(r.checked=!1,e.disabled=!0,a.style.display="flex",r.onchange=function(){e.disabled=!this.checked},document.getElementById("closeTutorLegalModal").onclick=()=>a.style.display="none",document.getElementById("btnCancelTutorApprove").onclick=()=>a.style.display="none",e.onclick=function(){a.style.display="none",E(k,"approve",!0)})}async function E(t,n,a){const r=localStorage.getItem("token");try{const e=await fetch(`${c}/api/minor/tutor-requests/${t}/respond`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${r}`},body:JSON.stringify({action:n,termsAccepted:a})}),o=await e.json();if(!e.ok){u(o.message||"Error al procesar respuesta.");return}u(o.message),_(),x()}catch(e){console.error("Error al responder tutela:",e),u("Error de red al procesar la respuesta.")}}async function x(){const t=document.getElementById("tutor-parental-controls-section");if(!t)return;const n=localStorage.getItem("token");if(n)try{const a=await fetch(`${c}/api/minor/children`,{headers:{Authorization:`Bearer ${n}`}});if(!a.ok)return;const r=await a.json();if(!r.children||r.children.length===0){t.innerHTML="";return}t.innerHTML=`
                <div class="tutor-children-card" style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 1.5rem; text-align: left;">
                    <h3 style="margin: 0 0 16px 0; color: #0f172a; font-size: 1.2rem; display: flex; align-items: center; justify-content: space-between;">
                        <span>👨‍👩‍👧‍👦 Controles Parentales (Menores a Cargo)</span>
                        <span style="font-size: 0.85rem; color: #64748b; font-weight: normal;">${r.children.length} menor(es) vinculado(s)</span>
                    </h3>

                    <div style="display: flex; flex-direction: column; gap: 16px;">
                        ${r.children.map(e=>{const o=e.is_suspended_by_tutor,i=typeof e.tutor_permissions=="string"?JSON.parse(e.tutor_permissions):e.tutor_permissions||{};return`
                                <div style="background: ${o?"#fef2f2":"#f8fafc"}; border: 1px solid ${o?"#fecdd3":"#e2e8f0"}; border-radius: 10px; padding: 16px;">
                                    <div style="display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 12px;">
                                        <div>
                                            <strong style="font-size: 1.1rem; color: #0f172a;">@${s(e.username)}</strong>
                                            <span style="margin-left: 8px; font-size: 0.8rem; padding: 2px 8px; border-radius: 999px; font-weight: 600; background: ${o?"#fee2e2; color: #991b1b;":"#dcfce7; color: #166534;"};">
                                                ${o?"⏸️ Cuenta Pausada":"✅ Cuenta Activa"}
                                            </span>
                                        </div>
                                        <div>
                                            <button class="btn-toggle-pause" data-id="${e.id}" data-suspended="${!o}" style="background: ${o?"#059669":"#dc2626"}; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem;">
                                                ${o?"▶️ Reanudar Cuenta":"⏸️ Congelar Acceso"}
                                            </button>
                                        </div>
                                    </div>

                                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 12px;">
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${e.id}" data-perm="allow_contracting" ${i.allow_contracting?"checked":""} ${o?"disabled":""}>
                                            <span>Contratar Tareas (RED)</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${e.id}" data-perm="allow_selling" ${i.allow_selling?"checked":""} ${o?"disabled":""}>
                                            <span>Publicar Ventas</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${e.id}" data-perm="allow_donations" ${i.allow_donations?"checked":""} ${o?"disabled":""}>
                                            <span>Realizar Donaciones</span>
                                        </label>
                                        <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #334155;">
                                            <input type="checkbox" class="chk-perm" data-child-id="${e.id}" data-perm="allow_p2p" ${i.allow_p2p?"checked":""} ${o?"disabled":""}>
                                            <span>Operaciones P2P</span>
                                        </label>
                                    </div>

                                    <div style="display: flex; align-items: center; gap: 10px; background: #ffffff; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0;">
                                        <span style="font-size: 0.85rem; color: #475569; font-weight: 600;">Límite de Deuda RED Máximo:</span>
                                        <input type="number" class="input-max-debt" data-child-id="${e.id}" value="${parseFloat(i.max_red_debt||20).toFixed(2)}" step="5" min="0" max="500" style="width: 90px; padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 4px;" ${o?"disabled":""}>
                                        <span style="font-size: 0.85rem; color: #64748b;">RED</span>
                                        <button class="btn-save-debt" data-child-id="${e.id}" style="background: #2563eb; color: #fff; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.8rem; cursor: pointer;" ${o?"disabled":""}>Guardar Límite</button>
                                    </div>
                                </div>
                            `}).join("")}
                    </div>
                </div>
            `,t.querySelectorAll(".btn-toggle-pause").forEach(e=>{e.addEventListener("click",function(){const o=this.dataset.id,i=this.dataset.suspended==="true";y(o,{is_suspended_by_tutor:i})})}),t.querySelectorAll(".chk-perm").forEach(e=>{e.addEventListener("change",function(){const o=this.dataset.childId,i=this.dataset.perm;y(o,{permissions:{[i]:this.checked}})})}),t.querySelectorAll(".btn-save-debt").forEach(e=>{e.addEventListener("click",function(){const o=this.dataset.childId,i=t.querySelector(`.input-max-debt[data-child-id="${o}"]`),m=parseFloat(i.value);if(isNaN(m)||m<0){u("Ingresa un monto de deuda válido.");return}y(o,{permissions:{max_red_debt:m}})})})}catch(a){console.error("Error al cargar controles parentales:",a)}}async function y(t,n){const a=localStorage.getItem("token");try{const r=await fetch(`${c}/api/minor/children/${t}/controls`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${a}`},body:JSON.stringify(n)}),e=await r.json();if(!r.ok){u(e.message||"Error al actualizar controles.");return}x()}catch(r){console.error("Error al actualizar controles parentales:",r)}}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",z):z();
//# sourceMappingURL=profile.BH17GCLW.js.map
