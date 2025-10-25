import { useQuery } from "@tanstack/react-query";
import { fetchGuilds } from "@/lib/api/guilds";

export function useGuilds() {
  return useQuery({
    queryKey: ["guilds"],
    queryFn: fetchGuilds,
    staleTime: 60_000,
  });
}
