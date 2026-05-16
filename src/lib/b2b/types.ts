export type B2BProspect = {
  id: string;
  organizationId: string;
  eduType: 'BUYER' | 'INQUIRER';
  name: string;
  phone: string;
  email?: string | null;
  productName?: string | null;
  paymentAmount?: number | null;
  paymentDate?: string | null;
  notes?: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type B2BProspectListResponse = {
  ok: true;
  prospects: B2BProspect[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type B2BProspectCreateRequest = {
  name: string;
  phone: string;
  email?: string;
  productName?: string;
  paymentAmount?: number;
  paymentDate?: string;
  notes?: string;
  status: string;
  eduType: 'BUYER' | 'INQUIRER';
};

export type B2BProspectUpdateRequest = {
  name?: string;
  email?: string;
  productName?: string;
  paymentAmount?: number;
  paymentDate?: string;
  notes?: string;
  status?: string;
};

export type ApiErrorResponse = {
  ok: false;
  error: string;
};
