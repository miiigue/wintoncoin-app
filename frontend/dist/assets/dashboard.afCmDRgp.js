import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                     */import{l as ke,e as X,a as Bt}from"./index.Dk_Cx65J.js";import{r as U,i as kt,a as Tt}from"./pushManager.C2effs3l.js";import{g as Te,h as A}from"./auth.PfzP10z-.js";import{showCustomAlert as g,showCustomConfirm as ee}from"./alerts.CawRDXDp.js";import{g as F,f as It,a as Ct}from"./config.Br4uoD7s.js";function D(c,d=1e3){if(!!!document.getElementById("global-app-interstitial"))setTimeout(c,d);else{console.log("[Onboarding] Modal detectado, posponiendo tour hasta que el usuario lo cierre...");const t=()=>{console.log("[Onboarding] Modal cerrado, iniciando tour..."),window.removeEventListener("winton_interstitial_closed",t),setTimeout(c,d)};window.addEventListener("winton_interstitial_closed",t)}}function _t(){const c=new URLSearchParams(window.location.search),d=c.get("start_tour"),r=c.get("start_wallet_tour");if(d==="true"){localStorage.removeItem("wintoncoin_tour_completed");const t=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:t},"",t),D(()=>{le()},1e3)}else if(r==="true"){sessionStorage.setItem("pendingWalletTour","true");const t=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:t},"",t),D(()=>{Mt()},1500)}else if(new URLSearchParams(window.location.search).get("start_burn_tour")==="true"){sessionStorage.setItem("pendingWalletTour","true");const t=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:t},"",t),D(()=>{$t()},1500)}else if(new URLSearchParams(window.location.search).get("start_publish_tour")==="true"){const t=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:t},"",t),D(()=>{At()},500)}else if(new URLSearchParams(window.location.search).get("start_task_tour")==="true"){const t=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:t},"",t),D(()=>{Dt()},1500)}else localStorage.getItem("wintoncoin_tour_completed")||D(()=>{le()},1500)}function Lt(){_t()}function Mt(){if(!window.driver||!window.driver.js){console.error("Driver.js no está cargado");return}document.body.classList.add("wallet-tour-active"),setTimeout(()=>{const r=document.getElementById("tabBilletera");r&&r.click(),sessionStorage.removeItem("pendingWalletTour")},50);const c=window.driver.js.driver,d=c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:r=>{r&&(r.style.setProperty("pointer-events","none","important"),r.addEventListener("click",h,{capture:!0}),r.addEventListener("mousedown",h,{capture:!0}),r.addEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.setProperty("pointer-events","none","important")))},onDeselected:r=>{r&&(r.style.pointerEvents="",r.removeEventListener("click",h,{capture:!0}),r.removeEventListener("mousedown",h,{capture:!0}),r.removeEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.pointerEvents=""))},onDestroyStarted:()=>{document.body.classList.remove("wallet-tour-active"),sessionStorage.removeItem("suppressWalletModal");const r=document.querySelector(".driver-active-element");r&&(r.style.pointerEvents="",r.removeEventListener("click",h,{capture:!0}));const t=document.getElementById("prelaunchWalletModal");t&&(t.style.display="none");const p=document.getElementById("burnModal");p&&(p.style.display="none"),d.destroy()},steps:[{element:"#tabBilletera",popover:{title:"👛 Tu Billetera",description:"Aquí gestionas tus fondos reales (BLUE y RED).",side:"bottom",align:"center"}},{element:".blue-section",popover:{title:"🔵 Saldo BLUE",description:"Este es tu dinero disponible. Úsalo para pagar, comprar, ahorrar o eliminar tu deuda RED.",side:"bottom",align:"start"}},{element:".red-section",popover:{title:"🔴 Saldo RED (Deuda)",description:"Es tu deuda pendiente. Recuerda quemarla con BLUE antes de su vencimiento.",side:"bottom",align:"start"}},{element:"#burnTriggerBtn",popover:{title:"🔥 Quemar Tokens",description:"Si tienes deuda, toca este botón para abrir la ventana de pagos.",side:"top",align:"center"}}]});d.drive()}function $t(){if(!window.driver||!window.driver.js)return;document.body.classList.add("wallet-tour-active"),setTimeout(()=>{const r=document.getElementById("tabBilletera");r&&r.click(),sessionStorage.removeItem("pendingWalletTour"),setTimeout(()=>{const t=document.getElementById("burnTriggerBtn");t&&t.click()},100)},50);const c=window.driver.js.driver,d=c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:r=>{r&&(r.style.setProperty("pointer-events","none","important"),r.addEventListener("click",h,{capture:!0}),r.addEventListener("mousedown",h,{capture:!0}),r.addEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.setProperty("pointer-events","none","important")))},onDeselected:r=>{r&&(r.style.pointerEvents="",r.removeEventListener("click",h,{capture:!0}),r.removeEventListener("mousedown",h,{capture:!0}),r.removeEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.pointerEvents=""))},onDestroyStarted:()=>{document.body.classList.remove("wallet-tour-active"),sessionStorage.removeItem("suppressWalletModal");const r=document.querySelector(".driver-active-element");r&&(r.style.pointerEvents="",r.removeEventListener("click",h,{capture:!0}));const t=document.getElementById("burnModal");t&&(t.style.display="none");const p=document.getElementById("prelaunchWalletModal");p&&(p.style.display="none"),d.destroy()},steps:[{element:"#burnModalBalances",popover:{title:"📊 Resumen de Saldos",description:"Aquí verás tus balances disponibles actualizados.",side:"bottom",align:"center"}},{element:"#burnAmount",popover:{title:"📝 Cantidad a Pagar",description:"Escribe aquí cuántos tokens RED quieres eliminar.",side:"top",align:"center"}},{element:"#burnForm .burn-button",popover:{title:"✅ Confirmar",description:"Presiona el botón para ejecutar la quema. ¡Es irreversible!",side:"top",align:"center"}}]});setTimeout(()=>{d.drive()},500)}function h(c){return c.preventDefault(),c.stopPropagation(),c.stopImmediatePropagation(),!1}function le(){if(!window.driver||!window.driver.js){console.error("Driver.js no está cargado");return}const c=window.driver.js.driver,d=c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡A empezar!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:r=>{r&&(r.style.setProperty("pointer-events","none","important"),r.addEventListener("click",h,{capture:!0}),r.addEventListener("mousedown",h,{capture:!0}),r.addEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.setProperty("pointer-events","none","important")))},onDeselected:r=>{r&&(r.style.pointerEvents="",r.removeEventListener("click",h,{capture:!0}),r.removeEventListener("mousedown",h,{capture:!0}),r.removeEventListener("touchstart",h,{capture:!0}),r.querySelectorAll("*").forEach(p=>p.style.pointerEvents=""))},steps:[{element:".main-title-container",popover:{title:"¡Bienvenido a WintonCoin!",description:"WintonCoin es el <b>Primer Marketplace Universal</b>. Una economía de intercambio real donde usas <b>BLUE</b> para pagar y <b>RED</b> para financiarte.",side:"bottom",align:"center"}},{element:".header-menu",popover:{title:"⚙️ Tu Panel de Control",description:"Aquí accedes al <b>P2P</b>, <b>Historial</b>, <b>Perfil de Impulsor</b> y otras funciones.",side:"bottom",align:"center"}},{element:"#boosterSummary",popover:{title:"⭐ Tu Progreso",description:"Toca este banner para ver tu <b>desempeño y BLUE iou acumulado</b> en la etapa pre-lanzamiento.",side:"bottom",align:"center"}},{element:".referral-card",popover:{title:"🤝 Comparte y Gana",description:"Toca aquí para enviar tu código. <b>Ambos ganan recompensa al registrarse.</b>",side:"top",align:"center"}},{element:".main-actions-container",popover:{title:"📢 Publicar",description:"¿Necesitas un servicio? ¿Vendes un producto? Toca aquí para publicar lo que se te ocurra.",side:"bottom",align:"center"}},{element:"#publications-list",popover:{title:"💼 Mercado de Tareas",description:"Aquí aparecen las ofertas de la comunidad. <b>Completa tareas para ganar BLUE</b> o compra lo que necesites.",side:"top",align:"center"}}],onDestroyStarted:()=>{const r=document.querySelector(".driver-active-element");r&&(r.style.pointerEvents=""),d.destroy(),localStorage.setItem("wintoncoin_tour_completed","true")}});d.drive()}function Pt(){localStorage.removeItem("wintoncoin_tour_completed"),le()}function At(){if(!window.driver||!window.driver.js)return;const c=document.getElementById("publicationTypeModal");c&&(c.style.display="flex",c.style.zIndex="10000");const d=window.driver.js.driver,r=d({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:t=>{t&&t.style.setProperty("pointer-events","none","important")},onDeselected:t=>{t&&(t.style.pointerEvents="")},onDestroyStarted:()=>{c&&(c.style.display="none"),r.destroy()},steps:[{element:"#publicationTypeModal .modal-content h2",popover:{title:"📢 Crear Nueva Publicación",description:"Aquí puedes elegir qué tipo de interacción quieres iniciar en el mercado.",side:"bottom",align:"center"}},{element:"#publicationTypeModal .modal-option-button.request",popover:{title:"🙋‍♂️ Solicitar Ayudante",description:"Elige esta opción si necesitas contratar a alguien. <b>Pagarás con BLUE</b> (o generarás deuda RED si no tienes dinero).",side:"top",align:"center"}},{element:"#publicationTypeModal .modal-option-button.sell",popover:{title:"💼 Vender u Ofrecer",description:"Elige esta opción para ofrecer tus habilidades, productos o monedas. <b>Ganarás BLUE</b>.",side:"top",align:"center"}},{element:"#publicationTypeModal .modal-option-button.donation",popover:{title:"🙏 Recibir Donaciones",description:"Exclusivo para causas benéficas o emergencias reales. La comunidad podrá apoyarte con BLUE.",side:"top",align:"center"}}]});setTimeout(()=>{r.drive()},500)}function Dt(){if(!window.driver||!window.driver.js)return;((d,r=8e3)=>new Promise(t=>{if(document.querySelector(d))return t(document.querySelector(d));const p=new MutationObserver(B=>{document.querySelector(d)&&(t(document.querySelector(d)),p.disconnect())});p.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{p.disconnect(),t(null)},r)}))(".publication-item").then(d=>{if(!d){console.warn("No se encontraron publicaciones para el tour.");return}d.scrollIntoView({behavior:"smooth",block:"center"}),setTimeout(()=>{qt(d)},800)})}function qt(c){const d=window.driver.js.driver,r="driver-tour-highlight-"+Date.now();c.classList.add(r);const t=d({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:p=>{p&&p.style.setProperty("pointer-events","none","important")},onDeselected:p=>{p&&(p.style.pointerEvents="")},onDestroyStarted:()=>{c.classList.remove(r),t.destroy()},steps:[{element:`.${r}`,popover:{title:"📝 Tarjeta de Tarea",description:"Cada recuadro representa una oportunidad de intercambio (tarea, venta o donación).",side:"bottom",align:"center"}},{element:`.${r} .publication-header h3`,popover:{title:"📌 Título",description:"Indica qué se necesita hacer o qué se está ofreciendo.",side:"bottom",align:"start"}},{element:`.${r} .cost-ribbon-right`,popover:{title:"💰 Recompensa / Costo",description:"La cantidad de <b>BLUE</b> involucrada en la transacción.",side:"right",align:"center"}},{element:`.${r} .pub-meta`,popover:{title:"👤 Autor y Reputación",description:"Muestra quién publicó. Las <b>estrellas</b> indican su confiabilidad basada en tratos anteriores.",side:"top",align:"start"}},{element:`.${r} .slots-info`,popover:{title:"🔢 Cupos",description:"Indica cuántas vacantes quedan disponibles para participar.",side:"top",align:"end"}}]});t.drive()}const Nt=`
.notification-gate-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;      /* Fallback para navegadores viejos */
    height: 100dvh;     /* Altura dinámica exacta para móviles */
    background-color: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(5px);
    z-index: 99999;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 0;         /* Quitamos padding del contenedor padre */
    box-sizing: border-box;
    font-family: 'Poppins', sans-serif;
    animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.gate-content {
    background: white;
    padding: 30px;
    border-radius: 24px;
    max-width: 90%;      /* Ancho responsivo */
    width: 380px;        /* Ancho ideal */
    margin: 20px;        /* Margen de seguridad contra bordes */
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
    border: 1px solid rgba(0,0,0,0.05);
    box-sizing: border-box;
}

.gate-icon {
    font-size: 48px;
    margin-bottom: 15px;
    display: block;
    animation: float 3s ease-in-out infinite;
}

@keyframes float {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
    100% { transform: translateY(0px); }
}

.gate-title {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #333;
}

.gate-text {
    font-size: 15px;
    line-height: 1.5;
    margin-bottom: 25px;
    color: #666;
}

.gate-btn {
    background: #4F46E5; /* Soft Indigo */
    color: white;
    border: none;
    padding: 12px 30px;
    font-size: 16px;
    font-weight: 500;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    width: 100%;
    box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2);
}

.gate-btn:hover {
    background: #4338ca;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(79, 70, 229, 0.3);
}

.gate-refresh-link {
    margin-top: 15px;
    font-size: 13px;
    color: #999;
    cursor: pointer;
    text-decoration: underline;
    background: none;
    border: none;
}
`;let T=null;function Ht(){return new Promise(c=>{const d=document.createElement("style");d.innerText=Nt,document.head.appendChild(d),zt()?c():T=c})}function zt(){if(!("Notification"in window))return!0;const c=Notification.permission;return c==="granted"?(j(),U(),!0):(Ie(c==="denied"),!1)}let S=0,R=[];const Rt=[{title:"Ayúdanos a protegerte 🛡️",text:"Las notificaciones son <strong>indispensables</strong> para la seguridad de tu cuenta.<br><br>Parece que están bloqueadas en este navegador.",img:"assets/images/tutorial/intro_security.png",icon:"🛡️"},{title:"Paso 1: Toca el Candado",text:"En la barra de dirección (arriba), toca el icono del <strong>Candado 🔒</strong> o Ajustes.",img:"assets/images/tutorial/step1_lock.png",icon:"🔒"},{title:"Paso 2: Permisos",text:"En el menú que se abre, busca y selecciona <strong>'Permisos'</strong> (icono 🎛️ o ⚙️).",img:"assets/images/tutorial/step2_permissions.png",icon:"🎛️"},{title:"Paso 3: Activar",text:"Busca 'Notificaciones' y <strong>Activa el interruptor</strong> 🟢.",img:"assets/images/tutorial/step3_toggle.png",icon:"🔔"}],Ut=[{title:"Ayúdanos a protegerte 🛡️",text:"Siendo una App segura, necesitamos notificaciones para confirmar tus operaciones.<br><br>Sigue estos pasos para activarlas en tu móvil.",img:"assets/images/tutorial/intro_pwa.png",icon:"📱"},{title:"Paso 1: Presiona el Icono",text:"Ve al inicio y busca el icono de <strong>WintonCoin</strong>. <strong>Mantenlo presionado por 2 segundos</strong>.",img:"assets/images/tutorial/step1_pwa_icon.png",icon:"👆"},{title:"Paso 2: Info de App",text:"En el menú que aparece, toca el círculo con la <strong>(i)</strong> o <strong>'Info. de la aplicación'</strong>.",img:"assets/images/tutorial/step2_pwa_info.png",icon:"ℹ️"},{title:"Paso 3: Activar",text:"Entra en <strong>'Notificaciones'</strong> y <strong>enciende el interruptor</strong> 🟢.",img:"assets/images/tutorial/step3_pwa_toggle.png",icon:"🔔"}];function Ie(c){if(document.querySelector(".notification-gate-overlay"))return;if(!c){jt();return}R=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0?Ut:Rt,Ft()}function jt(){const c=document.createElement("div");c.className="notification-gate-overlay",c.innerHTML=`
        <div class="gate-content">
            <span class="gate-icon">🔔</span>
            <h2 class="gate-title">Activar Notificaciones</h2>
            <p class="gate-text">Recibe actualizaciones importantes sobre tu cuenta en tiempo real.</p>
            <button class="gate-btn" id="gate-action-btn">Continuar</button>
        </div>
    `,document.body.appendChild(c),document.body.style.overflow="hidden",document.getElementById("gate-action-btn").addEventListener("click",async()=>{await Ot()})}function Ft(){const c=document.createElement("div");c.className="notification-gate-overlay";const d=`
        <style>
            .gate-wizard-img-container {
                width: 100%;
                height: 160px;
                background: #f0f2f5;
                border-radius: 12px;
                margin-bottom: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
            }
            .gate-wizard-img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .gate-wizard-placeholder {
                font-size: 50px;
                opacity: 0.3;
            }
            .gate-dots {
                display: flex;
                justify-content: center;
                gap: 6px;
                margin-bottom: 20px;
            }
            .gate-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #e0e0e0;
                transition: all 0.3s ease;
            }
            .gate-dot.active {
                background: #4F46E5;
                width: 24px;
                border-radius: 4px;
            }
            .gate-nav {
                display: flex;
                gap: 12px;
            }
            .gate-btn-secondary {
                background: #f3f4f6;
                color: #4b5563;
                border: none;
                padding: 12px 20px;
                font-size: 16px;
                font-weight: 500;
                border-radius: 12px;
                cursor: pointer;
                flex: 1;
            }
        </style>
    `;c.innerHTML=`
        ${d}
        <div class="gate-content">
            <div id="wizard-step-container">
                <!-- Inyectado por JS -->
            </div>
            
            <div class="gate-dots" id="wizard-dots">
                <!-- Dots dinámicos -->
            </div>

            <div class="gate-nav">
                <button class="gate-btn-secondary" id="wizard-prev" style="display:none">Atrás</button>
                <button class="gate-btn" id="wizard-next">Siguiente</button>
            </div>
            
            <div id="gate-msg" style="margin-top:15px; font-size:12px; color:#666; display:none"></div>
        </div>
    `,document.body.appendChild(c),document.body.style.overflow="hidden",S=0,se(),document.getElementById("wizard-next").addEventListener("click",()=>{S<R.length-1?(S++,se()):Wt()}),document.getElementById("wizard-prev").addEventListener("click",()=>{S>0&&(S--,se())}),"permissions"in navigator&&navigator.permissions.query({name:"notifications"}).then(r=>{r.onchange=()=>{r.state==="granted"&&(j(),U(),T&&T())}}).catch(()=>{})}function se(){const c=R[S],d=document.getElementById("wizard-step-container"),r=document.getElementById("wizard-dots"),t=document.getElementById("wizard-next"),p=document.getElementById("wizard-prev");d.innerHTML=`
        <div class="gate-wizard-img-container">
            <img src="${c.img}" class="gate-wizard-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div class="gate-wizard-placeholder" style="display:none">${c.icon}</div>
        </div>
        <h2 class="gate-title">${c.title}</h2>
        <p class="gate-text" style="min-height: 50px;">${c.text}</p>
    `,r.innerHTML=R.map((B,x)=>`<div class="gate-dot ${x===S?"active":""}"></div>`).join(""),p.style.display=S===0?"none":"block",S===0?(t.textContent="Mostrarme cómo",t.style.background="#4F46E5"):S===R.length-1?(t.textContent="Ya las habilité",t.style.background="#10B981"):(t.textContent="Siguiente",t.style.background="#4F46E5")}async function Wt(){let c=Notification.permission;try{c=await Notification.requestPermission()}catch(r){console.warn("Permission check failed",r)}if(c==="granted"){j(),await U(),T&&T();return}const d=document.getElementById("wizard-next");d&&(d.textContent="Continuando..."),console.log("Forzando cierre del tutorial (Usuario dice activado)"),j(),U().catch(()=>{}),T&&T()}async function Ot(){try{await Notification.requestPermission()==="granted"?(j(),await U(),T&&T()):(document.querySelector(".notification-gate-overlay").remove(),Ie(!0))}catch(c){console.error("Error:",c)}}function j(){const c=document.querySelector(".notification-gate-overlay");c&&c.remove(),document.body.style.overflow=""}function Vt(){const c=document.getElementById("settingsModal"),d=document.getElementById("openSettingsModal"),r=document.getElementById("closeSettingsModal"),t=document.getElementById("saveNotificationSettings");if(!c||!d||!r||!t){console.warn("[NotificationSettings] Required elements not found");return}d.addEventListener("click",async p=>{p.preventDefault(),await Gt(),c.style.display="block"}),r.addEventListener("click",()=>{c.style.display="none"}),window.addEventListener("click",p=>{p.target===c&&(c.style.display="none")}),t.addEventListener("click",async()=>{await Jt()})}async function Gt(){const c=F(),d=Te();if(!d){g("Debes iniciar sesión para acceder a la configuración.");return}try{const r=await fetch(`${c}/api/notifications/settings`,{method:"GET",headers:{Authorization:`Bearer ${d}`}});if(!r.ok)throw new Error("Error al cargar preferencias");const t=await r.json();document.getElementById("notifSecuritySwitch").checked=!0,document.getElementById("notifSocialSwitch").checked=t.social!==!1,document.getElementById("notifMarketingSwitch").checked=t.marketing!==!1}catch(r){console.error("[NotificationSettings] Load error:",r),g("No se pudieron cargar las preferencias de notificaciones.")}}async function Jt(){const c=F(),d=Te();if(!d){g("Debes iniciar sesión para guardar la configuración.");return}try{const r=document.getElementById("notifSocialSwitch").checked,t=document.getElementById("notifMarketingSwitch").checked,p=await fetch(`${c}/api/notifications/settings`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${d}`},body:JSON.stringify({settings:{social:r,marketing:t}})});if(!p.ok)throw new Error("Error al guardar preferencias");const B=await p.json();g("✅ Preferencias guardadas correctamente"),setTimeout(()=>{document.getElementById("settingsModal").style.display="none"},1500)}catch(r){console.error("[NotificationSettings] Save error:",r),g("❌ No se pudieron guardar las preferencias. Inténtalo de nuevo.")}}async function Qt(){if(sessionStorage.getItem("winton_global_modal_shown")!=="true")try{const c=await fetch(`${F()}/api/interstitial/global`);if(!c.ok)return;const d=await c.json();d.enabled&&d.message&&(Yt(d.title,d.message),sessionStorage.setItem("winton_global_modal_shown","true"))}catch(c){console.error("[Interstitials] Error initializing global modal:",c)}}function Yt(c,d){const r="global-app-interstitial",t=document.getElementById(r);t&&t.remove();const p=document.createElement("div");p.id=r,p.className="interstitial-overlay",p.innerHTML=`
        <div class="interstitial-container">
            <div class="interstitial-header">
                <div class="interstitial-icon-circle">
                    <span class="interstitial-icon">💡</span>
                </div>
                <h2>${c}</h2>
            </div>
            <div class="interstitial-body">
                <p>${d.replace(/\n/g,"<br>")}</p>
            </div>
            <div class="interstitial-footer">
                <button id="close-interstitial-btn" class="interstitial-action-btn">Entendido</button>
            </div>
        </div>
    `;const B=`
        .interstitial-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.4s ease;
        }
        .interstitial-container {
            background: #121926;
            width: 90%;
            max-width: 450px;
            border-radius: 24px;
            padding: 32px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            text-align: center;
            animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .interstitial-header h2 {
            color: #fff;
            margin: 16px 0 8px 0;
            font-size: 24px;
            font-weight: 800;
        }
        .interstitial-icon-circle {
            width: 64px;
            height: 64px;
            background: rgba(11, 95, 255, 0.15);
            border-radius: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto;
        }
        .interstitial-icon {
            font-size: 32px;
        }
        .interstitial-body {
            color: #94a3b8;
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 32px;
        }
        .interstitial-action-btn {
            width: 100%;
            padding: 16px;
            background: #0B5FFF;
            color: white;
            border: none;
            border-radius: 14px;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .interstitial-action-btn:hover {
            background: #004ecc;
            transform: translateY(-2px);
            box-shadow: 0 10px 15px -3px rgba(11, 95, 255, 0.4);
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
    `,x=document.createElement("style");x.innerText=B,document.head.appendChild(x),document.body.appendChild(p),document.getElementById("close-interstitial-btn").addEventListener("click",()=>{p.style.opacity="0",p.style.transition="opacity 0.3s ease",setTimeout(()=>{p.remove(),window.dispatchEvent(new CustomEvent("winton_interstitial_closed"))},300)})}window.getApiUrl=F;window.showCustomAlert=g;window.showCustomConfirm=ee;window.linkify=ke;window.fetchAndStoreAppSettings=It;window.appSettings=Ct;window.restartTour=Pt;console.log("[ContractInteraction] ES Module loaded");document.addEventListener("DOMContentLoaded",()=>{function c(e){const n=(Number(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),i=n.split(",");return i.length===2?`${i[0]},<span class="decimal-part">${i[1]}</span>`:n}const d=F(),r=localStorage.getItem("username"),t={usernameDisplay:document.getElementById("usernameDisplay"),profileTrigger:document.querySelector(".profile-trigger"),profileDropdown:document.getElementById("profileDropdown"),notificationTrigger:document.querySelector(".notification-trigger"),notificationDropdown:document.getElementById("notificationDropdown"),notificationBadge:document.getElementById("notificationBadge"),logoutLink:document.getElementById("logoutLink"),publicationsList:document.getElementById("publications-list"),publicationFilterChips:document.getElementById("publicationFilterChips"),publicationSortSelect:document.getElementById("publicationSortSelect"),publicationSearchInput:document.getElementById("publicationSearchInput"),publicationSearchClear:document.getElementById("publicationSearchClear"),saldoBlue:document.getElementById("saldoBlue"),saldoRed:document.getElementById("saldoRed"),ratingModal:document.getElementById("ratingModal"),ratingForm:document.getElementById("ratingForm"),publicationTypeModal:document.getElementById("publicationTypeModal"),openPublicationModalBtn:document.getElementById("openPublicationModalBtn"),closePublicationTypeModalBtn:document.querySelector(".publication-type-close"),debtCountdownContainer:document.getElementById("debt-countdown-container"),debtCountdownText:document.getElementById("debt-countdown-text"),escrowCountdownContainer:document.getElementById("escrow-countdown-container"),escrowCountdownText:document.getElementById("escrow-countdown-text"),availableCountdownContainer:document.getElementById("available-countdown-container"),availableCountdownText:document.getElementById("available-countdown-text"),publicationsCount:document.getElementById("publicationsCount"),boosterSummary:document.getElementById("boosterSummary"),boosterTotalBlue:document.getElementById("boosterTotalBlue"),boosterProgressText:document.getElementById("boosterProgressText"),boosterProgressFill:document.getElementById("boosterProgressFill"),tabImpulsor:document.getElementById("tabImpulsor"),tabBilletera:document.getElementById("tabBilletera"),panelImpulsor:document.getElementById("panelImpulsor"),panelBilletera:document.getElementById("panelBilletera"),createPostPrelaunchModal:document.getElementById("createPostPrelaunchModal"),createPostPrelaunchAccept:document.getElementById("createPostPrelaunchAccept"),myWalletAddressContainer:document.getElementById("myWalletAddressContainer"),myWalletAddressText:document.getElementById("myWalletAddressText"),copyMyWalletBtn:document.getElementById("copyMyWalletBtn")};let p=null,B=null,x=null,ce=0,de=0,W=null,ue=[];const O=new Map;let te="all",oe="active",I="",pe=null,C={requires_terms_acceptance:!1,pending_documents:[]};if(!r){g("Debes iniciar sesión para acceder a esta página.",()=>{window.location.href="index.html"});return}t.usernameDisplay&&(t.usernameDisplay.textContent=r);function me(e){["openPublicationModalBtn","openQuickSaleModalBtn"].forEach(n=>{const i=document.getElementById(n);i&&(i.disabled=!!e,i.style.opacity=e?"0.55":"",i.style.cursor=e?"not-allowed":"",e?i.title="Debes aceptar los documentos legales vigentes para habilitar esta acción.":i.removeAttribute("title"))})}function fe(){const e=document.getElementById("legal-acceptance-banner");if(!C.requires_terms_acceptance){e&&e.remove(),me(!1);return}C.pending_documents.map(i=>i.type==="terms_and_conditions"?"Términos y Condiciones":i.type==="privacy_policy"?"Política de Privacidad":i.type).join(", ");const o=e||document.createElement("div");o.id="legal-acceptance-banner",o.style.background="#fff3cd",o.style.color="#5f370e",o.style.border="1px solid #ffe69c",o.style.borderRadius="10px",o.style.padding="12px",o.style.margin="12px auto",o.style.maxWidth="1200px",o.innerHTML=`
            <strong>Actualizamos nuestros términos.</strong>
            Revisa y acepta para seguir operando.
            <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                <a href="terms.html" target="_blank" rel="noopener noreferrer" class="btn">Leer Términos</a>
                <a href="privacy.html" target="_blank" rel="noopener noreferrer" class="btn">Leer Privacidad</a>
                <button id="accept-legal-docs-btn" class="btn">He leído y acepto</button>
            </div>
        `,e||(document.querySelector(".container")||document.body).prepend(o);const n=document.getElementById("accept-legal-docs-btn");n&&(n.onclick=async()=>{const i=localStorage.getItem("token");if(i){if(!Array.isArray(C.pending_documents)||C.pending_documents.length===0){g("No se encontraron documentos pendientes para aceptar. Recarga la página o contacta soporte.");return}n.disabled=!0,n.textContent="Registrando aceptación...";try{const a=await fetch(`${d}/api/legal/accept`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${i}`},body:JSON.stringify({acceptedDocuments:C.pending_documents})}),l=await a.json();if(!a.ok)throw new Error(l.message||"No se pudo registrar la aceptación legal.");C={requires_terms_acceptance:!!l.requires_terms_acceptance,pending_documents:l.pending_documents||[]},fe(),g("Aceptación legal registrada correctamente. Ya puedes operar con normalidad.")}catch(a){console.error("[Legal] Error al aceptar documentos:",a),g(a.message||"No se pudo registrar la aceptación legal.")}finally{const a=document.getElementById("accept-legal-docs-btn");a&&(a.disabled=!1,a.textContent="He leído y acepto")}}}),me(!0)}async function Ce(){const e=localStorage.getItem("token");if(e)try{const o=await fetch(`${d}/api/legal/status`,{headers:{Authorization:`Bearer ${e}`}});if(!o.ok)throw new Error("No se pudo verificar el estado legal.");const n=await o.json();C={requires_terms_acceptance:!!n.requires_terms_acceptance,pending_documents:n.pending_documents||[]},fe()}catch(o){console.error("[Legal] Error consultando estado legal:",o)}}t.saldoBlue&&(t.saldoBlue.innerHTML=c(localStorage.getItem("blue_balance"))),t.saldoRed&&(t.saldoRed.innerHTML=c(localStorage.getItem("red_balance"))),Ce(),_(),Pe(),He(),ne(),gt(),ht(),$e(),kt(),Vt(),Tt(),qe(),Ht().then(()=>Qt()).then(()=>Ne()).then(()=>{setTimeout(Lt,500)});const _e=1e4;let q=null;function ge(){q||(q=setInterval(_,_e))}function Le(){q&&(clearInterval(q),q=null)}function Me(){document.hidden?Le():(_(),ge())}document.addEventListener("visibilitychange",Me),ge();async function V(){if(W)return W;try{const e=await fetch(`${d}/api/platform-settings`);if(!e.ok)throw new Error("No se pudo cargar la configuración.");return W=await e.json(),W}catch(e){return console.error(e),{pre_launch_mode_enabled:!1,allow_request_publications:!0,allow_sell_publications:!0,allow_donation_publications:!0}}}async function $e(){const e=localStorage.getItem("token");if(e)try{const o=await fetch(`${d}/api/momentum/profile`,{headers:{Authorization:`Bearer ${e}`}});if(o.ok){const n=await o.json();if(n&&n.username===r&&n.tier!=="PENDIENTE"&&n.tier!=="RECHAZADO"){const i=document.getElementById("momentumMenuLink");i&&(i.style.display="block")}}}catch(o){console.error("[Momentum] Error checking profile status:",o)}}async function ne(){const e=await V(),o=document.getElementById("publicationTypeModal");if(!o)return;const n=o.querySelector(".modal-option-button.request"),i=o.querySelector(".modal-option-button.sell"),a=o.querySelector(".modal-option-button.donation"),l=(u,m,f)=>{if(u)if(u.classList.toggle("disabled",!m),!m)u.style.cursor="not-allowed";else{u.style.cursor="pointer";const b=u.cloneNode(!0);u.parentNode.replaceChild(b,u),b.addEventListener("click",E=>{E.preventDefault(),setTimeout(()=>{f==="donation"&&e.pre_launch_mode_enabled?window.location.href="solicitud-solidaria.html":window.location.href=`publish.html?type=${f}`},50)})}};l(n,e.allow_request_publications,"request"),l(i,e.allow_sell_publications,"sell"),l(a,e.allow_donation_publications,"donation");const s=document.getElementById("openQuickSaleModalBtn");s&&(s.style.display=e.allow_quick_sale_publications===!1?"none":"inline-flex")}function _(){he(),ve(),ae(),bt(),wt()}window.loadAllData=_;function Pe(){const e=(o,n)=>{!o||!n||o.addEventListener("click",i=>{i.stopPropagation();const a=!n.classList.contains("show");ye(),a&&n.classList.toggle("show")})};e(t.profileTrigger,t.profileDropdown),e(t.notificationTrigger,t.notificationDropdown)}function ye(){t.profileDropdown&&t.profileDropdown.classList.remove("show"),t.notificationDropdown&&t.notificationDropdown.classList.remove("show")}function Ae(){const e=document.getElementById("prelaunchWalletModal");e&&(e.style.display="flex")}function De(){const e=document.getElementById("prelaunchWalletModal");e&&(e.style.display="none")}function G(e){const{tabImpulsor:o,tabBilletera:n,panelImpulsor:i,panelBilletera:a}=t;o&&o.classList.toggle("active",e==="impulsor"),n&&n.classList.toggle("active",e==="billetera"),i&&i.classList.toggle("active",e==="impulsor"),a&&a.classList.toggle("active",e==="billetera"),e==="billetera"&&(sessionStorage.getItem("suppressWalletModal")==="true"||Ae()),localStorage.setItem("walletActiveTab",e)}function qe(){const{tabImpulsor:e,tabBilletera:o}=t,n=document.getElementById("prelaunchModalAccept");e&&e.addEventListener("click",()=>G("impulsor")),o&&o.addEventListener("click",()=>G("billetera")),n&&n.addEventListener("click",De)}function Ne(){return new Promise(e=>{V().then(o=>{const n=o?.pre_launch_mode_enabled===!0||o?.pre_launch_mode_enabled==="true",a=new URLSearchParams(window.location.search).get("start_wallet_tour")==="true",l=sessionStorage.getItem("pendingWalletTour")==="true";let s="billetera";a||l?(l&&sessionStorage.setItem("suppressWalletModal","true"),s="billetera"):n?s="impulsor":s=localStorage.getItem("walletActiveTab")||"billetera",G(s);const u=document.getElementById("prelaunchWalletModal"),m=document.getElementById("prelaunchModalAccept");if(s==="billetera"&&u&&u.style.display!=="none"&&m){const f=()=>{m.removeEventListener("click",f),e()};m.addEventListener("click",f)}else e()}).catch(o=>{console.warn("[WalletTabs] Error inicializando, default a Impulsor:",o),G("impulsor"),e()})})}function He(){window.addEventListener("click",ye),t.logoutLink&&t.logoutLink.addEventListener("click",je),t.copyMyWalletBtn&&t.copyMyWalletBtn.addEventListener("click",function(){const e=this.dataset.address;e&&navigator.clipboard.writeText(e).then(()=>{const o=this.innerHTML;this.innerHTML='<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>',setTimeout(()=>{this.innerHTML=o},2e3)}).catch(o=>{console.error("Error al copiar la billetera: ",o)})}),t.publicationsList&&t.publicationsList.addEventListener("click",Fe),t.publicationFilterChips&&t.publicationFilterChips.addEventListener("click",ze),t.publicationSortSelect&&t.publicationSortSelect.addEventListener("change",N),t.publicationSearchInput&&t.publicationSearchInput.addEventListener("input",Re),t.publicationSearchClear&&t.publicationSearchClear.addEventListener("click",Ue),t.ratingForm&&t.ratingForm.addEventListener("submit",Oe),t.openPublicationModalBtn&&t.openPublicationModalBtn.addEventListener("click",async e=>{e.preventDefault(),(await V()).pre_launch_mode_enabled&&t.createPostPrelaunchModal?t.createPostPrelaunchModal.style.display="flex":(ne(),t.publicationTypeModal&&(t.publicationTypeModal.style.display="flex"))}),t.createPostPrelaunchAccept&&t.createPostPrelaunchAccept.addEventListener("click",()=>{t.createPostPrelaunchModal&&(t.createPostPrelaunchModal.style.display="none"),ne(),t.publicationTypeModal&&(t.publicationTypeModal.style.display="flex")}),t.closePublicationTypeModalBtn&&t.closePublicationTypeModalBtn.addEventListener("click",()=>{t.publicationTypeModal&&(t.publicationTypeModal.style.display="none")}),window.addEventListener("click",e=>{e.target===t.ratingModal&&t.ratingModal&&(t.ratingModal.style.display="none"),e.target===t.publicationTypeModal&&t.publicationTypeModal&&(t.publicationTypeModal.style.display="none"),e.target===t.createPostPrelaunchModal&&t.createPostPrelaunchModal&&(t.createPostPrelaunchModal.style.display="none")}),t.notificationDropdown&&t.notificationDropdown.addEventListener("click",async e=>{const o=e.target.closest(".notification-dismiss"),n=e.target.closest(".notification-footer-link");o&&(e.preventDefault(),await st(o.dataset.id)),n&&(e.preventDefault(),await clearAllNotifications())})}async function ze(e){const o=e.target.closest(".filter-chip");if(!o||o.classList.contains("active"))return;t.publicationFilterChips.querySelectorAll(".filter-chip").forEach(i=>{i.classList.remove("active"),i.setAttribute("aria-pressed","false")}),o.classList.add("active"),o.setAttribute("aria-pressed","true"),te=o.dataset.filter;const n=te==="hidden"?"hidden":"active";n!==oe?(oe=n,await he()):N()}function Re(){clearTimeout(pe),pe=setTimeout(()=>{I=(t.publicationSearchInput?.value||"").trim().toLowerCase(),t.publicationSearchClear&&(t.publicationSearchClear.style.display=I?"flex":"none"),N()},250)}function Ue(){t.publicationSearchInput&&(t.publicationSearchInput.value=""),t.publicationSearchClear&&(t.publicationSearchClear.style.display="none"),I="",N()}function je(e){e.preventDefault(),localStorage.removeItem("username"),localStorage.removeItem("blue_balance"),localStorage.removeItem("escrow_blue_balance"),localStorage.removeItem("red_balance"),localStorage.removeItem("token"),g("Has cerrado la sesión.",()=>{window.location.href="index.html"})}async function Fe(e){const o=e.target.closest("[data-action]");if(!o)return;const n=o.dataset.id,i=o.dataset.action,a=o.dataset.user;let l,s={};switch(i){case"accept":l=`/publications/${n}/accept`,s={acceptorUsername:r},await k(l,s);break;case"approve":l=`/publications/${n}/approve`,s={approverUsername:r,userToApprove:a},await k(l,s);break;case"complete":l=`/publications/${n}/complete`,s={completerUsername:r},await k(l,s);break;case"confirm-payment":const m=o.closest(".publication-item")?.dataset.author;await We(n,m,a);break;case"delete":ee("¿Deseas eliminar esta tarea?",async()=>{await Ve(`/publications/${n}`,{deleterUsername:r})});break;case"discard":ee(`¿Descartar solicitud de ${a}?`,async()=>{await k(`/publications/${n}/discard`,{discarderUsername:r,userToDiscard:a})});break;case"toggle-pause":await k(`/publications/${n}/toggle-pause`,{username:r});break;case"hide":await k(`/publications/${n}/hide`,{username:r});break}}async function We(e,o,n){try{const i=localStorage.getItem("token"),a={"Content-Type":"application/json"};i&&(a.Authorization=`Bearer ${i}`);const l=await fetch(`${d}/publications/${e}/confirm-payment`,{method:"POST",headers:a,body:JSON.stringify({confirmerUsername:r,workerUsername:n})}),s=await l.json();l.ok?(g(s.message),_(),mt(e,o,n)):g(s.message||"Error al confirmar el pago.")}catch(i){console.error("Error en confirmPaymentAndRate:",i),g("Error de red al confirmar el pago.")}}async function Oe(e){e.preventDefault();const o=new FormData(e.target),n=Object.fromEntries(o.entries());try{await k("/rate",n),t.ratingModal&&(t.ratingModal.style.display="none")}catch(i){console.error("La calificación falló.",i)}}async function k(e,o,n={}){const{silent:i=!1,reload:a=!0}=n;try{const l=localStorage.getItem("token"),s={"Content-Type":"application/json"};l&&(s.Authorization=`Bearer ${l}`);const u=await fetch(`${d}${e}`,{method:"POST",headers:s,body:JSON.stringify(o)});if(A(u))return null;const m=await u.text();let f;try{f=JSON.parse(m)}catch{throw console.error("Respuesta no-JSON:",m),g(m||"Error inesperado."),new Error("Respuesta no-JSON")}if(!u.ok)throw g(f.message||`Error: ${u.status}`),new Error(f.message);return!i&&f.message&&g(f.message),u.ok&&a&&_(),f}catch(l){return console.error(`Error en postToServer (${e}):`,l),Promise.reject(l)}}async function Ve(e,o){try{const n=localStorage.getItem("token"),i={"Content-Type":"application/json"};n&&(i.Authorization=`Bearer ${n}`);const a=await fetch(`${d}${e}`,{method:"DELETE",headers:i,body:JSON.stringify(o)}),l=await a.json();g(l.message),a.ok&&_()}catch(n){console.error("Error en deleteFromServer:",n),g("Error de red al eliminar.")}}async function he(){if(t.publicationsList)try{const e=await fetch(`${d}/publications/${oe}?user=${r}`);if(!e.ok){t.publicationsList.innerHTML="<p>Error al cargar las publicaciones.</p>";return}const o=await e.json();if(o.length===0){t.publicationsList.innerHTML=`
                    <div class="empty-state-container">
                        <div class="empty-state-icon">🚀</div>
                        <h3>¡El mercado está tranquilo!</h3>
                        <p>Es el momento perfecto para definir la economía.</p>
                        <button onclick="document.getElementById('openPublicationModalBtn').click()" class="action-button primary-action pulse-animation">
                            Crear la Primera Publicación
                        </button>
                    </div>
                `,ie([]);return}ue=o,O.clear(),await N()}catch(e){console.error("Error al obtener publicaciones:",e),t.publicationsList.innerHTML="<p>No se pudo conectar con el servidor.</p>"}}async function N(){if(!t.publicationsList)return;const e=Qe(ue);if(e.length===0){t.publicationsList.innerHTML='<p class="empty-message">No hay publicaciones para este filtro.</p>',ie([]);return}ie(e);const o=await V(),n=e.map(l=>l.author_username).filter(l=>!O.has(l)),i=[...new Set(n)];i.length>0&&(await Promise.all(i.map(s=>Je(s).then(u=>({username:s,data:u}))))).forEach(({username:s,data:u})=>O.set(s,u));const a=e.map(l=>{const s=O.get(l.author_username)||{average:0,count:0},u=Ge(s.average,s.count),m=et(l,o);return nt(l,m,u)});t.publicationsList.innerHTML=a.join("")}function Ge(e,o){if(o===0)return'<span class="no-rating">Sin calificaciones</span>';const n=Math.floor(e),i=e%1>=.5?1:0,a=5-n-i;let l="";for(let s=0;s<n;s++)l+="★";i&&(l+="½");for(let s=0;s<a;s++)l+="☆";return`<span class="stars">${l}</span> <span class="rating-count">(${o})</span>`}async function Je(e){try{const o=await fetch(`${d}/user/${e}`);if(!o.ok)return console.warn(`Could not fetch rating for user ${e}. Status: ${o.status}`),{average:0,count:0};const n=await o.json();return{average:n.average_rating,count:n.ratings_count}}catch(o){return console.error(`Error fetching rating for ${e}:`,o),{average:0,count:0}}}function Qe(e){const o=te,n=t.publicationSortSelect?.value||"recent";let i=[...e];return I&&(i=i.filter(a=>{const l=(a.title||"").toLowerCase(),s=(a.description||"").toLowerCase(),u=(a.author_username||"").toLowerCase();return l.includes(I)||s.includes(I)||u.includes(I)})),o==="pending"?i=i.filter(a=>Ye(a)):(o==="request"||o==="sell"||o==="donation")&&(i=i.filter(a=>Ke(a)===o)),n==="recent"||n==="oldest"?i.sort((a,l)=>{const s=we(l)-we(a);return n==="recent"?s:-s}):(n==="reward_desc"||n==="reward_asc")&&i.sort((a,l)=>{const s=(Number(l.blue_cost)||0)-(Number(a.blue_cost)||0);return n==="reward_desc"?s:-s}),Ze(i)}function Ye(e){const o=e.user_acceptance_status;return!!(o==="approved"||o==="pending_approval"||o==="completed"||e.author_username===r&&e.participants&&e.participants.some(i=>i.status==="pending_approval"||i.status==="completed"))}function be(e){if(e.author_username===r&&e.participants&&e.participants.length>0){const i=e.participants.some(l=>l.status==="pending_approval"),a=e.participants.some(l=>l.status==="completed");if(i)return 0;if(a)return 1}const n=e.user_acceptance_status;return n==="approved"?2:n==="pending_approval"?3:n==="completed"?4:5}function Ze(e){return[...e].sort((o,n)=>be(o)-be(n))}function Ke(e){return e.category==="donation"?"donation":e.is_sell_post?"sell":"request"}function we(e){const o=e.created_at||e.createdAt,n=o?new Date(o):null;return n&&!Number.isNaN(n.getTime())?n.getTime():Number(e.id)||0}function ie(e){t.publicationsCount&&(t.publicationsCount.textContent=String((e||[]).length))}function Xe(e,o){const n=String(o?.platform_username||"Plataforma WintonCoin").toLowerCase(),i=String(e.author_username||"").toLowerCase();return i===n||i==="plataforma"}function et(e,o){return o?.pre_launch_mode_enabled&&Xe(e,o)?"BLUE iou":"BLUE"}function tt(e){if(e.author_username===r&&e.participants&&e.participants.length>0){const l=e.participants.filter(u=>u.status==="pending_approval").length,s=e.participants.filter(u=>u.status==="completed").length;if(l>0||s>0){const u=[];return l>0&&u.push(`${l} por aprobar`),s>0&&u.push(`${s} por pagar`),`<div class="publication-status-banner status-author-action">${u.join(" · ")}</div>`}}const n=e.user_acceptance_status;let i="",a="";return n==="approved"?(e.is_sell_post?i="Pendiente pago":i="Puedes comenzar!",a="status-approved"):n==="completed"?(e.is_sell_post,i="Esperando confirmación",a="status-completed"):n==="pending_approval"&&(i="Esperando aprobación",a="status-pending"),i?`<div class="publication-status-banner ${a}">${i}</div>`:""}function ot(e){if(!e.expires_at)return{html:"",isExpired:!1};const o=new Date,i=new Date(e.expires_at)-o;if(i<=0)return{html:'<div class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</div>',isExpired:!0};const a=Math.floor(i/(1e3*60*60*24)),l=Math.floor(i%(1e3*60*60*24)/(1e3*60*60)),s=Math.floor(i%(1e3*60*60)/(1e3*60));let u="";return a>1?u=`Vence en ${a} días`:a===1?u=`Vence en ${a} día`:l>1?u=`Vence en ${l} horas`:l===1?u=`Vence en ${l} hora`:s>0?u=`Vence en ${s} min`:u="Vence en <1 min",{html:`<div class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${u}</div>`,isExpired:!1}}function nt(e,o,n=""){const i=e.category==="donation",a=i?`Meta: ${c(e.goal_amount)} ${o}`:`${c(e.blue_cost)} ${o}`,l=tt(e);let s="";e.is_booster_task?s="booster-ribbon":i?s="donation-ribbon":e.is_sell_post&&(s="sell-ribbon");const u=e.available_slots>0?"available":"full",m=i?"Campaña Activa":e.available_slots>0?`${e.available_slots} cupos`:"Cupos agotados",f=ot(e),b=X(e.author_username),E=Bt(e.author_username),v=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(e.author_username)}" class="profile-link" onclick="event.stopPropagation()">${b}</a>`:b;let w="";if(i){const z=parseFloat(e.current_amount||0),L=parseFloat(e.goal_amount||0),M=L>0?Math.min(100,Math.floor(z/L*100)):0;w=`
                <div class="donation-progress-container">
                    <div class="donation-progress-labels">
                        <span>${c(z)} BLUE recaudados</span>
                        <span>${M}%</span>
                    </div>
                    <div class="donation-progress-bar">
                        <div class="donation-progress-fill" style="width: ${M}%"></div>
                    </div>
                </div>
            `}const y=`<h3>${X(e.title)}</h3>`;return`
            <a href="publication-detail.html?id=${e.id}" class="publication-item-link">
                <div class="publication-item ${f.isExpired?"expired":""} ${i?"donation-card":""}" data-id="${e.id}" data-author="${E}">
                    
                    <div class="card-top-row ${l?"has-status":""}">
                        <button class="card-close-btn" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('hide', ${e.id})">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                        
                        ${l}

                        <div class="cost-ribbon-right ${s}">${a}</div>
                    </div>

                    <div class="publication-header">
                        ${y}
                    </div>
                    
                    ${w}

                    <p class="pub-description">${ke(e.description?.slice(0,150)||"")}</p>
                    


                    <div class="publication-footer">
                        <div class="pub-meta">
                            <span>Por: <strong>${v}</strong></span>
                            ${n}
                        </div>
                        <div class="pub-meta-right">
                            <div class="slots-info ${u}">${m}</div>
                            ${f.html}
                        </div>
                    </div>
                </div>
            </a>
        `}window.handleDirectDonation=async function(e,o){const n=document.getElementById(`don-input-${e}`),i=parseFloat(n?.value);if(!i||i<=0||isNaN(i)){g("⚠️ Por favor, ingresa un monto válido para donar.");return}const a=`¿Deseas donar ${i} BLUE a ${o}?

