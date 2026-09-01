const { db } = window.AR;

const $ = (id) => document.getElementById(id);

let negocioId = null;
let servicioEditandoId = null;

/* =========================
   MENSAJES
========================= */

function mostrarMensaje(texto, error = false) {
  const mensaje = $("mensaje");

  if (!mensaje) return;

  mensaje.textContent = texto;
  mensaje.className = `mensaje ${error ? "error" : "exito"}`;
  mensaje.classList.remove("oculto");
}

function ocultarMensaje() {
  const mensaje = $("mensaje");

  if (mensaje) {
    mensaje.classList.add("oculto");
  }
}

/* =========================
   CONTEXTO / NEGOCIO
========================= */

async function iniciar() {
  try {
    const ctx = await AR.contexto();

    if (!ctx) {
      location.href = "index.html";
      return;
    }

    negocioId =
      ctx.negocio_id ||
      ctx.negocioId ||
      ctx.negocio?.id ||
      ctx.membresia?.negocio_id;

    const nombreNegocio =
      ctx.negocio?.nombre ||
      ctx.nombre_negocio ||
      ctx.negocio_nombre ||
      "Mi negocio";

    const correo =
      ctx.usuario?.email ||
      ctx.user?.email ||
      ctx.email ||
      "";

    if (!negocioId) {
      throw new Error("No se pudo identificar el negocio.");
    }

    if ($("nombreNegocio")) {
      $("nombreNegocio").textContent = nombreNegocio;
    }

    if ($("correoSesion")) {
      $("correoSesion").textContent = correo;
    }

    await cargarServicios();

  } catch (error) {
    console.error("Error al iniciar servicios:", error);

    if ($("nombreNegocio")) {
      $("nombreNegocio").textContent = "Error";
    }

    mostrarMensaje(
      error.message || "No fue posible cargar los servicios.",
      true
    );
  }
}

/* =========================
   CARGAR SERVICIOS
========================= */

async function cargarServicios() {
  const lista = $("listaServicios");

  if (!lista) return;

  lista.innerHTML = `
    <div class="cargando">
      Cargando servicios...
    </div>
  `;

  const { data, error } = await db
    .from("servicios")
    .select("*")
    .eq("negocio_id", negocioId)
    .order("nombre", { ascending: true });

  if (error) {
    console.error(error);
    lista.innerHTML = "";
    mostrarMensaje(
      "No se pudieron cargar los servicios: " + error.message,
      true
    );
    return;
  }

  if (!data || data.length === 0) {
    lista.innerHTML = `
      <div class="sin-datos">
        Aún no tienes servicios registrados.
      </div>
    `;
    return;
  }

  lista.innerHTML = "";

  data.forEach((servicio) => {
    const tarjeta = document.createElement("div");
    tarjeta.className = "servicio-card";

    tarjeta.innerHTML = `
      <div class="servicio-info">

        <h3>${escapar(servicio.nombre)}</h3>

        ${
          servicio.descripcion
            ? `<p>${escapar(servicio.descripcion)}</p>`
            : ""
        }

        <div class="servicio-detalles">
          <span>⏱️ ${servicio.duracion_minutos} min</span>
          <span>💲${Number(servicio.precio || 0).toFixed(2)}</span>
        </div>

      </div>

      <div class="servicio-acciones">

        <button
          type="button"
          class="btn-editar"
          data-id="${servicio.id}"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btn-eliminar"
          data-id="${servicio.id}"
        >
          🗑️ Eliminar
        </button>

      </div>
    `;

    tarjeta
      .querySelector(".btn-editar")
      .addEventListener("click", () => editarServicio(servicio));

    tarjeta
      .querySelector(".btn-eliminar")
      .addEventListener("click", () =>
        eliminarServicio(servicio.id, servicio.nombre)
      );

    lista.appendChild(tarjeta);
  });
}

/* =========================
   GUARDAR SERVICIO
========================= */

