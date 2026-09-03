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
  $("btnCambiarPasswordSA")?.addEventListener("click", abrirPasswordSA);
  $("btnCancelarPasswordSA")?.addEventListener("click", cerrarPasswordSA);
  $("btnGuardarPasswordSA")?.addEventListener("click", guardarPasswordSA);
  $("modalPasswordSA")?.addEventListener("click", e => {
    if (e.target === $("modalPasswordSA")) cerrarPasswordSA();
  });

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
  $("negocioLogoArchivo")?.addEventListener("change", e => previsualizarArchivo(e.target.files?.[0], "negocioLogoPreview"));
  $("editNegocioLogoArchivo")?.addEventListener("change", e => previsualizarArchivo(e.target.files?.[0], "editNegocioLogoPreview"));
  $("formEditarNegocio")?.addEventListener("submit", guardarEdicionNegocio);
  $("btnCancelarEditarNegocio")?.addEventListener("click", cerrarEditarNegocio);
  $("formUsuario").onsubmit = crearUsuario;
  $("formProfesional").onsubmit = crearProfesional;
  $("formServicioSA").onsubmit = crearServicio;
  $("formHorarioSA").onsubmit = crearHorario;
  if ($("btnCopiarHorarioSA")) $("btnCopiarHorarioSA").onclick = copiarHorarioSA;
  if ($("btnAbrirCopiarHorarioSA")) $("btnAbrirCopiarHorarioSA").onclick = abrirModalCopiarHorarioSA;
  if ($("btnCerrarCopiarHorarioSA")) $("btnCerrarCopiarHorarioSA").onclick = cerrarModalCopiarHorarioSA;
  if ($("btnCancelarCopiarHorarioSA")) $("btnCancelarCopiarHorarioSA").onclick = cerrarModalCopiarHorarioSA;
  if ($("modalCopiarHorarioSA")) $("modalCopiarHorarioSA").onclick = e => { if(e.target === $("modalCopiarHorarioSA")) cerrarModalCopiarHorarioSA(); };

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
    .select("id,nombre,activo,whatsapp,logo_url,color_marca,direccion,mensaje_confirmacion")
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
          <span class="sa-badge">${n.activo ? "Activo" : "Inactivo"}</span><div class="sa-muted">${AR.escape(n.whatsapp || "Sin WhatsApp")}</div>
          <div class="sa-actions">
            <button type="button" onclick="editarNegocio('${n.id}')">✏️ Editar</button><button type="button" onclick="copiarAgenda('${n.id}')">🔗 Copiar agenda</button>
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

async function subirLogoNegocio(archivo, negocioId) {
  if (!archivo) return null;
  if (!archivo.type.startsWith("image/")) throw new Error("Selecciona una imagen válida.");
  if (archivo.size > 5 * 1024 * 1024) throw new Error("El logo debe pesar menos de 5 MB.");
  const ext = (archivo.name.split(".").pop() || "jpg").toLowerCase();
  const ruta = `${negocioId}/${Date.now()}.${ext}`;
  const { error } = await db.storage.from("logos-negocios").upload(ruta, archivo, { upsert: true, contentType: archivo.type });
  if (error) throw error;
  const { data } = db.storage.from("logos-negocios").getPublicUrl(ruta);
  return data.publicUrl;
}

function previsualizarArchivo(archivo, idImg) {
  const img = $(idImg); if (!img || !archivo) return;
  img.src = URL.createObjectURL(archivo); img.style.display = "block";
}

