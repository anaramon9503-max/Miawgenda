const SUPABASE_URL =
  "https://wbdijpsiovssuhxzzovi.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_T-fiB_MwofciQDOd7KWVOQ_LBVpq9xB";

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

const $ = id => document.getElementById(id);

const nombreNegocio = $("nombreNegocio");
const correoUsuario = $("correoUsuario");
const profesionalHorario = $("profesionalHorario");
const servicioHorario = $("servicioHorario");
const diaHorario = $("diaHorario");
const horaSlot = $("horaSlot");
const btnGuardarHorario = $("btnGuardarHorario");
const listaHorarios = $("listaHorarios");
const seccionCopiarHorario = $("seccionCopiarHorario");
const copiarDiaOrigen = $("copiarDiaOrigen");
const btnCopiarHorario = $("btnCopiarHorario");
const btnAbrirCopiarHorario = $("btnAbrirCopiarHorario");
const btnCerrarCopiarHorario = $("btnCerrarCopiarHorario");
const modalCopiarHorario = $("modalCopiarHorario");
const mensaje = $("mensaje");

let negocioActualId = null;
let usuarioActual = null;
let profesionales = [];
let serviciosAsignados = [];
let esAdmin = false;
let esProfesional = false;
let profesionalActualId = null;

const seccionAdminHorarios = $("seccionAdminHorarios");
const seccionListaAdmin = $("seccionListaAdmin");
const seccionProfesionalHorarios = $("seccionProfesionalHorarios");
const listaMiHorario = $("listaMiHorario");
const navAdmin = $("navAdmin");
const navProfesional = $("navProfesional");
const cargandoRol = $("cargandoRol");

const dias = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo"
};

$("btnVolver")?.addEventListener(
  "click",
  () => {
    window.location.href =
      "dashboard.html";
  }
);

$("btnCerrar")?.addEventListener(
  "click",
  async () => {
    await db.auth.signOut();
    window.location.href =
      "panel.html";
  }
);

profesionalHorario?.addEventListener(
  "change",
  async () => {
    await cargarServiciosProfesional();
    await cargarHorarios();
  }
);



btnGuardarHorario?.addEventListener(
  "click",
  guardarHorario
);

btnCopiarHorario?.addEventListener("click", copiarHorario);
btnAbrirCopiarHorario?.addEventListener("click", () => {
  if (!profesionalHorario.value) return mostrarError("Selecciona primero un profesional.");
  modalCopiarHorario?.classList.remove("oculto");
});
btnCerrarCopiarHorario?.addEventListener("click", () => modalCopiarHorario?.classList.add("oculto"));
modalCopiarHorario?.addEventListener("click", e => { if (e.target === modalCopiarHorario) modalCopiarHorario.classList.add("oculto"); });

function mostrarVistaResuelta() {
  cargandoRol?.classList.add("oculto");
}

async function iniciar() {
  ocultarMensaje();

  const { data, error } =
    await db.auth.getSession();

  if (
    error ||
    !data.session?.user
  ) {
    window.location.href =
      "panel.html";
    return;
  }

  usuarioActual =
    data.session.user;

  correoUsuario.textContent =
    usuarioActual.email || "";

  const membresia =
    await obtenerMembresia(
      usuarioActual.id
    );

  if (!membresia) {
    mostrarError(
      "No encontramos una membresía activa para esta cuenta."
    );

    setTimeout(() => {
      window.location.href =
        "dashboard.html";
    }, 1600);

    return;
  }

  negocioActualId =
    membresia.negocio_id;

  esAdmin =
    membresia.es_admin === true;

  esProfesional =
    membresia.es_profesional === true;

  await cargarNombreNegocio();

  if (esAdmin) {
    navAdmin?.classList.remove("oculto");
    seccionAdminHorarios?.classList.remove("oculto");
    seccionCopiarHorario?.classList.remove("oculto");
    seccionListaAdmin?.classList.remove("oculto");
    seccionProfesionalHorarios?.classList.add("oculto");

    await cargarProfesionales();
    mostrarVistaResuelta();
    return;
  }

  if (esProfesional) {
    profesionalActualId =
      await obtenerProfesionalActual(
        usuarioActual.id
      );

    if (!profesionalActualId) {
      mostrarError(
        "Tu cuenta no está vinculada a un profesional activo."
      );
      mostrarVistaResuelta();
      return;
    }

    navProfesional?.classList.remove("oculto");
    seccionAdminHorarios?.classList.add("oculto");
    seccionListaAdmin?.classList.add("oculto");
    seccionProfesionalHorarios?.classList.remove("oculto");

    await cargarMiHorario();
    mostrarVistaResuelta();
    return;
  }

  mostrarError(
    "Esta cuenta no tiene permisos para consultar horarios."
  );
  mostrarVistaResuelta();
}

