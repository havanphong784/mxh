import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import type { User } from "../session";
import type { createPeopleClient, ImageFolder, ImageReference, PrivateProfile } from "./contracts";
import { passwordProblem, profileHref, profilePatch, updatedViewer } from "./contracts";
import { Avatar, errorText, LoadFailure, useResource } from "./shared";

type Client = ReturnType<typeof createPeopleClient>;
type ImageEdit = File | ImageReference | null | undefined;
type Feedback = { error?: string; status?: string };

function Notice({ feedback }: { feedback: Feedback }) {
  return (
    <>
      {feedback.error && (
        <p className="people-feedback people-error" role="alert">
          {feedback.error}
        </p>
      )}
      <p className="people-feedback people-success" role="status">
        {feedback.status}
      </p>
    </>
  );
}

function ImageField({
  folder,
  value,
  original,
  person,
  onChange,
}: {
  folder: ImageFolder;
  value: ImageEdit;
  original?: string | null;
  person: User;
  onChange: (next: ImageEdit) => void;
}) {
  const avatar = folder === "avatars";
  const label = avatar ? "Ảnh đại diện" : "Ảnh bìa";
  const [problem, setProblem] = useState("");
  const [preview, setPreview] = useState("");
  const file = value instanceof File ? value : null;
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const src =
    value === undefined ? original : file ? preview : (value as ImageReference | null)?.url;

  const reset = (next: ImageEdit) => {
    setProblem("");
    onChange(next);
  };
  return (
    <div className="people-image-field">
      <label htmlFor={`people-${folder}`}>{label}</label>
      {avatar ? (
        <Avatar person={{ ...person, avatarUrl: src }} />
      ) : (
        <div className="people-cover people-cover-preview" aria-hidden="true">
          {src && <img src={src} alt="" />}
        </div>
      )}
      <input
        id={`people-${folder}`}
        type="file"
        accept="image/*"
        onChange={(event) => {
          const selected = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!selected) return;
          if (!selected.type.startsWith("image/") || !selected.size)
            setProblem("Chọn tệp ảnh hợp lệ.");
          else reset(selected);
        }}
      />
      {file && <span className="people-handle people-file-name">{file.name}</span>}
      {problem && (
        <p className="people-feedback people-error" role="alert">
          {problem}
        </p>
      )}
      <div className="people-image-actions">
        {(src || file) && (
          <button
            className="people-text-button"
            type="button"
            onClick={() => reset(original ? null : undefined)}
          >
            Xóa {avatar ? "ảnh đại diện" : "ảnh bìa"}
          </button>
        )}
        {value !== undefined && (
          <button className="people-text-button" type="button" onClick={() => reset(undefined)}>
            Hoàn tác thay đổi
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileForm({
  client,
  initial,
  onSaved,
  onBusy,
  busy,
}: {
  client: Client;
  initial: PrivateProfile;
  onSaved: (profile: PrivateProfile) => void;
  onBusy: (busy: boolean) => void;
  busy: boolean;
}) {
  const [original, setOriginal] = useState(initial);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio ?? "");
  const [avatar, setAvatar] = useState<ImageEdit>();
  const [banner, setBanner] = useState<ImageEdit>();
  const [feedback, setFeedback] = useState<Feedback>({});
  const inFlight = useRef<AbortController | null>(null);
  useEffect(() => () => inFlight.current?.abort(), []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || busy) return;
    const controller = new AbortController();
    inFlight.current = controller;
    onBusy(true);
    setFeedback({});
    try {
      const text = { displayName, bio };
      // Validate text before creating any remote assets.
      const textPatch = profilePatch(original, text, undefined, undefined);
      if (!Object.keys(textPatch).length && avatar === undefined && banner === undefined) {
        setFeedback({ status: "Chưa có thay đổi để lưu." });
        return;
      }
      async function upload(
        folder: ImageFolder,
        edit: ImageEdit,
        stage: (next: ImageReference) => void,
      ) {
        if (!(edit instanceof File)) return edit;
        setFeedback({
          status: folder === "avatars" ? "Đang tải ảnh đại diện…" : "Đang tải ảnh bìa…",
        });
        const image = await client.uploadImage(folder, edit, controller.signal);
        controller.signal.throwIfAborted();
        stage(image); // Keep the upload on retry if a later step fails.
        return image;
      }
      const nextAvatar = await upload("avatars", avatar, setAvatar);
      const nextBanner = await upload("banners", banner, setBanner);
      controller.signal.throwIfAborted();
      setFeedback({ status: "Đang lưu hồ sơ…" });
      const saved = await client.saveProfile(
        profilePatch(original, text, nextAvatar, nextBanner),
        controller.signal,
      );
      controller.signal.throwIfAborted();
      setOriginal(saved);
      setDisplayName(saved.displayName);
      setBio(saved.bio ?? "");
      setAvatar(undefined);
      setBanner(undefined);
      onSaved(saved);
      setFeedback({ status: "Đã lưu hồ sơ." });
    } catch (failure) {
      if (!controller.signal.aborted)
        setFeedback({
          error: errorText(failure, "Không lưu được hồ sơ. Thử lại."),
        });
    } finally {
      inFlight.current = null;
      if (!controller.signal.aborted) onBusy(false);
    }
  }

  return (
    <form className="people-form" onSubmit={save}>
      <fieldset className="people-fields" disabled={busy}>
        <div className="people-field">
          <label htmlFor="people-name">Tên hiển thị</label>
          <input
            id="people-name"
            autoComplete="nickname"
            value={displayName}
            required
            maxLength={100}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setFeedback({});
            }}
          />
        </div>
        <div className="people-field">
          <label htmlFor="people-bio">Tiểu sử</label>
          <textarea
            id="people-bio"
            rows={3}
            value={bio}
            maxLength={500}
            aria-describedby="people-bio-limit"
            onChange={(event) => {
              setBio(event.target.value);
              setFeedback({});
            }}
          />
          <span className="people-handle" id="people-bio-limit">
            Tối đa 250 ký tự.
          </span>
        </div>
        <div className="people-image-grid">
          <ImageField
            folder="avatars"
            value={avatar}
            original={original.avatarUrl}
            person={original}
            onChange={(image) => {
              setAvatar(image);
              setFeedback({});
            }}
          />
          <ImageField
            folder="banners"
            value={banner}
            original={original.bannerUrl}
            person={original}
            onChange={(image) => {
              setBanner(image);
              setFeedback({});
            }}
          />
        </div>
        <button className="button button-primary" type="submit">
          Lưu hồ sơ
        </button>
      </fieldset>
      <Notice feedback={feedback} />
    </form>
  );
}

