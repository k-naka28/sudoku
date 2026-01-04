// window.SudokuHints.findYWing（XY-Wing）
// ------------------------------------------------------------
// ■ 目的
//   「XY-Wing（Y-Wing）」は、3つの 2候補セル（bivalue）を使って、ある数字 z を複数マスから
//   一括で消去する“除去系”の手筋。消去の結果、新しい Naked single（確定 1 手）が発生したら
//   その 1 手をヒントとして返します（UI 一貫性のため）。
//
// ■ 用語（この実装での変数名）
//   pivot（ピボット）:  2 候補 {x,y} を持ち、両方のピンサーと「お互いに見える（同じ行/列/ブロックの関係）」セル
//   pincer A（ピンサーA）: pivot と見え合い、候補が {x,z}（x を共有）
//   pincer B（ピンサーB）: pivot と見え合い、候補が {y,z}（y を共有）
//   z: A と B が共有する第 2 候補。A と B の両方から見えるセル群から z を消去できる。
//
// ■ 成立条件（簡略）
//   1) pivot は {x,y} の 2 候補セル
//   2) pincer A は {x,z} の 2 候補セルで pivot と見え合う
//   3) pincer B は {y,z} の 2 候補セルで pivot と見え合う
//   4) A と B の「両方から見える」セルから z を消去できる
//      ※ピンサー同士が見える/見えない は XY-Wing では必須条件ではありません。
//        （以前は「見えない」制約を入れていましたが、本来不要なので外しました）
//
// ■ 直感的説明
//   pivot が x なら A は z になる必要がある。
//   pivot が y なら B は z になる必要がある。
//   つまり、A と B のどちらかは必ず z。よって A と B の両方から見えるマスは z ではありえない。
//   → そこから z を消去できます。
//
// ■ 実装方針
//   - 2 候補セル（bivalue）を全列挙し、各セルを pivot 候補にする
//   - その pivot と見え合う 2 候補セルの中から、{x,z} / {y,z} を満たす A / B を探索
//   - A と B に共通して見えるマスから z を消去した仮想盤 next を作り、
//     そこで新しい Naked single が生まれたら 1 手ヒントとして返す
//
// ■ 返り値（ヒット時）
//   {
//     r, c, d,               // 確定できた 1 手（行・列・数字）
//     kind: 'ywing',
//     pivot:[pr,pc], p1:[ar,ac], p2:[br,bc],   // 揃った3セル
//     x, y, z, eliminated: [[er,ec], ...]      // 使った数字と消去したマス群（参考）
//   }
//
// ------------------------------------------------------------
(function(w){
  const clone = cand => cand.map(row=>row.map(a=>a.slice()));
  const newSingle=(next,prev)=>{ for(let r=0;r<9;r++)for(let c=0;c<9;c++) if(prev[r][c].length!==1 && next[r][c].length===1) return {r,c,d:next[r][c][0]}; return null; };

  // あるセル (r,c) から「見える（同一行・列・ブロック）」マスの集合
  const peers = (r,c)=>{
    const set = new Set();
    // 行・列
    for(let i=0;i<9;i++){ if(i!==c) set.add(`${r},${i}`); if(i!==r) set.add(`${i},${c}`); }
    // ブロック
    const br=Math.floor(r/3)*3, bc=Math.floor(c/3)*3;
    for(let dr=0;dr<3;dr++) for(let dc=0;dc<3;dc++){
      const rr=br+dr, cc=bc+dc;
      if(!(rr===r && cc===c)) set.add(`${rr},${cc}`);
    }
    return [...set].map(s=>s.split(',').map(Number));
  };

  // 2セルが見え合うか（同一行・同一列・同一ブロック）
  const sees = (a,b)=> a[0]===b[0] || a[1]===b[1]
    || (Math.floor(a[0]/3)===Math.floor(b[0]/3) && Math.floor(a[1]/3)===Math.floor(b[1]/3));

  function findYWing(cand){
    const bivalue=[];
    for(let r=0;r<9;r++) for(let c=0;c<9;c++) if(cand[r][c].length===2) bivalue.push([r,c]);

    // pivot を固定して探索
    for(const [pr,pc] of bivalue){
      const [x,y]=cand[pr][pc]; // pivot の 2 候補
      // ピンサー候補を事前に分けて保持（pivot と見え合う 2 候補セルのみ）
      const pA=[], pB=[];
      for(const [rr,cc] of bivalue){
        if(rr===pr && cc===pc) continue;
        if(!sees([pr,pc],[rr,cc])) continue; // pivot と見え合う
        const s=cand[rr][cc];
        // {x,z} or {y,z} で、z は x,y 以外の数字
        if(s.includes(x) && s.length===2 && s.some(v=>v!==x)) pA.push([rr,cc]); // {x,z}
        if(s.includes(y) && s.length===2 && s.some(v=>v!==y)) pB.push([rr,cc]); // {y,z}
      }

      // それぞれから 1 個ずつ選んで XY-Wing を構成
      for(const [ar,ac] of pA){
        const zA = cand[ar][ac].find(v=>v!==x); // {x,zA}
        for(const [br,bc] of pB){
          const zB = cand[br][bc].find(v=>v!==y); // {y,zB}
          if(zA!==zB) continue; // 共通 z が一致しないと成立しない
          const z = zA;

          // A と B の“共通に見える”セルに対して z を消去
          const peersA = peers(ar,ac);
          const peersB = peers(br,bc);
          const both = peersA.filter(p=>peersB.some(q=>q[0]===p[0] && q[1]===p[1]));
          if(both.length===0) continue;

          const next=clone(cand); let changed=false; const eliminated=[];
          for(const [er,ec] of both){
            const a=next[er][ec]; const ix=a.indexOf(z);
            if(ix>=0){ a.splice(ix,1); changed=true; eliminated.push([er,ec]); }
          }
          if(!changed) continue; // 何も消せなければ不成立

          // 消去で新しい Naked single が生まれたら、それを 1 手ヒントとして返す
          const s=newSingle(next,cand);
          if(s) return {...s,kind:'ywing',pivot:[pr,pc],p1:[ar,ac],p2:[br,bc],x,y,z,eliminated};
        }
      }
    }
    return null;
  }

  w.SudokuHints = w.SudokuHints || {};
  w.SudokuHints.findYWing = findYWing;
})(window);