async function crearNegocio(e) {
  e.preventDefault(); clearMsg();
  const nombre = $("negocioNombre").value.trim();
  if (!nombre) return msg("Escribe el nombre del negocio.", true);
  const whatsapp = ($("negocioWhatsapp")?.value || "").replace(/\D/g, "");
  if (whatsapp && whatsapp.length !== 10) return msg("El WhatsApp debe tener exactamente 10 dígitos.", true);
  const color = ($("negocioColor")?.value || "#7b55da").trim();
  if (color && !/^#[0-9a-f]{6}$/i.test(color)) return msg("El color debe ser HEX, por ejemplo #7b55da.", true);
  const { data, error } = await db.from("negocios").insert({nombre,whatsapp:whatsapp||null,direccion:($("negocioDireccion")?.value||"").trim()||null,color_marca:color||"#7b55da",mensaje_confirmacion:($("negocioMensaje")?.value||"").trim()||null,activo:true}).select("id").single();
  if (error) return msg(error.message,true);
  try {
    const archivo=$("negocioLogoArchivo")?.files?.[0];
    if(archivo){ const url=await subirLogoNegocio(archivo,data.id); await db.from("negocios").update({logo_url:url}).eq("id",data.id); }
  } catch(err){ return msg("Negocio creado, pero el logo no se pudo subir: "+err.message,true); }
  e.target.reset(); $("negocioColor").value="#7b55da"; $("negocioLogoPreview").style.display="none";
  msg("Negocio creado correctamente."); await cargarNegocios();
  await Promise.all([cargarProfesionales(),cargarServicios(),cargarHorarios(),cargarCitas()]);
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

  const whatsapp = ($("profWhatsapp")?.value || "").replace(/\D/g, "").slice(0, 10);
  if (whatsapp && !/^\d{10}$/.test(whatsapp)) return msg("El WhatsApp debe tener 10 dígitos.", true);

  const { error } = await db
    .from("profesionales")
    .insert({
      negocio_id,
      nombre,
      especialidad:
        $("profEspecialidad").value.trim() || null,
      whatsapp: whatsapp || null,
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
      "id,nombre,especialidad,whatsapp,activo,usuario_id"
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
        <div class="sa-muted">📱 ${AR.escape(p.whatsapp || "Sin WhatsApp")}</div>

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

    if ($("horServiciosChecks")) $("horServiciosChecks").innerHTML = '<span style="font-size:13px;color:#81778a;">Sin servicios</span>';

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

  if ($("horServiciosChecks")) $("horServiciosChecks").innerHTML = '<span style="font-size:13px;color:#81778a;">Selecciona un profesional</span>';
}


/* =========================================================
   SELECT DE SERVICIOS PARA HORARIOS
========================================================= */

async function llenarServiciosHorario() {
  const profesional_id=$("horProfesional").value; const cont=$("horServiciosChecks");
  if(!profesional_id){cont.innerHTML='<span style="font-size:13px;color:#81778a;">Selecciona un profesional</span>';return;}
  const negocio_id=$("horNegocio").value;
  const {data:asigs,error:e1}=await db.from('profesional_servicios').select('servicio_id').eq('profesional_id',profesional_id); if(e1)return msg(e1.message,true);
  const ids=(asigs||[]).map(x=>x.servicio_id);
  let q=db.from('servicios').select('id,nombre,duracion_minutos').eq('negocio_id',negocio_id).eq('activo',true).order('nombre'); if(ids.length) q=q.in('id',ids); else {cont.innerHTML='<span style="font-size:13px;color:#81778a;">Este profesional no tiene servicios asignados.</span>';return;}
  const {data,error}=await q;if(error)return msg(error.message,true);
  cont.innerHTML=(data||[]).map(s=>`<label style="display:flex;align-items:center;gap:9px;margin:0;padding:8px;background:#fff;border-radius:10px;font-size:13px;font-weight:600"><input class="hor-servicio-check" type="checkbox" value="${s.id}" data-duracion="${Number(s.duracion_minutos||60)}" style="width:auto"> ${AR.escape(s.nombre)}</label>`).join('')||'<span>Sin servicios.</span>';
}
function serviciosHorarioSeleccionadosSA(){return [...document.querySelectorAll('.hor-servicio-check:checked')].map(x=>({id:x.value,duracion:Number(x.dataset.duracion||60)}));}


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
  e.preventDefault(); const profesional_id=$("horProfesional").value; const servicios=serviciosHorarioSeleccionadosSA(); const hora=$("horHora").value; const dia=Number($("horDia").value);
  if(!profesional_id||!servicios.length||!hora)return msg('Completa profesional, al menos un servicio y hora.',true);
  for(const sv of servicios){const {error:asig}=await db.from('profesional_servicios').upsert({profesional_id,servicio_id:sv.id},{onConflict:'profesional_id,servicio_id',ignoreDuplicates:true});if(asig)return msg(asig.message,true);}
  const hi=hora+':00'; const ids=servicios.map(x=>x.id); const {data:existentes,error:e0}=await db.from('horarios').select('servicio_id').eq('profesional_id',profesional_id).eq('dia_semana',dia).eq('hora_slot',hi).eq('activo',true).in('servicio_id',ids);if(e0)return msg(e0.message,true);const ya=new Set((existentes||[]).map(x=>x.servicio_id));
  const payload=servicios.filter(x=>!ya.has(x.id)).map(x=>({profesional_id,servicio_id:x.id,dia_semana:dia,hora_slot:hi,hora_inicio:hi,hora_fin:sumarMinutos(hora,x.duracion),activo:true}));
  if(!payload.length)return msg('Ese horario ya existe para los servicios seleccionados.',true);const {error}=await db.from('horarios').insert(payload);if(error)return msg(error.message,true);msg(`Horario agregado a ${payload.length} servicio${payload.length===1?'':'s'}.`);$("horHora").value='';await cargarHorarios();
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


  /* Crear menús plegables por día y profesional */
  let html = "";
  for (let dia=1; dia<=7; dia++) {
    const profesionalesDia=agrupados[dia];
    if(!profesionalesDia) continue;
    const totalDia=Object.values(profesionalesDia).reduce((n,horas)=>n+Object.keys(horas).length,0);
    html += `<details style="background:#fff;border:1px solid #e5e0eb;border-radius:16px;margin-bottom:10px;overflow:hidden;">
      <summary style="cursor:pointer;padding:14px;font-size:15px;font-weight:800;color:#7255a8;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
        <span>${dias[dia]}</span><span style="font-size:11px;color:#81778a;text-transform:none">${totalDia} horario${totalDia===1?'':'s'} ▾</span>
      </summary><div style="padding:0 12px 12px;">`;
    Object.keys(profesionalesDia).forEach(profesional_id=>{
      const nombreProfesional=mapaProfesionales[profesional_id]||'Profesional';
      const horas=Object.values(profesionalesDia[profesional_id]).sort((a,b)=>a.hora.localeCompare(b.hora));
      html += `<details style="border-top:1px solid #f1edf4;"><summary style="cursor:pointer;padding:11px 4px;font-weight:700;font-size:14px;display:flex;justify-content:space-between"><span>${AR.escape(nombreProfesional)}</span><span style="font-size:11px;color:#81778a">${horas.length} ▾</span></summary><div style="padding:0 4px 8px;">`;
      horas.forEach(slot=>{
        const serviciosHTML=slot.servicios.map(servicio=>`<span style="display:inline-flex;align-items:center;gap:4px;background:#f3eef9;color:#654a99;padding:4px 8px;border-radius:999px;font-size:11px;font-weight:600;">${iconoServicio(servicio.nombre)} ${AR.escape(servicio.nombre)} ${servicio.activo?'':'(inactivo)'}<button type="button" title="Editar" onclick="editarHorarioSA('${servicio.horario_id}')" style="border:0;background:transparent;padding:0 0 0 3px;color:inherit">✏️</button><button type="button" title="${servicio.activo?'Desactivar':'Activar'}" onclick="toggleHorario('${servicio.horario_id}',${!!servicio.activo})" style="border:0;background:transparent;padding:0;color:inherit">${servicio.activo?'⏸':'▶'}</button><button type="button" title="Eliminar" onclick="eliminarHorarioSA('${servicio.horario_id}')" style="border:0;background:transparent;padding:0;color:inherit">×</button></span>`).join('');
        html += `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-top:1px solid #f5f1f6;flex-wrap:wrap"><div style="min-width:48px;font-weight:800;font-size:13px">${slot.hora}</div><div style="display:flex;gap:5px;flex-wrap:wrap">${serviciosHTML}</div></div>`;
      });
      html += `</div></details>`;
    });
    html += `</div></details>`;
  }
  $("listaHorariosSA").innerHTML=html||'<div class="sin-resultados">Sin horarios.</div>';
}

function abrirModalCopiarHorarioSA(){
  if(!$(`horProfesional`)?.value) return msg("Selecciona primero un profesional.",true);
  const modal=$("modalCopiarHorarioSA"); if(modal) modal.style.display="flex";
}
function cerrarModalCopiarHorarioSA(){ const modal=$("modalCopiarHorarioSA"); if(modal) modal.style.display="none"; }

async function copiarHorarioSA(){
  clearMsg();const profesionalId=$("horProfesional")?.value,origen=Number($("saCopiarOrigen")?.value);const destinos=[...document.querySelectorAll('#saCopiarDestinos input:checked')].map(x=>Number(x.value)).filter(x=>x!==origen);if(!profesionalId)return msg('Selecciona profesional.',true);if(!destinos.length)return msg('Selecciona al menos un día destino diferente al origen.',true);const btn=$("btnCopiarHorarioSA");btn.disabled=true;btn.textContent='Copiando...';
  try{const {data:origenes,error:e1}=await db.from('horarios').select('servicio_id,hora_slot,hora_inicio,hora_fin').eq('profesional_id',profesionalId).eq('dia_semana',origen).eq('activo',true);if(e1)throw e1;if(!origenes?.length)return msg(`No hay horarios activos en ${dias[origen]}.`,true);const {data:existentes,error:e2}=await db.from('horarios').select('dia_semana,servicio_id,hora_slot,hora_inicio').eq('profesional_id',profesionalId).in('dia_semana',destinos).eq('activo',true);if(e2)throw e2;const norm=h=>String(h||'').slice(0,8),keys=new Set((existentes||[]).map(h=>`${h.dia_semana}|${h.servicio_id}|${norm(h.hora_slot||h.hora_inicio)}`)),inserts=[];destinos.forEach(d=>origenes.forEach(h=>{const hi=norm(h.hora_slot||h.hora_inicio),k=`${d}|${h.servicio_id}|${hi}`;if(!keys.has(k)){inserts.push({profesional_id:profesionalId,servicio_id:h.servicio_id,dia_semana:d,hora_slot:hi,hora_inicio:hi,hora_fin:h.hora_fin,activo:true});keys.add(k);}}));if(!inserts.length)return msg('Los días seleccionados ya tenían esos horarios.');const {error}=await db.from('horarios').insert(inserts);if(error)throw error;document.querySelectorAll('#saCopiarDestinos input').forEach(x=>x.checked=false);cerrarModalCopiarHorarioSA();msg(`Se copiaron ${inserts.length} horarios.`);await cargarHorarios();}catch(e){msg(e?.message||'No fue posible copiar los horarios.',true);}finally{btn.disabled=false;btn.textContent='📋 Copiar horario';}
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
  const actual = negocios.find(n => n.id === id); if (!actual) return;
  $("editNegocioId").value=id; $("editNegocioNombre").value=actual.nombre||"";
  $("editNegocioWhatsapp").value=actual.whatsapp||""; $("editNegocioDireccion").value=actual.direccion||"";
  $("editNegocioLogo").value=actual.logo_url||""; $("editNegocioColor").value=actual.color_marca||"#7b55da";
  $("editNegocioMensaje").value=actual.mensaje_confirmacion||""; $("editNegocioLogoArchivo").value="";
  const img=$("editNegocioLogoPreview"); if(actual.logo_url){img.src=actual.logo_url;img.style.display="block";}else img.style.display="none";
  $("modalEditarNegocio").style.display="block";
}
function cerrarEditarNegocio(){ $("modalEditarNegocio").style.display="none"; }
async function guardarEdicionNegocio(e){
  e.preventDefault(); const id=$("editNegocioId").value; const whatsapp=$("editNegocioWhatsapp").value.replace(/\D/g,"");
  if(whatsapp && whatsapp.length!==10) return msg("El WhatsApp debe tener exactamente 10 dígitos.",true);
  const color=$("editNegocioColor").value.trim()||"#7b55da"; if(!/^#[0-9a-f]{6}$/i.test(color)) return msg("El color debe ser HEX, por ejemplo #7b55da.",true);
  let logo_url=$("editNegocioLogo").value||null;
  try{ const archivo=$("editNegocioLogoArchivo")?.files?.[0]; if(archivo) logo_url=await subirLogoNegocio(archivo,id); }catch(err){return msg("No se pudo subir el logo: "+err.message,true);}
  const {error}=await db.from("negocios").update({nombre:$("editNegocioNombre").value.trim(),whatsapp:whatsapp||null,direccion:$("editNegocioDireccion").value.trim()||null,logo_url,color_marca:color,mensaje_confirmacion:$("editNegocioMensaje").value.trim()||null}).eq("id",id);
  if(error)return msg(error.message,true); cerrarEditarNegocio(); msg("Negocio actualizado."); await cargarNegocios(); await cargarUsuarios();
}


async function copiarAgenda(id) {
  const url = `${location.origin}/?negocio=${encodeURIComponent(id)}`;
  try { await navigator.clipboard.writeText(url); msg("Liga de agenda copiada."); }
  catch { prompt("Copia esta liga:", url); }
}
window.copiarAgenda = copiarAgenda;
async function toggleNegocio(id,activo){const {error}=await db.from("negocios").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Negocio desactivado.":"Negocio activado.");await cargarNegocios();}
async function eliminarNegocio(id){if(!confirm("¿Eliminar este negocio? También puede afectar sus datos relacionados."))return;const {error}=await db.from("negocios").delete().eq("id",id);if(error)return msg("No se pudo eliminar: "+error.message,true);msg("Negocio eliminado.");await cargarNegocios();}
async function editarProfesional(id){const {data:p,error:e}=await db.from("profesionales").select("nombre,especialidad,whatsapp").eq("id",id).single();if(e)return msg(e.message,true);const nombre=prompt("Nombre:",p.nombre||"");if(!nombre?.trim())return;const especialidad=prompt("Especialidad:",p.especialidad||"");const w=prompt("WhatsApp (10 dígitos):",p.whatsapp||"");if(w===null)return;const whatsapp=String(w).replace(/\D/g,"").slice(0,10);if(whatsapp&&!/^\d{10}$/.test(whatsapp))return msg("El WhatsApp debe tener 10 dígitos.",true);const {error}=await db.from("profesionales").update({nombre:nombre.trim(),especialidad:especialidad?.trim()||null,whatsapp:whatsapp||null}).eq("id",id);if(error)return msg(error.message,true);msg("Profesional actualizado.");await cargarProfesionales();}
async function toggleProfesional(id,activo){const {error}=await db.from("profesionales").update({activo:!activo}).eq("id",id);if(error)return msg(error.message,true);msg(activo?"Profesional desactivado.":"Profesional activado.");await Promise.all([cargarProfesionales(),llenarProfesionalesHorario()]);}
async function eliminarProfesional(id){if(!confirm("¿Eliminar este profesional?"))return;const {error}=await db.from("profesionales").delete().eq("id",id);if(error)return msg(error.message,true);msg("Profesional eliminado.");await cargarProfesionales();}
async function editarServicio(id){const {data:s,error:e}=await db.from("servicios").select("nombre,descripcion,duracion_minutos,precio,modalidad").eq("id",id).single();if(e)return msg(e.message,true);const nombre=prompt("Nombre:",s.nombre||"");if(!nombre?.trim())return;const descripcion=prompt("Descripción:",s.descripcion||"");const dur=Number(prompt("Duración en minutos:",s.duracion_minutos||60));if(!dur)return;const precio=prompt("Precio:",s.precio??"");const modalidad=prompt("Modalidad: presencial o en_linea",s.modalidad||"presencial");if(!["presencial","en_linea"].includes(modalidad))return msg("Modalidad no válida.",true);const {error}=await db.from("servicios").update({nombre:nombre.trim(),descripcion:descripcion?.trim()||null,duracion_minutos:dur,precio:precio===""?null:Number(precio),modalidad}).eq("id",id);if(error)return msg(error.message,true);msg("Servicio actualizado.");await cargarServicios();}
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
    cont.innerHTML=(out.usuarios||[]).map(u=>`<div class="sa-item"><h4>${AR.escape(u.email||"Usuario")}</h4><div class="sa-muted">${AR.escape(nm[u.negocio_id]||"Negocio")} · ${u.es_admin?"Administrador":u.es_profesional?"Profesional":"Sin rol"} · ${u.activo?"Activo":"Inactivo"}</div><div class="sa-actions"><button type="button" onclick="editarUsuarioSA('${u.usuario_id}','${u.negocio_id}','${u.es_admin?"admin":"profesional"}','${AR.escape(u.email||"")}')">✏️ Editar</button><button type="button" onclick="restablecerPasswordUsuarioSA('${u.usuario_id}','${u.negocio_id}','${AR.escape(u.email||"")}')">🔑 Restablecer contraseña</button><button type="button" onclick="toggleUsuarioSA('${u.usuario_id}','${u.negocio_id}',${!!u.activo})">${u.activo?"⏸️ Desactivar":"▶️ Activar"}</button><button type="button" onclick="eliminarUsuarioSA('${u.usuario_id}')">🗑️ Eliminar</button></div></div>`).join("")||'<div class="sin-resultados">Sin usuarios.</div>';
  } catch(e){cont.innerHTML=`<div class="sin-resultados">${AR.escape(e.message)}</div>`;}
}
async function editarUsuarioSA(usuario_id,negocio_id,rol,emailActual){
  const email=prompt("Correo:",emailActual); if(!email)return; const nuevoRol=prompt("Rol (admin/profesional):",rol); if(!["admin","profesional"].includes(nuevoRol))return msg("Rol no válido.",true); const password=prompt("Nueva contraseña (déjala vacía para conservarla):","");
  const {data:{session}}=await db.auth.getSession(); const r=await fetch("/api/manage-users",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id,negocio_id,rol:nuevoRol,email,password:password||undefined})}); const out=await r.json(); if(!r.ok)return msg(out.error||"No se pudo editar.",true); msg("Usuario actualizado."); await cargarUsuarios();
}

