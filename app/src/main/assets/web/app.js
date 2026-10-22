
/* ---------------- settings ---------------- */
const PRESETS = [
  { id: "none",  name: "원본",   sw: "#d9d2d6", p: {} },
  { id: "milk",  name: "뽀얀",   sw: "#fbe7ee", p: { bright: .35, contrast: -.05, sat: -.1, tint: .15, fade: .15 } },
  { id: "peach", name: "복숭아", sw: "#ffb59e", p: { bright: .2, warm: .35, tint: .45, sat: .05, fade: .1 } },
  { id: "film",  name: "필름",   sw: "#c9a46b", p: { contrast: .12, sat: -.18, warm: .25, fade: .35, grain: .5, vign: .45 } },
  { id: "soft",  name: "몽글",   sw: "#e8d3f0", p: { bright: .25, contrast: -.18, sat: -.12, tint: .12, fade: .4, glow: .5 } },
  { id: "cool",  name: "청량",   sw: "#9fd3f0", p: { bright: .15, warm: -.4, sat: .1, contrast: .06 } },
  { id: "mono",  name: "흑백",   sw: "#7a7a7a", p: { mono: 1, contrast: .18, grain: .3, vign: .25 } },
];
const TABS = [
  { id: "smooth", name: "피부" },
  { id: "bright", name: "화사" },
  { id: "eye",    name: "눈" },
  { id: "slim",   name: "갸름" },
  { id: "chin",   name: "V라인" },
  { id: "nose",   name: "코" },
  { id: "makeup", name: "메이크업" },
  { id: "amount", name: "필터" },
];
const LEVELS = {
  natural: { name: "자연", v: { smooth: 35, bright: 25, eye: 15, slim: 15, chin: 10, nose: 10, makeup: 20 } },
  bbosha:  { name: "뽀샤", v: { smooth: 65, bright: 45, eye: 40, slim: 45, chin: 35, nose: 35, makeup: 50 } },
  max:     { name: "최강", v: { smooth: 95, bright: 70, eye: 80, slim: 85, chin: 70, nose: 70, makeup: 85 } },
};
const DEFAULTS = { ...LEVELS.bbosha.v, amount: 80 };
const state = load();
let tab = "smooth";

function load() {
  try {
    const s = JSON.parse(localStorage.getItem("bbosha") || "{}");
    return { preset: s.preset || "milk", level: s.level || "bbosha", v: { ...DEFAULTS, ...(s.v || {}) } };
  } catch { return { preset: "milk", level: "bbosha", v: { ...DEFAULTS } }; }
}
function save() { try { localStorage.setItem("bbosha", JSON.stringify(state)); } catch {} }

/* ---------------- WebGL ---------------- */
const canvas = document.getElementById("gl");
const gl = canvas.getContext("webgl", { premultipliedAlpha: false, preserveDrawingBuffer: false });

const VS = `
attribute vec2 a_pos;
uniform float u_mirror;
varying vec2 v_uv;
void main(){
  vec2 uv = a_pos * 0.5 + 0.5;
  uv.y = 1.0 - uv.y;
  if (u_mirror > 0.5) uv.x = 1.0 - uv.x;
  v_uv = uv;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FS = `
precision mediump float;
varying vec2 v_uv;
uniform sampler2D u_tex;
uniform vec2 u_res;
uniform float u_smooth, u_bright, u_contrast, u_sat, u_warm, u_tint, u_fade, u_grain, u_vign, u_mono, u_glow, u_time;
uniform float u_face, u_eye, u_slim;
uniform vec2 u_eyeL, u_eyeR, u_cheekL, u_cheekR, u_faceC;
uniform float u_eyeRad, u_slimRad;
uniform float u_chin, u_nose, u_makeup;
uniform vec2 u_chinP, u_noseL, u_noseR, u_noseC, u_lipC, u_lipR, u_blushL, u_blushR, u_underL, u_underR;
uniform float u_chinRad, u_noseRad, u_blushRad, u_underRad;
float ellipseMask(vec2 p, vec2 c, vec2 r){ vec2 d = (p - c) / r; return 1.0 - smoothstep(0.55, 1.0, dot(d, d)); }
float softCircle(vec2 p, vec2 c, float r){ float t = length(p - c) / r; return 1.0 - smoothstep(0.0, 1.0, t); }

