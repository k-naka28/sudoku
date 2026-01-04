// window.SudokuGrid: 盤面生成・読み書き・色
(function(w){
  const inputs=[], wraps=[];
  function initBoard(el){
    for(let r=0;r<9;r++){inputs[r]=[];wraps[r]=[];
      for(let c=0;c<9;c++){
        const wv=document.createElement('div'); wv.className=`cell r${r} c${c}`;
        const inp=document.createElement('input'); inp.setAttribute('inputmode','numeric'); inp.maxLength=1;
        wv.appendChild(inp); el.appendChild(wv); inputs[r][c]=inp; wraps[r][c]=wv;
      }
    }
  }
  const readGrid=()=>Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>{const t=inputs[r][c].value.trim();return t?Number(t):0}));
  function renderGrid(g){for(let r=0;r<9;r++)for(let c=0;c<9;c++)inputs[r][c].value=g[r][c]?String(g[r][c]):''}
  function clearFlags(){for(let r=0;r<9;r++)for(let c=0;c<9;c++){wraps[r][c].className=`cell r${r} c${c}`;inputs[r][c].readOnly=false}}
  function applyGivenMask(g){clearFlags();for(let r=0;r<9;r++)for(let c=0;c<9;c++)if(g[r][c]){wraps[r][c].classList.add('given');inputs[r][c].readOnly=true}}
  function setManualColor(v){document.documentElement.style.setProperty('--manual-color', v==='blue'?'#1d4ed8':'#111')}
  w.SudokuGrid={inputs,wraps,initBoard,readGrid,renderGrid,applyGivenMask,clearFlags,setManualColor};
})(window);