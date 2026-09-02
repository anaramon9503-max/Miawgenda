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

  // Si el botón todavía existe, funciona.
  // Si ya lo quitaste del HTML, no rompe la página.
  if ($("btnPanel")) {
    $("btnPanel").onclick = () => location.href = "panel.html";
  }

  document.querySelectorAll("[data-tab]").forEach(
    b => b.onclick = () => abrirTab(b.dataset.tab)
  );

  conectarEventos();

  await cargarNegocios();

  await Promise.all([
    cargarUsuarios(),
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

  const seccion = $("tab-" + tab);

  if (seccion) {
    seccion.classList.add("activa");
  }

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
  if ($("citasEstado")) $("citasEstado").onchange = cargarCitas;
  if ($("citasFecha")) $("citasFecha").onchange = cargarCitas;
  if ($("citasBuscar")) $("citasBuscar").oninput = () => { clearTimeout(window.__citasTimer); window.__citasTimer=setTimeout(cargarCitas,220); };
  if ($("citasLimpiar")) $("citasLimpiar").onclick = () => { $("citasBuscar").value=""; $("citasEstado").value=""; $("citasFecha").value=""; $("citasNegocio").value=""; cargarCitas(); };
}


/* =========================================================
   NEGOCIOS
========================================================= */

async function cargarNegocios() {
  const { data, error } = await db
    .from("negocios")
    .select("id,nombre,activo")
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
          <span class="sa-badge">${n.activo ? "Activo" : "Inactivo"}</span>
          <div class="sa-actions">
            <button type="button" onclick="editarNegocio('${n.id}')">✏️ Editar</button>
            <button type="button" onclick="copiarAgendaPublica('${n.id}')">🔗 Copiar agenda</button>
            <button type="button" onclick="toggleNegocio('${n.id}', ${!!n.activo})">${n.activo ? "⏸️ Desactivar" : "▶️ Activar"}</button>
            <button type="button" onclick="eliminarNegocio('${n.id}')">🗑️ Eliminar</button>
          </div>
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

  if (negocios[0]) {
    await llenarProfesionalesHorario();
  }
}

async function copiarAgendaPublica(negocioId) {
  const url = new URL("/", window.location.origin);
  url.searchParams.set("negocio", negocioId);
  const liga = url.toString();

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(liga);
    } else {
      const area = document.createElement("textarea");
      area.value = liga;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }

    msg("Liga de agenda pública copiada ✓");
  } catch (error) {
    window.prompt("Copia esta liga de agenda pública:", liga);
  }
}


function rellenarNegocios(sel, todos = false) {
  if (!sel) return;

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


/* =========================================================
   CREAR NEGOCIO
========================================================= */

async function crearNegocio(e) {
  e.preventDefault();
  clearMsg();

  const nombre = $("negocioNombre").value.trim();

  if (!nombre) {
    return msg("Escribe el nombre del negocio.", true);
  }

  const { error } = await db
    .from("negocios")
    .insert({
      nombre,
      activo: true
    });

  if (error) {
    msg(error.message, true);
    return;
  }

  e.target.reset();
  msg("Negocio creado correctamente.");

  await cargarNegocios();

  await Promise.all([
    cargarProfesionales(),
    cargarServicios(),
    cargarHorarios(),
    cargarCitas()
  ]);
}


/* =========================================================
   CREAR USUARIO
========================================================= */

async function crearUsuario(e) {
  e.preventDefault();
  clearMsg();

  const {
    data: { session }
  } = await db.auth.getSession();

  if (!session) {
    return msg(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
      true
    );
  }

  const payload = {
    negocio_id: $("usuarioNegocio").value,
    rol: $("usuarioRol").value,
    nombre: $("usuarioNombre").value.trim(),
    especialidad: $("usuarioEspecialidad").value.trim(),
    email: $("usuarioCorreo").value.trim(),
    password: $("usuarioPassword").value
  };

  if (!payload.negocio_id) {
    return msg("Selecciona un negocio.", true);
  }

  if (!payload.rol) {
    return msg("Selecciona un rol.", true);
  }

  if (!payload.email || !payload.password) {
    return msg(
      "Correo y contraseña son obligatorios.",
      true
    );
  }

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
      throw new Error(
        out.error || "No se pudo crear el usuario"
      );
    }

    e.target.reset();

    rellenarNegocios(
      $("usuarioNegocio")
    );

    msg(
      `Acceso creado para ${payload.email}.`
    );

    await cargarProfesionales();

  } catch (err) {
    msg(err.message, true);
  }
}


