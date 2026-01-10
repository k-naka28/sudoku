// hints/kite.js
// Two-String Kite：除去→Naked single なら 1手、なければ消去ヒント
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const diffElims = (prev,next)=>{
    const out=[];
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      for(const d of prev[r][c]) if(!next[r][c].includes(d)) out.push({r,c,d});
    }
    return out;
  };
  const newSingle=(next,prev)=>{ for(let r=0;r<9;r++)for(let c=0;c<9;c++) if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]}; return null; };
  const bix = (r,c)=>Math.floor(r/3)*3+Math.floor(c/3);
  const sameBox = (a,b)=>bix(a[0],a[1])===bix(b[0],b[1]);

  const peersSet = (r,c)=>{
    const set = new Set();
    for(let i=0;i<9;i++){ if(i!==c) set.add(`${r},${i}`); if(i!==r) set.add(`${i},${c}`); }
    const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
    for(let dr=0;dr<3;dr++) for(let dc=0;dc<3;dc++){
      const rr=br+dr, cc=bc+dc;
      if(!(rr===r && cc===c)) set.add(`${rr},${cc}`);
    }
    return set;
  };
  const intersectPeers = (a,b,exclude)=>{
    const A=peersSet(a[0],a[1]);
    const B=peersSet(b[0],b[1]);
    const out=[];
    for(const key of A){
      if(!B.has(key)) continue;
      if(exclude && exclude.has(key)) continue;
      const [r,c]=key.split(',').map(Number);
      out.push([r,c]);
    }
    return out;
  };

  function findKite(cand, opts){
    for(let d=1; d<=9; d++){
      const rowPairs=[];
      for(let r=0;r<9;r++){
        const cols=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) cols.push(c);
        if(cols.length===2) rowPairs.push({r,cols});
      }
      const colPairs=[];
      for(let c=0;c<9;c++){
        const rows=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) rows.push(r);
        if(rows.length===2) colPairs.push({c,rows});
      }

      for(const rp of rowPairs){
        const r = rp.r;
        const rowCells = [[r,rp.cols[0]],[r,rp.cols[1]]];
        for(const cp of colPairs){
          const c = cp.c;
          const colCells = [[cp.rows[0],c],[cp.rows[1],c]];
          for(const baseR of rowCells){
            for(const baseC of colCells){
              if(baseR[0]===baseC[0] && baseR[1]===baseC[1]) continue;
              if(!sameBox(baseR, baseC)) continue;
              const roof1 = rowCells.find(([rr,cc])=>!(rr===baseR[0] && cc===baseR[1]));
              const roof2 = colCells.find(([rr,cc])=>!(rr===baseC[0] && cc===baseC[1]));
              const exclude = new Set([baseR, baseC, roof1, roof2].map(([rr,cc])=>`${rr},${cc}`));
              const targets = intersectPeers(roof1, roof2, exclude);
              if(targets.length===0) continue;

              const next=clone(cand); let changed=false; const eliminated=[];
              for(const [rr,cc] of targets){
                const a=next[rr][cc]; const ix=a.indexOf(d);
                if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([rr,cc]); }
              }
              if(!changed) continue;
              const eliminations = diffElims(cand,next);
              const s=newSingle(next,cand);
              if(s) return {...s,action:'place',kind:'kite',d,row:r,col:c,baseCells:[baseR,baseC],roofCells:[roof1,roof2],eliminated,eliminations};
              if(opts && opts.allowElim) return {action:'eliminate',kind:'kite',d,row:r,col:c,baseCells:[baseR,baseC],roofCells:[roof1,roof2],eliminated,eliminations};
            }
          }
        }
      }
    }
    return null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findKite = findKite;
})(window);