async function obtenerMembresia(
  usuarioId
) {
  const { data, error } =
    await db
      .from("miembros_negocio")
      .select(`
        negocio_id,
        es_admin,
        es_profesional,
        activo
      `)
      .eq(
        "usuario_id",
        usuarioId
      )
      .eq("activo", true)
      .limit(1);

  if (error) {
    console.error(
      "Error membresía:",
      error
    );
    return null;
  }

  return data?.[0] || null;
}

async function obtenerProfesionalActual(
  usuarioId
) {
  const { data, error } =
    await db
      .from("profesionales")
      .select("id")
      .eq(
        "usuario_id",
        usuarioId
      )
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
      .maybeSingle();

  if (error) {
    console.error(
      "Error profesional actual:",
      error
    );
    return null;
  }

  return data?.id || null;
}

async function cargarNombreNegocio() {
  const { data, error } =
    await db
      .from("negocios")
      .select("nombre")
      .eq(
        "id",
        negocioActualId
      )
      .maybeSingle();

  if (error || !data) {
    console.error(error);
    nombreNegocio.textContent =
      "Mi negocio";
    return;
  }

  nombreNegocio.textContent =
    data.nombre || "Mi negocio";
}


async function cargarMiHorario() {
  listaMiHorario.innerHTML = `<div class="cargando">🐱 Cargando tu horario...</div>`;
  const { data: horarios, error } = await db.from("horarios")
    .select("dia_semana,hora_slot,hora_inicio,hora_fin,activo")
    .eq("profesional_id", profesionalActualId).eq("activo", true)
    .order("dia_semana", {ascending:true}).order("hora_inicio", {ascending:true});
  if (error) { listaMiHorario.innerHTML = `<div class="sin-resultados">No fue posible cargar tu horario.</div>`; return; }
  const mapa=new Map(); (horarios||[]).forEach(h=>{const hora=horaCorta(h.hora_slot||h.hora_inicio);mapa.set(`${h.dia_semana}|${hora}`,{dia:Number(h.dia_semana),hora});});
  const slots=[...mapa.values()].sort((a,b)=>a.dia-b.dia||a.hora.localeCompare(b.hora));
  if(!slots.length){listaMiHorario.innerHTML=`<div class="sin-resultados">Aún no tienes horarios asignados.</div>`;return;}
  const grupos={};slots.forEach(x=>(grupos[x.dia]||=[]).push(x));
  listaMiHorario.innerHTML=Object.keys(grupos).sort((a,b)=>a-b).map(d=>`<details class="horario-card" style="padding:0;overflow:hidden"><summary style="cursor:pointer;padding:14px;font-weight:800;display:flex;justify-content:space-between"><span>${dias[d]}</span><span>${grupos[d].length} ▾</span></summary><div style="padding:0 14px 14px">${grupos[d].map(x=>`<div class="horario-meta" style="padding:9px 0;border-top:1px solid #eee8f2"><strong>${x.hora}</strong></div>`).join('')}</div></details>`).join('');
}

