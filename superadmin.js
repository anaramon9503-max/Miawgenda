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


/* =========================================================
   MENSAJES
========================================================= */

function msg(texto, error = false) {
  const el = $("saMensaje");

  if (!el) return;

  el.textContent = texto;
  el.className = `mensaje ${error ? "error" : "exito"}`;
  el.classList.remove("oculto");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function clearMsg() {
  const el = $("saMensaje");

  if (el) {
    el.classList.add("oculto");
  }
}


/* =========================================================
   INICIO
========================================================= */

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

  if ($("saCorreo")) {
    $("saCorreo").textContent = ctx.user.email;
  }

  if ($("btnCerrar")) {
    $("btnCerrar").onclick = AR.cerrarSesion;
  }

  /*
    Si todavía existe el botón viejo,
    seguirá funcionando.

    Si ya lo quitaste del HTML,
    no pasa nada.
  */

  if ($("btnPanel")) {
    $("btnPanel").onclick = () =>
      location.href = "panel.html";
  }


  /*
    NAVEGACIÓN
  */

  document
    .querySelectorAll("[data-tab]")
    .forEach(b => {

      b.onclick = () =>
        abrirTab(b.dataset.tab);

    });


  conectarEventos();

  await cargarNegocios();

  await Promise.all([
    cargarProfesionales(),
    cargarServicios(),
    cargarHorarios(),
    cargarCitas()
  ]);

  abrirTab("negocios");
}


/* =========================================================
   TABS
========================================================= */

function abrirTab(tab) {

  /*
    Ocultar todas las secciones
  */

  document
    .querySelectorAll(".sa-section")
    .forEach(s => {

      s.classList.remove("activa");

    });


  /*
    Mostrar sección seleccionada
  */

  const seccion =
    $("tab-" + tab);

  if (seccion) {
    seccion.classList.add("activa");
  }


  /*
    Quitar morado a todos
  */

  document
    .querySelectorAll("[data-tab]")
    .forEach(b => {

      b.classList.remove("activo");

    });


  /*
    Marcar la pestaña seleccionada.

    Esto afecta tanto:
    - menú desktop
    - barra inferior móvil
  */

  document
    .querySelectorAll(
      `[data-tab="${tab}"]`
    )
    .forEach(b => {

      b.classList.add("activo");

    });


  clearMsg();
}


/* =========================================================
   EVENTOS
========================================================= */

function conectarEventos() {

  if ($("formNegocio")) {
    $("formNegocio").onsubmit =
      crearNegocio;
  }

  if ($("formUsuario")) {
    $("formUsuario").onsubmit =
      crearUsuario;
  }

  if ($("formProfesional")) {
    $("formProfesional").onsubmit =
      crearProfesional;
  }

  if ($("formServicioSA")) {
    $("formServicioSA").onsubmit =
      crearServicio;
  }

  if ($("formHorarioSA")) {
    $("formHorarioSA").onsubmit =
      crearHorario;
  }


  if ($("profNegocio")) {

    $("profNegocio").onchange =
      cargarProfesionales;

  }


  if ($("servNegocio")) {

    $("servNegocio").onchange =
      cargarServicios;

  }


  if ($("horNegocio")) {

    $("horNegocio").onchange =
      async () => {

        await llenarProfesionalesHorario();
        await cargarHorarios();

      };

  }


  if ($("horProfesional")) {

    $("horProfesional").onchange =
      llenarServiciosHorario;

  }


  if ($("citasNegocio")) {

    $("citasNegocio").onchange =
      cargarCitas;

  }
}


/* =========================================================
   NEGOCIOS
========================================================= */

async function cargarNegocios() {

  const {
    data,
    error
  } = await db
    .from("negocios")
    .select("id,nombre")
    .order("nombre");


  if (error) {

    msg(
      "No pude cargar los negocios: " +
      error.message,
      true
    );

    return;
  }


  negocios =
    data || [];


  if ($("listaNegocios")) {

    $("listaNegocios").innerHTML =
      negocios.length

        ? negocios.map(n => `

            <div class="sa-item">

              <h4>
                ${AR.escape(n.nombre)}
              </h4>

              <span class="sa-badge">
                ${n.id}
              </span>

            </div>

          `).join("")

        : `
          <div class="sin-resultados">
            Todavía no hay negocios.
          </div>
        `;

  }


  [
    "usuarioNegocio",
    "profNegocio",
    "servNegocio",
    "horNegocio"
  ]
  .forEach(id => {

    rellenarNegocios($(id));

  });


  rellenarNegocios(
    $("citasNegocio"),
    true
  );


  if (negocios[0]) {

    await llenarProfesionalesHorario();

  }
}


