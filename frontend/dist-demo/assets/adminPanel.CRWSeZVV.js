import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                    *//* empty css                     */import"./index.pbqrtUCb.js";import{g as Ae,s as u,c as L}from"./auth.BgcrufBo.js";window.getApiUrl=Ae;window.showCustomAlert=u;window.showCustomConfirm=L;console.log("[AdminPanel] ES Module loaded - Full version");document.addEventListener("DOMContentLoaded",()=>{function l(e){return e==null?"":String(e).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}function $(e){const a=(Number(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),o=a.split(",");return o.length===2?`${o[0]},<span class="decimal-part">${o[1]}</span>`:a}const P=Ae(),t={navLinks:document.querySelectorAll(".nav-link"),sections:document.querySelectorAll(".admin-section"),logoutBtn:document.getElementById("adminLogoutBtn"),settingsContainer:document.getElementById("settings-switches"),phaseManagementContainer:document.getElementById("phase-management-switches"),dashboardContainer:document.getElementById("dashboard-stats"),usersTableContainer:document.getElementById("users-table-container"),userSearchInput:document.getElementById("userSearchInput"),userStatusFilter:document.getElementById("userStatusFilter"),debtorsTableContainer:document.getElementById("debtors-table-container"),publicationsTableContainer:document.getElementById("publications-table-container"),publicationSearchInput:document.getElementById("publicationSearchInput"),publicationStatusFilter:document.getElementById("publicationStatusFilter"),platformWalletStatsContainer:document.getElementById("platform-wallet-stats"),platformCommissionLogContainer:document.getElementById("platform-commission-log-container"),platformPublicationForm:document.getElementById("platformPublicationForm"),platformStepInputs:document.getElementById("platformStepInputs"),platformAddStepBtn:document.getElementById("platformAddStepBtn"),platformEditNotice:document.getElementById("platformEditNotice"),platformCancelEditBtn:document.getElementById("platformCancelEditBtn"),platformPublicationSubmitBtn:document.getElementById("platformPublicationSubmitBtn"),platformManagementList:document.getElementById("platform-management-list"),platformPublicationsBadge:document.getElementById("platformPublicationsBadge"),platformPublicationSearchInput:document.getElementById("platformPublicationSearchInput"),platformPublicationStatusFilter:document.getElementById("platformPublicationStatusFilter"),platformPublicationSortSelect:document.getElementById("platformPublicationSortSelect"),platformRepeatLimit:document.getElementById("platformRepeatLimit"),platformRepeatLimitWrapper:document.getElementById("platformRepeatLimitWrapper"),platformRepeatCooldownDays:document.getElementById("platformRepeatCooldownDays"),platformRepeatCooldownHours:document.getElementById("platformRepeatCooldownHours"),platformRepeatCooldownMinutes:document.getElementById("platformRepeatCooldownMinutes"),platformRepeatCooldownWrapper:document.getElementById("platformRepeatCooldownWrapper"),auditLogContainer:document.getElementById("audit-log-container"),auditEventTypeInput:document.getElementById("auditEventTypeInput"),auditActorInput:document.getElementById("auditActorInput"),auditTargetInput:document.getElementById("auditTargetInput"),auditCategoryInput:document.getElementById("auditCategoryInput"),auditFromInput:document.getElementById("auditFromInput"),auditToInput:document.getElementById("auditToInput"),auditLimitSelect:document.getElementById("auditLimitSelect"),auditApplyFiltersBtn:document.getElementById("auditApplyFiltersBtn"),auditExportCsvBtn:document.getElementById("auditExportCsvBtn"),referralsSettingsContainer:document.getElementById("referrals-settings-container"),referralsLogContainer:document.getElementById("referrals-log-container"),referralsTiersContainer:document.getElementById("referrals-tiers-container"),referralsMessageContainer:document.getElementById("referrals-message-container"),boosterSection:document.getElementById("boosters-section"),boostersSettingsContainer:document.getElementById("boosters-settings-container"),boostersDashboardStats:document.getElementById("boosters-dashboard-stats"),boostersListContainer:document.getElementById("boosters-list-container"),boostersPaymentsContainer:document.getElementById("boosters-payments-log-container"),boostersStagesContainer:document.getElementById("boosters-stages-container"),notificationsSection:document.getElementById("notifications-section"),pushNotificationForm:document.getElementById("pushNotificationForm"),emailBroadcastForm:document.getElementById("emailBroadcastForm"),broadcastTargetGroup:document.getElementById("broadcastTargetGroup"),broadcastSpecificUserGroup:document.getElementById("broadcastSpecificUserGroup"),broadcastHistoryContainer:document.getElementById("email-broadcast-history-container"),academySection:document.getElementById("academy-section"),academyVideoForm:document.getElementById("academyVideoForm"),academyTableContainer:document.getElementById("academy-table-container"),academyVideoUrl:document.getElementById("academyVideoUrl"),academyVideoTitle:document.getElementById("academyVideoTitle"),academyVideoOrder:document.getElementById("academyVideoOrder"),humanitarianStatsContainer:document.getElementById("humanitarian-stats"),humanitarianTableContainer:document.getElementById("humanitarian-table-container"),humanitarianSearchInput:document.getElementById("humanitarianSearchInput"),humanitarianStatusFilter:document.getElementById("humanitarianStatusFilter"),humanitarianBadge:document.getElementById("humanitarianBadge"),humanitarianDetailModal:document.getElementById("humanitarianDetailModal"),humanitarianModalTitle:document.getElementById("humanitarianModalTitle"),humanitarianModalBody:document.getElementById("humanitarianModalBody"),humanitarianModalActions:document.getElementById("humanitarianModalActions"),sosVictimsTableContainer:document.getElementById("sos-victims-table-container"),sosVictimsSearchInput:document.getElementById("sosVictimsSearchInput"),sosVictimsStatusFilter:document.getElementById("sosVictimsStatusFilter"),sosVictimsBadge:document.getElementById("sosVictimsBadge"),sosVictimDetailModal:document.getElementById("sosVictimDetailModal"),sosVictimModalTitle:document.getElementById("sosVictimModalTitle"),sosVictimModalBody:document.getElementById("sosVictimModalBody"),sosVictimModalActions:document.getElementById("sosVictimModalActions"),sosVictimDisburseModal:document.getElementById("sosVictimDisburseModal"),sosDisburseForm:document.getElementById("sosDisburseForm"),sosEditEmailTemplatesBtn:document.getElementById("sosEditEmailTemplatesBtn"),sosEmailTemplatesModal:document.getElementById("sosEmailTemplatesModal"),sosEmailTemplatesBody:document.getElementById("sosEmailTemplatesBody"),govRewardsStats:document.getElementById("gov-rewards-stats"),govRewardsAction:document.getElementById("gov-rewards-action"),govRewardsSummary:document.getElementById("gov-rewards-summary"),govRewardsDescription:document.getElementById("gov-rewards-description"),govRewardsProcessBtn:document.getElementById("gov-rewards-process-btn"),govRewardsResult:document.getElementById("gov-rewards-result"),govExportStats:document.getElementById("gov-export-stats"),govExportBtn:document.getElementById("gov-export-btn"),govExportResult:document.getElementById("gov-export-result"),govExportHistory:document.getElementById("gov-export-history"),govImportFile:document.getElementById("gov-import-file"),govImportValidateBtn:document.getElementById("gov-import-validate-btn"),govImportPreview:document.getElementById("gov-import-preview"),govImportProcessBtn:document.getElementById("gov-import-process-btn"),govImportResult:document.getElementById("gov-import-result")};let D=[],M=[],U=null,F=null,re=[];Re(),Ue(),se(),Xt(),W("dashboard"),Ne(),we(),He();function se(){const e=localStorage.getItem("admin_username"),n=document.getElementById("adminConnectedUser");n&&(e?(n.textContent=`Conectado: ${l(e)}`,n.style.display="block"):(n.textContent="",n.style.display="none"))}function Re(){t.navLinks.forEach(g=>{g.addEventListener("click",x=>{const m=g.dataset.section;m&&(x.preventDefault(),W(m))})}),t.dashboardContainer&&t.dashboardContainer.addEventListener("click",g=>{const x=g.target.closest(".interactive-card");if(x){const m=x.dataset.targetSection;m&&W(m)}}),t.logoutBtn&&t.logoutBtn.addEventListener("click",async g=>{g.preventDefault();try{await fetch(`${P}/api/admin/logout`,{method:"POST",credentials:"include"})}catch(x){console.error("Error al cerrar sesión",x)}localStorage.removeItem("admin_username"),window.location.href="admin.html"}),t.settingsContainer&&(t.settingsContainer.addEventListener("change",T),t.settingsContainer.addEventListener("keyup",g=>{g.target.type==="number"&&T(g)})),t.phaseManagementContainer&&t.phaseManagementContainer.addEventListener("change",T);let e;t.userSearchInput&&t.userSearchInput.addEventListener("keyup",()=>{clearTimeout(e),e=setTimeout(()=>{q(t.userSearchInput.value,t.userStatusFilter.value)},300)}),t.userStatusFilter&&t.userStatusFilter.addEventListener("change",()=>{q(t.userSearchInput.value,t.userStatusFilter.value)}),t.usersTableContainer&&t.usersTableContainer.addEventListener("click",nt),document.addEventListener("click",g=>{!g.target.closest(".action-menu-container")&&!g.target.closest(".menu-toggle")&&document.querySelectorAll(".action-menu.visible").forEach(x=>{x.classList.remove("visible")})});let n;t.publicationSearchInput&&t.publicationSearchInput.addEventListener("keyup",()=>{clearTimeout(n),n=setTimeout(()=>{O(t.publicationSearchInput.value,t.publicationStatusFilter?.value||"active")},300)}),t.publicationStatusFilter&&t.publicationStatusFilter.addEventListener("change",()=>{O(t.publicationSearchInput.value,t.publicationStatusFilter.value)}),t.publicationsTableContainer&&t.publicationsTableContainer.addEventListener("click",st),t.platformPublicationForm&&t.platformPublicationForm.addEventListener("submit",lt);const a=document.getElementById("platformPubCost"),o=document.getElementById("platformPubCostCalculator");if(a&&o){let m=function(){const E=parseFloat(a.value);if(isNaN(E)||E<=0)o.textContent=`Multiplicador vigente: ${g}x (${x})`;else{const S=(E*g).toFixed(4);o.textContent=`Valor Base: ${E} BLUE × ${g}x (${x}) = Total Final: ${S} BLUE IOU`}},g=1,x="Sin etapa activa";f("/api/booster/current-multiplier").then(E=>{g=E.multiplier||1,x=E.stageName||"Sin etapa activa",m()}).catch(()=>{m()}),a.addEventListener("input",m)}let r;t.platformPublicationSearchInput&&t.platformPublicationSearchInput.addEventListener("keyup",()=>{clearTimeout(r),r=setTimeout(()=>{J()},250)}),t.platformPublicationStatusFilter&&t.platformPublicationStatusFilter.addEventListener("change",J),t.platformPublicationSortSelect&&t.platformPublicationSortSelect.addEventListener("change",J);const s=document.getElementById("platformAllowRepeatParticipation");if(s&&t.platformRepeatLimitWrapper&&t.platformRepeatCooldownWrapper){const g=()=>{t.platformRepeatLimitWrapper.style.display=s.checked?"flex":"none",t.platformRepeatCooldownWrapper.style.display=s.checked?"flex":"none",!s.checked&&t.platformRepeatLimit&&(t.platformRepeatLimit.value="2"),s.checked||(t.platformRepeatCooldownDays&&(t.platformRepeatCooldownDays.value="0"),t.platformRepeatCooldownHours&&(t.platformRepeatCooldownHours.value="0"),t.platformRepeatCooldownMinutes&&(t.platformRepeatCooldownMinutes.value="12"))};s.addEventListener("change",g),g()}t.platformCancelEditBtn&&t.platformCancelEditBtn.addEventListener("click",Ee);const i=document.getElementById("platformFormToggle"),d=document.getElementById("platformFormContent");if(i&&d&&i.addEventListener("click",()=>{const g=d.style.display!=="none";d.style.display=g?"none":"block",i.classList.toggle("expanded",!g)}),t.platformAddStepBtn&&t.platformStepInputs&&t.platformAddStepBtn.addEventListener("click",()=>{const x=t.platformStepInputs.querySelectorAll(".admin-step-input").length;if(x>=20){t.platformAddStepBtn.disabled=!0;return}const m=x+1,E=document.createElement("div");E.className="admin-step-input",E.setAttribute("data-step",m);const S=m>=2?`
                    <div class="step-form-toggle">
                        <label class="toggle-label">
                            <input type="checkbox" class="step-form-checkbox" data-step="${m}">
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
                `:"";E.innerHTML=`
                    <label for="platformStep${m}">Paso ${m}</label>
                    <input type="text" id="platformStep${m}" placeholder="Describe el paso ${m}">
                    ${S}
                `,t.platformStepInputs.appendChild(E),t.platformStepInputs.querySelectorAll(".admin-step-input").length>=20&&(t.platformAddStepBtn.disabled=!0)}),t.platformStepInputs&&(t.platformStepInputs.addEventListener("change",g=>{if(g.target.classList.contains("step-form-checkbox")){const m=g.target.closest(".admin-step-input").querySelector(".step-form-fields");m&&(m.style.display=g.target.checked?"block":"none")}}),t.platformStepInputs.addEventListener("click",g=>{if(g.target.classList.contains("step-add-field-btn")){const x=g.target.previousElementSibling,m=x.querySelectorAll(".step-form-field-wrapper").length;if(m<10){const E=document.createElement("div");E.className="step-form-field-wrapper",E.innerHTML=`
                            <input type="text" class="step-form-field" placeholder="Campo ${m+1}">
                            <select class="step-form-type-select" title="Tipo de campo">
                                <option value="text">Texto corto</option>
                                <option value="textarea">Texto largo</option>
                            </select>
                        `,x.appendChild(E)}m>=9&&(g.target.style.display="none")}})),t.platformManagementList&&t.platformManagementList.addEventListener("click",dt),t.auditApplyFiltersBtn&&t.auditApplyFiltersBtn.addEventListener("click",()=>{de()}),t.auditExportCsvBtn&&t.auditExportCsvBtn.addEventListener("click",()=>{je()}),t.boosterSection){t.boosterSection.querySelectorAll(".tab-link").forEach(m=>{m.addEventListener("click",()=>{const E=m.dataset.tab;E==="boosters-list"&&(F=null),X(E)})}),t.boostersDashboardStats&&t.boostersDashboardStats.addEventListener("click",m=>{const E=m.target.closest(".interactive-card");if(E){m.preventDefault();const S=E.dataset.targetTab,C=E.dataset.level;if(C?F=parseInt(C,10):F=null,S)X(S);else{const B=E.dataset.targetSection;B&&W(B)}}});const x=document.getElementById("clear-booster-filter-btn");x&&x.addEventListener("click",m=>{m.preventDefault(),F=null,ue(re)})}t.notificationsSection&&t.notificationsSection.querySelectorAll(".tab-link").forEach(x=>{x.addEventListener("click",()=>{const m=x.dataset.tab;$e(m)})}),t.broadcastTargetGroup&&t.broadcastTargetGroup.addEventListener("change",g=>{t.broadcastSpecificUserGroup&&(t.broadcastSpecificUserGroup.style.display=g.target.value==="specific"?"block":"none")}),t.emailBroadcastForm&&t.emailBroadcastForm.addEventListener("submit",zt);const c=document.getElementById("saveDailyMessagesBtn");c&&c.addEventListener("click",Ot);let p;t.humanitarianSearchInput&&t.humanitarianSearchInput.addEventListener("keyup",()=>{clearTimeout(p),p=setTimeout(()=>Z(),300)}),t.humanitarianStatusFilter&&t.humanitarianStatusFilter.addEventListener("change",()=>Z()),t.humanitarianDetailModal&&(t.humanitarianDetailModal.querySelectorAll(".humanitarian-modal-close").forEach(g=>{g.addEventListener("click",()=>{t.humanitarianDetailModal.style.display="none"})}),t.humanitarianDetailModal.addEventListener("click",g=>{g.target===t.humanitarianDetailModal&&(t.humanitarianDetailModal.style.display="none")}));const v=document.getElementById("changePasswordForm"),y=document.getElementById("adminOtpModal"),h=document.getElementById("closeAdminOtpModal"),b=document.getElementById("adminOtpForm");let _="";h&&h.addEventListener("click",()=>{y.style.display="none"}),v&&v.addEventListener("submit",async g=>{g.preventDefault();const x=document.getElementById("currentPasswordInput"),m=document.getElementById("newPasswordInput"),E=document.getElementById("confirmNewPasswordInput"),S=document.getElementById("changePasswordBtn"),C=x?.value,B=m?.value,w=E?.value;if(!C||!B||!w){u("Por favor, introduce todos los campos requeridos.");return}if(B!==w){u("La nueva contraseña y su confirmación no coinciden.");return}if(B.length<8||!/[A-Za-z]/.test(B)||!/[0-9]/.test(B)){u("La nueva contraseña debe tener al menos 8 caracteres, incluyendo letras y números.");return}if(C.length>72||B.length>72){u("La contraseña no puede exceder los 72 caracteres.");return}if(C===B){u("La nueva contraseña no puede ser igual a la contraseña actual.");return}S&&(S.disabled=!0);try{const N=await f("/api/admin/change-password/request",{method:"POST",body:JSON.stringify({currentPassword:C})});_=B,y.style.display="flex"}catch(N){u(N.message||"Error al solicitar el cambio de contraseña.")}finally{S&&(S.disabled=!1)}}),b&&b.addEventListener("submit",async g=>{g.preventDefault();const x=document.getElementById("adminOtpInput"),m=x?.value,E=document.getElementById("adminOtpBtn");if(!m||m.length!==6){u("Por favor, introduce el código de 6 dígitos.");return}E&&(E.disabled=!0);try{const S=await f("/api/admin/change-password/confirm",{method:"POST",body:JSON.stringify({code:m,newPassword:_})});y.style.display="none",u(S.message||"Contraseña actualizada con éxito. Tu sesión se cerrará por seguridad."),document.getElementById("currentPasswordInput").value="",document.getElementById("newPasswordInput").value="",document.getElementById("confirmNewPasswordInput").value="",x.value="",_="",setTimeout(async()=>{try{await fetch(`${P}/api/admin/logout`,{method:"POST",credentials:"include"})}catch(C){console.error("Error al cerrar sesión:",C)}localStorage.removeItem("admin_username"),window.location.href="admin.html"},2e3)}catch(S){u(S.message||"Error al verificar el código.")}finally{E&&(E.disabled=!1)}})}function W(e){t.sections.forEach(o=>o.classList.remove("active-section")),t.navLinks.forEach(o=>o.classList.remove("active"));const n=document.getElementById(`${e}-section`),a=document.querySelector(`.nav-link[data-section="${e}"]`);n&&n.classList.add("active-section"),a&&a.classList.add("active"),e==="dashboard"?qe():e==="settings"?te():e==="users"?q():e==="debtors"?De():e==="publications"?(O(),It()):e==="platform-wallet"?Fe():e==="platform-publications"?ee():e==="referrals"?ie():e==="boosters"?X("boosters-dashboard"):e==="notifications"?$e("notifications-push"):e==="audit-log"?de():e==="academy"?Y():e==="humanitarian"?Z():e==="sos-victims"?j():e==="gov-rewards"?ne():e==="kyc-compliance"?Zt():e==="team"&&(ea(),oe(),Pe())}function X(e){if(!t.boosterSection)return;t.boosterSection.querySelectorAll(".tab-content").forEach(o=>o.classList.remove("active")),t.boosterSection.querySelectorAll(".tab-link").forEach(o=>o.classList.remove("active"));const n=document.getElementById(`${e}-tab`),a=document.querySelector(`.tab-link[data-tab="${e}"]`);switch(n&&n.classList.add("active"),a&&a.classList.add("active"),e){case"boosters-dashboard":Oe();break;case"boosters-settings":le();break;case"boosters-stages":pt();break;case"boosters-list":ze();break;case"boosters-payments":Ve();break}}async function f(e,n={}){const a={headers:{"Content-Type":"application/json"},credentials:"include"};n.body instanceof FormData&&delete a.headers["Content-Type"],n.headers&&(a.headers={...a.headers,...n.headers},delete n.headers);try{const o=await fetch(`${P}${e}`,{...a,...n});if(o.status===401)throw window.location.href="admin.html",new Error("Sesión expirada o no autorizada.");if(o.status===403){const r=await o.json();throw r.governance_required?new Error(r.message):(window.location.href="admin.html",new Error("No autorizado."))}if(!o.ok){const r=await o.json();throw new Error(r.message||`Error del servidor: ${o.status}`)}return o.json()}catch(o){throw o.message==="Sesión expirada o no autorizada."||console.error(`Error en apiFetch a ${e}:`,o),o}}async function q(e="",n=""){if(t.usersTableContainer){t.usersTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const a=await f(`/api/admin/users?search=${encodeURIComponent(e)}&status=${encodeURIComponent(n)}`);wt(a)}catch(a){t.usersTableContainer.innerHTML=`<p class="error-message">Error al cargar los usuarios: ${l(a.message)}</p>`}}}async function De(){if(t.debtorsTableContainer){t.debtorsTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/debtors");ut(e)}catch(e){t.debtorsTableContainer.innerHTML=`<p class="error-message">Error al cargar los compromisos vencidos: ${l(e.message)}</p>`}}}async function O(e="",n="active"){if(t.publicationsTableContainer){t.publicationsTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const a=await f(`/api/admin/publications?search=${encodeURIComponent(e)}&filter=${encodeURIComponent(n)}`);Mt(a)}catch(a){t.publicationsTableContainer.innerHTML=`<p class="error-message">Error al cargar las publicaciones: ${l(a.message)}</p>`}}}async function Fe(){if(t.platformWalletStatsContainer){t.platformWalletStatsContainer.innerHTML='<div class="loading-spinner"></div>',t.platformCommissionLogContainer&&(t.platformCommissionLogContainer.innerHTML='<div class="loading-spinner"></div>');try{const[e,n]=await Promise.all([f("/api/admin/platform-wallet/balance"),f("/api/admin/platform-wallet/log")]);Rt(e),Dt(n)}catch(e){t.platformWalletStatsContainer.innerHTML=`<p class="error-message">Error al cargar datos de la billetera: ${l(e.message)}</p>`,t.platformCommissionLogContainer&&(t.platformCommissionLogContainer.innerHTML="")}}}async function ee(){if(t.platformManagementList){t.platformManagementList.innerHTML='<div class="loading-spinner"></div>';try{D=await f("/api/admin/platform/publications-with-participants")||[],J()}catch(e){t.platformManagementList.innerHTML=`<p class="error-message">Error al cargar las publicaciones de la plataforma: ${l(e.message)}</p>`}}}async function Ne(){try{const e=await f("/api/admin/platform/publications-with-participants"),n=be(e);ve(n.totalPending)}catch(e){console.warn("No se pudo actualizar el badge de pendientes:",e.message)}}async function He(){async function e(){try{const n=await f("/api/admin/metrics/badges"),a=(o,r)=>{const s=document.getElementById(o);if(s){const i=parseInt(r,10)||0;i>0?(s.textContent=i,s.style.display="inline-flex",s.classList.add("is-visible")):(s.textContent="",s.style.display="none",s.classList.remove("is-visible"))}};a("sosVictimsBadge",n.sos),a("talentBadge",n.talent),a("humanitarianBadge",n.humanitarian),a("momentumBadge",n.momentum),a("platformPublicationsBadge",n.publications),a("governanceBadge",n.governance),a("kycBadge",n.kyc),a("crmBadge",n.crm),a("teamBadge",0),a("referralsBadge",0),a("boostersBadge",0)}catch(n){console.warn("No se pudieron actualizar los badges globales:",n.message)}}e(),setInterval(e,6e4)}async function Ue(){const e=document.getElementById("platformMediaDropzone"),n=document.getElementById("platformMediaFileInput"),a=document.getElementById("platformMediaPreviewContainer"),o=document.getElementById("platform-dropzone-limit-message");let r=3;async function s(){try{const d=await f("/api/platform-settings");d&&d.max_images_platform&&(r=parseInt(d.max_images_platform,10)),o&&(o.textContent=`Puedes subir hasta ${r} imagen${r!==1?"es":""}.`)}catch(d){console.error(d)}}s(),e&&n&&(e.addEventListener("click",()=>n.click()),e.addEventListener("dragover",d=>{d.preventDefault(),e.classList.add("dragover")}),e.addEventListener("dragleave",()=>e.classList.remove("dragover")),e.addEventListener("drop",d=>{d.preventDefault(),e.classList.remove("dragover"),i(d.dataTransfer.files)}),n.addEventListener("change",d=>i(d.target.files)));async function i(d){const c=r-M.length;if(c<=0){u(`Solo puedes subir un máximo de ${r} imágenes.`);return}const p=Array.from(d).slice(0,c);for(const v of p){if(!v.type.startsWith("image/"))continue;const y=document.createElement("div");y.className="media-preview-item";const h=document.createElement("img");h.src=URL.createObjectURL(v);const b=document.createElement("div");b.className="upload-progress";const _=document.createElement("button");_.className="remove-btn",_.innerHTML="&times;",_.type="button",_.style.display="none",y.appendChild(h),y.appendChild(b),y.appendChild(_),a.appendChild(y);const g=new FormData;g.append("images",v);try{const x=await fetch(`${P}/api/media/upload`,{method:"POST",credentials:"include",body:g});if(x.ok){const m=await x.json();if(m.urls&&m.urls.length>0){const E=m.urls[0];M.push(E),b.style.width="100%",setTimeout(()=>b.style.display="none",500),h.classList.add("loaded"),_.style.display="block",_.onclick=S=>{S.stopPropagation(),M=M.filter(C=>C!==E),y.remove()}}}else{y.remove();let m="Error al subir la imagen.";try{const E=await x.json(),S=[E.message,E.details].filter(Boolean).join(" - ");S&&(m+=` Detalle: ${S}`)}catch{}u(m)}}catch(x){console.error(x),y.remove(),u(`Error de red al subir la imagen: ${x.message}`)}}}}async function qe(){if(t.dashboardContainer){t.dashboardContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/dashboard-stats");mt(e)}catch(e){t.dashboardContainer.innerHTML=`<p class="error-message">Error al cargar el dashboard: ${l(e.message)}</p>`}}}async function te(){if(t.settingsContainer){t.settingsContainer.innerHTML='<div class="loading-spinner"></div>',t.phaseManagementContainer&&(t.phaseManagementContainer.innerHTML='<div class="loading-spinner"></div>');try{const e=await f("/api/admin/settings");Je(e),kt(e),Pt()}catch(e){u(e.message)}}}async function ie(){if(!(!t.referralsSettingsContainer||!t.referralsLogContainer||!t.referralsTiersContainer||!t.referralsMessageContainer)){t.referralsSettingsContainer.innerHTML='<div class="loading-spinner"></div>',t.referralsTiersContainer.innerHTML='<div class="loading-spinner"></div>',t.referralsMessageContainer.innerHTML='<div class="loading-spinner"></div>',t.referralsLogContainer.innerHTML='<div class="loading-spinner"></div>';try{const[e,n,a]=await Promise.all([f("/api/admin/settings"),f("/api/admin/referrals/log"),f("/api/admin/referrals/tiers")]);Ye(e),Ze(e),Qe(a),Nt(n)}catch(e){t.referralsSettingsContainer.innerHTML=`<p class="error-message">Error al cargar la configuración de referidos: ${l(e.message)}</p>`,t.referralsTiersContainer.innerHTML=`<p class="error-message">Error al cargar los tramos de referidos: ${l(e.message)}</p>`,t.referralsMessageContainer.innerHTML=`<p class="error-message">Error al cargar la configuración del mensaje: ${l(e.message)}</p>`,t.referralsLogContainer.innerHTML=`<p class="error-message">Error al cargar el log de referidos: ${l(e.message)}</p>`}}}async function Oe(){if(t.boostersDashboardStats){t.boostersDashboardStats.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/boosters/stats");tt(e)}catch(e){t.boostersDashboardStats.innerHTML=`<p class="error-message">Error al cargar el dashboard de impulsores: ${l(e.message)}</p>`}}}async function ze(){if(t.boostersListContainer){t.boostersListContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/boosters/list");re=e,ue(e)}catch(e){t.boostersListContainer.innerHTML=`<p class="error-message">Error al cargar la lista de impulsores: ${l(e.message)}</p>`}}}async function Ve(){if(t.boostersPaymentsContainer){t.boostersPaymentsContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/boosters/payments");at(e)}catch(e){t.boostersPaymentsContainer.innerHTML=`<p class="error-message">Error al cargar el historial de pagos: ${l(e.message)}</p>`}}}async function le(){if(t.boostersSettingsContainer){t.boostersSettingsContainer.innerHTML='<div class="loading-spinner"></div>';try{const[e,n]=await Promise.all([f("/api/admin/settings"),f("/api/admin/boosters/settings")]);et(e,n)}catch(e){t.boostersSettingsContainer.innerHTML=`<p class="error-message">Error al cargar la configuración de impulsores: ${l(e.message)}</p>`}}}async function de(){if(t.auditLogContainer){t.auditLogContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=ce(),n=await f(`/api/admin/audit-log?${e.toString()}`);gt(n)}catch(e){t.auditLogContainer.innerHTML=`<p class="error-message">Error al cargar auditoria: ${l(e.message)}</p>`}}}function ce(){const e=new URLSearchParams;return t.auditEventTypeInput?.value&&e.set("eventType",t.auditEventTypeInput.value.trim()),t.auditActorInput?.value&&e.set("actor",t.auditActorInput.value.trim()),t.auditTargetInput?.value&&e.set("target",t.auditTargetInput.value.trim()),t.auditCategoryInput?.value&&e.set("category",t.auditCategoryInput.value.trim()),t.auditFromInput?.value&&e.set("from",t.auditFromInput.value),t.auditToInput?.value&&e.set("to",t.auditToInput.value),t.auditLimitSelect?.value&&e.set("limit",t.auditLimitSelect.value),e}async function je(){try{const e=ce();e.get("limit")||e.set("limit","200");const a=(await f(`/api/admin/audit-log?${e.toString()}`))?.rows||[];if(a.length===0){u("No hay eventos para exportar con esos filtros.");return}const o=We(a);Ge(o,"audit_log.csv")}catch(e){u(`Error al exportar CSV: ${e.message}`)}}function We(e){const n=["id","created_at","event_type","actor_username","target_username","publication_id","category","ip_address","user_agent","metadata"],a=[n.join(",")];return e.forEach(o=>{const r=n.map(s=>{const i=s==="metadata"?JSON.stringify(o[s]||{}):o[s]??"";return`"${String(i).replace(/"/g,'""')}"`});a.push(r.join(","))}),a.join(`
