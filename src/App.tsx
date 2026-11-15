import { useState, useEffect, useRef, useCallback } from "react";
import logoImg from "@/imports/image.png";
import popularLogoImg from "@/imports/pinpopular1.png";
import tokeLogoImg from "@/imports/image-2.png";

type Screen = "splash" | "hello" | "login" | "home" | "barriers-intro" | "barriers" | "voice" | "balance" | "transfer" | "pay";
type FontSize = "normal" | "large" | "xlarge";
interface Msg { id: number; role: "user" | "assistant"; text: string; }

// ─── Sign language data ───────────────────────────────────────────────────────
const SIGN_DATA: Record<string, { words: string[]; speech: string }> = {
  welcome:  { speech: "Bienvenido a Popular Sin Barreras. Estoy aqui para ayudarte.",       words: ["BIENVENIDO","BANCO POPULAR","SIN BARRERAS","HOLA"] },
  balance:  { speech: "Consultar el saldo de tu cuenta bancaria.",                           words: ["DINERO","CUENTA","SALDO","CUANTO"] },
  transfer: { speech: "Enviar dinero a otra persona de forma segura.",                       words: ["ENVIAR","DINERO","A PERSONA","LISTO"] },
  pay:      { speech: "Pagar servicios como electricidad, agua e internet.",                 words: ["PAGAR","SERVICIOS","CONFIRMAR","LISTO"] },
  help:     { speech: "Solicitar ayuda de un agente del Banco Popular.",                     words: ["AYUDA","AGENTE","POR FAVOR","GRACIAS"] },
};
const TOPIC_LABEL: Record<string,string> = { welcome:"Bienvenido", balance:"Consultar", transfer:"Enviar", pay:"Pagar", help:"Pedir Ayuda" };

// ─── Audio system ─────────────────────────────────────────────────────────────
const AC: { ctx: AudioContext | null } = { ctx: null };
const getCtx = () => { try { if (!AC.ctx) AC.ctx = new AudioContext(); if (AC.ctx.state==="suspended") AC.ctx.resume(); return AC.ctx; } catch { return null; } };
const tone = (f: number, d: number, v=0.12, t: OscillatorType="sine") => {
  const c=getCtx(); if(!c) return;
  const o=c.createOscillator(), g=c.createGain();
  o.connect(g); g.connect(c.destination); o.frequency.value=f; o.type=t;
  g.gain.setValueAtTime(v,c.currentTime); g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+d);
  o.start(); o.stop(c.currentTime+d);
};
const sfx = {
  tap:     () => tone(700,.07,.1),
  confirm: () => { tone(880,.07); setTimeout(()=>tone(1320,.13),80); },
  listen:  () => { tone(440,.07); setTimeout(()=>tone(660,.1),70); setTimeout(()=>tone(880,.12),140); },
  nav:     () => tone(550,.09,.09,"triangle"),
  success: () => { tone(880,.08); setTimeout(()=>tone(1100,.08),90); setTimeout(()=>tone(1320,.18),180); },
  modal:   () => tone(440,.1,.1,"triangle"),
  exit:    () => { tone(330,.08); setTimeout(()=>tone(220,.15),90); },
};

const speak = (text: string, cb?: ()=>void) => {
  if (!("speechSynthesis" in window)) { cb?.(); return; }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang="es-ES"; u.rate=0.82; u.pitch=1.05; u.volume=1;
  const vs=window.speechSynthesis.getVoices();
  const v=vs.find(v=>v.lang.startsWith("es"))||vs[0]; if(v) u.voice=v;
  if(cb) u.onend=cb;
  window.speechSynthesis.speak(u);
};
const stopSpeak = () => { if("speechSynthesis" in window) window.speechSynthesis.cancel(); };

const fsCls = (size: FontSize) => ({
  normal: {h:"text-xl",   body:"text-base", btn:"text-lg",   sm:"text-sm"},
  large:  {h:"text-2xl",  body:"text-lg",   btn:"text-xl",   sm:"text-base"},
  xlarge: {h:"text-3xl",  body:"text-xl",   btn:"text-2xl",  sm:"text-lg"},
}[size]);

// ─── Logo (small, for nav bars) ───────────────────────────────────────────────
const Logo = ({size=44}:{size?:number}) => (
  <img src={logoImg} alt="Banco Popular" width={size} height={size} className="rounded-xl object-cover flex-shrink-0"/>
);

// ─── Popular Logo (full logo with POPULAR text, for splash/login) ─────────────
const PopularLogo = ({width=140}:{width?:number}) => (
  <img src={popularLogoImg} alt="Banco Popular" width={width} style={{ objectFit:"contain" }}/>
);

// ─── Realistic SVG Avatar doing sign language ─────────────────────────────────
const SignPerson = ({ playing, speedMs, word }: { playing: boolean; speedMs: number; word: string }) => {
  const dur = `${speedMs * 2.2}ms`;
  return (
    <div className="relative flex flex-col items-center select-none" style={{ "--arm-dur": dur } as React.CSSProperties}>
      <svg viewBox="0 0 240 310" width="220" height="280" xmlns="http://www.w3.org/2000/svg" overflow="visible">
        <defs>
          <radialGradient id="sk" cx="38%" cy="32%" r="65%">
            <stop offset="0%" stopColor="#F5C896"/>
            <stop offset="100%" stopColor="#C8823A"/>
          </radialGradient>
          <linearGradient id="suit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B4A9E"/>
            <stop offset="100%" stopColor="#001E56"/>
          </linearGradient>
          <linearGradient id="sleeve" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0A4090"/>
            <stop offset="100%" stopColor="#001840"/>
          </linearGradient>
          <radialGradient id="glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,174,239,0.22)"/>
            <stop offset="100%" stopColor="transparent"/>
          </radialGradient>
          <filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="rgba(0,0,0,0.45)"/>
          </filter>
          <filter id="fsh">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.35)"/>
          </filter>
        </defs>

        {/* Stage glow */}
        <ellipse cx="120" cy="160" rx="95" ry="80" fill="url(#glow)"/>

        {/* Ground shadow */}
        <ellipse cx="120" cy="300" rx="68" ry="11" fill="rgba(0,20,60,0.5)" style={{ filter: "blur(6px)" }}>
          {playing && <animate attributeName="rx" values="68;80;68" dur="2s" repeatCount="indefinite"/>}
        </ellipse>

        {/* SUIT BODY */}
        <path d="M 52 148 Q 50 132 70 124 L 95 137 L 120 148 L 145 137 L 170 124 Q 190 132 188 148 L 200 296 Q 120 308 40 296 Z"
          fill="url(#suit)" filter="url(#sh)"/>

        {/* Shirt chest */}
        <path d="M 93 130 L 120 148 L 147 130 L 143 190 L 120 198 L 97 190 Z" fill="#F2F2F2"/>

        {/* Tie knot */}
        <path d="M 114 132 L 126 132 L 124 136 L 120 138 L 116 136 Z" fill="#C8A800"/>
        {/* Tie body */}
        <path d="M 116 136 L 124 136 L 128 168 L 120 178 L 112 168 Z" fill="#FFD100"/>
        <line x1="120" y1="138" x2="120" y2="176" stroke="#C8A800" strokeWidth="1" opacity="0.5"/>

        {/* Left lapel */}
        <path d="M 93 130 L 62 153 L 70 185 L 97 172 Z" fill="#082E78"/>
        {/* Right lapel */}
        <path d="M 147 130 L 178 153 L 170 185 L 143 172 Z" fill="#082E78"/>

        {/* Suit pocket */}
        <rect x="155" y="175" width="22" height="14" rx="3" fill="#092F7A"/>
        <rect x="157" y="173" width="18" height="4" rx="2" fill="white" opacity="0.7"/>

        {/* Buttons */}
        <circle cx="120" cy="205" r="3" fill="#092F7A"/>
        <circle cx="120" cy="218" r="3" fill="#092F7A"/>
        <circle cx="120" cy="231" r="3" fill="#092F7A"/>

        {/* LEFT ARM (animated) */}
        <g className={playing ? "arm-l-sign" : ""}>
          <path d="M 52 148 Q 38 152 26 172 L 18 205 Q 28 210 38 206 L 52 175 Q 58 162 62 148 Z" fill="url(#sleeve)" filter="url(#fsh)"/>
          <path d="M 18 205 Q 8 218 6 234 L 14 246 Q 24 250 34 244 L 40 228 Q 38 212 38 206 Z" fill="url(#sk)"/>
          <ellipse cx="18" cy="250" rx="17" ry="13" fill="url(#sk)" transform="rotate(-22,18,250)"/>
          <rect x="2"  y="241" width="8" height="17" rx="4" fill="url(#sk)" transform="rotate(-35,6,249)"/>
          <rect x="8"  y="236" width="8" height="19" rx="4" fill="url(#sk)" transform="rotate(-18,12,245)"/>
          <rect x="16" y="234" width="8" height="19" rx="4" fill="url(#sk)" transform="rotate(-3,20,243)"/>
          <rect x="24" y="237" width="7" height="17" rx="4" fill="url(#sk)" transform="rotate(12,27,245)"/>
          <rect x="30" y="246" width="7" height="14" rx="4" fill="url(#sk)" transform="rotate(48,33,253)"/>
        </g>

        {/* RIGHT ARM (animated) */}
        <g className={playing ? "arm-r-sign" : ""}>
          <path d="M 188 148 Q 202 152 214 172 L 222 205 Q 212 210 202 206 L 188 175 Q 182 162 178 148 Z" fill="url(#sleeve)" filter="url(#fsh)"/>
          <path d="M 222 205 Q 232 218 234 234 L 226 246 Q 216 250 206 244 L 200 228 Q 202 212 202 206 Z" fill="url(#sk)"/>
          <ellipse cx="222" cy="250" rx="17" ry="13" fill="url(#sk)" transform="rotate(22,222,250)"/>
          <rect x="230" y="241" width="8" height="17" rx="4" fill="url(#sk)" transform="rotate(35,234,249)"/>
          <rect x="224" y="236" width="8" height="19" rx="4" fill="url(#sk)" transform="rotate(18,228,245)"/>
          <rect x="216" y="234" width="8" height="19" rx="4" fill="url(#sk)" transform="rotate(3,220,243)"/>
          <rect x="209" y="237" width="7" height="17" rx="4" fill="url(#sk)" transform="rotate(-12,212,245)"/>
          <rect x="203" y="246" width="7" height="14" rx="4" fill="url(#sk)" transform="rotate(-48,207,253)"/>
        </g>

        {/* NECK */}
        <rect x="106" y="110" width="28" height="25" rx="7" fill="url(#sk)"/>

        {/* HEAD */}
        <ellipse cx="120" cy="76" rx="46" ry="52" fill="url(#sk)" filter="url(#sh)" className={playing ? "head-bob" : ""}/>

        {/* Hair top */}
        <path d="M 76 70 Q 74 42 120 34 Q 166 42 164 70 Q 156 50 120 48 Q 84 50 76 70" fill="#231005"/>
        <path d="M 76 70 Q 72 50 76 40 Q 90 26 120 24 Q 150 26 164 40 Q 168 50 164 70 Q 155 46 120 44 Q 85 46 76 70" fill="#321608"/>
        <path d="M 75 78 Q 69 92 72 104 Q 76 95 80 90 Z" fill="#321608"/>
        <path d="M 165 78 Q 171 92 168 104 Q 164 95 160 90 Z" fill="#321608"/>

        {/* Ears */}
        <ellipse cx="74" cy="80" rx="8.5" ry="12" fill="url(#sk)"/>
        <ellipse cx="166" cy="80" rx="8.5" ry="12" fill="url(#sk)"/>
        <path d="M 75 74 Q 71 80 73 88" stroke="#B07040" strokeWidth="1.5" fill="none"/>
        <path d="M 165 74 Q 169 80 167 88" stroke="#B07040" strokeWidth="1.5" fill="none"/>

        {/* Eye sockets */}
        <ellipse cx="100" cy="77" rx="13" ry="11" fill="rgba(0,0,0,0.06)"/>
        <ellipse cx="140" cy="77" rx="13" ry="11" fill="rgba(0,0,0,0.06)"/>

        {/* Eye whites */}
        <ellipse cx="100" cy="76" rx="10.5" ry="9" fill="white"/>
        <ellipse cx="140" cy="76" rx="10.5" ry="9" fill="white"/>

        {/* Irises */}
        <circle cx="101" cy="77" r="7" fill="#3D2A14"/>
        <circle cx="141" cy="77" r="7" fill="#3D2A14"/>

        {/* Pupils */}
        <circle cx="101" cy="77" r="4" fill="#120A04"/>
        <circle cx="141" cy="77" r="4" fill="#120A04"/>

        {/* Eye highlights */}
        <circle cx="103" cy="74" r="2.5" fill="white" opacity="0.9"/>
        <circle cx="143" cy="74" r="2.5" fill="white" opacity="0.9"/>
        <circle cx="98"  cy="79" r="1.2" fill="white" opacity="0.4"/>
        <circle cx="138" cy="79" r="1.2" fill="white" opacity="0.4"/>

        {/* Eyelids */}
        <path d="M 89 71 Q 100 66 111 71" stroke="#1E0C04" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 129 71 Q 140 66 151 71" stroke="#1E0C04" strokeWidth="2" fill="none" strokeLinecap="round"/>

        {/* Eyebrows */}
        <path d="M 87 63 Q 100 57 113 63" stroke="#231005" strokeWidth="4" fill="none" strokeLinecap="round"/>
        <path d="M 127 63 Q 140 57 153 63" stroke="#231005" strokeWidth="4" fill="none" strokeLinecap="round"/>

        {/* Nose */}
        <path d="M 115 80 L 112 96 Q 120 101 128 96 L 125 80" fill="rgba(180,100,50,0.12)"/>
        <path d="M 112 96 Q 120 101 128 96" stroke="#B07040" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <circle cx="112" cy="95" r="4" fill="rgba(150,80,35,0.18)"/>
        <circle cx="128" cy="95" r="4" fill="rgba(150,80,35,0.18)"/>

        {/* Mouth */}
        <path d={playing ? "M 105 110 Q 120 122 135 110" : "M 105 110 Q 120 118 135 110"}
          stroke="#7A3010" strokeWidth="2.5" fill="none" strokeLinecap="round"/>

        {/* Shirt collar */}
        <path d="M 106 110 L 95 126 L 105 132 L 120 148 L 135 132 L 145 126 L 134 110" fill="white" opacity="0.95"/>

        {/* Popular badge */}
        <rect x="62" y="164" width="28" height="11" rx="4" fill="rgba(255,209,0,0.9)"/>
        <text x="76" y="173" textAnchor="middle" fill="#003876" fontSize="6.5" fontFamily="Outfit" fontWeight="900">POPULAR</text>
      </svg>

      {/* Word label */}
      <div className={`mt-1 px-8 py-2.5 rounded-2xl shadow-lg ${playing ? "sign-word-anim" : ""}`}
        style={{ background: "#FFD100", boxShadow: "0 4px 24px rgba(255,209,0,0.5)" }}>
        <div className="text-[#003876] font-black text-xl tracking-widest text-center" style={{ fontFamily: "'Outfit', sans-serif" }}>{word}</div>
      </div>
    </div>
  );
};