function rellenarNegocios(
  sel,
  todos = false
) {

  if (!sel) return;


  const actual =
    sel.value;


  sel.innerHTML =

    (
      todos

        ? `
          <option value="">
            Todos
          </option>
        `

        : `
          <option value="">
            Selecciona un negocio
          </option>
        `
    )

    +

    negocios.map(n => `

      <option value="${n.id}">
        ${AR.escape(n.nombre)}
      </option>

    `).join("");


  if (
    [...sel.options]
      .some(
        o => o.value === actual
      )
  ) {

    sel.value = actual;

  }

  else if (
    !todos &&
    negocios[0]
  ) {

    sel.value =
      negocios[0].id;

  }
}


/* =========================================================
   CREAR NEGOCIO
========================================================= */

async function crearNegocio(e) {

  e.preventDefault();

  clearMsg();


  const nombre =
    $("negocioNombre")
      .value
      .trim();


  if (!nombre) {

    return msg(
      "Escribe el nombre del negocio.",
      true
    );

  }


  const { error } =
    await db
      .from("negocios")
      .insert({

        nombre,
        activo: true

      });


  if (error) {

    msg(
      error.message,
      true
    );

    return;
  }


  e.target.reset();


  msg(
    "Negocio creado correctamente."
  );


  await cargarNegocios();


  await Promise.all([
    cargarProfesionales(),
    cargarServicios(),
    cargarHorarios(),
    cargarCitas()
  ]);
}


/* =========================================================
   USUARIOS
========================================================= */