vec2 bulge(vec2 p, vec2 c, float r, float s){
  vec2 d = p - c; float l = length(d);
  if (l < r) { float t = l / r; p = c + d * (1.0 - s * (1.0 - t * t)); }
  return p;
}
vec2 pull(vec2 p, vec2 c, vec2 dir, float r, float s){
  float l = length(p - c);
  if (l < r) { float t = 1.0 - (l * l) / (r * r); p -= dir * s * r * t * t; }
  return p;
}
float skin(vec3 c){
  vec3 k = c * 255.0;
  float cr = 128.0 + 0.5 * k.r - 0.4187 * k.g - 0.0813 * k.b;
  float cb = 128.0 - 0.1687 * k.r - 0.3313 * k.g + 0.5 * k.b;
  return clamp(1.0 - abs(cr - 150.0) / 26.0, 0.0, 1.0) * clamp(1.0 - abs(cb - 110.0) / 30.0, 0.0, 1.0);
}
float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898, 78.233)) + u_time) * 43758.5453); }

void main(){
  vec2 p = v_uv * u_res;
  if (u_face > 0.5) {
    p = bulge(p, u_eyeL, u_eyeRad, u_eye);
    p = bulge(p, u_eyeR, u_eyeRad, u_eye);
    p = pull(p, u_cheekL, normalize(u_faceC - u_cheekL), u_slimRad, u_slim);
    p = pull(p, u_cheekR, normalize(u_faceC - u_cheekR), u_slimRad, u_slim);
    p = pull(p, u_chinP, normalize(u_faceC - u_chinP), u_chinRad, u_chin);
    p = pull(p, u_noseL, normalize(u_noseC - u_noseL), u_noseRad, u_nose);
    p = pull(p, u_noseR, normalize(u_noseC - u_noseR), u_noseRad, u_nose);
  }
  vec2 uv = p / u_res;
  vec3 c = texture2D(u_tex, uv).rgb;

  // edge-preserving blur for skin
  float m = skin(c);
  float a = clamp(u_smooth * 1.4 * m + u_glow * 0.3, 0.0, 1.0);
  if (a > 0.01) {
    vec2 px = (u_res.y / 720.0) * (2.0 + u_smooth * 2.5) / u_res;
    vec3 sum = c; float wsum = 1.0;
    for (int i = 0; i < 12; i++) {
      float ang = float(i) * 0.5236;
      float rad = (i < 6) ? 1.5 : 3.2;
      vec2 off = vec2(cos(ang), sin(ang)) * px * rad * (mod(float(i), 2.0) + 1.0);
      vec3 s = texture2D(u_tex, uv + off).rgb;
      vec3 d = s - c;
      float w = exp(-dot(d, d) * 40.0);
      sum += s * w; wsum += w;
    }
    c = mix(c, sum / wsum, a);
  }

  if (u_face > 0.5 && u_makeup > 0.01) {
    // under-eye brighten
    float ue = max(softCircle(p, u_underL, u_underRad), softCircle(p, u_underR, u_underRad));
    c += ue * u_makeup * 0.12 * (vec3(1.0) - c);
    // blush
    float bl = max(softCircle(p, u_blushL, u_blushRad), softCircle(p, u_blushR, u_blushRad));
    c = mix(c, c * vec3(1.0, 0.82, 0.86) + vec3(0.06, 0.0, 0.02), bl * u_makeup * 0.55);
    // lips: skip teeth (bright, low saturation)
    float lm = ellipseMask(p, u_lipC, u_lipR);
    float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
    float lipish = smoothstep(0.08, 0.2, mx - mn) * (1.0 - smoothstep(0.75, 0.95, mn));
    vec3 lip = vec3(0.86, 0.28, 0.38) * (0.55 + 0.6 * dot(c, vec3(0.333)));
    c = mix(c, lip, lm * lipish * u_makeup * 0.6);
  }

  vec3 one = vec3(1.0);
  c += u_bright * 0.24 * (one - c);
  c = (c - 0.5) * (1.0 + u_contrast) + 0.5;
  float L = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(L), c, 1.0 + u_sat);
  c = mix(c, vec3(L), u_mono);
  c.r += u_warm * 0.086; c.b -= u_warm * 0.086;
  c += u_tint * vec3(0.055, -0.02, 0.03);
  c += u_fade * 0.18 * (one - c);
  c += (rand(v_uv) - 0.5) * u_grain * 0.16;
  float dv = distance(v_uv, vec2(0.5)) / 0.7071;
  c *= 1.0 - u_vign * max(0.0, dv - 0.45) * 1.4;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

