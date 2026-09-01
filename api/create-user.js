import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método no permitido"
    });
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRole) {
      return res.status(500).json({
        error: "Faltan variables de Supabase en Vercel."
      });
    }

    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        error: "Sesión no válida."
      });
    }

    const admin = createClient(supabaseUrl, serviceRole, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Comprobar quién está haciendo la petición
    const {
      data: { user },
      error: userError
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return res.status(401).json({
        error: "No se pudo validar tu sesión."
      });
    }

    // Comprobar que realmente sea súper admin
    const { data: superAdmin, error: superError } = await admin
      .from("super_admins")
      .select("usuario_id")
      .eq("usuario_id", user.id)
      .eq("activo", true)
      .maybeSingle();

    if (superError || !superAdmin) {
      return res.status(403).json({
        error: "Solo el súper admin puede crear accesos."
      });
    }

    const {
      negocio_id,
      rol,
      nombre,
      especialidad,
      email,
      password
    } = req.body || {};

    if (!negocio_id || !rol || !email || !password) {
      return res.status(400).json({
        error: "Faltan datos obligatorios."
      });
    }

    if (!["admin", "profesional"].includes(rol)) {
      return res.status(400).json({
        error: "Rol no válido."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "La contraseña debe tener al menos 6 caracteres."
      });
    }

    // Crear usuario en Supabase Auth
    const {
      data: nuevo,
      error: createError
    } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true
    });

    if (createError) {
      return res.status(400).json({
        error: createError.message
      });
    }

    const nuevoId = nuevo.user.id;

    // Crear membresía
    const { error: memberError } = await admin
      .from("miembros_negocio")
      .insert({
        negocio_id,
        usuario_id: nuevoId,
        es_admin: rol === "admin",
        es_profesional: rol === "profesional",
        activo: true
      });

    if (memberError) {
      await admin.auth.admin.deleteUser(nuevoId);

      return res.status(400).json({
        error: memberError.message
      });
    }

    // Si es profesional, crear también su registro
    if (rol === "profesional") {
      const { error: profError } = await admin
        .from("profesionales")
        .insert({
          negocio_id,
          usuario_id: nuevoId,
          nombre: nombre?.trim() || email,
          especialidad: especialidad?.trim() || null,
          activo: true
        });

      if (profError) {
        await admin
          .from("miembros_negocio")
          .delete()
          .eq("usuario_id", nuevoId)
          .eq("negocio_id", negocio_id);

        await admin.auth.admin.deleteUser(nuevoId);

        return res.status(400).json({
          error: profError.message
        });
      }
    }

    return res.status(200).json({
      ok: true,
      usuario_id: nuevoId
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Ocurrió un error al crear el acceso."
    });
  }
}
