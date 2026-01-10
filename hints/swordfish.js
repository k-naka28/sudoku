// hints/swordfish.js
// Swordfish（X-Wingの3本版）：除去→新しい Naked single が出たら 1手提示
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

  function rowSwordfish(cand, opts){
    for(let d=1; d<=9; d++){
      // 各行で d の候補列リストを収集（サイズ2〜3に限定）
      const rowsInfo = [];
      for(let r=0;r<9;r++){
        const cols=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) cols.push(c);
        if(cols.length>=2 && cols.length<=3) rowsInfo.push({r,cols});
      }
      const n=rowsInfo.length;
      for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) for(let k=j+1;k<n;k++){
        const R=[rowsInfo[i],rowsInfo[j],rowsInfo[k]];
        const setCols = new Set([...R[0].cols, ...R[1].cols, ...R[2].cols]);
        if(setCols.size!==3) continue; // 3行の候補列の合併が3列に収まる
        const [c1,c2,c3]=[...setCols];
        const rows = [R[0].r, R[1].r, R[2].r];
        const next=clone(cand); let changed=false; const eliminated=[];
        // その3列の「他の行」から d を削除
        for(let r=0;r<9;r++){
          if(rows.includes(r)) continue;
          for(const c of [c1,c2,c3]){
            const a=next[r][c]; const ix=a.indexOf(d);
            if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
          }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'swordfish-row',d,rows,cols:[c1,c2,c3],eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'swordfish-row',d,rows,cols:[c1,c2,c3],eliminated,eliminations};
      }
    }
    return null;
  }

  function colSwordfish(cand, opts){
    for(let d=1; d<=9; d++){
      const colsInfo = [];
      for(let c=0;c<9;c++){
        const rows=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) rows.push(r);
        if(rows.length>=2 && rows.length<=3) colsInfo.push({c,rows});
      }
      const n=colsInfo.length;
      for(let i=0;i<n;i++) for(let j=i+1;j<n;j++) for(let k=j+1;k<n;k++){
        const C=[colsInfo[i],colsInfo[j],colsInfo[k]];
        const setRows = new Set([...C[0].rows, ...C[1].rows, ...C[2].rows]);
        if(setRows.size!==3) continue;
        const [r1,r2,r3]=[...setRows];
        const cols = [C[0].c, C[1].c, C[2].c];
        const next=clone(cand); let changed=false; const eliminated=[];
        for(let c=0;c<9;c++){
          if(cols.includes(c)) continue;
          for(const r of [r1,r2,r3]){
            const a=next[r][c]; const ix=a.indexOf(d);
            if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
          }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'swordfish-col',d,rows:[r1,r2,r3],cols,eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'swordfish-col',d,rows:[r1,r2,r3],cols,eliminated,eliminations};
      }
    }
    return null;
  }

  function findSwordfish(cand, opts){ return rowSwordfish(cand,opts) || colSwordfish(cand,opts) || null; }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findSwordfish = findSwordfish;
})(window);
