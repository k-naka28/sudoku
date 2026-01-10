// window.SudokuGrid: 盤面生成・読み書き・色
(function(w){
  const inputs=[], wraps=[], cands=[];
  let boardEl = null;
  function initBoard(el){
    boardEl = el;
    for(let r=0;r<9;r++){inputs[r]=[];wraps[r]=[];
      for(let c=0;c<9;c++){
        const wv=document.createElement('div'); wv.className=`cell r${r} c${c}`;
        const inp=document.createElement('input'); inp.setAttribute('inputmode','numeric'); inp.maxLength=1;
        const cand=document.createElement('div'); cand.className='cand';
        for(let d=1;d<=9;d++){ const s=document.createElement('span'); s.dataset.d=String(d); cand.appendChild(s); }
        wv.appendChild(inp); wv.appendChild(cand); el.appendChild(wv);
        inputs[r][c]=inp; wraps[r][c]=wv; cands[r]=cands[r]||[]; cands[r][c]=cand;
      }
    }
  }
  const readGrid=()=>Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>{const t=inputs[r][c].value.trim();return t?Number(t):0}));
  function renderGrid(g){for(let r=0;r<9;r++)for(let c=0;c<9;c++)inputs[r][c].value=g[r][c]?String(g[r][c]):''}
  function clearFlags(){for(let r=0;r<9;r++)for(let c=0;c<9;c++){wraps[r][c].className=`cell r${r} c${c}`;inputs[r][c].readOnly=false}}
  function applyGivenMask(g){clearFlags();for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(g[r][c]){wraps[r][c].classList.add('given');inputs[r][c].readOnly=true}}
  function setManualColor(v){document.documentElement.style.setProperty('--manual-color', v==='blue'?'#1d4ed8':'#111')}
  function showCandidates(cand, grid, eliminations){
    if(!boardEl) return;
    boardEl.classList.add('show-cand');
    const elimMap = new Map();
    if(eliminations){
      for(const e of eliminations){
        const key = `${e.r},${e.c}`;
        if(!elimMap.has(key)) elimMap.set(key, new Set());
        elimMap.get(key).add(e.d);
      }
    }
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      const cellCands = cand[r][c] || [];
      const spans = cands[r][c].children;
      const filled = grid && grid[r][c];
      const elim = elimMap.get(`${r},${c}`);
      for(let d=1;d<=9;d++){
        spans[d-1].textContent = (!filled && cellCands.includes(d)) ? String(d) : '';
        spans[d-1].className = (elim && elim.has(d)) ? 'elim' : '';
      }
    }
  }
  function hideCandidates(){
    if(!boardEl) return;
    boardEl.classList.remove('show-cand');
  }
  w.SudokuGrid={inputs,wraps,initBoard,readGrid,renderGrid,applyGivenMask,clearFlags,setManualColor,showCandidates,hideCandidates};
})(window);