/* =========================================================
   PROFESIONALES
========================================================= */

async function crearProfesional(e) {
  e.preventDefault();

  const negocio_id =
    $("profNegocio").value;

  if (!negocio_id) {
    return msg(
      "Selecciona un negocio.",
      true
    );
  }

  const nombre =
    $("profNombre").value.trim();

  if (!nombre) {
    return msg(
      "Escribe el nombre del profesional.",
      true
    );
  }

  const { error } = await db
    .from("profesionales")
    .insert({
      negocio_id,
      nombre,
      especialidad:
        $("profEspecialidad").value.trim() || null,
      activo: true
    });

  if (error) {
    return msg(error.message, true);
  }

  e.target.reset();

  rellenarNegocios(
    $("profNegocio")
  );

  msg("Profesional creado.");

  await cargarProfesionales();
}

async function cargarProfesionales() {
  const negocio_id =
    $("profNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) {
    if ($("listaProfesionalesSA")) {
      $("listaProfesionalesSA").innerHTML =
        '<div class="sin-resultados">Todavía no hay negocios.</div>';
    }

    return;
  }

  $("profNegocio").value =
    negocio_id;

  const { data, error } = await db
    .from("profesionales")
    .select(
      "id,nombre,especialidad,activo,usuario_id"
    )
    .eq("negocio_id", negocio_id)
    .order("nombre");

  if (error) {
    return msg(error.message, true);
  }

  $("listaProfesionalesSA").innerHTML =
    (data || []).map(p => `
      <div class="sa-item">

        <h4>
          ${AR.escape(p.nombre)}
        </h4>

        <div class="sa-muted">
          ${AR.escape(
            p.especialidad ||
            "Sin especialidad"
          )}
        </div>

        <div class="sa-muted">
          ${
            p.usuario_id
              ? "Con acceso"
              : "Sin acceso"
          }
          ·
          ${
            p.activo
              ? "Activo"
              : "Inactivo"
          }
        </div>
        <div class="sa-actions">
          <button type="button" onclick="editarProfesional('${p.id}')">✏️ Editar</button>
          <button type="button" onclick="toggleProfesional('${p.id}', ${!!p.activo})">${p.activo ? "⏸️ Desactivar" : "▶️ Activar"}</button>
          <button type="button" onclick="eliminarProfesional('${p.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `).join("")
    ||
    '<div class="sin-resultados">Sin profesionales.</div>';
}


/* =========================================================
   SERVICIOS
========================================================= */

async function crearServicio(e) {
  e.preventDefault();

  const negocio_id =
    $("servNegocio").value;

  if (!negocio_id) {
    return msg(
      "Selecciona un negocio.",
      true
    );
  }

  const nombre =
    $("servNombre").value.trim();

  if (!nombre) {
    return msg(
      "Escribe el nombre del servicio.",
      true
    );
  }

  const duracion =
    Number(
      $("servDuracion").value
    );

  if (!duracion || duracion <= 0) {
    return msg(
      "La duración debe ser mayor a 0.",
      true
    );
  }

  const payload = {
    negocio_id,
    nombre,
    descripcion:
      $("servDescripcion").value.trim() ||
      null,
    duracion_minutos: duracion,
    precio:
      Number(
        $("servPrecio").value || 0
      ),
    activo: true
  };

  const { error } = await db
    .from("servicios")
    .insert(payload);

  if (error) {
    return msg(error.message, true);
  }

  e.target.reset();

  rellenarNegocios(
    $("servNegocio")
  );

  $("servDuracion").value =
    60;

  msg("Servicio creado.");

  await cargarServicios();
}

async function cargarServicios() {
  const negocio_id =
    $("servNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) {
    if ($("listaServiciosSA")) {
      $("listaServiciosSA").innerHTML =
        '<div class="sin-resultados">Todavía no hay negocios.</div>';
    }

    return;
  }

  $("servNegocio").value =
    negocio_id;

  const { data, error } = await db
    .from("servicios")
    .select(
      "id,nombre,descripcion,duracion_minutos,precio,activo"
    )
    .eq(
      "negocio_id",
      negocio_id
    )
    .order("nombre");

  if (error) {
    return msg(
      error.message,
      true
    );
  }

  $("listaServiciosSA").innerHTML =
    (data || []).map(s => `
      <div class="sa-item">

        <h4>
          ${AR.escape(s.nombre)}
        </h4>

        <div class="sa-muted">
          ${s.duracion_minutos} min
          ·
          ${AR.dinero(s.precio)}
          ·
          ${
            s.activo
              ? "Activo"
              : "Inactivo"
          }
        </div>
        <div class="sa-actions">
          <button type="button" onclick="editarServicio('${s.id}')">✏️ Editar</button>
          <button type="button" onclick="toggleServicio('${s.id}', ${!!s.activo})">${s.activo ? "⏸️ Desactivar" : "▶️ Activar"}</button>
          <button type="button" onclick="eliminarServicio('${s.id}')">🗑️ Eliminar</button>
        </div>
      </div>
    `).join("")
    ||
    '<div class="sin-resultados">Sin servicios.</div>';
}