async function cargarProfesionales() {
  profesionalHorario.disabled = true;

  profesionalHorario.innerHTML = `
    <option value="">
      Cargando profesionales...
    </option>
  `;

  const { data, error } =
    await db
      .from("profesionales")
      .select(`
        id,
        nombre,
        especialidad,
        activo
      `)
      .eq(
        "negocio_id",
        negocioActualId
      )
      .eq("activo", true)
      .order(
        "nombre",
        { ascending: true }
      );

  profesionalHorario.disabled = false;

  if (error) {
    console.error(
      "Error profesionales:",
      error
    );

    profesionalHorario.innerHTML = `
      <option value="">
        No fue posible cargar
      </option>
    `;

    mostrarError(
      "No fue posible cargar los profesionales."
    );
    return;
  }

  profesionales = data || [];

  profesionalHorario.innerHTML = `
    <option value="">
      Selecciona un profesional
    </option>
  `;

  for (
    const profesional
    of profesionales
  ) {
    const option =
      document.createElement(
        "option"
      );

    option.value =
      profesional.id;

    option.textContent =
      profesional.especialidad
        ? `${profesional.nombre} · ${profesional.especialidad}`
        : profesional.nombre;

    profesionalHorario.appendChild(
      option
    );
  }

  if (!profesionales.length) {
    profesionalHorario.innerHTML = `
      <option value="">
        No hay profesionales activos
      </option>
    `;
  }
}

async function cargarServiciosProfesional() {
  const profesionalId = profesionalHorario.value;
  serviciosAsignados = [];
  servicioHorario.innerHTML = "";

  if (!profesionalId) {
    listaHorarios.innerHTML = `<div class="sin-resultados">Selecciona un profesional.</div>`;
    return;
  }

  const { data: asignaciones, error: errorAsignaciones } = await db
    .from("profesional_servicios")
    .select("servicio_id")
    .eq("profesional_id", profesionalId);
  if (errorAsignaciones) return mostrarError("No fue posible cargar los servicios del profesional.");

  const ids = (asignaciones || []).map(x => x.servicio_id).filter(Boolean);
  if (!ids.length) {
    listaHorarios.innerHTML = `<div class="sin-resultados">Este profesional todavía no tiene servicios asignados.</div>`;
    return;
  }

  const { data: servicios, error } = await db.from("servicios")
    .select("id,nombre,duracion_minutos,activo")
    .in("id", ids).eq("negocio_id", negocioActualId).eq("activo", true).order("nombre");
  if (error) return mostrarError("No fue posible cargar los servicios.");
  serviciosAsignados = servicios || [];
  servicioHorario.innerHTML = serviciosAsignados.map(s => `<option value="${s.id}">${escapar(s.nombre)}</option>`).join("");
}

async function guardarHorario() {
  ocultarMensaje();
  const profesionalId = profesionalHorario.value;
  const dia = Number(diaHorario.value);
  const hora = horaSlot.value;
  if (!profesionalId || !dia || !hora) return mostrarError("Selecciona profesional, día y hora.");
  if (!serviciosAsignados.length) return mostrarError("Este profesional no tiene servicios activos asignados.");

  const horaInicio = normalizarHora(hora);
  btnGuardarHorario.disabled = true;
  btnGuardarHorario.textContent = "Guardando...";
  try {
    const { data: existentes, error: e1 } = await db.from("horarios")
      .select("servicio_id").eq("profesional_id", profesionalId).eq("dia_semana", dia).eq("hora_slot", horaInicio).eq("activo", true);
    if (e1) throw e1;
    const ya = new Set((existentes || []).map(x => x.servicio_id));
    const inserts = serviciosAsignados.filter(s => !ya.has(s.id)).map(s => ({
      profesional_id: profesionalId, servicio_id: s.id, dia_semana: dia,
      hora_slot: horaInicio, hora_inicio: horaInicio,
      hora_fin: sumarMinutos(horaInicio, Number(s.duracion_minutos) || 60), activo: true
    }));
    if (!inserts.length) return mostrarExito("Ese horario ya estaba agregado.");
    const { error } = await db.from("horarios").insert(inserts);
    if (error) throw error;
    mostrarExito(`Horario agregado a ${inserts.length} servicio${inserts.length === 1 ? "" : "s"}.`);
    horaSlot.value = "";
    await cargarHorarios();
  } catch (error) {
    console.error(error);
    mostrarError(error?.message || "No fue posible guardar el horario.");
  } finally {
    btnGuardarHorario.disabled = false;
    btnGuardarHorario.textContent = "+ Agregar horario";
  }
}

