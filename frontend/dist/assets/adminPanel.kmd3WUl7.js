import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                    *//* empty css                     */import"./index.Dk_Cx65J.js";import{g as _t}from"./config.Br4uoD7s.js";import{showCustomAlert as u,showCustomConfirm as T}from"./alerts.CawRDXDp.js";import"./auth.PfzP10z-.js";window.getApiUrl=_t;window.showCustomAlert=u;window.showCustomConfirm=T;console.log("[AdminPanel] ES Module loaded - Full version");document.addEventListener("DOMContentLoaded",()=>{function l(t){return t==null?"":String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function h(t){const n=(Number(t)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),o=n.split(",");return o.length===2?`${o[0]},<span class="decimal-part">${o[1]}</span>`:n}const j=_t(),e={navLinks:document.querySelectorAll(".nav-link"),sections:document.querySelectorAll(".admin-section"),logoutBtn:document.getElementById("adminLogoutBtn"),settingsContainer:document.getElementById("settings-switches"),phaseManagementContainer:document.getElementById("phase-management-switches"),dashboardContainer:document.getElementById("dashboard-stats"),usersTableContainer:document.getElementById("users-table-container"),userSearchInput:document.getElementById("userSearchInput"),userStatusFilter:document.getElementById("userStatusFilter"),debtorsTableContainer:document.getElementById("debtors-table-container"),publicationsTableContainer:document.getElementById("publications-table-container"),publicationSearchInput:document.getElementById("publicationSearchInput"),publicationStatusFilter:document.getElementById("publicationStatusFilter"),platformWalletStatsContainer:document.getElementById("platform-wallet-stats"),platformCommissionLogContainer:document.getElementById("platform-commission-log-container"),platformPublicationForm:document.getElementById("platformPublicationForm"),platformStepInputs:document.getElementById("platformStepInputs"),platformAddStepBtn:document.getElementById("platformAddStepBtn"),platformEditNotice:document.getElementById("platformEditNotice"),platformCancelEditBtn:document.getElementById("platformCancelEditBtn"),platformPublicationSubmitBtn:document.getElementById("platformPublicationSubmitBtn"),platformManagementList:document.getElementById("platform-management-list"),platformPublicationsBadge:document.getElementById("platformPublicationsBadge"),platformPublicationSearchInput:document.getElementById("platformPublicationSearchInput"),platformPublicationStatusFilter:document.getElementById("platformPublicationStatusFilter"),platformPublicationSortSelect:document.getElementById("platformPublicationSortSelect"),platformRepeatLimit:document.getElementById("platformRepeatLimit"),platformRepeatLimitWrapper:document.getElementById("platformRepeatLimitWrapper"),platformRepeatCooldownDays:document.getElementById("platformRepeatCooldownDays"),platformRepeatCooldownHours:document.getElementById("platformRepeatCooldownHours"),platformRepeatCooldownMinutes:document.getElementById("platformRepeatCooldownMinutes"),platformRepeatCooldownWrapper:document.getElementById("platformRepeatCooldownWrapper"),auditLogContainer:document.getElementById("audit-log-container"),auditEventTypeInput:document.getElementById("auditEventTypeInput"),auditActorInput:document.getElementById("auditActorInput"),auditTargetInput:document.getElementById("auditTargetInput"),auditCategoryInput:document.getElementById("auditCategoryInput"),auditFromInput:document.getElementById("auditFromInput"),auditToInput:document.getElementById("auditToInput"),auditLimitSelect:document.getElementById("auditLimitSelect"),auditApplyFiltersBtn:document.getElementById("auditApplyFiltersBtn"),auditExportCsvBtn:document.getElementById("auditExportCsvBtn"),referralsSettingsContainer:document.getElementById("referrals-settings-container"),referralsLogContainer:document.getElementById("referrals-log-container"),boosterSection:document.getElementById("boosters-section"),boostersSettingsContainer:document.getElementById("boosters-settings-container"),boostersDashboardStats:document.getElementById("boosters-dashboard-stats"),boostersListContainer:document.getElementById("boosters-list-container"),boostersStagesContainer:document.getElementById("boosters-stages-container"),notificationsSection:document.getElementById("notifications-section"),pushNotificationForm:document.getElementById("pushNotificationForm"),emailBroadcastForm:document.getElementById("emailBroadcastForm"),broadcastTargetGroup:document.getElementById("broadcastTargetGroup"),broadcastSpecificUserGroup:document.getElementById("broadcastSpecificUserGroup"),broadcastHistoryContainer:document.getElementById("email-broadcast-history-container"),academySection:document.getElementById("academy-section"),academyVideoForm:document.getElementById("academyVideoForm"),academyTableContainer:document.getElementById("academy-table-container"),academyVideoUrl:document.getElementById("academyVideoUrl"),academyVideoTitle:document.getElementById("academyVideoTitle"),academyVideoOrder:document.getElementById("academyVideoOrder"),humanitarianStatsContainer:document.getElementById("humanitarian-stats"),humanitarianTableContainer:document.getElementById("humanitarian-table-container"),humanitarianSearchInput:document.getElementById("humanitarianSearchInput"),humanitarianStatusFilter:document.getElementById("humanitarianStatusFilter"),humanitarianBadge:document.getElementById("humanitarianBadge"),humanitarianDetailModal:document.getElementById("humanitarianDetailModal"),humanitarianModalTitle:document.getElementById("humanitarianModalTitle"),humanitarianModalBody:document.getElementById("humanitarianModalBody"),humanitarianModalActions:document.getElementById("humanitarianModalActions"),govRewardsStats:document.getElementById("gov-rewards-stats"),govRewardsAction:document.getElementById("gov-rewards-action"),govRewardsSummary:document.getElementById("gov-rewards-summary"),govRewardsDescription:document.getElementById("gov-rewards-description"),govRewardsProcessBtn:document.getElementById("gov-rewards-process-btn"),govRewardsResult:document.getElementById("gov-rewards-result"),govExportStats:document.getElementById("gov-export-stats"),govExportBtn:document.getElementById("gov-export-btn"),govExportResult:document.getElementById("gov-export-result"),govExportHistory:document.getElementById("gov-export-history"),govImportFile:document.getElementById("gov-import-file"),govImportValidateBtn:document.getElementById("gov-import-validate-btn"),govImportPreview:document.getElementById("gov-import-preview"),govImportProcessBtn:document.getElementById("gov-import-process-btn"),govImportResult:document.getElementById("gov-import-result")};let $=[],R=null;Ct(),tt("dashboard"),at(),J(),setInterval(at,3e4),setInterval(J,3e4);function Ct(){e.navLinks.forEach(d=>{d.addEventListener("click",p=>{const g=d.dataset.section;g&&(p.preventDefault(),tt(g))})}),e.logoutBtn&&e.logoutBtn.addEventListener("click",async d=>{d.preventDefault();try{await fetch(`${j}/api/admin/logout`,{method:"POST",credentials:"include"})}catch(p){console.error("Error al cerrar sesión",p)}window.location.href="admin.html"}),e.settingsContainer&&(e.settingsContainer.addEventListener("change",x),e.settingsContainer.addEventListener("keyup",d=>{d.target.type==="number"&&x(d)})),e.phaseManagementContainer&&e.phaseManagementContainer.addEventListener("change",x);let t;e.userSearchInput&&e.userSearchInput.addEventListener("keyup",()=>{clearTimeout(t),t=setTimeout(()=>{k(e.userSearchInput.value,e.userStatusFilter.value)},300)}),e.userStatusFilter&&e.userStatusFilter.addEventListener("change",()=>{k(e.userSearchInput.value,e.userStatusFilter.value)}),e.usersTableContainer&&e.usersTableContainer.addEventListener("click",Ot),document.addEventListener("click",d=>{!d.target.closest(".action-menu-container")&&!d.target.closest(".menu-toggle")&&document.querySelectorAll(".action-menu.visible").forEach(p=>{p.classList.remove("visible")})});let a;e.publicationSearchInput&&e.publicationSearchInput.addEventListener("keyup",()=>{clearTimeout(a),a=setTimeout(()=>{M(e.publicationSearchInput.value,e.publicationStatusFilter?.value||"active")},300)}),e.publicationStatusFilter&&e.publicationStatusFilter.addEventListener("change",()=>{M(e.publicationSearchInput.value,e.publicationStatusFilter.value)}),e.publicationsTableContainer&&e.publicationsTableContainer.addEventListener("click",jt),e.platformPublicationForm&&e.platformPublicationForm.addEventListener("submit",Wt);let n;e.platformPublicationSearchInput&&e.platformPublicationSearchInput.addEventListener("keyup",()=>{clearTimeout(n),n=setTimeout(()=>{D()},250)}),e.platformPublicationStatusFilter&&e.platformPublicationStatusFilter.addEventListener("change",D),e.platformPublicationSortSelect&&e.platformPublicationSortSelect.addEventListener("change",D);const o=document.getElementById("platformAllowRepeatParticipation");if(o&&e.platformRepeatLimitWrapper&&e.platformRepeatCooldownWrapper){const d=()=>{e.platformRepeatLimitWrapper.style.display=o.checked?"flex":"none",e.platformRepeatCooldownWrapper.style.display=o.checked?"flex":"none",!o.checked&&e.platformRepeatLimit&&(e.platformRepeatLimit.value="2"),o.checked||(e.platformRepeatCooldownDays&&(e.platformRepeatCooldownDays.value="0"),e.platformRepeatCooldownHours&&(e.platformRepeatCooldownHours.value="0"),e.platformRepeatCooldownMinutes&&(e.platformRepeatCooldownMinutes.value="12"))};o.addEventListener("change",d),d()}e.platformCancelEditBtn&&e.platformCancelEditBtn.addEventListener("click",gt);const r=document.getElementById("platformFormToggle"),i=document.getElementById("platformFormContent");r&&i&&r.addEventListener("click",()=>{const d=i.style.display!=="none";i.style.display=d?"none":"block",r.classList.toggle("expanded",!d)}),e.platformAddStepBtn&&e.platformStepInputs&&e.platformAddStepBtn.addEventListener("click",()=>{const p=e.platformStepInputs.querySelectorAll(".admin-step-input").length;if(p>=20){e.platformAddStepBtn.disabled=!0;return}const g=p+1,y=document.createElement("div");y.className="admin-step-input",y.setAttribute("data-step",g);const b=g>=2?`
                    <div class="step-form-toggle">
                        <label class="toggle-label">
                            <input type="checkbox" class="step-form-checkbox" data-step="${g}">
                            <span>Activar formulario para este paso</span>
                        </label>
                        <div class="step-form-fields" style="display: none;">
                            <p class="form-hint">Define los campos que el usuario debe completar:</p>
                            <div class="step-form-inputs">
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 1">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 2">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                                <div class="step-form-field-wrapper">
                                    <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                </div>
                            </div>
                            <button type="button" class="step-add-field-btn">+ Agregar más campos</button>
                        </div>
                    </div>
                `:"";y.innerHTML=`
                    <label for="platformStep${g}">Paso ${g}</label>
                    <input type="text" id="platformStep${g}" placeholder="Describe el paso ${g}">
                    ${b}
                `,e.platformStepInputs.appendChild(y),e.platformStepInputs.querySelectorAll(".admin-step-input").length>=20&&(e.platformAddStepBtn.disabled=!0)}),e.platformStepInputs&&(e.platformStepInputs.addEventListener("change",d=>{if(d.target.classList.contains("step-form-checkbox")){const g=d.target.closest(".admin-step-input").querySelector(".step-form-fields");g&&(g.style.display=d.target.checked?"block":"none")}}),e.platformStepInputs.addEventListener("click",d=>{if(d.target.classList.contains("step-add-field-btn")){const p=d.target.previousElementSibling,g=p.querySelectorAll(".step-form-field-wrapper").length;if(g<10){const y=document.createElement("div");y.className="step-form-field-wrapper",y.innerHTML=`
                            <input type="text" class="step-form-field" placeholder="Campo ${g+1}">
                            <select class="step-form-type-select" title="Tipo de campo">
                                <option value="text">Texto corto</option>
                                <option value="textarea">Texto largo</option>
                            </select>
                        `,p.appendChild(y)}g>=9&&(d.target.style.display="none")}})),e.platformManagementList&&e.platformManagementList.addEventListener("click",Gt),e.auditApplyFiltersBtn&&e.auditApplyFiltersBtn.addEventListener("click",()=>{ot()}),e.auditExportCsvBtn&&e.auditExportCsvBtn.addEventListener("click",()=>{Pt()}),e.boosterSection&&e.boosterSection.querySelectorAll(".tab-link").forEach(p=>{p.addEventListener("click",()=>{const g=p.dataset.tab;et(g)})}),e.notificationsSection&&e.notificationsSection.querySelectorAll(".tab-link").forEach(p=>{p.addEventListener("click",()=>{const g=p.dataset.tab;bt(g)})}),e.broadcastTargetGroup&&e.broadcastTargetGroup.addEventListener("change",d=>{e.broadcastSpecificUserGroup&&(e.broadcastSpecificUserGroup.style.display=d.target.value==="specific"?"block":"none")}),e.emailBroadcastForm&&e.emailBroadcastForm.addEventListener("submit",Ce);const s=document.getElementById("saveDailyMessagesBtn");s&&s.addEventListener("click",_e);let c;e.humanitarianSearchInput&&e.humanitarianSearchInput.addEventListener("keyup",()=>{clearTimeout(c),c=setTimeout(()=>O(),300)}),e.humanitarianStatusFilter&&e.humanitarianStatusFilter.addEventListener("change",()=>O()),e.humanitarianDetailModal&&(e.humanitarianDetailModal.querySelectorAll(".humanitarian-modal-close").forEach(d=>{d.addEventListener("click",()=>{e.humanitarianDetailModal.style.display="none"})}),e.humanitarianDetailModal.addEventListener("click",d=>{d.target===e.humanitarianDetailModal&&(e.humanitarianDetailModal.style.display="none")}))}function tt(t){e.sections.forEach(o=>o.classList.remove("active-section")),e.navLinks.forEach(o=>o.classList.remove("active"));const a=document.getElementById(`${t}-section`),n=document.querySelector(`.nav-link[data-section="${t}"]`);a&&a.classList.add("active-section"),n&&n.classList.add("active"),t==="dashboard"?$t():t==="settings"?W():t==="users"?k():t==="debtors"?Bt():t==="publications"?M():t==="platform-wallet"?Tt():t==="platform-publications"?z():t==="referrals"?Lt():t==="boosters"?et("boosters-dashboard"):t==="notifications"?bt("notifications-push"):t==="audit-log"?ot():t==="academy"?U():t==="humanitarian"?O():t==="gov-rewards"?K():t==="kyc-compliance"&&Re()}function et(t){if(!e.boosterSection)return;e.boosterSection.querySelectorAll(".tab-content").forEach(o=>o.classList.remove("active")),e.boosterSection.querySelectorAll(".tab-link").forEach(o=>o.classList.remove("active"));const a=document.getElementById(`${t}-tab`),n=document.querySelector(`.tab-link[data-tab="${t}"]`);switch(a&&a.classList.add("active"),n&&n.classList.add("active"),t){case"boosters-dashboard":wt();break;case"boosters-settings":nt();break;case"boosters-stages":Kt();break;case"boosters-list":It();break}}async function m(t,a={}){const n={headers:{"Content-Type":"application/json"},credentials:"include"};a.headers&&(n.headers={...n.headers,...a.headers},delete a.headers);try{const o=await fetch(`${j}${t}`,{...n,...a});if(o.status===401)throw window.location.href="admin.html",new Error("Sesión expirada o no autorizada.");if(o.status===403){const r=await o.json();throw r.governance_required?new Error(r.message):(window.location.href="admin.html",new Error("No autorizado."))}if(!o.ok){const r=await o.json();throw new Error(r.message||`Error del servidor: ${o.status}`)}return o.json()}catch(o){throw o.message==="Sesión expirada o no autorizada."||console.error(`Error en apiFetch a ${t}:`,o),o}}async function k(t="",a=""){if(e.usersTableContainer){e.usersTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const n=await m(`/api/admin/users?search=${encodeURIComponent(t)}&status=${encodeURIComponent(a)}`);ue(n)}catch(n){e.usersTableContainer.innerHTML=`<p class="error-message">Error al cargar los usuarios: ${l(n.message)}</p>`}}}async function Bt(){if(e.debtorsTableContainer){e.debtorsTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/admin/debtors");Zt(t)}catch(t){e.debtorsTableContainer.innerHTML=`<p class="error-message">Error al cargar los deudores: ${l(t.message)}</p>`}}}async function M(t="",a="active"){if(e.publicationsTableContainer){e.publicationsTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const n=await m(`/api/admin/publications?search=${encodeURIComponent(t)}&filter=${encodeURIComponent(a)}`);ge(n)}catch(n){e.publicationsTableContainer.innerHTML=`<p class="error-message">Error al cargar las publicaciones: ${l(n.message)}</p>`}}}async function Tt(){if(e.platformWalletStatsContainer){e.platformWalletStatsContainer.innerHTML='<div class="loading-spinner"></div>',e.platformCommissionLogContainer&&(e.platformCommissionLogContainer.innerHTML='<div class="loading-spinner"></div>');try{const[t,a]=await Promise.all([m("/api/admin/platform-wallet/balance"),m("/api/admin/platform-wallet/log")]);ye(t),be(a)}catch(t){e.platformWalletStatsContainer.innerHTML=`<p class="error-message">Error al cargar datos de la billetera: ${l(t.message)}</p>`,e.platformCommissionLogContainer&&(e.platformCommissionLogContainer.innerHTML="")}}}async function z(){if(e.platformManagementList){e.platformManagementList.innerHTML='<div class="loading-spinner"></div>';try{$=await m("/api/admin/platform/publications-with-participants")||[],D()}catch(t){e.platformManagementList.innerHTML=`<p class="error-message">Error al cargar las publicaciones de la plataforma: ${l(t.message)}</p>`}}}async function at(){try{const t=await m("/api/admin/platform/publications-with-participants"),a=ct(t);pt(a.totalPending)}catch(t){console.warn("No se pudo actualizar el badge de pendientes:",t.message)}}async function $t(){if(e.dashboardContainer){e.dashboardContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/admin/dashboard-stats");Yt(t)}catch(t){e.dashboardContainer.innerHTML=`<p class="error-message">Error al cargar el dashboard: ${l(t.message)}</p>`}}}async function W(){if(e.settingsContainer){e.settingsContainer.innerHTML='<div class="loading-spinner"></div>',e.phaseManagementContainer&&(e.phaseManagementContainer.innerHTML='<div class="loading-spinner"></div>');try{const t=await m("/api/admin/settings");At(t)}catch(t){u(t.message)}}}async function Lt(){if(!(!e.referralsSettingsContainer||!e.referralsLogContainer)){e.referralsSettingsContainer.innerHTML='<div class="loading-spinner"></div>',e.referralsLogContainer.innerHTML='<div class="loading-spinner"></div>';try{const[t,a]=await Promise.all([m("/api/admin/settings"),m("/api/admin/referrals/log")]);Ht(t),ve(a)}catch(t){e.referralsSettingsContainer.innerHTML=`<p class="error-message">Error al cargar la configuración de referidos: ${l(t.message)}</p>`,e.referralsLogContainer.innerHTML=`<p class="error-message">Error al cargar el log de referidos: ${l(t.message)}</p>`}}}async function wt(){if(e.boostersDashboardStats){e.boostersDashboardStats.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/admin/boosters/stats");Nt(t)}catch(t){e.boostersDashboardStats.innerHTML=`<p class="error-message">Error al cargar el dashboard de impulsores: ${l(t.message)}</p>`}}}async function It(){if(e.boostersListContainer){e.boostersListContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/admin/boosters/list");Ut(t)}catch(t){e.boostersListContainer.innerHTML=`<p class="error-message">Error al cargar la lista de impulsores: ${l(t.message)}</p>`}}}async function nt(){if(e.boostersSettingsContainer){e.boostersSettingsContainer.innerHTML='<div class="loading-spinner"></div>';try{const[t,a]=await Promise.all([m("/api/admin/settings"),m("/api/admin/boosters/settings")]);Dt(t,a)}catch(t){e.boostersSettingsContainer.innerHTML=`<p class="error-message">Error al cargar la configuración de impulsores: ${l(t.message)}</p>`}}}async function ot(){if(e.auditLogContainer){e.auditLogContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=rt(),a=await m(`/api/admin/audit-log?${t.toString()}`);Qt(a)}catch(t){e.auditLogContainer.innerHTML=`<p class="error-message">Error al cargar auditoria: ${l(t.message)}</p>`}}}function rt(){const t=new URLSearchParams;return e.auditEventTypeInput?.value&&t.set("eventType",e.auditEventTypeInput.value.trim()),e.auditActorInput?.value&&t.set("actor",e.auditActorInput.value.trim()),e.auditTargetInput?.value&&t.set("target",e.auditTargetInput.value.trim()),e.auditCategoryInput?.value&&t.set("category",e.auditCategoryInput.value.trim()),e.auditFromInput?.value&&t.set("from",e.auditFromInput.value),e.auditToInput?.value&&t.set("to",e.auditToInput.value),e.auditLimitSelect?.value&&t.set("limit",e.auditLimitSelect.value),t}async function Pt(){try{const t=rt();t.get("limit")||t.set("limit","200");const n=(await m(`/api/admin/audit-log?${t.toString()}`))?.rows||[];if(n.length===0){u("No hay eventos para exportar con esos filtros.");return}const o=Rt(n);kt(o,"audit_log.csv")}catch(t){u(`Error al exportar CSV: ${t.message}`)}}function Rt(t){const a=["id","created_at","event_type","actor_username","target_username","publication_id","category","ip_address","user_agent","metadata"],n=[a.join(",")];return t.forEach(o=>{const r=a.map(i=>{const s=i==="metadata"?JSON.stringify(o[i]||{}):o[i]??"";return`"${String(s).replace(/"/g,'""')}"`});n.push(r.join(","))}),n.join(`
