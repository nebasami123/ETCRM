import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { errorMessage } from "../../../api/errors";
import { useAuth } from "../../../utils/AuthContext";

export function useLogin() {
  const { login, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@etcrm.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const loggedIn = await login(email, password);
      navigate(loggedIn.role === "ADMIN" ? "/admin" : "/sales");
    } catch (err) {
      setError(errorMessage(err, "Unable to log in"));
    } finally {
      setLoading(false);
    }
  }

  function switchDemoRole() {
    setEmail(email === "admin@etcrm.local" ? "sales@etcrm.local" : "admin@etcrm.local");
  }

  return {
    user,
    isAuthenticated,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    handleSubmit,
    switchDemoRole
  };
}
