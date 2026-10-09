"use client";

import { GuildBase } from "@/components/guild/guild-base";
import { GuildFinder } from "@/components/guild/finder";
import { GuildGate } from "@/components/guild/gate";

export default function GuildPage() {
  return <GuildGate>{(s) => (s.me.guild ? <GuildBase session={s} /> : <GuildFinder session={s} />)}</GuildGate>;
}
