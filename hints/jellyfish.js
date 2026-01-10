// hints/jellyfish.js
// Jellyfish（X-Wingの4本版）：除去→Naked single なら 1手、なければ消去ヒント
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

  function rowJellyfish(cand, opts){
    for(let d=1; d<=9; d++){
      const rowsInfo = [];
      for(let r=0;r<9;r++){
        const cols=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) cols.push(c);
        if(cols.length>=2 && cols.length<=4) rowsInfo.push({r,cols});
      }
      const n=rowsInfo.length;
      if(n < 4) continue;
      for(let i=0;i<n-3;i++) for(let j=i+1;j<n-2;j++) for(let k=j+1;k<n-1;k++) for(let l=k+1;l<n;l++){
        const R=[rowsInfo[i],rowsInfo[j],rowsInfo[k],rowsInfo[l]];
        const setCols = new Set([...R[0].cols, ...R[1].cols, ...R[2].cols, ...R[3].cols]);
        if(setCols.size!==4) continue;
        const cols=[...setCols].sort((a,b)=>a-b);
        const rows=[R[0].r, R[1].r, R[2].r, R[3].r];
        const next=clone(cand); let changed=false; const eliminated=[];
        for(let r=0;r<9;r++){
          if(rows.includes(r)) continue;
          for(const c of cols){
            const a=next[r][c]; const ix=a.indexOf(d);
            if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
          }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'jellyfish-row',d,rows,cols,eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'jellyfish-row',d,rows,cols,eliminated,eliminations};
      }
    }
    return null;
  }

  function colJellyfish(cand, opts){
    for(let d=1; d<=9; d++){
      const colsInfo = [];
      for(let c=0;c<9;c++){
        const rows=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) rows.push(r);
        if(rows.length>=2 && rows.length<=4) colsInfo.push({c,rows});
      }
      const n=colsInfo.length;
      if(n < 4) continue;
      for(let i=0;i<n-3;i++) for(let j=i+1;j<n-2;j++) for(let k=j+1;k<n-1;k++) for(let l=k+1;l<n;l++){
        const C=[colsInfo[i],colsInfo[j],colsInfo[k],colsInfo[l]];
        const setRows = new Set([...C[0].rows, ...C[1].rows, ...C[2].rows, ...C[3].rows]);
        if(setRows.size!==4) continue;
        const rows=[...setRows].sort((a,b)=>a-b);
        const cols=[C[0].c, C[1].c, C[2].c, C[3].c];
        const next=clone(cand); let changed=false; const eliminated=[];
        for(let c=0;c<9;c++){
          if(cols.includes(c)) continue;
          for(const r of rows){
            const a=next[r][c]; const ix=a.indexOf(d);
            if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
          }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'jellyfish-col',d,rows,cols,eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'jellyfish-col',d,rows,cols,eliminated,eliminations};
      }
    }
    return null;
  }

  function findJellyfish(cand, opts){ return rowJellyfish(cand,opts) || colJellyfish(cand,opts) || null; }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findJellyfish = findJellyfish;
})(window);
