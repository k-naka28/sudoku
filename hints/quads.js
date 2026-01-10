// hints/quads.js
// Naked/Hidden Quad：除去→新しい Naked single が出たら 1手提示
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const diffElims = (prev,next)=>{
    const out=[];
    for(let r=0;r<9;r++)for(let c=0;c<9;c++){
      for(const d of prev[r][c]) if(!next[r][c].includes(d)) out.push({r,c,d});
    }
    return out;
  };
  const newSingle=(next,prev)=>{
    for(let r=0;r<9;r++)for(let c=0;c<9;c++)
      if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]};
    return null;
  };

  const rowCells = r => Array.from({length:9},(_,c)=>[r,c]);
  const colCells = c => Array.from({length:9},(_,r)=>[r,c]);
  const boxCells = b => { const br=Math.floor(b/3)*3, bc=(b%3)*3; return Array.from({length:9},(_,i)=>[br+Math.floor(i/3), bc+(i%3)]) };

  // ---- Naked Quad ----
  // 条件: 単位内の 4 マスの候補の合併がちょうど 4 数字（各セルは 2〜4 候補、すべてがその4数字の部分集合）
  // 効果: 単位内の「他のマス」からその 4 数字を一括削除
  function tryNakedInUnit(getCells, label){
    return function(cand, opts){
      for(let u=0; u<9; u++){
        // 2〜4候補のマスのみを対象に（それ以外は Naked Quad に関与しない）
        const cells = getCells(u).filter(([r,c])=>{
          const len = cand[r][c].length;
          return len>=2 && len<=4;
        });

        const n = cells.length;
        if(n < 4) continue;

        // i<j<k<l の四重ループ（※以前の a+2 などの誤った開始位置を修正）
        for(let i=0;i<=n-4;i++){
          for(let j=i+1;j<=n-3;j++){
            for(let k=j+1;k<=n-2;k++){
              for(let l=k+1;l<=n-1;l++){
                const quad = [cells[i], cells[j], cells[k], cells[l]];

                // 合併が4数字かどうか
                const digSet = new Set();
                for(const [r,c] of quad) for(const d of cand[r][c]) digSet.add(d);
                if(digSet.size !== 4) continue;

                // （冗長チェック）各セルは digSet の部分集合（union から自明だが安全のため）
                let subsetOK = true;
                for(const [r,c] of quad){
                  for(const d of cand[r][c]) if(!digSet.has(d)){ subsetOK=false; break; }
                  if(!subsetOK) break;
                }
                if(!subsetOK) continue;

                // 他マスから4数字を削除
                const digits = [...digSet];
                const next=clone(cand); let changed=false;
                const keep=new Set(quad.map(([r,c])=>`${r},${c}`));
                for(const [rr,cc] of getCells(u)){
                  if(keep.has(`${rr},${cc}`)) continue;
                  const arr=next[rr][cc];
                  for(const d of digits){
                    const ix=arr.indexOf(d);
                    if(ix>=0){ arr.splice(ix,1); changed=true; }
                  }
                }
                if(!changed) continue;
                const eliminations = diffElims(cand,next);

                // 削除の結果、生じた新しい Naked single を 1 手として提示
                const s=newSingle(next,cand);
                if(s){
                  const payload={ quad:digits.sort((a,b)=>a-b), quadCells:quad };
                  if(label==='row') return {...s,action:'place',kind:'naked-quad-row',row:u,...payload,eliminations};
                  if(label==='col') return {...s,action:'place',kind:'naked-quad-col',col:u,...payload,eliminations};
                  return {...s,action:'place',kind:'naked-quad-box',box:u,...payload,eliminations};
                }
                if(opts && opts.allowElim){
                  const payload={ quad:digits.sort((a,b)=>a-b), quadCells:quad, eliminations };
                  if(label==='row') return {action:'eliminate',kind:'naked-quad-row',row:u,...payload};
                  if(label==='col') return {action:'eliminate',kind:'naked-quad-col',col:u,...payload};
                  return {action:'eliminate',kind:'naked-quad-box',box:u,...payload};
                }
              }
            }
          }
        }
      }
      return null;
    };
  }

  // ---- Hidden Quad ----
  // 条件: 4 数字 {a,b,c,d} の「出現可能位置」の和集合が単位内でちょうど 4 マス
  // 効果: その 4 マスから {a,b,c,d} 以外を削除
  function tryHiddenInUnit(getCells, label){
    return function(cand, opts){
      for(let u=0; u<9; u++){
        const cells = getCells(u);
        const pos = Array.from({length:10},()=>[]);
        for(const [r,c] of cells) for(const d of cand[r][c]) pos[d].push([r,c]);

        // a<b<c<d の四重ループ（※以前は a+2 / a+3 など誤りがあった）
        for(let a=1;a<=6;a++){
          for(let b=a+1;b<=7;b++){
            for(let c=b+1;c<=8;c++){
              for(let d=c+1;d<=9;d++){
                const A=pos[a], B=pos[b], C=pos[c], D=pos[d];
                if(A.length===0 || B.length===0 || C.length===0 || D.length===0) continue;

                const key = new Set([...A,...B,...C,...D].map(([r0,c0])=>`${r0},${c0}`));
                if(key.size !== 4) continue; // 和集合が 4 マスでなければ不成立

                const quad = [...key].map(s=>s.split(',').map(Number));
                const next=clone(cand); let changed=false;
                for(const [r0,c0] of quad){
                  const filtered = next[r0][c0].filter(x=>x===a||x===b||x===c||x===d);
                  if(filtered.length !== next[r0][c0].length){ next[r0][c0]=filtered; changed=true; }
                }
                if(!changed) continue;

                const eliminations = diffElims(cand,next);
                const s=newSingle(next,cand);
                if(s){
                  const payload={ quad:[a,b,c,d], quadCells:quad };
                  if(label==='row') return {...s,action:'place',kind:'hidden-quad-row',row:u,...payload,eliminations};
                  if(label==='col') return {...s,action:'place',kind:'hidden-quad-col',col:u,...payload,eliminations};
                  return {...s,action:'place',kind:'hidden-quad-box',box:u,...payload,eliminations};
                }
                if(opts && opts.allowElim){
                  const payload={ quad:[a,b,c,d], quadCells:quad, eliminations };
                  if(label==='row') return {action:'eliminate',kind:'hidden-quad-row',row:u,...payload};
                  if(label==='col') return {action:'eliminate',kind:'hidden-quad-col',col:u,...payload};
                  return {action:'eliminate',kind:'hidden-quad-box',box:u,...payload};
                }
              }
            }
          }
        }
      }
      return null;
    };
  }

  function findQuads(cand, opts){
    return tryNakedInUnit(rowCells,'row')(cand,opts) || tryNakedInUnit(colCells,'col')(cand,opts) || tryNakedInUnit(boxCells,'box')(cand,opts)
        || tryHiddenInUnit(rowCells,'row')(cand,opts) || tryHiddenInUnit(colCells,'col')(cand,opts) || tryHiddenInUnit(boxCells,'box')(cand,opts)
        || null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findQuads = findQuads;
})(window);