Esta acción generará una deuda RED equivalente en tu cuenta según el modelo económico de WintonCoin.`;ee(a,async()=>{try{const l=localStorage.getItem("token"),s=await fetch(`${d}/publications/${e}/accept`,{method:"POST",headers:{"Content-Type":"application/json",...l&&{Authorization:`Bearer ${l}`}},body:JSON.stringify({acceptorUsername:r,donationAmount:i})});if(A(s))return;const u=await s.json();s.ok?g(u.message||"¡Donación procesada con éxito!",()=>{window.loadAllData()}):g(u.message||"Error al procesar la donación.")}catch(l){console.error("Error en donación:",l),g("Error de red al procesar la donación.")}})},window.handleCardAction=async function(e,o){e==="hide"&&await it(o)};async function it(e){try{const o=document.querySelector(`.publication-item[data-id="${e}"]`);if(!o)return;const n=o.closest(".publication-item-link");if(n){n.style.transition="all 0.3s ease",n.style.opacity="0",n.style.transform="scale(0.9)";const a=setTimeout(()=>{n.style.display="none"},300);n.dataset.hideTimeout=a}(await fetch(`${d}/publications/${e}/hide`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({username:localStorage.getItem("username")})})).ok?rt("Publicación oculta","DESHACER",async()=>{await at(e)}):(console.error("Error al ocultar en servidor"),n&&(n.dataset.hideTimeout&&(clearTimeout(Number(n.dataset.hideTimeout)),delete n.dataset.hideTimeout),n.style.display="",setTimeout(()=>{n.style.opacity="1",n.style.transform="scale(1)"},50)))}catch(o){console.error("Error de red al ocultar:",o),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload()}}async function at(e){try{const n=document.querySelector(`.publication-item[data-id="${e}"]`)?.closest(".publication-item-link");n&&(n.dataset.hideTimeout&&(clearTimeout(Number(n.dataset.hideTimeout)),delete n.dataset.hideTimeout),n.style.display="",n.offsetWidth,n.style.opacity="1",n.style.transform="scale(1)"),(await fetch(`${d}/publications/${e}/unhide`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({username:localStorage.getItem("username")})})).ok?n||typeof window.loadAllData=="function"&&window.loadAllData():(console.error("Error en servidor al deshacer"),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload())}catch(o){console.error("Error al deshacer:",o),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload()}}function rt(e,o,n){const i=document.getElementById("toast-notification");i&&i.remove();const a=document.createElement("div");if(a.id="toast-notification",a.className="toast-notification",a.innerHTML=`
            <span>${e}</span>
            ${`<button id="toast-action" type="button">${o}</button>`}
        `,document.body.appendChild(a),a.offsetWidth,a.classList.add("show"),n){const l=document.getElementById("toast-action");l.onclick=s=>{s.preventDefault(),s.stopPropagation(),n(),a.classList.remove("show"),setTimeout(()=>a.remove(),300)}}setTimeout(()=>{document.body.contains(a)&&(a.classList.remove("show"),setTimeout(()=>{document.body.contains(a)&&a.remove()},300))},7e3)}async function ve(){try{const e=localStorage.getItem("token"),o=await fetch(`${d}/api/me/notifications`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(A(o))return;if(!o.ok)throw new Error("Error al cargar notificaciones.");const n=await o.json(),i=document.getElementById("notificationDropdown");if(!i)return;if(i.innerHTML="",n.length===0)i.innerHTML=`
                    <div class="notification-header-actions">
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                    <div class="no-notifications">No tienes notificaciones nuevas.</div>
                `;else{const a=document.createElement("div");a.className="notification-header-actions-container",a.innerHTML=`
                    <div class="notification-footer-actions">
                        <button class="noti-action-link" onclick="window.clearAllNotifications()">Limpiar</button>
                        <span class="noti-divider">|</span>
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                `,i.appendChild(a),n.forEach(l=>{const s=document.createElement("div");s.className="notification-item",s.dataset.id=l.id,s.innerHTML=`
                        <p>${X(l.message)}</p>
                        <span class="notification-dismiss" data-id="${l.id}" title="Descartar">&times;</span>
                    `,i.appendChild(s)})}J(n.length)}catch(e){console.error(e.message),J(0)}}function J(e){t.notificationBadge&&(e>0?(t.notificationBadge.textContent=e,t.notificationBadge.style.display="flex"):t.notificationBadge.style.display="none")}async function st(e){const o=document.querySelector(`.notification-item[data-id='${e}']`);o&&(o.style.transition="opacity 0.3s ease",o.style.opacity="0",setTimeout(()=>{o.remove();const n=document.querySelectorAll(".notification-item").length;J(n),n===0&&ve()},300));try{await k(`/api/me/notifications/${e}/dismiss`,{},{silent:!0,reload:!1})}catch(n){console.error("Error al descartar notificación:",n)}}window.clearAllNotifications=async function(){try{if((await k("/api/me/notifications/mark-read",{},{silent:!0,reload:!1})).success){const o=document.getElementById("notificationDropdown");o&&(o.innerHTML=`
                    <div class="notification-header-actions">
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                    <div class="no-notifications">No tienes notificaciones nuevas.</div>
                `),J(0)}}catch(e){console.error("Error al limpiar notificaciones:",e)}},window.openNotificationHistory=async function(){try{const e=localStorage.getItem("token"),o=await fetch(`${d}/api/me/notifications/history`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(!o.ok)throw new Error("No se pudo cargar el historial.");const n=await o.json();lt(n)}catch(e){console.error("Error al abrir historial:",e),g("No se pudo cargar el historial de notificaciones.")}};function lt(e){const o=document.getElementById("notificationHistoryModal");o&&o.remove();const n=document.createElement("div");n.id="notificationHistoryModal",n.className="custom-modal",n.style.display="flex";let i="";e.length===0?i='<p class="empty-history">Aún no tienes notificaciones en tu historial.</p>':i=e.map(a=>{const l=new Date(a.created_at).toLocaleString();let s="🔔",u="";const m=a.message.toLowerCase();return m.includes("aprobada")||m.includes("has sido aprobado")||m.includes("🎉")||m.includes("✅")?(s="✅",u="noti-success"):m.includes("rechazada")||m.includes("error")||m.includes("⚠️")||m.includes("❌")?(s="⚠️",u="noti-warning"):m.includes("pagada")||m.includes("acreditado")||m.includes("ganado")||m.includes("💰")?(s="💰",u="noti-money"):(m.includes("quiere participar")||m.includes("solicitud")||m.includes("📩"))&&(s="📩",u="noti-request"),`
                    <div class="history-noti-item ${a.is_read?"is-read":"is-unread"} ${u}">
                        <div class="history-noti-icon">${s}</div>
                        <div class="history-noti-content">
                            <p>${X(a.message)}</p>
                            <span class="history-noti-date">${l}</span>
                        </div>
                    </div>
                `}).join(""),n.innerHTML=`
            <div class="custom-modal-content history-modal">
                <div class="custom-modal-header">
                    <h2>Historial de Notificaciones</h2>
                    <span class="custom-modal-close" onclick="document.getElementById('notificationHistoryModal').remove()">&times;</span>
                </div>
                <div class="custom-modal-body history-body">
                    <div class="history-list">
                        ${i}
                    </div>
                </div>
                <div class="custom-modal-footer">
                    <button class="action-button-admin secondary" onclick="document.getElementById('notificationHistoryModal').remove()">Cerrar</button>
                </div>
            </div>
        `,document.body.appendChild(n)}async function ae(){try{const e=localStorage.getItem("token"),o=await fetch(`${d}/api/me/balance?t=${new Date().getTime()}`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(A(o))return;if(o.ok){const n=await o.json();if(t.saldoBlue&&(t.saldoBlue.innerHTML=c(n.blue_balance)),t.saldoRed&&(t.saldoRed.innerHTML=c(n.red_balance)),localStorage.setItem("blue_balance",n.blue_balance),localStorage.setItem("escrow_blue_balance",n.escrow_blue_balance),localStorage.setItem("red_balance",n.red_balance),localStorage.setItem("penalized_debt",n.penalized_debt),ct(n),n.web3_wallet_address&&t.myWalletAddressContainer&&t.myWalletAddressText&&t.copyMyWalletBtn){const i=n.web3_wallet_address,a=i.substring(0,8)+"..."+i.substring(i.length-6);t.myWalletAddressText.textContent=a,t.copyMyWalletBtn.dataset.address=i,t.myWalletAddressContainer.style.display="flex"}}}catch(e){console.error("Error al obtener saldos:",e)}}function ct(e){e.next_available_at&&parseFloat(e.next_available_amount)>0&&t.availableCountdownContainer?(t.availableCountdownContainer.style.display="block",dt(e.next_available_at,e.next_available_amount)):t.availableCountdownContainer&&(t.availableCountdownContainer.style.display="none"),e.next_due_at&&parseFloat(e.next_due_amount)>0&&t.debtCountdownContainer?(t.debtCountdownContainer.style.display="block",ut(e.next_due_at,e.next_due_amount)):t.debtCountdownContainer&&(t.debtCountdownContainer.style.display="none"),e.next_unlock_at&&parseFloat(e.next_unlock_amount)>0&&t.escrowCountdownContainer?(t.escrowCountdownContainer.style.display="block",pt(e.next_unlock_at,e.next_unlock_amount)):t.escrowCountdownContainer&&(t.escrowCountdownContainer.style.display="none")}function dt(e,o){x&&clearInterval(x);const n=c(o),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){t.availableCountdownContainer&&(t.availableCountdownContainer.style.display="none"),clearInterval(x),x=null,ae();return}const u=re(s);t.availableCountdownText&&(t.availableCountdownText.innerHTML=`Próxima liberación <strong class="saldo-blue-text">${n}</strong> en <strong>${u}</strong>`)};i(),x=setInterval(i,1e3)}function ut(e,o){p&&clearInterval(p);const n=c(o),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){t.debtCountdownText&&(t.debtCountdownText.innerHTML=`<strong class="expired">URGENTE! ${n} VENCIDOS!</strong>`),clearInterval(p);return}const u=re(s);t.debtCountdownText&&(t.debtCountdownText.innerHTML=`próximo vencimiento <strong class="saldo-red-text">${n}</strong> en <strong>${u}</strong>`)};i(),p=setInterval(i,1e3)}function pt(e,o){B&&clearInterval(B);const n=c(o),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){t.escrowCountdownContainer&&(t.escrowCountdownContainer.style.display="none"),clearInterval(B),ae();return}const u=re(s);t.escrowCountdownText&&(t.escrowCountdownText.innerHTML=`Disponible <strong class="saldo-blue-text">${n}</strong> en <strong>${u}</strong>`)};i(),B=setInterval(i,1e3)}function re(e){const o=Math.floor(e/864e5),n=Math.floor(e%(1e3*60*60*24)/(1e3*60*60)),i=Math.floor(e%(1e3*60*60)/(1e3*60)),a=Math.floor(e%(1e3*60)/1e3);return o>0?`${o}d y ${n}h`:n>0?`${n}h y ${i}m`:i>0?`${i}m y ${a}s`:`${a}s`}function mt(e,o,n){if(!t.ratingForm)return;t.ratingForm.reset();const i=document.getElementById("ratingPublicationId"),a=document.getElementById("ratingRaterUsername"),l=document.getElementById("ratingRateeUsername"),s=document.getElementById("ratingModalTitle");i&&(i.value=e),a&&(a.value=o),l&&(l.value=n),s&&(s.textContent=`Calificar a ${n}`),t.ratingModal&&(t.ratingModal.style.display="flex")}let Q;function ft(e){if(!e)return;let o=e.includes("T")?e:`${e}T23:59:59`;const n=new Date(o);if(isNaN(n.getTime())){console.error("Fecha de expiración inválida:",e);return}const i=document.getElementById("timer-days"),a=document.getElementById("timer-hours"),l=document.getElementById("timer-mins"),s=document.getElementById("timer-secs");if(!i||!a||!l||!s)return;Q&&clearInterval(Q);function u(){const f=n-new Date;if(f<=0){clearInterval(Q),i.textContent="00",a.textContent="00",l.textContent="00",s.textContent="00";return}const b=Math.floor(f/(1e3*60*60*24)),E=Math.floor(f%(1e3*60*60*24)/(1e3*60*60)),v=Math.floor(f%(1e3*60*60)/(1e3*60)),w=Math.floor(f%(1e3*60)/1e3);i.textContent=b.toString().padStart(2,"0"),a.textContent=E.toString().padStart(2,"0"),l.textContent=v.toString().padStart(2,"0"),s.textContent=w.toString().padStart(2,"0"),f<3*24*60*60*1e3&&[i,a,l,s].forEach(y=>y.classList.add("hot"))}u(),Q=setInterval(u,1e3)}async function gt(){try{const e=await fetch(`${d}/api/referral-settings`);if(e.ok){const o=await e.json(),n=document.getElementById("referralAmount");n&&o.referral_reward_amount&&(n.textContent=parseInt(o.referral_reward_amount)),o.referral_codes_expiry_date&&ft(o.referral_codes_expiry_date)}}catch(e){console.error("Error al cargar configuración de referidos:",e)}}async function yt(){try{const e=localStorage.getItem("username");if(!e){g("Error: No se pudo obtener tu información de usuario.");return}const[o,n]=await Promise.all([fetch(`${d}/api/users/${e}/referral-info`),fetch(`${d}/api/referral-expiry-date`)]);if(o.ok){const a=(await o.json()).referral_code,l=document.getElementById("referralAmount")?.textContent||"1000",s=`${window.location.origin}/register.html?ref=${a}`;let u="";if(n.ok)try{const f=await n.json();if(f.expiry_date){const b=new Date(f.expiry_date);isNaN(b.getTime())||(u=` (válido hasta el ${b.toLocaleDateString("es-ES",{year:"numeric",month:"long",day:"numeric"})})`)}}catch(f){console.warn("Error al formatear fecha de vigencia:",f)}const m=`Registrate en WintonCoin con mi codigo de referido y ambos ganamos ${l} BLUE IOU${u}