function PasswordForm({ client, blocked }: { client: Client; blocked: boolean }) {
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirm, setConfirm] = useState("");
  const [logoutOthers, setLogoutOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({});
  const lock = useRef(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (blocked || lock.current) return;
    const problem = passwordProblem(oldPassword, newPassword, confirm);
    if (problem) {
      setFeedback({ error: problem });
      return;
    }
    lock.current = true;
    setBusy(true);
    setFeedback({ status: "Đang đổi mật khẩu…" });
    try {
      await client.changePassword(oldPassword, newPassword, logoutOthers);
      setOld("");
      setNew("");
      setConfirm("");
      setFeedback({
        status: logoutOthers
          ? "Đã đổi mật khẩu và đăng xuất các thiết bị khác."
          : "Đã đổi mật khẩu.",
      });
    } catch (failure) {
      setFeedback({
        error: errorText(failure, "Không đổi được mật khẩu. Thử lại."),
      });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="people-form" onSubmit={submit}>
      <fieldset className="people-fields" disabled={busy || blocked}>
        <div className="people-field">
          <label htmlFor="people-password-old">Mật khẩu hiện tại</label>
          <input
            id="people-password-old"
            type="password"
            autoComplete="current-password"
            required
            value={oldPassword}
            onChange={(event) => setOld(event.target.value)}
          />
        </div>
        <div className="people-field">
          <label htmlFor="people-password-new">Mật khẩu mới</label>
          <input
            id="people-password-new"
            type="password"
            autoComplete="new-password"
            required
            value={newPassword}
            minLength={8}
            maxLength={100}
            aria-describedby="people-password-rules"
            onChange={(event) => setNew(event.target.value)}
          />
          <span className="people-handle" id="people-password-rules">
            Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.
          </span>
        </div>
        <div className="people-field">
          <label htmlFor="people-password-confirm">Nhập lại mật khẩu mới</label>
          <input
            id="people-password-confirm"
            type="password"
            autoComplete="new-password"
            required
            maxLength={100}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </div>
        <label className="people-check">
          <input
            type="checkbox"
            checked={logoutOthers}
            onChange={(event) => setLogoutOthers(event.target.checked)}
          />
          Đăng xuất trên các thiết bị khác
        </label>
        <button className="button button-primary" type="submit">
          Đổi mật khẩu
        </button>
      </fieldset>
      <Notice feedback={feedback} />
    </form>
  );
}

export function Settings({
  client,
  user,
  onUser,
}: {
  client: Client;
  user: User;
  onUser: (user: User | null) => void;
}) {
  const { value: profile, error, setValue, reload } = useResource(client.settings);
  const [saving, setSaving] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({});
  const lock = useRef(false);

  async function logout() {
    if (lock.current || saving) return;
    lock.current = true;
    setLogoutBusy(true);
    setFeedback({ status: "Đang đăng xuất…" });
    try {
      await client.logout(onUser);
    } catch (failure) {
      setFeedback({
        error: errorText(failure, "Không đăng xuất được. Thử lại."),
      });
    } finally {
      lock.current = false;
      setLogoutBusy(false);
    }
  }

  const account = profile ?? user;
  return (
    <div className="people-panel people-settings">
      <header className="people-section-head">
        <h1>Cài đặt</h1>
        <a className="people-back" href={profileHref(user.username)}>
          Xem hồ sơ của bạn
        </a>
      </header>
      <section className="people-setting-section" aria-labelledby="people-edit-title">
        <h2 id="people-edit-title">Hồ sơ công khai</h2>
        <p className="people-handle">Tên, tiểu sử và ảnh hiển thị trên hồ sơ của bạn.</p>
        {error ? (
          <LoadFailure title="Không tải được hồ sơ" error={error} retry={reload} />
        ) : profile ? (
          <ProfileForm
            client={client}
            initial={profile}
            onBusy={setSaving}
            busy={saving || logoutBusy}
            onSaved={(saved) => {
              setValue(saved);
              onUser(updatedViewer(user, saved));
            }}
          />
        ) : (
          <p role="status" className="people-handle">
            Đang tải hồ sơ…
          </p>
        )}
      </section>
      <section className="people-setting-section" aria-labelledby="people-account-title">
        <h2 id="people-account-title">Tài khoản</h2>
        <dl className="people-account">
          <div>
            <dt>Tên người dùng</dt>
            <dd>@{account.username}</dd>
          </div>
          {account.email && (
            <div>
              <dt>Email</dt>
              <dd>{account.email}</dd>
            </div>
          )}
          {account.isEmailVerified !== undefined && (
            <div>
              <dt>Xác minh email</dt>
              <dd>{account.isEmailVerified ? "Đã xác minh" : "Chưa xác minh"}</dd>
            </div>
          )}
        </dl>
      </section>
      <section className="people-setting-section" aria-labelledby="people-password-title">
        <h2 id="people-password-title">Đổi mật khẩu</h2>
        <PasswordForm client={client} blocked={logoutBusy} />
      </section>
      <section className="people-setting-section" aria-labelledby="people-session-title">
        <h2 id="people-session-title">Phiên đăng nhập</h2>
        <p className="people-handle">Kết thúc phiên đăng nhập trên thiết bị này.</p>
        <button
          className="button"
          type="button"
          disabled={saving || logoutBusy}
          onClick={() => void logout()}
        >
          Đăng xuất
        </button>
        <Notice feedback={feedback} />
      </section>
    </div>
  );
}
