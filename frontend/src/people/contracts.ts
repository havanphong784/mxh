import type { User } from "../session";

export type Connection = "followers" | "following";
type PeopleRoute =
  | { kind: "directory"; query: string }
  | { kind: "settings" }
  | { kind: "profile" | Connection; username: string };

type Request = <T>(
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    auth?: boolean;
    signal?: AbortSignal;
  },
) => Promise<T>;

export type Person = Pick<User, "id" | "username" | "displayName" | "avatarUrl" | "bio">;
export type Profile = Person &
  Pick<User, "bannerUrl"> & {
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
  };
export type PrivateProfile = User & {
  avatarPublicId?: string | null;
  bannerPublicId?: string | null;
};
export type PeoplePage = { items: Person[]; nextCursor: string | null };
export type ImageFolder = "avatars" | "banners";
export type ImageReference = { url: string; publicId: string };
type ProfilePatch = {
  displayName?: string;
  bio?: string | null;
  avatarUrl?: string | null;
  avatarPublicId?: string | null;
  bannerUrl?: string | null;
  bannerPublicId?: string | null;
};

export function parsePeoplePath(path: string): PeopleRoute | null {
  const [pathname, search = ""] = path.split(/\?(.*)/s, 2);
  const cleanPath = pathname.replace(/\/$/, "");
  if (cleanPath === "/people")
    return {
      kind: "directory",
      query: new URLSearchParams(search).get("q")?.trim() ?? "",
    };
  if (cleanPath === "/settings") return { kind: "settings" };
  const match = /^\/profile\/([^/]+)(?:\/(followers|following))?$/.exec(cleanPath);
  if (!match) return null;
  try {
    const username = decodeURIComponent(match[1]);
    if (username === "." || username === ".." || /[/\\]/.test(username)) return null;
    const kind =
      match[2] === "followers" ? "followers" : match[2] === "following" ? "following" : "profile";
    return { kind, username };
  } catch {
    return null;
  }
}

export function profileHref(username: string, connection?: Connection): string {
  return `/profile/${encodeURIComponent(username)}${connection ? `/${connection}` : ""}`;
}

export function peopleHref(query: string): string {
  return query.trim() ? `/people?${new URLSearchParams({ q: query.trim() })}` : "/people";
}

export function messageHref(userId: string): string {
  return `/messages?to=${encodeURIComponent(userId)}`;
}

export function searchProblem(query: string): string | null {
  const length = Array.from(query.trim()).length;
  return length < 2 || length > 100 ? "Nhập từ 2 đến 100 ký tự để tìm người dùng." : null;
}

export function passwordProblem(
  oldPassword: string,
  newPassword: string,
  confirm: string,
): string | null {
  if (!oldPassword) return "Nhập mật khẩu hiện tại.";
  if (
    newPassword.length < 8 ||
    newPassword.length > 100 ||
    !/[a-z]/.test(newPassword) ||
    !/[A-Z]/.test(newPassword) ||
    !/\d/.test(newPassword)
  ) {
    return "Dùng từ 8 đến 100 ký tự, có chữ hoa, chữ thường và chữ số.";
  }
  if (newPassword === oldPassword) return "Mật khẩu mới phải khác mật khẩu hiện tại.";
  if (newPassword !== confirm) return "Hai mật khẩu mới không khớp.";
  return null;
}

export function afterFollow(profile: Profile, isFollowing: boolean): Profile {
  if (profile.isFollowing === isFollowing) return profile;
  return {
    ...profile,
    isFollowing,
    followersCount: Math.max(0, profile.followersCount + (isFollowing ? 1 : -1)),
  };
}

export function bumpTimelineForFollow(
  revision: number,
  wasFollowing: boolean,
  isFollowing: boolean,
) {
  return revision + Number(wasFollowing !== isFollowing);
}

export function uniquePeople(existing: Person[], incoming: Person[]): Person[] {
  return [...new Map([...existing, ...incoming].map((person) => [person.id, person])).values()];
}

export function profilePatch(
  original: PrivateProfile,
  text: { displayName: string; bio: string },
  avatar: ImageReference | null | undefined,
  banner: ImageReference | null | undefined,
): ProfilePatch {
  const fields: ProfilePatch = {};
  const displayName = text.displayName.trim();
  const bio = text.bio.trim() || null;
  const nameLength = Array.from(displayName).length;
  if (displayName !== original.displayName && (!nameLength || nameLength > 50))
    throw new Error("Tên hiển thị cần có từ 1 đến 50 ký tự.");
  if (bio && Array.from(bio).length > 250)
    throw new Error("Tiểu sử không được vượt quá 250 ký tự.");
  if (displayName !== original.displayName) fields.displayName = displayName;
  if (bio !== (original.bio || null)) fields.bio = bio;
  if (avatar !== undefined) {
    fields.avatarUrl = avatar?.url ?? null;
    fields.avatarPublicId = avatar?.publicId ?? null;
  }
  if (banner !== undefined) {
    fields.bannerUrl = banner?.url ?? null;
    fields.bannerPublicId = banner?.publicId ?? null;
  }
  return fields;
}

