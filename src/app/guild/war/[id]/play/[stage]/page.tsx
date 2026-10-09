"use client";

import { use } from "react";
import { GuildGate } from "@/components/guild/gate";
import { StagePlay } from "@/components/guild/stage-play";

export default function PlayPage({ params }: PageProps<"/guild/war/[id]/play/[stage]">) {
  const { id, stage } = use(params);
  return <GuildGate>{(s) => <StagePlay key={stage} id={id} stage={stage} session={s} />}</GuildGate>;
}
