export type Visibility = "PUBLIC" | "FOLLOWERS" | "PRIVATE";
export type MediaKind = "image" | "video" | "audio";
export type MediaType = "IMAGE" | "VIDEO" | "AUDIO";
export type Author = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string | null;
};
export type Media = {
  id: string;
  url: string;
  type: MediaType;
  width?: number | null;
  height?: number | null;
  order: number;
};
export type Quote = {
  id: string;
  content: string | null;
  createdAt: string;
  author: Author | null;
  media: Media[];
};
export type ActivePost = Omit<Quote, "author"> & {
  author: Author;
  visibility: Visibility;
  parentId: string | null;
  rootId: string | null;
  repostOfId: string | null;
  repostOf?: Post | null;
  quotedPostId: string | null;
  quotedPost?: Quote | null;
  isQuotedPostDeleted?: boolean;
  isDeleted: false;
  isUnavailable?: false;
  editedAt: string | null;
  counters: {
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number;
    bookmarkCount: number;
  };
  interactions: {
    isLiked: boolean;
    isReposted: boolean;
    isBookmarked: boolean;
  };
};
export type Post =
  | ActivePost
  | {
      id: string;
      createdAt: string;
      isDeleted: true;
      isUnavailable?: false;
      replyCount?: number;
    }
  | {
      id: string;
      createdAt: string;
      isDeleted?: false;
      isUnavailable: true;
      replyCount?: number;
    };
export type Page = { items: Post[]; nextCursor: string | null };
export type PostLikeUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
  likedAt?: string;
};
export type PostLikesPage = {
  items: PostLikeUser[];
  nextCursor: string | null;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};
export type Toggle = "like" | "repost" | "bookmark";
export type Placement = { parentId?: string; quotedPostId?: string };
export const MAX_MEDIA = 10;
export const MAX_CONTENT = 2000;
export const VISIBILITIES: Record<Visibility, string> = {
  PUBLIC: "Công khai",
  FOLLOWERS: "Người theo dõi",
  PRIVATE: "Chỉ mình tôi",
};

export function postPath(id: string) {
  return `/posts/${encodeURIComponent(id)}`;
}
export function profilePath(username: string) {
  return `/profile/${encodeURIComponent(username)}`;
}
export function timelinePath(username: string, replies = false) {
  return `/users/${encodeURIComponent(username)}/${replies ? "replies" : "posts"}`;
}
export function composePath(placement: Placement) {
  const query = new URLSearchParams(placement);
  return query.size ? `/compose?${query}` : "/compose";
}

export type SocialRoute = {
  view: "home" | "explore" | "search" | "bookmarks" | "likes" | "detail" | "compose" | "missing";
  endpoint?: string;
  requiresUser?: boolean;
  postId?: string;
  q?: string;
  mediaOnly?: boolean;
  placement?: Placement;
};
export function resolveSocial(path: string, signedIn: boolean): SocialRoute {
  const { pathname, searchParams } = new URL(path, "https://mxh.invalid");
  const q = (searchParams.get("q") ?? "").trim();
  const mediaOnly = searchParams.get("mediaOnly") === "true";
  const mediaQuery = mediaOnly ? "?mediaOnly=true" : "";
  switch (pathname) {
    case "/":
      return {
        view: "home",
        endpoint: signedIn ? "/posts/feed" : "/posts/explore",
      };
    case "/explore":
      return {
        view: "explore",
        endpoint: "/posts/explore" + mediaQuery,
        mediaOnly,
      };
    case "/search":
      return {
        view: "search",
        q,
        mediaOnly,
        endpoint:
          q.length >= 2 && q.length <= 100
            ? `/posts/search?${new URLSearchParams(mediaOnly ? { q, mediaOnly: "true" } : { q })}`
            : undefined,
      };
    case "/bookmarks":
      return {
        view: "bookmarks",
        endpoint: "/posts/bookmarks",
        requiresUser: true,
      };
    case "/likes":
      return { view: "likes", endpoint: "/posts/liked", requiresUser: true };
    case "/compose": {
      const parentId = searchParams.get("parentId");
      const quotedPostId = searchParams.get("quotedPostId");
      return {
        view: "compose",
        requiresUser: true,
        placement: parentId ? { parentId } : quotedPostId ? { quotedPostId } : {},
      };
    }
    default: {
      const match = /^\/posts\/([^/]+)\/?$/.exec(pathname);
      if (match?.[1]) {
        try {
          return { view: "detail", postId: decodeURIComponent(match[1]) };
        } catch {
          return { view: "missing" };
        }
      }
      return { view: "missing" };
    }
  }
}

