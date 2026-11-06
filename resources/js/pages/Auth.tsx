import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogIn, Box, Eye, EyeOff } from "../components/icons";
import { toast } from "sonner";
import { api, csrf } from "../lib/api";
import { ApiError } from "../lib/types";
import { Spinner } from "../components/ui";

export function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [shake, setShake] = useState(false);
    const cache = useQueryClient();
    async function login(event: React.FormEvent) {
        event.preventDefault();
        setBusy(true);
        try {
            await csrf();
            await api("/login", {
                method: "POST",
                body: JSON.stringify({ username, password }),
            });
            setPassword("");
            cache.removeQueries({
                predicate: (query) => query.queryKey[0] !== "session",
            });
            await cache.invalidateQueries();
        } catch (error) {
            const failure = error as ApiError;
            toast.error("Sign in failed", {
                description:
                    failure.errors?.username?.[0] ||
                    failure.errors?.password?.[0] ||
                    failure.message ||
                    "These credentials do not match our records.",
                duration: 5000,
            });
            setShake(true);
            setTimeout(() => setShake(false), 500);
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="login-page">
            <div className={`login-form-card ${shake ? "shake" : ""}`}>
                <div className="login-brand">
                    <span className="login-brand-icon">
                        <Box size={22} strokeWidth={2.4} />
                    </span>
                    <div className="login-brand-text">
                        <span className="brand-cargo">Cargo</span>
                        <span className="brand-core">Core</span>
                    </div>
                </div>
                <h1 className="login-title">Sign in</h1>
                <form onSubmit={login} className="login-form">
                    <div className="login-field">
                        <label htmlFor="username">Username</label>
                        <input
                            id="username"
                            autoComplete="username"
                            autoFocus
                            value={username}
                            onChange={(event) =>
                                setUsername(event.target.value.toUpperCase())
                            }
                            required
                        />
                    </div>
                    <div className="login-field">
                        <label htmlFor="password">Password</label>
                        <div className="login-password-wrap">
                            <input
                                id="password"
                                type={visible ? "text" : "password"}
                                autoComplete="current-password"
                                value={password}
                                onChange={(event) =>
                                    setPassword(event.target.value)
                                }
                                required
                            />
                            <button
                                type="button"
                                className="login-eye-btn"
                                aria-label={
                                    visible ? "Hide password" : "Show password"
                                }
                                onClick={() => setVisible(!visible)}
                            >
                                {visible ? (
                                    <EyeOff size={18} strokeWidth={1.8} />
                                ) : (
                                    <Eye size={18} strokeWidth={1.8} />
                                )}
                            </button>
                        </div>
                    </div>
                    <button
                        type="submit"
                        className="login-btn-submit"
                        disabled={busy}
                    >
                        {busy ? (
                            <Spinner />
                        ) : (
                            <LogIn size={18} strokeWidth={2.2} />
                        )}
                        <span>Sign in</span>
                    </button>
                </form>
            </div>
        </div>
    );
}