async function restablecerPasswordUsuarioSA(usuario_id, negocio_id, email) {
  const temporal = prompt(
    `Nueva contraseña temporal para ${email || "este usuario"}:\n\nMínimo 8 caracteres.`
  );

  if (temporal === null) return;

  if (temporal.length < 8) {
    return msg("La contraseña temporal debe tener al menos 8 caracteres.", true);
  }

  const confirmar = prompt(
    "Confirma la contraseña temporal:"
  );

  if (confirmar === null) return;

  if (temporal !== confirmar) {
    return msg("Las contraseñas no coinciden.", true);
  }

  const { data: { session } } = await db.auth.getSession();

  if (!session) {
    return msg("Tu sesión expiró.", true);
  }

  const r = await fetch("/api/manage-users", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      usuario_id,
      negocio_id,
      password: temporal
    })
  });

  const out = await r.json();

  if (!r.ok) {
    return msg(out.error || "No se pudo restablecer la contraseña.", true);
  }

  msg(
    `Contraseña restablecida para ${email || "el usuario"}. Envíale la contraseña temporal y pídele que la cambie al iniciar sesión.`
  );
}

async function toggleUsuarioSA(usuario_id,negocio_id,activo){const {data:{session}}=await db.auth.getSession();if(!session)return msg("Tu sesión expiró.",true);const r=await fetch("/api/manage-users",{method:"PATCH",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id,negocio_id,activo:!activo})});const out=await r.json();if(!r.ok)return msg(out.error||"No se pudo cambiar el estado.",true);msg(activo?"Usuario desactivado.":"Usuario activado.");await cargarUsuarios();}
async function eliminarUsuarioSA(usuario_id){if(!confirm("¿Eliminar este acceso de usuario?"))return; const {data:{session}}=await db.auth.getSession(); const r=await fetch("/api/manage-users",{method:"DELETE",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({usuario_id})}); const out=await r.json(); if(!r.ok)return msg(out.error||"No se pudo eliminar.",true); msg("Usuario eliminado."); await Promise.all([cargarUsuarios(),cargarProfesionales()]);}

