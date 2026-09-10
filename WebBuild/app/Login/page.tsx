"use client";

import { useRouter } from "next/navigation";
import { AuthForm, AuthLink } from "@/Components/AuthForm";
import { ApiPostPublic } from "@/Platform/ApiClient";
import { SetSession, type SessionUser } from "@/Platform/Session";

export default function LoginPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Přihlášení"
      subtitle="Vítej zpátky v LockIn."
      submitLabel="Přihlásit se"
      fields={[
        { name: "username", label: "Uživatelské jméno", type: "text", autoComplete: "username" },
        { name: "password", label: "Heslo", type: "password", autoComplete: "current-password" },
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
          Nemáš účet? <AuthLink href="/Register">Zaregistruj se</AuthLink> — budeš potřebovat
          invite kód.
        </>
      }
    />
  );
}
