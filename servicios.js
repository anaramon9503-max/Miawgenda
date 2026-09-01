const serviciosDb = window.AR.db;

const $ = (id) => document.getElementById(id);

let negocioId = null;
let servicioEditandoId = null;


// =====================================================
// MENSAJES
// =====================================================

function mostrarMensaje(texto, error = false) {
  const el = $("mensaje");

  if (!el) return;

  el.textContent = texto;
  el.className =
    `mensaje ${error ? "error" : "exito"}`;

  el.classList.remove("oculto");
}


function ocultarMensaje() {
  const el = $("mensaje");

  if (!el) return;

  el.textContent = "";
  el.className = "mensaje oculto";
}


// =====================================================
// INICIAR
// =====================================================

async function iniciar() {
  try {

    const { data } =
      await serviciosDb.auth.getSession();

    const user =
      data.session?.user;

    if (!user) {
      location.href = "panel.html";
      return;
    }


    // Mostrar correo
    $("correoUsuario").textContent =
      user.email || "";


    // Obtener membresía
    const { data: membresias, error: errorMembresia } =
      await serviciosDb
        .from("miembros_negocio")
        .select(`
          negocio_id,
          es_admin,
          es_profesional,
          activo
        `)
        .eq("usuario_id", user.id)
        .eq("activo", true)
        .limit(1);


    if (errorMembresia) {
      throw errorMembresia;
    }


    if (
      !membresias ||
      membresias.length === 0
    ) {
      throw new Error(
        "Esta cuenta no tiene un negocio asignado."
      );
    }


    negocioId =
      membresias[0].negocio_id;


    // Obtener nombre del negocio
    const { data: negocio, error: errorNegocio } =
      await serviciosDb
        .from("negocios")
        .select("nombre")
        .eq("id", negocioId)
        .maybeSingle();


    if (errorNegocio) {
      throw errorNegocio;
    }


    $("nombreNegocio").textContent =
      negocio?.nombre || "Negocio";


    await cargarServicios();

  } catch (error) {

    console.error(
      "Error iniciando servicios:",
      error
    );

    $("nombreNegocio").textContent =
      "Error";

    mostrarMensaje(
      error.message ||
      "No fue posible cargar los servicios.",
      true
    );
  }
}


// =====================================================
// CARGAR SERVICIOS
// =====================================================

async function cargarServicios() {

  const lista =
    $("listaServicios");


  lista.innerHTML = `
    <div class="cargando">
      Cargando servicios...
    </div>
  `;


  const { data, error } =
    await serviciosDb
      .from("servicios")
      .select("*")
      .eq(
        "negocio_id",
        negocioId
      )
      .order(
        "nombre",
        { ascending: true }
      );


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


  if (
    !data ||
    data.length === 0
  ) {

    lista.innerHTML = `
      <div class="sin-citas">
        Aún no tienes servicios registrados.
      </div>
    `;

    return;
  }


  lista.innerHTML = "";


  data.forEach(servicio => {

    const tarjeta =
      document.createElement("div");

    tarjeta.className =
      "cita";


    tarjeta.innerHTML = `

      <div class="dato">
        <strong>
          ${escapar(servicio.nombre)}
        </strong>
      </div>

      ${
        servicio.descripcion
          ? `
            <div class="dato">
              ${escapar(
                servicio.descripcion
              )}
            </div>
          `
          : ""
      }

      <div class="dato">
        ⏱️
        ${servicio.duracion_minutos}
        minutos
      </div>

      <div class="dato">
        💲
        ${Number(
          servicio.precio || 0
        ).toFixed(2)}
      </div>

      <div class="acciones">

        <button
          type="button"
          class="btnEditar"
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btnEliminar"
        >
          🗑️ Eliminar
        </button>

      </div>
    `;


    tarjeta
      .querySelector(".btnEditar")
      .addEventListener(
        "click",
        () =>
          editarServicio(servicio)
      );


    tarjeta
      .querySelector(".btnEliminar")
      .addEventListener(
        "click",
        () =>
          eliminarServicio(
            servicio.id,
            servicio.nombre
          )
      );


    lista.appendChild(
      tarjeta
    );
  });
}


// =====================================================
// GUARDAR
// =====================================================

async function guardarServicio(event) {

  event.preventDefault();

  ocultarMensaje();


  const nombre =
    $("servicioNombre")
      .value
      .trim();


  const descripcion =
    $("servicioDescripcion")
      .value
      .trim();


  const duracion =
    Number(
      $("servicioDuracion").value
    );


  const precio =
    Number(
      $("servicioPrecio").value
    );


  if (!nombre) {

    mostrarMensaje(
      "Escribe el nombre del servicio.",
      true
    );

    return;
  }


  if (
    !duracion ||
    duracion < 1
  ) {

    mostrarMensaje(
      "Escribe una duración válida.",
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

      const { error } =
        await serviciosDb
          .from("servicios")
          .update({
            nombre,
            descripcion,
            duracion_minutos:
              duracion,
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
        "Servicio actualizado."
      );

    } else {

      const { error } =
        await serviciosDb
          .from("servicios")
          .insert({
            negocio_id:
              negocioId,

            nombre,

            descripcion,

            duracion_minutos:
              duracion,

            precio,

            activo: true
          });


      if (error) {
        throw error;
      }


      mostrarMensaje(
        "Servicio guardado."
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
      "No se pudo guardar: " +
      error.message,
      true
    );
  }
}


// =====================================================
// EDITAR
// =====================================================

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


  $("tituloFormularioServicio")
    .textContent =
    "Editar servicio";


  const boton =
    $("formularioServicio")
      .querySelector(
        'button[type="submit"]'
      );


  boton.textContent =
    "Guardar cambios";


  $("btnCancelarEdicion")
    .classList
    .remove("oculto");


  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// =====================================================
// LIMPIAR
// =====================================================

function limpiarFormulario() {

  servicioEditandoId = null;


  $("formularioServicio")
    .reset();


  $("servicioDuracion").value =
    60;


  $("tituloFormularioServicio")
    .textContent =
    "Agregar servicio";


  const boton =
    $("formularioServicio")
      .querySelector(
        'button[type="submit"]'
      );


  boton.textContent =
    "Guardar servicio";


  $("btnCancelarEdicion")
    .classList
    .add("oculto");
}


// =====================================================
// ELIMINAR
// =====================================================

async function eliminarServicio(
  id,
  nombre
) {

  const confirmar =
    window.confirm(
      `¿Eliminar "${nombre}"?`
    );


  if (!confirmar) {
    return;
  }


  try {

    const { error } =
      await serviciosDb
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
      "Servicio eliminado."
    );


    await cargarServicios();

  } catch (error) {

    console.error(
      "Error eliminando:",
      error
    );

    mostrarMensaje(
      "No se pudo eliminar: " +
      error.message,
      true
    );
  }
}


// =====================================================
// ESCAPAR TEXTO
// =====================================================

function escapar(texto = "") {

  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


// =====================================================
// EVENTOS
// =====================================================

$("formularioServicio")
  .addEventListener(
    "submit",
    guardarServicio
  );


$("btnCancelarEdicion")
  .addEventListener(
    "click",
    limpiarFormulario
  );


$("btnVolver")
  .addEventListener(
    "click",
    () => {
      location.href =
        "panel.html";
    }
  );


$("btnCerrar")
  .addEventListener(
    "click",
    async () => {

      await serviciosDb.auth.signOut();

      location.href =
        "panel.html";
    }
  );


// =====================================================
// ARRANCAR
// =====================================================

iniciar();
