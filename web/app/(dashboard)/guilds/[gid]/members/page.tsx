"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { deriveGuildRole, getGuildPermissions } from "@/lib/permissions";
import { useDashboardGuild } from "@/components/dashboard/dashboard-guild-context";
import { MembersPanel } from "./_components/members-panel";
import { AccessControlPanel } from "./_components/access-control-panel";
import { InviteLinksPanel } from "./_components/invite-links-panel";
import { AuditLogPanel } from "./_components/audit-log-panel";

export default function GuildMembersPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params?.gid;
  const { selectedGuild, changeGuild } = useDashboardGuild();

  useEffect(() => {
    if (guildId && !selectedGuild) {
      changeGuild(guildId);
    }
  }, [guildId, selectedGuild, changeGuild]);

  const { user } = useAuth();

  const guildRole = useMemo(() => deriveGuildRole(user ?? null, guildId), [user, guildId]);
  const permissions = useMemo(() => getGuildPermissions(guildRole), [guildRole]);
  const [lastInviteInfo, setLastInviteInfo] = useState<{
    email?: string | null;
    token?: string | null;
    url?: string | null;
  } | null>(null);

  return (
    <>
      <header className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Members</h1>
          <p className="text-sm text-muted-foreground">
            Manage guild roster, profile information, and active states.
          </p>
        </div>
      </header>

      <div className="space-y-6">
        <MembersPanel guildId={guildId} canManageMembers={permissions.canManageMembers} />

        <AccessControlPanel
          guildId={guildId}
          canManageRoles={permissions.canManageRoles}
          onInviteGenerated={setLastInviteInfo}
        />

        <InviteLinksPanel
          guildId={guildId}
          canManageInvites={permissions.canManageInvites}
          lastInviteInfo={lastInviteInfo}
          onLastInviteInfoChange={setLastInviteInfo}
        />

        <AuditLogPanel guildId={guildId} canViewAudit={permissions.canViewAudit} />
      </div>
    </>
  );
}
