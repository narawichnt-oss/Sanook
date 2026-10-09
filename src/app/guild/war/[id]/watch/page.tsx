"use client";

import { use } from "react";
import { GuildGate } from "@/components/guild/gate";
import { WarWatch } from "@/components/guild/war-watch";

export default function WatchPage({ params }: PageProps<"/guild/war/[id]/watch">) {
  const { id } = use(params);
  return <GuildGate>{(s) => <WarWatch id={id} session={s} />}</GuildGate>;
}
