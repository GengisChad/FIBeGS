import { useUserRoles } from "@/hooks/useUserRoles";

export const useAdmin = () => {
  const { isAdmin, loading } = useUserRoles();
  return { isAdmin, loading };
};
