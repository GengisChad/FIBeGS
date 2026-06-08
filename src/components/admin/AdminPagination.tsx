import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdminPaginationProps {
  page: number;
  totalItems: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export const ADMIN_PAGE_SIZE = 25;

export const useAdminPagination = <T,>(items: T[], pageSize = ADMIN_PAGE_SIZE) => {
  const totalPages = Math.ceil(items.length / pageSize);
  return {
    totalPages,
    pageSize,
    getPageItems: (page: number) => items.slice(page * pageSize, (page + 1) * pageSize),
  };
};

const AdminPagination = ({ page, totalItems, pageSize = ADMIN_PAGE_SIZE, onPageChange }: AdminPaginationProps) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-border">
      <Button variant="outline" size="sm" disabled={page === 0} onClick={() => onPageChange(page - 1)} className="gap-1">
        <ChevronLeft size={14} /> Prec
      </Button>
      <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
      <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => onPageChange(page + 1)} className="gap-1">
        Succ <ChevronRight size={14} />
      </Button>
    </div>
  );
};

export default AdminPagination;