export function pagePath(endpoint: string, cursor: string | null) {
  const url = new URL(endpoint, "https://mxh.invalid");
  url.searchParams.set("limit", "20");
  if (cursor !== null) url.searchParams.set("cursor", cursor);
  return url.pathname + url.search;
}

export function appendPage(old: Post[], incoming: Post[]): Post[] {
  const seen = new Set(old.map(({ id }) => id));
  return [...old, ...incoming.filter(({ id }) => !seen.has(id) && Boolean(seen.add(id)))];
}

export function isActive(post?: Post | null): post is ActivePost {
  return Boolean(post && !post.isDeleted && !post.isUnavailable);
}
export function repostTarget(post: Post): ActivePost | undefined {
  if (!isActive(post)) return undefined;
  return post.repostOfId ? (isActive(post.repostOf) ? post.repostOf : undefined) : post;
}

export const TOGGLES = {
  like: ["isLiked", "likeCount"],
  repost: ["isReposted", "repostCount"],
  bookmark: ["isBookmarked", "bookmarkCount"],
} as const;
export function postToggle(post: ActivePost, action: Toggle) {
  const active = !post.interactions[TOGGLES[action][0]];
  return {
    path: `${postPath(post.id)}/${action}`,
    method: active ? "POST" : "DELETE",
    active,
  };
}

export type PostChange = { id: string } & (
  | { kind: "toggle"; action: Toggle; active: boolean; count?: number }
  | { kind: "edit"; post: ActivePost }
  | { kind: "delete" }
  | { kind: "reply" }
);
export function mergePostChange(post: Post, change: PostChange, tombstone = false): Post | null {
  if (!isActive(post)) return post;
  if (post.id === change.id) {
    if (change.kind === "delete") {
      return tombstone
        ? {
            id: post.id,
            isDeleted: true,
            createdAt: post.createdAt,
            replyCount: post.counters.replyCount,
          }
        : null;
    }
    if (change.kind === "edit") {
      const { content, visibility, editedAt } = change.post;
      return { ...post, content, visibility, editedAt };
    }
    if (change.kind === "reply")
      return {
        ...post,
        counters: {
          ...post.counters,
          replyCount: post.counters.replyCount + 1,
        },
      };
    const [flag, counter] = TOGGLES[change.action];
    return {
      ...post,
      interactions: { ...post.interactions, [flag]: change.active },
      counters: {
        ...post.counters,
        [counter]:
          change.count ??
          Math.max(
            0,
            post.counters[counter] + Number(change.active) - Number(post.interactions[flag]),
          ),
      },
    };
  }
  if (post.repostOfId === change.id) {
    if (change.kind === "delete") return tombstone ? { ...post, repostOf: null } : null;
    if (change.kind === "edit" && change.post.visibility !== "PUBLIC")
      return { ...post, repostOf: null };
    if (post.repostOf) return { ...post, repostOf: mergePostChange(post.repostOf, change) };
  }
  if (post.quotedPostId === change.id) {
    if (
      change.kind === "delete" ||
      (change.kind === "edit" && change.post.visibility !== "PUBLIC")
    ) {
      return { ...post, quotedPost: null, isQuotedPostDeleted: true };
    }
    if (change.kind === "edit" && post.quotedPost)
      return {
        ...post,
        quotedPost: { ...post.quotedPost, content: change.post.content },
      };
  }
  return post;
}

