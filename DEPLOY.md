# Nasazení LockIn na Ubuntu

Návod pro server popsaný v `honza-dev-server.md` — Hetzner CX33, Ubuntu 24.04,
4 vCPU / 8 GB RAM / 80 GB disk, IPv4 `91.99.239.107`.

Stav k 10. 9. 2026: server běží, **SSH klíče vyřešené** (root i `reyn`),
**firewall nastavený** (porty 22, 80, 443). Kroky 1 a 2 jsou tedy hotové a
jsou tu jen pro referenci — začni krokem 3.

Domény: **`lockinapi.honzacies.dev`** (API) a **`lockin.honzacies.dev`** (web).

---

## 1. Uživatel místo roota

Přihlas se jako root a založ běžný účet:

```bash
adduser honza && usermod -aG sudo honza
```

Zkopíruj mu SSH klíč:

```bash
rsync --archive --chown=honza:honza ~/.ssh /home/honza/
```

**Teď otevři druhý terminál** a ověř, že se přihlásíš jako `honza`, dřív než
zavřeš ten rootovský — jinak se můžeš zamknout venku:

```bash
ssh honza@91.99.239.107
```

Až to projde, vypni rootovské přihlašování. V `/etc/ssh/sshd_config` nastav
`PermitRootLogin no` a `PasswordAuthentication no`, pak:

```bash
sudo systemctl restart ssh
```

## 2. Firewall

Nejjednodušší je **Hetzner Cloud Firewall** přímo v konzoli — filtruje ještě
před strojem a nestojí nic. Pravidla:

| Směr | Port | Zdroj |
|---|---|---|
| in | 22 | jen tvoje IP |
| in | 80, 443 | zatím kdekoliv, po zapojení Cloudflare zúžit na jeho rozsahy |

Na stroji navíc zapni ufw jako druhou vrstvu:

```bash
sudo ufw default deny incoming && sudo ufw default allow outgoing && sudo ufw allow 22 && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw --force enable
```

> **Pozor:** Docker si standardně obchází ufw tím, že si sám píše iptables
> pravidla. Proto má `docker-compose.yml` u API `ports: "127.0.0.1:4000:4000"`
> — vazba na localhost, ne na `0.0.0.0`. Bez toho by API viselo na veřejné IP
> i s běžícím ufw.

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
```

```bash
sudo usermod -aG docker honza && newgrp docker
```

Ověř:

```bash
docker compose version
```

## 4. Kód na server

```bash
sudo mkdir -p /srv/lockin && sudo chown honza:honza /srv/lockin
```

Repozitář je na GitHubu a je **private**, takže se na něj server musí umět
autentizovat. Správná cesta je **deploy key** — čtecí klíč vázaný na jeden
repozitář, ne na celý účet. Kdyby se server kompromitoval, útočník dostane
tenhle jeden repozitář, ne všechno.

Vygeneruj klíč na serveru, bez hesla (aby `git pull` v cronu nezasekl):

```bash
ssh-keygen -t ed25519 -C "lockin-deploy" -f ~/.ssh/lockin_deploy -N ""
```

```bash
cat ~/.ssh/lockin_deploy.pub
```

Veřejnou půlku vlož na GitHubu do **`Settings → Deploy keys → Add deploy key`**
u repozitáře (ne do `Settings → SSH and GPG keys`, to je osobní klíč pro celý
účet). **„Allow write access" nech nezaškrtnuté** — server má jen číst.

Do `~/.ssh/config` přidej alias:

```
Host github-lockin
    HostName github.com
    User git
    IdentityFile ~/.ssh/lockin_deploy
    IdentitiesOnly yes
```

`IdentitiesOnly yes` je podstatné: bez něj SSH nabídne všechny klíče, co na
stroji jsou, GitHub ho odmítne dřív, než dojde na ten správný, a hlásí to jako
chybu oprávnění.

Ověř a klonuj:

```bash
ssh -T git@github-lockin
```

```bash
git clone git@github-lockin:honzacies/lockin.git /srv/lockin
```

Aktualizace v kroku 12 pak jedou bez dalšího přihlašování.

## 5. Konfigurace

```bash
cd /srv/lockin/Api && cp .env.example .env
```

Vygeneruj dva silné klíče:

```bash
openssl rand -base64 48
```

Do `Api/.env` (ten je v `.gitignore`, do repozitáře se nedostane):

```
POSTGRES_PASSWORD=<první vygenerovaný>
JWT_SECRET=<druhý vygenerovaný>
CORS_ORIGINS=https://lockin.honzacies.dev
DEFAULT_STORAGE_QUOTA_BYTES=2147483648
MAX_UPLOAD_BYTES=52428800
```

`docker-compose.yml` čte `POSTGRES_PASSWORD`, `JWT_SECRET` i `CORS_ORIGINS`
přímo z tohohle souboru a bez nich odmítne nastartovat — to je schválně, ať
nikde nezůstane výchozí heslo.

> **Schéma se změnilo se zavedením šifrování.** Pokud už na serveru běžela
> starší verze, databáze má staré tabulky a migrace na ni nesedne. Data zatím
> žádná nejsou, takže nejrychlejší je volume smazat:
>
> ```bash
> cd /srv/lockin/Api && docker compose down -v
> ```

## 6. Spuštění API

```bash
cd /srv/lockin/Api && docker compose up -d --build
```

Migrace se pouštějí samy při startu kontejneru (`prisma migrate deploy`
v `CMD`), takže se o schéma starat nemusíš. Kontrola:

```bash
docker compose logs -f api
```

```bash
curl http://127.0.0.1:4000/health
```

Má vrátit `{"ok":true,...}`.

## 7. První admin

Registrace vyžaduje invite kód a ten nemá kdo vydat, dokud neexistuje admin.
Tenhle skript ten kruh přetne:

```bash
docker compose exec api node dist/Scripts/CreateAdmin.js
```

Vypíše i první invite kód. **Opiš si ho** — v administraci pak vygeneruješ další.

> Skript je interaktivní — `docker compose exec` bez `-T` mu nechá terminál.
> Používá se přeložená verze z `dist/`, protože `tsx` je devDependency a do
> runtime vrstvy image se nekopíruje.

## 8. Web build

Web je Next server, ne statické soubory — potřebuje běžící Node proces.
Služba `web` už v `docker-compose.yml` je, takže krok 6 ji spustí spolu s API.

Dvě věci, které se u ní snadno přehlédnou:

- **Build kontext je kořen repozitáře**, ne `Api/` — web závisí na `Shared/`.
  Proto `context: ..` a `dockerfile: WebBuild/Dockerfile`.
- **`NEXT_PUBLIC_API_URL` je build arg, ne runtime proměnná.** Next ji zapéká
  do klientského bundlu při buildu. Když ji změníš, musí se web přebuildovat
  (`docker compose up -d --build web`), samotný restart nestačí.

Proto je v `.env` navíc `PUBLIC_API_URL` — compose ho předává jako build arg.

## 9. Reverzní proxy (Caddy)

Caddy si sám zařídí HTTPS certifikáty od Let's Encrypt, žádný certbot ani cron.

```bash
sudo apt install -y caddy
```

`/etc/caddy/Caddyfile`:

```
lockinapi.honzacies.dev {
    reverse_proxy 127.0.0.1:4000
}

