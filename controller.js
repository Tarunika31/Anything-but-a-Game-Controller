(() => {
  const $ = id => document.getElementById(id);
  const params = new URLSearchParams(location.search);
  let room = (params.get("room") || "").toUpperCase(), ws = null, sensorEnabled = false;
  let baseGamma = 0, baseBeta = 0, x = 0, y = 0, jump = false, shake = false, lastMotion = 0, lastShake = 0, manual = {x:0,y:0};
  $("roomLabel").textContent = room || "NO ROOM";
  function setStatus(online, text) { $("connectionDot").className = online ? "dot online" : "dot"; $("connectionText").textContent = text; }
  function connect() {
    if (!room) { $("connectionText").textContent = "Missing room code — open the QR link"; return; }
    if (ws) { try { ws.close(); } catch {} }
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${proto}//${location.host}`);
    ws.onopen = () => { ws.send(JSON.stringify({type:"join",role:"controller",room})); setStatus(true,"Connected to room"); };
    ws.onclose = () => { setStatus(false,"Disconnected — reconnecting"); setTimeout(connect,1800); };
    ws.onerror = () => setStatus(false,"Connection issue");
    ws.onmessage = e => { const m=JSON.parse(e.data); if(m.type==="joined")setStatus(true,"Connected to room"); if(m.type==="game-status"&&!m.connected)$("sensorMessage").textContent="Phone connected; waiting for the laptop game."; if(m.type==="pong")$("latencyValue").textContent=`${Date.now()-m.sentAt} ms`; };
  }
  function sendMotion() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const sx = clamp(x + manual.x,-1,1), sy = clamp(y + manual.y,-1,1);
    ws.send(JSON.stringify({type:"motion",x:sx,y:sy,jump,shake,sentAt:Date.now()}));
    $("xValue").textContent=sx.toFixed(2);$("yValue").textContent=sy.toFixed(2);
    $("tiltBall").style.transform=`translate(${sx*70}px,${sy*70}px)`;
    jump=false;shake=false;
  }
  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function handleOrientation(e) {
    if (e.gamma == null || e.beta == null) return;
    x=clamp((e.gamma-baseGamma)/35,-1,1); y=clamp((e.beta-baseBeta)/35,-1,1);
    lastMotion=Date.now();
  }
  function handleAcceleration(e) {
    const a=e.accelerationIncludingGravity;if(!a)return;
    const mag=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);
    if(mag>22 && Date.now()-lastShake>900){shake=true;jump=true;lastShake=Date.now();}
  }
  async function enableMotion() {
    try {
      if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
        const permission=await DeviceOrientationEvent.requestPermission();
        if(permission!=="granted")throw new Error("Motion permission was not granted.");
      }
      if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
        const permission=await DeviceMotionEvent.requestPermission();
        if(permission!=="granted")throw new Error("Motion permission was not granted.");
      }
      window.addEventListener("deviceorientation",handleOrientation);
      window.addEventListener("devicemotion",handleAcceleration);
      sensorEnabled=true;$("sensorMessage").textContent="Motion enabled. Hold flat and calibrate."; $("enableMotion").textContent="Motion enabled";
    } catch(e) { $("sensorMessage").textContent=e.message||"Sensor access unavailable. Use the manual arrow pad."; }
  }
  function calibrate(){baseGamma=window.lastGamma ?? (baseGamma+x*35);baseBeta=window.lastBeta ?? (baseBeta+y*35);x=0;y=0;manual={x:0,y:0};if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:"calibrate"}));$("sensorMessage").textContent="Neutral position calibrated. Tilt to steer.";}
  // Keep current raw orientation for reliable neutral calibration.
  window.addEventListener("deviceorientation",e=>{if(e.gamma!=null)window.lastGamma=e.gamma;if(e.beta!=null)window.lastBeta=e.beta;});
  $("enableMotion").onclick=enableMotion;$("calibrate").onclick=calibrate;$("reconnect").onclick=connect;
  $("jump").addEventListener("pointerdown",e=>{e.preventDefault();jump=true;shake=true;sendMotion()});
  document.querySelectorAll("[data-dir]").forEach(btn=>{
    const dir=btn.dataset.dir;
    const activate=e=>{e.preventDefault();manual={x:0,y:0};if(dir==="left")manual.x=-.8;if(dir==="right")manual.x=.8;if(dir==="up")manual.y=-.8;if(dir==="down")manual.y=.8;sendMotion()};
    const release=()=>{manual={x:0,y:0};sendMotion()};
    btn.addEventListener("pointerdown",activate);btn.addEventListener("pointerup",release);btn.addEventListener("pointerleave",release);btn.addEventListener("pointercancel",release);
  });
  connect();setInterval(()=>{sendMotion();if(ws&&ws.readyState===1)ws.send(JSON.stringify({type:"ping",sentAt:Date.now()}));},50);
})();