import { getChatGPTUser } from "./chatgpt-auth";
import source from "./data/plan.json";
import DeliveryConsole from "./delivery-console";
import type { Plan } from "../lib/delivery";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user=await getChatGPTUser();
  return <DeliveryConsole plan={source as unknown as Plan} viewer={user ? user.displayName : null}/>;
}