function shader(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS));
gl.linkProgram(prog);
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, "a_pos");
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

const U = {};
["u_mirror","u_res","u_smooth","u_bright","u_contrast","u_sat","u_warm","u_tint","u_fade","u_grain","u_vign","u_mono",
 "u_glow","u_time","u_face","u_eye","u_slim","u_eyeL","u_eyeR","u_cheekL","u_cheekR","u_faceC","u_eyeRad","u_slimRad",
 "u_chin","u_nose","u_makeup","u_chinP","u_noseL","u_noseR","u_noseC","u_lipC","u_lipR","u_blushL","u_blushR",
 "u_underL","u_underR","u_chinRad","u_noseRad","u_blushRad","u_underRad"]
  .forEach(n => U[n] = gl.getUniformLocation(prog, n));

/* ---------------- camera ---------------- */
const video = document.getElementById("video");
let facing = "user", stream = null, running = false;

async function startCamera() {
  stopCamera();
  showMsg(null);
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
    });
    video.srcObject = stream;
    await video.play();
    running = true;
    requestAnimationFrame(loop);
  } catch (e) {
    showMsg("카메라를 켤 수 없어요.\n설정 > 앱 > 뽀샤캠 > 권한에서 카메라를 허용해 주세요.");
  }
}
function stopCamera() {
  running = false;
  if (stream) stream.getTracks().forEach(t => t.stop());
  stream = null;
}
window.startCamera = startCamera;
window.pauseCamera = stopCamera;
window.resumeCamera = () => { if (!running) startCamera(); };

function showMsg(text) {
  const m = document.getElementById("msg");
  if (!text) { m.hidden = true; return; }
  document.getElementById("msgText").innerText = text;
  m.hidden = false;
}
document.getElementById("retry").onclick = startCamera;

/* ---------------- face landmarks ---------------- */
let landmarker = null, face = null, lastTs = -1;
const statusEl = document.getElementById("status");

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);

async function initFace() {
  statusEl.textContent = "얼굴 기능 불러오는 중";
  let why = "";
  try {
    const { FilesetResolver, FaceLandmarker } = await import("./mp/vision_bundle.js");
    const files = await FilesetResolver.forVisionTasks(new URL("./mp/", location.href).href);
    const make = (path, delegate) => withTimeout(FaceLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: path, delegate },
      runningMode: "VIDEO", numFaces: 1,
    }), 20000);
    const local = new URL("./face_landmarker.task", location.href).href;
    const remote = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
    outer: for (const path of [local, remote]) {
      for (const d of ["CPU", "GPU"]) {
        try { landmarker = await make(path, d); break outer; } catch (e) { why = String(e && e.message || e).slice(0, 60); }
      }
    }
  } catch (e) {
    why = String(e && e.message || e).slice(0, 60);
  }
  statusEl.textContent = landmarker ? "" : "얼굴 기능 오류: " + why;
}

const IDX = { eyeL: 468, eyeR: 473, eL1: 33, eL2: 133, eR1: 362, eR2: 263, jawL: 132, jawR: 361, edgeL: 234, edgeR: 454, nose: 4,
  chin: 152, noseL: 129, noseR: 358, lipL: 61, lipR: 291, lipT: 0, lipB: 17, blushL: 50, blushR: 280, underL: 145, underR: 374 };

