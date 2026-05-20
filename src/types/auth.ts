export interface AuthSession {
  userId: string;
  role: string;
  organizationId: string | null;
  member: {
    id: string;
    organizationId: string;
    role: string;
    displayName: string | null;
  } | null;
  mallUser?: {
    id: number;
    name: string | null;
    mallUserId: string | null;
    affiliateType: string | null;
    affiliateProfileId: number | null;
  };
}