export function updatedViewer(user: User, saved: PrivateProfile): User {
  return {
    ...user,
    displayName: saved.displayName,
    bio: saved.bio,
    avatarUrl: saved.avatarUrl,
    bannerUrl: saved.bannerUrl,
    email: saved.email ?? user.email,
    isEmailVerified: saved.isEmailVerified ?? user.isEmailVerified,
  };
}

export function createPeopleClient(api: Request, upload: typeof fetch = fetch) {
  function pageQuery(cursor: string | null, query?: string) {
    const params = new URLSearchParams({ limit: "20" });
    if (query !== undefined) params.set("q", query);
    if (cursor) params.set("cursor", cursor);
    return params;
  }

  return {
    profile(username: string, auth: boolean, signal?: AbortSignal) {
      return api<Profile>(`/users/${encodeURIComponent(username)}`, {
        auth,
        signal,
      });
    },
    async setFollowing(id: string, follow: boolean) {
      await api(`/users/${encodeURIComponent(id)}/follow`, {
        method: follow ? "POST" : "DELETE",
        auth: true,
      });
      return follow;
    },
    connections(username: string, kind: Connection, cursor: string | null, signal?: AbortSignal) {
      return api<PeoplePage>(
        `/users/${encodeURIComponent(username)}/${kind}?${pageQuery(cursor)}`,
        { auth: false, signal },
      );
    },
    async search(query: string, cursor: string | null, signal?: AbortSignal) {
      const problem = searchProblem(query);
      if (problem) throw new Error(problem);
      return api<PeoplePage>(`/users/search?${pageQuery(cursor, query.trim())}`, {
        auth: false,
        signal,
      });
    },
    suggestions(auth: boolean, signal?: AbortSignal) {
      return api<{ items: Person[] }>("/users/suggestions", { auth, signal });
    },
    settings(signal?: AbortSignal) {
      return api<PrivateProfile>("/users/me", { auth: true, signal });
    },
    saveProfile(body: ProfilePatch, signal?: AbortSignal) {
      return api<PrivateProfile>("/users/me", {
        auth: true,
        method: "PATCH",
        body,
        ...(signal ? { signal } : {}),
      });
    },
    async uploadImage(
      folder: ImageFolder,
      file: File,
      signal?: AbortSignal,
    ): Promise<ImageReference> {
      signal?.throwIfAborted();
      if (!file.type.startsWith("image/") || file.size === 0)
        throw new Error("Chọn tệp ảnh hợp lệ.");
      const signed = await api<{
        cloudName?: string;
        apiKey?: string;
        signature: string;
        timestamp: number;
        folder: string;
        resourceType: string;
      }>(`/media/upload-signature?folder=${folder}&mediaType=image`, {
        auth: true,
        ...(signal && { signal }),
      });
      signal?.throwIfAborted();
      if (
        !signed.cloudName ||
        !signed.apiKey ||
        !signed.signature ||
        signed.resourceType !== "image"
      ) {
        throw new Error("Dịch vụ tải ảnh chưa sẵn sàng.");
      }
      const form = new FormData();
      form.set("file", file);
      form.set("folder", signed.folder);
      form.set("api_key", signed.apiKey);
      form.set("timestamp", String(signed.timestamp));
      form.set("signature", signed.signature);
      const response = await upload(
        `https://api.cloudinary.com/v1_1/${encodeURIComponent(signed.cloudName)}/image/upload`,
        {
          method: "POST",
          body: form,
          credentials: "omit",
          signal,
        },
      );
      if (!response.ok) throw new Error("Không tải được ảnh.");
      const result = (await response.json()) as {
        secure_url?: unknown;
        public_id?: unknown;
      } | null;
      if (
        typeof result?.secure_url !== "string" ||
        !result.secure_url.startsWith("https://res.cloudinary.com/") ||
        typeof result.public_id !== "string" ||
        !result.public_id.startsWith(`${signed.folder}/`)
      ) {
        throw new Error("Dịch vụ tải ảnh trả về dữ liệu không hợp lệ.");
      }
      return { url: result.secure_url, publicId: result.public_id };
    },
    changePassword(oldPassword: string, newPassword: string, logoutOtherDevices: boolean) {
      return api<{ message: string }>("/users/change-password", {
        auth: true,
        method: "POST",
        body: { oldPassword, newPassword, logoutOtherDevices },
      });
    },
    async logout(onUser: (user: null) => void) {
      await api("/auth/logout", { auth: false, method: "POST" });
      onUser(null);
    },
  };
}