async function guardarServicio(event) {
  event.preventDefault();

  ocultarMensaje();

  const nombre = $("servicioNombre")?.value.trim();
  const descripcion = $("servicioDescripcion")?.value.trim() || "";
  const duracion = Number($("servicioDuracion")?.value);
  const precio = Number($("servicioPrecio")?.value);

  if (!nombre) {
    mostrarMensaje("Escribe el nombre del servicio.", true);
    return;
  }

  if (!duracion || duracion < 1) {
    mostrarMensaje("La duración debe ser mayor a 0 minutos.", true);
    return;
  }

  if (Number.isNaN(precio) || precio < 0) {
    mostrarMensaje("Escribe un precio válido.", true);
    return;
  }

  const datos = {
    negocio_id: negocioId,
    nombre,
    descripcion,
    duracion_minutos: duracion,
    precio,
    activo: true
  };

  try {

    if (servicioEditandoId) {

      const { error } = await db
        .from("servicios")
        .update({
          nombre,
          descripcion,
          duracion_minutos: duracion,
          precio
        })
        .eq("id", servicioEditandoId)
        .eq("negocio_id", negocioId);

      if (error) throw error;

      mostrarMensaje("Servicio actualizado correctamente.");

    } else {

      const { error } = await db
        .from("servicios")
        .insert(datos);

      if (error) throw error;

      mostrarMensaje("Servicio guardado correctamente.");
    }

    limpiarFormulario();

    await cargarServicios();

  } catch (error) {
    console.error(error);

    mostrarMensaje(
      "No se pudo guardar el servicio: " + error.message,
      true
    );
  }
}

/* =========================
   EDITAR
========================= */

function editarServicio(servicio) {
  servicioEditandoId = servicio.id;

  $("servicioNombre").value = servicio.nombre || "";
  $("servicioDescripcion").value = servicio.descripcion || "";
  $("servicioDuracion").value = servicio.duracion_minutos || 60;
  $("servicioPrecio").value = servicio.precio || 0;

  const botonGuardar =
    $("formServicio")?.querySelector('button[type="submit"]');

  if (botonGuardar) {
    botonGuardar.textContent = "Guardar cambios";
  }

  const cancelar = $("btnCancelarEdicion");

  if (cancelar) {
    cancelar.classList.remove("oculto");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

/* =========================
   CANCELAR EDICIÓN
========================= */

function limpiarFormulario() {
  servicioEditandoId = null;

  if ($("formServicio")) {
    $("formServicio").reset();
  }

  if ($("servicioDuracion")) {
    $("servicioDuracion").value = 60;
  }

  const botonGuardar =
    $("formServicio")?.querySelector('button[type="submit"]');

  if (botonGuardar) {
    botonGuardar.textContent = "Guardar servicio";
  }

  if ($("btnCancelarEdicion")) {
    $("btnCancelarEdicion").classList.add("oculto");
  }
}

/* =========================
   ELIMINAR
========================= */

async function eliminarServicio(id, nombre) {
  const confirmar = window.confirm(
    `¿Eliminar el servicio "${nombre}"?`
  );

  if (!confirmar) return;

  ocultarMensaje();

  try {

    const { error } = await db
      .from("servicios")
      .delete()
      .eq("id", id)
      .eq("negocio_id", negocioId);

    if (error) throw error;

    mostrarMensaje("Servicio eliminado correctamente.");

    await cargarServicios();

  } catch (error) {
    console.error(error);

    mostrarMensaje(
      "No se pudo eliminar el servicio: " + error.message,
      true
    );
  }
}

/* =========================
   SEGURIDAD PARA TEXTO
========================= */

function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================
   BOTONES
========================= */

document.addEventListener("DOMContentLoaded", () => {

  $("formServicio")?.addEventListener(
    "submit",
    guardarServicio
  );

  $("btnCancelarEdicion")?.addEventListener(
    "click",
    limpiarFormulario
  );

  $("btnVolver")?.addEventListener("click", () => {
    location.href = "panel.html";
  });

  $("btnCerrarSesion")?.addEventListener(
    "click",
    async () => {
      await db.auth.signOut();
      location.href = "index.html";
    }
  );

  iniciar();
});