${a}

Recuerda que Tú ganas ${l} BLUE IOU por cada amigo que invites!

Regístrate aquí: ${s}`;navigator.share?await navigator.share({title:"¡Únete a WintonCoin!",text:m}):(await navigator.clipboard.writeText(m),g("¡Mensaje de invitación copiado! Compártelo con tus amigos."))}else g("Error al obtener tu código de referido.")}catch(e){console.error("Error al compartir código de referido:",e),g("Error al compartir el código de referido.")}}function ht(){const e=document.getElementById("shareReferralCard");e&&e.addEventListener("click",yt)}async function bt(){if(!t.boosterSummary)return;const e=Date.now();if(e-ce<6e4)return;ce=e;const o=localStorage.getItem("token");if(o)try{const n=await fetch(`${d}/api/me/booster-profile`,{headers:{Authorization:`Bearer ${o}`}});if(A(n))return;const i=await n.json();if(!n.ok||!i?.is_booster){t.boosterTotalBlue&&(t.boosterTotalBlue.innerHTML='<span class="booster-total-value">0</span> <span class="booster-total-unit">BLUE iou</span>');return}const a=Number(i.total_booster_blue||0),l=i.next_level_info,s=l?Number(l.min_blue_required||0):0;t.boosterTotalBlue&&(t.boosterTotalBlue.innerHTML=`<span class="booster-total-value">${c(a)}</span> <span class="booster-total-unit">BLUE iou</span>`);let u=100,m="Nivel máximo alcanzado";s>0&&(u=Math.min(100,a/s*100),m=`${a.toFixed(4)} / ${s.toFixed(4)} BLUE iou`),t.boosterProgressText&&(t.boosterProgressText.textContent=m),t.boosterProgressFill&&(t.boosterProgressFill.style.width=`${u}%`)}catch(n){console.error("Error al cargar el resumen de impulsor:",n)}}async function wt(){const e=document.getElementById("solidarioDashboardCard");if(!e)return;const o=Date.now();if(o-de<6e4)return;de=o;const n=localStorage.getItem("token");if(n)try{const i=document.getElementById("menuSolidarioHistory"),a=await fetch(`${d}/api/humanitarian/causes/my`,{headers:{Authorization:`Bearer ${n}`}});if(!a.ok){e.style.display="none",i&&(i.style.display="block",i.href="solicitud-solidaria.html");return}const l=await a.json();if(!l.success||!l.causes||l.causes.length===0){e.style.display="none",i&&(i.style.display="block",i.href="solicitud-solidaria.html");return}const s=l.causes.find(v=>v.status==="approved"||v.status==="pending");s?vt(e,s):e.style.display="none";const u=document.getElementById("solidarioHistoryLinkContainer"),m=document.getElementById("solidarioHistoryBtn"),f=document.getElementById("solidarioHistoryModal"),b=document.querySelector(".solidario-history-close"),E=document.getElementById("solidarioHistoryList");if(l.causes.length>0){u&&s&&(u.style.display="block");const v=w=>{w.preventDefault(),w.stopPropagation(),E.innerHTML="",l.causes.forEach((y,z)=>{const L=(parseFloat(y.current_amount)||0)+(parseFloat(y.amount_on_hold)||0),M=new Date(y.created_at).toLocaleDateString("es-ES");let $="";y.status==="completed"?$='<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Culminada</span>':y.status==="approved"?$='<span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Activa</span>':y.status==="pending"?$='<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Pendiente</span>':$=`<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${y.status}</span>`;const xt=y.status==="approved"||y.status==="completed"?`<a href="causa-solidaria.html?id=${y.id}" style="color: #e83e8c; font-size: 0.8rem; text-decoration: underline; margin-top: 5px; display: inline-block;">Ver Detalle Público</a>`:"",St=`
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <h4 style="margin:0; font-size: 0.95rem; color: #f8fafc; line-height: 1.3; max-width: 70%;">${y.title}</h4>
                                    ${$}
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8;">
                                    <span>Recaudado: <strong style="color:white;">${L.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})} BLUE</strong></span>
                                    <span>${M}</span>
                                </div>
                                ${xt}
                            </div>
                        `;E.innerHTML+=St}),f.style.display="flex"};m&&f&&b&&E&&(m.onclick=v,b.onclick=()=>{f.style.display="none"},window.addEventListener("click",w=>{w.target===f&&(f.style.display="none")})),i&&(i.style.display="block",i.href="#",i.onclick=w=>{const y=document.getElementById("profileDropdown");y&&y.classList.remove("show"),v(w)})}else u&&(u.style.display="none"),i&&(i.style.display="block",i.href="solicitud-solidaria.html",i.onclick=null)}catch(i){console.error("[Solidario] Error al cargar resumen:",i),e.style.display="none";const a=document.getElementById("menuSolidarioHistory");a&&(a.style.display="block",a.href="solicitud-solidaria.html")}}function vt(e,o){e.style.display="block",e.onclick=()=>{(o.status==="approved"||o.status==="completed")&&(window.location.href=`causa-solidaria.html?id=${o.id}`)};const n=document.getElementById("solidarioCardHeaderTitle");n&&(n.textContent=`Donación a la causa de ${r}`);const i=document.getElementById("solidarioCardCauseTitle");i&&(i.textContent=o.title);const a=parseFloat(o.current_amount)||0,l=parseFloat(o.amount_on_hold)||0,s=parseFloat(o.goal_amount)||0,u=a+l,m=s>0?Math.min(a/s*100,100):0,f=s>0?Math.min(l/s*100,100-m):0,b=document.getElementById("solidarioCardAmount"),E=document.getElementById("solidarioCardGoal"),v=document.getElementById("solidarioCardProgressFill"),w=document.getElementById("solidarioCardProgressFillHold");b&&(b.textContent=u.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})),E&&(E.textContent=s.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})),v&&(v.style.width=`${m.toFixed(1)}%`,v.style.background="",v.style.borderRadius=f>0?"6px 0 0 6px":"6px"),w&&(w.style.width=`${f.toFixed(1)}%`,w.style.borderRadius="0 3px 3px 0");const y=document.getElementById("solidarioCardShareBtn");y&&(o.status==="approved"?(y.style.opacity="1",y.style.pointerEvents="auto",y.onclick=z=>{z.stopPropagation();const L=`${window.location.origin}/causa-solidaria.html?id=${o.id}`,M=`💙 Apoya mi causa "${o.title}" en WintonCoin.

