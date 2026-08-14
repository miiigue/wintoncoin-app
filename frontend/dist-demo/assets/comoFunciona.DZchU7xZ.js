import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{g as f}from"./auth.BgcrufBo.js";console.log("Página Cómo Funciona cargada");document.addEventListener("DOMContentLoaded",()=>{p()});(document.readyState==="interactive"||document.readyState==="complete")&&p();const h=f();function p(){const t=document.getElementById("youtubeModal");if(!t)return;const o=document.getElementById("youtubeCloseBtn"),c=document.getElementById("youtubeVideoContainer");function y(e){c.innerHTML=`<iframe src="https://www.youtube-nocookie.com/embed/${e}?autoplay=1&rel=0&modestbranding=1&hl=es" title="YouTube video player" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`,t.classList.add("active"),document.body.style.overflow="hidden"}function a(){t.classList.remove("active"),document.body.style.overflow="",setTimeout(()=>{c.innerHTML=""},300)}if(o){const e=o.cloneNode(!0);o.parentNode.replaceChild(e,o),e.addEventListener("click",a)}t.addEventListener("click",e=>{e.target===t&&a()}),document.addEventListener("keydown",e=>{e.key==="Escape"&&t.classList.contains("active")&&a()});async function v(){const e=document.getElementById("dynamic-academy-grid");if(e)try{const n=await fetch(`${h}/api/academy/public`);if(!n.ok)throw new Error("Error al sincronizar con Winton Academy");const r=await n.json(),d=Array.isArray(r)?r:r.videos||[];if(d.length===0){e.innerHTML='<p style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Actualmente la academia está siendo actualizada. Vuelve pronto.</p>';return}e.innerHTML="",d.forEach(l=>{const s=String(l.title).replace(/</g,"&lt;").replace(/>/g,"&gt;"),i=String(l.youtube_id).replace(/[^a-zA-Z0-9_\-]/g,""),g=`
                    <div class="video-academy-card" data-video-id="${i}">
                        <div class="video-thumbnail-container">
                            <img src="https://img.youtube.com/vi/${i}/maxresdefault.jpg" alt="${s}" 
                                 onerror="this.src='https://img.youtube.com/vi/${i}/hqdefault.jpg'"> 
                            <div class="video-play-button">
                                <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                            </div>
                        </div>
                        <div class="video-info">
                            <h3 class="video-title">${s}</h3>
                        </div>
                    </div>
                `,m=document.createElement("div");m.innerHTML=g.trim();const u=m.firstChild;u.addEventListener("click",()=>{y(i)}),e.appendChild(u)})}catch(n){console.error("CoreCMS Error:",n),e.innerHTML='<p style="grid-column: 1 / -1; text-align: center; color: var(--error-color);">No se pudo cargar la Winton Academy por el momento.</p>'}}v()}
//# sourceMappingURL=comoFunciona.DZchU7xZ.js.map
