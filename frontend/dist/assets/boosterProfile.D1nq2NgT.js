import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                      */import{e as O,i as q}from"./index.Dk_Cx65J.js";import{showCustomAlert as z}from"./alerts.CawRDXDp.js";import{g as F}from"./config.Br4uoD7s.js";import{h as j}from"./auth.PfzP10z-.js";function h(){const v=F(),y=new URLSearchParams(window.location.search).get("username"),k=localStorage.getItem("username"),f=y||k,p={content:document.getElementById("booster-profile-content")};if(!f){p.content.innerHTML='<p class="error-message">No se pudo determinar el perfil a mostrar. Asegúrate de haber iniciado sesión o de que la URL sea correcta.</p>',z("No se pudo determinar qué perfil mostrar.",()=>{window.location.href="index.html"});return}$(f);async function $(t){try{const o=localStorage.getItem("token"),e=localStorage.getItem("username"),i=e&&t===e&&o,s=i?`${v}/api/me/booster-profile`:`${v}/api/users/${t}/booster-profile`,a=await fetch(s,{headers:i?{Authorization:`Bearer ${o}`}:{}});if(j(a))return;if(!a.ok){const l=await a.json();throw new Error(l.message||"Error al cargar el perfil de impulsor.")}const n=await a.json();L(n)}catch(o){console.error(o),p.content.innerHTML=`<p class="error-message">${o.message}</p>`}}function L(t){if(!t.is_booster){p.content.innerHTML=`
                <div class="booster-header"><h1>Programa de Impulsores</h1></div>
                <p class="empty-message" style="text-align: center; font-size: 1.1rem; margin: 2rem;">${t.message}<br>¡Completa tareas de la plataforma para unirte!</p>
            `;return}const{current_level_info:o,next_level_info:e,all_levels:i,total_booster_blue:s,booster_tasks_completed_count:a,transactions:n}=t,l=T(o),g=M(t,s,a||0),r=B(s,o,e,i),u=A(n);if(p.content.innerHTML=`${l}${g}${r}${u}`,H(),N(),t.daily_improved){const c=p.content.querySelector(".booster-daily-goal");c&&(c.classList.add("rank-improved"),C(c),setTimeout(()=>c.classList.remove("rank-improved"),2200))}}function T(t){const o=t?.description||"Acumula más BLUE iou para subir de nivel.";return`
            <div class="booster-header">
                <h1>${t?t.name:"Impulsor"}</h1>
                <span class="level-badge info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-booster-level">Nivel ${t?t.level:"?"}</span>
                <div class="booster-value-display" style="margin-top: 12px; font-weight: 600; font-size: 0.95rem; letter-spacing: 0.5px;">
                    <span class="shimmer-text">1 BLUE iou = 1 BLUE = 1 USD</span>
                </div>
                <div id="tooltip-booster-level" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>${o}</p>
                </div>
            </div>
        `}function M(t,o,e){const i=[_(o),S(t),x(t),E(t),w(e)].filter(Boolean);return i.length===0?"":`<div class="booster-stats booster-stats-blocks booster-summary-cards">${i.join("")}</div>`}function _(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-total-blue">Total BLUE iou Acumulado</span>
                </div>
                <div id="tooltip-total-blue" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>BLUE iou ganados por completar tareas de plataforma y referidos.</p>
                </div>
                <div class="ranking-position booster-total-highlight">${d(t)} BLUE iou</div>
            </div>
        `}function x(t){if(!t.rank_position||!t.rank_total)return"";const o=`#${t.rank_position} de ${m(t.rank_total)}`,e=t.rank_percentile?`Top ${t.rank_percentile}%`:"";return`
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-ranking">Ranking Mundial</span>
                </div>
                <div id="tooltip-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición entre todos los impulsores activos de la plataforma.</p>
                </div>
                <div class="ranking-position">${o}</div>
                ${e?`<div class="ranking-subtitle">${e}</div>`:""}
            </div>
        `}function E(t){if(!t.friends_rank_position||!t.friends_rank_total)return"";const o=`#${t.friends_rank_position} de ${m(t.friends_rank_total)}`,e=t.friends_rank_percentile?`Top ${t.friends_rank_percentile}%`:"";return`
            <div class="booster-stat-block booster-summary-card booster-ranking">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-friends-ranking">Ranking entre amigos</span>
                </div>
                <div id="tooltip-friends-ranking" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Tu posición frente a las personas que invitaste con tu código de referido.</p>
                </div>
                <div class="ranking-position">${o}</div>
                ${e?`<div class="ranking-subtitle">${e}</div>`:""}
            </div>
        `}function S(t){if(t.daily_today==null||t.daily_yesterday==null)return"";const o=Number(t.daily_today)||0,e=Number(t.daily_yesterday)||0,i=e>0?Math.min(o/e*100,100):o>0?100:0,s=o-e;return`
            <div class="booster-stat-block booster-summary-card booster-daily-goal">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-daily-goal">Meta diaria (hoy vs ayer)</span>
                </div>
                <div id="tooltip-daily-goal" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Compara tus ganancias de hoy vs ayer. Supéralas diariamente para mejorar tu ranking.</p>
                </div>
                <div class="daily-goal-value">${d(o)} hoy</div>
                <div class="daily-goal-bar"><div class="daily-goal-fill" style="width: ${i}%;"></div></div>
                <div class="ranking-subtitle">Ayer: ${d(e)} | Diferencia: ${U(s)}</div>
                ${t.daily_improved?'<div class="daily-goal-reward">🎉 ¡Mejoraste tu día anterior!</div>':""}
            </div>
        `}function w(t){return`
            <div class="booster-stat-block booster-summary-card">
                <div class="ranking-title">
                    <span class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-tasks">Tareas de Impulsor Completadas</span>
                </div>
                <div id="tooltip-tasks" class="info-tooltip" role="tooltip" aria-hidden="true">
                    <p>Cantidad de tareas de plataforma que has completado como impulsor.</p>
                </div>
                <div class="ranking-position">${m(t)}</div>
            </div>
        `}function B(t,o,e,i){if(!i||i.length===0)return"";const a=i.find(r=>r.level===3)?`
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
        `:"",l=[...i].sort((r,u)=>u.level-r.level).map((r,u)=>{const c=r.level<o.level,P=r.level===o.level;let I=c?"completed":P?"active":"locked";const b=parseFloat(r.min_blue_required),D=b===0?"START":`${d(b)} <span class="unit">BLUE iou</span>`,R=r.name.replace(/IMPULSOR/gi,"").trim();return`
                <div class="staircase-step ${I}" style="z-index: ${u};">
                    <div class="step-base">
                        <span class="step-requirement">${D}</span>
                        <div class="step-label">
                            <span class="step-number">${String(r.level).padStart(2,"0")}</span>
                            ${R}
                        </div>
                    </div>
                </div>
            `}).join(""),g=e?parseFloat(e.min_blue_required)-t:0;return`
            <div class="progress-section">
                <h3 class="section-title-premium">BOOSTER RANKING SYSTEM</h3>
                
                ${a}

                <div class="staircase-wrapper">
                    <div class="staircase-container">
                        ${l}
                    </div>
                </div>

                <div class="progress-footer-premium">
                    <div class="footer-stat-group">
                        <span class="stat-label">TOTAL BLUE iou ACUMULADO</span>
                        <span class="stat-value highlight">${d(t)} <span class="unit">BLUE iou</span></span>
                    </div>
                    ${e?`<div class="footer-stat-group align-right">
                                <span class="stat-label">SIGUIENTE NIVEL IMPULSOR: ${e.name}</span>
                                <span class="stat-value progress">FALTAN ${d(g)} <span class="unit">BLUE iou</span></span>
                           </div>`:`<div class="footer-stat-group align-right">
                                <span class="stat-label">RANGO ALCANZADO</span>
                                <span class="stat-value max">NIVEL MÁXIMO</span>
                           </div>`}
                </div>
            </div>
        `}function A(t){return!t||t.length===0?`
                <div class="history-section">
                    <h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Ganancias</h2>
                    <div id="tooltip-history" class="info-tooltip" role="tooltip" aria-hidden="true">
                        <p>Registro detallado de tus ganancias como impulsor.</p>
                    </div>
                    <p class="empty-message">Aún no hay actividades registradas.</p>
                </div>
            `:`
            <div class="history-section">
                <h2 class="info-text-clickable" role="button" tabindex="0" data-tooltip-id="tooltip-history">Historial de Ganancias</h2>
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
                            ${t.map(e=>{const i=Number(e.amount)||0,s=i>=0?"+":"−",a=Math.abs(i),n=(e.description||"").toString(),l=n.startsWith("Backfill:")?"Ajuste de saldo histórico":n||"(Sin descripción)";return`
                <tr>
                    <td>${new Date(e.created_at).toLocaleDateString("es-ES")}</td>
                    <td>${O(l)}</td>
                    <td class="saldo-blue-text">${s}${d(a)}</td>
                </tr>
            `}).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `}function d(t){const e=(Number(t)||0).toFixed(4),[i,s]=e.split(".");return`${i.replace(/\B(?=(\d{3})+(?!\d))/g,".")}, <span class="decimal-part">${s}</span>`}function m(t){return Number(t||0).toLocaleString("es-ES")}function U(t){const o=Number(t)||0;return`${o>0?"+":""}${d(o)} `}function H(){[{trigger:'[data-tooltip-id="tooltip-booster-level"]',tooltip:"#tooltip-booster-level"},{trigger:'[data-tooltip-id="tooltip-total-blue"]',tooltip:"#tooltip-total-blue"},{trigger:'[data-tooltip-id="tooltip-daily-goal"]',tooltip:"#tooltip-daily-goal"},{trigger:'[data-tooltip-id="tooltip-ranking"]',tooltip:"#tooltip-ranking"},{trigger:'[data-tooltip-id="tooltip-friends-ranking"]',tooltip:"#tooltip-friends-ranking"},{trigger:'[data-tooltip-id="tooltip-tasks"]',tooltip:"#tooltip-tasks"},{trigger:'[data-tooltip-id="tooltip-progress"]',tooltip:"#tooltip-progress"},{trigger:'[data-tooltip-id="tooltip-history"]',tooltip:"#tooltip-history"}].forEach(({trigger:o,tooltip:e})=>{document.querySelector(o)&&document.querySelector(e)&&q(o,e)})}function N(){const t=document.getElementById("unlockConditionsModalOverlay"),o=document.getElementById("unlockModalAccept");t&&(setTimeout(()=>{t.style.display="flex",t.offsetWidth,t.classList.add("show")},500),o&&o.addEventListener("click",()=>{t.classList.remove("show"),setTimeout(()=>{t.style.display="none"},400)}),window.addEventListener("click",e=>{e.target===t&&(t.classList.remove("show"),setTimeout(()=>{t.style.display="none"},400))}))}function C(t){const o=["#f5d76e","#6a5acd","#2ecc71","#ffffff"];for(let i=0;i<14;i++){const s=document.createElement("span"),a=6+Math.random()*5,n=Math.random()*Math.PI*2,l=40+Math.random()*70;s.className="firework-particle",s.style.width=`${a} px`,s.style.height=`${a} px`,s.style.background=o[i%o.length],s.style.setProperty("--fx-x",`${Math.cos(n)*l} px`),s.style.setProperty("--fx-y",`${Math.sin(n)*l} px`),s.style.animationDelay=`${Math.random()*.4} s`,t.appendChild(s),setTimeout(()=>s.remove(),4200)}}}document.readyState==="loading"?document.addEventListener("DOMContentLoaded",h):h();
//# sourceMappingURL=boosterProfile.D1nq2NgT.js.map
