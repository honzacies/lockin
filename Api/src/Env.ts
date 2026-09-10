import { z } from "zod";

/**
 * Konfigurace se čte jednou při startu a hned se ověří — server radši spadne
 * okamžitě s jasnou hláškou, než aby běžel s chybějícím JWT klíčem a selhal
 * až při prvním přihlášení.
 */
const Schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL musí být nastavená"),

  /// Minimálně 32 znaků — kratší klíč je u HS256 zbytečně slabý.
  JWT_SECRET: z.string().min(32, "JWT_SECRET musí mít aspoň 32 znaků"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /// Odkud smí chodit prohlížeč. Čárkou oddělený seznam originů.
  CORS_ORIGINS: z.string().default("http://localhost:3000"),

  /// Kam se ukládají nahraná média. V Dockeru přimountovaný volume.
  MEDIA_DIR: z.string().default("./data/media"),
  /// Strop na jeden soubor. 50 MB — desktop má 250 MB, ale tam jde o vlastní
  /// disk uživatele, kdežto tady se sdílí 80GB VPS.
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(50 * 1024 * 1024),
  /// Výchozí kvóta pro nově registrovaného uživatele.
  DEFAULT_STORAGE_QUOTA_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024 * 1024),
});

const parsed = Schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Chybná konfigurace prostředí:\n${issues}`);
  process.exit(1);
}

export const Env = parsed.data;

export const CorsOrigins = Env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

export const IsProduction = Env.NODE_ENV === "production";
