/* ACTIVA · aplicación web offline. Persistencia local por usuario; no es autenticación de servidor. */
(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const icon = (name) => `<svg class="ic" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
  const escapeHTML = (text) => String(text).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
  const nice = {
    casa: "En casa", gimnasio: "Gimnasio", airelibre: "Aire libre",
    ninguno: "Ninguno", basico: "Básico", completo: "Completo",
    fuerza: "Fuerza", estres: "Reducir estrés", activo: "Mantenerme activo",
    baja: "Baja", moderada: "Moderada", alta: "Alta"
  };
  const STORAGE_KEY = "activa_demo_v1";
  const ACCOUNTS_KEY = "activa_accounts_v2";
  const SESSION_KEY = "activa_session_v2";
  // La cuenta invitada de la versión anterior ya no es válida.
  try {
    const records = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
    if(records["demo@activa.local"]?.hash === "demo") {
      delete records["demo@activa.local"];
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(records));
    }
    if(localStorage.getItem(SESSION_KEY) === "demo@activa.local") localStorage.removeItem(SESSION_KEY);
  } catch { /* almacenamiento opcional */ }
  const PASSWORD_ALLOWED = /^[A-Za-z0-9!@#$%*._-]+$/;
  function passwordError(value){
    if(value.length < 8 || value.length > 32) return "La contraseña debe tener entre 8 y 32 caracteres.";
    if(!PASSWORD_ALLOWED.test(value)) return "Carácter no permitido: usa solo letras sin acentos, números y ! @ # $ % * . _ -; sin espacios.";
    if(!/[A-Z]/.test(value)) return "Agrega al menos una letra mayúscula.";
    if(!/[a-z]/.test(value)) return "Agrega al menos una letra minúscula.";
    if(!/[0-9]/.test(value)) return "Agrega al menos un número.";
    if(!/[!@#$%*._-]/.test(value)) return "Agrega al menos un símbolo: ! @ # $ % * . _ -";
    return "";
  }
  let user = null;
  try {
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}");
    const email = localStorage.getItem(SESSION_KEY);
    if(email && accounts[email]) user = { email, name: accounts[email].name };
  } catch { /* Permitir que funcione sin almacenamiento. */ }
  const userKey = () => user ? `activa_user_${user.email}` : STORAGE_KEY;
  const authRead = () => {try { return JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); }catch{return {};}};
  const authSave = (accounts) => localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  async function hashPassword(password, salt){
    if(!window.crypto?.subtle){
      // Fallback de compatibilidad para abrir el archivo directamente (no apto para autenticación real).
      let v=2166136261;for(const c of (salt+":"+password)){v^=c.charCodeAt(0);v=Math.imul(v,16777619)}
      return "local-"+(v>>>0).toString(16);
    }
    const bytes = new TextEncoder().encode(salt + ":" + password);
    const hashed = await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(hashed), x=>x.toString(16).padStart(2,"0")).join("");
  }
  const defaults = {time: 30, place: "casa", equipment: "ninguno", goal: "fuerza", intensity: "moderada"};
  const equipmentRank = {ninguno: 0, basico: 1, completo: 2};
  const intensityRank = {baja: 0, moderada: 1, alta: 2};
  const exercise = (name, quantity, help, timer = 30) => ({name, quantity, help, timer});

  const routines = [
    {
      id:"fuerza-casa", title:"Rutina de fuerza", duration:25, place:["casa","gimnasio"], equipment:0,
      goal:"fuerza", intensity:"moderada", muscles:"Pecho, brazos y core", symbol:"dumbbell",
      benefit:"Fuerza", exercises:[
        exercise("Lagartijas", "3 series × 12 repeticiones", "Mantén la espalda alineada y baja con control."),
        exercise("Fondos en silla", "3 series × 10 repeticiones", "Usa una silla firme y evita mover los hombros bruscamente."),
        exercise("Plancha", "3 series × 30 segundos", "Mantén el abdomen firme y respira con normalidad.",30),
        exercise("Crunch abdominal", "3 series × 15 repeticiones", "Sube suavemente sin jalar el cuello.")
      ]
    },
    {
      id:"fuerza-express",title:"Fuerza exprés",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"fuerza",intensity:"moderada",muscles:"Piernas, pecho y abdomen",symbol:"dumbbell",benefit:"Fuerza rápida",
      exercises:[exercise("Sentadillas","2 series × 12 repeticiones","Mantén los talones apoyados."),exercise("Lagartijas apoyadas","2 series × 10 repeticiones","Puedes apoyar las rodillas."),exercise("Plancha","2 series × 20 segundos","Evita arquear la espalda.",20)]
    },
    {
      id:"fuerza-dinamica",title:"Fuerza dinámica",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"fuerza",intensity:"alta",muscles:"Piernas, core y brazos",symbol:"dumbbell",benefit:"Reto rápido",
      exercises:[exercise("Sentadillas rápidas","3 series × 12 repeticiones","Prioriza control antes que velocidad."),exercise("Lagartijas","3 series × 8 repeticiones","Adapta el apoyo a tu nivel."),exercise("Mountain climbers","3 series × 20 segundos","Mantén la cadera estable.",20)]
    },
    {
      id:"resistencia",title:"Circuito de resistencia",duration:35,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"fuerza",intensity:"alta",muscles:"Cuerpo completo",symbol:"dumbbell",benefit:"Resistencia",
      exercises:[exercise("Sentadillas","4 series × 15 repeticiones","Rodillas en línea con los pies."),exercise("Zancadas","3 series × 10 por pierna","Da un paso cómodo y baja lentamente."),exercise("Lagartijas","3 series × 12 repeticiones","Controla el descenso."),exercise("Plancha lateral","3 series × 20 segundos por lado","Mantén hombros y cadera alineados.",20)]
    },
    {
      id:"mancuernas",title:"Fuerza con mancuernas",duration:30,place:["casa","gimnasio"],equipment:1,
      goal:"fuerza",intensity:"moderada",muscles:"Brazos, hombros y piernas",symbol:"dumbbell",benefit:"Fuerza",
      exercises:[exercise("Curl de bíceps","3 series × 12 repeticiones","Sin balancear el cuerpo."),exercise("Press de hombro","3 series × 10 repeticiones","Usa un peso que puedas controlar."),exercise("Sentadilla con peso","3 series × 12 repeticiones","Mantén la espalda neutra.")]
    },
    {
      id:"gimnasio",title:"Circuito de gimnasio",duration:45,place:["gimnasio"],equipment:2,
      goal:"fuerza",intensity:"alta",muscles:"Pecho, espalda y piernas",symbol:"dumbbell",benefit:"Fuerza",
      exercises:[exercise("Prensa de piernas","3 series × 12 repeticiones","Ajusta el asiento y el rango de movimiento."),exercise("Press de pecho","3 series × 10 repeticiones","Controla la carga."),exercise("Remo sentado","3 series × 12 repeticiones","No arquees la espalda."),exercise("Plancha","3 series × 30 segundos","Respira constantemente.",30)]
    },
    {
      id:"movilidad",title:"Movilidad y desestrés",duration:20,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"estres",intensity:"baja",muscles:"Espalda y cuello",symbol:"activity",benefit:"Liberar tensión",
      exercises:[exercise("Movilidad de cuello","2 series × 30 segundos","Realiza movimientos pequeños y suaves.",30),exercise("Círculos de hombros","2 series × 30 segundos","Evita forzar las articulaciones.",30),exercise("Gato-vaca","2 series × 10 repeticiones","Alterna la postura lentamente."),exercise("Respiración tranquila","2 minutos","Respira sin retener el aire.",60)]
    },
    {
      id:"pausa",title:"Pausa para despejarte",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"estres",intensity:"baja",muscles:"Cuello, hombros y espalda",symbol:"activity",benefit:"Desestresar",
      exercises:[exercise("Caminar suave","5 minutos","Busca un ritmo cómodo.",60),exercise("Estirar hombros","2 series × 20 segundos","No rebotes.",20),exercise("Respiración relajada","2 minutos","Siéntate o permanece de pie cómodamente.",60)]
    },
    {
      id:"desconexion",title:"Desconexión activa",duration:30,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"estres",intensity:"moderada",muscles:"Todo el cuerpo",symbol:"activity",benefit:"Mente despejada",
      exercises:[exercise("Marcha en el sitio","5 minutos","Mantén un ritmo constante.",60),exercise("Movilidad de hombros","3 series × 12 repeticiones","Movimientos amplios sin dolor."),exercise("Sentadillas suaves","2 series × 10 repeticiones","Baja hasta donde te resulte cómodo."),exercise("Estiramiento final","3 minutos","Relaja gradualmente el cuerpo.",60)]
    },
    {
      id:"cardio",title:"Cardio ligero",duration:25,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"activo",intensity:"moderada",muscles:"Piernas y resistencia",symbol:"lightning",benefit:"Energía rápida",
      exercises:[exercise("Marcha rápida","5 minutos","Acelera de forma gradual.",60),exercise("Pasos laterales","3 series × 40 segundos","Mantén los hombros relajados.",40),exercise("Rodillas arriba suaves","3 series × 30 segundos","A tu ritmo.",30),exercise("Caminar lento","4 minutos","Baja poco a poco la intensidad.",60)]
    },
    {
      id:"cardio-corto",title:"Energía en 15 minutos",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"activo",intensity:"moderada",muscles:"Piernas y sistema cardiovascular",symbol:"lightning",benefit:"Energía rápida",
      exercises:[exercise("Marcha rápida","4 minutos","Empieza suave.",60),exercise("Paso lateral","3 series × 30 segundos","Apoya bien los pies.",30),exercise("Talones al glúteo","3 series × 20 segundos","Sin impactar fuerte.",20)]
    },
    {
      id:"cardio-alto",title:"Circuito activo",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"activo",intensity:"alta",muscles:"Piernas y core",symbol:"lightning",benefit:"Energía intensa",
      exercises:[exercise("Jumping jacks","3 series × 30 segundos","Cambia por pasos laterales si necesitas menos impacto.",30),exercise("Sentadillas","3 series × 12 repeticiones","Mantén control y estabilidad."),exercise("Rodillas arriba","3 series × 30 segundos","Mantén un ritmo manejable.",30)]
    },
    {
      id:"moverse",title:"Movimiento suave",duration:15,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"activo",intensity:"baja",muscles:"Movilidad general",symbol:"activity",benefit:"Activarse",
      exercises:[exercise("Caminar suave","5 minutos","Ritmo cómodo.",60),exercise("Movilidad de brazos","2 series × 12 repeticiones","Sin tensión."),exercise("Estirar piernas","2 series × 20 segundos","Sin llegar a dolor.",20)]
    },
    {
      id:"caminata",title:"Caminata al aire libre",duration:30,place:["airelibre"],equipment:0,
      goal:"activo",intensity:"baja",muscles:"Piernas y bienestar general",symbol:"pin",benefit:"Aire libre",
      exercises:[exercise("Caminata de calentamiento","5 minutos","Empieza a ritmo suave.",60),exercise("Caminata continua","20 minutos","Mantén un paso cómodo.",60),exercise("Enfriamiento","5 minutos","Reduce el ritmo antes de terminar.",60)]
    },
    {
      id:"fullbody",title:"Cuerpo completo",duration:45,place:["casa","gimnasio","airelibre"],equipment:0,
      goal:"activo",intensity:"moderada",muscles:"Piernas, brazos y abdomen",symbol:"activity",benefit:"Condición general",
      exercises:[exercise("Sentadillas","3 series × 12 repeticiones","Mantén el control."),exercise("Lagartijas apoyadas","3 series × 10 repeticiones","Adapta la inclinación."),exercise("Marcha rápida","5 minutos","Aumenta poco a poco el ritmo.",60),exercise("Plancha","3 series × 25 segundos","Respira de manera natural.",25)]
    }
  ];

  function readStorage(){
    try { return JSON.parse(localStorage.getItem(userKey())) || {}; }
    catch { return {}; }
  }
  const persisted = readStorage();
  const state = {
    page: user ? "home" : "auth",
    authMode: "login",
    filters: {...defaults, ...(persisted.filters || {})},
    favorites: Array.isArray(persisted.favorites) ? persisted.favorites : [],
    history: Array.isArray(persisted.history) ? persisted.history : [],
    name: user?.name || (typeof persisted.name === "string" ? persisted.name : ""),
    routineId: "fuerza-casa",
    workout: null,
    interval: null,
    toastTimeout: null
  };
  const screen = $("#screen");
  const modal = $("#app-modal");

  function saveStorage(){
    try { localStorage.setItem(userKey(), JSON.stringify({filters:state.filters, favorites:state.favorites, history:state.history, name:state.name})); }
    catch { /* El prototipo sigue funcionando aunque el navegador bloquee almacenamiento. */ }
  }
  function toast(text){
    const element = $("#toast");
    element.textContent = text;
    element.classList.add("show");
    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => element.classList.remove("show"), 2700);
  }
  function workoutStopTimer(){
    if(state.interval){clearInterval(state.interval);state.interval = null;}
    if(state.workout) state.workout.running = false;
  }
  function navigate(page, {keepWorkout=false}={}){
    if(state.workout && !keepWorkout && page !== "detail") workoutStopTimer();
    if(!user && page !== "auth") page = "auth";
    if(modal.open)modal.close();
    state.page = page;
    render();
    screen.scrollTop = 0;
  }
  function optionGroup(title, iconName, key, opts){
    const cells = opts.map(([value,label]) => `<button type="button" class="option ${state.filters[key]===value ? "selected" : ""}" data-filter="${key}" data-value="${value}" aria-pressed="${state.filters[key]===value}">${label}</button>`).join("");
    return `<section class="group"><div class="group-label">${icon(iconName)}<span>${title}</span></div><div class="options ${opts.length===4 ? "four" : ""}">${cells}</div></section>`;
  }
  function renderAuth(){
    const registering = state.authMode === "register";
    return `<section class="auth-page" aria-label="Acceso a Activa">
      <div class="auth-logo"><span class="auth-logo-mark">A</span> <span>ACTIVA</span></div>
      <img class="auth-illustration" src="images/estirar.webp" alt="Ilustración de una persona realizando movilidad" />
      <p class="auth-kicker">TU ESPACIO DE MOVIMIENTO</p><h1 class="screen-title">${registering ? "Empieza hoy." : "Qué bueno verte."}</h1>
      <p class="bodycopy">${registering ? "Crea tu cuenta para tener tus rutinas y progresos en un mismo lugar." : "Inicia sesión y sigue moviéndote a tu ritmo."}</p>
      <form id="auth-form" class="auth-form">
        ${registering ? `<div class="form-field"><label for="auth-name">Tu nombre</label><input id="auth-name" name="name" autocomplete="name" maxlength="40" required placeholder="Ej. Mateo" /></div>` : ""}
        <div class="form-field"><label for="auth-email">Correo electrónico</label><input id="auth-email" type="email" name="email" autocomplete="email" required placeholder="correo@ejemplo.com" /></div>
        <div class="form-field"><label for="auth-password">Contraseña</label><input id="auth-password" type="password" name="password" minlength="6" required autocomplete="${registering ? "new-password" : "current-password"}" placeholder="${registering ? "Crea una contraseña segura" : "Tu contraseña"}" /></div>
        ${registering ? `<div class="form-field"><label for="auth-confirm">Confirma tu contraseña</label><input id="auth-confirm" type="password" name="confirm" autocomplete="new-password" required placeholder="Repite tu contraseña" /></div>
        <div class="password-rules" id="password-rules"><strong>Requisitos de contraseña</strong><span id="password-rule-length">○ 8 a 32 caracteres</span><span id="password-rule-case">○ Al menos una mayúscula y una minúscula</span><span id="password-rule-number">○ Al menos un número</span><span id="password-rule-symbol">○ Al menos un símbolo permitido: ! @ # $ % * . _ -</span><span id="password-rule-allowed">○ No se permiten espacios, acentos, emojis ni otros símbolos</span><span id="password-rule-confirm">○ Ambas contraseñas deben coincidir</span></div>` : ""}
        <p id="auth-error" class="auth-error" role="alert" hidden></p>
        <button type="submit" class="btn full">${registering ? "Crear cuenta" : "Iniciar sesión"} ${icon("next")}</button>
      </form>
      <button class="text-button" type="button" data-auth-mode="${registering ? "login" : "register"}">${registering ? "¿Ya tienes cuenta? Inicia sesión" : "¿No tienes cuenta? Regístrate"}</button>
      <p class="auth-disclaimer">Los datos se guardan únicamente en este navegador. No reutilices contraseñas personales; esta versión no tiene servidor de autenticación.</p>
    </section>`;
  }
  function renderHome(){
    return `<section aria-label="Inicio">
      <p class="eyebrow">BIENVENIDO A ACTIVA <span class="green-dot">●</span></p>
      <h1 class="screen-title big">¡Hola, ${escapeHTML((state.name || "bienvenido").split(" ")[0])}! <span class="wave">✳</span></h1>
      <p class="bodycopy">Hoy es un buen día para moverte. ¿Qué te gustaría hacer?</p>
      <div class="home-hero-wrap"><img class="home-hero" src="images/fuerza_casa.webp" alt="Ilustración de ejercicio en casa"/><div class="home-hero-caption"><span>ACTIVA</span><strong>A TU RITMO.</strong></div></div>
      <div class="welcome-note"><div class="welcome-note-icon">${icon("lightning")}</div><div><strong>Tu plan de hoy</strong><p>${state.filters.time} minutos · ${nice[state.filters.place]} · ${nice[state.filters.goal]}. Todo listo para comenzar.</p></div></div>
      <div class="features">
        <div class="feature">${icon("clock")}<span>Actividades según tu tiempo</span></div>
        <div class="feature">${icon("home")}<span>En casa, parque o gimnasio</span></div>
        <div class="feature">${icon("target")}<span>Opciones según tu objetivo</span></div>
      </div>
      <button type="button" class="btn full" data-go="setup">Descubrir mi rutina <span aria-hidden="true">→</span></button>
      <button type="button" class="text-button" data-modal="progress">Ver mi progreso</button>
    </section>`;
  }
  function renderSetup(){
    return `<section aria-label="Configuración de rutina">
      <button type="button" class="back" data-go="home">${icon("back")} Volver</button>
      <p class="eyebrow">PASO 01 / PERSONALIZACIÓN</p>
      <h1 class="screen-title">Configura tu rutina</h1>
      <p class="bodycopy">Solo cinco preguntas rápidas para encontrar actividades que encajen contigo.</p>
      ${optionGroup("Tiempo disponible", "clock", "time", [[15,"15 min"],[30,"30 min"],[45,"45 min"],[60,"60 min"]])}
      ${optionGroup("Lugar", "pin", "place", [["casa","En casa"],["gimnasio","Gimnasio"],["airelibre","Aire libre"]])}
      ${optionGroup("Equipamiento", "dumbbell", "equipment", [["ninguno","Ninguno"],["basico","Básico"],["completo","Completo"]])}
      ${optionGroup("Objetivo", "target", "goal", [["fuerza","Fuerza"],["estres","Reducir estrés"],["activo","Mantenerme activo"]])}
      ${optionGroup("Intensidad", "chart", "intensity", [["baja","Baja"],["moderada","Moderada"],["alta","Alta"]])}
      <button type="button" class="btn full actions-bottom" data-go="results">Ver recomendaciones ${icon("next")}</button>
      <p class="hint">Puedes modificar estas opciones siempre que quieras.</p>
    </section>`;
  }
  function eligible(r){
    return r.duration <= state.filters.time && r.place.includes(state.filters.place) && r.equipment <= equipmentRank[state.filters.equipment];
  }
  // KNN de catálogo: cada rutina es un ejemplo y se ordena por distancia al contexto del usuario.
  // Distancia ponderada de variables categóricas y numéricas normalizadas; k=3 vecinos más cercanos.
  // Las restricciones de tiempo, lugar y equipo se aplican ANTES de calcular distancias.
  function score(r){
    const f=state.filters;
    const goalDistance=r.goal===f.goal?0:1;
    const intensityDistance=Math.abs(intensityRank[r.intensity]-intensityRank[f.intensity])/2;
    const timeDistance=Math.abs(r.duration-f.time)/Math.max(f.time,15);
    const equipmentDistance=Math.abs(r.equipment-equipmentRank[f.equipment])/2;
    const distance=0.58*goalDistance+0.24*intensityDistance+0.14*timeDistance+0.04*equipmentDistance;
    return 1/(1+distance);
  }
  function recommendations(){
    const candidates = routines.filter(eligible).sort((a,b) => score(b)-score(a));
    // Tres vecinos cercanos, dando prioridad al objetivo principal.
    return candidates.slice(0,3);
  }
  function thumb(r){
    const artwork = {
      "fuerza-casa":"fuerza_casa", "fuerza-express":"saltar", "fuerza-dinamica":"fuerza_casa",
      "resistencia":"saltar", "mancuernas":"mancuernas", "gimnasio":"mancuernas",
      "movilidad":"estirar", "pausa":"relajacion", "desconexion":"estirar",
      "cardio":"correr", "cardio-corto":"saltar", "cardio-alto":"saltar",
      "moverse":"estirar", "caminata":"correr", "fullbody":"fuerza_casa"
    };
    const file = artwork[r.id] || "fuerza_casa";
    return `<div class="thumb"><img src="images/${file}.webp" alt="Ilustración de ${escapeHTML(r.title)}" loading="lazy" /></div>`;
  }
  function routineCard(r, buttonText="Ver rutina"){
    return `<article class="routine-card"><div class="card-main">${thumb(r)}<div class="card-info">
      <span class="card-category">${r.benefit}</span><h3>${r.title}</h3>
      <div class="meta">${icon("clock")}<span>${r.duration} min</span></div>
      <div class="meta">${icon("activity")}<span>${r.muscles}</span></div>
      <button type="button" class="btn small" data-routine="${r.id}">${buttonText}</button>
    </div></div></article>`;
  }
  function renderResults(){
    const f=state.filters;
    const chips = [
      ["clock", `${f.time} min`],["home", nice[f.place]],
      ["dumbbell", f.equipment==="ninguno" ? "Sin equipamiento" : `Equipo ${nice[f.equipment].toLowerCase()}`],
      ["chart",`Intensidad ${nice[f.intensity].toLowerCase()}`]
    ];
    const results = recommendations();
    return `<section aria-label="Recomendaciones">
      <button type="button" class="back" data-go="setup">${icon("back")} Cambiar filtros</button>
      <p class="eyebrow">ELEGIDAS PARA TI</p>
      <h1 class="screen-title">Para ti hoy</h1>
      <p class="bodycopy">Seleccionamos estas actividades según lo que nos contaste.</p>
      <div class="filter-grid">${chips.map(([name,text])=>`<button type="button" class="filter-chip" data-go="setup" title="Modificar filtros">${icon(name)}<span>${text}</span>${icon("down")}</button>`).join("")}</div>
      <p class="result-caption">${results.length} opciones para tu objetivo: ${nice[f.goal].toLowerCase()}</p>
      <div class="card-list">${results.length ? results.map((r,i)=>routineCard(r, i===0 ? "Ver rutina" : i===1 ? "Comenzar" : "Ver opción")).join("") : `<div class="empty">No hay rutinas compatibles con todas las opciones. Prueba cambiar el tiempo, lugar o equipamiento. <button type="button" class="small-link" data-go="setup">Cambiar configuración</button></div>`}</div>
      <button type="button" class="text-button" data-go="setup">Modificar mis opciones</button>
    </section>`;
  }
  function currentRoutine(){return routines.find(r=>r.id===state.routineId) || routines[0];}
  function renderWorkout(r){
    const w=state.workout;
    if(!w || w.id!==r.id) return "";
    const item=r.exercises[w.index];
    const time=`${String(Math.floor(w.secondsLeft/60)).padStart(2,"0")}:${String(w.secondsLeft%60).padStart(2,"0")}`;
    return `<section id="workout-panel" class="workout-panel" aria-label="Temporizador de rutina">
      <p class="eyebrow">Ejercicio ${w.index+1} de ${r.exercises.length}</p>
      <div class="progress-rail"><div id="workout-progress" class="progress-fill" style="width:${100*(w.index+1)/r.exercises.length}%"></div></div>
      <h3>${escapeHTML(item.name)}</h3>
      <p class="hint">${escapeHTML(item.quantity)}. ${escapeHTML(item.help)}</p>
      <div class="timer-display" id="timer-display" role="timer">${time}</div>
      <p class="timer-help" id="timer-help">${w.running ? "Temporizador en marcha" : w.secondsLeft===0 ? "Tiempo terminado. Puedes continuar." : "Temporizador en pausa"} · Ajusta tu ritmo</p>
      <div class="timer-controls">
        <button type="button" class="btn small" data-workout="toggle">${icon(w.running ? "pause" : "play")} ${w.running ? "Pausar" : "Continuar"}</button>
        <button type="button" class="btn small subtle" data-workout="reset">${icon("refresh")} Reiniciar</button>
        <button type="button" class="btn small subtle" data-workout="prev" ${w.index===0 ? "disabled" : ""}>Anterior</button>
        <button type="button" class="btn small" data-workout="next">${w.index+1===r.exercises.length ? "Finalizar ✓" : "Siguiente →"}</button>
      </div>
      <button type="button" class="small-link" data-workout="cancel">Cancelar sesión</button>
    </section>`;
  }
  function renderDetail(){
    const r=currentRoutine();
    const saved=state.favorites.includes(r.id);
    const list = r.exercises.map((e,index)=>`<article class="exercise"><span class="exercise-art">${String(index+1).padStart(2,"0")}</span><div><h3>${index+1}. ${escapeHTML(e.name)}</h3><p>${escapeHTML(e.quantity)}</p></div></article>`).join("");
    return `<section aria-label="Detalle de rutina">
      <button type="button" class="back" data-go="results">${icon("back")} Recomendaciones</button>
      <p class="eyebrow">TU ENTRENAMIENTO</p>
      <div class="detail-summary">${thumb(r)}<div>
        <h1>${r.title}</h1>
        <div class="meta">${icon("clock")}<span>${r.duration} min</span></div>
        <div class="meta">${icon("chart")}<span>${nice[r.intensity]}</span></div>
        <div class="meta">${icon("dumbbell")}<span>${r.muscles}</span></div>
      </div></div>
      <div class="tags"><span class="tag">${nice[r.goal]}</span><span class="tag">${r.benefit}</span></div>
      <div class="section-heading"><h2>Ejercicios</h2><span class="tag">${r.exercises.length} actividades</span></div>
      <div class="exercise-list">${list}</div>
      <div class="info-panel"><strong>${icon("info")} Técnica correcta</strong><p>Descansa alrededor de 30 segundos entre ejercicios. Haz los movimientos con control. Detente si sientes dolor o mareo. Esta app propone actividad recreativa, no indicaciones médicas.</p></div>
      <div class="action-row"><button type="button" class="btn" data-workout="start">${icon("play")} ${state.workout?.id===r.id ? "Reiniciar rutina" : "Iniciar rutina"}</button><button type="button" class="btn subtle small" data-save="${r.id}">${icon(saved ? "check" : "save")} ${saved ? "Guardada" : "Guardar"}</button></div>
      ${renderWorkout(r)}
    </section>`;
  }
  function render(){
    screen.innerHTML = ({auth:renderAuth,home:renderHome,setup:renderSetup,results:renderResults,detail:renderDetail})[state.page]();
    document.querySelector(".bottom-nav").hidden = !user;

    document.querySelectorAll("[data-go]").forEach(button=>{
      if(button.classList.contains("demo-step")) button.classList.toggle("is-active",button.dataset.go===state.page);
    });
    document.querySelectorAll("[data-nav]").forEach(button=>button.classList.toggle("active",button.dataset.nav==="home" && state.page==="home"));
  }
  function openRoutine(id){
    if(!routines.find(r=>r.id===id))return;
    if(state.workout && state.workout.id!==id){workoutStopTimer();state.workout=null;}
    state.routineId=id;
    if(modal.open) modal.close();
    navigate("detail",{keepWorkout:true});
  }
  function timerStart(){
    workoutStopTimer();
    state.workout.running=true;
    state.interval=setInterval(()=>{
      const w=state.workout;
      if(!w || !w.running){workoutStopTimer();return;}
      w.secondsLeft=Math.max(0,w.secondsLeft-1);
      const display=$("#timer-display");
      if(display)display.textContent=`${String(Math.floor(w.secondsLeft/60)).padStart(2,"0")}:${String(w.secondsLeft%60).padStart(2,"0")}`;
      if(w.secondsLeft===0){workoutStopTimer();render();toast("Tiempo terminado. Puedes pasar al siguiente ejercicio.");}
    },1000);
  }
  function workoutAction(action){
    const r=currentRoutine();
    if(action==="start"){
      workoutStopTimer();
      state.workout={id:r.id,index:0,secondsLeft:r.exercises[0].timer,running:false};
      timerStart();render();toast("Rutina iniciada. ¡Tú puedes!");
      $("#workout-panel")?.scrollIntoView({block:"nearest",behavior:"smooth"});
      return;
    }
    const w=state.workout;
    if(!w || w.id!==r.id){toast("Primero inicia una rutina.");return;}
    if(action==="toggle"){
      if(w.running)workoutStopTimer();else {if(w.secondsLeft===0)w.secondsLeft=r.exercises[w.index].timer;timerStart();}
    }else if(action==="reset"){
      workoutStopTimer();w.secondsLeft=r.exercises[w.index].timer;
    }else if(action==="prev"){
      workoutStopTimer();w.index=Math.max(0,w.index-1);w.secondsLeft=r.exercises[w.index].timer;
    }else if(action==="next"){
      workoutStopTimer();
      if(w.index===r.exercises.length-1){
        state.history.unshift({id:r.id,title:r.title,date:new Date().toISOString(),minutes:r.duration});
        state.history=state.history.slice(0,100);
        saveStorage();state.workout=null;render();toast("¡Rutina completada! Se guardó en tu progreso.");return;
      }
      w.index++;w.secondsLeft=r.exercises[w.index].timer;
    }else if(action==="cancel"){
      workoutStopTimer();state.workout=null;render();toast("Sesión cancelada.");return;
    }
    render();
  }
  function openModal(which){
    if(modal.open)modal.close();
    const title=$("#modal-title");
    const content=$("#modal-content");
    const activeNav=document.querySelector(`[data-nav="${which}"]`);
    document.querySelectorAll("[data-nav]").forEach(button=>button.classList.toggle("active",button===activeNav));
    if(which==="progress"){
      title.textContent="Tu progreso";
      const sessions=state.history.length;
      const minutes=state.history.reduce((sum,h)=>sum+(Number(h.minutes)||0),0);
      const weekStart=new Date();weekStart.setDate(weekStart.getDate()-6);weekStart.setHours(0,0,0,0);
      const week=state.history.filter(h=>new Date(h.date)>=weekStart).length;
      content.innerHTML=`<p class="modal-copy">Tus sesiones completadas se guardan en este dispositivo.</p>
        <div class="stat-grid"><div class="stat"><strong>${sessions}</strong><span>Rutinas completadas</span></div><div class="stat"><strong>${minutes}</strong><span>Minutos estimados</span></div><div class="stat"><strong>${week}</strong><span>Sesiones últimos 7 días</span></div><div class="stat"><strong>${state.favorites.length}</strong><span>Favoritas</span></div></div>
        <h3>Historial</h3>${sessions ? state.history.slice(0,15).map(h=>`<div class="history-row"><strong>${escapeHTML(h.title)}</strong><small>${new Date(h.date).toLocaleDateString("es-MX",{year:"numeric",month:"short",day:"numeric"})} · ${Number(h.minutes)||0} min aprox.</small></div>`).join("") : `<div class="empty">Todavía no has completado ninguna rutina. Inicia una para registrar tu progreso.</div>`}
        <p class="modal-copy">Para consultar tus rutinas guardadas, entra a <strong>Perfil → Mis rutinas guardadas</strong>.</p>`;
    }else if(which==="profile"){
      title.textContent="Mi perfil";
      const savedList=state.favorites.map(id=>routines.find(r=>r.id===id)).filter(Boolean);
      content.innerHTML=`<section class="profile-overview"><div class="profile-avatar">${escapeHTML((state.name || "U").charAt(0).toUpperCase())}</div><div><strong>${escapeHTML(state.name || "Mi cuenta")}</strong><p>${escapeHTML(user.email)}</p></div></section>
        <h3 class="profile-section-title">Mis rutinas guardadas <span class="saved-count">${savedList.length}</span></h3>
        <p class="modal-copy">Aquí están las rutinas que marcaste con «Guardar». Puedes abrirlas cuando quieras o eliminarlas de esta lista.</p>
        ${savedList.length ? `<div class="saved-routines">${savedList.map(r=>`<article class="saved-routine">${thumb(r)}<div class="saved-routine-info"><strong>${escapeHTML(r.title)}</strong><small>${r.duration} min · ${nice[r.intensity]}</small><div class="saved-actions"><button type="button" class="btn small" data-routine="${r.id}">Ver rutina</button><button type="button" class="btn small subtle" data-unsave="${r.id}" aria-label="Quitar ${escapeHTML(r.title)} de guardadas">Quitar</button></div></div></article>`).join("")}</div>` : `<div class="saved-empty"><span class="saved-empty-icon">♡</span><strong>Aún no has guardado rutinas</strong><p>Cuando encuentres una que te guste, pulsa «Guardar» en sus detalles y aparecerá aquí.</p><button type="button" class="btn small" data-profile-explore="1">Buscar rutinas</button></div>`}
        <h3 class="profile-section-title">Datos de mi cuenta</h3>
        <p class="modal-copy">Puedes cambiar el nombre que aparece en el saludo de Inicio.</p>
        <form id="profile-form"><div class="form-field"><label for="user-name">Nombre para mostrar</label><input id="user-name" name="name" maxlength="40" autocomplete="given-name" value="${escapeHTML(state.name)}" placeholder="Escribe tu nombre"></div>
        <button class="btn full" type="submit">${icon("check")} Actualizar nombre</button></form>
        <p class="profile-privacy-note">Tu historial y tus rutinas guardadas se conservan en este navegador. Para cambiar el tiempo o el tipo de ejercicio, utiliza «Configura tu rutina» desde Inicio.</p>
        <button type="button" class="btn small logout-button" data-modal-action="logout">Cerrar sesión</button>`;
    }else if(which==="search"){
      title.textContent="Buscar rutinas";
      content.innerHTML=`<div class="form-field"><label for="search-routines">Buscar por nombre o grupo muscular</label><input id="search-routines" type="search" placeholder="Ejemplo: cardio, fuerza..." autocomplete="off"></div><div id="search-matches"></div>`;
      renderSearchResults("");
    }
    modal.showModal();
  }
  function renderSearchResults(query){
    const target=$("#search-matches");if(!target)return;
    const q=query.trim().toLocaleLowerCase("es-MX");
    const matches=routines.filter(r=>`${r.title} ${r.muscles} ${r.benefit}`.toLocaleLowerCase("es-MX").includes(q));
    target.innerHTML=matches.length ? matches.map(r=>`<div class="search-result"><div><strong>${r.title}</strong><small>${r.duration} min · ${nice[r.intensity]} · ${r.muscles}</small></div><button type="button" class="btn small" data-routine="${r.id}">Ver</button></div>`).join("") : `<div class="empty">No encontramos rutinas con ese nombre.</div>`;
  }

  document.addEventListener("click",(event)=>{
    const button=event.target.closest("button");
    if(!button)return;
    if(button.dataset.authMode){state.authMode=button.dataset.authMode;render();return;}
    if(!user && (button.dataset.go || button.dataset.nav || button.dataset.modal)) {toast("Primero inicia sesión.");return;}
    if(button.dataset.go){
      if(button.dataset.go==="detail" && !routines.find(r=>r.id===state.routineId))state.routineId="fuerza-casa";
      navigate(button.dataset.go);return;
    }
    if(button.dataset.filter){
      const {filter,value}=button.dataset;
      state.filters[filter]=filter==="time" ? Number(value) : value;
      saveStorage();render();return;
    }
    if(button.dataset.routine){openRoutine(button.dataset.routine);return;}
    if(button.dataset.profileExplore){modal.close();navigate("setup");return;}
    if(button.dataset.unsave){
      const r=routines.find(x=>x.id===button.dataset.unsave);
      if(!r)return;
      state.favorites=state.favorites.filter(id=>id!==r.id);
      saveStorage();openModal("profile");toast("Se quitó «"+r.title+"» de tus guardadas.");return;
    }
    if(button.dataset.save){
      const id=button.dataset.save;
      if(state.favorites.includes(id)){state.favorites=state.favorites.filter(x=>x!==id);toast("Rutina quitada de tus guardadas.");}
      else {state.favorites.push(id);toast("Guardada. La encontrarás en Perfil → Mis rutinas guardadas.");}
      saveStorage();render();return;
    }
    if(button.dataset.workout){workoutAction(button.dataset.workout);return;}
    if(button.dataset.modal){openModal(button.dataset.modal);return;}
    if(button.dataset.nav){
      if(button.dataset.nav==="home") {if(modal.open)modal.close();navigate("home");}
      else openModal(button.dataset.nav);
      return;
    }
    if(button.dataset.modalAction==="logout"){
      workoutStopTimer();state.workout=null;if(modal.open)modal.close();user=null;localStorage.removeItem(SESSION_KEY);
      state.authMode="login";navigate("auth");toast("Sesión cerrada.");return;
    }
  });
  document.addEventListener("submit",async(event)=>{
    if(event.target.id==="auth-form"){
      event.preventDefault();
      const form=event.target;
      const error=$("#auth-error");
      const email=form.elements.email.value.trim().toLowerCase();
      const password=form.elements.password.value;
      const accounts=authRead();
      const registering=state.authMode==="register";
      const submit=form.querySelector("[type=submit]");submit.disabled=true;
      try {
        if(registering){
          const invalidPassword = passwordError(password);
          if(invalidPassword) throw new Error(invalidPassword);
          if(password !== form.elements.confirm.value) throw new Error("Las contraseñas no coinciden.");
          if(accounts[email]) throw new Error("Ese correo ya está registrado en este navegador.");
          const name=form.elements.name.value.trim();
          if(name.length<2)throw new Error("Escribe un nombre de al menos dos letras.");
          const random=new Uint8Array(12);if(window.crypto?.getRandomValues)crypto.getRandomValues(random);else for(let i=0;i<random.length;i++)random[i]=Math.floor(Math.random()*256);const salt=Array.from(random, x=>x.toString(16).padStart(2,"0")).join("");
          accounts[email]={name,salt,hash:await hashPassword(password,salt)};
          authSave(accounts);
        }else{
          if(!accounts[email] || await hashPassword(password,accounts[email].salt)!==accounts[email].hash)throw new Error("Correo o contraseña incorrectos.");
        }
        user={email,name:accounts[email].name};localStorage.setItem(SESSION_KEY,email);
        const saved=readStorage();
        state.filters={...defaults,...(saved.filters||{})};
        state.favorites=Array.isArray(saved.favorites)?saved.favorites:[];
        state.history=Array.isArray(saved.history)?saved.history:[];
        state.name=user.name;
        navigate("home");toast(registering?"¡Cuenta creada! Bienvenido.":"¡Bienvenido de nuevo!");
      }catch(err){error.textContent=err.message || "No fue posible entrar.";error.hidden=false;submit.disabled=false;}
      return;
    }
    if(event.target.id!=="profile-form")return;
    event.preventDefault();state.name=$("#user-name").value.trim() || user.name;
    const accounts=authRead();if(accounts[user.email]){accounts[user.email].name=state.name;authSave(accounts);user.name=state.name;}
    saveStorage();modal.close();toast("Perfil guardado.");
  });
  document.addEventListener("input",(event)=>{
    if(event.target.id==="search-routines")renderSearchResults(event.target.value);
    if(event.target.id==="auth-password" || event.target.id==="auth-confirm") {
      const p=document.querySelector("#auth-password")?.value || "";
      const confirm=document.querySelector("#auth-confirm")?.value || "";
      const checks = {
        length:p.length>=8 && p.length<=32,
        case:/[A-Z]/.test(p) && /[a-z]/.test(p),
        number:/[0-9]/.test(p),
        symbol:/[!@#$%*._-]/.test(p),
        allowed:p.length>0 && PASSWORD_ALLOWED.test(p),
        confirm:confirm.length>0 && p===confirm
      };
      Object.entries(checks).forEach(([k,ok])=>{
        const rule=document.querySelector(`#password-rule-${k}`);
        if(!rule)return;
        rule.classList.toggle("rule-ok",ok);
        rule.textContent=(ok?"✓ ":"○ ")+rule.textContent.slice(2);
      });
      const e=document.querySelector("#auth-error");
      if(e && !e.hidden){e.hidden=true;e.textContent="";}
    }
  });
  $("#close-modal").addEventListener("click",()=>modal.close());
  modal.addEventListener("close",()=>{
    document.querySelectorAll("[data-nav]").forEach(button=>button.classList.toggle("active",button.dataset.nav==="home" && state.page==="home"));
  });
  render();
})();
