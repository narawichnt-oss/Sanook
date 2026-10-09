"use client";

import { use } from "react";
import { GuildGate } from "@/components/guild/gate";
import { WarMap } from "@/components/guild/war-map";

export default function WarPage({ params }: PageProps<"/guild/war/[id]">) {
  const { id } = use(params);
  return <GuildGate>{(s) => <WarMap id={id} session={s} />}</GuildGate>;
}
