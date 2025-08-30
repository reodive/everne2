// Lightweight debug overlay. Enable with ?debug=1 or localStorage.DEBUG='1'
(function(){
  const enabled = /[?&]debug=1/.test(location.search) || localStorage.getItem('DEBUG') === '1';
  if (!enabled) return;
  const box = document.createElement('div');
  box.style.position = 'fixed';
  box.style.bottom = '10px';
  box.style.left = '10px';
  box.style.padding = '8px 10px';
  box.style.background = 'rgba(0,0,0,.7)';
  box.style.color = '#fff';
  box.style.font = '12px/1.4 -apple-system,Segoe UI,Roboto,Arial';
  box.style.borderRadius = '8px';
  box.style.zIndex = '9999';
  box.style.maxWidth = '60vw';

  const btns = document.createElement('div');
  btns.style.marginTop = '6px';
  btns.innerHTML = '<button id="dbg-recalc">Recalc</button> <button id="dbg-borders">Borders</button> <button id="dbg-off">Off</button>';
  Array.from(btns.querySelectorAll('button')).forEach(b=>{
    b.style.marginRight = '6px';
    b.style.fontSize = '12px';
  });

  function setText(txt){ box.firstChild ? box.firstChild.textContent = txt : box.prepend(document.createTextNode(txt)); }
  function update(){
    let txt = `[${location.pathname}]`;
    const css = Array.from(document.styleSheets).length;
    txt += ` css:${css}`;
    const s = window.__slider?.state?.();
    if (s) txt += ` | slider index:${s.index} w:${s.wrapper} itemW:${s.slideWidth} count:${s.count}`;
    setText(txt);
  }
  setInterval(update, 1000);
  update();

  btns.querySelector('#dbg-recalc').onclick = () => window.__slider?.layout?.();
  btns.querySelector('#dbg-borders').onclick = () => {
    document.body.classList.toggle('dbg-borders');
  };
  btns.querySelector('#dbg-off').onclick = () => { box.remove(); localStorage.removeItem('DEBUG'); };

  box.appendChild(btns);
  document.addEventListener('DOMContentLoaded', ()=> document.body.appendChild(box));

  // small border style
  const style = document.createElement('style');
  style.textContent = `.dbg-borders .slides{outline:2px dashed #0ff}.dbg-borders .slide{outline:1px solid #f80}.dbg-borders .slide img{outline:1px solid #fff}`;
  document.head.appendChild(style);
})();

