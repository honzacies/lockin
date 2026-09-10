"use client";

import { AuthForm, AuthLink } from "@/Components/AuthForm";
import { ApiPostPublic } from "@/Platform/ApiClient";
import { SetSession, type SessionUser } from "@/Platform/Session";

export default function LoginPage() {
  return (
    <AuthForm
      title="Sign in"
      subtitle="Welcome back to LockIn."
      submitLabel="Sign in"
      fields={[
        { name: "username", label: "Username", type: "text", autoComplete: "username" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]}
      onSubmit={async (values) => {
        const result = await ApiPostPublic<{
          accessToken: string;
          refreshToken: string;
          user: SessionUser;
        }>("/auth/login", {
          username: values.username,
          password: values.password,
        });
        SetSession(result.accessToken, result.refreshToken, result.user);
        // Tvrdý přechod, ne router.push — story se hydratovaly z IndexedDB a
        // musí naběhnout znovu, tentokrát z API.
        window.location.href = "/YourProjects";
      }}
      footer={
        <>
          No account yet? <AuthLink href="/Register">Create one</AuthLink> — you&apos;ll need an
          invite code.
        </>
      }
    />
  );
}
