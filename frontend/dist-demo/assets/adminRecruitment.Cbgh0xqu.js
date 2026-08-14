import"./modulepreload-polyfill.B5Qt9EMX.js";/* empty css              */import"./index.pbqrtUCb.js";import{s as o,g as k}from"./auth.BgcrufBo.js";const b=k();async function E(t){const e=await fetch(`${b}${t}`,{headers:{"Content-Type":"application/json"},credentials:"include"});if(e.status===401||e.status===403)throw window.location.href="admin.html",new Error("Sesión expirada.");return e.json()}async function y(t,e,n){const a=await fetch(`${b}${t}`,{method:e,headers:{"Content-Type":"application/json"},credentials:"include",body:JSON.stringify(n)});if(a.status===401||a.status===403)throw window.location.href="admin.html",new Error("Sesión expirada.");return a.json()}const h=document.getElementById("talentTableBody"),x=document.getElementById("searchInput"),v=document.getElementById("statusFilter"),_=document.getElementById("roleFilter");async function d(){try{const t=new URLSearchParams,e=v.value,n=_.value,a=x.value.trim();e!=="all"&&t.set("status",e),n!=="all"&&t.set("role",n),a&&t.set("search",a);const r=await E(`/api/recruitment/admin/list?${t.toString()}`);if(!r.success)throw new Error(r.message);$(r.proposals),C(r.proposals)}catch(t){h.innerHTML=`<tr><td colspan="7" class="empty-state">
                    <div class="emoji">⚠️</div>
                    <p>Error al cargar: ${t.message}</p>
                </td></tr>`}}function $(t){if(t.length===0){h.innerHTML=`<tr><td colspan="7" class="empty-state">
                    <div class="emoji">📭</div>
                    <p>No hay postulaciones con estos filtros.</p>
                </td></tr>`;return}h.innerHTML=t.map(e=>{const n=new Date(e.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"short",year:"numeric"}),a=e.cv_url&&(e.cv_url.startsWith("http://")||e.cv_url.startsWith("https://"))?e.cv_url:null,r=e.linkedin_url&&(e.linkedin_url.startsWith("http://")||e.linkedin_url.startsWith("https://"))?e.linkedin_url:null,i=e.portfolio_url&&(e.portfolio_url.startsWith("http://")||e.portfolio_url.startsWith("https://"))?e.portfolio_url:null,c=e.github_url&&(e.github_url.startsWith("http://")||e.github_url.startsWith("https://"))?e.github_url:null;return`
                    <tr class="talent-row" onclick="openCandidateModal(${e.id})" style="cursor: pointer;">
                        <td>
                            <div class="talent-profile">
                                <div class="avatar">${u(e.full_name.charAt(0))}</div>
                                <div class="info">
                                    <span class="name">${u(e.full_name)}</span>
                                    <span class="id">ID: #${e.id} ${e.years_experience?`· ${u(e.years_experience)}`:""}</span>
                                </div>
                            </div>
                        </td>
                        <td>
                            <div class="contact-info" style="display: flex; flex-direction: column; gap: 4px;">
                                <span class="email"><i class="far fa-envelope"></i> ${u(e.email)}</span>
                                <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 4px;" onclick="event.stopPropagation()">
                                    ${a?`<a href="${s(a)}" target="_blank" rel="noopener noreferrer" class="linkedin-link" style="color: #60A5FA; background: rgba(59,130,246,0.1); padding: 2px 8px; border-radius: 6px;"><i class="fas fa-file-alt"></i> Ver CV ↗</a>`:""}
                                    ${r?`<a href="${s(r)}" target="_blank" rel="noopener noreferrer" class="linkedin-link" style="padding: 2px 8px; border-radius: 6px;"><i class="fab fa-linkedin"></i> LinkedIn ↗</a>`:""}
                                    ${i?`<a href="${s(i)}" target="_blank" rel="noopener noreferrer" class="linkedin-link" style="color: #34D399; background: rgba(52,211,153,0.1); padding: 2px 8px; border-radius: 6px;"><i class="fas fa-globe"></i> Portfolio ↗</a>`:""}
                                    ${c?`<a href="${s(c)}" target="_blank" rel="noopener noreferrer" class="linkedin-link" style="color: #E2E8F0; background: rgba(255,255,255,0.08); padding: 2px 8px; border-radius: 6px;"><i class="fab fa-github"></i> GitHub ↗</a>`:""}
                                </div>
                            </div>
                        </td>
                        <td><span class="badge role">${u(e.role)}</span></td>
                        <td><span class="salary-text highlight">${e.expected_salary?`$ ${u(e.expected_salary)}`:"N/A"}</span></td>
                        <td><span class="date">${n}</span></td>
                        <td><span class="status-btn ${e.status}">${e.status.toUpperCase()}</span></td>
                        <td class="text-right" onclick="event.stopPropagation()">
                            <div class="actions">
                                <button onclick="openCandidateModal(${e.id})" class="btn-action review" title="Ver Ficha Completa del Candidato">
                                    <i class="fas fa-eye"></i>
                                </button>
                                ${["pending","reviewing"].includes(e.status)?`
                                    <button onclick="updateStatus(${e.id}, 'accepted')" class="btn-action accept" title="Aceptar">
                                        <i class="fas fa-check"></i>
                                    </button>
                                    <button onclick="updateStatus(${e.id}, 'rejected')" class="btn-action reject" title="Rechazar">
                                        <i class="fas fa-times"></i>
                                    </button>
                                `:""}
                            </div>
                        </td>
                    </tr>
                `}).join("")}let p=new Map,l=null;function C(t){p.clear(),t.forEach(r=>p.set(r.id,r));const e=t.length,n=t.filter(r=>r.status==="pending").length,a=t.filter(r=>r.status==="reviewing").length;document.getElementById("statTotal").textContent=e,document.getElementById("statPending").textContent=n,document.getElementById("statReviewing").textContent=a}function I(t){const e=p.get(t);if(!e)return;l=t;const n=document.getElementById("candidateDetailModal");if(!n)return;document.getElementById("modalAvatar").textContent=e.full_name.charAt(0).toUpperCase(),document.getElementById("modalFullName").textContent=e.full_name;const a=document.getElementById("modalStatusBadge");a.className=`status-btn ${e.status}`,a.textContent=e.status.toUpperCase(),document.getElementById("modalRole").textContent=e.role,document.getElementById("modalYearsExperience").textContent=e.years_experience||"Experiencia no especificada",document.getElementById("modalEmail").textContent=e.email,document.getElementById("modalSalary").textContent=e.expected_salary?`$ ${e.expected_salary} USD / mes`:"No especificado";const r=new Date(e.created_at).toLocaleDateString("es-ES",{day:"2-digit",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});document.getElementById("modalDate").textContent=r;const i=document.getElementById("modalLinksContainer");i.innerHTML="";const c=e.cv_url&&/^https?:\/\//i.test(e.cv_url)?e.cv_url:null,f=e.linkedin_url&&/^https?:\/\//i.test(e.linkedin_url)?e.linkedin_url:null,m=e.portfolio_url&&/^https?:\/\//i.test(e.portfolio_url)?e.portfolio_url:null,g=e.github_url&&/^https?:\/\//i.test(e.github_url)?e.github_url:null;c&&(i.innerHTML+=`
                    <a href="${s(c)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #2563eb, #1d4ed8); color: white; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 0.9rem; box-shadow: 0 4px 15px rgba(37,99,235,0.3);">
                        <i class="fas fa-file-alt"></i> Abrir CV en la Nube ↗
                    </a>
                `),f&&(i.innerHTML+=`
                    <a href="${s(f)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: #0a66c2; color: white; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
                        <i class="fab fa-linkedin"></i> Perfil LinkedIn ↗
                    </a>
                `),m&&(i.innerHTML+=`
                    <a href="${s(m)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(52,211,153,0.15); border: 1px solid rgba(52,211,153,0.3); color: #34d399; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
                        <i class="fas fa-globe"></i> Portfolio / Sitio Web ↗
                    </a>
                `),g&&(i.innerHTML+=`
                    <a href="${s(g)}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 10px 18px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 0.9rem;">
                        <i class="fab fa-github"></i> Repositorio GitHub ↗
                    </a>
                `),!c&&!f&&!m&&!g&&(i.innerHTML='<span style="color: #64748b; font-size: 0.85rem;">No se proporcionaron enlaces adicionales.</span>'),document.getElementById("modalCoverLetter").textContent=e.cover_letter||"Sin carta de presentación.",document.getElementById("modalReviewerNotes").value=e.reviewer_notes||"",n.style.display="flex"}function w(){const t=document.getElementById("candidateDetailModal");t&&(t.style.display="none"),l=null}async function B(t){if(!l)return;const e=document.getElementById("modalReviewerNotes")?.value?.trim()||null;try{const n=await y(`/api/recruitment/admin/${l}/status`,"PATCH",{status:t,notes:e});n.success?(w(),d()):o("Error: "+n.message)}catch(n){o("Error al actualizar estado: "+n.message)}}async function L(){if(!l)return;const t=p.get(l);if(!t)return;const e=document.getElementById("modalReviewerNotes")?.value?.trim()||"";try{const n=await y(`/api/recruitment/admin/${l}/status`,"PATCH",{status:t.status,notes:e});n.success?(o("✅ Observaciones guardadas con éxito."),d()):o("Error: "+n.message)}catch(n){o("Error al guardar notas: "+n.message)}}async function M(t,e){const n=e==="rejected"?prompt("¿Motivo del rechazo? (opcional):"):null;try{const a=await y(`/api/recruitment/admin/${t}/status`,"PATCH",{status:e,notes:n});a.success?d():o("Error: "+a.message)}catch(a){o("Error de conexión: "+a.message)}}window.openCandidateModal=I;window.closeCandidateModal=w;window.changeStatusFromModal=B;window.saveCandidateNotes=L;window.updateStatus=M;function u(t){if(!t)return"";const e=document.createElement("div");return e.textContent=t,e.innerHTML}function s(t){return t?t.replace(/"/g,"&quot;").replace(/'/g,"&#39;"):""}x.addEventListener("input",S(d,400));v.addEventListener("change",d);_.addEventListener("change",d);function S(t,e){let n;return function(...a){clearTimeout(n),n=setTimeout(()=>t.apply(this,a),e)}}d();
//# sourceMappingURL=adminRecruitment.Cbgh0xqu.js.map