const mimeKinds: Record<string, MediaKind> = {
  "image/jpeg": "image",
  "image/png": "image",
  "image/webp": "image",
  "image/gif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/mp4": "audio",
  "audio/wav": "audio",
  "audio/x-wav": "audio",
  "audio/ogg": "audio",
  "audio/webm": "audio",
  "audio/aac": "audio",
};
const extensionKinds: Record<string, MediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  webp: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  ogg: "audio",
  aac: "audio",
};
export function classifyMedia(file: Pick<File, "name" | "type" | "size">): MediaKind {
  const kind =
    file.type && file.type !== "application/octet-stream"
      ? mimeKinds[file.type]
      : extensionKinds[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
  if (!kind) throw new Error(`Định dạng của “${file.name}” chưa được hỗ trợ.`);
  const max = kind === "image" ? 10 : 100;
  if (file.size > max * 1024 * 1024) throw new Error(`“${file.name}” vượt quá ${max} MB.`);
  if (!file.size) throw new Error(`“${file.name}” không có dữ liệu.`);
  return kind;
}

export type UploadSignature = {
  cloudName?: string;
  resourceType: string;
  apiKey?: string;
  folder: string;
  timestamp: number;
  signature: string;
};
export function signedUpload(file: File, signature: UploadSignature) {
  if (
    !signature.cloudName ||
    !signature.apiKey ||
    !signature.signature ||
    !signature.folder ||
    !signature.timestamp ||
    !["image", "video", "raw", "auto"].includes(signature.resourceType)
  ) {
    throw new Error("Máy chủ chưa cấp được chữ ký tải tệp. Hãy thử lại.");
  }
  const body = new FormData();
  body.append("file", file);
  body.append("api_key", signature.apiKey);
  body.append("timestamp", String(signature.timestamp));
  body.append("signature", signature.signature);
  body.append("folder", signature.folder);
  return {
    url: `https://api.cloudinary.com/v1_1/${encodeURIComponent(signature.cloudName)}/${signature.resourceType}/upload`,
    body,
  };
}

export type MediaPayload = {
  publicId: string;
  version: string;
  signature: string;
  type: MediaType;
  width?: number;
  height?: number;
  duration?: number;
  order: number;
};
export function mediaPayload(result: unknown, kind: MediaKind, order: number): MediaPayload {
  const data = result as Record<string, unknown> | null;
  if (
    !data ||
    typeof data.public_id !== "string" ||
    !data.public_id ||
    typeof data.signature !== "string" ||
    !data.signature ||
    !(
      (typeof data.version === "string" && data.version) ||
      (typeof data.version === "number" && Number.isFinite(data.version))
    )
  ) {
    throw new Error("Dịch vụ tệp không trả về thông tin xác thực. Hãy tải lại tệp.");
  }
  const dimensions: Pick<MediaPayload, "width" | "height" | "duration"> = {};
  for (const key of ["width", "height", "duration"] as const) {
    const value = data[key];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (key === "duration" || Number.isInteger(value))
    )
      dimensions[key] = value;
  }
  return {
    publicId: data.public_id,
    version: String(data.version),
    signature: data.signature,
    type: kind.toUpperCase() as MediaType,
    ...dimensions,
    order,
  };
}

export type CreateBody = Placement & {
  content?: string;
  visibility: Visibility;
  media?: MediaPayload[];
};
export function editPayload(
  post: Pick<ActivePost, "parentId">,
  content: string,
  visibility: Visibility,
) {
  return post.parentId ? { content } : { content, visibility };
}
export function composePayload(
  text: string,
  visibility: Visibility,
  media: MediaPayload[],
  placement: Placement,
): CreateBody {
  const content = text.trim();
  if (Array.from(content).length > MAX_CONTENT)
    throw new Error(`Nội dung vượt quá ${MAX_CONTENT} ký tự.`);
  if (media.length > MAX_MEDIA) throw new Error(`Chỉ được đính kèm tối đa ${MAX_MEDIA} tệp.`);
  if (!content && !media.length) throw new Error("Hãy viết nội dung hoặc đính kèm tệp.");
  if (placement.parentId && placement.quotedPostId)
    throw new Error("Không thể vừa trả lời vừa trích dẫn trong một bài.");
  return {
    ...(content ? { content } : {}),
    visibility,
    ...(media.length ? { media } : {}),
    ...placement,
  };
}

export type CreateRequest = { body: string; key: string };
export function createRequest(
  body: CreateBody,
  previous: CreateRequest | null,
  makeKey: () => string = () => crypto.randomUUID(),
): CreateRequest {
  const encoded = JSON.stringify(body);
  return previous?.body === encoded ? previous : { body: encoded, key: makeKey() };
}
