"use client";

import { useRouter } from "next/navigation";
import { AuthForm, AuthLink } from "@/Components/AuthForm";
import { ApiPostPublic } from "@/Platform/ApiClient";
import { SetSession, type SessionUser } from "@/Platform/Session";

export default function RegisterPage() {
  const router = useRouter();

  return (
    <AuthForm
      title="Registrace"
      subtitle="LockIn je zatím na pozvánky."
      submitLabel="Vytvořit účet"
      fields={[
        {
          name: "username",
          label: "Uživatelské jméno",
          type: "text",
          autoComplete: "username",
          hint: "Aspoň 3 znaky, jen písmena, číslice a . _ -",
        },
        {
          name: "password",
          label: "Heslo",
          type: "password",
          autoComplete: "new-password",
          hint: "Aspoň 8 znaků.",
        },
        {
          name: "inviteCode",
          label: "Invite kód",
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
          Účet už máš? <AuthLink href="/Login">Přihlas se</AuthLink>
        </>
      }
    />
  );
}
