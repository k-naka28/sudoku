// hints/xyzwing.js
// XYZ-Wing：除去→Naked single なら 1手、なければ消去ヒント
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
  const sees = (a,b)=> a[0]===b[0] || a[1]===b[1]
    || (Math.floor(a[0]/3)===Math.floor(b[0]/3) && Math.floor(a[1]/3)===Math.floor(b[1]/3));

  function findXYZWing(cand, opts){
    const pivots=[];
    const bivalue=[];
    for(let r=0;r<9;r++) for(let c=0;c<9;c++){
      if(cand[r][c].length===3) pivots.push([r,c]);
      else if(cand[r][c].length===2) bivalue.push([r,c]);
    }

    for(const [pr,pc] of pivots){
      const digits = cand[pr][pc];
      for(const z of digits){
        const rest = digits.filter(v=>v!==z);
        if(rest.length!==2) continue;
        const x=rest[0], y=rest[1];
        const pA=[], pB=[];
        for(const [rr,cc] of bivalue){
          if(!sees([pr,pc],[rr,cc])) continue;
          const s=cand[rr][cc];
          if(s.includes(x) && s.includes(z)) pA.push([rr,cc]);
          if(s.includes(y) && s.includes(z)) pB.push([rr,cc]);
        }
        for(const [ar,ac] of pA){
          for(const [br,bc] of pB){
            if(ar===br && ac===bc) continue;
            const exclude = new Set([[pr,pc],[ar,ac],[br,bc]].map(([r,c])=>`${r},${c}`));
            const targets = intersectPeers([ar,ac],[br,bc], exclude);
            if(targets.length===0) continue;

            const next=clone(cand); let changed=false; const eliminated=[];
            for(const [rr,cc] of targets){
              const a=next[rr][cc]; const ix=a.indexOf(z);
              if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([rr,cc]); }
            }
            if(!changed) continue;
            const eliminations = diffElims(cand,next);
            const s=newSingle(next,cand);
            if(s) return {...s,action:'place',kind:'xyzwing',pivot:[pr,pc],p1:[ar,ac],p2:[br,bc],x,y,z,eliminated,eliminations};
            if(opts && opts.allowElim) return {action:'eliminate',kind:'xyzwing',pivot:[pr,pc],p1:[ar,ac],p2:[br,bc],x,y,z,eliminated,eliminations};
          }
        }
      }
    }
    return null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findXYZWing = findXYZWing;
})(window);
