import { useState } from "react";
import type { FormEvent } from "react";
import { api } from "./api";
import { safeReturn } from "./routes";
import type { AuthResult } from "./session";
import { Icon, Logo } from "./ui";
import { ThemeToggle } from "./theme";

const info = {
  "/login": ["Đăng nhập", "Tiếp tục theo dõi những người và câu chuyện bạn quan tâm."],
  "/register": ["Tạo tài khoản", "Chọn tên hiển thị và tên người dùng để bắt đầu."],
  "/verify-otp": ["Xác minh email", "Nhập mã 6 chữ số đã gửi vào hộp thư của bạn."],
  "/forgot-password": ["Quên mật khẩu", "Nhập email tài khoản để nhận mã đặt lại mật khẩu."],
  "/reset-password": ["Đặt lại mật khẩu", "Nhập mã trong email và chọn một mật khẩu mới."],
} as const;

export function Auth({
  path,
  onLogin,
  navigate,
}: {
  path: string;
  onLogin: (result: AuthResult) => void;
  navigate: (path: string, replace?: boolean) => void;
}) {
  const [route, query] = path.split("?");
  const params = new URLSearchParams(query);
  const next = safeReturn(params.get("next"));
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const login = route === "/login",
    register = route === "/register",
    verify = route === "/verify-otp",
    reset = route === "/reset-password";
  const [title, subtitle] = info[route as keyof typeof info] ?? info["/login"];
  const carry = (to: string, address = email) =>
    `${to}?${new URLSearchParams({ email: address.trim(), next })}`;
  const post = <T,>(suffix: string, body: object) =>
    api<T>(`/auth${suffix}`, { method: "POST", body, auth: false });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const values = new FormData(event.currentTarget);
    const body = { email: email.trim() };
    const value = (key: string) => String(values.get(key) ?? "");
    try {
      if (login || verify) {
        const result = await post<AuthResult>(route, {
          ...body,
          ...(login ? { password: value("password") } : { code: value("code") }),
        });
        onLogin(result);
        navigate(next, true);
      } else if (register) {
        const result = await post<{ email: string }>(route, {
          ...body,
          displayName: value("displayName"),
          username: value("username"),
          password: value("password"),
        });
        navigate(carry("/verify-otp", result.email));
      } else if (reset) {
        await post(route, {
          ...body,
          code: value("code"),
          newPassword: value("password"),
        });
        navigate(`${carry("/login")}&reset=1`, true);
      } else {
        await post(route, body);
        navigate(carry("/reset-password"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không thể kết nối. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await post("/resend-otp", { email: email.trim() });
      setMessage("Đã gửi lại mã. Hãy kiểm tra email.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không gửi được mã. Hãy thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate-page">
      <header className="gate-head">
        <Logo />
        <div className="gate-head-actions">
          <ThemeToggle />
          <a className="text-link" href="/explore">
            Khám phá bài viết <Icon name="arrow" size={17} />
          </a>
        </div>
      </header>
      <main id="noi-dung" className="gate-main" tabIndex={-1}>
        <aside className="gate-story">
          <div>
            <p className="story-title">
              Một chỗ để <br />
              trò chuyện<span>.</span>
            </p>
            <p>
              Đọc điều bạn quan tâm. Viết điều bạn muốn chia sẻ. Nối tiếp câu chuyện trong tin nhắn.
            </p>
          </div>
        </aside>
        <section className="gate-form">
          <h1>{title}</h1>
          <p className="gate-helper">{subtitle}</p>
          {(message || params.get("reset") === "1") && (
            <p className="notice" role="status">
              {message || "Mật khẩu đã được cập nhật."}
            </p>
          )}
          {error && (
            <p className="notice is-error" role="alert">
              {error}
            </p>
          )}
          <form onSubmit={submit}>
            {register && (
              <>
                <label>
                  Tên hiển thị
                  <input
                    name="displayName"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <label>
                  Tên người dùng
                  <input
                    name="username"
                    autoComplete="username"
                    pattern="[A-Za-z0-9_]{3,30}"
                    title="3–30 chữ cái, chữ số hoặc dấu gạch dưới"
                    minLength={3}
                    maxLength={30}
                    required
                  />
                </label>
              </>
            )}
            <label>
              Email
              <input
                type="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="ban@example.com"
                required
                maxLength={255}
              />
            </label>
            {(verify || reset) && (
              <label>
                Mã xác minh
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                />
              </label>
            )}
            {(login || register || reset) && (
              <label>
                {reset ? "Mật khẩu mới" : "Mật khẩu"}
                <input
                  type="password"
                  name="password"
                  autoComplete={login ? "current-password" : "new-password"}
                  minLength={login ? 6 : 8}
                  maxLength={100}
                  pattern={login ? undefined : "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,100}"}
                  required
                  aria-describedby={!login ? "password-hint" : undefined}
                />
                {!login && (
                  <small id="password-hint">
                    Ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số.
                  </small>
                )}
              </label>
            )}
            {login && (
              <a className="gate-forgot" href={carry("/forgot-password")}>
                Quên mật khẩu?
              </a>
            )}
            <button className="button button-primary gate-submit" disabled={busy}>
              {busy
                ? "Đang xử lý…"
                : login
                  ? "Đăng nhập"
                  : register
                    ? "Tạo tài khoản"
                    : verify
                      ? "Xác minh email"
                      : reset
                        ? "Lưu mật khẩu mới"
                        : "Gửi mã đặt lại"}{" "}
              {!busy && <Icon name="arrow" size={18} />}
            </button>
          </form>
          <div className="gate-foot">
            {login ? (
              <>
                Chưa có tài khoản? <a href={carry("/register")}>Đăng ký</a>
              </>
            ) : (
              <a href={carry("/login")}>Quay lại đăng nhập</a>
            )}
            {verify && (
              <button
                type="button"
                className="link-button"
                disabled={busy || !email.trim()}
                onClick={resend}
              >
                Gửi lại mã
              </button>
            )}
            {register && <a href={carry("/verify-otp")}>Đã có mã xác minh?</a>}
          </div>
        </section>
      </main>
      <footer className="gate-caption">
        <span>MXH</span>
        <span>Mạng xã hội · Tiếng Việt</span>
      </footer>
    </div>
  );
}
