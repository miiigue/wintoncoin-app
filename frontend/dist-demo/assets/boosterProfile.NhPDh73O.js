import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                      */import{i as G}from"./index.pbqrtUCb.js";import{s as K,g as V,h as Y,i as k}from"./auth.BgcrufBo.js";function $(){const x=V(),L=new URLSearchParams(window.location.search).get("username"),T=localStorage.getItem("username"),p=L||T,u={content:document.getElementById("booster-profile-content")};if(!p){u.content.innerHTML='<p class="error-message">No se pudo determinar el perfil a mostrar. Asegúrate de haber iniciado sesión o de que la URL sea correcta.</p>',K("No se pudo determinar qué perfil mostrar.",()=>{window.location.href="index.html"});return}_(p);async function _(t){try{const e=localStorage.getItem("token"),o=localStorage.getItem("username"),s=o&&t===o&&e,i=`${x}/api/users/${t}/booster-profile`,a=await fetch(i,{headers:s?{Authorization:`Bearer ${e}`}:{}});if(Y(a))return;if(!a.ok){const d=await a.json();throw new Error(d.message||"Error al cargar el perfil de impulsor.")}const r=await a.json();M(r)}catch(e){console.error(e),u.content.innerHTML=`<p class="error-message">${e.message}</p>`}}function M(t){if(!t.is_booster){u.content.innerHTML=`
                <div class="booster-header"><h1>Programa de Impulsores</h1></div>
                <p class="empty-message" style="text-align: center; font-size: 1.1rem; margin: 2rem;">${t.message}<br>¡Completa tareas de la plataforma para unirte!</p>
            `;return}const{current_level_info:e,next_level_info:o,all_levels:s,total_booster_blue:i,eligible_booster_blue:a,pending_booster_blue:r,booster_tasks_completed_count:d,transactions:v}=t,l=B(e),m=E(t,i,a||0,r||0,d||0),b=D(i,e,o,s),y=P(v);if(u.content.innerHTML=`${l}${m}${b}${y}`,R(),q(),t.daily_improved){const c=u.content.querySelector(".booster-daily-goal");c&&(c.classList.add("rank-improved"),O(c),setTimeout(()=>c.classList.remove("rank-improved"),2200))}}function B(t){const e=t?.description||"Acumula más BLUE iou para subir de nivel.",o=p?p.charAt(0).toUpperCase()+p.slice(1):"Impulsor";return`
            <div class="booster-header">
                <h1 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-booster-level">
                    ${k(o)}, eres nivel ${t?t.level:"?"} <i class="info-icon" style="font-size: 1.1rem; font-style: normal; opacity: 0.8; margin-left: 5px; vertical-align: middle;">ⓘ</i>
                </h1>
                <div class="booster-value-display" style="margin-top: 6px; font-weight: 600; font-size: 0.85rem; letter-spacing: 0.5px;">
                    <span class="shimmer-text">1 BLUE iou = 1 BLUE = 1 USD</span>
                </div>
                <div id="tooltip-booster-level" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>${e}</p>
                </div>
            </div>
        `}function E(t,e,o,s,i){const a=[U(e),w(o),S(s),A(t.base_eligible_booster_blue||0),z(t),C(t),H(t),I(i)].filter(Boolean);return a.length===0?"":`<div class="booster-stats booster-stats-blocks booster-summary-cards">${a.join("")}</div>`}const g='<span style="font-size: 0.95rem; font-weight: 500; opacity: 0.85; margin-left: 4px; display: inline-block; vertical-align: middle;">BLUE IOU</span>';function U(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-total-blue">Total BLUE iou Acumulado <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px;">ⓘ</i></span>
                </div>
                <div id="tooltip-total-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE iou acumulados totales en tu perfil de impulsor.</p>
                </div>
                <div class="ranking-position booster-total-highlight">${n(t)} ${g}</div>
            </div>
        `}function w(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-available-blue" style="color: #10B981; font-weight: bold;">Habilitado para Canje (KYC) <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px; color: #10B981;">ⓘ</i></span>
                </div>
                <div id="tooltip-available-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE iou habilitados para canjear por tokens BLUE a partir del lanzamiento oficial. Requiere KYC aprobado tuyo y de tus referidos.</p>
                </div>
                <div class="ranking-position booster-total-highlight" style="color: #10B981;">${n(t)} ${g}</div>
            </div>
        `}function S(t){return`
            <div class="booster-stat-block booster-summary-card" style="position: relative;">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-pending-blue" style="color: #F59E0B; font-weight: bold;">BLUE IOU de referidos sin KYC <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px; color: #F59E0B;">ⓘ</i></span>
                </div>
                <div id="tooltip-pending-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE iou generados por tus referidos que se encuentran retenidos temporalmente hasta que ellos aprueben su verificación KYC.</p>
                </div>
                <div class="ranking-position" style="color: #F59E0B; font-weight: bold;">${n(t)} ${g}</div>
                <div style="text-align: right; margin-top: 6px;">
                    <a href="referrals.html" style="font-size: 0.8rem; color: #F59E0B; text-decoration: none; font-weight: 600; opacity: 0.95;">Ver Referidos →</a>
                </div>
            </div>
        `}function A(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-spendable-blue" style="color: #e83e8c; font-weight: bold;">Disponible para Donaciones <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px; color: #e83e8c;">ⓘ</i></span>
                </div>
                <div id="tooltip-spendable-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE IOU recibios por registrarte y tareas realizadas que puedes donar de inmediato. Si no tienes KYC, la donación queda en espera.</p>
                </div>
                <div class="ranking-position" style="color: #e83e8c; font-weight: bold;">${n(t)} ${g}</div>
            </div>
        `}function C(t){if(!t.rank_position||!t.rank_total)return"";const e=`#${t.rank_position} de ${f(t.rank_total)}`,o=t.rank_percentile?`Top ${t.rank_percentile}%`:"";return`
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-ranking">Ranking Mundial <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px;">ⓘ</i></span>
                </div>
                <div id="tooltip-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición entre todos los impulsores activos de la plataforma.</p>
                </div>
                <div class="ranking-position">${e}</div>
                ${o?`<div class="ranking-subtitle">${o}</div>`:""}
            </div>
        `}function H(t){if(!t.friends_rank_position||!t.friends_rank_total)return"";const e=`#${t.friends_rank_position} de ${f(t.friends_rank_total)}`,o=t.friends_rank_percentile?`Top ${t.friends_rank_percentile}%`:"";return`
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-friends-ranking">Ranking entre amigos <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px;">ⓘ</i></span>
                </div>
                <div id="tooltip-friends-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición frente a las personas que invitaste con tu código de referido.</p>
                </div>
                <div class="ranking-position">${e}</div>
                ${o?`<div class="ranking-subtitle">${o}</div>`:""}
            </div>
        `}function z(t){if(t.daily_today==null||t.daily_yesterday==null)return"";const e=Number(t.daily_today)||0,o=Number(t.daily_yesterday)||0,s=o>0?Math.min(e/o*100,100):e>0?100:0,i=e-o;return`
            <div class="booster-stat-block booster-summary-card booster-daily-goal">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-daily-goal">Meta diaria (hoy vs ayer) <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px;">ⓘ</i></span>
                </div>
                <div id="tooltip-daily-goal" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Compara tus ganancias de hoy vs ayer. Supéralas diariamente para mejorar tu ranking.</p>
                </div>
                <div class="daily-goal-value">${n(e)} hoy</div>
                <div class="daily-goal-bar"><div class="daily-goal-fill" style="width: ${s}%;"></div></div>
                <div class="ranking-subtitle">Ayer: ${n(o)} | Diferencia: ${N(i)}</div>
                ${t.daily_improved?'<div class="daily-goal-reward">🎉 ¡Mejoraste tu día anterior!</div>':""}
            </div>
        `}function I(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-tasks">Tareas de Impulsor Completadas <i class="info-icon" style="font-size: 0.85rem; font-style: normal; opacity: 0.7; margin-left: 4px;">ⓘ</i></span>
                </div>
                <div id="tooltip-tasks" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Cantidad de tareas de plataforma que has completado como impulsor.</p>
                </div>
                <div class="ranking-position">${f(t)}</div>
            </div>
        `}function D(t,e,o,s){if(!s||s.length===0)return"";const a=s.find(l=>l.level===3)?`
            <div class="booster-milestone-header">
                <div class="bonus-card-premium">
                    <span class="milestone-badge">META DE NIVEL 3</span>
                    <div class="bonus-main-info">
                        <span class="chest-icon">🎁</span>
                        <div class="bonus-text">
                            <span class="amount">+50.000<span class="decimal-part">0000</span> <span class="unit">BLUE iou</span></span>
                        </div>
                    </div>
                    <p class="bonus-desc">Activable por tareas completadas o verificación de identidad de tus referidos.</p>
                </div>
            </div>
        `:"",d=[...s].sort((l,m)=>m.level-l.level).map((l,m)=>{const b=l.level<e.level,y=l.level===e.level;let c=b?"completed":y?"active":"locked";const h=parseFloat(l.min_blue_required),F=h===0?"START":`${n(h)} <span class="unit">BLUE iou</span>`,j=l.name.replace(/IMPULSOR/gi,"").trim();return`
                <div class="staircase-step ${c}" style="z-index: ${m};">
                    <div class="step-base">
                        <span class="step-requirement">${F}</span>
                        <div class="step-label">
                            <span class="step-number">${String(l.level).padStart(2,"0")}</span>
                            ${j}
                        </div>
                    </div>
                </div>
            `}).join(""),v=o?parseFloat(o.min_blue_required)-t:0;return`
            <div class="progress-section">
                <h3 class="section-title-premium">BOOSTER RANKING SYSTEM</h3>
                
                ${a}

                <div class="staircase-wrapper">
                    <div class="staircase-container">
                        ${d}
                    </div>
                </div>

                <div class="progress-footer-premium">
                    <div class="footer-stat-group">
                        <span class="stat-label">TOTAL BLUE iou ACUMULADO</span>
                        <span class="stat-value highlight">${n(t)} <span class="unit">BLUE iou</span></span>
                    </div>
                    ${o?`<div class="footer-stat-group align-right">
                                <span class="stat-label">SIGUIENTE NIVEL IMPULSOR: ${o.name}</span>
                                <span class="stat-value progress">FALTAN ${n(v)} <span class="unit">BLUE iou</span></span>
                           </div>`:`<div class="footer-stat-group align-right">
                                <span class="stat-label">RANGO ALCANZADO</span>
                                <span class="stat-value max">NIVEL MÁXIMO</span>
                           </div>`}
                </div>
            </div>
        `}function P(t){return!t||t.length===0?`
                <div class="history-section">
                    <h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Ganancias <i class="info-icon" style="font-size: 1rem; font-style: normal; opacity: 0.7; margin-left: 4px; vertical-align: middle;">ⓘ</i></h2>
                    <div id="tooltip-history" class="info-tooltip" role="tooltip" aria-hidden="true">
                        <p>Registro detallado de tus ganancias como impulsor.</p>
                    </div>
                    <p class="empty-message">Aún no hay actividades registradas.</p>
                </div>
            `:`
            <div class="history-section">
                <h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Ganancias <i class="info-icon" style="font-size: 1rem; font-style: normal; opacity: 0.7; margin-left: 4px; vertical-align: middle;">ⓘ</i></h2>
                <div id="tooltip-history" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Registro detallado de tus ganancias como impulsor.</p>
                </div>
                <div class="history-table-wrapper">
                    <table id="booster-history-table">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${t.map(o=>{const s=Number(o.amount)||0,i=s>=0?"+":"−",a=Math.abs(s),r=(o.description||"").toString(),d=r.startsWith("Backfill:")?"Ajuste de saldo histórico":r||"(Sin descripción)";return`
                <tr>
                    <td>${new Date(o.created_at).toLocaleDateString("es-ES")}</td>
                    <td>${k(d)}</td>
                    <td class="saldo-blue-text">${i}${n(a)}</td>
                </tr>
            `}).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `}function n(t){const o=(Number(t)||0).toFixed(4),[s,i]=o.split(".");return`${s.replace(/\B(?=(\d{3})+(?!\d))/g,".")}, <span class="decimal-part">${i}</span>`}function f(t){return Number(t||0).toLocaleString("es-ES")}function N(t){const e=Number(t)||0;return`${e>0?"+":""}${n(e)} `}function R(){[{trigger:'[data-tooltip-id="tooltip-booster-level"]',tooltip:"#tooltip-booster-level"},{trigger:'[data-tooltip-id="tooltip-total-blue"]',tooltip:"#tooltip-total-blue"},{trigger:'[data-tooltip-id="tooltip-available-blue"]',tooltip:"#tooltip-available-blue"},{trigger:'[data-tooltip-id="tooltip-pending-blue"]',tooltip:"#tooltip-pending-blue"},{trigger:'[data-tooltip-id="tooltip-spendable-blue"]',tooltip:"#tooltip-spendable-blue"},{trigger:'[data-tooltip-id="tooltip-daily-goal"]',tooltip:"#tooltip-daily-goal"},{trigger:'[data-tooltip-id="tooltip-ranking"]',tooltip:"#tooltip-ranking"},{trigger:'[data-tooltip-id="tooltip-friends-ranking"]',tooltip:"#tooltip-friends-ranking"},{trigger:'[data-tooltip-id="tooltip-tasks"]',tooltip:"#tooltip-tasks"},{trigger:'[data-tooltip-id="tooltip-progress"]',tooltip:"#tooltip-progress"},{trigger:'[data-tooltip-id="tooltip-history"]',tooltip:"#tooltip-history"}].forEach(({trigger:e,tooltip:o})=>{document.querySelector(e)&&document.querySelector(o)&&G(e,o)})}function q(){const t=document.getElementById("unlockConditionsModalOverlay"),e=document.getElementById("unlockModalAccept");t&&(setTimeout(()=>{t.style.display="flex",t.offsetWidth,t.classList.add("show")},500),e&&e.addEventListener("click",()=>{t.classList.remove("show"),setTimeout(()=>{t.style.display="none"},400)}),window.addEventListener("click",o=>{o.target===t&&(t.classList.remove("show"),setTimeout(()=>{t.style.display="none"},400))}))}function O(t){const e=["#f5d76e","#6a5acd","#2ecc71","#ffffff"];for(let s=0;s<14;s++){const i=document.createElement("span"),a=6+Math.random()*5,r=Math.random()*Math.PI*2,d=40+Math.random()*70;i.className="firework-particle",i.style.width=`${a} px`,i.style.height=`${a} px`,i.style.background=e[s%e.length],i.style.setProperty("--fx-x",`${Math.cos(r)*d} px`),i.style.setProperty("--fx-y",`${Math.sin(r)*d} px`),i.style.animationDelay=`${Math.random()*.4} s`,t.appendChild(i),setTimeout(()=>i.remove(),4200)}}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",$):$();
//# sourceMappingURL=boosterProfile.NhPDh73O.js.map
