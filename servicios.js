const { db } = window.AR;

const $ = (id) => document.getElementById(id);

let negocioId = null;
let servicioEditandoId = null;


/* =========================
   MENSAJES
========================= */

function mostrarMensaje(texto, error = false) {
  const el = $("mensaje");

  if (!el) return;

  el.textContent = texto;
  el.className = `mensaje ${error ? "error" : "exito"}`;
  el.classList.remove("oculto");
}


function ocultarMensaje() {
  const el = $("mensaje");

  if (el) {
    el.classList.add("oculto");
  }
}


/* =========================
   INICIAR PÁGINA
========================= */

async function iniciar() {
  try {
    const ctx = await AR.contexto();

    if (!ctx) {
      location.href = "index.html";
      return;
    }

    if (!ctx.membresias || ctx.membresias.length === 0) {
      throw new Error(
        "Esta cuenta no tiene un negocio asignado."
      );
    }

    negocioId = ctx.membresias[0].negocio_id;

    if ($("correoUsuario")) {
      $("correoUsuario").textContent =
        ctx.user?.email || "";
    }

    const { data: negocio, error: errorNegocio } = await db
      .from("negocios_publicos")
      .select("id, nombre")
      .eq("id", negocioId)
      .maybeSingle();

    if (errorNegocio) {
      throw errorNegocio;
    }

    if ($("nombreNegocio")) {
      $("nombreNegocio").textContent =
        negocio?.nombre || "Mi negocio";
    }

    await cargarServicios();

  } catch (error) {
    console.error(
      "Error al iniciar servicios:",
      error
    );

    if ($("nombreNegocio")) {
      $("nombreNegocio").textContent = "Error";
    }

    mostrarMensaje(
      error.message ||
      "No fue posible cargar los servicios.",
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
    .order("nombre", {
      ascending: true
    });

  if (error) {
    console.error(
      "Error cargando servicios:",
      error
    );

    lista.innerHTML = "";

    mostrarMensaje(
      "No se pudieron cargar los servicios: " +
      error.message,
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
    const tarjeta =
      document.createElement("div");

    tarjeta.className =
      "servicio-card";

    tarjeta.innerHTML = `
      <div class="servicio-info">

        <h3>
          ${escapar(servicio.nombre)}
        </h3>

        ${
          servicio.descripcion
            ? `
              <p>
                ${escapar(servicio.descripcion)}
              </p>
            `
            : ""
        }

        <div class="servicio-detalles">
          <span>
            ⏱️ ${servicio.duracion_minutos} min
          </span>

          <span>
            💲${Number(
              servicio.precio || 0
            ).toFixed(2)}
          </span>
        </div>

      </div>

      <div class="servicio-acciones">

        <button
          type="button"
          class="btn-editar"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btn-eliminar"
        >
          🗑️ Eliminar
        </button>

      </div>
    `;

    tarjeta
      .querySelector(".btn-editar")
      .addEventListener(
        "click",
        () => editarServicio(servicio)
      );

    tarjeta
      .querySelector(".btn-eliminar")
      .addEventListener(
        "click",
        () =>
          eliminarServicio(
            servicio.id,
            servicio.nombre
          )
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

  const nombre =
    $("servicioNombre")
      ?.value
      .trim();

  const descripcion =
    $("servicioDescripcion")
      ?.value
      .trim() || "";

  const duracion =
    Number(
      $("servicioDuracion")?.value
    );

  const precio =
    Number(
      $("servicioPrecio")?.value
    );

  if (!nombre) {
    mostrarMensaje(
      "Escribe el nombre del servicio.",
      true
    );

    return;
  }

  if (!duracion || duracion < 1) {
    mostrarMensaje(
      "La duración debe ser mayor a 0 minutos.",
      true
    );

    return;
  }

  if (
    Number.isNaN(precio) ||
    precio < 0
  ) {
    mostrarMensaje(
      "Escribe un precio válido.",
      true
    );

    return;
  }

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
        .eq(
          "id",
          servicioEditandoId
        )
        .eq(
          "negocio_id",
          negocioId
        );

      if (error) {
        throw error;
      }

      mostrarMensaje(
        "Servicio actualizado correctamente."
      );

    } else {
      const { error } = await db
        .from("servicios")
        .insert({
          negocio_id: negocioId,
          nombre,
          descripcion,
          duracion_minutos: duracion,
          precio,
          activo: true
        });

      if (error) {
        throw error;
      }

      mostrarMensaje(
        "Servicio guardado correctamente."
      );
    }

    limpiarFormulario();

    await cargarServicios();

  } catch (error) {
    console.error(
      "Error guardando servicio:",
      error
    );

    mostrarMensaje(
      "No se pudo guardar el servicio: " +
      error.message,
      true
    );
  }
}


/* =========================
   EDITAR SERVICIO
========================= */

function editarServicio(servicio) {
  servicioEditandoId =
    servicio.id;

  $("servicioNombre").value =
    servicio.nombre || "";

  $("servicioDescripcion").value =
    servicio.descripcion || "";

  $("servicioDuracion").value =
    servicio.duracion_minutos || 60;

  $("servicioPrecio").value =
    servicio.precio || 0;

  if ($("tituloFormularioServicio")) {
    $("tituloFormularioServicio")
      .textContent =
      "Editar servicio";
  }

  const botonGuardar =
    $("formularioServicio")
      ?.querySelector(
        'button[type="submit"]'
      );

  if (botonGuardar) {
    botonGuardar.textContent =
      "Guardar cambios";
  }

  $("btnCancelarEdicion")
    ?.classList
    .remove("oculto");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================
   LIMPIAR FORMULARIO
========================= */

function limpiarFormulario() {
  servicioEditandoId = null;

  $("formularioServicio")
    ?.reset();

  if ($("servicioDuracion")) {
    $("servicioDuracion").value = 60;
  }

  if ($("tituloFormularioServicio")) {
    $("tituloFormularioServicio")
      .textContent =
      "Agregar servicio";
  }

  const botonGuardar =
    $("formularioServicio")
      ?.querySelector(
        'button[type="submit"]'
      );

  if (botonGuardar) {
    botonGuardar.textContent =
      "Guardar servicio";
  }

  $("btnCancelarEdicion")
    ?.classList
    .add("oculto");
}


/* =========================
   ELIMINAR SERVICIO
========================= */

async function eliminarServicio(
  id,
  nombre
) {
  const confirmar =
    window.confirm(
      `¿Eliminar el servicio "${nombre}"?`
    );

  if (!confirmar) return;

  ocultarMensaje();

  try {
    const { error } = await db
      .from("servicios")
      .delete()
      .eq("id", id)
      .eq(
        "negocio_id",
        negocioId
      );

    if (error) {
      throw error;
    }

    mostrarMensaje(
      "Servicio eliminado correctamente."
    );

    await cargarServicios();

  } catch (error) {
    console.error(
      "Error eliminando servicio:",
      error
    );

    mostrarMensaje(
      "No se pudo eliminar el servicio: " +
      error.message,
      true
    );
  }
}


/* =========================
   ESCAPAR TEXTO
========================= */

function escapar(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}


/* =========================
   EVENTOS
========================= */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    $("formularioServicio")
      ?.addEventListener(
        "submit",
        guardarServicio
      );

    $("btnCancelarEdicion")
      ?.addEventListener(
        "click",
        limpiarFormulario
      );

    $("btnVolver")
      ?.addEventListener(
        "click",
        () => {
          location.href =
            "panel.html";
        }
      );

    $("btnCerrar")
      ?.addEventListener(
        "click",
        async () => {
          await db.auth.signOut();

          location.href =
            "index.html";
        }
      );

    iniciar();
  }
);
