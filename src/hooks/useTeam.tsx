import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type Team = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  region_id: string | null;
  created_by: string;
  disband_at: string | null;
};

export type TeamMember = {
  team_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type TeamInvite = {
  id: string;
  team_id: string;
  invited_user_id: string;
  invited_by: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
};

export type MemberProfile = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export const useTeam = () => {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [pendingOutgoing, setPendingOutgoing] = useState<TeamInvite[]>([]);
  const [acceptedOutgoing, setAcceptedOutgoing] = useState<TeamInvite[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<TeamInvite[]>([]);
  const [incomingProfiles, setIncomingProfiles] = useState<Record<string, MemberProfile>>({});
  const [incomingTeams, setIncomingTeams] = useState<Record<string, Team>>({});
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setTeam(null); setMembers([]); setProfiles({});
      setPendingOutgoing([]); setAcceptedOutgoing([]); setIncomingInvites([]); setLoading(false);
      return;
    }
    setLoading(true);

    // 1) my team
    const { data: myMembership } = await (supabase as any)
      .from("team_members")
      .select("team_id, role, user_id, joined_at")
      .eq("user_id", user.id)
      .maybeSingle();

    let currentTeam: Team | null = null;
    if (myMembership?.team_id) {
      const { data: t } = await (supabase as any)
        .from("teams")
        .select("id, name, slug, description, logo_url, city, region_id, created_by, disband_at")
        .eq("id", myMembership.team_id)
        .maybeSingle();
      currentTeam = (t as Team) || null;
    }
    setTeam(currentTeam);

    // 2) members + pending outgoing invites for that team
    if (currentTeam) {
      const { data: mems } = await (supabase as any)
        .from("team_members")
        .select("team_id, user_id, role, joined_at")
        .eq("team_id", currentTeam.id);
      const memList = (mems || []) as TeamMember[];
      setMembers(memList);

      const { data: outInv } = await (supabase as any)
        .from("team_invites")
        .select("id, team_id, invited_user_id, invited_by, status, created_at")
        .eq("team_id", currentTeam.id)
        .in("status", ["pending", "accepted"]);
      const outgoing = (outInv || []) as TeamInvite[];
      setPendingOutgoing(outgoing.filter(i => i.status === "pending"));
      setAcceptedOutgoing(outgoing.filter(i => i.status === "accepted"));

      const ids = Array.from(new Set([
        ...memList.map(m => m.user_id),
        ...outgoing.map(i => i.invited_user_id),
      ]));
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, username, avatar_url")
          .in("user_id", ids);
        const map: Record<string, MemberProfile> = {};
        (profs || []).forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      } else {
        setProfiles({});
      }
    } else {
      setMembers([]); setProfiles({}); setPendingOutgoing([]); setAcceptedOutgoing([]);
    }

    // 3) incoming invites for me
    const { data: incoming } = await (supabase as any)
      .from("team_invites")
      .select("id, team_id, invited_user_id, invited_by, status, created_at")
      .eq("invited_user_id", user.id)
      .eq("status", "pending");
    const inc = (incoming || []) as TeamInvite[];
    setIncomingInvites(inc);

    if (inc.length > 0) {
      const inviterIds = Array.from(new Set(inc.map(i => i.invited_by)));
      const teamIds = Array.from(new Set(inc.map(i => i.team_id)));
      const [{ data: ip }, { data: tt }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", inviterIds),
        (supabase as any).from("teams").select("id, name, slug, description, logo_url, city, region_id, created_by, disband_at").in("id", teamIds),
      ]);
      const ipMap: Record<string, MemberProfile> = {};
      (ip || []).forEach((p: any) => { ipMap[p.user_id] = p; });
      setIncomingProfiles(ipMap);
      const tMap: Record<string, Team> = {};
      (tt || []).forEach((t: any) => { tMap[t.id] = t; });
      setIncomingTeams(tMap);
    } else {
      setIncomingProfiles({}); setIncomingTeams({});
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`teams-${user.id}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "team_invites" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "team_members" }, () => reload())
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, () => reload())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, reload]);

  const respondToInvite = useCallback(async (inviteId: string, accept: boolean) => {
    const { error } = await (supabase as any)
      .from("team_invites")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", inviteId);
    if (error) toast.error(error.message);
    else toast.success(accept ? "Sei entrato in squadra!" : "Invito rifiutato");
    reload();
  }, [reload]);

  const cancelInvite = useCallback(async (inviteId: string) => {
    const { error } = await (supabase as any).from("team_invites").delete().eq("id", inviteId);
    if (error) toast.error(error.message); else reload();
  }, [reload]);

  const inviteUser = useCallback(async (invitedUserId: string) => {
    if (!user || !team) return false;
    const { error } = await (supabase as any).from("team_invites").insert({
      team_id: team.id, invited_user_id: invitedUserId, invited_by: user.id,
    });
    if (error) { toast.error(error.message); return false; }
    toast.success("Invito inviato"); reload(); return true;
  }, [user, team, reload]);

  const replaceInvite = useCallback(async (inviteId: string, newUserId: string) => {
    if (!user || !team) return false;
    const { error: delErr } = await (supabase as any).from("team_invites").delete().eq("id", inviteId);
    if (delErr) { toast.error(delErr.message); return false; }
    const { error: insErr } = await (supabase as any).from("team_invites").insert({
      team_id: team.id, invited_user_id: newUserId, invited_by: user.id,
    });
    if (insErr) { toast.error(insErr.message); return false; }
    toast.success("Invito sostituito"); reload(); return true;
  }, [user, team, reload]);

  const leaveTeam = useCallback(async () => {
    if (!user || !team) return;
    const { error } = await (supabase as any).from("team_members").delete()
      .eq("team_id", team.id).eq("user_id", user.id);
    if (error) toast.error(error.message);
    else { toast.success("Hai lasciato la squadra"); reload(); }
  }, [user, team, reload]);

  const kickMember = useCallback(async (memberId: string) => {
    if (!user || !team) return;
    const { error } = await (supabase as any).from("team_members").delete()
      .eq("team_id", team.id).eq("user_id", memberId);
    if (error) toast.error(error.message);
    else { toast.success("Membro rimosso"); reload(); }
  }, [user, team, reload]);

  const updateTeamLogo = useCallback(async (file: File) => {
    if (!user || !team) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${team.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("team-logos").upload(path, file, { upsert: false });
    if (upErr) { toast.error("Upload fallito: " + upErr.message); return; }
    const url = supabase.storage.from("team-logos").getPublicUrl(path).data.publicUrl;
    const { error } = await (supabase as any).from("teams").update({ logo_url: url }).eq("id", team.id);
    if (error) toast.error(error.message);
    else { toast.success("Logo aggiornato"); reload(); }
  }, [user, team, reload]);

  const disbandTeam = useCallback(async () => {
    if (!user || !team) return;
    const { error } = await (supabase as any).rpc("disband_team", { _team_id: team.id });
    if (error) toast.error(error.message);
    else { toast.success("Squadra sciolta"); reload(); }
  }, [user, team, reload]);

  const updateTeamInfo = useCallback(async (patch: { description?: string | null; city?: string | null; region_id?: string | null }) => {
    if (!user || !team) return false;
    const { error } = await (supabase as any).from("teams").update(patch).eq("id", team.id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Squadra aggiornata"); reload(); return true;
  }, [user, team, reload]);

  const transferLeadership = useCallback(async (newOwnerId: string) => {
    if (!user || !team) return false;
    const { error } = await (supabase as any).rpc("transfer_team_leadership", { _team_id: team.id, _new_owner: newOwnerId });
    if (error) { toast.error(error.message); return false; }
    toast.success("Ruolo di leader trasferito"); reload(); return true;
  }, [user, team, reload]);

  return {
    team, members, profiles, pendingOutgoing, acceptedOutgoing,
    incomingInvites, incomingProfiles, incomingTeams,
    loading, reload, respondToInvite, cancelInvite, inviteUser, replaceInvite,
    leaveTeam, disbandTeam, kickMember, updateTeamLogo,
    updateTeamInfo, transferLeadership,

    isOwner: !!(team && user && members.find(m => m.user_id === user.id)?.role === "owner"),
  };
};
