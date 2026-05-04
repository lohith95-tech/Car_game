import { useEffect, useRef, useState } from "react";

const Index = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [screen, setScreen] = useState<"start" | "playing" | "over">("start");
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [best, setBest] = useState(0);
  const stateRef = useRef<any>({});

  // load best
  useEffect(() => {
    try { setBest(parseInt(localStorage.getItem("nrd_best") || "0", 10) || 0); } catch {}
  }, []);

  // resize canvas
  useEffect(() => {
    const resize = () => {
      const c = canvasRef.current; const w = wrapRef.current;
      if (!c || !w) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = w.getBoundingClientRect();
      c.width = Math.floor(rect.width * dpr);
      c.height = Math.floor(rect.height * dpr);
      c.style.width = rect.width + "px";
      c.style.height = rect.height + "px";
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.W = rect.width;
      stateRef.current.H = rect.height;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  // input
  useEffect(() => {
    const keys: Record<string, boolean> = {};
    stateRef.current.keys = keys;
    const dn = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = true; };
    const up = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", dn);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); };
  }, []);

  const startGame = () => {
    const W = stateRef.current.W || 400;
    const H = stateRef.current.H || 600;
    stateRef.current.player = { x: W / 2, y: H - 110, w: 44, h: 78, vx: 0 };
    stateRef.current.scrollY = 0;
    stateRef.current.speed = 4;
    stateRef.current.score = 0;
    stateRef.current.coinsCount = 0;
    stateRef.current.cars = [];
    stateRef.current.coins = [];
    stateRef.current.particles = [];
    stateRef.current.spawnT = 0;
    stateRef.current.coinT = 0;
    stateRef.current.t = 0;
    setScore(0); setCoins(0); setSpeed(0);
    setScreen("playing");
  };

  // game loop
  useEffect(() => {
    if (screen !== "playing") return;
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let last = performance.now();
    const s = stateRef.current;

    const lanes = () => {
      const W = s.W;
      const roadW = Math.min(360, W * 0.7);
      const x0 = (W - roadW) / 2;
      return { roadW, x0, lanes: [x0 + roadW / 6, x0 + roadW / 2, x0 + 5 * roadW / 6] };
    };

    const rectHit = (a: any, b: any) =>
      Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

    const loop = (now: number) => {
      const dt = Math.min(40, now - last); last = now;
      s.t += dt;
      const W = s.W, H = s.H;
      const { roadW, x0, lanes: laneXs } = lanes();

      // input
      const k = s.keys;
      const left = k["arrowleft"] || k["a"] || s.touchLeft;
      const right = k["arrowright"] || k["d"] || s.touchRight;
      const upK = k["arrowup"] || k["w"] || s.touchUp;
      const dn = k["arrowdown"] || k["s"] || s.touchDown;

      if (left) s.player.vx -= 0.6;
      if (right) s.player.vx += 0.6;
      s.player.vx *= 0.85;
      s.player.x += s.player.vx;
      s.player.x = Math.max(x0 + 22, Math.min(x0 + roadW - 22, s.player.x));

      if (upK) s.speed = Math.min(14, s.speed + 0.05);
      else if (dn) s.speed = Math.max(2, s.speed - 0.15);
      else s.speed = Math.max(4, s.speed - 0.005);
      s.speed += 0.0008 * (dt); // slow ramp

      s.scrollY += s.speed;
      s.score += s.speed * 0.05;

      // spawn cars
      s.spawnT -= dt;
      if (s.spawnT <= 0) {
        s.spawnT = 700 - Math.min(450, s.speed * 30);
        const lane = laneXs[Math.floor(Math.random() * 3)];
        s.cars.push({ x: lane, y: -100, w: 44, h: 78, color: ["#ff3860", "#3273dc", "#ffdd57", "#9b59b6"][Math.floor(Math.random() * 4)], vy: 1 + Math.random() * 2 });
      }
      // spawn coins
      s.coinT -= dt;
      if (s.coinT <= 0) {
        s.coinT = 900 + Math.random() * 600;
        const lane = laneXs[Math.floor(Math.random() * 3)];
        s.coins.push({ x: lane, y: -40, w: 22, h: 22, spin: 0 });
      }

      // update cars
      for (const car of s.cars) car.y += s.speed - car.vy;
      s.cars = s.cars.filter((c: any) => c.y < H + 100);
      // update coins
      for (const co of s.coins) { co.y += s.speed; co.spin += 0.2; }
      s.coins = s.coins.filter((c: any) => c.y < H + 40);

      // collisions
      for (const car of s.cars) if (rectHit(car, s.player)) {
        // explode
        for (let i = 0; i < 40; i++) s.particles.push({ x: s.player.x, y: s.player.y, vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8, life: 60, color: Math.random() < 0.5 ? "#ff3860" : "#ffdd57" });
        const finalScore = Math.floor(s.score);
        setScore(finalScore);
        setCoins(s.coinsCount);
        try {
          const prev = parseInt(localStorage.getItem("nrd_best") || "0", 10) || 0;
          if (finalScore > prev) { localStorage.setItem("nrd_best", String(finalScore)); setBest(finalScore); }
        } catch {}
        setScreen("over");
        return;
      }
      s.coins = s.coins.filter((co: any) => {
        if (rectHit(co, s.player)) { s.coinsCount += 1; s.score += 10; return false; }
        return true;
      });

      // particles
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 1; }
      s.particles = s.particles.filter((p: any) => p.life > 0);

      // === DRAW ===
      ctx.fillStyle = "#0b0b1a";
      ctx.fillRect(0, 0, W, H);

      // stars
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      for (let i = 0; i < 30; i++) {
        const sx = (i * 73) % W;
        const sy = ((i * 131 + s.scrollY * 0.1) % H);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // city silhouette
      ctx.fillStyle = "#1a1a2e";
      for (let i = 0; i < 8; i++) {
        const bx = i * (W / 8);
        const bh = 40 + ((i * 53) % 60);
        ctx.fillRect(bx, H * 0.25 - bh, W / 8 - 4, bh);
      }

      // road
      ctx.fillStyle = "#16213e";
      ctx.fillRect(x0, 0, roadW, H);
      // edges
      ctx.fillStyle = "#0f3460";
      ctx.fillRect(x0 - 6, 0, 6, H);
      ctx.fillRect(x0 + roadW, 0, 6, H);

      // lane markers (neon green)
      ctx.fillStyle = "#39ff14";
      ctx.shadowColor = "#39ff14";
      ctx.shadowBlur = 10;
      const segH = 30, gap = 30;
      const offset = s.scrollY % (segH + gap);
      for (let lane = 1; lane < 3; lane++) {
        const lx = x0 + (roadW / 3) * lane - 2;
        for (let y = -segH + offset; y < H; y += segH + gap) {
          ctx.fillRect(lx, y, 4, segH);
        }
      }
      ctx.shadowBlur = 0;

      // coins
      for (const co of s.coins) {
        const r = 12 + Math.sin(co.spin) * 2;
        ctx.beginPath();
        ctx.fillStyle = "#ffd700";
        ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 15;
        ctx.arc(co.x, co.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#8a6d00";
        ctx.font = "bold 16px Orbitron, sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("★", co.x, co.y + 1);
      }

      // traffic cars
      for (const car of s.cars) drawCar(ctx, car.x, car.y, car.w, car.h, car.color);

      // player
      drawCar(ctx, s.player.x, s.player.y, s.player.w, s.player.h, "#00f0ff", true);

      // particles
      for (const p of s.particles) {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / 60);
        ctx.fillRect(p.x, p.y, 4, 4);
      }
      ctx.globalAlpha = 1;

      setScore(Math.floor(s.score));
      setCoins(s.coinsCount);
      setSpeed(Math.floor(s.speed * 18));

      raf = requestAnimationFrame(loop);
    };

    function drawCar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, glow = false) {
      ctx.save();
      if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 20; }
      ctx.fillStyle = color;
      const rx = x - w / 2, ry = y - h / 2;
      roundRect(ctx, rx, ry, w, h, 8);
      ctx.fill();
      ctx.shadowBlur = 0;
      // windshield
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, rx + 6, ry + 10, w - 12, 22, 4); ctx.fill();
      roundRect(ctx, rx + 6, ry + h - 32, w - 12, 22, 4); ctx.fill();
      // headlights
      ctx.fillStyle = "#fff7c2";
      ctx.fillRect(rx + 4, ry + 2, 6, 4);
      ctx.fillRect(rx + w - 10, ry + 2, 6, 4);
      ctx.restore();
    }
    function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [screen]);

  // touch helpers
  const setTouch = (key: string, val: boolean) => { (stateRef.current as any)[key] = val; };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#05050f] text-white" style={{ fontFamily: "Orbitron, system-ui, sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&display=swap" rel="stylesheet" />
      <h1 className="text-2xl md:text-3xl font-black tracking-widest mb-3" style={{ color: "#00f0ff", textShadow: "0 0 12px #00f0ff" }}>NEON RACER DASH</h1>

      <div ref={wrapRef} className="relative" style={{ width: "min(420px, 95vw)", height: "min(700px, 80vh)", border: "2px solid #00f0ff", borderRadius: 12, boxShadow: "0 0 30px rgba(0,240,255,0.4)", overflow: "hidden", background: "#0b0b1a" }}>
        <canvas ref={canvasRef} className="block w-full h-full" />

        {/* HUD */}
        {screen === "playing" && (
          <div className="absolute top-2 left-2 right-2 flex justify-between text-sm pointer-events-none" style={{ textShadow: "0 0 8px #39ff14" }}>
            <div style={{ color: "#39ff14" }}>SCORE<br /><span className="text-lg font-bold">{score}</span></div>
            <div style={{ color: "#ffd700", textShadow: "0 0 8px #ffd700" }} className="text-center">★ {coins}</div>
            <div style={{ color: "#00f0ff", textShadow: "0 0 8px #00f0ff" }} className="text-right">KM/H<br /><span className="text-lg font-bold">{speed}</span></div>
          </div>
        )}

        {/* Start */}
        {screen === "start" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-center px-4">
            <h2 className="text-3xl font-black mb-2" style={{ color: "#00f0ff", textShadow: "0 0 14px #00f0ff" }}>NEON RACER</h2>
            <p className="text-sm mb-2 opacity-80">Arrow keys / WASD or touch</p>
            <p className="text-xs mb-6 opacity-60">Best: {best}</p>
            <button onClick={startGame} className="px-8 py-3 rounded-lg font-bold tracking-wider" style={{ background: "#00f0ff", color: "#001018", boxShadow: "0 0 25px #00f0ff" }}>START</button>
          </div>
        )}

        {/* Game Over */}
        {screen === "over" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-center px-4">
            <h2 className="text-3xl font-black mb-2" style={{ color: "#ff3860", textShadow: "0 0 14px #ff3860" }}>CRASHED</h2>
            <p className="mb-1">Score: <span className="font-bold" style={{ color: "#39ff14" }}>{score}</span></p>
            <p className="mb-1">Coins: <span className="font-bold" style={{ color: "#ffd700" }}>{coins}</span></p>
            <p className="mb-6 opacity-70">Best: {best}</p>
            <button onClick={startGame} className="px-8 py-3 rounded-lg font-bold tracking-wider" style={{ background: "#39ff14", color: "#001a00", boxShadow: "0 0 25px #39ff14" }}>PLAY AGAIN</button>
          </div>
        )}
      </div>

      {/* Touch controls */}
      <div className="mt-4 grid grid-cols-3 gap-3 select-none md:hidden" style={{ width: "min(420px, 95vw)" }}>
        {[
          { label: "◀", key: "touchLeft" },
          { label: "▲", key: "touchUp" },
          { label: "▶", key: "touchRight" },
          { label: "", key: "" },
          { label: "▼", key: "touchDown" },
          { label: "", key: "" },
        ].map((b, i) => b.key ? (
          <button key={i}
            onPointerDown={(e) => { e.preventDefault(); setTouch(b.key, true); }}
            onPointerUp={() => setTouch(b.key, false)}
            onPointerLeave={() => setTouch(b.key, false)}
            onPointerCancel={() => setTouch(b.key, false)}
            className="h-14 rounded-lg text-2xl font-bold"
            style={{ background: "#16213e", color: "#00f0ff", border: "1px solid #00f0ff", boxShadow: "0 0 10px rgba(0,240,255,0.5)" }}
          >{b.label}</button>
        ) : <div key={i} />)}
      </div>

      <p className="mt-3 text-xs opacity-60">↑ accelerate · ↓ brake · ← → steer</p>
    </div>
  );
};

export default Index;