lockin.honzacies.dev {
    reverse_proxy 127.0.0.1:3001
}
```

```bash
sudo systemctl reload caddy
```

Ostatní projekty na stroji přidáš jako další bloky — každý svoje subdoména,
každý svůj port.

## 10. Doména a Cloudflare

1. `honzacies.dev` je na Cloudflare.
2. Přidej A záznamy `lockinapi` a `lockin` na `91.99.239.107`, oba **s oranžovým
   mráčkem** (proxy zapnutá) — origin IP tak zůstane skrytá.
3. SSL/TLS režim nastav na **Full (strict)**. Flexible by znamenal
   nešifrovaný provoz mezi Cloudflare a serverem.
4. Po ověření, že to jede, zúž v Hetzner firewallu porty 80 a 443 jen na
   [rozsahy Cloudflare](https://www.cloudflare.com/ips/) — pak se na server
   nikdo nedostane mimo proxy.

## 11. Zálohy

Databáze i média. Denně, do `/srv/backups`:

```bash
sudo mkdir -p /srv/backups && sudo chown honza:honza /srv/backups
```

`/srv/lockin/backup.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
STAMP=$(date +%F)
cd /srv/lockin/Api
docker compose exec -T postgres pg_dump -U lockin lockin | gzip > "/srv/backups/db-$STAMP.sql.gz"
docker run --rm -v api_media-data:/data -v /srv/backups:/backup alpine \
  tar czf "/backup/media-$STAMP.tar.gz" -C /data .
find /srv/backups -name '*.gz' -mtime +14 -delete
```

```bash
chmod +x /srv/lockin/backup.sh
```

Do crontabu (`crontab -e`):

```
0 3 * * * /srv/lockin/backup.sh >> /var/log/lockin-backup.log 2>&1
```

**Záloha, kterou jsi nikdy neobnovil, není záloha.** Vyzkoušej si obnovu dřív,
než ji budeš potřebovat:

```bash
gunzip -c /srv/backups/db-2026-09-10.sql.gz | docker compose exec -T postgres psql -U lockin lockin
```

## 12. Aktualizace

```bash
cd /srv/lockin && git pull && cd Api && docker compose up -d --build
```

---

## Kolik to sní

Odhad pro tvůj CX33 (8 GB RAM, 80 GB disk):

| | RAM | Disk |
|---|---|---|
| Postgres | ~150–300 MB | roste s dokumenty, řádově MB |
| API (Node) | ~120–200 MB | — |
| Web (Next server) | ~150–250 MB | — |
| Média uživatelů | — | **hlavní žrout** |

Při kvótě 2 GB na uživatele je 80GB disk teoreticky plný po ~35 lidech — a to
je na něm i všechno ostatní. Administrace ti vytížení disku ukazuje; až se
bude blížit ke stropu, Hetzner Volume se dá připojit za pár eur bez výpadku.

---

## Co zbývá dodělat

Tyhle věci nejsou hotové a nasazení bez nich neproběhne celé:

1. **Žádný Dockerfile nebyl nikdy postavený.** Oba (`Api/Dockerfile`
   i `WebBuild/Dockerfile`) jsou napsané podle dokumentace, ale bez Dockeru na
   vývojovém stroji je nešlo zkusit. Počítej s tím, že první `docker compose
   up --build` bude chtít pár oprav — nejpravděpodobnější místo je kopírování
   `node_modules` v buním workspace u webu.
2. **Nic z toho neběželo proti reálné databázi.** Na vývojovém stroji není
   Docker, takže API je ověřené jen typecheckem, generováním migrace a startem
   do chvíle, než sáhne na Postgres. První `docker compose up` na serveru bude
   zároveň první ostrý test.
3. **Přihlášená větev webu netestovaná.** Anonymní režim (IndexedDB) ověřený
   v prohlížeči včetně přežití reloadu; přihlášená větev a migrace dat čekají
   na běžící API.
4. **`CreateAdmin.ts` v produkčním image.** Skript používá `tsx`, který je
   devDependency a do runtime vrstvy se nekopíruje — krok 7 nejspíš selže a
   bude potřeba buď skript přeložit, nebo ho spustit jinak.
