const { db } = window.AR;
let negocios = [];

const $ = id => document.getElementById(id);

const dias = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo"
};

function msg(texto, error = false) {
  const el = $("saMensaje");
  el.textContent = texto;
  el.className = `mensaje ${error ? "error" : "exito"}`;
  el.classList.remove("oculto");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function clearMsg() {
  $("saMensaje").classList.add("oculto");
}

async function init() {
  const ctx = await AR.contexto();

  if (!ctx) {
    location.href = "panel.html";
    return;
  }

  if (!ctx.superAdmin) {
    location.href = "panel.html";
    return;
  }

  $("saCorreo").textContent = ctx.user.email;
  $("btnCerrar").onclick = AR.cerrarSesion;
  $("btnPanel").onclick = () => location.href = "panel.html";

  document.querySelectorAll("[data-tab]").forEach(
    b => b.onclick = () => abrirTab(b.dataset.tab)
  );

  conectarEventos();

  await cargarNegocios();

  await Promise.all([
    cargarProfesionales(),
    cargarServicios(),
    cargarHorarios(),
    cargarCitas()
  ]);
}

function abrirTab(tab) {
  document
    .querySelectorAll(".sa-section")
    .forEach(s => s.classList.remove("activa"));

  $("tab-" + tab).classList.add("activa");
  clearMsg();
}

function conectarEventos() {
  $("formNegocio").onsubmit = crearNegocio;
  $("formUsuario").onsubmit = crearUsuario;
  $("formProfesional").onsubmit = crearProfesional;
  $("formServicioSA").onsubmit = crearServicio;
  $("formHorarioSA").onsubmit = crearHorario;

  $("profNegocio").onchange = cargarProfesionales;
  $("servNegocio").onchange = cargarServicios;

  $("horNegocio").onchange = async () => {
    await llenarProfesionalesHorario();
    await cargarHorarios();
  };

  $("horProfesional").onchange = llenarServiciosHorario;
  $("citasNegocio").onchange = cargarCitas;
}

async function cargarNegocios() {
  const { data, error } = await db
    .from("negocios")
    .select("id,nombre")
    .order("nombre");

  if (error) {
    msg("No pude cargar los negocios: " + error.message, true);
    return;
  }

  negocios = data || [];

  $("listaNegocios").innerHTML = negocios.length
    ? negocios.map(n => `
        <div class="sa-item">
          <h4>${AR.escape(n.nombre)}</h4>
          <span class="sa-badge">${n.id}</span>
        </div>
      `).join("")
    : '<div class="sin-resultados">Todavía no hay negocios.</div>';

  [
    "usuarioNegocio",
    "profNegocio",
    "servNegocio",
    "horNegocio"
  ].forEach(id => rellenarNegocios($(id)));

  rellenarNegocios($("citasNegocio"), true);
}

function rellenarNegocios(sel, todos = false) {
  const actual = sel.value;

  sel.innerHTML =
    (todos
      ? '<option value="">Todos</option>'
      : '<option value="">Selecciona un negocio</option>') +
    negocios.map(n =>
      `<option value="${n.id}">${AR.escape(n.nombre)}</option>`
    ).join("");

  if ([...sel.options].some(o => o.value === actual)) {
    sel.value = actual;
  } else if (!todos && negocios[0]) {
    sel.value = negocios[0].id;
  }
}

async function crearNegocio(e) {
  e.preventDefault();
  clearMsg();

  const nombre = $("negocioNombre").value.trim();

  const { error } = await db
    .from("negocios")
    .insert({ nombre });

  if (error) {
    msg(error.message, true);
    return;
  }

  e.target.reset();
  msg("Negocio creado correctamente.");
  await cargarNegocios();
}

async function crearUsuario(e) {
  e.preventDefault();
  clearMsg();

  const {
    data: { session }
  } = await db.auth.getSession();

  const payload = {
    negocio_id: $("usuarioNegocio").value,
    rol: $("usuarioRol").value,
    nombre: $("usuarioNombre").value.trim(),
    especialidad: $("usuarioEspecialidad").value.trim(),
    email: $("usuarioCorreo").value.trim(),
    password: $("usuarioPassword").value
  };

  try {
    const r = await fetch("/api/create-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify(payload)
    });

    const out = await r.json();

    if (!r.ok) {
      throw new Error(out.error || "No se pudo crear el usuario");
    }

    e.target.reset();
    rellenarNegocios($("usuarioNegocio"));

    msg(`Acceso creado para ${payload.email}.`);

    await cargarProfesionales();

  } catch (err) {
    msg(err.message, true);
  }
}

