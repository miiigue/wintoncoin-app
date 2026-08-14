import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              *//* empty css                     */import{l as Me}from"./index.pbqrtUCb.js";import{r as Y,i as Ct,a as It}from"./pushManager.4QVSizjR.js";import{b as Pe,s as v,g as j,c as G,f as Tt,d as Lt,e as $t,h as N,i as H,j as $e}from"./auth.BgcrufBo.js";function R(c,f=1e3){if(!!!document.getElementById("global-app-interstitial"))setTimeout(c,f);else{console.log("[Onboarding] Modal detectado, posponiendo tour hasta que el usuario lo cierre...");const d=()=>{console.log("[Onboarding] Modal cerrado, iniciando tour..."),window.removeEventListener("winton_interstitial_closed",d),setTimeout(c,f)};window.addEventListener("winton_interstitial_closed",d)}}function Mt(){const c=new URLSearchParams(window.location.search),f=c.get("start_tour"),l=c.get("start_wallet_tour");if(f==="true"){localStorage.removeItem("wintoncoin_tour_completed");const d=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:d},"",d),R(()=>{fe()},1e3)}else if(l==="true"){sessionStorage.setItem("pendingWalletTour","true");const d=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:d},"",d),R(()=>{At()},1500)}else if(new URLSearchParams(window.location.search).get("start_burn_tour")==="true"){sessionStorage.setItem("pendingWalletTour","true");const d=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:d},"",d),R(()=>{Dt()},1500)}else if(new URLSearchParams(window.location.search).get("start_publish_tour")==="true"){const d=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:d},"",d),R(()=>{zt()},500)}else if(new URLSearchParams(window.location.search).get("start_task_tour")==="true"){const d=window.location.protocol+"//"+window.location.host+window.location.pathname;window.history.replaceState({path:d},"",d),R(()=>{Nt()},1500)}else localStorage.getItem("wintoncoin_tour_completed")||R(()=>{fe()},1500)}function Pt(){Mt()}function At(){if(!window.driver||!window.driver.js){console.error("Driver.js no está cargado");return}document.body.classList.add("wallet-tour-active"),setTimeout(()=>{const l=document.getElementById("tabBilletera");l&&l.click(),sessionStorage.removeItem("pendingWalletTour")},50);const c=window.driver.js.driver;c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:l=>{l&&(l.style.setProperty("pointer-events","none","important"),l.addEventListener("click",E,{capture:!0}),l.addEventListener("mousedown",E,{capture:!0}),l.addEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.setProperty("pointer-events","none","important")))},onDeselected:l=>{l&&(l.style.pointerEvents="",l.removeEventListener("click",E,{capture:!0}),l.removeEventListener("mousedown",E,{capture:!0}),l.removeEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.pointerEvents=""))},onDestroyed:()=>{document.body.classList.remove("wallet-tour-active"),sessionStorage.removeItem("suppressWalletModal");const l=document.querySelector(".driver-active-element");l&&(l.style.pointerEvents="",l.removeEventListener("click",E,{capture:!0}));const d=document.getElementById("prelaunchWalletModal");d&&(d.style.display="none");const o=document.getElementById("burnModal");o&&(o.style.display="none")},steps:[{element:"#tabBilletera",popover:{title:"👛 Tu Billetera",description:"Aquí gestionas tus fondos reales (BLUE y RED).",side:"bottom",align:"center"}},{element:".blue-section",popover:{title:"🔵 Saldo BLUE",description:"Este es tu dinero disponible. Úsalo para pagar, comprar, ahorrar o amortizar tu compromiso RED.",side:"bottom",align:"start"}},{element:".red-section",popover:{title:"🔴 Saldo RED (Compromiso)",description:"Es tu compromiso de reciprocidad pendiente. Recuerda amortizarlo con BLUE dentro de la vigencia del ciclo.",side:"bottom",align:"start"}},{element:"#burnTriggerBtn",popover:{title:"🔥 Quemar Tokens",description:"Si tienes un compromiso activo, toca este botón para abrir la ventana de amortización.",side:"top",align:"center"}}]}).drive()}function Dt(){if(!window.driver||!window.driver.js)return;document.body.classList.add("wallet-tour-active"),setTimeout(()=>{const l=document.getElementById("tabBilletera");l&&l.click(),sessionStorage.removeItem("pendingWalletTour"),setTimeout(()=>{const d=document.getElementById("burnTriggerBtn");d&&d.click()},100)},50);const c=window.driver.js.driver,f=c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:l=>{l&&(l.style.setProperty("pointer-events","none","important"),l.addEventListener("click",E,{capture:!0}),l.addEventListener("mousedown",E,{capture:!0}),l.addEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.setProperty("pointer-events","none","important")))},onDeselected:l=>{l&&(l.style.pointerEvents="",l.removeEventListener("click",E,{capture:!0}),l.removeEventListener("mousedown",E,{capture:!0}),l.removeEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.pointerEvents=""))},onDestroyed:()=>{document.body.classList.remove("wallet-tour-active"),sessionStorage.removeItem("suppressWalletModal");const l=document.querySelector(".driver-active-element");l&&(l.style.pointerEvents="",l.removeEventListener("click",E,{capture:!0}));const d=document.getElementById("burnModal");d&&(d.style.display="none");const o=document.getElementById("prelaunchWalletModal");o&&(o.style.display="none")},steps:[{element:"#burnModalBalances",popover:{title:"📊 Resumen de Saldos",description:"Aquí verás tus balances disponibles actualizados.",side:"bottom",align:"center"}},{element:"#burnAmount",popover:{title:"📝 Cantidad a Pagar",description:"Escribe aquí cuántos tokens RED quieres eliminar.",side:"top",align:"center"}},{element:"#burnForm .burn-button",popover:{title:"✅ Confirmar",description:"Presiona el botón para ejecutar la quema. ¡Es irreversible!",side:"top",align:"center"}}]});setTimeout(()=>{f.drive()},500)}function E(c){return c.preventDefault(),c.stopPropagation(),c.stopImmediatePropagation(),!1}function fe(){if(!window.driver||!window.driver.js){console.error("Driver.js no está cargado");return}const c=window.driver.js.driver;c({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡A empezar!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:l=>{l&&(l.style.setProperty("pointer-events","none","important"),l.addEventListener("click",E,{capture:!0}),l.addEventListener("mousedown",E,{capture:!0}),l.addEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.setProperty("pointer-events","none","important")))},onDeselected:l=>{l&&(l.style.pointerEvents="",l.removeEventListener("click",E,{capture:!0}),l.removeEventListener("mousedown",E,{capture:!0}),l.removeEventListener("touchstart",E,{capture:!0}),l.querySelectorAll("*").forEach(o=>o.style.pointerEvents=""))},steps:[{element:".main-title-container",popover:{title:"¡Bienvenido a WintonCoin!",description:"WintonCoin es el <b>Primer Marketplace Universal</b>. Una economía de intercambio real donde usas <b>BLUE</b> para pagar y <b>RED</b> para financiarte.",side:"bottom",align:"center"}},{element:".header-menu",popover:{title:"⚙️ Tu Panel de Control",description:"Aquí accedes al <b>P2P</b>, <b>Historial</b>, <b>Perfil de Impulsor</b> y otras funciones.",side:"bottom",align:"center"}},{element:"#boosterSummary",popover:{title:"⭐ Tu Progreso",description:"Toca este banner para ver tu <b>desempeño y BLUE iou acumulado</b> en la etapa pre-lanzamiento.",side:"bottom",align:"center"}},{element:".referral-card",popover:{title:"🤝 Comparte y Gana",description:"Toca aquí para enviar tu código. <b>Ambos ganan recompensa al registrarse.</b>",side:"top",align:"center"}},{element:".main-actions-container",popover:{title:"📢 Publicar",description:"¿Necesitas un servicio? ¿Vendes un producto? Toca aquí para publicar lo que se te ocurra.",side:"bottom",align:"center"}},{element:"#publications-list",popover:{title:"💼 Mercado de Tareas",description:"Aquí aparecen las ofertas de la comunidad. <b>Completa tareas para ganar BLUE</b> o compra lo que necesites.",side:"top",align:"center"}}],onDestroyed:()=>{const l=document.querySelector(".driver-active-element");l&&(l.style.pointerEvents=""),localStorage.setItem("wintoncoin_tour_completed","true")}}).drive()}function qt(){localStorage.removeItem("wintoncoin_tour_completed"),fe()}function zt(){if(!window.driver||!window.driver.js)return;const c=document.getElementById("publicationTypeModal");c&&(c.style.display="flex",c.style.zIndex="10000");const f=window.driver.js.driver,l=f({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:d=>{d&&d.style.setProperty("pointer-events","none","important")},onDeselected:d=>{d&&(d.style.pointerEvents="")},onDestroyed:()=>{c&&(c.style.display="none")},steps:[{element:"#publicationTypeModal .modal-content h2",popover:{title:"📢 Crear Nueva Publicación",description:"Aquí puedes elegir qué tipo de interacción quieres iniciar en el mercado.",side:"bottom",align:"center"}},{element:"#publicationTypeModal .modal-option-button.request",popover:{title:"🙋‍♂️ Solicitar Ayudante",description:"Elige esta opción si necesitas contratar a alguien. <b>Pagarás con BLUE</b> (o generarás un compromiso RED si no tienes saldo suficiente).",side:"top",align:"center"}},{element:"#publicationTypeModal .modal-option-button.sell",popover:{title:"💼 Vender u Ofrecer",description:"Elige esta opción para ofrecer tus habilidades, productos o monedas. <b>Ganarás BLUE</b>.",side:"top",align:"center"}},{element:"#publicationTypeModal .modal-option-button.donation",popover:{title:"🙏 Recibir Donaciones",description:"Exclusivo para causas benéficas o emergencias reales. La comunidad podrá apoyarte con BLUE.",side:"top",align:"center"}}]});setTimeout(()=>{l.drive()},500)}function Nt(){if(!window.driver||!window.driver.js)return;((f,l=8e3)=>new Promise(d=>{if(document.querySelector(f))return d(document.querySelector(f));const o=new MutationObserver(T=>{document.querySelector(f)&&(d(document.querySelector(f)),o.disconnect())});o.observe(document.body,{childList:!0,subtree:!0}),setTimeout(()=>{o.disconnect(),d(null)},l)}))(".publication-item").then(f=>{if(!f){console.warn("No se encontraron publicaciones para el tour.");return}f.scrollIntoView({behavior:"smooth",block:"center"}),setTimeout(()=>{Ht(f)},800)})}function Ht(c){const f=window.driver.js.driver,l="driver-tour-highlight-"+Date.now();c.classList.add(l),f({showProgress:!0,animate:!0,allowClose:!1,overlayClickNext:!1,doneBtnText:"¡Entendido!",nextBtnText:"Siguiente →",prevBtnText:"← Anterior",progressText:"Paso {{current}} de {{total}}",onHighlightStarted:o=>{o&&o.style.setProperty("pointer-events","none","important")},onDeselected:o=>{o&&(o.style.pointerEvents="")},onDestroyed:()=>{c.classList.remove(l)},steps:[{element:`.${l}`,popover:{title:"📝 Tarjeta de Tarea",description:"Cada recuadro representa una oportunidad de intercambio (tarea, venta o donación).",side:"bottom",align:"center"}},{element:`.${l} .publication-header h3`,popover:{title:"📌 Título",description:"Indica qué se necesita hacer o qué se está ofreciendo.",side:"bottom",align:"start"}},{element:`.${l} .cost-ribbon-right`,popover:{title:"💰 Recompensa / Costo",description:"La cantidad de <b>BLUE</b> involucrada en la transacción.",side:"right",align:"center"}},{element:`.${l} .pub-meta`,popover:{title:"👤 Autor y Reputación",description:"Muestra quién publicó. Las <b>estrellas</b> indican su confiabilidad basada en tratos anteriores.",side:"top",align:"start"}},{element:`.${l} .slots-info`,popover:{title:"🔢 Cupos",description:"Indica cuántas vacantes quedan disponibles para participar.",side:"top",align:"end"}}]}).drive()}const Rt=`
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
`;let P=null;function jt(){return new Promise(c=>{const f=document.createElement("style");f.innerText=Rt,document.head.appendChild(f),Ft()?c():P=c})}function Ft(){if(!("Notification"in window))return!0;const c=Notification.permission;return c==="granted"?(Q(),Y(),!0):(Ae(c==="denied"),!1)}let I=0,J=[];const Ut=[{title:"Ayúdanos a protegerte 🛡️",text:"Las notificaciones son <strong>indispensables</strong> para la seguridad de tu cuenta.<br><br>Parece que están bloqueadas en este navegador.",img:"assets/images/tutorial/intro_security.png",icon:"🛡️"},{title:"Paso 1: Toca el Candado",text:"En la barra de dirección (arriba), toca el icono del <strong>Candado 🔒</strong> o Ajustes.",img:"assets/images/tutorial/step1_lock.png",icon:"🔒"},{title:"Paso 2: Permisos",text:"En el menú que se abre, busca y selecciona <strong>'Permisos'</strong> (icono 🎛️ o ⚙️).",img:"assets/images/tutorial/step2_permissions.png",icon:"🎛️"},{title:"Paso 3: Activar",text:"Busca 'Notificaciones' y <strong>Activa el interruptor</strong> 🟢.",img:"assets/images/tutorial/step3_toggle.png",icon:"🔔"}],Wt=[{title:"Ayúdanos a protegerte 🛡️",text:"Siendo una App segura, necesitamos notificaciones para confirmar tus operaciones.<br><br>Sigue estos pasos para activarlas en tu móvil.",img:"assets/images/tutorial/intro_pwa.png",icon:"📱"},{title:"Paso 1: Presiona el Icono",text:"Ve al inicio y busca el icono de <strong>WintonCoin</strong>. <strong>Mantenlo presionado por 2 segundos</strong>.",img:"assets/images/tutorial/step1_pwa_icon.png",icon:"👆"},{title:"Paso 2: Info de App",text:"En el menú que aparece, toca el círculo con la <strong>(i)</strong> o <strong>'Info. de la aplicación'</strong>.",img:"assets/images/tutorial/step2_pwa_info.png",icon:"ℹ️"},{title:"Paso 3: Activar",text:"Entra en <strong>'Notificaciones'</strong> y <strong>enciende el interruptor</strong> 🟢.",img:"assets/images/tutorial/step3_pwa_toggle.png",icon:"🔔"}];function Ae(c){if(document.querySelector(".notification-gate-overlay"))return;if(!c){Ot();return}J=window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===!0?Wt:Ut,Vt()}function Ot(){const c=document.createElement("div");c.className="notification-gate-overlay",c.innerHTML=`
        <div class="gate-content">
            <span class="gate-icon">🔔</span>
            <h2 class="gate-title">Activar Notificaciones</h2>
            <p class="gate-text">Recibe actualizaciones importantes sobre tu cuenta en tiempo real.</p>
            <button class="gate-btn" id="gate-action-btn">Continuar</button>
        </div>
    `,document.body.appendChild(c),document.body.style.overflow="hidden",document.getElementById("gate-action-btn").addEventListener("click",async()=>{await Jt()})}function Vt(){const c=document.createElement("div");c.className="notification-gate-overlay";const f=`
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
        ${f}
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
    `,document.body.appendChild(c),document.body.style.overflow="hidden",I=0,me(),document.getElementById("wizard-next").addEventListener("click",()=>{I<J.length-1?(I++,me()):Gt()}),document.getElementById("wizard-prev").addEventListener("click",()=>{I>0&&(I--,me())}),"permissions"in navigator&&navigator.permissions.query({name:"notifications"}).then(l=>{l.onchange=()=>{l.state==="granted"&&(Q(),Y(),P&&P())}}).catch(()=>{})}function me(){const c=J[I],f=document.getElementById("wizard-step-container"),l=document.getElementById("wizard-dots"),d=document.getElementById("wizard-next"),o=document.getElementById("wizard-prev");f.innerHTML=`
        <div class="gate-wizard-img-container">
            <img src="${c.img}" class="gate-wizard-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
            <div class="gate-wizard-placeholder" style="display:none">${c.icon}</div>
        </div>
        <h2 class="gate-title">${c.title}</h2>
        <p class="gate-text" style="min-height: 50px;">${c.text}</p>
    `,l.innerHTML=J.map((T,L)=>`<div class="gate-dot ${L===I?"active":""}"></div>`).join(""),o.style.display=I===0?"none":"block",I===0?(d.textContent="Mostrarme cómo",d.style.background="#4F46E5"):I===J.length-1?(d.textContent="Ya las habilité",d.style.background="#10B981"):(d.textContent="Siguiente",d.style.background="#4F46E5")}async function Gt(){let c=Notification.permission;try{c=await Notification.requestPermission()}catch(l){console.warn("Permission check failed",l)}if(c==="granted"){Q(),await Y(),P&&P();return}const f=document.getElementById("wizard-next");f&&(f.textContent="Continuando..."),console.log("Forzando cierre del tutorial (Usuario dice activado)"),Q(),Y().catch(()=>{}),P&&P()}async function Jt(){try{await Notification.requestPermission()==="granted"?(Q(),await Y(),P&&P()):(document.querySelector(".notification-gate-overlay").remove(),Ae(!0))}catch(c){console.error("Error:",c)}}function Q(){const c=document.querySelector(".notification-gate-overlay");c&&c.remove(),document.body.style.overflow=""}function Yt(){const c=document.getElementById("settingsModal"),f=document.getElementById("openSettingsModal"),l=document.getElementById("closeSettingsModal"),d=document.getElementById("saveNotificationSettings");if(!c||!f||!l||!d){console.warn("[NotificationSettings] Required elements not found");return}f.addEventListener("click",async o=>{o.preventDefault(),await Qt(),c.style.display="block"}),l.addEventListener("click",()=>{c.style.display="none"}),window.addEventListener("click",o=>{o.target===c&&(c.style.display="none")}),d.addEventListener("click",async()=>{await Kt()})}async function Qt(){const c=j(),f=Pe();if(!f){v("Debes iniciar sesión para acceder a la configuración.");return}try{const l=await fetch(`${c}/api/notifications/settings`,{method:"GET",headers:{Authorization:`Bearer ${f}`}});if(!l.ok)throw new Error("Error al cargar preferencias");const d=await l.json();document.getElementById("notifSecuritySwitch").checked=!0,document.getElementById("notifSocialSwitch").checked=d.social!==!1,document.getElementById("notifMarketingSwitch").checked=d.marketing!==!1}catch(l){console.error("[NotificationSettings] Load error:",l),v("No se pudieron cargar las preferencias de notificaciones.")}}async function Kt(){const c=j(),f=Pe();if(!f){v("Debes iniciar sesión para guardar la configuración.");return}try{const l=document.getElementById("notifSocialSwitch").checked,d=document.getElementById("notifMarketingSwitch").checked,o=await fetch(`${c}/api/notifications/settings`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${f}`},body:JSON.stringify({settings:{social:l,marketing:d}})});if(!o.ok)throw new Error("Error al guardar preferencias");const T=await o.json();v("✅ Preferencias guardadas correctamente"),setTimeout(()=>{document.getElementById("settingsModal").style.display="none"},1500)}catch(l){console.error("[NotificationSettings] Save error:",l),v("❌ No se pudieron guardar las preferencias. Inténtalo de nuevo.")}}async function Xt(){if(sessionStorage.getItem("winton_global_modal_shown")!=="true")try{const c=await fetch(`${j()}/api/interstitial/global`);if(!c.ok)return;const f=await c.json();f.enabled&&f.message&&(Zt(f.title,f.message),sessionStorage.setItem("winton_global_modal_shown","true"))}catch(c){console.error("[Interstitials] Error initializing global modal:",c)}}function Zt(c,f){const l="global-app-interstitial",d=document.getElementById(l);d&&d.remove();const o=document.createElement("div");o.id=l,o.className="interstitial-overlay",o.innerHTML=`
        <div class="interstitial-container">
            <div class="interstitial-header">
                <div class="interstitial-icon-circle">
                    <span class="interstitial-icon">💡</span>
                </div>
                <h2>${c}</h2>
            </div>
            <div class="interstitial-body">
                <p>${f.replace(/\n/g,"<br>")}</p>
            </div>
            <div class="interstitial-footer">
                <button id="close-interstitial-btn" class="interstitial-action-btn">Entendido</button>
            </div>
        </div>
    `;const T=`
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
    `,L=document.createElement("style");L.innerText=T,document.head.appendChild(L),document.body.appendChild(o),document.getElementById("close-interstitial-btn").addEventListener("click",()=>{o.style.opacity="0",o.style.transition="opacity 0.3s ease",setTimeout(()=>{o.remove(),window.dispatchEvent(new CustomEvent("winton_interstitial_closed"))},300)})}window.getApiUrl=j;window.showCustomAlert=v;window.showCustomConfirm=G;window.linkify=Me;window.fetchAndStoreAppSettings=Tt;window.appSettings=Lt;window.restartTour=qt;console.log("[ContractInteraction] ES Module loaded");document.addEventListener("DOMContentLoaded",async()=>{await $t();function c(e){const n=(Number(e)||0).toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4}),i=n.split(",");return i.length===2?`${i[0]},<span class="decimal-part">${i[1]}</span>`:n}function f(e,t){if(!t||t<=0||e<=0)return"0.0";const n=e/t*100;if(n>=.1)return n.toFixed(1);const a=n.toFixed(10).match(/^0\.0*[1-9]/);return a?a[0]:n.toFixed(6).replace(/\.?0+$/,"")}const l=j(),d=localStorage.getItem("username"),o={usernameDisplay:document.getElementById("usernameDisplay"),profileTrigger:document.querySelector(".profile-trigger"),profileDropdown:document.getElementById("profileDropdown"),notificationTrigger:document.querySelector(".notification-trigger"),notificationDropdown:document.getElementById("notificationDropdown"),notificationBadge:document.getElementById("notificationBadge"),logoutLink:document.getElementById("logoutLink"),publicationsList:document.getElementById("publications-list"),publicationFilterChips:document.getElementById("publicationFilterChips"),publicationSortSelect:document.getElementById("publicationSortSelect"),publicationSearchInput:document.getElementById("publicationSearchInput"),publicationSearchClear:document.getElementById("publicationSearchClear"),saldoBlue:document.getElementById("saldoBlue"),saldoRed:document.getElementById("saldoRed"),ratingModal:document.getElementById("ratingModal"),ratingForm:document.getElementById("ratingForm"),publicationTypeModal:document.getElementById("publicationTypeModal"),openPublicationModalBtn:document.getElementById("openPublicationModalBtn"),closePublicationTypeModalBtn:document.querySelector(".publication-type-close"),debtCountdownContainer:document.getElementById("debt-countdown-container"),debtCountdownText:document.getElementById("debt-countdown-text"),escrowCountdownContainer:document.getElementById("escrow-countdown-container"),escrowCountdownText:document.getElementById("escrow-countdown-text"),availableCountdownContainer:document.getElementById("available-countdown-container"),availableCountdownText:document.getElementById("available-countdown-text"),publicationsCount:document.getElementById("publicationsCount"),boosterSummary:document.getElementById("boosterSummary"),boosterTotalBlue:document.getElementById("boosterTotalBlue"),boosterProgressText:document.getElementById("boosterProgressText"),boosterProgressFill:document.getElementById("boosterProgressFill"),tabImpulsor:document.getElementById("tabImpulsor"),tabBilletera:document.getElementById("tabBilletera"),panelImpulsor:document.getElementById("panelImpulsor"),panelBilletera:document.getElementById("panelBilletera"),walletTabsNav:document.querySelector(".wallet-tabs-nav"),createPostPrelaunchModal:document.getElementById("createPostPrelaunchModal"),createPostPrelaunchAccept:document.getElementById("createPostPrelaunchAccept"),myWalletAddressContainer:document.getElementById("myWalletAddressContainer"),myWalletAddressText:document.getElementById("myWalletAddressText"),copyMyWalletBtn:document.getElementById("copyMyWalletBtn")};let T=null,L=null,F=null,ge=0,ye=0,K=null,ie=[];const X=new Map;let A="all",D="",he=null,$={requires_terms_acceptance:!1,pending_documents:[]};if(!d){v("Debes iniciar sesión para acceder a esta página.",()=>{window.location.href="index.html"});return}o.usernameDisplay&&(o.usernameDisplay.textContent=d),De(d);async function De(e){const t=document.getElementById("sos-my-case-dashboard");if(e)try{const n=await fetch(`${j()}/api/public/sos-venezuela/my-case?username=${encodeURIComponent(e)}`);if(!n.ok)return;const i=await n.json();if(!i.success||!i.has_case||!i.case){t&&(t.innerHTML="");return}const a=i.case;let r='<span style="background: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">En Verificación Manual</span>';a.status==="approved"?r='<span style="background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Aprobado</span>':a.status==="disbursed"?r='<span style="background: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Ayuda Desembolsada</span>':a.status==="rejected"&&(r='<span style="background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 0.85rem;">Rechazado</span>');let s="Necesidades Básicas Urgentes";a.affectation_level==="total_loss"?s="Pérdida Total de Vivienda / Enseres":a.affectation_level==="medical_emergency"?s="Emergencia Médica / Lesionados":a.affectation_level==="partial_damage"&&(s="Daño Parcial en Vivienda");const u=`${a.dependents_minors||0} menor(es), ${a.dependents_elderly||0} adulto(s) mayor(es), ${a.dependents_disabled||0} persona(s) con discapacidad`,m=`${a.state}, ${a.municipality}, ${a.sector}`;t&&(t.innerHTML=`
                    <a href="profile.html" style="display: block; text-decoration: none; background: linear-gradient(135deg, rgba(219, 39, 119, 0.15) 0%, rgba(15, 23, 42, 0.7) 100%); border: 1px solid rgba(219, 39, 119, 0.4); border-radius: 14px; padding: 18px; margin-top: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); transition: transform 0.2s, box-shadow 0.2s;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <h4 style="margin: 0; color: #f472b6; font-size: 1.15rem;">
                                #${a.dossier_number}
                            </h4>
                            ${r}
                        </div>
                    </a>
                `)}catch(n){console.error("Error al cargar datos del dashboard de Mi caso:",n)}}function ae(e){["openPublicationModalBtn","openQuickSaleModalBtn"].forEach(n=>{const i=document.getElementById(n);i&&(i.disabled=!!e,i.style.opacity=e?"0.55":"",i.style.cursor=e?"not-allowed":"",e?i.title="Debes aceptar los documentos legales vigentes para habilitar esta acción.":i.removeAttribute("title"))})}function re(){const e=document.getElementById("legal-acceptance-banner");if(!$.requires_terms_acceptance){e&&e.remove(),ae(!1);return}const t=e||document.createElement("div");if(t.id="legal-acceptance-banner",$.legal_config_error==="NO_ACTIVE_LEGAL_DOCUMENTS"||!$.pending_documents||$.pending_documents.length===0){t.style.background="#f8d7da",t.style.color="#721c24",t.style.border="1px solid #f5c6cb",t.style.borderRadius="10px",t.style.padding="12px",t.style.margin="12px auto",t.style.maxWidth="1200px",t.innerHTML=`
                <strong>Bloqueo de Seguridad Técnico:</strong>
                El servidor no tiene configurados documentos legales activos. Las operaciones de la plataforma están deshabilitadas temporalmente por seguridad. Por favor, contacte soporte.
            `,e||(document.querySelector(".container")||document.body).prepend(t),ae(!0);return}window.qaModalShownOnLoad?n():(window.qaModalShownOnLoad=!0,window.showLegalAcceptanceModal($.pending_documents,i=>{$={requires_terms_acceptance:!!i.requires_terms_acceptance,pending_documents:i.pending_documents||[],legal_config_error:i.legal_config_error||null},re(),v("Aceptación legal registrada correctamente. Ya puedes operar con normalidad.")},()=>{console.log("[LEGAL] Modal automático cancelado. Mostrando recordatorio secundario."),n()}));function n(){t.style.background="#fff3cd",t.style.color="#5f370e",t.style.border="1px solid #ffe69c",t.style.borderRadius="10px",t.style.padding="12px",t.style.margin="12px auto",t.style.maxWidth="1200px",t.innerHTML=`
                <strong>Tienes documentos legales pendientes de aceptar.</strong>
                Para habilitar todas las operaciones de WintonCoin, por favor firma los términos vigentes.
                <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
                    <button id="accept-legal-docs-btn" class="btn">Revisar y Aceptar Términos</button>
                </div>
            `,e||(document.querySelector(".container")||document.body).prepend(t);const i=document.getElementById("accept-legal-docs-btn");i&&(i.onclick=()=>{window.showLegalAcceptanceModal($.pending_documents,a=>{$={requires_terms_acceptance:!!a.requires_terms_acceptance,pending_documents:a.pending_documents||[],legal_config_error:a.legal_config_error||null},re(),v("Aceptación legal registrada correctamente. Ya puedes operar con normalidad.")},()=>{console.log("[LEGAL] Cancelado nuevamente.")})}),ae(!0)}}async function se(){const e=localStorage.getItem("token");if(e)try{const t=await fetch(`${l}/api/legal/status`,{headers:{Authorization:`Bearer ${e}`}});if(!t.ok)throw new Error("No se pudo verificar el estado legal.");const n=await t.json();$={requires_terms_acceptance:!!n.requires_terms_acceptance,pending_documents:n.pending_documents||[],legal_config_error:n.legal_config_error||null},re()}catch(t){console.error("[Legal] Error consultando estado legal:",t)}}o.saldoBlue&&(o.saldoBlue.innerHTML=c(localStorage.getItem("blue_balance"))),o.saldoRed&&(o.saldoRed.innerHTML=c(localStorage.getItem("red_balance"))),se(),q(),Re(),Ve(),le(),wt(),Et(),He(),Ct(),Yt(),It(),Ue(),We(),jt().then(()=>Xt()).then(()=>Oe()).then(()=>{setTimeout(Pt,500)});const qe=1e4;let U=null;function be(){U||(U=setInterval(q,qe))}function ze(){U&&(clearInterval(U),U=null)}function Ne(){document.hidden?ze():(q(),be())}document.addEventListener("visibilitychange",Ne),be();async function W(){if(K)return K;try{const e=await fetch(`${l}/api/platform-settings`);if(!e.ok)throw new Error("No se pudo cargar la configuración.");return K=await e.json(),K}catch(e){return console.error(e),{pre_launch_mode_enabled:!1,allow_request_publications:!0,allow_sell_publications:!0,allow_donation_publications:!0}}}async function He(){const e=localStorage.getItem("token");if(e)try{const t=await fetch(`${l}/api/momentum/profile`,{headers:{Authorization:`Bearer ${e}`}});if(t.ok){const n=await t.json();if(n&&n.username===d&&n.tier!=="PENDIENTE"&&n.tier!=="RECHAZADO"){const i=document.getElementById("momentumMenuLink");i&&(i.style.display="block")}}}catch(t){console.error("[Momentum] Error checking profile status:",t)}}async function le(){const e=await W(),t=document.getElementById("publicationTypeModal");if(!t)return;const n=t.querySelector(".modal-option-button.request"),i=t.querySelector(".modal-option-button.sell"),a=t.querySelector(".modal-option-button.donation"),r=(localStorage.getItem("username")||"").toLowerCase(),s=(e.platform_username||"wintoncoin").toLowerCase(),u=r===s||r==="plataforma",m=e.pre_launch_mode_enabled?u:e.allow_request_publications,p=e.pre_launch_mode_enabled?u:e.allow_sell_publications,b=e.allow_donation_publications,h=(g,w,M)=>{if(g)if(g.classList.toggle("disabled",!w),w){g.style.cursor="pointer";const S=g.cloneNode(!0);g.parentNode.replaceChild(S,g),S.addEventListener("click",C=>{C.preventDefault(),setTimeout(()=>{M==="donation"&&e.pre_launch_mode_enabled?window.location.href="solicitud-solidaria.html":window.location.href=`publish.html?type=${M}`},50)})}else{g.style.cursor="not-allowed";const S=g.cloneNode(!0);g.parentNode.replaceChild(S,g),S.addEventListener("click",C=>{C.preventDefault(),C.stopPropagation()})}};h(n,m,"request"),h(i,p,"sell"),h(a,b,"donation");const y=document.getElementById("openQuickSaleModalBtn");y&&(y.style.display=e.allow_quick_sale_publications===!1||e.pre_launch_mode_enabled&&!u?"none":"inline-flex")}function q(){ce(),Se(),ue(),xt(),_t()}window.loadAllData=q;function Re(){const e=(t,n)=>{!t||!n||t.addEventListener("click",i=>{i.stopPropagation();const a=!n.classList.contains("show");we(),a&&n.classList.toggle("show")})};e(o.profileTrigger,o.profileDropdown),e(o.notificationTrigger,o.notificationDropdown)}function we(){o.profileDropdown&&o.profileDropdown.classList.remove("show"),o.notificationDropdown&&o.notificationDropdown.classList.remove("show")}function je(){const e=document.getElementById("prelaunchWalletModal");e&&(e.style.display="flex")}function Fe(){const e=document.getElementById("prelaunchWalletModal");e&&(e.style.display="none")}function Z(e){const{tabImpulsor:t,tabBilletera:n,panelImpulsor:i,panelBilletera:a}=o;t&&t.classList.toggle("active",e==="impulsor"),n&&n.classList.toggle("active",e==="billetera"),i&&i.classList.toggle("active",e==="impulsor"),a&&a.classList.toggle("active",e==="billetera"),e==="billetera"&&(sessionStorage.getItem("suppressWalletModal")==="true"||je()),localStorage.setItem("walletActiveTab",e)}function Ue(){const{tabImpulsor:e,tabBilletera:t}=o,n=document.getElementById("prelaunchModalAccept");e&&e.addEventListener("click",()=>Z("impulsor")),t&&t.addEventListener("click",()=>Z("billetera")),n&&n.addEventListener("click",Fe)}function We(){const e=document.getElementById("venezuelaEmergencyModal"),t=document.getElementById("venezuelaEmergencyBanner"),n=document.getElementById("venezuelaEmergencyDonateBtn"),i=document.getElementById("venezuelaEmergencyCloseBtn"),a=document.getElementById("emergencyBannerBtn"),r=document.getElementById("closeEmergencyBanner");if(!e||!t)return;const s=24*60*60*1e3,u=Date.now(),m=localStorage.getItem("venezuelaEmergencyDismissed"),p=localStorage.getItem("venezuelaEmergencyBannerDismissed"),b=m&&u-parseInt(m)<s,h=p&&u-parseInt(p)<s;function y(){e.style.display="none",t.style.display="none",localStorage.setItem("venezuelaEmergencyDismissed",u.toString());const g=document.querySelector('.filter-chip[data-filter="donation"]');g&&g.click();const w=document.querySelector(".publications-section");w&&w.scrollIntoView({behavior:"smooth"})}b?h||(t.style.display="block"):e.style.display="flex",n&&n.addEventListener("click",y),i&&i.addEventListener("click",()=>{e.style.display="none",localStorage.setItem("venezuelaEmergencyDismissed",u.toString()),h||(t.style.display="block")}),a&&a.addEventListener("click",y),r&&r.addEventListener("click",()=>{t.style.display="none",localStorage.setItem("venezuelaEmergencyBannerDismissed",u.toString())})}function Oe(){return new Promise(e=>{W().then(t=>{const n=t?.pre_launch_mode_enabled===!0||t?.pre_launch_mode_enabled==="true",a=new URLSearchParams(window.location.search).get("start_wallet_tour")==="true",r=sessionStorage.getItem("pendingWalletTour")==="true";o.walletTabsNav&&(n&&!a&&!r?o.walletTabsNav.style.display="none":o.walletTabsNav.style.display="flex");let s="billetera";a||r?(r&&sessionStorage.setItem("suppressWalletModal","true"),s="billetera"):n?s="impulsor":s=localStorage.getItem("walletActiveTab")||"billetera",Z(s);const u=document.getElementById("prelaunchWalletModal"),m=document.getElementById("prelaunchModalAccept");if(s==="billetera"&&u&&u.style.display!=="none"&&m){const p=()=>{m.removeEventListener("click",p),e()};m.addEventListener("click",p)}else e()}).catch(t=>{console.warn("[WalletTabs] Error inicializando, default a Impulsor:",t),Z("impulsor"),e()})})}function Ve(){window.addEventListener("click",we),o.logoutLink&&o.logoutLink.addEventListener("click",Qe),o.copyMyWalletBtn&&o.copyMyWalletBtn.addEventListener("click",function(){const e=this.dataset.address;e&&copyTextToClipboard(e).then(()=>{const t=this.innerHTML;this.innerHTML='<span style="font-size:12px; font-weight:bold; color:#059669;">✓ Copiado</span>',setTimeout(()=>{this.innerHTML=t},2e3)}).catch(t=>{console.error("Error al copiar la billetera: ",t)})}),o.publicationsList&&o.publicationsList.addEventListener("click",Ke),o.publicationFilterChips&&(o.publicationFilterChips.addEventListener("click",Ge),o.publicationFilterChips.addEventListener("wheel",e=>{if(e.deltaY===0)return;e.preventDefault();let t=0;e.deltaMode===1?t=e.deltaY*33:e.deltaMode===2?t=e.deltaY*o.publicationFilterChips.clientWidth:t=e.deltaY,o.publicationFilterChips.scrollLeft+=t},{passive:!1})),o.publicationSortSelect&&o.publicationSortSelect.addEventListener("change",O),o.publicationSearchInput&&o.publicationSearchInput.addEventListener("input",Je),o.publicationSearchClear&&o.publicationSearchClear.addEventListener("click",Ye),o.ratingForm&&o.ratingForm.addEventListener("submit",Ze),o.openPublicationModalBtn&&o.openPublicationModalBtn.addEventListener("click",async e=>{e.preventDefault(),(await W()).pre_launch_mode_enabled&&o.createPostPrelaunchModal?o.createPostPrelaunchModal.style.display="flex":(le(),o.publicationTypeModal&&(o.publicationTypeModal.style.display="flex"))}),o.createPostPrelaunchAccept&&o.createPostPrelaunchAccept.addEventListener("click",()=>{o.createPostPrelaunchModal&&(o.createPostPrelaunchModal.style.display="none"),le(),o.publicationTypeModal&&(o.publicationTypeModal.style.display="flex")}),o.closePublicationTypeModalBtn&&o.closePublicationTypeModalBtn.addEventListener("click",()=>{o.publicationTypeModal&&(o.publicationTypeModal.style.display="none")}),window.addEventListener("click",e=>{e.target===o.ratingModal&&o.ratingModal&&(o.ratingModal.style.display="none"),e.target===o.publicationTypeModal&&o.publicationTypeModal&&(o.publicationTypeModal.style.display="none"),e.target===o.createPostPrelaunchModal&&o.createPostPrelaunchModal&&(o.createPostPrelaunchModal.style.display="none")}),o.notificationDropdown&&o.notificationDropdown.addEventListener("click",async e=>{const t=e.target.closest(".notification-dismiss"),n=e.target.closest(".notification-footer-link");t&&(e.preventDefault(),await pt(t.dataset.id)),n&&(e.preventDefault(),await clearAllNotifications())})}function Ge(e){const t=e.target.closest(".filter-chip");if(!t||t.classList.contains("active"))return;const n=A,i=t.dataset.filter;o.publicationFilterChips.querySelectorAll(".filter-chip").forEach(a=>{a.classList.remove("active"),a.setAttribute("aria-pressed","false")}),t.classList.add("active"),t.setAttribute("aria-pressed","true"),A=i,n==="hidden"||i==="hidden"?ce():O()}function Je(){clearTimeout(he),he=setTimeout(()=>{D=(o.publicationSearchInput?.value||"").trim().toLowerCase(),o.publicationSearchClear&&(o.publicationSearchClear.style.display=D?"flex":"none"),O()},250)}function Ye(){o.publicationSearchInput&&(o.publicationSearchInput.value=""),o.publicationSearchClear&&(o.publicationSearchClear.style.display="none"),D="",O()}function Qe(e){e.preventDefault(),localStorage.removeItem("username"),localStorage.removeItem("blue_balance"),localStorage.removeItem("escrow_blue_balance"),localStorage.removeItem("red_balance"),localStorage.removeItem("token"),v("Has cerrado la sesión.",()=>{window.location.href="index.html"})}async function Ke(e){const t=e.target.closest("[data-action]");if(!t)return;const n=t.dataset.id,i=t.dataset.action,a=t.dataset.user;let r,s={};switch(i){case"accept":r=`/publications/${n}/accept`,s={acceptorUsername:d},await k(r,s);break;case"approve":r=`/publications/${n}/approve`,s={approverUsername:d,userToApprove:a},await k(r,s);break;case"complete":r=`/publications/${n}/complete`,s={completerUsername:d},await k(r,s);break;case"desist":{const b=t&&t.textContent.toLowerCase().includes("solicitud")?"¿Deseas retirar tu solicitud para esta tarea? Tu postulación será eliminada y el cupo quedará libre para otros postulantes.":"¿Deseas abandonar esta tarea? Tu participación se cancelará y el cupo se liberará de inmediato para otros ayudantes.";G(b,async()=>{r=`/publications/${n}/desist`,s={acceptorUsername:d},await k(r,s)});break}case"confirm-payment":const m=t.closest(".publication-item")?.dataset.author;await Xe(n,m,a);break;case"delete":G("¿Deseas eliminar esta tarea?",async()=>{await et(`/publications/${n}`,{deleterUsername:d})});break;case"discard":G(`¿Descartar solicitud de ${a}?`,async()=>{await k(`/publications/${n}/discard`,{discarderUsername:d,userToDiscard:a})});break;case"toggle-pause":await k(`/publications/${n}/toggle-pause`,{username:d});break;case"hide":await k(`/publications/${n}/hide`,{username:d});break}}async function Xe(e,t,n){try{const i=localStorage.getItem("token"),a={"Content-Type":"application/json"};i&&(a.Authorization=`Bearer ${i}`);const r=await fetch(`${l}/publications/${e}/confirm-payment`,{method:"POST",headers:a,body:JSON.stringify({confirmerUsername:d,workerUsername:n})}),s=await r.json();r.ok?(v(s.message),q(),bt(e,t,n)):v(s.message||"Error al confirmar el pago.")}catch(i){console.error("Error en confirmPaymentAndRate:",i),v("Error de red al confirmar el pago.")}}async function Ze(e){e.preventDefault();const t=new FormData(e.target),n=Object.fromEntries(t.entries());try{await k("/rate",n),o.ratingModal&&(o.ratingModal.style.display="none")}catch(i){console.error("La calificación falló.",i)}}async function k(e,t,n={}){const{silent:i=!1,reload:a=!0}=n;try{const r=localStorage.getItem("token"),s={"Content-Type":"application/json"};r&&(s.Authorization=`Bearer ${r}`);const u=await fetch(`${l}${e}`,{method:"POST",headers:s,body:JSON.stringify(t)});if(N(u))return null;const m=await u.text();let p;try{p=JSON.parse(m)}catch{throw console.error("Respuesta no-JSON:",m),v(m||"Error inesperado."),new Error("Respuesta no-JSON")}if(!u.ok){if(u.status===403&&p.code==="LEGAL_ACCEPTANCE_REQUIRED")return new Promise((b,h)=>{window.showLegalAcceptanceModal(p.pending_documents,async y=>{console.log("[LEGAL] Términos aceptados desde modal. Refrescando UI y reintentando..."),typeof se=="function"&&await se();try{const g=await k(e,t,n);b(g)}catch(g){h(g)}},()=>{h(new Error("Acción bloqueada: Debes aceptar los términos y condiciones vigentes."))})});throw v(p.message||`Error: ${u.status}`),new Error(p.message)}return!i&&p.message&&v(p.message),u.ok&&a&&q(),p}catch(r){return console.error(`Error en postToServer (${e}):`,r),Promise.reject(r)}}async function et(e,t){try{const n=localStorage.getItem("token"),i={"Content-Type":"application/json"};n&&(i.Authorization=`Bearer ${n}`);const a=await fetch(`${l}${e}`,{method:"DELETE",headers:i,body:JSON.stringify(t)}),r=await a.json();v(r.message),a.ok&&q()}catch(n){console.error("Error en deleteFromServer:",n),v("Error de red al eliminar.")}}async function ce(){if(o.publicationsList)try{const t=await fetch(`${l}/publications/active?user=${d}${A==="hidden"?"&filter=hidden":""}`);if(!t.ok){o.publicationsList.innerHTML="<p>Error al cargar las publicaciones.</p>";return}const n=await t.json();let i=[];const a=localStorage.getItem("token");if(a)try{const p=await fetch(`${l}/api/humanitarian/causes/approved`,{headers:{Authorization:`Bearer ${a}`}});if(p.ok){const b=await p.json();b.success&&(i=b.causes||[])}}catch(p){console.error("[Solidario] Error al obtener causas aprobadas para el marketplace:",p)}const r=`hidden_causes_${d}`,s=JSON.parse(localStorage.getItem(r)||"[]");if(ie=[...i.filter(p=>{const b=s.includes(p.id);return A==="hidden"?b:!b}).map(p=>({id:`cause-${p.id}`,cause_id:p.id,title:p.title,description:p.story,goal_amount:p.goal_amount,current_amount:p.current_amount,amount_on_hold:p.amount_on_hold,created_at:p.created_at,author_username:p.creator_username,beneficiary_username:p.beneficiary_username,foundation_name:p.foundation_name,category:"donation",is_humanitarian_cause:!0,image_urls:(p.evidence_urls||[]).filter(b=>{if(!b||typeof b!="string")return!1;const h=b.toLowerCase();return!!(h.includes("/uploads/")||/\.(webp|png|jpg|jpeg|gif)(\?.*)?$/i.test(h))}),available_slots:1,blue_cost:0})),...n],ie.length===0){A==="hidden"?o.publicationsList.innerHTML=`
                        <div class="empty-state-container">
                            <div class="empty-state-icon">📁</div>
                            <h3>No tienes publicaciones ocultas</h3>
                            <p>Las publicaciones que decidas ocultar con el botón 'X' aparecerán aquí para que puedas recuperarlas.</p>
                        </div>
                    `:o.publicationsList.innerHTML=`
                        <div class="empty-state-container">
                            <div class="empty-state-icon">🚀</div>
                            <h3>¡El mercado está tranquilo!</h3>
                            <p>Es el momento perfecto para definir la economía.</p>
                            <button onclick="document.getElementById('openPublicationModalBtn').click()" class="action-button primary-action pulse-animation">
                                Crear la Primera Publicación
                            </button>
                        </div>
                    `,de([]);return}X.clear(),await O()}catch(e){console.error("Error al obtener publicaciones:",e),o.publicationsList.innerHTML="<p>No se pudo conectar con el servidor.</p>"}}async function O(){if(!o.publicationsList)return;const e=ot(ie);if(e.length===0){o.publicationsList.innerHTML='<p class="empty-message">No hay publicaciones para este filtro.</p>',de([]);return}de(e);const t=await W(),n=e.map(r=>r.author_username).filter(r=>!X.has(r)),i=[...new Set(n)];i.length>0&&(await Promise.all(i.map(s=>nt(s).then(u=>({username:s,data:u}))))).forEach(({username:s,data:u})=>X.set(s,u));const a=e.map(r=>{const s=X.get(r.author_username)||{average:0,count:0},u=tt(s.average,s.count),m=st(r,t);return dt(r,m,u)});o.publicationsList.innerHTML=a.join("")}function tt(e,t){if(t===0)return"";const n=Math.floor(e),i=e%1>=.5?1:0,a=5-n-i;let r="";for(let s=0;s<n;s++)r+="★";i&&(r+="½");for(let s=0;s<a;s++)r+="☆";return`<span class="stars">${r}</span> <span class="rating-count">(${t})</span>`}async function nt(e){try{const t=await fetch(`${l}/user/${e}`);if(!t.ok)return console.warn(`Could not fetch rating for user ${e}. Status: ${t.status}`),{average:0,count:0};const n=await t.json();return{average:n.average_rating,count:n.ratings_count}}catch(t){return console.error(`Error fetching rating for ${e}:`,t),{average:0,count:0}}}function ot(e){const t=A,n=o.publicationSortSelect?.value||"recent";let i=[...e];return D&&(i=i.filter(a=>{const r=(a.title||"").toLowerCase(),s=(a.description||"").toLowerCase(),u=(a.author_username||"").toLowerCase();return r.includes(D)||s.includes(D)||u.includes(D)})),t==="pending"?i=i.filter(a=>it(a)):(t==="request"||t==="sell"||t==="donation")&&(i=i.filter(a=>rt(a)===t)),n==="recent"||n==="oldest"?i.sort((a,r)=>{const s=Ee(r)-Ee(a);return n==="recent"?s:-s}):(n==="reward_desc"||n==="reward_asc")&&i.sort((a,r)=>{const s=(Number(r.blue_cost)||0)-(Number(a.blue_cost)||0);return n==="reward_desc"?s:-s}),at(i)}function it(e){const t=e.user_acceptance_status;return!!(t==="approved"||t==="pending_approval"||t==="completed"||e.author_username===d&&e.participants&&e.participants.some(i=>i.status==="pending_approval"||i.status==="completed"))}function ve(e){if(e.is_humanitarian_cause)return-1;if(e.author_username===d&&e.participants&&e.participants.length>0){const i=e.participants.some(r=>r.status==="pending_approval"),a=e.participants.some(r=>r.status==="completed");if(i)return 0;if(a)return 1}const n=e.user_acceptance_status;return n==="approved"?2:n==="pending_approval"?3:n==="completed"?4:5}function at(e){return[...e].sort((t,n)=>ve(t)-ve(n))}function rt(e){return e.category==="donation"?"donation":e.is_sell_post?"sell":"request"}function Ee(e){const t=e.created_at||e.createdAt,n=t?new Date(t):null;return n&&!Number.isNaN(n.getTime())?n.getTime():Number(e.id)||0}function de(e){o.publicationsCount&&(o.publicationsCount.textContent=String((e||[]).length))}function st(e,t){return t?.pre_launch_mode_enabled?"BLUE IOU":"BLUE"}function lt(e){if(e.author_username===d&&e.participants&&e.participants.length>0){const r=e.participants.filter(u=>u.status==="pending_approval").length,s=e.participants.filter(u=>u.status==="completed").length;if(r>0||s>0){const u=[];return r>0&&u.push(`${r} por aprobar`),s>0&&u.push(`${s} por pagar`),`<div class="publication-status-banner status-author-action">${u.join(" · ")}</div>`}}const n=e.user_acceptance_status;let i="",a="";return n==="approved"?(e.is_sell_post?i="Pendiente pago":i="Puedes comenzar!",a="status-approved"):n==="completed"?(e.is_sell_post,i="Esperando confirmación",a="status-completed"):n==="pending_approval"&&(i="Esperando aprobación",a="status-pending"),i?`<div class="publication-status-banner ${a}">${i}</div>`:""}function ct(e){if(!e.expires_at)return{html:"",isExpired:!1};const t=new Date,i=new Date(e.expires_at)-t;if(i<=0)return{html:'<div class="expiration-info expired"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg> Expirada</div>',isExpired:!0};const a=Math.floor(i/(1e3*60*60*24)),r=Math.floor(i%(1e3*60*60*24)/(1e3*60*60)),s=Math.floor(i%(1e3*60*60)/(1e3*60));let u="";return a>1?u=`Vence en ${a} días`:a===1?u=`Vence en ${a} día`:r>1?u=`Vence en ${r} horas`:r===1?u=`Vence en ${r} hora`:s>0?u=`Vence en ${s} min`:u="Vence en <1 min",{html:`<div class="expiration-info"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> ${u}</div>`,isExpired:!1}}function dt(e,t,n=""){const i=e.category==="donation",a=i?`${c(e.goal_amount)} ${t}`:`${c(e.blue_cost)} ${t}`,r=lt(e);let s="";e.is_booster_task?s="booster-ribbon":i?s="donation-ribbon":e.is_sell_post&&(s="sell-ribbon");const u=e.available_slots>0?"available":"full",m=i?"Campaña Activa":e.available_slots>0?`${e.available_slots} cupos`:"Cupos agotados",p=ct(e),b=H(e.author_username),h=$e(e.author_username);let y="";if(e.is_humanitarian_cause){if(y=b,e.beneficiary_username&&e.beneficiary_username!==e.author_username){const x=H(e.beneficiary_username),_=e.foundation_name?H(e.foundation_name):"",B=_?`${_} @${x}`:`@${x}`;y=`${y} <span style="font-weight: normal; opacity: 0.7; font-size: 0.85em;">en beneficio de: ${B}</span>`}}else y=window.appSettings?.public_profiles_enabled?`<a href="profile.html?user=${encodeURIComponent(e.author_username)}" class="profile-link" onclick="event.stopPropagation()">${b}</a>`:b;let g="";if(i){const x=parseFloat(e.current_amount||0),_=parseFloat(e.goal_amount||0);if(e.is_humanitarian_cause){const B=parseFloat(e.amount_on_hold||0),Te=x+B,Le=_>0?Math.min(x/_*100,100):0,Bt=_>0?Math.min(B/_*100,100-Le):0;g=`
                    <div class="donation-progress-container" style="margin-top: 10px;">
                        <div class="donation-progress-labels" style="margin-bottom: 6px; font-size: 0.78rem; font-weight: normal; opacity: 0.85; display: flex; justify-content: space-between; align-items: center; letter-spacing: 0.3px;">
                            <span><strong style="color: #ffffff; font-weight: 600; font-size: 0.82rem;">${c(Te)}</strong> de <span style="opacity: 0.7; font-size: 0.8rem;">${c(_)}</span> ${t}</span>
                            <span style="font-weight: 600; color: #f472b6;">${f(Te,_)}%</span>
                        </div>
                        <div class="donation-progress-bar" style="display: flex; height: 8px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; position: relative;">
                            <div class="donation-progress-fill" style="width: ${Le.toFixed(1)}%; height: 100%; background: linear-gradient(90deg, #ec4899, #db2777); border-radius: 0;"></div>
                            <div class="donation-progress-fill-hold" style="width: ${Bt.toFixed(1)}%; height: 100%; background: repeating-linear-gradient(45deg, rgba(232, 62, 140, 0.4), rgba(232, 62, 140, 0.4) 10px, rgba(232, 62, 140, 0.6) 10px, rgba(232, 62, 140, 0.6) 20px);"></div>
                        </div>
                        ${B>0?`<div style="font-size: 10px; color: #f472b6; margin-top: 5px; font-weight: normal; opacity: 0.9;">${c(B)} ${t} en hold por verificación KYC</div>`:""}
                    </div>
                `}else{const B=_>0?Math.min(100,Math.floor(x/_*100)):0;g=`
                    <div class="donation-progress-container">
                        <div class="donation-progress-labels">
                             <span>${c(x)} ${t} recaudados</span>
                            <span>${B}%</span>
                        </div>
                        <div class="donation-progress-bar">
                            <div class="donation-progress-fill" style="width: ${B}%"></div>
                        </div>
                    </div>
                `}}const w=A==="hidden";let M="";e.is_humanitarian_cause?M=w?`
                <button class="card-close-btn restore-btn" title="Restaurar causa" onclick="event.preventDefault(); event.stopPropagation(); window.handleCauseAction('unhide', ${e.cause_id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                    </svg>
                </button>
                `:`
                <button class="card-close-btn" title="Ocultar causa" onclick="event.preventDefault(); event.stopPropagation(); window.handleCauseAction('hide', ${e.cause_id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                `:M=w?`
                <button class="card-close-btn restore-btn" title="Restaurar publicación" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('unhide', ${e.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <polyline points="3 3 3 8 8 8"></polyline>
                    </svg>
                </button>
                `:`
                <button class="card-close-btn" title="Ocultar publicación" onclick="event.preventDefault(); event.stopPropagation(); window.handleCardAction('hide', ${e.id})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
                `;const S=`<h3>${H(e.title)}</h3>`;return`
            <a href="${e.is_humanitarian_cause?`causa-solidaria.html?id=${e.cause_id}`:`publication-detail.html?id=${e.id}`}" class="publication-item-link">
                <div class="publication-item ${p.isExpired?"expired":""} ${i?"donation-card":""} ${e.image_urls&&e.image_urls.length>0?"has-images":""}" data-id="${e.id}" data-author="${h}">
                    
                    ${e.image_urls&&e.image_urls.length>0?`
                        <div class="card-images-wrapper">
                            <div class="card-images-container ${e.image_urls.length>1?"is-carousel":"single-image"}" onscroll="if(this.classList.contains('is-carousel')){const idx = Math.round(this.scrollLeft / this.offsetWidth); this.parentElement.querySelectorAll('.carousel-dot').forEach((d, i) => d.classList.toggle('active', i === idx));}">
                                ${e.image_urls.map(x=>`<img src="${$e(x)}" alt="Imagen de publicación" loading="lazy">`).join("")}
                            </div>
                            ${e.image_urls.length>1?`
                                <div class="carousel-dots">
                                    ${e.image_urls.map((x,_)=>`<span class="carousel-dot ${_===0?"active":""}"></span>`).join("")}
                                </div>
                            `:""}
                        </div>
                    `:""}

                    <div class="card-top-row ${r?"has-status":""}">
                        ${M}
                        
                        ${r}

                        <div class="cost-ribbon-right ${s}">${a}</div>
                    </div>

                    <div class="publication-header">
                        ${S}
                    </div>
                    
                    ${g}

                    ${e.is_humanitarian_cause?"":`<p class="pub-description">${Me(e.description?.slice(0,150)||"")}</p>`}
                    


                    <div class="publication-footer">
                        <div class="pub-meta">
                            <span>Por: <strong>${y}</strong></span>
                            ${n}
                        </div>
                        <div class="pub-meta-right">
                            ${i?"":`<div class="slots-info ${u}">${m}</div>`}
                            ${p.html}
                        </div>
                    </div>
                </div>
            </a>
        `}window.handleDirectDonation=async function(e,t){const n=document.getElementById(`don-input-${e}`),i=parseFloat(n?.value);if(!i||i<=0||isNaN(i)){v("⚠️ Por favor, ingresa un monto válido para donar.");return}const a=`¿Deseas donar ${i} BLUE a ${t}?

Esta acción generará un compromiso de reciprocidad RED equivalente en tu cuenta según el modelo económico de WintonCoin.`;G(a,async()=>{try{const r=localStorage.getItem("token"),s=await fetch(`${l}/publications/${e}/accept`,{method:"POST",headers:{"Content-Type":"application/json",...r&&{Authorization:`Bearer ${r}`}},body:JSON.stringify({acceptorUsername:d,donationAmount:i})});if(N(s))return;const u=await s.json();s.ok?v(u.message||"¡Donación procesada con éxito!",()=>{window.loadAllData()}):v(u.message||"Error al procesar la donación.")}catch(r){console.error("Error en donación:",r),v("Error de red al procesar la donación.")}})},window.handleCardAction=async function(e,t){if(e==="hide")await ut(t);else if(e==="unhide"){const n=document.querySelector(`.publication-item[data-id="${t}"]`);if(n){const i=n.closest(".publication-item-link");i&&(i.style.transition="all 0.3s ease",i.style.opacity="0",i.style.transform="scale(0.9)",setTimeout(()=>{i.remove(),o.publicationsList.querySelectorAll(".publication-item-link").length===0&&(o.publicationsList.innerHTML=`
                                <div class="empty-state-container">
                                    <div class="empty-state-icon">📁</div>
                                    <h3>No tienes publicaciones ocultas</h3>
                                    <p>Las publicaciones que decidas ocultar con el botón 'X' aparecerán aquí para que puedas recuperarlas.</p>
                                </div>
                            `)},300))}await xe(t)}},window.handleCauseAction=function(e,t){const n=`hidden_causes_${d}`;let i=JSON.parse(localStorage.getItem(n)||"[]");if(e==="hide"){const a=document.querySelector(`.publication-item[data-id="cause-${t}"]`);if(a){const r=a.closest(".publication-item-link");r&&(r.style.transition="all 0.3s ease",r.style.opacity="0",r.style.transform="scale(0.9)",setTimeout(()=>{r.style.display="none"},300))}i.includes(t)||(i.push(t),localStorage.setItem(n,JSON.stringify(i))),_e("Causa ocultada","DESHACER",()=>{window.handleCauseAction("unhide",t)})}else if(e==="unhide"){const a=document.querySelector(`.publication-item[data-id="cause-${t}"]`);if(a){const r=a.closest(".publication-item-link");r&&(r.style.transition="all 0.3s ease",r.style.opacity="0",r.style.transform="scale(0.9)",setTimeout(()=>{r.remove()},300))}i=i.filter(r=>r!==t),localStorage.setItem(n,JSON.stringify(i))}setTimeout(()=>{ce()},310)};async function ut(e){try{const t=document.querySelector(`.publication-item[data-id="${e}"]`);if(!t)return;const n=t.closest(".publication-item-link");if(n){n.style.transition="all 0.3s ease",n.style.opacity="0",n.style.transform="scale(0.9)";const a=setTimeout(()=>{n.style.display="none"},300);n.dataset.hideTimeout=a}(await fetch(`${l}/publications/${e}/hide`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({username:localStorage.getItem("username")})})).ok?_e("Publicación oculta","DESHACER",async()=>{await xe(e)}):(console.error("Error al ocultar en servidor"),n&&(n.dataset.hideTimeout&&(clearTimeout(Number(n.dataset.hideTimeout)),delete n.dataset.hideTimeout),n.style.display="",setTimeout(()=>{n.style.opacity="1",n.style.transform="scale(1)"},50)))}catch(t){console.error("Error de red al ocultar:",t),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload()}}async function xe(e){try{const n=document.querySelector(`.publication-item[data-id="${e}"]`)?.closest(".publication-item-link");n&&(n.dataset.hideTimeout&&(clearTimeout(Number(n.dataset.hideTimeout)),delete n.dataset.hideTimeout),n.style.display="",n.offsetWidth,n.style.opacity="1",n.style.transform="scale(1)"),(await fetch(`${l}/publications/${e}/unhide`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")}`},body:JSON.stringify({username:localStorage.getItem("username")})})).ok?n||typeof window.loadAllData=="function"&&window.loadAllData():(console.error("Error en servidor al deshacer"),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload())}catch(t){console.error("Error al deshacer:",t),typeof window.loadAllData=="function"?window.loadAllData():window.location.reload()}}function _e(e,t,n){const i=document.getElementById("toast-notification");i&&i.remove();const a=document.createElement("div");if(a.id="toast-notification",a.className="toast-notification",a.innerHTML=`
            <span>${e}</span>
            ${`<button id="toast-action" type="button">${t}</button>`}
        `,document.body.appendChild(a),a.offsetWidth,a.classList.add("show"),n){const r=document.getElementById("toast-action");r.onclick=s=>{s.preventDefault(),s.stopPropagation(),n(),a.classList.remove("show"),setTimeout(()=>a.remove(),300)}}setTimeout(()=>{document.body.contains(a)&&(a.classList.remove("show"),setTimeout(()=>{document.body.contains(a)&&a.remove()},300))},7e3)}async function Se(){try{const e=localStorage.getItem("token"),t=await fetch(`${l}/api/me/notifications`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(N(t))return;if(!t.ok)throw new Error("Error al cargar notificaciones.");const n=await t.json(),i=document.getElementById("notificationDropdown");if(!i)return;if(i.innerHTML="",n.length===0)i.innerHTML=`
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
                `,i.appendChild(a),n.forEach(r=>{const s=document.createElement("div");s.className="notification-item",s.dataset.id=r.id,s.innerHTML=`
                        <p>${H(r.message)}</p>
                        <span class="notification-dismiss" data-id="${r.id}" title="Descartar">&times;</span>
                    `,i.appendChild(s)})}ee(n.length)}catch(e){console.error(e.message),ee(0)}}function ee(e){o.notificationBadge&&(e>0?(o.notificationBadge.textContent=e,o.notificationBadge.style.display="flex"):o.notificationBadge.style.display="none")}async function pt(e){const t=document.querySelector(`.notification-item[data-id='${e}']`);t&&(t.style.transition="opacity 0.3s ease",t.style.opacity="0",setTimeout(()=>{t.remove();const n=document.querySelectorAll(".notification-item").length;ee(n),n===0&&Se()},300));try{await k(`/api/me/notifications/${e}/dismiss`,{},{silent:!0,reload:!1})}catch(n){console.error("Error al descartar notificación:",n)}}window.clearAllNotifications=async function(){try{if((await k("/api/me/notifications/mark-read",{},{silent:!0,reload:!1})).success){const t=document.getElementById("notificationDropdown");t&&(t.innerHTML=`
                    <div class="notification-header-actions">
                        <button class="noti-action-link" onclick="window.openNotificationHistory()">Ver historial</button>
                    </div>
                    <div class="no-notifications">No tienes notificaciones nuevas.</div>
                `),ee(0)}}catch(e){console.error("Error al limpiar notificaciones:",e)}},window.openNotificationHistory=async function(){try{const e=localStorage.getItem("token"),t=await fetch(`${l}/api/me/notifications/history`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(!t.ok)throw new Error("No se pudo cargar el historial.");const n=await t.json();mt(n)}catch(e){console.error("Error al abrir historial:",e),v("No se pudo cargar el historial de notificaciones.")}};function mt(e){const t=document.getElementById("notificationHistoryModal");t&&t.remove();const n=document.createElement("div");n.id="notificationHistoryModal",n.className="custom-modal",n.style.display="flex";let i="";e.length===0?i='<p class="empty-history">Aún no tienes notificaciones en tu historial.</p>':i=e.map(a=>{const r=new Date(a.created_at).toLocaleString();let s="🔔",u="";const m=a.message.toLowerCase();return m.includes("aprobada")||m.includes("has sido aprobado")||m.includes("🎉")||m.includes("✅")?(s="✅",u="noti-success"):m.includes("rechazada")||m.includes("error")||m.includes("⚠️")||m.includes("❌")?(s="⚠️",u="noti-warning"):m.includes("pagada")||m.includes("acreditado")||m.includes("ganado")||m.includes("💰")?(s="💰",u="noti-money"):(m.includes("quiere participar")||m.includes("solicitud")||m.includes("📩"))&&(s="📩",u="noti-request"),`
                    <div class="history-noti-item ${a.is_read?"is-read":"is-unread"} ${u}">
                        <div class="history-noti-icon">${s}</div>
                        <div class="history-noti-content">
                            <p>${H(a.message)}</p>
                            <span class="history-noti-date">${r}</span>
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
        `,document.body.appendChild(n)}async function ue(){try{const e=localStorage.getItem("token"),t=await fetch(`${l}/api/me/balance?t=${new Date().getTime()}`,{headers:e?{Authorization:`Bearer ${e}`}:{}});if(N(t))return;if(t.ok){const n=await t.json();o.saldoBlue&&(o.saldoBlue.innerHTML=c(n.blue_balance)),o.saldoRed&&(o.saldoRed.innerHTML=c(n.red_balance)),localStorage.setItem("blue_balance",n.blue_balance),localStorage.setItem("escrow_blue_balance",n.escrow_blue_balance),localStorage.setItem("red_balance",n.red_balance),localStorage.setItem("penalized_debt",n.penalized_debt),ft(n);const i=await W();if(!(i?.pre_launch_mode_enabled===!0||i?.pre_launch_mode_enabled==="true")&&n.web3_wallet_address&&o.myWalletAddressContainer&&o.myWalletAddressText&&o.copyMyWalletBtn){const r=n.web3_wallet_address,s=r.substring(0,8)+"..."+r.substring(r.length-6);o.myWalletAddressText.textContent=s,o.copyMyWalletBtn.dataset.address=r,o.myWalletAddressContainer.style.display="flex"}else o.myWalletAddressContainer&&(o.myWalletAddressContainer.style.display="none")}}catch(e){console.error("Error al obtener saldos:",e)}}function ft(e){e.next_available_at&&parseFloat(e.next_available_amount)>0&&o.availableCountdownContainer?(o.availableCountdownContainer.style.display="block",gt(e.next_available_at,e.next_available_amount)):o.availableCountdownContainer&&(o.availableCountdownContainer.style.display="none"),e.next_due_at&&parseFloat(e.next_due_amount)>0&&o.debtCountdownContainer?(o.debtCountdownContainer.style.display="block",yt(e.next_due_at,e.next_due_amount)):o.debtCountdownContainer&&(o.debtCountdownContainer.style.display="none"),e.next_unlock_at&&parseFloat(e.next_unlock_amount)>0&&o.escrowCountdownContainer?(o.escrowCountdownContainer.style.display="block",ht(e.next_unlock_at,e.next_unlock_amount)):o.escrowCountdownContainer&&(o.escrowCountdownContainer.style.display="none")}function gt(e,t){F&&clearInterval(F);const n=c(t),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){o.availableCountdownContainer&&(o.availableCountdownContainer.style.display="none"),clearInterval(F),F=null,ue();return}const u=pe(s);o.availableCountdownText&&(o.availableCountdownText.innerHTML=`Próxima liberación <strong class="saldo-blue-text">${n}</strong> en <strong>${u}</strong>`)};i(),F=setInterval(i,1e3)}function yt(e,t){T&&clearInterval(T);const n=c(t),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){o.debtCountdownText&&(o.debtCountdownText.innerHTML=`<strong class="expired">URGENTE! ${n} VENCIDOS!</strong>`),clearInterval(T);return}const u=pe(s);o.debtCountdownText&&(o.debtCountdownText.innerHTML=`próximo vencimiento <strong class="saldo-red-text">${n}</strong> en <strong>${u}</strong>`)};i(),T=setInterval(i,1e3)}function ht(e,t){L&&clearInterval(L);const n=c(t),i=()=>{const a=new Date,s=new Date(e)-a;if(s<=0){o.escrowCountdownContainer&&(o.escrowCountdownContainer.style.display="none"),clearInterval(L),ue();return}const u=pe(s);o.escrowCountdownText&&(o.escrowCountdownText.innerHTML=`Disponible <strong class="saldo-blue-text">${n}</strong> en <strong>${u}</strong>`)};i(),L=setInterval(i,1e3)}function pe(e){const t=Math.floor(e/864e5),n=Math.floor(e%(1e3*60*60*24)/(1e3*60*60)),i=Math.floor(e%(1e3*60*60)/(1e3*60)),a=Math.floor(e%(1e3*60)/1e3);return t>0?`${t}d y ${n}h`:n>0?`${n}h y ${i}m`:i>0?`${i}m y ${a}s`:`${a}s`}function bt(e,t,n){if(!o.ratingForm)return;o.ratingForm.reset();const i=document.getElementById("ratingPublicationId"),a=document.getElementById("ratingRaterUsername"),r=document.getElementById("ratingRateeUsername"),s=document.getElementById("ratingModalTitle");i&&(i.value=e),a&&(a.value=t),r&&(r.value=n),s&&(s.textContent=`Calificar a ${n}`),o.ratingModal&&(o.ratingModal.style.display="flex")}async function wt(){try{const e=await fetch(`${l}/api/referral-settings`);if(e.ok){const t=await e.json(),n=document.getElementById("referralAmount");n&&t.referral_reward_amount&&(n.textContent=parseInt(t.referral_reward_amount,10));const i=document.getElementById("referralRemainingSlots"),a=document.getElementById("promoSlotsLabel"),r=document.getElementById("referralCardSubtitle"),s=document.getElementById("referralCardBtnText"),u=document.getElementById("campaignBgOverlay"),m=document.getElementById("campaignCodeNotice"),p=document.getElementById("shareReferralCard");if(i&&typeof t.referral_remaining_slots<"u"){const h=parseInt(t.referral_remaining_slots,10);if(h<=0&&parseFloat(t.referral_reward_amount)<=0){const y=document.querySelector(".promo-timer-container");y&&(y.style.display="none")}else i.textContent=h.toLocaleString("es-ES")}if(t.referral_custom_share_code_enabled===!0){a&&t.referral_card_title&&(a.textContent=t.referral_card_title,a.style.color="#fff",a.style.fontWeight="700",a.style.fontSize="1.1rem"),r&&t.referral_card_subtitle&&(r.textContent=t.referral_card_subtitle,r.style.color="rgba(255, 255, 255, 0.95)",r.style.textShadow="0 1px 4px rgba(0, 0, 0, 0.8)",r.style.fontWeight="700");const h=document.getElementById("promoSlotsPrefix"),y=document.getElementById("referralRemainingLabel");if(h&&(h.style.color="rgba(255, 255, 255, 0.95)",h.style.textShadow="0 1px 4px rgba(0, 0, 0, 0.8)"),y&&(y.style.color="rgba(255, 255, 255, 0.95)",y.style.textShadow="0 1px 4px rgba(0, 0, 0, 0.8)"),s&&t.referral_card_button_text&&(s.textContent=t.referral_card_button_text),u&&t.referral_campaign_image_url){let g=t.referral_campaign_image_url;g.startsWith("http://")||g.startsWith("https://")||g.startsWith("//")?u.style.backgroundImage=`url('${g}')`:(!g.startsWith("/api")&&g.startsWith("/uploads")&&(g="/api"+g),u.style.backgroundImage=`url('${l}${g}')`),u.style.display="block",p&&(p.style.backgroundColor="transparent",p.style.border="1px solid rgba(255,255,255,0.1)")}m&&t.referral_custom_share_code&&(m.textContent=`Código a enviar: ${t.referral_custom_share_code}`,m.style.display="block")}else{a&&(a.textContent="CUPOS DISPONIBLES:",a.style=""),r&&(r.textContent="Bono por referir hoy",r.style="");const h=document.getElementById("promoSlotsPrefix"),y=document.getElementById("referralRemainingLabel");h&&(h.style=""),y&&(y.style=""),s&&(s.textContent="Compartir mi código"),u&&(u.style.display="none"),m&&(m.style.display="none"),p&&(p.style="")}}}catch(e){console.error("Error al cargar configuración de referidos:",e)}}async function vt(){try{const e=localStorage.getItem("username");if(!e){v("Error: No se pudo obtener tu información de usuario.");return}const[t,n]=await Promise.all([fetch(`${l}/api/users/${e}/referral-info`),fetch(`${l}/api/referral-settings`)]);if(t.ok&&n.ok){const i=await t.json(),a=await n.json(),r=i.referral_code,s=a.referral_custom_share_code||"WINTON",m=a.referral_custom_share_code_enabled===!0?s:r,p=parseInt(a.referral_reward_amount,10)||0,b=`${window.location.origin}/register.html?ref=${m}`,y=(a.referral_share_message_template||`¡Hola! Únete a WintonCoin usando mi código {code} y ambos ganaremos {reward} BLUE IOU de bienvenida.

👉 Regístrate gratis aquí: {link}`).replace(/{code}/g,m).replace(/{reward}/g,p).replace(/{link}/g,b);navigator.share?await navigator.share({title:"¡Únete a WintonCoin!",text:y}):(await copyTextToClipboard(y),v("¡Mensaje de invitación copiado! Compártelo con tus amigos."))}else v("Error al obtener tu código de referido.")}catch(e){console.error("Error al compartir código de referido:",e),e.name!=="AbortError"&&v("Error al compartir el código de referido.")}}function Et(){const e=document.getElementById("shareReferralCard");e&&e.addEventListener("click",vt)}async function xt(){if(!o.boosterSummary)return;const e=Date.now();if(e-ge<6e4)return;ge=e;const t=localStorage.getItem("token");if(t)try{const n=await fetch(`${l}/api/me/booster-profile`,{headers:{Authorization:`Bearer ${t}`}});if(N(n))return;const i=await n.json();if(!n.ok||!i?.is_booster){o.boosterTotalBlue&&(o.boosterTotalBlue.innerHTML='<span class="booster-total-value">0</span> <span class="booster-total-unit">BLUE iou</span>');return}const a=Number(i.total_booster_blue||0),r=i.next_level_info,s=r?Number(r.min_blue_required||0):0;o.boosterTotalBlue&&(o.boosterTotalBlue.innerHTML=`<span class="booster-total-value">${c(a)}</span> <span class="booster-total-unit">BLUE iou</span>`);let u=100,m="Nivel máximo alcanzado";s>0&&(u=Math.min(100,a/s*100),m=`${a.toFixed(4)} / ${s.toFixed(4)} BLUE iou`),o.boosterProgressText&&(o.boosterProgressText.textContent=m),o.boosterProgressFill&&(o.boosterProgressFill.style.width=`${u}%`)}catch(n){console.error("Error al cargar el resumen de impulsor:",n)}}async function _t(){const e=document.getElementById("solidarioDashboardCard"),t=Date.now();if(t-ye<6e4)return;ye=t;const n=localStorage.getItem("token");if(n)try{const i=document.getElementById("menuSolidarioHistory"),a=await fetch(`${l}/api/humanitarian/causes/my`,{headers:{Authorization:`Bearer ${n}`}});if(!a.ok){e&&(e.style.display="none"),i&&(i.style.display="block",i.href="solicitud-solidaria.html");return}const r=await a.json();if(!r.success||!r.causes||r.causes.length===0){e&&(e.style.display="none"),i&&(i.style.display="block",i.href="solicitud-solidaria.html");return}const s=r.causes.find(y=>y.status==="approved"||y.status==="pending");s?e&&St(e,s):e&&(e.style.display="none");const u=document.getElementById("solidarioHistoryLinkContainer"),m=document.getElementById("solidarioHistoryBtn"),p=document.getElementById("solidarioHistoryModal"),b=document.querySelector(".solidario-history-close"),h=document.getElementById("solidarioHistoryList");if(r.causes.length>0){u&&s&&(u.style.display="block");const y=g=>{g.preventDefault(),g.stopPropagation(),h.innerHTML="",r.causes.forEach((w,M)=>{const S=(parseFloat(w.current_amount)||0)+(parseFloat(w.amount_on_hold)||0),C=new Date(w.created_at).toLocaleDateString("es-ES");let x="";w.status==="completed"?x='<span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Culminada</span>':w.status==="approved"?x='<span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Activa</span>':w.status==="pending"?x='<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">Pendiente</span>':x=`<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${w.status}</span>`;const _=w.status==="approved"||w.status==="completed"?`<a href="causa-solidaria.html?id=${w.id}" style="color: #e83e8c; font-size: 0.8rem; text-decoration: underline; margin-top: 5px; display: inline-block;">Ver Detalle Público</a>`:"",B=`
                            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); padding: 15px; border-radius: 12px; position: relative;">
                                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                                    <h4 style="margin:0; font-size: 0.95rem; color: #f8fafc; line-height: 1.3; max-width: 70%;">${w.title}</h4>
                                    ${x}
                                </div>
                                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #94a3b8;">
                                    <span>Recaudado: <strong style="color:white;">${S.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})} BLUE</strong></span>
                                    <span>${C}</span>
                                </div>
                                ${_}
                            </div>
                        `;h.innerHTML+=B}),p.style.display="flex"};m&&p&&b&&h&&(m.onclick=y,b.onclick=()=>{p.style.display="none"},window.addEventListener("click",g=>{g.target===p&&(p.style.display="none")})),i&&(i.style.display="block",i.href="#",i.onclick=g=>{const w=document.getElementById("profileDropdown");w&&w.classList.remove("show"),y(g)})}else u&&(u.style.display="none"),i&&(i.style.display="block",i.href="solicitud-solidaria.html",i.onclick=null)}catch(i){console.error("[Solidario] Error al cargar resumen:",i),e.style.display="none";const a=document.getElementById("menuSolidarioHistory");a&&(a.style.display="block",a.href="solicitud-solidaria.html")}}function St(e,t){e.style.display="block",e.onclick=()=>{(t.status==="approved"||t.status==="completed")&&(window.location.href=`causa-solidaria.html?id=${t.id}`)};const n=document.getElementById("solidarioCardHeaderTitle");n&&(n.textContent=`Donación a la causa de ${d}`);const i=document.getElementById("solidarioCardCauseTitle");i&&(i.textContent=t.title);const a=parseFloat(t.current_amount)||0,r=parseFloat(t.amount_on_hold)||0,s=parseFloat(t.goal_amount)||0,u=a+r,m=s>0?Math.min(a/s*100,100):0,p=s>0?Math.min(r/s*100,100-m):0,b=document.getElementById("solidarioCardAmount"),h=document.getElementById("solidarioCardGoal"),y=document.getElementById("solidarioCardProgressFill"),g=document.getElementById("solidarioCardProgressFillHold");b&&(b.textContent=u.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})),h&&(h.textContent=s.toLocaleString("es-ES",{minimumFractionDigits:4,maximumFractionDigits:4})),y&&(y.style.width=`${m.toFixed(1)}%`,y.style.background="",y.style.borderRadius=p>0?"6px 0 0 6px":"6px"),g&&(g.style.width=`${p.toFixed(1)}%`,g.style.borderRadius="0 3px 3px 0");const w=document.getElementById("solidarioCardShareBtn");w&&(t.status==="approved"?(w.style.opacity="1",w.style.pointerEvents="auto",w.onclick=M=>{M.stopPropagation();const S=`${window.location.origin}/causa-solidaria.html?id=${t.id}`,C=`💙 Apoya mi causa "${t.title}" en WintonCoin.

Dona tus BLUE IOU y marca la diferencia:`;if(navigator.share)navigator.share({title:`Winton Solidario: ${t.title}`,text:C,url:S}).catch(()=>{});else{const x=`${C}
${S}`,_=`https://wa.me/?text=${encodeURIComponent(x)}`;window.open(_,"_blank")}}):(w.style.opacity="0.5",w.style.pointerEvents="none"))}const z=document.getElementById("quickSaleModal"),ke=document.getElementById("openQuickSaleModalBtn"),Be=document.querySelector(".quick-sale-close"),te=document.getElementById("quickSaleForm"),V=document.getElementById("qrCodeModal"),Ce=document.querySelector(".qr-code-close"),ne=document.getElementById("qrCodeOutput"),oe=document.getElementById("qrCodeUrl"),Ie=document.getElementById("copyQrCodeUrl");let kt=null;ke&&z&&ke.addEventListener("click",e=>{e.preventDefault(),z.style.display="flex"}),Be&&Be.addEventListener("click",()=>{z.style.display="none"}),Ce&&Ce.addEventListener("click",()=>{V.style.display="none"}),window.addEventListener("click",e=>{e.target===z&&(z.style.display="none"),e.target===V&&(V.style.display="none")}),te&&te.addEventListener("submit",async e=>{e.preventDefault();const t=new FormData(te),n={title:t.get("title"),amount:t.get("amount"),targetUsername:t.get("targetUsername"),authorUsername:d};try{const i=localStorage.getItem("token"),a=await fetch(`${l}/api/quick-sale`,{method:"POST",headers:{"Content-Type":"application/json",...i&&{Authorization:`Bearer ${i}`}},body:JSON.stringify(n)});if(N(a))return;const r=await a.json();if(a.ok){z.style.display="none",te.reset();const s=`${window.location.origin}/publication-detail.html?id=${r.publicationId}`;ne&&(ne.innerHTML=""),typeof QRCode<"u"&&ne&&(kt=new QRCode(ne,{text:s,width:256,height:256,colorDark:"#000000",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.H})),oe&&(oe.value=s),V&&(V.style.display="flex")}else v(r.message||"Error al crear la venta rápida.")}catch(i){console.error("Error en el submit de Venta Rápida:",i),v("Error de conexión al crear la venta rápida.")}}),Ie&&Ie.addEventListener("click",()=>{oe&&(oe.select(),document.execCommand("copy"),v("¡Enlace copiado al portapapeles!"))})});
//# sourceMappingURL=dashboard.DQu7dDBt.js.map
