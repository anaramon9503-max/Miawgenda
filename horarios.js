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
const serviciosHorarioChecks = $("serviciosHorarioChecks");
const diaHorario = $("diaHorario");
const horaSlot = $("horaSlot");
const btnGuardarHorario = $("btnGuardarHorario");
const listaHorarios = $("listaHorarios");
const seccionCopiarHorario = $("seccionCopiarHorario");
const copiarDiaOrigen = $("copiarDiaOrigen");
const btnCopiarHorario = $("btnCopiarHorario");
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
  listaMiHorario.innerHTML = `
    <div class="cargando">
      🐱 Cargando tu horario...
    </div>
  `;

  // Usamos la vista pública de horarios para consulta de solo lectura.
  const { data: horarios, error } =
    await db
      .from("horarios")
      .select(`
        id,
        profesional_id,
        servicio_id,
        dia_semana,
        hora_slot,
        hora_inicio,
        hora_fin,
        activo
      `)
      .eq(
        "profesional_id",
        profesionalActualId
      )
      .eq(
        "activo",
        true
      )
      .order(
        "dia_semana",
        { ascending: true }
      )
      .order(
        "hora_inicio",
        { ascending: true }
      );

  if (error) {
    console.error(
      "Error mi horario:",
      error
    );

    listaMiHorario.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar tu horario.
      </div>
    `;

    // El mensaje se muestra dentro de la tarjeta para evitar duplicarlo.
    return;
  }

  if (!horarios?.length) {
    listaMiHorario.innerHTML = `
      <div class="sin-resultados">
        Aún no tienes horarios asignados.
      </div>
    `;
    return;
  }

  const idsServicios = [
    ...new Set(
      horarios
        .map(h => h.servicio_id)
        .filter(Boolean)
    )
  ];

  let mapaServicios = {};

  if (idsServicios.length) {
    const { data: servicios, error: errorServicios } =
      await db
        .from("servicios")
        .select("id,nombre")
        .in("id", idsServicios);

    if (!errorServicios) {
      mapaServicios =
        Object.fromEntries(
          (servicios || []).map(
            s => [s.id, s.nombre]
          )
        );
    }
  }

  listaMiHorario.innerHTML = "";

  for (const horario of horarios) {
    const inicio =
      horaCorta(
        horario.hora_inicio ||
        horario.hora_slot
      );

    const fin =
      horaCorta(
        horario.hora_fin
      );

    const servicio =
      mapaServicios[
        horario.servicio_id
      ] || "Servicio";

    const card =
      document.createElement("div");

    card.className =
      "horario-card";

    card.innerHTML = `
      <strong>
        ${dias[horario.dia_semana] || "Día"}
        · ${inicio}${fin ? ` - ${fin}` : ""}
      </strong>

      <div class="horario-meta">
        ${escapar(servicio)}
      </div>

      <div class="horario-meta">
        Activo
      </div>
    `;

    listaMiHorario.appendChild(card);
  }
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
  serviciosHorarioChecks.innerHTML = '<span style="font-size:13px;color:#81778a;">Cargando servicios...</span>';
  serviciosAsignados = [];
  if (!profesionalId) {
    serviciosHorarioChecks.innerHTML = '<span style="font-size:13px;color:#81778a;">Primero selecciona un profesional</span>';
    listaHorarios.innerHTML = '<div class="sin-resultados">Selecciona un profesional.</div>';
    return;
  }
  const {data:asignaciones,error:errorAsignaciones}=await db.from("profesional_servicios").select("servicio_id").eq("profesional_id",profesionalId);
  if(errorAsignaciones){mostrarError("No fue posible cargar los servicios del profesional.");return;}
  const ids=(asignaciones||[]).map(x=>x.servicio_id);
  if(!ids.length){serviciosHorarioChecks.innerHTML='<span style="font-size:13px;color:#81778a;">Este profesional no tiene servicios asignados.</span>';await cargarHorarios();return;}
  const {data:servicios,error}=await db.from("servicios").select("id,nombre,duracion_minutos,activo").in("id",ids).eq("negocio_id",negocioActualId).eq("activo",true).order("nombre");
  if(error){mostrarError("No fue posible cargar los servicios.");return;}
  serviciosAsignados=servicios||[];
  serviciosHorarioChecks.innerHTML=serviciosAsignados.map(s=>`<label style="display:flex;align-items:center;gap:9px;margin:0;padding:8px;background:#fff;border-radius:10px;font-size:13px;font-weight:600;"><input class="servicio-horario-check" type="checkbox" value="${s.id}" style="width:auto;"> ${escapar(s.nombre)}</label>`).join('');
  await cargarHorarios();
}

function serviciosSeleccionadosHorario(){
  return [...document.querySelectorAll('.servicio-horario-check:checked')].map(x=>x.value);
}

async function guardarHorario() {
  ocultarMensaje();
  const profesionalId=profesionalHorario.value;
  const servicioIds=serviciosSeleccionadosHorario();
  const dia=Number(diaHorario.value);
  const hora=horaSlot.value;
  if(!profesionalId||!servicioIds.length||!dia||!hora){mostrarError("Selecciona profesional, al menos un servicio, día y hora.");return;}
  btnGuardarHorario.disabled=true; btnGuardarHorario.textContent="Guardando...";
  try{
    const horaInicio=normalizarHora(hora);
    const {data:existentes,error:e0}=await db.from('horarios').select('servicio_id').eq('profesional_id',profesionalId).eq('dia_semana',dia).eq('hora_slot',horaInicio).eq('activo',true).in('servicio_id',servicioIds);
    if(e0) throw e0;
    const ya=new Set((existentes||[]).map(x=>x.servicio_id));
    const inserts=[];
    for(const servicioId of servicioIds){
      if(ya.has(servicioId)) continue;
      const servicio=serviciosAsignados.find(s=>s.id===servicioId);
      const duracion=Number(servicio?.duracion_minutos)||60;
      inserts.push({profesional_id:profesionalId,servicio_id:servicioId,dia_semana:dia,hora_slot:horaInicio,hora_inicio:horaInicio,hora_fin:sumarMinutos(horaInicio,duracion),activo:true});
    }
    if(!inserts.length){mostrarError("Ese horario ya existe para los servicios seleccionados.");return;}
    const {error}=await db.from('horarios').insert(inserts); if(error) throw error;
    mostrarExito(`Horario agregado a ${inserts.length} servicio${inserts.length===1?'':'s'}.`); horaSlot.value=''; await cargarHorarios();
  }catch(error){console.error(error);mostrarError(error?.message||"No fue posible guardar el horario.");}
  finally{btnGuardarHorario.disabled=false;btnGuardarHorario.textContent="+ Agregar horario";}
}

async function cargarHorarios() {
  const profesionalId=profesionalHorario.value;
  if(!profesionalId){listaHorarios.innerHTML='<div class="sin-resultados">Selecciona un profesional.</div>';return;}
  listaHorarios.innerHTML='<div class="cargando">Cargando horarios...</div>';
  const {data,error}=await db.from('horarios').select('id,profesional_id,servicio_id,dia_semana,hora_slot,hora_inicio,hora_fin,activo').eq('profesional_id',profesionalId).order('dia_semana').order('hora_inicio');
  if(error){mostrarError('No fue posible cargar los horarios.');return;}
  renderHorarios(data||[]);
}
function renderHorarios(horarios){
  if(!horarios.length){listaHorarios.innerHTML='<div class="sin-resultados">No hay horarios asignados.</div>';return;}
  const mapa=Object.fromEntries(serviciosAsignados.map(s=>[s.id,s.nombre])); const grupos={};
  horarios.forEach(h=>{const key=`${h.dia_semana}|${cortarHora(h.hora_inicio||h.hora_slot)}`;(grupos[key] ||= {dia:h.dia_semana,hora:cortarHora(h.hora_inicio||h.hora_slot),items:[]}).items.push(h);});
  const porDia={}; Object.values(grupos).forEach(g=>(porDia[g.dia] ||= []).push(g));
  listaHorarios.innerHTML=Object.keys(porDia).sort((a,b)=>a-b).map(d=>`<details class="horario-card" style="padding:0;overflow:hidden"><summary style="cursor:pointer;padding:14px;font-weight:800;color:#493d52;display:flex;justify-content:space-between"><span>${dias[d]}</span><span style="font-size:12px;color:#81778a">${porDia[d].length} hora${porDia[d].length===1?'':'s'} ▾</span></summary><div style="padding:0 14px 14px">${porDia[d].sort((a,b)=>a.hora.localeCompare(b.hora)).map(g=>`<div style="padding:10px 0;border-top:1px solid #eee8f2"><strong>${g.hora}</strong><div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:6px">${g.items.map(h=>`<span style="background:#f3eef9;padding:5px 8px;border-radius:999px;font-size:11px">${escapar(mapa[h.servicio_id]||'Servicio')} <button onclick="eliminarHorario('${h.id}')" style="border:0;background:transparent">×</button></span>`).join('')}</div></div>`).join('')}</div></details>`).join('');
}

async function copiarHorario(){
  ocultarMensaje(); const profesionalId=profesionalHorario.value; const origen=Number(copiarDiaOrigen?.value); const destinos=[...document.querySelectorAll('#copiarDiasDestino input:checked')].map(x=>Number(x.value)).filter(x=>x!==origen);
  if(!profesionalId)return mostrarError('Selecciona primero un profesional.'); if(!destinos.length)return mostrarError('Selecciona al menos un día destino diferente al origen.');
  btnCopiarHorario.disabled=true;btnCopiarHorario.textContent='Copiando...';
  try{const {data:origenes,error:e1}=await db.from('horarios').select('servicio_id,hora_slot,hora_inicio,hora_fin').eq('profesional_id',profesionalId).eq('dia_semana',origen).eq('activo',true);if(e1)throw e1;if(!origenes?.length)return mostrarError(`No hay horarios activos en ${dias[origen]}.`);
  const {data:existentes,error:e2}=await db.from('horarios').select('dia_semana,servicio_id,hora_slot,hora_inicio').eq('profesional_id',profesionalId).in('dia_semana',destinos).eq('activo',true);if(e2)throw e2;
  const keys=new Set((existentes||[]).map(h=>`${h.dia_semana}|${h.servicio_id}|${normalizarHora(h.hora_slot||h.hora_inicio)}`));const inserts=[];destinos.forEach(d=>origenes.forEach(h=>{const hi=normalizarHora(h.hora_slot||h.hora_inicio),k=`${d}|${h.servicio_id}|${hi}`;if(!keys.has(k)){inserts.push({profesional_id:profesionalId,servicio_id:h.servicio_id,dia_semana:d,hora_slot:hi,hora_inicio:hi,hora_fin:h.hora_fin,activo:true});keys.add(k);}}));
  if(!inserts.length)return mostrarExito('Los días seleccionados ya tenían esos horarios.');const {error}=await db.from('horarios').insert(inserts);if(error)throw error;mostrarExito(`Se copiaron ${inserts.length} horarios correctamente.`);document.querySelectorAll('#copiarDiasDestino input').forEach(x=>x.checked=false);await cargarHorarios();}
  catch(e){mostrarError(e?.message||'No fue posible copiar los horarios.');}finally{btnCopiarHorario.disabled=false;btnCopiarHorario.textContent='📋 Copiar horario';}
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