// ─── Sign Language Modal ──────────────────────────────────────────────────────
const SignModal = ({ topic, onClose }: { topic: string; onClose: () => void }) => {
  const data = SIGN_DATA[topic] || SIGN_DATA.welcome;
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<"normal"|"slow">("normal");
  const [wordIdx, setWordIdx] = useState(0);
  const speedMs = speed === "slow" ? 1800 : 900;
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  useEffect(() => { sfx.modal(); speak(data.speech); }, []);

  useEffect(() => {
    if (!playing) { if (timerRef.current) clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setWordIdx(i => (i+1) % data.words.length), speedMs * 2.8);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [playing, speedMs, data.words.length]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,4,16,0.88)", backdropFilter: "blur(8px)" }} onClick={onClose}>
      <div className="w-full max-w-[420px] rounded-t-[34px] overflow-hidden slide-sheet"
        style={{ background: "linear-gradient(175deg,#001E4A 0%,#000E24 100%)", border: "1px solid rgba(0,174,239,0.2)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 pt-5 pb-2">
          <div>
            <div className="text-[#00AEEF] text-[10px] font-black tracking-[0.22em] uppercase">Lengua de Senas Dominicana</div>
            <div className="text-white font-black text-lg mt-0.5" style={{ fontFamily: "'Outfit',sans-serif" }}>{TOPIC_LABEL[topic] || "Senas"}</div>
          </div>
          <button onClick={() => { sfx.tap(); onClose(); }} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 text-lg transition-colors" aria-label="Cerrar">x</button>
        </div>

        <div className="mx-4 mb-2 rounded-2xl overflow-hidden pt-3 pb-1 avatar-glow"
          style={{ background: "linear-gradient(175deg,#002455 0%,#000E28 100%)", border: "1px solid rgba(0,174,239,0.12)" }}>
          <SignPerson playing={playing} speedMs={speedMs} word={data.words[wordIdx]} />
          <div className="flex justify-center gap-2 mt-2 pb-2">
            {data.words.map((_, i) => (
              <button key={i} onClick={() => setWordIdx(i)}
                className={`rounded-full transition-all duration-200 ${i===wordIdx ? "w-6 h-2.5 bg-[#00AEEF]" : "w-2.5 h-2.5 bg-white/20 hover:bg-white/40"}`}/>
            ))}
          </div>
        </div>

        <div className="px-4 pb-3 grid grid-cols-3 gap-2">
          <button onClick={() => { sfx.tap(); setPlaying(p=>!p); }}
            className="flex items-center justify-center gap-2 py-3 rounded-2xl font-bold text-base transition-all active:scale-95"
            style={{ background: playing ? "#FF6B2B" : "#00A651", color: "white" }}>
            {playing ? "Pausar" : "Reanudar"}
          </button>
          <button onClick={() => { sfx.tap(); setSpeed(s=>s==="normal"?"slow":"normal"); }}
            className="flex items-center justify-center gap-1 py-3 rounded-2xl font-semibold text-sm bg-white/10 text-white border border-white/15 transition-all">
            {speed==="slow" ? "Normal" : "Lento"}
          </button>
          <button onClick={() => { sfx.tap(); speak(data.speech); }}
            className="flex items-center justify-center gap-1 py-3 rounded-2xl font-semibold text-sm text-white border border-[#00AEEF]/30 transition-all"
            style={{ background: "#003876" }}>
            Audio
          </button>
        </div>

        <div className="px-4 pb-5">
          <div className="grid grid-cols-5 gap-1.5">
            {Object.keys(SIGN_DATA).map(k => (
              <button key={k} onClick={() => { sfx.tap(); setWordIdx(0); speak(SIGN_DATA[k].speech); }}
                className={`py-2 rounded-xl text-xs font-bold text-center border transition-all ${k===topic ? "bg-[#00AEEF] text-white border-[#00AEEF]" : "bg-white/5 text-white/50 border-white/10"}`}>
                {TOPIC_LABEL[k]?.split(" ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Screen Reader ────────────────────────────────────────────────────────────
const ScreenReader = ({ items, onClose }: { items: string[]; onClose: () => void }) => {
  const [idx, setIdx] = useState(0);
  const [active, setActive] = useState(false);
  const autoRef = useRef(false);

  const read = useCallback((i: number) => {
    if (i >= items.length) { setActive(false); autoRef.current=false; return; }
    setIdx(i); setActive(true);
    speak(items[i], () => { setActive(false); if (autoRef.current) setTimeout(() => read(i+1), 500); });
  }, [items]);

  useEffect(() => { sfx.modal(); read(0); return () => stopSpeak(); }, []);

  const stop = () => { stopSpeak(); setActive(false); autoRef.current=false; };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)" }}>
      <div className="w-full max-w-[420px] rounded-t-[32px] overflow-hidden slide-sheet" style={{ background:"#04091A", borderTop:"2px solid #00AEEF" }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#00AEEF]/20 flex items-center justify-center text-2xl">👁️</div>
            <div>
              <div className="text-[#00AEEF] text-[10px] font-black tracking-widest uppercase">Lector de Pantalla</div>
              <div className="text-white font-bold">TalkBack Popular</div>
            </div>
          </div>
          <button onClick={() => { stop(); sfx.tap(); onClose(); }} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-lg">x</button>
        </div>
        <div className="mx-4 mb-3 rounded-2xl p-4 min-h-16 flex items-center gap-3" style={{ background:"#0A1E3C", border:"1px solid rgba(0,174,239,0.3)" }}>
          {active
            ? <div className="flex gap-0.5 items-center h-7 flex-shrink-0">{[0,1,2,3,4,5].map(i=><div key={i} className="wave-bar w-1 rounded-full bg-[#00AEEF]" style={{height:24}}/>)}</div>
            : <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"><div className="w-2 h-2 rounded-full bg-white/30"/></div>
          }
          <p className="text-white text-base font-medium leading-snug flex-1">{items[idx]}</p>
        </div>
        <div className="mx-4 mb-3 max-h-44 overflow-y-auto scroll-hide space-y-1">
          {items.map((item,i) => (
            <button key={i} onClick={() => { sfx.tap(); read(i); }} className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all ${i===idx?"bg-[#00AEEF] text-white font-semibold":"bg-white/5 text-white/55 hover:bg-white/10"}`}>
              <span className="text-xs opacity-40 mr-2">{i+1}.</span>{item}
            </button>
          ))}
        </div>
        <div className="px-4 pb-6 grid grid-cols-4 gap-2">
          <button onClick={() => { sfx.tap(); read(Math.max(0,idx-1)); }} className="py-3.5 rounded-2xl bg-white/10 text-white text-xl flex items-center justify-center">⏮</button>
          <button onClick={() => { sfx.tap(); active ? stop() : read(idx); }} className={`py-3.5 rounded-2xl text-white text-xl flex items-center justify-center ${active?"bg-red-500":"bg-[#00AEEF]"}`}>{active?"⏹":"▶️"}</button>
          <button onClick={() => { sfx.tap(); read(Math.min(items.length-1,idx+1)); }} className="py-3.5 rounded-2xl bg-white/10 text-white text-xl flex items-center justify-center">⏭</button>
          <button onClick={() => { sfx.tap(); autoRef.current=true; read(0); }} className="py-3.5 rounded-2xl bg-[#00A651] text-white text-sm font-bold flex items-center justify-center">Todo</button>
        </div>
      </div>
    </div>
  );
};

// ─── Voice wave ───────────────────────────────────────────────────────────────
const VoiceWave = () => (
  <div className="flex items-center gap-0.5 h-7">
    {[0,1,2,3,4,5].map(i=><div key={i} className="wave-bar rounded-full bg-white" style={{width:3,height:22,animationDelay:`${i*.09}s`}}/>)}
  </div>
);

const AvatarChip = ({ active }: { active: boolean }) => (
  <div className={`w-16 h-16 rounded-full flex items-center justify-center border-4 border-white/20 flex-shrink-0 ${active?"float-slow avatar-glow":""}`}
    style={{ background: "linear-gradient(135deg,#00AEEF,#003876)" }}>
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="11" rx="3" fill="white"/>
      <path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <path d="M12 17v4M9 21h6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  </div>
);

// ─── Exit confirmation dialog ─────────────────────────────────────────────────
const ExitDialog = ({ onConfirm, onCancel }: { onConfirm:()=>void; onCancel:()=>void }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)" }}>
    <div className="w-full max-w-sm rounded-3xl p-6 fade-up" style={{ background:"#0A1628", border:"1px solid rgba(255,255,255,0.12)" }}>
      <div className="text-center mb-5">
        <div className="text-4xl mb-3">🚪</div>
        <div className="text-white font-black text-xl" style={{ fontFamily:"'Outfit',sans-serif" }}>Deseas salir?</div>
        <div className="text-white/55 text-sm mt-1">Volveras a la pantalla de acceso del banco.</div>
      </div>
      <div className="flex gap-3">
        <button onClick={onCancel} className="flex-1 py-3.5 rounded-2xl font-bold text-white bg-white/10 hover:bg-white/18 transition-colors">Cancelar</button>
        <button onClick={() => { sfx.exit(); onConfirm(); }} className="flex-1 py-3.5 rounded-2xl font-black text-white transition-colors" style={{ background:"linear-gradient(135deg,#CC1A1A,#991010)" }}>
          Salir
        </button>
      </div>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SCREENS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Splash screen (image 1): solid dark navy, logo centered ─────────────────
const SplashScreen = ({ onNext }: { onNext:()=>void }) => {
  useEffect(() => { const t=setTimeout(onNext,1600); return ()=>clearTimeout(t); },[onNext]);
  return (
    <div className="flex flex-col items-center justify-center h-full" style={{ background:"#0A1D5A" }}>
      <div className="logo-scale-in">
        <PopularLogo width={130}/>
      </div>
    </div>
  );
};

// ─── Hello screen (image 2): gradient + cyan glow + Hola + logo top ──────────
const HelloScreen = ({ onNext }: { onNext:()=>void }) => {
  const [showHola, setShowHola] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(()=>setShowHola(true), 350);
    const t2 = setTimeout(onNext, 2200);
    return ()=>{ clearTimeout(t1); clearTimeout(t2); };
  },[onNext]);
  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{
      background:"linear-gradient(175deg,#0A2060 0%,#0D2D7A 35%,#0B245E 65%,#091840 100%)"
    }}>
      {/* Cyan radial glow top-left */}
      <div className="absolute top-0 left-0 w-72 h-72 pointer-events-none" style={{
        background:"radial-gradient(circle at 20% 20%, rgba(0,210,230,0.28) 0%, transparent 65%)"
      }}/>
      {/* Blue glow bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-52 pointer-events-none" style={{
        background:"radial-gradient(ellipse at 50% 110%, rgba(20,80,180,0.45) 0%, transparent 70%)"
      }}/>

      {/* Logo top-center */}
      <div className="flex flex-col items-center pt-14 pb-0 relative z-10">
        <PopularLogo width={120}/>
      </div>

      {/* Hola center */}
      <div className="flex-1 flex items-center justify-center relative z-10">
        {showHola && (
          <span className="hola-pop text-white text-5xl font-light tracking-wide" style={{ fontFamily:"'Nunito',sans-serif", fontWeight:300 }}>
            ¡Hola!
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Login screen (image 3): gradient + hamburger + orange button + bottom bar ─
const LoginScreen = ({ onLogin }: { onLogin:()=>void }) => {
  const [showContent, setShowContent] = useState(false);
  useEffect(() => { const t=setTimeout(()=>setShowContent(true),80); return ()=>clearTimeout(t); },[]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden" style={{
      background:"linear-gradient(175deg,#0A2060 0%,#0D2D7A 35%,#0B245E 65%,#091840 100%)"
    }}>
      {/* Cyan glow top-left */}
      <div className="absolute top-0 left-0 w-72 h-72 pointer-events-none" style={{
        background:"radial-gradient(circle at 20% 20%, rgba(0,210,230,0.28) 0%, transparent 65%)"
      }}/>
      {/* Blue glow bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-52 pointer-events-none" style={{
        background:"radial-gradient(ellipse at 50% 110%, rgba(20,80,180,0.45) 0%, transparent 70%)"
      }}/>

      {/* Top row: hamburger + logo */}
      <div className={`relative z-10 flex items-start pt-14 px-6 ${showContent?"login-slide-up":""}`} style={{ opacity: showContent?1:0 }}>
        {/* Hamburger */}
        <button onClick={()=>sfx.tap()} className="flex flex-col gap-[5px] mt-1 p-1" aria-label="Menu">
          <span className="block w-6 h-[2px] bg-white rounded"/>
          <span className="block w-6 h-[2px] bg-white rounded"/>
        </button>
        {/* Logo centered */}
        <div className="flex-1 flex justify-center">
          <PopularLogo width={112}/>
        </div>
        {/* Spacer for symmetry */}
        <div className="w-8"/>
      </div>

      {/* Main content: biometric button + password */}
      <div className={`flex-1 flex flex-col justify-center px-6 relative z-10 ${showContent?"login-slide-up":""}`} style={{ animationDelay:"0.12s", opacity: showContent?1:0 }}>
        {/* Orange biometric button */}
        <button onClick={()=>{ sfx.confirm(); onLogin(); }}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl text-white font-bold text-lg active:scale-97 transition-transform mb-5"
          style={{ background:"linear-gradient(135deg,#F0900A,#E07808)", boxShadow:"0 8px 32px rgba(230,120,0,0.45)" }}>
          {/* Face/fingerprint icon */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="2" y="2" width="8" height="8" rx="2.5" stroke="white" strokeWidth="2" fill="none"/>
            <rect x="18" y="2" width="8" height="8" rx="2.5" stroke="white" strokeWidth="2" fill="none"/>
            <rect x="2" y="18" width="8" height="8" rx="2.5" stroke="white" strokeWidth="2" fill="none"/>
            <circle cx="19" cy="19" r="4" stroke="white" strokeWidth="2" fill="none"/>
            <circle cx="19" cy="19" r="1.5" fill="white"/>
          </svg>
          Acceder con rostro o huella
        </button>

        {/* Password text link */}
        <button onClick={()=>{ sfx.tap(); onLogin(); }}
          className="text-white text-center text-base font-semibold tracking-wide active:opacity-70 transition-opacity">
          Acceder con contrasena
        </button>
      </div>

      {/* Bottom quick-action bar */}
      <div className={`relative z-10 border-t border-white/10 ${showContent?"login-slide-up":""}`} style={{ animationDelay:"0.2s", opacity: showContent?1:0 }}>
        <div className="flex items-stretch divide-x divide-dashed divide-white/20 pb-8">
          {[
            { icon: (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="6" y="8" width="16" height="12" rx="2" stroke="white" strokeWidth="1.8" fill="none"/>
                <circle cx="10" cy="5" r="2" stroke="white" strokeWidth="1.5" fill="none"/>
                <circle cx="18" cy="5" r="2" stroke="white" strokeWidth="1.5" fill="none"/>
                <line x1="10" y1="13" x2="18" y2="13" stroke="white" strokeWidth="1.5"/>
              </svg>
            ), label:"Contactos, turnos\ny citas" },
            { icon: (
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <circle cx="14" cy="14" r="9" stroke="white" strokeWidth="1.8" fill="none"/>
                <path d="M10 14 Q14 9 18 14 Q14 19 10 14Z" stroke="white" strokeWidth="1.5" fill="none"/>
              </svg>
            ), label:"Token\nPopular" },
            { icon: (
              <div className="relative">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <rect x="4" y="4" width="9" height="9" rx="1.5" stroke="white" strokeWidth="1.8" fill="none"/>
                  <rect x="15" y="4" width="9" height="9" rx="1.5" stroke="white" strokeWidth="1.8" fill="none"/>
                  <rect x="4" y="15" width="9" height="9" rx="1.5" stroke="white" strokeWidth="1.8" fill="none"/>
                  <rect x="15" y="15" width="4" height="4" fill="white" rx="0.5"/>
                  <rect x="20" y="20" width="4" height="4" fill="white" rx="0.5"/>
                  <rect x="6.5" y="6.5" width="4" height="4" fill="white" rx="0.5"/>
                  <rect x="17.5" y="6.5" width="4" height="4" fill="white" rx="0.5"/>
                  <rect x="6.5" y="17.5" width="4" height="4" fill="white" rx="0.5"/>
                </svg>
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#F0900A] border border-[#0A2060]"/>
              </div>
            ), label:"Pagar a\nQR Toke" },
          ].map((item, i) => (
            <button key={i} onClick={()=>sfx.tap()} className="flex-1 flex flex-col items-center gap-2 pt-4 active:bg-white/5 transition-colors">
              {item.icon}
              <span className="text-white text-[11px] text-center leading-tight whitespace-pre-line font-medium px-1">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Drawer icon helper ── */
const DIcon = ({ children }: { children: React.ReactNode }) => (
  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background:"#E8F0FC" }}>
    {children}
  </div>
);

/* ── Transfer Bottom Sheet ── */
const TransferBottomSheet = ({ onClose }: { onClose: () => void }) => {
  const options = [
    { label:"Terceros", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="7" r="3" stroke="#0A2060" strokeWidth="2"/><path d="M4 19c0-3.31 2.69-6 6-6" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/><path d="M17 12l4 4m0 0l-4 4m4-4H13" stroke="#E07808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { label:"Otros bancos", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v1H3v-1z" stroke="#0A2060" strokeWidth="1.8" strokeLinejoin="round"/><rect x="5" y="11" width="3" height="7" stroke="#0A2060" strokeWidth="1.8"/><rect x="10.5" y="11" width="3" height="7" stroke="#0A2060" strokeWidth="1.8"/><rect x="16" y="11" width="3" height="7" stroke="#0A2060" strokeWidth="1.8"/><path d="M2 18h20" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/><path d="M19 8l3 3" stroke="#E07808" strokeWidth="2" strokeLinecap="round"/></svg> },
    { label:"Expresos", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#0A2060" strokeWidth="1.8"/><path d="M12 8v4l3 2" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/><path d="M18 18l2 2" stroke="#E07808" strokeWidth="2" strokeLinecap="round"/><path d="M20 16a5 5 0 11-4 4" stroke="#E07808" strokeWidth="2" strokeLinecap="round"/></svg> },
    { label:"Expresos a otros bancos", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="10" cy="10" r="6" stroke="#0A2060" strokeWidth="1.8"/><path d="M10 7v3l2 1.5" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/><path d="M16 17l3 3" stroke="#E07808" strokeWidth="2" strokeLinecap="round"/><path d="M19 15a4 4 0 11-3 3" stroke="#E07808" strokeWidth="2" strokeLinecap="round"/></svg> },
    { label:"Entre mis cuentas", dim:true, icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M7 4H5a2 2 0 00-2 2v12a2 2 0 002 2h2" stroke="#9BAEC8" strokeWidth="1.8" strokeLinecap="round"/><path d="M17 4h2a2 2 0 012 2v12a2 2 0 01-2 2h-2" stroke="#9BAEC8" strokeWidth="1.8" strokeLinecap="round"/><path d="M9 8l-2 2 2 2M15 12l2 2-2 2" stroke="#9BAEC8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
    { label:"Cuenta Internacional", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#0A2060" strokeWidth="1.8"/><path d="M12 3c-2 3-3 5.5-3 9s1 6 3 9M12 3c2 3 3 5.5 3 9s-1 6-3 9" stroke="#0A2060" strokeWidth="1.5"/><path d="M3 12h18" stroke="#0A2060" strokeWidth="1.5"/><path d="M3 8h18M3 16h18" stroke="#0A2060" strokeWidth="1.2" opacity=".5"/></svg> },
  ];
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="slide-sheet bg-white rounded-t-3xl pb-10" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300"/></div>
        <div className="text-[#0A2060] font-black text-[17px] text-center py-4 px-5" style={{ fontFamily:"'Outfit',sans-serif" }}>¿A dónde deseas transferir?</div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 px-5 pt-2">
          {options.map(o => (
            <button key={o.label} onClick={()=>{ sfx.tap(); speak(o.label); onClose(); }}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:"#EEF4FF" }}>{o.icon}</div>
              <span className={`text-center text-[11px] font-semibold leading-tight ${o.dim?"text-[#9BAEC8]":"text-[#0A2060]"}`}>{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Pay Bottom Sheet ── */
const PayBottomSheet = ({ onClose }: { onClose: () => void }) => {
  const options = [
    { label:"Tarjetas de crédito", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="#0A2060" strokeWidth="1.8"/><path d="M2 10h20" stroke="#0A2060" strokeWidth="1.8"/><rect x="5" y="14" width="5" height="2" rx="1" fill="#0A2060"/></svg> },
    { label:"Préstamos", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#0A2060" strokeWidth="1.8"/><path d="M12 8v1m0 6v1m-2-4h3.5c.83 0 1.5.67 1.5 1.5S14.33 15 13.5 15H12M9.5 10H13" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/><path d="M17 4a9 9 0 010 16" stroke="#E07808" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { label:"Servicios y facturas", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#0A2060" strokeWidth="1.8"/><path d="M14 2v6h6M12 17a2 2 0 100-4 2 2 0 000 4z" stroke="#0A2060" strokeWidth="1.5"/><path d="M12 13V11" stroke="#0A2060" strokeWidth="1.5" strokeLinecap="round"/></svg> },
    { label:"Impuestos", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="#0A2060" strokeWidth="1.8"/><path d="M14 2v6h6"/><text x="8" y="18" fontSize="8" fontWeight="700" fill="#E07808">%</text></svg> },
    { label:"Hacer recargas", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="18" rx="2" stroke="#0A2060" strokeWidth="1.8"/><path d="M10 6h4M12 18v.01" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/><path d="M12 10v3m-1.5-1.5H15" stroke="#E07808" strokeWidth="1.8" strokeLinecap="round"/></svg> },
    { label:"Código QR", icon:<svg width="28" height="28" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8"/><rect x="5" y="5" width="3" height="3" fill="#0A2060"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8"/><rect x="16" y="5" width="3" height="3" fill="#0A2060"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8"/><rect x="5" y="16" width="3" height="3" fill="#0A2060"/><path d="M14 14h3v3M17 17h3v3M14 20h3" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  ];
  return (
    <div className="absolute inset-0 z-50 flex flex-col justify-end" style={{ background:"rgba(0,0,0,0.45)" }} onClick={onClose}>
      <div className="slide-sheet bg-white rounded-t-3xl pb-10" onClick={e=>e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-gray-300"/></div>
        <div className="text-[#0A2060] font-black text-[17px] text-center py-4 px-5" style={{ fontFamily:"'Outfit',sans-serif" }}>¿Qué deseas pagar?</div>
        <div className="grid grid-cols-3 gap-x-4 gap-y-6 px-5 pt-2">
          {options.map(o => (
            <button key={o.label} onClick={()=>{ sfx.tap(); speak(o.label); onClose(); }}
              className="flex flex-col items-center gap-2 active:scale-95 transition-transform">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background:"#EEF4FF" }}>{o.icon}</div>
              <span className="text-center text-[11px] font-semibold leading-tight text-[#0A2060]">{o.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Side Drawer ── */
const SideDrawer = ({
  isOpen, onClose, onScreen, onExit, onTransfer, onPay
}: {
  isOpen: boolean;
  onClose: () => void;
  onScreen: (s: Screen) => void;
  onExit: () => void;
  onTransfer: () => void;
  onPay: () => void;
}) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  const doAction = (fn: () => void) => { sfx.tap(); fn(); };

  type MenuItem = {
    id: string;
    icon: React.ReactNode;
    label: string;
    chevron?: boolean;
    action: () => void;
    sub?: Array<{ label: string; action: () => void }>;
  };

  const items: MenuItem[] = [
    {
      id:"inicio", label:"Ir al inicio", chevron:false, action:()=>onClose(),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H15v-5H9v5H4a1 1 0 01-1-1v-9.5z" stroke="#0A2060" strokeWidth="2" strokeLinejoin="round"/></svg>
    },
    {
      id:"transferir", label:"Transferir", chevron:true,
      action:()=>toggle("transferir"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 8h13M4 8l3-3M4 8l3 3" stroke="#0A2060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M20 16H7M20 16l-3-3M20 16l-3 3" stroke="#0A2060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      sub:[
        { label:"Popular a Popular", action:()=>{ onClose(); onTransfer(); } },
        { label:"A otro banco", action:()=>{ onClose(); onTransfer(); } },
      ]
    },
    {
      id:"pagar", label:"Pagar", chevron:true,
      action:()=>toggle("pagar"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="13" rx="2" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M12 10v6M9 13h6" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>,
      sub:[
        { label:"Servicios", action:()=>{ onClose(); onPay(); } },
        { label:"Tarjeta de crédito", action:()=>{ onClose(); onPay(); } },
      ]
    },
    {
      id:"codigo-cash", label:"Código cash", chevron:false, action:()=>doAction(onClose),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 8l4 4-4 4M11 8l4 4-4 4" stroke="#0A2060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M17 8h2" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/><path d="M17 12h2" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/><path d="M17 16h2" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>
    },
    {
      id:"avanzar", label:"Avanzar efectivo", chevron:false, action:()=>doAction(onClose),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="#0A2060" strokeWidth="2"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>
    },
    {
      id:"toke", label:"Toke", chevron:false, action:()=>doAction(onClose),
      icon:<img src={tokeLogoImg} alt="Toke" className="w-8 h-8 rounded-lg object-cover"/>
    },
    {
      id:"cheque", label:"Depositar un cheque", chevron:false, action:()=>doAction(onClose),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M7 9h10M7 13h6" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>
    },
    {
      id:"remesas", label:"Remesas", chevron:false, action:()=>doAction(onClose),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M12 7v1m0 8v1m-3.5-5h6c.83 0 1.5.67 1.5 1.5S15.33 15 14.5 15H12m-3.5-5H14" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/></svg>
    },
    {
      id:"tarjetas", label:"Tarjetas", chevron:true,
      action:()=>toggle("tarjetas"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="13" rx="2" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M2 10h20" stroke="#0A2060" strokeWidth="2"/><rect x="5" y="14" width="5" height="2" rx="1" fill="#0A2060"/></svg>,
      sub:[
        { label:"Ver mis tarjetas", action:()=>doAction(onClose) },
        { label:"Bloquear tarjeta", action:()=>doAction(onClose) },
      ]
    },
    {
      id:"beneficiarios", label:"Ver beneficiarios", chevron:true,
      action:()=>toggle("beneficiarios"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M3 20c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/><circle cx="17" cy="7" r="2.5" stroke="#0A2060" strokeWidth="1.8" fill="none"/><path d="M21 20c0-2.76-1.79-5-4-5" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/></svg>,
      sub:[
        { label:"Mis beneficiarios", action:()=>doAction(onClose) },
        { label:"Agregar beneficiario", action:()=>doAction(onClose) },
      ]
    },
    {
      id:"servicios", label:"Servicios y reclamaciones", chevron:true,
      action:()=>toggle("servicios"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="#0A2060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M8 12h8M8 16h4" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>,
      sub:[
        { label:"Servicios", action:()=>doAction(onClose) },
        { label:"Reclamaciones", action:()=>doAction(onClose) },
      ]
    },
    {
      id:"solicitar", label:"Solicitar productos", chevron:true,
      action:()=>toggle("solicitar"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="2" fill="none"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="2" fill="none"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="2" fill="none"/><path d="M14 17.5h7M17.5 14v7" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/></svg>,
      sub:[
        { label:"Tarjeta de crédito", action:()=>doAction(onClose) },
        { label:"Préstamo personal", action:()=>doAction(onClose) },
      ]
    },
    {
      id:"facilidades", label:"Facilidades de pagos", chevron:true,
      action:()=>toggle("facilidades"),
      icon:<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 21c-4.97 0-9-2-9-6V9m18 6c0 4-4.03 6-9 6m9-12c0 1.66-4.03 3-9 3S3 10.66 3 9c0-1.66 4.03-3 9-3s9 1.34 9 3z" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/></svg>,
      sub:[
        { label:"Ver mis facilidades", action:()=>doAction(onClose) },
        { label:"Solicitar facilidad", action:()=>doAction(onClose) },
      ]
    },
  ];

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex" style={{ background:"rgba(0,0,0,0.45)" }}
      onClick={onClose}>
      {/* White drawer panel */}
      <div className="slide-in-left bg-white h-full overflow-y-auto scroll-hide flex flex-col"
        style={{ width:"78%" }}
        onClick={e => e.stopPropagation()}>

        {/* Drawer header */}
        <div className="flex items-center gap-3 px-4 pt-14 pb-4 border-b border-[#F0F4FA]">
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
            style={{ background:"#FFF0E0" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 6l-6 6 6 6" stroke="#E07808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <span className="text-[#0A2060] font-bold text-[16px]" style={{ fontFamily:"'Outfit',sans-serif" }}>
            ¿Qué deseas hacer?
          </span>
        </div>

        {/* Menu items */}
        <div className="flex-1 py-1">
          {items.map((item, idx) => (
            <div key={item.id}>
              <button className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[#F5F8FF] transition-colors"
                onClick={() => { sfx.tap(); item.action(); }}>
                <DIcon>{item.icon}</DIcon>
                <span className="flex-1 text-left text-[#0A2060] text-[14px] font-medium leading-snug">{item.label}</span>
                {item.chevron && (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    style={{ transform: expanded === item.id ? "rotate(90deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                    <path d="M9 6l6 6-6 6" stroke="#E07808" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
              {/* Sub-items */}
              {item.chevron && expanded === item.id && item.sub && (
                <div className="bg-[#F7F9FE] border-l-2 border-[#E07808]/30 ml-[56px] mr-4 mb-1 rounded-lg overflow-hidden">
                  {item.sub.map((s, si) => (
                    <button key={si} className="w-full text-left px-4 py-3 text-[13px] text-[#0A2060]/80 font-medium active:bg-[#E8F0FC] border-b last:border-b-0 border-[#E8F0FA]"
                      onClick={()=>{ sfx.tap(); s.action(); }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
              {idx < items.length - 1 && expanded !== item.id && (
                <div className="mx-4 h-px bg-[#F0F4FA]"/>
              )}
            </div>
          ))}
        </div>

        {/* Salir at the bottom */}
        <div className="border-t border-[#F0F4FA] px-4 py-4 pb-10">
          <button className="w-full flex items-center gap-3 py-3 active:opacity-60"
            onClick={()=>{ sfx.tap(); onClose(); onExit(); }}>
            <DIcon>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M16 17l5-5m0 0l-5-5m5 5H9" stroke="#D63030" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" stroke="#D63030" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </DIcon>
            <span className="text-[#D63030] font-bold text-[14px]">Salir</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const HomeScreen = ({ onBarriers, onScreen, onExit, sinBarrerasActive, onDeactivate, globalFontSize, onCycleFont, darkMode, onToggleDark }: {
  onBarriers:()=>void; onScreen:(s:Screen)=>void; onExit:()=>void;
  sinBarrerasActive: boolean; onDeactivate: ()=>void;
  globalFontSize: "small"|"normal"|"large"|"xlarge"; onCycleFont: ()=>void;
  darkMode: boolean; onToggleDark: ()=>void;
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [showPaySheet, setShowPaySheet] = useState(false);
  const [audioGuide, setAudioGuide] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const fontScale = globalFontSize === "xlarge" ? 1.32 : globalFontSize === "large" ? 1.15 : globalFontSize === "small" ? 0.88 : 1;

  const guideSteps = [
    { label:"Toca para hablar", desc:"Este botón activa el asistente de voz. Puedes hablar para consultar tu saldo, transferir dinero o pagar servicios." },
    { label:"Botón Aa", desc:"Este botón cambia el tamaño del texto para que sea más fácil de leer. Tócalo para agrandar o reducir las letras." },
    { label:"Transferir", desc:"Presiona Transferir para enviar dinero a otra persona o cuenta bancaria." },
    { label:"Pagar", desc:"Presiona Pagar para pagar servicios como electricidad, agua o internet." },
    { label:"Retirar", desc:"Presiona Retirar para retirar efectivo de un cajero automático." },
    { label:"Productos", desc:"Presiona Productos para ver todos tus productos bancarios: cuentas, tarjetas y préstamos." },
    { label:"Desactivar módulo", desc:"Este botón desactiva el módulo Popular Sin Barreras y vuelve a la vista normal de la aplicación." },
  ];

  const startAudioGuide = () => {
    sfx.modal(); setGuideStep(0); setAudioGuide(true);
    speak(guideSteps[0].desc);
  };
  const nextGuideStep = () => {
    const next = guideStep + 1;
    if (next >= guideSteps.length) { setAudioGuide(false); stopSpeak(); speak("Audio guía finalizado. Ya conoces todos los botones."); return; }
    sfx.tap(); setGuideStep(next); speak(guideSteps[next].desc);
  };
  const skipGuide = () => { sfx.tap(); setAudioGuide(false); stopSpeak(); };

  return (
    <div className="flex flex-col h-full" style={{ background:"#fff" }}>
      {showTransferSheet && <TransferBottomSheet onClose={()=>setShowTransferSheet(false)}/>}
      {showPaySheet && <PayBottomSheet onClose={()=>setShowPaySheet(false)}/>}
      <SideDrawer
        isOpen={drawerOpen}
        onClose={()=>setDrawerOpen(false)}
        onScreen={s=>{ setDrawerOpen(false); onScreen(s); }}
        onExit={()=>{ setDrawerOpen(false); onExit(); }}
        onTransfer={()=>{ setDrawerOpen(false); setShowTransferSheet(true); }}
        onPay={()=>{ setDrawerOpen(false); setShowPaySheet(true); }}
      />

      {/* ── HEADER ── */}
      <div className="flex-shrink-0 px-5 pt-12 pb-6" style={{ background:"linear-gradient(180deg,#0A2060 0%,#1A3E8A 100%)" }}>
        <div className="flex items-center justify-between">
          <button onClick={()=>{ sfx.tap(); setDrawerOpen(true); }} className="flex flex-col gap-[5px] p-1" aria-label="Menu">
            <span className="block w-6 h-[2.5px] bg-white rounded"/>
            <span className="block w-6 h-[2.5px] bg-white rounded"/>
            <span className="block w-6 h-[2.5px] bg-white rounded"/>
          </button>
          <div className="text-center">
            <div className="text-white font-bold text-[17px] leading-tight">Hola, Eliana</div>
            <div className="text-white/60 text-[13px] mt-0.5">8 de septiembre, 2026</div>
          </div>
          <div className="flex items-center gap-2">
            {sinBarrerasActive && (
              <>
                {/* Aa — font size */}
                <button onClick={()=>{ sfx.tap(); onCycleFont(); speak(globalFontSize==="xlarge"?"Texto pequeño":globalFontSize==="large"?"Texto extra grande":globalFontSize==="normal"?"Texto grande":"Texto normal"); }}
                  aria-label="Tamaño de texto"
                  className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-[#0A2060]"
                  style={{ background:"rgba(255,255,255,0.92)", boxShadow:"0 2px 8px rgba(0,0,0,0.18)", fontSize:11 }}>
                  {globalFontSize==="small"?"A-":globalFontSize==="large"?"A+":globalFontSize==="xlarge"?"A++":"Aa"}
                </button>
                {/* Moon — dark mode */}
                <button onClick={()=>{ sfx.tap(); onToggleDark(); speak(darkMode?"Modo claro activado":"Modo oscuro activado"); }}
                  aria-label="Modo oscuro"
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: darkMode?"#1A3E8A":"rgba(255,255,255,0.92)", boxShadow:"0 2px 8px rgba(0,0,0,0.18)" }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill={darkMode?"#FFD100":"#0A2060"} strokeWidth="0"/>
                  </svg>
                </button>
              </>
            )}
            <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm" style={{ background:"#0AACB8" }}>EP</div>
          </div>
        </div>

        {/* Account card */}
        <div className="mt-5 bg-white rounded-2xl px-5 py-4" style={{ boxShadow:"0 4px 20px rgba(0,0,0,0.18)" }}>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[#0A2060] font-bold text-[15px]">Cuenta Corriente</div>
              <div className="text-[#5C6E8A] text-[13px] mt-0.5">100-200-0001</div>
            </div>
            <div className="text-right">
              <div className="text-[#5C6E8A] text-[13px]">Balance disponible:</div>
              <div className="text-[#E07808] font-bold text-[17px] mt-0.5">RD$10,000.00</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── GRADIENT FADE navy → white ── */}
      <div className="flex-shrink-0 h-24" style={{
        background:"linear-gradient(180deg,#1A3E8A 0%,#4A72C0 28%,#A8C0E8 58%,#EEF3FA 80%,#fff 100%)"
      }}/>

      {/* ── BODY ── */}
      <div className="flex-1 overflow-y-auto scroll-hide bg-white px-4 pb-32">
        {sinBarrerasActive ? (
          /* ── Activated: "Toca para hablar" (image-8) ── */
          <div className="flex flex-col h-full relative">
            {/* Audio Guide overlay */}
            {audioGuide && (
              <div className="absolute inset-0 z-40 flex flex-col" style={{ background:"rgba(0,10,40,0.82)", backdropFilter:"blur(2px)" }}>
                <div className="flex-1 flex flex-col items-center justify-center px-6 gap-5">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background:"#0AACB8" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path d="M3 12a9 9 0 0118 0" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                      <rect x="2" y="12" width="4" height="7" rx="2" fill="white"/>
                      <rect x="18" y="12" width="4" height="7" rx="2" fill="white"/>
                    </svg>
                  </div>
                  <div className="text-[#FFD100] text-xs font-bold tracking-widest uppercase">Audio guía · paso {guideStep + 1} de {guideSteps.length}</div>
                  <div className="text-white font-black text-[18px] text-center" style={{ fontFamily:"'Outfit',sans-serif" }}>
                    {guideSteps[guideStep].label}
                  </div>
                  <div className="bg-white/10 rounded-2xl px-5 py-4 border border-white/15">
                    <p className="text-white/85 text-[14px] text-center leading-relaxed" style={{ fontSize: 14 * fontScale }}>
                      {guideSteps[guideStep].desc}
                    </p>
                  </div>
                  {/* Progress dots */}
                  <div className="flex gap-2">
                    {guideSteps.map((_,i)=>(
                      <div key={i} className="rounded-full transition-all" style={{ width: i===guideStep?20:8, height:8, background: i<=guideStep?"#0AACB8":"rgba(255,255,255,0.2)" }}/>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 px-6 pb-16">
                  <button onClick={skipGuide} className="flex-1 py-3.5 rounded-2xl border border-white/20 text-white/70 font-semibold text-sm active:opacity-60">
                    Saltar
                  </button>
                  <button onClick={nextGuideStep} className="flex-1 py-3.5 rounded-2xl font-bold text-white text-sm active:scale-97 transition-transform"
                    style={{ background:"linear-gradient(135deg,#0AACB8,#1A3E8A)" }}>
                    {guideStep < guideSteps.length - 1 ? "Siguiente ›" : "Finalizar ✓"}
                  </button>
                </div>
              </div>
            )}

            {/* Toca para hablar card */}
            <button onClick={()=>{ sfx.listen(); onScreen("voice"); }}
              className="w-full bg-white rounded-2xl px-6 py-8 flex flex-col items-center gap-3 active:scale-98 transition-transform"
              style={{ boxShadow:"0 4px 20px rgba(0,56,118,0.1)", border:"1px solid #E8F0FA" }}>
              <span className="text-[#0A2060] font-black text-center" style={{ fontFamily:"'Outfit',sans-serif", fontSize: 24 * fontScale }}>
                Toca para hablar
              </span>
              <div className="flex items-center gap-[3px] h-8">
                {[10,18,26,20,30,22,14,28,16,24,12,20,26,18,10].map((h,i)=>(
                  <div key={i} className="wave-bar rounded-full" style={{ width:3, height:h, background:"linear-gradient(180deg,#1A3E8A 0%,#0AACB8 100%)", animationDelay:`${i*0.06}s` }}/>
                ))}
              </div>
              <div className="w-full h-[2px] rounded-full" style={{ background:"linear-gradient(90deg,#0AACB8 0%,#1A3E8A 100%)" }}/>
            </button>

            <div className="flex-1"/>

            {/* Deactivate button */}
            <button onClick={()=>{ sfx.tap(); onDeactivate(); }}
              className="mx-auto mb-2 flex items-center gap-2 py-2.5 px-5 rounded-full border border-[#CDD8ED] active:opacity-60 transition-opacity">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18.36 6.64a9 9 0 11-12.73 0" stroke="#5C6E8A" strokeWidth="2" strokeLinecap="round"/>
                <path d="M12 2v7" stroke="#5C6E8A" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <span style={{ fontSize: 13 * fontScale, color:"#5C6E8A", fontWeight:500 }}>Desactivar módulo</span>
            </button>
          </div>
        ) : (
          /* ── Default: Sin Barreras banner (white card style) ── */
          <button onClick={()=>{ sfx.confirm(); onBarriers(); }}
            className="w-full rounded-2xl bg-white active:scale-98 transition-transform"
            style={{ boxShadow:"0 4px 20px rgba(0,56,118,0.13)", border:"1px solid #E8F0FA" }}>
            <div className="p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background:"#EEF4FF" }}>
                <svg width="34" height="34" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="22" fill="#E8F0FC" stroke="#1A3E8A" strokeWidth="2"/>
                  <circle cx="24" cy="14" r="3.5" fill="#1A3E8A"/>
                  <path d="M16 20h16" stroke="#1A3E8A" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M24 20v7l-4 7" stroke="#1A3E8A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M24 27l4 7" stroke="#1A3E8A" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="flex-1 text-left">
                <div className="text-[#5C6E8A] text-[10px] font-semibold tracking-[0.12em] uppercase mb-0.5">Nuevo módulo</div>
                <div className="text-[#0A2060] text-[17px] font-black leading-tight" style={{ fontFamily:"'Outfit',sans-serif" }}>Popular Sin Barreras</div>
                <div className="text-[#5C6E8A] text-[12px] mt-0.5">Banco accesible · IA · Voz · Señas</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 6l6 6-6 6" stroke="#E07808" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="h-[3px] rounded-b-2xl" style={{ background:"linear-gradient(90deg,#0AACB8 0%,#1A3E8A 100%)" }}/>
          </button>
        )}
      </div>

      {/* ── BOTTOM NAV ── */}
      <div className="fixed bottom-0 z-20 bg-white border-t border-[#E0E8F4]"
        style={{width:"min(393px,100vw)",left:"50%",transform:"translateX(-50%)"}}>
        {/* Toke raised circular button */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-7">
          <button onClick={()=>sfx.tap()} aria-label="Toke"
            className="w-[62px] h-[62px] rounded-full overflow-hidden shadow-xl active:scale-95 transition-transform border-4 border-white"
            style={{ background:"#5B4BC8" }}>
            <img src={tokeLogoImg} alt="Toke" className="w-full h-full object-cover"/>
          </button>
        </div>

        <div className="flex items-end pb-6 pt-2">
          {/* Audio guía — shown when Sin Barreras active */}
          {sinBarrerasActive && (
            <button onClick={startAudioGuide} className="flex-1 flex flex-col items-center gap-1 active:opacity-60 pt-1">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 12a9 9 0 0118 0" stroke="#0A2060" strokeWidth="2" strokeLinecap="round"/>
                <rect x="2" y="12" width="4" height="7" rx="2" fill="#0AACB8"/>
                <rect x="18" y="12" width="4" height="7" rx="2" fill="#0AACB8"/>
              </svg>
              <span className="text-[11px] text-[#0A2060] font-medium">Audio guía</span>
            </button>
          )}
          {/* Transferir */}
          <button onClick={()=>{ sfx.nav(); setShowTransferSheet(true); }} className="flex-1 flex flex-col items-center gap-1 active:opacity-60 pt-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h13M4 8l3-3M4 8l3 3" stroke={showTransferSheet?"#E07808":"#0A2060"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20 16H7M20 16l-3-3M20 16l-3 3" stroke={showTransferSheet?"#E07808":"#0A2060"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className={`text-[11px] font-medium ${showTransferSheet?"text-[#E07808]":"text-[#0A2060]"}`}>Transferir</span>
          </button>
          {/* Pagar */}
          <button onClick={()=>{ sfx.nav(); setShowPaySheet(true); }} className="flex-1 flex flex-col items-center gap-1 active:opacity-60 pt-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="6" width="16" height="13" rx="2" stroke={showPaySheet?"#E07808":"#0A2060"} strokeWidth="2" fill="none"/>
              <path d="M12 10v6M9 13h6" stroke={showPaySheet?"#E07808":"#0A2060"} strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className={`text-[11px] font-medium ${showPaySheet?"text-[#E07808]":"text-[#0A2060]"}`}>Pagar</span>
          </button>
          {/* Toke spacer */}
          <div className="flex-1 flex flex-col items-center pt-1 gap-1">
            <div className="h-6"/>
            <span className="text-[11px] text-[#0A2060] font-medium">Toke</span>
          </div>
          {/* Retirar */}
          <button onClick={()=>sfx.tap()} className="flex-1 flex flex-col items-center gap-1 active:opacity-60 pt-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 6l6 6-6 6M7 6l6 6-6 6" stroke="#0A2060" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-[11px] text-[#0A2060] font-medium">Retirar</span>
          </button>
          {/* Productos */}
          <button onClick={()=>sfx.tap()} className="flex-1 flex flex-col items-center gap-1 active:opacity-60 pt-1">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8" fill="none"/>
              <rect x="14" y="3" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8" fill="none"/>
              <rect x="3" y="14" width="7" height="7" rx="1" stroke="#0A2060" strokeWidth="1.8" fill="none"/>
              <path d="M14 17.5h7M17.5 14v7" stroke="#0A2060" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            <span className="text-[11px] text-[#0A2060] font-medium">Productos</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ── Next-arrow pill button (shared by onboarding steps) ── */
const NextPill = ({ onPress, dark = false }: { onPress: () => void; dark?: boolean }) => (
  <button onClick={onPress}
    className="flex items-center gap-2 rounded-full active:scale-95 transition-transform"
    style={{ background: dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.92)", padding:"10px 24px 10px 16px", boxShadow:"0 4px 18px rgba(0,0,0,0.18)" }}>
    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background:"#E07808" }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <span className="font-bold text-sm" style={{ color: dark ? "#fff" : "#E07808" }}>Siguiente</span>
  </button>
);

/* ── Barriers Onboarding (3-step: image-5 → image-6 → activate) ── */
const BarriersOnboardingScreen = ({
  onActivate, onBack
}: { onActivate: () => void; onBack: () => void }) => {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const texts = [
      "Hola Eliana, bienvenida a Popular sin Barreras. Por tu seguridad, usa audífonos.",
      "Funcionalidades integradas a la App: Asistencia por voz 24/7. Audio guía. Ajustes en la interfaz. Tamaño de texto.",
    ];
    const t = setTimeout(() => speak(texts[step] ?? ""), 350);
    return () => { clearTimeout(t); stopSpeak(); };
  }, [step]);

  const next = () => { sfx.confirm(); stopSpeak(); if (step === 0) setStep(1); else onActivate(); };

  /* ── Step 0: Welcome (image-5) ── */
  if (step === 0) return (
    <div className="flex flex-col h-full" style={{ background:"linear-gradient(180deg,#5AACF8 0%,#2260D8 40%,#0A35A8 100%)" }}>
      {/* Back */}
      <div className="px-5 pt-14 flex">
        <button onClick={()=>{ stopSpeak(); onBack(); }} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background:"rgba(255,255,255,0.2)" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
      </div>
      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <div className="mb-6 w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background:"rgba(255,255,255,0.2)" }}>
          <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="13" r="4.5" fill="white"/>
            <path d="M16 22h16" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M24 22v8l-4 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M24 30l4 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-white font-black leading-snug" style={{ fontSize:28, fontFamily:"'Outfit',sans-serif" }}>
          Hola Eliana,<br/>Bienvenida/o<br/>a Popular sin<br/>Barreras
        </div>
      </div>
      {/* Bottom */}
      <div className="flex flex-col items-center gap-5 pb-16">
        <p className="text-white/75 text-[14px] text-center">Por tu seguridad, usa audífonos.</p>
        <NextPill onPress={next}/>
      </div>
    </div>
  );

  /* ── Step 1: Features (image-6) ── */
  const features = ["Asistencia por voz 24/7","Audio guía","Ajustes en la interfaz","Tamaño de texto"];
  return (
    <div className="flex flex-col h-full px-6 pt-14 pb-10" style={{ background:"#0A1D5A" }}>
      {/* Back */}
      <button onClick={()=>setStep(0)} className="self-start w-10 h-10 rounded-full flex items-center justify-center mb-8" style={{ background:"rgba(255,255,255,0.12)" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <div className="text-white font-semibold text-[18px] text-center mb-8 leading-snug">
        Funcionalidades integradas<br/>a la App
      </div>
      <div className="flex flex-col gap-4">
        {features.map(f => (
          <div key={f} className="bg-white rounded-2xl py-4 px-6 text-center text-[#0A1D5A] font-semibold text-[15px]"
            style={{ border:"2px solid #E07808" }}>
            {f}
          </div>
        ))}
      </div>
      <div className="flex-1"/>
      <div className="flex justify-center">
        <NextPill onPress={next} dark/>
      </div>
    </div>
  );
};

const READER_ITEMS = [
  "Pantalla: Popular Sin Barreras. El banco que se adapta a ti.",
  "Boton: Toca para hablar con el asistente de inteligencia artificial.",
  "Boton: Lengua de Senas. Avatar 3D interpretando en Lengua de Senas Dominicana.",
  "Boton: Lector de Pantalla. Lee en voz alta todos los elementos de la pantalla.",
  "Boton: Audio Guia. Instrucciones habladas paso a paso.",
  "Accion 1: Ver mi Saldo. Consulta cuanto dinero tienes disponible.",
  "Accion 2: Enviar Dinero. Transferir a otra persona.",
  "Accion 3: Pagar Servicios. Luz, agua, internet y mas.",
  "Boton: Hablar con un Agente del Banco Popular.",
  "Boton: Salir. Volver a la pantalla de acceso.",
];

const BarriersScreen = ({ onVoice, onScreen, onBack, onExit }: { onVoice:()=>void; onScreen:(s:Screen)=>void; onBack:()=>void; onExit:()=>void }) => {
  const [hc, setHc] = useState(false);
  const [fSize, setFSize] = useState<FontSize>("large");
  const [signTopic, setSignTopic] = useState<string|null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [listenActive, setListenActive] = useState(false);

  const f = fsCls(fSize);
  const bg   = hc ? "#000"      : "#F0F4FA";
  const card = hc ? "#111"      : "#FFF";
  const tMain= hc ? "#FFD100"   : "#0D1E38";
  const tSub = hc ? "#FFD10099" : "#5C6E8A";
  const hdr  = hc ? "#000"      : "linear-gradient(145deg,#003876 0%,#00509E 100%)";

  useEffect(() => {
    const t=setTimeout(()=>speak("Hola, soy tu asistente Popular Sin Barreras. Puedes hablar conmigo, usar los botones, o ver la traduccion en lengua de senas dominicana."),300);
    return ()=>{ clearTimeout(t); stopSpeak(); };
  },[]);

  const handleVoice = () => {
    sfx.listen(); setListenActive(true);
    speak("Activando asistente de voz.",()=>{ setListenActive(false); onVoice(); });
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto scroll-hide" style={{ background:bg }}>
      {signTopic && <SignModal topic={signTopic} onClose={()=>setSignTopic(null)}/>}
      {readerOpen && <ScreenReader items={READER_ITEMS} onClose={()=>setReaderOpen(false)}/>}
      <div className="px-5 pt-12 pb-6 relative overflow-hidden" style={{ background:hdr, borderBottom: hc?"2px solid #FFD100":"none" }}>
        {!hc && <div className="absolute top-0 right-0 w-44 h-44 rounded-full opacity-[0.07] translate-x-14 -translate-y-14 bg-[#00AEEF]"/>}
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-5">
            <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl" style={{ background:"rgba(255,255,255,0.15)" }}>‹</button>
            <div className="flex items-center gap-2"><Logo size={30}/><div className="text-white font-black text-sm">Sin Barreras</div></div>
            <div className="flex gap-2">
              <button onClick={()=>{ sfx.tap(); setHc(v=>!v); speak(hc?"Alto contraste desactivado":"Alto contraste activado"); }}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-base font-bold transition-all"
                style={{ background:hc?"#FFD100":"rgba(255,255,255,0.15)", color:hc?"#003876":"white" }}
                aria-pressed={hc}>🔆</button>
              <button onClick={()=>{ sfx.tap(); setFSize(s=>s==="normal"?"large":s==="large"?"xlarge":"normal"); }}
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xs font-black" style={{ background:"rgba(255,255,255,0.15)" }}>
                A{fSize==="normal"?"·":fSize==="large"?"+":"++"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <AvatarChip active={listenActive}/>
            <div>
              <div className={`text-white font-black ${f.h} leading-tight`} style={{ fontFamily:"'Outfit',sans-serif" }}>Popular Sin Barreras</div>
              <div className="text-[#FFD100] text-sm font-semibold mt-0.5">El banco que se adapta a ti</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 mt-5">
        <button onClick={handleVoice}
          className={`w-full py-6 rounded-3xl flex flex-col items-center gap-3 active:scale-97 transition-all ${listenActive?"scale-[1.015]":""}`}
          style={{ background:listenActive?"linear-gradient(135deg,#00A651,#005E30)":"linear-gradient(135deg,#003876,#00509E)", boxShadow:listenActive?"0 0 40px rgba(0,166,81,0.5)":"0 12px 40px rgba(0,56,118,0.45)" }}>
          <div className={`rounded-full flex items-center justify-center relative ${listenActive?"":"pulse-ring"}`} style={{ background:"rgba(255,255,255,0.18)", width:72, height:72 }}>
            {listenActive ? <VoiceWave/> : <span className="text-4xl">🎙️</span>}
            {listenActive && <div className="absolute inset-0 rounded-full animate-ping" style={{ background:"rgba(0,166,81,0.25)" }}/>}
          </div>
          <div className={`text-white font-black ${f.btn}`} style={{ fontFamily:"'Outfit',sans-serif" }}>{listenActive?"ESCUCHANDO...":"TOCA PARA HABLAR"}</div>
          <div className="text-white/60 text-sm">{listenActive?"Procesando tu voz...":"Dime lo que necesitas"}</div>
        </button>
      </div>

      <div className="px-5 mt-4 grid grid-cols-3 gap-3">
        {[
          { icon:"🤟", label:"Lengua de Senas",    bg:"#7B2FBE22", border:"#7B2FBE", action:()=>{ sfx.modal(); setSignTopic("welcome"); speak("Abriendo interprete de lengua de senas dominicana."); } },
          { icon:"👁️", label:"Lector de Pantalla", bg:"#00AEEF22", border:"#00AEEF", action:()=>{ sfx.modal(); setReaderOpen(true); } },
          { icon:"📢", label:"Audio Guia",          bg:"#00A65122", border:"#00A651", action:()=>{ sfx.tap(); speak("Audio guia activada. Boton uno: hablar con el asistente. Boton dos: ver saldo. Boton tres: transferir dinero. Boton cuatro: pagar servicios."); } },
        ].map(opt=>(
          <button key={opt.label} onClick={opt.action} className="rounded-2xl py-3.5 px-2 flex flex-col items-center gap-2 active:scale-95 transition-transform shadow-sm"
            style={{ background:card, border:hc?`2px solid #FFD100`:`1.5px solid ${opt.border}40` }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl" style={{ background:hc?"#333":opt.bg }}>{opt.icon}</div>
            <span className="text-center leading-tight font-bold" style={{ color:tMain, fontSize:11 }}>{opt.label}</span>
          </button>
        ))}
      </div>

      <div className="px-5 mt-5">
        <div className={`${f.body} font-black mb-3`} style={{ color:tMain }}>Que necesitas hoy?</div>
        <div className="flex flex-col gap-3">
          {[
            {icon:"💰",label:"Ver mi Saldo",    sub:"Consulta cuanto dinero tienes", color:"#003876", screen:"balance"  as Screen, sign:"balance"},
            {icon:"📤",label:"Enviar Dinero",   sub:"Transferir a otra persona",     color:"#00A651", screen:"transfer" as Screen, sign:"transfer"},
            {icon:"📄",label:"Pagar Servicios", sub:"Luz, agua, internet y mas",     color:"#FF6B2B", screen:"pay"      as Screen, sign:"pay"},
          ].map(btn=>(
            <div key={btn.label} className="relative">
              <button onClick={()=>{ sfx.nav(); speak(btn.sub); onScreen(btn.screen); }}
                className="w-full rounded-2xl px-4 py-4 flex items-center gap-4 active:scale-98 transition-all shadow-sm"
                style={{ background:card, border:hc?"2px solid #FFD100":"none" }}>
                <div className="w-[58px] h-[58px] rounded-2xl flex items-center justify-center text-3xl flex-shrink-0" style={{ background:btn.color+"18" }}>{btn.icon}</div>
                <div className="flex-1 text-left">
                  <div className={`font-black ${f.btn}`} style={{ color:tMain }}>{btn.label}</div>
                  <div className={`mt-0.5 ${f.sm}`} style={{ color:tSub }}>{btn.sub}</div>
                </div>
                <div className="text-2xl" style={{ color:btn.color }}>›</div>
              </button>
              <button onClick={e=>{ e.stopPropagation(); sfx.modal(); setSignTopic(btn.sign); }}
                className="absolute right-14 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-lg active:scale-90 transition-transform"
                style={{ background:"#7B2FBE18", border:"1px solid #7B2FBE40" }} aria-label="Ver en senas">🤟</button>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 mt-4 flex flex-col gap-3 mb-8">
        <button onClick={()=>{ sfx.tap(); speak("Conectando con un agente del Banco Popular. Por favor espera."); }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-98 transition-transform"
          style={{ background:card, border:hc?"2px solid #FFD100":"2px solid #003876" }}>
          <span className="text-2xl">👨‍💼</span>
          <span className={`font-black ${f.body}`} style={{ color:tMain }}>Hablar con un Agente</span>
        </button>

        <button onClick={()=>{ sfx.exit(); onExit(); }}
          className="w-full py-4 rounded-2xl flex items-center justify-center gap-3 active:scale-98 transition-transform border-2 border-red-500/60"
          style={{ background:hc?"#1A0000":card }}>
          <span className="text-2xl">🚪</span>
          <span className={`font-black ${f.body} text-red-500`}>Salir de la App</span>
        </button>
      </div>
    </div>
  );
};

const VoiceScreen = ({ onBack }: { onBack:()=>void }) => {
  const [msgs, setMsgs] = useState<Msg[]>([
    {id:0,role:"assistant",text:"Hola! Soy tu asistente Popular Sin Barreras. Puedo ayudarte a consultar tu saldo, hacer transferencias o pagar servicios. En que te puedo ayudar hoy?"}
  ]);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(1);

  useEffect(() => { setSpeaking(true); sfx.confirm(); speak(msgs[0].text,()=>setSpeaking(false)); },[]);
  useEffect(() => { endRef.current?.scrollIntoView({behavior:"smooth"}); },[msgs,typing]);

  const addMsg = (role:"user"|"assistant", text:string) =>
    setMsgs(p=>[...p,{id:idRef.current++,role,text}]);

  const process = useCallback((text:string) => {
    if (!text.trim()) return;
    sfx.tap(); addMsg("user",text); setTyping(true);
    setTimeout(()=>{
      setTyping(false);
      const l=text.toLowerCase();
      const reply =
        l.includes("saldo")||l.includes("balance")||l.includes("cuanto") ? "Tu saldo disponible es de RD$ 45,230 pesos en tu Cuenta de Ahorros terminada en 4821. Necesitas algo mas?" :
        l.includes("transfer")||l.includes("enviar")||l.includes("mandar") ? "Perfecto, te ayudare a transferir. A quien deseas enviar dinero y cuanto?" :
        l.includes("pagar")||l.includes("servicio")||l.includes("factura")||l.includes("luz")||l.includes("agua") ? "Puedo ayudarte a pagar electricidad, agua, internet o telefono. Cual servicio deseas pagar?" :
        l.includes("tarjeta")||l.includes("credito") ? "Tu tarjeta Visa terminada en 7734 tiene disponible RD$ 28,500. Proximo pago el 15 de septiembre." :
        l.includes("hola")||l.includes("buenas") ? "Hola! Puedo ayudarte con saldo, transferencias y pagos. En que te ayudo?" :
        l.includes("gracias") ? "Con gusto! Estoy aqui siempre que lo necesites." :
        "Entendi lo que me dices. Puedo ayudarte con tu saldo, transferencias o pagos. Con cual empezamos?";
      addMsg("assistant",reply); setSpeaking(true); sfx.confirm(); speak(reply,()=>setSpeaking(false));
    },1100);
  },[]);

  const startListen = () => {
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){ process("Consultar saldo"); return; }
    sfx.listen();
    const rec=new SR(); rec.lang="es-ES"; rec.continuous=false; rec.interimResults=true;
    rec.onstart=()=>setListening(true);
    rec.onresult=(e:any)=>{ const t=Array.from(e.results as any[]).map((r:any)=>r[0].transcript).join(""); setTranscript(t); if(e.results[e.results.length-1].isFinal){setTranscript(""); process(t);} };
    rec.onend=()=>{ setListening(false); setTranscript(""); };
    rec.onerror=()=>{ setListening(false); setTranscript(""); };
    recRef.current=rec; rec.start();
  };
  const stopListen=()=>{ recRef.current?.stop(); setListening(false); setTranscript(""); };

  return (
    <div className="flex flex-col h-full" style={{ background:"linear-gradient(165deg,#003876 0%,#001840 100%)" }}>
      <div className="px-5 pt-12 pb-4 flex items-center gap-3">
        <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-10 h-10 rounded-full flex items-center justify-center text-white text-xl" style={{ background:"rgba(255,255,255,0.15)" }}>‹</button>
        <div className="flex items-center gap-3 flex-1">
          <AvatarChip active={speaking}/>
          <div>
            <div className="text-white font-black text-base">Asistente Popular</div>
            <div className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${speaking||listening?"bg-[#00A651] animate-pulse":"bg-white/25"}`}/>
              <span className="text-white/50 text-xs">{listening?"Escuchando...":speaking?"Respondiendo...":"En linea · IA activa"}</span>
            </div>
          </div>
        </div>
        <Logo size={34}/>
      </div>

      <div className="flex-1 overflow-y-auto scroll-hide px-4 py-2 space-y-3">
        {msgs.map(m=>(
          <div key={m.id} className={`flex ${m.role==="user"?"justify-end":"justify-start"} fade-up`}>
            {m.role==="assistant" && (
              <div className="w-8 h-8 rounded-full mr-2 mt-1 flex-shrink-0 flex items-center justify-center" style={{ background:"linear-gradient(135deg,#00AEEF,#003876)" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="11" rx="3" fill="white"/><path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 17v3" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
              </div>
            )}
            <div className={`max-w-[76%] px-4 py-3 rounded-2xl text-base leading-relaxed ${m.role==="user"?"bg-white text-[#0D1E38] font-semibold rounded-br-sm":"text-white rounded-bl-sm"}`}
              style={m.role==="assistant"?{background:"rgba(255,255,255,0.13)",border:"1px solid rgba(255,255,255,0.18)"}:{}}>
              {m.text}
            </div>
          </div>
        ))}
        {typing && (
          <div className="flex justify-start fade-up">
            <div className="w-8 h-8 rounded-full mr-2 flex-shrink-0 flex items-center justify-center" style={{ background:"linear-gradient(135deg,#00AEEF,#003876)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="9" y="2" width="6" height="11" rx="3" fill="white"/><path d="M5 10a7 7 0 0014 0" stroke="white" strokeWidth="2.2" strokeLinecap="round"/><path d="M12 17v3" stroke="white" strokeWidth="2.2" strokeLinecap="round"/></svg>
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5" style={{ background:"rgba(255,255,255,0.13)", border:"1px solid rgba(255,255,255,0.18)" }}>
              {[0,1,2].map(i=><div key={i} className="typing-dot w-2.5 h-2.5 rounded-full bg-white/60" style={{ animationDelay:`${i*.18}s` }}/>)}
            </div>
          </div>
        )}
        {transcript && (
          <div className="flex justify-end fade-up">
            <div className="max-w-[76%] px-4 py-3 rounded-2xl rounded-br-sm text-white/65 italic" style={{ background:"rgba(255,255,255,0.18)", border:"1px solid rgba(255,255,255,0.28)" }}>{transcript}</div>
          </div>
        )}
        <div ref={endRef}/>
      </div>

      <div className="px-4 mb-3">
        <div className="flex gap-2 overflow-x-auto scroll-hide pb-1">
          {["Ver mi saldo","Transferir dinero","Pagar servicios","Hablar con agente"].map(s=>(
            <button key={s} onClick={()=>process(s)} className="flex-shrink-0 px-3 py-2 rounded-full text-white text-sm font-semibold border transition-colors" style={{ background:"rgba(255,255,255,0.12)", borderColor:"rgba(255,255,255,0.2)" }}>{s}</button>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 pb-8 border-t" style={{ background:"rgba(255,255,255,0.06)", borderColor:"rgba(255,255,255,0.1)" }}>
        <div className="flex items-end gap-3">
          <div className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-2" style={{ background:"rgba(255,255,255,0.12)", border:"1px solid rgba(255,255,255,0.2)" }}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(process(input),setInput(""))}
              placeholder="Escribe o habla..." className="flex-1 bg-transparent text-white placeholder-white/35 text-base outline-none"/>
            {input && <button onClick={()=>{ process(input); setInput(""); }} className="font-black text-sm text-[#FFD100]">Enviar</button>}
          </div>
          <button onPointerDown={startListen} onPointerUp={stopListen}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-88 shadow-lg ${listening?"bg-red-500 scale-105":""}`}
            style={!listening?{background:"linear-gradient(135deg,#003876,#00AEEF)", boxShadow:"0 6px 20px rgba(0,174,239,0.35)"}:{}}>
            {listening?<VoiceWave/>:<span className="text-2xl">🎙️</span>}
          </button>
        </div>
        <p className="text-white/30 text-xs text-center mt-2">Manten el microfono para hablar · Suelta para enviar</p>
      </div>
    </div>
  );
};

const BalanceScreen = ({ onBack }: { onBack:()=>void }) => {
  const [vis, setVis] = useState(true);
  const [signOpen, setSignOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const items=["Tu Saldo Bancario.","Cuenta de Ahorros 4821: RD$ 45,230 pesos.","Cuenta Corriente 2203: RD$ 12,800 pesos.","Tarjeta Visa 7734: Disponible RD$ 28,500."];
  useEffect(()=>{ sfx.confirm(); speak("Tu saldo disponible es de 45 mil 230 pesos en tu Cuenta de Ahorros terminada en 4821."); },[]);
  return (
    <div className="flex flex-col h-full bg-[#F0F4FA]">
      {signOpen && <SignModal topic="balance" onClose={()=>setSignOpen(false)}/>}
      {readerOpen && <ScreenReader items={items} onClose={()=>setReaderOpen(false)}/>}
      <div className="px-5 pt-12 pb-8" style={{ background:"linear-gradient(145deg,#003876 0%,#00509E 100%)" }}>
        <div className="flex items-center justify-between mb-5">
          <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl" style={{ background:"rgba(255,255,255,0.15)" }}>‹</button>
          <div className="flex gap-2">
            <button onClick={()=>{ sfx.modal(); setSignOpen(true); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background:"rgba(255,255,255,0.15)" }}>🤟</button>
            <button onClick={()=>{ sfx.modal(); setReaderOpen(true); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background:"rgba(255,255,255,0.15)" }}>👁️</button>
          </div>
        </div>
        <div className="text-[#FFD100] text-xs font-black tracking-widest uppercase mb-1">Tu Saldo</div>
        <div className="text-white font-black mb-2" style={{ fontSize:32 }}>{vis?"RD$ 45,230.00":"RD$ ●●,●●●.●●"}</div>
        <button onClick={()=>{ sfx.tap(); setVis(v=>!v); }} className="text-white/50 text-sm flex items-center gap-1 mb-3">{vis?"🙈 Ocultar":"👁️ Mostrar"}</button>
        <button onClick={()=>{ sfx.tap(); speak("Tu saldo disponible es de 45 mil 230 pesos en tu cuenta de ahorros terminada en 4821."); }}
          className="flex items-center gap-2.5 rounded-full px-5 py-2.5 active:scale-97 transition-transform" style={{ background:"rgba(255,255,255,0.18)" }}>
          <span className="text-xl">🔊</span><span className="text-white font-bold text-sm">Escuchar mi saldo</span>
        </button>
      </div>
      <div className="px-5 mt-5 flex flex-col gap-3 pb-8">
        {[
          {label:"Cuenta de Ahorros",num:"4821",amount:"RD$ 45,230.00",speech:"Cuenta de Ahorros: 45 mil 230 pesos.",icon:"💳",color:"#003876"},
          {label:"Cuenta Corriente", num:"2203",amount:"RD$ 12,800.00",speech:"Cuenta Corriente: 12 mil 800 pesos.",icon:"🏦",color:"#00509E"},
          {label:"Tarjeta Visa Popular",num:"7734",amount:"Disponible: RD$ 28,500",speech:"Tarjeta Visa: 28 mil 500 pesos disponibles.",icon:"💳",color:"#7B2FBE"},
        ].map(acc=>(
          <div key={acc.num} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background:acc.color+"18" }}>{acc.icon}</div>
            <div className="flex-1"><div className="text-[#0D1E38] font-bold text-base">{acc.label}</div><div className="text-[#5C6E8A] text-sm">{acc.num}</div></div>
            <div className="text-right">
              <div className="text-[#0D1E38] font-black text-sm">{vis?acc.amount:"●●●●"}</div>
              <button onClick={()=>{ sfx.tap(); speak(acc.speech); }} className="text-[#003876] text-xs font-bold mt-1 flex items-center gap-0.5 ml-auto">🔊 Escuchar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TransferScreen = ({ onBack }: { onBack:()=>void }) => {
  const [step, setStep] = useState<1|2|3>(1);
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [signOpen, setSignOpen] = useState(false);
  useEffect(()=>{ sfx.nav(); speak("Selecciona o escribe el nombre del destinatario para tu transferencia."); },[]);
  const confirm=()=>{ setStep(3); sfx.success(); speak(`Transferencia exitosa. Enviaste ${amount} pesos a ${recipient}.`); };
  return (
    <div className="flex flex-col h-full bg-[#F0F4FA]">
      {signOpen && <SignModal topic="transfer" onClose={()=>setSignOpen(false)}/>}
      <div className="px-5 pt-12 pb-6" style={{ background:"linear-gradient(145deg,#00A651 0%,#007A3D 100%)" }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl" style={{ background:"rgba(255,255,255,0.2)" }}>‹</button>
          <button onClick={()=>{ sfx.modal(); setSignOpen(true); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background:"rgba(255,255,255,0.2)" }}>🤟</button>
        </div>
        <div className="text-white/70 text-xs font-black tracking-widest uppercase">Transferir Dinero</div>
        <div className="text-white font-black text-2xl mt-1" style={{ fontFamily:"'Outfit',sans-serif" }}>Envia dinero facil</div>
        <div className="flex items-center gap-2 mt-4">
          {[1,2,3].map(s=>(
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-black transition-all ${step>=s?"bg-white text-[#00A651]":"bg-white/25 text-white"}`}>{step>s?"v":s}</div>
              {s<3 && <div className={`h-0.5 w-8 transition-all ${step>s?"bg-white":"bg-white/25"}`}/>}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1 px-5 py-5 overflow-y-auto scroll-hide">
        {step===3?(
          <div className="flex flex-col items-center justify-center h-full gap-4 fade-up">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-6xl" style={{ background:"#00A65118" }}>✅</div>
            <div className="text-[#0D1E38] font-black text-2xl text-center" style={{ fontFamily:"'Outfit',sans-serif" }}>Transferencia Exitosa!</div>
            <div className="text-[#5C6E8A] text-center">Enviaste RD$ {amount} a <strong>{recipient}</strong></div>
            <div className="flex gap-4 mt-2">
              <button onClick={()=>{ sfx.tap(); speak(`Transferiste ${amount} pesos a ${recipient} exitosamente.`); }} className="flex items-center gap-2 text-[#003876] font-bold">🔊 Escuchar</button>
              <button onClick={()=>{ sfx.modal(); setSignOpen(true); }} className="flex items-center gap-2 font-bold text-[#7B2FBE]">🤟 Ver senas</button>
            </div>
            <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-full py-5 rounded-2xl text-white font-black text-xl mt-4" style={{ background:"linear-gradient(135deg,#003876,#00509E)" }}>Volver</button>
          </div>
        ):step===1?(
          <div className="flex flex-col gap-4">
            <div className="text-[#0D1E38] font-black text-xl">A quien envias?</div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-transparent focus-within:border-[#003876]">
              <input value={recipient} onChange={e=>setRecipient(e.target.value)} placeholder="Nombre o numero de cuenta" className="w-full text-lg font-semibold text-[#0D1E38] outline-none"/>
            </div>
            {[{name:"Carmen Lopez",num:"4521",icon:"👩‍🦳"},{name:"Roberto Mendez",num:"8832",icon:"👨"},{name:"Farmacia Carol",num:"2211",icon:"💊"}].map(c=>(
              <button key={c.name} onClick={()=>{ sfx.tap(); setRecipient(c.name); }} className={`bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm transition-all ${recipient===c.name?"ring-2 ring-[#00A651]":""}`}>
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background:"#00A65118" }}>{c.icon}</div>
                <div><div className="text-[#0D1E38] font-bold">{c.name}</div><div className="text-[#5C6E8A] text-sm">{c.num}</div></div>
              </button>
            ))}
            <button disabled={!recipient} onClick={()=>{ sfx.nav(); setStep(2); speak("Ahora dime cuanto deseas transferir."); }}
              className="w-full py-5 rounded-2xl text-white font-black text-xl transition-all" style={{ background:recipient?"linear-gradient(135deg,#00A651,#007A3D)":"#CCC" }}>Continuar</button>
          </div>
        ):(
          <div className="flex flex-col gap-4">
            <div className="text-[#0D1E38] font-black text-xl">Cuanto envias?</div>
            <div className="bg-white rounded-2xl p-5 shadow-sm text-center">
              <div className="text-[#5C6E8A] text-sm mb-1">Monto en RD$</div>
              <div className="text-[#0D1E38] font-black" style={{ fontSize:36 }}>RD$ {amount||"0"}</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {["1","2","3","4","5","6","7","8","9","000","0","del"].map(d=>(
                <button key={d} onClick={()=>{ sfx.tap(); d==="del"?setAmount(a=>a.slice(0,-1)):setAmount(a=>a+d); }} className="h-14 bg-white rounded-2xl text-xl font-bold text-[#0D1E38] shadow-sm active:bg-[#003876] active:text-white transition-colors">{d==="del"?"⌫":d}</button>
              ))}
            </div>
            <button disabled={!amount} onClick={confirm} className="w-full py-5 rounded-2xl text-white font-black text-xl transition-all" style={{ background:amount?"linear-gradient(135deg,#00A651,#007A3D)":"#CCC" }}>Confirmar Transferencia</button>
          </div>
        )}
      </div>
    </div>
  );
};

const PayScreen = ({ onBack }: { onBack:()=>void }) => {
  const [sel, setSel] = useState<string|null>(null);
  const [paid, setPaid] = useState(false);
  const [signOpen, setSignOpen] = useState(false);
  useEffect(()=>{ sfx.nav(); speak("Selecciona el servicio que deseas pagar hoy."); },[]);
  const svcs=[
    {name:"EDESUR Electricidad",icon:"⚡",amount:"RD$ 3,200",due:"Vence 30 ago",color:"#FF6B2B",speech:"Electricidad EDESUR: 3 mil 200 pesos."},
    {name:"CAASD Agua",icon:"💧",amount:"RD$ 850",due:"Vence 5 sep",color:"#00AEEF",speech:"Agua CAASD: 850 pesos."},
    {name:"Claro Internet",icon:"📡",amount:"RD$ 1,500",due:"Vence 15 sep",color:"#7B2FBE",speech:"Internet Claro: 1 mil 500 pesos."},
    {name:"Wind Telefono",icon:"📱",amount:"RD$ 990",due:"Vence 20 sep",color:"#00A651",speech:"Telefono Wind: 990 pesos."},
  ];
  const confirm=()=>{ setPaid(true); sfx.success(); const s=svcs.find(x=>x.name===sel); speak(`Pago exitoso. Pagaste ${s?.amount} de ${sel}.`); };
  return (
    <div className="flex flex-col h-full bg-[#F0F4FA]">
      {signOpen && <SignModal topic="pay" onClose={()=>setSignOpen(false)}/>}
      <div className="px-5 pt-12 pb-6" style={{ background:"linear-gradient(145deg,#FF6B2B 0%,#CC4400 100%)" }}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-white text-xl" style={{ background:"rgba(255,255,255,0.2)" }}>‹</button>
          <button onClick={()=>{ sfx.modal(); setSignOpen(true); }} className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background:"rgba(255,255,255,0.2)" }}>🤟</button>
        </div>
        <div className="text-white/70 text-xs font-black tracking-widest uppercase">Pagar Servicios</div>
        <div className="text-white font-black text-2xl mt-1" style={{ fontFamily:"'Outfit',sans-serif" }}>Que deseas pagar?</div>
      </div>
      <div className="flex-1 px-5 py-5 overflow-y-auto scroll-hide">
        {paid?(
          <div className="flex flex-col items-center justify-center h-full gap-4 fade-up">
            <div className="w-24 h-24 rounded-full flex items-center justify-center text-6xl" style={{ background:"#00A65118" }}>✅</div>
            <div className="text-[#0D1E38] font-black text-2xl" style={{ fontFamily:"'Outfit',sans-serif" }}>Pago Exitoso!</div>
            <div className="text-[#5C6E8A] text-center"><strong>{sel}</strong> pagado correctamente</div>
            <div className="flex gap-4">
              <button onClick={()=>{ sfx.tap(); speak(`Pago de ${sel} confirmado.`); }} className="flex items-center gap-2 text-[#003876] font-bold">🔊 Escuchar</button>
              <button onClick={()=>{ sfx.modal(); setSignOpen(true); }} className="flex items-center gap-2 font-bold text-[#7B2FBE]">🤟 Ver senas</button>
            </div>
            <button onClick={()=>{ sfx.nav(); onBack(); }} className="w-full py-5 rounded-2xl text-white font-black text-xl mt-2" style={{ background:"linear-gradient(135deg,#003876,#00509E)" }}>Volver</button>
          </div>
        ):(
          <>
            <div className="flex flex-col gap-3">
              {svcs.map(s=>(
                <button key={s.name} onClick={()=>{ sfx.tap(); setSel(s.name); speak(s.speech); }} className={`bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm transition-all ${sel===s.name?"ring-2 scale-[1.01]":""}`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background:s.color+"18" }}>{s.icon}</div>
                  <div className="flex-1"><div className="text-[#0D1E38] font-bold">{s.name}</div><div className="text-[#5C6E8A] text-sm">{s.due}</div></div>
                  <div className="text-right">
                    <div className="text-[#0D1E38] font-black">{s.amount}</div>
                    {sel===s.name&&<div className="text-xs font-black" style={{ color:s.color }}>Seleccionado</div>}
                  </div>
                </button>
              ))}
            </div>
            <button disabled={!sel} onClick={confirm} className="w-full py-5 rounded-2xl text-white font-black text-xl mt-5 transition-all" style={{ background:sel?"linear-gradient(135deg,#FF6B2B,#CC4400)":"#CCC" }}>
              {sel?"Confirmar Pago":"Selecciona un servicio"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [prev, setPrev] = useState<Screen>("home");
  const [sinBarrerasActive, setSinBarrerasActive] = useState(false);
  const [globalFontSize, setGlobalFontSize] = useState<"small"|"normal"|"large"|"xlarge">("normal");
  const [darkMode, setDarkMode] = useState(false);

  const zoomMap = { small: 0.88, normal: 1, large: 1.12, xlarge: 1.25 } as const;
  const cycleFont = () => setGlobalFontSize(s => s==="small"?"normal":s==="normal"?"large":s==="large"?"xlarge":"small");
  const toggleDark = () => setDarkMode(d => !d);

  const go=(s:Screen)=>{ setPrev(screen); setScreen(s); };
  const exitToLogin=()=>{ stopSpeak(); setScreen("splash"); setSinBarrerasActive(false); };
  const activateSinBarreras=()=>{ setSinBarrerasActive(true); setScreen("home"); };
  const deactivateSinBarreras=()=>{ setSinBarrerasActive(false); };

  const render=()=>{
    switch(screen){
      case "splash":        return <SplashScreen onNext={()=>setScreen("hello")}/>;
      case "hello":         return <HelloScreen  onNext={()=>setScreen("login")}/>;
      case "login":         return <LoginScreen  onLogin={()=>setScreen("home")}/>;
      case "home":          return <HomeScreen onBarriers={()=>go("barriers-intro")} onScreen={go} onExit={exitToLogin} sinBarrerasActive={sinBarrerasActive} onDeactivate={deactivateSinBarreras} globalFontSize={globalFontSize} onCycleFont={cycleFont} darkMode={darkMode} onToggleDark={toggleDark}/>;
      case "barriers-intro":return <BarriersOnboardingScreen onActivate={activateSinBarreras} onBack={()=>setScreen("home")}/>;
      case "barriers":      return <BarriersScreen onVoice={()=>go("voice")} onScreen={go} onBack={()=>setScreen("home")} onExit={exitToLogin}/>;
      case "voice":         return <VoiceScreen onBack={()=>setScreen("home")}/>;
      case "balance":       return <BalanceScreen onBack={()=>setScreen("home")}/>;
      case "transfer":      return <TransferScreen onBack={()=>setScreen("home")}/>;
      case "pay":           return <PayScreen onBack={()=>setScreen("home")}/>;
    }
  };

  return (
    <div className="app-shell">
      <div className={`phone-frame screen-pop ${darkMode?"dark-phone":""}`} style={{ background: darkMode?"#000":"#fff" }}>
        <div style={{ height:"100%", filter: darkMode?"invert(1) hue-rotate(180deg)":undefined, zoom: zoomMap[globalFontSize] }} key={screen}>
          {render()}
        </div>
      </div>
    </div>
  );
}
