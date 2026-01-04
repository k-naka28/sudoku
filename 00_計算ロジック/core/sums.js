// window.SudokuSums: 合計UIの生成と更新
(function(w){
  function initSums(rowEl,colEl,blockEl){
    const lab=document.createElement('div'); lab.className='label'; lab.textContent='ブロック合計'; blockEl.appendChild(lab);
    const blockCells=Array.from({length:9},()=>{const d=document.createElement('div');d.className='bcell';blockEl.appendChild(d);return d});
    const rowCells=Array.from({length:9},()=>{const d=document.createElement('div');d.className='sumcell';rowEl.appendChild(d);return d});
    const colCells=Array.from({length:9},()=>{const d=document.createElement('div');d.className='sumcell';colEl.appendChild(d);return d});
    return {blockCells,rowCells,colCells};
  }
  function updateSums(g,rowCells,colCells,blockCells){
    const {isRowValid,isColValid}=window.SudokuCore;
    for(let r=0;r<9;r++){const sum=g[r].reduce((a,b)=>a+(b||0),0),filled=g[r].filter(v=>v).length,ok=sum===45&&filled===9&&isRowValid(g,r),bad=sum>45||!isRowValid(g,r);
      rowCells[r].className=`sumcell ${ok?'ok':bad?'err':'warn'}`;rowCells[r].textContent=String(sum||0)}
    for(let c=0;c<9;c++){let sum=0,filled=0;for(let r=0;r<9;r++){const v=g[r][c];sum+=v||0;if(v)filled++}
      const ok=sum===45&&filled===9&&isColValid(g,c),bad=sum>45||!isColValid(g,c);
      colCells[c].className=`sumcell ${ok?'ok':bad?'err':'warn'}`;colCells[c].textContent=String(sum||0)}
    for(let b=0;b<9;b++){const br=Math.floor(b/3)*3,bc=(b%3)*3;let sum=0,filled=0;const s=new Set();let valid=true;
      for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){const v=g[br+dr][bc+dc];sum+=v||0;if(v){filled++;if(s.has(v))valid=false;s.add(v)}}
      const ok=sum===45&&filled===9&&valid,bad=sum>45||!valid;blockCells[b].className=`bcell ${ok?'ok':bad?'err':'warn'}`;blockCells[b].textContent=String(sum||0)}
  }
  w.SudokuSums={initSums,updateSums};
})(window);