// One exact last-applied vector per live sprite. Never cache by plan identity:
// callers recompute the matrix so in-place edits and changing rigs remain visible.
export function applyZenCherryPlumeSpriteTransform(item,matrix){
  const previous=item.appliedMatrix;
  if(previous&&Object.is(previous[0],matrix.a)&&Object.is(previous[1],matrix.b)
    &&Object.is(previous[2],matrix.c)&&Object.is(previous[3],matrix.d)
    &&Object.is(previous[4],matrix.tx)&&Object.is(previous[5],matrix.ty))return false;
  item.sprite.transform.setFromMatrix(matrix);
  if(previous){previous[0]=matrix.a;previous[1]=matrix.b;previous[2]=matrix.c;previous[3]=matrix.d;previous[4]=matrix.tx;previous[5]=matrix.ty;}
  else item.appliedMatrix=[matrix.a,matrix.b,matrix.c,matrix.d,matrix.tx,matrix.ty];
  return true;
}