function detect(now) {
  if (!landmarker || video.readyState < 2) return;
  const ts = Math.max(lastTs + 1, Math.round(now));
  lastTs = ts;
  let res;
  try { res = landmarker.detectForVideo(video, ts); } catch { return; }
  const lm = res && res.faceLandmarks && res.faceLandmarks[0];
  if (!lm) { face = null; statusEl.textContent = "얼굴을 화면 안에 맞춰주세요"; return; }
  if (statusEl.textContent) statusEl.textContent = "";
  const w = video.videoWidth, h = video.videoHeight;
  const P = i => [lm[i].x * w, lm[i].y * h];
  lastEyeW = (dist(P(IDX.eL1), P(IDX.eL2)) + dist(P(IDX.eR1), P(IDX.eR2))) / 2;
  const next = {
    eyeL: P(IDX.eyeL), eyeR: P(IDX.eyeR),
    jawL: P(IDX.jawL), jawR: P(IDX.jawR), nose: P(IDX.nose),
    chin: P(IDX.chin), noseL: P(IDX.noseL), noseR: P(IDX.noseR),
    lipC: mid(P(IDX.lipT), P(IDX.lipB)),
    lipR: [dist(P(IDX.lipL), P(IDX.lipR)) * 0.55, dist(P(IDX.lipT), P(IDX.lipB)) * 0.6],
    blushL: P(IDX.blushL), blushR: P(IDX.blushR),
    underL: below(P(IDX.underL)), underR: below(P(IDX.underR)),
    eyeW: (dist(P(IDX.eL1), P(IDX.eL2)) + dist(P(IDX.eR1), P(IDX.eR2))) / 2,
    faceW: dist(P(IDX.edgeL), P(IDX.edgeR)),
  };
  face = face ? smoothFace(face, next, 0.5) : next;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
let lastEyeW = 20;
const below = a => [a[0], a[1] + lastEyeW * 0.35];
function smoothFace(a, b, k) {
  const o = {};
  for (const key in b) o[key] = Array.isArray(b[key])
    ? [a[key][0] + (b[key][0] - a[key][0]) * k, a[key][1] + (b[key][1] - a[key][1]) * k]
    : a[key] + (b[key] - a[key]) * k;
  return o;
}

/* ---------------- render loop ---------------- */
let showOriginal = false;

function render(now) {
  const w = video.videoWidth, h = video.videoHeight;
  if (!w || !h) return false;
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video);

  const preset = PRESETS.find(p => p.id === state.preset) || PRESETS[0];
  const k = showOriginal ? 0 : state.v.amount / 100;
  const pv = n => (preset.p[n] || 0) * k;
  const off = showOriginal ? 0 : 1;

  gl.uniform1f(U.u_mirror, facing === "user" ? 1 : 0);
  gl.uniform2f(U.u_res, w, h);
  gl.uniform1f(U.u_smooth, off * state.v.smooth / 100);
  gl.uniform1f(U.u_bright, pv("bright") + off * state.v.bright / 100 * 0.6);
  gl.uniform1f(U.u_contrast, pv("contrast"));
  gl.uniform1f(U.u_sat, pv("sat"));
  gl.uniform1f(U.u_warm, pv("warm"));
  gl.uniform1f(U.u_tint, pv("tint"));
  gl.uniform1f(U.u_fade, pv("fade"));
  gl.uniform1f(U.u_grain, pv("grain"));
  gl.uniform1f(U.u_vign, pv("vign"));
  gl.uniform1f(U.u_mono, pv("mono"));
  gl.uniform1f(U.u_glow, pv("glow"));
  gl.uniform1f(U.u_time, (now % 10000) / 1000);

  const f = face && !showOriginal;
  gl.uniform1f(U.u_face, f ? 1 : 0);
  if (!f) gl.uniform1f(U.u_makeup, 0);
  if (f) {
    gl.uniform1f(U.u_eye, state.v.eye / 100 * 0.3);
    gl.uniform1f(U.u_slim, state.v.slim / 100 * 0.14);
    gl.uniform2f(U.u_eyeL, ...face.eyeL);
    gl.uniform2f(U.u_eyeR, ...face.eyeR);
    gl.uniform2f(U.u_cheekL, ...face.jawL);
    gl.uniform2f(U.u_cheekR, ...face.jawR);
    gl.uniform2f(U.u_faceC, ...face.nose);
    gl.uniform1f(U.u_eyeRad, face.eyeW * 1.1);
    gl.uniform1f(U.u_slimRad, face.faceW * 0.42);
    gl.uniform1f(U.u_chin, state.v.chin / 100 * 0.12);
    gl.uniform1f(U.u_nose, state.v.nose / 100 * 0.18);
    gl.uniform1f(U.u_makeup, state.v.makeup / 100);
    gl.uniform2f(U.u_chinP, ...face.chin);
    gl.uniform2f(U.u_noseL, ...face.noseL);
    gl.uniform2f(U.u_noseR, ...face.noseR);
    gl.uniform2f(U.u_noseC, ...face.nose);
    gl.uniform2f(U.u_lipC, ...face.lipC);
    gl.uniform2f(U.u_lipR, ...face.lipR);
    gl.uniform2f(U.u_blushL, ...face.blushL);
    gl.uniform2f(U.u_blushR, ...face.blushR);
    gl.uniform2f(U.u_underL, ...face.underL);
    gl.uniform2f(U.u_underR, ...face.underR);
    gl.uniform1f(U.u_chinRad, face.faceW * 0.35);
    gl.uniform1f(U.u_noseRad, face.eyeW * 0.9);
    gl.uniform1f(U.u_blushRad, face.faceW * 0.16);
    gl.uniform1f(U.u_underRad, face.eyeW * 0.55);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return true;
}

function loop(now) {
  if (!running) return;
  detect(now);
  render(now);
  requestAnimationFrame(loop);
}

/* ---------------- capture ---------------- */
const lastBtn = document.getElementById("last");
document.getElementById("shot").onclick = () => {
  if (!running) return;
  const was = showOriginal; showOriginal = false;
  if (!render(performance.now())) { showOriginal = was; return; }
  const data = canvas.toDataURL("image/jpeg", 0.92);
  showOriginal = was;
  const fl = document.getElementById("flash");
  fl.classList.add("on"); setTimeout(() => fl.classList.remove("on"), 60);
  lastBtn.innerHTML = `<img alt="" src="${data}">`;
  let ok = false;
  try { ok = window.Android && window.Android.savePhoto(data) === "ok"; } catch {}
  toast(ok ? "사진첩에 저장했어요" : "저장하지 못했어요. 다시 찍어 주세요.");
};

document.getElementById("flip").onclick = () => {
  facing = facing === "user" ? "environment" : "user";
  face = null;
  startCamera();
};

const hold = document.getElementById("hold");
const setOrig = on => { showOriginal = on; hold.classList.toggle("on", on); };
hold.addEventListener("pointerdown", e => { e.preventDefault(); setOrig(true); });
["pointerup", "pointerleave", "pointercancel"].forEach(ev => hold.addEventListener(ev, () => setOrig(false)));

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------------- controls ---------------- */
const filtersEl = document.getElementById("filters");
PRESETS.forEach(p => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "chip" + (p.id === state.preset ? " sel" : "");
  b.innerHTML = `<i style="background:${p.sw}"></i>${p.name}`;
  b.onclick = () => {
    state.preset = p.id; save();
    filtersEl.querySelectorAll(".chip").forEach(c => c.classList.remove("sel"));
    b.classList.add("sel");
  };
  filtersEl.append(b);
});

