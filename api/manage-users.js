import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRole) return res.status(500).json({error:"Faltan variables de Supabase en Vercel."});
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({error:"Sesión no válida."});
  const admin = createClient(supabaseUrl, serviceRole, {auth:{autoRefreshToken:false,persistSession:false}});
  const {data:{user}} = await admin.auth.getUser(token);
  if (!user) return res.status(401).json({error:"Sesión no válida."});
  const {data: sa} = await admin.from("super_admins").select("usuario_id").eq("usuario_id",user.id).eq("activo",true).maybeSingle();
  if (!sa) return res.status(403).json({error:"Solo el súper admin puede administrar usuarios."});

  if (req.method === "GET") {
    const {data: members, error} = await admin.from("miembros_negocio").select("negocio_id,usuario_id,es_admin,es_profesional,activo");
    if (error) return res.status(400).json({error:error.message});
    const {data: authData, error: authError} = await admin.auth.admin.listUsers({page:1,perPage:1000});
    if (authError) return res.status(400).json({error:authError.message});
    const emails = Object.fromEntries((authData.users||[]).map(u=>[u.id,u.email]));
    return res.status(200).json({usuarios:(members||[]).map(m=>({...m,email:emails[m.usuario_id]||""}))});
  }

  if (req.method === "PATCH") {
    const {usuario_id, negocio_id, rol, activo, email, password} = req.body||{};
    if (!usuario_id || !negocio_id) return res.status(400).json({error:"Faltan datos."});
    const changes={};
    if (email) changes.email=email.trim().toLowerCase();
    if (password) changes.password=password;
    if (Object.keys(changes).length) {
      const {error} = await admin.auth.admin.updateUserById(usuario_id, changes);
      if (error) return res.status(400).json({error:error.message});
    }
    const member={activo: activo !== false};
    if (rol) { member.es_admin=rol==="admin"; member.es_profesional=rol==="profesional"; }
    const {error} = await admin.from("miembros_negocio").update(member).eq("usuario_id",usuario_id).eq("negocio_id",negocio_id);
    if (error) return res.status(400).json({error:error.message});
    return res.status(200).json({ok:true});
  }

  if (req.method === "DELETE") {
    const {usuario_id} = req.body||{};
    if (!usuario_id) return res.status(400).json({error:"Falta usuario_id."});
    const {error} = await admin.auth.admin.deleteUser(usuario_id);
    if (error) return res.status(400).json({error:error.message});
    return res.status(200).json({ok:true});
  }
  return res.status(405).json({error:"Método no permitido"});
}
