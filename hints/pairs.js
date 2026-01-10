// window.SudokuHints.findPairs（Naked/Hidden Pair）
// ------------------------------------------------------------
// ■ 目的
//   2 マスにだけ現れる 2 数字のセット（Pair）を使って候補を除去し、
//   その結果生じた Naked single を 1 手ヒントとして返す。
//   - Naked Pair : 2 マスの候補集合がちょうど {a,b} の 2 数字 ⇒ 他マスから {a,b} を除去
//   - Hidden Pair: 2 数字 {a,b} の“出現可能なマス”がちょうど 2 マス ⇒ その 2 マスから {a,b} 以外を除去
// ------------------------------------------------------------
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const diffElims = (prev,next)=>{
    const out=[];
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      for(const d of prev[r][c]) if(!next[r][c].includes(d)) out.push({r,c,d});
    }
    return out;
  };
  const bix = (r,c)=>Math.floor(r/3)*3+Math.floor(c/3);
  const newSingle=(next,prev)=>{
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)
      if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]};
    return null;
  };

  function tryNakedInRow(cand, opts){
    for(let r=0;r<9;r++){
      const map=new Map(); // "a,b" -> [c1,c2,...]
      for(let c=0;c<9;c++){
        if(cand[r][c].length===2){
          const key=cand[r][c].slice().sort().join(',');
          map.set(key,(map.get(key)||[]).concat(c));
        }
      }
      for(const [key,cols] of map){
        if(cols.length===2){
          const [a,b]=key.split(',').map(Number);
          const next=clone(cand); let changed=false;
          for(let c=0;c<9;c++){
            if(!cols.includes(c)){
              const arr=next[r][c]; let i=arr.indexOf(a); if(i>=0){arr.splice(i,1); changed=true;}
              i=arr.indexOf(b); if(i>=0){arr.splice(i,1); changed=true;}
            }
          }
          if(!changed) continue;
          const eliminations = diffElims(cand,next);
          const s=newSingle(next,cand);
          if(s) return {...s,action:'place',kind:'naked-pair-row',row:r,pair:[a,b],pairCells:[[r,cols[0]],[r,cols[1]]],eliminations };
          if(opts && opts.allowElim) return {action:'eliminate',kind:'naked-pair-row',row:r,pair:[a,b],pairCells:[[r,cols[0]],[r,cols[1]]],eliminations };
        }
      }
    }
    return null;
  }

  function tryNakedInCol(cand, opts){
    for(let c=0;c<9;c++){
      const map=new Map();
      for(let r=0;r<9;r++){
        if(cand[r][c].length===2){
          const key=cand[r][c].slice().sort().join(',');
          map.set(key,(map.get(key)||[]).concat(r));
        }
      }
      for(const [key,rows] of map){
        if(rows.length===2){
          const [a,b]=key.split(',').map(Number);
          const next=clone(cand); let changed=false;
          for(let r=0;r<9;r++){
            if(!rows.includes(r)){
              const arr=next[r][c]; let i=arr.indexOf(a); if(i>=0){arr.splice(i,1); changed=true;}
              i=arr.indexOf(b); if(i>=0){arr.splice(i,1); changed=true;}
            }
          }
          if(!changed) continue;
          const eliminations = diffElims(cand,next);
          const s=newSingle(next,cand);
          if(s) return {...s,action:'place',kind:'naked-pair-col',col:c,pair:[a,b],pairCells:[[rows[0],c],[rows[1],c]],eliminations };
          if(opts && opts.allowElim) return {action:'eliminate',kind:'naked-pair-col',col:c,pair:[a,b],pairCells:[[rows[0],c],[rows[1],c]],eliminations };
        }
      }
    }
    return null;
  }

  function tryNakedInBox(cand, opts){
    for(let b=0;b<9;b++){
      const br=Math.floor(b/3)*3, bc=(b%3)*3;
      const map=new Map(); // "a,b" -> [[r,c],...]
      for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){
        const r=br+dr,c=bc+dc;
        if(cand[r][c].length===2){
          const key=cand[r][c].slice().sort().join(',');
          map.set(key,(map.get(key)||[]).concat([[r,c]]));
        }
      }
      for(const [key,cells] of map){
        if(cells.length===2){
          const [a,b]=key.split(',').map(Number);
          const next=clone(cand); let changed=false;
          for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){
            const r=br+dr,c=bc+dc;
            if(!cells.some(([rr,cc])=>rr===r&&cc===c)){
              const arr=next[r][c]; let i=arr.indexOf(a); if(i>=0){arr.splice(i,1); changed=true;}
              i=arr.indexOf(b); if(i>=0){arr.splice(i,1); changed=true;}
            }
          }
          if(!changed) continue;
          const eliminations = diffElims(cand,next);
          const s=newSingle(next,cand);
          if(s) return {...s,action:'place',kind:'naked-pair-box',box:b,pair:[a,b],pairCells:cells,eliminations };
          if(opts && opts.allowElim) return {action:'eliminate',kind:'naked-pair-box',box:b,pair:[a,b],pairCells:cells,eliminations };
        }
      }
    }
    return null;
  }

  function tryHiddenInUnit(getCells, label){
    return function(cand, opts){
      for(let unit=0;unit<9;unit++){
        const posByDigit=Array.from({length:10},()=>[]);
        const cells=getCells(unit);
        for(const [r,c] of cells) for(const d of cand[r][c]) posByDigit[d].push([r,c]);
        // 2 数字 a<b の組を全列挙：出現セルが完全一致で 2 マス
        for(let a=1;a<=8;a++) for(let b=a+1;b<=9;b++){
          const A=posByDigit[a], B=posByDigit[b];
          if(A.length===2 && B.length===2 &&
             A[0][0]===B[0][0] && A[0][1]===B[0][1] &&
             A[1][0]===B[1][0] && A[1][1]===B[1][1]){
            const next=clone(cand); let changed=false;
            for(const [r,c] of A){ // 2セルに {a,b} 以外を削除
              const arr=next[r][c].filter(x=>x===a||x===b);
              if(arr.length!==next[r][c].length){ next[r][c]=arr; changed=true; }
            }
            if(!changed) continue;
            const eliminations = diffElims(cand,next);
            const s=newSingle(next,cand);
            if(s){
              const payload={ pair:[a,b], pairCells:A };
              if(label==='row') return {...s,action:'place',kind:'hidden-pair-row',row:unit,...payload,eliminations};
              if(label==='col') return {...s,action:'place',kind:'hidden-pair-col',col:unit,...payload,eliminations};
              return {...s,action:'place',kind:'hidden-pair-box',box:unit,...payload,eliminations};
            }
            if(opts && opts.allowElim){
              const payload={ pair:[a,b], pairCells:A, eliminations };
              if(label==='row') return {action:'eliminate',kind:'hidden-pair-row',row:unit,...payload};
              if(label==='col') return {action:'eliminate',kind:'hidden-pair-col',col:unit,...payload};
              return {action:'eliminate',kind:'hidden-pair-box',box:unit,...payload};
            }
          }
        }
      }
      return null;
    };
  }

  const rowCells = r => Array.from({length:9},(_,c)=>[r,c]);
  const colCells = c => Array.from({length:9},(_,r)=>[r,c]);
  const boxCells = b => { const br=Math.floor(b/3)*3,bc=(b%3)*3; return Array.from({length:9},(_,i)=>[br+Math.floor(i/3), bc+(i%3)]) };

  const tryHiddenRow = tryHiddenInUnit(rowCells,'row');
  const tryHiddenCol = tryHiddenInUnit(colCells,'col');
  const tryHiddenBox = tryHiddenInUnit(boxCells,'box');

  function findPairs(cand, opts){
    // 優先: Naked(行→列→箱) → Hidden(行→列→箱)
    return tryNakedInRow(cand,opts) || tryNakedInCol(cand,opts) || tryNakedInBox(cand,opts)
        || tryHiddenRow(cand,opts)   || tryHiddenCol(cand,opts)   || tryHiddenBox(cand,opts)
        || null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findPairs = findPairs;
})(window);