`)}function Ge(e,n){const a=new Blob([e],{type:"text/csv;charset=utf-8;"}),o=URL.createObjectURL(a),r=document.createElement("a");r.href=o,r.setAttribute("download",n),document.body.appendChild(r),r.click(),document.body.removeChild(r),URL.revokeObjectURL(o)}function pe(e){return{allow_new_registrations:{title:"Permitir Nuevos Registros",description:"Activa o desactiva esta característica para toda la plataforma."},public_profiles_enabled:{title:"Perfiles Públicos",description:"Permite que cualquiera vea los perfiles públicos de los usuarios."},debt_system_enabled:{title:"Sistema de Compromisos (Tokens RED)",description:"Activa o desactiva la creación y gestión de compromisos RED."},platform_commission_percentage:{title:"Comisión de Plataforma (%)",description:"Porcentaje de comisión para la plataforma (ej: 5 para 5%)."},booster_system_enabled:{title:"Sistema de Impulsores",description:"Activa el sistema de Impulsores y su lógica de pagos mensuales."},booster_custom_frequency_enabled:{title:"Frecuencia de Pago Personalizada",description:"Si se activa, el sistema realizará los pagos en el intervalo configurado abajo (días, horas, minutos) en lugar del ciclo mensual del primer día de cada mes."},booster_payment_frequency_days:{title:"Frecuencia Personalizada — Días",description:"Número de días en el intervalo de pago personalizado de impulsores."},booster_payment_frequency_hours:{title:"Frecuencia Personalizada — Horas",description:"Número de horas en el intervalo de pago personalizado de impulsores."},booster_payment_frequency_minutes:{title:"Frecuencia Personalizada — Minutos",description:"Número de minutos en el intervalo de pago personalizado de impulsores."},referral_system_enabled:{title:"Sistema de Referidos",description:"Activa o desactiva el bono por registro con código de referido."},referral_reward_amount:{title:"Recompensa por Referido (BLUE)",description:"Cantidad de BLUE que ganan referente y referido."},referral_reward_after_expiry:{title:"Recompensa después de la promo (BLUE)",description:"Cantidad de BLUE que se otorgará una vez expire la promoción."},referral_codes_expiry_date:{title:"Vigencia hasta",description:"Fecha de expiración de los códigos de referido (formato: YYYY-MM-DD)."},referral_custom_share_code:{title:"Código de Referido Especial",description:"Código global para compartir en redes sociales en lugar del código personal."},referral_custom_share_code_enabled:{title:"Habilitar Código Especial",description:"Si está activo (ON), los usuarios compartirán el código especial anterior. Si está apagado (OFF), compartirán su propio código personal."},referral_share_message_template:{title:"Plantilla del Mensaje para Compartir",description:"Mensaje publicitario que se copiará al compartir. Soporta {code}, {reward} y {link} como placeholders."},welcome_bonus_enabled:{title:"Bono de Bienvenida",description:"Activa o desactiva el bono al registrarse sin código."},welcome_bonus_amount:{title:"Monto del Bono de Bienvenida (BLUE)",description:"Cantidad de BLUE que se otorga sin código de referido."},pre_launch_mode_enabled:{title:"Modo Pre-Lanzamiento",description:"Todas las ganancias van al Perfil de Impulsor, no se crea RED."},allow_request_publications:{title:'Permitir Publicaciones de "Solicitud"',description:"Los usuarios pueden publicar tareas para que otros las realicen."},allow_sell_publications:{title:'Permitir Publicaciones de "Venta"',description:"Los usuarios pueden publicar productos o servicios para vender."},allow_donation_publications:{title:'Permitir Publicaciones de "Donación"',description:"Los usuarios pueden solicitar donaciones."},allow_quick_sale_publications:{title:'Permitir Publicaciones de "Venta Rápida"',description:"Habilita el botón de Venta Rápida para transacciones exprés."},p2p_enabled:{title:"P2P — Habilitado",description:"Habilita el módulo P2P para compra/venta de BLUE entre usuarios."},p2p_price_min:{title:"P2P — Precio Mínimo (USD)",description:"Precio mínimo permitido por 1 BLUE en USD."},p2p_price_max:{title:"P2P — Precio Máximo (USD)",description:"Precio máximo permitido por 1 BLUE en USD."},p2p_fee_percentage:{title:"P2P — Comisión (%)",description:"Comisión P2P total en porcentaje."},p2p_payment_window_minutes:{title:"P2P — Ventana de Pago (min)",description:"Minutos máximos para confirmar el pago."},p2p_extension_minutes:{title:"P2P — Extensión (min)",description:"Minutos de extensión al aceptar una prórroga."},p2p_extension_limit:{title:"P2P — Límite de Extensiones",description:"Cantidad máxima de extensiones por orden."},p2p_cash_min_rating:{title:"P2P — Reputación Mínima para Efectivo",description:"Calificación mínima requerida para usar efectivo en persona."},gov_quorum_percentage:{title:"Gobernanza — Quórum Requerido (%)",description:"Porcentaje de votos necesarios para aprobar o rechazar (mín. 51, máx. 100)."},gov_timelock_hours:{title:"Gobernanza — Time-Lock (horas)",description:"Horas de espera tras alcanzar el quórum de aprobación, antes de ejecutar un cambio de membresía (reloj del servidor)."},gov_request_expiry_hours:{title:"Gobernanza — Expiración de Solicitud (horas)",description:"Horas que tiene una solicitud para alcanzar quórum."},gov_reminder_threshold_hours:{title:"Gobernanza — Umbral de Recordatorio (horas)",description:"Cuando quedan estas horas para expirar, se envía recordatorio."},gov_reminder_cooldown_hours:{title:"Gobernanza — Enfriamiento entre Recordatorios (horas)",description:"Horas mínimas entre recordatorios al mismo guardián."},gov_vote_reward_blue:{title:"Gobernanza — Recompensa por Voto (BLUE IOU)",description:"BLUE IOU acreditados al guardián al emitir su voto. Valor 0 desactiva la recompensa."},red_credit_base_limit:{title:"Scoring — Límite Base RED (Nuevos Usuarios)",description:"El límite de compromiso inicial que se asigna a los nuevos usuarios al registrarse."},red_credit_culture_quiz:{title:"Scoring — Bono por Cuestionario de Cultura (RED)",description:"Aumento del límite por aprobar cuestionarios de la Winton Academy."},red_credit_referral:{title:"Scoring — Bono por Referido Activo (RED)",description:"Aumento del límite por cada referido exitoso que utilice la plataforma."},red_credit_monthly_activity:{title:"Scoring — Bono por Alta Actividad (RED)",description:"Aumento del límite al superar 20 tareas en un mes calendario."},red_credit_early_payment:{title:"Scoring — Bono por Amortización Anticipada (RED)",description:"Aumento del límite por amortizar compromisos en los primeros 5 días del ciclo."},donation_refund_enabled:{title:"Reembolso Automático de Donaciones",description:"Activa o desactiva el demonio que devuelve automáticamente las donaciones en espera (on_hold) si el donante no verifica su KYC Web3."},donation_escrow_expiration_days:{title:"Días de Retención de Donaciones",description:"Cantidad de días que una donación permanece en espera antes de ser devuelta automáticamente al donante si este no completa su KYC."},registration_country_restriction_enabled:{title:"Activar Restricción por País",description:"Controla si el formulario de registro está restringido a ciertos prefijos telefónicos."},registration_allowed_country_prefixes:{title:"Prefijos de País Permitidos",description:"Prefijos telefónicos autorizados para el registro."},registration_country_restriction_notice_text:{title:"Texto de la Nota Informativa",description:"Mensaje descriptivo mostrado en el formulario de registro."}}[e]||{title:e,description:"Sin descripción."}}function me(e){return pe(e).title}function Je(e){const n=e.filter(i=>["pre_launch_mode_enabled","allow_request_publications","allow_sell_publications","allow_donation_publications","allow_quick_sale_publications"].includes(i.setting_key)),a=e.filter(i=>i.setting_key.startsWith("debt_cycle_")||i.setting_key.startsWith("blue_escrow_")),o=["referral_system_enabled","referral_reward_amount","welcome_bonus_enabled","welcome_bonus_amount","referral_bonus_enabled","referral_bonus_amount"],r=["registration_country_restriction_enabled","registration_allowed_country_prefixes","registration_country_restriction_notice_text"],s=e.filter(i=>!n.includes(i)&&!a.includes(i)&&!o.includes(i.setting_key)&&!r.includes(i.setting_key));if(t.phaseManagementContainer&&(t.phaseManagementContainer.innerHTML=n.map(i=>k(i,"switch")).join("")),t.settingsContainer){t.settingsContainer.innerHTML=s.map(d=>d.setting_key.endsWith("_enabled")||d.setting_key.endsWith("registrations")?k(d,"switch"):d.setting_key==="gov_vote_reward_blue"?k(d,"number"):d.setting_key==="donation_escrow_expiration_days"||d.setting_key.startsWith("gov_")?k(d,"integer"):d.setting_key.startsWith("p2p_")||d.setting_key.startsWith("red_credit_")||d.setting_key.endsWith("_amount")||d.setting_key.includes("percentage")?k(d,"number"):"").join("");const i={debt_cycle:{label:"Duración del Ciclo de Compromiso RED",description:"Define el período de tiempo para esta funcionalidad.",settings:[]},blue_escrow:{label:"Duración del Depósito BLUE (Escrow)",description:"Define el período de tiempo para esta funcionalidad.",settings:[]}};a.forEach(d=>{d.setting_key.startsWith("debt_cycle_")?i.debt_cycle.settings.push(d):d.setting_key.startsWith("blue_escrow_")&&i.blue_escrow.settings.push(d)});for(const d in i)t.settingsContainer.innerHTML+=Ke(i[d]);t.settingsContainer.querySelectorAll('input[type="checkbox"]').forEach(d=>{d.addEventListener("change",T)}),t.settingsContainer.querySelectorAll('input[type="number"]').forEach(d=>{d.addEventListener("change",T),d.addEventListener("keyup",c=>{c.key==="Enter"&&T(c)})})}t.phaseManagementContainer&&t.phaseManagementContainer.querySelectorAll('input[type="checkbox"]').forEach(i=>{i.addEventListener("change",T)})}function k(e,n){const{title:a,description:o}=pe(e.setting_key),r=l(e.setting_key),s=l(e.setting_value),i=l(a),d=l(o);let c="";return n==="switch"?c=`
                <label class="switch">
                    <input type="checkbox" data-key="${r}" ${e.setting_value==="true"?"checked":""}>
                    <span class="slider round"></span>
                </label>
            `:n==="number"?c=`
                <input type="number" class="admin-numeric-input" data-key="${r}" value="${parseFloat(e.setting_value).toFixed(2)}" step="0.01" min="0">
            `:n==="integer"?c=`
                <input type="number" class="admin-numeric-input" data-key="${r}" value="${parseInt(e.setting_value,10)||0}" step="1" min="1">
            `:n==="date"&&(c=`
                <input type="date" class="admin-date-input" data-key="${r}" value="${s||""}">
            `),`
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${i}</h4>
                    <p>${d}</p>
                </div>
                <div class="setting-item-control">
                    ${c}
                </div>
            </div>
        `}function Ke(e){return e.settings.length===0?"":(e.settings.sort((n,a)=>{const o=["days","hours","minutes"],r=n.setting_key.split("_").pop(),s=a.setting_key.split("_").pop();return o.indexOf(r)-o.indexOf(s)}),`
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>${l(e.label)}</h4>
                    <p>${l(e.description)}</p>
                </div>
                <div class="setting-item-control-group">
                    ${e.settings.map(n=>{const a=n.setting_key.split("_").pop(),o=l(n.setting_key),r=l(n.setting_value);return`
                            <div class="numeric-group-item">
                                <label for="setting-${o}">${a.charAt(0).toUpperCase()+a.slice(1)}</label>
                                <input type="number" class="admin-numeric-input" id="setting-${o}" data-key="${o}" value="${r}" min="0">
                            </div>
                        `}).join("")}
                </div>
            </div>
        `)}function Ye(e){const n=["referral_system_enabled","referral_reward_after_expiry","referral_codes_expiry_date","welcome_bonus_enabled","welcome_bonus_amount"],a=e.filter(r=>n.includes(r.setting_key)),o=document.getElementById("referrals-settings-container");o&&(o.innerHTML=a.map(r=>r.setting_key.endsWith("_enabled")?k(r,"switch"):r.setting_key.endsWith("_amount")||r.setting_key.endsWith("_after_expiry")?k(r,"number"):r.setting_key==="referral_codes_expiry_date"?k(r,"date"):"").join(""),o.querySelectorAll('input[type="checkbox"]').forEach(r=>{r.addEventListener("change",T)}),o.querySelectorAll('input[type="number"]').forEach(r=>{r.addEventListener("change",T),r.addEventListener("keyup",s=>{s.key==="Enter"&&T(s)})}),o.querySelectorAll('input[type="date"]').forEach(r=>{r.addEventListener("change",T)}))}function Ze(e){const n=["referral_custom_share_code","referral_custom_share_code_enabled","referral_share_message_template","referral_card_title","referral_card_button_text","referral_campaign_image_url","referral_card_subtitle"],a=e.filter(m=>n.includes(m.setting_key)),o=t.referralsMessageContainer;if(!o)return;const r=a.find(m=>m.setting_key==="referral_custom_share_code")||{setting_value:""},s=a.find(m=>m.setting_key==="referral_custom_share_code_enabled")||{setting_value:"false"},i=a.find(m=>m.setting_key==="referral_share_message_template")||{setting_value:""},d=a.find(m=>m.setting_key==="referral_card_title")||{setting_value:"🔥 CAMPAÑA ESPECIAL"},c=a.find(m=>m.setting_key==="referral_card_button_text")||{setting_value:"📢 COMPARTIR INVITACIÓN"},p=a.find(m=>m.setting_key==="referral_campaign_image_url")||{setting_value:""},v=a.find(m=>m.setting_key==="referral_card_subtitle")||{setting_value:"Bono por referir hoy"};o.innerHTML=`
            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>Habilitar Código Especial</h4>
                    <p>Si está activo (ON), los usuarios compartirán el código especial de abajo. Si está apagado (OFF), compartirán su propio código personal.</p>
                </div>
                <div class="setting-item-control">
                    <label class="switch">
                        <input type="checkbox" id="setting-referral_custom_share_code_enabled" data-key="referral_custom_share_code_enabled" ${s.setting_value==="true"?"checked":""}>
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>Código de Referido Especial</h4>
                    <p>Código global para compartir en redes sociales en lugar del código personal.</p>
                </div>
                <div class="setting-item-control" style="flex-direction: column; align-items: flex-end; gap: 0.3rem;">
                    <input type="text" class="admin-text-input" id="setting-referral_custom_share_code" data-key="referral_custom_share_code" value="${l(r.setting_value)}" style="padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; width: 100%; max-width: 250px;">
                    <div id="referral-code-status-msg" style="font-size: 0.8rem; text-align: right; width: 100%;"></div>
                </div>
            </div>

            <div class="setting-item" style="flex-direction: column; align-items: stretch; gap: 0.5rem;">
                <div class="setting-item-info" style="margin-bottom: 0.5rem;">
                    <h4>Plantilla del Mensaje para Compartir</h4>
                    <p>Mensaje publicitario que se copiará al compartir. Soporta los siguientes placeholders dinámicos:</p>
                    <p style="margin-top: 0.25rem; font-family: monospace; color: #f1c40f; font-size: 0.8rem;">
                        {code} &rarr; Código de referido a compartir (personal o especial)<br>
                        {reward} &rarr; Monto de recompensa del tramo activo<br>
                        {link} &rarr; Enlace de registro con el código inyectado
                    </p>
                </div>
                <textarea id="setting-referral_share_message_template" data-key="referral_share_message_template" style="width: 100%; min-height: 120px; padding: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-family: inherit; font-size: 0.9rem; resize: vertical; box-sizing: border-box;">${l(i.setting_value)}</textarea>
            </div>

            <hr class="admin-divider" style="margin: 2rem 0; opacity: 0.2;">
            <h3 style="margin-top: 0;">Diseño de la Tarjeta en la App (Modo Campaña)</h3>
            <p style="margin-bottom: 1.5rem;">Estos textos e imagen reemplazarán la tarjeta de referidos normal en los teléfonos de los usuarios cuando el "Código Especial" (arriba) esté activo.</p>

            <div class="setting-item" style="align-items: flex-start;">
                <div class="setting-item-info">
                    <h4>Imagen de Fondo (Banner)</h4>
                    <p>Imagen premium que cubrirá la tarjeta (ej. Terremoto en Venezuela). Puedes subir un archivo o pegar una URL persistente (ej: de Imgur/PostImage) para que nunca se borre al reiniciar el contenedor.</p>
                </div>
                <div class="setting-item-control" style="flex-direction: column; align-items: flex-end; gap: 0.5rem; width: 100%; max-width: 250px;">
                    ${p.setting_value?`<img src="${l(p.setting_value.startsWith("http")?p.setting_value:P+p.setting_value)}" alt="Campaña actual" style="max-width: 250px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2);">`:'<span style="font-size:0.85rem; color:#aaa;">Sin imagen</span>'}
                    
                    <!-- Subida local -->
                    <input type="file" id="campaign-image-upload" accept="image/jpeg, image/png, image/webp" style="width: 100%; font-size: 0.85rem;">
                    <div id="campaign-upload-status" style="font-size: 0.8rem; width: 100%; text-align: right;"></div>
                    
                    <!-- Entrada de URL directa para persistencia -->
                    <p style="margin: 0.5rem 0 0; font-size: 0.75rem; color: #aaa; text-align: right; width: 100%;">O pegar URL de imagen externa:</p>
                    <input type="text" class="admin-text-input" id="setting-referral_campaign_image_url" data-key="referral_campaign_image_url" value="${l(p.setting_value)}" placeholder="https://ejemplo.com/imagen.jpg" style="padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; width: 100%; box-sizing: border-box;">
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>Título de la Tarjeta</h4>
                    <p>Reemplaza "CUPOS DISPONIBLES".</p>
                </div>
                <div class="setting-item-control">
                    <input type="text" class="admin-text-input" id="setting-referral_card_title" data-key="referral_card_title" value="${l(d.setting_value)}" style="padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; width: 100%; max-width: 250px;">
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>Subtítulo de Recompensa</h4>
                    <p>Reemplaza "Bono por referir hoy".</p>
                </div>
                <div class="setting-item-control">
                    <input type="text" class="admin-text-input" id="setting-referral_card_subtitle" data-key="referral_card_subtitle" value="${l(v.setting_value)}" style="padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; width: 100%; max-width: 250px;">
                </div>
            </div>

            <div class="setting-item">
                <div class="setting-item-info">
                    <h4>Texto del Botón</h4>
                    <p>Reemplaza "COMPARTIR MI CÓDIGO".</p>
                </div>
                <div class="setting-item-control">
                    <input type="text" class="admin-text-input" id="setting-referral_card_button_text" data-key="referral_card_button_text" value="${l(c.setting_value)}" style="padding: 0.5rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; width: 100%; max-width: 250px;">
                </div>
            </div>
        `,o.querySelectorAll('input[type="checkbox"]').forEach(m=>{m.addEventListener("change",T)}),o.querySelectorAll('input[type="text"]').forEach(m=>{m.addEventListener("change",T),m.addEventListener("keyup",E=>{E.key==="Enter"&&T(E)})});const y=o.querySelector("#setting-referral_custom_share_code"),h=o.querySelector("#setting-referral_custom_share_code_enabled"),b=o.querySelector("#referral-code-status-msg"),_=async()=>{if(!y||!b)return;const m=y.value.trim();if(!m){b.innerHTML='<span style="color: #e74c3c;">❌ Debe ingresar un código</span>',h&&(h.checked=!1,h.disabled=!0);return}try{let E=await fetch(`${P}/api/verify-referral-code?code=${encodeURIComponent(m)}`);E.ok||(E=await fetch(`${P}/api/system/verify-referral-code?code=${encodeURIComponent(m)}`));const S=await E.json();S.valid?(b.innerHTML=`<span style="color: #2ecc71;">✅ Pertenece al usuario: <strong>@${S.username}</strong></span>`,h&&(h.disabled=!1)):(b.innerHTML=`<span style="color: #e74c3c;">❌ ${S.message||"El código no existe"}</span>`,h&&(h.checked=!1,h.disabled=!0,T({target:h})))}catch{b.innerHTML='<span style="color: #e74c3c;">Error al verificar código</span>'}};y&&(y.addEventListener("blur",_),y.addEventListener("keyup",m=>{m.key==="Enter"&&_()}),_());const g=o.querySelector("textarea");g&&g.addEventListener("change",T);const x=o.querySelector("#campaign-image-upload");x&&x.addEventListener("change",async m=>{const E=m.target.files[0];if(!E)return;const S=o.querySelector("#campaign-upload-status");S.innerHTML='<span style="color: #f1c40f;">Subiendo imagen...</span>';const C=new FormData;C.append("image",E);try{const B=await f("/api/upload/campaign-image",{method:"POST",body:C});if(B.success){S.innerHTML='<span style="color: #2ecc71;">¡Imagen subida! Guardando configuración...</span>';const w=o.querySelector("#setting-referral_campaign_image_url");w.value=B.url,await T({target:w}),setTimeout(()=>loadReferralMessageSettings(),1e3)}else S.innerHTML=`<span style="color: #e74c3c;">Error: ${B.message}</span>`}catch(B){S.innerHTML=`<span style="color: #e74c3c;">Error: ${B.message||"Error de conexión."}</span>`}})}function Qe(e){const n=t.referralsTiersContainer;if(!n)return;const a=e.tiers,o=e.totalUsers;let r=0;a.forEach(d=>{const c=parseFloat(d.reward_amount),p=parseInt(d.max_users_limit,10);let v=0;if(d.tier_number>1){const h=a.find(b=>parseInt(b.tier_number,10)===d.tier_number-1);h&&(v=parseInt(h.max_users_limit,10))}const y=Math.max(0,p-v);r+=y*c*2});let s=`
            <div class="admin-card" style="border-left: 4px solid var(--admin-primary); margin-bottom: 1.5rem; background: #1c1c1e; padding: 20px; border-radius: 12px;">
                <h3 style="margin-top: 0; color: #fff;">Estado del Pool Promocional</h3>
                <div style="margin: 10px 0;">
                    <div style="display: flex; justify-content: space-between; font-weight: 600; margin-bottom: 5px; color: #fff;">
                        <span>BLUE comprometido en tramos:</span>
                        <span>${r.toLocaleString("es-ES")} / 200.000.000 BLUE</span>
                    </div>
                    <div style="background: rgba(255, 255, 255, 0.1); border-radius: 10px; height: 10px; overflow: hidden; width: 100%;">
                        <div style="background: ${r>2e8?"#ff453a":"var(--admin-primary)"}; width: ${Math.min(100,r/2e8*100)}%; height: 100%; transition: width 0.3s ease;"></div>
                    </div>
                    <small style="color: #8e8e93; display: block; margin-top: 8px; font-size: 0.85rem;">
                        Actualmente hay <strong style="color: #fff;">${o.toLocaleString("es-ES")}</strong> usuarios registrados en la plataforma.
                    </small>
                </div>
            </div>

            <table class="admin-table" style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <thead>
                    <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1);">
                        <th style="text-align: left; padding: 12px;">Tramo</th>
                        <th style="text-align: left; padding: 12px;">Límite de Usuarios (Límite Superior)</th>
                        <th style="text-align: left; padding: 12px;">Recompensa Referente y Referido (BLUE IOU)</th>
                        <th style="text-align: left; padding: 12px;">Emisión Máxima del Tramo</th>
                        <th style="text-align: left; padding: 12px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
        `;a.forEach(d=>{const c=parseFloat(d.reward_amount),p=parseInt(d.max_users_limit,10);let v=0;if(d.tier_number>1){const x=a.find(m=>parseInt(m.tier_number,10)===d.tier_number-1);x&&(v=parseInt(x.max_users_limit,10))}const h=Math.max(0,p-v)*c*2,b=o>=v&&o<p,_=b?'<span class="badge badge-success" style="font-weight:700; background: rgba(52, 199, 89, 0.2); color: #30d158; padding: 4px 8px; border-radius: 4px;">[ACTIVO HOY]</span>':o>=p?'<span class="badge badge-secondary" style="opacity:0.6; background: rgba(255,255,255,0.1); color: #fff; padding: 4px 8px; border-radius: 4px;">Completado</span>':'<span class="badge badge-secondary" style="opacity:0.6; background: rgba(255,255,255,0.05); color: #8e8e93; padding: 4px 8px; border-radius: 4px;">Próximo</span>';s+=`
                <tr ${b?'style="background: rgba(10, 132, 255, 0.08); border-left: 3px solid var(--admin-primary);"':""} style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                    <td style="padding: 12px;"><strong>${l(d.label)}</strong></td>
                    <td style="padding: 12px;">
                        <input type="number" class="admin-numeric-input tier-limit-input" 
                            data-tier-id="${d.id}" data-tier-number="${d.tier_number}" 
                            value="${p}" style="width: 100%; max-width: 180px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: #1c1c1e; color: #fff;" min="1" required>
                    </td>
                    <td style="padding: 12px;">
                        <input type="number" class="admin-numeric-input tier-reward-input" 
                            data-tier-id="${d.id}" data-tier-number="${d.tier_number}" 
                            value="${c.toFixed(2)}" style="width: 100%; max-width: 150px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: #1c1c1e; color: #fff;" min="0" step="0.01" required>
                    </td>
                    <td style="padding: 12px; font-weight: 500; color: #ff9f0a;">
                        ${h.toLocaleString("es-ES")} BLUE
                    </td>
                    <td style="padding: 12px;">${_}</td>
                </tr>
            `}),s+=`
                </tbody>
            </table>
            
            <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                <button id="save-referrals-tiers-btn" class="action-button-admin publish" style="background: var(--admin-primary); color: #fff; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; font-weight: 600;">
                    Guardar Configuración de Tramos
                </button>
            </div>
        `,n.innerHTML=s;const i=document.getElementById("save-referrals-tiers-btn");i&&i.addEventListener("click",Xe)}async function Xe(){const e=document.querySelectorAll(".tier-limit-input"),n=document.querySelectorAll(".tier-reward-input"),a=[];for(let r=0;r<e.length;r++){const s=parseInt(e[r].dataset.tierId,10),i=parseInt(e[r].dataset.tierNumber,10),d=parseInt(e[r].value,10),c=parseFloat(n[r].value);if(isNaN(d)||d<=0||isNaN(c)||c<0){u("Todos los límites y recompensas deben ser números positivos.");return}a.push({id:s,tier_number:i,label:i===1?"Tramo 1 (Primeros 10k)":i===2?"Tramo 2 (Siguientes 300k)":"Tramo 3 (Siguientes 700k)",max_users_limit:d,reward_amount:c})}for(let r=1;r<a.length;r++)if(a[r].max_users_limit<=a[r-1].max_users_limit){u(`El límite del Tramo ${a[r].tier_number} (${a[r].max_users_limit}) debe ser mayor que el del Tramo ${a[r-1].tier_number} (${a[r-1].max_users_limit}).`);return}let o=0;for(let r=0;r<a.length;r++){const s=a[r].reward_amount,i=a[r].max_users_limit,d=r>0?a[r-1].max_users_limit:0;o+=(i-d)*s*2}if(o>2e8){u(`Error de Viabilidad Financiera: La recompensa total proyectada (${o.toLocaleString("es-ES")} BLUE) excede el pool promocional de 200.000.000 BLUE.`);return}try{const r=document.getElementById("save-referrals-tiers-btn");r&&(r.disabled=!0,r.innerText="Guardando...");const s=await f("/api/admin/referrals/tiers",{method:"POST",body:JSON.stringify({tiers:a})});u(s.message||"Configuración de tramos guardada exitosamente."),ie()}catch(r){console.error("Error al guardar tramos:",r),u(r.message||"Error al guardar la configuración de tramos.");const s=document.getElementById("save-referrals-tiers-btn");s&&(s.disabled=!1,s.innerText="Guardar Configuración de Tramos")}}function et(e,n){const a=t.boostersSettingsContainer;if(!a)return;a.innerHTML="";const o=e.find(p=>p.setting_key==="booster_system_enabled");if(o){const p=me(o.setting_key),v=l(o.setting_key),y=o.description||"Activa o desactiva el programa de impulsores y los pagos mensuales.",h=`
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${l(p)}</h4>
                        <p>${l(y)}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${v}" ${o.setting_value==="true"?"checked":""}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>
            `;a.innerHTML+=h}const r=e.find(p=>p.setting_key==="booster_custom_frequency_enabled"),s=e.find(p=>p.setting_key==="booster_payment_frequency_days")||{setting_value:"0"},i=e.find(p=>p.setting_key==="booster_payment_frequency_hours")||{setting_value:"0"},d=e.find(p=>p.setting_key==="booster_payment_frequency_minutes")||{setting_value:"5"};if(r){const p=me(r.setting_key),v=l(r.setting_key),y=r.description||"Habilita o desactiva la frecuencia de cobro personalizada.",h=`
                <div class="setting-item">
                    <div class="setting-item-info">
                        <h4>${l(p)}</h4>
                        <p>${l(y)}</p>
                    </div>
                    <div class="setting-item-control">
                        <label class="switch">
                            <input type="checkbox" data-key="${v}" ${r.setting_value==="true"?"checked":""}>
                            <span class="slider"></span>
                        </label>
                    </div>
                </div>

                <!-- Grupo de campos numéricos para la frecuencia personalizada -->
                <div class="setting-item" id="booster-custom-frequency-inputs" style="margin-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 1rem;">
                    <div class="setting-item-info">
                        <h4>Intervalo de Pago Personalizado</h4>
                        <p>Establece el intervalo de tiempo exacto para la distribución automática de comisiones.</p>
                    </div>
                    <div class="setting-item-control-group">
                        <div class="numeric-group-item">
                            <label for="setting-booster-days">Días</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-days" data-key="booster_payment_frequency_days" value="${l(s.setting_value)}" min="0">
                        </div>
                        <div class="numeric-group-item">
                            <label for="setting-booster-hours">Horas</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-hours" data-key="booster_payment_frequency_hours" value="${l(i.setting_value)}" min="0" max="23">
                        </div>
                        <div class="numeric-group-item">
                            <label for="setting-booster-minutes">Minutos</label>
                            <input type="number" class="admin-numeric-input" id="setting-booster-minutes" data-key="booster_payment_frequency_minutes" value="${l(d.setting_value)}" min="0" max="59">
                        </div>
                    </div>
                </div>
            `;a.innerHTML+=h}a.innerHTML+='<hr class="admin-divider">';const c=`
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
                        ${n.map(p=>`
                            <tr data-level="${l(p.level)}">
                                <td class="level-cell">${l(p.level)}</td>
                                <td><input type="text" class="admin-text-input" data-field="name" value="${l(p.name)}"></td>
                                <td><input type="number" class="admin-numeric-input" data-field="min_blue_required" value="${l(p.min_blue_required)}" step="any"></td>
                                <td><textarea class="admin-textarea-input" data-field="description">${l(p.description||"")}</textarea></td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            </div>
        `;a.innerHTML+=c,a.querySelectorAll("#booster-levels-table input, #booster-levels-table textarea").forEach(p=>{p.addEventListener("change",ot)}),a.querySelectorAll('input[type="checkbox"], input[type="number"]').forEach(p=>{p.closest("#booster-levels-table")||(p.addEventListener("change",T),p.type==="number"&&p.addEventListener("keyup",v=>{v.key==="Enter"&&T(v)}))})}function tt(e){if(!t.boostersDashboardStats)return;const n={1:"Visionario (Nivel 1)",2:"Bronce (Nivel 2)",3:"Plata (Nivel 3)",4:"Oro (Nivel 4)",5:"Platino (Nivel 5)"},a={1:"#3B82F6",2:"#b45309",3:"#94a3b8",4:"#fbbf24",5:"#a78bfa"};let o="";for(let i=1;i<=5;i++){const d=e.debt_by_level&&e.debt_by_level[i]||{total:0,eligible:0};o+=`
                <div class="stat-card interactive-card" style="border-left: 4px solid ${a[i]};" data-target-tab="boosters-list" data-level="${i}">
                    <h4>${l(n[i])}</h4>
                    <p class="stat-value saldo-blue-text">${$(d.total)}</p>
                    <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 6px;">
                        Apto KYC: <strong style="color: #10B981;">${$(d.eligible)} BLUE</strong>
                    </div>
                </div>
            `}let r="",s=!1;e.coverage_by_level&&Array.isArray(e.coverage_by_level)&&e.coverage_by_level.forEach(i=>{if(i.percentage>0){s=!0;let d="#3B82F6";i.percentage===100&&(d="#10B981"),r+=`
                        <div style="margin-bottom: 12px;">
                            <p class="stat-value" style="color: ${d};">${i.percentage}%</p>
                            <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                                Nivel ${i.level}
                            </div>
                        </div>
                    `}}),s||(r=`
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 10px; text-align: center; font-style: italic;">
                    Comisiones insuficientes para proyectar canjes en este momento.
                </div>
            `),t.boostersDashboardStats.innerHTML=`
            <div class="stat-card interactive-card" data-target-tab="boosters-list">
                <h4>Impulsores Totales</h4>
                <p class="stat-value">${l(e.total_boosters||0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Aptos KYC: <strong style="color: #10B981;">${l(e.eligible_boosters||0)}</strong>
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-list">
                <h4>Compromiso Total (BLUE de Impulsores)</h4>
                <p class="stat-value saldo-blue-text">${$(e.total_booster_blue_debt)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Apto KYC: <strong style="color: #10B981;">${$(e.eligible_booster_blue_debt)} BLUE</strong>
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${$(e.platform_commission_balance||0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Saldo de comisiones disponible en caja
                </div>
            </div>
            <div class="stat-card interactive-card">
                <h4>Proyección de Canje</h4>
                <div style="margin-top: 8px;">
                    ${r}
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-payments">
                <h4>Total Pagado (BLUE)</h4>
                <p class="stat-value saldo-blue-text">${$(e.total_blue_paid_out)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Enviado a balance de custodia (Escrow)
                </div>
            </div>
            <div class="stat-card interactive-card" data-target-tab="boosters-payments">
                <h4>Pagos Mensuales Realizados</h4>
                <p class="stat-value">${l(e.total_payments_made||0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Ciclos ejecutados por cron automático
                </div>
            </div>
            ${o}
        `}function ue(e){if(!t.boostersListContainer)return;const n=document.getElementById("boosters-filter-badge-container"),a=document.getElementById("active-filter-level-num");if(n&&a)if(F!==null){const s={1:"1 (Visionario)",2:"2 (Bronce)",3:"3 (Plata)",4:"4 (Oro)",5:"5 (Platino)"};a.textContent=s[F]||F,n.style.display="block"}else n.style.display="none";const o=F?e.filter(s=>Number(s.booster_level)===Number(F)):e;if(!o||o.length===0){t.boostersListContainer.innerHTML='<p class="empty-message">No se encontraron impulsores para este nivel en la plataforma.</p>';return}const r=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Nivel de Impulsor</th>
                        <th style="text-align: center;">Estado KYC</th>
                        <th>Total BLUE de Impulsor</th>
                    </tr>
                </thead>
                <tbody>
                    ${o.map(s=>`
                        <tr>
                            <td class="username-cell">
                                <a href="profile.html?user=${l(s.username)}" target="_blank">${l(s.username)}</a>
                            </td>
                            <td align="center">${l(s.booster_level)}</td>
                            <td align="center">
                                ${s.kyc_verified?'<span class="status-badge active" style="background-color: #10B981; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">Verificado</span>':'<span class="status-badge" style="background-color: #EF4444; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">No Verificado</span>'}
                            </td>
                            <td class="saldo-blue-text">${$(s.total_booster_blue)}</td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;t.boostersListContainer.innerHTML=r}function at(e){if(!t.boostersPaymentsContainer)return;const n=e.reduce((s,i)=>s+(parseFloat(i.amount_paid)||0),0),a=e.length,o=`
            <div class="booster-payments-summary-bar" style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; flex-wrap: wrap;">
                <div class="stat-card" style="flex: 1; min-width: 250px; border-left: 4px solid #10B981; margin-bottom: 0; padding: 16px; background: var(--admin-card-bg); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h4 style="margin: 0; font-size: 0.9rem; color: var(--admin-text-secondary); font-weight: 500;">Total de Recompensas Liquidadas</h4>
                    <p class="stat-value saldo-blue-text" style="margin: 8px 0 4px; font-size: 1.8rem; font-weight: 700; color: #10B981;">+${$(n)}</p>
                    <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">
                        Suma del historial mostrado
                    </div>
                </div>
                <div class="stat-card" style="flex: 1; min-width: 250px; border-left: 4px solid #3B82F6; margin-bottom: 0; padding: 16px; background: var(--admin-card-bg); border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <h4 style="margin: 0; font-size: 0.9rem; color: var(--admin-text-secondary); font-weight: 500;">Transacciones de Pago</h4>
                    <p class="stat-value" style="margin: 8px 0 4px; font-size: 1.8rem; font-weight: 700; color: #3B82F6;">${a}</p>
                    <div style="font-size: 0.8rem; color: var(--admin-text-secondary);">
                        Número de liquidaciones individuales
                    </div>
                </div>
            </div>
        `;if(!e||e.length===0){t.boostersPaymentsContainer.innerHTML=o+'<p class="empty-message">No se han registrado pagos de impulsores aún.</p>';return}const r=`
            ${o}
            <table class="admin-table">
                <thead>
                    <tr>
                        <th style="width: 200px;">Fecha de Pago</th>
                        <th>Usuario</th>
                        <th style="text-align: center; width: 150px;">Nivel de Pago</th>
                        <th>Periodo Liquidado</th>
                        <th style="text-align: right; width: 180px;">BLUE Pagado</th>
                    </tr>
                </thead>
                <tbody>
                    ${e.map(s=>`
                        <tr>
                            <td>${new Date(s.created_at).toLocaleString()}</td>
                            <td class="username-cell">
                                <a href="profile.html?user=${l(s.username)}" target="_blank">${l(s.username)}</a>
                            </td>
                            <td align="center">
                                <span class="status-badge active" style="background-color: #3B82F6; font-size: 0.75rem; padding: 4px 8px; border-radius: 12px; font-weight: bold; color: white;">Nivel ${l(s.booster_level_at_payment)}</span>
                            </td>
                            <td>${new Date(s.payment_month).toLocaleDateString("es-ES",{month:"long",year:"numeric"})}</td>
                            <td class="saldo-blue-text" style="font-weight: bold; color: #10B981; text-align: right;">
                                +${$(s.amount_paid)}
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        `;t.boostersPaymentsContainer.innerHTML=r}let G;async function T(e){const n=e.target;if(!n.dataset.key)return;const a=n.dataset.key;let o;const r=n.tagName.toLowerCase()==="textarea";if(n.type==="checkbox")o=n.checked.toString();else if(n.type==="number")o=n.value;else if(n.type==="date"){if(o=n.value,o){const s=new Date(o);if(isNaN(s.getTime())){u("Fecha inválida. Por favor, ingresa una fecha válida."),te();return}}}else if(n.type==="text"||n.type==="hidden"||r)o=n.value;else return;n.type==="number"||n.type==="date"||n.type==="text"||r?(clearTimeout(G),G=setTimeout(()=>{ge(a,o)},500)):ge(a,o)}async function nt(e){const n=e.target.closest(".menu-toggle");if(n){e.stopPropagation();const o=n.nextElementSibling,r=o.classList.contains("visible");document.querySelectorAll(".action-menu.visible").forEach(s=>{s.classList.remove("visible")}),r||o.classList.add("visible");return}const a=e.target.closest(".action-button-admin");if(a&&a.dataset.action){const o=a.dataset.action,r=a.closest("tr"),s=r.dataset.userId,i=r.dataset.username,d=r.dataset.status;if(o==="edit-referral"){const h=r.dataset.referralCode||"",b=prompt(`Nuevo código de referido para ${i} (Solo letras, números y guiones):`,h);if(b!==null&&b.trim()!==""&&b!==h)try{const _=await f(`/api/admin/users/${s}/referral-code`,{method:"PUT",body:JSON.stringify({newReferralCode:b.trim().toUpperCase()})});u(_.message||"Código actualizado correctamente."),q(t.userSearchInput.value,t.userStatusFilter.value)}catch(_){u(`Error al actualizar código: ${_.message}`)}return}const c={suspend:{verb:"suspender",noun:"suspensión"},ban:{verb:"banear",noun:"baneo"},activate:{verb:"reactivar",noun:"reactivación"}},{verb:p,noun:v}=c[o];if(o==="suspend"&&d==="suspended"||o==="ban"&&d==="banned"||o==="activate"&&d==="active"){u(`El usuario ${l(i)} ya está en ese estado.`);return}let y="active";o==="suspend"?y="suspended":o==="ban"&&(y="banned"),L(`¿Estás seguro de que quieres ${p} al usuario "${l(i)}"?`,async()=>{try{const h=await f(`/api/admin/users/${s}/status`,{method:"POST",body:JSON.stringify({status:y})});u(h.message||"Acción completada con éxito."),q(t.userSearchInput.value,t.userStatusFilter.value)}catch(h){u(`Error durante la ${v}: ${h.message}`)}})}}function ot(e){const a=e.target.closest("tr"),o=a.dataset.level,r={level:parseInt(o),name:a.querySelector('[data-field="name"]').value,min_blue_required:parseFloat(a.querySelector('[data-field="min_blue_required"]').value),description:a.querySelector('[data-field="description"]').value};clearTimeout(G),G=setTimeout(()=>{rt(r)},500)}async function ge(e,n){try{await f("/api/admin/settings",{method:"POST",body:JSON.stringify({key:e,value:n})}),console.log("Setting actualizado.")}catch(a){a.message.includes("gobernanza")?u(`🔐 ${a.message}

Dirige tu solicitud al panel de gobernanza.`):u(`Error al guardar la configuración: ${a.message}`),te()}}async function rt(e){try{await f("/api/admin/boosters/settings",{method:"POST",body:JSON.stringify(e)}),console.log("Nivel de impulsor actualizado.")}catch(n){n.message.includes("gobernanza")?u(`🔐 ${n.message}

Dirige tu solicitud al panel de gobernanza.`):u(`Error al guardar el nivel: ${n.message}`),le()}}async function st(e){const n=e.target.closest(".action-button-admin.delete");if(n){const o=n.dataset.pubId,r=n.closest("tr").querySelector(".publication-title-cell").textContent;L(`¿Seguro que quieres eliminar la publicación "${l(r)}"? Esta acción es irreversible.`,async()=>{try{const s=await f(`/api/admin/publications/${o}`,{method:"DELETE"});u(s.message||"Publicación eliminada."),O(t.publicationSearchInput.value,t.publicationStatusFilter?.value||"active")}catch(s){u(`Error al eliminar: ${s.message}`)}})}const a=e.target.closest(".action-button-admin.restore");if(a){const o=a.dataset.pubId,r=a.closest("tr").querySelector(".publication-title-cell").textContent;L(`¿Seguro que quieres restaurar la publicación "${l(r)}"?`,async()=>{try{const s=await f(`/api/admin/publications/${o}/restore`,{method:"POST"});u(s.message||"Publicación restaurada."),O(t.publicationSearchInput.value,t.publicationStatusFilter?.value||"active")}catch(s){u(`Error al restaurar: ${s.message}`)}})}}function it(){const e={},n=["text","textarea"];return document.querySelectorAll("#platformStepInputs .admin-step-input").forEach(o=>{const r=o.getAttribute("data-step"),s=o.querySelector(".step-form-checkbox");if(s&&s.checked){const i=[],d=o.querySelectorAll(".step-form-field-wrapper");d.forEach(c=>{const p=c.querySelector(".step-form-field"),v=c.querySelector(".step-form-type-select"),y=p?p.value.trim():"",h=v&&n.includes(v.value)?v.value:"text";y&&i.push({label:y,type:h})}),d.length===0&&o.querySelectorAll(".step-form-field").forEach(p=>{const v=p.value.trim();v&&i.push({label:v,type:"text"})}),i.length>0&&(e[r]=i)}}),Object.keys(e).length>0?e:null}async function lt(e){e.preventDefault();const n="[[INSTRUCTIONS_STEPS]]",a="[[/INSTRUCTIONS_STEPS]]",o=xt(),r=document.getElementById("platformPubDescription").value,s=Et(r),i=o.length?`${s}

${n}
${o.join(`
`)}
${a}`:s,d=e.target,c=document.getElementById("platformAllowRepeatParticipation").checked,p=t.platformRepeatLimit?parseInt(t.platformRepeatLimit.value,10):NaN;if(c&&(!Number.isFinite(p)||p<2)){u("Indica el máximo de repeticiones por usuario (mínimo 2).");return}const v=t.platformRepeatCooldownDays?parseInt(t.platformRepeatCooldownDays.value,10):0,y=t.platformRepeatCooldownHours?parseInt(t.platformRepeatCooldownHours.value,10):0,h=t.platformRepeatCooldownMinutes?parseInt(t.platformRepeatCooldownMinutes.value,10):0,b=Number.isFinite(v)?v:0,_=Number.isFinite(y)?y:0,g=Number.isFinite(h)?h:0,x=b*24*60+_*60+g;if(c&&x<1){u("Indica el tiempo mínimo para repetir (mínimo 1 minuto).");return}const m=document.getElementById("platformTargetUsername"),E=m?m.value.trim():"",S=it(),C={title:document.getElementById("platformPubTitle").value,description:i,cost:document.getElementById("platformPubCost").value,availableSlots:document.getElementById("platformPubSlots").value,isSellPost:document.querySelector('input[name="platformPubType"]:checked').value==="sell",autoApprove:document.getElementById("platformAutoApprove").checked,allowRepeatParticipation:c,maxRepeatPerUser:c?p:1,repeatCooldownDays:c?b:0,repeatCooldownHours:c?_:0,repeatCooldownMinutes:c?g:12,isBoosterTask:document.getElementById("platformIsBoosterTask").checked,targetUsername:E||null,formFields:S,showPreflightModal:document.getElementById("platformShowPreflightModal").checked,image_urls:M,requires_evidence:document.getElementById("platformRequiresEvidence")?document.getElementById("platformRequiresEvidence").checked:!1};try{if(U){const w=await f(`/api/admin/platform/publications/${U}`,{method:"PUT",body:JSON.stringify(C)});u(w.message||"Publicación actualizada con éxito.")}else{const w=await f("/api/admin/platform/create-publication",{method:"POST",body:JSON.stringify(C)});u(w.message||"Publicación creada con éxito.")}d.reset(),M=[];const B=document.getElementById("platformMediaPreviewContainer");B&&(B.innerHTML=""),Ee(),ee()}catch(B){u(`Error al crear la publicación: ${B.message}`)}}async function dt(e){const n=e.target.closest(".action-button-admin");if(!n)return;const a=n.dataset.pubId,o=n.dataset.action,r=n.dataset.user,s="Plataforma WintonCoin";let i,d={};switch(o){case"edit":await St(a);return;case"copy":await Bt(a);return;case"approve":i=`/publications/${a}/approve`,d={approverUsername:s,userToApprove:r};break;case"discard":i=`/publications/${a}/discard`,d={discarderUsername:s,userToDiscard:r};break;case"confirm-payment":i=`/publications/${a}/confirm-payment`,d={confirmerUsername:s,workerUsername:r};break;default:return}try{const c=await f(i,{method:"POST",body:JSON.stringify(d)});u(c.message||"Acción completada con éxito."),ee()}catch(c){u(`Error al realizar la acción: ${c.message}`)}}const ct={open:"Abierta",pending_approval:"Pendiente",approved:"Aprobada",completed:"Culminada",confirmed_paid:"Pagada"};function fe(e){return ct[e]||e.charAt(0).toUpperCase()+e.slice(1)}function ye(e,n){if(n===0)return'<span class="no-rating">Sin calif.</span>';const a="★".repeat(Math.round(e))+"☆".repeat(5-Math.round(e));return`<span class="stars" title="${parseFloat(e).toFixed(1)} de 5">${a}</span> <span class="rating-count">(${n})</span>`}async function pt(){if(t.boostersStagesContainer){t.boostersStagesContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await fetch(`${P}/api/admin/boosters/config-stages`,{credentials:"include"});if(!e.ok)throw new Error("Error al cargar etapas");const n=await e.json();let a=`
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
            `;n.forEach(o=>{const r=new Date(o.start_date).toLocaleDateString("es-ES",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}),s=new Date(o.end_date).toLocaleDateString("es-ES",{timeZone:"UTC",day:"2-digit",month:"2-digit",year:"numeric"}),i=`${r} <span style="font-size: 0.7em; color: #666;">UTC</span>`,d=`${s} <span style="font-size: 0.7em; color: #666;">UTC</span>`,c=o.is_active?'<span class="badge badge-success">Activo</span>':'<span class="badge badge-danger">Inactivo</span>';a+=`
                    <tr>
                        <td><strong>${l(o.name)}</strong></td>
                        <td class="multiplier-cell" style="font-weight: 800; color: #7f00ff;">${parseFloat(o.multiplier).toFixed(2)}x</td>
                        <td>${i}</td>
                        <td>${d}</td>
                        <td>${c}</td>
                        <td>
                            <button class="admin-btn-small edit-stage-btn" data-id="${o.id}">Editar</button>
                        </td>
                    </tr>
                `}),a+="</tbody></table>",t.boostersStagesContainer.innerHTML=a}catch(e){console.error("Error al cargar etapas:",e),t.boostersStagesContainer.innerHTML=`<div class="error-msg">Error: ${e.message}</div>`}}}function mt(e){if(!t.dashboardContainer)return;let n="",a=!1;e.coverage_by_level&&Array.isArray(e.coverage_by_level)&&e.coverage_by_level.forEach(o=>{if(o.percentage>0){a=!0;let r="#3B82F6";o.percentage===100&&(r="#10B981"),n+=`
                        <div style="margin-bottom: 12px;">
                            <p class="stat-value" style="color: ${r};">${o.percentage}%</p>
                            <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                                Nivel ${o.level}
                            </div>
                        </div>
                    `}}),a||(n=`
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 10px; text-align: center; font-style: italic;">
                    Comisiones insuficientes para proyectar canjes en este momento.
                </div>
            `),t.dashboardContainer.innerHTML=`
            <div class="stat-card interactive-card" data-target-section="users">
                <h4>Usuarios Totales</h4>
                <p class="stat-value">${l(e.totalUsers||0)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="publications">
                <h4>Publicaciones Activas</h4>
                <p class="stat-value">${l(e.activePublications||0)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>BLUE en Circulación (Tokens Reales)</h4>
                <p class="stat-value saldo-blue-text">${$(e.totalBlue)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>RED en Circulación (Compromiso Total)</h4>
                <p class="stat-value saldo-red-text">${$(e.totalRed)}</p>
            </div>
            <div class="stat-card interactive-card" data-target-section="platform-wallet">
                <h4>Comisiones Acumuladas</h4>
                <p class="stat-value saldo-blue-text">${$(e.platformCommissionBalance)}</p>
            </div>
            <div class="stat-card interactive-card">
                <h4>Proyección de Canje</h4>
                <div style="margin-top: 8px;">
                    ${n}
                </div>
            </div>
            
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU Comprometidos (Tareas Plataforma)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${$(e.totalPlatformEscrow||0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU en Ejecución (Fondos Asignados)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${$(e.totalPlatformInExecution||0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="platform-publications">
                <h4>BLUE IOU Pendientes de Pago (En Auditoría)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${$(e.totalPlatformPendingPayment||0)}</p>
            </div>
            <div class="stat-card interactive-card" style="border-left: 4px solid #8B5CF6;" data-target-section="boosters">
                <h4>BLUE IOU Entregados (Compromiso Futuro)</h4>
                <p class="stat-value" style="color: #8B5CF6;">${$(e.totalBoosterFunds||0)}</p>
                <div style="font-size: 0.85rem; color: var(--admin-text-secondary); margin-top: 4px;">
                    Apto KYC: <strong style="color: #10B981;">${$(e.eligibleBoosterFunds||0)} BLUE</strong>
                </div>
            </div>
        `}function ut(e){if(!t.debtorsTableContainer)return;if(!e||e.length===0){t.debtorsTableContainer.innerHTML='<p class="empty-message">No hay usuarios con compromisos vencidos actualmente.</p>';return}const n=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Usuario</th>
                        <th>Compromiso Vencido Total (RED)</th>
                        <th>Nº de Compromisos Vencidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${e.map(a=>bt(a)).join("")}
                </tbody>
            </table>
        `;t.debtorsTableContainer.innerHTML=n}function gt(e){if(!t.auditLogContainer)return;const n=e?.rows||[];if(n.length===0){t.auditLogContainer.innerHTML='<p class="empty-message">No hay eventos que coincidan con los filtros.</p>';return}const a=`
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
                    ${n.map(o=>ft(o)).join("")}
                </tbody>
            </table>
        `;t.auditLogContainer.innerHTML=a}function ft(e){const n=e.created_at?new Date(e.created_at):null,a=n?n.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha",o=yt(e.metadata);return`
            <tr>
                <td>${l(a)}</td>
                <td>${l(e.event_type)}</td>
                <td>${l(e.actor_username||"")}</td>
                <td>${l(e.target_username||"")}</td>
                <td>${l(e.publication_id??"")}</td>
                <td>${l(e.category||"")}</td>
                <td>${l(e.ip_address||"")}</td>
                <td class="audit-metadata">${l(o)}</td>
            </tr>
        `}function yt(e){try{const n=typeof e=="string"?e:JSON.stringify(e||{});return n.length>160?`${n.slice(0,160)}...`:n}catch{return""}}function bt(e){return`
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${l(e.username)}" target="_blank">${l(e.username)}</a>
                </td>
                <td class="saldo-red-text">${$(e.total_penalized_debt)}</td>
                <td align="center">${l(e.penalized_debts_count)}</td>
            </tr>
        `}function vt(e){const n=be(D);if(ve(n.totalPending),!e||e.length===0){t.platformManagementList&&(t.platformManagementList.innerHTML='<p class="empty-message">No hay publicaciones de la plataforma que requieran acción.</p>');return}t.platformManagementList&&(t.platformManagementList.innerHTML=e.map(a=>ht(a)).join(""))}function J(){if(!t.platformManagementList)return;const e=(t.platformPublicationSearchInput?.value||"").trim().toLowerCase(),n=t.platformPublicationStatusFilter?.value||"all",a=t.platformPublicationSortSelect?.value||"pending";let o=[...D];e&&(o=o.filter(s=>{const i=(s.title||"").toLowerCase(),d=(s.description||"").toLowerCase(),c=(s.author_username||"").toLowerCase(),p=String(s.id||"");return i.includes(e)||d.includes(e)||c.includes(e)||p.includes(e)})),n!=="all"&&(o=o.filter(s=>{switch(n){case"active":return!s.is_deleted&&!s.is_expired&&!s.is_completed_publication&&!s.is_paused;case"paused":return!!s.is_paused&&!s.is_deleted;case"completed":return!!s.is_completed_publication&&!s.is_deleted;case"expired":return!!s.is_expired&&!s.is_deleted;case"deleted":return!!s.is_deleted;default:return!0}}));const r=s=>Number(s)||0;if(o.sort((s,i)=>{const d=K(s),c=K(i);switch(a){case"recent":return new Date(i.created_at||0)-new Date(s.created_at||0);case"oldest":return new Date(s.created_at||0)-new Date(i.created_at||0);case"reward_desc":return r(i.blue_cost)-r(s.blue_cost);case"reward_asc":return r(s.blue_cost)-r(i.blue_cost);case"participants_desc":return(i.participants?.length||0)-(s.participants?.length||0);case"approvals_desc":return c.pendingApprovals-d.pendingApprovals;case"payments_desc":return c.pendingPayments-d.pendingPayments;case"pending":default:return c.pendingApprovals!==d.pendingApprovals?c.pendingApprovals-d.pendingApprovals:c.totalPending-d.totalPending}}),o.length===0){t.platformManagementList.innerHTML='<p class="empty-message">No hay publicaciones que coincidan con la búsqueda.</p>';return}vt(o)}function be(e){return!e||e.length===0?{pendingApprovals:0,pendingPayments:0,totalPending:0}:e.reduce((n,a)=>{const o=K(a);return n.pendingApprovals+=o.pendingApprovals,n.pendingPayments+=o.pendingPayments,n.totalPending+=o.totalPending,n},{pendingApprovals:0,pendingPayments:0,totalPending:0})}function K(e){const n=Array.isArray(e.participants)?e.participants:[],a=n.filter(s=>s.status==="pending_approval").length,o=n.filter(s=>s.status==="completed").length,r=a+o;return{pendingApprovals:a,pendingPayments:o,totalPending:r}}function ve(e){if(!t.platformPublicationsBadge)return;const n=parseInt(e,10)||0;n>0?(t.platformPublicationsBadge.textContent=n,t.platformPublicationsBadge.style.display="inline-flex",t.platformPublicationsBadge.classList.add("is-visible")):(t.platformPublicationsBadge.textContent="",t.platformPublicationsBadge.style.display="none",t.platformPublicationsBadge.classList.remove("is-visible"))}function ht(e){const n=e.created_at?new Date(e.created_at):null,a=n?n.toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha",o=e.is_sell_post?"Venta":"Solicitud",r=e.is_sell_post?"sell":"request",s=$(e.blue_cost),i=Se(e),d=Be(e),c=Number.isFinite(Number(e.available_slots))?`${e.available_slots}`:"N/A",p=Array.isArray(e.participants)?e.participants.length:0,v=K(e),y=v.pendingApprovals>0?`<span class="pending-badge warning">Aprobar: ${v.pendingApprovals}</span>`:"",h=v.pendingPayments>0?`<span class="pending-badge">Pagos: ${v.pendingPayments}</span>`:"",b=Number.isFinite(Number(e.max_repeat_per_user))?` (máx ${e.max_repeat_per_user})`:"",_=e.allow_repeat_participation?`Sí${b}`:"No";let g='<p class="no-participants" style="padding: 1rem; text-align: center; color: var(--admin-text-secondary);">Sin participantes por ahora.</p>';if(e.participants&&e.participants.length>0){const S=e.participants.length,C=3;if(S<=C)g=`<ul class="participants-list-admin">${e.participants.map(B=>ae(e.id,B)).join("")}</ul>`;else{const B=e.participants.slice(0,C),w=e.participants.slice(C),N=`more-participants-${e.id}`,H=`<ul class="participants-list-admin" style="margin-bottom: 0;">${B.map(R=>ae(e.id,R)).join("")}</ul>`,A=`<ul class="participants-list-admin" id="${N}" style="display: none; margin-top: 0; border-top: none;">${w.map(R=>ae(e.id,R)).join("")}</ul>`,I=`
                    <div style="text-align: center; padding: 0.5rem; background: rgba(255, 255, 255, 0.05); border-radius: 0 0 8px 8px;">
                        <button class="action-button-admin secondary small" 
                                onclick="document.getElementById('${N}').style.display='block'; this.parentNode.style.display='none';"
                                style="width: auto; padding: 4px 12px; font-size: 0.85rem;">
                            Ver todos (${S})
                        </button>
                    </div>
                `;g=H+A+I}}const{mainText:x,steps:m}=he(e.description),E=_t(m);return`
            <div class="history-item-admin">
                <div class="history-item-header">
                    <h3>${l(e.title)}</h3>
                    <div class="pending-badges">
                        ${y}
                        ${h}
                    </div>
                </div>
                <p>${l(x||"Sin descripción.")}</p>
                ${E}
                <div class="history-item-actions">
                    <button class="action-button-admin edit" data-action="edit" data-pub-id="${l(e.id)}">Editar</button>
                    <button class="action-button-admin copy" data-action="copy" data-pub-id="${l(e.id)}" title="Copiar datos al formulario">Copiar</button>
                </div>
                <div class="history-item-meta">
                    <span><strong>ID:</strong> ${l(e.id)}</span>
                    <span><strong>Tipo:</strong> <span class="status-badge ${r}">${o}</span></span>
                    <span><strong>Precio:</strong> ${s} BLUE</span>
                    <span><strong>Cupos:</strong> ${l(c)}</span>
                    <span><strong>Participantes:</strong> ${l(p)}</span>
                    <span><strong>Repetible:</strong> ${l(_)}</span>
                    <span><strong>Estado:</strong> <span class="status-badge ${l(d)}">${l(i)}</span></span>
                    <span><strong>Fecha:</strong> ${l(a)}</span>
                </div>
                <h4>Participantes</h4>
                ${g}
            </div>
        `}function xt(){return t.platformStepInputs?Array.from(t.platformStepInputs.querySelectorAll(".admin-step-input")).map(e=>{const n=e.querySelector(':scope > input[type="text"]');return n?n.value.trim():""}).filter(e=>e.length>0):[]}function Et(e){if(!e)return"";const n="[[INSTRUCTIONS_STEPS]]",a="[[/INSTRUCTIONS_STEPS]]",o=new RegExp(`${n}[\\s\\S]*?${a}`,"g");return e.replace(o,"").trim()}function he(e){const n="[[INSTRUCTIONS_STEPS]]",a="[[/INSTRUCTIONS_STEPS]]";if(!e||!e.includes(n))return{mainText:e||"",steps:[]};const o=e.indexOf(n),r=e.indexOf(a);if(r===-1)return{mainText:e||"",steps:[]};const s=e.slice(0,o).trim(),i=e.slice(o+n.length,r).split(`
`).map(d=>d.trim()).filter(d=>d.length>0);return{mainText:s,steps:i}}function _t(e){return!e||e.length===0?"":`
            <div class="admin-step-flow">
                <h4 class="admin-step-title">Sigue las instrucciones paso a paso sin saltar ninguno</h4>
                <ol class="admin-steps-list">
                    ${e.map((a,o)=>`
            <li class="admin-step-item">
                <div class="admin-step-node">
                    <span class="admin-step-index">${o+1}</span>
                </div>
                <div class="admin-step-content">
                    <div class="admin-step-badge">Paso ${o+1}</div>
                    <div class="admin-step-text">${l(a)}</div>
                </div>
            </li>
        `).join("")}
                </ol>
            </div>
        `}async function St(e){let n=D.find(o=>String(o.id)===String(e));if(!n)try{D=await f("/api/admin/platform/publications-with-participants")||[],n=D.find(r=>String(r.id)===String(e))}catch(o){u(`No se pudo cargar la publicación para editar: ${o.message}`);return}if(!n){u("No se encontró la publicación para editar.");return}U=n.id,xe(n);const a=document.getElementById("platformPublicationForm")||document.querySelector(".admin-form");a&&a.scrollIntoView({behavior:"smooth"})}async function Bt(e){let n=D.find(s=>String(s.id)===String(e));if(!n)try{D=await f("/api/admin/platform/publications-with-participants")||[],n=D.find(i=>String(i.id)===String(e))}catch(s){u(`No se pudo cargar la publicación para copiar: ${s.message}`);return}if(!n){u("No se encontró la publicación para copiar.");return}U=null,xe(n);const a=document.getElementById("platformSubmitButton")||t.platformPublicationSubmitBtn;a&&(a.textContent="Crear Publicación");const o=document.getElementById("cancelEditBtn")||t.platformCancelEditBtn;o&&(o.style.display="none"),t.platformEditNotice&&(t.platformEditNotice.style.display="none"),u('Datos copiados al formulario. Revisa y pulsa "Crear Publicación".');const r=document.getElementById("platformPublicationForm")||document.querySelector(".admin-form");r&&r.scrollIntoView({behavior:"smooth"})}function xe(e){const{mainText:n,steps:a}=he(e.description);document.getElementById("platformPubTitle").value=e.title||"",document.getElementById("platformPubDescription").value=n||"";const o=e.base_blue_cost?e.base_blue_cost:e.blue_cost||"";document.getElementById("platformPubCost").value=o,document.getElementById("platformPubSlots").value=e.available_slots||1,document.getElementById("platformAutoApprove").checked=!!e.auto_approve,document.getElementById("platformAllowRepeatParticipation").checked=!!e.allow_repeat_participation,document.getElementById("platformIsBoosterTask").checked=!!e.is_booster_task;const r=document.getElementById("platformShowPreflightModal");r&&(r.checked=!!e.show_preflight_modal);const s=document.getElementById("platformRequiresEvidence");s&&(s.checked=!!e.requires_evidence),M=e.image_urls||[];const i=document.getElementById("platformMediaPreviewContainer");if(i&&(i.innerHTML="",M.forEach(d=>{const c=document.createElement("div");c.className="media-preview-item";const p=document.createElement("img");p.src=d,p.classList.add("loaded");const v=document.createElement("button");v.className="remove-btn",v.innerHTML="&times;",v.type="button",v.style.display="block",c.appendChild(p),c.appendChild(v),i.appendChild(c),v.onclick=y=>{y.stopPropagation(),M=M.filter(h=>h!==d),c.remove()}})),t.platformRepeatLimit){const d=Number(e.max_repeat_per_user);t.platformRepeatLimit.value=Number.isFinite(d)&&d>=2?d:2}if(t.platformRepeatLimitWrapper&&(t.platformRepeatLimitWrapper.style.display=e.allow_repeat_participation?"flex":"none"),t.platformRepeatCooldownWrapper&&(t.platformRepeatCooldownWrapper.style.display=e.allow_repeat_participation?"flex":"none"),t.platformRepeatCooldownDays||t.platformRepeatCooldownHours||t.platformRepeatCooldownMinutes){const d=Number(e.repeat_cooldown_minutes),c=Number(e.repeat_cooldown_hours),p=Number.isFinite(d)&&d>0?d:Number.isFinite(c)&&c>0?Math.round(c*60):12,v=Math.floor(p/1440),y=Math.floor(p%1440/60),h=p%60;t.platformRepeatCooldownDays&&(t.platformRepeatCooldownDays.value=String(v)),t.platformRepeatCooldownHours&&(t.platformRepeatCooldownHours.value=String(y)),t.platformRepeatCooldownMinutes&&(t.platformRepeatCooldownMinutes.value=String(h))}e.is_sell_post?document.getElementById("platformPubTypeSell").checked=!0:document.getElementById("platformPubTypeRequest").checked=!0,$t(a,e.form_fields||e.form_options),t.platformPublicationSubmitBtn&&(t.platformPublicationSubmitBtn.textContent="Guardar cambios"),t.platformCancelEditBtn&&(t.platformCancelEditBtn.style.display="inline-flex"),t.platformEditNotice&&(t.platformEditNotice.textContent=`Editando publicación #${e.id}`,t.platformEditNotice.style.display="block"),window.scrollTo({top:0,behavior:"smooth"})}function Ee(){U=null,t.platformPublicationSubmitBtn&&(t.platformPublicationSubmitBtn.textContent="Crear Publicación"),t.platformCancelEditBtn&&(t.platformCancelEditBtn.style.display="none"),t.platformEditNotice&&(t.platformEditNotice.style.display="none"),t.platformStepInputs&&t.platformStepInputs.querySelectorAll(".admin-step-input").forEach((a,o)=>{if(o>3)a.remove();else{const r=a.querySelector("input");r&&(r.value="")}}),t.platformAddStepBtn&&(t.platformAddStepBtn.disabled=!1),t.platformRepeatLimit&&(t.platformRepeatLimit.value="2"),t.platformRepeatLimitWrapper&&(t.platformRepeatLimitWrapper.style.display="none"),t.platformRepeatCooldownDays&&(t.platformRepeatCooldownDays.value="0"),t.platformRepeatCooldownHours&&(t.platformRepeatCooldownHours.value="0"),t.platformRepeatCooldownMinutes&&(t.platformRepeatCooldownMinutes.value="12"),t.platformRepeatCooldownWrapper&&(t.platformRepeatCooldownWrapper.style.display="none");const e=document.getElementById("platformTargetUsername");e&&(e.value="")}function $t(e,n){t.platformStepInputs&&(t.platformStepInputs.innerHTML="",e.forEach((a,o)=>{const r=o+1;Ct(r);const s=document.getElementById(`platformStep${r}`);if(s&&(s.value=a),n&&n[r]){const i=t.platformStepInputs.querySelector(`.admin-step-input[data-step="${r}"]`);if(i){const d=i.querySelector(".step-form-checkbox"),c=i.querySelector(".step-form-fields"),p=i.querySelector(".step-form-inputs");if(d&&c&&p){d.checked=!0,c.style.display="block",p.innerHTML="",n[r].forEach((y,h)=>{const b=typeof y=="string"?y:y?.label||"",_=typeof y=="object"&&y?.type==="textarea"?"textarea":"text",g=document.createElement("div");g.className="step-form-field-wrapper";const x=document.createElement("input");x.type="text",x.className="step-form-field",x.value=b,x.placeholder=`Campo ${h+1}`;const m=document.createElement("select");m.className="step-form-type-select",m.title="Tipo de campo",m.innerHTML=`
                                <option value="text"${_==="text"?" selected":""}>Texto corto</option>
                                <option value="textarea"${_==="textarea"?" selected":""}>Texto largo</option>
                            `,g.appendChild(x),g.appendChild(m),p.appendChild(g)});const v=n[r].length;if(v<3)for(let y=v;y<3;y++){const h=document.createElement("div");h.className="step-form-field-wrapper",h.innerHTML=`
                                    <input type="text" class="step-form-field" placeholder="Campo ${y+1}">
                                    <select class="step-form-type-select" title="Tipo de campo">
                                        <option value="text">Texto corto</option>
                                        <option value="textarea">Texto largo</option>
                                    </select>
                                `,p.appendChild(h)}}}}}))}function Ct(e){if(e>20||document.getElementById(`platformStep${e}`))return;const o=document.createElement("div");o.className="admin-step-input",o.setAttribute("data-step",e);const r=document.createElement("label");r.setAttribute("for",`platformStep${e}`),r.textContent=`Paso ${e}`;const s=document.createElement("input");s.type="text",s.id=`platformStep${e}`,s.placeholder=`Describe el paso ${e}`;const i=document.createElement("div");i.className="step-form-toggle",i.innerHTML=`
            <label class="toggle-label">
                <input type="checkbox" class="step-form-checkbox" data-step="${e}">
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
        `,o.appendChild(r),o.appendChild(s),o.appendChild(i),t.platformStepInputs.appendChild(o);const d=i.querySelector(".step-form-checkbox"),c=i.querySelector(".step-form-fields");d&&d.addEventListener("change",y=>{c.style.display=y.target.checked?"block":"none"});const p=i.querySelector(".step-add-field-btn"),v=i.querySelector(".step-form-inputs");p&&v&&p.addEventListener("click",()=>{const y=v.querySelectorAll(".step-form-field").length,h=document.createElement("div");h.className="step-form-field-wrapper";const b=document.createElement("input");b.type="text",b.className="step-form-field",b.placeholder=`Campo ${y+1}`;const _=document.createElement("select");_.className="step-form-type-select",_.title="Tipo de campo",_.innerHTML=`
                    <option value="text">Texto corto</option>
                    <option value="textarea">Texto largo</option>
                `,h.appendChild(b),h.appendChild(_),v.appendChild(h)}),t.platformStepInputs.querySelectorAll(".admin-step-input").length>=20&&(t.platformAddStepBtn.disabled=!0)}function ae(e,n){const a=ye(n.average_rating,n.ratings_count),o=fe(n.status);let r="";const s=n.accepted_at?`<span class="participant-accepted-at">Solicitó: ${Tt(n.accepted_at)}</span>`:"";n.status==="pending_approval"?r=`
                <button class="action-button-admin approve" data-pub-id="${l(e)}" data-action="approve" data-user="${l(n.acceptor_username)}">Aprobar</button>
                <button class="action-button-admin reject" data-pub-id="${l(e)}" data-action="discard" data-user="${l(n.acceptor_username)}">Rechazar</button>
            `:n.status==="completed"&&(r=`
                <button class="action-button-admin confirm" data-pub-id="${l(e)}" data-action="confirm-payment" data-user="${l(n.acceptor_username)}">Confirmar Pago</button>
                <button class="action-button-admin reject" data-pub-id="${l(e)}" data-action="discard" data-user="${l(n.acceptor_username)}">Rechazar</button>
            `);let i="";n.form_responses&&Object.keys(n.form_responses).length>0&&(i=`
                <div class="participant-form-responses-admin">
                    <div class="form-responses-content-admin">
                        ${Object.entries(n.form_responses).flatMap(([,p])=>Object.entries(p)).map(([p,v])=>`
                    <div class="form-response-field-admin">
                        <span class="form-response-label-admin">${l(p)}:</span>
                        <span class="form-response-value-admin">${l(v)}</span>
                    </div>
                `).join("")}
                    </div>
                </div>
            `);let d="";return n.evidence_urls&&n.evidence_urls.length>0&&(d=`
                <div class="participant-evidence-admin" style="margin-top: 8px; padding: 0.5rem; background: rgba(255, 255, 255, 0.03); border-radius: 6px; display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.8rem; color: var(--admin-text-secondary); font-weight: 500;">Evidencias:</span>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                        ${n.evidence_urls.map(p=>`
                <a href="${l(p)}" target="_blank" class="admin-evidence-link" style="display: inline-block; margin-right: 5px;">
                    <img src="${l(p)}" class="admin-evidence-thumbnail" alt="Evidencia" style="width: 45px; height: 45px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; transition: transform 0.15s ease;">
                </a>
            `).join("")}
                    </div>
                </div>
            `),`
            <li class="participant-item-admin ${n.form_responses?"has-responses":""}">
                <div class="participant-row-admin">
                    <div class="participant-info-admin">
                        <strong><a href="profile.html?user=${l(n.acceptor_username)}" target="_blank">${l(n.acceptor_username)}</a></strong>
                        <span class="rating-display">${a}</span>
                        ${s}
                    </div>
                    <div class="participant-status-admin">
                        <span class="status-badge ${l(n.status)}">${l(o)}</span>
                        ${r}
                    </div>
                </div>
                ${i}
                ${d}
            </li>
        `}function Tt(e){const n=new Date(e),a={day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"};return n.toLocaleDateString("es-ES",a)}function wt(e){if(!t.usersTableContainer)return;if(e.length===0){t.usersTableContainer.innerHTML='<p class="empty-message">No se encontraron usuarios.</p>';return}const n=`
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
                    ${e.map(a=>Lt(a)).join("")}
                </tbody>
            </table>
        `;t.usersTableContainer.innerHTML=n,t.usersTableContainer.querySelectorAll(".copy-wallet-btn-admin").forEach(a=>{a.addEventListener("click",function(){const o=this.dataset.address;copyTextToClipboard(o).then(()=>{const r=this.innerHTML;this.innerHTML='<span style="font-size:10px; font-weight:bold; color:#059669;">✓</span>',setTimeout(()=>{this.innerHTML=r},2e3)}).catch(r=>{console.error("Error al copiar: ",r)})})})}function Lt(e){const n=new Date(e.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"}),a=ye(e.average_rating,e.ratings_count);let o='<span style="color: #888;">Sin billetera</span>';if(e.web3_wallet_address){const r=e.web3_wallet_address;o=`
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
            <tr data-user-id="${l(e.id)}" data-username="${l(e.username)}" data-status="${l(e.status)}" data-referral-code="${l(e.referral_code||"")}">
                <td class="username-cell">
                    <a href="profile.html?user=${l(e.username)}" target="_blank">${l(e.username)}</a>
                </td>
                <td>${o}</td>
                <td class="saldo-blue-text">${$(e.liquid_blue_balance)}</td>
                <td class="saldo-escrow-text">${$(e.escrow_blue_balance)}</td>
                <td class="saldo-booster-text">${$(e.booster_blue_balance)}</td>
                <td class="saldo-red-text">${$(e.red_balance)}</td>
                <td>${a}</td>
                <td><span class="status-badge ${l(e.status)}">${l(e.status)}</span></td>
                <td>${n}</td>
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
        `}async function It(){try{const e=await f("/api/admin/settings");["max_images_request","max_images_sell","max_images_donation","max_images_platform","max_images_evidence"].forEach(a=>{const o=e.find(s=>s.setting_key===a),r=document.getElementById(a.replace(/_([a-z])/g,s=>s[1].toUpperCase()));r&&o&&(r.value=o.setting_value)})}catch(e){console.error("Error al cargar configuración de límites de imágenes:",e)}}const _e=document.getElementById("imageLimitsForm");_e&&_e.addEventListener("submit",async e=>{e.preventDefault();const n=e.target.querySelector('button[type="submit"]'),a=n.textContent;n.textContent="Guardando...",n.disabled=!0;const o=[{key:"max_images_request",value:document.getElementById("maxImagesRequest").value},{key:"max_images_sell",value:document.getElementById("maxImagesSell").value},{key:"max_images_donation",value:document.getElementById("maxImagesDonation").value},{key:"max_images_platform",value:document.getElementById("maxImagesPlatform").value},{key:"max_images_evidence",value:document.getElementById("maxImagesEvidence").value}];try{for(const r of o)await f("/api/admin/settings",{method:"POST",body:JSON.stringify({key:r.key,value:r.value.toString()})});u("Límites de imágenes guardados correctamente.")}catch(r){console.error(r),u("Error al guardar los límites de imágenes.")}finally{n.textContent=a,n.disabled=!1}});function kt(e){const n=document.getElementById("registrationCountryRestrictionToggle"),a=document.getElementById("registrationAllowedPrefixesInput"),o=document.getElementById("registrationNoticeTextInput");if(!(!e||!Array.isArray(e))){if(n){const r=e.find(s=>s.setting_key==="registration_country_restriction_enabled");n.checked=r?r.setting_value!=="false":!0}if(a){const r=e.find(s=>s.setting_key==="registration_allowed_country_prefixes");a.value=r?r.setting_value:"+58"}if(o){const r=e.find(s=>s.setting_key==="registration_country_restriction_notice_text");o.value=r?r.setting_value:"Por el momento solo se aceptan registros de personas residentes en Venezuela (+58)."}}}function Pt(){const e=document.getElementById("registrationCountryRestrictionToggle"),n=document.getElementById("registrationAllowedPrefixesInput"),a=document.getElementById("registrationNoticeTextInput"),o=document.getElementById("registration-country-admin-feedback");if(!e&&!n&&!a||e&&e.dataset.listenerAttached)return;e&&(e.dataset.listenerAttached="true");const r=i=>{o&&(o.textContent=i,o.style.display="block",setTimeout(()=>{o.style.display="none"},3e3))},s=async(i,d)=>{try{await f("/api/admin/settings",{method:"POST",body:JSON.stringify({key:i,value:String(d)})}),r("✓ Configuración guardada automáticamente")}catch(c){console.error("Error al guardar ajuste:",c),u("Error al guardar la configuración de restricción por país: "+c.message)}};e&&e.addEventListener("change",()=>{s("registration_country_restriction_enabled",e.checked?"true":"false")}),n&&n.addEventListener("blur",()=>{s("registration_allowed_country_prefixes",n.value.trim()||"+58")}),a&&a.addEventListener("blur",()=>{s("registration_country_restriction_notice_text",a.value.trim())})}function Mt(e){if(!t.publicationsTableContainer)return;if(e.length===0){t.publicationsTableContainer.innerHTML='<p class="empty-message">No se encontraron publicaciones con ese criterio.</p>';return}const n=`
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
                    ${e.map(a=>At(a)).join("")}
                </tbody>
            </table>
        `;t.publicationsTableContainer.innerHTML=n}function At(e){const n=new Date(e.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),a=e.is_sell_post?'<span class="status-badge sell">Venta</span>':'<span class="status-badge request">Solicitud</span>',o=$(e.blue_cost),r=(Number(e.available_slots)||0)+(Number(e.participants_count)||0),s=`${e.participants_count} / ${r}`,i=Se(e),d=Be(e),c=e.is_deleted?`<button class="action-button-admin restore" data-pub-id="${l(e.id)}" title="Restaurar publicación">Restaurar</button>`:`<button class="action-button-admin delete" data-pub-id="${l(e.id)}" title="Eliminar publicación">Eliminar</button>`;return`
            <tr>
                <td class="publication-title-cell" title="${l(e.title)}">${l(e.title)}</td>
                <td class="username-cell">
                    <a href="profile.html?user=${l(e.author_username)}" target="_blank">${l(e.author_username)}</a>
                </td>
                <td>${a}</td>
                <td class="saldo-blue-text">${o}</td>
                <td align="center">${s}</td>
                <td><span class="status-badge ${l(d)}">${l(i)}</span></td>
                <td>${n}</td>
                <td>${c}</td>
            </tr>
        `}function Se(e){return e.is_deleted?"Eliminada":e.is_expired?"Expirada":e.is_completed_publication?"Completada":e.is_paused?"Pausada":fe(e.status||"open")}function Be(e){return e.is_deleted?"deleted":e.is_expired?"expired":e.is_completed_publication?"completed":e.is_paused?"pausada":String(e.status||"open").toLowerCase()}function Rt(e){t.platformWalletStatsContainer&&(t.platformWalletStatsContainer.innerHTML=`
            <div class="stat-card">
                <h4>Comisiones (Ganancias Netas)</h4>
                <p class="stat-value saldo-blue-text">${$(e.commissionBalance)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo RED de la Plataforma</h4>
                <p class="stat-value saldo-red-text">${$(e.redBalance)} RED</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Disponible)</h4>
                <p class="stat-value saldo-blue-text">${$(e.liquidBlue)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Saldo BLUE de la Plataforma (Pendiente)</h4>
                <p class="stat-value saldo-escrow-text">${$(e.escrowBlue)} BLUE</p>
            </div>
        `)}function Dt(e){if(!t.platformCommissionLogContainer)return;if(e.length===0){t.platformCommissionLogContainer.innerHTML='<p class="empty-message">Aún no se ha registrado ninguna comisión.</p>';return}const n=`
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
                    ${e.map(a=>Ft(a)).join("")}
                </tbody>
            </table>
        `;t.platformCommissionLogContainer.innerHTML=n}function Ft(e){const n=new Date(e.created_at).toLocaleString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}),a=e.publication_id?`<span title="ID de Publicación: ${l(e.publication_id)}" style="cursor: help;">${l(e.publication_title)}</span>`:l(e.publication_title),o=e.user_who_paid!=="(Usuario desconocido)"?`<a href="profile.html?user=${l(e.user_who_paid)}" target="_blank">${l(e.user_who_paid)}</a>`:l(e.user_who_paid);return`
            <tr>
                <td class="saldo-blue-text">${$(e.commission_amount_blue)} BLUE</td>
                <td>${a}</td>
                <td class="username-cell">${o}</td>
                <td>${n}</td>
            </tr>
        `}function Nt(e){if(!t.referralsLogContainer)return;if(!e||e.length===0){t.referralsLogContainer.innerHTML='<p class="empty-message">Todavía no se ha registrado ningún referido.</p>';return}const n=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Referido (Nuevo Usuario)</th>
                        <th>Referente (Usuario Antiguo)</th>
                        <th>Fecha de Registro</th>
                    </tr>
                </thead>
                <tbody>
                    ${e.map(a=>Ht(a)).join("")}
                </tbody>
            </table>
        `;t.referralsLogContainer.innerHTML=n}function Ht(e){const n=new Date(e.created_at).toLocaleString("es-ES",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"});return`
            <tr>
                <td class="username-cell">
                    <a href="profile.html?user=${l(e.referred_username)}" target="_blank">${l(e.referred_username)}</a>
                </td>
                <td class="username-cell">
                    <a href="profile.html?user=${l(e.referrer_username)}" target="_blank">${l(e.referrer_username)}</a>
                </td>
                <td>${n}</td>
            </tr>
        `}const z=document.getElementById("pushSendToAll");z&&z.addEventListener("change",e=>{const n=document.getElementById("pushTargetUsername");e.target.checked?(n.disabled=!0,n.value="",n.placeholder="ENVIANDO A TODOS LOS USUARIOS",n.classList.add("input-disabled-broadcast")):(n.disabled=!1,n.placeholder="Ej: miiigue",n.classList.remove("input-disabled-broadcast"))});async function Ut(e){e.preventDefault();const n=document.getElementById("pushSendToAll").checked,a=document.getElementById("pushTargetUsername").value,o=document.getElementById("pushTitle").value,r=document.getElementById("pushMessage").value,s=document.getElementById("pushUrl").value;if(!o||!r){u("Por favor completa el título y el mensaje.");return}if(!n&&!a){u('Debes especificar un usuario destino o seleccionar "Enviar a Todos".');return}if(n&&!await new Promise(p=>{L(`⚠️ ¡ATENCIÓN! Estás a punto de enviar esta notificación a TODOS los usuarios registrados.

Titulo: ${o}

¿Estás seguro de proceder?`,()=>p(!0))}))return;const i=document.getElementById("sendPushBtn"),d=i?i.textContent:"Enviar";i&&(i.textContent=n?"Enviando Masivo...":"Enviando...",i.disabled=!0);try{const c=await f("/api/notifications/send",{method:"POST",body:JSON.stringify({username:n?null:a,title:o,message:r,url:s,sendToAll:n})});if(c.success){let p="✅ Notificación enviada.";c.total_active?p+=`
Difusión completada: ${c.sent} enviados, ${c.failed} fallidos/limpiados.`:c.sent>0?p+=`
${c.sent} dispositivo(s) notificados.`:p+=`
Sin embargo, no se encontraron dispositivos activos para el destinatario.`,u(p),e.target.reset(),z&&(z.checked=!1,z.dispatchEvent(new Event("change")))}else u(`⚠️ ${c.error||"Error desconocido al enviar."}`)}catch(c){console.error("Error enviando push:",c),u(`❌ Error al enviar notificación: ${c.message}`)}finally{i&&(i.textContent=d,i.disabled=!1)}}async function qt(){if(document.getElementById("notifications-section"))try{const n=await f("/api/admin/settings");n.filter(s=>s.setting_key.startsWith("daily_modal_")).forEach(s=>{const i=document.querySelector(`[data-setting-key="${s.setting_key}"]`);i&&(i.value=s.setting_value)});const o=n.find(s=>s.setting_key==="global_app_interstitial_enabled"),r=document.getElementById("setting_global_app_interstitial_enabled");o&&r&&(r.checked=o.setting_value==="true")}catch(n){console.error("Error al cargar configuración de modal diario:",n)}}async function Ot(){const n=document.getElementById("notifications-section").querySelectorAll('[data-setting-key^="daily_modal_"]'),a=document.getElementById("saveDailyMessagesBtn"),o=a.textContent;a.disabled=!0,a.textContent="Guardando...";try{for(const s of n){const i=s.dataset.settingKey,d=s.value;await f("/api/admin/settings",{method:"POST",body:JSON.stringify({key:i,value:d})})}const r=document.getElementById("setting_global_app_interstitial_enabled");r&&await f("/api/admin/settings",{method:"POST",body:JSON.stringify({key:"global_app_interstitial_enabled",value:r.checked.toString()})}),u("Mensajes diarios guardados correctamente.")}catch(r){u(`Error al guardar: ${r.message}`)}finally{a.disabled=!1,a.textContent=o}}function $e(e){if(!t.notificationsSection)return;t.notificationsSection.querySelectorAll(".tab-content").forEach(o=>o.classList.remove("active")),t.notificationsSection.querySelectorAll(".tab-link").forEach(o=>o.classList.remove("active"));const n=document.getElementById(`${e}-tab`),a=document.querySelector(`.tab-link[data-tab="${e}"]`);switch(n&&n.classList.add("active"),a&&a.classList.add("active"),e){case"notifications-push":break;case"notifications-email":Ce();break;case"notifications-daily":qt();break}}async function zt(e){e.preventDefault();const n=document.getElementById("broadcastTargetGroup").value,a=document.getElementById("broadcastTargetUsername").value,o=document.getElementById("broadcastSubject").value,r=document.getElementById("broadcastTitle").value,s=document.getElementById("broadcastBody").value,i=document.getElementById("broadcastButtonText").value,d=document.getElementById("broadcastButtonUrl").value;if(!o||!r||!s){u("Por favor completa todos los campos del correo.");return}if(!await new Promise(y=>{L(`Estás por programar una difusión masiva de correo.
Canal: ${n}
Asunto: ${o}

¿Confirmas el envío?`,()=>y(!0))}))return;const p=document.getElementById("sendBroadcastBtn"),v=p.textContent;p.disabled=!0,p.textContent="Programando...";try{const y=await f("/api/admin/broadcast-email",{method:"POST",body:JSON.stringify({targetGroup:n,targetUsername:n==="specific"?a:null,subject:o,title:r,bodyHtml:s,buttonText:i,buttonUrl:d})});y.success&&(u(`✅ Difusión programada exitosamente (#${y.broadcast_id}).
${y.message}`),e.target.reset(),t.broadcastSpecificUserGroup&&(t.broadcastSpecificUserGroup.style.display="none"),Ce())}catch(y){u(`❌ Error al programar difusión: ${y.message}`)}finally{p.disabled=!1,p.textContent=v}}async function Ce(){if(t.broadcastHistoryContainer){t.broadcastHistoryContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/admin/broadcast-email");Vt(e)}catch(e){t.broadcastHistoryContainer.innerHTML=`<p class="error-message">Error al cargar historial: ${e.message}</p>`}}}function Vt(e){if(!t.broadcastHistoryContainer)return;if(!e||e.length===0){t.broadcastHistoryContainer.innerHTML='<p class="empty-message">No hay difusiones previas registradas.</p>';return}const n=`
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
                    ${e.map(a=>{const o=new Date(a.created_at).toLocaleString(),r=a.status==="completed"?"active":a.status==="failed"?"suspended":"pending";return`
                        <tr>
                            <td>#${a.id}</td>
                            <td>${o}</td>
                            <td title="${l(a.subject)}">${l(a.subject.substring(0,30))}${a.subject.length>30?"...":""}</td>
                            <td><span class="status-badge">${a.target_group}</span></td>
                            <td><span class="status-badge ${r}">${a.status}</span></td>
                            <td align="center"><strong>${a.sent_count}</strong></td>
                            <td align="center"><span class="saldo-red-text">${a.failed_count}</span></td>
                            <td align="center">${a.total_recipients}</td>
                        </tr>
                        `}).join("")}
                </tbody>
            </table>
        `;t.broadcastHistoryContainer.innerHTML=n}async function Y(){if(t.academyTableContainer){t.academyTableContainer.innerHTML='<div class="loading-spinner"></div>';try{const e=await f("/api/academy/all");jt(e)}catch(e){t.academyTableContainer.innerHTML=`<p class="error-message">Error al cargar videos: ${e.message}</p>`}}}function jt(e){if(!t.academyTableContainer)return;if(!e||e.length===0){t.academyTableContainer.innerHTML='<p class="empty-message">No hay videos interactivos registrados actualmente.</p>';return}const n=`
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
                    ${e.map(a=>Wt(a)).join("")}
                </tbody>
            </table>
        `;t.academyTableContainer.innerHTML=n,t.academyTableContainer.querySelectorAll(".action-button-admin").forEach(a=>{a.addEventListener("click",Gt)})}function Wt(e){const n=e.is_active,a=n?"active":"suspended",o=n?"✅ Público":"❌ Oculto",r=`https://img.youtube.com/vi/${l(e.youtube_id)}/hqdefault.jpg`;return`
            <tr>
                <td align="center"><strong>${l(e.order_num)}</strong></td>
                <td>
                    <div style="width: 120px; height: 68px; border-radius: 4px; overflow: hidden; background: #000;">
                        <img src="${r}" alt="Thumbnail" style="width: 100%; height: 100%; object-fit: cover;">
                    </div>
                </td>
                <td style="font-weight: bold;">${l(e.title)}</td>
                <td><code>${l(e.youtube_id)}</code></td>
                <td><span class="status-badge ${a}">${o}</span></td>
                <td>
                    <button class="action-button-admin ${n?"danger":"approve"}" 
                            data-action="toggle-video-status" 
                            data-video-id="${l(e.id)}"
                            data-current-status="${n}">
                        ${n?"Ocultar":"Publicar"}
                    </button>
                    <button class="action-button-admin delete" 
                            data-action="delete-video" 
                            data-video-id="${l(e.id)}">
                        🗑️
                    </button>
                </td>
            </tr>
        `}t.academyVideoForm&&t.academyVideoForm.addEventListener("submit",async e=>{e.preventDefault();const n=t.academyVideoForm.querySelector('button[type="submit"]'),a=n.textContent,o=t.academyVideoUrl.value.trim(),r=t.academyVideoTitle.value.trim(),s=parseInt(t.academyVideoOrder.value,10)||0;if(!o||!r){u("Por favor, ingresa el enlace y el título del video.");return}n.textContent="Guardando...",n.disabled=!0;try{const i=await f("/api/academy/add",{method:"POST",body:JSON.stringify({youtube_url:o,title:r,order_num:s})});i.success&&(u(`✅ Tutorial agregado exitosamente: ${i.video.title}`),t.academyVideoForm.reset(),Y())}catch(i){u(`❌ Error al agregar video: ${i.message}`)}finally{n.textContent=a,n.disabled=!1}});async function Gt(e){const n=e.target.closest("button");if(!n)return;const a=n.dataset.action,o=n.dataset.videoId;if(a==="toggle-video-status"){const s=!(n.dataset.currentStatus==="true");n.disabled=!0;try{(await f(`/api/academy/${o}/status`,{method:"PUT",body:JSON.stringify({is_active:s})})).success&&Y()}catch(i){u(`Error al actualizar estado: ${i.message}`),n.disabled=!1}}else if(a==="delete-video"){if(!await new Promise(s=>{L(`🗑️ ¿Estás completamente seguro de ELIMINAR este tutorial interactivo?

Esta acción no se puede deshacer y desaparecerá de la página 'Cómo Funciona'.`,()=>s(!0))}))return;n.disabled=!0;try{(await f(`/api/academy/${o}`,{method:"DELETE"})).success&&(u("✅ Video eliminado permanentemente."),Y())}catch(s){u(`Error al eliminar: ${s.message}`),n.disabled=!1}}}t.pushNotificationForm&&t.pushNotificationForm.addEventListener("submit",Ut);async function Z(){if(t.humanitarianTableContainer){t.humanitarianTableContainer.innerHTML='<div class="loading-spinner"></div>',t.humanitarianStatsContainer&&(t.humanitarianStatsContainer.innerHTML='<div class="loading-spinner"></div>');try{const e=t.humanitarianStatusFilter?.value||"pending",n=t.humanitarianSearchInput?.value||"",a=await f(`/api/admin/humanitarian/causes?status=${encodeURIComponent(e)}&search=${encodeURIComponent(n)}`);Jt(a),Kt(a.causes||[])}catch(e){t.humanitarianTableContainer.innerHTML=`<p class="error-message">Error al cargar causas: ${l(e.message)}</p>`,t.humanitarianStatsContainer&&(t.humanitarianStatsContainer.innerHTML="")}}}function Jt(e){t.humanitarianStatsContainer&&(t.humanitarianStatsContainer.innerHTML=`
            <div class="stat-card">
                <div class="stat-value">${e.pending_count||0}</div>
                <div class="stat-label">Pendientes</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${e.total||0}</div>
                <div class="stat-label">Total (filtro actual)</div>
            </div>
        `)}function Kt(e){if(!t.humanitarianTableContainer)return;if(!e||e.length===0){t.humanitarianTableContainer.innerHTML='<p class="no-data-message">No se encontraron causas con los filtros seleccionados.</p>';return}const n=o=>{const s={pending:{label:"⏳ Pendiente",color:"#F59E0B",bg:"rgba(245,158,11,0.15)"},approved:{label:"✅ Aprobada",color:"#10B981",bg:"rgba(16,185,129,0.15)"},rejected:{label:"❌ Rechazada",color:"#EF4444",bg:"rgba(239,68,68,0.15)"},completed:{label:"🏆 Completada",color:"#6366F1",bg:"rgba(99,102,241,0.15)"}}[o]||{label:o,color:"#888",bg:"rgba(136,136,136,0.15)"};return`<span style="padding: 4px 10px; border-radius: 6px; font-size: 0.8rem; font-weight: 600; color: ${s.color}; background: ${s.bg};">${s.label}</span>`};let a=`
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
        `;e.forEach(o=>{const r=new Date(o.created_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric"}),s=Number(o.goal_amount).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2}),i=Number(o.current_amount).toLocaleString("es-ES",{minimumFractionDigits:2,maximumFractionDigits:2});a+=`
                <tr>
                    <td>#${o.id}</td>
                    <td><strong>${l(o.username)}</strong></td>
                    <td>${l(o.title)}</td>
                    <td>${s}</td>
                    <td>${i}</td>
                    <td>${n(o.status)}</td>
                    <td>${r}</td>
                    <td>
                        <button class="action-button" onclick="window._viewHumanitarianCause(${o.id})" style="font-size: 0.8rem; padding: 6px 12px;">
                            👁️ Ver
                        </button>
                    </td>
                </tr>
            `}),a+="</tbody></table>",t.humanitarianTableContainer.innerHTML=a}window._viewHumanitarianCause=async function(e){if(t.humanitarianDetailModal){t.humanitarianModalTitle.textContent="Cargando...",t.humanitarianModalBody.innerHTML='<div class="loading-spinner"></div>',t.humanitarianModalActions.innerHTML="",t.humanitarianDetailModal.style.display="flex";try{const a=(await f(`/api/admin/humanitarian/causes/${e}`)).cause,o=new Date(a.created_at).toLocaleString("es-ES");let r="<em>Sin evidencia</em>";if(a.evidence_urls&&Array.isArray(a.evidence_urls)&&a.evidence_urls.length>0){const s=[],i=[];a.evidence_urls.forEach(c=>{if(!c||typeof c!="string")return;const p=c.toLowerCase();p.includes("/uploads/")||/\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(p)?s.push(c):i.push(c)});let d=[];s.length>0&&d.push(`
                        <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 8px;">
                            ${s.map((c,p)=>`
                                <a href="${l(c)}" target="_blank" rel="noopener noreferrer" title="Ver imagen ${p+1} en tamaño completo">
                                    <img src="${l(c)}" alt="Evidencia ${p+1}" style="width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.3);" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                </a>
                            `).join("")}
                        </div>
                    `),i.length>0&&d.push(i.map((c,p)=>`<a href="${l(c)}" target="_blank" rel="noopener noreferrer" style="color: #3B82F6; text-decoration: underline; display: block; margin-bottom: 4px; word-break: break-all;">📎 Evidencia ${p+1}</a>`).join("")),r=d.join("")||"<em>Sin evidencia</em>"}t.humanitarianModalTitle.textContent=`Causa #${a.id}: ${a.title}`,t.humanitarianModalBody.innerHTML=`
                <div style="display: grid; gap: 12px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <strong style="color: #94A3B8;">Usuario:</strong>
                            <p style="margin: 4px 0;">${l(a.username)}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Email:</strong>
                            <p style="margin: 4px 0;">${l(a.email||"N/A")}</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Meta BLUE IOU:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #3B82F6;">${Number(a.goal_amount).toLocaleString("es-ES")} BLUE</p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Recaudado:</strong>
                            <p style="margin: 4px 0; font-weight: 700; color: #10B981;">${Number(a.current_amount).toLocaleString("es-ES")} BLUE</p>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); padding: 10px 0;">
                        <div>
                            <strong style="color: #94A3B8;">Registro (Sponsor):</strong>
                            <p style="margin: 4px 0;">
                                ${a.referrer_referral_code?`<span style="color: #10B981; font-weight: bold;">${l(a.referrer_referral_code)}</span> (de @${l(a.referrer_username)})`:'<span style="color: #64748B; font-style: italic;">Registro Directo (Sin Referido)</span>'}
                            </p>
                        </div>
                        <div>
                            <strong style="color: #94A3B8;">Destinatario de Fondos:</strong>
                            <p style="margin: 4px 0;">
                                <strong style="color: #F472B6;">${l(a.foundation_name)}</strong> 
                                (Código: <span style="color: #3B82F6; font-weight: bold;">${l(a.beneficiary_referral_code)}</span>)
                            </p>
                        </div>
                    </div>

                    ${a.beneficiary_socials?`
                        <div>
                            <strong style="color: #94A3B8;">Redes del Beneficiario:</strong>
                            <div style="margin-top: 4px;">
                                ${a.beneficiary_socials.trim().split(/\s+/).map(s=>`
                                    <a href="${l(s)}" target="_blank" rel="noopener noreferrer" style="color: #F472B6; text-decoration: underline; margin-right: 15px; font-size: 0.85rem;">🔗 ${l(s)}</a>
                                `).join("")}
                            </div>
                        </div>
                    `:""}

                    <div>
                        <strong style="color: #94A3B8;">Historia:</strong>
                        <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 8px; margin-top: 6px; max-height: 200px; overflow-y: auto; line-height: 1.6;">
                            ${l(a.story)}
                        </div>
                    </div>

                    <div>
                        <strong style="color: #94A3B8;">Evidencia:</strong>
                        <div style="margin-top: 6px;">${r}</div>
                    </div>

                    <div style="display: flex; gap: 20px; font-size: 0.85rem; color: #64748B;">
                        <span>📅 Registrada: ${o}</span>
                        <span>🔖 Estado: <strong>${a.status}</strong></span>
                    </div>

                    ${a.admin_notes?`
                        <div style="background: rgba(239,68,68,0.1); padding: 12px; border-radius: 8px; border-left: 3px solid #EF4444;">
                            <strong style="color: #EF4444;">Notas del Admin:</strong>
                            <p style="margin: 4px 0;">${l(a.admin_notes)}</p>
                        </div>
                    `:""}
                </div>
            `,a.status==="pending"?(t.humanitarianModalActions.innerHTML=`
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
                `,document.getElementById("btnApproveCause").addEventListener("click",()=>{const s=document.getElementById("humanitarianAdminNotes")?.value||"";Te(e,"approve",s)}),document.getElementById("btnRejectCause").addEventListener("click",()=>{const s=document.getElementById("humanitarianAdminNotes")?.value||"";Te(e,"reject",s)})):t.humanitarianModalActions.innerHTML=`
                    <p style="text-align: center; color: #64748B; font-style: italic;">Esta causa ya fue procesada (${a.status}).</p>
                `}catch(n){t.humanitarianModalBody.innerHTML=`<p class="error-message">Error al cargar detalle: ${l(n.message)}</p>`}}};async function Te(e,n,a){const o=n==="approve"?"APROBAR":"RECHAZAR",r=n==="approve"?`¿Estás seguro de APROBAR esta causa #${e}? El usuario será notificado y sus referidos podrán donarle.`:`¿Estás seguro de RECHAZAR esta causa #${e}? Se requiere una razón detallada.`;L(r,async()=>{try{const s=await f(`/api/admin/humanitarian/causes/${e}/${n}`,{method:"PATCH",body:JSON.stringify({admin_notes:a})});u(`✅ ${s.message}`),t.humanitarianDetailModal.style.display="none",Z(),we()}catch(s){u(`❌ Error al ${o.toLowerCase()}: ${s.message}`)}})}async function we(){try{const e=await f("/api/admin/humanitarian/pending-count");t.humanitarianBadge&&(t.humanitarianBadge.textContent=e.count>0?e.count:"",t.humanitarianBadge.style.display=e.count>0?"inline-flex":"none")}catch(e){console.warn("[SOLIDARIO] No se pudo actualizar badge de pendientes:",e.message)}}async function ne(){if(t.govRewardsStats){t.govRewardsStats.innerHTML='<div class="loading-spinner"></div>',t.govRewardsAction&&(t.govRewardsAction.style.display="none"),t.govRewardsResult&&(t.govRewardsResult.style.display="none");try{const e=await f("/api/admin/governance/reward-stats");Yt(e)}catch(e){t.govRewardsStats.innerHTML=`<p class="error-message">Error al cargar estadísticas: ${l(e.message)}</p>`}Le()}}function Yt(e){t.govRewardsStats&&(t.govRewardsStats.innerHTML=`
            <div class="stat-card">
                <h4>Votos sin Recompensar</h4>
                <p class="stat-value">${Number(e.pendingCount)}</p>
            </div>
            <div class="stat-card">
                <h4>Guardianes Afectados</h4>
                <p class="stat-value">${Number(e.guardiansAffected)}</p>
            </div>
            <div class="stat-card">
                <h4>Tasa Actual</h4>
                <p class="stat-value">${Number(e.currentRate).toFixed(2)} BLUE</p>
            </div>
            <div class="stat-card">
                <h4>Total Estimado</h4>
                <p class="stat-value">${Number(e.estimatedTotal).toFixed(2)} BLUE</p>
            </div>
        `,e.pendingCount>0&&e.currentRate>0?(t.govRewardsSummary.textContent=`${e.pendingCount} voto(s) pendientes — ${e.guardiansAffected} guardián(es)`,t.govRewardsDescription.textContent=`Se acreditarán ${Number(e.estimatedTotal).toFixed(2)} BLUE IOU en total (${Number(e.currentRate).toFixed(2)} por voto).`,t.govRewardsAction.style.display="block",t.govRewardsProcessBtn.disabled=!1,t.govRewardsProcessBtn.textContent="Procesar Pagos Pendientes",t.govRewardsProcessBtn.style.background="#059669",t.govRewardsProcessBtn.style.cursor="pointer"):e.pendingCount>0&&e.currentRate===0?(t.govRewardsSummary.textContent=`${e.pendingCount} voto(s) pendientes — Tasa en 0 (desactivada)`,t.govRewardsDescription.textContent='Configure "Gobernanza — Recompensa por Voto (BLUE IOU)" en Configuración antes de procesar.',t.govRewardsAction.style.display="block",t.govRewardsProcessBtn.disabled=!0,t.govRewardsProcessBtn.textContent="Tasa en 0 — Configure primero",t.govRewardsProcessBtn.style.background="#9CA3AF",t.govRewardsProcessBtn.style.cursor="not-allowed"):t.govRewardsAction.style.display="none")}t.govRewardsProcessBtn&&t.govRewardsProcessBtn.addEventListener("click",()=>{t.govRewardsProcessBtn.disabled||L(`¿Estás seguro de procesar los pagos pendientes?

Esta acción acreditará BLUE IOU a cada guardián según la tasa configurada. Se enviará un correo consolidado a cada guardián afectado.`,async()=>{t.govRewardsProcessBtn.disabled=!0,t.govRewardsProcessBtn.textContent="Procesando...",t.govRewardsResult.style.display="none";try{const e=await f("/api/admin/governance/process-rewards",{method:"POST"});t.govRewardsResult.style.display="block",t.govRewardsResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                                <h4 style="color: #059669; margin: 0 0 0.5rem;">Procesamiento completado</h4>
                                <p><strong>Votos procesados:</strong> ${Number(e.totalProcessed)}</p>
                                <p><strong>Omitidos:</strong> ${Number(e.totalSkipped)}</p>
                                <p><strong>Tasa aplicada:</strong> ${Number(e.rateUsed).toFixed(2)} BLUE IOU</p>
                                <p><strong>Guardianes notificados:</strong> ${Number(e.guardiansAffected)}</p>
                            </div>
                        `,ne()}catch(e){t.govRewardsResult.style.display="block",t.govRewardsResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                                <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en el procesamiento</h4>
                                <p>${l(e.message)}</p>
                            </div>
                        `,t.govRewardsProcessBtn.disabled=!1,t.govRewardsProcessBtn.textContent="Procesar Pagos Pendientes"}})});let V=null,Q=null;async function Le(){if(t.govExportStats){try{const e=await f("/api/admin/governance/demo-export-stats");e.unexportedVotes>0?(t.govExportStats.innerHTML=`<p><strong>${Number(e.unexportedVotes)}</strong> voto(s) de <strong>${Number(e.guardiansCount)}</strong> guardián(es) sin exportar.</p>`,t.govExportBtn&&(t.govExportBtn.disabled=!1)):(t.govExportStats.innerHTML='<p style="color: #059669;">Todos los votos han sido exportados.</p>',t.govExportBtn&&(t.govExportBtn.disabled=!0,t.govExportBtn.textContent="Sin votos pendientes",t.govExportBtn.style.background="#9CA3AF",t.govExportBtn.style.cursor="not-allowed"))}catch(e){t.govExportStats.innerHTML=`<p style="color: #DC2626;">${l(e.message)}</p>`}Ie()}}async function Ie(){if(t.govExportHistory)try{const e=await f("/api/admin/governance/demo-export-history");if(!Array.isArray(e)||e.length===0){t.govExportHistory.innerHTML='<p style="color: #9CA3AF; font-size: 0.875rem;">No hay exportaciones registradas.</p>';return}let n="";for(const a of e){const o=new Date(a.exported_at).toLocaleDateString("es-ES",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});n+=`
                    <tr>
                        <td style="padding: 8px;">${Number(a.id)}</td>
                        <td style="padding: 8px;">${l(o)}</td>
                        <td style="padding: 8px;">${Number(a.total_guardians)}</td>
                        <td style="padding: 8px;">${Number(a.total_votes)}</td>
                        <td style="padding: 8px;">${Number(a.downloaded_count)}</td>
                        <td style="padding: 8px;">
                            <button class="gov-export-download-btn" data-export-id="${Number(a.id)}"
                                style="background: #6B7280; color: #fff; border: none; padding: 4px 12px;
                                       border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 500;">
                                Re-descargar
                            </button>
                        </td>
                    </tr>`}t.govExportHistory.innerHTML=`
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
                        <tbody>${n}</tbody>
                    </table>
                </div>`,t.govExportHistory.querySelectorAll(".gov-export-download-btn").forEach(a=>{a.addEventListener("click",async()=>{const o=a.dataset.exportId;a.disabled=!0,a.textContent="Descargando...";try{const r=await f(`/api/admin/governance/demo-export/${o}/download`),s=new Blob([JSON.stringify(r.export_data,null,2)],{type:"application/json"}),i=URL.createObjectURL(s),d=document.createElement("a"),c=new Date(r.exported_at).toISOString().split("T")[0];d.href=i,d.download=`gov-rewards-export-${c}-redownload.json`,document.body.appendChild(d),d.click(),document.body.removeChild(d),URL.revokeObjectURL(i),Ie()}catch(r){u("Error al descargar: "+r.message)}finally{a.disabled=!1,a.textContent="Re-descargar"}})})}catch(e){t.govExportHistory.innerHTML=`<p style="color: #DC2626; font-size: 0.875rem;">${l(e.message)}</p>`}}t.govExportBtn&&t.govExportBtn.addEventListener("click",()=>{t.govExportBtn.disabled||L(`¿Exportar los votos de gobernanza no exportados?

Se generará un archivo JSON firmado y los votos se marcarán como exportados.`,async()=>{t.govExportBtn.disabled=!0,t.govExportBtn.textContent="Exportando...",t.govExportResult&&(t.govExportResult.style.display="none");try{const e=await f("/api/admin/governance/demo-export",{method:"POST"});if(!e.data){t.govExportResult.style.display="block",t.govExportResult.innerHTML='<p style="color: #667085;">No hay votos pendientes de exportar.</p>';return}const n=new Blob([JSON.stringify(e.data,null,2)],{type:"application/json"}),a=URL.createObjectURL(n),o=document.createElement("a"),r=new Date().toISOString().split("T")[0];o.href=a,o.download=`gov-rewards-export-${r}.json`,document.body.appendChild(o),o.click(),document.body.removeChild(o),URL.revokeObjectURL(a),t.govExportResult.style.display="block",t.govExportResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                                <h4 style="color: #059669; margin: 0 0 0.5rem;">Exportación completada</h4>
                                <p><strong>Votos exportados:</strong> ${Number(e.data.summary.total_votes)}</p>
                                <p><strong>Guardianes:</strong> ${Number(e.data.summary.total_guardians)}</p>
                                <p style="color: #667085; font-size: 0.875rem; margin-top: 0.5rem;">
                                    El archivo se descargó automáticamente. Súbelo en el panel de admin de producción.
                                </p>
                            </div>`,Le()}catch(e){t.govExportResult.style.display="block",t.govExportResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                                <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error en la exportación</h4>
                                <p>${l(e.message)}</p>
                            </div>`,t.govExportBtn.disabled=!1,t.govExportBtn.textContent="Exportar Reporte",t.govExportBtn.style.background="#3B82F6",t.govExportBtn.style.cursor="pointer"}})}),t.govImportValidateBtn&&t.govImportValidateBtn.addEventListener("click",async()=>{if(!t.govImportFile||!t.govImportFile.files[0]){u("Selecciona un archivo JSON primero.");return}const e=t.govImportFile.files[0];if(!e.name.endsWith(".json")){u("El archivo debe ser de tipo .json");return}if(e.size>5*1024*1024){u("El archivo es demasiado grande (máx. 5 MB).");return}t.govImportValidateBtn.disabled=!0,t.govImportValidateBtn.textContent="Validando...",t.govImportPreview&&(t.govImportPreview.style.display="none"),t.govImportProcessBtn&&(t.govImportProcessBtn.style.display="none"),t.govImportResult&&(t.govImportResult.style.display="none");try{const n=await e.text();let a;try{a=JSON.parse(n)}catch{throw new Error("El archivo no contiene JSON válido.")}const o=await f("/api/admin/governance/demo-import-preview",{method:"POST",body:JSON.stringify({fileData:a})});if(o.status==="duplicate"){t.govImportPreview.style.display="block",t.govImportPreview.innerHTML=`
                        <div class="admin-card" style="border-left: 4px solid #F59E0B; background: #FFFBEB;">
                            <h4 style="color: #D97706; margin: 0 0 0.5rem;">Archivo ya importado</h4>
                            <p>${l(o.message)}</p>
                        </div>`;return}V=a;const r={};if(a&&Array.isArray(a.guardians))for(const b of a.guardians)b&&typeof b.username=="string"&&(r[b.username]=Array.isArray(b.votes)?b.votes:[]);const s=b=>b==="approve"?"Aprobar":b==="reject"?"Rechazar":l(String(b||"—")),i=b=>{if(!b)return"—";const _=new Date(b);return isNaN(_.getTime())?l(String(b)):_.toLocaleString("es-ES",{timeZone:"America/Bogota"})};let d="";o.guardians.forEach((b,_)=>{const g=b.found_in_production?"✅":"⚠️",x=b.found_in_production?"":" (NO encontrado en producción)",m=`gov-imp-det-${_}`,E=r[b.username]||[];let S="";for(const I of E)S+=`
                            <tr>
                                <td style="padding: 4px 8px; color: #374151;">#${Number(I.request_id)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${s(I.vote)}</td>
                                <td style="padding: 4px 8px; color: #374151;">${i(I.voted_at)}</td>
                                <td style="padding: 4px 8px; color: #6B7280;">#${Number(I.demo_vote_id)}</td>
                            </tr>`;const C=E.length===0?'<p style="color: #6B7280; margin: 0;">Sin detalle de votos en el archivo.</p>':`
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #FFFFFF; border: 1px solid #E5E7EB;">
                                <thead>
                                    <tr style="background: #F3F4F6; color: #111827; text-align: left;">
                                        <th style="padding: 6px 8px;">Solicitud</th>
                                        <th style="padding: 6px 8px;">Voto</th>
                                        <th style="padding: 6px 8px;">Fecha</th>
                                        <th style="padding: 6px 8px;">Demo vote ID</th>
                                    </tr>
                                </thead>
                                <tbody>${S}</tbody>
                            </table>`,B=Number(b.base_per_vote??o.currentRate??0),w=Number(b.multiplier??o.multiplier??1),N=b.stage_name||o.stageName||"Sin etapa activa",H=Number(b.total_base??b.new_votes*B),A=Number(b.total_reward??0);d+=`
                        <tr style="border-bottom: 1px solid #E5E7EB; color: #111827;">
                            <td style="padding: 8px; color: #111827;">
                                <button type="button" class="gov-imp-toggle" data-target="${m}"
                                    style="background: transparent; border: 1px solid #8B5CF6; color: #6D28D9;
                                           border-radius: 4px; padding: 2px 8px; margin-right: 6px; cursor: pointer;">
                                    Ver votos
                                </button>
                                ${g} <strong>${l(b.username)}</strong>${x}
                            </td>
                            <td style="padding: 8px; color: #111827;">${Number(b.new_votes)}</td>
                            <td style="padding: 8px; color: #111827;">${Number(b.already_imported)}</td>
                            <td style="padding: 8px; color: #111827;">
                                ${b.found_in_production?B.toFixed(2):"—"}
                            </td>
                            <td style="padding: 8px; color: #111827;" title="${l(N)}">
                                ${b.found_in_production?`x${w}`:"—"}
                            </td>
                            <td style="padding: 8px; color: #111827;">
                                ${b.found_in_production?H.toFixed(2):"—"}
                            </td>
                            <td style="padding: 8px; color: #047857; font-weight: 700;">
                                ${b.found_in_production?A.toFixed(2):"—"}
                            </td>
                        </tr>
                        <tr id="${m}" style="display: none; background: #FAFAFA;">
                            <td colspan="7" style="padding: 8px 12px;">
                                <div style="color: #111827;">${C}</div>
                            </td>
                        </tr>`});const c=Number(o.multiplier??1),p=o.stageName||"Sin etapa activa",v=Number(o.currentRate??0),y=Number(o.ratePerVoteFinal??v*c),h=Number(o.summary.total_base??0);t.govImportPreview.style.display="block",t.govImportPreview.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #8B5CF6; background: #FFFFFF; color: #111827;">
                        <h4 style="color: #7C3AED; margin: 0 0 1rem;">Vista Previa de Importación</h4>
                        <p style="color: #111827;"><strong>Archivo exportado:</strong> ${l(o.exported_at.split("T")[0])}</p>
                        <p style="color: #111827;"><strong>Entorno origen:</strong> ${l(o.source_env)}</p>
                        <p style="color: #111827;"><strong>Tasa base (producción):</strong> ${v.toFixed(2)} BLUE IOU</p>
                        <p style="color: #111827;">
                            <strong>Multiplicador vigente:</strong> x${c}
                            <span style="color: #6B7280;">(${l(p)})</span>
                        </p>
                        <p style="color: #111827;">
                            <strong>Tasa final por voto:</strong>
                            ${v.toFixed(2)} × ${c} = <strong>${y.toFixed(2)} BLUE IOU</strong>
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
                                <tbody>${d}</tbody>
                            </table>
                        </div>
                        <hr style="margin: 1rem 0; border-color: #E5E7EB;">
                        <p style="color: #111827;"><strong>Encontrados:</strong> ${Number(o.summary.matched)} · <strong>No encontrados:</strong> ${Number(o.summary.unmatched)}</p>
                        <p style="color: #111827;"><strong>Votos a procesar:</strong> ${Number(o.summary.total_new_votes)} · <strong>Omitidos (ya importados):</strong> ${Number(o.summary.total_skipped)}</p>
                        <p style="color: #111827;">
                            <strong>Subtotal base (sin multiplicar):</strong> ${h.toFixed(2)} BLUE IOU
                        </p>
                        <p style="font-size: 1.1rem; font-weight: 700; color: #047857; margin-top: 0.5rem;">
                            Total a acreditar (con multiplicador x${c}):
                            ${Number(o.summary.total_amount).toFixed(2)} BLUE IOU
                        </p>
                        <p style="color: #6B7280; font-size: 0.8rem; margin-top: 0.5rem;">
                            El multiplicador se aplica al momento de procesar el pago. Si la etapa booster cambia
                            entre ahora y el procesamiento, el sistema abortará la operación y te pedirá revisar
                            la preview nuevamente (control maker-checker).
                        </p>
                    </div>`,Q=c,t.govImportPreview.querySelectorAll(".gov-imp-toggle").forEach(b=>{b.addEventListener("click",()=>{const _=b.getAttribute("data-target"),g=_?document.getElementById(_):null;if(!g)return;const x=g.style.display==="none"||g.style.display==="";g.style.display=x?"table-row":"none",b.textContent=x?"Ocultar votos":"Ver votos"})}),o.summary.total_new_votes>0&&o.summary.matched>0&&o.currentRate>0&&(t.govImportProcessBtn.style.display="inline-block")}catch(n){t.govImportPreview.style.display="block",t.govImportPreview.innerHTML=`
                    <div class="admin-card" style="border-left: 4px solid #DC2626; background: #FEF2F2;">
                        <h4 style="color: #DC2626; margin: 0 0 0.5rem;">Error de validación</h4>
                        <p>${l(n.message)}</p>
                    </div>`}finally{t.govImportValidateBtn.disabled=!1,t.govImportValidateBtn.textContent="Validar Archivo"}}),t.govImportProcessBtn&&t.govImportProcessBtn.addEventListener("click",()=>{if(!V){u("No hay archivo validado. Valida primero.");return}L(`¿Estás seguro de procesar esta importación?

Se acreditarán BLUE IOU REALES en las cuentas de producción de los guardianes. Se enviará un correo de confirmación a cada guardián afectado.

Esta acción no se puede deshacer.`,async()=>{t.govImportProcessBtn.disabled=!0,t.govImportProcessBtn.textContent="Procesando...",t.govImportResult&&(t.govImportResult.style.display="none");try{const e=await f("/api/admin/governance/demo-import-process",{method:"POST",body:JSON.stringify({fileData:V,expectedMultiplier:Q})});V=null,Q=null,t.govImportProcessBtn.disabled=!1,t.govImportProcessBtn.textContent="Confirmar y Procesar Pagos",t.govImportProcessBtn.style.display="none";const n=Number(e.multiplier??1),a=e.stageName||"Sin etapa activa",o=Number(e.finalRatePerVote??Number(e.rateUsed||0)*n);t.govImportResult.style.display="block",t.govImportResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid #059669; background: #F0FDF4;">
                                <h4 style="color: #059669; margin: 0 0 0.5rem;">Importación completada</h4>
                                <p><strong>Votos procesados:</strong> ${Number(e.totalProcessed)}</p>
                                <p><strong>Omitidos:</strong> ${Number(e.totalSkipped)}</p>
                                <p><strong>Tasa base aplicada:</strong> ${Number(e.rateUsed).toFixed(2)} BLUE IOU</p>
                                <p><strong>Multiplicador aplicado:</strong> x${n}
                                    <span style="color: #6B7280;">(${l(a)})</span>
                                </p>
                                <p><strong>Tasa final por voto:</strong> ${o.toFixed(2)} BLUE IOU</p>
                                <p><strong>Guardianes notificados:</strong> ${Number(e.guardiansAffected)}</p>
                            </div>`,ne()}catch(e){const n=e&&(e.code==="MULTIPLIER_CHANGED"||typeof e.message=="string"&&e.message.includes("etapa booster cambió"));t.govImportResult.style.display="block",t.govImportResult.innerHTML=`
                            <div class="admin-card" style="border-left: 4px solid ${n?"#D97706":"#DC2626"};
                                 background: ${n?"#FFFBEB":"#FEF2F2"};">
                                <h4 style="color: ${n?"#B45309":"#DC2626"}; margin: 0 0 0.5rem;">
                                    ${n?"Etapa booster cambió — revalidar":"Error en la importación"}
                                </h4>
                                <p>${l(e.message||"Error desconocido")}</p>
                                ${n?'<p style="color: #78350F;">Vuelve a pulsar <strong>Validar Archivo</strong> para ver la nueva tasa y autorizar el pago con el multiplicador vigente.</p>':""}
                            </div>`,n&&(V=null,Q=null,t.govImportProcessBtn.style.display="none"),t.govImportProcessBtn.disabled=!1,t.govImportProcessBtn.textContent="Confirmar y Procesar Pagos"}})});function Zt(){const e=document.getElementById("kycCheckBtn"),n=document.getElementById("kycApproveBtn"),a=document.getElementById("kycRevokeBtn"),o=document.getElementById("kycUsernameInput");e&&!e._kycListenerAttached&&(e._kycListenerAttached=!0,e.addEventListener("click",()=>{const r=o?.value?.trim();if(!r){u("Ingresa un nombre de usuario para consultar.");return}Qt(r)}),o.addEventListener("keyup",r=>{r.key==="Enter"&&e.click()})),n&&!n._kycListenerAttached&&(n._kycListenerAttached=!0,n.addEventListener("click",()=>{const r=document.getElementById("kycResultUsername")?.textContent;r&&L(`¿Estás seguro de APROBAR el KYC para "${r}"? Esta acción se registrará en el Smart Contract y en el log de auditoría.`,()=>ke(r,!0))})),a&&!a._kycListenerAttached&&(a._kycListenerAttached=!0,a.addEventListener("click",()=>{const r=document.getElementById("kycResultUsername")?.textContent;r&&L(`⚠️ ¿Estás seguro de REVOCAR el KYC para "${r}"? El usuario NO podrá crear publicaciones que impliquen pagos.`,()=>ke(r,!1))}))}async function Qt(e){const n=document.getElementById("kycStatusResult"),a=document.getElementById("kycOperationResult");n&&(n.style.display="none"),a&&(a.style.display="none");try{const o=await f(`/api/admin/users?search=${encodeURIComponent(e)}`),r=Array.isArray(o)?o.find(c=>c.username===e):null;if(!r){u(`Usuario "${l(e)}" no encontrado.`);return}document.getElementById("kycResultUsername").textContent=r.username,document.getElementById("kycResultWallet").textContent=r.web3_wallet_address?`Wallet: ${r.web3_wallet_address}`:"Sin billetera Web3 registrada",document.getElementById("kycResultStatus").textContent="⏳ Consultando blockchain...",document.getElementById("kycResultStatus").style.color="#F59E0B",document.getElementById("kycActions").style.display="none",n.style.display="block";const s=await f(`/api/admin/users/${r.id}/kyc-status`),i=document.getElementById("kycResultStatus"),d=document.getElementById("kycActions");if(document.getElementById("kycResultWallet").textContent=s.walletAddress?`Wallet: ${s.walletAddress}`:"Sin billetera Web3 registrada",!s.walletAddress){i.textContent="N/A — Sin billetera Web3",i.style.color="#667085",d.style.display="none";return}if(!s.blockchainQuerySuccess){const c=s.kycInDatabase?"✅ VERIFICADO (caché DB)":"❌ NO VERIFICADO (caché DB)";i.textContent=`⚠️ ${c}`,i.style.color="#F59E0B",d.style.display="flex";return}if(s.kycOnChain===!0?(i.textContent="✅ VERIFICADO ON-CHAIN",i.style.color="#059669"):(i.textContent="❌ NO VERIFICADO ON-CHAIN",i.style.color="#DC2626"),s.message&&s.message.includes("discrepancia")){const c=document.createElement("p");c.style.cssText="color: #F59E0B; font-size: 12px; margin: 4px 0 0; font-style: italic;",c.textContent="⚡ "+s.message,i.parentNode.insertBefore(c,i.nextSibling)}d.style.display="flex"}catch(o){u(`Error al consultar usuario: ${o.message}`)}}async function ke(e,n){const a=document.getElementById("kycOperationResult"),o=document.getElementById("kycApproveBtn"),r=document.getElementById("kycRevokeBtn");o&&(o.disabled=!0),r&&(r.disabled=!0);try{const s=await f("/api/governance/kyc",{method:"POST",body:JSON.stringify({username:e,kycStatus:n})});a.style.display="block",a.style.background="rgba(5, 150, 105, 0.1)",a.style.border="1px solid #059669",a.innerHTML=`
                <p style="color: #059669; font-weight: 700; margin: 0 0 0.5rem;">✅ ${l(s.message)}</p>
                <p style="color: #667085; font-size: 13px; margin: 0;">TX Hash: ${l(s.txHash||"Sin cambios necesarios")}</p>
            `;const i=document.getElementById("kycResultStatus");i&&(i.textContent=n?"✅ VERIFICADO":"❌ NO VERIFICADO",i.style.color=n?"#059669":"#DC2626")}catch(s){a.style.display="block",a.style.background="rgba(220, 38, 38, 0.1)",a.style.border="1px solid #DC2626",a.innerHTML=`
                <p style="color: #DC2626; font-weight: 700; margin: 0;">❌ Error: ${l(s.message)}</p>
            `}finally{o&&(o.disabled=!1),r&&(r.disabled=!1)}}async function Xt(){try{const e=await f("/api/admin/profile"),n=document.getElementById("sidebarTeamLi");n&&(e.role==="superadmin"?n.style.display="block":n.style.display="none"),e.username&&(localStorage.setItem("admin_username",e.username),se())}catch(e){console.error("Error al obtener perfil administrativo de control:",e)}}function ea(){const e=document.getElementById("inviteAdminForm");e&&!e._teamListenerAttached&&(e._teamListenerAttached=!0,e.addEventListener("submit",async n=>{n.preventDefault();const a=document.getElementById("inviteEmailInput"),o=document.getElementById("inviteRoleSelect"),r=document.getElementById("sendInviteBtn"),s=a?.value?.trim(),i=o?.value;if(!s||!i){u("Por favor, introduce un email y selecciona un rol.");return}r&&(r.disabled=!0);try{const d=await f("/api/admin/invitations",{method:"POST",body:JSON.stringify({email:s,role:i})});u(d.message||"Invitación de administrador enviada correctamente."),a&&(a.value=""),oe()}catch(d){u(d.message||"Error al generar la invitación.")}finally{r&&(r.disabled=!1)}}))}async function oe(){const e=document.getElementById("invitations-table-container");if(e){e.innerHTML='<div class="loading-spinner"></div>';try{const n=await f("/api/admin/invitations");if(!n||n.length===0){e.innerHTML='<p style="text-align:center; color:#94A3B8; padding:20px;">No hay invitaciones registradas en la base de datos.</p>';return}let a=`
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Rol</th>
                            <th>Creado Por</th>
                            <th>Fecha Envío</th>
                            <th>Expiración</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
            `;n.forEach(o=>{let r="Pendiente",s="background: rgba(245, 158, 11, 0.15); color: #F59E0B; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",i="";o.used_at?(r="Reclamada",s="background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",i='<span style="color:#64748B;">—</span>'):(o.is_expired&&(r="Expirada",s="background: rgba(239, 68, 68, 0.15); color: #EF4444; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;"),i=`
                        <button type="button" class="btn-revoke-invite" data-email="${l(o.email)}" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                            Revocar
                        </button>
                    `);const d=new Date(o.created_at).toLocaleString("es-ES"),c=new Date(o.expires_at).toLocaleString("es-ES");a+=`
                    <tr>
                        <td class="username-cell">${l(o.email)}</td>
                        <td style="text-transform: capitalize;">${l(o.role)}</td>
                        <td>${l(o.created_by)}</td>
                        <td>${d}</td>
                        <td>${c}</td>
                        <td><span style="${s}">${r}</span></td>
                        <td>${i}</td>
                    </tr>
                `}),a+=`
                    </tbody>
                </table>
            `,e.innerHTML=a,e.dataset.listenerRegistered||(e.dataset.listenerRegistered="true",e.addEventListener("click",o=>{const r=o.target.closest(".btn-revoke-invite");if(r){const s=r.dataset.email;if(!s)return;L(`¿Estás seguro de que deseas revocar y anular permanentemente la invitación para ${s}? Esta acción es irreversible.`,async()=>{try{r.disabled=!0;const i=r.innerText;r.innerText="Revocando...";const d=await f("/api/admin/invitations",{method:"DELETE",body:JSON.stringify({email:s})});u(d.message||`Invitación de ${s} revocada con éxito.`),oe()}catch(i){u(i.message||"Error al revocar la invitación."),r.disabled=!1,r.innerText="Revocar"}})}}))}catch(n){e.innerHTML=`<p class="error-message">Error al cargar la tabla de invitaciones: ${l(n.message)}</p>`}}}async function Pe(){const e=document.getElementById("active-admins-table-container");if(e){e.innerHTML='<div class="loading-spinner"></div>';try{const n=await f("/api/admin/team");if(!n||n.length===0){e.innerHTML='<p style="text-align:center; color:#94A3B8; padding:20px;">No hay administradores registrados.</p>';return}let a=`
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Nombre Usuario</th>
                            <th>Rol</th>
                            <th>Creado El</th>
                            <th>Última Conexión</th>
                            <th>Estado</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
            `;const o=localStorage.getItem("admin_username")||"",r="admin";n.forEach(s=>{let i="Activo",d="background: rgba(16, 185, 129, 0.15); color: #10B981; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;",c="";const p=s.username.toLowerCase()===o.toLowerCase(),v=s.username.toLowerCase()===r;s.account_status==="suspended"&&(i="Suspendido",d="background: rgba(239, 68, 68, 0.15); color: #EF4444; padding: 4px 8px; border-radius: 4px; font-weight: bold; font-size: 12px;"),p||v?c='<span style="color:#64748B;">Protegido</span>':s.account_status==="suspended"?c=`
                            <button type="button" class="btn-toggle-admin-status" data-id="${s.id}" data-username="${l(s.username)}" data-target-status="active" style="background:none; border:none; color:#10B981; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                                Activar
                            </button>
                        `:c=`
                            <button type="button" class="btn-toggle-admin-status" data-id="${s.id}" data-username="${l(s.username)}" data-target-status="suspended" style="background:none; border:none; color:#EF4444; cursor:pointer; font-weight:bold; font-size:12px; text-decoration:underline; padding:0;">
                                Suspender
                            </button>
                        `;const y=s.created_at?new Date(s.created_at).toLocaleString("es-ES"):"N/A",h=s.last_login?new Date(s.last_login).toLocaleString("es-ES"):"Nunca";a+=`
                    <tr>
                        <td class="username-cell">${l(s.username)}</td>
                        <td style="text-transform: capitalize;">${l(s.role)}</td>
                        <td>${y}</td>
                        <td>${h}</td>
                        <td><span style="${d}">${i}</span></td>
                        <td>${c}</td>
                    </tr>
                `}),a+=`
                    </tbody>
                </table>
            `,e.innerHTML=a,e.dataset.listenerRegistered||(e.dataset.listenerRegistered="true",e.addEventListener("click",s=>{const i=s.target.closest(".btn-toggle-admin-status");if(i){const d=i.dataset.id,c=i.dataset.username,p=i.dataset.targetStatus;if(!d||!p)return;L(`¿Estás seguro de que deseas ${p==="suspended"?"SUSPENDER":"ACTIVAR"} al administrador "${c}"?`,async()=>{try{i.disabled=!0,i.innerText=p==="suspended"?"Suspendiendo...":"Activando...";const y=await f(`/api/admin/team/${d}/status`,{method:"POST",body:JSON.stringify({status:p})});u(y.message||`Estado de ${c} actualizado con éxito.`),Pe()}catch(y){u(y.message||"Error al actualizar el estado del administrador."),i.disabled=!1,i.innerText=p==="suspended"?"Suspender":"Activar"}})}}))}catch(n){e.innerHTML=`<p class="error-message">Error al cargar el equipo administrativo: ${l(n.message)}</p>`}}}const Me=document.getElementById("btnAutoFillQA");if(Me&&Me.addEventListener("click",()=>{const e=document.getElementById("qaMarkdownInput"),n=e?e.value.trim():"";if(!n){u("Por favor, pega el texto de la prueba generado por la IA.");return}const a=n.match(/TITULO:\s*(.*)/i),o=n.match(/DESCRIPCION:\s*([\s\S]*?)(?=PASOS:|$)/i),r=n.match(/PASOS:\s*([\s\S]*)/i);if(!a||!o||!r){u("Error de formato. Asegúrate de incluir 'TITULO:', 'DESCRIPCION:' y 'PASOS:' exactamente como indica el modelo estricto.");return}const s=a[1].trim(),i=o[1].trim(),v=["Aceptar tarea y grabar pantalla",...r[1].trim().split(`
`).filter(B=>B.trim().length>0).map(B=>B.replace(/^\d+\.\s*/,"").trim())],y=document.getElementById("platformPubTitle");y&&(y.value=s);const h=document.getElementById("platformPubDescription");h&&(h.value=i);const b=document.getElementById("platformPubCost");b&&(b.value="1");const _=document.getElementById("platformPubSlots");_&&(_.value="10");const g=document.getElementById("platformAutoApprove");g&&(g.checked=!0);const x=document.getElementById("platformRequiresEvidence");x&&(x.checked=!0);const m=document.getElementById("platformAllowRepeatParticipation");m&&(m.checked=!0,m.dispatchEvent(new Event("change")));const E=document.getElementById("platformRepeatLimit");E&&(E.value="10");const S=document.getElementById("platformAddStepBtn");if(S)for(;document.querySelectorAll(".admin-step-input").length<v.length;)S.click();document.querySelectorAll(".admin-step-input").forEach((B,w)=>{const N=w+1,H=B.querySelector(`input[id="platformStep${N}"]`),A=B.querySelector(".step-form-checkbox"),I=B.querySelector(".step-form-fields"),R=B.querySelector(".step-form-inputs");H&&(w<v.length?(H.value=v[w],w===v.length-1?(A&&(A.checked=!0),I&&(I.style.display="block"),R&&(R.innerHTML=`
                                <input type="text" class="step-form-field" value="¿Pasó la prueba?">
                                <input type="text" class="step-form-field" value="Enlace de evidencia">
                                <input type="text" class="step-form-field" value="Si dio error, detalla lo ocurrido">
                            `)):(A&&(A.checked=!1),I&&(I.style.display="none"),R&&(R.innerHTML=`
                            <input type="text" class="step-form-field" placeholder="Campo 1">
                            <input type="text" class="step-form-field" placeholder="Campo 2">
                            <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                        `))):(H.value="",A&&(A.checked=!1),I&&(I.style.display="none"),R&&(R.innerHTML=`
                        <input type="text" class="step-form-field" placeholder="Campo 1">
                        <input type="text" class="step-form-field" placeholder="Campo 2">
                        <input type="text" class="step-form-field" placeholder="Campo 3 (opcional)">
                    `)))}),u("¡Formulario de prueba autocompletado exitosamente! Revisa los datos y haz clic en Publicar.")}),t.sosVictimsSearchInput){let e;t.sosVictimsSearchInput.addEventListener("keyup",()=>{clearTimeout(e),e=setTimeout(()=>j(),300)})}t.sosVictimsStatusFilter&&t.sosVictimsStatusFilter.addEventListener("change",()=>j()),t.sosEditEmailTemplatesBtn&&t.sosEditEmailTemplatesBtn.addEventListener("click",()=>oa()),document.querySelectorAll(".sos-victim-modal-close").forEach(e=>{e.addEventListener("click",()=>{t.sosVictimDetailModal&&(t.sosVictimDetailModal.style.display="none")})}),document.querySelectorAll(".sos-disburse-modal-close").forEach(e=>{e.addEventListener("click",()=>{t.sosVictimDisburseModal&&(t.sosVictimDisburseModal.style.display="none")})}),document.querySelectorAll(".sos-templates-modal-close").forEach(e=>{e.addEventListener("click",()=>{t.sosEmailTemplatesModal&&(t.sosEmailTemplatesModal.style.display="none")})}),window.addEventListener("click",e=>{t.sosVictimDetailModal&&e.target===t.sosVictimDetailModal&&(t.sosVictimDetailModal.style.display="none"),t.sosVictimDisburseModal&&e.target===t.sosVictimDisburseModal&&(t.sosVictimDisburseModal.style.display="none"),t.sosEmailTemplatesModal&&e.target===t.sosEmailTemplatesModal&&(t.sosEmailTemplatesModal.style.display="none")}),t.sosDisburseForm&&t.sosDisburseForm.addEventListener("submit",async e=>{e.preventDefault();const n=document.getElementById("sosDisburseVictimId").value,a=document.getElementById("sosDisburseAmount").value,o=document.getElementById("sosDisbursePeriod").value,r=document.getElementById("sosDisburseNotes").value;try{const s=await f(`/api/admin/sos-venezuela/victims/${n}/disburse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({amount_blue:parseFloat(a),disbursement_period:o,notes:r})});u(s.message||"¡Entrega de ayuda asignada exitosamente!"),t.sosVictimDisburseModal&&(t.sosVictimDisburseModal.style.display="none"),j()}catch(s){u(`Error al asignar ayuda: ${s.message}`)}});async function j(){if(!t.sosVictimsTableContainer)return;t.sosVictimsTableContainer.innerHTML='<div class="loading-spinner"></div>';const e=t.sosVictimsStatusFilter?.value||"pending_verification",n=t.sosVictimsSearchInput?.value||"";try{const a=await f(`/api/admin/sos-venezuela/victims?status=${encodeURIComponent(e)}&search=${encodeURIComponent(n)}`);if(ta(a.victims||[]),t.sosVictimsBadge){const o=(a.victims||[]).filter(r=>r.status==="pending_verification").length;t.sosVictimsBadge.textContent=o>0?o:""}}catch(a){console.error("[SOS ADMIN] Error al cargar expedientes:",a),t.sosVictimsTableContainer.innerHTML=`<p class="error-message">Error al cargar expedientes: ${l(a.message)}</p>`}}function ta(e){if(!e||e.length===0){t.sosVictimsTableContainer.innerHTML='<p class="no-data-message">No se encontraron expedientes con los filtros seleccionados.</p>';return}let n=`
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>Expediente</th>
                        <th>Nombre</th>
                        <th>Cédula</th>
                        <th>Teléfono</th>
                        <th>Ubicación</th>
                        <th>Dependientes</th>
                        <th>Afectación</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
        `;e.forEach(a=>{const o={pending_verification:'<span class="status-badge pending">En Verificación</span>',info_requested:'<span class="status-badge active" style="background: #3b82f6;">Info Requerida</span>',approved_for_aid:'<span class="status-badge active" style="background: #10b981;">Aprobado</span>',verified_approved:'<span class="status-badge active" style="background: #10b981;">Aprobado</span>',disbursed:'<span class="status-badge active" style="background: #8b5cf6;">Desembolsado</span>',rejected:'<span class="status-badge inactive">Rechazado</span>'},r={total_loss:"🚨 Pérdida Total",medical_emergency:"🚑 Emergencia Médica",partial_damage:"🏚️ Daño Parcial",essential_needs:"📦 Insumos Básicos"},s=(parseInt(a.dependents_minors)||0)+(parseInt(a.dependents_elderly)||0)+(parseInt(a.dependents_disabled)||0),i=a.status==="approved_for_aid",d=i?"":"disabled",c=i?"":"opacity: 0.5; cursor: not-allowed; pointer-events: none;";n+=`
                <tr>
                    <td><strong style="font-family: monospace; color: #ec4899;">#${l(a.dossier_number)}</strong></td>
                    <td>${l(a.full_name)}</td>
                    <td>${l(a.id_document)}</td>
                    <td>${l(a.phone_number)}</td>
                    <td>${l(a.state)} / ${l(a.municipality)}</td>
                    <td><strong>${s}</strong> (👨‍👩‍👧 ${a.dependents_minors} | 👴 ${a.dependents_elderly} | ♿ ${a.dependents_disabled})</td>
                    <td>${r[a.affectation_level]||a.affectation_level}</td>
                    <td>${o[a.status]||a.status}</td>
                    <td>
                        <button type="button" class="action-button-admin view-sos-victim-btn" data-id="${a.id}" style="padding: 4px 10px; font-size: 0.85rem; margin-right: 4px;">🔎 Ver Ficha</button>
                        <button type="button" class="action-button-admin publish disburse-sos-victim-btn" data-id="${a.id}" data-dossier="${l(a.dossier_number)}" ${d} style="padding: 4px 10px; font-size: 0.85rem; ${c}">💸 Asignar Ayuda</button>
                    </td>
                </tr>
            `}),n+="</tbody></table>",t.sosVictimsTableContainer.innerHTML=n,t.sosVictimsTableContainer.querySelectorAll(".view-sos-victim-btn").forEach(a=>{a.addEventListener("click",()=>aa(a.getAttribute("data-id")))}),t.sosVictimsTableContainer.querySelectorAll(".disburse-sos-victim-btn").forEach(a=>{a.addEventListener("click",()=>na(a.getAttribute("data-id"),a.getAttribute("data-dossier")))})}async function aa(e){if(t.sosVictimDetailModal){t.sosVictimModalTitle.textContent="Cargando Expediente...",t.sosVictimModalBody.innerHTML='<div class="loading-spinner"></div>',t.sosVictimModalActions.innerHTML="",t.sosVictimDetailModal.style.display="flex";try{const n=await f(`/api/admin/sos-venezuela/victims/${e}`),a=n.victim;t.sosVictimModalTitle.textContent=`Expediente #${a.dossier_number}`;let o="";a.evidence_urls&&a.evidence_urls.length>0?o=a.evidence_urls.map(i=>{if(i.includes("drive.google.com")||i.includes("photos.app.goo.gl")||i.includes("photos.google.com"))return`<a href="${l(i)}" target="_blank" style="display: inline-block; background: rgba(236,72,153,0.15); color: #f472b6; padding: 6px 12px; border-radius: 6px; text-decoration: none; margin: 4px;">🔗 Enlace Externo / Google Fotos ↗</a>`;const c=i.startsWith("http")?i:i.startsWith("/")?`${P}${i}`:`${P}/${i}`;return`<a href="${l(c)}" target="_blank" title="Abrir imagen completa en nueva pestaña"><img src="${l(c)}" alt="Evidencia SOS" style="width: 90px; height: 90px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); margin: 4px; transition: transform 0.15s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'"></a>`}).join(""):o='<p style="color: #94a3b8; font-size: 0.9rem;">Sin imágenes adjuntas.</p>';let r="";n.disbursements&&n.disbursements.length>0&&(r=`
                    <div style="margin-top: 1rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px;">
                        <strong style="color: #8b5cf6; display: block; margin-bottom: 0.5rem;">📜 Historial de Entregas Realizadas:</strong>
                        <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.9rem; color: #cbd5e1;">
                            ${n.disbursements.map(i=>`<li><strong>${i.amount_blue} BLUE</strong> (${l(i.disbursement_period)}) - ${new Date(i.created_at).toLocaleDateString()} ${i.notes?"- "+l(i.notes):""}</li>`).join("")}
                        </ul>
                    </div>
                `);let s="";n.history&&n.history.length>0&&(s=`
                    <div style="margin-top: 1rem; background: rgba(0,0,0,0.3); padding: 1rem; border-radius: 8px;">
                        <strong style="color: #ec4899; display: block; margin-bottom: 0.5rem;">📋 Bitácora Histórica de Eventos (Auditoría):</strong>
                        <div style="display: flex; flex-direction: column; gap: 8px; max-height: 200px; overflow-y: auto; padding-right: 4px;">
                            ${n.history.map(i=>{const d=new Date(i.created_at),c=String(d.getDate()).padStart(2,"0"),p=String(d.getMonth()+1).padStart(2,"0"),v=d.getFullYear(),y=String(d.getHours()).padStart(2,"0"),h=String(d.getMinutes()).padStart(2,"0"),b=`${c}/${p}/${v} ${y}:${h}`;let _="#9f1239",g=i.event_type;return i.event_type==="registered"?(g="CREADO",_="#0284c7"):i.event_type==="approved_for_aid"?(g="APROBADO AYUDA",_="#10b981"):i.event_type==="disbursed"?(g="AYUDA ENTREGADA",_="#8b5cf6"):i.event_type==="info_requested"?(g="INFO REQUERIDA",_="#f59e0b"):i.event_type==="rejected"&&(g="RECHAZADO",_="#ef4444"),`
                                    <div style="background: rgba(255,255,255,0.03); padding: 8px 10px; border-radius: 6px; border-left: 3px solid ${_}; font-size: 0.85rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; color: #94a3b8; font-size: 0.8rem; margin-bottom: 2px;">
                                            <span style="font-weight: bold; color: ${_}; text-transform: uppercase;">${l(g)}</span>
                                            <span>📅 ${b}</span>
                                        </div>
                                        <p style="margin: 0; color: #e2e8f0; font-size: 0.85rem;">${l(i.message)}</p>
                                    </div>
                                `}).join("")}
                        </div>
                    </div>
                `),t.sosVictimModalBody.innerHTML=`
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                    <div><strong>Nombre:</strong> ${l(a.full_name)}</div>
                    <div><strong>Cédula:</strong> ${l(a.id_document)}</div>
                    <div><strong>Edad:</strong> ${a.age?a.age+" años":"N/A"} ${a.birth_date?"("+new Date(a.birth_date).toLocaleDateString("es-ES")+")":""}</div>
                    <div><strong>Género:</strong> ${l(a.gender)}</div>
                    <div><strong>¿Cabeza de Familia?:</strong> ${a.is_head_of_family?"Sí":"No"}</div>
                    <div><strong>Correo:</strong> ${l(a.email)}</div>
                    <div><strong>Teléfono:</strong> ${l(a.phone_number)}</div>
                    <div><strong>Puntaje Urgencia:</strong> <span style="background: rgba(236,72,153,0.2); color: #ec4899; padding: 2px 8px; border-radius: 4px; font-weight: bold; font-family: monospace;">${a.urgency_score||"N/A"}</span></div>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <strong style="color: #ec4899; display: block; margin-bottom: 0.4rem;">📍 Ubicación Geográfica:</strong>
                    <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1;">
                        Estado: <strong>${l(a.state)}</strong> | Municipio: <strong>${l(a.municipality)}</strong> | Sector: <strong>${l(a.sector)}</strong><br>
                        Dirección: ${l(a.address_details)}
                    </p>
                </div>

                <div style="background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                    <strong style="color: #ec4899; display: block; margin-bottom: 0.4rem;">👨‍👩‍👧‍👦 Censo de Dependientes:</strong>
                    <p style="margin: 0; font-size: 0.95rem; color: #cbd5e1;">
                        Menores de edad: <strong>${a.dependents_minors}</strong> | Adultos mayores: <strong>${a.dependents_elderly}</strong> | Personas con discapacidad: <strong>${a.dependents_disabled}</strong>
                    </p>
                </div>

                <div style="margin-bottom: 1rem;">
                    <strong style="color: #ec4899; display: block; margin-bottom: 0.4rem;">📝 Relato del Daño:</strong>
                    <p style="background: rgba(0,0,0,0.3); padding: 10px; border-radius: 6px; font-size: 0.95rem; color: #e2e8f0; line-height: 1.5; margin: 0;">
                        ${l(a.description)}
                    </p>
                </div>

                <div style="margin-bottom: 1rem;">
                    <strong style="color: #ec4899; display: block; margin-bottom: 0.4rem;">📷 Fotos y Evidencias:</strong>
                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">${o}</div>
                </div>

                ${r}

                ${s}

                <div style="margin-top: 1.25rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
                    <label style="font-weight: 600; color: #cbd5e1; display: block; margin-bottom: 0.4rem;">Actualizar Estado y Notificar por Correo:</label>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <select id="sosUpdateStatusSelect" class="admin-input-dark" style="padding: 8px 12px; border-radius: 6px; background: #0f172a; color: #fff;">
                            <option value="pending_verification" ${a.status==="pending_verification"?"selected":""}>En Verificación Manual</option>
                            <option value="info_requested" ${a.status==="info_requested"?"selected":""}>Solicitar Información Adicional</option>
                            <option value="approved_for_aid" ${a.status==="approved_for_aid"?"selected":""}>Aprobar para Ayuda</option>
                            <option value="disbursed" ${a.status==="disbursed"?"selected":""}>Marcar Desembolsado</option>
                            <option value="rejected" ${a.status==="rejected"?"selected":""}>Rechazar Expediente</option>
                        </select>
                        <input type="text" id="sosUpdateCustomMsg" class="admin-input-dark" placeholder="Mensaje personalizado o información requerida..." style="flex: 1; min-width: 200px; padding: 8px 12px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff;">
                        <button type="button" id="sosSaveStatusBtn" class="action-button-admin publish" style="padding: 8px 16px; border-radius: 6px;">Guardar y Notificar</button>
                    </div>
                </div>
            `,document.getElementById("sosSaveStatusBtn")?.addEventListener("click",async()=>{const i=document.getElementById("sosUpdateStatusSelect").value,d=document.getElementById("sosUpdateCustomMsg").value;try{const c=await f(`/api/admin/sos-venezuela/victims/${e}/update-status`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:i,custom_message:d})});u(c.message||"Estado actualizado exitosamente."),t.sosVictimDetailModal.style.display="none",j()}catch(c){u(`Error al actualizar estado: ${c.message}`)}})}catch(n){t.sosVictimModalBody.innerHTML=`<p class="error-message">Error al cargar detalle: ${l(n.message)}</p>`}}}function na(e,n){t.sosVictimDisburseModal&&(document.getElementById("sosDisburseVictimId").value=e,document.getElementById("sosDisburseAmount").value="",document.getElementById("sosDisburseNotes").value="",t.sosVictimDisburseModal.style.display="flex")}async function oa(){if(t.sosEmailTemplatesModal){t.sosEmailTemplatesBody.innerHTML='<div class="loading-spinner"></div>',t.sosEmailTemplatesModal.style.display="flex";try{const n=(await f("/api/admin/sos-venezuela/email-templates")).templates||[];let a='<div style="display: flex; flex-direction: column; gap: 1.5rem;">';n.forEach(o=>{a+=`
                    <div style="background: rgba(15,23,42,0.6); padding: 1.25rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
                        <strong style="color: #ec4899; display: block; margin-bottom: 0.5rem;">Plantilla: ${l(o.template_key)}</strong>
                        <div style="margin-bottom: 0.8rem;">
                            <label style="font-size: 0.85rem; color: #cbd5e1;">Asunto del Correo:</label>
                            <input type="text" id="tpl_subj_${o.template_key}" class="admin-input-dark" value="${l(o.subject)}" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff;">
                        </div>
                        <div>
                            <label style="font-size: 0.85rem; color: #cbd5e1;">Cuerpo HTML:</label>
                            <textarea id="tpl_body_${o.template_key}" rows="5" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(0,0,0,0.3); color: #fff; font-family: monospace; font-size: 0.85rem; line-height: 1.4;">${l(o.html_body)}</textarea>
                        </div>
                        <button type="button" class="action-button-admin publish save-template-btn" data-key="${o.template_key}" style="margin-top: 0.8rem; padding: 6px 14px; font-size: 0.9rem;">Guardar Plantilla</button>
                    </div>
                `}),a+="</div>",t.sosEmailTemplatesBody.innerHTML=a,t.sosEmailTemplatesBody.querySelectorAll(".save-template-btn").forEach(o=>{o.addEventListener("click",async()=>{const r=o.getAttribute("data-key"),s=document.getElementById(`tpl_subj_${r}`).value,i=document.getElementById(`tpl_body_${r}`).value;try{const d=await f("/api/admin/sos-venezuela/email-templates",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({template_key:r,subject:s,html_body:i})});u(d.message||"Plantilla guardada exitosamente.")}catch(d){u(`Error al guardar plantilla: ${d.message}`)}})})}catch(e){t.sosEmailTemplatesBody.innerHTML=`<p class="error-message">Error al cargar plantillas: ${l(e.message)}</p>`}}}});
//# sourceMappingURL=adminPanel.CRWSeZVV.js.map
