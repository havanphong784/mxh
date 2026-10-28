export interface AuthUserDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  bio: string | null;
  isEmailVerified: boolean;
  createdAt: any;
}

export interface AuthResultDto {
  message: string;
  accessToken: string;
  refreshToken: string;
  user: AuthUserDto;
}

export interface AuthResponseDto {
  message: string;
  accessToken: string;
  user: AuthUserDto;
}

export interface RefreshResultDto {
  message: string;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResponseDto {
  message: string;
  accessToken: string;
}

export interface MessageResponseDto {
  message: string;
}

export interface RegisterResponseDto {
  message: string;
  email: string;
}