/* =========================================================
   SELECT DE PROFESIONALES PARA HORARIOS
========================================================= */

async function llenarProfesionalesHorario() {
  const negocio_id =
    $("horNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) {

    $("horProfesional").innerHTML =
      '<option value="">Sin negocios</option>';

    $("horServicio").innerHTML =
      '<option value="">Sin servicios</option>';

    return;
  }

  $("horNegocio").value =
    negocio_id;

  const { data, error } = await db
    .from("profesionales")
    .select("id,nombre")
    .eq(
      "negocio_id",
      negocio_id
    )
    .eq(
      "activo",
      true
    )
    .order("nombre");

  if (error) {
    return msg(
      error.message,
      true
    );
  }

  $("horProfesional").innerHTML =
    '<option value="">Selecciona</option>' +
    (data || []).map(p =>
      `
        <option value="${p.id}">
          ${AR.escape(p.nombre)}
        </option>
      `
    ).join("");

  $("horServicio").innerHTML =
    '<option value="">Selecciona profesional</option>';
}


/* =========================================================
   SELECT DE SERVICIOS PARA HORARIOS
========================================================= */

async function llenarServiciosHorario() {

  const profesional_id =
    $("horProfesional").value;

  if (!profesional_id) {

    $("horServicio").innerHTML =
      '<option value="">Selecciona profesional</option>';

    return;
  }

  const negocio_id =
    $("horNegocio").value;

  const { data, error } = await db
    .from("servicios")
    .select("id,nombre")
    .eq(
      "negocio_id",
      negocio_id
    )
    .eq(
      "activo",
      true
    )
    .order("nombre");

  if (error) {
    return msg(
      error.message,
      true
    );
  }

  $("horServicio").innerHTML =
    '<option value="">Selecciona</option>' +
    (data || []).map(s =>
      `
        <option value="${s.id}">
          ${AR.escape(s.nombre)}
        </option>
      `
    ).join("");
}


/* =========================================================
   SUMAR MINUTOS
========================================================= */

function sumarMinutos(
  hora,
  min
) {

  const [h, m] =
    hora
      .split(":")
      .map(Number);

  const total =
    h * 60 +
    m +
    min;

  return `${String(
    Math.floor(total / 60) % 24
  ).padStart(2, "0")}:${String(
    total % 60
  ).padStart(2, "0")}:00`;
}


/* =========================================================
   CREAR HORARIO
========================================================= */

async function crearHorario(e) {

  e.preventDefault();

  const profesional_id =
    $("horProfesional").value;

  const servicio_id =
    $("horServicio").value;

  const hora =
    $("horHora").value;

  if (
    !profesional_id ||
    !servicio_id ||
    !hora
  ) {

    return msg(
      "Completa profesional, servicio y hora.",
      true
    );
  }

  const {
    data: servicio,
    error: servicioError
  } = await db
    .from("servicios")
    .select(
      "duracion_minutos"
    )
    .eq(
      "id",
      servicio_id
    )
    .single();

  if (servicioError) {

    return msg(
      servicioError.message,
      true
    );
  }

  const {
    error: asignacionError
  } = await db
    .from(
      "profesional_servicios"
    )
    .upsert(
      {
        profesional_id,
        servicio_id
      },
      {
        onConflict:
          "profesional_id,servicio_id",

        ignoreDuplicates:
          true
      }
    );

  if (asignacionError) {

    return msg(
      asignacionError.message,
      true
    );
  }

  const payload = {

    profesional_id,

    servicio_id,

    dia_semana:
      Number(
        $("horDia").value
      ),

    hora_slot:
      hora + ":00",

    hora_inicio:
      hora + ":00",

    hora_fin:
      sumarMinutos(
        hora,
        Number(
          servicio?.duracion_minutos ||
          60
        )
      ),

    activo:
      true
  };

  const { error } = await db
    .from("horarios")
    .insert(payload);

  if (error) {

    return msg(
      error.message,
      true
    );
  }

  msg(
    "Horario agregado."
  );

  $("horHora").value =
    "";

  await cargarHorarios();
}


