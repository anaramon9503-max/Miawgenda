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
const btnVolver = $("btnVolver");
const btnCerrar = $("btnCerrar");
const formularioProfesional = $("formularioProfesional");
const profesionalNombre = $("profesionalNombre");
const profesionalEspecialidad = $("profesionalEspecialidad");
const tituloFormularioProfesional = $("tituloFormularioProfesional");
const btnCancelarEdicion = $("btnCancelarEdicion");
const listaProfesionales = $("listaProfesionales");
const seccionServiciosProfesional = $("seccionServiciosProfesional");
const nombreProfesionalServicios = $("nombreProfesionalServicios");
const listaServiciosProfesional = $("listaServiciosProfesional");
const btnGuardarServiciosProfesional = $("btnGuardarServiciosProfesional");
const btnCerrarServiciosProfesional = $("btnCerrarServiciosProfesional");
const mensaje = $("mensaje");

let negocioActualId = null;
let usuarioActual = null;
let profesionalEditandoId = null;
let profesionalServiciosId = null;
let profesionales = [];
let servicios = [];

btnVolver?.addEventListener("click", () => {
  window.location.href = "dashboard.html";
});

btnCerrar?.addEventListener("click", cerrarSesion);

formularioProfesional?.addEventListener(
  "submit",
  guardarProfesional
);

btnCancelarEdicion?.addEventListener(
  "click",
  cancelarEdicion
);

btnGuardarServiciosProfesional?.addEventListener(
  "click",
  guardarServiciosProfesional
);

btnCerrarServiciosProfesional?.addEventListener(
  "click",
  cerrarServiciosProfesional
);

async function iniciar() {
  ocultarMensaje();

  const { data, error } =
    await db.auth.getSession();

  if (error || !data.session?.user) {
    window.location.href = "panel.html";
    return;
  }

  usuarioActual = data.session.user;
  correoUsuario.textContent =
    usuarioActual.email || "";

  const membresia =
    await obtenerMembresiaAdmin(usuarioActual.id);

  if (!membresia) {
    mostrarError(
      "Esta sección es solo para administradores del negocio."
    );

    setTimeout(() => {
      window.location.href = "panel.html";
    }, 1600);

    return;
  }

  negocioActualId = membresia.negocio_id;

  await cargarNombreNegocio();
  await cargarProfesionales();
}

