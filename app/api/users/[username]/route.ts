import { env } from "cloudflare:workers";
import { getAuthenticatedUser, PASSWORD_ITERATIONS, passwordDigest, randomHex } from "../../../../lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ username: string }> }) {
  const actor = await getAuthenticatedUser(request);
  if (!actor) return Response.json({ error: "Sign in to manage accounts." }, { status: 401 });
  if (actor.role !== "admin" && actor.role !== "reviewer") return Response.json({ error: "Only an administrator or reviewer can manage accounts." }, { status: 403 });
  const origin=request.headers.get("origin");if(origin&&new URL(origin).origin!==new URL(request.url).origin)return Response.json({error:"Cross-origin account changes are not allowed."},{status:403});
  const { username } = await context.params;
  let body: any;
  try { body = await request.json(); } catch { return Response.json({ error: "Review the account changes." }, { status: 400 }); }
  const target = await env.DB!.prepare("SELECT username, active FROM delivery_users WHERE username=?").bind(username).first<{username:string;active:number}>();
  if (!target) return Response.json({ error: "Account not found." }, { status: 404 });
  if ((body.role !== undefined || body.newPassword !== undefined) && actor.role !== "admin") return Response.json({ error: "Only an administrator can change roles or reset passwords." }, { status: 403 });
  if (body.role !== undefined) {
    const roles = ["admin", "reviewer", "staff", "delegated_reviewer", "viewer"];
    if (!roles.includes(body.role)) return Response.json({ error: "Choose a valid account role." }, { status: 400 });
    if (username === actor.username && body.role !== "admin") return Response.json({ error: "You cannot remove your own administrator role." }, { status: 400 });
    if (target.active && body.role !== "admin") {
      const admins = await env.DB!.prepare("SELECT COUNT(*) AS count FROM delivery_users WHERE role='admin' AND active=1").first<{count:number}>();
      const targetRole = await env.DB!.prepare("SELECT role FROM delivery_users WHERE username=?").bind(username).first<{role:string}>();
      if (targetRole?.role === "admin" && (admins?.count ?? 0) <= 1) return Response.json({ error: "The workspace must keep at least one enabled administrator." }, { status: 400 });
    }
    await env.DB!.prepare("UPDATE delivery_users SET role=? WHERE username=?").bind(body.role, username).run();
  }
  if (body.newPassword !== undefined) {
    const next = typeof body.newPassword === "string" ? body.newPassword : "";
    if (next.length < 12 || next.length > 256 || !/[a-z]/.test(next) || !/[A-Z]/.test(next) || !/\d/.test(next) || !/[^A-Za-z0-9]/.test(next)) return Response.json({ error: "Generate a strong password with at least 12 characters, upper and lower case letters, a number, and a symbol." }, { status: 400 });
    const salt = randomHex(16), hash = await passwordDigest(next, salt, PASSWORD_ITERATIONS);
    await env.DB!.prepare("UPDATE delivery_users SET password_salt=?, password_hash=?, password_iterations=? WHERE username=?").bind(salt, hash, PASSWORD_ITERATIONS, username).run();
    await env.DB!.prepare("DELETE FROM delivery_sessions WHERE username=?").bind(username).run();
  }
  if (body.active !== undefined) {
    if (body.active === 0 && target.username === actor.username) return Response.json({ error: "You cannot disable your own account." }, { status: 400 });
    if (body.active !== 0 && body.active !== 1) return Response.json({ error: "Choose enable or disable." }, { status: 400 });
    await env.DB!.prepare("UPDATE delivery_users SET active=? WHERE username=?").bind(body.active, username).run();
    if (body.active === 0) await env.DB!.prepare("DELETE FROM delivery_sessions WHERE username=?").bind(username).run();
  }
  if(body.firstName!==undefined||body.lastName!==undefined||body.email!==undefined||body.timezone!==undefined||body.themeMode!==undefined||body.avatarData!==undefined){
    const row=await env.DB!.prepare("SELECT first_name,last_name,email,timezone,theme_mode,avatar_data FROM delivery_users WHERE username=?").bind(username).first<any>();
    const first=body.firstName===undefined?row.first_name:String(body.firstName).trim(),last=body.lastName===undefined?row.last_name:String(body.lastName).trim(),email=body.email===undefined?row.email:typeof body.email==="string"?body.email.trim().toLowerCase()||null:null,timezone=body.timezone===undefined?row.timezone:body.timezone,theme=body.themeMode===undefined?row.theme_mode:body.themeMode,avatar=body.avatarData===undefined?row.avatar_data:body.avatarData;
    if(!first||first.length>80||last.length>80||(email&&(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254))||!['PDT','PST','PHT'].includes(timezone)||!['default','dark','light'].includes(theme))return Response.json({error:"Enter valid profile values."},{status:400});
    if(avatar&&(!/^data:image\/(png|jpeg|webp|gif);base64,/.test(String(avatar))||String(avatar).length>700000))return Response.json({error:"Profile images must be under 500 KB and use PNG, JPG, WEBP, or GIF."},{status:400});
    try{await env.DB!.prepare("UPDATE delivery_users SET first_name=?,last_name=?,display_name=?,email=?,timezone=?,theme_mode=?,avatar_data=? WHERE username=?").bind(first,last,`${first} ${last}`,email,timezone,theme,avatar,username).run();}catch(error){if(String(error).includes("UNIQUE"))return Response.json({error:"That email is already assigned."},{status:409});throw error;}
  }
  return Response.json({ ok: true });
}