async function crearProfesional(e) {
  e.preventDefault();

  const negocio_id = $("profNegocio").value;

  if (!negocio_id) {
    return msg("Selecciona un negocio.", true);
  }

  const { error } = await db
    .from("profesionales")
    .insert({
      negocio_id,
      nombre: $("profNombre").value.trim(),
      especialidad: $("profEspecialidad").value.trim() || null,
      activo: true
    });

  if (error) {
    return msg(error.message, true);
  }

  e.target.reset();
  msg("Profesional creado.");

  await cargarProfesionales();
}

async function cargarProfesionales() {
  const negocio_id =
    $("profNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) return;

  $("profNegocio").value = negocio_id;

  const { data, error } = await db
    .from("profesionales")
    .select("id,nombre,especialidad,activo,usuario_id")
    .eq("negocio_id", negocio_id)
    .order("nombre");

  if (error) {
    return msg(error.message, true);
  }

  $("listaProfesionalesSA").innerHTML =
    (data || []).map(p => `
      <div class="sa-item">
        <h4>${AR.escape(p.nombre)}</h4>

        <div class="sa-muted">
          ${AR.escape(p.especialidad || "Sin especialidad")}
        </div>

        <div class="sa-muted">
          ${p.usuario_id ? "Con acceso" : "Sin acceso"}
          ·
          ${p.activo ? "Activo" : "Inactivo"}
        </div>
      </div>
    `).join("")
    ||
    '<div class="sin-resultados">Sin profesionales.</div>';
}

async function crearServicio(e) {
  e.preventDefault();

  const negocio_id = $("servNegocio").value;

  if (!negocio_id) {
    return msg("Selecciona un negocio.", true);
  }

  const payload = {
    negocio_id,
    nombre: $("servNombre").value.trim(),
    descripcion: $("servDescripcion").value.trim() || null,
    duracion_minutos: Number($("servDuracion").value),
    precio: Number($("servPrecio").value || 0),
    activo: true
  };

  const { error } = await db
    .from("servicios")
    .insert(payload);

  if (error) {
    return msg(error.message, true);
  }

  e.target.reset();
  $("servDuracion").value = 60;

  msg("Servicio creado.");

  await cargarServicios();
}

async function cargarServicios() {
  const negocio_id =
    $("servNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) return;

  $("servNegocio").value = negocio_id;

  const { data, error } = await db
    .from("servicios")
    .select("id,nombre,descripcion,duracion_minutos,precio,activo")
    .eq("negocio_id", negocio_id)
    .order("nombre");

  if (error) {
    return msg(error.message, true);
  }

  $("listaServiciosSA").innerHTML =
    (data || []).map(s => `
      <div class="sa-item">
        <h4>${AR.escape(s.nombre)}</h4>

        <div class="sa-muted">
          ${s.duracion_minutos} min
          ·
          ${AR.dinero(s.precio)}
          ·
          ${s.activo ? "Activo" : "Inactivo"}
        </div>
      </div>
    `).join("")
    ||
    '<div class="sin-resultados">Sin servicios.</div>';
}

async function llenarProfesionalesHorario() {
  const negocio_id =
    $("horNegocio").value ||
    negocios[0]?.id;

  if (!negocio_id) return;

  $("horNegocio").value = negocio_id;

  const { data } = await db
    .from("profesionales")
    .select("id,nombre")
    .eq("negocio_id", negocio_id)
    .eq("activo", true)
    .order("nombre");

  $("horProfesional").innerHTML =
    '<option value="">Selecciona</option>' +
    (data || []).map(p =>
      `<option value="${p.id}">
        ${AR.escape(p.nombre)}
      </option>`
    ).join("");

  $("horServicio").innerHTML =
    '<option value="">Selecciona profesional</option>';
}

async function llenarServiciosHorario() {
  const profesional_id =
    $("horProfesional").value;

  if (!profesional_id) return;

  const { data: asig } = await db
    .from("profesional_servicios")
    .select("servicio_id")
    .eq("profesional_id", profesional_id);

  const ids =
    (asig || []).map(x => x.servicio_id);

  if (!ids.length) {
    $("horServicio").innerHTML =
      '<option value="">Sin servicios asignados</option>';

    return;
  }

  const { data } = await db
    .from("servicios")
    .select("id,nombre")
    .in("id", ids)
    .eq("activo", true);

  $("horServicio").innerHTML =
    '<option value="">Selecciona</option>' +
    (data || []).map(s =>
      `<option value="${s.id}">
        ${AR.escape(s.nombre)}
      </option>`
    ).join("");
}

function sumarMinutos(hora, min) {
  const [h, m] =
    hora.split(":").map(Number);

  const total =
    h * 60 + m + min;

  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}:00`;
}

async function crearHorario(e) {
  e.preventDefault();

  const profesional_id =
    $("horProfesional").value;

  const servicio_id =
    $("horServicio").value;

  const hora =
    $("horHora").value;

  if (!profesional_id || !servicio_id || !hora) {
    return msg(
      "Completa profesional, servicio y hora.",
      true
    );
  }

  const { data: s } = await db
    .from("servicios")
    .select("duracion_minutos")
    .eq("id", servicio_id)
    .single();

  await db
    .from("profesional_servicios")
    .upsert(
      {
        profesional_id,
        servicio_id
      },
      {
        onConflict:
          "profesional_id,servicio_id",
        ignoreDuplicates: true
      }
    );

  const payload = {
    negocio_id: $("horNegocio").value,
    profesional_id,
    servicio_id,
    dia_semana: Number($("horDia").value),
    hora_slot: hora + ":00",
    hora_inicio: hora + ":00",
    hora_fin: sumarMinutos(
      hora,
      Number(s?.duracion_minutos || 60)
    ),
    activo: true
  };

  const { error } = await db
    .from("horarios")
    .insert(payload);

  if (error) {
    return msg(error.message, true);
  }

  msg("Horario agregado.");

  await cargarHorarios();
}

async function cargarHorarios() {
  const negocio_id =
    $("horNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) return;

  $("horNegocio").value = negocio_id;

  await llenarProfesionalesHorario();

  const { data, error } = await db
    .from("horarios")
    .select("id,profesional_id,servicio_id,dia_semana,hora_slot,activo")
    .eq("negocio_id", negocio_id)
    .eq("activo", true)
    .order("dia_semana")
    .order("hora_slot");

  if (error) {
    return msg(error.message, true);
  }

  const [
    { data: ps },
    { data: ss }
  ] = await Promise.all([
    db
      .from("profesionales")
      .select("id,nombre")
      .eq("negocio_id", negocio_id),

    db
      .from("servicios")
      .select("id,nombre")
      .eq("negocio_id", negocio_id)
  ]);

  const pm =
    Object.fromEntries(
      (ps || []).map(x => [x.id, x.nombre])
    );

  const sm =
    Object.fromEntries(
      (ss || []).map(x => [x.id, x.nombre])
    );

  $("listaHorariosSA").innerHTML =
    (data || []).map(h => `
      <div class="sa-item">
        <h4>
          ${dias[h.dia_semana]}
          ·
          ${String(h.hora_slot).slice(0, 5)}
        </h4>

        <div class="sa-muted">
          ${AR.escape(pm[h.profesional_id] || "Profesional")}
          ·
          ${AR.escape(sm[h.servicio_id] || "Servicio")}
        </div>
      </div>
    `).join("")
    ||
    '<div class="sin-resultados">Sin horarios.</div>';
}

async function cargarCitas() {
  const filtro =
    $("citasNegocio")?.value || "";

  let q = db
    .from("citas")
    .select(`
      id,
      negocio_id,
      profesional_id,
      servicio_id,
      paciente_nombre,
      fecha,
      hora_inicio,
      estado
    `)
    .order("fecha", { ascending: false })
    .order("hora_inicio", { ascending: true })
    .limit(300);

  if (filtro) {
    q = q.eq("negocio_id", filtro);
  }

  const { data, error } = await q;

  if (error) {
    return msg(error.message, true);
  }

  const { data: ps } =
    await db
      .from("profesionales")
      .select("id,nombre");

  const { data: ss } =
    await db
      .from("servicios")
      .select("id,nombre");

  const nm =
    Object.fromEntries(
      negocios.map(x => [x.id, x.nombre])
    );

  const pm =
    Object.fromEntries(
      (ps || []).map(x => [x.id, x.nombre])
    );

  const sm =
    Object.fromEntries(
      (ss || []).map(x => [x.id, x.nombre])
    );

  $("tablaCitasSA").innerHTML =
    (data || []).map(c => `
      <tr>
        <td>${c.fecha}</td>
        <td>${String(c.hora_inicio).slice(0, 5)}</td>
        <td>${AR.escape(nm[c.negocio_id] || "")}</td>
        <td>${AR.escape(c.paciente_nombre || "")}</td>
        <td>${AR.escape(sm[c.servicio_id] || "")}</td>
        <td>${AR.escape(pm[c.profesional_id] || "")}</td>
        <td>${AR.escape(c.estado || "")}</td>
      </tr>
    `).join("")
    ||
    '<tr><td colspan="7">Sin citas.</td></tr>';
}

init();
