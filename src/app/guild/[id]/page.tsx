"use client";

import { use } from "react";
import { GuildGate } from "@/components/guild/gate";
import { GuildVisit } from "@/components/guild/guild-visit";

export default function VisitPage({ params }: PageProps<"/guild/[id]">) {
  const { id } = use(params);
  return <GuildGate>{(s) => <GuildVisit id={id} session={s} />}</GuildGate>;
}