Dona tus BLUE IOU y marca la diferencia:
${L}`;if(navigator.share)navigator.share({title:`Winton Solidario: ${o.title}`,text:M,url:L}).catch(()=>{});else{const $=`https://wa.me/?text=${encodeURIComponent(M)}`;window.open($,"_blank")}}):(y.style.opacity="0.5",y.style.pointerEvents="none"))}const P=document.getElementById("quickSaleModal"),Ee=document.getElementById("openQuickSaleModalBtn"),xe=document.querySelector(".quick-sale-close"),Y=document.getElementById("quickSaleForm"),H=document.getElementById("qrCodeModal"),Se=document.querySelector(".qr-code-close"),Z=document.getElementById("qrCodeOutput"),K=document.getElementById("qrCodeUrl"),Be=document.getElementById("copyQrCodeUrl");let Et=null;Ee&&P&&Ee.addEventListener("click",e=>{e.preventDefault(),P.style.display="flex"}),xe&&xe.addEventListener("click",()=>{P.style.display="none"}),Se&&Se.addEventListener("click",()=>{H.style.display="none"}),window.addEventListener("click",e=>{e.target===P&&(P.style.display="none"),e.target===H&&(H.style.display="none")}),Y&&Y.addEventListener("submit",async e=>{e.preventDefault();const o=new FormData(Y),n={title:o.get("title"),amount:o.get("amount"),targetUsername:o.get("targetUsername"),authorUsername:r};try{const i=localStorage.getItem("token"),a=await fetch(`${d}/api/quick-sale`,{method:"POST",headers:{"Content-Type":"application/json",...i&&{Authorization:`Bearer ${i}`}},body:JSON.stringify(n)});if(A(a))return;const l=await a.json();if(a.ok){P.style.display="none",Y.reset();const s=`${window.location.origin}/publication-detail.html?id=${l.publicationId}`;Z&&(Z.innerHTML=""),typeof QRCode<"u"&&Z&&(Et=new QRCode(Z,{text:s,width:256,height:256,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H})),K&&(K.value=s),H&&(H.style.display="flex")}else g(l.message||"Error al crear la venta rápida.")}catch(i){console.error("Error en el submit de Venta Rápida:",i),g("Error de conexión al crear la venta rápida.")}}),Be&&Be.addEventListener("click",()=>{K&&(K.select(),document.execCommand("copy"),g("¡Enlace copiado al portapapeles!"))})});
//# sourceMappingURL=dashboard.afCmDRgp.js.map