async function obtenerMembresiaAdmin(usuarioId) {
  const { data, error } =
    await db
      .from("miembros_negocio")
      .select(`
        negocio_id,
        es_admin,
        activo
      `)
      .eq("usuario_id", usuarioId)
      .eq("activo", true)
      .eq("es_admin", true)
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

async function cargarNombreNegocio() {
  const { data, error } =
    await db
      .from("negocios")
      .select("nombre")
      .eq("id", negocioActualId)
      .maybeSingle();

  if (error || !data) {
    console.error(error);
    nombreNegocio.textContent = "Negocio";
    return;
  }

  nombreNegocio.textContent =
    data.nombre || "Negocio";
}

async function cargarProfesionales() {
  listaProfesionales.innerHTML = `
    <div class="cargando">
      Cargando profesionales...
    </div>
  `;

  const { data, error } =
    await db
      .from("profesionales")
      .select(`
        id,
        negocio_id,
        usuario_id,
        nombre,
        especialidad,
        activo
      `)
      .eq("negocio_id", negocioActualId)
      .order("nombre", { ascending: true });

  if (error) {
    console.error(
      "Error profesionales:",
      error
    );

    listaProfesionales.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar los profesionales.
      </div>
    `;

    return;
  }

  profesionales = data || [];
  renderProfesionales();
}

function renderProfesionales() {
  if (!profesionales.length) {
    listaProfesionales.innerHTML = `
      <div class="sin-resultados">
        Todavía no hay profesionales.
      </div>
    `;
    return;
  }

  listaProfesionales.innerHTML = "";

  for (const profesional of profesionales) {
    const card =
      document.createElement("div");

    card.className = "servicio-card";

    card.innerHTML = `
      <div class="servicio-cabecera">
        <div>
          <div class="servicio-nombre">
            ${escapar(profesional.nombre)}
          </div>

          <div class="servicio-descripcion">
            ${escapar(
              profesional.especialidad ||
              "Sin especialidad"
            )}
          </div>
        </div>

        <span class="
          servicio-estado
          ${profesional.activo ? "activo" : "inactivo"}
        ">
          ${profesional.activo ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div class="servicio-acciones">

        <button
          type="button"
          class="btn-editar"
          onclick="editarProfesional('${profesional.id}')"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btn-servicios"
          onclick="abrirServiciosProfesional('${profesional.id}')"
        >
          🛍️ Servicios
        </button>

        <button
          type="button"
          class="btn-activar"
          onclick="cambiarActivoProfesional(
            '${profesional.id}',
            ${!profesional.activo}
          )"
        >
          ${profesional.activo
            ? "Desactivar profesional"
            : "Activar profesional"}
        </button>

      </div>
    `;

    listaProfesionales.appendChild(card);
  }
}

async function guardarProfesional(evento) {
  evento.preventDefault();
  ocultarMensaje();

  const nombre =
    profesionalNombre.value.trim();

  const especialidad =
    profesionalEspecialidad.value.trim();

  if (!nombre) {
    mostrarError(
      "Escribe el nombre del profesional."
    );
    return;
  }

  const boton =
    formularioProfesional.querySelector(
      'button[type="submit"]'
    );

  boton.disabled = true;
  boton.textContent =
    profesionalEditandoId
      ? "Guardando..."
      : "Agregando...";

  try {
    if (profesionalEditandoId) {
      const { error } =
        await db
          .from("profesionales")
          .update({
            nombre,
            especialidad:
              especialidad || null
          })
          .eq(
            "id",
            profesionalEditandoId
          )
          .eq(
            "negocio_id",
            negocioActualId
          );

      if (error) throw error;

      mostrarExito(
        "Profesional actualizado."
      );

    } else {
      const { error } =
        await db
          .from("profesionales")
          .insert({
            negocio_id:
              negocioActualId,
            usuario_id:
              null,
            nombre,
            especialidad:
              especialidad || null,
            activo:
              true
          });

      if (error) throw error;

      mostrarExito(
        "Profesional agregado."
      );
    }

    cancelarEdicion();
    await cargarProfesionales();

  } catch (error) {
    console.error(
      "Error guardando profesional:",
      error
    );

    mostrarError(
      "No fue posible guardar el profesional."
    );

  } finally {
    boton.disabled = false;
    boton.textContent =
      "Guardar profesional";
  }
}

function editarProfesional(id) {
  const profesional =
    profesionales.find(
      p => p.id === id
    );

  if (!profesional) return;

  profesionalEditandoId = id;

  profesionalNombre.value =
    profesional.nombre || "";

  profesionalEspecialidad.value =
    profesional.especialidad || "";

  tituloFormularioProfesional.textContent =
    "Editar profesional";

  btnCancelarEdicion.classList.remove(
    "oculto"
  );

  formularioProfesional.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function cancelarEdicion() {
  profesionalEditandoId = null;

  profesionalNombre.value = "";
  profesionalEspecialidad.value = "";

  tituloFormularioProfesional.textContent =
    "Agregar profesional";

  btnCancelarEdicion.classList.add(
    "oculto"
  );
}

async function cambiarActivoProfesional(
  id,
  nuevoActivo
) {
  ocultarMensaje();

  if (!nuevoActivo) {
    const confirmar =
      window.confirm(
        "¿Desactivar este profesional? Sus citas anteriores no se borrarán."
      );

    if (!confirmar) return;
  }

  const { error } =
    await db
      .from("profesionales")
      .update({
        activo: nuevoActivo
      })
      .eq("id", id)
      .eq(
        "negocio_id",
        negocioActualId
      );

  if (error) {
    console.error(error);
    mostrarError(
      "No fue posible cambiar el estado del profesional."
    );
    return;
  }

  mostrarExito(
    nuevoActivo
      ? "Profesional activado."
      : "Profesional desactivado."
  );

  await cargarProfesionales();
}

async function abrirServiciosProfesional(id) {
  ocultarMensaje();

  const profesional =
    profesionales.find(
      p => p.id === id
    );

  if (!profesional) return;

  profesionalServiciosId = id;

  nombreProfesionalServicios.textContent =
    profesional.nombre;

  seccionServiciosProfesional.classList.remove(
    "oculto"
  );

  listaServiciosProfesional.innerHTML = `
    <div class="cargando">
      Cargando servicios...
    </div>
  `;

  const [
    serviciosRespuesta,
    asignacionesRespuesta
  ] = await Promise.all([
    db
      .from("servicios")
      .select(`
        id,
        nombre,
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
      ),

    db
      .from("profesional_servicios")
      .select("servicio_id")
      .eq(
        "profesional_id",
        id
      )
  ]);

  if (
    serviciosRespuesta.error ||
    asignacionesRespuesta.error
  ) {
    console.error(
      serviciosRespuesta.error ||
      asignacionesRespuesta.error
    );

    listaServiciosProfesional.innerHTML = `
      <div class="sin-resultados">
        No fue posible cargar los servicios.
      </div>
    `;
    return;
  }

  servicios =
    serviciosRespuesta.data || [];

  const asignados =
    new Set(
      (asignacionesRespuesta.data || [])
        .map(x => x.servicio_id)
    );

  if (!servicios.length) {
    listaServiciosProfesional.innerHTML = `
      <div class="sin-resultados">
        Primero agrega servicios al negocio.
      </div>
    `;
    return;
  }

  listaServiciosProfesional.innerHTML =
    servicios.map(servicio => `
      <label
        style="
          display:flex;
          align-items:center;
          gap:10px;
          padding:11px 8px;
          border-bottom:1px solid #eee9f0;
        "
      >
        <input
          type="checkbox"
          class="check-servicio-profesional"
          value="${servicio.id}"
          ${asignados.has(servicio.id)
            ? "checked"
            : ""}
          style="
            width:auto;
            margin:0;
          "
        >

        <span>
          ${escapar(servicio.nombre)}
        </span>
      </label>
    `).join("");

  seccionServiciosProfesional.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function guardarServiciosProfesional() {
  if (!profesionalServiciosId) {
    return;
  }

  ocultarMensaje();

  btnGuardarServiciosProfesional.disabled =
    true;

  btnGuardarServiciosProfesional.textContent =
    "Guardando...";

  try {
    const seleccionados =
      [
        ...document.querySelectorAll(
          ".check-servicio-profesional:checked"
        )
      ].map(check => check.value);

    const { error: errorBorrar } =
      await db
        .from("profesional_servicios")
        .delete()
        .eq(
          "profesional_id",
          profesionalServiciosId
        );

    if (errorBorrar) {
      throw errorBorrar;
    }

    if (seleccionados.length) {
      const filas =
        seleccionados.map(
          servicioId => ({
            profesional_id:
              profesionalServiciosId,
            servicio_id:
              servicioId
          })
        );

      const { error: errorInsertar } =
        await db
          .from("profesional_servicios")
          .insert(filas);

      if (errorInsertar) {
        throw errorInsertar;
      }
    }

    mostrarExito(
      "Servicios del profesional actualizados."
    );

  } catch (error) {
    console.error(
      "Error asignando servicios:",
      error
    );

    mostrarError(
      "No fue posible guardar los servicios."
    );

  } finally {
    btnGuardarServiciosProfesional.disabled =
      false;

    btnGuardarServiciosProfesional.textContent =
      "Guardar servicios";
  }
}

function cerrarServiciosProfesional() {
  profesionalServiciosId = null;

  seccionServiciosProfesional.classList.add(
    "oculto"
  );

  listaServiciosProfesional.innerHTML = "";
}

async function cerrarSesion() {
  await db.auth.signOut();
  window.location.href = "panel.html";
}

function mostrarError(texto) {
  mensaje.textContent = texto;
  mensaje.className =
    "mensaje error";
}

function mostrarExito(texto) {
  mensaje.textContent = texto;
  mensaje.className =
    "mensaje exito";
}

function ocultarMensaje() {
  mensaje.textContent = "";
  mensaje.className =
    "mensaje oculto";
}

function escapar(texto = "") {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

window.editarProfesional =
  editarProfesional;

window.cambiarActivoProfesional =
  cambiarActivoProfesional;

window.abrirServiciosProfesional =
  abrirServiciosProfesional;

iniciar();