const tabsEl = document.getElementById("tabs");
const slider = document.getElementById("slider"), out = document.getElementById("sliderOut");
function selectTab(id) {
  tab = id;
  tabsEl.querySelectorAll(".tab").forEach(t => t.classList.toggle("sel", t.dataset.id === id));
  slider.value = state.v[id]; out.textContent = state.v[id];
}
TABS.forEach(t => {
  const b = document.createElement("button");
  b.type = "button"; b.className = "tab"; b.dataset.id = t.id; b.textContent = t.name;
  b.onclick = () => selectTab(t.id);
  tabsEl.append(b);
});
slider.addEventListener("input", () => {
  if (tab !== "amount") { state.level = null; paintLevels(); }
  state.v[tab] = +slider.value; out.textContent = slider.value; save();
});
selectTab("smooth");

const levelsEl = document.getElementById("levels");
function paintLevels() {
  levelsEl.querySelectorAll("button").forEach(b => b.classList.toggle("sel", b.dataset.id === state.level));
}
Object.entries(LEVELS).forEach(([id, L]) => {
  const b = document.createElement("button");
  b.type = "button"; b.dataset.id = id; b.textContent = L.name;
  b.onclick = () => {
    state.level = id; Object.assign(state.v, L.v); save();
    paintLevels(); selectTab(tab); toast(L.name + " 모드");
  };
  levelsEl.append(b);
});
paintLevels();

/* ---------------- start ---------------- */
startCamera();
initFace();
