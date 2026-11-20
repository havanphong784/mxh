export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  email?: string;
  isEmailVerified?: boolean;
  createdAt?: string;
}
export interface AuthResult {
  message: string;
  accessToken: string;
  user: User;
}
