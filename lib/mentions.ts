import { env } from "cloudflare:workers";

export async function notifyMentions(taskId: string, text: string, actorUsername: string, actorName: string) {
  const users = await env.DB!.prepare("SELECT username, display_name FROM delivery_users WHERE active=1").all<{username:string;display_name:string}>();
  const matches = (users.results ?? []).filter((person) => person.username !== actorUsername && (
    text.toLocaleLowerCase().includes(`@${person.display_name.toLocaleLowerCase()}`) ||
    text.toLocaleLowerCase().includes(`@${person.username.toLocaleLowerCase()}`)
  ));
  const now = new Date().toISOString();
  const inserts = matches.map((person) => env.DB!.prepare(`INSERT INTO delivery_notifications
    (id,recipient_username,actor_username,task_id,kind,message,created_at) VALUES (?,?,?,?,?,?,?)`)
    .bind(crypto.randomUUID(),person.username,actorUsername,taskId,"mention",`${actorName} mentioned you on a deliverable.`,now));
  if (inserts.length) await env.DB!.batch(inserts);
}