/* =========================================================
   ICONOS DE MODALIDAD
========================================================= */

function iconoServicio(nombre) {

  const texto =
    String(nombre || "")
      .toLowerCase();

  if (
    texto.includes("línea") ||
    texto.includes("linea") ||
    texto.includes("online")
  ) {
    return "💻";
  }

  if (
    texto.includes("presencial")
  ) {
    return "🏢";
  }

  return "•";
}


/* =========================================================
   HORARIOS AGRUPADOS
   DÍA → PROFESIONAL → HORA → SERVICIOS
========================================================= */

async function cargarHorarios() {

  const negocio_id =
    $("horNegocio")?.value ||
    negocios[0]?.id;

  if (!negocio_id) {

    if ($("listaHorariosSA")) {

      $("listaHorariosSA").innerHTML =
        '<div class="sin-resultados">Todavía no hay negocios.</div>';
    }

    return;
  }

  $("horNegocio").value =
    negocio_id;


  /* Buscar profesionales del negocio */

  const {
    data: profesionalesNegocio,
    error: profError
  } = await db
    .from("profesionales")
    .select("id,nombre")
    .eq(
      "negocio_id",
      negocio_id
    );

  if (profError) {

    return msg(
      profError.message,
      true
    );
  }

  const profesionales =
    profesionalesNegocio || [];

  const idsProfesionales =
    profesionales.map(
      p => p.id
    );


  if (!idsProfesionales.length) {

    $("listaHorariosSA").innerHTML =
      '<div class="sin-resultados">Sin profesionales.</div>';

    return;
  }


  /* Buscar horarios */

  const {
    data: horarios,
    error: horariosError
  } = await db
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
    .in(
      "profesional_id",
      idsProfesionales
    )
    .order(
      "dia_semana"
    )
    .order(
      "hora_slot"
    );

  if (horariosError) {

    return msg(
      horariosError.message,
      true
    );
  }


  /* Buscar servicios */

  const {
    data: servicios,
    error: serviciosError
  } = await db
    .from("servicios")
    .select(
      "id,nombre"
    )
    .eq(
      "negocio_id",
      negocio_id
    );

  if (serviciosError) {

    return msg(
      serviciosError.message,
      true
    );
  }


  const mapaProfesionales =
    Object.fromEntries(
      profesionales.map(
        p => [
          p.id,
          p.nombre
        ]
      )
    );


  const mapaServicios =
    Object.fromEntries(
      (servicios || []).map(
        s => [
          s.id,
          s.nombre
        ]
      )
    );


  /*
    Agrupación:

    Lunes
      Laura
        10:00
          Presencial
          En línea
        11:00
          En línea
  */

  const agrupados = {};


  (horarios || []).forEach(h => {

    const dia =
      Number(
        h.dia_semana
      );

    const profesional_id =
      h.profesional_id;

    const hora =
      String(
        h.hora_slot ||
        h.hora_inicio ||
        ""
      ).slice(
        0,
        5
      );


    if (!agrupados[dia]) {
      agrupados[dia] = {};
    }


    if (
      !agrupados[dia][profesional_id]
    ) {

      agrupados[dia][profesional_id] = {};
    }


    if (
      !agrupados[dia]
        [profesional_id]
        [hora]
    ) {

      agrupados[dia]
        [profesional_id]
        [hora] = {

          hora,
          servicios: []

        };
    }


    const nombreServicio =
      mapaServicios[
        h.servicio_id
      ] ||
      "Servicio";


    const yaExiste =
      agrupados[dia]
        [profesional_id]
        [hora]
        .servicios
        .some(
          servicio =>
            servicio.id ===
            h.servicio_id
        );


    if (!yaExiste) {

      agrupados[dia]
        [profesional_id]
        [hora]
        .servicios
        .push({

          id:
            h.servicio_id,

          horario_id:
            h.id,

          nombre:
            nombreServicio,
          activo: !!h.activo

        });
    }
  });


  /* Crear las tarjetas */

  let html = "";


  for (
    let dia = 1;
    dia <= 7;
    dia++
  ) {

    const profesionalesDia =
      agrupados[dia];


    if (!profesionalesDia) {
      continue;
    }


    html += `

      <div style="
        background:#ffffff;
        border:1px solid #e5e0eb;
        border-radius:16px;
        padding:14px;
        margin-bottom:12px;
      ">

        <div style="
          font-size:15px;
          font-weight:800;
          color:#7255a8;
          margin-bottom:12px;
          text-transform:uppercase;
        ">
          ${dias[dia]}
        </div>

    `;


    Object.keys(
      profesionalesDia
    ).forEach(
      profesional_id => {

        const nombreProfesional =
          mapaProfesionales[
            profesional_id
          ] ||
          "Profesional";


        html += `

          <div style="
            margin-bottom:12px;
          ">

            <div style="
              font-weight:700;
              font-size:14px;
              margin-bottom:7px;
            ">
              ${AR.escape(
                nombreProfesional
              )}
            </div>

        `;


        const horas =
          Object.values(
            profesionalesDia[
              profesional_id
            ]
          )
          .sort(
            (a, b) =>
              a.hora.localeCompare(
                b.hora
              )
          );


        horas.forEach(slot => {

          const serviciosHTML =
            slot.servicios
              .map(servicio => `

                <span style="
                  display:inline-flex;
                  align-items:center;
                  gap:4px;
                  background:#f3eef9;
                  color:#654a99;
                  padding:4px 8px;
                  border-radius:999px;
                  font-size:11px;
                  font-weight:600;
                ">

                  ${
                    iconoServicio(
                      servicio.nombre
                    )
                  }

                  ${AR.escape(servicio.nombre)} ${servicio.activo ? "" : "(inactivo)"}
                  <button type="button" title="Editar horario" onclick="editarHorarioSA('${servicio.horario_id}')" style="border:0;background:transparent;cursor:pointer;padding:0 0 0 3px;color:inherit;">✏️</button>
                  <button type="button" title="${servicio.activo ? "Desactivar" : "Activar"}" onclick="toggleHorario('${servicio.horario_id}', ${!!servicio.activo})" style="border:0;background:transparent;cursor:pointer;padding:0;color:inherit;">${servicio.activo ? "⏸" : "▶"}</button>
                  <button type="button" title="Eliminar horario" onclick="eliminarHorarioSA('${servicio.horario_id}')" style="border:0;background:transparent;cursor:pointer;padding:0;color:inherit;">×</button>
                </span>

              `)
              .join("");


          html += `

            <div style="
              display:flex;
              align-items:center;
              gap:8px;
              padding:7px 0;
              border-bottom:1px solid #f1edf4;
              flex-wrap:wrap;
            ">

              <div style="
                min-width:48px;
                font-weight:800;
                font-size:13px;
              ">
                ${slot.hora}
              </div>

              <div style="
                display:flex;
                gap:5px;
                flex-wrap:wrap;
              ">
                ${serviciosHTML}
              </div>

            </div>

          `;

        });


        html += `
          </div>
        `;

      }
    );


    html += `
      </div>
    `;
  }


  $("listaHorariosSA").innerHTML =
    html ||
    '<div class="sin-resultados">Sin horarios.</div>';
}