/* =========================================================
   INICIAR
========================================================= */


/* =========================================================
   CUENTA / CONTRASEÑA
========================================================= */

function abrirPasswordSA() {
  $("saNuevaPassword").value = "";
  $("saConfirmarPassword").value = "";
  const m = $("saPasswordMensaje");
  m.style.display = "none";
  m.textContent = "";
  m.style.background = "#f5f1fb";
  m.style.color = "#604b80";
  $("modalPasswordSA").style.display = "flex";
  setTimeout(() => $("saNuevaPassword").focus(), 50);
}

function cerrarPasswordSA() {
  $("modalPasswordSA").style.display = "none";
}

function passwordMsgSA(texto, error = false) {
  const m = $("saPasswordMensaje");
  m.textContent = texto;
  m.style.display = "block";
  m.style.background = error ? "#fff0f0" : "#f5f1fb";
  m.style.color = error ? "#a13f3f" : "#604b80";
}

async function guardarPasswordSA() {
  const nueva = $("saNuevaPassword").value;
  const confirmar = $("saConfirmarPassword").value;
  const btn = $("btnGuardarPasswordSA");

  if (!nueva || nueva.length < 8) {
    return passwordMsgSA("La contraseña debe tener al menos 8 caracteres.", true);
  }

  if (nueva !== confirmar) {
    return passwordMsgSA("Las contraseñas no coinciden.", true);
  }

  btn.disabled = true;
  btn.textContent = "Guardando...";

  try {
    const { error } = await db.auth.updateUser({ password: nueva });
    if (error) throw error;

    passwordMsgSA("Contraseña actualizada correctamente.");
    setTimeout(cerrarPasswordSA, 900);
  } catch (error) {
    console.error("Error cambiando contraseña:", error);
    passwordMsgSA(error?.message || "No fue posible cambiar la contraseña.", true);
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar";
  }
}

init();


document.getElementById("negocioWhatsapp")?.addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0,10); });

$("profWhatsapp")?.addEventListener("input",()=>{$("profWhatsapp").value=$("profWhatsapp").value.replace(/\D/g,"").slice(0,10);});
