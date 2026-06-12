export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  roles?: string[];
}

export interface AuthContext {
  token: string;
  user: AuthUser;
}