/* =========================================================
   CITAS
========================================================= */

async function cargarCitas() {
  const filtro = $("citasNegocio")?.value || "";
  const estadoFiltro = $("citasEstado")?.value || "";
  const fechaFiltro = $("citasFecha")?.value || "";
  const buscar = ($("citasBuscar")?.value || "").trim().toLowerCase();

  let q = db.from("citas").select(`
    id,negocio_id,profesional_id,servicio_id,paciente_nombre,paciente_telefono,paciente_email,
    fecha,hora_inicio,hora_fin,estado
  `).order("fecha",{ascending:false}).order("hora_inicio",{ascending:true}).limit(500);
  if (filtro) q=q.eq("negocio_id",filtro);
  if (estadoFiltro) q=q.eq("estado",estadoFiltro);
  if (fechaFiltro) q=q.eq("fecha",fechaFiltro);

  const {data,error}=await q;
  if(error) return msg(error.message,true);
  const [{data:ps,error:psError},{data:ss,error:ssError}]=await Promise.all([
    db.from("profesionales").select("id,nombre"), db.from("servicios").select("id,nombre")
  ]);
  if(psError)return msg(psError.message,true); if(ssError)return msg(ssError.message,true);
  const nm=Object.fromEntries(negocios.map(x=>[x.id,x.nombre]));
  const pm=Object.fromEntries((ps||[]).map(x=>[x.id,x.nombre]));
  const sm=Object.fromEntries((ss||[]).map(x=>[x.id,x.nombre]));
  const citas=(data||[]).filter(c=>!buscar || [c.paciente_nombre,c.paciente_telefono,c.paciente_email,nm[c.negocio_id],pm[c.profesional_id],sm[c.servicio_id]].some(v=>String(v||"").toLowerCase().includes(buscar)));

  const total=citas.length, pendientes=citas.filter(c=>c.estado==="pendiente").length, confirmadas=citas.filter(c=>c.estado==="confirmada").length, atendidas=citas.filter(c=>c.estado==="atendida").length;
  if($("citasResumen")) $("citasResumen").innerHTML=`<div class="sa-stat"><strong>${total}</strong><span>Citas mostradas</span></div><div class="sa-stat"><strong>${pendientes}</strong><span>Pendientes</span></div><div class="sa-stat"><strong>${confirmadas}</strong><span>Confirmadas</span></div><div class="sa-stat"><strong>${atendidas}</strong><span>Atendidas</span></div>`;

  const estadoTxt=e=>({no_asistio:"No asistió"}[e]||e||"Pendiente");
  const fechaBonita=f=>{if(!f)return ""; const [y,m,d]=f.split("-"); return `${d}/${m}/${y}`;};
  const acciones=c=>`<div class="sa-actions"><button type="button" onclick="editarCitaSA('${c.id}')">✏️ Editar</button><button type="button" onclick="eliminarCitaSA('${c.id}')">🗑️ Eliminar</button></div>`;

  $("tablaCitasSA").innerHTML=citas.map(c=>`<tr>
    <td><strong>${fechaBonita(c.fecha)}</strong></td><td>${String(c.hora_inicio||"").slice(0,5)}${c.hora_fin?`<div class="sa-cita-sub">a ${String(c.hora_fin).slice(0,5)}</div>`:""}</td>
    <td>${AR.escape(nm[c.negocio_id]||"")}</td><td><div class="sa-cita-paciente">${AR.escape(c.paciente_nombre||"")}</div><div class="sa-cita-sub">${AR.escape(c.paciente_telefono||c.paciente_email||"")}</div></td>
    <td>${AR.escape(sm[c.servicio_id]||"")}</td><td>${AR.escape(pm[c.profesional_id]||"")}</td><td><span class="sa-estado ${AR.escape(c.estado||"pendiente")}">${AR.escape(estadoTxt(c.estado))}</span></td><td>${acciones(c)}</td></tr>`).join("")||'<tr><td colspan="8">Sin citas con estos filtros.</td></tr>';

  if($("citasCardsSA")) $("citasCardsSA").innerHTML=citas.map(c=>`<div class="sa-cita-card"><div class="sa-cita-card-top"><div><div class="sa-cita-fecha">${fechaBonita(c.fecha)}</div><div class="sa-cita-hora">${String(c.hora_inicio||"").slice(0,5)}</div></div><span class="sa-estado ${AR.escape(c.estado||"pendiente")}">${AR.escape(estadoTxt(c.estado))}</span></div><div class="sa-cita-paciente" style="margin-top:10px;font-size:16px">${AR.escape(c.paciente_nombre||"")}</div><div class="sa-cita-sub">${AR.escape(c.paciente_telefono||"")}${c.paciente_email?` · ${AR.escape(c.paciente_email)}`:""}</div><div class="sa-cita-grid"><div class="sa-cita-dato"><small>Negocio</small><div>${AR.escape(nm[c.negocio_id]||"")}</div></div><div class="sa-cita-dato"><small>Profesional</small><div>${AR.escape(pm[c.profesional_id]||"")}</div></div><div class="sa-cita-dato"><small>Servicio</small><div>${AR.escape(sm[c.servicio_id]||"")}</div></div><div class="sa-cita-dato"><small>Horario</small><div>${String(c.hora_inicio||"").slice(0,5)}${c.hora_fin?` - ${String(c.hora_fin).slice(0,5)}`:""}</div></div></div>${acciones(c)}</div>`).join("")||'<div class="sin-resultados">Sin citas con estos filtros.</div>';
}