async function cargarHorarios() {
  const profesionalId = profesionalHorario.value;
  if (!profesionalId) { listaHorarios.innerHTML = `<div class="sin-resultados">Selecciona un profesional.</div>`; return; }
  listaHorarios.innerHTML = `<div class="cargando">Cargando horarios...</div>`;
  const { data, error } = await db.from("horarios")
    .select("id,profesional_id,servicio_id,dia_semana,hora_slot,hora_inicio,hora_fin,activo")
    .eq("profesional_id", profesionalId).order("dia_semana", {ascending:true}).order("hora_inicio", {ascending:true});
  if (error) return mostrarError("No fue posible cargar los horarios.");
  renderHorarios(data || []);
}

function renderHorarios(horarios) {
  const unicos = new Map();
  horarios.forEach(h => {
    const hora = normalizarHora(h.hora_slot || h.hora_inicio);
    const key = `${h.dia_semana}|${hora}`;
    if (!unicos.has(key)) unicos.set(key, {dia_semana:Number(h.dia_semana), hora, activos:0, total:0});
    const x=unicos.get(key); x.total++; if(h.activo) x.activos++;
  });
  const slots=[...unicos.values()].sort((a,b)=>a.dia_semana-b.dia_semana || a.hora.localeCompare(b.hora));
  if (!slots.length) { listaHorarios.innerHTML = `<div class="sin-resultados">No hay horarios asignados.</div>`; return; }
  const grupos={}; slots.forEach(x => (grupos[x.dia_semana] ||= []).push(x));
  listaHorarios.innerHTML = Object.keys(grupos).sort((a,b)=>a-b).map(dia => {
    const items=grupos[dia];
    return `<details class="horario-card" style="padding:0;overflow:hidden"><summary style="cursor:pointer;padding:14px;font-weight:800;color:#493d52;display:flex;justify-content:space-between;align-items:center"><span>${dias[dia]}</span><span style="font-size:12px;color:#81778a">${items.length} horario${items.length===1?'':'s'} ▾</span></summary><div style="padding:0 14px 14px">${items.map(h=>`<div style="padding:10px 0;border-top:1px solid #eee8f2;opacity:${h.activos?1:.55}"><div class="horario-meta"><strong>${h.hora.slice(0,5)}</strong> · ${h.activos ? 'Activo' : 'Inactivo'} · aplica a todos sus servicios</div><div class="horario-acciones"><button type="button" class="btn-horario-estado" onclick="cambiarEstadoSlot(${h.dia_semana},'${h.hora}',${h.activos ? 'false':'true'})">${h.activos?'Desactivar':'Activar'}</button><button type="button" class="btn-horario-eliminar" onclick="eliminarSlot(${h.dia_semana},'${h.hora}')">Eliminar</button></div></div>`).join('')}</div></details>`;
  }).join('');
}

async function copiarHorario(){
  ocultarMensaje();
  const profesionalId=profesionalHorario.value;
  const origen=Number(copiarDiaOrigen?.value);
  const destinos=[...document.querySelectorAll('#copiarDiasDestino input:checked')].map(x=>Number(x.value)).filter(x=>x!==origen);
  if(!profesionalId) return mostrarError('Selecciona primero un profesional.');
  if(!destinos.length) return mostrarError('Selecciona al menos un día destino diferente al día origen.');
  btnCopiarHorario.disabled=true; btnCopiarHorario.textContent='Copiando...';
  try{
    const {data:origenes,error:e1}=await db.from('horarios').select('servicio_id,hora_slot,hora_inicio,hora_fin').eq('profesional_id',profesionalId).eq('dia_semana',origen).eq('activo',true);
    if(e1) throw e1; if(!origenes?.length) return mostrarError(`No hay horarios activos en ${dias[origen]}.`);
    const {data:existentes,error:e2}=await db.from('horarios').select('dia_semana,servicio_id,hora_slot,hora_inicio').eq('profesional_id',profesionalId).in('dia_semana',destinos).eq('activo',true);
    if(e2) throw e2;
    const keys=new Set((existentes||[]).map(h=>`${h.dia_semana}|${h.servicio_id}|${normalizarHora(h.hora_slot||h.hora_inicio)}`));
    const inserts=[];
    destinos.forEach(d=>origenes.forEach(h=>{const hi=normalizarHora(h.hora_slot||h.hora_inicio);const k=`${d}|${h.servicio_id}|${hi}`;if(!keys.has(k)){inserts.push({profesional_id:profesionalId,servicio_id:h.servicio_id,dia_semana:d,hora_slot:hi,hora_inicio:hi,hora_fin:h.hora_fin,activo:true});keys.add(k);}}));
    if(!inserts.length) mostrarExito('Los días seleccionados ya tenían esos horarios.');
    else { const {error}=await db.from('horarios').insert(inserts); if(error) throw error; mostrarExito(`Horario copiado a ${destinos.map(d=>dias[d]).join(', ')}.`); }
    document.querySelectorAll('#copiarDiasDestino input').forEach(x=>x.checked=false); modalCopiarHorario?.classList.add('oculto'); await cargarHorarios();
  }catch(e){console.error(e);mostrarError(e?.message||'No fue posible copiar los horarios.');}
  finally{btnCopiarHorario.disabled=false;btnCopiarHorario.textContent='Copiar';}
}

