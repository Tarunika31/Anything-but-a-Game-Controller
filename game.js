(() => {
  const $ = id => document.getElementById(id);
  const canvas = $("game"), ctx = canvas.getContext("2d");
  let ws, room = "", gameStarted = false, lastPacketAt = 0, latency = null;
  let state = { x: 50, y: 50, vx: 0, vy: 0, tiltX: 0, tiltY: 0, jump: false, shake: false };
  const walls = [
    {x:115,y:0,w:18,h:235},{x:115,y:285,w:18,h:135},
    {x:220,y:85,w:18,h:335},{x:220,y:0,w:18,h:35},
    {x:325,y:0,w:18,h:235},{x:325,y:285,w:18,h:135},
    {x:430,y:85,w:18,h:335},{x:430,y:0,w:18,h:35},
    {x:535,y:0,w:18,h:235},{x:535,y:285,w:18,h:135}
  ];
  const hazard = {x:375,y:260,r:15}; const goal = {x:660,y:355,r:24};
  async function createRoom() {
    try {
      const r = await fetch("/api/room"); const data = await r.json();
      room = data.room; $("roomCode").textContent = room; $("qr").src = data.qr; $("qr").hidden = false; $("qrPlaceholder").hidden = true;
      const url = new URL(data.controllerUrl); $("controllerLink").href = `${url.pathname}?room=${room}`;
      connectGame();
    } catch { $("serverStatus").textContent = "Server unavailable"; }
  }
  function connectGame() {
    if (ws) ws.close();
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}`);
    ws.onopen = () => { ws.send(JSON.stringify({type:"join", role:"game", room})); $("serverStatus").textContent = "Server online"; $("serverStatus").className = "pill"; };
    ws.onclose = () => { $("gameStatus").textContent = "Reconnecting…"; $("gameStatus").className = "pill muted"; setTimeout(connectGame, 1800); };
    ws.onmessage = e => {
      const m = JSON.parse(e.data);
      if (m.type === "joined") $("gameStatus").textContent = "Game ready";
      if (m.type === "peers") { $("phoneCount").textContent = m.controllerCount; $("gameStatus").textContent = m.controllerCount ? "Phone connected" : "Waiting for phone"; $("gameStatus").className = m.controllerCount ? "pill" : "pill muted"; }
      if (m.type === "motion") {
        state.tiltX = m.x; state.tiltY = m.y; state.jump = m.jump; state.shake = m.shake; lastPacketAt = Date.now();
        latency = Math.max(0, lastPacketAt - m.sentAt); $("latency").textContent = `Latency: ${latency} ms`;
        $("tiltX").textContent = m.x.toFixed(2); $("tiltY").textContent = m.y.toFixed(2); $("lastPacket").textContent = "just now";
      }
    };
  }
  function reset() { state.x=50;state.y=50;state.vx=0;state.vy=0; }
  function collideCircleRect(cx,cy,r,w) { const x=Math.max(w.x,Math.min(cx,w.x+w.w)),y=Math.max(w.y,Math.min(cy,w.y+w.h));return (cx-x)**2+(cy-y)**2<r*r; }
  function update() {
    if (gameStarted) {
      const ax = state.tiltX * 0.34, ay = state.tiltY * 0.34;
      state.vx = (state.vx + ax) * .91; state.vy = (state.vy + ay) * .91;
      let nx = state.x + state.vx, ny = state.y + state.vy, r = state.jump ? 8 : 11;
      nx = Math.max(r,Math.min(canvas.width-r,nx)); ny = Math.max(r,Math.min(canvas.height-r,ny));
      for (const w of walls) { if (collideCircleRect(nx,ny,r,w)) { if (!collideCircleRect(state.x+state.vx, state.y, r, w)) state.vx *= -.35; else state.vx *= -.35; if (!collideCircleRect(state.x, state.y+state.vy, r, w)) state.vy *= -.35; else state.vy *= -.35; nx=state.x;ny=state.y; } }
      state.x=nx;state.y=ny;
      if (!state.jump && Math.hypot(state.x-hazard.x,state.y-hazard.y)<r+hazard.r) reset();
      if (Math.hypot(state.x-goal.x,state.y-goal.y)<r+goal.r) { gameStarted=false; $("gameStatus").textContent="Maze complete! 🎉"; }
    }
    draw(); requestAnimationFrame(update);
  }
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height); ctx.fillStyle="#fff9f4";ctx.fillRect(0,0,720,420);
    ctx.strokeStyle="#f4e8df";ctx.lineWidth=1;for(let x=0;x<720;x+=30){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,420);ctx.stroke()}for(let y=0;y<420;y+=30){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(720,y);ctx.stroke()}
    ctx.fillStyle="#253047";for(const w of walls)ctx.fillRect(w.x,w.y,w.w,w.h);
    ctx.fillStyle="#ff657b";ctx.beginPath();ctx.arc(hazard.x,hazard.y,hazard.r,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#42bb8a";ctx.lineWidth=5;ctx.beginPath();ctx.arc(goal.x,goal.y,goal.r,0,Math.PI*2);ctx.stroke();
    ctx.fillStyle="#42bb8a";ctx.font="bold 11px sans-serif";ctx.fillText("GOAL",goal.x-16,goal.y+4);
    ctx.fillStyle="#e96c6c";ctx.beginPath();ctx.arc(state.x,state.y,state.jump?8:11,0,Math.PI*2);ctx.fill();ctx.fillStyle="#ffffff";ctx.beginPath();ctx.arc(state.x-3,state.y-3,3,0,Math.PI*2);ctx.fill();
    if(!gameStarted){ctx.fillStyle="#253047cc";ctx.fillRect(0,0,720,420);ctx.fillStyle="white";ctx.textAlign="center";ctx.font="bold 24px sans-serif";ctx.fillText("MOTION MAZE",360,185);ctx.font="15px sans-serif";ctx.fillText("Press Start / restart game to play",360,216);ctx.textAlign="left"}
  }
  $("createRoom").onclick=createRoom;$("startGame").onclick=()=>{reset();gameStarted=true;$("gameStatus").textContent="Playing";};$("resetBall").onclick=reset;
  window.addEventListener("keydown",e=>{const k=e.key.toLowerCase();if(["arrowleft","a"].includes(k))state.tiltX=-.8;if(["arrowright","d"].includes(k))state.tiltX=.8;if(["arrowup","w"].includes(k))state.tiltY=-.8;if(["arrowdown","s"].includes(k))state.tiltY=.8;if(k===" "||k==="shift")state.jump=true;});
  window.addEventListener("keyup",()=>{state.tiltX=0;state.tiltY=0;state.jump=false;});
  fetch("/api/health").then(r=>r.json()).then(()=>{$("serverStatus").textContent="Server online";$("serverStatus").className="pill"}).catch(()=>{$("serverStatus").textContent="Server unavailable"});
  update();
})();