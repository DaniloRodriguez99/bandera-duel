import { CLASS_IDS, CLASSES, DEFAULT_CLASS, validClass, type ClassId } from '@bandera/shared';
import { classIllustration } from './art.js';
export function savedClass(): ClassId { const saved=localStorage.getItem('bandera-class');return validClass(saved)?saved:DEFAULT_CLASS; }
export function saveClass(classId:ClassId) { localStorage.setItem('bandera-class',classId); }
export function mountClasses(root:HTMLElement, selected:ClassId, choose:(id:ClassId)=>void) {
  root.innerHTML=CLASS_IDS.map(id=>{const c=CLASSES[id];return `<button type="button" class="class-card" data-class="${id}" aria-pressed="${id===selected}" aria-label="Elegir ${c.name}: ${c.label.toLowerCase()}">${classIllustration(id)}<strong>${c.name}</strong><span class="class-equipment">${c.label}</span><span class="class-stats">${'♥'.repeat(c.hp)} · ${c.speed>=180?'LIGERO':'PESADO'}</span><small>${c.description}</small></button>`;}).join('');
  root.querySelectorAll<HTMLButtonElement>('[data-class]').forEach(b=>b.onclick=()=>choose(b.dataset.class as ClassId));
}
export function updateClasses(root:HTMLElement, selected:ClassId, disabled=false) {
  root.querySelectorAll<HTMLButtonElement>('[data-class]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.class===selected));b.disabled=disabled;});
}
