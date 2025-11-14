"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MemberForm, type MemberSchema } from "@/components/forms/member-form";
import { MembersSection } from "../sections";
import { membersQueryKey } from "../constants";
import { listMembers, createMember, updateMember, toggleMemberStatus, type MemberListResponse } from "@/lib/api/members";
import { useToast } from "@/components/ui/use-toast";
import type { Member } from "@/lib/types";
import { toApiError } from "@/lib/api/errors";

interface MembersPanelProps {
  guildId?: string;
  canManageMembers: boolean;
}

const PAGE_SIZE = 5;

export function MembersPanel({ guildId, canManageMembers }: MembersPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, showInactive]);

  const membersQuery = useQuery({
    queryKey: guildId ? membersQueryKey(guildId, search, showInactive, page) : [],
    queryFn: async (): Promise<MemberListResponse> =>
      listMembers(guildId!, {
        search: search || undefined,
        active: showInactive ? undefined : true,
        page,
        pageSize: PAGE_SIZE,
      }),
    enabled: Boolean(guildId),
    staleTime: 5 * 1000,
  });

  const invalidateMembers = useCallback(async () => {
    if (!guildId) return;
    await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "members"] });
  }, [guildId, queryClient]);

  const createMutation = useMutation({
    mutationFn: async (payload: MemberSchema) =>
      createMember(guildId!, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date?.trim() ? payload.join_date : null,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      }),
    onSuccess: async () => {
      await invalidateMembers();
      toast({
        title: "Member added",
        description: "The guild roster has been updated.",
      });
      setDialogOpen(false);
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to add member", description: apiError.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: MemberSchema) => {
      if (!selectedMember) throw new Error("Member not selected");
      return updateMember(guildId!, selectedMember.id, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date?.trim() ? payload.join_date : null,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      });
    },
    onSuccess: async () => {
      await invalidateMembers();
      toast({ title: "Member updated", description: "Member details have been saved." });
      setDialogOpen(false);
      setSelectedMember(null);
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to update member", description: apiError.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ member, nextState }: { member: Member; nextState: boolean }) =>
      toggleMemberStatus(guildId!, member.id, nextState),
    onSuccess: async () => {
      await invalidateMembers();
      toast({ title: "Member status updated" });
    },
    onError: async (error) => {
      const apiError = await toApiError(error);
      toast({ title: "Failed to update status", description: apiError.message });
    },
  });

  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);

  const filtersActive = Boolean(search.trim()) || showInactive;
  const defaultValues = useMemo<MemberSchema | undefined>(() => {
    if (!selectedMember) return undefined;
    const contact = (selectedMember.contact ?? {}) as Record<string, unknown>;
    return {
      in_game_name: selectedMember.in_game_name,
      role_in_guild: selectedMember.role_in_guild,
      join_date: selectedMember.join_date ?? undefined,
      notes: selectedMember.notes ?? undefined,
      discord: typeof contact.discord === "string" ? (contact.discord as string) : "",
      is_active: selectedMember.is_active,
    };
  }, [selectedMember]);

  const isLoading = membersQuery.isLoading;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const emptyState = !isLoading && members.length === 0 && !filtersActive;

  return (
    <>
      <MembersSection
        members={members}
        total={total}
        isLoading={isLoading}
        emptyState={emptyState}
        filtersActive={filtersActive}
        canManageMembers={canManageMembers}
        searchValue={searchInput}
        onSearchChange={setSearchInput}
        showInactive={showInactive}
        onToggleInactive={setShowInactive}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onAddMember={() => {
          setSelectedMember(null);
          setDialogOpen(true);
        }}
        onEditMember={(member) => {
          setSelectedMember(member);
          setDialogOpen(true);
        }}
        onToggleMemberStatus={(member, nextState) => toggleMutation.mutate({ member, nextState })}
        isMutating={toggleMutation.isPending}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMember ? "Edit member" : "Add member"}</DialogTitle>
          </DialogHeader>

          <MemberForm
            defaultValues={defaultValues}
            onSubmit={async (values) => {
              if (selectedMember) {
                await updateMutation.mutateAsync(values);
              } else {
                await createMutation.mutateAsync(values);
              }
            }}
            loading={isSaving}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
