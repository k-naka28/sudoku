// window.SudokuHints.findXWing（X-Wing：行基準 / 列基準）
// ------------------------------------------------------------
// ■ 目的
//   同じ数字 d の候補が、2 行（または 2 列）で「同じ 2 列（または 2 行）」にだけ存在する
//   長方形パターン（X-Wing）を見つけ、相手側の列（または行）から d を一括除去する。
//   除去の結果、新しい Naked single が出たら 1 手ヒントとして返す。
//
// ■ 成立条件（行基準の例）
//   - ある数字 d について、行 r1 と r2 の候補位置がちょうど 2 列 c1,c2 に揃う
//   - このとき列 c1,c2 の「他の行」には d は置けない（そこから d を消去）
//
// ■ 実装の要点
//   - 行基準：各行で d の候補列を集計 → ちょうど 2 つならキー化 "c1,c2"
//             同じキーを持つ行が 2 本見つかったら X-Wing 成立（列側から消す）
//   - 列基準：左右対称。各列で d の候補行を集計して同様に処理。
// ------------------------------------------------------------
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const newSingle=(next,prev)=>{ for(let r=0;r<9;r++)for(let c=0;c<9;c++) if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]}; return null; };

  function rowXWing(cand){
    for(let d=1; d<=9; d++){
      const map = new Map(); // "c1,c2" -> [row1,row2,...]
      for(let r=0;r<9;r++){
        const cols=[]; for(let c=0;c<9;c++) if(cand[r][c].includes(d)) cols.push(c);
        if(cols.length===2){
          const key=`${cols[0]},${cols[1]}`;
          map.set(key, (map.get(key)||[]).concat(r));
        }
      }
      for(const [key,rows] of map){
        if(rows.length===2){
          const [c1,c2] = key.split(',').map(Number);
          const [r1,r2] = rows;
          const next=clone(cand); let changed=false; const eliminated=[];
          // 列 c1,c2 の「他の行」から d を削除
          for(let r=0;r<9;r++){
            if(r===r1 || r===r2) continue;
            for(const c of [c1,c2]){
              const a=next[r][c]; const ix=a.indexOf(d);
              if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
            }
          }
          if(!changed) continue;
          const s=newSingle(next,cand);
          if(s) return {...s,kind:'xwing-row',d,rows:[r1,r2],cols:[c1,c2],eliminated};
        }
      }
    }
    return null;
  }

  function colXWing(cand){
    for(let d=1; d<=9; d++){
      const map = new Map(); // "r1,r2" -> [col1,col2,...]
      for(let c=0;c<9;c++){
        const rows=[]; for(let r=0;r<9;r++) if(cand[r][c].includes(d)) rows.push(r);
        if(rows.length===2){
          const key=`${rows[0]},${rows[1]}`;
          map.set(key, (map.get(key)||[]).concat(c));
        }
      }
      for(const [key,cols] of map){
        if(cols.length===2){
          const [r1,r2] = key.split(',').map(Number);
          const [c1,c2] = cols;
          const next=clone(cand); let changed=false; const eliminated=[];
          // 行 r1,r2 の「他の列」から d を削除
          for(let c=0;c<9;c++){
            if(c===c1 || c===c2) continue;
            for(const r of [r1,r2]){
              const a=next[r][c]; const ix=a.indexOf(d);
              if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([r,c]); }
            }
          }
          if(!changed) continue;
          const s=newSingle(next,cand);
          if(s) return {...s,kind:'xwing-col',d,rows:[r1,r2],cols:[c1,c2],eliminated};
        }
      }
    }
    return null;
  }

  function findXWing(cand){ return rowXWing(cand) || colXWing(cand) || null; }
  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findXWing = findXWing;
})(window);