`)}function kt(t,a){const n=new Blob([t],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(n),r=document.createElement("a");r.href=o,r.setAttribute("download",a),document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(o)}function it(t){return{allow_new_registrations:{title:"Permitir Nuevos Registros",description:"Activa o desactiva esta característica para toda la plataforma."},public_profiles_enabled:{title:"Perfiles Públicos",description:"Permite que cualquiera vea los perfiles públicos de los usuarios."},debt_system_enabled:{title:"Sistema de Deuda (Tokens RED)",description:"Activa o desactiva la creación y gestión de deuda RED."},platform_commission_percentage:{title:"Comisión de Plataforma (%)",description:"Porcentaje de comisión para la plataforma (ej: 5 para 5%)."},booster_system_enabled:{title:"Sistema de Impulsores",description:"Activa el sistema de Impulsores y su lógica de pagos mensuales."},referral_system_enabled:{title:"Sistema de Referidos",description:"Activa o desactiva el bono por registro con código de referido."},referral_reward_amount:{title:"Recompensa por Referido (BLUE)",description:"Cantidad de BLUE que ganan referente y referido."},referral_reward_after_expiry:{title:"Recompensa después de la promo (BLUE)",description:"Cantidad de BLUE que se otorgará una vez expire la promoción."},referral_codes_expiry_date:{title:"Vigencia hasta",description:"Fecha de expiración de los códigos de referido (formato: YYYY-MM-DD)."},welcome_bonus_enabled:{title:"Bono de Bienvenida",description:"Activa o desactiva el bono al registrarse sin código."},welcome_bonus_amount:{title:"Monto del Bono de Bienvenida (BLUE)",description:"Cantidad de BLUE que se otorga sin código de referido."},pre_launch_mode_enabled:{title:"Modo Pre-Lanzamiento",description:"Todas las ganancias van al Perfil de Impulsor, no se crea RED."},allow_request_publications:{title:'Permitir Publicaciones de "Solicitud"',description:"Los usuarios pueden publicar tareas para que otros las realicen."},allow_sell_publications:{title:'Permitir Publicaciones de "Venta"',description:"Los usuarios pueden publicar productos o servicios para vender."},allow_donation_publications:{title:'Permitir Publicaciones de "Donación"',description:"Los usuarios pueden solicitar donaciones."},allow_quick_sale_publications:{title:'Permitir Publicaciones de "Venta Rápida"',description:"Habilita el botón de Venta Rápida para transacciones exprés."},p2p_enabled:{title:"P2P — Habilitado",description:"Habilita el módulo P2P para compra/venta de BLUE entre usuarios."},p2p_price_min:{title:"P2P — Precio Mínimo (USD)",description:"Precio mínimo permitido por 1 BLUE en USD."},p2p_price_max:{title:"P2P — Precio Máximo (USD)",description:"Precio máximo permitido por 1 BLUE en USD."},p2p_fee_percentage:{title:"P2P — Comisión (%)",description:"Comisión P2P total en porcentaje."},p2p_payment_window_minutes:{title:"P2P — Ventana de Pago (min)",description:"Minutos máximos para confirmar el pago."},p2p_extension_minutes:{title:"P2P — Extensión (min)",description:"Minutos de extensión al aceptar una prórroga."},p2p_extension_limit:{title:"P2P — Límite de Extensiones",description:"Cantidad máxima de extensiones por orden."},p2p_cash_min_rating:{title:"P2P — Reputación Mínima para Efectivo",description:"Calificación mínima requerida para usar efectivo en persona."},gov_quorum_percentage:{title:"Gobernanza — Quórum Requerido (%)",description:"Porcentaje de votos necesarios para aprobar o rechazar (mín. 51, máx. 100)."},gov_timelock_hours:{title:"Gobernanza — Time-Lock (horas)",description:"Horas de espera tras alcanzar el quórum de aprobación, antes de ejecutar un cambio de membresía (reloj del servidor)."},gov_request_expiry_hours:{title:"Gobernanza — Expiración de Solicitud (horas)",description:"Horas que tiene una solicitud para alcanzar quórum."},gov_reminder_threshold_hours:{title:"Gobernanza — Umbral de Recordatorio (horas)",description:"Cuando quedan estas horas para expirar, se envía recordatorio."},gov_reminder_cooldown_hours:{title:"Gobernanza — Enfriamiento entre Recordatorios (horas)",description:"Horas mínimas entre recordatorios al mismo guardián."},gov_vote_reward_blue:{title:"Gobernanza — Recompensa por Voto (BLUE IOU)",description:"BLUE IOU acreditados al guardián al emitir su voto. Valor 0 desactiva la recompensa."},red_credit_base_limit:{title:"Scoring — Límite Base RED (Nuevos Usuarios)",description:"El límite de crédito inicial que se asigna a los nuevos usuarios al registrarse."},red_credit_culture_quiz:{title:"Scoring — Bono por Cuestionario de Cultura (RED)",description:"Aumento del límite por aprobar cuestionarios de la Winton Academy."},red_credit_referral:{title:"Scoring — Bono por Referido Activo (RED)",description:"Aumento del límite por cada referido exitoso que utilice la plataforma."},red_credit_monthly_activity:{title:"Scoring — Bono por Alta Actividad (RED)",description:"Aumento del límite al superar 20 tareas en un mes calendario."},red_credit_early_payment:{title:"Scoring — Bono por Pago Anticipado (RED)",description:"Aumento del límite por pagar deudas en los primeros 5 días del ciclo."}}[t]||{title:t,description:"Sin descripción."}}function Mt(t){return it(t).title}function At(t){const a=t.filter(i=>["pre_launch_mode_enabled","allow_request_publications","allow_sell_publications","allow_donation_publications","allow_quick_sale_publications"].includes(i.setting_key)),n=t.filter(i=>i.setting_key.startsWith("debt_cycle_")||i.setting_key.startsWith("blue_escrow_")),o=["referral_system_enabled","referral_reward_amount","welcome_bonus_enabled","welcome_bonus_amount","referral_bonus_enabled","referral_bonus_amount"],r=t.filter(i=>!a.includes(i)&&!n.includes(i)&&!o.includes(i.setting_key));if(e.phaseManagementContainer&&(e.phaseManagementContainer.innerHTML=a.map(i=>B(i,"switch")).join("")),e.settingsContainer){e.settingsContainer.innerHTML=r.map(s=>s.setting_key.endsWith("_enabled")||s.setting_key.endsWith("registrations")?B(s,"switch"):s.setting_key==="gov_vote_reward_blue"?B(s,"number"):s.setting_key.startsWith("gov_")?B(s,"integer"):s.setting_key.startsWith("p2p_")||s.setting_key.startsWith("red_credit_")||s.setting_key.endsWith("_amount")||s.setting_key.includes("percentage")?B(s,"number"):"").join("");const i={debt_cycle:{label:"Duración del Ciclo de Deuda RED",description:"Define el período de tiempo para esta funcionalidad.",settings:[]},blue_escrow:{label:"Duración del Depósito BLUE (Escrow)",description:"Define el período de tiempo para esta funcionalidad.",settings:[]}};n.forEach(s=>{s.setting_key.startsWith("debt_cycle_")?i.debt_cycle.settings.push(s):s.setting_key.startsWith("blue_escrow_")&&i.blue_escrow.settings.push(s)});for(const s in i)e.settingsContainer.innerHTML+=Ft(i[s]);e.settingsContainer.querySelectorAll('input[type="checkbox"]').forEach(s=>{s.addEventListener("change",x)}),e.settingsContainer.querySelectorAll('input[type="number"]').forEach(s=>{s.addEventListener("change",x),s.addEventListener("keyup",c=>{c.key==="Enter"&&x(c)})})}e.phaseManagementContainer&&e.phaseManagementContainer.querySelectorAll('input[type="checkbox"]').forEach(i=>{i.addEventListener("change",x)})}function B(t,a){const{title:n,description:o}=it(t.setting_key),r=l(t.setting_key),i=l(t.setting_value),s=l(n),c=l(o);let d="";return a==="switch"?d=`
                <label class="switch">
                    <input type="checkbox" data-key="${r}" ${t.setting_value==="true"?"checked":""}>
                    <span class="slider round"></span>
                </label>
            `:a==="number"?d=`
                <input type="number" class="admin-numeric-input" data-key="${r}" value="${parseFloat(t.setting_value).toFixed(2)}" step="0.01" min="0">
            `:a==="integer"?d=`
                <input type="number" class="admin-numeric-input" data-key="${r}" value="${parseInt(t.setting_value,10)||0}" step="1" min="1">
            `:a==="date"&&(d=`
                <input type="date" class="admin-date-input" data-key="${r}" value="${i||""}">
            `),`
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${s}</h4>
                    <p>${c}</p>
                </div>
                <div class="setting-item-control">
                    ${d}
                </div>
            </div>
        `}function Ft(t){return t.settings.length===0?"":(t.settings.sort((a,n)=>{const o=["days","hours","minutes"],r=a.setting_key.split("_").pop(),i=n.setting_key.split("_").pop();return o.indexOf(r)-o.indexOf(i)}),`
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${l(t.label)}</h4>
                    <p>${l(t.description)}</p>
                </div>
                <div class="setting-item-control-group">
                    ${t.settings.map(a=>{const n=a.setting_key.split("_").pop(),o=l(a.setting_key),r=l(a.setting_value);return`
                            <div class="numeric-group-item">
                                <label for="setting-${o}">${n.charAt(0).toUpperCase()+n.slice(1)}</label>
                                <input type="number" class="admin-numeric-input" id="setting-${o}" data-key="${o}" value="${r}" min="0">
                            </div>
                        `}).join("")}
                </div>
            </div>
        `)}function Ht(t){const a=["referral_system_enabled","referral_reward_amount","referral_reward_after_expiry","referral_codes_expiry_date","welcome_bonus_enabled","welcome_bonus_amount"],n=t.filter(r=>a.includes(r.setting_key)),o=document.getElementById("referrals-settings-container");o&&(o.innerHTML=n.map(r=>r.setting_key.endsWith("_enabled")?B(r,"switch"):r.setting_key.endsWith("_amount")||r.setting_key.endsWith("_after_expiry")?B(r,"number"):r.setting_key==="referral_codes_expiry_date"?B(r,"date"):"").join(""),o.querySelectorAll('input[type="checkbox"]').forEach(r=>{r.addEventListener("change",x)}),o.querySelectorAll('input[type="number"]').forEach(r=>{r.addEventListener("change",x),r.addEventListener("keyup",i=>{i.key==="Enter"&&x(i)})}),o.querySelectorAll('input[type="date"]').forEach(r=>{r.addEventListener("change",x)}))}function Dt(t,a){const n=e.boostersSettingsContainer;if(!n)return;n.innerHTML="";const o=t.find(s=>s.setting_key==="booster_system_enabled");if(o){const s=Mt(o.setting_key),c=l(o.setting_key),d=o.description||"Activa o desactiva el programa de impulsores y los pagos mensuales.",p=`
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${l(s)}</h4>
                        <p>${l(d)}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${c}" ${o.setting_value==="true"?"checked":""}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            `;n.innerHTML+=p}n.innerHTML+='<hr class="admin-divider">';const r=`
            <h2>Niveles de Impulsor</h2>
            <p>Define los umbrales de BLUE requeridos para alcanzar cada nivel.</p>
            <div class="table-container-admin">
                <table class="admin-table" id="booster-levels-table">
                    <thead>
                        <tr>
                            <th>Nivel</th>
                            <th>Nombre del Nivel</th>
                            <th>BLUE Mínimo Requerido</th>
                            <th>Descripción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${a.map(s=>`
                            <tr data-level="${l(s.level)}">
                                <td class="level-cell">${l(s.level)}</td>
                                <td><input type="text" class="admin-text-input" data-field="name" value="${l(s.name)}"></td>
                                <td><input type="number" class="admin-numeric-input" data-field="min_blue_required" value="${l(s.min_blue_required)}" step="any"></td>
                                <td><textarea class="admin-textarea-input" data-field="description">${l(s.description||"")}</textarea></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;n.innerHTML+=r,n.querySelectorAll("#booster-levels-table input, #booster-levels-table textarea").forEach(s=>{s.addEventListener("change",qt)});const i=n.querySelector('input[type="checkbox"]');i&&i.addEventListener("change",x)}function Nt(t){e.boostersDashboardStats&&(e.boostersDashboardStats.innerHTML=`
            <div class="stat-card">
                <h4>Impulsores Totales</h4>
                <p class="stat-value">${l(t.total_boosters||0)}</p>
            </div>
            <div class="stat-card">
                <h4>Deuda Total (BLUE de Impulsores)</h4>
                <p class="stat-value saldo-blue-text">${h(t.total_booster_blue_debt)}</p>
            </div>
            <div class="stat-card">
                <h4>Total Pagado (BLUE)</h4>
                <p class="stat-value saldo-blue-text">${h(t.total_blue_paid_out)}</p>
            </div>
            <div class="stat-card">
                <h4>Pagos Mensuales Realizados</h4>
                <p class="stat-value">${l(t.total_payments_made||0)}</p>
            </div>
        `)}function Ut(t){if(!e.boostersListContainer)return;if(!t||t.length===0){e.boostersListContainer.innerHTML='<p class="empty-message">Aún no hay usuarios impulsores en la plataforma.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Nivel de Impulsor</th>
                        <th>Total BLUE de Impulsor</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>`
                        <tr>
                            <td class="username-cell">
                                <a href="profile.html?user=${l(n.username)}" target="_blank">${l(n.username)}</a>
                            </td>
                            <td align="center">${l(n.booster_level)}</td>
                            <td class="saldo-blue-text">${h(n.total_booster_blue)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;e.boostersListContainer.innerHTML=a}let H;async function x(t){const a=t.target;if(!a.dataset.key)return;const n=a.dataset.key;let o;if(a.type==="checkbox")o=a.checked.toString();else if(a.type==="number")o=a.value;else if(a.type==="date"){if(o=a.value,o){const r=new Date(o);if(isNaN(r.getTime())){u("Fecha inválida. Por favor, ingresa una fecha válida."),W();return}}}else return;a.type==="number"||a.type==="date"?(clearTimeout(H),H=setTimeout(()=>{st(n,o)},500)):st(n,o)}async function Ot(t){const a=t.target.closest(".menu-toggle");if(a){t.stopPropagation();const o=a.nextElementSibling,r=o.classList.contains("visible");document.querySelectorAll(".action-menu.visible").forEach(i=>{i.classList.remove("visible")}),r||o.classList.add("visible");return}const n=t.target.closest(".action-button-admin");if(n&&n.dataset.action){const o=n.dataset.action,r=n.closest("tr"),i=r.dataset.userId,s=r.dataset.username,c=r.dataset.status;if(o==="edit-referral"){const b=r.dataset.referralCode||"",f=prompt(`Nuevo código de referido para ${s} (Solo letras, números y guiones):`,b);if(f!==null&&f.trim()!==""&&f!==b)try{const v=await m(`/api/admin/users/${i}/referral-code`,{method:"PUT",body:JSON.stringify({newReferralCode:f.trim().toUpperCase()})});u(v.message||"Código actualizado correctamente."),k(e.userSearchInput.value,e.userStatusFilter.value)}catch(v){u(`Error al actualizar código: ${v.message}`)}return}const d={suspend:{verb:"suspender",noun:"suspensión"},ban:{verb:"banear",noun:"baneo"},activate:{verb:"reactivar",noun:"reactivación"}},{verb:p,noun:g}=d[o];if(o==="suspend"&&c==="suspended"||o==="ban"&&c==="banned"||o==="activate"&&c==="active"){u(`El usuario ${l(s)} ya está en ese estado.`);return}const y=o==="activate"?"active":o;T(`¿Estás seguro de que quieres ${p} al usuario "${l(s)}"?`,async()=>{try{const b=await m(`/api/admin/users/${i}/status`,{method:"POST",body:JSON.stringify({status:y})});u(b.message||"Acción completada con éxito."),k(e.userSearchInput.value,e.userStatusFilter.value)}catch(b){u(`Error durante la ${g}: ${b.message}`)}})}}function qt(t){const n=t.target.closest("tr"),o=n.dataset.level,r={level:parseInt(o),name:n.querySelector('[data-field="name"]').value,min_blue_required:parseFloat(n.querySelector('[data-field="min_blue_required"]').value),description:n.querySelector('[data-field="description"]').value};clearTimeout(H),H=setTimeout(()=>{Vt(r)},500)}async function st(t,a){try{await m("/api/admin/settings",{method:"POST",body:JSON.stringify({key:t,value:a})}),console.log("Setting actualizado.")}catch(n){n.message.includes("gobernanza")?u(`🔐 ${n.message}

Dirige tu solicitud al panel de gobernanza.`):u(`Error al guardar la configuración: ${n.message}`),W()}}async function Vt(t){try{await m("/api/admin/boosters/settings",{method:"POST",body:JSON.stringify(t)}),console.log("Nivel de impulsor actualizado.")}catch(a){a.message.includes("gobernanza")?u(`🔐 ${a.message}

Dirige tu solicitud al panel de gobernanza.`):u(`Error al guardar el nivel: ${a.message}`),nt()}}async function jt(t){const a=t.target.closest(".action-button-admin.delete");if(a){const o=a.dataset.pubId,r=a.closest("tr").querySelector(".publication-title-cell").textContent;T(`¿Seguro que quieres eliminar la publicación "${l(r)}"? Esta acción es irreversible.`,async()=>{try{const i=await m(`/api/admin/publications/${o}`,{method:"DELETE"});u(i.message||"Publicación eliminada."),M(e.publicationSearchInput.value,e.publicationStatusFilter?.value||"active")}catch(i){u(`Error al eliminar: ${i.message}`)}})}const n=t.target.closest(".action-button-admin.restore");if(n){const o=n.dataset.pubId,r=n.closest("tr").querySelector(".publication-title-cell").textContent;T(`¿Seguro que quieres restaurar la publicación "${l(r)}"?`,async()=>{try{const i=await m(`/api/admin/publications/${o}/restore`,{method:"POST"});u(i.message||"Publicación restaurada."),M(e.publicationSearchInput.value,e.publicationStatusFilter?.value||"active")}catch(i){u(`Error al restaurar: ${i.message}`)}})}}function zt(){const t={},a=["text","textarea"];return document.querySelectorAll("#platformStepInputs .admin-step-input").forEach(o=>{const r=o.getAttribute("data-step"),i=o.querySelector(".step-form-checkbox");if(i&&i.checked){const s=[],c=o.querySelectorAll(".step-form-field-wrapper");c.forEach(d=>{const p=d.querySelector(".step-form-field"),g=d.querySelector(".step-form-type-select"),y=p?p.value.trim():"",b=g&&a.includes(g.value)?g.value:"text";y&&s.push({label:y,type:b})}),c.length===0&&o.querySelectorAll(".step-form-field").forEach(p=>{const g=p.value.trim();g&&s.push({label:g,type:"text"})}),s.length>0&&(t[r]=s)}}),Object.keys(t).length>0?t:null}async function Wt(t){t.preventDefault();const a="[[INSTRUCTIONS_STEPS]]",n="[[/INSTRUCTIONS_STEPS]]",o=oe(),r=document.getElementById("platformPubDescription").value,i=re(r),s=o.length?`${i}

${a}
${o.join(`
`)}
${n}`:i,c=t.target,d=document.getElementById("platformAllowRepeatParticipation").checked,p=e.platformRepeatLimit?parseInt(e.platformRepeatLimit.value,10):NaN;if(d&&(!Number.isFinite(p)||p<2)){u("Indica el máximo de repeticiones por usuario (mínimo 2).");return}const g=e.platformRepeatCooldownDays?parseInt(e.platformRepeatCooldownDays.value,10):0,y=e.platformRepeatCooldownHours?parseInt(e.platformRepeatCooldownHours.value,10):0,b=e.platformRepeatCooldownMinutes?parseInt(e.platformRepeatCooldownMinutes.value,10):0,f=Number.isFinite(g)?g:0,v=Number.isFinite(y)?y:0,E=Number.isFinite(b)?b:0,S=f*24*60+v*60+E;if(d&&S<1){u("Indica el tiempo mínimo para repetir (mínimo 1 minuto).");return}const _=document.getElementById("platformTargetUsername"),I=_?_.value.trim():"",w=zt(),L={title:document.getElementById("platformPubTitle").value,description:s,cost:document.getElementById("platformPubCost").value,availableSlots:document.getElementById("platformPubSlots").value,isSellPost:document.querySelector('input[name="platformPubType"]:checked').value==="sell",autoApprove:document.getElementById("platformAutoApprove").checked,allowRepeatParticipation:d,maxRepeatPerUser:d?p:1,repeatCooldownDays:d?f:0,repeatCooldownHours:d?v:0,repeatCooldownMinutes:d?E:12,isBoosterTask:document.getElementById("platformIsBoosterTask").checked,targetUsername:I||null,formFields:w,showPreflightModal:document.getElementById("platformShowPreflightModal").checked};try{if(R){const C=await m(`/api/admin/platform/publications/${R}`,{method:"PUT",body:JSON.stringify(L)});u(C.message||"Publicación actualizada con éxito.")}else{const C=await m("/api/admin/platform/create-publication",{method:"POST",body:JSON.stringify(L)});u(C.message||"Publicación creada con éxito.")}c.reset(),gt(),z()}catch(C){u(`Error al crear la publicación: ${C.message}`)}}async function Gt(t){const a=t.target.closest(".action-button-admin");if(!a)return;const n=a.dataset.pubId,o=a.dataset.action,r=a.dataset.user,i="Plataforma WintonCoin";let s,c={};switch(o){case"edit":await se(n);return;case"copy":await le(n);return;case"approve":s=`/publications/${n}/approve`,c={approverUsername:i,userToApprove:r};break;case"discard":s=`/publications/${n}/discard`,c={discarderUsername:i,userToDiscard:r};break;case"confirm-payment":s=`/publications/${n}/confirm-payment`,c={confirmerUsername:i,workerUsername:r};break;default:return}try{const d=await m(s,{method:"POST",body:JSON.stringify(c)});u(d.message||"Acción completada con éxito."),z()}catch(d){u(`Error al realizar la acción: ${d.message}`)}}const Jt={open:"Abierta",pending_approval:"Pendiente",approved:"Aprobada",completed:"Culminada",confirmed_paid:"Pagada"};function lt(t){return Jt[t]||t.charAt(0).toUpperCase()+t.slice(1)}function dt(t,a){if(a===0)return'<span class="no-rating">Sin calif.</span>';const n="★".repeat(Math.round(t))+"☆".repeat(5-Math.round(t));return`<span class="stars" title="${parseFloat(t).toFixed(1)} de 5">${n}</span> <span class="rating-count">(${a})</span>`}async function Kt(){if(e.boostersStagesContainer){e.boostersStagesContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await fetch(`${j}/api/admin/boosters/config-stages`,{credentials:"include"});if(!t.ok)throw new Error("Error al cargar etapas");const a=await t.json();let n=`
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Etapa</th>
                            <th>Monto Multiplicador</th>
                            <th>Inicio</th>
                            <th>Fin</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
            `;a.forEach(o=>{const r=new Date(o.start_date).toLocaleDateString("es-ES",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}),i=new Date(o.end_date).toLocaleDateString("es-ES",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}),s=`${r} <span style="font-size: 0.7em; color: #666;">UTC</span>`,c=`${i} <span style="font-size: 0.7em; color: #666;">UTC</span>`,d=o.is_active?'<span class="badge badge-success">Activo</span>':'<span class="badge badge-danger">Inactivo</span>';n+=`
                    <tr>
                        <td><strong>${l(o.name)}</strong></td>
                        <td class="multiplier-cell" style="font-weight: 800; color: #7f00ff;">${parseFloat(o.multiplier).toFixed(2)}x</td>
                        <td>${s}</td>
                        <td>${c}</td>
                        <td>${d}</td>
                        <td>
                            <button class="admin-btn-small edit-stage-btn" data-id="${o.id}">Editar</button>
                        </td>
                    </tr>
                `}),n+="</tbody></table>",e.boostersStagesContainer.innerHTML=n}catch(t){console.error("Error al cargar etapas:",t),e.boostersStagesContainer.innerHTML=`<div class="error-msg">Error: ${t.message}</div>`}}}function Yt(t){e.dashboardContainer&&(e.dashboardContainer.innerHTML=`
            <div class="stat-card">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${l(t.totalUsers||0)}</p>
            </div>
            <div class="stat-card">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${l(t.activePublications||0)}</p>
            </div>
            <div class="stat-card">
                <h4>BLUE en Circulación (Tokens Reales)</h4>
                <p class="stat-value saldo-blue-text">${h(t.totalBlue)}</p>
            </div>
            <div class="stat-card">
                <h4>RED en Circulación (Deuda Total)</h4>
                <p class="stat-value saldo-red-text">${h(t.totalRed)}</p>
            </div>
            <div class="stat-card">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${h(t.platformCommissionBalance)}</p>
            </div>
            <div class="stat-card">
                <h4>Fondos de Impulsores (Deuda Futura)</h4>
                <p class="stat-value saldo-escrow-text">${h(t.totalBoosterFunds||0)}</p>
            </div>
        `)}function Zt(t){if(!e.debtorsTableContainer)return;if(!t||t.length===0){e.debtorsTableContainer.innerHTML='<p class="empty-message">No hay deudores con pagos vencidos actualmente.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Deuda Vencida Total (RED)</th>
                        <th>Nº de Deudas Vencidas</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>ee(n)).join("")}
                </tbody>
            </table>
        `;e.debtorsTableContainer.innerHTML=a}function Qt(t){if(!e.auditLogContainer)return;const a=t?.rows||[];if(a.length===0){e.auditLogContainer.innerHTML='<p class="empty-message">No hay eventos que coincidan con los filtros.</p>';return}const n=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Evento</th>
                        <th>Actor</th>
                        <th>Target</th>
                        <th>Pub ID</th>
                        <th>Categoría</th>
                        <th>IP</th>
                        <th>Metadata</th>
                    </tr>
                </thead>
                <tbody>
                    ${a.map(o=>Xt(o)).join("")}
                </tbody>
            </table>
        `;e.auditLogContainer.innerHTML=n}function Xt(t){const a=t.created_at?new Date(t.created_at):null,n=a?a.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha",o=te(t.metadata);return`
            <tr>
                <td>${l(n)}</td>
                <td>${l(t.event_type)}</td>
                <td>${l(t.actor_username||"")}</td>
                <td>${l(t.target_username||"")}</td>
                <td>${l(t.publication_id??"")}</td>
                <td>${l(t.category||"")}</td>
                <td>${l(t.ip_address||"")}</td>
                <td class="audit-metadata">${l(o)}</td>
            </tr>
        `}function te(t){try{const a=typeof t=="string"?t:JSON.stringify(t||{});return a.length>160?`${a.slice(0,160)}...`:a}catch{return""}}function ee(t){return`
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${l(t.username)}" target="_blank">${l(t.username)}</a>
                </td>
                <td class="saldo-red-text">${h(t.total_penalized_debt)}</td>
                <td align="center">${l(t.penalized_debts_count)}</td>
            </tr>
        `}function ae(t){const a=ct($);if(pt(a.totalPending),!t||t.length===0){e.platformManagementList&&(e.platformManagementList.innerHTML='<p class="empty-message">No hay publicaciones de la plataforma que requieran acción.</p>');return}e.platformManagementList&&(e.platformManagementList.innerHTML=t.map(n=>ne(n)).join(""))}function D(){if(!e.platformManagementList)return;const t=(e.platformPublicationSearchInput?.value||"").trim().toLowerCase(),a=e.platformPublicationStatusFilter?.value||"all",n=e.platformPublicationSortSelect?.value||"pending";let o=[...$];t&&(o=o.filter(i=>{const s=(i.title||"").toLowerCase(),c=(i.description||"").toLowerCase(),d=(i.author_username||"").toLowerCase(),p=String(i.id||"");return s.includes(t)||c.includes(t)||d.includes(t)||p.includes(t)})),a!=="all"&&(o=o.filter(i=>{switch(a){case"active":return!i.is_deleted&&!i.is_expired&&!i.is_completed_publication&&!i.is_paused;case"paused":return!!i.is_paused&&!i.is_deleted;case"completed":return!!i.is_completed_publication&&!i.is_deleted;case"expired":return!!i.is_expired&&!i.is_deleted;case"deleted":return!!i.is_deleted;default:return!0}}));const r=i=>Number(i)||0;if(o.sort((i,s)=>{const c=N(i),d=N(s);switch(n){case"recent":return new Date(s.created_at||0)-new Date(i.created_at||0);case"oldest":return new Date(i.created_at||0)-new Date(s.created_at||0);case"reward_desc":return r(s.blue_cost)-r(i.blue_cost);case"reward_asc":return r(i.blue_cost)-r(s.blue_cost);case"participants_desc":return(s.participants?.length||0)-(i.participants?.length||0);case"approvals_desc":return d.pendingApprovals-c.pendingApprovals;case"payments_desc":return d.pendingPayments-c.pendingPayments;case"pending":default:return d.pendingApprovals!==c.pendingApprovals?d.pendingApprovals-c.pendingApprovals:d.totalPending-c.totalPending}}),o.length===0){e.platformManagementList.innerHTML='<p class="empty-message">No hay publicaciones que coincidan con la búsqueda.</p>';return}ae(o)}function ct(t){return!t||t.length===0?{pendingApprovals:0,pendingPayments:0,totalPending:0}:t.reduce((a,n)=>{const o=N(n);return a.pendingApprovals+=o.pendingApprovals,a.pendingPayments+=o.pendingPayments,a.totalPending+=o.totalPending,a},{pendingApprovals:0,pendingPayments:0,totalPending:0})}function N(t){const a=Array.isArray(t.participants)?t.participants:[],n=a.filter(i=>i.status==="pending_approval").length,o=a.filter(i=>i.status==="completed").length,r=n+o;return{pendingApprovals:n,pendingPayments:o,totalPending:r}}function pt(t){e.platformPublicationsBadge&&(t>0?(e.platformPublicationsBadge.textContent=t,e.platformPublicationsBadge.classList.add("is-visible")):(e.platformPublicationsBadge.textContent="",e.platformPublicationsBadge.classList.remove("is-visible")))}function ne(t){const a=t.created_at?new Date(t.created_at):null,n=a?a.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha",o=t.is_sell_post?"Venta":"Solicitud",r=t.is_sell_post?"sell":"request",i=h(t.blue_cost),s=ft(t),c=yt(t),d=Number.isFinite(Number(t.available_slots))?`${t.available_slots}`:"N/A",p=Array.isArray(t.participants)?t.participants.length:0,g=N(t),y=g.pendingApprovals>0?`<span class="pending-badge warning">Aprobar: ${g.pendingApprovals}</span>`:"",b=g.pendingPayments>0?`<span class="pending-badge">Pagos: ${g.pendingPayments}</span>`:"",f=Number.isFinite(Number(t.max_repeat_per_user))?` (máx ${t.max_repeat_per_user})`:"",v=t.allow_repeat_participation?`Sí${f}`:"No";let E='<p class="no-participants" style="padding: 1rem; text-align: center; color: var(--admin-text-secondary);">Sin participantes por ahora.</p>';if(t.participants&&t.participants.length>0){const w=t.participants.length,L=3;if(w<=L)E=`<ul class="participants-list-admin">${t.participants.map(C=>G(t.id,C)).join("")}</ul>`;else{const C=t.participants.slice(0,L),Y=t.participants.slice(L),V=`more-participants-${t.id}`,Z=`<ul class="participants-list-admin" style="margin-bottom: 0;">${C.map(X=>G(t.id,X)).join("")}</ul>`,Q=`<ul class="participants-list-admin" id="${V}" style="display: none; margin-top: 0; border-top: none;">${Y.map(X=>G(t.id,X)).join("")}</ul>`,P=`
                    <div style="text-align: center; padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border-radius: 0 0 8px 8px;">
                        <button class="action-button-admin secondary small" 
                                onclick="document.getElementById('${V}').style.display='block'; this.parentNode.style.display='none';"
                                style="width: auto; padding: 4px 12px; font-size: 0.85rem;">
                            Ver todos (${w})
                        </button>
                    </div>
                `;E=Z+Q+P}}const{mainText:S,steps:_}=ut(t.description),I=ie(_);return`
            <div class="history-item-admin">
                <div class="history-item-header">
                    <h3>${l(t.title)}</h3>
                    <div class="pending-badges">
                        ${y}
                        ${b}
                    </div>
                </div>
                <p>${l(S||"Sin descripción.")}</p>
                ${I}
                <div class="history-item-actions">
                    <button class="action-button-admin edit" data-action="edit" data-pub-id="${l(t.id)}">Editar</button>
                    <button class="action-button-admin copy" data-action="copy" data-pub-id="${l(t.id)}" title="Copiar datos al formulario">Copiar</button>
                </div>
                <div class="history-item-meta">
                    <span><strong>ID:</strong> ${l(t.id)}</span>
                    <span><strong>Tipo:</strong> <span class="status-badge ${r}">${o}</span></span>
                    <span><strong>Precio:</strong> ${i} BLUE</span>
                    <span><strong>Cupos:</strong> ${l(d)}</span>
                    <span><strong>Participantes:</strong> ${l(p)}</span>
                    <span><strong>Repetible:</strong> ${l(v)}</span>
                    <span><strong>Estado:</strong> <span class="status-badge ${l(c)}">${l(s)}</span></span>
                    <span><strong>Fecha:</strong> ${l(n)}</span>
                </div>
                <h4>Participantes</h4>
                ${E}
            </div>
        `}function oe(){return e.platformStepInputs?Array.from(e.platformStepInputs.querySelectorAll(".admin-step-input")).map(t=>{const a=t.querySelector(':scope > input[type="text"]');return a?a.value.trim():""}).filter(t=>t.length>0):[]}function re(t){if(!t)return"";const a="[[INSTRUCTIONS_STEPS]]",n="[[/INSTRUCTIONS_STEPS]]",o=new RegExp(`${a}[\\s\\S]*?${n}`,"g");return t.replace(o,"").trim()}function ut(t){const a="[[INSTRUCTIONS_STEPS]]",n="[[/INSTRUCTIONS_STEPS]]";if(!t||!t.includes(a))return{mainText:t||"",steps:[]};const o=t.indexOf(a),r=t.indexOf(n);if(r===-1)return{mainText:t||"",steps:[]};const i=t.slice(0,o).trim(),s=t.slice(o+a.length,r).split(`
`).map(c=>c.trim()).filter(c=>c.length>0);return{mainText:i,steps:s}}function ie(t){return!t||t.length===0?"":`
            <div class="admin-step-flow">
                <h4 class="admin-step-title">Sigue las instrucciones paso a paso sin saltar ninguno</h4>
                <ol class="admin-steps-list">
                    ${t.map((n,o)=>`
            <li class="admin-step-item">
                <div class="admin-step-node">
                    <span class="admin-step-index">${o+1}</span>
                </div>
                <div class="admin-step-content">
                    <div class="admin-step-badge">Paso ${o+1}</div>
                    <div class="admin-step-text">${l(n)}</div>
                </div>
            </li>
        `).join("")}
                </ol>
            </div>
        `}async function se(t){let a=$.find(o=>String(o.id)===String(t));if(!a)try{$=await m("/api/admin/platform/publications-with-participants")||[],a=$.find(r=>String(r.id)===String(t))}catch(o){u(`No se pudo cargar la publicación para editar: ${o.message}`);return}if(!a){u("No se encontró la publicación para editar.");return}R=a.id,mt(a);const n=document.getElementById("platformPublicationForm")||document.querySelector(".admin-form");n&&n.scrollIntoView({behavior:"smooth"})}async function le(t){let a=$.find(i=>String(i.id)===String(t));if(!a)try{$=await m("/api/admin/platform/publications-with-participants")||[],a=$.find(s=>String(s.id)===String(t))}catch(i){u(`No se pudo cargar la publicación para copiar: ${i.message}`);return}if(!a){u("No se encontró la publicación para copiar.");return}R=null,mt(a);const n=document.getElementById("platformSubmitButton")||e.platformPublicationSubmitBtn;n&&(n.textContent="Crear Publicación");const o=document.getElementById("cancelEditBtn")||e.platformCancelEditBtn;o&&(o.style.display="none"),e.platformEditNotice&&(e.platformEditNotice.style.display="none"),u('Datos copiados al formulario. Revisa y pulsa "Crear Publicación".');const r=document.getElementById("platformPublicationForm")||document.querySelector(".admin-form");r&&r.scrollIntoView({behavior:"smooth"})}function mt(t){const{mainText:a,steps:n}=ut(t.description);document.getElementById("platformPubTitle").value=t.title||"",document.getElementById("platformPubDescription").value=a||"",document.getElementById("platformPubCost").value=t.blue_cost||"",document.getElementById("platformPubSlots").value=t.available_slots||1,document.getElementById("platformAutoApprove").checked=!!t.auto_approve,document.getElementById("platformAllowRepeatParticipation").checked=!!t.allow_repeat_participation,document.getElementById("platformIsBoosterTask").checked=!!t.is_booster_task;const o=document.getElementById("platformShowPreflightModal");if(o&&(o.checked=!!t.show_preflight_modal),e.platformRepeatLimit){const r=Number(t.max_repeat_per_user);e.platformRepeatLimit.value=Number.isFinite(r)&&r>=2?r:2}if(e.platformRepeatLimitWrapper&&(e.platformRepeatLimitWrapper.style.display=t.allow_repeat_participation?"flex":"none"),e.platformRepeatCooldownWrapper&&(e.platformRepeatCooldownWrapper.style.display=t.allow_repeat_participation?"flex":"none"),e.platformRepeatCooldownDays||e.platformRepeatCooldownHours||e.platformRepeatCooldownMinutes){const r=Number(t.repeat_cooldown_minutes),i=Number(t.repeat_cooldown_hours),s=Number.isFinite(r)&&r>0?r:Number.isFinite(i)&&i>0?Math.round(i*60):12,c=Math.floor(s/1440),d=Math.floor(s%1440/60),p=s%60;e.platformRepeatCooldownDays&&(e.platformRepeatCooldownDays.value=String(c)),e.platformRepeatCooldownHours&&(e.platformRepeatCooldownHours.value=String(d)),e.platformRepeatCooldownMinutes&&(e.platformRepeatCooldownMinutes.value=String(p))}t.is_sell_post?document.getElementById("platformPubTypeSell").checked=!0:document.getElementById("platformPubTypeRequest").checked=!0,de(n,t.form_fields||t.form_options),e.platformPublicationSubmitBtn&&(e.platformPublicationSubmitBtn.textContent="Guardar cambios"),e.platformCancelEditBtn&&(e.platformCancelEditBtn.style.display="inline-flex"),e.platformEditNotice&&(e.platformEditNotice.textContent=`Editando publicación #${t.id}`,e.platformEditNotice.style.display="block"),window.scrollTo({top:0,behavior:"smooth"})}function gt(){R=null,e.platformPublicationSubmitBtn&&(e.platformPublicationSubmitBtn.textContent="Crear Publicación"),e.platformCancelEditBtn&&(e.platformCancelEditBtn.style.display="none"),e.platformEditNotice&&(e.platformEditNotice.style.display="none"),e.platformStepInputs&&e.platformStepInputs.querySelectorAll(".admin-step-input").forEach((n,o)=>{if(o>3)n.remove();else{const r=n.querySelector("input");r&&(r.value="")}}),e.platformAddStepBtn&&(e.platformAddStepBtn.disabled=!1),e.platformRepeatLimit&&(e.platformRepeatLimit.value="2"),e.platformRepeatLimitWrapper&&(e.platformRepeatLimitWrapper.style.display="none"),e.platformRepeatCooldownDays&&(e.platformRepeatCooldownDays.value="0"),e.platformRepeatCooldownHours&&(e.platformRepeatCooldownHours.value="0"),e.platformRepeatCooldownMinutes&&(e.platformRepeatCooldownMinutes.value="12"),e.platformRepeatCooldownWrapper&&(e.platformRepeatCooldownWrapper.style.display="none");const t=document.getElementById("platformTargetUsername");t&&(t.value="")}function de(t,a){e.platformStepInputs&&(e.platformStepInputs.innerHTML="",t.forEach((n,o)=>{const r=o+1;ce(r);const i=document.getElementById(`platformStep${r}`);if(i&&(i.value=n),a&&a[r]){const s=e.platformStepInputs.querySelector(`.admin-step-input[data-step="${r}"]`);if(s){const c=s.querySelector(".step-form-checkbox"),d=s.querySelector(".step-form-fields"),p=s.querySelector(".step-form-inputs");if(c&&d&&p){c.checked=!0,d.style.display="block",p.innerHTML="",a[r].forEach((y,b)=>{const f=typeof y=="string"?y:y?.label||"",v=typeof y=="object"&&y?.type==="textarea"?"textarea":"text",E=document.createElement("div");E.className="step-form-field-wrapper";const S=document.createElement("input");S.type="text",S.className="step-form-field",S.value=f,S.placeholder=`Campo ${b+1}`;const _=document.createElement("select");_.className="step-form-type-select",_.title="Tipo de campo",_.innerHTML=`
                                <option value="text"${v==="text"?" selected":""}>Texto corto</option>
                                <option value="textarea"${v==="textarea"?" selected":""}>Texto largo</option>
                            `,E.appendChild(S),E.appendChild(_),p.appendChild(E)});const g=a[r].length;if(g<3)for(let y=g;y<3;y++){const b=document.createElement("div");b.className="step-form-field-wrapper",b.innerHTML=`
                                    <input type="text" class="step-form-field" placeholder="Campo ${y+1}">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                `,p.appendChild(b)}}}}}))}function ce(t){if(t>20||document.getElementById(`platformStep${t}`))return;const o=document.createElement("div");o.className="admin-step-input",o.setAttribute("data-step",t);const r=document.createElement("label");r.setAttribute("for",`platformStep${t}`),r.textContent=`Paso ${t}`;const i=document.createElement("input");i.type="text",i.id=`platformStep${t}`,i.placeholder=`Describe el paso ${t}`;const s=document.createElement("div");s.className="step-form-toggle",s.innerHTML=`
            <label class="toggle-label">
                <input type="checkbox" class="step-form-checkbox" data-step="${t}">
                <span>Activar formulario para este paso</span>
            </label>
            <div class="step-form-fields" style="display: none;">
                <p class="form-hint">Define los campos que el usuario debe completar:</p>
                <div class="step-form-inputs">
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 1">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 2">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                    <div class="step-form-field-wrapper">
                        <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                        <select class="step-form-type-select" title="Tipo de campo">
                            <option value="text">Texto corto</option>
                            <option value="textarea">Texto largo</option>
                        </select>
                    </div>
                </div>
                <button type="button" class="step-add-field-btn">+ Agregar más campos</button>
            </div>
        `,o.appendChild(r),o.appendChild(i),o.appendChild(s),e.platformStepInputs.appendChild(o);const c=s.querySelector(".step-form-checkbox"),d=s.querySelector(".step-form-fields");c&&c.addEventListener("change",y=>{d.style.display=y.target.checked?"block":"none"});const p=s.querySelector(".step-add-field-btn"),g=s.querySelector(".step-form-inputs");p&&g&&p.addEventListener("click",()=>{const y=g.querySelectorAll(".step-form-field").length,b=document.createElement("input");b.type="text",b.className="step-form-field",b.placeholder=`Campo ${y+1}`,g.appendChild(b)}),e.platformStepInputs.querySelectorAll(".admin-step-input").length>=20&&(e.platformAddStepBtn.disabled=!0)}function G(t,a){const n=dt(a.average_rating,a.ratings_count),o=lt(a.status);let r="";const i=a.accepted_at?`<span class="participant-accepted-at">Solicitó: ${pe(a.accepted_at)}</span>`:"";a.status==="pending_approval"?r=`
                <button class="action-button-admin approve" data-pub-id="${l(t)}" data-action="approve" data-user="${l(a.acceptor_username)}">Aprobar</button>
                <button class="action-button-admin reject" data-pub-id="${l(t)}" data-action="discard" data-user="${l(a.acceptor_username)}">Rechazar</button>
            `:a.status==="completed"&&(r=`
                <button class="action-button-admin confirm" data-pub-id="${l(t)}" data-action="confirm-payment" data-user="${l(a.acceptor_username)}">Confirmar Pago</button>
                <button class="action-button-admin reject" data-pub-id="${l(t)}" data-action="discard" data-user="${l(a.acceptor_username)}">Rechazar</button>
            `);let s="";return a.form_responses&&Object.keys(a.form_responses).length>0&&(s=`
                <div class="participant-form-responses-admin">
                    <div class="form-responses-content-admin">
                        ${Object.entries(a.form_responses).flatMap(([,d])=>Object.entries(d)).map(([d,p])=>`
                    <div class="form-response-field-admin">
                        <span class="form-response-label-admin">${l(d)}:</span>
                        <span class="form-response-value-admin">${l(p)}</span>
                    </div>
                `).join("")}
                    </div>
                </div>
            `),`
            <li class="participant-item-admin ${a.form_responses?"has-responses":""}">
                <div class="participant-row-admin">
                    <div class="participant-info-admin">
                        <strong><a href="profile.html?user=${l(a.acceptor_username)}" target="_blank">${l(a.acceptor_username)}</a></strong>
                        <span class="rating-display">${n}</span>
                        ${i}
                    </div>
                    <div class="participant-status-admin">
                        <span class="status-badge ${l(a.status)}">${l(o)}</span>
                        ${r}
                    </div>
                </div>
                ${s}
            </li>
        `}function pe(t){const a=new Date(t),n={day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"};return a.toLocaleDateString("es-ES",n)}function ue(t){if(!e.usersTableContainer)return;if(t.length===0){e.usersTableContainer.innerHTML='<p class="empty-message">No se encontraron usuarios.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Billetera Web3</th>
                        <th>Saldo BLUE (Disponible)</th>
                        <th>Saldo BLUE (Pendientes)</th>
                        <th>BLUE de Impulsor (IOU)</th>
                        <th>Saldo RED</th>
                        <th>Calificación</th>
                        <th>Estado</th>
                        <th>Fecha de Registro</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>me(n)).join("")}
                </tbody>
            </table>
        `;e.usersTableContainer.innerHTML=a,e.usersTableContainer.querySelectorAll(".copy-wallet-btn-admin").forEach(n=>{n.addEventListener("click",function(){const o=this.dataset.address;navigator.clipboard.writeText(o).then(()=>{const r=this.innerHTML;this.innerHTML='<span style="font-size:10px; font-weight:bold; color:#059669;">✓</span>',setTimeout(()=>{this.innerHTML=r},2e3)}).catch(r=>{console.error("Error al copiar: ",r)})})})}function me(t){const a=new Date(t.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"}),n=dt(t.average_rating,t.ratings_count);let o='<span style="color: #888;">Sin billetera</span>';if(t.web3_wallet_address){const r=t.web3_wallet_address;o=`
                <div style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-family: monospace; font-size: 12px; color: #fff;">${r.substring(0,6)+"..."+r.substring(r.length-4)}</span>
                    <button class="copy-wallet-btn-admin" data-address="${r}" style="background: none; border: none; cursor: pointer; color: #4da6ff; padding: 0; display: flex; align-items: center;" title="Copiar dirección">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                    </button>
                </div>
            `}return`
            <tr data-user-id="${l(t.id)}" data-username="${l(t.username)}" data-status="${l(t.status)}" data-referral-code="${l(t.referral_code||"")}">
                <td class="username-cell">
                    <a href="profile.html?user=${l(t.username)}" target="_blank">${l(t.username)}</a>
                </td>
                <td>${o}</td>
                <td class="saldo-blue-text">${h(t.liquid_blue_balance)}</td>
                <td class="saldo-escrow-text">${h(t.escrow_blue_balance)}</td>
                <td class="saldo-booster-text">${h(t.booster_blue_balance)}</td>
                <td class="saldo-red-text">${h(t.red_balance)}</td>
                <td>${n}</td>
                <td><span class="status-badge ${l(t.status)}">${l(t.status)}</span></td>
                <td>${a}</td>
                <td class="actions-cell">
                    <div class="action-menu-container">
                        <button class="action-button-admin menu-toggle">Acciones</button>
                        <div class="action-menu">
                            <button class="action-button-admin" data-action="edit-referral">✏️ Editar Código</button>
                            <button class="action-button-admin approve" data-action="activate">Reactivar</button>
                            <button class="action-button-admin suspend" data-action="suspend">Suspender</button>
                            <button class="action-button-admin danger" data-action="ban">Banear</button>
                        </div>
                    </div>
                </td>
            </tr>
        `}function ge(t){if(!e.publicationsTableContainer)return;if(t.length===0){e.publicationsTableContainer.innerHTML='<p class="empty-message">No se encontraron publicaciones con ese criterio.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Título</th>
                        <th>Autor</th>
                        <th>Tipo</th>
                        <th>Valor (BLUE)</th>
                        <th>Participantes</th>
                        <th>Estado</th>
                        <th>Fecha Creación</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>fe(n)).join("")}
                </tbody>
            </table>
        `;e.publicationsTableContainer.innerHTML=a}function fe(t){const a=new Date(t.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),n=t.is_sell_post?'<span class="status-badge sell">Venta</span>':'<span class="status-badge request">Solicitud</span>',o=h(t.blue_cost),r=(Number(t.available_slots)||0)+(Number(t.participants_count)||0),i=`${t.participants_count} / ${r}`,s=ft(t),c=yt(t),d=t.is_deleted?`<button class="action-button-admin restore" data-pub-id="${l(t.id)}" title="Restaurar publicación">Restaurar</button>`:`<button class="action-button-admin delete" data-pub-id="${l(t.id)}" title="Eliminar publicación">Eliminar</button>`;return`
            <tr>
                <td class="publication-title-cell" title="${l(t.title)}">${l(t.title)}</td>
                <td class="username-cell">
                    <a href="profile.html?user=${l(t.author_username)}" target="_blank">${l(t.author_username)}</a>
                </td>
                <td>${n}</td>
                <td class="saldo-blue-text">${o}</td>
                <td align="center">${i}</td>
                <td><span class="status-badge ${l(c)}">${l(s)}</span></td>
                <td>${a}</td>
                <td>${d}</td>
            </tr>
        `}function ft(t){return t.is_deleted?"Eliminada":t.is_expired?"Expirada":t.is_completed_publication?"Completada":t.is_paused?"Pausada":lt(t.status||"open")}function yt(t){return t.is_deleted?"deleted":t.is_expired?"expired":t.is_completed_publication?"completed":t.is_paused?"pausada":String(t.status||"open").toLowerCase()}function ye(t){e.platformWalletStatsContainer&&(e.platformWalletStatsContainer.innerHTML=`
            <div class="stat-card">
                <h4>Comisiones (Ganancias Netas)</h4>
                <p class="stat-value saldo-blue-text">${h(t.commissionBalance)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo RED de la Plataforma</h4>
                <p class="stat-value saldo-red-text">${h(t.redBalance)} RED</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Disponible)</h4>
                <p class="stat-value saldo-blue-text">${h(t.liquidBlue)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Pendiente)</h4>
                <p class="stat-value saldo-escrow-text">${h(t.escrowBlue)} BLUE</p>
            </div>
        `)}function be(t){if(!e.platformCommissionLogContainer)return;if(t.length===0){e.platformCommissionLogContainer.innerHTML='<p class="empty-message">Aún no se ha registrado ninguna comisión.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Monto Comisión (BLUE)</th>
                        <th>Publicación de Origen</th>
                        <th>Usuario Implicado</th>
                        <th>Fecha</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>he(n)).join("")}
                </tbody>
            </table>
        `;e.platformCommissionLogContainer.innerHTML=a}function he(t){const a=new Date(t.created_at).toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),n=t.publication_id?`<span title="ID de Publicación: ${l(t.publication_id)}" style="cursor: help;">${l(t.publication_title)}</span>`:l(t.publication_title),o=t.user_who_paid!=="(Usuario desconocido)"?`<a href="profile.html?user=${l(t.user_who_paid)}" target="_blank">${l(t.user_who_paid)}</a>`:l(t.user_who_paid);return`
            <tr>
                <td class="saldo-blue-text">${h(t.commission_amount_blue)} BLUE</td>
                <td>${n}</td>
                <td class="username-cell">${o}</td>
                <td>${a}</td>
            </tr>
        `}function ve(t){if(!e.referralsLogContainer)return;if(!t||t.length===0){e.referralsLogContainer.innerHTML='<p class="empty-message">Todavía no se ha registrado ningún referido.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Referido (Nuevo Usuario)</th>
                        <th>Referente (Usuario Antiguo)</th>
                        <th>Fecha de Registro</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>Ee(n)).join("")}
                </tbody>
            </table>
        `;e.referralsLogContainer.innerHTML=a}function Ee(t){const a=new Date(t.created_at).toLocaleString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});return`
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${l(t.referred_username)}" target="_blank">${l(t.referred_username)}</a>
                </td>
                <td class="username-cell">
                    <a href="profile.html?user=${l(t.referrer_username)}" target="_blank">${l(t.referrer_username)}</a>
                </td>
                <td>${a}</td>
            </tr>
        `}const A=document.getElementById("pushSendToAll");A&&A.addEventListener("change",t=>{const a=document.getElementById("pushTargetUsername");t.target.checked?(a.disabled=!0,a.value="",a.placeholder="ENVIANDO A TODOS LOS USUARIOS",a.classList.add("input-disabled-broadcast")):(a.disabled=!1,a.placeholder="Ej: miiigue",a.classList.remove("input-disabled-broadcast"))});async function Se(t){t.preventDefault();const a=document.getElementById("pushSendToAll").checked,n=document.getElementById("pushTargetUsername").value,o=document.getElementById("pushTitle").value,r=document.getElementById("pushMessage").value,i=document.getElementById("pushUrl").value;if(!o||!r){u("Por favor completa el título y el mensaje.");return}if(!a&&!n){u('Debes especificar un usuario destino o seleccionar "Enviar a Todos".');return}if(a&&!await new Promise(p=>{T(`⚠️ ¡ATENCIÓN! Estás a punto de enviar esta notificación a TODOS los usuarios registrados.

Titulo: ${o}

¿Estás seguro de proceder?`,()=>p(!0))}))return;const s=document.getElementById("sendPushBtn"),c=s?s.textContent:"Enviar";s&&(s.textContent=a?"Enviando Masivo...":"Enviando...",s.disabled=!0);try{const d=await m("/api/notifications/send",{method:"POST",body:JSON.stringify({username:a?null:n,title:o,message:r,url:i,sendToAll:a})});if(d.success){let p="✅ Notificación enviada.";d.total_active?p+=`
Difusión completada: ${d.sent} enviados, ${d.failed} fallidos/limpiados.`:d.sent>0?p+=`
${d.sent} dispositivo(s) notificados.`:p+=`
Sin embargo, no se encontraron dispositivos activos para el destinatario.`,u(p),t.target.reset(),A&&(A.checked=!1,A.dispatchEvent(new Event("change")))}else u(`⚠️ ${d.error||"Error desconocido al enviar."}`)}catch(d){console.error("Error enviando push:",d),u(`❌ Error al enviar notificación: ${d.message}`)}finally{s&&(s.textContent=c,s.disabled=!1)}}async function xe(){if(document.getElementById("notifications-section"))try{const a=await m("/api/admin/settings");a.filter(i=>i.setting_key.startsWith("daily_modal_")).forEach(i=>{const s=document.querySelector(`[data-setting-key="${i.setting_key}"]`);s&&(s.value=i.setting_value)});const o=a.find(i=>i.setting_key==="global_app_interstitial_enabled"),r=document.getElementById("setting_global_app_interstitial_enabled");o&&r&&(r.checked=o.setting_value==="true")}catch(a){console.error("Error al cargar configuración de modal diario:",a)}}async function _e(){const a=document.getElementById("notifications-section").querySelectorAll('[data-setting-key^="daily_modal_"]'),n=document.getElementById("saveDailyMessagesBtn"),o=n.textContent;n.disabled=!0,n.textContent="Guardando...";try{for(const i of a){const s=i.dataset.settingKey,c=i.value;await m("/api/admin/settings",{method:"POST",body:JSON.stringify({key:s,value:c})})}const r=document.getElementById("setting_global_app_interstitial_enabled");r&&await m("/api/admin/settings",{method:"POST",body:JSON.stringify({key:"global_app_interstitial_enabled",value:r.checked.toString()})}),u("Mensajes diarios guardados correctamente.")}catch(r){u(`Error al guardar: ${r.message}`)}finally{n.disabled=!1,n.textContent=o}}function bt(t){if(!e.notificationsSection)return;e.notificationsSection.querySelectorAll(".tab-content").forEach(o=>o.classList.remove("active")),e.notificationsSection.querySelectorAll(".tab-link").forEach(o=>o.classList.remove("active"));const a=document.getElementById(`${t}-tab`),n=document.querySelector(`.tab-link[data-tab="${t}"]`);switch(a&&a.classList.add("active"),n&&n.classList.add("active"),t){case"notifications-push":break;case"notifications-email":ht();break;case"notifications-daily":xe();break}}async function Ce(t){t.preventDefault();const a=document.getElementById("broadcastTargetGroup").value,n=document.getElementById("broadcastTargetUsername").value,o=document.getElementById("broadcastSubject").value,r=document.getElementById("broadcastTitle").value,i=document.getElementById("broadcastBody").value,s=document.getElementById("broadcastButtonText").value,c=document.getElementById("broadcastButtonUrl").value;if(!o||!r||!i){u("Por favor completa todos los campos del correo.");return}if(!await new Promise(y=>{T(`Estás por programar una difusión masiva de correo.
Canal: ${a}
Asunto: ${o}

¿Confirmas el envío?`,()=>y(!0))}))return;const p=document.getElementById("sendBroadcastBtn"),g=p.textContent;p.disabled=!0,p.textContent="Programando...";try{const y=await m("/api/admin/broadcast-email",{method:"POST",body:JSON.stringify({targetGroup:a,targetUsername:a==="specific"?n:null,subject:o,title:r,bodyHtml:i,buttonText:s,buttonUrl:c})});y.success&&(u(`✅ Difusión programada exitosamente (#${y.broadcast_id}).
${y.message}`),t.target.reset(),e.broadcastSpecificUserGroup&&(e.broadcastSpecificUserGroup.style.display="none"),ht())}catch(y){u(`❌ Error al programar difusión: ${y.message}`)}finally{p.disabled=!1,p.textContent=g}}async function ht(){if(e.broadcastHistoryContainer){e.broadcastHistoryContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/admin/broadcast-email");Be(t)}catch(t){e.broadcastHistoryContainer.innerHTML=`<p class="error-message">Error al cargar historial: ${t.message}</p>`}}}function Be(t){if(!e.broadcastHistoryContainer)return;if(!t||t.length===0){e.broadcastHistoryContainer.innerHTML='<p class="empty-message">No hay difusiones previas registradas.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Fecha</th>
                        <th>Asunto</th>
                        <th>Grupo</th>
                        <th>Estado</th>
                        <th>Enviados</th>
                        <th>Fallidos</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>{const o=new Date(n.created_at).toLocaleString(),r=n.status==="completed"?"active":n.status==="failed"?"suspended":"pending";return`
                        <tr>
                            <td>#${n.id}</td>
                            <td>${o}</td>
                            <td title="${l(n.subject)}">${l(n.subject.substring(0,30))}${n.subject.length>30?"...":""}</td>
                            <td><span class="status-badge">${n.target_group}</span></td>
                            <td><span class="status-badge ${r}">${n.status}</span></td>
                            <td align="center"><strong>${n.sent_count}</strong></td>
                            <td align="center"><span class="saldo-red-text">${n.failed_count}</span></td>
                            <td align="center">${n.total_recipients}</td>
                        </tr>
                        `}).join("")}
                </tbody>
            </table>
        `;e.broadcastHistoryContainer.innerHTML=a}async function U(){if(e.academyTableContainer){e.academyTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const t=await m("/api/academy/all");Te(t)}catch(t){e.academyTableContainer.innerHTML=`<p class="error-message">Error al cargar videos: ${t.message}</p>`}}}function Te(t){if(!e.academyTableContainer)return;if(!t||t.length===0){e.academyTableContainer.innerHTML='<p class="empty-message">No hay videos interactivos registrados actualmente.</p>';return}const a=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">Orden</th>
                        <th>Video</th>
                        <th>Título Interactivo</th>
                        <th style="width: 100px;">ID YouTube</th>
                        <th style="width: 100px;">Estado</th>
                        <th style="width: 150px;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${t.map(n=>$e(n)).join("")}
                </tbody>
            </table>
        `;e.academyTableContainer.innerHTML=a,e.academyTableContainer.querySelectorAll(".action-button-admin").forEach(n=>{n.addEventListener("click",Le)})}function $e(t){const a=t.is_active,n=a?"active":"suspended",o=a?"✅ Público":"❌ Oculto",r=`https://img.youtube.com/vi/${l(t.youtube_id)}/hqdefault.jpg`;return`
            <tr>
                <td align="center"><strong>${l(t.order_num)}</strong></td>
                <td>
                    <div style="width: 120px; height: 68px; border-radius: 4px; overflow: hidden; background: #000;">
                        <img src="${r}" alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </td>
                <td style="font-weight: bold;">${l(t.title)}</td>
                <td><code>${l(t.youtube_id)}</code></td>
                <td><span class="status-badge ${n}">${o}</span></td>
                <td>
                    <button class="action-button-admin ${a?"danger":"approve"}" 
                            data-action="toggle-video-status" 
                            data-video-id="${l(t.id)}"
                            data-current-status="${a}">
                        ${a?"Ocultar":"Publicar"}
                    </button>
                    <button class="action-button-admin delete" 
                            data-action="delete-video" 
                            data-video-id="${l(t.id)}">
                        🗑️
                    </button>
                </td>
            </tr>
        `}e.academyVideoForm&&e.academyVideoForm.addEventListener("submit",async t=>{t.preventDefault();const a=e.academyVideoForm.querySelector('button[type="submit"]'),n=a.textContent,o=e.academyVideoUrl.value.trim(),r=e.academyVideoTitle.value.trim(),i=parseInt(e.academyVideoOrder.value,10)||0;if(!o||!r){u("Por favor, ingresa el enlace y el título del video.");return}a.textContent="Guardando...",a.disabled=!0;try{const s=await m("/api/academy/add",{method:"POST",body:JSON.stringify({youtube_url:o,title:r,order_num:i})});s.success&&(u(`✅ Tutorial agregado exitosamente: ${s.video.title}`),e.academyVideoForm.reset(),U())}catch(s){u(`❌ Error al agregar video: ${s.message}`)}finally{a.textContent=n,a.disabled=!1}});async function Le(t){const a=t.target.closest("button");if(!a)return;const n=a.dataset.action,o=a.dataset.videoId;if(n==="toggle-video-status"){const i=!(a.dataset.currentStatus==="true");a.disabled=!0;try{(await m(`/api/academy/${o}/status`,{method:"PUT",body:JSON.stringify({is_active:i})})).success&&U()}catch(s){u(`Error al actualizar estado: ${s.message}`),a.disabled=!1}}else if(n==="delete-video"){if(!await new Promise(i=>{T(`🗑️ ¿Estás completamente seguro de ELIMINAR este tutorial interactivo?

Esta acción no se puede deshacer y desaparecerá de la página 'Cómo Funciona'.`,()=>i(!0))}))return;a.disabled=!0;try{(await m(`/api/academy/${o}`,{method:"DELETE"})).success&&(u("✅ Video eliminado permanentemente."),U())}catch(i){u(`Error al eliminar: ${i.message}`),a.disabled=!1}}}e.pushNotificationForm&&e.pushNotificationForm.addEventListener("submit",Se);async function O(){if(e.humanitarianTableContainer){e.humanitarianTableContainer.innerHTML='<div class="loading-spinner"></div>',e.humanitarianStatsContainer&&(e.humanitarianStatsContainer.innerHTML='<div class="loading-spinner"></div>');try{const t=e.humanitarianStatusFilter?.value||"pending",a=e.humanitarianSearchInput?.value||"",n=await m(`/api/admin/humanitarian/causes?status=${encodeURIComponent(t)}&search=${encodeURIComponent(a)}`);we(n),Ie(n.causes||[])}catch(t){e.humanitarianTableContainer.innerHTML=`<p class="error-message">Error al cargar causas: ${l(t.message)}</p>`,e.humanitarianStatsContainer&&(e.humanitarianStatsContainer.innerHTML="")}}}function we(t){e.humanitarianStatsContainer&&(e.humanitarianStatsContainer.innerHTML=`
            <div class="stat-card">
                <div class="stat-value">${t.pending_count||0}</div>
                <div class="stat-label">Pendientes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${t.total||0}</div>
                <div class="stat-label">Total (filtro actual)</div>
            </div>
        `)}function Ie(t){if(!e.humanitarianTableContainer)return;if(!t||t.length===0){e.humanitarianTableContainer.innerHTML='<p class="no-data-message">No se encontraron causas con los filtros seleccionados.</p>';return}const a=o=>{const i={pending:{label:"⏳ Pendiente",color:"#F59E0B",bg:"rgba(245,158,11,0.15)"},approved:{label:"✅ Aprobada",color:"#10B981",bg:"rgba(16,185,129,0.15)"},rejected:{label:"❌ Rechazada",color:"#EF4444",bg:"rgba(239,68,68,0.15)"},completed:{label:"🏆 Completada",color:"#6366F1",bg:"rgba(99,102,241,0.15)"}}[o]||{label:o,color:"#888",bg:"rgba(136,136,136,0.15)"};return`<span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: ${i.color}; background: ${i.bg};">${i.label}</span>`};let n=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Usuario</th>
                        <th>Título</th>
                        <th>Meta (BLUE)</th>
                        <th>Recaudado</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
        `;t.forEach(o=>{const r=new Date(o.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric"}),i=Number(o.goal_amount).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}),s=Number(o.current_amount).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});n+=`
                <tr>
                    <td>#${o.id}</td>
                    <td><strong>${l(o.username)}</strong></td>
                    <td>${l(o.title)}</td>
                    <td>${i}</td>
                    <td>${s}</td>
                    <td>${a(o.status)}</td>
                    <td>${r}</td>
                    <td>
                        <button class="action-button" onclick="window._viewHumanitarianCause(${o.id})" style="font-size: 0.8rem; padding: 6px 12px;">
                            👁️ Ver
                        </button>
                    </td>
                </tr>
            `}),n+="</tbody></table>",e.humanitarianTableContainer.innerHTML=n}window._viewHumanitarianCause=async function(t){if(e.humanitarianDetailModal){e.humanitarianModalTitle.textContent="Cargando...",e.humanitarianModalBody.innerHTML='<div class="loading-spinner"></div>',e.humanitarianModalActions.innerHTML="",e.humanitarianDetailModal.style.display="flex";try{const n=(await m(`/api/admin/humanitarian/causes/${t}`)).cause,o=new Date(n.created_at).toLocaleString("es-ES");let r="<em>Sin evidencia</em>";n.evidence_urls&&Array.isArray(n.evidence_urls)&&n.evidence_urls.length>0&&(r=n.evidence_urls.map((i,s)=>`<a href="${l(i)}" target="_blank" rel="noopener noreferrer" style="color: #3B82F6; text-decoration: underline; display: block; margin-bottom: 4px;">📎 Evidencia ${s+1}</a>`).join("")),e.humanitarianModalTitle.textContent=`Causa #${n.id}: ${n.title}`,e.humanitarianModalBody.innerHTML=`
                <div style="display: grid; gap: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <strong style="color: #94A3B8;">Usuario:</strong>
                            <p style="margin: 4px 0;">${l(n.username)}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Email:</strong>
                            <p style="margin: 4px 0;">${l(n.email||"N/A")}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Meta BLUE IOU:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #3B82F6;">${Number(n.goal_amount).toLocaleString("es-ES")} BLUE</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Recaudado:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #10B981;">${Number(n.current_amount).toLocaleString("es-ES")} BLUE</p>
                        </div>
                    </div>

                    <div>
                        <strong style="color: #94A3B8;">Historia:</strong>
                        <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-top: 6px; max-height: 200px; overflow-y: auto; line-height: 1.6;">
                            ${l(n.story)}
                        </div>
                    </div>

                    <div>
                        <strong style="color: #94A3B8;">Evidencia:</strong>
                        <div style="margin-top: 6px;">${r}</div>
                    </div>

                    <div style="display: flex; gap: 20px; font-size: 0.85rem; color: #64748B;">
                        <span>📅 Registrada: ${o}</span>
                        <span>🔖 Estado: <strong>${n.status}</strong></span>
                    </div>

                    ${n.admin_notes?`
                        <div style="background: rgba(239,68,68,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #EF4444;">
                            <strong style="color: #EF4444;">Notas del Admin:</strong>
                            <p style="margin: 4px 0;">${l(n.admin_notes)}</p>
                        </div>
                    `:""}
                </div>
            `,n.status==="pending"?(e.humanitarianModalActions.innerHTML=`
                    <div style="display: flex; gap: 12px; width: 100%;">
                        <div style="flex: 1;">
                            <label style="display: block; margin-bottom: 6px; font-size: 0.85rem; color: #94A3B8;">Notas del Admin (obligatorio para rechazar):</label>
                            <textarea id="humanitarianAdminNotes" rows="2" style="width: 100%; padding: 8px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; font-size: 0.9rem;" placeholder="Escribe notas o razón de rechazo..."></textarea>
                        </div>
                    </div>
                    <div style="display: flex; gap: 12px; margin-top: 12px;">
                        <button id="btnApproveCause" class="action-button" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #10B981, #059669); border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer;">
                            ✅ Aprobar Causa
                        </button>
                        <button id="btnRejectCause" class="action-button" style="flex: 1; padding: 10px; background: linear-gradient(135deg, #EF4444, #DC2626); border: none; border-radius: 8px; color: white; font-weight: 700; cursor: pointer;">
                            ❌ Rechazar Causa
                        </button>
                    </div>
                `,document.getElementById("btnApproveCause").addEventListener("click",()=>{const i=document.getElementById("humanitarianAdminNotes")?.value||"";vt(t,"approve",i)}),document.getElementById("btnRejectCause").addEventListener("click",()=>{const i=document.getElementById("humanitarianAdminNotes")?.value||"";vt(t,"reject",i)})):e.humanitarianModalActions.innerHTML=`
                    <p style="text-align: center; color: #64748B; font-style: italic;">Esta causa ya fue procesada (${n.status}).</p>
                `}catch(a){e.humanitarianModalBody.innerHTML=`<p class="error-message">Error al cargar detalle: ${l(a.message)}</p>`}}};async function vt(t,a,n){const o=a==="approve"?"APROBAR":"RECHAZAR",r=a==="approve"?`¿Estás seguro de APROBAR esta causa #${t}? El usuario será notificado y sus referidos podrán donarle.`:`¿Estás seguro de RECHAZAR esta causa #${t}? Se requiere una razón detallada.`;T(r,async()=>{try{const i=await m(`/api/admin/humanitarian/causes/${t}/${a}`,{method:"PATCH",body:JSON.stringify({admin_notes:n})});u(`✅ ${i.message}`),e.humanitarianDetailModal.style.display="none",O(),J()}catch(i){u(`❌ Error al ${o.toLowerCase()}: ${i.message}`)}})}async function J(){try{const t=await m("/api/admin/humanitarian/pending-count");e.humanitarianBadge&&(e.humanitarianBadge.textContent=t.count>0?t.count:"",e.humanitarianBadge.style.display=t.count>0?"inline-flex":"none")}catch(t){console.warn("[SOLIDARIO] No se pudo actualizar badge de pendientes:",t.message)}}async function K(){if(e.govRewardsStats){e.govRewardsStats.innerHTML='<div class="loading-spinner"></div>',e.govRewardsAction&&(e.govRewardsAction.style.display="none"),e.govRewardsResult&&(e.govRewardsResult.style.display="none");try{const t=await m("/api/admin/governance/reward-stats");Pe(t)}catch(t){e.govRewardsStats.innerHTML=`<p class="error-message">Error al cargar estadísticas: ${l(t.message)}</p>`}Et()}}function Pe(t){e.govRewardsStats&&(e.govRewardsStats.innerHTML=`
            <div class="stat-card">
                <h4>Votos sin Recompensar</h4>
                <p class="stat-value">${Number(t.pendingCount)}</p>
            </div>
            <div class="stat-card">
                <h4>Guardianes Afectados</h4>
                <p class="stat-value">${Number(t.guardiansAffected)}</p>
            </div>
            <div class="stat-card">
                <h4>Tasa Actual</h4>
                <p class="stat-value">${Number(t.currentRate).toFixed(2)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Total Estimado</h4>
                <p class="stat-value">${Number(t.estimatedTotal).toFixed(2)} BLUE</p>
            </div>
        `,t.pendingCount>0&&t.currentRate>0?(e.govRewardsSummary.textContent=`${t.pendingCount} voto(s) pendientes — ${t.guardiansAffected} guardián(es)`,e.govRewardsDescription.textContent=`Se acreditarán ${Number(t.estimatedTotal).toFixed(2)} BLUE IOU en total (${Number(t.currentRate).toFixed(2)} por voto).`,e.govRewardsAction.style.display="block",e.govRewardsProcessBtn.disabled=!1,e.govRewardsProcessBtn.textContent="Procesar Pagos Pendientes",e.govRewardsProcessBtn.style.background="#059669",e.govRewardsProcessBtn.style.cursor="pointer"):t.pendingCount>0&&t.currentRate===0?(e.govRewardsSummary.textContent=`${t.pendingCount} voto(s) pendientes — Tasa en 0 (desactivada)`,e.govRewardsDescription.textContent='Configure "Gobernanza — Recompensa por Voto (BLUE IOU)" en Configuración antes de procesar.',e.govRewardsAction.style.display="block",e.govRewardsProcessBtn.disabled=!0,e.govRewardsProcessBtn.textContent="Tasa en 0 — Configure primero",e.govRewardsProcessBtn.style.background="#9CA3AF",e.govRewardsProcessBtn.style.cursor="not-allowed"):e.govRewardsAction.style.display="none")}e.govRewardsProcessBtn&&e.govRewardsProcessBtn.addEventListener("click",async()=>{if(!(e.govRewardsProcessBtn.disabled||!confirm(`¿Estás seguro de procesar los pagos pendientes?

Esta acción acreditará BLUE IOU a cada guardián según la tasa configurada. Se enviará un correo consolidado a cada guardián afectado.`))){e.govRewardsProcessBtn.disabled=!0,e.govRewardsProcessBtn.textContent="Procesando...",e.govRewardsResult.style.display="none";try{const a=await m("/api/admin/governance/process-rewards",{method:"POST"});e.govRewardsResult.style.display="block",e.govRewardsResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Procesamiento completado</h4>
                        <p><strong>Votos procesados:</strong> ${Number(a.totalProcessed)}</p>
                        <p><strong>Omitidos:</strong> ${Number(a.totalSkipped)}</p>
                        <p><strong>Tasa aplicada:</strong> ${Number(a.rateUsed).toFixed(2)} BLUE IOU</p>
                        <p><strong>Guardianes notificados:</strong> ${Number(a.guardiansAffected)}</p>
                    </div>
                `,K()}catch(a){e.govRewardsResult.style.display="block",e.govRewardsResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en el procesamiento</h4>
                        <p>${l(a.message)}</p>
                    </div>
                `,e.govRewardsProcessBtn.disabled=!1,e.govRewardsProcessBtn.textContent="Procesar Pagos Pendientes"}}});let F=null,q=null;async function Et(){if(e.govExportStats){try{const t=await m("/api/admin/governance/demo-export-stats");t.unexportedVotes>0?(e.govExportStats.innerHTML=`<p><strong>${Number(t.unexportedVotes)}</strong> voto(s) de <strong>${Number(t.guardiansCount)}</strong> guardián(es) sin exportar.</p>`,e.govExportBtn&&(e.govExportBtn.disabled=!1)):(e.govExportStats.innerHTML='<p style="color: #059669;">Todos los votos han sido exportados.</p>',e.govExportBtn&&(e.govExportBtn.disabled=!0,e.govExportBtn.textContent="Sin votos pendientes",e.govExportBtn.style.background="#9CA3AF",e.govExportBtn.style.cursor="not-allowed"))}catch(t){e.govExportStats.innerHTML=`<p style="color: #DC2626;">${l(t.message)}</p>`}St()}}async function St(){if(e.govExportHistory)try{const t=await m("/api/admin/governance/demo-export-history");if(!Array.isArray(t)||t.length===0){e.govExportHistory.innerHTML='<p style="color: #9CA3AF; font-size: 0.875rem;">No hay exportaciones registradas.</p>';return}let a="";for(const n of t){const o=new Date(n.exported_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});a+=`
                    <tr>
                        <td style="padding: 8px;">${Number(n.id)}</td>
                        <td style="padding: 8px;">${l(o)}</td>
                        <td style="padding: 8px;">${Number(n.total_guardians)}</td>
                        <td style="padding: 8px;">${Number(n.total_votes)}</td>
                        <td style="padding: 8px;">${Number(n.downloaded_count)}</td>
                        <td style="padding: 8px;">
                            <button class="gov-export-download-btn" data-export-id="${Number(n.id)}"
                                style="background: #6B7280; color: #fff; border: none; padding: 4px 12px;
                                       border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
                                Re-descargar
                            </button>
                        </td>
                    </tr>`}e.govExportHistory.innerHTML=`
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">
                        <thead>
                            <tr style="border-bottom: 2px solid #E5E7EB; text-align: left;">
                                <th style="padding: 8px;">#</th>
                                <th style="padding: 8px;">Fecha</th>
                                <th style="padding: 8px;">Guardianes</th>
                                <th style="padding: 8px;">Votos</th>
                                <th style="padding: 8px;">Descargas</th>
                                <th style="padding: 8px;">Acción</th>
                            </tr>
                        </thead>
                        <tbody>${a}</tbody>
                    </table>
                </div>`,e.govExportHistory.querySelectorAll(".gov-export-download-btn").forEach(n=>{n.addEventListener("click",async()=>{const o=n.dataset.exportId;n.disabled=!0,n.textContent="Descargando...";try{const r=await m(`/api/admin/governance/demo-export/${o}/download`),i=new Blob([JSON.stringify(r.export_data,null,2)],{type:"application/json"}),s=URL.createObjectURL(i),c=document.createElement("a"),d=new Date(r.exported_at).toISOString().split("T")[0];c.href=s,c.download=`gov-rewards-export-${d}-redownload.json`,document.body.appendChild(c),c.click(),document.body.removeChild(c),URL.revokeObjectURL(s),St()}catch(r){u("Error al descargar: "+r.message)}finally{n.disabled=!1,n.textContent="Re-descargar"}})})}catch(t){e.govExportHistory.innerHTML=`<p style="color: #DC2626; font-size: 0.875rem;">${l(t.message)}</p>`}}e.govExportBtn&&e.govExportBtn.addEventListener("click",async()=>{if(!(e.govExportBtn.disabled||!confirm(`¿Exportar los votos de gobernanza no exportados?

Se generará un archivo JSON firmado y los votos se marcarán como exportados.`))){e.govExportBtn.disabled=!0,e.govExportBtn.textContent="Exportando...",e.govExportResult&&(e.govExportResult.style.display="none");try{const a=await m("/api/admin/governance/demo-export",{method:"POST"});if(!a.data){e.govExportResult.style.display="block",e.govExportResult.innerHTML='<p style="color: #667085;">No hay votos pendientes de exportar.</p>';return}const n=new Blob([JSON.stringify(a.data,null,2)],{type:"application/json"}),o=URL.createObjectURL(n),r=document.createElement("a"),i=new Date().toISOString().split("T")[0];r.href=o,r.download=`gov-rewards-export-${i}.json`,document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(o),e.govExportResult.style.display="block",e.govExportResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Exportación completada</h4>
                        <p><strong>Votos exportados:</strong> ${Number(a.data.summary.total_votes)}</p>
                        <p><strong>Guardianes:</strong> ${Number(a.data.summary.total_guardians)}</p>
                        <p style="color: #667085; font-size: 0.875rem; margin-top: 0.5rem;">
                            El archivo se descargó automáticamente. Súbelo en el panel de admin de producción.
                        </p>
                    </div>`,Et()}catch(a){e.govExportResult.style.display="block",e.govExportResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en la exportación</h4>
                        <p>${l(a.message)}</p>
                    </div>`,e.govExportBtn.disabled=!1,e.govExportBtn.textContent="Exportar Reporte",e.govExportBtn.style.background="#3B82F6",e.govExportBtn.style.cursor="pointer"}}}),e.govImportValidateBtn&&e.govImportValidateBtn.addEventListener("click",async()=>{if(!e.govImportFile||!e.govImportFile.files[0]){u("Selecciona un archivo JSON primero.");return}const t=e.govImportFile.files[0];if(!t.name.endsWith(".json")){u("El archivo debe ser de tipo .json");return}if(t.size>5*1024*1024){u("El archivo es demasiado grande (máx. 5 MB).");return}e.govImportValidateBtn.disabled=!0,e.govImportValidateBtn.textContent="Validando...",e.govImportPreview&&(e.govImportPreview.style.display="none"),e.govImportProcessBtn&&(e.govImportProcessBtn.style.display="none"),e.govImportResult&&(e.govImportResult.style.display="none");try{const a=await t.text();let n;try{n=JSON.parse(a)}catch{throw new Error("El archivo no contiene JSON válido.")}const o=await m("/api/admin/governance/demo-import-preview",{method:"POST",body:JSON.stringify({fileData:n})});if(o.status==="duplicate"){e.govImportPreview.style.display="block",e.govImportPreview.innerHTML=`
                        <div class="admin-card" style="border-left: 4px solid #F59E0B; background: #FFFBEB;">
                            <h4 style="color: #D97706; margin: 0 0 0.5rem;">Archivo ya importado</h4>
                            <p>${l(o.message)}</p>
                        </div>`;return}F=n;const r={};if(n&&Array.isArray(n.guardians))for(const f of n.guardians)f&&typeof f.username=="string"&&(r[f.username]=Array.isArray(f.votes)?f.votes:[]);const i=f=>f==="approve"?"Aprobar":f==="reject"?"Rechazar":l(String(f||"—")),s=f=>{if(!f)return"—";const v=new Date(f);return isNaN(v.getTime())?l(String(f)):v.toLocaleString("es-ES",{timeZone:"America/Bogota"})};let c="";o.guardians.forEach((f,v)=>{const E=f.found_in_production?"✅":"⚠️",S=f.found_in_production?"":" (NO encontrado en producción)",_=`gov-imp-det-${v}`,I=r[f.username]||[];let w="";for(const P of I)w+=`
                            <tr>
                                <td style="padding: 4px 8px; color: #374151;">#${Number(P.request_id)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${i(P.vote)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${s(P.voted_at)}</td>
                                <td style="padding: 4px 8px; color: #6B7280;">#${Number(P.demo_vote_id)}</td>
                            </tr>`;const L=I.length===0?'<p style="color: #6B7280; margin: 0;">Sin detalle de votos en el archivo.</p>':`
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #FFFFFF; border: 1px solid #E5E7EB;">
                                <thead>
                                    <tr style="background: #F3F4F6; color: #111827; text-align: left;">
                                        <th style="padding: 6px 8px;">Solicitud</th>
                                        <th style="padding: 6px 8px;">Voto</th>
                                        <th style="padding: 6px 8px;">Fecha</th>
                                        <th style="padding: 6px 8px;">Demo vote ID</th>
                                    </tr>
                                </thead>
                                <tbody>${w}</tbody>
                            </table>`,C=Number(f.base_per_vote??o.currentRate??0),Y=Number(f.multiplier??o.multiplier??1),V=f.stage_name||o.stageName||"Sin etapa activa",Z=Number(f.total_base??f.new_votes*C),Q=Number(f.total_reward??0);c+=`
                        <tr style="border-bottom: 1px solid #E5E7EB; color: #111827;">
                            <td style="padding: 8px; color: #111827;">
                                <button type="button" class="gov-imp-toggle" data-target="${_}"
                                    style="background: transparent; border: 1px solid #8B5CF6; color: #6D28D9;
                                           border-radius: 4px; padding: 2px 8px; margin-right: 6px; cursor: pointer;">
                                    Ver votos
                                </button>
                                ${E} <strong>${l(f.username)}</strong>${S}
                            </td>
                            <td style="padding: 8px; color: #111827;">${Number(f.new_votes)}</td>
                            <td style="padding: 8px; color: #111827;">${Number(f.already_imported)}</td>
                            <td style="padding: 8px; color: #111827;">
                                ${f.found_in_production?C.toFixed(2):"—"}
                            </td>
                            <td style="padding: 8px; color: #111827;" title="${l(V)}">
                                ${f.found_in_production?`x${Y}`:"—"}
                            </td>
                            <td style="padding: 8px; color: #111827;">
                                ${f.found_in_production?Z.toFixed(2):"—"}
                            </td>
                            <td style="padding: 8px; color: #047857; font-weight: 700;">
                                ${f.found_in_production?Q.toFixed(2):"—"}
                            </td>
                        </tr>
                        <tr id="${_}" style="display: none; background: #FAFAFA;">
                            <td colspan="7" style="padding: 8px 12px;">
                                <div style="color: #111827;">${L}</div>
                            </td>
                        </tr>`});const d=Number(o.multiplier??1),p=o.stageName||"Sin etapa activa",g=Number(o.currentRate??0),y=Number(o.ratePerVoteFinal??g*d),b=Number(o.summary.total_base??0);e.govImportPreview.style.display="block",e.govImportPreview.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #8B5CF6; background: #FFFFFF; color: #111827;">
                        <h4 style="color: #7C3AED; margin: 0 0 1rem;">Vista Previa de Importación</h4>
                        <p style="color: #111827;"><strong>Archivo exportado:</strong> ${l(o.exported_at.split("T")[0])}</p>
                        <p style="color: #111827;"><strong>Entorno origen:</strong> ${l(o.source_env)}</p>
                        <p style="color: #111827;"><strong>Tasa base (producción):</strong> ${g.toFixed(2)} BLUE IOU</p>
                        <p style="color: #111827;">
                            <strong>Multiplicador vigente:</strong> x${d}
                            <span style="color: #6B7280;">(${l(p)})</span>
                        </p>
                        <p style="color: #111827;">
                            <strong>Tasa final por voto:</strong>
                            ${g.toFixed(2)} × ${d} = <strong>${y.toFixed(2)} BLUE IOU</strong>
                        </p>
                        <div style="overflow-x: auto; margin-top: 1rem;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem; color: #111827;">
                                <thead>
                                    <tr style="border-bottom: 2px solid #E5E7EB; text-align: left; color: #111827; background: #F9FAFB;">
                                        <th style="padding: 8px;">Guardián</th>
                                        <th style="padding: 8px;">Votos nuevos</th>
                                        <th style="padding: 8px;">Ya importados</th>
                                        <th style="padding: 8px;">Base/voto</th>
                                        <th style="padding: 8px;">Multiplicador</th>
                                        <th style="padding: 8px;">Subtotal base</th>
                                        <th style="padding: 8px;">Total (final)</th>
                                    </tr>
                                </thead>
                                <tbody>${c}</tbody>
                            </table>
                        </div>
                        <hr style="margin: 1rem 0; border-color: #E5E7EB;">
                        <p style="color: #111827;"><strong>Encontrados:</strong> ${Number(o.summary.matched)} · <strong>No encontrados:</strong> ${Number(o.summary.unmatched)}</p>
                        <p style="color: #111827;"><strong>Votos a procesar:</strong> ${Number(o.summary.total_new_votes)} · <strong>Omitidos (ya importados):</strong> ${Number(o.summary.total_skipped)}</p>
                        <p style="color: #111827;">
                            <strong>Subtotal base (sin multiplicar):</strong> ${b.toFixed(2)} BLUE IOU
                        </p>
                        <p style="font-size: 1.1rem; font-weight: 700; color: #047857; margin-top: 0.5rem;">
                            Total a acreditar (con multiplicador x${d}):
                            ${Number(o.summary.total_amount).toFixed(2)} BLUE IOU
                        </p>
                        <p style="color: #6B7280; font-size: 0.8rem; margin-top: 0.5rem;">
                            El multiplicador se aplica al momento de procesar el pago. Si la etapa booster cambia
                            entre ahora y el procesamiento, el sistema abortará la operación y te pedirá revisar
                            la preview nuevamente (control maker-checker).
                        </p>
                    </div>`,q=d,e.govImportPreview.querySelectorAll(".gov-imp-toggle").forEach(f=>{f.addEventListener("click",()=>{const v=f.getAttribute("data-target"),E=v?document.getElementById(v):null;if(!E)return;const S=E.style.display==="none"||E.style.display==="";E.style.display=S?"table-row":"none",f.textContent=S?"Ocultar votos":"Ver votos"})}),o.summary.total_new_votes>0&&o.summary.matched>0&&o.currentRate>0&&(e.govImportProcessBtn.style.display="inline-block")}catch(a){e.govImportPreview.style.display="block",e.govImportPreview.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error de validación</h4>
                        <p>${l(a.message)}</p>
                    </div>`}finally{e.govImportValidateBtn.disabled=!1,e.govImportValidateBtn.textContent="Validar Archivo"}}),e.govImportProcessBtn&&e.govImportProcessBtn.addEventListener("click",async()=>{if(!F){u("No hay archivo validado. Valida primero.");return}if(confirm(`¿Estás seguro de procesar esta importación?

Se acreditarán BLUE IOU REALES en las cuentas de producción de los guardianes. Se enviará un correo de confirmación a cada guardián afectado.

Esta acción no se puede deshacer.`)){e.govImportProcessBtn.disabled=!0,e.govImportProcessBtn.textContent="Procesando...",e.govImportResult&&(e.govImportResult.style.display="none");try{const a=await m("/api/admin/governance/demo-import-process",{method:"POST",body:JSON.stringify({fileData:F,expectedMultiplier:q})});F=null,q=null,e.govImportProcessBtn.disabled=!1,e.govImportProcessBtn.textContent="Confirmar y Procesar Pagos",e.govImportProcessBtn.style.display="none";const n=Number(a.multiplier??1),o=a.stageName||"Sin etapa activa",r=Number(a.finalRatePerVote??Number(a.rateUsed||0)*n);e.govImportResult.style.display="block",e.govImportResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                        <h4 style="color: #059669; margin: 0 0 0.5rem;">Importación completada</h4>
                        <p><strong>Votos procesados:</strong> ${Number(a.totalProcessed)}</p>
                        <p><strong>Omitidos:</strong> ${Number(a.totalSkipped)}</p>
                        <p><strong>Tasa base aplicada:</strong> ${Number(a.rateUsed).toFixed(2)} BLUE IOU</p>
                        <p><strong>Multiplicador aplicado:</strong> x${n}
                            <span style="color: #6B7280;">(${l(o)})</span>
                        </p>
                        <p><strong>Tasa final por voto:</strong> ${r.toFixed(2)} BLUE IOU</p>
                        <p><strong>Guardianes notificados:</strong> ${Number(a.guardiansAffected)}</p>
                    </div>`,K()}catch(a){const n=a&&(a.code==="MULTIPLIER_CHANGED"||typeof a.message=="string"&&a.message.includes("etapa booster cambió"));e.govImportResult.style.display="block",e.govImportResult.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid ${n?"#D97706":"#DC2626"};
                         background: ${n?"#FFFBEB":"#FEF2F2"};">
                        <h4 style="color: ${n?"#B45309":"#DC2626"}; margin: 0 0 0.5rem;">
                            ${n?"Etapa booster cambió — revalidar":"Error en la importación"}
                        </h4>
                        <p>${l(a.message||"Error desconocido")}</p>
                        ${n?'<p style="color: #78350F;">Vuelve a pulsar <strong>Validar Archivo</strong> para ver la nueva tasa y autorizar el pago con el multiplicador vigente.</p>':""}
                    </div>`,n&&(F=null,q=null,e.govImportProcessBtn.style.display="none"),e.govImportProcessBtn.disabled=!1,e.govImportProcessBtn.textContent="Confirmar y Procesar Pagos"}}});function Re(){const t=document.getElementById("kycCheckBtn"),a=document.getElementById("kycApproveBtn"),n=document.getElementById("kycRevokeBtn"),o=document.getElementById("kycUsernameInput");t&&!t._kycListenerAttached&&(t._kycListenerAttached=!0,t.addEventListener("click",()=>{const r=o?.value?.trim();if(!r){u("Ingresa un nombre de usuario para consultar.");return}ke(r)}),o.addEventListener("keyup",r=>{r.key==="Enter"&&t.click()})),a&&!a._kycListenerAttached&&(a._kycListenerAttached=!0,a.addEventListener("click",()=>{const r=document.getElementById("kycResultUsername")?.textContent;r&&T(`¿Estás seguro de APROBAR el KYC para "${r}"? Esta acción se registrará en el Smart Contract y en el log de auditoría.`,()=>xt(r,!0))})),n&&!n._kycListenerAttached&&(n._kycListenerAttached=!0,n.addEventListener("click",()=>{const r=document.getElementById("kycResultUsername")?.textContent;r&&T(`⚠️ ¿Estás seguro de REVOCAR el KYC para "${r}"? El usuario NO podrá crear publicaciones que impliquen pagos.`,()=>xt(r,!1))}))}async function ke(t){const a=document.getElementById("kycStatusResult"),n=document.getElementById("kycOperationResult");a&&(a.style.display="none"),n&&(n.style.display="none");try{const o=await m(`/api/admin/users?search=${encodeURIComponent(t)}`),r=Array.isArray(o)?o.find(d=>d.username===t):null;if(!r){u(`Usuario "${l(t)}" no encontrado.`);return}document.getElementById("kycResultUsername").textContent=r.username,document.getElementById("kycResultWallet").textContent=r.web3_wallet_address?`Wallet: ${r.web3_wallet_address}`:"Sin billetera Web3 registrada",document.getElementById("kycResultStatus").textContent="⏳ Consultando blockchain...",document.getElementById("kycResultStatus").style.color="#F59E0B",document.getElementById("kycActions").style.display="none",a.style.display="block";const i=await m(`/api/admin/users/${r.id}/kyc-status`),s=document.getElementById("kycResultStatus"),c=document.getElementById("kycActions");if(document.getElementById("kycResultWallet").textContent=i.walletAddress?`Wallet: ${i.walletAddress}`:"Sin billetera Web3 registrada",!i.walletAddress){s.textContent="N/A — Sin billetera Web3",s.style.color="#667085",c.style.display="none";return}if(!i.blockchainQuerySuccess){const d=i.kycInDatabase?"✅ VERIFICADO (caché DB)":"❌ NO VERIFICADO (caché DB)";s.textContent=`⚠️ ${d}`,s.style.color="#F59E0B",c.style.display="flex";return}if(i.kycOnChain===!0?(s.textContent="✅ VERIFICADO ON-CHAIN",s.style.color="#059669"):(s.textContent="❌ NO VERIFICADO ON-CHAIN",s.style.color="#DC2626"),i.message&&i.message.includes("discrepancia")){const d=document.createElement("p");d.style.cssText="color: #F59E0B; font-size: 12px; margin: 4px 0 0; font-style: italic;",d.textContent="⚡ "+i.message,s.parentNode.insertBefore(d,s.nextSibling)}c.style.display="flex"}catch(o){u(`Error al consultar usuario: ${o.message}`)}}async function xt(t,a){const n=document.getElementById("kycOperationResult"),o=document.getElementById("kycApproveBtn"),r=document.getElementById("kycRevokeBtn");o&&(o.disabled=!0),r&&(r.disabled=!0);try{const i=await m("/api/governance/kyc",{method:"POST",body:JSON.stringify({username:t,kycStatus:a})});n.style.display="block",n.style.background="rgba(5, 150, 105, 0.1)",n.style.border="1px solid #059669",n.innerHTML=`
                <p style="color: #059669; font-weight: 700; margin: 0 0 0.5rem;">✅ ${l(i.message)}</p>
                <p style="color: #667085; font-size: 13px; margin: 0;">TX Hash: ${l(i.txHash||"Sin cambios necesarios")}</p>
            `;const s=document.getElementById("kycResultStatus");s&&(s.textContent=a?"✅ VERIFICADO":"❌ NO VERIFICADO",s.style.color=a?"#059669":"#DC2626")}catch(i){n.style.display="block",n.style.background="rgba(220, 38, 38, 0.1)",n.style.border="1px solid #DC2626",n.innerHTML=`
                <p style="color: #DC2626; font-weight: 700; margin: 0;">❌ Error: ${l(i.message)}</p>
            `}finally{o&&(o.disabled=!1),r&&(r.disabled=!1)}}});
//# sourceMappingURL=adminPanel.kmd3WUl7.js.map
