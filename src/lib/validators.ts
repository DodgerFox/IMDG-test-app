import { z } from 'zod';

// Auth response can come in several shapes -- accept common variants.
export const AuthTokenSchema = z.object({
  token: z.string().optional(),
  lifeTime: z.number().optional(),
});

export const LoginResponseSchema = z
  .object({
    access: AuthTokenSchema.optional(),
    refresh: AuthTokenSchema.optional(),
    access_token: z.string().optional(),
    refresh_token: z.string().optional(),
    token: z.string().optional(),
  })
  .passthrough();

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export function parseLoginResponse(obj: unknown) {
  const res = LoginResponseSchema.safeParse(obj);
  if (!res.success) {
    throw new Error('invalid-auth-response');
  }
  return res.data as LoginResponse;
}

// IMDG list is an array of unknown objects coming from upstream; validate as array
// IMDG items: object with string keys and unknown values
export const IMDGItemSchema = z.record(z.string(), z.unknown());
export const IMDGListSchema = z.array(IMDGItemSchema);

export function parseIMDGList(obj: unknown) {
  const res = IMDGListSchema.safeParse(obj);
  if (!res.success) return [] as Array<Record<string, unknown>>;
  return res.data;
}
