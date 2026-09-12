export function touchFrame(points){const [a,b]=points;return {center:[(a[0]+b[0])/2,(a[1]+b[1])/2],distance:Math.hypot(b[0]-a[0],b[1]-a[1]),angle:Math.atan2(b[1]-a[1],b[0]-a[0])};}
export function touchDelta(previous,next){return {scale:previous.distance>2?next.distance/previous.distance:1,rotation:Math.atan2(Math.sin(next.angle-previous.angle),Math.cos(next.angle-previous.angle))};}
