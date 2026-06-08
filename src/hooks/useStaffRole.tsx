import { useUserRoles } from "@/hooks/useUserRoles";

export const useStaffRole = () => {
  const { isStaff, loading } = useUserRoles();
  return { isStaff, loading };
};