async function cambiarEstadoSlot(dia, hora, nuevoActivo){
  const profesionalId=profesionalHorario.value; if(!profesionalId) return;
  ocultarMensaje();
  const {error}=await db.from('horarios').update({activo:nuevoActivo}).eq('profesional_id',profesionalId).eq('dia_semana',dia).eq('hora_slot',normalizarHora(hora));
  if(error) return mostrarError('No fue posible cambiar el horario.');
  mostrarExito(nuevoActivo?'Horario activado.':'Horario desactivado.'); await cargarHorarios();
}

async function eliminarSlot(dia,hora){
  if(!confirm('¿Eliminar esta hora para todos los servicios del profesional?')) return;
  const profesionalId=profesionalHorario.value;
  const {error}=await db.from('horarios').delete().eq('profesional_id',profesionalId).eq('dia_semana',dia).eq('hora_slot',normalizarHora(hora));
  if(error) return mostrarError('No fue posible eliminar el horario.');
  mostrarExito('Horario eliminado.'); await cargarHorarios();
}

async function cambiarEstadoHorario(
  id,
  nuevoActivo
) {
  ocultarMensaje();

  const { error } =
    await db
      .from("horarios")
      .update({
        activo:
          nuevoActivo
      })
      .eq("id", id);

  if (error) {
    console.error(error);
    mostrarError(
      "No fue posible cambiar el horario."
    );
    return;
  }

  mostrarExito(
    nuevoActivo
      ? "Horario activado."
      : "Horario desactivado."
  );

  await cargarHorarios();
}

async function eliminarHorario(
  id
) {
  const confirmar =
    window.confirm(
      "¿Eliminar este horario?"
    );

  if (!confirmar) return;

  ocultarMensaje();

  const { error } =
    await db
      .from("horarios")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(error);
    mostrarError(
      "No fue posible eliminar el horario."
    );
    return;
  }

  mostrarExito(
    "Horario eliminado."
  );

  await cargarHorarios();
}

function normalizarHora(
  hora
) {
  if (!hora) return "";

  if (
    /^\d{2}:\d{2}$/
      .test(hora)
  ) {
    return `${hora}:00`;
  }

  return hora;
}

function sumarMinutos(
  hora,
  minutos
) {
  const partes =
    String(hora)
      .split(":")
      .map(Number);

  const total =
    (
      (partes[0] || 0) *
      60
    ) +
    (partes[1] || 0) +
    Number(minutos || 0);

  const h =
    Math.floor(
      total / 60
    ) % 24;

  const m =
    total % 60;

  return (
    String(h)
      .padStart(2, "0") +
    ":" +
    String(m)
      .padStart(2, "0") +
    ":00"
  );
}

function cortarHora(
  hora
) {
  if (!hora) return "";

  return String(hora)
    .slice(0, 5);
}

function mostrarError(
  texto
) {
  mensaje.textContent =
    texto;

  mensaje.className =
    "mensaje error";
}

function mostrarExito(
  texto
) {
  mensaje.textContent =
    texto;

  mensaje.className =
    "mensaje exito";
}

function ocultarMensaje() {
  mensaje.textContent = "";

  mensaje.className =
    "mensaje oculto";
}

window.cambiarEstadoHorario =
  cambiarEstadoHorario;

window.eliminarHorario =
  eliminarHorario;

iniciar();

function horaCorta(hora) {
  if (!hora) return "";
  return String(hora).slice(0, 5);
}

function escapar(texto = "") {
  return String(texto)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}
