// hints/skyscraper.js
// Skyscraper：除去→Naked single なら 1手、なければ消去ヒント
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

  function rowSkyscraper(cand, opts){
    for(let d=1; d<=9; d++){
      const rows=[];
      for(let r=0;r<9;r++){
        const cols=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) cols.push(c);
        if(cols.length===2) rows.push({r,cols});
      }
      const n=rows.length;
      for(let i=0;i<n-1;i++) for(let j=i+1;j<n;j++){
        const r1=rows[i].r, r2=rows[j].r;
        const cols1=rows[i].cols, cols2=rows[j].cols;
        const shared=cols1.filter(c=>cols2.includes(c));
        if(shared.length!==1) continue;
        const sharedCol=shared[0];
        const roofCol1=cols1.find(c=>c!==sharedCol);
        const roofCol2=cols2.find(c=>c!==sharedCol);
        const roof1=[r1,roofCol1], roof2=[r2,roofCol2];
        const baseCells=[[r1,sharedCol],[r2,sharedCol]];
        const exclude = new Set([...baseCells, roof1, roof2].map(([r,c])=>`${r},${c}`));
        const targets = intersectPeers(roof1, roof2, exclude);
        if(targets.length===0) continue;

        const next=clone(cand); let changed=false; const eliminated=[];
        for(const [r,c] of targets){
          const a=next[r][c]; const ix=a.indexOf(d);
          if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'skyscraper-row',d,rows:[r1,r2],cols:[roofCol1,roofCol2],baseCells,roofCells:[roof1,roof2],eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'skyscraper-row',d,rows:[r1,r2],cols:[roofCol1,roofCol2],baseCells,roofCells:[roof1,roof2],eliminated,eliminations};
      }
    }
    return null;
  }

  function colSkyscraper(cand, opts){
    for(let d=1; d<=9; d++){
      const cols=[];
      for(let c=0;c<9;c++){
        const rows=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) rows.push(r);
        if(rows.length===2) cols.push({c,rows});
      }
      const n=cols.length;
      for(let i=0;i<n-1;i++) for(let j=i+1;j<n;j++){
        const c1=cols[i].c, c2=cols[j].c;
        const rows1=cols[i].rows, rows2=cols[j].rows;
        const shared=rows1.filter(r=>rows2.includes(r));
        if(shared.length!==1) continue;
        const sharedRow=shared[0];
        const roofRow1=rows1.find(r=>r!==sharedRow);
        const roofRow2=rows2.find(r=>r!==sharedRow);
        const roof1=[roofRow1,c1], roof2=[roofRow2,c2];
        const baseCells=[[sharedRow,c1],[sharedRow,c2]];
        const exclude = new Set([...baseCells, roof1, roof2].map(([r,c])=>`${r},${c}`));
        const targets = intersectPeers(roof1, roof2, exclude);
        if(targets.length===0) continue;

        const next=clone(cand); let changed=false; const eliminated=[];
        for(const [r,c] of targets){
          const a=next[r][c]; const ix=a.indexOf(d);
          if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
        }
        if(!changed) continue;
        const eliminations = diffElims(cand,next);
        const s=newSingle(next,cand);
        if(s) return {...s,action:'place',kind:'skyscraper-col',d,rows:[roofRow1,roofRow2],cols:[c1,c2],baseCells,roofCells:[roof1,roof2],eliminated,eliminations};
        if(opts && opts.allowElim) return {action:'eliminate',kind:'skyscraper-col',d,rows:[roofRow1,roofRow2],cols:[c1,c2],baseCells,roofCells:[roof1,roof2],eliminated,eliminations};
      }
    }
    return null;
  }

  function findSkyscraper(cand, opts){ return rowSkyscraper(cand,opts) || colSkyscraper(cand,opts) || null; }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findSkyscraper = findSkyscraper;
})(window);
