// Copyright (c) 2026 nmvuong92
// SPDX-License-Identifier: Apache-2.0
/* shellScript — JS vanilla TÍ HON chạy trên MỌI trang (kể cả static 0-React-JS) để:
 *  - no-flash theme: đọc localStorage.theme → set data-theme ngay khi parse (trước content).
 *  - nút .theme-toggle: đổi light/dark + lưu localStorage (không cần React hydrate).
 *  - .nav-link active theo path; cập nhật khi SPA nav ("fluxe:nav") + back/forward.
 * Layout nhúng <script>{shellScript}</script>. ~0.5KB, độc lập React → static cell vẫn tương tác. */
export const shellScript = `(function(){
var d=document.documentElement;
try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')d.dataset.theme=t;}catch(e){}
function active(){var p=location.pathname;document.querySelectorAll('.nav-link').forEach(function(a){try{a.classList.toggle('active',new URL(a.href).pathname===p);}catch(e){}});}
function wire(){var b=document.querySelector('[data-fluxe-theme-toggle]');if(b&&!b._w){b._w=1;b.addEventListener('click',function(){var n=d.dataset.theme==='dark'?'light':'dark';d.dataset.theme=n;try{localStorage.setItem('theme',n);}catch(e){}document.cookie='theme='+n+';Path=/;Max-Age=31536000;SameSite=Lax';});}active();}
if(document.readyState!=='loading')wire();else document.addEventListener('DOMContentLoaded',wire);
addEventListener('fluxe:nav',active);addEventListener('popstate',active);
})();`;
