"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MemberForm, type MemberSchema } from "@/components/forms/member-form";
import { fetchMembers, createMember, updateMember, toggleMemberActive } from "@/lib/services/members";
import { formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import type { Member } from "@/lib/types";
import { Edit, UserPlus, Power, Search } from "lucide-react";

export default function GuildMembersPage() {
  const params = useParams<{ gid: string }>();
  const guildId = params.gid;
  const toast = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const membersQuery = useQuery({
    queryKey: ["guild", guildId, "members", { search, showInactive }],
    queryFn: () =>
      fetchMembers(guildId, {
        search: search || undefined,
        active: showInactive ? undefined : true,
      }),
    enabled: Boolean(guildId),
  });

  const createMutation = useMutation({
    mutationFn: (payload: MemberSchema) =>
      createMember(guildId, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "members"] });
      toast({
        title: "Member added",
        description: "The guild roster has been updated.",
      });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Failed to add member",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: MemberSchema) => {
      if (!selectedMember) throw new Error("Member not found");
      return updateMember(guildId, selectedMember.id, {
        in_game_name: payload.in_game_name,
        role_in_guild: payload.role_in_guild,
        join_date: payload.join_date,
        notes: payload.notes,
        contact: payload.discord ? { discord: payload.discord } : {},
        is_active: payload.is_active,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "members"] });
      toast({
        title: "Member updated",
        description: "Member details have been saved.",
      });
      setDialogOpen(false);
      setSelectedMember(null);
    },
    onError: (error) => {
      toast({
        title: "Failed to update member",
        description: error.message,
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ member, nextState }: { member: Member; nextState: boolean }) =>
      toggleMemberActive(guildId, member.id, nextState),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["guild", guildId, "members"] });
      toast({
        title: "Member status updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
      });
    },
  });

  const members = membersQuery.data?.members ?? [];
  const total = membersQuery.data?.total ?? 0;

  const emptyState = !membersQuery.isLoading && members.length === 0;
  const isSaving = createMutation.isPending || updateMutation.isPending;

  const defaultValues = useMemo<MemberSchema | undefined>(() => {
    if (!selectedMember) return undefined;
    return {
      in_game_name: selectedMember.in_game_name,
      role_in_guild: selectedMember.role_in_guild,
      join_date: selectedMember.join_date ?? undefined,
      discord:
        typeof selectedMember.contact?.discord === "string"
          ? (selectedMember.contact.discord as string)
          : "",
      notes: selectedMember.notes ?? "",
      is_active: selectedMember.is_active,
    };
  }, [selectedMember]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Guild members</h2>
          <p className="text-sm text-muted-foreground">
            Manage the roster, raid roles, and activity status of your members.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              className="rounded-full px-4"
              onClick={() => {
                setSelectedMember(null);
                setDialogOpen(true);
              }}
            >
              <UserPlus className="mr-2 h-4 w-4" />
              Add member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedMember ? "Edit member" : "Member baru"}</DialogTitle>
            </DialogHeader>
            <MemberForm
              defaultValues={defaultValues}
              loading={isSaving}
              onSubmit={async (values) => {
                if (selectedMember) {
                  await updateMutation.mutateAsync(values);
                  return;
                }
                await createMutation.mutateAsync(values);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Roster</CardTitle>
            <CardDescription>{total} members in total</CardDescription>
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center rounded-full border border-border/60 bg-muted/20 px-3">
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search members"
                className="border-0 bg-transparent focus-visible:ring-0"
              />
            </div>
            <Button
              variant={showInactive ? "default" : "outline"}
              className="rounded-full"
              onClick={() => setShowInactive((prev) => !prev)}
            >
              {showInactive ? "Show active only" : "Show inactive members"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {membersQuery.isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
              <Skeleton className="h-16 rounded-3xl" />
            </div>
          )}
          {emptyState && (
            <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border/60 p-12 text-center">
              <UserPlus className="h-8 w-8 text-muted-foreground" />
              <div>
                <h3 className="text-lg font-semibold">No members yet</h3>
                <p className="text-sm text-muted-foreground">
                  Add guild members to start tracking your roster.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelectedMember(null);
                  setDialogOpen(true);
                }}
                className="rounded-full"
              >
                Add member
              </Button>
            </div>
          )}
          {!membersQuery.isLoading && members.length > 0 && (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary/20 text-sm font-semibold uppercase text-secondary-foreground">
                          {member.in_game_name
                            .split(" ")
                            .map((part) => part[0])
                            .join("")
                            .slice(0, 2)}
                        </div>
                        <div>
                          <p className="font-semibold">{member.in_game_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {member.contact && typeof member.contact.discord === "string"
                              ? member.contact.discord
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{member.role_in_guild}</TableCell>
                    <TableCell>{formatDate(member.join_date ?? "")}</TableCell>
                    <TableCell>
                      <Badge variant={member.is_active ? "success" : "secondary"}>
                        {member.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedMember(member);
                            setDialogOpen(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleMutation.mutate({
                              member,
                              nextState: !member.is_active,
                            })
                          }
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
