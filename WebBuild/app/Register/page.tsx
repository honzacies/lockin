"use client";

import { AuthForm, AuthLink } from "@/Components/AuthForm";
import { ApiPostPublic } from "@/Platform/ApiClient";
import { SetSession, type SessionUser } from "@/Platform/Session";

export default function RegisterPage() {
  return (
    <AuthForm
      title="Create account"
      subtitle="LockIn is invite-only for now."
      submitLabel="Create account"
      fields={[
        {
          name: "username",
          label: "Username",
          type: "text",
          autoComplete: "username",
          hint: "At least 3 characters. Letters, digits and . _ - only.",
        },
        {
          name: "password",
          label: "Password",
          type: "password",
          autoComplete: "new-password",
          hint: "At least 8 characters.",
        },
        {
          name: "inviteCode",
          label: "Invite code",
          type: "text",
          placeholder: "LOCKIN-XXXX-XXXX",
        },
      ]}
      onSubmit={async (values) => {
        await ApiPostPublic("/auth/register", {
          username: values.username,
          password: values.password,
          inviteCode: values.inviteCode.trim().toUpperCase(),
        });
        // Registrace token nevrací — rovnou přihlásit, ať uživatel nemusí
        // psát údaje podruhé.
        const result = await ApiPostPublic<{
          accessToken: string;
          refreshToken: string;
          user: SessionUser;
        }>("/auth/login", {
          username: values.username,
          password: values.password,
        });
        SetSession(result.accessToken, result.refreshToken, result.user);
        window.location.href = "/YourProjects";
      }}
      footer={
        <>
          Already have an account? <AuthLink href="/Login">Sign in</AuthLink>
        </>
      }
    />
  );
}