async function crearUsuario(e) {

  e.preventDefault();

  clearMsg();


  const {
    data: {
      session
    }
  } =
    await db.auth.getSession();


  if (!session) {

    return msg(
      "Tu sesión expiró. Vuelve a iniciar sesión.",
      true
    );

  }


  const payload = {

    negocio_id:
      $("usuarioNegocio").value,

    rol:
      $("usuarioRol").value,

    nombre:
      $("usuarioNombre")
        .value
        .trim(),

    especialidad:
      $("usuarioEspecialidad")
        .value
        .trim(),

    email:
      $("usuarioCorreo")
        .value
        .trim(),

    password:
      $("usuarioPassword").value

  };


  if (!payload.negocio_id) {

    return msg(
      "Selecciona un negocio.",
      true
    );

  }


  if (!payload.rol) {

    return msg(
      "Selecciona un rol.",
      true
    );

  }


  if (
    !payload.email ||
    !payload.password
  ) {

    return msg(
      "Correo y contraseña son obligatorios.",
      true
    );

  }


  try {

    const r =
      await fetch(
        "/api/create-user",
        {

          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "Authorization":
              `Bearer ${session.access_token}`

          },

          body:
            JSON.stringify(
              payload
            )

        }
      );


    const out =
      await r.json();


    if (!r.ok) {

      throw new Error(
        out.error ||
        "No se pudo crear el usuario"
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

  }

  catch (err) {

    msg(
      err.message,
      true
    );

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
    $("profNombre")
      .value
      .trim();


  if (!nombre) {

    return msg(
      "Escribe el nombre del profesional.",
      true
    );

  }


  const { error } =
    await db
      .from("profesionales")
      .insert({

        negocio_id,

        nombre,

        especialidad:
          $("profEspecialidad")
            .value
            .trim()
          || null,

        activo: true

      });


  if (error) {

    return msg(
      error.message,
      true
    );

  }


  e.target.reset();


  rellenarNegocios(
    $("profNegocio")
  );


  msg(
    "Profesional creado."
  );


  await cargarProfesionales();

  await llenarProfesionalesHorario();
}


async function cargarProfesionales() {

  const negocio_id =

    $("profNegocio")?.value ||

    negocios[0]?.id;


  if (!negocio_id) {

    if ($("listaProfesionalesSA")) {

      $("listaProfesionalesSA").innerHTML = `
        <div class="sin-resultados">
          Todavía no hay negocios.
        </div>
      `;

    }

    return;
  }


  $("profNegocio").value =
    negocio_id;


  const {
    data,
    error
  } =
    await db
      .from("profesionales")
      .select(
        "id,nombre,especialidad,activo,usuario_id"
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

      </div>

    `).join("")

    ||

    `
      <div class="sin-resultados">
        Sin profesionales.
      </div>
    `;
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
    $("servNombre")
      .value
      .trim();


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


  if (
    !duracion ||
    duracion <= 0
  ) {

    return msg(
      "La duración debe ser mayor a 0.",
      true
    );

  }


  const payload = {

    negocio_id,

    nombre,

    descripcion:
      $("servDescripcion")
        .value
        .trim()
      || null,

    duracion_minutos:
      duracion,

    precio:
      Number(
        $("servPrecio").value ||
        0
      ),

    activo:
      true

  };


  const { error } =
    await db
      .from("servicios")
      .insert(payload);


  if (error) {

    return msg(
      error.message,
      true
    );

  }


  e.target.reset();


  rellenarNegocios(
    $("servNegocio")
  );


  $("servDuracion").value =
    60;


  msg(
    "Servicio creado."
  );


  await cargarServicios();
}


async function cargarServicios() {

  const negocio_id =

    $("servNegocio")?.value ||

    negocios[0]?.id;


  if (!negocio_id) {

    if ($("listaServiciosSA")) {

      $("listaServiciosSA").innerHTML = `
        <div class="sin-resultados">
          Todavía no hay negocios.
        </div>
      `;

    }

    return;
  }


  $("servNegocio").value =
    negocio_id;


  const {
    data,
    error
  } =
    await db
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

      </div>

    `).join("")

    ||

    `
      <div class="sin-resultados">
        Sin servicios.
      </div>
    `;
}


/* =========================================================
   HORARIOS - PROFESIONALES
========================================================= */

async function llenarProfesionalesHorario() {

  const negocio_id =

    $("horNegocio")?.value ||

    negocios[0]?.id;


  if (!negocio_id) {

    $("horProfesional").innerHTML = `
      <option value="">
        Sin negocios
      </option>
    `;

    $("horServicio").innerHTML = `
      <option value="">
        Sin servicios
      </option>
    `;

    return;
  }


  $("horNegocio").value =
    negocio_id;


  const {
    data,
    error
  } =
    await db
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

    `
      <option value="">
        Selecciona
      </option>
    `

    +

    (data || []).map(p => `

      <option value="${p.id}">
        ${AR.escape(p.nombre)}
      </option>

    `).join("");


  $("horServicio").innerHTML = `
    <option value="">
      Selecciona profesional
    </option>
  `;
}


/* =========================================================
   HORARIOS - SERVICIOS
========================================================= */

async function llenarServiciosHorario() {

  const profesional_id =
    $("horProfesional").value;


  if (!profesional_id) {

    $("horServicio").innerHTML = `
      <option value="">
        Selecciona profesional
      </option>
    `;

    return;
  }


  const negocio_id =
    $("horNegocio").value;


  const {
    data,
    error
  } =
    await db
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

    `
      <option value="">
        Selecciona
      </option>
    `

    +

    (data || []).map(s => `

      <option value="${s.id}">
        ${AR.escape(s.nombre)}
      </option>

    `).join("");
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
  ).padStart(
    2,
    "0"
  )}:${String(
    total % 60
  ).padStart(
    2,
    "0"
  )}:00`;
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
  } =
    await db
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


  /*
    Asociamos el servicio
    al profesional automáticamente.
  */

  const {
    error: asignacionError
  } =
    await db
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


  const { error } =
    await db
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
   ICONO DEL SERVICIO
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
   CARGAR HORARIOS
   AGRUPADOS POR DÍA → PROFESIONAL → HORA
========================================================= */

async function cargarHorarios() {

  const negocio_id =

    $("horNegocio")?.value ||

    negocios[0]?.id;


  if (!negocio_id) {

    if ($("listaHorariosSA")) {

      $("listaHorariosSA").innerHTML = `
        <div class="sin-resultados">
          Todavía no hay negocios.
        </div>
      `;

    }

    return;
  }


  $("horNegocio").value =
    negocio_id;


  /*
    Buscar profesionales
    del negocio.
  */

  const {
    data: profesionalesNegocio,
    error: profError
  } =
    await db
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
    profesionalesNegocio ||
    [];


  const idsProfesionales =
    profesionales.map(
      p => p.id
    );


  if (!idsProfesionales.length) {

    $("listaHorariosSA").innerHTML = `
      <div class="sin-resultados">
        Sin profesionales.
      </div>
    `;

    return;
  }


  /*
    Buscar horarios
  */

  const {
    data,
    error
  } =
    await db
      .from("horarios")
      .select(`
        id,
        profesional_id,
        servicio_id,
        dia_semana,
        hora_sl
