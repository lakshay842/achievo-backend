export interface Pagination {
  page: number;
  limit: number;
  skip: number;
}

export function getPagination(query: { page?: number; limit?: number }): Pagination {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;
  return { page, limit, skip: (page - 1) * limit };
}

export function pageMeta(total: number, page: number, limit: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