/* =========================================================
   CRUD SÚPER ADMIN
========================================================= */
async function editarNegocio(id) {
  const actual=negocios.find(n=>n.id===id); const nombre=prompt("Nombre del negocio:",actual?.nombre||""); if(!nombre?.trim())return;
  const {error}=await db.from("negocios").update({nombre:nombre.trim()}).eq("id",id); if(error)return msg(error.message,true); msg("Negocio actualizado."); await cargarNegocios(); await cargarUsuarios();
}
async function toggleNegocio(id,activo){const {error}=await db.from("negocios").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Negocio desactivado.":"Negocio activado.");await cargarNegocios();}
async function eliminarNegocio(id){if(!confirm("¿Eliminar este negocio? También puede afectar sus datos relacionados."))return;const {error}=await db.from("negocios").delete().eq("id",id);if(error)return msg("No se pudo eliminar: "+error.message,true);msg("Negocio eliminado.");await cargarNegocios();}
async function editarProfesional(id){const {data:p,error:e}=await db.from("profesionales").select("nombre,especialidad").eq("id",id).single();if(e)return msg(e.message,true);const nombre=prompt("Nombre:",p.nombre||"");if(!nombre?.trim())return;const especialidad=prompt("Especialidad:",p.especialidad||"");const {error}=await db.from("profesionales").update({nombre:nombre.trim(),especialidad:especialidad?.trim()||null}).eq("id",id);if(error)return msg(error.message,true);msg("Profesional actualizado.");await cargarProfesionales();}
async function toggleProfesional(id,activo){const {error}=await db.from("profesionales").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Profesional desactivado.":"Profesional activado.");await Promise.all([cargarProfesionales(),llenarProfesionalesHorario()]);}
async function eliminarProfesional(id){if(!confirm("¿Eliminar este profesional?"))return;const {error}=await db.from("profesionales").delete().eq("id",id);if(error)return msg(error.message,true);msg("Profesional eliminado.");await cargarProfesionales();}
async function editarServicio(id){const {data:s,error:e}=await db.from("servicios").select("nombre,descripcion,duracion_minutos,precio").eq("id",id).single();if(e)return msg(e.message,true);const nombre=prompt("Nombre:",s.nombre||"");if(!nombre?.trim())return;const descripcion=prompt("Descripción:",s.descripcion||"");const dur=Number(prompt("Duración en minutos:",s.duracion_minutos||60));if(!dur)return;const precio=prompt("Precio:",s.precio??"");const {error}=await db.from("servicios").update({nombre:nombre.trim(),descripcion:descripcion?.trim()||null,duracion_minutos:dur,precio:precio===""?null:Number(precio)}).eq("id",id);if(error)return msg(error.message,true);msg("Servicio actualizado.");await cargarServicios();}
async function toggleServicio(id,activo){const {error}=await db.from("servicios").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Servicio desactivado.":"Servicio activado.");await Promise.all([cargarServicios(),llenarServiciosHorario()]);}
async function eliminarServicio(id){if(!confirm("¿Eliminar este servicio?"))return;const {error}=await db.from("servicios").delete().eq("id",id);if(error)return msg(error.message,true);msg("Servicio eliminado.");await cargarServicios();}
async function editarHorarioSA(id){const {data:h,error:e}=await db.from("horarios").select("dia_semana,hora_inicio,hora_slot,servicio_id").eq("id",id).single();if(e)return msg(e.message,true);const dia=Number(prompt("Día (1=Lunes ... 7=Domingo):",h.dia_semana));if(!(dia>=1&&dia<=7))return msg("Día no válido.",true);const hora=prompt("Hora (HH:MM):",String(h.hora_slot||h.hora_inicio||"").slice(0,5));if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(hora||""))return msg("Hora no válida.",true);const {data:sv,error:se}=await db.from("servicios").select("duracion_minutos").eq("id",h.servicio_id).single();if(se)return msg(se.message,true);const {error}=await db.from("horarios").update({dia_semana:dia,hora_slot:hora+":00",hora_inicio:hora+":00",hora_fin:sumarMinutos(hora,Number(sv?.duracion_minutos||60))}).eq("id",id);if(error)return msg(error.message,true);msg("Horario actualizado.");await cargarHorarios();}
async function toggleHorario(id,activo){const {error}=await db.from("horarios").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Horario desactivado.":"Horario activado.");await cargarHorarios();}
async function editarCitaSA(id){const {data:c,error:e}=await db.from("citas").select("paciente_nombre,paciente_telefono,paciente_email,fecha,hora_inicio,hora_fin,estado,servicio_id").eq("id",id).single();if(e)return msg(e.message,true);const paciente=prompt("Paciente:",c.paciente_nombre||"");if(!paciente?.trim())return;const telefono=prompt("Teléfono:",c.paciente_telefono||"");const email=prompt("Correo:",c.paciente_email||"");const fecha=prompt("Fecha (AAAA-MM-DD):",c.fecha||"");if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(fecha||""))return msg("Fecha no válida.",true);const hora=prompt("Hora (HH:MM):",String(c.hora_inicio||"").slice(0,5));if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(hora||""))return msg("Hora no válida.",true);const estado=prompt("Estado: pendiente, confirmada, atendida, cancelada o no_asistio",c.estado||"pendiente");if(!["pendiente","confirmada","atendida","cancelada","no_asistio"].includes(estado))return msg("Estado no válido.",true);const {data:sv}=await db.from("servicios").select("duracion_minutos").eq("id",c.servicio_id).maybeSingle();const {error}=await db.from("citas").update({paciente_nombre:paciente.trim(),paciente_telefono:telefono?.trim()||null,paciente_email:email?.trim()||null,fecha,hora_inicio:hora+":00",hora_fin:sumarMinutos(hora,Number(sv?.duracion_minutos||60)),estado}).eq("id",id);if(error)return msg(error.message,true);msg("Cita actualizada.");await cargarCitas();}
async function eliminarCitaSA(id){if(!confirm("¿Eliminar definitivamente esta cita?"))return;const {error}=await db.from("citas").delete().eq("id",id);if(error)return msg(error.message,true);msg("Cita eliminada.");await cargarCitas();}
async function eliminarHorarioSA(id){if(!confirm("¿Eliminar este horario?"))return;const {error}=await db.from("horarios").delete().eq("id",id);if(error)return msg(error.message,true);msg("Horario eliminado.");await cargarHorarios();}

async function cargarUsuarios() {
  const cont=$("listaUsuariosSA"); if(!cont)return;
  const {data:{session}}=await db.auth.getSession(); if(!session)return;
  try { const r=await fetch("/api/manage-users",{headers:{Authorization:`Bearer ${session.access_token}`}}); const out=await r.json(); if(!r.ok)throw new Error(out.error||"No se pudieron cargar usuarios");
    const nm=Object.fromEntries(negocios.map(n=>[n.id,n.nombre]));
    cont.innerHTML=(out.usuarios||[]).map(u=>`<div class="sa-item"><h4>${AR.escape(u.email||"Usuario")}</h4><div class="sa-muted">${AR.escape(nm[u.negocio_id]||"Negocio")} · ${u.es_admin?"Administrador":u.es_profesional?"Profesional":"Sin rol"} · ${u.activo?"Activo":"Inactivo"}</div><div class="sa-actions"><button type="button" onclick="editarUsuarioSA('${u.usuario_id}','${u.negocio_id}','${u.es_admin?"admin":"profesional"}','${AR.escape(u.email||"")}')">✏️ Editar</button><button type="button" onclick="toggleUsuarioSA('${u.usuario_id}','${u.negocio_id}',${!!u.activo})">${u.activo?"⏸️ Desactivar":"▶️ Activar"}</button><button type="button" onclick="eliminarUsuarioSA('${u.usuario_id}')">🗑️ Eliminar</button></div></div>`).join("")||'<div class="sin-resultados">Sin usuarios.</div>';
  } catch(e){cont.innerHTML=`<div class="sin-resultados">${AR.escape(e.message)}</div>`;}
}
async function editarUsuarioSA(usuario_id,negocio_id,rol,emailActual){
  const email=prompt("Correo:",emailActual); if(!email)return; const nuevoRol=prompt("Rol (admin/profesional):",rol); if(!["admin","profesional"].includes(nuevoRol))return msg("Rol no válido.",true); const password=prompt("Nueva contraseña (déjala vacía para conservarla):","");
  const {data:{session}}=await db.auth.getSession(); const r=await fetch("/api/manage-users",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id,negocio_id,rol:nuevoRol,email,password:password||undefined})}); const out=await r.json(); if(!r.ok)return msg(out.error||"No se pudo editar.",true); msg("Usuario actualizado."); await cargarUsuarios();
}
async function toggleUsuarioSA(usuario_id,negocio_id,activo){const {data:{session}}=await db.auth.getSession();if(!session)return msg("Tu sesión expiró.",true);const r=await fetch("/api/manage-users",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id,negocio_id,activo:!activo})});const out=await r.json();if(!r.ok)return msg(out.error||"No se pudo cambiar el estado.",true);msg(activo?"Usuario desactivado.":"Usuario activado.");await cargarUsuarios();}
async function eliminarUsuarioSA(usuario_id){if(!confirm("¿Eliminar este acceso de usuario?"))return; const {data:{session}}=await db.auth.getSession(); const r=await fetch("/api/manage-users",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id})}); const out=await r.json(); if(!r.ok)return msg(out.error||"No se pudo eliminar.",true); msg("Usuario eliminado."); await Promise.all([cargarUsuarios(),cargarProfesionales()]);}

/* =========================================================
   INICIAR
========================================================= */

init();
